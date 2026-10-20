<?php

namespace App\Services\GastFin;

use App\Domain\GastFin\Cents;
use App\Models\CostoProject;
use App\Models\GastFin\GastFinGrupo;
use App\Models\Mantenimiento\MaintenanceDocument;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Cabecera de Gast. Fin.: un mantenimiento_documentos con origen = 'delphin' por presupuesto,
 * creado la primera vez que se abre el modo. Así GG y los parámetros de RESUMEN reutilizan tal
 * cual la infraestructura de Mantenimiento (revisión/lock, escenarios GG, parametros JSON).
 */
class GastFinDocumentService
{
    public const ORIGEN = 'delphin';

    public const TIPOS_GRUPO = ['modulo', 'institucion', 'piso'];

    public function __construct(private readonly GastFinExpedienteService $expediente) {}

    public function resolve(CostoProject $project): MaintenanceDocument
    {
        $presupuestoId = DB::connection('costos_tenant')
            ->table('presupuestos')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->value('id');

        abort_if($presupuestoId === null, 422, 'No existe un presupuesto para este proyecto.');

        return MaintenanceDocument::query()->firstOrCreate(
            ['origen' => self::ORIGEN, 'presupuesto_id' => (int) $presupuestoId],
            ['public_id' => (string) Str::ulid(), 'nombre' => 'Gast. Fin. — '.($project->nombre ?? 'Proyecto'), 'moneda' => 'PEN'],
        );
    }

    public function expediente(MaintenanceDocument $document): array
    {
        return $this->expediente->forPresupuesto((int) $document->presupuesto_id);
    }

    /** @return array<int, array{tipo:?string, mo_aprobado_minor:?int, mat_aprobado_minor:?int}> */
    public function grupoConfig(MaintenanceDocument $document): array
    {
        return GastFinGrupo::query()
            ->where('documento_id', $document->id)
            ->get()
            ->mapWithKeys(fn (GastFinGrupo $grupo) => [$grupo->grupo_ref => [
                'tipo' => $grupo->tipo,
                'mo_aprobado_minor' => $grupo->mo_aprobado_minor,
                'mat_aprobado_minor' => $grupo->mat_aprobado_minor,
            ]])
            ->all();
    }

    /** Grupos de nivel 1 (pestañas de MAT) con su clasificación. */
    public function grupos(MaintenanceDocument $document): array
    {
        $expediente = $this->expediente($document);
        $config = $this->grupoConfig($document);

        return array_map(fn (array $grupo) => [
            'ref' => $grupo['ref'],
            'partida' => $grupo['partida'],
            'descripcion' => $grupo['descripcion'],
            'tipo' => $config[$grupo['ref']]['tipo'] ?? null,
            'materiales' => count($expediente['insumos'][$grupo['ref']]['materiales'] ?? []),
            'sin_metrado' => $expediente['sin_metrado'][$grupo['ref']] ?? 0,
        ], $expediente['grupos']);
    }

    public function assertGrupo(MaintenanceDocument $document, string $grupoRef): void
    {
        $refs = array_column($this->expediente($document)['grupos'], 'ref');
        abort_unless(in_array($grupoRef, $refs, true), 404, 'El nivel ya no existe en el presupuesto.');
    }

    /** @param array{tipo?:?string, mo_aprobado?:?string, mat_aprobado?:?string} $data */
    public function updateGrupo(MaintenanceDocument $document, string $grupoRef, array $data): int
    {
        $this->assertGrupo($document, $grupoRef);

        return $this->write($document, function () use ($document, $grupoRef, $data) {
            $grupo = GastFinGrupo::query()->firstOrNew(['documento_id' => $document->id, 'grupo_ref' => $grupoRef]);
            if (array_key_exists('tipo', $data)) {
                $grupo->tipo = $data['tipo'];
            }
            foreach (['mo_aprobado' => 'mo_aprobado_minor', 'mat_aprobado' => 'mat_aprobado_minor'] as $field => $column) {
                if (array_key_exists($field, $data)) {
                    $grupo->{$column} = $data[$field] === null ? null : Cents::of($data[$field]);
                }
            }
            $grupo->save();
        });
    }

    /** Mutación bajo lock del documento; devuelve la nueva revisión. */
    public function write(MaintenanceDocument $document, \Closure $mutation): int
    {
        return DB::connection('costos_tenant')->transaction(function () use ($document, $mutation) {
            $locked = MaintenanceDocument::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            $mutation();
            $locked->increment('revision');

            return (int) $locked->revision;
        }, attempts: 3);
    }
}
