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

it('absorbs inputs using the target price without deleting quantities', function () {
    $connection = DB::connection('costos_tenant');
    $presupuestoId = $this->dbService->getDefaultPresupuestoId($this->testDbName);
    $acuId = createTestAcu($presupuestoId);
    $unitId = $connection->table('unidad')->insertGetId([
        'descripcion' => 'm',
        'descripcion_singular' => 'Metro',
        'orden' => '',
        'informacion_unidad' => '',
        'abreviatura_unidad' => 'm',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $firstAngleId = $connection->table('insumo_productos')->insertGetId([
        'codigo_producto' => '510010002',
        'descripcion' => 'ANGULO A36 1 1/4" X 3/16"x6m',
        'unidad_id' => $unitId,
        'tipo' => 'materiales',
        'costo_unitario' => 30,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $targetAngleId = $connection->table('insumo_productos')->insertGetId([
        'codigo_producto' => '510010003',
        'descripcion' => 'ANGULO A36 1"x3/16"x6m',
        'unidad_id' => $unitId,
        'tipo' => 'materiales',
        'costo_unitario' => 20,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $connection->table('acu_materiales')->insert([
        [
            'acu_id' => $acuId,
            'cod_insumo' => '49',
            'descripcion' => 'GRAVILLA DE 3/8 (PUESTO EN OBRA)',
            'unidad' => 'm3',
            'cantidad' => 0.053,
            'precio_unitario' => 100,
            'parcial' => 5.3,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'acu_id' => $acuId,
            'cod_insumo' => '50',
            'descripcion' => 'GRAVILLA DE 3/8',
            'unidad' => 'm3',
            'cantidad' => 0.055,
            'precio_unitario' => 80,
            'parcial' => 4.4,
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);

    $this->actingAs($this->user)
        ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/insumos/merge-project-insumos", [
            'tipo' => 'materiales',
            'target' => [
                'insumo_id' => null,
                'codigo' => '49',
                'codigo_producto' => null,
                'descripcion' => 'GRAVILLA DE 3/8 (PUESTO EN OBRA)',
                'unidad' => 'm3',
                'precio' => 100,
            ],
            'sources' => [
                [
                    'descripcion' => 'GRAVILLA DE 3/8 (PUESTO EN OBRA)',
                    'unidad' => 'm3',
                    'codigo' => '49',
                ],
                [
                    'descripcion' => 'GRAVILLA DE 3/8',
                    'unidad' => 'm3',
                    'codigo' => '50',
                ],
            ],
        ])
        ->assertSuccessful()
        ->assertJsonPath('filas_afectadas', 2)
        ->assertJsonPath('acus_afectados', 1);

    $materials = $connection->table('acu_materiales')
        ->where('acu_id', $acuId)
        ->orderBy('cod_insumo')
        ->get();
    $acu = $connection->table('presupuesto_acus')->where('id', $acuId)->first();
    $storedMaterials = json_decode($acu->materiales, true);

    expect($materials)->toHaveCount(2)
        ->and($materials->pluck('descripcion')->unique()->all())->toBe(['GRAVILLA DE 3/8 (PUESTO EN OBRA)'])
        ->and($materials->pluck('cod_insumo')->unique()->all())->toBe(['49'])
        ->and($materials->pluck('precio_unitario')->map(fn ($price) => (float) $price)->all())->toBe([100.0, 100.0])
        ->and($materials->pluck('cantidad')->map(fn ($quantity) => (float) $quantity)->all())->toBe([0.053, 0.055])
        ->and(collect($storedMaterials)->pluck('descripcion')->unique()->all())->toBe(['GRAVILLA DE 3/8 (PUESTO EN OBRA)']);

    $connection->table('acu_materiales')->insert([
        [
            'acu_id' => $acuId,
            'insumo_id' => $firstAngleId,
            'cod_insumo' => '51',
            'descripcion' => 'ANGULO A36 1 1/4" X 3/16"x6m',
            'unidad' => 'm',
            'cantidad' => 2,
            'precio_unitario' => 30,
            'parcial' => 60,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'acu_id' => $acuId,
            'insumo_id' => $targetAngleId,
            'cod_insumo' => '51',
            'descripcion' => 'ANGULO A36 1"x3/16"x6m',
            'unidad' => 'm',
            'cantidad' => 3,
            'precio_unitario' => 20,
            'parcial' => 60,
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);

    $this->actingAs($this->user)
        ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/insumos/merge-project-insumos", [
            'tipo' => 'materiales',
            'target_descripcion' => 'ANGULO A36 1"x3/16"x6m',
            'sources' => [
                ['insumo_id' => null, 'descripcion' => 'ANGULO A36 1 1/4" X 3/16"x6m', 'unidad' => 'm', 'codigo' => '51'],
                ['insumo_id' => null, 'descripcion' => 'ANGULO A36 1"x3/16"x6m', 'unidad' => 'm', 'codigo' => '51'],
            ],
        ])
        ->assertSuccessful();

    $angles = $connection->table('acu_materiales')
        ->where('acu_id', $acuId)
        ->where('unidad', 'm')
        ->get();

    expect($angles->pluck('descripcion')->unique()->all())->toBe(['ANGULO A36 1"x3/16"x6m'])
        ->and($angles->pluck('insumo_id')->unique()->all())->toBe([$targetAngleId])
        ->and($angles->pluck('precio_unitario')->map(fn ($price) => (float) $price)->unique()->all())->toBe([20.0])
        ->and($angles->pluck('cantidad')->map(fn ($quantity) => (float) $quantity)->all())->toBe([2.0, 3.0]);
});
