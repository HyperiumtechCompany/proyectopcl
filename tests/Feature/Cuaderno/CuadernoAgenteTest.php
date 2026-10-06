<?php

use App\Http\Controllers\Cuaderno\CuadernoAgenteApiController;
use App\Models\CostoProject;
use App\Models\CuadernoAgente;
use App\Models\CuadernoTarea;
use App\Models\CuadernoVinculo;
use App\Models\User;
use App\Services\Cuaderno\CuadernoAgentBridge;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['cuaderno.enabled' => true, 'cuaderno.mode' => 'agent', 'cuaderno.agent_timeout' => 5]);
    $this->withoutVite();
    $this->owner = User::factory()->create();
    $this->project = CostoProject::factory()->create(['user_id' => $this->owner->id]);
    $this->pairAgent = function (?User $user = null): array {
        $code = 'ABCD2345';
        Cache::put(CuadernoAgenteApiController::PAIRING_PREFIX.$code, ($user ?? $this->owner)->id, now()->addMinutes(15));
        $token = $this->postJson(route('cuaderno-agente.pair'), ['codigo' => $code, 'nombre' => 'PC-OBRA', 'plataforma' => 'win32 10'])
            ->assertOk()->json('token');

        return [$token, CuadernoAgente::query()->latest('id')->first()];
    };
});

it('pairs a computer with a one-time code and stores only the token hash', function () {
    $this->actingAs($this->owner);
    $response = $this->postJson(route('costos.cuaderno.agent.code', $this->project))->assertOk();
    $code = $response->json('codigo');
    expect($code)->toMatch('/^[A-Z2-9]{8}$/');
    $this->get(route('cuaderno-agente.installer', $code))->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="instalar-conector-costos.cmd"');
    $this->get(route('cuaderno-agente.installer-script', $code))->assertOk()->assertSee($code, false);
    $this->getJson(route('cuaderno-agente.package', ['codigo' => $code]))->assertOk()
        ->assertJsonStructure(['version', 'files' => ['cuaderno-agent.mjs', 'cuaderno/engine.mjs']]);

    $token = $this->postJson(route('cuaderno-agente.pair'), ['codigo' => $code, 'nombre' => 'PC-OBRA'])->assertOk()->json('token');
    $agente = CuadernoAgente::query()->sole();
    expect($agente->user_id)->toBe($this->owner->id)
        ->and($agente->token_hash)->toBe(hash('sha256', $token))
        ->and($agente->toArray())->not->toHaveKey('token_hash');
    // Single use.
    $this->postJson(route('cuaderno-agente.pair'), ['codigo' => $code, 'nombre' => 'Otra'])->assertUnprocessable();
    $this->get(route('cuaderno-agente.installer', $code))->assertNotFound();
});

it('hands a task once to its own computer and erases the password from the server', function () {
    [$token, $agente] = ($this->pairAgent)();
    $tarea = new CuadernoTarea;
    $tarea->forceFill([
        'user_id' => $this->owner->id, 'cuaderno_agente_id' => $agente->id, 'action' => 'connect',
        'payload' => ['usuario' => 'u', 'password' => 'clave-ficticia', 'session' => '11111111-1111-4111-8111-111111111111'],
        'status' => 'pendiente', 'expires_at' => now()->addMinute(),
    ])->save();

    $this->withToken($token)->getJson(route('cuaderno-agente.next'))->assertOk()
        ->assertJsonPath('id', $tarea->id)->assertJsonPath('payload.password', 'clave-ficticia');
    expect($tarea->fresh()->status)->toBe('tomada')
        ->and($tarea->fresh()->getRawOriginal('payload'))->toBeNull();
    $this->withToken($token)->get(route('cuaderno-agente.next'))->assertNoContent();

    [$otherToken] = ($this->pairAgent)(User::factory()->create());
    $this->withToken($otherToken)->postJson(route('cuaderno-agente.finish', $tarea), ['status' => 'completada', 'result' => ['state' => 'ready']])
        ->assertNotFound();
    $this->withoutToken()->getJson(route('cuaderno-agente.next'))->assertUnauthorized();
});

it('keeps official empty fields and spacing exactly as the connector sends them', function () {
    [$token, $agente] = ($this->pairAgent)();
    $tarea = new CuadernoTarea;
    $tarea->forceFill(['user_id' => $this->owner->id, 'cuaderno_agente_id' => $agente->id, 'action' => 'sync', 'status' => 'tomada', 'expires_at' => now()->addMinute()])->save();
    $this->withToken($token)->postJson(route('cuaderno-agente.finish', $tarea), [
        'status' => 'completada', 'result' => ['state' => 'ready', 'rows' => [['tipo' => '', 'titulo' => ' Asiento ']]],
    ])->assertNoContent();
    expect($tarea->fresh()->result['rows'][0])->toBe(['tipo' => '', 'titulo' => ' Asiento ']);
});

it('stores an uploaded official PDF only inside the folder of the task session', function () {
    Storage::fake('local');
    [$token, $agente] = ($this->pairAgent)();
    $session = '11111111-1111-4111-8111-111111111111';
    $tarea = new CuadernoTarea;
    $tarea->forceFill(['user_id' => $this->owner->id, 'cuaderno_agente_id' => $agente->id, 'action' => 'asiento', 'sesion' => $session, 'status' => 'tomada', 'expires_at' => now()->addMinute()])->save();
    $file = UploadedFile::fake()->createWithContent('documento.pdf', '%PDF-1.5 oficial');
    $path = "cuaderno-downloads/{$session}/6636f44a-f0ff-4915-a0be-b30e6141cd5c";

    $this->withToken($token)->post(route('cuaderno-agente.upload', $tarea), ['path' => $path, 'archivo' => $file])->assertNoContent();
    expect(Storage::disk('local')->get($path))->toBe('%PDF-1.5 oficial');
    $this->withToken($token)->post(route('cuaderno-agente.upload', $tarea), [
        'path' => 'cuaderno-downloads/22222222-2222-4222-8222-222222222222/6636f44a-f0ff-4915-a0be-b30e6141cd5c', 'archivo' => $file,
    ])->assertUnprocessable();
});

