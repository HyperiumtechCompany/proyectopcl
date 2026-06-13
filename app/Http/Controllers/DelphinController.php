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

        return $records->map(fn ($row) => $this->rowToV2($row))->all();
    }

    private function rowToV2(object $row): array
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

        return [
            'id'            => $row->id,
            'parent_id'     => $row->parent_id,
            'nivel'         => (int) ($row->nivel ?? 1),
            'item_order'    => (int) ($row->item_order ?? 0),
            'partida'       => $row->partida ?? '',
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
