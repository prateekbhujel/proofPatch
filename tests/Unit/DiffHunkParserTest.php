<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\DiffHunkParser;

final class DiffHunkParserTest extends TestCase
{
    private string $samplePatch = <<<'DIFF'
@@ -10,3 +10,5 @@
  public function testExample()
  {
+     $guard = true;
+     $this->assertTrue($guard);
  }
DIFF;

    public function testParseExtractsHunksAndLineNumbers(): void
    {
        $result = DiffHunkParser::parse($this->samplePatch);

        self::assertTrue($result['validPatch']);
        self::assertNull($result['error']);
        self::assertCount(1, $result['hunks']);
        $hunk = $result['hunks'][0];
        self::assertSame(10, $hunk['oldStart']);
        self::assertSame(10, $hunk['newStart']);
        self::assertSame(3, $hunk['oldLinesCount']);
        self::assertSame(5, $hunk['newLinesCount']);

        self::assertSame([12, 13], $result['addedLines']);
        self::assertSame([10, 11, 14], $result['contextLines']);
        self::assertSame([], $result['deletedLines']);
        self::assertSame([10, 11, 12, 13, 14], $result['allNewLines']);
    }

    public function testValidateAnchorAttachesToAddedLine(): void
    {
        $head = '1111111111111111111111111111111111111111';
        $validation = DiffHunkParser::validateAnchor($this->samplePatch, 12, $head, $head, 'RIGHT');

        self::assertTrue($validation['valid']);
        self::assertTrue($validation['commentable']);
        self::assertSame('anchored', $validation['status']);
        self::assertSame('addition', $validation['lineType']);
        self::assertSame('RIGHT', $validation['side']);
        self::assertSame(12, $validation['line']);
        self::assertStringContainsString('attached to added line 12', $validation['message']);
    }

    public function testValidateAnchorAttachesToContextLine(): void
    {
        $head = '1111111111111111111111111111111111111111';
        $validation = DiffHunkParser::validateAnchor($this->samplePatch, 10, $head, $head, 'RIGHT');

        self::assertTrue($validation['valid']);
        self::assertTrue($validation['commentable']);
        self::assertSame('anchored', $validation['status']);
        self::assertSame('context', $validation['lineType']);
        self::assertSame(10, $validation['line']);
    }

    public function testPositiveLineHintOutsideDiffHunksIsNotCommentable(): void
    {
        $head = '1111111111111111111111111111111111111111';
        // Line 99 is a positive integer, but strictly outside the captured diff hunk (lines 10..15)
        $validation = DiffHunkParser::validateAnchor($this->samplePatch, 99, $head, $head, 'RIGHT');

        self::assertFalse($validation['valid']);
        self::assertFalse($validation['commentable']);
        self::assertSame('hint_only', $validation['status']);
        self::assertNull($validation['lineType']);
        self::assertStringContainsString('outside the captured diff hunks', $validation['message']);
    }

    public function testValidateAnchorDetectsStaleHeadRevision(): void
    {
        $oldHead = '1111111111111111111111111111111111111111';
        $newHead = '2222222222222222222222222222222222222222';
        $validation = DiffHunkParser::validateAnchor($this->samplePatch, 12, $oldHead, $newHead);

        self::assertFalse($validation['valid']);
        self::assertFalse($validation['commentable']);
        self::assertSame('stale', $validation['status']);
        self::assertStringContainsString('head SHA has changed', $validation['message']);
    }

    public function testValidateAnchorHandlesNullLineHint(): void
    {
        $head = '1111111111111111111111111111111111111111';
        $validation = DiffHunkParser::validateAnchor($this->samplePatch, null, $head, $head);

        self::assertFalse($validation['valid']);
        self::assertFalse($validation['commentable']);
        self::assertSame('hint_only', $validation['status']);
        self::assertNull($validation['line']);
    }

