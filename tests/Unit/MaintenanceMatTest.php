<?php

use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceMatCompra;
use App\Models\Mantenimiento\MaintenanceMatMaterial;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Services\Mantenimiento\MaintenanceMatService;
use App\Services\Mantenimiento\MaintenanceMoService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use App\Services\Mantenimiento\MaintenanceWbsImportService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    config()->set('database.connections.costos_tenant', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]);
    DB::purge('costos_tenant');
    $schema = Schema::connection('costos_tenant');

    $schema->create('presupuestos', function (Blueprint $table) {
        $table->id();
        $table->string('nombre');
        $table->string('moneda');
        $table->decimal('costo_directo', 20, 10)->default(0);
        $table->decimal('gastos_generales', 20, 10)->default(0);
        $table->decimal('utilidad', 20, 10)->default(0);
        $table->decimal('igv_porcentaje', 20, 10)->default(0);
        $table->decimal('total_presupuesto', 20, 10)->default(0);
        $table->timestamps();
        $table->softDeletes();
    });
    $schema->create('presupuesto_general', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('presupuesto_id');
        $table->string('partida');
        $table->text('descripcion');
        $table->string('unidad')->nullable();
        $table->decimal('metrado', 20, 10);
        $table->decimal('precio_unitario', 20, 10);
        $table->decimal('parcial', 20, 10);
        $table->unsignedInteger('item_order');
        $table->softDeletes();
    });
    $schema->create('presupuesto_acus', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('presupuesto_id');
        $table->string('partida');
        $table->text('descripcion');
        $table->string('unidad');
        $table->decimal('rendimiento', 20, 10);
        $table->decimal('costo_mano_obra', 20, 10);
        $table->decimal('costo_materiales', 20, 10);
        $table->decimal('costo_equipos', 20, 10);
        $table->decimal('costo_subcontratos', 20, 10);
        $table->decimal('costo_subpartidas', 20, 10);
        $table->decimal('costo_unitario_total', 20, 10);
        $table->unsignedInteger('item_order');
    });
    foreach (['acu_mano_de_obra', 'acu_materiales', 'acu_equipos', 'acu_subcontratos', 'acu_subpartidas'] as $tableName) {
        $schema->create($tableName, function (Blueprint $table) use ($tableName) {
            $table->id();
            $table->unsignedBigInteger('acu_id');
            $table->unsignedBigInteger('insumo_id')->nullable();
            $table->text('descripcion');
            $table->string('unidad');
            $table->decimal('cantidad', 20, 10);
            $table->decimal($tableName === 'acu_equipos' ? 'precio_hora' : 'precio_unitario', 20, 10);
            $table->decimal('parcial', 20, 10)->nullable();
            $table->unsignedInteger('item_order');
        });
    }
    foreach ([
        '2026_09_10_000020_create_mantenimiento_editor_tables.php',
        '2026_09_10_000030_create_mantenimiento_recovery_tables.php',
        '2026_09_10_000060_create_mantenimiento_mo_domain_tables.php',
        '2026_09_10_000061_drop_mo_partida_adjustment_columns.php',
        '2026_09_10_000070_create_mantenimiento_mat_tables.php',
    ] as $migration) {
        (require database_path('migrations/costos_tenant/'.$migration))->up();
    }

    DB::connection('costos_tenant')->table('presupuestos')->insert(['id' => 1, 'nombre' => 'PG', 'moneda' => 'PEN', 'created_at' => now(), 'updated_at' => now()]);
    DB::connection('costos_tenant')->table('presupuesto_general')->insert([
        ['id' => 1, 'presupuesto_id' => 1, 'partida' => '01', 'descripcion' => 'INSTITUCIÓN EDUCATIVA X', 'unidad' => null, 'metrado' => '0', 'precio_unitario' => '0', 'parcial' => '0', 'item_order' => 1],
        ['id' => 2, 'presupuesto_id' => 1, 'partida' => '01.01', 'descripcion' => 'PISO DE MADERA', 'unidad' => 'M2', 'metrado' => '94.8', 'precio_unitario' => '42', 'parcial' => '3981.6', 'item_order' => 2],
    ]);
    DB::connection('costos_tenant')->table('presupuesto_acus')->insert([
        ['id' => 1, 'presupuesto_id' => 1, 'partida' => '01.01', 'descripcion' => 'PISO', 'unidad' => 'M2', 'rendimiento' => '1', 'costo_mano_obra' => '20', 'costo_materiales' => '22', 'costo_equipos' => '0', 'costo_subcontratos' => '0', 'costo_subpartidas' => '0', 'costo_unitario_total' => '42', 'item_order' => 2],
    ]);
    DB::connection('costos_tenant')->table('acu_materiales')->insert([
        ['acu_id' => 1, 'descripcion' => 'MACHIHEMBRADO 3.0M', 'unidad' => 'UND', 'cantidad' => '330', 'precio_unitario' => '12', 'parcial' => '3960', 'item_order' => 1],
        ['acu_id' => 1, 'descripcion' => 'CLAVO 2"', 'unidad' => 'KG', 'cantidad' => '20', 'precio_unitario' => '5', 'parcial' => '100', 'item_order' => 2],
        ['acu_id' => 1, 'descripcion' => 'FLETE', 'unidad' => 'GLB', 'cantidad' => '0', 'precio_unitario' => '0', 'parcial' => '0', 'item_order' => 3],
    ]);
    foreach (['acu_mano_de_obra', 'acu_equipos', 'acu_subcontratos', 'acu_subpartidas'] as $tableName) {
        DB::connection('costos_tenant')->table($tableName)->insert([
            'acu_id' => 1, 'descripcion' => 'r', 'unidad' => 'u', 'cantidad' => '1',
            $tableName === 'acu_equipos' ? 'precio_hora' : 'precio_unitario' => '1', 'parcial' => '1', 'item_order' => 1,
        ]);
    }
});

