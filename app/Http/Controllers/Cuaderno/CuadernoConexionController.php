<?php

namespace App\Http\Controllers\Cuaderno;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cuaderno\CuadernoOperacionRequest;
use App\Http\Requests\Cuaderno\CuadernoRunnerStartRequest;
use App\Models\CostoProject;
use App\Models\CuadernoVinculo;
use App\Services\Cuaderno\CuadernoRunner;
use App\Services\Cuaderno\CuadernoRunnerProcess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CuadernoConexionController extends Controller
{
    public function operate(CuadernoOperacionRequest $request, CostoProject $costoProject, CuadernoRunner $runner): RedirectResponse
    {
        $action = substr($request->route()->getName(), strrpos($request->route()->getName(), '.') + 1);
        $vinculo = $action === 'connect' && ! $request->filled('vinculo_id')
            ? $this->activeOrNewLink($costoProject, $request->user()->id)
            : $costoProject->cuadernoVinculos()->where('active_slot', 1)->findOrFail($request->integer('vinculo_id'));
        $lock = Cache::lock('cuaderno-operacion:'.$vinculo->id, 70);
        if (! $lock->get()) {
            throw ValidationException::withMessages(['conexion' => 'Hay una operación en curso. Espera antes de volver a intentar.']);
        }
        try {
            if ($action === 'confirm') {
                $vinculo = $runner->confirm($vinculo, $request->boolean('reemplazar'));
                $result = ['state' => 'ready'];
            } else {
                $result = $runner->execute($vinculo, $action, $request->safe()->except('vinculo_id'));
            }
        } catch (ValidationException $exception) {
            if ($vinculo->fresh()?->active_slot === 1) {
                $vinculo->conexion_estado = 'error';
                $vinculo->conexion_mensaje = $exception->errors()['conexion'][0] ?? 'No se pudo verificar la respuesta del conector.';
                $vinculo->sync_completa = false;
                $vinculo->save();
            }
            throw $exception;
        } finally {
            $lock->release();
        }

        $redirect = to_route('costos.cuaderno.show', $costoProject);
        // Polling actions (inspect, sync progress) stay silent; outcomes get a message.
        $message = match (true) {
            $action === 'sync' && $result['state'] === 'ready' => count($result['rows']).' asientos importados. '
                .($result['complete'] ? 'Importación completa y conciliada con el total oficial.' : 'Importación parcial; vuelve a sincronizar para completar el total.'),
            $action === 'confirm' => 'Cuaderno confirmado para este proyecto. Importando sus asientos…',
            $action === 'capture' => 'Estructura de la página guardada en storage/app/private/'.$result['capture_path'].'.',
            $action === 'disconnect' => 'Cuenta desconectada. Los asientos importados se conservan.',
            default => null,
        };

        return $message ? $redirect->with('success', $message) : $redirect;
    }

    /**
     * Remote view of the invisible official browser: returns its visible fields (and a
     * screenshot on request) and forwards what the holder fills, clicks or types in Costos.
     */
    public function remote(CuadernoOperacionRequest $request, CostoProject $costoProject, CuadernoRunner $runner): JsonResponse
    {
        $action = $request->routeIs('costos.cuaderno.interact') ? 'interact' : 'screen';
        $vinculo = $costoProject->cuadernoVinculos()->where('active_slot', 1)->findOrFail($request->integer('vinculo_id'));
        $lock = Cache::lock('cuaderno-operacion:'.$vinculo->id, 70);
        if (! $lock->get()) {
            throw ValidationException::withMessages(['conexion' => 'Hay una operación en curso. Espera un momento.']);
        }
        try {
            $result = $runner->execute($vinculo, $action, $request->safe()->except('vinculo_id'));
        } finally {
            $lock->release();
        }
        $screen = is_array($result['screen'] ?? null) ? $result['screen'] : [];

        return response()->json([
            'conexion_estado' => $vinculo->fresh()->conexion_estado,
            'screen' => [
                'path' => is_string($screen['path'] ?? null) ? $screen['path'] : null,
                'text' => is_string($screen['text'] ?? null) ? $screen['text'] : '',
                'fields' => array_values(array_filter($screen['fields'] ?? [], 'is_array')),
                'viewport' => $screen['viewport'] ?? null,
                'shot' => is_string($screen['shot'] ?? null) ? $screen['shot'] : null,
            ],
        ]);
    }

    public function startRunner(CuadernoRunnerStartRequest $request, CostoProject $costoProject, CuadernoRunner $runner, CuadernoRunnerProcess $process): RedirectResponse
    {
        if (! $process->canStart() || ! $runner->configured()) {
            throw ValidationException::withMessages(['conector' => 'El inicio automático no está habilitado. Ejecuta npm run cuaderno:runner en el equipo.']);
        }
        if (! $runner->health()) {
            $process->start();
            for ($attempt = 0; $attempt < 16 && ! $runner->health(); $attempt++) {
                usleep(250_000);
            }
        }
        if (! $runner->health()) {
            throw ValidationException::withMessages(['conector' => 'El conector no respondió. Revisa storage/logs/cuaderno-runner.log o ejecuta npm run cuaderno:runner.']);
        }

        return to_route('costos.cuaderno.show', $costoProject)->with('success', 'Conector iniciado.');
    }

    private function activeOrNewLink(CostoProject $costoProject, int $userId): CuadernoVinculo
    {
        return DB::transaction(function () use ($costoProject, $userId): CuadernoVinculo {
            $project = CostoProject::query()->lockForUpdate()->findOrFail($costoProject->id);
            $vinculo = $project->cuadernoVinculos()->where('active_slot', 1)->first();
            if ($vinculo) {
                return $vinculo;
            }
            // Entity, work and CUI are filled from the official notebook on confirmation.
            $vinculo = new CuadernoVinculo;
            $vinculo->user_id = $userId;
            $vinculo->active_slot = 1;
            $vinculo->estado = 'pendiente_verificacion';
            $project->cuadernoVinculos()->save($vinculo);

            return $vinculo;
        });
    }
}
