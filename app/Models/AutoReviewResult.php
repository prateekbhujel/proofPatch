<?php

declare(strict_types=1);

namespace ProofPatch\Models;

use Illuminate\Database\Eloquent\Model;

final class AutoReviewResult extends Model
{
    protected $table = 'auto_review_results';

    protected $fillable = [
        'repository',
        'pull_number',
        'head_sha',
        'base_sha',
        'status',
        'is_public',
        'summary',
        'risk_level',
        'recommendation',
        'file_findings',
        'raw_review',
        'usage',
        'error_message',
        'published_status',
        'model',
        'input_digest',
        'reviewed_at',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'file_findings' => 'array',
        'raw_review' => 'array',
        'usage' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public static function findForRevision(string $repository, int $pullNumber, string $headSha, string $baseSha): ?self
    {
        return self::where('repository', $repository)
            ->where('pull_number', $pullNumber)
            ->where('head_sha', $headSha)
            ->where('base_sha', $baseSha)
            ->latest('id')
            ->first();
    }

    public static function hasCompletedReview(string $repository, int $pullNumber, string $headSha, string $baseSha): bool
    {
        return self::where('repository', $repository)
            ->where('pull_number', $pullNumber)
            ->where('head_sha', $headSha)
            ->where('base_sha', $baseSha)
            ->where('status', 'completed')
            ->exists();
    }
}
