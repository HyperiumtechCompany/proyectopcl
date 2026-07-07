<?php

namespace Database\Factories;

use App\Models\GestorProyecto;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GestorProyecto>
 */
class GestorProyectoFactory extends Factory
{
    protected $model = GestorProyecto::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'nombre' => fake()->sentence(3),
            'descripcion' => fake()->optional()->sentence(10),
        ];
    }
}
