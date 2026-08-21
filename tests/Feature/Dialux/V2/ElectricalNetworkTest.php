<?php

use App\Models\Dialux\DialuxElectricalProject;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(fn () => $this->withoutMiddleware(ValidateCsrfToken::class));

test('an owner can load ports and persist a versioned electrical network', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $generalModule = DialuxModule::factory()->for($project, 'project')->create([
        'name' => 'General',
        'kind' => 'general',
    ]);
    $module = DialuxModule::factory()->for($project, 'project')->create([
        'data' => ['scenes' => [[
            'id' => 'floor-1', 'name' => 'Piso 1',
            'electricalDevices' => [[
                'id' => 'td-1', 'type' => 'sub_panel', 'label' => 'TD-1',
                'connectedDeviceIds' => [], 'properties' => ['voltage' => '380V', 'phases' => '3Φ'],
            ], [
                'id' => 'td-01', 'type' => 'sub_panel', 'label' => 'TD-01',
                'connectedDeviceIds' => [], 'properties' => [
                    'voltage' => '380V', 'phases' => '3Φ', 'upstreamPanelId' => 'td-1',
                ],
            ]],
            'conductors' => [[
                'id' => 'feeder-td-01', 'sourceId' => 'td-01', 'targetId' => 'td-1',
            ]],
        ]]],
    ]);
    DialuxElectricalProject::query()->create([
        'dialux_module_id' => $module->id,
        'user_id' => $user->id,
        'reference_standard' => 'CNE Utilizacion',
        'voltage_v' => 380,
        'phases' => 3,
        'frequency_hz' => 60,
        'installed_power_w' => 7200,
        'demand_power_w' => 5400,
        'derived_summary' => [
            'version' => 1,
            'panels' => [[
                'panelId' => 'td-1',
                'installedPowerW' => 7200,
                'demandPowerW' => 5400,
                'ownInstalledPowerW' => 7200,
                'ownDemandPowerW' => 5400,
                'currentA' => 8.2,
                'mainBreakerA' => 16,
            ], [
                'panelId' => 'td-01',
                'installedPowerW' => 2400,
                'demandPowerW' => 1800,
                'ownInstalledPowerW' => 2400,
                'ownDemandPowerW' => 1800,
                'currentA' => 2.74,
                'mainBreakerA' => 10,
            ]],
        ],
    ]);
    $wiredModule = DialuxModule::factory()->for($project, 'project')->create([
        'name' => 'Módulo cableado',
        'data' => ['scenes' => [[
            'id' => 'floor-wired',
            'name' => 'Nivel cableado',
            'conductors' => [['id' => 'wire-1', 'sourceId' => 'a', 'targetId' => 'b']],
        ]]],
    ]);

    $response = $this->actingAs($user)->getJson(route('dialux-v2.projects.electrical-network.show', $project))
        ->assertSuccessful()
        ->assertJsonPath('network.version', 1)
        ->assertJsonPath('ports.0.panelLabel', 'TD-1')
        ->assertJsonPath('ports.0.installedPowerW', 7200)
        ->assertJsonPath('ports.0.demandPowerW', 5400)
        ->assertJsonPath('ports.0.currentA', 8.2)
        ->assertJsonPath('ports.0.mainBreakerA', 16)
        ->assertJsonPath('ports.1.panelLabel', 'TD-01')
        ->assertJsonPath('ports.1.parentPanelId', 'td-1');

    $fallbackPort = collect($response->json('ports'))->firstWhere('moduleId', $wiredModule->id);
    expect($fallbackPort)
        ->not->toBeNull()
        ->and($fallbackPort['panelLabel'])->toBe('Entrada · Módulo cableado')
        ->and($fallbackPort['isFallback'])->toBeTrue();

    $snapshot = $response->json('network');
    $this->actingAs($user)->putJson(route('dialux-v2.projects.electrical-network.update', $project), $snapshot)
        ->assertSuccessful()
        ->assertJsonPath('network.version', 2);

    $this->actingAs($user)->putJson(route('dialux-v2.projects.electrical-network.update', $project), $snapshot)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('version');

    $this->actingAs($user)
        ->get(route('dialux-v2.projects.electrical-network.show', $project))
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->component('dialux/v2/ElectricalNetwork')
            ->where('generalModuleId', $generalModule->id));
});

test('another user cannot read or update the project electrical network', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = DialuxProject::factory()->for($owner)->create();

    $this->actingAs($intruder)->getJson(route('dialux-v2.projects.electrical-network.show', $project))->assertForbidden();
});
