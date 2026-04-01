<?php

namespace Tests\Unit;

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CostoProjectTest extends TestCase
{
    use RefreshDatabase;

    public function test_has_unified_presupuesto_returns_true_when_presupuesto_module_enabled(): void
    {
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto',
            'enabled' => true,
        ]);

        $result = $project->hasUnifiedPresupuesto();

        $this->assertTrue($result, 'hasUnifiedPresupuesto should return true when presupuesto module is enabled');
    }

    public function test_has_unified_presupuesto_returns_false_when_presupuesto_module_disabled(): void
    {
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto',
            'enabled' => false,
        ]);

        $result = $project->hasUnifiedPresupuesto();

        $this->assertFalse($result, 'hasUnifiedPresupuesto should return false when presupuesto module is disabled');
    }

    public function test_has_unified_presupuesto_returns_false_when_no_presupuesto_module(): void
    {
        $project = CostoProject::factory()->create();

        $result = $project->hasUnifiedPresupuesto();

        $this->assertFalse($result, 'hasUnifiedPresupuesto should return false when no presupuesto module exists');
    }

    public function test_has_module_for_metrado_modules(): void
    {
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'metrado_arquitectura',
            'enabled' => true,
        ]);

        $this->assertTrue($project->hasModule('metrado_arquitectura'));
        $this->assertFalse($project->hasModule('metrado_estructura'));
    }

    public function test_has_module_for_cronograma_modules(): void
    {
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'crono_general',
            'enabled' => true,
        ]);

        $this->assertTrue($project->hasModule('crono_general'));
        $this->assertFalse($project->hasModule('crono_valorizado'));
    }

    public function test_module_types_constant_contains_expected_modules(): void
    {
        $expected = [
            'metrado_arquitectura',
            'metrado_estructura',
            'metrado_sanitarias',
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
            'crono_general',
            'crono_valorizado',
            'crono_materiales',
            'presupuesto',
            'etts',
        ];

        $this->assertEquals($expected, CostoProject::MODULE_TYPES);
    }
}
