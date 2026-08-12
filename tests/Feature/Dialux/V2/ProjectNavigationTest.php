<?php

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('the v2 index only lists modular projects owned by the user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $v2Project = DialuxProject::factory()->for($user)->create();
    DialuxModule::factory()->for($v2Project, 'project')->create();
    DialuxProject::factory()->for($user)->create(['name' => 'Proyecto v1']);
    $foreign = DialuxProject::factory()->for($other)->create();
    DialuxModule::factory()->for($foreign, 'project')->create();

    $this->actingAs($user)
        ->get(route('dialux-v2.projects.index'))
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->component('dialux/v2/Index')
            ->has('projects', 1)
            ->where('projects.0.id', $v2Project->id));
});

test('creating a v2 project also creates its first module', function () {
    $user = User::factory()->create(['plan' => 'mensual']);

    $response = $this->actingAs($user)->post(route('dialux-v2.projects.store'), [
        'name' => 'Complejo modular',
    ]);

    $project = DialuxProject::query()->where('user_id', $user->id)->sole();
    $response->assertRedirect(route('dialux-v2.projects.show', $project));
    expect($project->modules()->count())->toBe(1)
        ->and($project->modules()->firstOrFail()->name)->toBe('Módulo 1')
        ->and($project->data)->toBeNull();
});

test('the project dashboard and module editor expose isolated inertia pages', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create([
        'data' => ['scenes' => [['rooms' => [['id' => 'room-1']]]]],
    ]);

    $this->actingAs($user)
        ->get(route('dialux-v2.projects.show', $project))
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->component('dialux/v2/Project')
            ->where('project.id', $project->id)
            ->where('modules.0.rooms_count', 1));

    $this->actingAs($user)
        ->get(route('dialux-v2.modules.show', [$project, $module]))
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->component('dialux/v2/Module')
            ->where('project.id', $project->id)
            ->where('module.id', $module->id)
            ->has('modules', 1));

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.show', [$project, $module]))
        ->assertSuccessful()
        ->assertJsonPath('module.id', $module->id);
});

test('another user cannot open v2 project navigation', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = DialuxProject::factory()->for($owner)->create();

    $this->actingAs($intruder)
        ->get(route('dialux-v2.projects.show', $project))
        ->assertForbidden();
});
