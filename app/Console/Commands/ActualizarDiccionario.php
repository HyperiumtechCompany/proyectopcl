<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Database\Seeders\DiccionarioSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ActualizarDiccionario extends Command
{
    /**
     * Backfill del catálogo fusionado 2026 (Diccionario + Índices INEI) a
     * proyectos ya existentes. Nunca borra filas: actualiza por descripción
     * normalizada (mayúsculas/tildes/espacios) preservando el id, para no
     * romper ningún insumo_productos.diccionario_id ya vinculado.
     *
     * @var string
     */
    protected $signature = 'costos:actualizar-diccionario {--project=} {--dry-run}';

    protected $description = 'Actualiza el catálogo diccionario (2026) en uno o todos los proyectos de costos existentes';

    public function handle(CostoDatabaseService $dbService): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $projectId = $this->option('project');

        $projects = $projectId
            ? CostoProject::where('id', $projectId)->get()
            : CostoProject::all();

        if ($projects->isEmpty()) {
            $this->error('No se encontró ningún proyecto.');

            return 1;
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '')."Actualizando diccionario en {$projects->count()} proyecto(s)...");

        $totalInsertados = 0;
        $totalActualizados = 0;

        foreach ($projects as $project) {
            try {
                $dbService->setTenantConnection($project->database_name);
                $connection = DB::connection('costos_tenant');

                $stats = DiccionarioSeeder::apply($connection, $dryRun);

                $totalInsertados += $stats['insertados'];
                $totalActualizados += $stats['actualizados'];

                $this->line(sprintf(
                    '  [%d] %s — insertados: %d, actualizados: %d, sin cambios: %d',
                    $project->id,
                    $project->nombre ?? $project->database_name,
                    $stats['insertados'],
                    $stats['actualizados'],
                    $stats['sin_cambios'],
                ));
            } catch (\Throwable $e) {
                $this->error("  [{$project->id}] {$project->database_name} — ERROR: {$e->getMessage()}");
            }
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '')."Listo. Total insertados: {$totalInsertados}, total actualizados: {$totalActualizados}.");

        return 0;
    }
}
