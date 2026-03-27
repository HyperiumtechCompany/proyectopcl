<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB; 
use App\Models\EspecificacionTecnica;
use App\Models\CostoProject;

class EttpController extends Controller
{
    /**
     * Muestra la vista principal de ETTS
     * Ruta: /module/etts?project={id}
     */
    public function show(Request $request)
    {
        $proyectoId = $request->query('project');
        
        $proyecto = CostoProject::find($proyectoId);
        $etts = EspecificacionTecnica::where('proyecto_id', $proyectoId)->first();
        
        return Inertia::render('costos/ettp/etts', [
            'proyecto' => $proyecto,
            'especificacionesId' => $etts?->id,
            'initialData' => $etts?->data ? json_decode($etts->data, true) : null,
        ]);
    }
    
    /**
     * Obtiene especificaciones técnicas guardadas (API)
     * Ruta: POST /obtener-especificaciones-tecnicas
     */
    public function obtenerEspecificaciones(Request $request)
    {
        $id = $request->input('id');
        $etts = EspecificacionTecnica::find($id);
        
        return response()->json([
            'data' => $etts ? $etts->data : null
        ]);
    }
    
    /**
     * Obtiene metrados desde el módulo de metrados (API)
     * Ruta: POST /obtener-metrados-ettp
     */
public function obtenerMetrados(Request $request)
{
    try {
        $proyectoId = $request->input('proyecto_id');
        $estructura = $request->input('estructura', 0);
        
        $datos = [];
        
        if ($estructura == 1) {
            $items = DB::table('metrados_prueba')
                ->where('proyecto_id', $proyectoId)
                ->where('especialidad', 'estructura')
                ->orderBy('item')
                ->get();
            
            // Construir el árbol usando objetos (no arrays)
            $itemsById = [];
            foreach ($items as $item) {
                $itemsById[$item->id] = $item;
            }
            
            $tree = [];
            foreach ($items as $item) {
                if ($item->parent_id && isset($itemsById[$item->parent_id])) {
                    if (!isset($itemsById[$item->parent_id]->_children)) {
                        $itemsById[$item->parent_id]->_children = [];
                    }
                    $itemsById[$item->parent_id]->_children[] = $item;
                } else {
                    $tree[] = $item;
                }
            }
            
            // Convertir a array para JSON
            $datos = json_decode(json_encode($tree), true);
        }
        
        return response()->json($datos);
        
    } catch (\Exception $e) {
        \Log::error('Error en obtenerMetrados: ' . $e->getMessage());
        return response()->json(['error' => $e->getMessage()], 500);
    }
}



private function getMetradosEstructura($proyectoId)
{
    // Aquí va tu consulta para metrados de estructura
    // Por ahora retorna vacío
    return [];
}

private function getMetradosArquitectura($proyectoId)
{
    return [];
}

private function getMetradosSanitarias($proyectoId)
{
    return [];
}

private function getMetradosElectricas($proyectoId)
{
    return [];
}

private function getMetradosComunicaciones($proyectoId)
{
    return [];
}

private function getMetradosGas($proyectoId)
{
    return [];
}
    
    /**
     * Guarda las especificaciones técnicas (API)
     * Ruta: POST /guardar-especificaciones-tecnicas/{proyectoId}
     */
    public function guardarEspecificaciones(Request $request, $proyectoId)
    {
        $data = $request->input('especificaciones_tecnicas');
        
        $etts = EspecificacionTecnica::updateOrCreate(
            ['proyecto_id' => $proyectoId],
            ['data' => json_encode($data)]
        );
        
        return response()->json([
            'success' => true, 
            'id' => $etts->id
        ]);
    }
}