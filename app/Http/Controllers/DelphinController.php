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

        $rows = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->orderByRaw('COALESCE(item_order, 999999), id')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        $tasks = $this->fetchTasks($presupuestoId);

        $projectParams = $this->dbService->getProjectParams($costoProject->database_name);

        return Inertia::render('costos/delphin/DelphinView', [
            'project'        => (string) $projectId,
            'project_id_int' => (int) $projectId,
            'project_name'   => $costoProject->nombre ?? '',
            'initialRows'    => $rows,
            'initialTasks'   => $tasks,
            'projectParams'  => $projectParams ? (array) $projectParams : null,
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
                        'tipo'   => $typeMap[$link['type'] ?? '0'] ?? 'FC',
                        'lag'    => (int) ($link['lag'] ?? 0),
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
            $parts     = explode('.', $partida);
            array_pop($parts);
            $parentPartida = implode('.', $parts);
            $parentId  = isset($partidaToId[$parentPartida])
                ? (int) $partidaToId[$parentPartida]
                : null;
        }

        return [
            'id'            => $row->id,
            'parent_id'     => $parentId,
            'nivel'         => $nivel,
            'item_order'    => (int) ($row->item_order ?? 0),
            'partida'       => $partida,
            'descripcion'   => $row->descripcion ?? '',
            'duracion_dias' => (int) ($row->duracion_dias ?? 0),
            'fecha_inicio'  => $row->fecha_inicio,
            'fecha_fin'     => $row->fecha_fin,
            'avance'        => (float) ($row->avance ?? 0),
            'predecesoras'  => $predecesoras,
            'presupuesto'   => (float) ($row->presupuesto ?? 0),
        ];
    }
}
