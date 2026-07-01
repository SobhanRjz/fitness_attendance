<?php

namespace Database\Factories;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\FitnessClass;
use App\Models\Member;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Attendance>
 */
class AttendanceFactory extends Factory
{
    protected $model = Attendance::class;

    public function definition(): array
    {
        $status = fake()->randomElement(AttendanceStatus::cases());

        return [
            'fitness_class_id' => FitnessClass::factory(),
            'member_id' => Member::factory(),
            'status' => $status,
            'version' => 1,
            // Only attended rows carry a timestamp; not-attended is the resting state.
            'marked_at' => $status === AttendanceStatus::Attended ? now() : null,
        ];
    }

    public function attended(): static
    {
        return $this->state(fn () => [
            'status' => AttendanceStatus::Attended,
            'marked_at' => now(),
        ]);
    }

    public function notAttended(): static
    {
        return $this->state(fn () => [
            'status' => AttendanceStatus::NotAttended,
            'marked_at' => null,
        ]);
    }
}
