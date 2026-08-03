<?php

namespace Database\Factories;

use App\Models\GestorProyecto;
use App\Models\GestorProyectoNodo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GestorProyectoNodo>
 */
class GestorProyectoNodoFactory extends Factory
{
    protected $model = GestorProyectoNodo::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'gestor_proyecto_id' => GestorProyecto::factory(),
            'parent_id' => null,
            'title' => fake()->words(3, true),
            'type' => 'text',
            'shape' => 'square',
            'color' => 'violet',
            'status' => 'Pendiente',
            'content' => ['text' => fake()->sentence()],
            'order' => 0,
        ];
    }
}
