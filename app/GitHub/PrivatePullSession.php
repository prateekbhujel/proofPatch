<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use Illuminate\Http\Request;

/** Access to an in-session private test PR is rechecked on every web request. */
final class PrivatePullSession
{
    public const KEYS = [
        'private_pull_owner', 'pullRequest', 'pullRequestSnapshot', 'patch_preview',
        'pr_review', 'review_drafts', 'review_approval_token', 'review_error',
    ];

    public static function usesServerSession(): bool
    {
        return in_array(config('session.driver'), ['file', 'database', 'redis', 'memcached', 'dynamodb', 'array'], true);
    }

    public static function allows(Request $request, array $pull): bool
    {
        if (!$request->hasSession() || !self::usesServerSession()) return false;
        $access = $request->attributes->get('proofpatch_github_access');
        $owner = $request->session()->get('private_pull_owner');
        $repo = $pull['repository'] ?? null;
        $configured = DedicatedTestRepo::name();
        return is_array($access) && is_int($access['userId'] ?? null) && $access['userId'] > 0
            && is_int($owner) && $owner === $access['userId']
            && is_string($repo) && is_string($configured) && strcasecmp($repo, $configured) === 0
            && is_array($access['repositories'] ?? null) && isset($access['repositories'][strtolower($repo)]);
    }

    public static function clear(Request $request): void
    {
        if ($request->hasSession()) $request->session()->forget(self::KEYS);
    }
}
