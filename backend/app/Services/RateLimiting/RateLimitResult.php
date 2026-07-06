<?php

namespace App\Services\RateLimiting;

/**
 * Outcome of a single fixed-window rate limit check.
 */
final class RateLimitResult
{
    public function __construct(
        public readonly bool $allowed,
        public readonly int $limit,
        public readonly int $remaining,
        public readonly int $retryAfterSeconds,
    ) {}
}
