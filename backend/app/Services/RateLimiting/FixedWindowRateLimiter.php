<?php

namespace App\Services\RateLimiting;

use Illuminate\Support\Facades\Cache;

/**
 * Fixed-window rate limiting.
 *
 * Time is sliced into consecutive, non-overlapping windows of `$decaySeconds`
 * (e.g. every 00:00-00:59, 01:00-01:59, ...). Every request bumps a counter
 * scoped to the current window; once the counter passes `$maxAttempts` the
 * caller is rejected until the window rolls over, at which point the counter
 * resets to zero.
 *
 * Trade-off: a client can burst up to `$maxAttempts` twice back-to-back if
 * the burst straddles a window boundary (e.g. last second of one window plus
 * first second of the next). That's the well-known edge case of fixed-window
 * limiting, accepted here for its simplicity and O(1) storage compared to a
 * sliding window/log.
 */
class FixedWindowRateLimiter
{
    private const KEY_PREFIX = 'fixed-window-rate-limit';

    /**
     * Record one hit for `$identifier` and report whether it's within limits.
     */
    public function attempt(string $identifier, int $maxAttempts, int $decaySeconds): RateLimitResult
    {
        $now = now()->getTimestamp();
        $windowStart = intdiv($now, $decaySeconds) * $decaySeconds;
        $windowEnd = $windowStart + $decaySeconds;
        $key = self::KEY_PREFIX.':'.$identifier.':'.$windowStart;

        // Cache::add only wins the very first time a window is touched, so every
        // request within the same window shares one counter with one expiry —
        // that expiry is what makes the whole window reset atomically at
        // $windowEnd instead of sliding forward on every hit.
        Cache::add($key, 0, $windowEnd - $now);

        $hits = Cache::increment($key);

        $allowed = $hits <= $maxAttempts;

        return new RateLimitResult(
            allowed: $allowed,
            limit: $maxAttempts,
            remaining: max(0, $maxAttempts - $hits),
            retryAfterSeconds: $allowed ? 0 : $windowEnd - $now,
        );
    }
}
