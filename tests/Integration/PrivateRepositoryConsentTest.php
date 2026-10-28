<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\PullRequestReview;
use ProofPatch\Agent\RequestBudget;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PrivateRepositoryConsentTest extends TestCase
{
    private string $tempDir;
    private RequestBudget $budget;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir().'/proofpatch_private_consent_test_'.bin2hex(random_bytes(6));
        $this->budget = new RequestBudget($this->tempDir, 200000, 5);
    }

    protected function tearDown(): void
    {
        $ledger = $this->tempDir.'/runtime-ledger.json';
        if (file_exists($ledger)) {
            @unlink($ledger);
        }
        if (is_dir($this->tempDir)) {
            @rmdir($this->tempDir);
        }
    }

    private function privatePull(): array
    {
        return [
            'repository' => 'pratikbhujel/secret-repo',
            'number' => 7,
            'title' => 'Proprietary billing logic upgrade',
            'headSha' => '1111111111111111111111111111111111111111',
            'baseSha' => '2222222222222222222222222222222222222222',
            'isPrivate' => true,
        ];
    }

    private function privatePatchPreview(): array
    {
        return [
            'repository' => 'pratikbhujel/secret-repo',
            'number' => 7,
            'headSha' => '1111111111111111111111111111111111111111',
            'baseSha' => '2222222222222222222222222222222222222222',
            'isPrivate' => true,
            'changedFiles' => 1,
            'filesTruncated' => false,
            'files' => [
                [
                    'name' => 'src/Billing.php',
                    'status' => 'available',
                    'patch' => "@@ -1,3 +1,3 @@\n-<?php echo 1;\n+<?php echo 2;\n",
                ],
            ],
        ];
    }

    private function mockModelSuccessResponse(string $path = 'src/Billing.php'): MockResponse
    {
        return new MockResponse(json_encode([
            'id' => 'chatcmpl-test',
            'object' => 'chat.completion',
            'model' => PullRequestReview::MODEL,
            'choices' => [
                [
                    'index' => 0,
                    'finish_reason' => 'stop',
                    'message' => [
                        'role' => 'assistant',
                        'content' => json_encode([
                            'summary' => 'Update verified.',
                            'riskLevel' => 'low',
                            'recommendation' => 'approve',
                            'fileFindings' => [
                                [
                                    'path' => $path,
                                    'status' => 'approval',
                                    'lineHint' => 2,
                                    'comment' => 'Clean update.',
                                ],
                            ],
                        ]),
                    ],
                ],
            ],
            'usage' => [
                'prompt_tokens' => 120,
                'completion_tokens' => 45,
                'total_tokens' => 165,
            ],
        ]));
    }

    public function testPrivatePullRequestFailsClosedWithoutExplicitConsent(): void
    {
        $pull = $this->privatePull();
        $preview = $this->privatePatchPreview();

        $http = new MockHttpClient([$this->mockModelSuccessResponse('src/Billing.php')]);
        $agent = new PullRequestReview($http, $this->budget);

        $previewData = $agent->preview($pull, $preview);
        $this->assertTrue($previewData['isPrivate']);

        $key = 'baseten_key_test_1234567890abcdef';

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Explicit maintainer consent is required to transmit private repository content to third-party model inference.');

        // Attempting to execute with privateConsent = false (default)
        $agent->review($pull, $preview, $previewData['digest'], $key, false);
    }

    public function testPrivatePullRequestAllowedWithExplicitConsent(): void
    {
        $pull = $this->privatePull();
        $preview = $this->privatePatchPreview();

        $http = new MockHttpClient([$this->mockModelSuccessResponse('src/Billing.php')]);
        $agent = new PullRequestReview($http, $this->budget);

        $previewData = $agent->preview($pull, $preview);
        $this->assertTrue($previewData['isPrivate']);

        $key = 'baseten_key_test_1234567890abcdef';

        // Executing with privateConsent = true
        $result = $agent->review($pull, $preview, $previewData['digest'], $key, true);

        $this->assertSame('Update verified.', $result['summary']);
        $this->assertSame('low', $result['riskLevel']);
        $this->assertSame('approve', $result['recommendation']);
    }

    public function testPublicPullRequestDoesNotRequirePrivateConsent(): void
    {
        $pull = [
            'repository' => 'pratikbhujel/public-repo',
            'number' => 1,
            'title' => 'Open source fix',
            'headSha' => '1111111111111111111111111111111111111111',
            'baseSha' => '2222222222222222222222222222222222222222',
            'isPrivate' => false,
        ];
        $preview = [
            'repository' => 'pratikbhujel/public-repo',
            'number' => 1,
            'headSha' => '1111111111111111111111111111111111111111',
            'baseSha' => '2222222222222222222222222222222222222222',
            'isPrivate' => false,
            'changedFiles' => 1,
            'filesTruncated' => false,
            'files' => [
                [
                    'name' => 'readme.md',
                    'status' => 'available',
                    'patch' => "@@ -1,2 +1,2 @@\n-Hello\n+World\n",
                ],
            ],
        ];

        $http = new MockHttpClient([$this->mockModelSuccessResponse('readme.md')]);
        $agent = new PullRequestReview($http, $this->budget);

        $previewData = $agent->preview($pull, $preview);
        $this->assertFalse($previewData['isPrivate']);

        $key = 'baseten_key_test_1234567890abcdef';

        // privateConsent is false, but PR is public, so it succeeds
        $result = $agent->review($pull, $preview, $previewData['digest'], $key, false);

        $this->assertSame('approve', $result['recommendation']);
    }
}
