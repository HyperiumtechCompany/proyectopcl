<?php

use App\Models\CostoProject;
use App\Models\CuadernoVinculo;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['cuaderno.enabled' => true, 'cuaderno.runner_token' => str_repeat('x', 64), 'cuaderno.runner_port' => 43127]);
    Http::preventStrayRequests();
    Storage::fake('local');
    $this->owner = User::factory()->create();
    $this->project = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->vinculo = new CuadernoVinculo(['entidad' => 'Entidad piloto', 'obra' => 'Obra piloto CUI N° 2444383', 'rol' => 'SUPERVISOR']);
    $this->vinculo->user_id = $this->owner->id;
    $this->vinculo->active_slot = 1;
    $this->vinculo->estado = 'verificada';
    $this->vinculo->session_key = '11111111-1111-4111-8111-111111111111';
    $this->project->cuadernoVinculos()->save($this->vinculo);
    $this->asiento = $this->vinculo->asientos()->create([
        'numero' => 231, 'titulo' => 'Presentación de la valorización N.° 05', 'tipo' => 'VALORIZACIONES Y METRADOS',
        'fecha_oficial' => '03/10/2026 09:16 PM', 'usuario' => 'Residente', 'rol' => 'RESIDENTE DE OBRA', 'estado' => 'DEFINITIVO',
    ]);
    $this->temporary = 'cuaderno-downloads/'.$this->vinculo->session_key.'/6636f44a-f0ff-4915-a0be-b30e6141cd5c';
    $this->reply = fn (array $overrides = []) => array_replace_recursive([
        'state' => 'ready',
        'identity' => ['entidad' => 'Entidad piloto', 'obra' => 'Obra piloto CUI N° 2444383', 'codigo_cui' => '2444383'],
        'asiento' => [
            'numero' => 231, 'external_id' => '3450BB3E-5D8F-4CD2-A3A0-07116EA0B459',
            'titulo' => 'PRESENTACIÓN DE LA VALORIZACIÓN N.° 05', 'tipo' => 'VALORIZACIONES Y METRADOS',
            'descripcion' => 'El residente deja constancia de la presentación de la valorización.',
            'referencia' => 'NINGUNO', 'fecha' => '03/10/2026 21:16', 'usuario' => 'Residente', 'rol' => 'RESIDENTE DE OBRA',
            'latitud' => '(*)', 'longitud' => '(*)',
        ],
        'pdf' => ['path' => $this->temporary],
    ], $overrides);
    $this->actingAs($this->owner);
});

it('stores the official detail and PDF privately and serves it only to the owner', function () {
    Storage::disk('local')->put($this->temporary, "%PDF-1.5\ncontenido oficial");
    Http::fake(['127.0.0.1:43127/asiento' => Http::response(($this->reply)())]);
    $this->postJson(route('costos.cuaderno.asientos.oficial', [$this->project, $this->asiento]))
        ->assertOk()->assertJsonPath('asiento.tiene_pdf', true);
    Http::assertSent(fn ($request) => $request['numero'] === 231 && $request['pdf'] === true);

    $asiento = $this->asiento->fresh();
    expect($asiento->external_id)->toBe('3450bb3e-5d8f-4cd2-a3a0-07116ea0b459')
        ->and($asiento->descripcion)->toContain('constancia')
        ->and($asiento->pdf_sha256)->toBe(hash('sha256', "%PDF-1.5\ncontenido oficial"))
        ->and(Storage::disk('local')->exists($this->temporary))->toBeFalse()
        ->and($asiento->toArray())->not->toHaveKey('pdf_path');

    $this->get(route('costos.cuaderno.asientos.pdf', [$this->project, $this->asiento]))
        ->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $this->actingAs(User::factory()->create())
        ->get(route('costos.cuaderno.asientos.pdf', [$this->project, $this->asiento]))->assertForbidden();
});

it('rejects a download that is not a PDF (for example an expired-session page)', function () {
    Storage::disk('local')->put($this->temporary, '<html>Tu sesión ha expirado</html>');
    Http::fake(['127.0.0.1:43127/asiento' => Http::response(($this->reply)())]);
    $this->postJson(route('costos.cuaderno.asientos.oficial', [$this->project, $this->asiento]))
        ->assertUnprocessable()->assertJsonValidationErrors('conexion');
    expect($this->asiento->fresh()->tiene_pdf)->toBeFalse()
        ->and(Storage::disk('local')->exists($this->temporary))->toBeFalse();
});

