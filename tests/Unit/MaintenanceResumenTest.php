<?php

use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Services\Mantenimiento\MaintenanceGgService;
use App\Services\Mantenimiento\MaintenanceMatService;
use App\Services\Mantenimiento\MaintenanceMoService;
use App\Services\Mantenimiento\MaintenanceResumenService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    config()->set('database.connections.costos_tenant', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]);
    DB::purge('costos_tenant');

    foreach ([
        '2026_09_10_000020_create_mantenimiento_editor_tables.php',
        '2026_09_10_000030_create_mantenimiento_recovery_tables.php',
        '2026_09_10_000060_create_mantenimiento_mo_domain_tables.php',
        '2026_09_10_000061_drop_mo_partida_adjustment_columns.php',
        '2026_09_10_000070_create_mantenimiento_mat_tables.php',
        '2026_09_11_000080_create_mantenimiento_gg_tables.php',
    ] as $migration) {
        (require database_path('migrations/costos_tenant/'.$migration))->up();
    }
});

afterEach(function () {
    Schema::connection('costos_tenant')->dropAllTables();
});

it('rolls up MO + MAT + GG E.T. totals into RESUMEN GENERAL and computes deuda/déficit/gasto real from parámetros', function () {
    $document = MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Doc', 'moneda' => 'PEN']);

    // Presupuesto/Saldo de MO ahora viven solo a nivel institución: la partida necesita estar
    // anidada bajo una para que MO.totales.general.presupuesto tenga un valor (por defecto,
    // "sugerido" = su propio rollup de E.T., igual que antes).
    $mo = app(MaintenanceMoService::class);
    $ie = $mo->addPartida($document, null, ['tipo' => 'ie', 'descripcion' => 'Institución']);
    $ieModel = MaintenancePartida::query()->where('public_id', collect($ie['mo']['rows'])->firstWhere('tipo', 'ie')['partida_id'])->firstOrFail();

    // Partida con mano de obra E.T. = 10 * 50 = 500.00
    $created = $mo->addPartida($document->refresh(), $ieModel, ['tipo' => 'partida', 'item' => '01.01', 'descripcion' => 'Partida', 'metrado' => '10', 'mo_pu' => '50']);
    $partidaId = collect($created['mo']['rows'])->firstWhere('item', '01.01')['partida_id'];
    $partida = MaintenancePartida::query()->where('public_id', $partidaId)->firstOrFail();

    // Material con E.T. = 2 * 1000 = 2000.00
    $mat = app(MaintenanceMatService::class);
    $mat->addMaterial($document->refresh(), $partida, ['descripcion' => 'Cemento', 'cantidad' => '2', 'precio_unitario' => '1000']);

    // Línea GG con E.T. = 1 * 300 = 300.00
    $gg = app(MaintenanceGgService::class);
    $gg->addLinea($document->refresh(), ['grupo' => 'fijo', 'rubro' => 'Fianzas: Contratación', 'descripcion' => 'Fianza', 'cantidad' => '1', 'costo_unitario' => '300']);

    $resumen = app(MaintenanceResumenService::class);
    $result = $resumen->updateParametros($document->refresh(), [
        'expediente' => ['equipos' => '80', 'utilidad' => '150', 'igv' => '60', 'descuento' => '0'],
        'aprobado_ideal' => ['materiales' => '2500', 'mano_obra' => '600', 'equipos' => '100', 'gastos_generales' => '350', 'utilidad' => '200', 'igv' => '90', 'descuento' => '50'],
        'apoyo_tecnico' => ['ejecutado' => '0', 'por_pagar' => '100'],
        'monto_invertir' => ['materiales' => ['armada_1' => '100', 'armada_2' => '50', 'liquidacion' => '0']],
        'aportes_socios' => ['socio1' => ['armada_1' => '200', 'armada_2' => '0', 'liquidacion' => '0']],
    ]);

    $payload = $result['resumen'];

    // ── RESUMEN GENERAL ──
    $rows = collect($payload['general']['rows'])->keyBy('componente');
    expect($rows['materiales']['expediente'])->toBe('2000.00')
        ->and($rows['mano_obra']['expediente'])->toBe('500.00')
        ->and($rows['gastos_generales']['expediente'])->toBe('300.00')
        ->and($rows['costo_directo']['expediente'])->toBe('2580.00') // 2000+500+80
        ->and($rows['costo_directo']['aprobado_ideal'])->toBe('3200.00') // 2500+600+100
        ->and($rows['total']['expediente'])->toBe('3030.00') // 2580+300+150
        ->and($rows['total']['aprobado_ideal'])->toBe('3750.00') // 3200+350+200
        ->and($rows['total_adjudicado']['expediente'])->toBe('3090.00') // 3030+60-0
        ->and($rows['total_adjudicado']['aprobado_ideal'])->toBe('3790.00'); // 3750+90-50

    // ── RESUMEN DESAGREGADO ──
    $desag = collect($payload['desagregado']['rows']);
    $materialesRow = $desag->first(fn ($r) => ($r['label'] ?? null) === 'Materiales' && $r['tipo'] === 'linea');
    expect($materialesRow['aprobado_ideal'])->toBe('2500.00')
        ->and($materialesRow['proyectado_real'])->toBe('2000.00')
        ->and($materialesRow['actual'])->toBe('0.00')
        ->and($materialesRow['deuda'])->toBe('2000.00')
        ->and($materialesRow['deficit'])->toBe('500.00');

    $subcontratoRow = $desag->first(fn ($r) => ($r['label'] ?? null) === 'Subcontrato');
    expect($subcontratoRow['deuda'])->toBe('500.00')
        ->and($subcontratoRow['deficit'])->toBe('100.00');

    $costoDirectoRollup = $desag->first(fn ($r) => ($r['label'] ?? null) === 'Costo Directo');
    expect($costoDirectoRollup['proyectado_real'])->toBe('2580.00')
        ->and($costoDirectoRollup['deficit'])->toBe('620.00');

    $ggRollup = $desag->first(fn ($r) => ($r['label'] ?? null) === 'Gastos Generales' && $r['tipo'] === 'rollup');
    expect($ggRollup['proyectado_real'])->toBe('300.00')
        ->and($ggRollup['deficit'])->toBe('50.00');

    // ── MONTO A INVERTIR ──
    $materialesInvertir = collect($payload['monto_invertir']['componentes'])->firstWhere('componente', 'materiales');
    expect($materialesInvertir['sub_total'])->toBe('150.00'); // 100+50+0
    $totalSocios = collect($payload['monto_invertir']['socios'])->firstWhere('componente', 'total_socios');
    expect($totalSocios['armadas']['armada_1'])->toBe('200.00'); // solo socio1 aportó

    // ── GASTO REAL ──
    $lineas = collect($payload['gasto_real']['lineas'])->keyBy('label');
    expect($lineas['M.O']['por_pagar'])->toBe('500.00')
        ->and($lineas['MAT.']['por_pagar'])->toBe('2000.00')
        ->and($lineas['G.G']['por_pagar'])->toBe('300.00')
        ->and($payload['gasto_real']['gasto_total'])->toBe('2900.00') // 500+2000+300+100 apoyo
        ->and($payload['gasto_real']['total_adjudicado'])->toBe('3790.00')
        ->and($payload['gasto_real']['utilidad'])->toBe('890.00') // 3790-2900
        ->and($payload['gasto_real']['pct_ejecucion'])->toBe('76.52'); // 2900/3790
});

