<?php

use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceMoSeries;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Models\Mantenimiento\MaintenanceScenario;
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
    foreach (['2026_09_10_000020_create_mantenimiento_editor_tables.php', '2026_09_10_000030_create_mantenimiento_recovery_tables.php', '2026_09_10_000060_create_mantenimiento_mo_domain_tables.php', '2026_09_10_000061_drop_mo_partida_adjustment_columns.php', '2026_09_10_000070_create_mantenimiento_mat_tables.php'] as $migration) {
        (require database_path('migrations/costos_tenant/'.$migration))->up();
    }

    DB::connection('costos_tenant')->table('presupuestos')->insert(['id' => 1, 'nombre' => 'PG Colegios', 'moneda' => 'PEN', 'created_at' => now(), 'updated_at' => now()]);
    DB::connection('costos_tenant')->table('presupuesto_general')->insert([
        ['id' => 1, 'presupuesto_id' => 1, 'partida' => '01', 'descripcion' => 'INSTITUCIÓN EDUCATIVA MIGUEL DE LA MATA', 'unidad' => null, 'metrado' => '0', 'precio_unitario' => '0', 'parcial' => '0', 'item_order' => 1],
        ['id' => 2, 'presupuesto_id' => 1, 'partida' => '01.01', 'descripcion' => 'ARQUITECTURA', 'unidad' => null, 'metrado' => '0', 'precio_unitario' => '0', 'parcial' => '0', 'item_order' => 2],
        ['id' => 3, 'presupuesto_id' => 1, 'partida' => '01.01.01', 'descripcion' => 'PISO DE MADERA MACHIHEMBRADO', 'unidad' => 'M2', 'metrado' => '94.8', 'precio_unitario' => '30', 'parcial' => '2844', 'item_order' => 3],
        ['id' => 4, 'presupuesto_id' => 1, 'partida' => '01.01.02', 'descripcion' => 'TARRAJEO EN MUROS', 'unidad' => 'M2', 'metrado' => '403.99', 'precio_unitario' => '25', 'parcial' => '10099.75', 'item_order' => 4],
    ]);
    DB::connection('costos_tenant')->table('presupuesto_acus')->insert([
        ['id' => 1, 'presupuesto_id' => 1, 'partida' => '01.01.01', 'descripcion' => 'PISO DE MADERA', 'unidad' => 'M2', 'rendimiento' => '1', 'costo_mano_obra' => '20', 'costo_materiales' => '10', 'costo_equipos' => '0', 'costo_subcontratos' => '0', 'costo_subpartidas' => '0', 'costo_unitario_total' => '30', 'item_order' => 3],
        ['id' => 2, 'presupuesto_id' => 1, 'partida' => '01.01.02', 'descripcion' => 'TARRAJEO', 'unidad' => 'M2', 'rendimiento' => '1', 'costo_mano_obra' => '20', 'costo_materiales' => '5', 'costo_equipos' => '0', 'costo_subcontratos' => '0', 'costo_subpartidas' => '0', 'costo_unitario_total' => '25', 'item_order' => 4],
    ]);
    foreach (['acu_mano_de_obra', 'acu_materiales', 'acu_equipos', 'acu_subcontratos', 'acu_subpartidas'] as $tableName) {
        DB::connection('costos_tenant')->table($tableName)->insert([
            'acu_id' => 1, 'descripcion' => 'r', 'unidad' => 'hh', 'cantidad' => '1',
            $tableName === 'acu_equipos' ? 'precio_hora' : 'precio_unitario' => '1', 'parcial' => '1', 'item_order' => 1,
        ]);
    }
});

function moDocument(): MaintenanceDocument
{
    return MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Doc', 'moneda' => 'PEN']);
}

function importWbs(MaintenanceDocument $document, ?string $key = null): array
{
    $project = new CostoProject(['database_name' => 'unused']);
    $service = app(MaintenanceWbsImportService::class);
    $preview = $service->preview($project, $document);

    return $service->import($project, $document, $preview['source_hash'], $key ?? (string) Str::uuid(), null);
}

