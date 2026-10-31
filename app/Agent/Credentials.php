<?php

declare(strict_types=1);

namespace ProofPatch\Agent;

final class Credentials
{
    /**
     * @return array{provider: string, label: string, endpoint: string, model: string}
     */
    public static function activeTarget(): array
    {
        return ProviderConfigStore::activeTarget();
    }

    public static function activeKey(): string
    {
        $target = ProviderConfigStore::activeTarget();
        $provider = $target['provider'];
        $resolved = ProviderConfigStore::resolveProviderKey($provider);
        if ($resolved !== null && strlen($resolved['key']) >= 16) {
            return $resolved['key'];
        }

        if ($provider === 'meta') {
            throw new \RuntimeException('Configure an owner-only Meta Model API key in Settings before requesting a proposal.');
        }

        throw new \RuntimeException('Configure an owner-only Baseten key before requesting a proposal.');
    }

    public static function baseten(): string
    {
        $target = ProviderConfigStore::activeTarget();
        if ($target['provider'] === 'meta') {
            return self::activeKey();
        }

        $resolved = ProviderConfigStore::resolveProviderKey('baseten');
        if ($resolved !== null && strlen($resolved['key']) >= 16) {
            return $resolved['key'];
        }

        throw new \RuntimeException('Configure an owner-only Baseten key before requesting a proposal.');
    }
}
