<?php

namespace App\Http\Middleware;

use App\Services\RateLimiting\FixedWindowRateLimiter;
use App\Services\RateLimiting\RateLimitResult;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applies fixed-window rate limiting to the request's client IP.
 *
 * Usage: ->middleware('throttle.fixed') uses the config('rate_limiting')
 * defaults, or ->middleware('throttle.fixed:60,60') to override per-route
 * with an explicit "60 requests per 60 seconds".
 */
class FixedWindowRateLimit
{
    public function __construct(
        private readonly FixedWindowRateLimiter $limiter,
    ) {}

    public function handle(Request $request, Closure $next, ?int $maxAttempts = null, ?int $decaySeconds = null): Response
    {
        $result = $this->limiter->attempt(
            identifier: $request->ip() ?? 'unknown',
            maxAttempts: $maxAttempts ?? (int) config('rate_limiting.max_attempts'),
            decaySeconds: $decaySeconds ?? (int) config('rate_limiting.decay_seconds'),
        );

        if (! $result->allowed) {
            return response()->json([
                'message' => 'You have reached the maximum requests. Try again later.',
            ], 429)->withHeaders($this->headers($result));
        }

        $response = $next($request);

        foreach ($this->headers($result) as $header => $value) {
            $response->headers->set($header, (string) $value);
        }

        return $response;
    }

    /**
     * @return array<string, int>
     */
    private function headers(RateLimitResult $result): array
    {
        $headers = [
            'X-RateLimit-Limit' => $result->limit,
            'X-RateLimit-Remaining' => $result->remaining,
        ];

        if (! $result->allowed) {
            $headers['Retry-After'] = $result->retryAfterSeconds;
        }

        return $headers;
    }
}
