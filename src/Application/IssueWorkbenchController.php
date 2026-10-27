<?php

declare(strict_types=1);

namespace ProofPatch\Application;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use ProofPatch\Agent\Credentials;
use ProofPatch\Agent\IssueSuggestion;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\GitHub\PublicIssueContext;
use Symfony\Component\HttpClient\HttpClient;

final class IssueWorkbenchController
{
    private function budget(): RequestBudget
    {
        $home = getenv('HOME');
        if (!$home) {
            throw new \RuntimeException('The local request budget is unavailable.');
        }
        return new RequestBudget($home.'/.local/share/proofpatch/runtime');
    }

    public function show(Request $request): Response
    {
        $context = $request->session()->get('issue_context');
        $preview = null;
        $budget = null;
        try {
            $budget = $this->budget()->status();
            if (is_array($context)) {
                $preview = (new IssueSuggestion(HttpClient::create(), $this->budget()))->preview($context);
                $budget['canRequest'] = $budget['canRequest'] && $budget['remainingMicros'] >= $preview['estimatedMicros'];
            }
        } catch (\Throwable) {
            $request->session()->forget('issue_context');
        }
        return Inertia::render('Issues', [
            'context' => is_array($context) && $preview !== null ? $context : null,
            'preview' => $preview,
            'suggestion' => $request->session()->get('issue_suggestion'),
            'budget' => $budget,
            'error' => $request->session()->get('error'),
        ]);
    }

    public function capture(Request $request): RedirectResponse
    {
        $request->session()->forget(['issue_context', 'issue_suggestion']);
        try {
            $url = $request->input('issue_url');
            $path = $request->input('path');
            if (!is_string($url) || strlen($url) > 512 || !is_string($path)) {
                throw new \InvalidArgumentException('Enter a public GitHub issue URL and a source file path.');
            }
            $context = (new PublicIssueContext(HttpClient::create()))->fetch($url, $path);
            $request->session()->put('issue_context', $context);
            return redirect('/issues');
        } catch (\Throwable $error) {
            return redirect('/issues')->with('error', $error->getMessage());
        }
    }

    public function propose(Request $request): RedirectResponse
    {
        $context = $request->session()->get('issue_context');
        $digest = $request->input('digest');
        // Consume the preview before the call: a retry requires a fresh review and approval.
        $request->session()->forget(['issue_context', 'issue_suggestion']);
        // Persist while the session lock is held, even if the worker dies during the provider call.
        $request->session()->save();
        try {
            if ($request->input('approved') !== true || !is_array($context) || !is_string($digest)) {
                throw new \InvalidArgumentException('Review and approve the request first.');
            }
            if (!$this->budget()->status()['canRequest']) {
                throw new \RuntimeException('The local model request allowance is exhausted.');
            }
            $service = new IssueSuggestion(HttpClient::create(), $this->budget());
            if (!hash_equals($service->preview($context)['digest'], $digest)) {
                throw new \InvalidArgumentException('Review and approve the exact request first.');
            }
            // Refetch without credentials to verify the issue, public visibility and commit still match.
            $current = (new PublicIssueContext(HttpClient::create()))->fetch($context['issueUrl'], $context['path']);
            if (!hash_equals($service->preview($current)['digest'], $digest)) {
                throw new \RuntimeException('The issue or repository changed. Preview the request again.');
            }
            $suggestion = $service->propose($current, $digest, Credentials::baseten());
            $request->session()->put('issue_suggestion', $suggestion);
            return redirect('/issues');
        } catch (\Throwable $error) {
            return redirect('/issues')->with('error', $error->getMessage());
        }
    }
}
