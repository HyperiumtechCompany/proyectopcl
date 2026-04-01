<?php

namespace Database\Factories;

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\CostoProjectModule>
 */
class CostoProjectModuleFactory extends Factory
{
    protected $model = CostoProjectModule::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'costo_project_id' => CostoProject::factory(),
            'module_type' => fake()->randomElement(CostoProject::MODULE_TYPES),
            'enabled' => true,
        ];
    }

    /**
     * Indicate that the module is disabled.
     */
    public function disabled(): static
    {
        return $this->state(fn (array $attributes) => [
            'enabled' => false,
        ]);
    }

    /**
     * Indicate that the module is the unified presupuesto.
     */
    public function unifiedPresupuesto(): static
    {
        return $this->state(fn (array $attributes) => [
            'module_type' => 'presupuesto',
            'enabled' => true,
        ]);
    }

    /**
     * Indicate that the module is a legacy presupuesto module.
     */
    public function legacyPresupuesto(string $type = 'presupuesto_gg'): static
    {
        return $this->state(fn (array $attributes) => [
            'module_type' => $type,
            'enabled' => true,
        ]);
    }
}
