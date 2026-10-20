<?php

use App\Domain\GastFin\InsumoConsolidator;
use App\Models\GastFin\GastFinMatCompra;
use App\Models\GastFin\GastFinMatInsumo;
use App\Models\GastFin\GastFinMoPago;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Services\GastFin\GastFinDocumentService;
use App\Services\GastFin\GastFinMatService;
use App\Services\GastFin\GastFinMoService;
use App\Services\GastFin\GastFinResumenService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
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
        '2026_10_19_000100_create_gastfin_tables.php',
        '2026_10_20_000110_gastfin_grupo_ref_to_codigo.php',
    ] as $migration) {
        (require database_path('migrations/costos_tenant/'.$migration))->up();
    }

    // Solo las columnas que Gast. Fin. lee (las migraciones reales de presupuesto usan SQL de MySQL).
    $schema = Schema::connection('costos_tenant');
    $schema->create('presupuestos', function (Blueprint $table) {
        $table->id();
        $table->softDeletes();
    });
    $schema->create('presupuesto_general', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('presupuesto_id');
        $table->string('partida', 50);
        $table->text('descripcion');
        $table->decimal('metrado', 15, 4)->default(0);
        $table->decimal('parcial', 15, 4)->default(0);
        $table->unsignedSmallInteger('item_order')->default(0);
        $table->softDeletes();
    });
    $schema->create('presupuesto_acus', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('presupuesto_id');
        $table->string('partida', 50);
        foreach (InsumoConsolidator::TIPOS as $tipo) {
            $table->json($tipo)->nullable();
        }
    });
});

afterEach(function () {
    Schema::connection('costos_tenant')->dropAllTables();
});

function gfPartida(int $id, string $partida, string $descripcion, string $metrado = '0'): void
{
    DB::connection('costos_tenant')->table('presupuesto_general')->insert([
        'id' => $id, 'presupuesto_id' => 1, 'partida' => $partida, 'descripcion' => $descripcion,
        'metrado' => $metrado, 'parcial' => '0', 'item_order' => $id,
    ]);
}

function gfAcu(string $partida, array $componentes): void
{
    $row = ['presupuesto_id' => 1, 'partida' => $partida];
    foreach (InsumoConsolidator::TIPOS as $tipo) {
        $row[$tipo] = json_encode($componentes[$tipo] ?? []);
    }
    DB::connection('costos_tenant')->table('presupuesto_acus')->insert($row);
}

function gfItem(string $descripcion, string $unidad, string $cantidad, string $precio, array $extra = []): array
{
    return ['descripcion' => $descripcion, 'unidad' => $unidad, 'cantidad' => $cantidad, 'precio_unitario' => $precio, ...$extra];
}

/**
 * PRIMER NIVEL (1) con dos especialidades (1.1.1 y 1.2.1), SEGUNDO NIVEL (2), y una partida 9.1
 * cuyo nivel 1 no existe (→ SIN NIVEL). Los códigos de ACU vienen con ceros ("01.01.01") como en
 * la BD real, y "OFÍCIAL" con tilde/mayúsculas se consolida con "OFICIAL".
 */
function gfSeed(): MaintenanceDocument
{
    DB::connection('costos_tenant')->table('presupuestos')->insert(['id' => 1]);
    gfPartida(10, '1', 'PRIMER NIVEL');
    gfPartida(11, '1.1', 'ESTRUCTURAS');
    gfPartida(12, '1.1.1', 'Concreto', '10');
    gfPartida(13, '1.2.1', 'Tarrajeo', '20');
    gfPartida(20, '2', 'SEGUNDO NIVEL');
    gfPartida(21, '2.1', 'Concreto 2do', '5');
    gfPartida(30, '9.1', 'Suelta', '1');

    gfAcu('01.01.01', [
        'mano_de_obra' => [gfItem('OFICIAL', 'hh', '0.5', '23.93'), gfItem('PEON', 'hh', '2', '21.66')],
        'materiales' => [gfItem('Cemento', 'bol', '8.5', '29.90', ['factor_desperdicio' => '1.05']), gfItem('Arena', 'm3', '0.5', '80')],
        'equipos' => [['descripcion' => 'Herramientas manuales', 'unidad' => '%mo', 'cantidad' => '3', 'precio_hora' => '55.285']],
    ]);
    gfAcu('01.02.01', [
        'mano_de_obra' => [gfItem('OFÍCIAL ', 'hh', '0.25', '23.93')],
        'materiales' => [gfItem('cemento', 'BOL', '0.2', '29.90')],
    ]);
    gfAcu('02.01', ['materiales' => [gfItem('Cemento', 'bol', '8.5', '29.90')]]);
    gfAcu('09.01', ['materiales' => [gfItem('Clavos', 'kg', '0.1', '7.9')]]);

    return MaintenanceDocument::create([
        'public_id' => (string) Str::ulid(), 'nombre' => 'GF', 'moneda' => 'PEN',
        'origen' => 'delphin', 'presupuesto_id' => 1,
    ]);
}

