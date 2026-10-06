<?php

namespace App\Http\Controllers\Cuaderno;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cuaderno\FinishCuadernoTareaRequest;
use App\Http\Requests\Cuaderno\PairCuadernoAgenteRequest;
use App\Http\Requests\Cuaderno\UploadCuadernoArchivoRequest;
use App\Models\CuadernoAgente;
use App\Models\CuadernoTarea;
use App\Services\Cuaderno\CuadernoAgentPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** API used by the connector installed on the holder's computer. */
class CuadernoAgenteApiController extends Controller
{
    public const PAIRING_PREFIX = 'cuaderno-emparejar:';

    public function pair(PairCuadernoAgenteRequest $request): JsonResponse
    {
        $userId = Cache::pull(self::PAIRING_PREFIX.$request->validated('codigo'));
        if (! $userId) {
            return response()->json(['message' => 'El código venció o ya se usó. Genera uno nuevo en Costos.'], 422);
        }
        $token = Str::random(64);
        $agente = new CuadernoAgente;
        $agente->forceFill([
            'user_id' => $userId,
            'nombre' => $request->validated('nombre'),
            'plataforma' => $request->validated('plataforma'),
            'version' => $request->validated('version'),
            'tipo' => $request->validated('tipo') ?? 'pc',
            'token_hash' => hash('sha256', $token),
            'last_seen_at' => now(),
        ])->save();

        // The plain token is only returned here, once.
        return response()->json(['token' => $token, 'nombre' => $agente->nombre]);
    }

    /** Small Windows launcher: downloads the PowerShell installer bound to this code. */
    public function installer(Request $request, string $codigo): Response
    {
        $this->ensurePairingCode($codigo);
        $script = $request->getSchemeAndHttpHost().'/api/cuaderno-agente/instalador/'.$codigo.'/script';
        $lines = [
            '@echo off',
            'title Conector del Cuaderno - Costos',
            'echo Instalando el conector del Cuaderno de incidencias de Costos...',
            'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=\'Tls12\'; $w=New-Object Net.WebClient; $w.Encoding=[Text.Encoding]::UTF8; iex $w.DownloadString(\''.$script.'\')"',
            'echo.',
            'pause',
        ];

        return response(implode("\r\n", $lines)."\r\n", 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="instalar-conector-costos.cmd"',
            'Cache-Control' => 'no-store',
        ]);
    }

    public function installerScript(Request $request, string $codigo): Response
    {
        $this->ensurePairingCode($codigo);
        $script = str_replace(
            ['__SERVIDOR__', '__CODIGO__', '__NODE__'],
            [$request->getSchemeAndHttpHost(), $codigo, config('cuaderno.agent_node_version', 'v24.4.1')],
            (string) file_get_contents(resource_path('cuaderno/instalar-conector.ps1')),
        );

        return response($script, 200, ['Content-Type' => 'text/plain; charset=utf-8', 'Cache-Control' => 'no-store']);
    }

    /** Connector files: for the installer (valid pairing code) or for self-update (token). */
    public function package(Request $request, CuadernoAgentPackage $package): JsonResponse
    {
        $token = (string) $request->bearerToken();
        $byToken = strlen($token) >= 40 && CuadernoAgente::query()->active()->where('token_hash', hash('sha256', $token))->exists();
        $code = (string) $request->query('codigo');
        $byCode = preg_match('/^[A-Z2-9]{8}$/', $code) === 1 && Cache::has(self::PAIRING_PREFIX.$code);
        abort_unless($byToken || $byCode, 403);

        return response()->json(['version' => $package->version(), 'files' => $package->files()]);
    }

    /** Next task for this computer; erases the password from the server once taken. */
    public function next(Request $request, CuadernoAgentPackage $package): JsonResponse|Response
    {
        $agente = $request->attributes->get('cuadernoAgente');
        CuadernoTarea::query()->where('expires_at', '<', now()->subDay())->delete();
        $tarea = DB::transaction(function () use ($agente): ?CuadernoTarea {
            $tarea = CuadernoTarea::query()->where('cuaderno_agente_id', $agente->id)
                ->where('status', 'pendiente')->where('expires_at', '>', now())
                ->oldest()->lockForUpdate()->first();
            if (! $tarea) {
                return null;
            }
            $payload = $tarea->payload;
            $tarea->forceFill(['status' => 'tomada', 'taken_at' => now(), 'payload' => null])->save();
            $tarea->setAttribute('entrega', $payload);

            return $tarea;
        });
        $headers = ['X-Agente-Version-Servidor' => $package->version()];
        if (! $tarea) {
            return response()->noContent(204, $headers);
        }

        return response()->json([
            'id' => $tarea->id,
            'action' => $tarea->action,
            'payload' => $tarea->getAttribute('entrega') ?? [],
        ], 200, $headers);
    }

    /** Official PDF downloaded by the connector, stored where CuadernoRunner expects it. */
    public function upload(UploadCuadernoArchivoRequest $request, CuadernoTarea $tarea): Response
    {
        $this->ensureOwnTask($request, $tarea);
        $path = $request->validated('path');
        abort_unless($tarea->sesion && str_starts_with($path, 'cuaderno-downloads/'.$tarea->sesion.'/'), 422);
        Storage::disk('local')->putFileAs(dirname($path), $request->file('archivo'), basename($path));

        return response()->noContent();
    }

    public function finish(FinishCuadernoTareaRequest $request, CuadernoTarea $tarea): Response
    {
        $this->ensureOwnTask($request, $tarea);
        $tarea->forceFill([
            'status' => $request->validated('status'),
            'result' => $request->validated('status') === 'completada' ? $request->validated('result') : null,
            'error' => $request->validated('error'),
            'finished_at' => now(),
        ])->save();

        return response()->noContent();
    }

    private function ensureOwnTask(Request $request, CuadernoTarea $tarea): void
    {
        abort_unless($tarea->cuaderno_agente_id === $request->attributes->get('cuadernoAgente')->id
            && $tarea->status === 'tomada', 404);
    }

    private function ensurePairingCode(string $codigo): void
    {
        abort_unless(preg_match('/^[A-Z2-9]{8}$/', $codigo) === 1 && Cache::has(self::PAIRING_PREFIX.$codigo), 404, 'El código venció. Genera uno nuevo en Costos.');
    }
}