it('refuses a detail that belongs to another entry or notebook', function (array $overrides) {
    Storage::disk('local')->put($this->temporary, '%PDF-1.5');
    Http::fake(['127.0.0.1:43127/asiento' => Http::response(($this->reply)($overrides))]);
    $this->postJson(route('costos.cuaderno.asientos.oficial', [$this->project, $this->asiento]))
        ->assertUnprocessable()->assertJsonValidationErrors('conexion');
    expect($this->asiento->fresh()->detalle_at)->toBeNull();
})->with([
    'other title' => [['asiento' => ['titulo' => 'Otro asiento']]],
    'other notebook' => [['identity' => ['obra' => 'Otra obra']]],
    'path outside the session folder' => [['pdf' => ['path' => 'cuaderno-downloads/otra-sesion/6636f44a-f0ff-4915-a0be-b30e6141cd5c']]],
]);

it('downloads only the PDF quickly without touching the stored detail', function () {
    Storage::disk('local')->put($this->temporary, '%PDF-1.5 rapido');
    Http::fake(['127.0.0.1:43127/asiento' => Http::response([
        'state' => 'ready', 'identity' => ($this->reply)()['identity'],
        'asiento' => ['numero' => 231, 'titulo' => 'Presentación de la valorización N.° 05'],
        'pdf' => ['path' => $this->temporary],
    ])]);
    $this->postJson(route('costos.cuaderno.asientos.oficial', [$this->project, $this->asiento]), ['detalle' => false])
        ->assertOk()->assertJsonPath('asiento.tiene_pdf', true);
    Http::assertSent(fn ($request) => $request['detalle'] === false);
    expect($this->asiento->fresh()->detalle_at)->toBeNull();
});

it('zips the stored PDFs in number order for a range or a selection', function () {
    $row = ['tipo' => 'CONSULTA', 'fecha_oficial' => '01/10/2026', 'usuario' => 'U', 'rol' => 'R', 'estado' => 'DEFINITIVO'];
    foreach ([7 => 'Consulta: ¿plano?', 12 => 'Absolución', 40 => 'Fuera de rango'] as $numero => $titulo) {
        $asiento = $this->vinculo->asientos()->create([...$row, 'numero' => $numero, 'titulo' => $titulo]);
        Storage::disk('local')->put("cuaderno/pdf/{$this->vinculo->id}/asiento-{$numero}.pdf", '%PDF-'.$numero);
        $asiento->forceFill(['pdf_path' => "cuaderno/pdf/{$this->vinculo->id}/asiento-{$numero}.pdf"])->save();
    }
    $response = $this->get(route('costos.cuaderno.pdfs', [$this->project, 'desde' => 1, 'hasta' => 20]))->assertOk();
    $zip = new ZipArchive;
    $zip->open($response->getFile()->getPathname());
    $names = collect(range(0, $zip->numFiles - 1))->map(fn (int $index) => $zip->getNameIndex($index))->all();
    $zip->close();
    expect($names)->toBe(['0007 - Consulta ¿plano.pdf', '0012 - Absolución.pdf']);

    $this->from(route('costos.cuaderno.show', $this->project))
        ->get(route('costos.cuaderno.pdfs', [$this->project, 'desde' => 100]))
        ->assertRedirect()->assertSessionHas('error');
    $this->actingAs(User::factory()->create())
        ->get(route('costos.cuaderno.pdfs', $this->project))->assertForbidden();
});

it('asks to reconnect when the OECE session expired', function () {
    Http::fake(['127.0.0.1:43127/asiento' => Http::response(['state' => 'login', 'message' => 'La sesión de OECE expiró. Vuelve a conectar tu cuenta.'])]);
    $this->postJson(route('costos.cuaderno.asientos.oficial', [$this->project, $this->asiento]))
        ->assertUnprocessable()->assertJsonValidationErrors('conexion');
    expect($this->vinculo->fresh()->conexion_estado)->toBe('requiere_ingreso');
});
