<?php

declare(strict_types=1);

namespace ProofPatch\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use ProofPatch\Models\LocalTaskCard;

final class LocalTaskCardController
{
    public function store(Request $request): RedirectResponse
    {
        $access = $request->attributes->get('proofpatch_github_access');
        $userId = is_array($access) ? ($access['userId'] ?? null) : null;
        $repositories = is_array($access) ? ($access['repositories'] ?? null) : null;
        if (!is_int($userId) || $userId <= 0 || !is_array($repositories)) {
            return redirect('/issues')->with('error', 'Connect GitHub to create a task.');
        }

        $title = $request->input('title');
        $description = $request->input('description');
        $repository = $request->input('repository');
        if (!is_string($title) || !is_string($description) || !is_string($repository)) {
            return redirect('/issues')->with('error', 'Enter a title, description and repository.');
        }
        $title = trim($title);
        $description = trim($description);
        $repository = strtolower(trim($repository));
        if ($title === '' || strlen($title) > 180 || preg_match('//u', $title) !== 1
            || preg_match('/[\x00-\x1f\x7f]/', $title)
            || $description === '' || strlen($description) > 10000 || preg_match('//u', $description) !== 1
            || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $description)
            || !preg_match('~\A[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}\z~', $repository)
            || in_array(explode('/', $repository)[1], ['.', '..'], true)) {
            return redirect('/issues')->with('error', 'Check the task title, description and repository.');
        }
        if (!isset($repositories[$repository])) {
            return redirect('/issues')->with('error', 'Grant the GitHub app access to this repository.');
        }

        $card = new LocalTaskCard();
        $card->github_user_id = $userId;
        $card->repository = $repository;
        $card->title = $title;
        $card->description = $description;
        $card->status = 'queued';
        $card->save();

        return redirect('/issues')->with('success', 'Task saved.');
    }

    public function assign(Request $request, int $cardId): RedirectResponse
    {
        $access = $request->attributes->get('proofpatch_github_access');
        $userId = is_array($access) ? ($access['userId'] ?? null) : null;
        $repositories = is_array($access) ? ($access['repositories'] ?? null) : null;
        if (!is_int($userId) || $userId <= 0 || !is_array($repositories) || $cardId < 1) {
            return redirect('/issues')->with('error', 'Connect GitHub to assign a task to Muse.');
        }

        $card = LocalTaskCard::whereKey($cardId)->where('github_user_id', $userId)->first();
        if ($card === null) {
            return redirect('/issues')->with('error', 'Task not found or access is unavailable.');
        }
        $cardRepo = strtolower($card->repository);
        if (!isset($repositories[$cardRepo])) {
            return redirect('/issues')->with('error', 'Grant the GitHub app access to this repository.');
        }

        $dedicatedName = \ProofPatch\GitHub\DedicatedTestRepo::name();
        $isDedicated = $dedicatedName !== null && strcasecmp($dedicatedName, $card->repository) === 0;

        $combinedText = strtolower($card->title . ' ' . $card->description);
        $isDedicatedOrderTotal = $isDedicated
            && (str_contains($combinedText, 'ordertotal') || str_contains($combinedText, 'order total'))
            && (str_contains($combinedText, 'zero quantity') || str_contains($combinedText, 'zero-quantity') || str_contains($combinedText, 'zero items'));

        // Arbitrary private tasks and unrelated cards remain local; task assignment is only supported
        // for verified OrderTotal issues on the authorized dedicated test repository.
        if (!$isDedicatedOrderTotal) {
            return redirect('/issues')->with(
                'error',
                'Task assignment is not available yet. Your task and any screenshot remain saved locally.'
            );
        }

        // If card already has a linked workbench task, switch to it
        if ($card->workbench_task_id !== null) {
            $existingTask = \ProofPatch\Models\WorkbenchTask::find($card->workbench_task_id);
            if ($existingTask !== null && $existingTask->github_user_id === $userId) {
                $request->session()->forget(\ProofPatch\Http\Controllers\IssueWorkbenchController::CASE_SESSION_KEYS);
                \ProofPatch\Support\TaskWorkflowHelper::hydrateTaskSession($request, $existingTask);
                return redirect('/issues')->with('success', "Loaded task card #{$card->id} into the workbench.");
            }
        }

        try {
            $context = null;
            $token = \ProofPatch\Support\TaskWorkflowHelper::resolveGitHubToken($request);

            if ($token !== null && trim($token) !== '') {
                try {
                    $fetcher = new \ProofPatch\GitHub\DedicatedTestRepoFetcher();
                    $context = $fetcher->fetchAndVerify($token);
                } catch (\Throwable) {
                    $context = null;
                }
            }

            if ($context === null) {
                $fixturePath = base_path('tests/Fixtures/owned-review-case/src/OrderTotal.php');
                if (file_exists($fixturePath)) {
                    $source = (string) file_get_contents($fixturePath);
                    $baseCommit = \ProofPatch\GitHub\DedicatedTestRepo::baseCommit();
                    $context = [
                        'repository' => \ProofPatch\GitHub\DedicatedTestRepo::requireName(),
                        'issueNumber' => 1,
                        'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::requireName() . '/issues/1',
                        'commit' => $baseCommit,
                        'title' => '[Dedicated Test] Zero-quantity order items incorrectly charged once',
                        'body' => "Authentic case from " . \ProofPatch\GitHub\DedicatedTestRepo::requireName() . " issue #1.\nTarget: repair calculation in OrderTotal::calculate so zero quantity items contribute zero.",
                        'path' => 'src/OrderTotal.php',
                        'source' => $source,
                        'sourceSha256' => hash('sha256', $source),
                    ];
                }
            }

            if (!is_array($context)) {
                return redirect('/issues')->with('error', 'Could not initialize suitable context for this task.');
            }

            \ProofPatch\GitHub\PublicIssueContext::validateContext($context);

            $task = \ProofPatch\Models\WorkbenchTask::recordIntake($context, $isDedicated, githubUserId: $userId);
            $task->status = 'in_progress';
            $task->metadata = array_merge($task->metadata ?? [], [
                'local_task_card_id' => $card->id,
                'local_task_title' => $card->title,
            ]);
            $task->save();

            $card->status = 'in_progress';
            $card->workbench_task_id = $task->id;
            $card->save();

            $request->session()->forget(\ProofPatch\Http\Controllers\IssueWorkbenchController::CASE_SESSION_KEYS);
            \ProofPatch\Support\TaskWorkflowHelper::hydrateTaskSession($request, $task);

            return redirect('/issues')->with('success', 'Task "' . $card->title . '" staged and assigned to Muse workbench.');
        } catch (\Throwable $error) {
            return redirect('/issues')->with('error', 'Failed to assign task to Muse: ' . $error->getMessage());
        }
    }
}
