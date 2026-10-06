<?php

use App\Models\CostoProject;
use App\Models\CuadernoReferencia;
use App\Models\CuadernoVinculo;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['cuaderno.enabled' => true]);
    $this->withoutVite();
    $this->owner = User::factory()->create();
    $this->project = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->vinculo = new CuadernoVinculo(['entidad' => 'Entidad piloto', 'obra' => 'Obra piloto', 'rol' => 'SUPERVISOR']);
    $this->vinculo->user_id = $this->owner->id;
    $this->vinculo->active_slot = 1;
    $this->vinculo->estado = 'verificada';
    $this->project->cuadernoVinculos()->save($this->vinculo);
    $row = ['tipo' => 'CONSULTA', 'fecha_oficial' => '03/10/2026 09:16 PM', 'usuario' => 'Usuario piloto', 'rol' => 'SUPERVISOR', 'estado' => 'DEFINITIVO'];
    $this->first = $this->vinculo->asientos()->create([...$row, 'numero' => 1, 'titulo' => 'Consulta de diseño']);
    $this->second = $this->vinculo->asientos()->create([...$row, 'numero' => 2, 'titulo' => 'Absolución de consulta', 'tipo' => 'ABSOLUCIÓN']);
    $this->actingAs($this->owner);
});

it('saves a local note that survives a new import and is searchable', function () {
    $this->patch(route('costos.cuaderno.asientos.update', [$this->project, $this->first]), ['nota_local' => 'Revisar con metrados'])
        ->assertRedirect();
    $this->vinculo->asientos()->upsert([[
        'cuaderno_vinculo_id' => $this->vinculo->id, 'numero' => 1, 'titulo' => 'Consulta de diseño (actualizada)', 'tipo' => 'CONSULTA',
        'fecha_oficial' => '03/10/2026 09:16 PM', 'usuario' => 'Usuario piloto', 'rol' => 'SUPERVISOR', 'estado' => 'DEFINITIVO',
    ]], ['cuaderno_vinculo_id', 'numero'], ['titulo']);
    expect($this->first->fresh()->nota_local)->toBe('Revisar con metrados');
    $this->get(route('costos.cuaderno.show', [$this->project, 'q' => 'metrados']))->assertInertia(fn (Assert $page) => $page
        ->has('asientos.data', 1)->where('asientos.data.0.numero', 1)->has('tipos', 2));
});

it('links two seats of the same notebook once and shows both directions', function () {
    $this->post(route('costos.cuaderno.asientos.link', [$this->project, $this->second]), ['numero' => 1])->assertRedirect();
    $this->post(route('costos.cuaderno.asientos.link', [$this->project, $this->second]), ['numero' => 1])->assertRedirect();
    expect(CuadernoReferencia::count())->toBe(1);
    $this->get(route('costos.cuaderno.show', $this->project))->assertInertia(fn (Assert $page) => $page
        ->where('asientos.data.0.referencias.0.destino.numero', 1)
        ->where('asientos.data.1.referenciado_por.0.origen.numero', 2));
    $this->delete(route('costos.cuaderno.asientos.unlink', [$this->project, $this->first, CuadernoReferencia::sole()]))->assertRedirect();
    expect(CuadernoReferencia::count())->toBe(0);
});

it('rejects links to itself or to numbers outside the notebook', function (int $numero) {
    $this->post(route('costos.cuaderno.asientos.link', [$this->project, $this->first]), ['numero' => $numero])
        ->assertSessionHasErrors('numero');
    expect(CuadernoReferencia::count())->toBe(0);
})->with(['itself' => 1, 'missing' => 99]);

it('blocks notes, links and exports from another owner or project', function () {
    $other = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->patch(route('costos.cuaderno.asientos.update', [$other, $this->first]), ['nota_local' => 'x'])->assertForbidden();
    $this->post(route('costos.cuaderno.asientos.link', [$other, $this->first]), ['numero' => 2])->assertForbidden();
    $this->actingAs(User::factory()->create());
    $this->patch(route('costos.cuaderno.asientos.update', [$this->project, $this->first]), ['nota_local' => 'x'])->assertForbidden();
    $this->get(route('costos.cuaderno.export', $this->project))->assertForbidden();
    expect($this->first->fresh()->nota_local)->toBeNull();
});

it('exports the filtered local copy as an Excel-friendly CSV', function () {
    $this->first->forceFill(['nota_local' => 'Sustento de valorización'])->save();
    $csv = $this->get(route('costos.cuaderno.export', [$this->project, 'tipo' => 'CONSULTA']))->assertOk()->streamedContent();
    expect($csv)->toStartWith("\xEF\xBB\xBF")
        ->toContain('Consulta de diseño')->toContain('Sustento de valorización')
        ->not->toContain('Absolución de consulta');
});
