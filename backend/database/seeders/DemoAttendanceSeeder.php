<?php

namespace Database\Seeders;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Gym;
use App\Models\Member;
use Illuminate\Database\Seeder;

class DemoAttendanceSeeder extends Seeder
{
    /**
     * Fixed, hand-written demo dataset for showcasing the app (assignment/demo
     * environments) without pulling in Faker: 1 gym, 1 class, 5 members, and
     * 5 attendance rows pairing every member with that class.
     *
     * Safe to run against a prod-like database on demand:
     *   php artisan db:seed --class=DemoAttendanceSeeder
     */
    public function run(): void
    {
        $gym = Gym::create(['name' => 'Downtown Fitness Center']);

        $class = FitnessClass::create([
            'gym_id' => $gym->id,
            'name' => 'Morning Yoga',
            'start_time' => '07:00:00',
        ]);

        $members = collect([
            'Alice Johnson',
            'Bob Smith',
            'Carol White',
            'David Brown',
            'Emma Davis',
        ])->map(fn (string $name) => Member::create([
            'gym_id' => $gym->id,
            'name' => $name,
        ]));

        $members->each(fn (Member $member) => Attendance::create([
            'fitness_class_id' => $class->id,
            'member_id' => $member->id,
            'status' => AttendanceStatus::NotAttended,
        ]));
    }
}
