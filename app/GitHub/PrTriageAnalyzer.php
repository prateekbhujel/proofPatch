<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

/**
 * Triage pull requests against maintainer policies, anti-slop rules, and repo standards.
 * Pure deterministic analysis based on captured pull metadata and files.
 */
final readonly class PrTriageAnalyzer
{
    private const DEFAULT_MAX_DIFF = 50;
    private const SLOP_SIZE_THRESHOLD = 150;
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

        $evaluation = $this->evaluatePullStandards($targetPull, $files, $testPaths, $total, $limit, $truncated, !empty($withShared));

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
                'mode' => $this->policy['maintainerMode'] ?? 'STRICT_ANTI_SLOP',
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
            ],
            'comparisons' => array_values($comparisons),
        ];
    }

    private function evaluatePullStandards(
        array $targetPull,
        array $files,
        array $testPaths,
        int $total,
        int $limit,
        bool $truncated,
        bool $hasSharedFiles
    ): array {
        $title = trim((string) ($targetPull['title'] ?? ''));
        $body = trim((string) ($targetPull['body'] ?? $targetPull['description'] ?? ''));
        $baseBranch = (string) ($targetPull['base'] ?? 'main');
        $expectedBranch = (string) ($this->policy['defaultBranch'] ?? 'main');

        $hasTests = count($testPaths) > 0;
        $exceeded = $total > $limit;
        $isSlopTitle = $this->isSlopIndicator($title);
        $isShortBody = strlen($body) < self::MIN_BODY_LENGTH;
        $isMismatch = $this->isDescriptionMismatch($title, $body, $files);
        $isWrongBranch = $baseBranch !== '' && strcasecmp($baseBranch, $expectedBranch) !== 0;

        $flags = [];
        if (!$hasTests) {
            $flags[] = 'missing_tests';
        }
        if ($isShortBody) {
            $flags[] = 'short_description';
        }
        if ($isMismatch) {
            $flags[] = 'description_mismatch';
        }
        if ($isWrongBranch) {
            $flags[] = 'wrong_target_branch';
        }
        if ($exceeded) {
            $flags[] = 'diff_exceeded';
        }

        if (($exceeded && !$hasTests) || ($total > self::SLOP_SIZE_THRESHOLD && $isShortBody) || ($isSlopTitle && !$hasTests)) {
            return [
                'classification' => 'AI_SLOP_REJECT',
                'badge' => 'Slop / Close Recommended',
                'headline' => $exceeded ? 'Changed lines exceed the configured limit' : 'High likelihood of unreviewed AI slop or unverified bulk changes',
                'detail' => 'Large diff without automated test coverage and minimal description. Recommended action: Close or request focused minimal reproduction.',
                'severity' => 'amber',
                'suggestedAction' => 'Recommend closing PR: ask contributor for a minimal reproducible test.',
                'suggestedComment' => "Thank you for the contribution. However, this pull request modifies {$total} lines without accompanying test coverage or detailed reproduction steps. Per repository standards, please scope changes to a minimal, verifiable unit with automated tests before resubmitting.",
                'reasoning' => "PR modifies {$total} lines without test coverage (" . count($testPaths) . " test files found) and lacks sufficient verification context.",
                'flags' => $flags,
            ];
        }

        if (!$exceeded && $hasTests && strlen($title) >= 10 && strlen($body) >= self::MIN_BODY_LENGTH && !$isMismatch && !$isWrongBranch && !$truncated) {
            return [
                'classification' => 'CLEAN_PR',
                'badge' => 'Clean & Focused PR',
                'headline' => 'Clean, well-scoped pull request',
                'detail' => "Focused change of {$total} lines within configured limit ({$limit} max) with dedicated test coverage.",
                'severity' => 'emerald',
                'suggestedAction' => 'Ready for maintainer review and isolated verification.',
                'suggestedComment' => "Looks clean, focused ({$total} lines), and includes tests. Queuing for isolated verification.",
                'reasoning' => "PR stays within the {$limit}-line diff limit, includes dedicated test files (" . implode(', ', $testPaths) . "), targets {$expectedBranch}, and has a matching description.",
                'flags' => $flags,
            ];
        }

        // Needs Standards Cleanup
        $cleanItems = [];
        if (!$hasTests) {
            $cleanItems[] = '1) Add an automated test in tests/ verifying the intended behavior.';
        }
        if ($isMismatch) {
            $cleanItems[] = '2) Update description to match the actual files changed in this PR.';
        } elseif ($isShortBody) {
            $cleanItems[] = '2) Elaborate in the description on the bug reproduction and expected outcome.';
        }
        if ($isWrongBranch) {
            $cleanItems[] = "3) Retarget PR base branch to '{$expectedBranch}' instead of '{$baseBranch}'.";
        }
        if ($exceeded) {
            $cleanItems[] = "4) Reduce diff size to within {$limit} lines.";
        }

        $suggestedComment = "Thanks for the contribution! The change looks promising, but per repo standards:\n" . implode("\n", $cleanItems);
        $reasoning = 'PR needs standards cleanup: ' . implode(', ', str_replace('_', ' ', $flags)) . '.';

        $headline = $exceeded ? 'Changed lines exceed the configured limit' : ($hasSharedFiles ? 'Shared file paths found' : 'Review needs more evidence');
        $detail = $exceeded ? 'Review the size threshold; this is not an automatic merge decision.' : ($hasSharedFiles ? 'Compare the captured PRs manually; file overlap does not establish duplicate changes.' : 'Only captured PRs were compared. Test coverage and code quality have not been assessed.');

        return [
            'classification' => 'NEEDS_CLEANUP',
            'badge' => 'Needs Standards Cleanup',
            'headline' => $headline,
            'detail' => $detail,
            'severity' => 'amber',
            'suggestedAction' => 'Request changes: contributor should address test coverage, branch targeting, or description clarity.',
            'suggestedComment' => $suggestedComment,
            'reasoning' => $reasoning,
            'flags' => $flags,
        ];
    }

    private function isSlopIndicator(string $title): bool
    {
        return (bool) preg_match('/\b(?:ai\s*generated|gpt|copilot\s*auto|automated\s*fix|bot\s*patch|unreviewed\s*slop)\b/i', $title);
    }

    private function isDescriptionMismatch(string $title, string $body, array $files): bool
    {
        $hasDocFiles = false;
        $hasCodeFiles = false;
        foreach ($files as $file) {
            if ((bool) preg_match('/\.(?:md|rst|txt)$/i', $file) || str_starts_with($file, 'docs/')) {
                $hasDocFiles = true;
            }
            if ((bool) preg_match('/\.(?:php|js|ts|jsx|tsx|py|go|rb|rs)$/i', $file) && !str_starts_with($file, 'tests/')) {
                $hasCodeFiles = true;
            }
        }

        $combinedText = strtolower($title . ' ' . $body);
        $claimsDocOnly = (str_contains($combinedText, 'readme') || str_contains($combinedText, 'docs') || str_contains($combinedText, 'documentation'))
            && !str_contains($combinedText, 'fix') && !str_contains($combinedText, 'logic') && !str_contains($combinedText, 'code');

        if ($claimsDocOnly && $hasCodeFiles && !$hasDocFiles) {
            return true;
        }

        $claimsCodeFix = str_contains($combinedText, 'order total') || str_contains($combinedText, 'pricing calculation') || str_contains($combinedText, 'bug fix');
        if ($claimsCodeFix && !$hasCodeFiles && $hasDocFiles) {
            return true;
        }

        return false;
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
