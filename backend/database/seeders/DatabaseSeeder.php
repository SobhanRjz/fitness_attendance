<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Gym;
use App\Models\Member;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed a realistic dataset:
     *   3 gyms -> 30 members each -> 10 classes each -> 20 attendances per class.
     *
     * Attendances are created by pairing each class with distinct members from the
     * SAME gym, which respects the unique(fitness_class_id, member_id) constraint
     * and mirrors the real domain (you only attend classes at your own gym).
     */
    public function run(): void
    {
        Gym::factory()
            ->count(3)
            ->create()
            ->each(function (Gym $gym) {
                $members = Member::factory()->count(30)->for($gym)->create();
                $classes = FitnessClass::factory()->count(10)->for($gym)->create();

                $classes->each(function (FitnessClass $class) use ($members) {
                    // Pick 20 distinct members from this gym for this class.
                    $members->random(20)->each(function (Member $member) use ($class) {
                        Attendance::factory()
                            ->for($class)
                            ->for($member)
                            ->create();
                    });
                });
            });
    }
}
