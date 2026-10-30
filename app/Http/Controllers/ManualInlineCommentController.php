<?php

declare(strict_types=1);

namespace ProofPatch\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use ProofPatch\GitHub\ManualInlineCommentPublisher;
use ProofPatch\GitHub\PrivatePullSession;
use Symfony\Component\HttpClient\HttpClient;

final class ManualInlineCommentController
{
    public function __construct(private ?ManualInlineCommentPublisher $publisher = null) {}

    public function store(Request $request): RedirectResponse
    {
        $access = $request->attributes->get('proofpatch_github_access');
        $auth = $request->session()->get('github_auth');
        $pull = $request->session()->get('pullRequest');
        $drafts = $request->session()->get('review_drafts', []);
        $id = $request->input('id');
        $digest = $request->input('digest');
        $draft = is_string($id) && is_array($drafts) ? ($drafts[$id] ?? null) : null;

        if (is_array($pull) && ($pull['isPrivate'] ?? false) === true && !PrivatePullSession::allows($request, $pull)) {
            PrivatePullSession::clear($request);
            return redirect('/repositories')->with('review_error', 'Connect GitHub and grant access to this repository.');
        }

        if ($request->input('approved') !== true || !is_array($access) || !is_int($access['userId'] ?? null)
            || !is_array($auth) || !is_string($auth['token'] ?? null) || !is_array($pull)
            || !is_array($draft) || !is_string($digest)) {
            return redirect('/repositories?preview=1')->with('review_error', 'Connect GitHub and approve the exact draft before posting.');
        }
        try {
            $publisher = $this->publisher ?? new ManualInlineCommentPublisher(HttpClient::create());
            $publisher->publish($auth['token'], $access['userId'], $pull, $draft, $digest);
            unset($drafts[$id]);
            $request->session()->put('review_drafts', $drafts);
            return redirect('/repositories?preview=1')->with('comment_posted', true);
        } catch (\Throwable $e) {
            return redirect('/repositories?preview=1')->with('review_error', $e->getMessage());
        }
    }
}
