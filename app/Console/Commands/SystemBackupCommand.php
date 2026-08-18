<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

class SystemBackupCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pcl:backup {--only-db : Solo hacer backup de la base de datos}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Realiza un backup completo del sistema, inyectando de manera dinámica todos los tenant DBs (Costos).';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Iniciando agrupamiento de bases de datos...');

        // 1. Obtener la conexión principal y todas las DBs tenant
        $databasesToBackup = ['mysql']; // Siempre incluir la DB principal

        $projects = CostoProject::select('database_name')->distinct()->get();
        $mysqlConfig = config('database.connections.mysql');

        foreach ($projects as $project) {
            $dbName = $project->database_name;
            if (! $dbName) {
                continue;
            }

            $connName = 'tenant_'.$dbName;

            // Inyectar la configuración al vuelo
            $tenantConfig = array_merge($mysqlConfig, [
                'database' => $dbName,
            ]);

            Config::set('database.connections.'.$connName, $tenantConfig);

            $databasesToBackup[] = $connName;
        }

        $this->info('Se encontraron '.count($databasesToBackup).' bases de datos a respaldar.');

        // 2. Sobrescribir la configuración de Spatie al vuelo
        Config::set('backup.backup.source.databases', $databasesToBackup);

        // Evitamos las notificaciones de error a menos que esten configuradas
        Config::set('backup.notifications.notifications', []);

        // Cambiamos temporalmente el nombre del zip
        Config::set('backup.backup.name', 'PCL_BACKUP');

        // 3. Ejecutar Spatie Backup
        $this->info('Lanzando Spatie Laravel Backup...');

        $args = [];
        if ($this->option('only-db')) {
            $args['--only-db'] = true;
        }

        try {
            // Deshabilitar timeout
            set_time_limit(0);
            $exitCode = Artisan::call('backup:run', $args, $this->output);

            if ($exitCode === 0) {
                $this->info('Backup masivo completado exitosamente.');
                Log::info('Backup masivo completado exitosamente ('.count($databasesToBackup).' DBs).');
            } else {
                $this->error('Hubo un problema ejecutando el backup.');
                Log::error('Fallo al ejecutar pcl:backup');
            }
        } catch (\Exception $e) {
            $this->error('Excepción en backup: '.$e->getMessage());
            Log::error('Excepción en pcl:backup: '.$e->getMessage());
        }

        return 0;
    }
}
