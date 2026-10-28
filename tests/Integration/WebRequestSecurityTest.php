<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

final class WebRequestSecurityTest extends TestCase
{
    public function testWriteRoutesRejectCrossSiteRequestsWithoutCsrfAndAcceptAValidToken(): void
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0', $error, $message);
        self::assertNotFalse($socket, $message);
        $address = stream_socket_get_name($socket, false);
        fclose($socket);

        $server = new Process(
            [PHP_BINARY, '-S', $address, '-t', 'public'],
            dirname(__DIR__, 2),
            [
                'APP_KEY' => 'base64:'.base64_encode(random_bytes(32)),
                'APP_ENV' => 'local',
                'APP_DEBUG' => 'false',
            ],
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

            [$status, $headers] = $this->request($address, '/repositories');
            self::assertSame(200, $status);
            $cookies = [];
            foreach ($headers as $header) {
                if (preg_match('/^Set-Cookie:\s*([^=;]+)=([^;]*)/i', $header, $matches)) {
                    $cookies[$matches[1]] = $matches[2];
                }
            }
            self::assertArrayHasKey('proofpatch_session', $cookies);
            self::assertArrayHasKey('XSRF-TOKEN', $cookies);
            // Laravel cookie payloads are encrypted, rather than raw session identifiers.
            self::assertStringStartsWith('eyJ', rawurldecode($cookies['proofpatch_session']));
            self::assertStringStartsWith('eyJ', rawurldecode($cookies['XSRF-TOKEN']));
            $cookieHeader = implode('; ', array_map(
                static fn(string $name, string $value): string => $name.'='.$value,
                array_keys($cookies), array_values($cookies),
            ));

            foreach ([
                '/repositories',
                '/checks',
                '/issues/preview',
                '/issues/propose',
                '/repositories/review',
                '/repositories/review/clear',
                '/repositories/review/draft',
                '/repositories/review/draft/delete',
                '/repositories/review/draft/clear',
                '/github/device/initiate',
                '/github/device/poll',
                '/github/device/disconnect',
                '/github/repositories/select',
                '/github/pulls/capture',
            ] as $route) {
                [$status] = $this->request($address, $route, 'POST', [
                    'Cookie: '.$cookieHeader,
                    'Origin: https://example.invalid',
                    'Sec-Fetch-Site: cross-site',
                ]);
                self::assertSame(419, $status, $route.' must reject a request without a CSRF token');
            }

            // This form is intentionally invalid, so the positive test never contacts GitHub.
            [$status] = $this->request($address, '/repositories', 'POST', [
                'Cookie: '.$cookieHeader,
                'X-XSRF-TOKEN: '.rawurldecode($cookies['XSRF-TOKEN']),
                'Origin: http://'.$address,
            ]);
            self::assertSame(302, $status, 'A legitimate local submission should reach validation');
            [$status] = $this->request($address, '/issues/propose', 'POST', [
                'Cookie: '.$cookieHeader,
                'X-XSRF-TOKEN: '.rawurldecode($cookies['XSRF-TOKEN']),
                'Origin: http://'.$address,
            ]);
            self::assertSame(302, $status, 'An unapproved proposal must return to the issue page');
            [, , $issuePage] = $this->request($address, '/issues', 'GET', ['Cookie: '.$cookieHeader]);
            self::assertStringContainsString('Review and approve the request first.', $issuePage);

            [$status] = $this->request($address, '/github/device/initiate', 'POST', [
                'Cookie: '.$cookieHeader,
                'X-XSRF-TOKEN: '.rawurldecode($cookies['XSRF-TOKEN']),
                'Origin: http://'.$address,
            ]);
            self::assertSame(302, $status, 'A legitimate local device initiate request should reach validation and redirect');
            [, , $repoPage] = $this->request($address, '/repositories', 'GET', ['Cookie: '.$cookieHeader]);
            self::assertStringContainsString('Client ID is required', $repoPage);
        } finally {
            $server->stop();
        }
    }

    private function request(string $address, string $path, string $method = 'GET', array $headers = []): array
    {
        $context = stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", [...$headers, 'Content-Type: application/x-www-form-urlencoded']),
            'content' => $method === 'POST' ? 'url=' : '',
            'ignore_errors' => true,
            'follow_location' => 0,
            'timeout' => 5,
        ]]);
        $body = file_get_contents('http://'.$address.$path, false, $context);
        self::assertNotFalse($body);
        $responseHeaders = $http_response_header ?? [];
        self::assertMatchesRegularExpression('/^HTTP\/\S+ (\d{3})/', $responseHeaders[0] ?? '');
        preg_match('/^HTTP\/\S+ (\d{3})/', $responseHeaders[0], $matches);

        return [(int) $matches[1], $responseHeaders, $body];
    }
}
