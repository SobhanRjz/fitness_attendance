<?php

namespace App\Http\Requests;

use App\Enums\AttendanceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the payload for marking a single attendee.
 */
class UpdateAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        // No auth layer in this assignment; access control would live here.
        return true;
    }

    public function rules(): array
    {
        return [
            // Must be one of the enum's backing values ("attended" / "not_attended").
            'status' => ['required', Rule::enum(AttendanceStatus::class)],
            'version' => ['required', 'integer', 'min:1'], // Optimistic concurrency control
        ];
    }
}
