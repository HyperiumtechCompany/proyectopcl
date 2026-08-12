<?php

use App\Models\Dialux\DialuxElectricalProject;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxNormativeConfig;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function createSummaryModule(DialuxProject $project, string $name, int $rooms): DialuxModule
{
    return DialuxModule::factory()->for($project, 'project')->create([
        'name' => $name,
        'data' => [
            'scenes' => [[
                'id' => "scene-{$name}",
                'rooms' => array_fill(0, $rooms, ['id' => 'room']),
                'fixtures' => array_fill(0, 2, ['id' => 'fixture']),
            ]],
        ],
    ]);
}

it('builds and caches a consolidated summary for all project modules', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $first = createSummaryModule($project, 'Arquitectura', 3);
    $second = createSummaryModule($project, 'Oficinas', 2);

    DialuxElectricalProject::query()->create([
        'dialux_module_id' => $first->id,
        'dialux_project_id' => null,
        'user_id' => $user->id,
        'total_luminaires' => 8,
        'total_outlets' => 12,
        'total_panels' => 1,
        'installed_power_w' => 1460.5,
    ]);
    DialuxNormativeConfig::query()->create([
        'dialux_module_id' => $first->id,
        'dialux_project_id' => null,
        'user_id' => $user->id,
        'total_rooms' => 3,
        'compliant_rooms' => 2,
        'non_compliant_rooms' => 1,
    ]);

    $response = $this->actingAs($user)->getJson(route('dialux-v2.projects.summary', $project));

    $response->assertSuccessful()
        ->assertJsonPath('summary.totals.modules', 2)
        ->assertJsonPath('summary.totals.rooms', 5)
        ->assertJsonPath('summary.totals.luminaires', 10)
        ->assertJsonPath('summary.totals.outlets', 12)
        ->assertJsonPath('summary.totals.installed_power_w', 1460.5)
        ->assertJsonPath('summary.totals.compliant_rooms', 2);

    expect($project->fresh()->consolidated_summary)->not->toBeNull()
        ->and($second->fresh()->name)->toBe('Oficinas');
});

it('renders the consolidated Inertia page', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    createSummaryModule($project, 'Módulo principal', 1);

    $this->actingAs($user)
        ->get(route('dialux-v2.projects.summary', $project))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dialux/v2/Summary')
            ->where('project.id', $project->id)
            ->where('summary.totals.modules', 1));
});

it('invalidates the cache when a module or dependent result changes', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = createSummaryModule($project, 'Inicial', 1);

    $this->actingAs($user)->getJson(route('dialux-v2.projects.summary', $project))->assertSuccessful();
    expect($project->fresh()->consolidated_summary)->not->toBeNull();

    $module->update(['name' => 'Actualizado']);
    expect($project->fresh()->consolidated_summary)->toBeNull();

    $this->actingAs($user)->getJson(route('dialux-v2.projects.summary', $project))->assertSuccessful();
    DialuxElectricalProject::query()->create([
        'dialux_module_id' => $module->id,
        'dialux_project_id' => null,
        'user_id' => $user->id,
        'installed_power_w' => 500,
    ]);

    expect($project->fresh()->consolidated_summary)->toBeNull();
});

it('exports a multi module consolidated pdf', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create(['name' => 'Centro Empresarial']);
    createSummaryModule($project, 'Torre A', 2);
    createSummaryModule($project, 'Torre B', 4);

    $this->actingAs($user)
        ->get(route('dialux-v2.projects.formal-export', $project))
        ->assertSuccessful()
        ->assertHeader('content-type', 'application/pdf')
        ->assertDownload('centro-empresarial-consolidado.pdf');
});

it('forbids access to another users summary and export', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $project = DialuxProject::factory()->for($owner)->create();
    createSummaryModule($project, 'Privado', 1);

    $this->actingAs($other)->get(route('dialux-v2.projects.summary', $project))->assertForbidden();
    $this->actingAs($other)->get(route('dialux-v2.projects.formal-export', $project))->assertForbidden();
});
