<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Organization>
 */
class OrganizationFactory extends Factory
{
    protected $model = Organization::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nombre' => fake()->company(),
            'plan' => 'negocios',
            'owner_id' => null,
        ];
    }

    public function empresarial(): static
    {
        return $this->state(fn (array $attributes) => ['plan' => 'empresarial']);
    }
}
