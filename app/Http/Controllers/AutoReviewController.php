<?php

declare(strict_types=1);

namespace ProofPatch\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use ProofPatch\Models\AutoReviewResult;
use ProofPatch\Models\RepositoryAutoReviewSetting;
use ProofPatch\Support\WorkerStatusService;

final class AutoReviewController
{
    public function __construct(private ?WorkerStatusService $workerStatus = null)
    {
        $this->workerStatus ??= new WorkerStatusService();
    }

    /**
     * Opt-in or stop automatic PR reviews for an authorized repository.
     * Validates local active session and strictly requires repository in installed grant.
     */
    public function toggle(Request $request): JsonResponse
    {
        $authorizedRepos = $this->resolveAuthorizedRepositories($request);
        if ($authorizedRepos === null) {
            return response()->json([
                'success' => false,
                'error' => 'Authentication required. Connect your GitHub account first.',
            ], 401);
        }

        $repository = (string) $request->input('repository', '');
        $repository = trim($repository);

        if (!preg_match('~\A([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})\z~', $repository)) {
            return response()->json([
                'success' => false,
                'error' => 'A valid repository name in owner/repo format is required.',
            ], 422);
        }

        if (!isset($authorizedRepos[strtolower($repository)])) {
            return response()->json([
                'success' => false,
                'error' => 'Repository is not installed or authorized in your active GitHub App connection.',
            ], 403);
        }

        $enabled = $request->boolean('enabled');
        if ($enabled) {
            $auth = $request->session()->get('github_auth');
            foreach (($auth['repositories'] ?? []) as $r) {
                if (is_array($r) && strcasecmp((string) ($r['fullName'] ?? ''), $repository) === 0 && ($r['isPrivate'] ?? null) === true) {
                    RepositoryAutoReviewSetting::disableForRepository($repository);
                    return response()->json([
                        'success' => false,
                        'error' => 'Automatic reviews are available for public repositories only. Private repositories are never sent to Muse.',
                    ], 422);
                }
            }
        }
        $setting = RepositoryAutoReviewSetting::setRepoEnabled($repository, $enabled);

        return response()->json([
            'success' => true,
            'repository' => $setting->repository,
            'enabled' => $setting->enabled,
            'public_only' => $setting->public_only,
        ]);
    }

    /**
     * Returns worker liveness and public-only status scoped strictly to the authenticated user's repositories.
     */
    public function status(Request $request): JsonResponse
    {
        $authorizedRepos = $this->resolveAuthorizedRepositories($request);
        if ($authorizedRepos === null) {
            return response()->json([
                'success' => false,
                'error' => 'Authentication required. Connect your GitHub account first.',
            ], 401);
        }

        $worker = $this->workerStatus->getStatus();
        $authorizedList = array_keys($authorizedRepos);

        $settings = RepositoryAutoReviewSetting::whereIn('repository', $authorizedList)
            ->get(['repository', 'enabled', 'public_only', 'updated_at']);

        $stats = [
            'totalReviews' => AutoReviewResult::whereIn('repository', $authorizedList)->count(),
            'completed' => AutoReviewResult::whereIn('repository', $authorizedList)->where('status', 'completed')->count(),
            'failed' => AutoReviewResult::whereIn('repository', $authorizedList)->where('status', 'failed')->count(),
            'skippedPrivate' => AutoReviewResult::whereIn('repository', $authorizedList)->where('status', 'skipped_private')->count(),
            'skippedBudget' => AutoReviewResult::whereIn('repository', $authorizedList)->where('status', 'skipped_budget')->count(),
        ];

        return response()->json([
            'worker' => $worker,
            'settings' => $settings,
            'stats' => $stats,
            'publicOnly' => true,
        ]);
    }

    /**
     * Lists review results for a repository or pull request.
     * Strictly requires active GitHub session and scoped repository authorization.
     */
    public function results(Request $request): JsonResponse
    {
        $authorizedRepos = $this->resolveAuthorizedRepositories($request);
        if ($authorizedRepos === null) {
            return response()->json([
                'success' => false,
                'error' => 'Authentication required. Connect your GitHub account first.',
            ], 401);
        }

        $query = AutoReviewResult::query();
        $authorizedList = array_keys($authorizedRepos);

        if ($request->filled('repository')) {
            $repo = trim((string) $request->input('repository'));
            if (!isset($authorizedRepos[strtolower($repo)])) {
                return response()->json([
                    'success' => false,
                    'error' => 'Access denied: repository is not authorized in your GitHub session.',
                ], 403);
            }
            $query->where('repository', $repo);
        } else {
            $query->whereIn('repository', $authorizedList);
        }

        if ($request->filled('pull_number')) {
            $query->where('pull_number', (int) $request->input('pull_number'));
        }

        if ($request->filled('status')) {
            $query->where('status', trim((string) $request->input('status')));
        }

        $limit = min(100, max(1, (int) $request->input('limit', 25)));
        $results = $query->latest('id')->limit($limit)->get();

        return response()->json([
            'results' => $results,
        ]);
    }

    /**
     * Resolves the list of authorized repositories from the session and request access attributes.
     * Returns null if unauthenticated.
     *
     * @return array<string, bool>|null
     */
    private function resolveAuthorizedRepositories(Request $request): ?array
    {
        $auth = $request->session()->get('github_auth');
        $token = is_array($auth) ? ($auth['token'] ?? null) : null;
        if (!is_string($token) || trim($token) === '') {
            return null;
        }

        $repos = [];
        $access = $request->attributes->get('proofpatch_github_access');
        if (is_array($access) && isset($access['repositories']) && is_array($access['repositories'])) {
            foreach ($access['repositories'] as $lower => $repoData) {
                $repos[strtolower((string) $lower)] = true;
            }
        } elseif (isset($auth['repositories']) && is_array($auth['repositories'])) {
            foreach ($auth['repositories'] as $r) {
                if (is_array($r) && isset($r['fullName']) && is_string($r['fullName'])) {
                    $repos[strtolower(trim($r['fullName']))] = true;
                }
            }
        }

        return $repos;
    }
}
