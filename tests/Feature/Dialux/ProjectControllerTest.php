<?php

use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('the index only lists the authenticated users own dialux projects', function () {
    $user = User::factory()->create(['plan' => 'mensual']);
    $other = User::factory()->create(['plan' => 'mensual']);

    DialuxProject::factory()->count(2)->create(['user_id' => $user->id]);
    DialuxProject::factory()->create(['user_id' => $other->id]);

    $response = $this->actingAs($user)->get(route('dialux.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('dialux/Index')
        ->has('proyectos', 2));
});

test('creating a dialux project respects the plan quota', function () {
    $user = User::factory()->create(['plan' => 'mensual']);

    DialuxProject::factory()->count(10)->create(['user_id' => $user->id]);

    $response = $this->actingAs($user)->post(route('dialux.store'), [
        'name' => 'Once and beyond',
    ]);

    $response->assertStatus(422);
    expect(DialuxProject::where('user_id', $user->id)->count())->toBe(10);
});

test('a user can create, load, autosave and delete a dialux project', function () {
    $user = User::factory()->create(['plan' => 'mensual']);

    $createResponse = $this->actingAs($user)->post(route('dialux.store'), [
        'name' => 'Edificio Comercial Los Pinos',
    ]);

    $project = DialuxProject::where('user_id', $user->id)->firstOrFail();
    $createResponse->assertRedirect(route('dialux.show', $project));
    expect($project->data)->toBeNull();

    $showResponse = $this->actingAs($user)->get(route('dialux.show', $project));
    $showResponse->assertOk();
    $showResponse->assertInertia(fn ($page) => $page
        ->component('dialux/Show')
        ->where('project.id', (string) $project->id)
        ->where('project.name', 'Edificio Comercial Los Pinos')
        ->where('project.data', null));

    // Autosave desde el editor: fetch JSON, no debe redirigir.
    $drawing = ['id' => (string) $project->id, 'name' => $project->name, 'scenes' => [['id' => 'scene-1']]];
    $saveResponse = $this->actingAs($user)->patchJson(route('dialux.update', $project), [
        'data' => $drawing,
    ]);
    $saveResponse->assertOk()->assertJsonStructure(['message', 'updated_at']);
    expect($project->fresh()->data)->toBe($drawing);

    // Renombrar desde el listado: visita Inertia, redirige.
    $renameResponse = $this->actingAs($user)->patch(route('dialux.update', $project), [
        'name' => 'Nuevo nombre',
    ]);
    $renameResponse->assertRedirect();
    expect($project->fresh()->name)->toBe('Nuevo nombre');

    $this->actingAs($user)->delete(route('dialux.destroy', $project))
        ->assertRedirect(route('dialux.index'));
    expect(DialuxProject::find($project->id))->toBeNull();
});

test('a user cannot view, update or delete another users dialux project', function () {
    $owner = User::factory()->create(['plan' => 'mensual']);
    $intruder = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->create(['user_id' => $owner->id]);

    $this->actingAs($intruder)->get(route('dialux.show', $project))->assertForbidden();
    $this->actingAs($intruder)->patchJson(route('dialux.update', $project), ['name' => 'x'])->assertForbidden();
    $this->actingAs($intruder)->delete(route('dialux.destroy', $project))->assertForbidden();
});

test('an expired demo dialux project is blocked from access', function () {
    $user = User::factory()->create(['plan' => 'free']);
    $project = DialuxProject::factory()->create([
        'user_id' => $user->id,
        'is_demo' => true,
        'demo_expires_at' => now()->subDay(),
    ]);

    $this->actingAs($user)->get(route('dialux.show', $project))->assertForbidden();
});
