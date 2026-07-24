<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DelphinController extends Controller
{
    public function __construct(private readonly CostoDatabaseService $dbService) {}

    // GET /module/delphin?project={id}
    public function index(Request $request)
    {
        $projectId = $request->query('project');
        if (! $projectId) {
            abort(404, 'No se recibió el ID del proyecto');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();

        // Auto-repara precio_unitario/parcial de partidas cuyo ACU fue calculado
        // antes de la corrección de precisión (aplanaba a 2 decimales, ej. 1.48 en
        // vez de 1.479333) — así Costo Directo reconcilia con Insumos Consolidados
        // sin que el usuario tenga que reguardar cada ACU manualmente.
        $this->dbService->syncCostoDirecto($costoProject->database_name, $presupuestoId);

        $rows = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->orderByRaw('COALESCE(item_order, 999999), id')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        $tasks = $this->fetchTasks($presupuestoId);

        $projectParams = $this->dbService->getProjectParams($costoProject->database_name);
        $resumenPresupuesto = $this->resumenPresupuesto($presupuestoId, $projectParams);

        $projectData = [
            // El id del proyecto es indispensable para el fetch de ACUs del export
            // (`/costos/{id}/presupuesto/acus/export-data`) — sin él la hoja "ACUs"
            // nunca se agregaba al Excel/PDF (la petición fallaba silenciosamente
            // contra "/costos/undefined/...").
            'id' => $costoProject->id,
            'nombre' => $costoProject->nombre ?? 'PROYECTO',
            'codigo_cui' => $costoProject->codigo_cui ?? '-',
            'codigo_local' => $costoProject->codigo_local ?? '-',
            // codigos_modulares se guarda como array (cast en el modelo); hay que
            // aplanarlo a texto legible antes de exponerlo, o el frontend lo
            // interpola tal cual en un template string y muestra "[object Object]".
            'codigos_modulares' => $this->formatCodigosModulares($costoProject->codigos_modulares),
            'unidad_ejecutora' => $costoProject->unidad_ejecutora ?? '-',
            'propietario' => $costoProject->unidad_ejecutora ?? '-',
            'modulo' => 'GENERAL',
            'plantilla_logo_izq_url' => $costoProject->plantilla_logo_izq
                ? asset('storage/'.ltrim($costoProject->plantilla_logo_izq, '/'))
                : null,
            'plantilla_logo_der_url' => $costoProject->plantilla_logo_der
                ? asset('storage/'.ltrim($costoProject->plantilla_logo_der, '/'))
                : null,

            'plantilla_logo_izq_base64' => $costoProject->plantilla_logo_izq
                ? $this->getImageBase64($costoProject->plantilla_logo_izq)
                : null,
            'plantilla_logo_der_base64' => $costoProject->plantilla_logo_der
                ? $this->getImageBase64($costoProject->plantilla_logo_der)
                : null,
        ];

        return Inertia::render('costos/delphin/DelphinView', [
            'project' => (string) $projectId,
            'project_id_int' => (int) $projectId,
            'project_name' => $costoProject->nombre ?? '',
            'initialRows' => $rows,
            'initialTasks' => $tasks,
            'projectParams' => $projectParams ? (array) $projectParams : null,
            'projectData' => $projectData,
            'resumenPresupuesto' => $resumenPresupuesto,
        ]);
    }

    /**
     * Costo Directo + Gastos Generales + Utilidad = Total, para las filas de
     * resumen del Presupuesto en Delphin y para el índice 39 (INE) de la
     * Fórmula Polinómica.
     *
     * Los % (utilidad_porcentaje, gastos_generales_porcentaje) SÍ se leen del
     * snapshot en gg_consolidado si existe, para no pisar el input manual del
     * usuario en cada carga de página. Pero los MONTOS derivados (Costo
     * Directo, Utilidad, Gastos Generales, Total) siempre se recalculan aquí
     * contra el presupuesto_general actual — antes se devolvía el monto
     * congelado del snapshot (comp_i_costo_directo/comp_iii_utilidad/...), que
     * solo se refrescaba cuando el usuario reescribía el % manualmente. Como
     * editar ACUs/partidas cambia Costo Directo constantemente sin tocar el
     * snapshot, el resumen podía mostrar "1.00%" junto a un monto de Utilidad
     * que en realidad correspondía a un Costo Directo viejo (o 0 si el
     * snapshot se creó antes de cargar el presupuesto).
     */
    private function resumenPresupuesto(int $presupuestoId, ?object $projectParams): array
    {
        $connection = DB::connection('costos_tenant');

        $snapshot = $connection->table('gg_consolidado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();

        // Solo partidas hoja (con metrado): presupuesto_general también guarda el
        // rollup en las filas de título/grupo, así que un SUM(parcial) sin filtrar
        // cuenta el costo de cada partida una vez por cada nivel de su árbol —
        // mismo criterio que recalculateConsolidadoSnapshot() en PresupuestoController.
        $costoDirecto = (float) $connection->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->where('metrado', '>', 0)
            ->sum('parcial');

        $gastosGeneralesDetalle = (float) $connection->table('gg_fijos')
            ->where('presupuesto_id', $presupuestoId)
            ->where('tipo_fila', 'detalle')
            ->sum('parcial')
            + (float) $connection->table('gg_variables')
                ->where('presupuesto_id', $presupuestoId)
                ->where('tipo_fila', 'detalle')
                ->sum('parcial');

        $utilidadPorcentaje = (float) ($snapshot?->utilidad_porcentaje ?? $projectParams?->utilidad_porcentaje ?? 5);
        $gastosGeneralesOverride = $snapshot?->gastos_generales_porcentaje ?? null;

        $gastosGenerales = $gastosGeneralesOverride !== null
            ? $costoDirecto * ((float) $gastosGeneralesOverride / 100)
            : $gastosGeneralesDetalle;

        $utilidad = $costoDirecto * ($utilidadPorcentaje / 100);

        return [
            'costoDirecto' => $costoDirecto,
            'gastosGenerales' => $gastosGenerales,
            'gastosGeneralesPorcentaje' => $costoDirecto > 0 ? round(($gastosGenerales / $costoDirecto) * 100, 4) : 0,
            'utilidad' => $utilidad,
            'utilidadPorcentaje' => $utilidadPorcentaje,
            'total' => $costoDirecto + $gastosGenerales + $utilidad,
        ];
    }

    // DELETE /module/delphin/reset?project={id}
    public function resetPresupuesto(Request $request)
    {
        $projectId = $request->query('project');
        if (! $projectId) {
            abort(404, 'No se recibió el ID del proyecto');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        $tablas = [
            'presupuesto_general',
            'presupuesto_indices',
            'presupuesto_acus',        // cascade FK borra acu_mano_de_obra/materiales/equipos/subcontratos/subpartidas
            'gg_fijos',
            'gg_fijos_fianzas',
            'gg_fijos_polizas',
            'gg_variables',
            'presupuesto_remuneraciones',
            'gg_supervision',
            'supervision_gg_detalle',
            'gg_control_concurrente',
            'gg_consolidado',
            'cronograma_general',
            'cronograma_valorizado',
            'cronograma_materiales',
        ];

        DB::connection('costos_tenant')->transaction(function () use ($tablas, $presupuestoId) {
            foreach ($tablas as $tabla) {
                DB::connection('costos_tenant')->table($tabla)->where('presupuesto_id', $presupuestoId)->delete();
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'El presupuesto fue vaciado por completo. El catálogo de insumos no fue afectado.',
        ]);
    }

    private function resolvePresupuestoId(): int
    {
        $id = DB::connection('costos_tenant')
            ->table('presupuestos')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->value('id');

        if (! $id) {
            abort(422, 'No existe un presupuesto para este proyecto.');
        }

        return (int) $id;
    }

    private function fetchTasks(int $presupuestoId): array
    {
        $records = DB::connection('costos_tenant')
            ->table('cronograma_general as cg')
            ->leftJoin('presupuesto_general as pg', function ($join) use ($presupuestoId) {
                $join->on('cg.partida', '=', 'pg.partida')
                    ->where('pg.presupuesto_id', '=', $presupuestoId);
            })
            ->where('cg.presupuesto_id', $presupuestoId)
            ->orderBy('cg.item_order')
            ->select('cg.*', DB::raw('COALESCE(pg.parcial, 0) as presupuesto'))
            ->get();

        // Map partida → id so we can derive parent_id from dotted notation
        // when the DB rows have parent_id = null (e.g. data imported externally).
        $partidaToId = $records->pluck('id', 'partida')->all();

        return $records->map(fn ($row) => $this->rowToV2($row, $partidaToId))->all();
    }

    /**
     * Convert a raw DB row to the V2 task shape.
     *
     * When parent_id or nivel are missing/zero we derive them from the partida
     * dotted-notation ("2.1.3" → nivel=3, parent="2.1").  This lets Delphin
     * build the correct tree even for rows that were imported without explicit
     * parent_id / nivel values.
     */
    private function rowToV2(object $row, array $partidaToId = []): array
    {
        $typeMap = ['0' => 'FC', '1' => 'CC', '2' => 'FF', '3' => 'CF'];
        $predecesoras = [];

        if ($row->predecesoras) {
            $links = json_decode($row->predecesoras, true) ?? [];
            foreach ($links as $link) {
                if (isset($link['taskId'])) {
                    $predecesoras[] = $link;
                } else {
                    $predecesoras[] = [
                        'taskId' => (int) ($link['source'] ?? 0),
                        'tipo' => $typeMap[$link['type'] ?? '0'] ?? 'FC',
                        'lag' => (int) ($link['lag'] ?? 0),
                    ];
                }
            }
        }

        $partida = $row->partida ?? '';

        // Derive nivel from partida depth: "2.1.3" → 3, "2" → 1
        $nivelFromPartida = $partida !== '' ? substr_count($partida, '.') + 1 : 1;
        $nivel = (int) ($row->nivel ?? 0);
        if ($nivel <= 0) {
            $nivel = $nivelFromPartida;
        }

        // Derive parent_id from partida when DB value is null
        $parentId = isset($row->parent_id) && $row->parent_id > 0
            ? (int) $row->parent_id
            : null;

        if ($parentId === null && str_contains($partida, '.')) {
            $parts = explode('.', $partida);
            array_pop($parts);
            $parentPartida = implode('.', $parts);
            $parentId = isset($partidaToId[$parentPartida])
                ? (int) $partidaToId[$parentPartida]
                : null;
        }

        return [
            'id' => $row->id,
            'parent_id' => $parentId,
            'nivel' => $nivel,
            'item_order' => (int) ($row->item_order ?? 0),
            'partida' => $partida,
            'descripcion' => $row->descripcion ?? '',
            'duracion_dias' => (int) ($row->duracion_dias ?? 0),
            'fecha_inicio' => $row->fecha_inicio,
            'fecha_fin' => $row->fecha_fin,
            'avance' => (float) ($row->avance ?? 0),
            'predecesoras' => $predecesoras,
            'presupuesto' => (float) ($row->presupuesto ?? 0),
        ];
    }

    private function formatCodigosModulares(mixed $codigosModulares): string
    {
        if (! is_array($codigosModulares)) {
            return $codigosModulares ?: '-';
        }

        $labels = ['inicial' => 'Inicial', 'primaria' => 'Primaria', 'secundaria' => 'Secundaria'];
        $parts = [];
        foreach ($labels as $key => $label) {
            if (! empty($codigosModulares[$key])) {
                $parts[] = "{$label}: {$codigosModulares[$key]}";
            }
        }

        return $parts ? implode(', ', $parts) : '-';
    }

    private function getImageBase64($path): ?string
    {
        $fullPath = storage_path('app/public/'.ltrim($path, '/'));
        if (! file_exists($fullPath)) {
            return null;
        }
        $mime = mime_content_type($fullPath);
        $data = file_get_contents($fullPath);

        return 'data:'.$mime.';base64,'.base64_encode($data);
    }
}
