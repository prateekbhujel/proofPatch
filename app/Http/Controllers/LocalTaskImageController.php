<?php

declare(strict_types=1);

namespace ProofPatch\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use ProofPatch\Models\LocalTaskCard;
use Symfony\Component\HttpFoundation\Response;

/** Stores one private image with a task; images are not sent to a model. */
final class LocalTaskImageController
{
    private const MAX_BYTES = 2_000_000;
    private const MAX_PIXELS = 16_000_000;

    public function store(Request $request, int $cardId): RedirectResponse
    {
        $card = $this->authorizedCard($request, $cardId);
        if ($card === null) {
            return redirect('/issues')->with('error', 'Task not found or access is unavailable.');
        }
        $file = $request->file('image');
        if (!$file || !$file->isValid() || !is_int($file->getSize()) || $file->getSize() < 1 || $file->getSize() > self::MAX_BYTES) {
            return redirect('/issues')->with('error', 'Choose a PNG or JPEG image under 2 MB.');
        }
        $bytes = file_get_contents($file->getPathname(), false, null, 0, self::MAX_BYTES + 1);
        if ($bytes === false || strlen($bytes) > self::MAX_BYTES) {
            return redirect('/issues')->with('error', 'Could not read the image.');
        }
        $info = @getimagesizefromstring($bytes);
        $mime = is_array($info) ? ($info['mime'] ?? null) : null;
        if (!in_array($mime, ['image/png', 'image/jpeg'], true)
            || ($info[0] ?? 0) < 1 || ($info[1] ?? 0) < 1
            || $info[0] * $info[1] > self::MAX_PIXELS
            || !function_exists('imagecreatefromstring')
            || ($decoded = @imagecreatefromstring($bytes)) === false) {
            return redirect('/issues')->with('error', 'Choose a valid PNG or JPEG image.');
        }
        imagedestroy($decoded);

        // Do not replace an existing image or erase it on concurrent requests.
        $updated = LocalTaskCard::whereKey($card->id)->whereNull('image_bytes')->update([
            'image_bytes' => $bytes,
            'image_mime' => $mime,
            'updated_at' => now(),
        ]);
        if ($updated !== 1) {
            return redirect('/issues')->with('error', 'This task already has an image.');
        }
        return redirect('/issues')->with('success', 'Image saved.');
    }

    public function show(Request $request, int $cardId): Response
    {
        $card = $this->authorizedCard($request, $cardId);
        if ($card === null || !is_string($card->image_bytes)
            || !in_array($card->image_mime, ['image/png', 'image/jpeg'], true)) {
            return response('Not found.', 404)->header('Cache-Control', 'no-store');
        }
        return response($card->image_bytes, 200, [
            'Content-Type' => $card->image_mime,
            'Content-Disposition' => 'inline',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function authorizedCard(Request $request, int $cardId): ?LocalTaskCard
    {
        $access = $request->attributes->get('proofpatch_github_access');
        $userId = is_array($access) ? ($access['userId'] ?? null) : null;
        $repositories = is_array($access) ? ($access['repositories'] ?? null) : null;
        if (!is_int($userId) || $userId <= 0 || !is_array($repositories) || $cardId < 1) {
            return null;
        }
        $card = LocalTaskCard::whereKey($cardId)->where('github_user_id', $userId)->first();
        return $card !== null && isset($repositories[strtolower($card->repository)]) ? $card : null;
    }
}
