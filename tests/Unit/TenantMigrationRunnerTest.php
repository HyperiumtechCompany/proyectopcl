<?php

use App\Services\CostoDatabaseService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

uses(TestCase::class);

it('ejecuta las migraciones pendientes en la base del proyecto', function () {
    $service = Mockery::mock(CostoDatabaseService::class)->makePartial();
    $service->shouldReceive('setTenantConnection')->once()->with('tenant_antiguo');

    $connection = Mockery::mock();
    $connection->shouldReceive('getPdo')->once()->andReturn(new stdClass);
    DB::shouldReceive('connection')->once()->with('costos_tenant')->andReturn($connection);
    Artisan::shouldReceive('call')->once()->with('migrate', [
        '--database' => 'costos_tenant',
        '--path' => 'database/migrations/costos_tenant',
        '--force' => true,
    ])->andReturn(0);
    Artisan::shouldReceive('output')->once()->andReturn('Migraciones completadas');
    Log::shouldReceive('info')->once();

    $service->runTenantMigrations('tenant_antiguo');
});

it('informa el fallo cuando Artisan devuelve un codigo distinto de cero', function () {
    $service = Mockery::mock(CostoDatabaseService::class)->makePartial();
    $service->shouldReceive('setTenantConnection')->once()->with('tenant_antiguo');

    $connection = Mockery::mock();
    $connection->shouldReceive('getPdo')->once()->andReturn(new stdClass);
    DB::shouldReceive('connection')->once()->with('costos_tenant')->andReturn($connection);
    Artisan::shouldReceive('call')->once()->andReturn(1);
    Artisan::shouldReceive('output')->once()->andReturn('Error de migracion');
    Log::shouldReceive('error')->once();

    expect(fn () => $service->runTenantMigrations('tenant_antiguo'))
        ->toThrow(RuntimeException::class, 'No se pudieron aplicar las migraciones del proyecto');
});
