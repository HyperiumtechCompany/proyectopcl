<?php

namespace App\Http\Middleware;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class EnsureGastFinSchema
{
    public function __construct(private readonly CostoDatabaseService $databases) {}

    public function handle(Request $request, Closure $next): Response
    {
        $project = $request->route('costoProject');
        if ($project instanceof CostoProject && ! Schema::connection('costos_tenant')->hasTable('gastfin_mat_compra_valores')) {
            $this->databases->runTenantMigrations($project->database_name);
        }

        return $next($request);
    }
}
