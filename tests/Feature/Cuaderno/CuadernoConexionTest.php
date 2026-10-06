<?php

use App\Models\CostoProject;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['cuaderno.enabled' => true, 'cuaderno.runner_token' => str_repeat('x', 64), 'cuaderno.runner_port' => 43127]);
    Http::preventStrayRequests();
    $this->withoutVite();
    $this->owner = User::factory()->create();
    $this->project = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->actingAs($this->owner);
    $this->post(route('costos.cuaderno.store', $this->project), [
        'entidad' => 'Entidad piloto', 'obra' => 'Obra piloto CUI N° 2458710',
        'codigo_cui' => '2458710', 'rol' => 'SUPERVISOR', 'confirmacion' => true,
    ])->assertRedirect();
    $this->vinculo = $this->project->cuadernoVinculos()->sole();
    $this->vinculo->session_key = '11111111-1111-4111-8111-111111111111';
    $this->vinculo->save();
    $this->snapshot = [
        'state' => 'ready',
        'identity' => ['entidad' => 'Entidad piloto', 'obra' => 'Obra piloto CUI N° 2458710', 'codigo_cui' => '2458710'],
        'rows' => [[
            'numero' => '1', 'titulo' => 'Entrega de valorización', 'tipo' => 'VALORIZACIÓN',
            'fecha_oficial' => '03/10/2026 09:16 PM', 'usuario' => 'Usuario piloto',
            'rol' => 'RESIDENTE DE OBRA', 'estado' => 'DEFINITIVO',
        ]],
        'total' => 1, 'complete' => true,
    ];
});

it('connects from costs without persisting or returning a password or session key', function () {
    $this->vinculo->session_key = null;
    $this->vinculo->save();
    Http::fake(['127.0.0.1:43127/connect' => Http::response(['state' => 'intervention'])]);
    $this->post(route('costos.cuaderno.connect', $this->project), [
        'vinculo_id' => $this->vinculo->id, 'usuario' => 'usuario-prueba', 'password' => 'clave-ficticia',
    ])->assertRedirect(route('costos.cuaderno.show', $this->project));
    Http::assertSent(fn ($request) => $request['password'] === 'clave-ficticia' && $request['session'] === $this->vinculo->fresh()->session_key);
    expect($this->vinculo->fresh()->conexion_estado)->toBe('requiere_intervencion')
        ->and($this->vinculo->fresh()->getRawOriginal('session_key'))->not->toBe($this->vinculo->fresh()->session_key)
        ->and(Str::isUuid($this->vinculo->fresh()->session_key))->toBeTrue();
    $this->get(route('costos.cuaderno.show', $this->project))->assertInertia(fn (Assert $page) => $page
        ->missing('vinculo.session_key')->missing('vinculo.password'));
});

it('imports and updates the same numbered seat without duplicates', function () {
    $payload = ['vinculo_id' => $this->vinculo->id];
    $updated = $this->snapshot;
    $updated['rows'][0]['titulo'] = 'Entrega de valorización actualizada';
    Http::fake(['127.0.0.1:43127/sync' => Http::sequence()->push($this->snapshot)->push($updated)]);
    $this->post(route('costos.cuaderno.sync', $this->project), $payload)->assertRedirect();
    $this->post(route('costos.cuaderno.sync', $this->project), $payload)->assertRedirect();
    expect($this->vinculo->asientos()->count())->toBe(1)
        ->and($this->vinculo->asientos()->sole()->titulo)->toBe('Entrega de valorización actualizada')
        ->and($this->vinculo->fresh()->sync_completa)->toBeTrue()
        ->and($this->vinculo->fresh()->last_synced_at)->not->toBeNull();
});

