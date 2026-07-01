<?php

namespace Tests\Feature\Attendance;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Gym;
use App\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpdateAttendanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_mark_member_attended(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        Attendance::factory()
            ->for($class)
            ->for($member)
            ->notAttended()
            ->create();

        $response = $this->patchJson("/api/classes/{$class->id}/attendees/{$member->id}", [
            'status' => AttendanceStatus::Attended->value,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.member.id', $member->id)
            ->assertJsonPath('data.status', AttendanceStatus::Attended->value);

        $this->assertDatabaseHas('attendances', [
            'fitness_class_id' => $class->id,
            'member_id' => $member->id,
            'status' => AttendanceStatus::Attended->value,
        ]);
    }

    public function test_can_mark_member_not_attended(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        Attendance::factory()
            ->for($class)
            ->for($member)
            ->attended()
            ->create();

        $response = $this->patchJson("/api/classes/{$class->id}/attendees/{$member->id}", [
            'status' => AttendanceStatus::NotAttended->value,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', AttendanceStatus::NotAttended->value);

        $this->assertDatabaseHas('attendances', [
            'fitness_class_id' => $class->id,
            'member_id' => $member->id,
            'status' => AttendanceStatus::NotAttended->value,
            'marked_at' => null,
        ]);
    }

    public function test_update_does_not_create_duplicate_attendance(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        Attendance::factory()
            ->for($class)
            ->for($member)
            ->notAttended()
            ->create();

        $this->patchJson("/api/classes/{$class->id}/attendees/{$member->id}", [
            'status' => AttendanceStatus::Attended->value,
        ])->assertOk();

        $this->assertEquals(1, Attendance::count());
    }

    public function test_status_is_required(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        Attendance::factory()
            ->for($class)
            ->for($member)
            ->create();

        $response = $this->patchJson("/api/classes/{$class->id}/attendees/{$member->id}", []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_status_must_be_valid(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        Attendance::factory()
            ->for($class)
            ->for($member)
            ->create();

        $response = $this->patchJson("/api/classes/{$class->id}/attendees/{$member->id}", [
            'status' => 'present',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_member_not_enrolled_in_class_returns_404(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        $response = $this->patchJson("/api/classes/{$class->id}/attendees/{$member->id}", [
            'status' => AttendanceStatus::Attended->value,
        ]);

        $response->assertNotFound();
    }
}