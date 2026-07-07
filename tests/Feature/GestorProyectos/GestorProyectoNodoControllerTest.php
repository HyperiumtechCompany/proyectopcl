<?php

use App\Models\GestorProyecto;
use App\Models\GestorProyectoNodo;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

function crearProyectoConRaiz(User $user): GestorProyecto
{
    $proyecto = GestorProyecto::factory()->for($user)->create();
    $proyecto->nodos()->create([
        'parent_id' => null,
        'title' => 'Proyecto',
        'type' => 'text',
        'shape' => 'square',
        'color' => 'violet',
        'status' => 'En curso',
        'content' => ['text' => 'raiz'],
        'order' => 0,
    ]);

    return $proyecto;
}

test('the owner can create a child node', function () {
    $user = User::factory()->create();
    $proyecto = crearProyectoConRaiz($user);
    $root = $proyecto->nodos()->whereNull('parent_id')->firstOrFail();

    $response = $this->actingAs($user)->postJson(route('gestor-proyectos.nodos.store', $proyecto), [
        'parent_id' => $root->id,
        'title' => 'Arquitectura',
        'type' => 'text',
        'shape' => 'circle',
        'color' => 'fuchsia',
        'status' => 'Pendiente',
        'content' => ['text' => 'Primer hijo'],
    ]);

    $response->assertCreated();
    $response->assertJsonPath('nodo.title', 'Arquitectura');
    expect($proyecto->nodos()->count())->toBe(2);
});

test('the owner can update a node', function () {
    $user = User::factory()->create();
    $proyecto = crearProyectoConRaiz($user);
    $root = $proyecto->nodos()->whereNull('parent_id')->firstOrFail();

    $response = $this->actingAs($user)->patchJson(route('gestor-proyectos.nodos.update', [$proyecto, $root]), [
        'title' => 'Proyecto renombrado',
        'type' => 'text',
        'shape' => 'square',
        'color' => 'violet',
        'status' => 'Completo',
        'content' => ['text' => 'actualizado'],
    ]);

    $response->assertOk();
    expect($root->fresh()->title)->toBe('Proyecto renombrado');
});

test('the root node cannot be deleted', function () {
    $user = User::factory()->create();
    $proyecto = crearProyectoConRaiz($user);
    $root = $proyecto->nodos()->whereNull('parent_id')->firstOrFail();

    $response = $this->actingAs($user)->deleteJson(route('gestor-proyectos.nodos.destroy', [$proyecto, $root]));

    $response->assertStatus(422);
    expect(GestorProyectoNodo::find($root->id))->not->toBeNull();
});

test('deleting a node cascades to its children', function () {
    $user = User::factory()->create();
    $proyecto = crearProyectoConRaiz($user);
    $root = $proyecto->nodos()->whereNull('parent_id')->firstOrFail();

    $child = $proyecto->nodos()->create([
        'parent_id' => $root->id,
        'title' => 'Hijo',
        'type' => 'text',
        'shape' => 'square',
        'color' => 'sky',
        'status' => 'Pendiente',
        'content' => ['text' => 'hijo'],
        'order' => 0,
    ]);
    $grandchild = $proyecto->nodos()->create([
        'parent_id' => $child->id,
        'title' => 'Nieto',
        'type' => 'text',
        'shape' => 'square',
        'color' => 'sky',
        'status' => 'Pendiente',
        'content' => ['text' => 'nieto'],
        'order' => 0,
    ]);

    $response = $this->actingAs($user)->deleteJson(route('gestor-proyectos.nodos.destroy', [$proyecto, $child]));

    $response->assertOk();
    expect(GestorProyectoNodo::find($child->id))->toBeNull();
    expect(GestorProyectoNodo::find($grandchild->id))->toBeNull();
});

test('a user cannot mutate nodes of another users project', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $proyecto = crearProyectoConRaiz($owner);
    $root = $proyecto->nodos()->whereNull('parent_id')->firstOrFail();

    $this->actingAs($intruder)->postJson(route('gestor-proyectos.nodos.store', $proyecto), [
        'parent_id' => $root->id,
        'title' => 'Intruso',
        'type' => 'text',
        'shape' => 'square',
        'color' => 'violet',
        'status' => 'Pendiente',
        'content' => ['text' => 'x'],
    ])->assertForbidden();
});

test('a node from another project cannot be updated through this project', function () {
    $user = User::factory()->create();
    $proyectoA = crearProyectoConRaiz($user);
    $proyectoB = crearProyectoConRaiz($user);
    $rootB = $proyectoB->nodos()->whereNull('parent_id')->firstOrFail();

    $this->actingAs($user)->patchJson(route('gestor-proyectos.nodos.update', [$proyectoA, $rootB]), [
        'title' => 'Cruzado',
        'type' => 'text',
        'shape' => 'square',
        'color' => 'violet',
        'status' => 'Pendiente',
        'content' => ['text' => 'x'],
    ])->assertNotFound();
});