it('refuses data from another notebook before saving any seat', function (string $field, string $value) {
    $snapshot = $this->snapshot;
    $snapshot['identity'][$field] = $value;
    Http::fake(['127.0.0.1:43127/sync' => Http::response($snapshot)]);
    $this->postJson(route('costos.cuaderno.sync', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertUnprocessable()->assertJsonValidationErrors('conexion');
    expect($this->vinculo->asientos()->count())->toBe(0)
        ->and($this->vinculo->fresh()->conexion_estado)->toBe('error');
})->with([
    'entity' => ['entidad', 'Otra entidad'],
    'work' => ['obra', 'Otra obra'],
    'CUI' => ['codigo_cui', '2444383'],
]);

it('does not report a partial import as complete or overwrite the last complete timestamp', function () {
    $previous = now()->subDay()->startOfSecond();
    $this->vinculo->last_synced_at = $previous;
    $this->vinculo->save();
    $snapshot = [...$this->snapshot, 'total' => 231, 'complete' => false];
    Http::fake(['127.0.0.1:43127/sync' => Http::response($snapshot)]);
    $this->post(route('costos.cuaderno.sync', $this->project), ['vinculo_id' => $this->vinculo->id])->assertRedirect();
    expect($this->vinculo->fresh()->sync_completa)->toBeFalse()
        ->and($this->vinculo->fresh()->last_synced_at->equalTo($previous))->toBeTrue()
        ->and($this->vinculo->fresh()->total_oficial)->toBe(231);
});

it('rejects an inconsistent complete count', function () {
    Http::fake(['127.0.0.1:43127/sync' => Http::response([...$this->snapshot, 'total' => 231])]);
    $this->postJson(route('costos.cuaderno.sync', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertUnprocessable()->assertJsonValidationErrors('conexion');
    expect($this->vinculo->asientos()->count())->toBe(0);
});

it('isolates connection actions by project and owner', function () {
    $other = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->post(route('costos.cuaderno.sync', $other), ['vinculo_id' => $this->vinculo->id])->assertNotFound();
    $this->actingAs(User::factory()->create());
    foreach (['inspect', 'select', 'sync', 'disconnect', 'connect'] as $action) {
        $this->post(route('costos.cuaderno.'.$action, $this->project), ['vinculo_id' => $this->vinculo->id])->assertForbidden();
    }
    Http::assertNothingSent();
});

it('keeps passwords out of flashed input after validation fails', function () {
    $this->post(route('costos.cuaderno.connect', $this->project), [
        'vinculo_id' => $this->vinculo->id, 'usuario' => '', 'password' => 'clave-ficticia',
    ])->assertSessionHasErrors('usuario')->assertSessionMissing('_old_input.password');
    Http::assertNothingSent();
});

it('preserves data when the connector fails and exposes no raw transport error', function () {
    Http::fake(['127.0.0.1:43127/sync' => Http::failedConnection()]);
    $this->post(route('costos.cuaderno.sync', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertSessionHasErrors('conexion');
    expect($this->vinculo->fresh()->conexion_estado)->toBe('error')
        ->and($this->vinculo->asientos()->count())->toBe(0);
});

it('searches the local copy and filters by type and state', function () {
    $this->vinculo->asientos()->create($this->snapshot['rows'][0]);
    $this->vinculo->asientos()->create([
        ...$this->snapshot['rows'][0], 'numero' => 2, 'titulo' => 'Consulta de obra', 'tipo' => 'CONSULTA', 'estado' => 'BORRADOR',
    ]);
    $this->get(route('costos.cuaderno.show', [$this->project, 'q' => 'valorización', 'tipo' => 'VALORIZACIÓN', 'estado' => 'DEFINITIVO']))
        ->assertInertia(fn (Assert $page) => $page->has('asientos.data', 1)->where('asientos.data.0.numero', 1));
});

it('refuses to replace a link that still owns a browser session', function () {
    $this->delete(route('costos.cuaderno.destroy', $this->project))->assertSessionHasErrors('conexion');
    expect($this->vinculo->fresh()->active_slot)->toBe(1);
});

it('disconnects before archiving the link and preserves imported seats', function () {
    $this->vinculo->asientos()->create($this->snapshot['rows'][0]);
    Http::fake(['127.0.0.1:43127/disconnect' => Http::response(['state' => 'disconnected'])]);
    $this->post(route('costos.cuaderno.disconnect', $this->project), ['vinculo_id' => $this->vinculo->id])->assertRedirect();
    $this->delete(route('costos.cuaderno.destroy', $this->project))->assertRedirect();
    expect($this->vinculo->fresh()->session_key)->toBeNull()
        ->and($this->vinculo->fresh()->active_slot)->toBeNull()
        ->and($this->vinculo->asientos()->count())->toBe(1);
});

it('detects official metadata and requires explicit confirmation before changing the link', function () {
    $this->vinculo->obra = 'Nombre incompleto ingresado manualmente';
    $this->vinculo->save();
    $originalProjectCui = $this->project->codigo_cui;
    Http::fake(['127.0.0.1:43127/preview' => Http::response([
        'state' => 'ready', 'identity' => $this->snapshot['identity'],
    ])]);
    $this->post(route('costos.cuaderno.preview', $this->project), ['vinculo_id' => $this->vinculo->id])->assertRedirect();
    expect($this->vinculo->fresh()->obra)->toBe('Nombre incompleto ingresado manualmente');
    $this->get(route('costos.cuaderno.show', $this->project))->assertInertia(fn (Assert $page) => $page
        ->where('cuadernoDetectado.obra', $this->snapshot['identity']['obra'])->missing('cuadernoDetectado.session'));
    $this->post(route('costos.cuaderno.confirm', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertSessionHasErrors('confirmacion');
    $this->post(route('costos.cuaderno.confirm', $this->project), ['vinculo_id' => $this->vinculo->id, 'confirmacion' => true])
        ->assertRedirect();
    expect($this->vinculo->fresh()->obra)->toBe($this->snapshot['identity']['obra'])
        ->and($this->vinculo->fresh()->estado)->toBe('verificada')
        ->and($this->project->fresh()->codigo_cui)->toBe($originalProjectCui);
});

it('refuses confirmation if the official notebook changes after preview', function () {
    $changedIdentity = [...$this->snapshot['identity'], 'obra' => 'Otra obra CUI N° 2458710'];
    Http::fake(['127.0.0.1:43127/preview' => Http::sequence()
        ->push(['state' => 'ready', 'identity' => $this->snapshot['identity']])
        ->push(['state' => 'ready', 'identity' => $changedIdentity])]);
    $this->post(route('costos.cuaderno.preview', $this->project), ['vinculo_id' => $this->vinculo->id])->assertRedirect();
    $this->post(route('costos.cuaderno.confirm', $this->project), ['vinculo_id' => $this->vinculo->id, 'confirmacion' => true])
        ->assertSessionHasErrors('conexion');
    expect($this->vinculo->fresh()->obra)->toBe($this->snapshot['identity']['obra']);
});

it('does not mix existing seats with a different detected notebook', function () {
    $this->vinculo->asientos()->create($this->snapshot['rows'][0]);
    Http::fake(['127.0.0.1:43127/preview' => Http::response([
        'state' => 'ready', 'identity' => [...$this->snapshot['identity'], 'obra' => 'Otra obra CUI N° 2458710'],
    ])]);
    $this->post(route('costos.cuaderno.preview', $this->project), ['vinculo_id' => $this->vinculo->id])->assertRedirect();
    $this->post(route('costos.cuaderno.confirm', $this->project), ['vinculo_id' => $this->vinculo->id, 'confirmacion' => true])
        ->assertSessionHasErrors('conexion');
    expect($this->vinculo->fresh()->obra)->toBe($this->snapshot['identity']['obra'])
        ->and($this->vinculo->asientos()->count())->toBe(1);
});

it('creates the link from the first connection without a manual form', function () {
    $project = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    Http::fake(['127.0.0.1:43127/connect' => Http::response(['state' => 'intervention'])]);
    $this->post(route('costos.cuaderno.connect', $project), ['usuario' => 'usuario-prueba', 'password' => 'clave-ficticia'])
        ->assertRedirect(route('costos.cuaderno.show', $project));
    $vinculo = $project->cuadernoVinculos()->sole();
    expect($vinculo->estado)->toBe('pendiente_verificacion')
        ->and($vinculo->entidad)->toBeNull()
        ->and($vinculo->conexion_estado)->toBe('requiere_intervencion')
        ->and($vinculo->tiene_sesion)->toBeTrue();
});

it('refuses to import before the detected notebook is confirmed', function () {
    $this->vinculo->entidad = null;
    $this->vinculo->save();
    $this->post(route('costos.cuaderno.sync', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertSessionHasErrors('conexion');
    Http::assertNothingSent();
});

it('reports background import progress without saving partial seats', function () {
    Http::fake(['127.0.0.1:43127/sync' => Http::sequence()
        ->push(['state' => 'syncing', 'progress' => ['page' => 3, 'rows' => 30, 'total' => 231]])
        ->push($this->snapshot)]);
    $this->post(route('costos.cuaderno.sync', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertRedirect()->assertSessionMissing('success');
    expect($this->vinculo->fresh()->conexion_estado)->toBe('sincronizando')
        ->and($this->vinculo->asientos()->count())->toBe(0);
    $this->get(route('costos.cuaderno.show', $this->project))->assertInertia(fn (Assert $page) => $page
        ->where('sincronizacion', ['page' => 3, 'rows' => 30, 'total' => 231]));
    $this->post(route('costos.cuaderno.sync', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertSessionHas('success');
    expect($this->vinculo->fresh()->conexion_estado)->toBe('conectada')
        ->and($this->vinculo->asientos()->count())->toBe(1);
    $this->get(route('costos.cuaderno.show', $this->project))->assertInertia(fn (Assert $page) => $page->where('sincronizacion', null));
});

it('shows the official login message when OECE rejects the credentials', function () {
    Http::fake(['127.0.0.1:43127/connect' => Http::response(['state' => 'login', 'message' => '<b>Usuario o clave incorrecta</b>'])]);
    $this->post(route('costos.cuaderno.connect', $this->project), [
        'vinculo_id' => $this->vinculo->id, 'usuario' => 'usuario-prueba', 'password' => 'clave-ficticia',
    ])->assertRedirect();
    expect($this->vinculo->fresh()->conexion_estado)->toBe('requiere_ingreso')
        ->and($this->vinculo->fresh()->conexion_mensaje)->toBe('OECE indica: Usuario o clave incorrecta');
});

it('takes the holder role from the selected notebook option', function () {
    $this->vinculo->forceFill(['rol' => null, 'estado' => 'pendiente_verificacion', 'cuadernos_disponibles' => [
        ['key' => str_repeat('a', 64), 'label' => 'Entidad piloto RESIDENTE DE OBRA Obra uno'],
    ]])->save();
    Http::fake(['127.0.0.1:43127/select' => Http::response(['state' => 'intervention'])]);
    $this->post(route('costos.cuaderno.select', $this->project), ['vinculo_id' => $this->vinculo->id, 'choice' => str_repeat('a', 64)])
        ->assertRedirect();
    expect($this->vinculo->fresh()->rol)->toBe('RESIDENTE DE OBRA')
        ->and($this->vinculo->fresh()->cuadernos_disponibles)->toBeNull();
});

it('stores a page outline privately for mapping new portal screens', function () {
    Storage::fake('local');
    Http::fake(['127.0.0.1:43127/capture' => Http::response(['state' => 'ready', 'outline' => ['path' => '/cuaderno-obra/detalle', 'controls' => []]])]);
    $this->post(route('costos.cuaderno.capture', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertSessionHas('success');
    $files = Storage::disk('local')->allFiles('cuaderno/diagnostico/'.$this->vinculo->id);
    expect($files)->toHaveCount(1)
        ->and(json_decode(Storage::disk('local')->get($files[0]), true)['path'])->toBe('/cuaderno-obra/detalle');
});

it('shows the official screen fields so the holder can answer 2FA from costs', function () {
    Http::fake(['127.0.0.1:43127/screen' => Http::response([
        'state' => 'intervention',
        'screen' => [
            'path' => '/cuaderno-obra/verificacion', 'text' => 'Ingrese el código enviado a su correo',
            'fields' => [['ref' => 1, 'kind' => 'text', 'label' => 'Código'], ['ref' => 2, 'kind' => 'button', 'label' => 'Validar']],
            'viewport' => ['width' => 1280, 'height' => 900], 'shot' => null, 'extra' => 'ignored',
        ],
    ])]);
    $this->postJson(route('costos.cuaderno.screen', $this->project), ['vinculo_id' => $this->vinculo->id])
        ->assertOk()
        ->assertJsonPath('conexion_estado', 'requiere_intervencion')
        ->assertJsonPath('screen.fields.1.label', 'Validar')
        ->assertJsonMissingPath('screen.extra');
});

it('forwards the filled 2FA form to the invisible browser', function () {
    Http::fake(['127.0.0.1:43127/interact' => Http::response(['state' => 'ready', 'screen' => ['fields' => []]])]);
    $this->postJson(route('costos.cuaderno.interact', $this->project), [
        'vinculo_id' => $this->vinculo->id, 'kind' => 'form', 'fields' => [['ref' => 1, 'value' => '123456']], 'submit' => 2,
    ])->assertOk()->assertJsonPath('conexion_estado', 'conectada');
    Http::assertSent(fn ($request) => $request['kind'] === 'form' && $request['fields'][0]['value'] === '123456'
        && $request['submit'] === 2 && $request['session'] === $this->vinculo->session_key);
});

it('validates remote actions and blocks other owners', function () {
    $this->postJson(route('costos.cuaderno.interact', $this->project), ['vinculo_id' => $this->vinculo->id, 'kind' => 'script'])
        ->assertUnprocessable()->assertJsonValidationErrors('kind');
    $this->postJson(route('costos.cuaderno.interact', $this->project), ['vinculo_id' => $this->vinculo->id, 'kind' => 'click', 'x' => 9999, 'y' => 1])
        ->assertUnprocessable()->assertJsonValidationErrors('x');
    $this->actingAs(User::factory()->create());
    $this->postJson(route('costos.cuaderno.screen', $this->project), ['vinculo_id' => $this->vinculo->id])->assertForbidden();
    Http::assertNothingSent();
});

it('replaces the linked notebook on request, keeping the old one and its entries in history', function () {
    $this->vinculo->asientos()->create($this->snapshot['rows'][0]);
    $other = [...$this->snapshot['identity'], 'obra' => 'Otra obra CUI N° 2444383', 'codigo_cui' => '2444383'];
    Http::fake(['127.0.0.1:43127/preview' => Http::response(['state' => 'ready', 'identity' => $other])]);
    $this->post(route('costos.cuaderno.preview', $this->project), ['vinculo_id' => $this->vinculo->id]);
    $this->post(route('costos.cuaderno.confirm', $this->project), ['vinculo_id' => $this->vinculo->id, 'confirmacion' => true, 'reemplazar' => true])
        ->assertRedirect()->assertSessionHasNoErrors();

    $old = $this->vinculo->fresh();
    $new = $this->project->cuadernoVinculos()->where('active_slot', 1)->sole();
    expect($old->active_slot)->toBeNull()
        ->and($old->tiene_sesion)->toBeFalse()
        ->and($old->asientos()->count())->toBe(1)
        ->and($new->obra)->toBe('Otra obra CUI N° 2444383')
        ->and($new->estado)->toBe('verificada')
        ->and($new->session_key)->toBe('11111111-1111-4111-8111-111111111111')
        ->and($new->asientos()->count())->toBe(0);
});

it('opens the official notebook selection to change the work', function () {
    Http::fake(['127.0.0.1:43127/switch' => Http::response(['state' => 'selection', 'choices' => [
        ['key' => str_repeat('b', 64), 'label' => 'Entidad piloto SUPERVISOR Obra dos CUI N° 2444383'],
    ]])]);
    $this->post(route('costos.cuaderno.switch', $this->project), ['vinculo_id' => $this->vinculo->id])->assertRedirect();
    expect($this->vinculo->fresh()->conexion_estado)->toBe('seleccionar_cuaderno')
        ->and($this->vinculo->fresh()->cuadernos_disponibles)->toHaveCount(1);
});

it('does not start the connector process when autostart is disabled', function () {
    config(['cuaderno.runner_autostart' => false]);
    $this->post(route('costos.cuaderno.runner.start', $this->project))->assertSessionHasErrors('conector');
    $this->actingAs(User::factory()->create())
        ->post(route('costos.cuaderno.runner.start', $this->project))->assertForbidden();
    Http::assertNothingSent();
});
