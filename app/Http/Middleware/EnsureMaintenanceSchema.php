<?php

namespace App\Http\Middleware;

use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceDocument;
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
            abort_unless($project->canBeViewedBy($request->user()), 403);
        }

        // Última tabla del esquema (Gast. Fin. agrega mantenimiento_documentos.origen, que el
        // chequeo de módulo de abajo necesita).
        if (! Schema::connection('costos_tenant')->hasTable('gastfin_mat_compra_valores')) {
            if ($project instanceof CostoProject) {
                $this->databases->runTenantMigrations($project->database_name);
            }
        }

        if ($project instanceof CostoProject) {
            abort_unless(MaintenanceDocument::allowedFor($project, $request->route('documentId')), 404);
        }

        return $next($request);
    }
}