it('builds the WBS tree with ie, bloque and partida rows and seeds a MO scenario', function () {
    $document = moDocument();
    $result = importWbs($document);

    expect($result['summary']['instituciones'])->toBe(1)
        ->and($result['summary']['insertadas'])->toBe(4);

    $partidas = MaintenancePartida::query()->orderBy('sort_order')->get();
    expect($partidas->pluck('tipo')->all())->toBe(['ie', 'bloque', 'partida', 'partida'])
        ->and($partidas->firstWhere('item', '01')->item_entero)->toBeTrue()
        ->and($partidas->firstWhere('item', '01.01.01')->parent->item)->toBe('01.01');

    expect(MaintenanceScenario::query()->where('tipo_hoja', 'mo')->where('es_activo', true)->count())->toBe(1);
});

it('is idempotent for the same request and re-syncs without duplicating', function () {
    $document = moDocument();
    $key = (string) Str::uuid();
    importWbs($document, $key);

    expect(importWbs($document, $key)['idempotent'])->toBeTrue();      // mismo request
    importWbs($document);                                             // re-sync (upsert)

    expect(MaintenancePartida::query()->count())->toBe(4)
        ->and(MaintenanceDocument::query()->count())->toBe(1);
});

it('derives MO expediente técnico from metrado x costo_mano_obra and rolls up blocks', function () {
    $document = moDocument();
    importWbs($document);
    $scenario = app(MaintenanceScenarioService::class)->activeFor($document->refresh(), 'mo');
    $payload = app(MaintenanceMoService::class)->payload($document, $scenario);

    $piso = collect($payload['rows'])->firstWhere('item', '01.01.01');
    expect($piso['et'])->toMatchArray(['cantidad' => '94.8', 'precio' => '20', 'parcial' => '1896']);

    $bloque = collect($payload['rows'])->firstWhere('item', '01.01');
    expect($bloque['et']['parcial'])->toBe('9975.8'); // 1896 + (403.99 * 20)
    expect($payload['totales']['general']['et_parcial'])->toBe('9975.80');
});

it('lets you build the structure manually when there is no presupuesto', function () {
    $document = moDocument();
    $mo = app(MaintenanceMoService::class);
    $scenarios = app(MaintenanceScenarioService::class);

    $scenarios->ensureDefault($document, 'mo', 'MO');
    $ie = $mo->addPartida($document->refresh(), null, ['tipo' => 'ie', 'descripcion' => 'I.E. San Pedro']);
    $ieRow = collect($ie['mo']['rows'])->firstWhere('tipo', 'ie');
    $ieModel = MaintenancePartida::query()->where('public_id', $ieRow['partida_id'])->firstOrFail();

    $result = $mo->addPartida($document->refresh(), $ieModel, [
        'tipo' => 'partida', 'item' => '01.01', 'descripcion' => 'Tarrajeo', 'unidad' => 'M2', 'metrado' => '100', 'mo_pu' => '18',
    ]);

    $partida = collect($result['mo']['rows'])->firstWhere('item', '01.01');
    expect($partida['tipo'])->toBe('partida')
        ->and($partida['et'])->toMatchArray(['cantidad' => '100', 'precio' => '18', 'parcial' => '1800'])
        ->and(MaintenancePartida::query()->where('tipo', 'ie')->count())->toBe(1);
});

it('promotes a leaf partida to bloque when a child is added under it, so the rollup sums the child instead of losing it', function () {
    $document = moDocument();
    $mo = app(MaintenanceMoService::class);
    $scenarios = app(MaintenanceScenarioService::class);
    $scenarios->ensureDefault($document, 'mo', 'MO');

    $created = $mo->addPartida($document->refresh(), null, [
        'tipo' => 'partida', 'item' => '1.01', 'descripcion' => 'Arquitectura', 'unidad' => 'GLB', 'metrado' => '1', 'mo_pu' => '500',
    ]);
    $arquitecturaRow = collect($created['mo']['rows'])->firstWhere('item', '1.01');
    expect($arquitecturaRow['tipo'])->toBe('partida')
        ->and($arquitecturaRow['et']['parcial'])->toBe('500');

    $arquitectura = MaintenancePartida::query()->where('public_id', $arquitecturaRow['partida_id'])->firstOrFail();
    $result = $mo->addPartida($document->refresh(), $arquitectura, [
        'tipo' => 'partida', 'item' => '01.01.01', 'descripcion' => 'Pisos y Pavimientos', 'unidad' => 'M2', 'metrado' => '10', 'mo_pu' => '20',
    ]);

    $promoted = collect($result['mo']['rows'])->firstWhere('item', '1.01');
    expect($promoted['tipo'])->toBe('bloque') // se ascendió automáticamente al agregarle un hijo
        ->and($promoted['et']['parcial'])->toBe('200'); // ahora suma al hijo (10*20); ya no aplica su propia fórmula de hoja (500)

    $hijo = collect($result['mo']['rows'])->firstWhere('item', '01.01.01');
    expect($hijo['parent_id'])->toBe($arquitectura->public_id);
});

