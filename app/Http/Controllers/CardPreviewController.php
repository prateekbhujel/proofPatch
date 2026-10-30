<?php

declare(strict_types=1);

namespace ProofPatch\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use ProofPatch\Evidence\CanonicalJson;
use ProofPatch\GitHub\PublicCardPreview;
use ProofPatch\Models\LocalTaskCard;
use Symfony\Component\HttpClient\HttpClient;

/** Local preview only; it does not authorize or send a model request. */
final class CardPreviewController
{
    public function __construct(private ?PublicCardPreview $previewer = null) {}

    public function store(Request $request, int $cardId): RedirectResponse
    {
        $request->session()->forget(['card_preview', 'card_proposal_preview', 'card_proposal_result']);
        $card = self::authorizedCard($request, $cardId);
        if ($card === null) {
            return redirect('/issues')->with('error', 'Task not found or access is unavailable.');
        }
        $path = $request->input('path');
        $commit = $request->input('commit');
        if (!is_string($path) || !is_string($commit)) {
            return redirect('/issues')->with('error', 'Choose a file path and full commit SHA.');
        }
        try {
            $snapshot = self::snapshot($card);
            $preview = ($this->previewer ?? new PublicCardPreview(HttpClient::create()))->preview($snapshot, trim($path), trim($commit));
            // The card or grant may have changed while GitHub was being read.
            $current = self::authorizedCard($request, $cardId);
            if ($current === null || !hash_equals(PublicCardPreview::cardVersion($snapshot), PublicCardPreview::cardVersion(self::snapshot($current)))) {
                throw new \RuntimeException('The task changed; create a new preview.');
            }
            $request->session()->put('card_preview', $preview);
            return redirect('/issues')->with('success', 'Preview ready. Nothing was sent to a model.');
        } catch (\Throwable $error) {
            return redirect('/issues')->with('error', $error->getMessage());
        }
    }

    public static function visiblePreview(Request $request): ?array
    {
        $preview = $request->session()->get('card_preview');
        $context = is_array($preview) ? ($preview['context'] ?? null) : null;
        $id = is_array($context) ? ($context['cardId'] ?? null) : null;
        $card = is_int($id) ? self::authorizedCard($request, $id) : null;
        try {
            if ($card === null || !is_string($preview['digest'] ?? null)
                || ($preview['status'] ?? null) !== 'local_preview_not_sent'
                || !hash_equals($preview['digest'], hash('sha256', CanonicalJson::encode($context)))
                || !is_string($context['cardVersion'] ?? null)
                || !hash_equals($context['cardVersion'], PublicCardPreview::cardVersion(self::snapshot($card)))) {
                throw new \RuntimeException('Stale preview');
            }
            return $preview;
        } catch (\Throwable) {
            $request->session()->forget('card_preview');
            return null;
        }
    }

    public static function authorizedCard(Request $request, int $cardId): ?LocalTaskCard
    {
        $access = $request->attributes->get('proofpatch_github_access');
        $userId = is_array($access) ? ($access['userId'] ?? null) : null;
        $repos = is_array($access) ? ($access['repositories'] ?? null) : null;
        if (!is_int($userId) || $userId <= 0 || !is_array($repos) || $cardId <= 0) {
            return null;
        }
        $card = LocalTaskCard::whereKey($cardId)->where('github_user_id', $userId)->first();
        return $card !== null && isset($repos[strtolower($card->repository)]) ? $card : null;
    }

    public static function snapshot(LocalTaskCard $card): array
    {
        return ['id' => (int) $card->id, 'userId' => (int) $card->github_user_id,
            'repository' => $card->repository, 'title' => $card->title, 'description' => $card->description];
    }
}
