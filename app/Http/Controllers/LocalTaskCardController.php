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
}
