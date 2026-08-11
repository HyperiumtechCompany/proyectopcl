<?php

use App\Models\Dialux\DialuxConductor;
use App\Models\Dialux\DialuxElectricalProject;
use App\Models\Dialux\DialuxNormativeRequirement;
use App\Models\Dialux\DialuxOutletRule;
use App\Models\Dialux\DialuxOutletType;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('the outlet catalog exposes the required mounting heights', function () {
    Artisan::call('db:seed', ['--class' => 'DialuxElectricalCatalogSeeder']);

    expect(DialuxOutletType::query()->whereNull('user_id')->where('code', 'bajo')->value('height_m'))->toEqual(0.4)
        ->and(DialuxOutletType::query()->whereNull('user_id')->where('code', 'inicial')->value('height_m'))->toEqual(1.5)
        ->and(DialuxOutletType::query()->whereNull('user_id')->where('code', 'alto')->value('height_m'))->toEqual(1.2)
        ->and(DialuxOutletType::query()->whereNull('user_id')->where('code', 'alto_180')->value('height_m'))->toEqual(1.8)
        ->and(DialuxOutletType::query()->whereNull('user_id')->where('code', 'comunicaciones')->value('height_m'))->toEqual(2.0)
        ->and(DialuxOutletType::query()->whereNull('user_id')->where('code', 'piso')->value('height_m'))->toEqual(0.0);
});

test('the electrical workspace renders with catalogs and normative requirements', function () {
    Artisan::call('db:seed', ['--class' => 'DialuxElectricalCatalogSeeder']);
    Artisan::call('db:seed', ['--class' => 'DialuxNormativeRequirementsSeeder']);

    $user = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create(['user_id' => $user->id]);

    $response = $this->actingAs($user)->get(route('dialux.electrical.workspace', $project));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('dialux/electrical/Show')
        ->where('project.id', (string) $project->id)
        ->where('electrical', null)
        ->has('catalogs.outletRules', 12)
        ->has('catalogs.outletTypes', 9)
        ->has('catalogs.conductors', 11)
        ->has('catalogs.circuitDefaults', 12)
        ->has('normativeRequirements', 295));
});

test('the electrical workspace is forbidden for another users project', function () {
    $owner = User::factory()->create(['plan' => 'mensual']);
    $intruder = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create(['user_id' => $owner->id]);

    $this->actingAs($intruder)
        ->get(route('dialux.electrical.workspace', $project))
        ->assertForbidden();
});

test('the electrical document can be saved and reloaded per project and user', function () {
    $user = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create(['user_id' => $user->id]);

    $document = [
        'version' => 1,
        'settings' => ['voltageV' => 220, 'phases' => 1, 'frequencyHz' => 60, 'powerFactor' => 0.9],
        'rooms' => [['id' => 'room-1', 'name' => 'Aula 101']],
    ];

    $saveResponse = $this->actingAs($user)->postJson(route('dialux.electrical.store'), [
        'dialux_project_id' => (string) $project->id,
        'voltage_v' => 220,
        'phases' => 1,
        'data' => $document,
        'total_rooms' => 1,
        'total_luminaires' => 8,
        'installed_power_w' => 288.5,
    ]);

    $saveResponse->assertCreated();

    // Segundo guardado: actualiza el mismo registro (upsert).
    $this->actingAs($user)->postJson(route('dialux.electrical.store'), [
        'dialux_project_id' => (string) $project->id,
        'data' => $document,
        'total_rooms' => 2,
    ])->assertOk();

    expect(DialuxElectricalProject::count())->toBe(1);

    $showResponse = $this->actingAs($user)->getJson(route('dialux.electrical.show', ['dialuxProjectId' => (string) $project->id]));
    $showResponse->assertOk();
    $showResponse->assertJsonPath('exists', true);
    $showResponse->assertJsonPath('data.total_rooms', 2);
    $showResponse->assertJsonPath('data.data.rooms.0.name', 'Aula 101');

    // Otro usuario no ve el documento del dueño.
    $other = User::factory()->create(['plan' => 'mensual']);
    $this->actingAs($other)
        ->getJson(route('dialux.electrical.show', ['dialuxProjectId' => (string) $project->id]))
        ->assertOk()
        ->assertJsonPath('exists', false);
});

test('the electrical store validates phases and frequency', function () {
    $user = User::factory()->create(['plan' => 'mensual']);

    $this->actingAs($user)->postJson(route('dialux.electrical.store'), [
        'dialux_project_id' => 'p-1',
        'phases' => 2,
        'frequency_hz' => 55,
    ])->assertStatus(422)->assertJsonValidationErrors(['phases', 'frequency_hz']);
});

