<?php

declare(strict_types=1);

use Illuminate\Foundation\Application;
use ProofPatch\Application\InspectPullRequestCommand;
use ProofPatch\Application\RecordPullRequestSnapshotCommand;
use ProofPatch\Http\Middleware\HandleInertiaRequests;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: '',
    )
    ->withMiddleware(static function (\Illuminate\Foundation\Configuration\Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
    })
    ->withCommands([
        RecordPullRequestSnapshotCommand::class,
        InspectPullRequestCommand::class,
        \ProofPatch\Application\TriagePullRequestCommand::class,
        \ProofPatch\Application\VerifyPatchCommand::class,
        \ProofPatch\Application\CheckReceiptCommand::class,
    ])
    ->withExceptions(static function (): void {})
    ->create();

$app->useAppPath(dirname(__DIR__).'/src');

return $app;
