<?php

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Models\User;
use App\Services\CostoDatabaseService;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    if (config('database.default') !== 'mysql') {
        $this->markTestSkipped('This test requires MySQL database connection');
    }

    $this->dbService = app(CostoDatabaseService::class);
    $this->user = User::factory()->create();
    $this->project = CostoProject::factory()->create([
        'user_id' => $this->user->id,
        'nombre' => 'Insumos Test Project',
    ]);
    $this->testDbName = $this->project->database_name;

    DB::connection('mysql')->statement(
        "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    $this->dbService->createPresupuestoTables($this->testDbName);
    $this->dbService->createDefaultPresupuesto($this->testDbName, 'Insumos Test Project');
    CostoProjectModule::create([
        'costo_project_id' => $this->project->id,
        'module_type' => 'presupuesto',
    ]);
    $this->dbService->setTenantConnection($this->testDbName);
});

afterEach(function () {
    if (config('database.default') === 'mysql' && isset($this->testDbName)) {
        DB::connection('mysql')->statement("DROP DATABASE IF EXISTS `{$this->testDbName}`");
    }
});

function createTestAcu(int $presupuestoId): int
{
    return DB::connection('costos_tenant')->table('presupuesto_acus')->insertGetId([
        'presupuesto_id' => $presupuestoId,
        'partida' => '01.01',
        'descripcion' => 'Partida de prueba',
        'unidad' => 'und',
        'rendimiento' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

it('updates code and unit for a catalog-linked consolidated input', function () {
    $connection = DB::connection('costos_tenant');
    $presupuestoId = $this->dbService->getDefaultPresupuestoId($this->testDbName);
    $acuId = createTestAcu($presupuestoId);
    $unitId = $connection->table('unidad')->insertGetId([
        'descripcion' => 'bol',
        'descripcion_singular' => 'Bolsa',
        'orden' => '',
        'informacion_unidad' => '',
        'abreviatura_unidad' => 'bol',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $insumoId = $connection->table('insumo_productos')->insertGetId([
        'codigo_producto' => 'MAT-001',
        'descripcion' => 'Cemento',
        'unidad_id' => $unitId,
        'tipo' => 'materiales',
        'costo_unitario' => 20,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $connection->table('acu_materiales')->insert([
        'acu_id' => $acuId,
        'insumo_id' => $insumoId,
        'cod_insumo' => 'MAT-001',
        'codigo_producto' => 'MAT-001',
        'descripcion' => 'Cemento',
        'unidad' => 'bol',
        'cantidad' => 2,
        'precio_unitario' => 20,
        'parcial' => 40,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($this->user)
        ->putJson("/costos/proyectos/{$this->project->id}/presupuesto/insumos/{$insumoId}", [
            'codigo_producto' => 'MAT-900',
            'descripcion' => 'Cemento mejorado',
            'unidad' => 'saco',
            'costo_unitario' => 25.5,
        ])
        ->assertSuccessful();

    $producto = $connection->table('insumo_productos')->where('id', $insumoId)->first();
    $material = $connection->table('acu_materiales')->where('acu_id', $acuId)->first();

    expect($producto->codigo_producto)->toBe('MAT-900')
        ->and($material->cod_insumo)->toBe('MAT-900')
        ->and($material->codigo_producto)->toBe('MAT-900')
        ->and($material->unidad)->toBe('saco')
        ->and($material->descripcion)->toBe('Cemento mejorado')
        ->and((float) $material->precio_unitario)->toBe(25.5)
        ->and((float) $material->parcial)->toBe(51.0);
});

it('updates code and unit for an unlinked consolidated input', function () {
    $connection = DB::connection('costos_tenant');
    $presupuestoId = $this->dbService->getDefaultPresupuestoId($this->testDbName);
    $acuId = createTestAcu($presupuestoId);
    $connection->table('acu_materiales')->insert([
        'acu_id' => $acuId,
        'cod_insumo' => 'OLD-01',
        'descripcion' => 'Arena gruesa',
        'unidad' => 'm3',
        'cantidad' => 3,
        'precio_unitario' => 10,
        'parcial' => 30,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($this->user)
        ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/insumos/update-unlinked", [
            'tipo' => 'materiales',
            'old_descripcion' => 'Arena gruesa',
            'new_codigo' => 'NEW-02',
            'new_descripcion' => 'Arena seleccionada',
            'new_unidad' => 'kg',
            'new_precio' => 12,
        ])
        ->assertSuccessful();

    $material = $connection->table('acu_materiales')->where('acu_id', $acuId)->first();

    expect($material->cod_insumo)->toBe('NEW-02')
        ->and($material->codigo_producto)->toBe('NEW-02')
        ->and($material->unidad)->toBe('kg')
        ->and($material->descripcion)->toBe('Arena seleccionada')
        ->and((float) $material->parcial)->toBe(36.0);
});
