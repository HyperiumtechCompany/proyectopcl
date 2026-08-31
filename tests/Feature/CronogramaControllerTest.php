<?php

use App\Models\CostoProject;
use App\Models\User;
use App\Services\CostoDatabaseService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

it('loads the general cronograma from the tenant database', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(1);

    try {
        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->update(['descripcion' => 'Inicio']);

        $this->actingAs($user)
            ->get("/module/crono_general?project={$project->id}")
            ->assertSuccessful()
            ->assertInertia(fn (Assert $page) => $page
                ->component('costos/cronogramas/general/CronogramaIndex')
                ->where('project', (string) $project->id)
                ->where('initialData.tasks.0.text', 'Inicio')
            );
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('stores the cronograma payload sent by the frontend', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(1);

    try {
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson("/cronograma/save/{$project->id}", [
                'tasks' => [
                    [
                        'id' => '1',
                        'text' => 'Inicio',
                        'item' => '01.01',
                        'start_date' => '2026-01-01',
                        'end_date' => '2026-01-31',
                        'duration' => 31,
                    ],
                ],
                'links' => [],
            ])
            ->assertSuccessful()
            ->assertJsonPath('status', 'success');

        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $stored = DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('partida', '01.01')
            ->first();

        expect($stored)->not->toBeNull()
            ->and($stored->descripcion)->toBe('Inicio');
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('registers valorizado and materiales persistence routes used by the frontend', function () {
    expect(Route::has('proyectos.cronograma.materiales.save'))->toBeTrue()
        ->and(Route::has('proyectos.cronograma.materiales.destroy'))->toBeTrue()
        ->and(Route::has('proyectos.cronograma.valorizado.save'))->toBeTrue()
        ->and(Route::has('proyectos.cronograma.valorizado.destroy'))->toBeTrue();
});

it('reconciles ACU resource totals across materiales and valorizado', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(3);

    try {
        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $connection = DB::connection('costos_tenant');
        $presupuestoId = (int) $connection->table('presupuestos')->value('id');
        $now = now();

        $connection->table('presupuesto_general')->insert([
            'presupuesto_id' => $presupuestoId,
            'partida' => '01.01',
            'descripcion' => 'Partida con recursos',
            'unidad' => 'und',
            'metrado' => 10,
            'precio_unitario' => 31,
            'item_order' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $connection->table('presupuesto_acus')->insert([
            'presupuesto_id' => $presupuestoId,
            'partida' => '1.1',
            'descripcion' => 'Partida con recursos',
            'unidad' => 'und',
            'rendimiento' => 1,
            'materiales' => json_encode([[
                'descripcion' => 'CEMENTO PORTLAND',
                'unidad' => 'bol',
                'cantidad' => 2,
                'precio_unitario' => 5,
                'factor_desperdicio' => 1.1,
                'parcial' => 11,
            ]]),
            'equipos' => json_encode([
                [
                    'descripcion' => 'CAMION VOLQUETE',
                    'unidad' => 'hm',
                    'cantidad' => 1,
                    'precio_hora' => 20,
                    'parcial' => 20,
                ],
                [
                    'descripcion' => 'HERRAMIENTAS MANUALES',
                    'unidad' => '%mo',
                    'cantidad' => 3,
                    'precio_hora' => 50,
                    'parcial' => 1.5,
                ],
            ]),
            'item_order' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/module/crono_materiales/data?project={$project->id}")
            ->assertSuccessful();

        $materials = collect($response->json('materiales'))->keyBy('descripcion');

        expect($materials['CAMION VOLQUETE']['tipo'])->toBe('equipos')
            ->and($materials['CAMION VOLQUETE']['costo_total'])->toBe(200)
            ->and($materials['CEMENTO PORTLAND']['tipo'])->toBe('materiales')
            ->and($materials['CEMENTO PORTLAND']['costo_total'])->toBe(110)
            ->and($materials['HERRAMIENTAS MANUALES']['cantidad_total'])->toBe(15)
            ->and($materials['HERRAMIENTAS MANUALES']['precio'])->toBe(0)
            ->and($materials['HERRAMIENTAS MANUALES']['costo_total'])->toBe(15)
            ->and(array_sum(array_column($materials['CEMENTO PORTLAND']['distribucion'], 'monto')))->toBe(110.0)
            ->and(array_sum(array_column($materials['CAMION VOLQUETE']['distribucion'], 'monto')))->toBe(200.0)
            ->and($response->json('resumen.presupuesto_total'))->toBe(325);

        $this->actingAs($user)
            ->get("/module/crono_valorizado?project={$project->id}")
            ->assertSuccessful()
            ->assertInertia(fn (Assert $page) => $page
                ->component('costos/cronogramas/valorizado/CronogramaValorizado')
                ->where('materiales.0.costo_total', 110)
                ->where('materiales.1.costo_total', 200)
                ->where('materiales.2.costo_total', 15)
                ->where('materialesResumen.presupuesto_total', 325)
            );
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('stores valorizado distributions for 3 dynamic months', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(3);

    try {
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson('/module/crono_valorizado/save', [
                'project_id' => $project->id,
                'items' => [
                    valorizadoItemPayload([
                        '2026-01' => 100,
                        '2026-02' => 200,
                        '2026-03' => 300,
                    ]),
                ],
            ])
            ->assertSuccessful()
            ->assertJsonPath('status', 'success');

        $stored = storedValorizadoDistribution($dbName);

        expect(array_keys($stored))->toBe(['2026-01', '2026-02', '2026-03'])
            ->and((float) $stored['2026-02']['monto'])->toBe(200.0)
            ->and($stored['2026-02']['porcentaje'])->toBe(33.333333);
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('stores valorizado distributions for 15 dynamic months', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(15);

    try {
        $distribution = [];
        for ($month = 1; $month <= 15; $month++) {
            $distribution[sprintf('2026-%02d', $month)] = 10;
        }

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson('/module/crono_valorizado/save', [
                'project_id' => $project->id,
                'items' => [valorizadoItemPayload($distribution, 150)],
            ])
            ->assertSuccessful();

        expect(storedValorizadoDistribution($dbName))->toHaveCount(15);
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('removes obsolete valorizado months when gantt duration shrinks', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(15);

    try {
        $distribution = [];
        for ($month = 1; $month <= 15; $month++) {
            $distribution[sprintf('2026-%02d', $month)] = 10;
        }

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson('/module/crono_valorizado/save', [
                'project_id' => $project->id,
                'items' => [valorizadoItemPayload($distribution, 150)],
            ])
            ->assertSuccessful();

        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->update(['fecha_fin' => '2026-03-31']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson('/module/crono_valorizado/save', [
                'project_id' => $project->id,
                'items' => [valorizadoItemPayload($distribution, 150)],
            ])
            ->assertSuccessful();

        expect(array_keys(storedValorizadoDistribution($dbName)))->toBe(['2026-01', '2026-02', '2026-03']);
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('rejects valorizado save when gantt exceeds 30 periods', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(31);

    try {
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson('/module/crono_valorizado/save', [
                'project_id' => $project->id,
                'items' => [
                    valorizadoItemPayload([
                        '2026-01' => 100,
                    ]),
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'El cronograma valorizado admite como máximo 30 periodos.');
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

function createCronoValorizadoTenant(int $months): array
{
    if (config('database.default') !== 'mysql') {
        test()->markTestSkipped('This test requires MySQL database connection');
    }

    $dbName = 'costos_test_crono_'.str_replace('.', '_', uniqid('', true));
    $service = app(CostoDatabaseService::class);

    DB::connection('mysql')->statement(
        "CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );

    $service->runTenantMigrations($dbName);

    $user = User::factory()->create();
    $project = CostoProject::factory()->create([
        'user_id' => $user->id,
        'database_name' => $dbName,
    ]);

    $presupuestoId = $service->createDefaultPresupuesto($dbName, 'Test cronograma valorizado');
    $start = Carbon::create(2026, 1, 1);
    $end = $start->copy()->addMonthsNoOverflow($months - 1)->endOfMonth();

    DB::connection('costos_tenant')
        ->table('cronograma_general')
        ->insert([
            'presupuesto_id' => $presupuestoId,
            'item_order' => 1,
            'partida' => '01.01',
            'descripcion' => 'Partida valorizada',
            'fecha_inicio' => $start->toDateString(),
            'fecha_fin' => $end->toDateString(),
            'duracion_dias' => $start->diffInDays($end) + 1,
            'nivel' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

    return [$user, $project, $dbName];
}

function valorizadoItemPayload(array $monthlyAmounts, float $parcial = 600): array
{
    $distribucion = [];

    foreach ($monthlyAmounts as $key => $monto) {
        $distribucion[$key] = [
            'monto' => $monto,
            'porcentaje' => 999,
        ];
    }

    return [
        'item' => '01.01',
        'descripcion' => 'Partida valorizada',
        'parcial' => $parcial,
        'distribucion' => $distribucion,
        'parent_id' => null,
    ];
}

function storedValorizadoDistribution(string $dbName): array
{
    app(CostoDatabaseService::class)->setTenantConnection($dbName);

    $json = DB::connection('costos_tenant')
        ->table('cronograma_valorizado')
        ->where('partida', '01.01')
        ->value('distribucion_mensual');

    return json_decode($json, true) ?? [];
}

function dropCronoValorizadoTenant(string $dbName): void
{
    if (config('database.default') === 'mysql') {
        DB::connection('mysql')->statement("DROP DATABASE IF EXISTS `{$dbName}`");
    }
}
