<?php

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('an owner can list project modules in configured order', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    DialuxModule::factory()->for($project, 'project')->create(['name' => 'Segundo', 'sort_order' => 20]);
    DialuxModule::factory()->for($project, 'project')->create(['name' => 'Primero', 'sort_order' => 10]);

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.index', $project))
        ->assertSuccessful()
        ->assertJsonPath('modules.0.name', 'Primero')
        ->assertJsonPath('modules.1.name', 'Segundo');
});

test('an owner can create modules up to the project limit', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    DialuxModule::factory()->for($project, 'project')->create(['sort_order' => 4]);

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.store', $project), [
            'name' => 'Torre norte',
            'description' => 'Oficinas administrativas',
        ])
        ->assertCreated()
        ->assertJsonPath('module.name', 'Torre norte')
        ->assertJsonPath('module.sort_order', 5)
        ->assertJsonPath('module.status', 'draft');

    $this->assertDatabaseHas('dialux_modules', [
        'dialux_project_id' => $project->id,
        'name' => 'Torre norte',
    ]);

    DialuxModule::factory()
        ->count(DialuxModule::MAX_PER_PROJECT - 2)
        ->for($project, 'project')
        ->create();

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.store', $project), ['name' => 'Módulo 26'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});

test('an owner can show update and delete a module', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $snapshot = ['scenes' => [['id' => 'scene-v2']]];

    $routeParameters = [$project, $module];

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.show', $routeParameters))
        ->assertSuccessful()
        ->assertJsonPath('module.id', $module->id);

    $this->actingAs($user)
        ->patchJson(route('dialux-v2.modules.update', $routeParameters), [
            'name' => 'Módulo actualizado',
            'status' => 'in_progress',
            'data' => $snapshot,
        ])
        ->assertSuccessful()
        ->assertJsonPath('module.name', 'Módulo actualizado')
        ->assertJsonPath('module.status', 'in_progress')
        ->assertJsonPath('module.data', $snapshot);

    $this->actingAs($user)
        ->deleteJson(route('dialux-v2.modules.destroy', $routeParameters))
        ->assertNoContent();

    $this->assertDatabaseMissing('dialux_modules', ['id' => $module->id]);
});

test('an owner can duplicate a module snapshot with a safe initial status', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $snapshot = ['rooms' => [['id' => 'room-1']]];
    $source = DialuxModule::factory()->for($project, 'project')->create([
        'name' => 'Edificio A',
        'description' => 'Bloque principal',
        'sort_order' => 7,
        'status' => 'completed',
        'data' => $snapshot,
    ]);

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.duplicate', [$project, $source]), [])
        ->assertCreated()
        ->assertJsonPath('module.name', 'Edificio A (copia)')
        ->assertJsonPath('module.description', 'Bloque principal')
        ->assertJsonPath('module.sort_order', 8)
        ->assertJsonPath('module.status', 'draft')
        ->assertJsonPath('module.data', $snapshot);
});

test('an owner can reorder only modules belonging to the project', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $first = DialuxModule::factory()->for($project, 'project')->create(['sort_order' => 1]);
    $second = DialuxModule::factory()->for($project, 'project')->create(['sort_order' => 2]);

    $this->actingAs($user)
        ->patchJson(route('dialux-v2.modules.reorder', $project), [
            'modules' => [
                ['id' => $first->id, 'sort_order' => 20],
                ['id' => $second->id, 'sort_order' => 10],
            ],
        ])
        ->assertSuccessful()
        ->assertJsonPath('modules.0.id', $second->id)
        ->assertJsonPath('modules.1.id', $first->id);

    $foreignProject = DialuxProject::factory()->for($user)->create();
    $foreignModule = DialuxModule::factory()->for($foreignProject, 'project')->create();

    $this->actingAs($user)
        ->patchJson(route('dialux-v2.modules.reorder', $project), [
            'modules' => [['id' => $foreignModule->id, 'sort_order' => 1]],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('modules');
});

test('v2 module endpoints isolate owners projects and nested modules', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = DialuxProject::factory()->for($owner)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($intruder)
        ->getJson(route('dialux-v2.modules.index', $project))
        ->assertForbidden();

    $this->actingAs($intruder)
        ->postJson(route('dialux-v2.modules.store', $project), ['name' => 'Intrusión'])
        ->assertForbidden();

    $otherProject = DialuxProject::factory()->for($owner)->create();

    $this->actingAs($owner)
        ->getJson(route('dialux-v2.modules.show', [$otherProject, $module]))
        ->assertNotFound();

    $this->actingAs($owner)
        ->patchJson(route('dialux-v2.modules.update', [$otherProject, $module]), ['name' => 'Cruce'])
        ->assertForbidden();
});

test('module updates reject unsupported statuses and invalid snapshots', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($user)
        ->patchJson(route('dialux-v2.modules.update', [$project, $module]), [
            'status' => 'unknown',
            'data' => 'not-an-array',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status', 'data']);
});
