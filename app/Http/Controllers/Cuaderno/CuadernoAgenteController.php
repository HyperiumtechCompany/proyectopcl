<?php

namespace App\Http\Controllers\Cuaderno;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cuaderno\CuadernoRunnerStartRequest;
use App\Models\CostoProject;
use App\Models\CuadernoAgente;
use App\Models\CuadernoVinculo;
use App\Services\Cuaderno\CuadernoExtensionPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Installs (one-time pairing code) and revokes the connectors of the signed-in holder. */
class CuadernoAgenteController extends Controller
{
    public function code(CuadernoRunnerStartRequest $request, CostoProject $costoProject): JsonResponse
    {
        // No confusable characters (0/O, 1/I) so it can also be typed by hand.
        do {
            $code = Str::upper(Str::password(8, letters: true, numbers: true, symbols: false));
        } while (preg_match('/^[A-Z2-9]{8}$/', $code) !== 1);
        Cache::put(CuadernoAgenteApiController::PAIRING_PREFIX.$code, $request->user()->id, now()->addMinutes(15));

        return response()->json([
            'codigo' => $code,
            'instalador' => route('cuaderno-agente.installer', $code),
            'expira' => now()->addMinutes(15)->toIso8601String(),
        ]);
    }

    /** Test copy of the browser extension, for this Costos site (before the store listing). */
    public function extension(CuadernoRunnerStartRequest $request, CostoProject $costoProject, CuadernoExtensionPackage $package): BinaryFileResponse
    {
        $target = storage_path('app/private/cuaderno/tmp/'.Str::uuid().'.zip');
        $package->build([$request->getSchemeAndHttpHost(), (string) config('app.url')], $target);

        return response()->download($target, 'asistente-cuaderno-costos.zip')->deleteFileAfterSend();
    }

    public function revoke(CuadernoRunnerStartRequest $request, CostoProject $costoProject, CuadernoAgente $agente): RedirectResponse
    {
        abort_unless($agente->user_id === $request->user()->id, 403);
        $agente->forceFill(['revoked_at' => now()])->save();
        // Connections that lived on that computer end; their imported data stays.
        CuadernoVinculo::query()->where('cuaderno_agente_id', $agente->id)->whereNotNull('session_key')
            ->update(['session_key' => null, 'conexion_estado' => 'desconectada', 'conexion_mensaje' => null]);

        return back()->with('success', 'PC «'.$agente->nombre.'» desvinculada. Su conector dejará de funcionar.');
    }
}
