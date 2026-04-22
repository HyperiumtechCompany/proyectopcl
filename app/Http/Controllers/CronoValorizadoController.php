<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class CronoValorizadoController extends Controller
{
    public function valorizado(Request $request)
    {
        $projectId = $request->query('project');
        $project = CostoProject::findOrFail($projectId);
        $db = $project->database_name;

        // 1. Obtener Periodos desde el Gantt (config_json)
        $gantt = DB::connection('mysql')->table("{$db}.cronograma_general")
            ->where('project_id', $projectId)
            ->whereNotNull('config_json')
            ->first();
        
        $config = $gantt ? json_decode($gantt->config_json, true) : [];
        $periodos = $config['periodos'] ?? [];

        // 2. Obtener datos de la tabla cronograma_valorizado
        $valorizadoExistente = DB::connection('mysql')->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $projectId)
            ->get()
            ->keyBy('partida');

        // 3. Obtener el Presupuesto General (La fuente de verdad)
        $presupuesto = DB::connection('mysql')->table("{$db}.presupuesto_general")
            ->where('presupuesto_id', $projectId)
            ->orderBy('item_order')
            ->get();

        $items = $presupuesto->map(function($p) use ($valorizadoExistente) {
            $val = $valorizadoExistente->get($p->partida);
            return [
                'id' => $p->id,
                'item' => $p->partida,
                'descripcion' => $p->descripcion,
                'und' => $p->unidad,
                'parcial' => (float)$p->parcial,
                // Si ya hay algo guardado en la tabla valorizado, lo usamos, si no, array vacío
                'distribucion' => $val ? json_decode($val->distribucion_mensual, true) : []
            ];
        });

        return Inertia::render('costos/cronogramas/valorizado/CronogramaValorizado', [
            'project' => (string) $projectId,
            'projectName' => $project->nombre,
            'items' => $items,
            'periodos' => $periodos,
            'totalPresupuesto' => $items->sum('parcial'),
        ]);
    }

    public function store(Request $request)
    {
        $projectId = $request->input('project_id');
        $project = CostoProject::findOrFail($projectId);
        $db = $project->database_name;
        $items = $request->input('items');

        DB::connection('mysql')->transaction(function () use ($db, $projectId, $items) {
            foreach ($items as $item) {
                DB::connection('mysql')->table("{$db}.cronograma_valorizado")->updateOrInsert(
                    ['presupuesto_id' => $projectId, 'partida' => $item['item']],
                    [
                        'descripcion' => $item['descripcion'],
                        'presupuesto_total' => $item['parcial'],
                        'distribucion_mensual' => json_encode($item['distribucion']),
                        'updated_at' => now()
                    ]
                );
            }
        });

        return back()->with('message', 'Cronograma guardado correctamente');
    }
}