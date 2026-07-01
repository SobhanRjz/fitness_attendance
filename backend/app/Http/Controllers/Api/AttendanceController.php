<?php

namespace App\Http\Controllers\Api;

use App\Enums\AttendanceStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\BulkUpdateAttendanceRequest;
use App\Http\Requests\UpdateAttendanceRequest;
use App\Http\Resources\AttendeeCollection;
use App\Http\Resources\AttendeeResource;
use App\Models\FitnessClass;
use App\Models\Member;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;

/**
 * Thin controller: validate input, delegate to the service, shape the response.
 * No business logic lives here.
 */
class AttendanceController extends Controller
{
    public function __construct(
        private readonly AttendanceService $attendance,
    ) {}

    /**
     * GET /api/classes/{class}/attendees
     */
    public function index(FitnessClass $class): AttendeeCollection
    {
        return new AttendeeCollection(
            $this->attendance->getAttendees($class)
        );
    }

    /**
     * PATCH /api/classes/{class}/attendees/{member}
     */
    public function update(
        UpdateAttendanceRequest $request,
        FitnessClass $class,
        Member $member
    ): AttendeeResource {
        $attendance = $this->attendance->markAttendance(
            $class,
            $member,
            AttendanceStatus::from($request->validated('status')),
        );

        // Load the member so the resource can serialize it without an extra round-trip.
        return new AttendeeResource($attendance->load('member:id,name'));
    }

    /**
     * PATCH /api/classes/{class}/attendees
     */
    public function bulkUpdate(
        BulkUpdateAttendanceRequest $request,
        FitnessClass $class
    ): JsonResponse {
        $updated = $this->attendance->markAllAttendance(
            $class,
            AttendanceStatus::from($request->validated('status')),
        );

        return response()->json([
            'updated' => $updated,
            'status' => $request->validated('status'),
        ]);
    }
}
