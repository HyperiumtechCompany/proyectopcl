<?php

namespace App\Services\GastFin;

use App\Domain\GastFin\Cents;
use App\Domain\Mantenimiento\Resumen\ResumenCalculator;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Services\Mantenimiento\MaintenanceGgService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use Illuminate\Support\Facades\DB;

/**
 * RESUMEN de Gast. Fin. = el ResumenCalculator de Mantenimiento (mismas fórmulas y parámetros
 * manuales) alimentado con los totales de MO/MAT por nivel, más:
 * - Equipos y Herramientas del expediente sale en vivo del ACU (en Mantenimiento era manual).
 * - En el desagregado, una línea por nivel bajo Materiales y bajo Mano de Obra, con su
 *   Aprobado Ideal editable (gastfin_grupos; vacío = E.T. del nivel).
 */
class GastFinResumenService
{
    public function __construct(
        private readonly ResumenCalculator $calculator,
        private readonly GastFinDocumentService $documents,
        private readonly GastFinMoService $mo,
        private readonly GastFinMatService $mat,
        private readonly MaintenanceGgService $gg,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function payload(MaintenanceDocument $document): array
    {
        $expediente = $this->documents->expediente($document);
        $config = $this->documents->grupoConfig($document);
        $mo = $this->mo->payload($document);
        $matPorGrupo = $this->mat->allGroups($document);
        $gg = $this->gg->payload($document, $this->scenarios->activeFor($document, 'gg'));

        $matEt = 0;
        $matComprado = 0;
        foreach ($matPorGrupo as $mat) {
            $matEt += Cents::of($mat['totales']['et']);
            $matComprado += Cents::of($mat['totales']['total_comprado']);
        }
        $matGeneral = ['totales' => ['general' => [
            'pt_et' => Cents::format($matEt),
            'total_comprado' => Cents::format($matComprado),
            'saldo' => Cents::format($matEt - $matComprado),
        ]]];

        // Subcontratos y subpartidas de los ACU no se muestran en Gast. Fin. (decisión 2026-10-20).
        $equiposEt = 0;
        foreach ($expediente['totales'] as $porTipo) {
            $equiposEt += Cents::of($porTipo['equipos'] ?? '0');
        }

        $parametros = ResumenCalculator::normalizeParametros($document->parametros);
        $parametros['expediente']['equipos'] = Cents::format($equiposEt);

        $resumen = $this->calculator->payload($mo, $matGeneral, $gg, $parametros);

        foreach ($resumen['general']['rows'] as $i => $row) {
            if ($row['componente'] === 'equipos') {
                $resumen['general']['rows'][$i]['editable']['expediente'] = false;
            }
        }

        $resumen['desagregado']['rows'] = $this->withGrupoLines($resumen['desagregado']['rows'], $expediente, $config, $mo, $matPorGrupo);
        $resumen['grupos'] = $this->documents->grupos($document);

        return $resumen;
    }

    public function updateParametros(MaintenanceDocument $document, array $data): array
    {
        $revision = DB::connection('costos_tenant')->transaction(function () use ($document, $data) {
            $locked = MaintenanceDocument::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            $current = ResumenCalculator::normalizeParametros($locked->parametros);
            $locked->parametros = ResumenCalculator::normalizeParametros(array_replace_recursive($current, $data));
            $locked->increment('revision');
            $locked->save();

            return (int) $locked->revision;
        }, attempts: 3);

        return ['revision' => $revision, 'resumen' => $this->payload($document->refresh())];
    }

    private function withGrupoLines(array $rows, array $expediente, array $config, array $mo, array $matPorGrupo): array
    {
        $moPorGrupo = collect($mo['grupos'])->keyBy('ref');

        $matLines = [];
        $moLines = [];
        foreach ($expediente['grupos'] as $grupo) {
            $ref = $grupo['ref'];
            $label = $grupo['descripcion'];

            $mat = $matPorGrupo[$ref]['totales'] ?? null;
            if ($mat !== null && ($mat['et'] !== '0.00' || $mat['total_comprado'] !== '0.00')) {
                $manual = $config[$ref]['mat_aprobado_minor'] ?? null;
                $ideal = $manual === null ? $mat['et'] : Cents::format($manual);
                $matLines[] = [
                    ...$this->calculator->desagRow('grupo', $label, $ideal, $mat['et'], $mat['total_comprado']),
                    'grupo_ref' => $ref, 'campo' => 'mat_aprobado', 'ideal_manual' => $manual !== null,
                ];
            }

            $moGrupo = $moPorGrupo->get($ref);
            if ($moGrupo !== null) {
                $totales = $moGrupo['totales'];
                $moLines[] = [
                    ...$this->calculator->desagRow('grupo', $label, $totales['aprobado'], $totales['et_parcial'], $totales['pagado']),
                    'grupo_ref' => $ref, 'campo' => 'mo_aprobado', 'ideal_manual' => $totales['aprobado_manual'],
                ];
            }
        }

        $out = [];
        foreach ($rows as $row) {
            $out[] = $row;
            if (($row['tipo'] ?? null) === 'linea' && $row['label'] === 'Materiales') {
                array_push($out, ...$matLines);
            }
            if (($row['tipo'] ?? null) === 'linea' && $row['label'] === 'Subcontrato') {
                array_push($out, ...$moLines);
            }
        }

        return $out;
    }
}