test('a user can override a system outlet rule without touching the default', function () {
    Artisan::call('db:seed', ['--class' => 'DialuxElectricalCatalogSeeder']);

    $user = User::factory()->create(['plan' => 'mensual']);

    $response = $this->actingAs($user)->postJson(route('dialux.electrical.catalog.outlet-rules.store'), [
        'room_type' => 'aula',
        'method' => 'area',
        'value' => 8,
        'unit' => 'm2_per_point',
        'power_per_outlet_va' => 200,
    ]);

    $response->assertCreated();

    $systemRule = DialuxOutletRule::query()->whereNull('user_id')->where('room_type', 'aula')->first();
    $userRule = DialuxOutletRule::query()->where('user_id', $user->id)->where('room_type', 'aula')->first();

    expect($systemRule->value)->toEqual(10.0)
        ->and($userRule->value)->toEqual(8.0);

    // Repetir el guardado actualiza el mismo override (no duplica).
    $this->actingAs($user)->postJson(route('dialux.electrical.catalog.outlet-rules.store'), [
        'room_type' => 'aula',
        'method' => 'area',
        'value' => 12,
        'unit' => 'm2_per_point',
    ])->assertOk();

    expect(DialuxOutletRule::query()->where('user_id', $user->id)->where('room_type', 'aula')->count())->toBe(1);

    // Eliminar el override no puede tocar la regla del sistema.
    $this->actingAs($user)
        ->deleteJson(route('dialux.electrical.catalog.outlet-rules.destroy', ['id' => $systemRule->id]))
        ->assertOk();

    expect(DialuxOutletRule::query()->whereNull('user_id')->where('room_type', 'aula')->exists())->toBeTrue();
});

test('a user can register a custom conductor with real mm2 section', function () {
    $user = User::factory()->create(['plan' => 'mensual']);

    $this->actingAs($user)->postJson(route('dialux.electrical.catalog.conductors.store'), [
        'material' => 'cobre',
        'section_mm2' => 150,
        'awg_ref' => '300 MCM',
        'insulation' => 'THW-90',
        'ampacity_a' => 250,
        'price_per_meter' => 68.5,
    ])->assertCreated();

    expect(DialuxConductor::query()->where('user_id', $user->id)->where('section_mm2', 150)->exists())->toBeTrue();
});

test('the normative requirements endpoint serves the full EM.010 catalog', function () {
    Artisan::call('db:seed', ['--class' => 'DialuxNormativeRequirementsSeeder']);

    $user = User::factory()->create(['plan' => 'mensual']);

    $response = $this->actingAs($user)->getJson(route('dialux.normative-config.requirements'));

    $response->assertOk();
    $response->assertJsonPath('standard', 'rne_peru');
    $response->assertJsonPath('count', 295);

    expect(DialuxNormativeRequirement::query()->whereNull('em_lux')->count())->toBe(7);
});

// ─── Puente TD/TG (Fase D): materializar tomacorrientes / ubicar tableros ────

test('materialize outlets draws the circuit calculated quantity on the CAD room perimeter, idempotently', function () {
    $user = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create([
        'user_id' => $user->id,
        'data' => [
            'scenes' => [[
                'id' => 'scene-1',
                'name' => 'Piso 1',
                'floorIndex' => 0,
                'rooms' => [[
                    'id' => 'room-cad-1',
                    'vertices' => [
                        ['x' => 0, 'y' => 0], ['x' => 10, 'y' => 0], ['x' => 10, 'y' => 5], ['x' => 0, 'y' => 5],
                    ],
                ]],
                'electricalDevices' => [],
                'conductors' => [],
            ]],
        ],
    ]);

    $response = $this->actingAs($user)->postJson(
        route('dialux.electrical.materialize-outlets', $project),
        ['circuit_id' => 'circuit-1', 'source_room_id' => 'room-cad-1', 'quantity' => 4, 'outlet_type_code' => 'bajo'],
    );

    $response->assertOk();
    $response->assertJsonPath('createdCount', 4);

    $project->refresh();
    $devices = $project->data['scenes'][0]['electricalDevices'];
    expect($devices)->toHaveCount(4);
    foreach ($devices as $device) {
        expect($device['type'])->toBe('outlet_floor')
            ->and($device['generatedBy'])->toBe('analytic-circuit')
            ->and($device['linkedCircuitId'])->toBe('circuit-1')
            ->and($device['x'])->toBeGreaterThanOrEqual(0)->toBeLessThanOrEqual(10)
            ->and($device['y'])->toBeGreaterThanOrEqual(0)->toBeLessThanOrEqual(5);
    }

    // Regenerar con otra cantidad reemplaza SOLO lo que este circuito había generado.
    $this->actingAs($user)->postJson(
        route('dialux.electrical.materialize-outlets', $project),
        ['circuit_id' => 'circuit-1', 'source_room_id' => 'room-cad-1', 'quantity' => 2, 'outlet_type_code' => 'bajo'],
    )->assertOk()->assertJsonPath('createdCount', 2);

    $project->refresh();
    expect($project->data['scenes'][0]['electricalDevices'])->toHaveCount(2);
});

