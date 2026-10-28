<?php

declare(strict_types=1);

namespace ProofPatch\Http\Controllers;

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
    public function __construct(
        private ?\Symfony\Contracts\HttpClient\HttpClientInterface $http = null,
        private ?RequestBudget $customBudget = null,
    ) {}

    private function getHttpClient(): \Symfony\Contracts\HttpClient\HttpClientInterface
    {
        return $this->http ?? HttpClient::create();
    }

    private function budget(): RequestBudget
    {
        return $this->customBudget ?? RequestBudget::forRuntime();
    }

    public function show(Request $request): Response
    {
        $context = $request->session()->get('issue_context');
        $preview = null;
        $budget = null;
        try {
            $budget = $this->budget()->status();
            if (is_array($context)) {
                $preview = (new IssueSuggestion($this->getHttpClient(), $this->budget()))->preview($context);
                $budget['canRequest'] = $budget['canRequest'] && $budget['remainingMicros'] >= $preview['estimatedMicros'];
            }
        } catch (\Throwable) {
            $request->session()->forget('issue_context');
        }
        return Inertia::render('Issues', [
            'context' => is_array($context) && $preview !== null ? $context : null,
            'preview' => $preview,
            'suggestion' => $request->session()->get('issue_suggestion'),
            'draft' => $request->session()->get('issue_draft'),
            'verificationReport' => $request->session()->get('issue_verification_report'),
            'isOwnedFixture' => (bool) $request->session()->get('issue_is_owned_fixture'),
            'budget' => $budget,
            'error' => $request->session()->get('error'),
        ]);
    }

    public function loadOwnedCase(Request $request): RedirectResponse
    {
        $request->session()->forget(['issue_context', 'issue_suggestion', 'issue_draft', 'issue_verification_report']);
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $srcFile = $fixturePath.'/src/OrderTotal.php';
        if (!file_exists($srcFile)) {
            return redirect('/issues')->with('error', 'Owned review case fixture not found.');
        }

        $source = (string) file_get_contents($srcFile);
        $context = [
            'isSynthetic' => true,
            'provenance' => 'Local checked-in test fixture (tests/Fixtures/owned-review-case)',
            'repository' => 'synthetic-fixture/order-total',
            'issueNumber' => 101,
            'issueUrl' => null,
            'commit' => null,
            'title' => '[Synthetic Fixture] Zero-quantity order items incorrectly charged once',
            'body' => "NOTICE: Deliberately seeded offline synthetic test case from tests/Fixtures/owned-review-case.\n"
                ."Checked-in local test case; no remote GitHub issue or commit provenance.\n"
                ."In tests/order_total.php, expected 250, got 750 because max(1, quantity) is used.\n"
                ."Target: repair calculation in OrderTotal::calculate so zero quantity items contribute zero.",
            'path' => 'src/OrderTotal.php',
            'source' => $source,
            'sourceSha256' => hash('sha256', $source),
        ];

        PublicIssueContext::validateContext($context);
        $request->session()->put('issue_context', $context);
        $request->session()->put('issue_is_owned_fixture', true);

        return redirect('/issues');
    }

    public function saveDraft(Request $request): RedirectResponse
    {
        $comment = (string) $request->input('comment', '');
        if (trim($comment) === '') {
            $request->session()->forget('issue_draft');
        } else {
            $request->session()->put('issue_draft', [
                'comment' => $comment,
                'savedAt' => gmdate(DATE_ATOM),
                'readOnlyPolicy' => 'Local draft only. No external GitHub pull request comments or mutations are made without explicit user authorization.',
            ]);
        }
        return redirect('/issues');
    }

    public function capture(Request $request): RedirectResponse
    {
        $request->session()->forget(['issue_context', 'issue_suggestion', 'issue_draft', 'issue_is_owned_fixture', 'issue_verification_report']);
        try {
            $url = $request->input('issue_url');
            $path = $request->input('path');
            if (!is_string($url) || strlen($url) > 512 || !is_string($path)) {
                throw new \InvalidArgumentException('Enter a public GitHub issue URL and a source file path.');
            }
            $context = (new PublicIssueContext($this->getHttpClient()))->fetch($url, $path);
            $request->session()->put('issue_context', $context);
            $request->session()->put('issue_is_owned_fixture', false);
            return redirect('/issues');
        } catch (\Throwable $error) {
            return redirect('/issues')->with('error', $error->getMessage());
        }
    }

    public function propose(Request $request): RedirectResponse
    {
        $context = $request->session()->get('issue_context');
        $isOwned = (bool) $request->session()->get('issue_is_owned_fixture');
        $digest = $request->input('digest');
        // Consume the preview before the call: a retry requires a fresh review and approval.
        $request->session()->forget(['issue_context', 'issue_suggestion', 'issue_verification_report']);
        // Persist while the session lock is held, even if the worker dies during the provider call.
        $request->session()->save();
        try {
            if ($request->input('approved') !== true || !is_array($context) || !is_string($digest)) {
                throw new \InvalidArgumentException('Review and approve the request first.');
            }
            if (!$this->budget()->status()['canRequest']) {
                throw new \RuntimeException('The local model request allowance is exhausted.');
            }
            $service = new IssueSuggestion($this->getHttpClient(), $this->budget());
            if (!hash_equals($service->preview($context)['digest'], $digest)) {
                throw new \InvalidArgumentException('Review and approve the exact request first.');
            }

            if ($isOwned) {
                // Verify local fixture integrity
                $fixturePath = base_path('tests/Fixtures/owned-review-case/src/OrderTotal.php');
                if (!file_exists($fixturePath) || hash_file('sha256', $fixturePath) !== $context['sourceSha256']) {
                    throw new \RuntimeException('The local fixture file was modified.');
                }

                $hasKey = false;
                try {
                    $key = Credentials::baseten();
                    $hasKey = is_string($key) && strlen($key) >= 16;
                } catch (\Throwable) {
                    $hasKey = false;
                }

                if ($hasKey) {
                    $suggestion = $service->propose($context, $digest, Credentials::baseten());
                    $suggestion['commit'] = null;
                    $suggestion['isSynthetic'] = true;
                    $suggestion['provenance'] = 'Local checked-in test fixture (tests/Fixtures/owned-review-case)';
                } else {
                    // Safe offline deterministic proposal clearly marked as an offline reference example
                    $candidateSource = \ProofPatch\Agent\SingleFileCandidate::create(
                        $context['source'],
                        $context['sourceSha256'],
                        "max(1, \$item['quantity'])",
                        "\$item['quantity']",
                    );
                    $suggestion = [
                        'status' => 'offline_reference_example',
                        'isOfflineExample' => true,
                        'isSynthetic' => true,
                        'provenance' => 'Local checked-in test fixture (tests/Fixtures/owned-review-case)',
                        'repository' => $context['repository'],
                        'issueNumber' => $context['issueNumber'],
                        'commit' => null,
                        'path' => $context['path'],
                        'sourceSha256' => $context['sourceSha256'],
                        'find' => "max(1, \$item['quantity'])",
                        'replace' => "\$item['quantity']",
                        'explanation' => "Offline reference example for OrderTotal boundary calculation. No external provider call was made.",
                        'model' => null,
                        'requestDigest' => $digest,
                        'usage' => null,
                        'candidate' => [
                            'status' => 'unverified_in_memory_preview',
                            'source' => $candidateSource,
                            'sha256' => hash('sha256', $candidateSource),
                            'applied' => false,
                            'verified' => false,
                        ],
                    ];
                }
            } else {
                // Refetch without credentials to verify the issue, public visibility and commit still match.
                $current = (new PublicIssueContext($this->getHttpClient()))->fetch($context['issueUrl'], $context['path']);
                if (!hash_equals($service->preview($current)['digest'], $digest)) {
                    throw new \RuntimeException('The issue or repository changed. Preview the request again.');
                }
                $suggestion = $service->propose($current, $digest, Credentials::baseten());
            }

            $suggestion['safetyNotice'] = 'Host execution of untrusted PHP candidates is disabled: worktrees and temporary directories are not security sandboxes. This candidate is an in-memory preview only.';
            $request->session()->put('issue_suggestion', $suggestion);
            return redirect('/issues');
        } catch (\Throwable $error) {
            return redirect('/issues')->with('error', $error->getMessage());
        }
    }

    public function verifyCandidate(Request $request): RedirectResponse
    {
        $suggestion = $request->session()->get('issue_suggestion');
        $isOwned = (bool) $request->session()->get('issue_is_owned_fixture');
        $context = $request->session()->get('issue_context');

        if (!is_array($suggestion) || !isset($suggestion['candidate']['source'])) {
            return redirect('/issues')->with('error', 'No candidate proposal available to verify.');
        }

        if (!$isOwned || ($suggestion['path'] ?? '') !== 'src/OrderTotal.php') {
            return redirect('/issues')->with('error', 'Automated host verification is currently restricted to the allowlisted owned review case fixture. Worktrees and temporary directories are not security sandboxes for arbitrary untrusted code.');
        }

        try {
            $candidateSource = (string) $suggestion['candidate']['source'];
            $verifier = new \ProofPatch\Verifier\OwnedCaseVerifier(base_path());
            $report = $verifier->verify($candidateSource, is_array($context) ? $context : null);

            $request->session()->put('issue_verification_report', $report);

            // Update candidate verified status in suggestion
            $suggestion['candidate']['verified'] = ($report['decision'] === 'VERIFIED');
            $suggestion['candidate']['verificationRunId'] = $report['id'];
            $suggestion['candidate']['status'] = $report['decision'] === 'VERIFIED' ? 'verified_allowlisted_candidate' : 'failed_verification';
            $request->session()->put('issue_suggestion', $suggestion);

            $this->addNotification(
                $request,
                $report['decision'] === 'VERIFIED' ? 'success' : 'warning',
                $report['decision'] === 'VERIFIED' ? 'Candidate Verified with Receipt' : 'Candidate Verification Failed',
                "OrderTotal bug verification {$report['decision']}: run {$report['id']}, receipt {$report['receipt']['sha256']}.",
                '/issues'
            );

            return redirect('/issues');
        } catch (\Throwable $error) {
            return redirect('/issues')->with('error', 'Verification error: ' . $error->getMessage());
        }
    }

    private function addNotification(Request $request, string $type, string $title, string $message, ?string $link = null): void
    {
        $notifications = (array) $request->session()->get('notifications', []);
        array_unshift($notifications, [
            'id' => bin2hex(random_bytes(8)),
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'link' => $link,
            'timestamp' => gmdate(DATE_ATOM),
            'read' => false,
        ]);
        $notifications = array_slice($notifications, 0, 20);
        $request->session()->put('notifications', $notifications);
    }
}