    public function testSideSpecificCommentabilityDistinguishesLeftAndRight(): void
    {
        $head = '1111111111111111111111111111111111111111';
        $patchWithDeletions = <<<'DIFF'
@@ -5,3 +5,1 @@
  line 5
- line 6
- line 7
DIFF;

        // Line 6 was deleted from the base version:
        // On LEFT side (base revision), it is commentable as a deletion
        $leftCheck = DiffHunkParser::validateAnchor($patchWithDeletions, 6, $head, $head, 'LEFT');
        self::assertTrue($leftCheck['valid']);
        self::assertTrue($leftCheck['commentable']);
        self::assertSame('anchored', $leftCheck['status']);
        self::assertSame('deletion', $leftCheck['lineType']);

        // On RIGHT side (head revision), line 6 does not exist in head, so it is NOT commentable on RIGHT side!
        $rightCheck = DiffHunkParser::validateAnchor($patchWithDeletions, 6, $head, $head, 'RIGHT');
        self::assertFalse($rightCheck['valid']);
        self::assertFalse($rightCheck['commentable']);
        self::assertStringContainsString('cannot be anchored on the RIGHT (head) side', $rightCheck['message']);
    }

    public function testNullOrEmptyPatchIsNotCommentable(): void
    {
        $head = '1111111111111111111111111111111111111111';
        $nullCheck = DiffHunkParser::validateAnchor(null, 10, $head, $head);
        self::assertFalse($nullCheck['commentable']);
        self::assertSame('hint_only', $nullCheck['status']);

        $emptyCheck = DiffHunkParser::validateAnchor('   ', 10, $head, $head);
        self::assertFalse($emptyCheck['commentable']);
        self::assertSame('hint_only', $emptyCheck['status']);
    }

    public function testTrailingNewlineDoesNotInventSpuriousLineAnchor(): void
    {
        $head = '1111111111111111111111111111111111111111';
        // 2 lines expected: line 10 and line 11.
        // Followed by trailing \n\n. Must NOT parse an invented line 12!
        $patchWithTrailingNewlines = "@@ -10,2 +10,2 @@\n context 10\n context 11\n\n\n";

        $parsed = DiffHunkParser::parse($patchWithTrailingNewlines);
        self::assertTrue($parsed['validPatch']);
        self::assertSame([10, 11], $parsed['allNewLines']);
        self::assertNotContains(12, $parsed['allNewLines'], 'Trailing newline sentinel must not invent an anchor for line 12.');

        // Line 12 must be rejected
        $checkLine12 = DiffHunkParser::validateAnchor($patchWithTrailingNewlines, 12, $head, $head, 'RIGHT');
        self::assertFalse($checkLine12['valid']);
        self::assertFalse($checkLine12['commentable']);
        self::assertSame('hint_only', $checkLine12['status']);
    }

    public function testTruncatedDiffHunkFailsClosed(): void
    {
        $head = '1111111111111111111111111111111111111111';
        // Header expects 5 lines (-10,5 +10,5), but only 2 lines are present (truncated)
        $truncatedPatch = "@@ -10,5 +10,5 @@\n context 10\n+added 11\n";

        $parsed = DiffHunkParser::parse($truncatedPatch);
        self::assertFalse($parsed['validPatch']);
        self::assertNotNull($parsed['error']);
        self::assertStringContainsString('count mismatch', $parsed['error']);

        // Attempting to anchor to line 11 on a truncated patch MUST fail closed
        $validation = DiffHunkParser::validateAnchor($truncatedPatch, 11, $head, $head, 'RIGHT');
        self::assertFalse($validation['valid']);
        self::assertFalse($validation['commentable']);
        self::assertSame('hint_only', $validation['status']);
        self::assertStringContainsString('Malformed or truncated diff', $validation['message']);
    }

