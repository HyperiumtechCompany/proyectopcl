<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Controllers\Controller;
use App\Models\Mantenimiento\MaintenancePlantilla;
use App\Services\Mantenimiento\MaintenanceMoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// A diferencia del resto de controladores de Mantenimiento, este NO vive detrás de
// SetCostosDatabase/EnsureMaintenanceSchema: las plantillas son del usuario, no de un
// CostoProject puntual (conexión DEFAULT, reutilizables en cualquiera de sus proyectos).
class MaintenancePlantillaController extends Controller
{
    public function __construct(private readonly MaintenanceMoService $mo) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['plantillas' => $this->mo->listPlantillas($request->user()->id)]);
    }

    public function destroy(Request $request, MaintenancePlantilla $plantilla): JsonResponse
    {
        abort_unless($plantilla->user_id === $request->user()->id, 403);
        $plantilla->delete();

        return response()->json(['deleted' => true]);
    }
}
