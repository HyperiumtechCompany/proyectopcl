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
            'materiales' => json_encode([
                [
                    'descripcion' => 'CEMENTO PORTLAND',
                    'unidad' => 'bol',
                    'cantidad' => 2,
                    'precio_unitario' => 5,
                    'factor_desperdicio' => 1.1,
                    'parcial' => 11,
                ],
                [
                    'descripcion' => 'PRECISION A',
                    'unidad' => 'und',
                    'cantidad' => 1,
                    'precio_unitario' => 0.0005,
                    'parcial' => 0.0005,
                ],
                [
                    'descripcion' => 'PRECISION B',
                    'unidad' => 'und',
                    'cantidad' => 1,
                    'precio_unitario' => 0.0005,
                    'parcial' => 0.0005,
                ],
            ]),
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
        $connection->table('presupuesto_general')->insert([
            'presupuesto_id' => $presupuestoId,
            'partida' => '02.01',
            'descripcion' => 'Partida aún no programada',
            'unidad' => 'und',
            'metrado' => 2,
            'precio_unitario' => 12,
            'item_order' => 2,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $connection->table('presupuesto_acus')->insert([
            'presupuesto_id' => $presupuestoId,
            'partida' => '02.01',
            'descripcion' => 'Partida aún no programada',
            'unidad' => 'und',
            'rendimiento' => 1,
            'materiales' => json_encode([[
                'descripcion' => 'CLAVOS',
                'unidad' => 'kg',
                'cantidad' => 3,
                'precio_unitario' => 4,
                'parcial' => 12,
            ]]),
            'item_order' => 2,
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
            ->and($materials['CLAVOS']['costo_total'])->toBe(24)
            ->and($materials['CLAVOS']['distribucion']['2026-01']['monto'])->toBe(24)
            ->and($materials['PRECISION A']['costo_total'])->toBe(0.005)
            ->and($materials['PRECISION B']['costo_total'])->toBe(0.005)
            ->and(array_sum(array_column($materials['CEMENTO PORTLAND']['distribucion'], 'monto')))->toBe(110.0)
            ->and(array_sum(array_column($materials['CAMION VOLQUETE']['distribucion'], 'monto')))->toBe(200.0)
            ->and($response->json('resumen.presupuesto_total'))->toBe(349.01);

        $this->actingAs($user)
            ->get("/module/crono_valorizado?project={$project->id}")
            ->assertSuccessful()
            ->assertInertia(fn (Assert $page) => $page
                ->component('costos/cronogramas/valorizado/CronogramaValorizado')
                ->where('materialesResumen.presupuesto_total', 349.01)
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

it('cronograma v2 save: preserves refId and remaps new-row references', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(1);

    try {
        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $presupuestoId = DB::connection('costos_tenant')->table('presupuestos')->value('id');

        $existingId = DB::connection('costos_tenant')->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)->value('id');

        // Payload: la fila existente + 2 nuevas (client_id negativo). La fila -2
        // depende de la -1 mediante refId negativo → el backend debe re-mapearlo.
        $payload = [
            'tasks' => [
                ['client_id' => $existingId, 'id' => $existingId, 'item_order' => 1, 'partida' => '01.01', 'descripcion' => 'A', 'duracion_dias' => 2, 'fecha_inicio' => '2026-01-01', 'fecha_fin' => '2026-01-02', 'nivel' => 1, 'parent_id' => null, 'predecesoras' => []],
                ['client_id' => -1, 'id' => -1, 'item_order' => 2, 'partida' => '01.02', 'descripcion' => 'B', 'duracion_dias' => 2, 'fecha_inicio' => '2026-01-03', 'fecha_fin' => '2026-01-04', 'nivel' => 1, 'parent_id' => null, 'predecesoras' => []],
                ['client_id' => -2, 'id' => -2, 'item_order' => 3, 'partida' => '01.03', 'descripcion' => 'C', 'duracion_dias' => 2, 'fecha_inicio' => '2026-01-05', 'fecha_fin' => '2026-01-06', 'nivel' => 1, 'parent_id' => null, 'predecesoras' => [
                    ['source' => 2, 'target' => -2, 'type' => '0', 'lag' => 0, 'refId' => -1, 'ref' => ['codigo' => '01.02', 'desc' => 'B']],
                ]],
            ],
        ];

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson("/cronograma/v2/{$project->id}/save", $payload)
            ->assertSuccessful()
            ->assertJsonPath('status', 'success');

        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $rowB = DB::connection('costos_tenant')->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)->where('partida', '01.02')->first();
        $rowC = DB::connection('costos_tenant')->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)->where('partida', '01.03')->first();

        $links = json_decode($rowC->predecesoras, true);

        expect($links)->toHaveCount(1)
            ->and($links[0]['refId'])->toBe((int) $rowB->id)  // re-mapeado al id real
            ->and($links[0]['ref']['codigo'])->toBe('01.02')
            ->and($links[0]['target'])->toBe((int) $rowC->id);
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('cronograma v2 save: absent rows survive, only deleted_ids are removed (A3)', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(1);

    try {
        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $presupuestoId = DB::connection('costos_tenant')->table('presupuestos')->value('id');

        // 3 filas extra: 01.02 (se mantiene y se edita), 01.03 (ausente del payload → sobrevive),
        // 01.04 (en deleted_ids → se borra)
        foreach (['01.02' => 'B', '01.03' => 'C', '01.04' => 'D'] as $partida => $desc) {
            DB::connection('costos_tenant')->table('cronograma_general')->insert([
                'presupuesto_id' => $presupuestoId, 'item_order' => 2, 'partida' => $partida,
                'descripcion' => $desc, 'duracion_dias' => 1, 'nivel' => 1,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $ids = DB::connection('costos_tenant')->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)->pluck('id', 'partida');

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson("/cronograma/v2/{$project->id}/save", [
                'deleted_ids' => [$ids['01.04']],
                'tasks' => [
                    ['client_id' => $ids['01.01'], 'id' => $ids['01.01'], 'item_order' => 1, 'partida' => '01.01', 'descripcion' => 'A', 'duracion_dias' => 1, 'nivel' => 1, 'predecesoras' => []],
                    ['client_id' => $ids['01.02'], 'id' => $ids['01.02'], 'item_order' => 2, 'partida' => '01.02', 'descripcion' => 'B editada', 'duracion_dias' => 5, 'nivel' => 1, 'predecesoras' => []],
                ],
            ])
            ->assertSuccessful();

        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $rows = DB::connection('costos_tenant')->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)->pluck('descripcion', 'partida');

        expect($rows)->toHaveKey('01.03')                 // ausente del payload → sobrevive
            ->and($rows)->not->toHaveKey('01.04')          // en deleted_ids → borrada
            ->and($rows['01.02'])->toBe('B editada');      // editada por upsert
    } finally {
        dropCronoValorizadoTenant($dbName);
    }
});

it('cronograma v2 save: guardrail blocks a suspicious shrink', function () {
    [$user, $project, $dbName] = createCronoValorizadoTenant(1);

    try {
        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $presupuestoId = DB::connection('costos_tenant')->table('presupuestos')->value('id');

        $rows = [];
        for ($i = 2; $i <= 21; $i++) {
            $rows[] = [
                'presupuesto_id' => $presupuestoId, 'item_order' => $i,
                'partida' => sprintf('01.%02d', $i), 'descripcion' => "P{$i}",
                'duracion_dias' => 1, 'nivel' => 1, 'created_at' => now(), 'updated_at' => now(),
            ];
        }
        DB::connection('costos_tenant')->table('cronograma_general')->insert($rows); // 21 filas totales

        // Payload que solo reconoce 2 de 21 filas (sin deleted_ids) → debe abortar
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson("/cronograma/v2/{$project->id}/save", [
                'tasks' => [
                    ['client_id' => 1, 'id' => 1, 'item_order' => 1, 'partida' => '01.01', 'descripcion' => 'A', 'duracion_dias' => 1, 'nivel' => 1, 'predecesoras' => []],
                    ['client_id' => 2, 'id' => 2, 'item_order' => 2, 'partida' => '01.02', 'descripcion' => 'B', 'duracion_dias' => 1, 'nivel' => 1, 'predecesoras' => []],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'suspicious_shrink');

        // El cronograma no se tocó
        expect(DB::connection('costos_tenant')->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)->count())->toBe(21);

        // Con force=true sí pasa
        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->withHeader('X-CSRF-TOKEN', 'test-token')
            ->postJson("/cronograma/v2/{$project->id}/save", [
                'force' => true,
                'tasks' => [
                    ['client_id' => 1, 'id' => 1, 'item_order' => 1, 'partida' => '01.01', 'descripcion' => 'A', 'duracion_dias' => 1, 'nivel' => 1, 'predecesoras' => []],
                ],
            ])
            ->assertSuccessful();
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