it('consolidates ACU insumos by level-1 group, summing every specialty underneath', function () {
    $document = gfSeed();
    $et = app(GastFinDocumentService::class)->expediente($document);

    expect(array_column($et['grupos'], 'ref'))->toBe(['01', '02', InsumoConsolidator::SIN_GRUPO])
        ->and(array_column($et['grupos'], 'descripcion'))->toBe(['PRIMER NIVEL', 'SEGUNDO NIVEL', 'SIN NIVEL']);

    $mo = $et['insumos']['01']['mano_de_obra'];
    expect($mo)->toHaveCount(2); // OFICIAL + OFÍCIAL se consolidan
    $oficial = $mo['mano_de_obra|oficial|hh'];
    expect(bccomp($oficial['cantidad'], '10', 10))->toBe(0)          // 10×0.5 + 20×0.25
        ->and(bccomp($oficial['parcial'], '239.3', 10))->toBe(0)     // 10 × 23.93
        ->and(bccomp($oficial['precio'], '23.93', 10))->toBe(0);

    // Cemento: 10×8.5 con desperdicio 1.05 (2668.575) + 20×0.2 sin desperdicio (119.6)
    $cemento = $et['insumos']['01']['materiales']['materiales|cemento|bol'];
    expect(bccomp($cemento['cantidad'], '89', 10))->toBe(0)
        ->and(bccomp($cemento['parcial'], '2788.175', 10))->toBe(0);

    // Unidad "%": monto = cantidad/100 × precio × metrado = 0.03 × 55.285 × 10
    $herr = $et['insumos']['01']['equipos']['equipos|herramientas manuales|mo'];
    expect(bccomp($herr['parcial'], '16.5855', 10))->toBe(0)
        ->and($herr['precio'])->toBe('0');

    expect(bccomp($et['totales']['02']['materiales'], '1270.75', 10))->toBe(0)
        ->and(bccomp($et['totales']['_']['materiales'], '0.79', 10))->toBe(0);
});

it('allocates rounding cents so rows add up exactly to the group total', function () {
    $document = gfSeed();
    $mat = app(GastFinMatService::class)->payload($document, '01');

    // 2788.175 + 400 = 3188.175 → 3188.18; el céntimo de redondeo va a la fila de mayor resto.
    $rows = collect($mat['rows'])->keyBy('descripcion');
    expect($rows['Cemento']['et']['parcial'])->toBe('2788.18')
        ->and($rows['Arena']['et']['parcial'])->toBe('400.00')
        ->and($mat['totales']['et'])->toBe('3188.18')
        ->and(array_column($mat['rows'], 'descripcion'))->toBe(['Arena', 'Cemento']);
});

