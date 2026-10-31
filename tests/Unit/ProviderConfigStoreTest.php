<?php

declare(strict_types=1);

namespace Tests\Unit;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\Credentials;
use ProofPatch\Agent\IssueSuggestion;
use ProofPatch\Agent\ProviderConfigStore;
use ProofPatch\Agent\PullRequestReview;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Http\Controllers\DashboardController;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class ProviderConfigStoreTest extends TestCase
{
    private string $tempDir;
    private ?string $oldHome = null;
    private ?string $oldConfigOverride = null;
    private ?string $oldBasetenEnv = null;
    private ?string $oldMetaEnv = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tempDir = sys_get_temp_dir() . '/proofpatch-provider-cfg-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0700, true);

        $this->oldHome = getenv('HOME') !== false ? (string) getenv('HOME') : null;
        $this->oldConfigOverride = getenv('PROOFPATCH_PROVIDER_CONFIG_FILE') !== false ? (string) getenv('PROOFPATCH_PROVIDER_CONFIG_FILE') : null;
        $this->oldBasetenEnv = getenv('BASETEN_API_KEY') !== false ? (string) getenv('BASETEN_API_KEY') : null;
        $this->oldMetaEnv = getenv('META_MODEL_API_KEY') !== false ? (string) getenv('META_MODEL_API_KEY') : null;

        putenv('HOME=' . $this->tempDir);
        putenv('PROOFPATCH_PROVIDER_CONFIG_FILE=' . $this->tempDir . '/.config/proofpatch/provider_config.enc');
        putenv('BASETEN_API_KEY');
        putenv('META_MODEL_API_KEY');
        putenv('MODEL_API_KEY');
    }

    protected function tearDown(): void
    {
        $this->oldHome !== null ? putenv('HOME=' . $this->oldHome) : putenv('HOME');
        $this->oldConfigOverride !== null ? putenv('PROOFPATCH_PROVIDER_CONFIG_FILE=' . $this->oldConfigOverride) : putenv('PROOFPATCH_PROVIDER_CONFIG_FILE');
        $this->oldBasetenEnv !== null ? putenv('BASETEN_API_KEY=' . $this->oldBasetenEnv) : putenv('BASETEN_API_KEY');
        $this->oldMetaEnv !== null ? putenv('META_MODEL_API_KEY=' . $this->oldMetaEnv) : putenv('META_MODEL_API_KEY');

        $cfgFile = $this->tempDir . '/.config/proofpatch/provider_config.enc';
        if (is_file($cfgFile) || is_link($cfgFile)) {
            @unlink($cfgFile);
        }
        @rmdir($this->tempDir . '/.config/proofpatch');
        @rmdir($this->tempDir . '/.config');
        @rmdir($this->tempDir);
        parent::tearDown();
    }

    public function testSaveReplaceRemoveAndNeverLeakSecretInDiskPlaintextOrStatusProps(): void
    {
        $secretBaseten = 'baseten_live_secret_token_9988776655';
        $secretMeta = 'meta_model_api_secret_token_1122334455';

        ProviderConfigStore::saveKey('baseten', $secretBaseten);
        ProviderConfigStore::saveKey('meta', $secretMeta);

        $path = ProviderConfigStore::getStoragePath();
        self::assertNotNull($path);
        self::assertFileExists($path);
        self::assertSame(0600, fileperms($path) & 0777);

        // Plaintext secret must never appear in the file on disk
        $rawDisk = (string) file_get_contents($path);
        self::assertStringNotContainsString($secretBaseten, $rawDisk);
        self::assertStringNotContainsString($secretMeta, $rawDisk);

        // Status returned to UI must never contain raw or partial secrets
        $status = ProviderConfigStore::status();
        $statusJson = json_encode($status, JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString($secretBaseten, $statusJson);
        self::assertStringNotContainsString($secretMeta, $statusJson);
        self::assertTrue($status['providers']['baseten']['configured']);
        self::assertTrue($status['providers']['meta']['configured']);
        self::assertSame('settings_encrypted', $status['providers']['baseten']['source']);
        self::assertSame('settings_encrypted', $status['providers']['meta']['source']);

        // Replace key
        $replacementMeta = 'meta_replaced_secret_token_abcde12345';
        ProviderConfigStore::saveKey('meta', $replacementMeta);
        ProviderConfigStore::selectActive('meta', 'muse-spark-1.3');
        self::assertSame($replacementMeta, Credentials::activeKey());
        self::assertSame($replacementMeta, Credentials::baseten());

        // Remove key
        ProviderConfigStore::removeKey('meta');
        $statusAfter = ProviderConfigStore::status();
        self::assertFalse($statusAfter['providers']['meta']['configured']);
        self::assertFalse($statusAfter['activeKeyAvailable']);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Meta Model API key');
        Credentials::activeKey();
    }

    public function testProviderSwitchingChangesActualEndToEndAgentRequestsAndValidatesModel(): void
    {
        $metaSecret = 'meta_api_key_for_end_to_end_test_12345';
        ProviderConfigStore::saveKey('meta', $metaSecret);
        ProviderConfigStore::selectActive('meta', 'muse-spark-1.3');

        $target = Credentials::activeTarget();
        self::assertSame('meta', $target['provider']);
        self::assertSame('https://api.meta.ai/v1/chat/completions', $target['endpoint']);
        self::assertSame('muse-spark-1.3', $target['model']);

        // Verify IssueSuggestion preview and propose use Meta Model API endpoint and muse-spark-1.3
        $budgetDir = $this->tempDir . '/budget';
        mkdir($budgetDir, 0700, true);
        $budget = new RequestBudget($budgetDir, 500000, 10);

        $capturedUrl = null;
        $capturedPayload = null;
        $mockHttp = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedUrl, &$capturedPayload): MockResponse {
            $capturedUrl = $url;
            $capturedPayload = json_decode((string) ($options['body'] ?? '{}'), true);
            return new MockResponse(json_encode([
                'model' => 'muse-spark-1.3',
                'choices' => [[
                    'finish_reason' => 'stop',
                    'message' => [
                        'content' => json_encode([
                            'path' => 'src/OrderTotal.php',
                            'find' => 'max(1, $qty)',
                            'replace' => 'max(0, $qty)',
                            'explanation' => 'Allow zero quantity in calculation.',
                        ]),
                    ],
                ]],
                'usage' => ['prompt_tokens' => 120, 'completion_tokens' => 45],
            ]));
        });

        $source = "<?php\nfunction total(int \$qty): int {\n    return 100 * max(1, \$qty);\n}\n";
        $context = [
            'isSynthetic' => true,
            'provenance' => 'Local synthetic test fixture',
            'repository' => 'synthetic-fixture/order-total',
            'issueNumber' => 101,
            'issueUrl' => null,
            'title' => 'Zero quantity bug',
            'body' => 'Items with zero quantity should return 0.',
            'commit' => null,
            'path' => 'src/OrderTotal.php',
            'source' => $source,
            'sourceSha256' => hash('sha256', $source),
        ];

        $agent = new IssueSuggestion($mockHttp, $budget);
        $preview = $agent->preview($context);

        self::assertSame('https://api.meta.ai/v1/chat/completions', $preview['destination']);
        self::assertSame('muse-spark-1.3', $preview['body']['model']);

        $result = $agent->propose($context, $preview['digest'], Credentials::activeKey());
        self::assertSame('https://api.meta.ai/v1/chat/completions', $capturedUrl);
        self::assertSame('muse-spark-1.3', $capturedPayload['model'] ?? null);
        self::assertSame('muse-spark-1.3', $result['model']);

        // Also verify PullRequestReview preview targets Meta Model API when active
        $prAgent = new PullRequestReview($mockHttp, $budget);
        $pull = [
            'repository' => 'prateekbhujel/proofpatch-review-demo',
            'number' => 1,
            'title' => 'Demo PR',
            'state' => 'open',
            'baseSha' => str_repeat('1', 40),
            'headSha' => str_repeat('2', 40),
            'isPrivate' => false,
        ];
        $patchPreview = [
            'repository' => 'prateekbhujel/proofpatch-review-demo',
            'number' => 1,
            'baseSha' => str_repeat('1', 40),
            'headSha' => str_repeat('2', 40),
            'isPrivate' => false,
            'files' => [
                ['name' => 'order_total.php', 'status' => 'available', 'patch' => "@@ -1,3 +1,3 @@\n-return 1;\n+return 0;"],
            ],
        ];
        $prPreview = $prAgent->preview($pull, $patchPreview);
        self::assertSame('https://api.meta.ai/v1/chat/completions', $prPreview['destination']);
        self::assertSame('muse-spark-1.3', $prPreview['body']['model']);

        foreach (glob($budgetDir . '/*') ?: [] as $f) {
            @unlink($f);
        }
        @rmdir($budgetDir);
    }

    public function testBlocksModalInferenceAndMetaContributorModeAndInvalidKeys(): void
    {
        // 1. Modal must be rejected as an LLM inference provider
        try {
            ProviderConfigStore::selectActive('modal', 'muse-spark-1.3');
            self::fail('Expected InvalidArgumentException for modal provider.');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('gVisor microVM sandbox execution', $e->getMessage());
        }

        // 2. Meta Contributor mode must be blocked for code privacy
        try {
            ProviderConfigStore::selectActive('meta', 'muse-spark-1.3-contributor');
            self::fail('Expected InvalidArgumentException for contributor mode model.');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('Contributor Mode models are blocked', $e->getMessage());
        }

        // 3. Short or whitespace keys must be rejected
        try {
            ProviderConfigStore::saveKey('baseten', 'short_key');
            self::fail('Expected InvalidArgumentException for short key.');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('between 16 and 4096', $e->getMessage());
        }

        try {
            ProviderConfigStore::saveKey('meta', "key_with_spaces_1234567890 abcdef");
            self::fail('Expected InvalidArgumentException for whitespace key.');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('printable non-whitespace', $e->getMessage());
        }
    }

    public function testWorldReadableConfigFileFailsClosed(): void
    {
        ProviderConfigStore::saveKey('baseten', 'baseten_valid_secret_key_1234567890');
        $path = ProviderConfigStore::getStoragePath();
        self::assertNotNull($path);
        chmod($path, 0644); // Insecure group/world readable permissions

        $status = ProviderConfigStore::status();
        self::assertFalse($status['providers']['baseten']['configured']);
    }
}
