<?php

declare(strict_types=1);

namespace ProofPatch\Evidence;

final class CanonicalJson
{
    public static function encode(mixed $value): string
    {
        $normalized = self::normalize($value, 0);
        try {
            return json_encode($normalized, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } catch (\JsonException $error) {
            throw new \InvalidArgumentException('Invalid JSON value: '.$error->getMessage(), 0, $error);
        }
    }

    private static function normalize(mixed $value, int $depth): mixed
    {
        if ($value === null || is_bool($value) || is_int($value) || is_string($value)) {
            return $value;
        }
        if (!is_array($value) && (!is_object($value) || $value::class !== \stdClass::class)) {
            throw new \InvalidArgumentException('Unsupported JSON value.');
        }
        if ($depth >= 32) {
            throw new \InvalidArgumentException('JSON nesting exceeds 32 containers.');
        }
        if (is_array($value) && array_is_list($value)) {
            $result = [];
            foreach ($value as $item) {
                $result[] = self::normalize($item, $depth + 1);
            }
            return $result;
        }

        $fields = is_array($value) ? $value : get_object_vars($value);
        if (is_array($value)) {
            foreach (array_keys($fields) as $key) {
                if (!is_string($key)) {
                    throw new \InvalidArgumentException('JSON maps require string keys.');
                }
            }
        }
        ksort($fields, SORT_STRING);
        $result = new \stdClass();
        foreach ($fields as $key => $item) {
            $result->{(string) $key} = self::normalize($item, $depth + 1);
        }
        return $result;
    }
}
