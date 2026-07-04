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

        // Bulk update doesn't check individual versions, but it must still bump
        // them so a stale single-attendee update issued afterward is rejected.
        $this->assertEquals(
            3,
            Attendance::where('version', 2)->count()
        );
    }

    public function test_can_bulk_update_all_attendees_to_absent(): void
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

        $response = $this->patchJson("/api/classes/{$class->id}/attendees", [
            'status' => AttendanceStatus::NotAttended->value,
        ]);

        $response->assertOk()
            ->assertJsonPath('updated', 3)
            ->assertJsonPath('status', AttendanceStatus::NotAttended->value);

        $this->assertEquals(
            3,
            Attendance::where('status', AttendanceStatus::NotAttended->value)->count()
        );

        // Marking everyone absent must also clear marked_at, mirroring the
        // single-attendee update's behavior.
        $this->assertEquals(
            3,
            Attendance::whereNull('marked_at')->count()
        );
    }

    public function test_bulk_mark_attended_does_not_overwrite_an_existing_check_in_time(): void
    {
        $gym = Gym::factory()->create();
        $class = FitnessClass::factory()->for($gym)->create();

        [$alreadyIn, $straggler] = Member::factory()->count(2)->for($gym)->create();

        // Checked in ten minutes ago by front-desk staff scanning them individually.
        // (Truncated to whole seconds since that's the precision the DB column stores.)
        $earlierCheckIn = now()->subMinutes(10)->startOfSecond();
        Attendance::factory()
            ->for($class)->for($alreadyIn)
            ->attended()
            ->create(['marked_at' => $earlierCheckIn]);

        Attendance::factory()
            ->for($class)->for($straggler)
            ->notAttended()
            ->create();

        // Staff clicks "mark all attended" to sweep up the stragglers.
        $this->travel(5)->minutes();
        $response = $this->patchJson("/api/classes/{$class->id}/attendees", [
            'status' => AttendanceStatus::Attended->value,
        ]);

        $response->assertOk();

        // The straggler gets a fresh timestamp...
        $stragglerAttendance = Attendance::where('member_id', $straggler->id)->firstOrFail();
        $this->assertEquals(AttendanceStatus::Attended, $stragglerAttendance->status);
        $this->assertFalse($stragglerAttendance->marked_at->equalTo($earlierCheckIn));

        // ...but the attendee who already checked in keeps their real check-in time.
        $alreadyInAttendance = Attendance::where('member_id', $alreadyIn->id)->firstOrFail();
        $this->assertTrue($alreadyInAttendance->marked_at->equalTo($earlierCheckIn));
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