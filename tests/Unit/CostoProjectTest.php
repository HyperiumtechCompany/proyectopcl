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
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasUnifiedPresupuesto();

        // Assert
        $this->assertTrue($result, 'hasUnifiedPresupuesto should return true when presupuesto module is enabled');
    }

    public function test_has_unified_presupuesto_returns_false_when_presupuesto_module_disabled(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto',
            'enabled' => false,
        ]);

        // Act
        $result = $project->hasUnifiedPresupuesto();

        // Assert
        $this->assertFalse($result, 'hasUnifiedPresupuesto should return false when presupuesto module is disabled');
    }

    public function test_has_unified_presupuesto_returns_false_when_no_presupuesto_module(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();

        // Act
        $result = $project->hasUnifiedPresupuesto();

        // Assert
        $this->assertFalse($result, 'hasUnifiedPresupuesto should return false when no presupuesto module exists');
    }

    public function test_has_legacy_presupuesto_returns_true_for_presupuesto_gg(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_gg',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertTrue($result, 'hasLegacyPresupuesto should return true when presupuesto_gg is enabled');
    }

    public function test_has_legacy_presupuesto_returns_true_for_presupuesto_insumos(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_insumos',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertTrue($result, 'hasLegacyPresupuesto should return true when presupuesto_insumos is enabled');
    }

    public function test_has_legacy_presupuesto_returns_true_for_presupuesto_remuneraciones(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_remuneraciones',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertTrue($result, 'hasLegacyPresupuesto should return true when presupuesto_remuneraciones is enabled');
    }

    public function test_has_legacy_presupuesto_returns_true_for_presupuesto_acus(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_acus',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertTrue($result, 'hasLegacyPresupuesto should return true when presupuesto_acus is enabled');
    }

    public function test_has_legacy_presupuesto_returns_true_for_presupuesto_indice(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_indice',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertTrue($result, 'hasLegacyPresupuesto should return true when presupuesto_indice is enabled');
    }

    public function test_has_legacy_presupuesto_returns_true_when_multiple_legacy_modules_enabled(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_gg',
            'enabled' => true,
        ]);
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_insumos',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertTrue($result, 'hasLegacyPresupuesto should return true when multiple legacy modules are enabled');
    }

    public function test_has_legacy_presupuesto_returns_false_when_legacy_modules_disabled(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_gg',
            'enabled' => false,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertFalse($result, 'hasLegacyPresupuesto should return false when legacy modules are disabled');
    }

    public function test_has_legacy_presupuesto_returns_false_when_no_legacy_modules(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertFalse($result, 'hasLegacyPresupuesto should return false when no legacy modules exist');
    }

    public function test_has_legacy_presupuesto_returns_false_when_only_unified_presupuesto_enabled(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertFalse($result, 'hasLegacyPresupuesto should return false when only unified presupuesto is enabled');
    }

    public function test_project_can_have_both_unified_and_legacy_presupuesto_for_migration(): void
    {
        // Arrange - Simulating a migration scenario
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto',
            'enabled' => true,
        ]);
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'presupuesto_gg',
            'enabled' => true,
        ]);

        // Act
        $hasUnified = $project->hasUnifiedPresupuesto();
        $hasLegacy = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertTrue($hasUnified, 'Project should have unified presupuesto');
        $this->assertTrue($hasLegacy, 'Project should have legacy presupuesto during migration');
    }

    public function test_has_legacy_presupuesto_ignores_non_presupuesto_modules(): void
    {
        // Arrange
        $project = CostoProject::factory()->create();
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'metrado_arquitectura',
            'enabled' => true,
        ]);
        CostoProjectModule::factory()->create([
            'costo_project_id' => $project->id,
            'module_type' => 'crono_general',
            'enabled' => true,
        ]);

        // Act
        $result = $project->hasLegacyPresupuesto();

        // Assert
        $this->assertFalse($result, 'hasLegacyPresupuesto should return false when only non-presupuesto modules exist');
    }
}
