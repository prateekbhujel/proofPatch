<?php

declare(strict_types=1);

return [
    'name' => env('APP_NAME', 'ProofPatch'),
    'env' => env('APP_ENV', 'local'),
    'debug' => (bool) env('APP_DEBUG', true),
    'url' => env('APP_URL', 'http://127.0.0.1:8000'),
    'timezone' => 'UTC',
    'locale' => 'en',
    'fallback_locale' => 'en',
    'key' => env('APP_KEY', 'base64:6kG5Z4/39jZz7a41uH8m1P1w2x3y4z5A6b7C8d9E0f1='),
    'cipher' => 'AES-256-CBC',
];
