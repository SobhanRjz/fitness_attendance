<?php

use App\Enums\AttendanceStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            // Optimistic-locking token. Incremented on every write; a client must
            // send back the version it last read so stale updates can be rejected
            // instead of silently overwriting a newer value.
            $table->unsignedBigInteger('version')->default(1)->after('marked_at');
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropColumn('version');
        });
    }
};
