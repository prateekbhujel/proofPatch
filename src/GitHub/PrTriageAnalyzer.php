<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

/** Compares captured file names only. It does not assess code, authorship or coverage. */
final readonly class PrTriageAnalyzer
{
    public function __construct(private array $policy = []) {}

    public function triage(array $targetPull, array $candidatePulls): array
    {
        $files = $this->fileNames($targetPull);
        $total = 0;
        foreach ($targetPull['files'] ?? [] as $file) {
            $total += ($file['additions'] ?? 0) + ($file['deletions'] ?? 0);
        }
        $truncated = (bool) ($targetPull['filesTruncated'] ?? false);
        // A path is a hint only, not proof that tests exist, ran, or cover this change.
        $testPaths = array_values(array_filter($files, static fn (string $file): bool =>
            (bool) preg_match('~(?:^|/)(?:tests?|__tests__)/|(?:^|/)[^/]+[._-](?:test|spec)\.[^/]+$~i', $file)
            || (bool) preg_match('~(?:^|/)[^/]+(?:Test|Spec)\.[^/]+$~', $file)));
        $limit = (int) ($this->policy['maxDiffLines'] ?? 50);
        $coverageRequired = (bool) ($this->policy['requireTestCoverage'] ?? true);
        $exceeded = $total > $limit;
        $status = $exceeded ? 'review' : (($truncated || $coverageRequired) ? 'unknown' : 'within_limit');

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
                'candidate' => ['repository' => $candidateRepo, 'number' => $number,
                    'headSha' => $candidate['headSha'] ?? '', 'title' => $candidate['title'] ?? '',
                    'fileCount' => count($candidateFiles)],
                'jaccardScore' => round($score, 4), 'matchPercentage' => (int) round($score * 100),
                'sharedFiles' => $shared, 'sharedFilesCount' => count($shared), 'incomplete' => $incomplete,
                'relationship' => count($shared) ? 'SHARED_FILES' : 'NO_SHARED_FILES_OBSERVED',
                'verdictBanner' => count($shared)
                    ? 'Shared file paths with PR #'.$number.'. This does not establish a duplicate fix.'
                    : 'No shared file paths observed with PR #'.$number.'.',
            ];
        }

        $withShared = array_filter($comparisons, static fn (array $c): bool => $c['sharedFilesCount'] > 0);
        $headline = $exceeded ? 'Changed lines exceed the configured limit'
            : ($withShared ? 'Shared file paths found' : 'Review needs more evidence');
        $detail = $exceeded ? 'Review the size threshold; this is not an automatic merge decision.'
            : ($withShared ? 'Compare the captured PRs manually; file overlap does not establish duplicate changes.'
                : 'Only captured PRs were compared. Test coverage and code quality have not been assessed.');
        return [
            'target' => ['repository' => $targetRepo ?? 'unknown', 'number' => $targetPull['number'] ?? 0,
                'headSha' => $targetPull['headSha'] ?? '', 'title' => $targetPull['title'] ?? '',
                'totalChanges' => $total, 'testPaths' => $testPaths, 'fileCount' => count($files), 'filesTruncated' => $truncated],
            'policy' => ['mode' => $this->policy['maintainerMode'] ?? 'STRICT_ANTI_SLOP', 'status' => $status,
                'maxDiffLines' => $limit, 'totalChanges' => $total, 'diffExceeded' => $exceeded,
                'requireTestCoverage' => $coverageRequired, 'coverage' => 'unknown'],
            'summary' => ['verdict' => 'REVIEW', 'headline' => $headline, 'detail' => $detail, 'severity' => 'amber'],
            'comparisons' => array_values($comparisons),
        ];
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