it('emits rows in depth-first tree order even when sort_order collides across unrelated branches', function () {
    // sort_order solo es único ENTRE HERMANOS (se reinicia en cada nivel), así que dos filas de
    // ramas distintas del árbol pueden compartir el mismo valor. Antes de este fix, el payload
    // simplemente reusaba el orden plano de la query (ORDER BY sort_order global), y con ese
    // empate MySQL no garantiza el orden → una fila terminaba visualmente "dentro" de la
    // institución equivocada aunque su parent_id en BD fuera correcto.
    $document = moDocument();
    $mo = app(MaintenanceMoService::class);
    $scenarios = app(MaintenanceScenarioService::class);
    $scenarios->ensureDefault($document, 'mo', 'MO');

    $inst1 = $mo->addPartida($document->refresh(), null, ['tipo' => 'ie', 'descripcion' => 'Institución 1']);
    $inst1Model = MaintenancePartida::query()->where('public_id', collect($inst1['mo']['rows'])->firstWhere('tipo', 'ie')['partida_id'])->firstOrFail();

    $arq = $mo->addPartida($document->refresh(), $inst1Model, ['tipo' => 'bloque', 'item' => '1.01', 'descripcion' => 'Arquitectura']);
    $arqModel = MaintenancePartida::query()->where('public_id', collect($arq['mo']['rows'])->firstWhere('item', '1.01')['partida_id'])->firstOrFail();

    // Institución 2 nace con sort_order=2048 (segunda raíz).
    $mo->addPartida($document->refresh(), null, ['tipo' => 'ie', 'descripcion' => 'Institución 2']);

    // Revoques es hijo de Arquitectura y también recibe sort_order=2048 dentro de ESE grupo de
    // hermanos (Arquitectura ya tenía un hijo en 1024) — empata en valor con Institución 2, pero
    // en ramas distintas del árbol.
    $mo->addPartida($document->refresh(), $arqModel, ['tipo' => 'partida', 'item' => '01.01.01', 'descripcion' => 'Pisos', 'metrado' => '1', 'mo_pu' => '1']);
    $result = $mo->addPartida($document->refresh(), $arqModel, ['tipo' => 'bloque', 'item' => '01.01.02', 'descripcion' => 'Revoques']);

    $order = collect($result['mo']['rows'])->pluck('descripcion')->all();
    $revoquesIndex = array_search('Revoques', $order, true);
    $inst2Index = array_search('Institución 2', $order, true);

    expect($order[0])->toBe('Institución 1')
        ->and($revoquesIndex)->not->toBeFalse()
        ->and($inst2Index)->not->toBeFalse()
        ->and($revoquesIndex)->toBeLessThan($inst2Index); // Revoques sigue dentro del árbol de Institución 1
});

