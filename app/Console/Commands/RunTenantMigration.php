<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class RunTenantMigration extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tenant:migrate {projectId} {migration?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run a specific migration on a tenant database';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $projectId = $this->argument('projectId');
        $migration = $this->argument('migration');

        $project = CostoProject::find($projectId);
        if (!$project) {
            $this->error("Project with ID {$projectId} not found.");
            return 1;
        }

        $service = app(CostoDatabaseService::class);
        $service->setTenantConnection($project->database_name);

        $this->info("Connected to database: {$project->database_name}");

        $params = [
            '--database' => 'costos_tenant',
            '--force' => true,
        ];

        if ($migration) {
            $params['--path'] = "database/migrations/costos_tenant/{$migration}";
        } else {
            $params['--path'] = 'database/migrations/costos_tenant';
        }

        $exitCode = Artisan::call('migrate', $params);

        $this->info(Artisan::output());

        return $exitCode;
    }
}
