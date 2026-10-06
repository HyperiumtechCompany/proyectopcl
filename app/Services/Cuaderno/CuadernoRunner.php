<?php

namespace App\Services\Cuaderno;

use App\Http\Requests\Cuaderno\StoreCuadernoVinculoRequest;
use App\Models\CostoProject;
use App\Models\CuadernoAsiento;
use App\Models\CuadernoVinculo;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CuadernoRunner
{
    public const STATES = ['login', 'intervention', 'selection', 'ready', 'disconnected', 'syncing'];

    public function health(): bool
    {
        $token = config('cuaderno.runner_token');
        if (! $this->configured()) {
            return false;
        }
        try {
            return Http::withToken($token)->acceptJson()->connectTimeout(1)->timeout(2)
                ->get('http://127.0.0.1:'.config('cuaderno.runner_port').'/health')->json('ready') === true;
        } catch (ConnectionException) {
            return false;
        }
    }

    public function configured(): bool
    {
        $token = config('cuaderno.runner_token');
        $port = config('cuaderno.runner_port');

        return is_string($token) && strlen($token) >= 32 && $port >= 1024 && $port <= 65535;
    }

    public function execute(CuadernoVinculo $vinculo, string $action, array $data = []): array
    {
        if (! $this->configured()) {
            throw ValidationException::withMessages(['conexion' => 'El conector local no está configurado.']);
        }
        if ($action === 'sync' && ! $vinculo->entidad) {
            throw ValidationException::withMessages(['conexion' => 'Confirma el cuaderno detectado antes de importar sus asientos.']);
        }
        if (! $vinculo->session_key) {
            if ($action !== 'connect') {
                throw ValidationException::withMessages(['conexion' => 'Conecta tu cuenta OECE primero.']);
            }
            DB::transaction(function () use ($vinculo): void {
                CostoProject::query()->whereKey($vinculo->costo_project_id)->lockForUpdate()->firstOrFail();
                $current = CuadernoVinculo::query()->whereKey($vinculo->id)->where('active_slot', 1)->first();
                if (! $current) {
                    throw ValidationException::withMessages(['conexion' => 'La vinculación cambió. Vuelve a cargar el proyecto.']);
                }
                if (! $current->session_key) {
                    $current->session_key = (string) Str::uuid();
                    $current->save();
                }
                $vinculo->session_key = $current->session_key;
            });
        }
        try {
            $response = Http::withToken(config('cuaderno.runner_token'))->acceptJson()->connectTimeout(3)->timeout(55)
                ->post('http://127.0.0.1:'.config('cuaderno.runner_port')."/{$action}", [
                    ...$data, 'session' => $vinculo->session_key,
                ]);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['conexion' => 'El conector local no responde. Inícialo y vuelve a intentar.']);
        }
        if (! $response->successful()) {
            $message = match ($response->json('error')) {
                'session_missing', 'browser_closed', 'session_expired' => 'La sesión terminó. Conecta nuevamente tu cuenta.',
                'operation_busy' => 'Hay una operación en curso. Espera antes de volver a intentar.',
                'selection_changed' => 'La selección del cuaderno cambió. Actualiza la conexión.',
                'notebook_changed' => 'El cuaderno cambió durante la importación. No se guardaron los datos.',
                'asiento_not_found' => 'Ese asiento no aparece en la bandeja de OECE. Sincroniza y vuelve a intentar.',
                'download_timeout', 'download_failed' => 'OECE no terminó de entregar el PDF. Vuelve a intentar.',
                'screen_changed' => 'La pantalla de OECE cambió. Revisa los datos y vuelve a enviar.',
                'submit_disabled' => 'OECE no habilitó el botón. Revisa que los campos estén completos.',
                'sync_cancelled' => 'La importación se canceló. No se guardaron los datos.',
                'browser_not_found' => 'No se encontró Chrome ni Edge. Instala uno o indica CUADERNO_BROWSER_PATH.',
                'login_form_not_found' => 'No se encontró el formulario de ingreso de OECE. Revisa la ventana del conector.',
                'pagination_not_changed', 'pagination_repeated', 'pagination_limit', 'portal_structure_changed' => 'La estructura o paginación del portal no coincide. No se ha confirmado una importación completa.',
                default => 'No se pudo completar la operación con OECE. Revisa el navegador del conector.',
            };
            throw ValidationException::withMessages(['conexion' => $message]);
        }
        $result = $response->json();
        if (! is_array($result) || ! in_array($result['state'] ?? null, self::STATES, true)) {
            throw ValidationException::withMessages(['conexion' => 'El conector devolvió una respuesta inválida.']);
        }
        $this->rememberDetected($vinculo, $result);
        $this->rememberProgress($vinculo, $result);
        if ($action === 'capture') {
            $result['capture_path'] = $this->storeOutline($vinculo, $result['outline'] ?? null);
        }
        DB::transaction(function () use ($vinculo, $result, $action, $data): void {
            CostoProject::query()->whereKey($vinculo->costo_project_id)->lockForUpdate()->firstOrFail();
            $current = CuadernoVinculo::query()->whereKey($vinculo->id)->where('active_slot', 1)->first();
            if (! $current) {
                throw ValidationException::withMessages(['conexion' => 'La vinculación cambió. Vuelve a cargar el proyecto.']);
            }
            $current->conexion_estado = match ($result['state']) {
                'ready' => 'conectada', 'disconnected' => 'desconectada', 'syncing' => 'sincronizando',
                'selection' => 'seleccionar_cuaderno', 'login' => 'requiere_ingreso', default => 'requiere_intervencion',
            };
            $current->conexion_mensaje = match ($result['state']) {
                'login' => is_string($result['message'] ?? null) && $result['message'] !== ''
                    ? 'OECE indica: '.Str::limit(strip_tags($result['message']), 300)
                    : 'OECE no aceptó el ingreso. Revisa usuario y contraseña.',
                'intervention' => 'Completa el segundo factor o los términos oficiales en la ventana del conector. Costos lo detectará solo.',
                'selection' => 'Elige el cuaderno que corresponde a este proyecto.',
                'syncing' => 'Importando asientos de la bandeja oficial…',
                'ready' => $current->estado === 'verificada' ? 'Sesión activa.' : 'Revisa el cuaderno detectado y confírmalo.',
                default => null,
            };
            if ($action === 'select') {
                $role = $this->roleFromChoice($current->cuadernos_disponibles ?? [], $data['choice'] ?? null);
                if (! $current->rol && $current->estado !== 'verificada') {
                    $current->rol = $role;
                }
                // Kept in case the holder replaces the linked notebook with this one.
                Cache::put('cuaderno-rol-elegido:'.$current->id, $role, now()->addHour());
            }
            if ($result['state'] !== 'syncing') {
                $current->cuadernos_disponibles = $result['state'] === 'selection'
                    ? Validator::make($result, [
                        'choices' => ['required', 'array', 'max:200'],
                        'choices.*.key' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
                        'choices.*.label' => ['required', 'string', 'max:4000'],
                    ])->validate()['choices'] : null;
            }
            if ($action === 'sync' && $result['state'] === 'ready') {
                $this->import($current, $result);
            }
            if ($result['state'] === 'disconnected') {
                $current->session_key = null;
            }
            $current->save();
        });

        if ($action === 'sync' && $result['state'] === 'ready') {
            $result['complete'] = $vinculo->fresh()->sync_completa;
        }

        return $result;
    }

    public function confirm(CuadernoVinculo $vinculo, bool $replace = false): CuadernoVinculo
    {
        $expected = Cache::get('cuaderno-detectado:'.$vinculo->id);
        if (! $expected || ($expected['session'] ?? null) !== $vinculo->session_key) {
            throw ValidationException::withMessages(['conexion' => 'Detecta el cuaderno antes de confirmarlo.']);
        }
        $result = $this->execute($vinculo, 'preview');
        if ($result['state'] !== 'ready' || ($result['identity'] ?? null) !== $expected['identity']) {
            throw ValidationException::withMessages(['conexion' => 'El cuaderno abierto cambió. Revisa los datos detectados y vuelve a confirmar.']);
        }

        return DB::transaction(function () use ($vinculo, $expected, $replace): CuadernoVinculo {
            CostoProject::query()->whereKey($vinculo->costo_project_id)->lockForUpdate()->firstOrFail();
            $current = CuadernoVinculo::query()->whereKey($vinculo->id)->where('active_slot', 1)->firstOrFail();
            $identity = $expected['identity'];
            $differs = $current->entidad !== $identity['entidad'] || $current->obra !== $identity['obra']
                || $current->codigo_cui !== ($identity['codigo_cui'] ?? null);
            if (($current->asientos()->exists() || $current->estado === 'verificada') && $differs) {
                if (! $replace) {
                    throw ValidationException::withMessages(['conexion' => 'Es otro cuaderno. Confirma el reemplazo para vincularlo; el anterior queda en el historial con sus asientos.']);
                }
                // The open browser session moves to the new link; entries never mix.
                $sessionKey = $current->session_key;
                $current->forceFill([
                    'active_slot' => null, 'estado' => 'revocada', 'revoked_at' => now(),
                    'session_key' => null, 'conexion_estado' => 'desconectada', 'conexion_mensaje' => null,
                ])->save();
                $current = new CuadernoVinculo($identity);
                $current->forceFill([
                    'user_id' => $vinculo->user_id, 'active_slot' => 1, 'session_key' => $sessionKey,
                    'rol' => Cache::pull('cuaderno-rol-elegido:'.$vinculo->id), 'conexion_estado' => 'conectada',
                ]);
                $current->costo_project_id = $vinculo->costo_project_id;
            }
            $current->fill($identity);
            $current->estado = 'verificada';
            $current->conexion_mensaje = 'Sesión activa.';
            $current->save();

            return $current;
        });
    }

    /**
     * Reads the official detail of one entry and stores its official PDF privately.
     * The PDF is the file issued by OECE; it is never regenerated by Costos.
     */
    public function fetchAsiento(CuadernoVinculo $vinculo, CuadernoAsiento $asiento, bool $withPdf = true, bool $withDetail = true): CuadernoAsiento
    {
        $result = $this->execute($vinculo, 'asiento', ['numero' => $asiento->numero, 'pdf' => $withPdf, 'detalle' => $withDetail]);
        $detailRule = $withDetail ? 'present' : 'sometimes';
        if ($result['state'] !== 'ready' || ! isset($result['asiento'])) {
            throw ValidationException::withMessages(['conexion' => $vinculo->fresh()->conexion_mensaje
                ?? 'OECE no mostró el asiento. Revisa la conexión.']);
        }
        $validator = Validator::make($result, [
            'identity.entidad' => ['required', 'string', 'max:255'],
            'identity.obra' => ['required', 'string', 'max:3000'],
            'asiento.external_id' => [$withDetail ? 'required' : 'sometimes', 'uuid'],
            'asiento.titulo' => ['required', 'string', 'max:10000'],
            'asiento.descripcion' => [$detailRule, 'string', 'max:200000'],
            'asiento.referencia' => [$detailRule, 'string', 'max:500'],
            'asiento.latitud' => [$detailRule, 'string', 'max:50'],
            'asiento.longitud' => [$detailRule, 'string', 'max:50'],
            'pdf' => ['nullable', 'array'],
            'pdf.path' => ['required_with:pdf', 'string', 'regex:#^cuaderno-downloads/'.preg_quote($vinculo->session_key, '#').'/[a-f0-9-]{36}$#'],
        ]);
        if ($validator->fails()) {
            throw ValidationException::withMessages(['conexion' => 'El conector devolvió datos no válidos para el asiento N.º '.$asiento->numero.'. No se guardó.']);
        }
        $data = $validator->validated();
        $normalize = static fn (?string $value): string => preg_replace('/[^A-Z0-9]/', '', Str::upper(Str::ascii($value ?? '')));
        if ($normalize($data['identity']['entidad']) !== $normalize($vinculo->entidad)
            || $normalize($data['identity']['obra']) !== $normalize($vinculo->obra)) {
            throw ValidationException::withMessages(['conexion' => 'El asiento abierto pertenece a otro cuaderno. No se guardó.']);
        }
        // The row opened by number must be the same entry imported from the inbox.
        if ($normalize($data['asiento']['titulo']) !== $normalize($asiento->titulo)) {
            throw ValidationException::withMessages(['conexion' => 'El detalle de OECE no coincide con el asiento N.º '.$asiento->numero.'. Sincroniza la bandeja y vuelve a intentar.']);
        }

        $disk = Storage::disk('local');
        $pdfPath = null;
        if ($data['pdf']['path'] ?? null) {
            $temporary = $data['pdf']['path'];
            $size = $disk->exists($temporary) ? $disk->size($temporary) : 0;
            $stream = $size ? $disk->readStream($temporary) : null;
            $header = $stream ? fread($stream, 5) : '';
            if (is_resource($stream)) {
                fclose($stream);
            }
            // A login page or an error message saved as a "download" is rejected.
            if ($header !== '%PDF-' || $size > 100 * 1024 * 1024) {
                $disk->delete($temporary);
                throw ValidationException::withMessages(['conexion' => 'OECE no entregó un PDF válido para el asiento N.º '.$asiento->numero.'.']);
            }
            $pdfPath = 'cuaderno/pdf/'.$vinculo->id.'/asiento-'.$asiento->numero.'.pdf';
            $disk->delete($pdfPath);
            $disk->move($temporary, $pdfPath);
        }

        $detail = $data['asiento'];
        if ($withDetail) {
            $asiento->forceFill([
                'external_id' => Str::lower($detail['external_id']),
                'descripcion' => $detail['descripcion'],
                'referencia' => $detail['referencia'],
                'latitud' => $detail['latitud'],
                'longitud' => $detail['longitud'],
                'detalle_at' => now(),
            ]);
        }
        if ($pdfPath) {
            $asiento->forceFill([
                'pdf_path' => $pdfPath,
                'pdf_sha256' => hash_file('sha256', $disk->path($pdfPath)),
                'pdf_bytes' => $disk->size($pdfPath),
                'pdf_at' => now(),
            ]);
        }
        $asiento->save();

        return $asiento;
    }

    /** @return array{page: int, rows: int, total: int|null}|null */
    public function progress(CuadernoVinculo $vinculo): ?array
    {
        $progress = Cache::get('cuaderno-sync:'.$vinculo->id);

        return $vinculo->conexion_estado === 'sincronizando' && is_array($progress) ? $progress : null;
    }

    private function rememberDetected(CuadernoVinculo $vinculo, array $result): void
    {
        $cacheKey = 'cuaderno-detectado:'.$vinculo->id;
        if ($result['state'] === 'ready' && isset($result['identity'])) {
            $identity = Validator::make($result, [
                'identity.entidad' => ['required', 'string', 'max:255'],
                'identity.obra' => ['required', 'string', 'max:3000'],
                'identity.codigo_cui' => ['nullable', 'string', 'max:50'],
            ])->validate()['identity'];
            Cache::put($cacheKey, ['identity' => $identity, 'session' => $vinculo->session_key], now()->addHour());
        } elseif ($result['state'] !== 'syncing') {
            Cache::forget($cacheKey);
        }
    }

    private function rememberProgress(CuadernoVinculo $vinculo, array $result): void
    {
        if ($result['state'] !== 'syncing') {
            Cache::forget('cuaderno-sync:'.$vinculo->id);

            return;
        }
        $progress = Validator::make($result, [
            'progress.page' => ['required', 'integer', 'min:0'],
            'progress.rows' => ['required', 'integer', 'min:0'],
            'progress.total' => ['nullable', 'integer', 'min:0'],
        ])->validate()['progress'];
        Cache::put('cuaderno-sync:'.$vinculo->id, $progress, now()->addMinutes(20));
    }

    private function storeOutline(CuadernoVinculo $vinculo, mixed $outline): string
    {
        $json = is_array($outline) ? json_encode($outline, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : false;
        if ($json === false || strlen($json) > 2_000_000) {
            throw ValidationException::withMessages(['conexion' => 'No se pudo capturar la estructura de la página abierta en el conector.']);
        }
        $path = 'cuaderno/diagnostico/'.$vinculo->id.'/'.now()->format('Ymd-His').'.json';
        Storage::disk('local')->put($path, $json);

        return $path;
    }

    /** The selection screen lists the holder's role inside each notebook option. */
    private function roleFromChoice(array $choices, ?string $key): ?string
    {
        $label = collect($choices)->firstWhere('key', $key)['label'] ?? null;
        if (! is_string($label)) {
            return null;
        }
        $normalize = static fn (string $value): string => Str::upper(Str::ascii($value));

        return collect(StoreCuadernoVinculoRequest::ROLES)
            ->first(fn (string $role): bool => str_contains($normalize($label), $normalize($role)));
    }

    private function import(CuadernoVinculo $vinculo, array $result): void
    {
        $validated = Validator::make($result, [
            'identity.entidad' => ['required', 'string', 'max:255'],
            'identity.obra' => ['required', 'string', 'max:3000'],
            'identity.codigo_cui' => ['nullable', 'string', 'max:50'],
            'rows' => ['present', 'array', 'max:10000'],
            'rows.*' => ['array:numero,titulo,tipo,fecha_oficial,usuario,rol,estado'],
            'rows.*.numero' => ['required', 'integer', 'min:1', 'distinct'],
            'rows.*.titulo' => ['required', 'string', 'max:10000'],
            'rows.*.tipo' => ['present', 'string', 'max:255'],
            'rows.*.fecha_oficial' => ['present', 'string', 'max:100'],
            'rows.*.usuario' => ['present', 'string', 'max:255'],
            'rows.*.rol' => ['present', 'string', 'max:100'],
            'rows.*.estado' => ['present', 'string', 'max:100'],
            'total' => ['required', 'integer', 'min:0'],
            'complete' => ['required', 'boolean'],
        ])->validate();
        $normalize = static fn (?string $value): string => preg_replace('/[^A-Z0-9]/', '', Str::upper(Str::ascii($value ?? '')));
        if ($normalize($validated['identity']['entidad']) !== $normalize($vinculo->entidad)
            || $normalize($validated['identity']['obra']) !== $normalize($vinculo->obra)
            || ($vinculo->codigo_cui && ($validated['identity']['codigo_cui'] ?? null) !== $vinculo->codigo_cui)) {
            throw ValidationException::withMessages(['conexion' => 'El cuaderno abierto no coincide con la entidad, obra o CUI guardados. Corrige la vinculación antes de importar.']);
        }
        if (count($validated['rows']) > $validated['total']
            || ($validated['complete'] && count($validated['rows']) !== $validated['total'])) {
            throw ValidationException::withMessages(['conexion' => 'La cantidad importada no coincide con el total oficial.']);
        }
        $now = now();
        $rows = array_map(static fn (array $row): array => [
            ...$row, 'cuaderno_vinculo_id' => $vinculo->id, 'created_at' => $now, 'updated_at' => $now,
        ], $validated['rows']);
        foreach (array_chunk($rows, 200) as $chunk) {
            CuadernoAsiento::upsert($chunk, ['cuaderno_vinculo_id', 'numero'], [
                'titulo', 'tipo', 'fecha_oficial', 'usuario', 'rol', 'estado', 'updated_at',
            ]);
        }
        $vinculo->estado = 'verificada';
        $vinculo->total_oficial = $validated['total'];
        $vinculo->sync_completa = $validated['complete'] && $vinculo->asientos()->count() === $validated['total'];
        $vinculo->conexion_mensaje = 'Sesión activa.';
        if ($vinculo->sync_completa) {
            $vinculo->last_synced_at = $now;
        }
    }
}
