<?php

namespace App\Exceptions;

use App\Models\Attendance;
use RuntimeException;

/**
 * Thrown when a client updates an attendance row with a stale version token.
 * Carries the current row so the caller can hand it back to the client.
 */
class AttendanceConflictException extends RuntimeException
{
    public function __construct(
        public readonly Attendance $current,
    ) {
        parent::__construct('This attendee was updated by someone else. Refresh and try again.');
    }
}