<?php

declare(strict_types=1);

namespace ProofPatch\Exceptions;

final class AmbiguousPublicationException extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $repository,
        public readonly string $branch,
        public readonly string $runId,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
    }
}
