<?php

namespace Database\Factories;

use App\Models\FitnessClass;
use App\Models\Gym;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FitnessClass>
 */
class FitnessClassFactory extends Factory
{
    protected $model = FitnessClass::class;

    public function definition(): array
    {
        return [
            'gym_id' => Gym::factory(),
            'name' => fake()->randomElement([
                'Yoga',
                'HIIT',
                'Pilates',
                'Spin',
                'Boxing',
            ]),
            'start_time' => fake()->randomElement([
                '06:00:00',
                '07:00:00',
                '08:30:00',
                '12:00:00',
                '17:30:00',
                '18:30:00',
                '19:30:00',
            ]),
        ];
    }
}
