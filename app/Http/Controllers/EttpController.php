<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use App\Models\EspecificacionTecnica;

class EttpController extends Controller
{
    /**
     * Muestra la vista de especificaciones técnicas
     */
    public function index($id = null)
    {
        $initialData = null;
        
        if ($id) {
            // Buscar datos existentes
            $ettp = EspecificacionTecnica::find($id);
            if ($ettp && $ettp->data) {
                $initialData = json_decode($ettp->data, true);
            }
        }
        
        return Inertia::render('etpp/etts', [
            'especificacionesId' => $id,
            'initialData' => $initialData,
        ]);
    }
    
    /**
     * Obtiene especificaciones técnicas (API)
     */
    public function obtenerEspecificaciones(Request $request)
    {
        $id = $request->input('id');
        $ettp = EspecificacionTecnica::find($id);
        
        return response()->json([
            'data' => $ettp ? $ettp->data : null
        ]);
    }
    
    /**
     * Obtiene metrados (API)
     */
    public function obtenerMetrados(Request $request)
    {
        $proyectoId = $request->input('proyecto_id');
        
        // Aquí va tu lógica para obtener metrados según las opciones
        // estructura, arquitectura, sanitarias, electricas, comunicacion, gas
        
        // Ejemplo de respuesta
        $datos = [];
        
        return response()->json($datos);
    }
    
    /**
     * Guarda especificaciones técnicas (API)
     */
    public function guardarEspecificaciones(Request $request, $id)
    {
        $data = $request->input('especificaciones_tecnicas');
        
        $ettp = EspecificacionTecnica::updateOrCreate(
            ['id' => $id],
            ['data' => json_encode($data)]
        );
        
        return response()->json(['success' => true]);
    }
}