it('renders a fresh document with parametros still null (never saved) without a TypeError', function () {
    $document = MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Doc', 'moneda' => 'PEN']);
    expect($document->parametros)->toBeNull();

    $payload = app(MaintenanceResumenService::class)->payload($document);

    expect($payload['general']['rows'])->not->toBeEmpty()
        ->and($payload['general']['totals']['aprobado_ideal'])->toBe('0.00');
});

it('deep-merges a partial parámetros update without wiping other fields', function () {
    $document = MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Doc', 'moneda' => 'PEN']);
    $resumen = app(MaintenanceResumenService::class);

    $first = $resumen->updateParametros($document, ['aprobado_ideal' => ['materiales' => '1000', 'mano_obra' => '2000']]);
    expect($first['resumen']['parametros']['aprobado_ideal']['materiales'])->toBe('1000')
        ->and($first['resumen']['parametros']['aprobado_ideal']['mano_obra'])->toBe('2000');

    $second = $resumen->updateParametros($document->refresh(), ['aprobado_ideal' => ['equipos' => '500']]);
    expect($second['resumen']['parametros']['aprobado_ideal']['equipos'])->toBe('500')
        ->and($second['resumen']['parametros']['aprobado_ideal']['materiales'])->toBe('1000') // no se pierde
        ->and($second['resumen']['parametros']['aprobado_ideal']['mano_obra'])->toBe('2000');
});
