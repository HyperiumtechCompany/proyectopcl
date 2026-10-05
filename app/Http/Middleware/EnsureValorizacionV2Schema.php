<?php

namespace App\Http\Middleware;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

/**
 * Valorización v2: exige dueño + módulo Cronograma Valorizado y crea sus tablas
 * en la base del proyecto si aún no existen (mismo patrón que mantenimiento).
 */
class EnsureValorizacionV2Schema
{
    public function __construct(private readonly CostoDatabaseService $databases) {}

    public function handle(Request $request, Closure $next): Response
    {
        $project = $request->route('costoProject');
        if ($project instanceof CostoProject) {
            abort_unless($project->user_id === $request->user()?->id, 403);
            abort_unless($project->hasModule('crono_valorizado'), 404);

            if (! Schema::connection('costos_tenant')->hasTable('valorizacion_v2_cortes')) {
                $this->databases->runTenantMigrations($project->database_name);
            }
        }

        return $next($request);
    }
}
