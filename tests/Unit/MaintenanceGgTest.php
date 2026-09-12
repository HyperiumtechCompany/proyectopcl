<?php

use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceGgLinea;
use App\Models\Mantenimiento\MaintenanceGgPago;
use App\Services\Mantenimiento\MaintenanceGgService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
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

function ggDoc(): MaintenanceDocument
{
    return MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Doc', 'moneda' => 'PEN']);
}

it('groups líneas by grupo and rubro, rolling up gasto E.T. and pagos', function () {
    $document = ggDoc();
    $gg = app(MaintenanceGgService::class);
    $scenarios = app(MaintenanceScenarioService::class);

    $gg->addLinea($document, ['grupo' => 'fijo', 'rubro' => 'Fianzas: Contratación', 'descripcion' => 'Fianza fiel cumplimiento', 'cantidad' => '2', 'costo_unitario' => '100']);
    $result = $gg->addLinea($document->refresh(), ['grupo' => 'fijo', 'rubro' => 'Fianzas: Contratación', 'descripcion' => 'Fianza adelanto', 'cantidad' => '1', 'costo_unitario' => '50']);

    $rows = $result['gg']['rows'];
    expect(collect($rows)->pluck('tipo')->all())->toBe(['grupo', 'rubro', 'linea', 'linea', 'grupo']);

    $rubro = collect($rows)->firstWhere('tipo', 'rubro');
    expect($rubro['gasto_et'])->toBe('250.00')
        ->and($rubro['gasto_proyectado'])->toBe('250.00')
        ->and($rubro['item'])->toBe('01.01.00'); // 1er rubro del grupo fijo (orden 01)

    $grupoFijo = collect($rows)->firstWhere(fn ($r) => $r['tipo'] === 'grupo' && $r['grupo'] === 'fijo');
    expect($grupoFijo['gasto_et'])->toBe('250.00')
        ->and($grupoFijo['item'])->toBe('01)');

    $linea = MaintenanceGgLinea::query()->where('descripcion', 'Fianza fiel cumplimiento')->firstOrFail();
    $scenario = $scenarios->activeFor($document->refresh(), 'gg');
    $pagoResult = $gg->addPago($document->refresh(), $scenario, '2026-09-11', 'T1');
    $pagoId = $pagoResult['gg']['pagos'][0]['id'];
    $pago = MaintenanceGgPago::query()->where('public_id', $pagoId)->firstOrFail();

    $paid = $gg->setPagoValor($document->refresh(), $pago, $linea, '120');
    $lineaRow = collect($paid['gg']['rows'])->firstWhere('linea_id', $linea->public_id);

    expect($lineaRow['total_pagado'])->toBe('120.00')
        ->and($lineaRow['saldo'])->toBe('80.00') // 200 proyectado (auto = E.T.) - 120 pagado
        ->and($lineaRow['descuadra'])->toBeFalse()
        ->and($lineaRow['por_pago'][$pagoId])->toBe('120.00');

    $otraLineaRow = collect($paid['gg']['rows'])->first(fn ($r) => ($r['tipo'] ?? null) === 'linea' && $r['linea_id'] !== $linea->public_id);
    expect($otraLineaRow['por_pago'][$pagoId])->toBeNull(); // celda sin pago = en blanco, no "0.00"
});

it('lets gasto_proyectado be overridden manually and reverts to E.T. when cleared', function () {
    $document = ggDoc();
    $gg = app(MaintenanceGgService::class);

    $gg->addLinea($document, ['grupo' => 'variable', 'rubro' => 'Personal', 'descripcion' => 'Residente', 'cantidad' => '1', 'costo_unitario' => '2500']);
    $linea = MaintenanceGgLinea::query()->where('descripcion', 'Residente')->firstOrFail();

    $manual = $gg->updateLinea($document->refresh(), $linea, ['gasto_proyectado' => '3000']);
    $row = collect($manual['gg']['rows'])->firstWhere('linea_id', $linea->public_id);
    expect($row['gasto_proyectado'])->toBe('3000')
        ->and($row['gasto_proyectado_manual'])->toBeTrue();

    $cleared = $gg->updateLinea($document->refresh(), $linea->refresh(), ['gasto_proyectado' => null]);
    $row = collect($cleared['gg']['rows'])->firstWhere('linea_id', $linea->public_id);
    expect($row['gasto_proyectado'])->toBe('2500') // vuelve a = gasto E.T.
        ->and($row['gasto_proyectado_manual'])->toBeFalse();
});

it('seeds the standard plantilla only when there are no líneas yet', function () {
    $document = ggDoc();
    $gg = app(MaintenanceGgService::class);

    $seeded = $gg->seedPlantilla($document);
    $rubroRows = collect($seeded['gg']['rows'])->where('tipo', 'rubro');
    expect($rubroRows->pluck('rubro'))->toContain('Fianzas: Contratación', 'Seguros: Contratación', 'Gastos de Administración en Obra')
        ->and(MaintenanceGgLinea::query()->count())->toBeGreaterThan(10)
        ->and($rubroRows->firstWhere('rubro', 'Fianzas: Contratación')['item'])->toBe('01.01.00')
        ->and($rubroRows->firstWhere('rubro', 'Seguros: Contratación')['item'])->toBe('01.02.00')
        ->and($rubroRows->firstWhere('rubro', 'Gastos de Administración en Obra')['item'])->toBe('02.01.00');

    $countAfterFirstSeed = MaintenanceGgLinea::query()->count();
    $gg->seedPlantilla($document->refresh()); // segunda llamada no debe duplicar
    expect(MaintenanceGgLinea::query()->count())->toBe($countAfterFirstSeed);
});

it('renames a rubro across all its líneas and deletes it in bulk', function () {
    $document = ggDoc();
    $gg = app(MaintenanceGgService::class);

    $gg->addLinea($document, ['grupo' => 'fijo', 'rubro' => 'Seguros', 'descripcion' => 'CAR', 'cantidad' => '1', 'costo_unitario' => '500']);
    $gg->addLinea($document->refresh(), ['grupo' => 'fijo', 'rubro' => 'Seguros', 'descripcion' => 'SCTR', 'cantidad' => '1', 'costo_unitario' => '300']);

    $renamed = $gg->renameRubro($document->refresh(), 'fijo', 'Seguros', 'Seguros: Contratación');
    $rubros = collect($renamed['gg']['rows'])->where('tipo', 'rubro')->pluck('rubro')->all();
    expect($rubros)->toBe(['Seguros: Contratación']);

    $deleted = $gg->deleteRubro($document->refresh(), 'fijo', 'Seguros: Contratación');
    expect(collect($deleted['gg']['rows'])->where('tipo', 'linea'))->toHaveCount(0)
        ->and(MaintenanceGgLinea::query()->count())->toBe(0);
});
