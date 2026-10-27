<?php

declare(strict_types=1);

namespace ProofPatch\Patch;

final readonly class CssPatch
{
    public const FILE = 'public/fixtures/checkout.html';
    public const SECOND_FILE = 'public/fixtures/occlusion-b.html';
    public const FILES = [self::FILE, self::SECOND_FILE];

    private function __construct(public string $file, public string $baseSha256, public string $find, public string $replace)
    {
    }

    public static function fromArray(array $input): self
    {
        $keys = array_keys($input);
        sort($keys);
        if ($keys !== ['baseSha256', 'file', 'find', 'replace'] || !in_array($input['file'], self::FILES, true)) {
            throw new \InvalidArgumentException('Patch must target an allowed fixture and contain only the declared fields.');
        }
        if (!is_string($input['baseSha256']) || !preg_match('/\A[a-f0-9]{64}\z/', $input['baseSha256'])) {
            throw new \InvalidArgumentException('Invalid base SHA-256.');
        }
        foreach (['find', 'replace'] as $key) {
            $text = $input[$key];
            if (!is_string($text) || trim($text) === '' || strlen($text) > 4096) {
                throw new \InvalidArgumentException('Patch text must be nonempty and at most 4096 bytes.');
            }
            foreach (["\0", '<', '>', '\\', '@'] as $forbidden) {
                if (str_contains($text, $forbidden)) {
                    throw new \InvalidArgumentException('Patch must contain local inline CSS only.');
                }
            }
            if (preg_match('/(?:url|expression)\s*\(/i', $text)) {
                throw new \InvalidArgumentException('External resources and CSS expressions are not supported.');
            }
        }
        if ($input['find'] === $input['replace']) {
            throw new \InvalidArgumentException('Patch makes no change.');
        }
        return new self($input['file'], $input['baseSha256'], $input['find'], $input['replace']);
    }

    public function apply(string $source): string
    {
        if (strlen($source) > 65536 || !hash_equals($this->baseSha256, hash('sha256', $source))) {
            throw new \InvalidArgumentException('Patch does not match the bounded base source.');
        }
        if (substr_count($source, $this->find) !== 1) {
            throw new \InvalidArgumentException('Patch must match exactly once.');
        }
        $start = strpos($source, '<style>');
        $end = strpos($source, '</style>');
        $offset = strpos($source, $this->find);
        if ($start === false || $end === false || $offset < $start + strlen('<style>')
            || $offset + strlen($this->find) > $end) {
            throw new \InvalidArgumentException('Patch lies outside the inline stylesheet.');
        }
        return substr_replace($source, $this->replace, $offset, strlen($this->find));
    }

    public function toArray(): array
    {
        return ['file' => $this->file, 'baseSha256' => $this->baseSha256, 'find' => $this->find, 'replace' => $this->replace];
    }
}
