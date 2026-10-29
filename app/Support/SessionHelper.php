<?php

declare(strict_types=1);

namespace ProofPatch\Support;

use Illuminate\Http\Request;

/**
 * Shared session helper providing uniform session access across Laravel Request and native PHP sessions.
 */
final class SessionHelper
{
    public static function get(?Request $request, string $key, mixed $default = null): mixed
    {
        if ($request !== null && $request->hasSession()) {
            return $request->session()->get($key, $default);
        }

        return $_SESSION[$key] ?? $default;
    }

    public static function put(?Request $request, string $key, mixed $value): void
    {
        if ($request !== null && $request->hasSession()) {
            $request->session()->put($key, $value);
            return;
        }

        $_SESSION[$key] = $value;
    }

    public static function forget(?Request $request, string ...$keys): void
    {
        if ($request !== null && $request->hasSession()) {
            $request->session()->forget($keys);
            return;
        }

        foreach ($keys as $key) {
            unset($_SESSION[$key]);
        }
    }
}
