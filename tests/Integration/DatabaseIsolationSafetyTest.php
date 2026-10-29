<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;

final class DatabaseIsolationSafetyTest extends TestCase
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

    public function testDatabaseConnectionPointsToIsolatedTemporarySqliteFile(): void
    {
        $activeDb = (string) config('database.connections.sqlite.database');
        $prodDb = realpath(database_path('proofpatch.sqlite')) ?: database_path('proofpatch.sqlite');

        self::assertNotSame($prodDb, $activeDb, 'Active database connection must NEVER equal the development/production database.');
        self::assertFalse(
            str_ends_with(str_replace('\\', '/', $activeDb), 'database/proofpatch.sqlite'),
            'Active database connection must not end with database/proofpatch.sqlite.'
        );
        self::assertFileExists($activeDb);
        self::assertSame(realpath($this->testDatabasePath) ?: $this->testDatabasePath, realpath($activeDb) ?: $activeDb);
    }

    public function testApplicationStorageIsSeparateFromLocalProjectStorage(): void
    {
        $storage = realpath(storage_path());
        self::assertNotFalse($storage);
        self::assertNotSame(realpath(base_path('storage')), $storage);
        self::assertStringStartsWith(realpath(sys_get_temp_dir()) . DIRECTORY_SEPARATOR, $storage);
    }

    public function testSuiteBootstrapDoesNotCleanConfiguredApplicationStorage(): void
    {
        $controlPath = $this->testDatabaseDir . '/control-storage';
        mkdir($controlPath . '/app/publication_recovery', 0700, true);
        $sentinel = $controlPath . '/app/publication_recovery/preserve.json';
        file_put_contents($sentinel, 'preserve');

        $script = <<<'PHP'
        require $argv[1];
        $isolated = $_ENV['LARAVEL_STORAGE_PATH'];
        mkdir($isolated . '/app/publication_recovery');
        file_put_contents($isolated . '/app/publication_recovery/test.json', 'test');
        foreach (glob($isolated . '/app/publication_recovery/*.json') as $file) {
            unlink($file);
        }
        PHP;
        $environment = getenv();
        $environment['LARAVEL_STORAGE_PATH'] = $controlPath;
        $process = proc_open([PHP_BINARY, '-r', $script, dirname(__DIR__) . '/bootstrap.php'],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
        self::assertIsResource($process);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        self::assertSame(0, proc_close($process), $stdout . $stderr);
        self::assertSame('preserve', file_get_contents($sentinel));
        unlink($sentinel);
        rmdir($controlPath . '/app/publication_recovery');
        rmdir($controlPath . '/app');
        rmdir($controlPath);
    }

    public function testMutationsInTestDoNotTouchProductionDatabase(): void
    {
        // Simulate a developer-supplied database without opening the real one.
        $controlPath = $this->testDatabaseDir . '/control.sqlite';
        $control = new \PDO('sqlite:' . $controlPath);
        $control->exec('CREATE TABLE sentinel (value TEXT NOT NULL)');
        $control->exec("INSERT INTO sentinel VALUES ('preserve')");

        $script = <<<'PHP'
        require $argv[1];
        $database = new PDO('sqlite:' . getenv('PROOFPATCH_DB'));
        $database->exec('CREATE TABLE sentinel (value TEXT NOT NULL)');
        $database->exec('DELETE FROM sentinel');
        PHP;
        $environment = getenv();
        $environment['PROOFPATCH_DB'] = $controlPath;
        $process = proc_open(
            [PHP_BINARY, '-r', $script, dirname(__DIR__) . '/bootstrap.php'],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            null,
            $environment
        );
        self::assertIsResource($process);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        self::assertSame(0, proc_close($process), $stdout . $stderr);
        self::assertSame('preserve', $control->query('SELECT value FROM sentinel')->fetchColumn());

        $control = null;
        unlink($controlPath);
    }
}
