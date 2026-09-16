<?php

use App\Models\CostoProject;
use App\Services\AvanceObraCalculoService;
use App\Services\FinancieroContratoService;
use App\Services\PagosValorizacionService;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class);

it('nunca convierte el avance valorizado en un pago no informado', function () {
    $project = new CostoProject;
    $avance = Mockery::mock(AvanceObraCalculoService::class);
    $financiero = Mockery::mock(FinancieroContratoService::class);
    $avance->shouldReceive('calcular')->once()->andReturn([
        'filas' => [
            ['key' => '2026-06', 'periodoCal' => 'Jun 2026', 'ejecutadoMensual' => 100],
            ['key' => '2026-07', 'periodoCal' => 'Jul 2026', 'ejecutadoMensual' => 200],
        ],
        'sinProgramado' => false,
        'sinEjecutado' => false,
    ]);
    $financiero->shouldReceive('porcentajes')->once()->andReturn([]);
    $financiero->shouldReceive('aplicarCascada')->twice()->andReturn(
        ['montoTotal' => 118.0],
        ['montoTotal' => 236.0],
    );

    $query = Mockery::mock();
    $query->shouldReceive('where')->once()->with('presupuesto_id', 5)->andReturnSelf();
    $query->shouldReceive('get')->once()->andReturn(collect([
        (object) ['periodo_key' => '2026-07', 'reajuste' => '5.00', 'penalidades' => '0.00', 'monto_pagado' => '90.00', 'fecha_pago' => '2026-08-10'],
    ]));
    $connection = Mockery::mock();
    $connection->shouldReceive('table')->once()->with('pagos_valorizacion')->andReturn($query);
    DB::shouldReceive('connection')->once()->with('costos_tenant')->andReturn($connection);

    $resultado = (new PagosValorizacionService($avance, $financiero))->calcular($project, 5, 'calendario');

    expect($resultado['filas'][0]['montoPagado'])->toBeNull()
        ->and($resultado['filas'][0]['acumuladoPagado'])->toBeNull()
        ->and($resultado['filas'][1]['montoPagado'])->toBe(90.0)
        ->and($resultado['totalValorizado'])->toBe(354.0)
        ->and($resultado['totalPagado'])->toBe(90.0);
});
