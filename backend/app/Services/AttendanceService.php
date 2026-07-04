<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Exceptions\AttendanceConflictException;
use App\Exceptions\AttendanceRemovedException;
use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Member;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Attendance business logic.
 *
 * The controller stays small and delegates the actual rules to this service.
 */
class AttendanceService
{
    /**
     * Return all attendees for a class.
     *
     * Eager-load the member relation to avoid an N+1 query when serializing rows.
     */
    public function getAttendees(FitnessClass $class): Collection
    {
        return $class->attendances()
            ->with('member:id,name')
            ->orderBy('id')
            ->get();
    }

    /**
     * Set one attendee to the requested status.
     *
     * Important: this updates an existing attendance row only. If the member is
     * not enrolled in this class, Laravel returns 404 instead of creating a new
     * row accidentally.
     */
    public function markAttendance(
        FitnessClass $class,
        Member $member,
        AttendanceStatus $status,
        int $expectedVersion
    ): Attendance {
        $attendance = $class->attendances()
            ->where('member_id', $member->id)
            ->firstOrFail();

        // Single atomic statement: UPDATE ... WHERE version = ?. If another
        // request already changed this row, `version` no longer matches and
        // 0 rows are affected — no race window between "check" and "write".
        $updated = $class->attendances()
            ->where('member_id', $member->id)
            ->where('version', $expectedVersion)
            ->update([
                'status' => $status,
                'marked_at' => $this->markedAtFor($status),
                'version' => $expectedVersion + 1,
            ]);

        // Re-fetch once and branch on it: a null row means someone deleted this
        // attendee's enrollment between our lookup and the write (404), which is
        // a different failure than "someone else changed the status" (409).
        $fresh = $attendance->fresh();

        if ($fresh === null) {
            throw new AttendanceRemovedException();
        }

        if ($updated === 0) {
            throw new AttendanceConflictException($fresh);
        }

        return $fresh;
    }

    /**
     * Set every attendee in the class to the same status.
     *
     * This is one SQL UPDATE, not one query per attendee.
     */
    public function markAllAttendance(FitnessClass $class, AttendanceStatus $status): int
    {
        if ($status === AttendanceStatus::NotAttended) {
            return $class->attendances()
                ->where('status', '!=', AttendanceStatus::NotAttended)
                ->update([
                    'status' => $status,
                    'marked_at' => null,
                    'version' => DB::raw('version + 1'),
                    'updated_at' => now(),
                ]);
        }

        return $class->attendances()
            ->where('status', '!=', AttendanceStatus::Attended)
            ->update([
                'status' => $status,
                'marked_at' => now(),
                'version' => DB::raw('version + 1'),
                'updated_at' => now(),
            ]);
    }

    private function markedAtFor(AttendanceStatus $status): ?\DateTimeInterface
    {
        return $status === AttendanceStatus::Attended ? now() : null;
    }
}
