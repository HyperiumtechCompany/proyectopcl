<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Services\CostoDatabaseService;
use App\Services\Mantenimiento\MaintenanceMoService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

// Exporta la estructura de una institución de Mantenimiento a un archivo JSON portátil, para
// llevarla a otro entorno (p. ej. de local a producción) con mantenimiento:plantilla-import — sin
// necesitar acceso directo a la base de datos DEFAULT de ese otro entorno. NO escribe nada en la
// base de datos de este entorno (a diferencia de MaintenanceMoService::savePlantilla(), que sí
// persiste): solo lee de la tenant DB del proyecto indicado y escribe el archivo.
class ExportMaintenancePlantilla extends Command
{
    protected $signature = 'mantenimiento:plantilla-export
        {project : ID del CostoProject dueño del documento}
        {document : public_id del documento de Mantenimiento}
        {institucion : public_id de la fila institución (tipo=ie) a exportar}
        {nombre : Nombre de la plantilla}
        {--descripcion= : Descripción opcional}
        {--out= : Ruta del archivo JSON de salida (por defecto storage/app/plantillas/<slug>.json)}';

    protected $description = 'Exporta la estructura de una institución de Mantenimiento a un JSON portátil, para importarla en otro entorno con mantenimiento:plantilla-import';

    public function handle(CostoDatabaseService $dbService, MaintenanceMoService $mo, MaintenanceScenarioService $scenarios): int
    {
        $project = CostoProject::find($this->argument('project'));
        if (! $project) {
            $this->error('No existe un CostoProject con ese ID en este entorno.');

            return self::FAILURE;
        }

        $dbService->setTenantConnection($project->database_name);

        $document = MaintenanceDocument::query()->where('public_id', $this->argument('document'))->first();
        if (! $document) {
            $this->error('No existe ese documento de Mantenimiento en el proyecto indicado.');

            return self::FAILURE;
        }

        $ie = MaintenancePartida::query()
            ->where('documento_id', $document->id)
            ->where('public_id', $this->argument('institucion'))
            ->first();
        if (! $ie || $ie->tipo !== 'ie') {
            $this->error('Ese public_id no corresponde a una fila de institución (tipo=ie) de ese documento.');

            return self::FAILURE;
        }

        $scenario = $scenarios->activeFor($document, 'mo');
        $estructura = $mo->buildPlantillaEstructura($scenario, $ie);

        $payload = [
            'nombre' => $this->argument('nombre'),
            'descripcion' => $this->option('descripcion'),
            'estructura' => $estructura,
        ];

        $outPath = $this->option('out') ?: storage_path('app/plantillas/'.Str::slug($this->argument('nombre')).'.json');
        if (! is_dir(dirname($outPath))) {
            mkdir(dirname($outPath), 0755, true);
        }
        file_put_contents($outPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->info("Plantilla exportada a: {$outPath}");
        $this->info('Nodos (bloques+partidas, sin contar la institución raíz): '.count($estructura));

        return self::SUCCESS;
    }
}
