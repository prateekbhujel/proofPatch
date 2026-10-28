<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

/**
 * Parses unified diff patches and strictly validates inline review comment line anchors.
 *
 * Strict Hunk & Commentability Boundaries:
 * 1. Trailing Newlines: Sentinel empty lines from trailing newlines are stripped and never invent lines.
 * 2. Hunk Count Validation: Every hunk's consumed old and new lines must exactly equal the declared header counts.
 *    Any truncated, truncated-at-EOF, or overflowed hunk renders the patch invalid.
 * 3. No-Newline Markers: Lines starting with '\' (e.g. '\ No newline at end of file') are metadata, not diff lines.
 * 4. Old/New Side Semantics:
 *    - RIGHT side (head revision): Commentable ONLY on added lines (+) or head-side context lines ( ).
 *      Deleted lines (-) belong to base and cannot be anchored on RIGHT.
 *    - LEFT side (base revision): Commentable ONLY on deleted lines (-) or base-side context lines ( ).
 *      Added lines (+) belong to head and cannot be anchored on LEFT.
 * 5. Head Freshness: Stale head commits (mismatched headSha) fail closed.
 * 6. Bounds: Positive integers outside the parsed hunk boundaries are unanchored hints only.
 */
final class DiffHunkParser
{
    /**
     * Parses a unified diff string into structured hunks and lines.
     * Validates hunk counts and detects malformed or truncated patches.
     *
     * @return array{
     *     validPatch: bool,
     *     error: ?string,
     *     hunks: list<array{
     *         header: string,
     *         oldStart: int,
     *         oldLinesCount: int,
     *         newStart: int,
     *         newLinesCount: int,
     *         consumedOld: int,
     *         consumedNew: int,
     *         valid: bool,
     *         error?: string,
     *         lines: list<array{type: string, oldLine: ?int, newLine: ?int, content: string, raw: string}>
     *     }>,
     *     addedLines: list<int>,
     *     deletedLines: list<int>,
     *     contextNewLines: list<int>,
     *     contextOldLines: list<int>,
     *     contextLines: list<int>,
     *     allNewLines: list<int>,
     *     allOldLines: list<int>
     * }
     */
    public static function parse(string $patch): array
    {
        $hunks = [];
        $addedLines = [];
        $deletedLines = [];
        $contextNewLines = [];
        $contextOldLines = [];
        $allNewLines = [];
        $allOldLines = [];

        // 1. Strip trailing newlines so explode does not produce a trailing empty string sentinel
        $trimmedPatch = rtrim($patch, "\r\n");
        if ($trimmedPatch === '') {
            return [
                'validPatch' => false,
                'error' => 'Empty patch.',
                'hunks' => [],
                'addedLines' => [],
                'deletedLines' => [],
                'contextNewLines' => [],
                'contextOldLines' => [],
                'contextLines' => [],
                'allNewLines' => [],
                'allOldLines' => [],
            ];
        }

        $rawLines = explode("\n", $trimmedPatch);
        $currentHunk = null;
        $oldLine = 0;
        $newLine = 0;
        $consumedOld = 0;
        $consumedNew = 0;
        $malformedError = null;

        $finalizeHunk = static function (?array $hunk, int $cOld, int $cNew) use (&$malformedError): ?array {
            if ($hunk === null) {
                return null;
            }
            if ($cOld !== $hunk['oldLinesCount'] || $cNew !== $hunk['newLinesCount']) {
                $malformedError ??= "Diff hunk {$hunk['header']} count mismatch: expected -{$hunk['oldLinesCount']},+{$hunk['newLinesCount']} lines, but found -{$cOld},+{$cNew} lines.";
                $hunk['valid'] = false;
                $hunk['error'] = "Expected -{$hunk['oldLinesCount']},+{$hunk['newLinesCount']}, found -{$cOld},+{$cNew}";
            } else {
                $hunk['valid'] = true;
            }
            $hunk['consumedOld'] = $cOld;
            $hunk['consumedNew'] = $cNew;
            return $hunk;
        };

        foreach ($rawLines as $line) {
            // Check for hunk header @@ -oldStart,oldLen +newStart,newLen @@
            if (preg_match('/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/', $line, $matches)) {
                if ($currentHunk !== null) {
                    $finalized = $finalizeHunk($currentHunk, $consumedOld, $consumedNew);
                    if ($finalized !== null) {
                        $hunks[] = $finalized;
                    }
                }
                $oldLine = (int) $matches[1];
                $newLine = (int) $matches[3];
                $oldLinesCount = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : 1;
                $newLinesCount = isset($matches[4]) && $matches[4] !== '' ? (int) $matches[4] : 1;
                $consumedOld = 0;
                $consumedNew = 0;
                $currentHunk = [
                    'header' => $matches[0],
                    'oldStart' => $oldLine,
                    'oldLinesCount' => $oldLinesCount,
                    'newStart' => $newLine,
                    'newLinesCount' => $newLinesCount,
                    'lines' => [],
                ];
                continue;
            }

            if ($currentHunk === null) {
                // Ignore diff headers before first hunk (e.g., diff --git, index, ---, +++)
                continue;
            }

            // 2. No-newline marker at end of file (e.g. "\ No newline at end of file")
            if (str_starts_with($line, '\\')) {
                $currentHunk['lines'][] = [
                    'type' => 'no_newline_marker',
                    'oldLine' => null,
                    'newLine' => null,
                    'content' => $line,
                    'raw' => $line,
                ];
                continue;
            }

            if (str_starts_with($line, '+')) {
                $currentHunk['lines'][] = [
                    'type' => 'addition',
                    'oldLine' => null,
                    'newLine' => $newLine,
                    'content' => substr($line, 1),
                    'raw' => $line,
                ];
                $addedLines[] = $newLine;
                $allNewLines[] = $newLine;
                ++$newLine;
                ++$consumedNew;
            } elseif (str_starts_with($line, '-')) {
                $currentHunk['lines'][] = [
                    'type' => 'deletion',
                    'oldLine' => $oldLine,
                    'newLine' => null,
                    'content' => substr($line, 1),
                    'raw' => $line,
                ];
                $deletedLines[] = $oldLine;
                $allOldLines[] = $oldLine;
                ++$oldLine;
                ++$consumedOld;
            } elseif (str_starts_with($line, ' ')) {
                $currentHunk['lines'][] = [
                    'type' => 'context',
                    'oldLine' => $oldLine,
                    'newLine' => $newLine,
                    'content' => substr($line, 1),
                    'raw' => $line,
                ];
                $contextNewLines[] = $newLine;
                $contextOldLines[] = $oldLine;
                $allNewLines[] = $newLine;
                $allOldLines[] = $oldLine;
                ++$oldLine;
                ++$newLine;
                ++$consumedOld;
                ++$consumedNew;
            } elseif ($line === '' && ($consumedOld < $currentHunk['oldLinesCount'] || $consumedNew < $currentHunk['newLinesCount'])) {
                // Blank context line inside hunk without leading space (git stripped whitespace),
                // but ONLY when the hunk still expects lines
                $currentHunk['lines'][] = [
                    'type' => 'context',
                    'oldLine' => $oldLine,
                    'newLine' => $newLine,
                    'content' => '',
                    'raw' => $line,
                ];
                $contextNewLines[] = $newLine;
                $contextOldLines[] = $oldLine;
                $allNewLines[] = $newLine;
                $allOldLines[] = $oldLine;
                ++$oldLine;
                ++$newLine;
                ++$consumedOld;
                ++$consumedNew;
            } else {
                if ($line !== '') {
                    $malformedError ??= 'Unexpected content line inside diff hunk: '.substr($line, 0, 50);
                }
            }
        }

        if ($currentHunk !== null) {
            $finalized = $finalizeHunk($currentHunk, $consumedOld, $consumedNew);
            if ($finalized !== null) {
                $hunks[] = $finalized;
            }
        }

        $validPatch = $malformedError === null && $hunks !== [];

        return [
            'validPatch' => $validPatch,
            'error' => $malformedError,
            'hunks' => $hunks,
            'addedLines' => array_values(array_unique($addedLines)),
            'deletedLines' => array_values(array_unique($deletedLines)),
            'contextNewLines' => array_values(array_unique($contextNewLines)),
            'contextOldLines' => array_values(array_unique($contextOldLines)),
            'contextLines' => array_values(array_unique($contextNewLines)),
            'allNewLines' => array_values(array_unique($allNewLines)),
            'allOldLines' => array_values(array_unique($allOldLines)),
        ];
    }

