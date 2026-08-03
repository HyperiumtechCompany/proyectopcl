<?php

namespace Database\Factories;

use App\Models\PlanRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlanRequest>
 */
class PlanRequestFactory extends Factory
{
    protected $model = PlanRequest::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nombre' => fake()->name(),
            'email' => fake()->safeEmail(),
            'plan' => fake()->randomElement(['free', 'mensual', 'anual']),
            'comprobante_path' => null,
            'status' => 'pending',
            'notas_admin' => null,
            'user_id' => null,
        ];
    }
}
