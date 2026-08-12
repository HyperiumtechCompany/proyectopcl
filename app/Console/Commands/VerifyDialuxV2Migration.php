<?php

namespace App\Console\Commands;

use App\Services\Dialux\V2\LegacyProjectMigrationVerifier;
use Illuminate\Console\Command;

class VerifyDialuxV2Migration extends Command
{
    protected $signature = 'dialux:v2:verify-migration {--json : Imprime el reporte en JSON}';

    protected $description = 'Verifica la integridad de la migración de proyectos DIALux v1 a módulos v2';

    public function handle(LegacyProjectMigrationVerifier $verifier): int
    {
        $report = $verifier->report();

        if ($this->option('json')) {
            $this->line((string) json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        } else {
            $this->components->info($report['valid']
                ? 'La migración DIALux v2 es consistente.'
                : 'Se encontraron inconsistencias en la migración DIALux v2.');
            $this->table(['Comprobación', 'Cantidad'], [
                ['Proyectos sin módulos', $report['projects_without_modules']],
                ['Dependencias sin módulo', array_sum($report['orphaned_dependencies'])],
                ['Dependencias vinculadas a otro proyecto', array_sum($report['mismatched_dependencies'])],
            ]);
        }

        return $report['valid'] ? self::SUCCESS : self::FAILURE;
    }
}