it('auto-numbers the item code from the tree position when left blank, and still allows a manual override', function () {
    $document = moDocument();
    $mo = app(MaintenanceMoService::class);
    $scenarios = app(MaintenanceScenarioService::class);
    $scenarios->ensureDefault($document, 'mo', 'MO');

    $ie = $mo->addPartida($document->refresh(), null, ['tipo' => 'ie', 'descripcion' => 'Institución 1']);
    $ieModel = MaintenancePartida::query()->where('public_id', collect($ie['mo']['rows'])->firstWhere('tipo', 'ie')['partida_id'])->firstOrFail();

    // nivel 1: "{índice}.01"
    $arq = $mo->addPartida($document->refresh(), $ieModel, ['tipo' => 'bloque', 'descripcion' => 'Arquitectura']);
    $arqRow = collect($arq['mo']['rows'])->firstWhere('descripcion', 'Arquitectura');
    expect($arqRow['item'])->toBe('1.01');
    $arqModel = MaintenancePartida::query()->where('public_id', $arqRow['partida_id'])->firstOrFail();

    $estr = $mo->addPartida($document->refresh(), $ieModel, ['tipo' => 'bloque', 'descripcion' => 'Estructuras']);
    expect(collect($estr['mo']['rows'])->firstWhere('descripcion', 'Estructuras')['item'])->toBe('2.01');

    // nivel 2: prefijo del padre a 2 dígitos + índice a 2 dígitos
    $pisos = $mo->addPartida($document->refresh(), $arqModel, ['tipo' => 'bloque', 'descripcion' => 'Pisos y Pavimientos']);
    $pisosRow = collect($pisos['mo']['rows'])->firstWhere('descripcion', 'Pisos y Pavimientos');
    expect($pisosRow['item'])->toBe('01.01.01');
    $pisosModel = MaintenancePartida::query()->where('public_id', $pisosRow['partida_id'])->firstOrFail();

    $revoques = $mo->addPartida($document->refresh(), $arqModel, ['tipo' => 'bloque', 'descripcion' => 'Revoques']);
    expect(collect($revoques['mo']['rows'])->firstWhere('descripcion', 'Revoques')['item'])->toBe('01.01.02');

    // nivel 3: sigue extendiendo el prefijo del padre
    $leaf = $mo->addPartida($document->refresh(), $pisosModel, ['tipo' => 'partida', 'descripcion' => 'Piso de madera', 'metrado' => '1', 'mo_pu' => '1']);
    expect(collect($leaf['mo']['rows'])->firstWhere('descripcion', 'Piso de madera')['item'])->toBe('01.01.01.01');

    // el ítem sigue siendo editable a mano cuando se especifica explícitamente
    $manual = $mo->addPartida($document->refresh(), $arqModel, ['tipo' => 'bloque', 'item' => '99.99.99', 'descripcion' => 'Caso irregular']);
    expect(collect($manual['mo']['rows'])->firstWhere('descripcion', 'Caso irregular')['item'])->toBe('99.99.99');
});

it('computes FINAL as the sum of every P.M.O parcial and flags a mismatch against the institución presupuesto', function () {
    // Presupuesto/Saldo ahora viven solo a nivel institución (la bolsa de la que se descuentan
    // los P.M.O de TODAS sus partidas) — ya no se editan ni se comparan por partida individual.
    $document = moDocument();
    importWbs($document);
    $mo = app(MaintenanceMoService::class);
    $scenarios = app(MaintenanceScenarioService::class);
    $active = fn () => $scenarios->activeFor($document->refresh(), 'mo');

    $ie = MaintenancePartida::query()->where('tipo', 'ie')->firstOrFail();
    $piso = MaintenancePartida::query()->where('item', '01.01.01')->firstOrFail();
    $mo->updatePartida($document->refresh(), $active(), $ie, ['presupuesto' => '2000']);

    $s1 = $mo->addSeries($document->refresh(), $active(), '2026-06-24', 'Adelanto');
    $s2 = $mo->addSeries($document->refresh(), $active(), '2026-07-10', null);
    $serie1 = MaintenanceMoSeries::query()->where('public_id', $s1['mo']['series'][0]['id'])->firstOrFail();
    $serie2 = MaintenanceMoSeries::query()->where('public_id', $s2['mo']['series'][1]['id'])->firstOrFail();

    $mo->setParcial($document->refresh(), $serie1, $piso, '800');
    $result = $mo->setParcial($document->refresh(), $serie2, $piso, '1200');

    $ieRow = collect($result['mo']['rows'])->firstWhere('tipo', 'ie');
    expect($ieRow['final'])->toBe('2000.00')
        ->and($ieRow['presupuesto'])->toBe('2000.00')
        ->and($ieRow['saldo'])->toBe('0.00')
        ->and($ieRow['descuadra'])->toBeFalse()
        ->and($result['mo']['totales']['cuadra'])->toBeTrue();

    // las filas de partida ya no llevan su propio presupuesto/saldo; Final sigue siendo informativo por fila
    $pisoRow = collect($result['mo']['rows'])->firstWhere('item', '01.01.01');
    expect($pisoRow['presupuesto'])->toBeNull()
        ->and($pisoRow['saldo'])->toBeNull()
        ->and($pisoRow['final'])->toBe('2000.00');

    $result = $mo->setParcial($document->refresh(), $serie2, $piso, '1000');
    $ieRow = collect($result['mo']['rows'])->firstWhere('tipo', 'ie');
    expect($ieRow['final'])->toBe('1800.00')
        ->and($ieRow['saldo'])->toBe('200.00')
        ->and($ieRow['descuadra'])->toBeTrue()
        ->and($result['mo']['totales']['descuadres'])->toBe(1);
});