    /**
     * Validates an inline anchor against a patch diff and checks head revision integrity.
     * Enforces that positive line hints outside the captured diff hunks or in malformed patches
     * are strictly NOT commentable.
     *
     * @return array{
     *     status: 'anchored' | 'hint_only' | 'stale',
     *     valid: bool,
     *     commentable: bool,
     *     side: string,
     *     line: ?int,
     *     headSha: string,
     *     lineType: ?string,
     *     message: string
     * }
     */
    public static function validateAnchor(
        ?string $patch,
        ?int $lineHint,
        string $draftHeadSha,
        string $currentHeadSha,
        string $side = 'RIGHT',
    ): array {
        $normalizedSide = strtoupper($side) === 'LEFT' ? 'LEFT' : 'RIGHT';

        // 1. Revision freshness check: prevent comments on stale head commits
        if ($draftHeadSha === '' || !hash_equals($currentHeadSha, $draftHeadSha)) {
            return [
                'status' => 'stale',
                'valid' => false,
                'commentable' => false,
                'side' => $normalizedSide,
                'line' => $lineHint,
                'headSha' => $draftHeadSha,
                'lineType' => null,
                'message' => 'Stale anchor: the pull request head SHA has changed since this finding was suggested.',
            ];
        }

        // 2. Line hint existence check
        if ($lineHint === null || $lineHint < 1 || $patch === null || trim($patch) === '') {
            return [
                'status' => 'hint_only',
                'valid' => false,
                'commentable' => false,
                'side' => $normalizedSide,
                'line' => null,
                'headSha' => $draftHeadSha,
                'lineType' => null,
                'message' => 'Unanchored finding: no commentable line number in the captured diff.',
            ];
        }

        $parsed = self::parse($patch);

        // 3. Fail closed if the patch is truncated, malformed, or has count mismatches
        if (!$parsed['validPatch']) {
            return [
                'status' => 'hint_only',
                'valid' => false,
                'commentable' => false,
                'side' => $normalizedSide,
                'line' => $lineHint,
                'headSha' => $draftHeadSha,
                'lineType' => null,
                'message' => 'Malformed or truncated diff: '.($parsed['error'] ?? 'diff hunks are corrupted or incomplete.'),
            ];
        }

        // 4. Side-specific anchor location check in diff hunks
        if ($normalizedSide === 'RIGHT') {
            if (in_array($lineHint, $parsed['addedLines'], true)) {
                return [
                    'status' => 'anchored',
                    'valid' => true,
                    'commentable' => true,
                    'side' => 'RIGHT',
                    'line' => $lineHint,
                    'headSha' => $draftHeadSha,
                    'lineType' => 'addition',
                    'message' => "Validated anchor: attached to added line {$lineHint} in head revision.",
                ];
            }

            if (in_array($lineHint, $parsed['contextNewLines'], true)) {
                return [
                    'status' => 'anchored',
                    'valid' => true,
                    'commentable' => true,
                    'side' => 'RIGHT',
                    'line' => $lineHint,
                    'headSha' => $draftHeadSha,
                    'lineType' => 'context',
                    'message' => "Validated anchor: attached to context line {$lineHint} in head revision.",
                ];
            }

            if (in_array($lineHint, $parsed['deletedLines'], true)) {
                return [
                    'status' => 'hint_only',
                    'valid' => false,
                    'commentable' => false,
                    'side' => 'RIGHT',
                    'line' => $lineHint,
                    'headSha' => $draftHeadSha,
                    'lineType' => 'deletion',
                    'message' => "Uncommentable: line {$lineHint} is a deleted line in base revision and cannot be anchored on the RIGHT (head) side.",
                ];
            }
        } else {
            // LEFT side: base revision lines
            if (in_array($lineHint, $parsed['deletedLines'], true)) {
                return [
                    'status' => 'anchored',
                    'valid' => true,
                    'commentable' => true,
                    'side' => 'LEFT',
                    'line' => $lineHint,
                    'headSha' => $draftHeadSha,
                    'lineType' => 'deletion',
                    'message' => "Validated anchor: attached to deleted line {$lineHint} in base revision.",
                ];
            }

            if (in_array($lineHint, $parsed['contextOldLines'], true)) {
                return [
                    'status' => 'anchored',
                    'valid' => true,
                    'commentable' => true,
                    'side' => 'LEFT',
                    'line' => $lineHint,
                    'headSha' => $draftHeadSha,
                    'lineType' => 'context',
                    'message' => "Validated anchor: attached to context line {$lineHint} in base revision.",
                ];
            }

            if (in_array($lineHint, $parsed['addedLines'], true)) {
                return [
                    'status' => 'hint_only',
                    'valid' => false,
                    'commentable' => false,
                    'side' => 'LEFT',
                    'line' => $lineHint,
                    'headSha' => $draftHeadSha,
                    'lineType' => 'addition',
                    'message' => "Uncommentable: line {$lineHint} is an added line in head revision and cannot be anchored on the LEFT (base) side.",
                ];
            }
        }

        // Positive line hint exists in theory, but is strictly outside any diff hunk
        return [
            'status' => 'hint_only',
            'valid' => false,
            'commentable' => false,
            'side' => $normalizedSide,
            'line' => $lineHint,
            'headSha' => $draftHeadSha,
            'lineType' => null,
            'message' => "Model hint only: line {$lineHint} is outside the captured diff hunks of this file and is not commentable.",
        ];
    }
}
