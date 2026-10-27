<?php

declare(strict_types=1);

namespace ProofPatch\Agent;

use ProofPatch\Evidence\Receipt;
use ProofPatch\Patch\CssPatch;
use ProofPatch\Support\LocalProcess;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final readonly class ModelProposal
{
    private const ENDPOINT = 'https://inference.baseten.co/v1/chat/completions';
    private const MODEL = 'meta-models/muse-spark-open-1026';
    private const MAX_TOKENS = 4096;

    public function __construct(private string $project, private HttpClientInterface $http, private RequestBudget $budget)
    {
    }

    public function propose(string $directory, string $key): array
    {
        if (strlen($key) < 16 || strlen($key) > 4096 || !preg_match('/\A[\x21-\x7e]+\z/', $key)) {
            throw new \InvalidArgumentException('Baseten key is missing or invalid.');
        }
        $sourceReceipt = (new Receipt())->verify($directory);
        $report = json_decode((string) file_get_contents($directory.'/result.json'), true, 64, JSON_THROW_ON_ERROR);
        $head = trim(LocalProcess::output(['git', '-C', $this->project, 'rev-parse', 'HEAD']));
        $source = file_get_contents($this->project.'/'.CssPatch::FILE);
        $committed = LocalProcess::output(['git', '-C', $this->project, 'show', $head.':'.CssPatch::FILE]);
        if ($source === false || !hash_equals(hash('sha256', $committed), hash('sha256', $source))
            || ($report['baseCommit'] ?? null) !== $head) {
            throw new \InvalidArgumentException('Run a fresh baseline against the current committed fixture.');
        }
        $baseline = $report['runs']['baseline'] ?? [];
        $observation = $baseline['observation'] ?? [];
        if (($baseline['exitCode'] ?? null) !== 1 || ($observation['initial'] ?? null) !== 'Standard'
            || ($observation['selected'] ?? null) !== 'Standard' || ($observation['pointer']['trusted'] ?? null) !== true) {
            throw new \InvalidArgumentException('A reproduced checkout failure is required.');
        }
        $system = 'You repair CSS in a controlled checkout fixture. Return only a JSON object with exactly "find" and "replace" strings. '
            .'The find text must occur exactly once inside the inline style and replacement must be local CSS only. '
            .'Fix the blocked shipping click while preserving the banner and its offer button. Do not change HTML or tests.';
        $prompt = "Checkout source:\n".$source."\nBrowser evidence:\n".json_encode([
            'initial' => $observation['initial'], 'selected' => $observation['selected'],
            'pointer' => $observation['pointer'], 'hitStack' => $observation['hitStack'], 'banner' => $observation['banner'],
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        if (strlen($system.$prompt) > 24000 || str_contains($system.$prompt, $key)) {
            throw new \InvalidArgumentException('Model input exceeds the allowed bounds.');
        }
        // Reserve uncached text input by UTF-8 bytes plus framing allowance and maximum output.
        $reserveMicros = (int) ceil((strlen($system.$prompt) + 4096) * 1.25 + self::MAX_TOKENS * 4.25);
        return $this->budget->run($reserveMicros, function () use ($key, $system, $prompt, $source, $sourceReceipt): array {
            $response = $this->http->request('POST', self::ENDPOINT, [
                'headers' => ['Authorization' => 'Bearer '.$key, 'Content-Type' => 'application/json'],
                'max_redirects' => 0, 'timeout' => 90, 'max_duration' => 120,
                'json' => ['model' => self::MODEL, 'max_tokens' => self::MAX_TOKENS, 'reasoning_effort' => 'low',
                    'temperature' => 1.0, 'top_p' => 1.0, 'stream' => false,
                    'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $prompt]]],
            ]);
            if ($response->getStatusCode() !== 200) {
                throw new \RuntimeException('Model request failed with HTTP '.$response->getStatusCode().'.');
            }
            $raw = $response->getContent(false);
            if (strlen($raw) > 524288 || str_contains($raw, $key)) {
                throw new \RuntimeException('Model response exceeded its safe bounds.');
            }
            $result = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
            $choice = $result['choices'][0] ?? [];
            if (($result['model'] ?? null) !== self::MODEL || ($choice['finish_reason'] ?? null) !== 'stop'
                || !is_string($choice['message']['content'] ?? null) || strlen($choice['message']['content']) > 16384) {
                throw new \RuntimeException('Model returned an incomplete or unexpected response.');
            }
            $candidate = json_decode($choice['message']['content'], true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($candidate) || count($candidate) !== 2 || !array_key_exists('find', $candidate) || !array_key_exists('replace', $candidate)) {
                throw new \RuntimeException('Model did not return the required patch format.');
            }
            $patch = CssPatch::fromArray(['file' => CssPatch::FILE, 'baseSha256' => hash('sha256', $source),
                'find' => $candidate['find'], 'replace' => $candidate['replace']]);
            $patch->apply($source);
            $usage = $result['usage'] ?? null;
            if (!is_array($usage) || !is_int($usage['prompt_tokens'] ?? null) || !is_int($usage['completion_tokens'] ?? null)
                || $usage['prompt_tokens'] < 0 || $usage['completion_tokens'] < 0 || $usage['completion_tokens'] > self::MAX_TOKENS) {
                throw new \RuntimeException('Model response lacks bounded usage data.');
            }
            return ['patch' => $patch->toArray(), 'model' => self::MODEL, 'sourceRunId' => $sourceReceipt['runId'],
                'sourceReceiptSha256' => $sourceReceipt['sha256'],
                'usage' => ['prompt_tokens' => $usage['prompt_tokens'], 'completion_tokens' => $usage['completion_tokens']]];
        });
    }
}
