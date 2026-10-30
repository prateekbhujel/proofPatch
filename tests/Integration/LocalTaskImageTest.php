<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Response;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\GitHubAppClient;
use ProofPatch\Http\Controllers\LocalTaskImageController;
use ProofPatch\Http\Middleware\AuthorizeGithubTasks;
use ProofPatch\Models\LocalTaskCard;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class LocalTaskImageTest extends TestCase
{
    use InteractsWithIsolatedDatabase;
    private array $temporaryFiles = [];

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();
    }

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $path) @unlink($path);
        $this->teardownIsolatedDatabase();
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function card(): LocalTaskCard
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1;
        $card->repository = 'owner/private-repo';
        $card->title = 'Task';
        $card->description = 'Details';
        $card->status = 'queued';
        $card->save();
        return $card;
    }

    private function middleware(int $user, bool $grant): AuthorizeGithubTasks
    {
        $responses = [
            new MockResponse(json_encode(['id' => $user, 'login' => 'user'.$user])),
            new MockResponse(json_encode(['installations' => $grant ? [['id' => 101]] : []])),
        ];
        if ($grant) {
            $responses[] = new MockResponse(json_encode(['repositories' => [[
                'id' => 5, 'name' => 'private-repo', 'full_name' => 'owner/private-repo',
                'owner' => ['login' => 'owner'], 'private' => true,
            ]]]));
        }
        return new AuthorizeGithubTasks(new GitHubAppClient(new MockHttpClient($responses)));
    }

    private function request(string $method, int $id, ?int $user, ?UploadedFile $image = null): Request
    {
        $session = app('session')->driver('array');
        if ($user !== null) $session->put('github_auth', ['token' => 'fake-token', 'user' => ['id' => $user]]);
        app('redirect')->setSession($session);
        $request = Request::create('/issues/tasks/'.$id.'/image', $method, [], [], $image ? ['image' => $image] : []);
        $request->setLaravelSession($session);
        return $request;
    }

    private function upload(string $bytes, string $name = 'screenshot.png', string $mime = 'image/png'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'pp-image-');
        $this->temporaryFiles[] = $path;
        file_put_contents($path, $bytes);
        return new UploadedFile($path, $name, $mime, null, true);
    }

    private function png(): string
    {
        $image = imagecreatetruecolor(2, 2);
        imagefill($image, 0, 0, imagecolorallocate($image, 255, 0, 0));
        ob_start();
        imagepng($image);
        $bytes = (string) ob_get_clean();
        imagedestroy($image);
        return $bytes;
    }

    public function testOwnerCanAddAndViewImageWithoutExposingItInCardProps(): void
    {
        $card = $this->card();
        $bytes = $this->png();
        $request = $this->request('POST', $card->id, 1, $this->upload($bytes));
        $this->middleware(1, true)->handle($request, fn (Request $r) => (new LocalTaskImageController())->store($r, $card->id));
        self::assertSame('Image saved.', $request->session()->get('success'));
        $card->refresh();
        self::assertSame($bytes, $card->image_bytes);
        self::assertTrue($card->toBoardArray()['hasImage']);
        self::assertArrayNotHasKey('image_bytes', $card->toBoardArray());

        $get = $this->request('GET', $card->id, 1);
        $response = $this->middleware(1, true)->handle($get, fn (Request $r) => (new LocalTaskImageController())->show($r, $card->id));
        self::assertSame(200, $response->getStatusCode());
        self::assertSame($bytes, $response->getContent());
        self::assertSame('image/png', $response->headers->get('Content-Type'));
        self::assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        self::assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
    }

    public function testRevokedOtherUserAndAnonymousCannotReadOrReplace(): void
    {
        $card = $this->card();
        $card->image_bytes = $this->png();
        $card->image_mime = 'image/png';
        $card->save();
        $original = $card->image_bytes;
        foreach ([[1, false], [2, true], [null, false]] as [$user, $grant]) {
            $get = $this->request('GET', $card->id, $user);
            $response = $this->middleware($user ?? 1, $grant)->handle($get, fn (Request $r) => (new LocalTaskImageController())->show($r, $card->id));
            self::assertSame(404, $response->getStatusCode());
            self::assertStringNotContainsString($original, (string) $response->getContent());
            $post = $this->request('POST', $card->id, $user, $this->upload($this->png()));
            $this->middleware($user ?? 1, $grant)->handle($post, fn (Request $r) => (new LocalTaskImageController())->store($r, $card->id));
            self::assertSame('Task not found or access is unavailable.', $post->session()->get('error'));
        }
        self::assertSame($original, $card->fresh()->image_bytes);
    }

    public function testAnonymousRealRouteCannotReadImage(): void
    {
        $card = $this->card();
        $card->image_bytes = $this->png();
        $card->image_mime = 'image/png';
        $card->save();
        $request = Request::create('/issues/tasks/'.$card->id.'/image', 'GET');
        $kernel = app(\Illuminate\Contracts\Http\Kernel::class);
        $response = $kernel->handle($request);
        try {
            self::assertSame(404, $response->getStatusCode());
            self::assertStringNotContainsString($card->image_bytes, (string) $response->getContent());
        } finally {
            $kernel->terminate($request, $response);
        }
    }

    public function testJpegDetectedFromContentsInsteadOfFilename(): void
    {
        $card = $this->card();
        $image = imagecreatetruecolor(2, 2);
        ob_start();
        imagejpeg($image);
        $bytes = (string) ob_get_clean();
        imagedestroy($image);
        $request = $this->request('POST', $card->id, 1, $this->upload($bytes, 'not-jpeg.png', 'image/png'));
        $this->middleware(1, true)->handle($request, fn (Request $r) => (new LocalTaskImageController())->store($r, $card->id));
        self::assertSame('Image saved.', $request->session()->get('success'));
        self::assertSame('image/jpeg', $card->fresh()->image_mime);
    }

    public function testInvalidOversizedAndReplacementImagesAreRejected(): void
    {
        $card = $this->card();
        foreach ([$this->upload('not an image'), $this->upload(str_repeat('x', 2_000_001))] as $file) {
            $request = $this->request('POST', $card->id, 1, $file);
            $this->middleware(1, true)->handle($request, fn (Request $r) => (new LocalTaskImageController())->store($r, $card->id));
            self::assertNotNull($request->session()->get('error'));
            self::assertNull($card->fresh()->image_bytes);
        }
        $card->image_bytes = $this->png();
        $card->image_mime = 'image/png';
        $card->save();
        $original = $card->image_bytes;
        $request = $this->request('POST', $card->id, 1, $this->upload($this->png()));
        $this->middleware(1, true)->handle($request, fn (Request $r) => (new LocalTaskImageController())->store($r, $card->id));
        self::assertSame('This task already has an image.', $request->session()->get('error'));
        self::assertSame($original, $card->fresh()->image_bytes);
    }
}
