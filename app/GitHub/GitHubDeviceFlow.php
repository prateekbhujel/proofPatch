<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Handles the OAuth 2.0 Device Authorization Grant (RFC 8628) for local desktop GitHub Apps.
 *
 * Per official GitHub App documentation:
 * https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
 */
final readonly class GitHubDeviceFlow
{
    private const DEVICE_CODE_URL = 'https://github.com/login/device/code';
    private const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

    public function __construct(private HttpClientInterface $http)
    {
    }

    /**
     * Step 1: Request device and user verification codes.
     *
     * @return array{deviceCode: string, userCode: string, verificationUri: string, expiresIn: int, interval: int}
     */
    public function initiate(string $clientId): array
    {
        $clientId = trim($clientId);
        if ($clientId === '' || strlen($clientId) > 100 || !preg_match('/\A[a-zA-Z0-9._-]+\z/', $clientId)) {
            throw new \InvalidArgumentException('A valid GitHub App Client ID is required.');
        }

        $response = $this->http->request('POST', self::DEVICE_CODE_URL, [
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'ProofPatcher',
            ],
            'json' => [
                'client_id' => $clientId,
            ],
            'timeout' => 15,
        ]);

        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('Failed to request device code from GitHub (HTTP '.$response->getStatusCode().').');
        }

        $data = json_decode($response->getContent(false), true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($data) || !isset($data['device_code'], $data['user_code'], $data['verification_uri'])) {
            $error = $data['error_description'] ?? $data['error'] ?? 'Unexpected GitHub response.';
            throw new \RuntimeException('GitHub device authorization failed: '.$error);
        }

        return [
            'deviceCode' => (string) $data['device_code'],
            'userCode' => (string) $data['user_code'],
            'verificationUri' => (string) $data['verification_uri'],
            'expiresIn' => (int) ($data['expires_in'] ?? 900),
            'interval' => (int) ($data['interval'] ?? 5),
        ];
    }

    /**
     * Step 2: Poll for user access token once the user enters the code on GitHub.
     *
     * @return array{status: 'authorized'|'pending'|'slow_down'|'expired'|'denied'|'error', accessToken?: string, tokenType?: string, interval?: int, error?: string}
     */
    public function poll(string $clientId, string $deviceCode): array
    {
        $clientId = trim($clientId);
        $deviceCode = trim($deviceCode);
        if ($clientId === '' || $deviceCode === '') {
            throw new \InvalidArgumentException('Client ID and device code are required.');
        }

        $response = $this->http->request('POST', self::ACCESS_TOKEN_URL, [
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'ProofPatcher',
            ],
            'json' => [
                'client_id' => $clientId,
                'device_code' => $deviceCode,
                'grant_type' => 'urn:ietf:params:oauth:grant-type:device_code',
            ],
            'timeout' => 15,
        ]);

        $data = json_decode($response->getContent(false), true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($data)) {
            return ['status' => 'error', 'error' => 'Invalid response from GitHub.'];
        }

        if (isset($data['access_token'])) {
            return [
                'status' => 'authorized',
                'accessToken' => (string) $data['access_token'],
                'tokenType' => (string) ($data['token_type'] ?? 'bearer'),
            ];
        }

        $error = (string) ($data['error'] ?? 'unknown_error');

        return match ($error) {
            'authorization_pending' => ['status' => 'pending'],
            'slow_down' => [
                'status' => 'slow_down',
                'interval' => (int) ($data['interval'] ?? 10),
            ],
            'expired_token' => ['status' => 'expired', 'error' => 'The verification code has expired. Please initiate again.'],
            'access_denied' => ['status' => 'denied', 'error' => 'Authorization was declined on GitHub.'],
            default => [
                'status' => 'error',
                'error' => (string) ($data['error_description'] ?? $error),
            ],
        };
    }
}
