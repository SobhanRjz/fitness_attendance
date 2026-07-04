<?php

namespace Tests\Unit\Services;

use App\Enums\AttendanceStatus;
use App\Exceptions\AttendanceConflictException;
use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Gym;
use App\Models\Member;
use App\Services\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_mark_attendance_sets_attended_and_marked_at(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        $existing = Attendance::factory()
            ->for($class)
            ->for($member)
            ->notAttended()
            ->create();

        $service = new AttendanceService();

        $attendance = $service->markAttendance(
            $class,
            $member,
            AttendanceStatus::Attended,
            $existing->version
        );

        $this->assertEquals(AttendanceStatus::Attended, $attendance->status);
        $this->assertNotNull($attendance->marked_at);
    }

    public function test_mark_attendance_sets_not_attended_and_clears_marked_at(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        $existing = Attendance::factory()
            ->for($class)
            ->for($member)
            ->attended()
            ->create();

        $service = new AttendanceService();

        $attendance = $service->markAttendance(
            $class,
            $member,
            AttendanceStatus::NotAttended,
            $existing->version
        );

        $this->assertEquals(AttendanceStatus::NotAttended, $attendance->status);
        $this->assertNull($attendance->marked_at);
    }

    public function test_mark_attendance_increments_version_on_success(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        $existing = Attendance::factory()
            ->for($class)
            ->for($member)
            ->notAttended()
            ->create();

        $service = new AttendanceService();

        $attendance = $service->markAttendance(
            $class,
            $member,
            AttendanceStatus::Attended,
            $existing->version
        );

        $this->assertEquals($existing->version + 1, $attendance->version);
    }

    public function test_mark_attendance_with_stale_version_throws_conflict_and_does_not_write(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        $member = Member::factory()->for($gym)->create();

        $existing = Attendance::factory()
            ->for($class)
            ->for($member)
            ->notAttended()
            ->create(); // version = 1

        // Simulate another staff member already having written a newer version.
        $existing->update(['status' => AttendanceStatus::Attended, 'version' => 2]);

        $service = new AttendanceService();

        $this->expectException(AttendanceConflictException::class);

        try {
            $service->markAttendance(
                $class,
                $member,
                AttendanceStatus::NotAttended,
                1 // stale version
            );
        } finally {
            // The newer write must survive regardless of the exception.
            $this->assertEquals(
                AttendanceStatus::Attended,
                $existing->fresh()->status
            );
        }
    }

    public function test_mark_all_attendance_updates_all_class_attendees(): void
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

        $service = new AttendanceService();

        $updated = $service->markAllAttendance(
            $class,
            AttendanceStatus::Attended
        );

        $this->assertEquals(3, $updated);
        $this->assertEquals(
            3,
            Attendance::where('status', AttendanceStatus::Attended->value)->count()
        );
    }

    public function test_mark_all_attendance_sets_not_attended_and_clears_marked_at(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();

        $members = Member::factory()->count(3)->for($gym)->create();

        foreach ($members as $member) {
            Attendance::factory()
                ->for($class)
                ->for($member)
                ->attended()
                ->create();
        }

        $service = new AttendanceService();

        $updated = $service->markAllAttendance(
            $class,
            AttendanceStatus::NotAttended
        );

        $this->assertEquals(3, $updated);
        $this->assertEquals(
            3,
            Attendance::where('status', AttendanceStatus::NotAttended->value)
                ->whereNull('marked_at')
                ->count()
        );
    }

    public function test_mark_all_attendance_increments_version_for_every_changed_row(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();

        $members = Member::factory()->count(3)->for($gym)->create();

        foreach ($members as $member) {
            Attendance::factory()
                ->for($class)
                ->for($member)
                ->notAttended()
                ->create(); // version = 1
        }

        $service = new AttendanceService();

        $service->markAllAttendance($class, AttendanceStatus::Attended);

        $this->assertEquals(
            3,
            $class->attendances()->where('version', 2)->count()
        );
    }

    public function test_mark_all_attendance_does_not_increment_version_for_rows_already_matching_status(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();
        [$alreadyAbsent, $needsUpdate] = Member::factory()->count(2)->for($gym)->create();

        Attendance::factory()
            ->for($class)
            ->for($alreadyAbsent)
            ->notAttended()
            ->create(['version' => 7]);

        Attendance::factory()
            ->for($class)
            ->for($needsUpdate)
            ->attended()
            ->create(['version' => 3]);

        $service = new AttendanceService();

        $updated = $service->markAllAttendance($class, AttendanceStatus::NotAttended);

        $this->assertEquals(1, $updated);
        $this->assertEquals(
            7,
            $class->attendances()->where('member_id', $alreadyAbsent->id)->firstOrFail()->version
        );
        $this->assertEquals(
            4,
            $class->attendances()->where('member_id', $needsUpdate->id)->firstOrFail()->version
        );
    }
}
