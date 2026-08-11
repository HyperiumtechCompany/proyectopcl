<?php

namespace Database\Factories\Dialux;

use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DialuxProject>
 */
class DialuxProjectFactory extends Factory
{
    protected $model = DialuxProject::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->sentence(3),
            'description' => fake()->optional()->sentence(),
            'client_name' => fake()->optional()->company(),
            'location' => fake()->optional()->city(),
            'project_code' => fake()->optional()->bothify('DLX-####'),
            'status' => 'draft',
            'consolidated_summary' => null,
            'data' => null,
        ];
    }
}
