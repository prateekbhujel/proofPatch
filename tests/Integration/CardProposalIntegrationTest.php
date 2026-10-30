<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Agent\SingleUseReviewApproval;
use ProofPatch\GitHub\PublicCardPreview;
use ProofPatch\Http\Controllers\CardPreviewController;
use ProofPatch\Http\Controllers\CardProposalController;
use ProofPatch\Models\LocalTaskCard;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class CardProposalIntegrationTest extends TestCase
{
    use InteractsWithIsolatedDatabase;
    private string $dir;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();
        $this->dir = sys_get_temp_dir().'/proofpatch-card-flow-'.bin2hex(random_bytes(8));
        mkdir($this->dir, 0700);
    }
    protected function tearDown(): void
    {
        foreach (glob($this->dir.'/approvals/*') ?: [] as $file) @unlink($file);
        @rmdir($this->dir.'/approvals');
        foreach (glob($this->dir.'/*') ?: [] as $file) @unlink($file);
        @rmdir($this->dir);
        $this->teardownIsolatedDatabase();
        @restore_error_handler(); @restore_exception_handler();
    }
    private function card(): LocalTaskCard
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1; $card->repository = 'example/project';
        $card->title = 'Fix chart'; $card->description = 'Change the quantity from one to two.'; $card->status = 'queued';
        $card->image_bytes = 'private screenshot'; $card->image_mime = 'image/png'; $card->save();
        return $card;
    }
    private function request(LocalTaskCard $card, string $path, array $data = []): Request
    {
        $session = app('session')->driver('array');
        $session->put('github_auth', ['token' => 'fake-github-token', 'user' => ['id' => 1]]);
        app('redirect')->setSession($session);
        $request = Request::create($path, 'POST', $data);
        $request->setLaravelSession($session);
        $request->attributes->set('proofpatch_github_access', ['userId' => 1, 'repositories' => ['example/project' => true]]);
        return $request;
    }
    private function client(array &$calls, string $mode = 'normal'): MockHttpClient
    {
        $installs = 0;
        return new MockHttpClient(function (string $method, string $url, array $options) use (&$calls, &$installs, $mode): MockResponse {
            $calls[] = [$method, $url];
            $repo = ['full_name' => 'example/project', 'private' => false, 'visibility' => 'public', 'id' => 4, 'name' => 'project', 'owner' => ['login' => 'example']];
            $source = 'const quantity = 1;';
            if ($url === 'https://api.github.com/user') $body = ['id' => 1, 'login' => 'user'];
            elseif (str_starts_with($url, 'https://api.github.com/user/installations?')) {
                $installs++;
                $body = ['installations' => ($mode === 'revoke' && $installs >= 2) ? [] : [['id' => 5]]];
            } elseif (str_starts_with($url, 'https://api.github.com/user/installations/5/repositories?')) $body = ['repositories' => [$repo]];
            elseif ($url === 'https://api.github.com/repos/example/project') $body = $mode === 'private' ? array_replace($repo, ['private' => true, 'visibility' => 'private']) : $repo;
            elseif (str_contains($url, '/commits/')) $body = ['sha' => str_repeat('a', 40)];
            elseif (str_contains($url, '/contents/')) $body = ['type' => 'file', 'path' => 'src/chart.js', 'encoding' => 'base64', 'size' => strlen($source), 'content' => base64_encode($source)];
            elseif ($url === 'https://inference.baseten.co/v1/chat/completions') {
                if ($mode === 'failed') return new MockResponse('{}', ['http_code' => 500]);
                self::assertSame('POST', $method);
                $sent = json_decode($options['body'], true, 64, JSON_THROW_ON_ERROR);
                self::assertStringContainsString('Change the quantity from one to two.', $sent['messages'][1]['content']);
                self::assertStringNotContainsString('private screenshot', $sent['messages'][1]['content']);
                $stored = DB::table('card_proposal_reservations')->first();
                self::assertNotNull($stored);
                self::assertSame('reserved', $stored->status);
                self::assertEquals($sent, json_decode($stored->payload, true, 64, JSON_THROW_ON_ERROR)['body']);
                // A different DB connection can edit during inference, but cannot alter reserved payload.
                $pdo = new \PDO('sqlite:'.config('database.connections.sqlite.database'));
                $pdo->exec('PRAGMA busy_timeout = 0');
                $pdo->exec("UPDATE local_task_cards SET description = 'Later edit' WHERE id = ".(int) $stored->card_id);
                $body = ['model' => 'meta-models/muse-spark-open-1026', 'choices' => [[
                    'finish_reason' => 'stop', 'message' => ['content' => json_encode(['path' => 'src/chart.js',
                        'find' => 'quantity = 1', 'replace' => 'quantity = 2', 'explanation' => 'Fix quantity.'], JSON_THROW_ON_ERROR)],
                ]], 'usage' => ['prompt_tokens' => 20, 'completion_tokens' => 10]];
            } else self::fail('Unexpected URL '.$url);
            return new MockResponse(json_encode($body, JSON_THROW_ON_ERROR));
        });
    }
    private function setupPreview(LocalTaskCard $card, Request $request): void
    {
        $calls = [];
        $request->merge(['path' => 'src/chart.js', 'commit' => str_repeat('a', 40)]);
        (new CardPreviewController(new PublicCardPreview($this->client($calls))))->store($request, (int) $card->id);
        self::assertNotNull(CardPreviewController::visiblePreview($request));
    }
    private function controller(MockHttpClient $client): CardProposalController
    {
        return new CardProposalController($client, new RequestBudget($this->dir, 100000, 2),
            new SingleUseReviewApproval($this->dir.'/approvals'), 'test-provider-key-12345');
    }
    public function testApprovedSnapshotSurvivesLaterEditsAndCannotBeReplayed(): void
    {
        $card = $this->card(); $request = $this->request($card, '/issues/tasks/'.$card->id.'/model-send');
        $this->setupPreview($card, $request); $calls = []; $controller = $this->controller($this->client($calls));
        $controller->prepare($request, (int) $card->id);
        $payload = $request->session()->get('card_proposal_preview');
        self::assertIsArray($payload); self::assertStringContainsString('Change the quantity', $payload['body']['messages'][1]['content']);
        $request->merge(['approved' => true, 'digest' => $payload['digest']]);
        $controller->send($request, (int) $card->id);
        $result = $request->session()->get('card_proposal_result');
        self::assertSame('unverified_suggestion', $result['status']);
        self::assertFalse($result['candidate']['verified']); self::assertFalse($result['candidate']['applied']);
        self::assertSame('completed', DB::table('card_proposal_reservations')->value('status'));
        self::assertSame('Later edit', $card->fresh()->description);
        $request->session()->put('card_proposal_preview', $payload);
        $controller->send($request, (int) $card->id);
        self::assertCount(1, array_filter($calls, static fn ($call) => $call[0] === 'POST'));
    }
    public function testRevokedGrantNeverReachesProvider(): void
    {
        $card = $this->card(); $request = $this->request($card, '/issues/tasks/'.$card->id.'/model-send');
        $this->setupPreview($card, $request); $calls = []; $controller = $this->controller($this->client($calls, 'revoke'));
        $controller->prepare($request, (int) $card->id);
        $payload = $request->session()->get('card_proposal_preview');
        $request->merge(['approved' => true, 'digest' => $payload['digest']]);
        $controller->send($request, (int) $card->id);
        self::assertSame(0, DB::table('card_proposal_reservations')->count());
        self::assertCount(0, array_filter($calls, static fn ($call) => $call[0] === 'POST'));
    }
    public function testNoConsentOrPrivateVisibilityDoesNotReachProvider(): void
    {
        $card = $this->card(); $request = $this->request($card, '/issues/tasks/'.$card->id.'/model-send');
        $this->setupPreview($card, $request); $calls = []; $controller = $this->controller($this->client($calls, 'private'));
        $controller->prepare($request, (int) $card->id);
        $payload = $request->session()->get('card_proposal_preview');
        $request->merge(['approved' => false, 'digest' => $payload['digest']]);
        $controller->send($request, (int) $card->id);
        self::assertSame([], $calls);
        $request->merge(['approved' => true]);
        $controller->send($request, (int) $card->id);
        self::assertCount(0, array_filter($calls, static fn ($call) => $call[0] === 'POST'));
        self::assertSame(0, DB::table('card_proposal_reservations')->count());
    }

    public function testFailedProviderCallIsUncertainAndNeverAutomaticallyRetried(): void
    {
        $card = $this->card(); $request = $this->request($card, '/issues/tasks/'.$card->id.'/model-send');
        $this->setupPreview($card, $request); $calls = []; $controller = $this->controller($this->client($calls, 'failed'));
        $controller->prepare($request, (int) $card->id);
        $payload = $request->session()->get('card_proposal_preview');
        $request->merge(['approved' => true, 'digest' => $payload['digest']]);
        $controller->send($request, (int) $card->id);
        self::assertSame('uncertain', DB::table('card_proposal_reservations')->value('status'));
        self::assertStringContainsString('may have used credits', $request->session()->get('error'));
        self::assertNull($request->session()->get('card_proposal_preview'));
        $controller->send($request, (int) $card->id);
        self::assertCount(1, array_filter($calls, static fn ($call) => $call[0] === 'POST'));
    }

}
