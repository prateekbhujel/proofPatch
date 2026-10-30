<?php

declare(strict_types=1);

namespace ProofPatch\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use ProofPatch\Agent\CardProposalReservation;
use ProofPatch\Agent\Credentials;
use ProofPatch\Agent\PublicCardProposal;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Agent\SingleUseReviewApproval;
use ProofPatch\GitHub\GitHubAppClient;
use ProofPatch\GitHub\PublicCardPreview;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Explicitly approved public-card suggestions; never executes or changes GitHub. */
final class CardProposalController
{
    public function __construct(
        private ?HttpClientInterface $http = null,
        private ?RequestBudget $budget = null,
        private ?SingleUseReviewApproval $approvals = null,
        private ?string $testKey = null,
    ) {}

    private function service(): PublicCardProposal
    {
        $http = $this->http ?? HttpClient::create();
        return new PublicCardProposal($http, new PublicCardPreview($http), $this->budget ?? RequestBudget::forRuntime(),
            $this->approvals ?? new SingleUseReviewApproval(storage_path('app/card_approvals')));
    }

    public function prepare(Request $request, int $cardId): RedirectResponse
    {
        $request->session()->forget(['card_proposal_preview', 'card_proposal_result']);
        $card = CardPreviewController::authorizedCard($request, $cardId);
        $preview = CardPreviewController::visiblePreview($request);
        if ($card === null || !is_array($preview) || ($preview['context']['cardId'] ?? null) !== $cardId) {
            return redirect('/issues')->with('error', 'Create a current public-file preview for this task first.');
        }
        try {
            $proposal = $this->service()->issueApproval($preview, CardPreviewController::snapshot($card));
            $proposal['cardId'] = $cardId;
            $request->session()->put('card_proposal_preview', $proposal);
            return redirect('/issues');
        } catch (\Throwable) {
            return redirect('/issues')->with('error', 'Unable to prepare this request. Check the task content and try again.');
        }
    }

    public function send(Request $request, int $cardId): RedirectResponse
    {
        if ($request->input('approved') !== true) {
            return redirect('/issues')->with('error', 'Review and approve the exact request first.');
        }
        $preview = CardPreviewController::visiblePreview($request);
        $payload = $request->session()->get('card_proposal_preview');
        if (!is_array($preview) || ($preview['context']['cardId'] ?? null) !== $cardId || !is_array($payload)
            || ($payload['cardId'] ?? null) !== $cardId
            || !is_string($payload['approvalToken'] ?? null) || !is_string($payload['digest'] ?? null)
            || !is_string($request->input('digest')) || !hash_equals($payload['digest'], $request->input('digest'))) {
            return redirect('/issues')->with('error', 'Review the current request again.');
        }
        $auth = $request->session()->get('github_auth');
        $token = is_array($auth) && is_string($auth['token'] ?? null) ? $auth['token'] : '';
        $sessionUser = $auth['user']['id'] ?? null;
        if ($token === '' || !is_int($sessionUser) || $sessionUser < 1) {
            return redirect('/issues')->with('error', 'Connect GitHub before requesting a suggestion.');
        }
        $http = $this->http ?? HttpClient::create();
        $load = function () use ($request, $cardId, $token, $sessionUser, $http): ?array {
            $card = CardPreviewController::authorizedCard($request, $cardId);
            if ($card === null || (int) $card->github_user_id !== $sessionUser) return null;
            $client = new GitHubAppClient($http);
            $user = $client->getCurrentUser($token);
            if (($user['id'] ?? null) !== $sessionUser) return null;
            $status = [];
            $repos = $client->listSelectedRepositories($token, $status);
            // installationsCount also rejects legacy user-wide fallback on a 403.
            if (($status['truncated'] ?? true) || !empty($status['errors']) || ($status['installationsCount'] ?? 0) < 1) return null;
            foreach ($repos as $repo) {
                if (strcasecmp((string) ($repo['fullName'] ?? ''), $card->repository) === 0
                    && ($repo['isPrivate'] ?? null) === false) {
                    return CardPreviewController::snapshot($card);
                }
            }
            return null;
        };
        $reservation = new CardProposalReservation();
        try {
            $result = $this->service()->propose($preview, $load, true, $payload['approvalToken'], $payload['digest'],
                $this->testKey ?? Credentials::baseten(), $reservation->reserve(...), $reservation->finish(...));
            $request->session()->forget('card_proposal_preview');
            $request->session()->put('card_proposal_result', $result);
            return redirect('/issues')->with('success', 'Suggestion ready for review.');
        } catch (\Throwable) {
            // A call may already have reached the provider. Do not retry automatically.
            $request->session()->forget(['card_proposal_preview', 'card_proposal_result']);
            return redirect('/issues')->with('error', 'The request did not complete. It may have used credits; review again before retrying.');
        }
    }

    public static function visible(Request $request, string $key): ?array
    {
        $value = $request->session()->get($key);
        if (!is_array($value)) return null;
        $id = $value['cardId'] ?? null;
        $card = is_int($id) ? CardPreviewController::authorizedCard($request, $id) : null;
        if ($card === null || ($key === 'card_proposal_preview' && CardPreviewController::visiblePreview($request) === null)) {
            $request->session()->forget($key);
            return null;
        }
        unset($value['approvalToken']);
        return $value;
    }
}
