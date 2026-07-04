<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a client tries to mark attendance for a row that no longer
 * exists (e.g. the member's enrollment was removed by another request
 * between the initial lookup and the write).
 *
 * The row is gone by the time this is thrown, so there is no `Attendance`
 * model left to describe it — the message is intentionally generic.
 */
class AttendanceRemovedException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('This attendee was removed by someone else. Refresh and try again.');
    }
}
