<?php

use App\Http\Controllers\Api\AttendanceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Attendance API
|--------------------------------------------------------------------------
|
| Routes are scoped under a class because attendance only ever exists in the
| context of a class. Route-model binding ({class}, {member}) resolves the
| models for us and returns a 404 automatically when an ID does not exist.
|
| URI versioning: every route lives under /api/{version}/... so breaking
| changes can ship as a new version (v2, ...) without touching existing
| clients still pointed at v1.
|
*/

Route::prefix('v1')
    ->middleware('throttle.fixed')
    ->group(function () {
        Route::prefix('classes/{class}')->group(function () {
            // GET /api/v1/classes/{class}/attendees
            Route::get('attendees', [AttendanceController::class, 'index']);
            // PATCH /api/v1/classes/{class}/attendees
            Route::patch('attendees', [AttendanceController::class, 'bulkUpdate']);
            // PATCH /api/v1/classes/{class}/attendees/{member}
            Route::patch('attendees/{member}', [AttendanceController::class, 'update']);
        });
    });