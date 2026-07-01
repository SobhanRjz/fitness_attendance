<?php

namespace App\Http\Resources;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serializes a single attendance row into the public API shape.
 *
 * @mixin Attendance
 */
class AttendeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'member' => [
                'id' => $this->member->id,
                'name' => $this->member->name,
            ],
            // ->value gives the string ("attended"), not the enum object,
            // so the JSON stays a plain string the client can compare against.
            'status' => $this->status->value,
            // ISO-8601 so the client can parse it in any timezone; null when unmarked.
            'marked_at' => $this->marked_at?->toIso8601String(),
        ];
    }
}
