<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\GitHubDeviceFlow;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class GitHubDeviceFlowTest extends TestCase
{
    public function testInitiateThrowsOnInvalidClientId(): void
    {
        $flow = new GitHubDeviceFlow(new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('A valid GitHub App Client ID is required.');
        $flow->initiate('');
    }

    public function testInitiateThrowsOnWhitespaceClientId(): void
    {
        $flow = new GitHubDeviceFlow(new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('A valid GitHub App Client ID is required.');
        $flow->initiate('   ');
    }

    public function testInitiateThrowsOnInvalidCharacters(): void
    {
        $flow = new GitHubDeviceFlow(new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('A valid GitHub App Client ID is required.');
        $flow->initiate('client;id=bad');
    }

    public function testInitiateSuccess(): void
    {
        $http = new MockHttpClient(function (string $method, string $url, array $options): MockResponse {
            $this->assertSame('POST', $method);
            $this->assertSame('https://github.com/login/device/code', $url);
            $payload = json_decode($options['body'], true);
            $this->assertSame('Iv1.abc123xyz', $payload['client_id']);

            return new MockResponse(json_encode([
                'device_code' => 'dev_code_12345',
                'user_code' => 'WDJB-MJHT',
                'verification_uri' => 'https://github.com/login/device',
                'expires_in' => 900,
                'interval' => 5,
            ]));
        });

        $flow = new GitHubDeviceFlow($http);
        $result = $flow->initiate('Iv1.abc123xyz');

        $this->assertSame('dev_code_12345', $result['deviceCode']);
        $this->assertSame('WDJB-MJHT', $result['userCode']);
        $this->assertSame('https://github.com/login/device', $result['verificationUri']);
        $this->assertSame(900, $result['expiresIn']);
        $this->assertSame(5, $result['interval']);
    }

    public function testInitiateThrowsOnHttpError(): void
    {
        $http = new MockHttpClient([
            new MockResponse('{"error":"not_found"}', ['http_code' => 404]),
        ]);

        $flow = new GitHubDeviceFlow($http);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Failed to request device code from GitHub (HTTP 404).');
        $flow->initiate('Iv1.test');
    }

    public function testPollThrowsOnEmptyArguments(): void
    {
        $flow = new GitHubDeviceFlow(new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Client ID and device code are required.');
        $flow->poll('', 'code');
    }

    public function testPollAuthorized(): void
    {
        $http = new MockHttpClient(function (string $method, string $url, array $options): MockResponse {
            $this->assertSame('POST', $method);
            $this->assertSame('https://github.com/login/oauth/access_token', $url);
            $payload = json_decode($options['body'], true);
            $this->assertSame('Iv1.abc123xyz', $payload['client_id']);
            $this->assertSame('dev_123', $payload['device_code']);
            $this->assertSame('urn:ietf:params:oauth:grant-type:device_code', $payload['grant_type']);

            return new MockResponse(json_encode([
                'access_token' => 'ghu_mocktoken1234567890',
                'token_type' => 'bearer',
                'scope' => '',
            ]));
        });

        $flow = new GitHubDeviceFlow($http);
        $result = $flow->poll('Iv1.abc123xyz', 'dev_123');

        $this->assertSame('authorized', $result['status']);
        $this->assertSame('ghu_mocktoken1234567890', $result['accessToken']);
        $this->assertSame('bearer', $result['tokenType']);
    }

    public function testPollPending(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                'error' => 'authorization_pending',
                'error_description' => 'The authorization request is still pending.',
            ])),
        ]);

        $flow = new GitHubDeviceFlow($http);
        $result = $flow->poll('Iv1.test', 'dev_123');

        $this->assertSame('pending', $result['status']);
    }

    public function testPollSlowDown(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                'error' => 'slow_down',
                'interval' => 15,
            ])),
        ]);

        $flow = new GitHubDeviceFlow($http);
        $result = $flow->poll('Iv1.test', 'dev_123');

        $this->assertSame('slow_down', $result['status']);
        $this->assertSame(15, $result['interval']);
    }

    public function testPollExpired(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                'error' => 'expired_token',
            ])),
        ]);

        $flow = new GitHubDeviceFlow($http);
        $result = $flow->poll('Iv1.test', 'dev_123');

        $this->assertSame('expired', $result['status']);
        $this->assertStringContainsString('expired', $result['error']);
    }

    public function testPollAccessDenied(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                'error' => 'access_denied',
            ])),
        ]);

        $flow = new GitHubDeviceFlow($http);
        $result = $flow->poll('Iv1.test', 'dev_123');

        $this->assertSame('denied', $result['status']);
        $this->assertStringContainsString('declined', $result['error']);
    }

    public function testPollUnknownError(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                'error' => 'unsupported_grant_type',
                'error_description' => 'The grant type is not supported.',
            ])),
        ]);

        $flow = new GitHubDeviceFlow($http);
        $result = $flow->poll('Iv1.test', 'dev_123');

        $this->assertSame('error', $result['status']);
        $this->assertSame('The grant type is not supported.', $result['error']);
    }
}
