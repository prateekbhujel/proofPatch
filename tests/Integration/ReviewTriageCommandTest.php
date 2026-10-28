<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Console\Commands\TriagePullRequestCommand;
use ProofPatch\GitHub\PrTriageAnalyzer;

final class ReviewTriageCommandTest extends TestCase
{
    public function testPrTriageCommandSignatureAndRegistration(): void
    {
        $command = new TriagePullRequestCommand();
        self::assertSame('review:triage <target> <compare>...', $command->getName().' '.$command->getDefinition()->getSynopsis());
        self::assertStringContainsString('triage', $command->getDescription());
        self::assertTrue($command->getDefinition()->hasArgument('target'));
        self::assertTrue($command->getDefinition()->hasArgument('compare'));
    }
}