function matDoc(): MaintenanceDocument
{
    return MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Doc', 'moneda' => 'PEN']);
}

function importForMat(MaintenanceDocument $document): array
{
    $project = new CostoProject(['database_name' => 'x']);
    $service = app(MaintenanceWbsImportService::class);

    return $service->import($project, $document, $service->preview($project, $document)['source_hash'], (string) Str::uuid(), null);
}

it('imports only ACU materials with parcial > 0 under their partida', function () {
    $document = matDoc();
    $result = importForMat($document);

    expect($result['summary']['materiales'])->toBe(2); // FLETE (parcial 0) excluido

    $mat = app(MaintenanceMatService::class)->payload($document->refresh(), app(MaintenanceScenarioService::class)->activeFor($document, 'mat'));
    $materials = collect($mat['rows'])->where('es_material', true);

    expect($materials->pluck('descripcion')->all())->toBe(['MACHIHEMBRADO 3.0M', 'CLAVO 2"'])
        ->and($materials->firstWhere('descripcion', 'MACHIHEMBRADO 3.0M')['et'])->toMatchArray(['cantidad' => '330', 'precio' => '12', 'pt' => '3960']);
});

it('takes the lowest quoted unit price and reconciles purchases against the E.T.', function () {
    $document = matDoc();
    importForMat($document);
    $mat = app(MaintenanceMatService::class);
    $scenarios = app(MaintenanceScenarioService::class);
    $active = fn () => $scenarios->activeFor($document->refresh(), 'mat');

    $machi = MaintenanceMatMaterial::query()->where('descripcion', 'MACHIHEMBRADO 3.0M')->firstOrFail();

    $mat->setCotizacion($document->refresh(), $active(), $machi, 1, ['precio' => '18']);
    $mat->setCotizacion($document->refresh(), $active(), $machi, 2, ['precio' => '14.5']);
    $result = $mat->setCotizacion($document->refresh(), $active(), $machi, 3, ['precio' => '17.5']);

    $row = collect($result['mat']['rows'])->firstWhere('material_id', $machi->public_id);
    expect($row['pu_minimo'])->toBe('14.5')
        ->and($row['pt_referencia'])->toBe('4785'); // 330 * 14.5

    $compra = $mat->addCompra($document->refresh(), $active(), '2026-06-24', null);
    $compraId = $compra['mat']['compras'][0]['id'];
    $compraModel = MaintenanceMatCompra::query()->where('public_id', $compraId)->firstOrFail();

    $result = $mat->setCompraValor($document->refresh(), $compraModel, $machi, ['cantidad' => '330', 'precio' => '14.5']);
    $row = collect($result['mat']['rows'])->firstWhere('material_id', $machi->public_id);
    expect($row['compras'][$compraId]['subtotal'])->toBe('4785')
        ->and($row['total_comprado'])->toBe('4785.00')
        ->and($row['saldo'])->toBe('-825.00')      // 3960 (E.T.) - 4785
        ->and($row['descuadra'])->toBeTrue();

    $partida = collect($result['mat']['rows'])->firstWhere(fn ($r) => $r['tipo'] === 'partida');
    expect($partida['pt_et'])->toBe('4060.00')     // 3960 + 100
        ->and($result['mat']['totales']['conciliacion']['estado'])->toBe('deficit');
});

it('emits rows in depth-first tree order even when sort_order collides across unrelated branches', function () {
    // Mismo bug/fix que MoCalculator: sort_order solo es único entre hermanos, así que dos ramas
    // distintas del árbol pueden empatar; el payload debe seguir el orden del árbol, no el orden
    // plano de la query.
    $document = matDoc();
    $mo = app(MaintenanceMoService::class);
    $scenarios = app(MaintenanceScenarioService::class);
    $scenarios->ensureDefault($document, 'mo', 'MO');

    $inst1 = $mo->addPartida($document->refresh(), null, ['tipo' => 'ie', 'descripcion' => 'Institución 1']);
    $inst1Model = MaintenancePartida::query()->where('public_id', collect($inst1['mo']['rows'])->firstWhere('tipo', 'ie')['partida_id'])->firstOrFail();

    $arq = $mo->addPartida($document->refresh(), $inst1Model, ['tipo' => 'bloque', 'item' => '1.01', 'descripcion' => 'Arquitectura']);
    $arqModel = MaintenancePartida::query()->where('public_id', collect($arq['mo']['rows'])->firstWhere('item', '1.01')['partida_id'])->firstOrFail();

    $mo->addPartida($document->refresh(), $arqModel, ['tipo' => 'partida', 'item' => '01.01.01', 'descripcion' => 'Pisos', 'metrado' => '1', 'mo_pu' => '1']);
    $mo->addPartida($document->refresh(), null, ['tipo' => 'ie', 'descripcion' => 'Institución 2']); // sort_order=2048
    $mo->addPartida($document->refresh(), $arqModel, ['tipo' => 'bloque', 'item' => '01.01.02', 'descripcion' => 'Revoques']); // también sort_order=2048, pero hijo de Arquitectura

    $mat = app(MaintenanceMatService::class)->payload($document->refresh(), app(MaintenanceScenarioService::class)->activeFor($document, 'mat'));
    $order = collect($mat['rows'])->pluck('descripcion')->all();
    $revoquesIndex = array_search('Revoques', $order, true);
    $inst2Index = array_search('Institución 2', $order, true);

    expect($revoquesIndex)->not->toBeFalse()
        ->and($inst2Index)->not->toBeFalse()
        ->and($revoquesIndex)->toBeLessThan($inst2Index);
});
