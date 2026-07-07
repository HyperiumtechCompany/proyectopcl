<?php

use App\Models\GestorProyecto;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('authenticated users can list their own projects', function () {
    $user = User::factory()->create();
    $mine = GestorProyecto::factory()->for($user)->create();
    GestorProyecto::factory()->create();

    $response = $this->actingAs($user)->get(route('gestor-proyectos.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('gestor-proyectos/Index')
        ->has('proyectos', 1)
        ->where('proyectos.0.id', $mine->id));
});

test('creating a project seeds a root node', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('gestor-proyectos.store'), [
        'nombre' => 'Mi proyecto',
        'descripcion' => 'Descripcion de prueba',
    ]);

    $proyecto = GestorProyecto::where('nombre', 'Mi proyecto')->firstOrFail();
    $response->assertRedirect(route('gestor-proyectos.show', $proyecto));

    expect($proyecto->user_id)->toBe($user->id);
    expect($proyecto->nodos()->whereNull('parent_id')->count())->toBe(1);
});

test('a user cannot view another users project', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $proyecto = GestorProyecto::factory()->for($owner)->create();

    $this->actingAs($intruder)->get(route('gestor-proyectos.show', $proyecto))->assertForbidden();
});

test('a user cannot delete another users project', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $proyecto = GestorProyecto::factory()->for($owner)->create();

    $this->actingAs($intruder)->delete(route('gestor-proyectos.destroy', $proyecto))->assertForbidden();

    expect(GestorProyecto::find($proyecto->id))->not->toBeNull();
});