it('runs a connection on the holder computer through the task bridge', function () {
    [, $agente] = ($this->pairAgent)();
    // Simulates the computer answering while Costos waits.
    app()->instance(CuadernoAgentBridge::class, new class extends CuadernoAgentBridge
    {
        protected function pause(): void
        {
            CuadernoTarea::query()->where('status', 'pendiente')->get()->each(function (CuadernoTarea $tarea): void {
                expect($tarea->payload['password'])->toBe('clave-ficticia');
                $tarea->forceFill(['status' => 'completada', 'result' => ['state' => 'intervention']])->save();
            });
        }
    });
    $this->actingAs($this->owner)
        ->post(route('costos.cuaderno.connect', $this->project), ['usuario' => 'usuario', 'password' => 'clave-ficticia'])
        ->assertRedirect()->assertSessionHasNoErrors();
    $vinculo = $this->project->cuadernoVinculos()->sole();
    expect($vinculo->conexion_estado)->toBe('requiere_intervencion')
        ->and($vinculo->cuaderno_agente_id)->toBe($agente->id)
        ->and(CuadernoTarea::count())->toBe(0);
});

it('explains that the connector is off instead of waiting', function () {
    [, $agente] = ($this->pairAgent)();
    $agente->forceFill(['last_seen_at' => now()->subMinutes(5)])->save();
    $this->actingAs($this->owner)
        ->post(route('costos.cuaderno.connect', $this->project), ['usuario' => 'usuario', 'password' => 'clave'])
        ->assertSessionHasErrors('conexion');
    expect(CuadernoTarea::count())->toBe(0);
});

it('connects through the browser extension without any credentials in Costos', function () {
    $code = 'EXTN2345';
    Cache::put(CuadernoAgenteApiController::PAIRING_PREFIX.$code, $this->owner->id, now()->addMinutes(15));
    $this->postJson(route('cuaderno-agente.pair'), ['codigo' => $code, 'nombre' => 'Chrome · Windows', 'tipo' => 'extension'])->assertOk();
    expect(CuadernoAgente::query()->sole()->tipo)->toBe('extension');
    app()->instance(CuadernoAgentBridge::class, new class extends CuadernoAgentBridge
    {
        protected function pause(): void
        {
            CuadernoTarea::query()->where('status', 'pendiente')->get()->each(function (CuadernoTarea $tarea): void {
                expect($tarea->payload)->not->toHaveKey('password');
                $tarea->forceFill(['status' => 'completada', 'result' => ['state' => 'intervention', 'message' => 'Inicia sesión en la pestaña de OECE.']])->save();
            });
        }
    });
    $this->actingAs($this->owner)
        ->post(route('costos.cuaderno.connect', $this->project))
        ->assertRedirect()->assertSessionHasNoErrors();
    expect($this->project->cuadernoVinculos()->sole()->conexion_estado)->toBe('requiere_intervencion');
    $this->get(route('costos.cuaderno.show', $this->project))->assertOk();
});

it('still asks for credentials when only the desktop connector is online', function () {
    ($this->pairAgent)();
    $this->actingAs($this->owner)
        ->post(route('costos.cuaderno.connect', $this->project))
        ->assertSessionHasErrors(['usuario', 'password']);
    expect(CuadernoTarea::count())->toBe(0);
});

it('builds the test copy of the browser extension for this Costos site', function () {
    $response = $this->actingAs($this->owner)->get(route('costos.cuaderno.agent.extension', $this->project))->assertOk();
    $zip = new ZipArchive;
    $zip->open($response->getFile()->getPathname());
    $manifest = json_decode($zip->getFromName('manifest.json'), true);
    $dom = $zip->getFromName('dom.js');
    $zip->close();
    $site = rtrim((string) config('app.url'), '/').'/*';
    expect($manifest['manifest_version'])->toBe(3)
        ->and($manifest['host_permissions'])->toContain('https://apps.oece.gob.pe/*', $site)
        ->and($manifest['content_scripts'][0]['matches'])->toContain($site)
        ->and($dom)->toContain('export function inspectPortal');
    $this->actingAs(User::factory()->create())
        ->get(route('costos.cuaderno.agent.extension', $this->project))->assertForbidden();
});

it('revokes a computer and ends the connections that lived on it', function () {
    [$token, $agente] = ($this->pairAgent)();
    $vinculo = new CuadernoVinculo(['entidad' => 'E', 'obra' => 'O']);
    $vinculo->forceFill(['user_id' => $this->owner->id, 'active_slot' => 1, 'estado' => 'verificada', 'session_key' => '11111111-1111-4111-8111-111111111111', 'cuaderno_agente_id' => $agente->id]);
    $this->project->cuadernoVinculos()->save($vinculo);

    $this->actingAs(User::factory()->create())
        ->delete(route('costos.cuaderno.agent.revoke', [$this->project, $agente]))->assertForbidden();
    $this->actingAs($this->owner)
        ->delete(route('costos.cuaderno.agent.revoke', [$this->project, $agente]))->assertRedirect();
    expect($agente->fresh()->revoked_at)->not->toBeNull()
        ->and($vinculo->fresh()->tiene_sesion)->toBeFalse();
    $this->withToken($token)->getJson(route('cuaderno-agente.next'))->assertUnauthorized();
});
