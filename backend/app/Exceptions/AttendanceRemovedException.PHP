<?php

namespace App\Exceptions;

use RuntimeException;
use App\Models\Attendance;
/**
 * Thrown when a client tries to mark attendance for a row that no longer
 * exists (e.g. the member's enrollment was removed by another request
 * between the initial lookup and the write).
 */
class AttendanceRemovedException extends RuntimeException
{
    public function __construct(Attendance $attendance)
    {
        parent::__construct("This attendee ({$attendance->member->name}) was removed by someone else. Refresh and try again.");
    }
}