it('tracks MO valorizaciones and adelantos per group against the approved budget', function () {
    $document = gfSeed();
    $service = app(GastFinMoService::class);

    $service->addPago($document, 'ADELANTO 1', null);
    $service->addPago($document, 'VAL 01 - S1', '2026-01-10');
    [$adelanto, $val01] = GastFinMoPago::query()->orderBy('sort_order')->get()->all();

    $service->setValor($document, $adelanto, '01', 'adelanto', ['etiqueta' => '1', 'monto' => '2000']);
    $mo = $service->setValor($document, $val01, '01', 'valorizacion', ['etiqueta' => '1.00', 'monto' => '4254.93'])['mo'];

    expect(array_column($mo['grupos'], 'ref'))->toBe(['01', '02']); // todos los niveles; SIN NIVEL vacío se omite

    $grupo = $mo['grupos'][0];
    expect($grupo['valores'][$val01->public_id]['valorizacion'])->toBe(['etiqueta' => '1.00', 'monto' => '4254.93'])
        ->and($grupo['valores'][$val01->public_id]['adelanto'])->toBeNull()
        ->and($grupo['totales'])->toMatchArray([
            'et_parcial' => '672.50', 'valorizado' => '4254.93', 'adelantos' => '2000.00', 'pagado' => '6254.93',
            'aprobado' => '672.50', 'aprobado_manual' => false, 'saldo' => '-5582.43', 'sobregiro' => true,
        ]);

    app(GastFinDocumentService::class)->updateGrupo($document, '01', ['mo_aprobado' => '40000']);
    $grupo = $service->payload($document)['grupos'][0];
    expect($grupo['totales'])->toMatchArray(['aprobado' => '40000.00', 'aprobado_manual' => true, 'saldo' => '33745.07', 'sobregiro' => false]);

    // Un nivel sin mano de obra igual recibe pagos; vaciar la celda la borra.
    $mo = $service->setValor($document, $val01, '02', 'valorizacion', ['monto' => '100'])['mo'];
    expect($mo['grupos'][1]['totales']['pagado'])->toBe('100.00');
    $mo = $service->setValor($document, $val01, '02', 'valorizacion', ['monto' => null])['mo'];
    expect($mo['grupos'][1]['rows'])->toBe([])
        ->and($mo['totales']['general']['final'])->toBe('6254.93');

    expect(fn () => $service->setValor($document, $val01, 999, 'valorizacion', ['monto' => '1']))->toThrow(HttpException::class);
});

it('records MAT cotizado, compras and manual rows per group, answering cell edits with a delta', function () {
    $document = gfSeed();
    $service = app(GastFinMatService::class);
    $cementoKey = 'materiales|cemento|bol';

    $delta = $service->setCotizacion($document, '01', $cementoKey, ['precio' => '30.65']);
    expect($delta['row']['cot'])->toMatchArray(['cantidad' => '89.0000', 'cantidad_source' => 'et', 'precio' => '30.6500', 'parcial' => '2727.85'])
        ->and($delta)->toHaveKeys(['revision', 'row', 'totales'])
        ->and($delta)->not->toHaveKey('mat');

    $service->addCompra($document, '01', '2026-04-24');
    $compra = GastFinMatCompra::query()->firstOrFail();
    $delta = $service->setCompraValor($document, $compra, $cementoKey, ['cantidad' => '50', 'precio' => '30.65', 'proveedor' => ' ANDES ']);
    expect($delta['row']['compras'][$compra->public_id])->toBe(['cantidad' => '50.0000', 'precio' => '30.6500', 'subtotal' => '1532.50', 'proveedor' => 'ANDES'])
        ->and($delta['row']['saldo'])->toBe('1255.68')
        ->and($delta['totales'])->toMatchArray(['et' => '3188.18', 'total_comprado' => '1532.50', 'saldo' => '1655.68', 'estado' => 'superavit']);

    $mat = $service->addManual($document, '01', 'CEMENTO CEMEX HE', 'bol')['mat'];
    $manual = collect($mat['rows'])->firstWhere('origen', 'manual');
    expect($manual['et'])->toBeNull()
        ->and(array_column($mat['rows'], 'descripcion'))->toBe(['Arena', 'Cemento', 'CEMENTO CEMEX HE']);

    $delta = $service->setCompraValor($document, $compra, $manual['key'], ['cantidad' => '386', 'precio' => '27.50']);
    expect($delta['totales'])->toMatchArray(['total_comprado' => '12147.50', 'estado' => 'deficit']);

    expect(fn () => $service->setCotizacion($document, '01', 'materiales|no existe|und', ['precio' => '1']))->toThrow(HttpException::class);
});