    public function testOverflowedDiffHunkFailsClosed(): void
    {
        $head = '1111111111111111111111111111111111111111';
        // Header expects 1 line (-10,1 +10,1), but 3 lines are present (overflowed / corrupted)
        $overflowPatch = "@@ -10,1 +10,1 @@\n context 10\n+added 11\n+added 12\n";

        $parsed = DiffHunkParser::parse($overflowPatch);
        self::assertFalse($parsed['validPatch']);
        self::assertStringContainsString('count mismatch', $parsed['error'] ?? '');

        $validation = DiffHunkParser::validateAnchor($overflowPatch, 11, $head, $head, 'RIGHT');
        self::assertFalse($validation['valid']);
        self::assertFalse($validation['commentable']);
        self::assertStringContainsString('Malformed or truncated diff', $validation['message']);
    }

    public function testNoNewlineMarkerIsProperlyIgnoredFromHunkCounts(): void
    {
        $head = '1111111111111111111111111111111111111111';
        // Hunk expects 1 deletion and 1 addition.
        // Followed by "\ No newline at end of file"
        $patchWithNoNewline = "@@ -1,1 +1,1 @@\n-old line\n\\ No newline at end of file\n+new line\n\\ No newline at end of file\n";

        $parsed = DiffHunkParser::parse($patchWithNoNewline);
        self::assertTrue($parsed['validPatch']);
        self::assertNull($parsed['error']);
        self::assertSame([1], $parsed['deletedLines']);
        self::assertSame([1], $parsed['addedLines']);

        // Added line 1 must be valid on RIGHT
        $rightCheck = DiffHunkParser::validateAnchor($patchWithNoNewline, 1, $head, $head, 'RIGHT');
        self::assertTrue($rightCheck['valid']);
        self::assertTrue($rightCheck['commentable']);
        self::assertSame('anchored', $rightCheck['status']);

        // Deleted line 1 must be valid on LEFT
        $leftCheck = DiffHunkParser::validateAnchor($patchWithNoNewline, 1, $head, $head, 'LEFT');
        self::assertTrue($leftCheck['valid']);
        self::assertTrue($leftCheck['commentable']);
        self::assertSame('anchored', $leftCheck['status']);
    }

    public function testOffsetContextLinesDistinguishOldAndNewCoordinates(): void
    {
        $head = '1111111111111111111111111111111111111111';
        // Earlier hunks caused a line offset:
        // Base hunk starts at line 10. Head hunk starts at line 50.
        $offsetPatch = <<<'DIFF'
@@ -10,2 +50,2 @@
  context alpha
  context beta
DIFF;

        $parsed = DiffHunkParser::parse($offsetPatch);
        self::assertTrue($parsed['validPatch']);
        self::assertSame([10, 11], $parsed['contextOldLines']);
        self::assertSame([50, 51], $parsed['contextNewLines']);

        // Base revision (LEFT side): lines 10 and 11 are valid; lines 50 and 51 are NOT
        $leftAlpha = DiffHunkParser::validateAnchor($offsetPatch, 10, $head, $head, 'LEFT');
        self::assertTrue($leftAlpha['valid']);
        self::assertTrue($leftAlpha['commentable']);
        self::assertSame('anchored', $leftAlpha['status']);

        $leftWrong = DiffHunkParser::validateAnchor($offsetPatch, 50, $head, $head, 'LEFT');
        self::assertFalse($leftWrong['valid']);
        self::assertFalse($leftWrong['commentable']);
        self::assertSame('hint_only', $leftWrong['status']);

        // Head revision (RIGHT side): lines 50 and 51 are valid; lines 10 and 11 are NOT
        $rightAlpha = DiffHunkParser::validateAnchor($offsetPatch, 50, $head, $head, 'RIGHT');
        self::assertTrue($rightAlpha['valid']);
        self::assertTrue($rightAlpha['commentable']);
        self::assertSame('anchored', $rightAlpha['status']);

        $rightWrong = DiffHunkParser::validateAnchor($offsetPatch, 10, $head, $head, 'RIGHT');
        self::assertFalse($rightWrong['valid']);
        self::assertFalse($rightWrong['commentable']);
        self::assertSame('hint_only', $rightWrong['status']);
    }
}
