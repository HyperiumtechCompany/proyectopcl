<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class RunTenantMigrationAll extends Command
{
    protected $signature = 'tenant:migrate-all {--migration= : Solo esta migración (nombre de archivo)} {--pretend}';

    protected $description = 'Corre las migraciones de database/migrations/costos_tenant en TODAS las BD tenant de proyectos de costos';

    public function handle(): int
    {
        $projects = CostoProject::query()
            ->whereNotNull('database_name')
            ->orderBy('id')
            ->get(['id', 'nombre', 'database_name']);

        if ($projects->isEmpty()) {
            $this->warn('No hay proyectos de costos con database_name.');

            return self::SUCCESS;
        }

        $service = app(CostoDatabaseService::class);
        $migration = $this->option('migration');
        $failures = [];

        $this->info("Migrando {$projects->count()} BD tenant…");

        foreach ($projects as $project) {
            $this->line("→ [{$project->id}] {$project->database_name}  ({$project->nombre})");

            try {
                $service->setTenantConnection($project->database_name);

                $params = [
                    '--database' => 'costos_tenant',
                    '--force' => true,
                    '--path' => $migration
                        ? "database/migrations/costos_tenant/{$migration}"
                        : 'database/migrations/costos_tenant',
                ];
                if ($this->option('pretend')) {
                    $params['--pretend'] = true;
                }

                $code = Artisan::call('migrate', $params);
                $out = trim(Artisan::output());
                if ($out !== '') {
                    $this->line("  {$out}");
                }
                if ($code !== 0) {
                    $failures[] = $project->database_name;
                }
            } catch (\Throwable $e) {
                $this->error("  ERROR: {$e->getMessage()}");
                $failures[] = $project->database_name;
            }
        }

        if (! empty($failures)) {
            $this->newLine();
            $this->error('Fallaron: '.implode(', ', $failures));

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Todas las BD tenant migradas.');

        return self::SUCCESS;
    }
}
