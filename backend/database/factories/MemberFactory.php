<?php

namespace Database\Factories;

use App\Models\Gym;
use App\Models\Member;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Member>
 */
class MemberFactory extends Factory
{
    protected $model = Member::class;

    public function definition(): array
    {
        return [
            // Create a parent gym by default; callers usually override this
            // with ->for($gym) to attach members to a specific gym.
            'gym_id' => Gym::factory(),
            'name' => fake()->name(),
        ];
    }
}
