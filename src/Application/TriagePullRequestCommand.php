<?php

declare(strict_types=1);

namespace ProofPatch\Application;

use Illuminate\Console\Command;
use ProofPatch\GitHub\PrTriageAnalyzer;
use ProofPatch\GitHub\PullRequestReader;
use Symfony\Component\HttpClient\HttpClient;

final class TriagePullRequestCommand extends Command
{
    protected $signature = 'review:triage {target : Target PR handle (e.g. owner/repo#123)} {compare* : One or more comparison PR handles to check for duplicate/superset overlap}';

    protected $description = 'Perform maintainer anti-slop policy checks and Jaccard file/hunk overlap triage across pull requests';

    public function handle(): int
    {
        $targetInput = (string) $this->argument('target');
        $compareInputs = (array) $this->argument('compare');

        $token = getenv('GITHUB_TOKEN') ?: null;
        $reader = new PullRequestReader(HttpClient::create(), $token);

        $this->info("Fetching target PR: {$targetInput}...");
        try {
            $targetPull = $reader->read($targetInput);
        } catch (\Throwable $e) {
            $this->error("Failed to fetch target PR: {$e->getMessage()}");
            return self::FAILURE;
        }

        $candidates = [];
        foreach ($compareInputs as $candidateInput) {
            $this->line("Fetching comparison PR: {$candidateInput}...");
            try {
                $candidates[] = $reader->read($candidateInput);
            } catch (\Throwable $e) {
                $this->warn("Skipping candidate {$candidateInput}: {$e->getMessage()}");
            }
        }

        $policyFile = dirname(__DIR__, 2).'/.proofpatchrc.json';
        $policy = is_file($policyFile) ? json_decode((string) file_get_contents($policyFile), true) ?? [] : [];

        $analyzer = new PrTriageAnalyzer($policy);
        $result = $analyzer->triage($targetPull, $candidates);

        $this->newLine();
        $this->line('===============================================================');
        $this->line('               PROOFPATCH MAINTAINER PR TRIAGE                 ');
        $this->line('===============================================================');

        $summary = $result['summary'];
        $policyEval = $result['policy'];

        $this->info("Target: #{$result['target']['number']} - {$result['target']['title']}");
        $this->line("Repository: {$result['target']['repository']}  |  Changed files: {$result['target']['fileCount']}  |  Total lines changed: {$result['target']['totalChanges']}");
        $this->line("Tests present: ".($result['target']['hasTests'] ? 'YES' : 'NO'));

        $this->newLine();
        $this->line("VERDICT: [{$summary['headline']}]");
        $this->line("DETAIL:  {$summary['detail']}");

        $this->newLine();
        $this->line("Policy Enforcement ({$policyEval['mode']}):");
        $this->line("- Max Diff Lines: {$policyEval['maxDiffLines']} (Current: {$policyEval['totalChanges']}) -> ".($policyEval['diffExceeded'] ? 'EXCEEDED [FAIL]' : 'PASS'));
        $this->line("- Test Coverage Required: ".($policyEval['requireTestCoverage'] ? 'YES' : 'NO')." -> ".($policyEval['testsMissing'] ? 'MISSING [FAIL]' : 'PASS'));
        $this->line("- Action: {$policyEval['action']}");

        if (!empty($result['comparisons'])) {
            $this->newLine();
            $this->line("PR Queue Overlap Analysis:");
            $rows = [];
            foreach ($result['comparisons'] as $comp) {
                $rows[] = [
                    "#{$comp['candidate']['number']}",
                    mb_substr($comp['candidate']['title'], 0, 32),
                    "{$comp['matchPercentage']}%",
                    $comp['relationship'],
                    $comp['sharedFilesCount'].' shared',
                    $comp['hunkOverlap']['hasLineOverlap'] ? 'YES' : 'NO',
                ];
            }
            $this->table(['PR', 'Title', 'Match', 'Relationship', 'Files', 'Line Overlap'], $rows);

            foreach ($result['comparisons'] as $comp) {
                $this->line("-> {$comp['verdictBanner']}");
            }
        }

        $this->line('===============================================================');

        return $policyEval['passed'] ? self::SUCCESS : self::FAILURE;
    }
}
