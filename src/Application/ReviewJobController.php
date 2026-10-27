<?php

declare(strict_types=1);

namespace ProofPatch\Application;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use ProofPatch\GitHub\PullRequestSnapshot;

final class ReviewJobController
{
    public function show(string $reviewId): JsonResponse
    {
        $review = DB::table('review_jobs')->where('id', $reviewId)->first();
        if ($review === null) {
            return response()->json(['message' => 'Review not found.'], 404)->header('Cache-Control', 'no-store');
        }

        $directory = getenv('PROOFPATCH_SNAPSHOT_DIR') ?: dirname(__DIR__, 2).'/artifacts/pull-requests';
        try {
            (new PullRequestSnapshot($directory))->verify($review->snapshot_id, $review->snapshot_sha256);
        } catch (\Throwable) {
            return response()->json(['message' => 'Saved snapshot is unavailable or does not match the review record.'], 409)
                ->header('Cache-Control', 'no-store');
        }

        return response()->json([
            'id' => $review->id,
            'repository' => $review->repository,
            'pull_number' => $review->pull_number,
            'head_sha' => $review->head_sha,
            'status' => $review->status,
            'snapshot_id' => $review->snapshot_id,
            'snapshot_sha256' => $review->snapshot_sha256,
            'snapshot_integrity' => 'matches_saved_digest',
        ])->header('Cache-Control', 'no-store');
    }
}
