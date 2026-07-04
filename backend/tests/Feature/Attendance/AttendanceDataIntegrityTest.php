<?php

namespace Tests\Feature\Attendance;

use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Gym;
use App\Models\Member;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * These tests exercise guarantees enforced by the schema itself (unique
 * constraints, cascades) rather than by application code, so they'd stay
 * green even if a future change bypassed the service layer entirely.
 */
class AttendanceDataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_member_cannot_have_two_attendance_rows_for_the_same_class(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        Attendance::factory()->for($class)->for($member)->create();

        $this->expectException(QueryException::class);

        Attendance::factory()->for($class)->for($member)->create();
    }

    public function test_deleting_a_class_removes_its_attendance_rows(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        $attendance = Attendance::factory()->for($class)->for($member)->create();

        $class->delete();

        $this->assertDatabaseMissing('attendances', ['id' => $attendance->id]);
    }

    public function test_deleting_a_member_removes_their_attendance_rows(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        $attendance = Attendance::factory()->for($class)->for($member)->create();

        $member->delete();

        $this->assertDatabaseMissing('attendances', ['id' => $attendance->id]);
    }
}
