<?php

namespace App\Http\Controllers\Cuaderno;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cuaderno\CuadernoConsultaRequest;
use App\Http\Requests\Cuaderno\StoreCuadernoVinculoRequest;
use App\Models\CostoProject;
use App\Models\CuadernoVinculo;
use App\Services\Cuaderno\CuadernoRunner;
use App\Services\Cuaderno\CuadernoRunnerProcess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CuadernoVinculoController extends Controller
{
    public function show(CuadernoConsultaRequest $request, CostoProject $costoProject, CuadernoRunner $runner, CuadernoRunnerProcess $process): Response
    {
        $this->authorizeProject($request, $costoProject);
        $vinculo = $costoProject->cuadernoVinculos()->where('active_slot', 1)->first();
        $detected = $vinculo ? Cache::get('cuaderno-detectado:'.$vinculo->id) : null;
        $filters = $request->safe()->only(['q', 'tipo', 'estado']);
        $asientos = $vinculo ? CuadernoAsientoController::filtered($vinculo, $filters)
            ->with(['referencias.destino:id,numero,titulo', 'referenciadoPor.origen:id,numero,titulo'])
            ->orderByDesc('numero')->paginate(25)->withQueryString() : null;

        return Inertia::render('costos/cuaderno/Show', [
            'project' => $costoProject->only('id', 'nombre', 'codigo_cui'),
            'vinculo' => $vinculo,
            'cuadernoDetectado' => $detected && ($detected['session'] ?? null) === $vinculo?->session_key ? $detected['identity'] : null,
            'sincronizacion' => $vinculo ? $runner->progress($vinculo) : null,
            'asientos' => $asientos,
            'filters' => $filters,
            'tipos' => $vinculo?->asientos()->selectRaw('tipo as valor, count(*) as total')
                ->groupBy('tipo')->orderByDesc('total')->get() ?? [],
            'estados' => $vinculo?->asientos()->distinct()->pluck('estado') ?? [],
            // Compact index of every entry in number order for downloads by range or selection:
            // [id, numero, has official PDF, has official detail].
            'indiceOficial' => $vinculo?->asientos()->orderBy('numero')
                ->get(['id', 'numero', 'pdf_path', 'detalle_at'])
                ->map(fn ($asiento): array => [$asiento->id, $asiento->numero, $asiento->pdf_path !== null, $asiento->detalle_at !== null])
                ->values() ?? [],
            'historial' => $costoProject->cuadernoVinculos()
                ->whereNull('active_slot')->latest('id')->limit(10)->get(),
            'roles' => StoreCuadernoVinculoRequest::ROLES,
            // Loaded after the first paint, and reloaded by the page while the connector is offline.
            'conector' => Inertia::defer(fn (): array => [
                'online' => $runner->health(),
                'autostart' => $process->canStart() && $runner->configured(),
            ]),
        ]);
    }

    public function store(StoreCuadernoVinculoRequest $request, CostoProject $costoProject): RedirectResponse
    {
        DB::transaction(function () use ($request, $costoProject): void {
            $project = CostoProject::query()->lockForUpdate()->findOrFail($costoProject->id);
            $this->authorizeProject($request, $project);
            $this->archiveActiveLink($project);

            $vinculo = new CuadernoVinculo($request->safe()->only([
                'entidad', 'obra', 'contrato', 'codigo_cui', 'rol', 'external_id',
            ]));
            $vinculo->user_id = $request->user()->id;
            $vinculo->active_slot = 1;
            $vinculo->estado = 'pendiente_verificacion';
            $project->cuadernoVinculos()->save($vinculo);
        });

        return to_route('costos.cuaderno.show', $costoProject)
            ->with('success', 'Vinculación guardada. Pendiente de verificar el acceso oficial a OECE.');
    }

    public function destroy(Request $request, CostoProject $costoProject): RedirectResponse
    {
        $this->authorizeProject($request, $costoProject);

        DB::transaction(function () use ($request, $costoProject): void {
            $project = CostoProject::query()->lockForUpdate()->findOrFail($costoProject->id);
            $this->authorizeProject($request, $project);
            $this->archiveActiveLink($project);
        });

        return to_route('costos.cuaderno.show', $costoProject)
            ->with('success', 'Vinculación archivada. El historial se conserva.');
    }

    private function archiveActiveLink(CostoProject $project): void
    {
        if ($project->cuadernoVinculos()->where('active_slot', 1)->whereNotNull('session_key')->exists()) {
            throw ValidationException::withMessages(['conexion' => 'Desconecta la cuenta antes de reemplazar o archivar la vinculación.']);
        }
        $project->cuadernoVinculos()->where('active_slot', 1)->update([
            'active_slot' => null,
            'estado' => 'revocada',
            'revoked_at' => now(),
        ]);
    }

    private function authorizeProject(Request $request, CostoProject $project): void
    {
        abort_unless($request->user()?->id === $project->user_id, 403, 'No tienes acceso a este proyecto.');
    }
}
