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
Route::post('/repositories/review', [DashboardController::class, 'reviewPullRequest']);
Route::post('/repositories/review/clear', [DashboardController::class, 'clearReview']);
Route::post('/repositories/review/draft', [DashboardController::class, 'saveDraftComment']);
Route::post('/repositories/review/draft/delete', [DashboardController::class, 'deleteDraftComment']);
Route::post('/repositories/review/draft/clear', [DashboardController::class, 'clearDraftComments']);

// GitHub App Device Flow (Local Desktop Connection per RFC 8628)
Route::post('/github/device/initiate', [DashboardController::class, 'initiateDeviceFlow']);
Route::post('/github/device/poll', [DashboardController::class, 'pollDeviceFlow']);
Route::post('/github/device/disconnect', [DashboardController::class, 'disconnectDeviceFlow']);
Route::post('/github/repositories/select', [DashboardController::class, 'selectInstalledRepository']);
Route::post('/github/pulls/capture', [DashboardController::class, 'captureInstalledPullRequest']);
Route::match(['get', 'post'], '/checks', [DashboardController::class, 'checks']);
Route::get('/checks/image', [DashboardController::class, 'image']);
Route::get('/runs/{runId}/images/{image}', [DashboardController::class, 'imageByPath']);
