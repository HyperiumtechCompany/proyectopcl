<?php

namespace App\Http\Middleware;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetCostosDatabase
{
    public function __construct(protected CostoDatabaseService $dbService) {}

    /**
     * Read the {costoProject} route parameter,
     * resolve its database_name and configure the costos_tenant connection.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $project = $request->route('costoProject');

        if (! $project instanceof CostoProject) {
            $project = CostoProject::findOrFail($project);
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
