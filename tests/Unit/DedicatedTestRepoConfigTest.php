<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\DedicatedTestRepo;
use ProofPatch\GitHub\DedicatedTestRepoFetcher;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\GitHub\ServerHeldPublicationApproval;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class DedicatedTestRepoConfigTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('PROOFPATCH_TEST_REPO=example-owner/proofpatch-test');
        putenv('PROOFPATCH_TEST_BASE_COMMIT=' . str_repeat('a', 40));
    }

    public function testInvalidOrMissingRepositoryAndCommitAreRejectedBeforeNetwork(): void
    {
        $calls = 0;
        $http = new MockHttpClient(static function () use (&$calls): MockResponse {
            $calls++;
            return new MockResponse('{}');
        });

        foreach (['', 'owner', '../repo', 'https://github.com/owner/repo', 'owner/../repo', 'owner/repo?x=1'] as $repo) {
            putenv('PROOFPATCH_TEST_REPO=' . $repo);
            self::assertNull(DedicatedTestRepo::name());
            try {
                (new DedicatedTestRepoFetcher($http))->fetchAndVerify('test-token');
                self::fail('Invalid repository was accepted.');
            } catch (\RuntimeException $e) {
                self::assertStringContainsString('not configured', $e->getMessage());
            }
        }

        putenv('PROOFPATCH_TEST_REPO=example-owner/proofpatch-test');
        foreach (['', 'not-a-sha', str_repeat('A', 40)] as $sha) {
            putenv('PROOFPATCH_TEST_BASE_COMMIT=' . $sha);
            try {
                (new DedicatedTestRepoFetcher($http))->fetchAndVerify('test-token');
                self::fail('Invalid base commit was accepted.');
            } catch (\RuntimeException $e) {
                self::assertStringContainsString('base commit is not configured', $e->getMessage());
            }
        }
        self::assertSame(0, $calls);
    }

    public function testPublisherRejectsRepositoryMismatchBeforeNetwork(): void
    {
        $dir = sys_get_temp_dir() . '/proofpatch-config-' . bin2hex(random_bytes(6));
        $calls = 0;
        $http = new MockHttpClient(static function () use (&$calls): MockResponse {
            $calls++;
            return new MockResponse('{}');
        });
        try {
            $store = new ServerHeldPublicationApproval($dir, 'test-secret');
            $publisher = new DedicatedTestRepoPublisher($store, $http, disconnected: false);
            try {
                $publisher->publishDraftPr(['repository' => 'other-owner/other-repo'], '/nonexistent', '');
                self::fail('Mismatched repository was accepted.');
            } catch (\InvalidArgumentException $e) {
                self::assertStringContainsString('not authorized', $e->getMessage());
            }
            self::assertSame(0, $calls);
        } finally {
            if (is_dir($dir)) {
                rmdir($dir);
            }
        }
    }

    public function testPublisherRejectsMissingConfigurationBeforeNetwork(): void
    {
        $dir = sys_get_temp_dir() . '/proofpatch-config-' . bin2hex(random_bytes(6));
        $calls = 0;
        $http = new MockHttpClient(static function () use (&$calls): MockResponse {
            $calls++;
            return new MockResponse('{}');
        });
        try {
            $publisher = new DedicatedTestRepoPublisher(new ServerHeldPublicationApproval($dir, 'test-secret'), $http, disconnected: false);
            foreach ([['', str_repeat('a', 40)], ['invalid/repo/extra', str_repeat('a', 40)], ['example-owner/proofpatch-test', '']] as [$repo, $sha]) {
                putenv('PROOFPATCH_TEST_REPO=' . $repo);
                putenv('PROOFPATCH_TEST_BASE_COMMIT=' . $sha);
                try {
                    $publisher->publishDraftPr(['repository' => 'example-owner/proofpatch-test'], '/nonexistent', '');
                    self::fail('Missing configuration was accepted.');
                } catch (\RuntimeException $e) {
                    self::assertStringContainsString('not configured', $e->getMessage());
                }
            }
            self::assertSame(0, $calls);
        } finally {
            if (is_dir($dir)) {
                rmdir($dir);
            }
        }
    }
}
