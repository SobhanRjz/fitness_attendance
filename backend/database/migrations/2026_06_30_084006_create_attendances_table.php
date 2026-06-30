<?php

use App\Enums\AttendanceStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fitness_class_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained()->cascadeOnDelete();

            // Stored as a string column constrained to the enum's values. Using the
            // enum cases as the allowed set keeps the DB and the application code in sync.
            $table->enum('status', array_column(AttendanceStatus::cases(), 'value'))
                ->default(AttendanceStatus::NotAttended->value);

            // When the status was last set. Nullable because a member can be enrolled
            // in a class before anyone has marked them present/absent for the session.
            $table->timestamp('marked_at')->nullable();

            $table->timestamps();

            // A member can only have one attendance record per class.
            // PostgreSQL creates an index for this unique constraint, and because
            // fitness_class_id is the first column, it also supports the hot query:
            // "all attendees for a class".
            $table->unique(['fitness_class_id', 'member_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
