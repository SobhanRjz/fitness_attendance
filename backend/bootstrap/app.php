<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use App\Exceptions\AttendanceConflictException;
use App\Exceptions\AttendanceRemovedException;
use App\Http\Resources\AttendeeResource;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
        $exceptions->render(function (AttendanceConflictException $e, Request $request) {
            return response()->json([
                'message' => $e->getMessage(),
                'data' => new AttendeeResource($e->current->load('member:id,name')),
            ], 409);
        });
        $exceptions->render(function (AttendanceRemovedException $e, Request $request) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 404);
        });
    })->create();
