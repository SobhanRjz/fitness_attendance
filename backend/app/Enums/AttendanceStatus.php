<?php

namespace App\Enums;

enum AttendanceStatus: string
{
    case Attended = 'attended';
    case NotAttended = 'not_attended';
}
