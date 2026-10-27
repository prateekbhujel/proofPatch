<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

final readonly class PrTriageAnalyzer
{
    public function __construct(private array $policy = [])
    {
    }

    /**
     * Analyze a target PR against a list of candidate PRs (or single candidate).
     */
    public function triage(array $targetPull, array $candidatePulls): array
    {
        $targetFiles = $this->extractFileNames($targetPull);
        $totalChanges = 0;
        foreach ($targetPull['files'] ?? [] as $file) {
            $totalChanges += ($file['additions'] ?? 0) + ($file['deletions'] ?? 0);
        }
        $hasTests = false;
        foreach ($targetFiles as $file) {
            if (preg_match('/(?:test|spec|tests\/|__tests__)/i', $file)) {
                $hasTests = true;
                break;
            }
        }

        $policyEvaluation = $this->evaluatePolicy($totalChanges, $hasTests);

        $comparisons = [];
        $topMatch = null;
        $maxScore = -1.0;

        foreach ($candidatePulls as $candidate) {
            if (($candidate['number'] ?? null) === ($targetPull['number'] ?? null)
                && ($candidate['repository'] ?? '') === ($targetPull['repository'] ?? '')) {
                continue;
            }
            $candidateFiles = $this->extractFileNames($candidate);
            $comparison = $this->compareSingle($targetPull, $targetFiles, $candidate, $candidateFiles);
            $comparisons[] = $comparison;
            if ($comparison['jaccardScore'] > $maxScore) {
                $maxScore = $comparison['jaccardScore'];
                $topMatch = $comparison;
            }
        }

        $summary = $this->generateSummary($targetPull, $topMatch, $policyEvaluation);

        return [
            'target' => [
                'repository' => $targetPull['repository'] ?? 'unknown',
                'number' => $targetPull['number'] ?? 0,
                'headSha' => $targetPull['headSha'] ?? '',
                'title' => $targetPull['title'] ?? '',
                'totalChanges' => $totalChanges,
                'hasTests' => $hasTests,
                'fileCount' => count($targetFiles),
            ],
            'policy' => $policyEvaluation,
            'summary' => $summary,
            'comparisons' => $comparisons,
        ];
    }

    private function compareSingle(array $target, array $targetFiles, array $candidate, array $candidateFiles): array
    {
        $intersection = array_values(array_intersect($targetFiles, $candidateFiles));
        $union = array_values(array_unique(array_merge($targetFiles, $candidateFiles)));

        $jaccard = count($union) > 0 ? count($intersection) / count($union) : 0.0;
        $matchPercentage = (int) round($jaccard * 100);

        $hunkOverlap = $this->detectHunkOverlap($target['files'] ?? [], $candidate['files'] ?? []);

        $relationship = 'INDEPENDENT';
        if ($jaccard > 0.0) {
            if ($jaccard >= 0.999) {
                $relationship = $hunkOverlap['hasLineOverlap'] ? 'DUPLICATE' : 'IDENTICAL_FILES_DIFFERENT_HUNKS';
            } elseif (count($intersection) === count($targetFiles) && count($candidateFiles) > count($targetFiles)) {
                $relationship = 'SUPERSET';
            } elseif (count($intersection) === count($candidateFiles) && count($targetFiles) > count($candidateFiles)) {
                $relationship = 'SUBSET';
            } else {
                $relationship = 'PARTIAL_OVERLAP';
            }
        }

        $verdictBanner = $this->formatVerdictBanner($candidate, $relationship, $matchPercentage, count($intersection));

        return [
            'candidate' => [
                'repository' => $candidate['repository'] ?? 'unknown',
                'number' => $candidate['number'] ?? 0,
                'headSha' => $candidate['headSha'] ?? '',
                'title' => $candidate['title'] ?? '',
                'fileCount' => count($candidateFiles),
            ],
            'jaccardScore' => round($jaccard, 4),
            'matchPercentage' => $matchPercentage,
            'sharedFiles' => $intersection,
            'sharedFilesCount' => count($intersection),
            'hunkOverlap' => $hunkOverlap,
            'relationship' => $relationship,
            'verdictBanner' => $verdictBanner,
        ];
    }

    private function detectHunkOverlap(array $targetFiles, array $candidateFiles): array
    {
        $candidateMap = [];
        foreach ($candidateFiles as $file) {
            if (isset($file['name'])) {
                $candidateMap[$file['name']] = $file;
            }
        }

        $overlappingFiles = [];
        $totalOverlappingHunks = 0;

        foreach ($targetFiles as $file) {
            $name = $file['name'] ?? null;
            if ($name === null || !isset($candidateMap[$name])) {
                continue;
            }
            $targetHunks = $this->parseHunks($file['patch'] ?? '');
            $candHunks = $this->parseHunks($candidateMap[$name]['patch'] ?? '');

            $overlapCount = 0;
            foreach ($targetHunks as $tHunk) {
                foreach ($candHunks as $cHunk) {
                    if ($this->rangesIntersect($tHunk, $cHunk)) {
                        ++$overlapCount;
                    }
                }
            }
            if ($overlapCount > 0) {
                $overlappingFiles[] = ['name' => $name, 'overlappingHunks' => $overlapCount];
                $totalOverlappingHunks += $overlapCount;
            }
        }

        return [
            'hasLineOverlap' => $totalOverlappingHunks > 0,
            'overlappingHunksCount' => $totalOverlappingHunks,
            'overlappingFiles' => $overlappingFiles,
        ];
    }

    private function parseHunks(string $patch): array
    {
        if (trim($patch) === '') {
            return [];
        }
        $hunks = [];
        if (preg_match_all('/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/', $patch, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $start = (int) $match[1];
                $len = isset($match[2]) && $match[2] !== '' ? (int) $match[2] : 1;
                $hunks[] = ['start' => $start, 'end' => $start + max(0, $len - 1)];
            }
        }
        return $hunks;
    }

    private function rangesIntersect(array $a, array $b): bool
    {
        return max($a['start'], $b['start']) <= min($a['end'], $b['end']);
    }

    private function extractFileNames(array $pull): array
    {
        $names = [];
        foreach ($pull['files'] ?? [] as $file) {
            if (isset($file['name']) && is_string($file['name'])) {
                $names[] = $file['name'];
            }
        }
        sort($names);
        return array_values(array_unique($names));
    }

    private function evaluatePolicy(int $totalChanges, bool $hasTests): array
    {
        $maxDiffLines = (int) ($this->policy['maxDiffLines'] ?? 50);
        $requireTests = (bool) ($this->policy['requireTestCoverage'] ?? true);
        $mode = $this->policy['maintainerMode'] ?? 'STRICT_ANTI_SLOP';

        $diffExceeded = $totalChanges > $maxDiffLines;
        $testsMissing = $requireTests && !$hasTests;
        $passed = !$diffExceeded && !$testsMissing;

        return [
            'mode' => $mode,
            'passed' => $passed,
            'maxDiffLines' => $maxDiffLines,
            'totalChanges' => $totalChanges,
            'diffExceeded' => $diffExceeded,
            'requireTestCoverage' => $requireTests,
            'hasTests' => $hasTests,
            'testsMissing' => $testsMissing,
            'action' => $passed ? 'PROMOTE_FOR_HUMAN_REVIEW' : 'QUARANTINE_DO_NOT_NOTIFY_MAINTAINER',
        ];
    }

    private function formatVerdictBanner(array $candidate, string $relationship, int $pct, int $sharedCount): string
    {
        $num = $candidate['number'] ?? 0;
        return match ($relationship) {
            'DUPLICATE' => "OVERLAPS PR #{$num} ({$pct}% match) — Touches the exact same files and hunk lines; candidate is a duplicate fix.",
            'SUPERSET' => "OVERLAPS PR #{$num} ({$pct}% match) — PR #{$num} is a superset fix encompassing all shared files.",
            'SUBSET' => "OVERLAPS PR #{$num} ({$pct}% match) — PR #{$num} is a subset fix of the current change.",
            'PARTIAL_OVERLAP' => "PARTIAL OVERLAP WITH PR #{$num} ({$pct}% match) — Shares {$sharedCount} files in common queue.",
            'IDENTICAL_FILES_DIFFERENT_HUNKS' => "SHARED FILES WITH PR #{$num} ({$pct}% match) — Same files modified but distinct line hunks.",
            default => "INDEPENDENT — 0 file overlap with PR #{$num}.",
        };
    }

    private function generateSummary(array $target, ?array $topMatch, array $policy): array
    {
        if (!$policy['passed']) {
            $reason = $policy['diffExceeded'] ? 'Exceeds maximum bounded diff lines' : 'Missing test coverage in pull request';
            return [
                'verdict' => 'QUARANTINE',
                'headline' => 'DO NOT MERGE — Violates maintainer anti-slop policy',
                'detail' => $reason.' (Mode: '.$policy['mode'].').',
                'severity' => 'red',
            ];
        }

        if ($topMatch !== null && $topMatch['matchPercentage'] >= 75) {
            return [
                'verdict' => 'OVERLAP_WARNING',
                'headline' => "OVERLAPS PR #{$topMatch['candidate']['number']} ({$topMatch['matchPercentage']}% match)",
                'detail' => "Shares {$topMatch['sharedFilesCount']} files in repository; investigate queue collision before review.",
                'severity' => 'amber',
            ];
        }

        if ($topMatch !== null && $topMatch['matchPercentage'] > 0) {
            return [
                'verdict' => 'PARTIAL_OVERLAP',
                'headline' => "PARTIAL QUEUE OVERLAP ({$topMatch['matchPercentage']}% match)",
                'detail' => "Shares {$topMatch['sharedFilesCount']} files with PR #{$topMatch['candidate']['number']}.",
                'severity' => 'amber',
            ];
        }

        return [
            'verdict' => 'CLEAR',
            'headline' => 'READY FOR VERIFICATION — 0 queue collisions',
            'detail' => 'Complies with maintainer policy and touches independent files.',
            'severity' => 'emerald',
        ];
    }
}
