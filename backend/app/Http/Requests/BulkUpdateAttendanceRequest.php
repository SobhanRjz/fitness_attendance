<?php

namespace App\Http\Requests;

use App\Enums\AttendanceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the payload for the "toggle all" action.
 *
 * The shape is identical to the single-update request today, but it is kept as a
 * separate class so the two endpoints can evolve independently (e.g. bulk could
 * later accept a list of member IDs to target a subset) without coupling them.
 */
class BulkUpdateAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(AttendanceStatus::class)],
        ];
    }
}
