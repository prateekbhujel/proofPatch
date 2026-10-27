<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

final class IssueSessionConcurrencyTest extends TestCase
{
    public function testTwoConcurrentRequestsCannotConsumeOneSessionApprovalTwice(): void
    {
        $directory = sys_get_temp_dir().'/proofpatch-session-'.bin2hex(random_bytes(8));
        mkdir($directory.'/storage/framework/sessions', 0700, true);
        mkdir($directory.'/storage/framework/cache/data', 0700, true);
        $root = dirname(__DIR__, 2);
        $router = $directory.'/router.php';
        $script = <<<'PHP'
<?php
require ROOT.'/vendor/autoload.php';
$app = require ROOT.'/bootstrap/app.php';
$app->useStoragePath(STORAGE);
$app->booted(function () {
    \Illuminate\Support\Facades\Route::middleware('web')->get('/seed', function (\Illuminate\Http\Request $request) {
        $request->session()->put('one_use_approval', 'yes');
        return response('seeded');
    });
    \Illuminate\Support\Facades\Route::middleware('web')->get('/consume', function (\Illuminate\Http\Request $request) {
        $value = $request->session()->pull('one_use_approval');
        usleep(400000);
        return response($value === 'yes' ? 'consumed' : 'empty');
    });
    \Illuminate\Support\Facades\Route::middleware('web')->get('/interrupt', function (\Illuminate\Http\Request $request) {
        $request->session()->pull('one_use_approval');
        $request->session()->save();
        exit('interrupted');
    })->block(1, 5);
});
$app->handleRequest(\Illuminate\Http\Request::capture());
PHP;
        file_put_contents($router, str_replace(['ROOT', 'STORAGE'], [var_export($root, true), var_export($directory.'/storage', true)], $script));
        $key = 'base64:'.base64_encode(random_bytes(32));
        $servers = [];
        try {
            for ($i = 0; $i < 2; ++$i) {
                $socket = stream_socket_server('tcp://127.0.0.1:0', $error, $message);
                self::assertNotFalse($socket, $message);
                $address = stream_socket_get_name($socket, false);
                fclose($socket);
                $server = new Process([PHP_BINARY, '-S', $address, $router], $root, ['APP_KEY' => $key, 'APP_ENV' => 'local']);
                $server->start();
                $servers[] = [$server, $address];
                $ready = false;
                for ($attempt = 0; $attempt < 50 && !$ready; ++$attempt) {
                    $connection = @stream_socket_client('tcp://'.$address, $error, $message, .1);
                    if ($connection) { fclose($connection); $ready = true; } else { usleep(20000); }
                }
                self::assertTrue($ready, 'Test server did not start.');
            }
            $body = file_get_contents('http://'.$servers[0][1].'/seed');
            self::assertSame('seeded', $body);
            $cookie = null;
            foreach ($http_response_header ?? [] as $header) {
                if (preg_match('/^Set-Cookie:\s*(proofpatch_session=[^;]+)/i', $header, $matches)) $cookie = $matches[1];
            }
            self::assertNotNull($cookie);
            $clientCode = '$c=stream_context_create(["http"=>["header"=>"Cookie: ".$argv[2],"timeout"=>5]]); echo file_get_contents($argv[1],false,$c);';
            $clients = [];
            foreach ($servers as [, $address]) {
                $client = new Process([PHP_BINARY, '-r', $clientCode, 'http://'.$address.'/consume', $cookie]);
                $client->start();
                $clients[] = $client;
            }
            foreach ($clients as $client) $client->wait();
            foreach ($clients as $client) self::assertSame(0, $client->getExitCode(), $client->getErrorOutput());
            $results = array_map(static fn (Process $client): string => $client->getOutput(), $clients);
            sort($results);
            self::assertSame(['consumed', 'empty'], $results);
            $seedContext = stream_context_create(['http' => ['header' => 'Cookie: '.$cookie]]);
            self::assertSame('seeded', file_get_contents('http://'.$servers[0][1].'/seed', false, $seedContext));
            self::assertSame('interrupted', file_get_contents('http://'.$servers[0][1].'/interrupt', false, $seedContext));
            self::assertSame('empty', file_get_contents('http://'.$servers[1][1].'/consume', false, $seedContext));
        } finally {
            foreach ($servers as [$server]) $server->stop();
            if (is_dir($directory)) {
                foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) {
                    $item->isDir() && !$item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname());
                }
                rmdir($directory);
            }
        }
    }
}