it('keeps purchases when the ACU material is renamed, as an orphan row without E.T.', function () {
    $document = gfSeed();
    $service = app(GastFinMatService::class);

    $service->addCompra($document, '02', null);
    $compra = GastFinMatCompra::query()->firstOrFail();
    $service->setCompraValor($document, $compra, 'materiales|cemento|bol', ['cantidad' => '40', 'precio' => '30']);

    // Re-guardar el ACU borra y reinserta sus líneas (ids nuevos) y aquí además renombra el insumo.
    DB::connection('costos_tenant')->table('presupuesto_acus')->where('partida', '02.01')
        ->update(['materiales' => json_encode([gfItem('Cemento Portland', 'bol', '8.5', '29.90')])]);

    $rows = collect(app(GastFinMatService::class)->payload($document, '02')['rows'])->keyBy('descripcion');
    expect($rows['Cemento']['origen'])->toBe('huerfano')
        ->and($rows['Cemento']['et'])->toBeNull()
        ->and($rows['Cemento']['total_comprado'])->toBe('1200.00')
        ->and($rows['Cemento Portland']['origen'])->toBe('expediente');

    $fresh = app(GastFinMatService::class); // el E.T. se memoiza por instancia (una petición)
    $fresh->deleteInsumo($document, GastFinMatInsumo::query()->where('insumo_key', 'materiales|cemento|bol')->firstOrFail());
    expect(collect($fresh->payload($document, '02')['rows'])->pluck('descripcion')->all())->toBe(['Cemento Portland']);
});

it('builds RESUMEN with live equipos and one desagregado line per level', function () {
    $document = gfSeed();
    app(GastFinDocumentService::class)->updateGrupo($document, '02', ['mat_aprobado' => '1500']);

    $resumen = app(GastFinResumenService::class)->payload($document);
    $general = collect($resumen['general']['rows'])->keyBy('componente');

    expect($general['materiales']['expediente'])->toBe('4459.72') // 3188.18 + 1270.75 + 0.79
        ->and($general['mano_obra']['expediente'])->toBe('672.50')
        ->and($general['equipos']['expediente'])->toBe('16.59')
        ->and($general['equipos']['editable']['expediente'])->toBeFalse();

    $lineas = collect($resumen['desagregado']['rows'])->where('tipo', 'grupo')->values();
    expect($lineas->where('campo', 'mat_aprobado')->pluck('grupo_ref')->all())->toBe(['01', '02', '_'])
        ->and($lineas->where('campo', 'mo_aprobado')->pluck('grupo_ref')->all())->toBe(['01', '02']);

    $segundo = $lineas->first(fn ($l) => $l['grupo_ref'] === '02' && $l['campo'] === 'mat_aprobado');
    expect($segundo)->toMatchArray(['aprobado_ideal' => '1500.00', 'proyectado_real' => '1270.75', 'deficit' => '229.25', 'ideal_manual' => true]);

    $rows = $resumen['desagregado']['rows'];
    $materiales = collect($rows)->search(fn ($r) => ($r['tipo'] ?? null) === 'linea' && $r['label'] === 'Materiales');
    expect($rows[$materiales + 1]['label'])->toBe('PRIMER NIVEL');
});

it('lists the ACU insumos of a level whose partidas have metrado 0, with zero consumption', function () {
    $document = gfSeed();
    // Caso real reportado: "2 Instalaciones Electricas > 2.1 > 2.1.1" con ACU pero metrado 0.
    gfPartida(40, '3', 'INSTALACIONES ELECTRICAS');
    gfPartida(41, '3.1', 'Titulo');
    gfPartida(42, '3.1.1', 'Salida', '0');
    gfAcu('03.01.01', [
        'mano_de_obra' => [gfItem('CAPATAZ', 'hh', '8', '27.54')],
        'materiales' => [gfItem('ABRAZADERA 4" ACERO GALVANIZADO', 'und', '1', '7.5')],
    ]);
    gfAcu('07.01', ['materiales' => [gfItem('Huérfano', 'und', '1', '1')]]); // ACU sin partida en el presupuesto

    $grupos = collect(app(GastFinDocumentService::class)->grupos($document))->keyBy('ref');
    expect($grupos['03'])->toMatchArray(['materiales' => 1, 'sin_metrado' => 1])
        ->and($grupos->has('_'))->toBeTrue(); // 9.1 sigue en SIN NIVEL; el ACU 07.01 huérfano no suma nada

    $mo = collect(app(GastFinMoService::class)->payload($document)['grupos'])->keyBy('ref');
    expect($mo['03']['rows'][0])->toMatchArray(['descripcion' => 'CAPATAZ', 'cantidad' => '0.0000', 'precio' => '27.5400', 'parcial' => '0.00'])
        ->and($mo['03']['sin_metrado'])->toBe(1);

    $mat = app(GastFinMatService::class)->payload($document, '03');
    expect($mat['rows'][0]['et'])->toBe(['cantidad' => '0.0000', 'precio' => '7.5000', 'parcial' => '0.00'])
        ->and($mat['sin_metrado'])->toBe(1);

    // Se puede registrar la compra aunque el E.T. sea 0.
    app(GastFinMatService::class)->addCompra($document, '03', null);
    $delta = app(GastFinMatService::class)->setCompraValor($document, GastFinMatCompra::query()->firstOrFail(), $mat['rows'][0]['key'], ['cantidad' => '10', 'precio' => '7.5']);
    expect($delta['totales'])->toMatchArray(['et' => '0.00', 'total_comprado' => '75.00', 'estado' => 'deficit']);
});

