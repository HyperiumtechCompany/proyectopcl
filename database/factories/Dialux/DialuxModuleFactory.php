<?php

namespace Database\Factories\Dialux;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DialuxModule>
 */
class DialuxModuleFactory extends Factory
{
    protected $model = DialuxModule::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'dialux_project_id' => DialuxProject::factory(),
            'name' => fake()->words(2, true),
            'description' => fake()->optional()->sentence(),
            'sort_order' => 0,
            'status' => 'draft',
            'data' => null,
        ];
    }
}
