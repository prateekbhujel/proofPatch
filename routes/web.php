<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use ProofPatch\Http\Controllers\DashboardController;
use ProofPatch\Http\Controllers\CardPreviewController;
use ProofPatch\Http\Controllers\CardProposalController;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Http\Controllers\LocalTaskCardController;
use ProofPatch\Http\Controllers\LocalTaskImageController;
use ProofPatch\Http\Controllers\ManualInlineCommentController;

Route::redirect('/', '/issues');
Route::get('/overview', [DashboardController::class, 'overview']);
Route::get('/issues', [IssueWorkbenchController::class, 'show']);
Route::post('/issues/tasks', [LocalTaskCardController::class, 'store']);
Route::post('/issues/tasks/{cardId}/preview', [CardPreviewController::class, 'store'])->whereNumber('cardId');
Route::post('/issues/tasks/{cardId}/model-preview', [CardProposalController::class, 'prepare'])->whereNumber('cardId');
Route::post('/issues/tasks/{cardId}/model-send', [CardProposalController::class, 'send'])->whereNumber('cardId');
Route::post('/issues/tasks/{cardId}/assign', [LocalTaskCardController::class, 'assign'])->whereNumber('cardId');
Route::post('/issues/tasks/{cardId}/image', [LocalTaskImageController::class, 'store'])->whereNumber('cardId');
Route::get('/issues/tasks/{cardId}/image', [LocalTaskImageController::class, 'show'])->whereNumber('cardId');
Route::post('/issues/preview', [IssueWorkbenchController::class, 'capture']);
Route::post('/issues/load-owned', [IssueWorkbenchController::class, 'loadOwnedCase']);
Route::post('/issues/load-dedicated', [IssueWorkbenchController::class, 'loadDedicatedCase']);
Route::post('/issues/select-repository', [IssueWorkbenchController::class, 'selectRepository']);
Route::post('/issues/load-issue', [IssueWorkbenchController::class, 'loadIssue']);
Route::post('/issues/propose', [IssueWorkbenchController::class, 'propose']);
Route::post('/issues/verify', [IssueWorkbenchController::class, 'verifyCandidate']);
Route::post('/issues/publish-pr', [IssueWorkbenchController::class, 'publishDraftPr']);
Route::post('/issues/reconcile-pr', [IssueWorkbenchController::class, 'reconcilePr']);
Route::post('/issues/switch-task', [IssueWorkbenchController::class, 'switchTask']);
Route::post('/issues/draft', [IssueWorkbenchController::class, 'saveDraft']);
Route::match(['get', 'post'], '/repositories', [DashboardController::class, 'repositories']);
Route::post('/repositories/review', [DashboardController::class, 'reviewPullRequest']);
Route::post('/repositories/review/clear', [DashboardController::class, 'clearReview']);
Route::post('/repositories/review/draft', [DashboardController::class, 'saveDraftComment']);
Route::post('/repositories/review/comment', [ManualInlineCommentController::class, 'store']);
Route::post('/repositories/review/draft/delete', [DashboardController::class, 'deleteDraftComment']);
Route::post('/repositories/review/draft/clear', [DashboardController::class, 'clearDraftComments']);

// GitHub App Device Flow (Local Desktop Connection per RFC 8628)
Route::post('/github/device/initiate', [DashboardController::class, 'initiateDeviceFlow']);
Route::post('/github/device/poll', [DashboardController::class, 'pollDeviceFlow']);
Route::post('/github/device/disconnect', [DashboardController::class, 'disconnectDeviceFlowRequest']);
Route::post('/github/repositories/select', [DashboardController::class, 'selectInstalledRepository']);
Route::post('/github/pulls/capture', [DashboardController::class, 'captureInstalledPullRequest']);
Route::match(['get', 'post'], '/checks', [DashboardController::class, 'checks']);
Route::get('/settings', [DashboardController::class, 'settings']);
Route::get('/docs', [DashboardController::class, 'docs']);
Route::post('/notifications/clear', [DashboardController::class, 'clearNotifications']);
Route::get('/checks/image', [DashboardController::class, 'image']);
Route::get('/runs/{runId}/images/{image}', [DashboardController::class, 'imageByPath']);
