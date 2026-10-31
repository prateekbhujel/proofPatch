<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

/**
 * Summarize captured pull request metadata for maintainer review.
 * File names and descriptions do not establish quality, authorship or coverage.
 */
final readonly class PrTriageAnalyzer
{
    private const DEFAULT_MAX_DIFF = 10000;
    private const MIN_BODY_LENGTH = 25;

    public function __construct(private array $policy = []) {}

    public function triage(array $targetPull, array $candidatePulls): array
    {
        $files = $this->fileNames($targetPull);
        $total = $this->calculateTotalChanges($targetPull);
        $truncated = (bool) ($targetPull['filesTruncated'] ?? false);
        $testPaths = $this->extractTestPaths($files);

        $limit = (int) ($this->policy['maxDiffLines'] ?? self::DEFAULT_MAX_DIFF);
        $coverageRequired = (bool) ($this->policy['requireTestCoverage'] ?? true);
        $exceeded = $total > $limit;
        $status = $exceeded ? 'review' : (($truncated || $coverageRequired) ? 'unknown' : 'within_limit');

        $comparisons = $this->buildComparisons($targetPull, $candidatePulls, $files, $truncated);
        $withShared = array_filter($comparisons, static fn (array $c): bool => $c['sharedFilesCount'] > 0);

        $evaluation = $this->evaluatePullStandards($targetPull, $testPaths, $total, $limit, $truncated, !empty($withShared));

        return [
            'target' => [
                'repository' => $targetPull['repository'] ?? 'unknown',
                'number' => $targetPull['number'] ?? 0,
                'headSha' => $targetPull['headSha'] ?? '',
                'title' => $targetPull['title'] ?? '',
                'base' => $targetPull['base'] ?? 'main',
                'head' => $targetPull['head'] ?? '',
                'totalChanges' => $total,
                'testPaths' => $testPaths,
                'fileCount' => count($files),
                'filesTruncated' => $truncated,
            ],
            'policy' => [
                'mode' => $this->policy['maintainerMode'] ?? 'MAINTAINER_STANDARDS',
                'status' => $status,
                'maxDiffLines' => $limit,
                'totalChanges' => $total,
                'diffExceeded' => $exceeded,
                'requireTestCoverage' => $coverageRequired,
                'coverage' => 'unknown',
            ],
            'summary' => [
                'verdict' => 'REVIEW',
                'classification' => $evaluation['classification'],
                'badge' => $evaluation['badge'],
                'headline' => $evaluation['headline'],
                'detail' => $evaluation['detail'],
                'severity' => $evaluation['severity'],
                'suggestedAction' => $evaluation['suggestedAction'],
                'suggestedComment' => $evaluation['suggestedComment'],
                'reasoning' => $evaluation['reasoning'],
                'flags' => $evaluation['flags'],
                'diagnostics' => $evaluation['diagnostics'],
            ],
            'comparisons' => array_values($comparisons),
        ];
    }

    private function evaluatePullStandards(
        array $targetPull,
        array $testPaths,
        int $total,
        int $limit,
        bool $truncated,
        bool $hasSharedFiles
    ): array {
        $title = trim((string) ($targetPull['title'] ?? ''));
        $body = trim((string) ($targetPull['body'] ?? $targetPull['description'] ?? ''));
        $combinedText = $title . "\n" . $body;
        $exceeded = $total > $limit;
        $flags = [];
        $diagnostics = [];

        if ($exceeded) {
            $flags[] = 'diff_exceeded';
            $diagnostics[] = "Changed lines ({$total}) exceed configured policy threshold ({$limit}).";
        } else {
            $diagnostics[] = "Changed lines ({$total}) are within policy threshold ({$limit}).";
        }

        if (strlen($body) < self::MIN_BODY_LENGTH) {
            $flags[] = 'short_description';
            $diagnostics[] = 'Pull request description is brief (< 25 chars); context and motivation may be missing.';
        }

        if ($testPaths === []) {
            $flags[] = 'no_test_paths_observed';
            $diagnostics[] = 'No test file paths were observed in the diff list.';
            if (preg_match('/\b(?:performance|optimiz[a-z]*|faster|speedup|cleanup|refactor)\b/i', $combinedText) === 1) {
                $flags[] = 'unverified_claim_without_tests';
                $diagnostics[] = 'Title or description claims optimization/cleanup without accompanying test or benchmark files in the diff.';
            }
        } else {
            $diagnostics[] = count($testPaths) . ' test file path(s) observed in diff, though file names alone do not prove execution or coverage.';
        }

        if (preg_match('/(?:#\d+\b|(?:fixes|closes|resolves)\s+#?\d+)/i', $combinedText) !== 1) {
            $flags[] = 'no_linked_issue_observed';
        }

        if ($truncated) {
            $flags[] = 'files_truncated';
            $diagnostics[] = 'Captured file list was truncated by pagination bounds.';
        }

        if (isset($this->policy['defaultBranch']) && ($targetPull['base'] ?? '') !== ''
            && strcasecmp((string) $targetPull['base'], (string) $this->policy['defaultBranch']) !== 0) {
            $flags[] = 'different_target_branch';
            $diagnostics[] = 'Target base branch (' . $targetPull['base'] . ') differs from configured default branch (' . $this->policy['defaultBranch'] . ').';
        }

        $headline = $exceeded ? 'Changed lines exceed the configured limit'
            : ($hasSharedFiles ? 'Shared file paths found' : 'Review pull request');
        $detail = $truncated
            ? 'The captured file list is incomplete. Review the changes and test results on GitHub.'
            : 'File names and descriptions cannot establish test coverage or code quality.';

        return [
            'classification' => 'UNVERIFIED_REVIEW',
            'badge' => 'Needs review',
            'headline' => $headline,
            'detail' => $detail,
            'severity' => 'amber',
            'suggestedAction' => 'Review the changes and test results.',
            'suggestedComment' => '',
            'reasoning' => $hasSharedFiles
                ? 'Some captured file paths overlap with other pull requests; this does not establish duplicate work.'
                : 'Only captured metadata and file names were compared.',
            'flags' => $flags,
            'diagnostics' => $diagnostics,
        ];
    }

    /** Summarize an issue without inferring that it can be reproduced or automatically fixed. */
    public function triageIssue(array $issue): array
    {
        $number = (int) ($issue['number'] ?? 0);
        $body = trim((string) ($issue['body'] ?? $issue['description'] ?? ''));
        $hasImage = (bool) ($issue['hasImage'] ?? false)
            || preg_match('/!\[[^\]]*\]\([^)]+\)|<img\b[^>]*>|https?:\/\/\S+\.(?:png|jpe?g|gif|webp)\b/i', $body) === 1;
        $textOnly = trim((string) preg_replace('/!\[[^\]]*\]\([^)]+\)|<img\b[^>]*>/i', '', $body));
        $short = strlen($textOnly) < self::MIN_BODY_LENGTH;

        $flags = [];
        if ($short) {
            $flags[] = 'short_description';
        }
        if ($hasImage) {
            $flags[] = 'screenshot_attached';
        }

        $headline = $hasImage && $short
            ? 'Screenshot attached with brief description'
            : ($short ? 'Issue description is brief' : 'Review issue details');

        $suggestedComment = '';
        if ($hasImage && $short) {
            $suggestedComment = 'Thanks for the report and screenshot. Screenshots are kept local and not read automatically—could you share the text steps to reproduce this, along with the expected and actual results?';
        } elseif ($short) {
            $suggestedComment = 'Thanks for the report. Could you share the steps to reproduce this, along with the expected and actual results?';
        }

        return [
            'issueNumber' => $number,
            'classification' => 'ISSUE_REVIEW',
            'badge' => 'Needs review',
            'category' => $hasImage && $short ? 'needs-text-repro' : 'needs-repro',
            'severity' => 'amber',
            'headline' => $headline,
            'suggestedAction' => $hasImage
                ? 'Review the issue and ensure written reproduction steps accompany any screenshot.'
                : 'Review the issue and confirm how to reproduce it.',
            'suggestedComment' => $suggestedComment,
            'flags' => $flags,
        ];
    }

    private function calculateTotalChanges(array $pull): int
    {
        $total = 0;
        foreach ($pull['files'] ?? [] as $file) {
            $total += ($file['additions'] ?? 0) + ($file['deletions'] ?? 0);
        }
        return $total;
    }

    private function extractTestPaths(array $files): array
    {
        return array_values(array_filter($files, static fn (string $file): bool =>
            (bool) preg_match('~(?:^|/)(?:tests?|__tests__)/|(?:^|/)[^/]+[._-](?:test|spec)\.[^/]+$~i', $file)
            || (bool) preg_match('~(?:^|/)[^/]+(?:Test|Spec)\.[^/]+$~', $file)));
    }

    private function buildComparisons(array $targetPull, array $candidatePulls, array $files, bool $truncated): array
    {
        $comparisons = [];
        $targetRepo = $targetPull['repository'] ?? null;

        foreach ($candidatePulls as $candidate) {
            $candidateRepo = $candidate['repository'] ?? null;
            if (!is_string($targetRepo) || $targetRepo === '' || !is_string($candidateRepo)
                || strcasecmp($targetRepo, $candidateRepo) !== 0
                || ($candidate['number'] ?? null) === ($targetPull['number'] ?? null)) {
                continue;
            }
            $candidateFiles = $this->fileNames($candidate);
            $shared = array_values(array_intersect($files, $candidateFiles));
            $union = array_values(array_unique(array_merge($files, $candidateFiles)));
            $score = count($union) ? count($shared) / count($union) : 0.0;
            $incomplete = $truncated || (bool) ($candidate['filesTruncated'] ?? false);
            $number = $candidate['number'] ?? 0;
            $comparisons[] = [
                'candidate' => [
                    'repository' => $candidateRepo,
                    'number' => $number,
                    'headSha' => $candidate['headSha'] ?? '',
                    'title' => $candidate['title'] ?? '',
                    'fileCount' => count($candidateFiles),
                ],
                'jaccardScore' => round($score, 4),
                'matchPercentage' => (int) round($score * 100),
                'sharedFiles' => $shared,
                'sharedFilesCount' => count($shared),
                'incomplete' => $incomplete,
                'relationship' => count($shared) ? 'SHARED_FILES' : 'NO_SHARED_FILES_OBSERVED',
                'verdictBanner' => count($shared)
                    ? 'Shared file paths with PR #' . $number . '. This does not establish a duplicate fix.'
                    : 'No shared file paths observed with PR #' . $number . '.',
            ];
        }

        return $comparisons;
    }

    private function fileNames(array $pull): array
    {
        $names = [];
        foreach ($pull['files'] ?? [] as $file) {
            if (is_string($file['name'] ?? null)) {
                $names[] = $file['name'];
            }
        }
        sort($names);
        return array_values(array_unique($names));
    }
}