test('materialize outlets links straight conductors to an already-placed panel device', function () {
    $user = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create([
        'user_id' => $user->id,
        'data' => [
            'scenes' => [[
                'id' => 'scene-1',
                'name' => 'Piso 1',
                'floorIndex' => 0,
                'rooms' => [[
                    'id' => 'room-cad-1',
                    'vertices' => [['x' => 0, 'y' => 0], ['x' => 4, 'y' => 0], ['x' => 4, 'y' => 4], ['x' => 0, 'y' => 4]],
                ]],
                'electricalDevices' => [[
                    'id' => 'panel-device-1',
                    'type' => 'main_panel',
                    'x' => 0,
                    'y' => 0,
                    'label' => 'TG-01',
                    'mountingHeight' => 1.8,
                    'linkedAnalyticPanelId' => 'panel-1',
                    'connectedDeviceIds' => [],
                    'properties' => [],
                ]],
                'conductors' => [],
            ]],
        ],
    ]);

    $response = $this->actingAs($user)->postJson(
        route('dialux.electrical.materialize-outlets', $project),
        [
            'circuit_id' => 'circuit-1',
            'source_room_id' => 'room-cad-1',
            'quantity' => 3,
            'outlet_type_code' => 'bajo',
            'panel_id' => 'panel-1',
        ],
    );

    $response->assertOk()->assertJsonPath('conductorsCreated', 3);

    $project->refresh();
    $conductors = $project->data['scenes'][0]['conductors'];
    expect($conductors)->toHaveCount(3);
    foreach ($conductors as $conductor) {
        expect($conductor['sourceId'])->toBe('panel-device-1');
    }
});

test('materialize outlets returns 404 when the source room no longer exists on the CAD plan', function () {
    $user = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create([
        'user_id' => $user->id,
        'data' => ['scenes' => [['id' => 'scene-1', 'name' => 'Piso 1', 'floorIndex' => 0, 'rooms' => []]]],
    ]);

    $this->actingAs($user)->postJson(
        route('dialux.electrical.materialize-outlets', $project),
        ['circuit_id' => 'c1', 'source_room_id' => 'missing-room', 'quantity' => 2, 'outlet_type_code' => 'bajo'],
    )->assertNotFound();
});

test('materialize outlets is forbidden for another users project', function () {
    $owner = User::factory()->create(['plan' => 'mensual']);
    $intruder = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create(['user_id' => $owner->id, 'data' => ['scenes' => []]]);

    $this->actingAs($intruder)->postJson(
        route('dialux.electrical.materialize-outlets', $project),
        ['circuit_id' => 'c1', 'source_room_id' => 'r1', 'quantity' => 2, 'outlet_type_code' => 'bajo'],
    )->assertForbidden();
});

test('place panel positions a new device at the room bounding box center and is idempotent by panel id', function () {
    $user = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create([
        'user_id' => $user->id,
        'data' => [
            'scenes' => [[
                'id' => 'scene-1',
                'name' => 'Piso 1',
                'floorIndex' => 0,
                'rooms' => [[
                    'id' => 'room-1',
                    'vertices' => [['x' => 0, 'y' => 0], ['x' => 10, 'y' => 0], ['x' => 10, 'y' => 10], ['x' => 0, 'y' => 10]],
                ]],
                'electricalDevices' => [],
            ]],
        ],
    ]);

    $response = $this->actingAs($user)->postJson(
        route('dialux.electrical.place-panel', $project),
        ['panel_id' => 'panel-1', 'code' => 'TG-01', 'is_root' => true],
    );

    $response->assertOk()->assertJsonPath('created', true);

    $project->refresh();
    $devices = $project->data['scenes'][0]['electricalDevices'];
    expect($devices)->toHaveCount(1)
        ->and($devices[0]['type'])->toBe('main_panel')
        ->and($devices[0]['label'])->toBe('TG-01')
        ->and($devices[0]['linkedAnalyticPanelId'])->toBe('panel-1')
        // El cast `array` de Eloquent hace json_encode/decode sin
        // JSON_PRESERVE_ZERO_FRACTION -- un float entero (5.0) vuelve como
        // int (5) tras el round-trip por BD. Sin impacto real: en JS
        // (donde vive el consumidor) ambos son el mismo `number`.
        ->and($devices[0]['x'])->toEqual(5.0)
        ->and($devices[0]['y'])->toEqual(5.0);

    // Repetir con otro código RENOMBRA el mismo dispositivo, no lo duplica.
    $this->actingAs($user)->postJson(
        route('dialux.electrical.place-panel', $project),
        ['panel_id' => 'panel-1', 'code' => 'TG-01-B', 'is_root' => true],
    )->assertOk()->assertJsonPath('created', false);

    $project->refresh();
    $devices = $project->data['scenes'][0]['electricalDevices'];
    expect($devices)->toHaveCount(1)
        ->and($devices[0]['label'])->toBe('TG-01-B');
});

test('place panel is forbidden for another users project', function () {
    $owner = User::factory()->create(['plan' => 'mensual']);
    $intruder = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create(['user_id' => $owner->id, 'data' => ['scenes' => []]]);

    $this->actingAs($intruder)->postJson(
        route('dialux.electrical.place-panel', $project),
        ['panel_id' => 'panel-1', 'code' => 'TG-01', 'is_root' => true],
    )->assertForbidden();
});
