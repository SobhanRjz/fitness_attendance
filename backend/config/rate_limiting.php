<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Fixed Window Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Applied to every /api/v1/* route via the `throttle.fixed` middleware
    | (see routes/api.php and App\Http\Middleware\FixedWindowRateLimit).
    | `max_attempts` requests are allowed per client IP within each
    | `decay_seconds`-long window before further requests get a 429.
    |
    */

    'max_attempts' => (int) env('RATE_LIMIT_MAX_ATTEMPTS', 60),

    'decay_seconds' => (int) env('RATE_LIMIT_DECAY_SECONDS', 60),

];
