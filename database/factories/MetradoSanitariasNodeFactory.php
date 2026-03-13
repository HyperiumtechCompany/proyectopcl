<?php

namespace Database\Factories;

use App\Models\CostoProject;
use App\Models\MetradoSanitariasNode;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MetradoSanitariasNode>
 */
class MetradoSanitariasNodeFactory extends Factory
{
    protected $model = MetradoSanitariasNode::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $nodeType = fake()->randomElement(['titulo', 'subtitulo', 'partida']);
        
        return [
            'id' => (string) Str::uuid(),
            'project_id' => CostoProject::factory(),
            'parent_id' => null,
            'node_type' => $nodeType,
            'name' => fake()->sentence(3),
            'numbering' => $this->generateNumbering($nodeType),
            'unit' => $nodeType === 'partida' ? fake()->randomElement(['m', 'm2', 'm3', 'kg', 'und', 'glb']) : null,
            'level' => 0,
            'position' => fake()->numberBetween(1, 100),
        ];
    }

    /**
     * Indicate that the node is a titulo.
     */
    public function titulo(): static
    {
        return $this->state(fn (array $attributes) => [
            'node_type' => 'titulo',
            'numbering' => fake()->numberBetween(1, 20) . '.00',
            'unit' => null,
            'level' => 0,
        ]);
    }

    /**
     * Indicate that the node is a subtitulo.
     */
    public function subtitulo(): static
    {
        return $this->state(fn (array $attributes) => [
            'node_type' => 'subtitulo',
            'numbering' => fake()->numberBetween(1, 20) . '.' . fake()->numberBetween(1, 99),
            'unit' => null,
            'level' => 1,
        ]);
    }

    /**
     * Indicate that the node is a partida.
     */
    public function partida(): static
    {
        return $this->state(fn (array $attributes) => [
            'node_type' => 'partida',
            'numbering' => fake()->numberBetween(1, 20) . '.' . fake()->numberBetween(1, 99) . '.' . fake()->numberBetween(1, 99),
            'unit' => fake()->randomElement(['m', 'm2', 'm3', 'kg', 'und', 'glb']),
            'level' => 2,
        ]);
    }

    /**
     * Generate appropriate numbering based on node type.
     */
    private function generateNumbering(string $nodeType): string
    {
        return match ($nodeType) {
            'titulo' => fake()->numberBetween(1, 20) . '.00',
            'subtitulo' => fake()->numberBetween(1, 20) . '.' . fake()->numberBetween(1, 99),
            'partida' => fake()->numberBetween(1, 20) . '.' . fake()->numberBetween(1, 99) . '.' . fake()->numberBetween(1, 99),
            default => '1.00',
        };
    }
}
