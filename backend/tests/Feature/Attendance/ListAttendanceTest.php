<?php

namespace Tests\Feature\Attendance;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Gym;
use App\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListAttendanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_get_class_attendees(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        Attendance::factory()
            ->for($class)
            ->for($member)
            ->notAttended()
            ->create();

        $response = $this->getJson("/api/classes/{$class->id}/attendees");

        $response->assertOk()
            ->assertJsonPath('data.0.member.id', $member->id)
            ->assertJsonPath('data.0.status', AttendanceStatus::NotAttended->value);
    }

    public function test_returns_empty_list_for_class_with_no_attendees(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();

        $response = $this->getJson("/api/classes/{$class->id}/attendees");

        $response->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_returns_404_for_nonexistent_class(): void
    {
        $response = $this->getJson('/api/classes/999999/attendees');

        $response->assertNotFound();
    }
}