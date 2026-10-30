<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PublicCardPreview;
use ProofPatch\Http\Controllers\CardPreviewController;
use ProofPatch\Models\LocalTaskCard;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class CardPreviewIntegrationTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();
    }

    protected function tearDown(): void
    {
        $this->teardownIsolatedDatabase();
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function request(LocalTaskCard $card, int $userId = 1, bool $grant = true): Request
    {
        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $request = Request::create('/issues/tasks/'.$card->id.'/preview', 'POST', [
            'path' => 'src/chart.js', 'commit' => str_repeat('a', 40),
        ]);
        $request->setLaravelSession($session);
        $request->attributes->set('proofpatch_github_access', [
            'userId' => $userId, 'repositories' => $grant ? ['example/project' => true] : [],
        ]);
        return $request;
    }

    private function card(): LocalTaskCard
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1;
        $card->repository = 'example/project';
        $card->title = 'Fix chart';
        $card->description = 'Make the quantity chart readable.';
        $card->status = 'queued';
        $card->image_bytes = 'private image bytes';
        $card->image_mime = 'image/png';
        $card->save();
        return $card;
    }

    private function controller(array &$calls): CardPreviewController
    {
        $repo = ['full_name' => 'example/project', 'private' => false, 'visibility' => 'public'];
        $file = ['type' => 'file', 'path' => 'src/chart.js', 'encoding' => 'base64', 'size' => 2, 'content' => base64_encode('ok')];
        $responses = [$repo, ['sha' => str_repeat('a', 40)], $file, $repo];
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$responses, &$calls): MockResponse {
            $calls[] = $url;
            self::assertSame('GET', $method);
            self::assertStringStartsWith('https://api.github.com/repos/example/project', $url);
            self::assertArrayNotHasKey('body', $options);
            if (!$responses) self::fail('Unexpected request.');
            return new MockResponse(json_encode(array_shift($responses), JSON_THROW_ON_ERROR));
        });
        return new CardPreviewController(new PublicCardPreview($client));
    }

    public function testAuthorizedPreviewPreservesRealCardAndInvalidatesAfterEditOrGrantRevocation(): void
    {
        $card = $this->card();
        $request = $this->request($card);
        $calls = [];
        $response = $this->controller($calls)->store($request, $card->id);
        self::assertTrue($response->isRedirection());
        self::assertSame('Preview ready. Nothing was sent to a model.', $request->session()->get('success'));
        $visible = CardPreviewController::visiblePreview($request);
        self::assertSame('Fix chart', $visible['context']['title']);
        self::assertSame('Make the quantity chart readable.', $visible['context']['description']);
        self::assertSame('ok', $visible['context']['source']);
        self::assertSame('local_preview_not_sent', $visible['status']);
        self::assertArrayNotHasKey('image', $visible['context']);
        self::assertStringNotContainsString('private image bytes', json_encode($visible, JSON_THROW_ON_ERROR));
        self::assertSame(4, count($calls));
        $request->attributes->set('proofpatch_github_access', ['userId' => 1, 'repositories' => []]);
        self::assertNull(CardPreviewController::visiblePreview($request));
        $request->attributes->set('proofpatch_github_access', ['userId' => 1, 'repositories' => ['example/project' => true]]);
        $this->controller($calls)->store($request, $card->id);
        self::assertNotNull(CardPreviewController::visiblePreview($request));
        $card->description = 'Changed while preview is open.';
        $card->save();
        self::assertNull(CardPreviewController::visiblePreview($request));
        self::assertNull($request->session()->get('card_preview'));
    }

    public function testUnownedOrRevokedCardNeverFetchesOrDisplaysContext(): void
    {
        $card = $this->card();
        foreach ([[2, true], [1, false]] as [$userId, $grant]) {
            $request = $this->request($card, $userId, $grant);
            $calls = [];
            $this->controller($calls)->store($request, $card->id);
            self::assertSame([], $calls);
            self::assertNull(CardPreviewController::visiblePreview($request));
            self::assertStringContainsString('access is unavailable', $request->session()->get('error'));
        }
    }
}
