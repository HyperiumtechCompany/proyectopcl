<?php

namespace App\Http\Controllers\ValorizacionV2;

use App\Http\Controllers\Controller;
use App\Http\Requests\ValorizacionV2\AprobarValorizacionV2Request;
use App\Http\Requests\ValorizacionV2\CrearValorizacionV2Request;
use App\Http\Requests\ValorizacionV2\GuardarValorizacionV2Request;
use App\Models\CostoProject;
use App\Models\ValorizacionV2\ValorizacionV2Corte;
use App\Models\ValorizacionV2\ValorizacionV2Documento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Valorización v2 — entorno de pruebas aislado del "Cronograma Valorizado" en
 * producción (CronoValorizadoController y hermanos): tablas propias
 * valorizacion_v2_*. Un proyecto puede tener VARIAS valorizaciones (como los
 * documentos de mantenimiento). Dueño, módulo y esquema los garantiza
 * EnsureValorizacionV2Schema (más SetCostosDatabase).
 */
class ValorizacionV2Controller extends Controller
{
    /** Lista de valorizaciones del proyecto + crear nueva. */
    public function index(Request $request, CostoProject $costoProject): Response
    {
        $documentos = ValorizacionV2Documento::query()->withCount('cortes')->latest('updated_at')->get();

        return Inertia::render('costos/valorizacion-v2/Index', [
            'project' => $this->proyecto($costoProject),
            'documentos' => $documentos->map(fn (ValorizacionV2Documento $documento): array => $this->documentoResumen($documento))->values(),
            'proyectos' => $this->otrosProyectos($request),
        ]);
    }

    /** Crea una valorización con los datos iniciales que arma el frontend (vacía o ejemplo). */
    public function store(CrearValorizacionV2Request $request, CostoProject $costoProject): RedirectResponse
    {
        $documento = ValorizacionV2Documento::create([
            'public_id' => (string) Str::ulid(),
            'nombre' => $request->validated('nombre'),
            'schema_version' => $request->validated('schema_version'),
            'revision' => 1,
            'datos' => $request->validated('datos'),
        ]);

        return redirect()->route('costos.valorizacion-v2.show', [$costoProject, $documento->public_id]);
    }

    /** Editor de una valorización. */
    public function show(Request $request, CostoProject $costoProject, string $documentoId): Response
    {
        $documento = $this->documento($documentoId)->load('cortes');

        return Inertia::render('costos/valorizacion-v2/Editor', [
            'project' => $this->proyecto($costoProject),
            'documento' => [
                'public_id' => $documento->public_id,
                'nombre' => $documento->nombre,
                'revision' => $documento->revision,
                'schema_version' => $documento->schema_version,
                'datos' => $documento->datos,
                'updated_at' => $documento->updated_at?->toIso8601String(),
            ],
            'cortes' => $documento->cortes->map(fn (ValorizacionV2Corte $corte): array => $this->corteResumen($corte))->values(),
            'documentos' => ValorizacionV2Documento::query()->orderBy('nombre')->get(['public_id', 'nombre'])
                ->map(fn (ValorizacionV2Documento $d): array => ['public_id' => $d->public_id, 'nombre' => $d->nombre])->values(),
            'proyectos' => $this->otrosProyectos($request),
        ]);
    }

    /**
     * Guarda los datos de entrada. Si otra pestaña guardó antes (revisión
     * distinta) responde 409 con la versión del servidor en vez de pisarla.
     */
    public function guardar(GuardarValorizacionV2Request $request, CostoProject $costoProject, string $documentoId): JsonResponse
    {
        return DB::connection('costos_tenant')->transaction(function () use ($request, $documentoId): JsonResponse {
            $documento = ValorizacionV2Documento::query()->where('public_id', $documentoId)->lockForUpdate()->firstOrFail();

            if ((int) $request->validated('revision') !== $documento->revision) {
                return response()->json([
                    'message' => 'La valorización fue guardada desde otra pestaña o equipo.',
                    'revision' => $documento->revision,
                    'datos' => $documento->datos,
                    'updated_at' => $documento->updated_at?->toIso8601String(),
                ], 409);
            }

            $documento->update([
                'schema_version' => $request->validated('schema_version'),
                'revision' => $documento->revision + 1,
                'datos' => $request->validated('datos'),
            ]);

            return response()->json(['revision' => $documento->revision, 'updated_at' => $documento->updated_at?->toIso8601String()]);
        });
    }

    /** Renombra una valorización. */
    public function renombrar(Request $request, CostoProject $costoProject, string $documentoId): RedirectResponse
    {
        $nombre = $request->validate(['nombre' => ['required', 'string', 'max:255']])['nombre'];
        $this->documento($documentoId)->update(['nombre' => $nombre]);

        return back();
    }

