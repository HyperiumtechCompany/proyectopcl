<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class CronogramaController extends Controller
{
    public function index(Request $request) 
    {
        $project_id = $request->query('project');

        if (!$project_id) {
            abort(404, "No se recibió el ID del proyecto");
        }

        $cronograma = DB::table('cronogramas')
            ->where('project_id', $project_id)
            ->first();

        return Inertia::render('costos/cronogramas/CronogramaIndex', [
            'project'     => (string)$project_id,
            'initialData' => $cronograma ? json_decode($cronograma->config_json) : null
        ]);
    }

    public function store(Request $request, $project)
    {
        // Validamos que 'data' esté presente (enviado desde Axios)
        $request->validate([
            'data' => 'required'
        ]);

        try {
            DB::table('cronogramas')->updateOrInsert(
                ['project_id' => $project],
                [
                    'config_json' => $request->input('data'), // Se guarda el JSON stringificado
                    'updated_at'  => now(),
                    'created_at'  => DB::raw('IFNULL(created_at, NOW())') 
                ]
            );

            return response()->json([
                'status'  => 'success',
                'message' => '¡Diagrama de Gantt guardado correctamente!'
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error al guardar: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtiene todas las partidas del presupuesto para importar al cronograma
     * Ruta: GET /presupuesto/{project}/partidas
     */
    public function getPartidas($project)
    {
        try {
            // Buscar el proyecto
            $costoProject = CostoProject::findOrFail($project);
            
            // Verificar permisos
            if ($costoProject->user_id !== Auth::id()) {
                return response()->json(['error' => 'No autorizado'], 403);
            }
            
            // Obtener el presupuesto_id del tenant
            $dbService = app(\App\Services\CostoDatabaseService::class);
            $tenantPresupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);
            
            // Obtener todas las partidas del presupuesto general
            $partidas = DB::connection('costos_tenant')
                ->table('presupuesto_general')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->whereNotNull('partida')
                ->where('partida', '!=', '')
                ->orderBy('item_order')
                ->orderBy('id')
                ->get()
                ->map(function($item) {
                    return [
                        'descripcion' => $item->descripcion,
                        'total' => (float)($item->parcial ?? 0),
                        'plazo_estimado' => 5, // Valor por defecto
                        'partida' => $item->partida,
                        'unidad' => $item->unidad,
                        'metrado' => (float)($item->metrado ?? 0),
                        'precio_unitario' => (float)($item->precio_unitario ?? 0),
                    ];
                });
            
            return response()->json($partidas);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener partidas: ' . $e->getMessage()
            ], 500);
        }
    }
}