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
*/

Route::prefix('classes/{class}')->group(function () {
    // GET /api/classes/{class}/attendees
    Route::get('attendees', [AttendanceController::class, 'index']);
    // PATCH /api/classes/{class}/attendees
    Route::patch('attendees', [AttendanceController::class, 'bulkUpdate']);
    // PATCH /api/classes/{class}/attendees/{member}
    Route::patch('attendees/{member}', [AttendanceController::class, 'update']);
});