    /** Copia los datos de una valorización en una nueva (sin sus aprobaciones). */
    public function duplicar(Request $request, CostoProject $costoProject, string $documentoId): RedirectResponse
    {
        $original = $this->documento($documentoId);
        $copia = ValorizacionV2Documento::create([
            'public_id' => (string) Str::ulid(),
            'nombre' => Str::limit($original->nombre.' (copia)', 255, ''),
            'schema_version' => $original->schema_version,
            'revision' => 1,
            'datos' => $original->datos,
        ]);

        return redirect()->route('costos.valorizacion-v2.show', [$costoProject, $copia->public_id]);
    }

    /** Elimina una valorización con sus aprobaciones. */
    public function destroy(Request $request, CostoProject $costoProject, string $documentoId): RedirectResponse
    {
        $this->documento($documentoId)->delete();

        return redirect()->route('costos.valorizacion-v2.index', $costoProject);
    }

    /** Aprueba la valorización N°: congela una copia de los datos guardados. */
    public function aprobar(AprobarValorizacionV2Request $request, CostoProject $costoProject, string $documentoId): JsonResponse
    {
        $documento = $this->documento($documentoId);
        if ($documento->revision !== (int) $request->validated('revision')) {
            return response()->json(['message' => 'Guarda los cambios pendientes antes de aprobar.'], 409);
        }

        $numero = (int) $request->validated('numero');
        if ($documento->cortes()->where('numero', $numero)->exists()) {
            return response()->json(['message' => "La valorización N°{$numero} ya está aprobada."], 422);
        }

        $corte = $documento->cortes()->create([
            'numero' => $numero,
            'mes' => $request->validated('mes'),
            'estado' => 'aprobada',
            'resumen' => $request->validated('resumen'),
            'datos' => $documento->datos,
            'aprobado_por' => $request->user()?->id,
        ]);

        return response()->json(['corte' => $this->corteResumen($corte)], 201);
    }

    /** Reabre (elimina la aprobación de) la valorización N°. */
    public function reabrir(Request $request, CostoProject $costoProject, string $documentoId, int $numero): JsonResponse
    {
        $this->documento($documentoId)->cortes()->where('numero', $numero)->delete();

        return response()->json(['numero' => $numero]);
    }

    private function documento(string $publicId): ValorizacionV2Documento
    {
        return ValorizacionV2Documento::query()->where('public_id', $publicId)->firstOrFail();
    }

    /**
     * Datos del proyecto de Costos (también pre-llenan la Ficha Técnica de una valorización nueva).
     *
     * @return array<string, mixed>
     */
    private function proyecto(CostoProject $costoProject): array
    {
        return [
            'id' => $costoProject->id,
            'nombre' => $costoProject->nombre,
            'fecha_inicio' => $costoProject->fecha_inicio?->format('Y-m-d'),
            'fecha_fin' => $costoProject->fecha_fin?->format('Y-m-d'),
            'unidad_ejecutora' => $costoProject->unidad_ejecutora,
            'codigo_cui' => $costoProject->codigo_cui,
            'departamento' => $costoProject->departamento?->departamento,
            'provincia' => $costoProject->provincia?->provincia,
            'distrito' => $costoProject->distrito?->distrito,
            'centro_poblado' => $costoProject->centro_poblado,
        ];
    }

    /**
     * Proyectos del usuario con el módulo activo, para cambiar de obra sin salir.
     *
     * @return Collection<int, array{id: int, nombre: string}>
     */
    private function otrosProyectos(Request $request): Collection
    {
        return CostoProject::query()
            ->where('user_id', $request->user()->id)
            ->whereHas('enabledModules', fn ($query) => $query->where('module_type', 'crono_valorizado'))
            ->orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn (CostoProject $proyecto): array => ['id' => $proyecto->id, 'nombre' => $proyecto->nombre])
            ->values();
    }

    /**
     * Resumen para la lista: datos leídos del JSON (obra, N° y mes activos).
     *
     * @return array<string, mixed>
     */
    private function documentoResumen(ValorizacionV2Documento $documento): array
    {
        $datos = $documento->datos ?? [];

        return [
            'public_id' => $documento->public_id,
            'nombre' => $documento->nombre,
            'obra' => data_get($datos, 'fichaTecnica.datosGenerales.obra'),
            'contrato' => data_get($datos, 'fichaTecnica.contratista.contrato'),
            'periodo' => data_get($datos, 'periodo'),
            'partidas' => count(data_get($datos, 'presupuesto.partidas', [])),
            'aprobadas' => $documento->cortes_count ?? 0,
            'updated_at' => $documento->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array{numero: int, mes: string, estado: string, resumen: array<string, mixed>, aprobado_at: string|null}
     */
    private function corteResumen(ValorizacionV2Corte $corte): array
    {
        return [
            'numero' => $corte->numero,
            'mes' => $corte->mes->format('Y-m-d'),
            'estado' => $corte->estado,
            'resumen' => $corte->resumen,
            'aprobado_at' => $corte->created_at?->toIso8601String(),
        ];
    }
}
