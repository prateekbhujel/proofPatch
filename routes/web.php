<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use ProofPatch\Application\DashboardController;
use ProofPatch\Application\IssueWorkbenchController;

Route::get('/', [DashboardController::class, 'overview']);
Route::get('/issues', [IssueWorkbenchController::class, 'show']);
Route::post('/issues/preview', [IssueWorkbenchController::class, 'capture']);
Route::post('/issues/propose', [IssueWorkbenchController::class, 'propose']);
Route::match(['get', 'post'], '/repositories', [DashboardController::class, 'repositories']);
Route::match(['get', 'post'], '/checks', [DashboardController::class, 'checks']);
Route::get('/checks/image', [DashboardController::class, 'image']);
Route::get('/runs/{runId}/images/{image}', [DashboardController::class, 'imageByPath']);

// Backward compatibility redirects:
Route::match(['get', 'post'], '/repositories.php', static function (Request $request) {
    return redirect('/repositories'.($request->getQueryString() ? '?'.$request->getQueryString() : ''));
});
Route::match(['get', 'post'], '/checks.php', static function (Request $request) {
    if ($request->has('image')) {
        return app(DashboardController::class)->image($request);
    }
    return redirect('/checks'.($request->getQueryString() ? '?'.$request->getQueryString() : ''));
});
