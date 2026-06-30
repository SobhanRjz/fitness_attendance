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
            'name' => fake()->randomElement(['Yoga', 'Spin', 'HIIT', 'Pilates', 'Boxing'])
                .' '.fake()->time('H:i'),
        ];
    }
}
