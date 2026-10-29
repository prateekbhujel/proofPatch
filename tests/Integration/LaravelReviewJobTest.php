<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Evidence\CanonicalJson;
use ProofPatch\GitHub\PullRequestSnapshot;
use Symfony\Component\Process\Process;

final class LaravelReviewJobTest extends TestCase
{
    private string $directory;
    private string $database;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/proofpatch-laravel-test-'.bin2hex(random_bytes(8));
        self::assertTrue(mkdir($this->directory, 0700));
        $this->database = $this->directory.'/reviews.sqlite';
        touch($this->database);

        $prodDb = realpath(dirname(__DIR__, 2).'/database/proofpatch.sqlite') ?: (dirname(__DIR__, 2).'/database/proofpatch.sqlite');
        self::assertNotSame(
            $prodDb,
            realpath($this->database) ?: $this->database,
            'CRITICAL SAFETY FAILURE: Test database must not point to the production/development database!'
        );
        self::assertFalse(
            str_ends_with(str_replace('\\', '/', $this->database), 'database/proofpatch.sqlite'),
            'CRITICAL SAFETY FAILURE: Test database points to database/proofpatch.sqlite!'
        );

        self::assertSame(0, $this->runArtisan('migrate', '--force')->getExitCode());
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory.'/*') ?: [] as $file) {
            if (is_dir($file)) {
                foreach (glob($file.'/*') ?: [] as $child) {
                    unlink($child);
                }
                rmdir($file);
            } else {
                unlink($file);
            }
        }
        rmdir($this->directory);
    }

    public function testSnapshotIsRecordedOnceAndDoesNotClaimVerification(): void
    {
        $snapshot = (new PullRequestSnapshot($this->directory.'/snapshots'))->capture([
            'repository' => 'example/project', 'number' => 12, 'headSha' => str_repeat('a', 40),
            'isPrivate' => false, 'visibility' => 'public',
        ]);
        $first = $this->runArtisan('review:record', $snapshot['id']);
        self::assertSame(0, $first->getExitCode(), $first->getErrorOutput().$first->getOutput());
        self::assertStringContainsString('not verified', $first->getOutput());
        $second = $this->runArtisan('review:record', $snapshot['id']);
        self::assertSame(0, $second->getExitCode());
        self::assertStringContainsString('Already recorded', $second->getOutput());

        $db = new \PDO('sqlite:'.$this->database);
        $rows = $db->query('SELECT snapshot_id, snapshot_sha256, repository, pull_number, head_sha, status FROM review_jobs')->fetchAll(\PDO::FETCH_ASSOC);
        self::assertCount(1, $rows);
        self::assertSame($snapshot['sha256'], $rows[0]['snapshot_sha256']);
        self::assertSame(str_repeat('a', 40), $rows[0]['head_sha']);
        self::assertSame('not_verified', $rows[0]['status']);
        $this->assertReviewAvailableOverHttp((int) $db->query('SELECT id FROM review_jobs')->fetchColumn());

        $file = $this->directory.'/snapshots/'.$snapshot['id'].'.json';
        $document = json_decode((string) file_get_contents($file), true, 64, JSON_THROW_ON_ERROR);
        $document['snapshot']['pullRequest']['headSha'] = str_repeat('b', 40);
        $document['sha256'] = hash('sha256', CanonicalJson::encode($document['snapshot']));
        file_put_contents($file, json_encode($document, JSON_THROW_ON_ERROR));
        $conflict = $this->runArtisan('review:record', $snapshot['id']);
        self::assertNotSame(0, $conflict->getExitCode());
        self::assertStringContainsString('conflicts', $conflict->getOutput());
        self::assertSame(str_repeat('a', 40), $db->query('SELECT head_sha FROM review_jobs')->fetchColumn());
        $this->assertReviewAvailableOverHttp((int) $db->query('SELECT id FROM review_jobs')->fetchColumn(), true);
    }

    public function testInvalidSnapshotFailsAndMigrationRollsBack(): void
    {
        $invalid = $this->runArtisan('review:record', '../invalid');
        self::assertNotSame(0, $invalid->getExitCode());
        $db = new \PDO('sqlite:'.$this->database);
        self::assertSame(0, (int) $db->query('SELECT COUNT(*) FROM review_jobs')->fetchColumn());
        self::assertSame(0, $this->runArtisan('migrate:rollback', '--force')->getExitCode());
        self::assertSame(0, (int) $db->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='review_jobs'")->fetchColumn());
    }

    public function testInspectRejectsAnInvalidUrlWithoutCreatingARecord(): void
    {
        $invalid = $this->runArtisan('review:inspect', 'https://github.com.evil.test/example/project/pull/12');
        self::assertNotSame(0, $invalid->getExitCode());
        self::assertStringContainsString('GitHub pull request URL', $invalid->getOutput());
        self::assertDirectoryDoesNotExist($this->directory.'/snapshots');
        $db = new \PDO('sqlite:'.$this->database);
        self::assertSame(0, (int) $db->query('SELECT COUNT(*) FROM review_jobs')->fetchColumn());
    }

    public function testUnexpectedStoredStatusIsNotReportedAsNotVerified(): void
    {
        $snapshot = (new PullRequestSnapshot($this->directory.'/snapshots'))->capture([
            'repository' => 'example/project', 'number' => 12, 'headSha' => str_repeat('a', 40),
            'isPrivate' => false, 'visibility' => 'public',
        ]);
        self::assertSame(0, $this->runArtisan('review:record', $snapshot['id'])->getExitCode());
        $db = new \PDO('sqlite:'.$this->database);
        $db->exec("UPDATE review_jobs SET status = 'verified'");
        $repeat = $this->runArtisan('review:record', $snapshot['id']);
        self::assertNotSame(0, $repeat->getExitCode());
        self::assertStringContainsString('unsupported status', $repeat->getOutput());
    }

    private function runArtisan(string ...$arguments): Process
    {
        $process = new Process(
            [PHP_BINARY, 'artisan', ...$arguments, '--no-interaction'],
            dirname(__DIR__, 2),
            ['PROOFPATCH_DB' => $this->database, 'PROOFPATCH_SNAPSHOT_DIR' => $this->directory.'/snapshots'],
        );
        $process->run();
        return $process;
    }

    private function assertReviewAvailableOverHttp(int $id, bool $expectConflict = false): void
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0', $error, $message);
        self::assertNotFalse($socket, $message);
        $address = stream_socket_get_name($socket, false);
        fclose($socket);
        $server = new Process(
            [PHP_BINARY, '-S', $address, '-t', 'public'],
            dirname(__DIR__, 2),
            ['PROOFPATCH_DB' => $this->database, 'PROOFPATCH_SNAPSHOT_DIR' => $this->directory.'/snapshots'],
        );
        $server->start();
        try {
            $connection = false;
            for ($attempt = 0; $attempt < 50 && $connection === false; ++$attempt) {
                $connection = @stream_socket_client('tcp://'.$address, $error, $message, .1);
                if ($connection === false) {
                    usleep(20000);
                }
            }
            self::assertNotFalse($connection, 'Local Laravel server did not start.');
            fclose($connection);
            $context = stream_context_create(['http' => ['ignore_errors' => true]]);
            $review = json_decode((string) file_get_contents('http://'.$address.'/reviews/'.$id, false, $context), true, 64, JSON_THROW_ON_ERROR);
            if ($expectConflict) {
                self::assertStringContainsString('409', $http_response_header[0] ?? '');
                self::assertStringContainsString('does not match', $review['message']);
                return;
            }
            self::assertSame('example/project', $review['repository']);
            self::assertSame('not_verified', $review['status']);
            self::assertSame(str_repeat('a', 40), $review['head_sha']);
            self::assertSame('matches_saved_digest', $review['snapshot_integrity']);
            self::assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $review['snapshot_sha256']);
            $missing = file_get_contents('http://'.$address.'/reviews/99999', false, $context);
            self::assertStringContainsString('404', $http_response_header[0] ?? '');
            self::assertSame('Review not found.', json_decode((string) $missing, true, 64, JSON_THROW_ON_ERROR)['message']);
        } finally {
            $server->stop();
        }
    }
}
