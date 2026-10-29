<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Support;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use PHPUnit\Framework\Assert;

trait InteractsWithIsolatedDatabase
{
    private ?string $testDatabaseDir = null;
    private ?string $testDatabasePath = null;
    private ?string $previousProofpatchDb = null;

    protected function setupIsolatedDatabase(): void
    {
        $this->previousProofpatchDb = getenv('PROOFPATCH_DB') !== false ? (string) getenv('PROOFPATCH_DB') : null;

        $this->testDatabaseDir = sys_get_temp_dir() . '/proofpatch-test-db-' . bin2hex(random_bytes(6));
        if (!is_dir($this->testDatabaseDir)) {
            mkdir($this->testDatabaseDir, 0700, true);
        }

        $this->testDatabasePath = $this->testDatabaseDir . '/isolated_test.sqlite';
        touch($this->testDatabasePath);

        // Set PROOFPATCH_DB BEFORE Laravel bootstraps
        putenv('PROOFPATCH_DB=' . $this->testDatabasePath);
        $_ENV['PROOFPATCH_DB'] = $this->testDatabasePath;
        $_SERVER['PROOFPATCH_DB'] = $this->testDatabasePath;
    }

    protected function bootstrapAndMigrateIsolatedDatabase(): Application
    {
        Assert::assertNotNull(
            $this->testDatabasePath,
            'CRITICAL SAFETY FAILURE: Isolated test database path must be initialized before bootstrapping.'
        );

        // Ensure clean facade/connection state before booting
        try {
            DB::purge('sqlite');
            DB::disconnect('sqlite');
        } catch (\Throwable) {
        }
        Facade::clearResolvedInstances();

        $app = require dirname(__DIR__, 2) . '/bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();

        // Enforce isolated DB in configuration and reconnect
        config(['database.connections.sqlite.database' => $this->testDatabasePath]);
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        // Guard assertion: test DB must NOT be the production/development DB
        $prodDb = realpath(database_path('proofpatch.sqlite')) ?: database_path('proofpatch.sqlite');
        $activeDb = (string) config('database.connections.sqlite.database');
        $realActiveDb = realpath($activeDb) ?: $activeDb;

        Assert::assertNotSame(
            $prodDb,
            $realActiveDb,
            'CRITICAL SAFETY FAILURE: Test database must not point to the production/development database!'
        );
        Assert::assertFalse(
            str_ends_with(str_replace('\\', '/', $activeDb), 'database/proofpatch.sqlite'),
            'CRITICAL SAFETY FAILURE: Test database resolves to database/proofpatch.sqlite!'
        );
        Assert::assertSame(
            realpath($this->testDatabasePath) ?: $this->testDatabasePath,
            $realActiveDb,
            'Active SQLite database does not match the isolated test database path.'
        );

        // Run migrations on ONLY this isolated test database
        Artisan::call('migrate', ['--force' => true]);

        return $app;
    }

    protected function teardownIsolatedDatabase(): void
    {
        try {
            DB::purge('sqlite');
            DB::disconnect('sqlite');
        } catch (\Throwable) {
        }
        Facade::clearResolvedInstances();

        if ($this->previousProofpatchDb !== null) {
            putenv('PROOFPATCH_DB=' . $this->previousProofpatchDb);
            $_ENV['PROOFPATCH_DB'] = $this->previousProofpatchDb;
            $_SERVER['PROOFPATCH_DB'] = $this->previousProofpatchDb;
        } else {
            putenv('PROOFPATCH_DB');
            unset($_ENV['PROOFPATCH_DB'], $_SERVER['PROOFPATCH_DB']);
        }

        if ($this->testDatabasePath !== null && file_exists($this->testDatabasePath)) {
            @unlink($this->testDatabasePath);
        }
        if ($this->testDatabaseDir !== null && is_dir($this->testDatabaseDir)) {
            @rmdir($this->testDatabaseDir);
        }
    }
}
