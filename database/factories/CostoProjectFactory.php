<?php

namespace Database\Factories;

use App\Models\CostoProject;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\CostoProject>
 */
class CostoProjectFactory extends Factory
{
    protected $model = CostoProject::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'nombre' => fake()->sentence(3),
            'uei' => fake()->numerify('UEI-####'),
            'unidad_ejecutora' => fake()->company(),
            'codigo_snip' => fake()->numerify('SNIP-######'),
            'codigo_cui' => fake()->numerify('CUI-######'),
            'codigo_local' => fake()->numerify('LOCAL-####'),
            'fecha_inicio' => fake()->date(),
            'fecha_fin' => fake()->date(),
            'codigos_modulares' => [fake()->numerify('MOD-####')],
            'departamento_id' => fake()->numberBetween(1, 25),
            'provincia_id' => fake()->numberBetween(1, 100),
            'distrito_id' => fake()->numberBetween(1, 1000),
            'centro_poblado' => fake()->city(),
            'database_name' => CostoProject::generateDatabaseName(1),
            'status' => 'active',
        ];
    }

    /**
     * Indicate that the project has the unified presupuesto module.
     */
    public function withUnifiedPresupuesto(): static
    {
        return $this->afterCreating(function (CostoProject $project) {
            $project->modules()->create([
                'module_type' => 'presupuesto',
                'enabled' => true,
            ]);
        });
    }

    /**
     * Indicate that the project has legacy presupuesto modules.
     */
    public function withLegacyPresupuesto(): static
    {
        return $this->afterCreating(function (CostoProject $project) {
            $legacyModules = [
                'presupuesto_gg',
                'presupuesto_insumos',
                'presupuesto_remuneraciones',
                'presupuesto_acus',
                'presupuesto_indice',
            ];

            foreach ($legacyModules as $module) {
                $project->modules()->create([
                    'module_type' => $module,
                    'enabled' => true,
                ]);
            }
        });
    }
}
