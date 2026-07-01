<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

/**
 * Collection wrapper for attendees.
 *
 * Exists as an explicit class (rather than AttendeeResource::collection())
 * so we have a single place to attach collection-level metadata later, e.g.
 * a per-class attendance summary.
 */
class AttendeeCollection extends ResourceCollection
{
    public $collects = AttendeeResource::class;

    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection,
        ];
    }
}
