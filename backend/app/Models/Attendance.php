<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory;

    protected $fillable = [
        'fitness_class_id',
        'member_id',
        'status',
        'marked_at',
        // Optimistic-locking token. Mass-assignable so internal callers (e.g. the
        // service layer's atomic update) and factories can set it directly; it is
        // never taken verbatim from client-controlled request input.
        'version',
    ];

    protected $casts = [
        // Casting to the enum means $attendance->status is an AttendanceStatus
        // instance everywhere in the app, not a raw string.
        'status' => AttendanceStatus::class,
        'marked_at' => 'datetime',
    ];

    public function fitnessClass(): BelongsTo
    {
        return $this->belongsTo(FitnessClass::class);
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }
}
