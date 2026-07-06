<?php

namespace Tests\Feature\RateLimiting;

use App\Models\FitnessClass;
use App\Models\Gym;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class FixedWindowRateLimitTest extends TestCase
{
    use RefreshDatabase;

    private string $endpoint;

    protected function setUp(): void
    {
        parent::setUp();

        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $this->endpoint = "/api/v1/classes/{$class->id}/attendees";

        Config::set('rate_limiting.max_attempts', 3);
        Config::set('rate_limiting.decay_seconds', 60);

        // Pin "now" to the start of a window so every request in a test lands
        // in a predictable window instead of risking a real-clock boundary.
        Carbon::setTestNow(Carbon::createFromTimestamp(0));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_allows_requests_within_the_limit(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->getJson($this->endpoint)
                ->assertOk()
                ->assertHeader('X-RateLimit-Limit', 3);
        }
    }

    public function test_rejects_requests_once_the_limit_is_exceeded_within_the_window(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->getJson($this->endpoint)->assertOk();
        }

        $response = $this->getJson($this->endpoint);

        $response->assertStatus(429)
            ->assertHeader('X-RateLimit-Limit', 3)
            ->assertHeader('X-RateLimit-Remaining', 0)
            ->assertJson(['message' => 'You have reached the maximum requests. Try again later.']);

        $this->assertTrue($response->headers->has('Retry-After'));
    }

    public function test_remaining_count_decreases_with_each_request(): void
    {
        $this->getJson($this->endpoint)->assertHeader('X-RateLimit-Remaining', 2);
        $this->getJson($this->endpoint)->assertHeader('X-RateLimit-Remaining', 1);
        $this->getJson($this->endpoint)->assertHeader('X-RateLimit-Remaining', 0);
    }

    public function test_counter_resets_once_the_next_window_starts(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->getJson($this->endpoint)->assertOk();
        }
        $this->getJson($this->endpoint)->assertStatus(429);

        // Jump forward into the next fixed window.
        Carbon::setTestNow(Carbon::createFromTimestamp(60));

        $this->getJson($this->endpoint)
            ->assertOk()
            ->assertHeader('X-RateLimit-Remaining', 2);
    }

    public function test_rate_limits_are_tracked_separately_per_client_ip(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
                ->getJson($this->endpoint)
                ->assertOk();
        }
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
            ->getJson($this->endpoint)
            ->assertStatus(429);

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
            ->getJson($this->endpoint)
            ->assertOk()
            ->assertHeader('X-RateLimit-Remaining', 2);
    }
}
