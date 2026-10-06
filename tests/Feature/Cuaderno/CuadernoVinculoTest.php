<?php

use App\Models\CostoProject;
use App\Models\CuadernoVinculo;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['cuaderno.enabled' => true]);
    $this->withoutVite();
    $this->owner = User::factory()->create();
    $this->project = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->payload = [
        'entidad' => 'Entidad piloto',
        'obra' => 'Obra piloto',
        'contrato' => 'Contrato 001',
        'codigo_cui' => '2458710',
        'rol' => 'SUPERVISOR',
        'external_id' => null,
        'confirmacion' => true,
    ];
});

it('shows an empty notebook setup for the project owner', function () {
    $this->actingAs($this->owner)
        ->get(route('costos.cuaderno.show', $this->project))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('costos/cuaderno/Show')
            ->where('project.id', $this->project->id)
            ->where('vinculo', null)
            ->has('historial', 0)
            ->missing('password')
            ->missing('token'));
});

it('saves local metadata without claiming official connectivity or changing the project', function () {
    $status = $this->project->status;
    $this->actingAs($this->owner)
        ->post(route('costos.cuaderno.store', $this->project), $this->payload)
        ->assertRedirect(route('costos.cuaderno.show', $this->project))
        ->assertSessionHas('success');

    $vinculo = $this->project->cuadernoVinculos()->sole();
    expect($vinculo->estado)->toBe('pendiente_verificacion')
        ->and($vinculo->active_slot)->toBe(1)
        ->and($vinculo->user_id)->toBe($this->owner->id)
        ->and($vinculo->external_id)->toBeNull()
        ->and($this->project->fresh()->status)->toBe($status);
});

it('archives the previous link when a new link replaces it', function () {
    $this->actingAs($this->owner);
    $this->post(route('costos.cuaderno.store', $this->project), $this->payload)->assertRedirect();
    $old = $this->project->cuadernoVinculos()->sole();
    $this->post(route('costos.cuaderno.store', $this->project), [
        ...$this->payload, 'obra' => 'Otra prestación',
    ])->assertRedirect();

    expect($old->fresh()->active_slot)->toBeNull()
        ->and($old->fresh()->estado)->toBe('revocada')
        ->and($old->fresh()->revoked_at)->not->toBeNull()
        ->and($this->project->cuadernoVinculos()->count())->toBe(2)
        ->and($this->project->cuadernoVinculos()->where('active_slot', 1)->sole()->obra)->toBe('Otra prestación');
});

it('archives a link without deleting history and is safe to repeat', function () {
    $this->actingAs($this->owner);
    $this->post(route('costos.cuaderno.store', $this->project), $this->payload)->assertRedirect();
    $this->delete(route('costos.cuaderno.destroy', $this->project))->assertRedirect();
    $this->delete(route('costos.cuaderno.destroy', $this->project))->assertRedirect();

    expect($this->project->cuadernoVinculos()->count())->toBe(1)
        ->and($this->project->cuadernoVinculos()->where('active_slot', 1)->exists())->toBeFalse();
    $this->get(route('costos.cuaderno.show', $this->project))
        ->assertInertia(fn (Assert $page) => $page->where('vinculo', null)->has('historial', 1));
});

it('rejects access to another owners project for every action', function () {
    $this->actingAs(User::factory()->create());
    $this->get(route('costos.cuaderno.show', $this->project))->assertForbidden();
    $this->post(route('costos.cuaderno.store', $this->project), $this->payload)->assertForbidden();
    $this->delete(route('costos.cuaderno.destroy', $this->project))->assertForbidden();
    expect(CuadernoVinculo::query()->count())->toBe(0);
});

it('keeps each projects current link and history isolated', function () {
    $second = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->actingAs($this->owner);
    $this->post(route('costos.cuaderno.store', $this->project), $this->payload)->assertRedirect();
    $this->post(route('costos.cuaderno.store', $second), [
        ...$this->payload, 'obra' => 'Proyecto separado',
    ])->assertRedirect();
    $this->delete(route('costos.cuaderno.destroy', $this->project))->assertRedirect();

    $this->get(route('costos.cuaderno.show', $second))
        ->assertInertia(fn (Assert $page) => $page
            ->where('vinculo.obra', 'Proyecto separado')
            ->has('historial', 0));
});

it('rejects unconfirmed or invalid notebook data without replacing the current link', function (array $changes, string $field) {
    $this->actingAs($this->owner);
    $this->post(route('costos.cuaderno.store', $this->project), $this->payload)->assertRedirect();
    $existing = $this->project->cuadernoVinculos()->sole();
    $this->postJson(route('costos.cuaderno.store', $this->project), [
        ...$this->payload, ...$changes,
    ])->assertUnprocessable()->assertJsonValidationErrors($field);

    expect($existing->fresh()->active_slot)->toBe(1)
        ->and(CuadernoVinculo::query()->count())->toBe(1);
})->with([
    'confirmation' => [['confirmacion' => false], 'confirmacion'],
    'entity' => [['entidad' => ''], 'entidad'],
    'role' => [['rol' => 'ADMINISTRADOR INVENTADO'], 'rol'],
    'oversized ID' => [['external_id' => str_repeat('x', 121)], 'external_id'],
    'password' => [['password' => 'not-a-real-password'], 'password'],
    'forged state' => [['estado' => 'conectada'], 'estado'],
    'forged project' => [['costo_project_id' => 999], 'costo_project_id'],
]);

it('returns not found for every integration route when disabled', function () {
    config(['cuaderno.enabled' => false]);
    $this->actingAs($this->owner);
    $this->get(route('costos.cuaderno.show', $this->project))->assertNotFound();
    $this->post(route('costos.cuaderno.store', $this->project), $this->payload)->assertNotFound();
    $this->delete(route('costos.cuaderno.destroy', $this->project))->assertNotFound();
});

it('requires authentication', function () {
    $this->get(route('costos.cuaderno.show', $this->project))->assertRedirect(route('login'));
});
