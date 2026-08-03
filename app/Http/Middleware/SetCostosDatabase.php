<?php

namespace App\Http\Middleware;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class SetCostosDatabase
{
    public function __construct(protected CostoDatabaseService $dbService) {}

    /**
     * Read the {costoProject} route parameter or other inputs,
     * resolve its database_name and configure the costos_tenant connection.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Búsqueda flexible de ID de proyecto o instancia
        $project = $request->route('costoProject')
            ?? $request->route('project')
            ?? $request->route('proyectoId')
            ?? $request->route('presupuestoId')
            ?? $request->query('project')
            ?? $request->input('proyecto_id')
            ?? $request->input('project_id');

        if (empty($project)) {
            abort(500, 'Error de configuración multi-tenant: No se encontró el contexto del proyecto (ID).');
        }

        if (! $project instanceof CostoProject) {
            $project = CostoProject::findOrFail($project);
        }

        // Verificar dueño del proyecto — sin esto, cualquier usuario autenticado
        // que conozca/adivine el ID puede leer y modificar datos de otro proyecto.
        if ($project->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }

        if ($project->is_demo && $project->demo_expires_at?->isPast()) {
            abort(403, 'Tu demo expiró. Actualiza tu plan para seguir accediendo.');
        }

        // Verify the database exists
        if (! $this->dbService->databaseExists($project->database_name)) {
            abort(500, "La base de datos del proyecto [{$project->nombre}] no existe.");
        }

        // Set the tenant connection to point to this project's DB
        $this->dbService->setTenantConnection($project->database_name);

        // Share project instance in request for downstream usage
        $request->attributes->set('costoProject', $project);

        return $next($request);
    }
}
