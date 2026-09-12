<?php

namespace App\Http\Middleware;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class EnsureMaintenanceSchema
{
    public function __construct(private readonly CostoDatabaseService $databases) {}

    public function handle(Request $request, Closure $next): Response
    {
        $project = $request->route('costoProject');
        if ($project instanceof CostoProject) {
            abort_unless($project->user_id === $request->user()?->id, 403);
            abort_unless($project->hasModule('mantenimiento'), 404);
        }

        if (! Schema::connection('costos_tenant')->hasTable('mantenimiento_mo_parcial')) {
            if ($project instanceof CostoProject) {
                $this->databases->runTenantMigrations($project->database_name);
            }
        }

        return $next($request);
    }
}
