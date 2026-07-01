<?php

namespace Tests\Feature\Attendance;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Gym;
use App\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BulkUpdateAttendanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_bulk_update_all_attendees(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();

        $members = Member::factory()->count(3)->for($gym)->create();

        foreach ($members as $member) {
            Attendance::factory()
                ->for($class)
                ->for($member)
                ->notAttended()
                ->create();
        }

        $response = $this->patchJson("/api/classes/{$class->id}/attendees", [
            'status' => AttendanceStatus::Attended->value,
        ]);

        $response->assertOk()
            ->assertJsonPath('updated', 3)
            ->assertJsonPath('status', AttendanceStatus::Attended->value);

        $this->assertEquals(
            3,
            Attendance::where('status', AttendanceStatus::Attended->value)->count()
        );
    }

    public function test_bulk_update_validates_status(): void
    {
        $class = FitnessClass::factory()->create();

        $response = $this->patchJson("/api/classes/{$class->id}/attendees", [
            'status' => 'wrong_status',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }
}