it('keeps MO payments and MAT purchases when Delphin re-saves the presupuesto with new ids', function () {
    $document = gfSeed();
    $mo = app(GastFinMoService::class);
    $mat = app(GastFinMatService::class);

    $mo->addPago($document, 'VAL 01', null);
    $mo->setValor($document, GastFinMoPago::query()->firstOrFail(), '01', 'valorizacion', ['monto' => '500']);
    $mat->addCompra($document, '01', null);
    $mat->setCompraValor($document, GastFinMatCompra::query()->firstOrFail(), 'materiales|cemento|bol', ['cantidad' => '10', 'precio' => '30']);
    app(GastFinDocumentService::class)->updateGrupo($document, '01', ['tipo' => 'piso', 'mat_aprobado' => '3000']);

    // Guardar el presupuesto en Delphin borra y reinserta todas las filas: mismos códigos, ids nuevos.
    $filas = DB::connection('costos_tenant')->table('presupuesto_general')->orderBy('id')->get();
    DB::connection('costos_tenant')->table('presupuesto_general')->delete();
    foreach ($filas as $fila) {
        DB::connection('costos_tenant')->table('presupuesto_general')->insert([...(array) $fila, 'id' => $fila->id + 1000]);
    }

    $grupo = collect(app(GastFinMoService::class)->payload($document)['grupos'])->firstWhere('ref', '01');
    expect($grupo['tipo'])->toBe('piso')
        ->and($grupo['totales']['valorizado'])->toBe('500.00');

    $cemento = collect(app(GastFinMatService::class)->payload($document, '01')['rows'])->firstWhere('descripcion', 'Cemento');
    expect($cemento['total_comprado'])->toBe('300.00')
        ->and($cemento['origen'])->toBe('expediente');
});

it('consolidates 5 000 partidas with 60 000 ACU lines in reasonable time', function () {
    $partidas = [];
    $acus = [];
    $id = 1;
    for ($root = 1; $root <= 10; $root++) {
        $partidas[] = ['id' => $id++, 'partida' => (string) $root, 'descripcion' => "NIVEL $root", 'metrado' => '0', 'parcial' => '0'];
        for ($i = 1; $i <= 500; $i++) {
            $code = "$root.".intdiv($i, 50).'.'.$i;
            $partidas[] = ['id' => $id++, 'partida' => $code, 'descripcion' => "Partida $code", 'metrado' => (string) ($i % 37 + 1), 'parcial' => '0'];
            $materiales = [];
            for ($m = 0; $m < 8; $m++) {
                $materiales[] = gfItem('Material '.(($i * 7 + $m) % 300), 'und', '1.25', '12.3456', ['factor_desperdicio' => '1.05']);
            }
            $acus[] = [
                'partida' => $code,
                'mano_de_obra' => [gfItem('OPERARIO', 'hh', '0.8', '31.44'), gfItem('OFICIAL', 'hh', '0.4', '23.93'), gfItem('PEON', 'hh', '1.6', '21.66')],
                'materiales' => $materiales,
                'equipos' => [['descripcion' => 'Herramientas', 'unidad' => '%mo', 'cantidad' => '3', 'precio_hora' => '70']],
            ];
        }
    }

    $start = hrtime(true);
    $result = app(InsumoConsolidator::class)->consolidate($partidas, $acus);
    $seconds = (hrtime(true) - $start) / 1e9;

    expect($result['grupos'])->toHaveCount(10)
        ->and($result['insumos']['01']['materiales'])->toHaveCount(300)
        ->and($seconds)->toBeLessThan(10.0);

    fwrite(STDERR, sprintf("\n[GastFin] consolidación 5000 partidas / 60000 líneas: %.2f s\n", $seconds));
});
