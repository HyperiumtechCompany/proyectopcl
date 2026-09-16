<?php

namespace App\Services;

use App\Models\CostoProject;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Cálculo por partida (programado vs. ejecutado, acumulado a un periodo de
 * corte) — extraído de ProgVsEjecController para que RESUMEN VAL. y PAGOS
 * ACUMULADOS (que necesitan la MISMA tabla por partida, solo que le
 * agregan la cascada financiera GG/Utilidad/IGV) no dupliquen esta lógica.
 * Lectura pura sobre 'cronograma_valorizado' y 'cronograma_ejecutado' — se
 * recalcula desde cero en cada carga.
 */
class ResumenValorizacionService
{
    public function __construct(
        private readonly CronogramaPeriodosService $periodosService,
        private readonly PresupuestoJerarquiaService $jerarquiaService,
    ) {}

    public function calcular(
        CostoProject $costoProject,
        int $presupuestoId,
        string $modoCalculo,
        ?string $periodoKeySolicitado
    ): array {
        $presupuesto = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->where('metrado', '>', 0)
            ->orderBy('item_order')
            ->get()
            ->keyBy(fn ($p) => trim($p->partida ?? ''));

        if ($presupuesto->isEmpty()) {
            return [
                'periodos' => [],
                'periodoSeleccionado' => null,
                'items' => [],
                'sinProgramado' => true,
                'sinEjecutado' => true,
            ];
        }

        $jerarquiaPresupuesto = $this->jerarquiaService->resolve($presupuestoId);
        $calendarSettings = $this->periodosService->fetchCalendarSettings($costoProject->id);
        $cronoPorPartida = $this->resolveCronoPorPartida($presupuestoId);
        $fechasProgramadas = $cronoPorPartida->filter(
            fn ($c) => ! empty($c->fecha_inicio) && ! empty($c->fecha_fin)
        );

        [$rangoInicio, $rangoFin] = $this->periodosService->resolveRango($costoProject, $calendarSettings, $fechasProgramadas);
        $periodos = $this->periodosService->generarPeriodos($modoCalculo, $rangoInicio, $rangoFin, $calendarSettings);

        // Periodo de corte: el que pide la URL, o el último por defecto (el
        // corte más reciente es el que normalmente se quiere revisar).
        $clavesPeriodos = array_column($periodos, 'key');
        $periodoKeySeleccionado = $periodoKeySolicitado;
        if (! $periodoKeySeleccionado || ! in_array($periodoKeySeleccionado, $clavesPeriodos, true)) {
            $periodoKeySeleccionado = end($clavesPeriodos) ?: null;
        }

        // Periodos "hasta el corte" (inclusive) — para los acumulados.
        $indiceCorte = array_search($periodoKeySeleccionado, $clavesPeriodos, true);
        $clavesHastaCorte = $indiceCorte !== false
            ? array_slice($clavesPeriodos, 0, $indiceCorte + 1)
            : [];

        $valorizadoGuardado = DB::connection('costos_tenant')
            ->table('cronograma_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->get()
            ->keyBy(fn ($v) => trim($v->partida ?? ''));

        $ejecutadoGuardado = DB::connection('costos_tenant')
            ->table('cronograma_ejecutado')
            ->where('presupuesto_id', $presupuestoId)
            ->get()
            ->keyBy(fn ($e) => trim($e->partida ?? ''));

        $sinProgramado = $valorizadoGuardado->isEmpty();
        $sinEjecutado = $ejecutadoGuardado->isEmpty();

        $items = [];
        foreach ($presupuesto as $pItem) {
            $partida = trim($pItem->partida ?? '');
            $parcial = round((float) ($pItem->parcial ?? 0), 2);
            $metradoContratado = (float) ($pItem->metrado ?? 0);

            $distProgramado = $this->decodeJsonColumn($valorizadoGuardado->get($partida), 'distribucion_mensual');
            $distEjecutado = $this->decodeJsonColumn($ejecutadoGuardado->get($partida), 'ejecucion_mensual');

            $progMensual = round((float) ($distProgramado[$periodoKeySeleccionado]['monto'] ?? 0), 2);
            $ejecMensual = round((float) ($distEjecutado[$periodoKeySeleccionado]['monto'] ?? 0), 2);
            $metradoEjecMensual = (float) ($distEjecutado[$periodoKeySeleccionado]['metrado'] ?? 0);

            $progAcum = 0.0;
            $ejecAcum = 0.0;
            $metradoEjecAcum = 0.0;
            foreach ($clavesHastaCorte as $key) {
                $progAcum += (float) ($distProgramado[$key]['monto'] ?? 0);
                $ejecAcum += (float) ($distEjecutado[$key]['monto'] ?? 0);
                $metradoEjecAcum += (float) ($distEjecutado[$key]['metrado'] ?? 0);
            }
            $progAcum = round($progAcum, 2);
            $ejecAcum = round($ejecAcum, 2);

            $pctProgAcum = $parcial > 0 ? round($progAcum / $parcial * 100, 4) : 0.0;
            $pctEjecAcum = $parcial > 0 ? round($ejecAcum / $parcial * 100, 4) : 0.0;

            $estado = match (true) {
                $pctEjecAcum + 0.0001 < $pctProgAcum => 'ATRASADA',
                $pctEjecAcum >= 100 => 'CULMINADA',
                default => 'ADELANTADA',
            };

            $items[$partida] = [
                'id' => (string) $pItem->id,
                'item' => $partida,
                'descripcion' => $pItem->descripcion ?? '',
                'und' => $pItem->unidad ?? '',
                'metradoContratado' => $metradoContratado,
                'metradoEjecutadoAcumulado' => round($metradoEjecAcum, 4),
                'metradoEjecutadoMensual' => round($metradoEjecMensual, 4),
                'parcial' => $parcial,
                'programadoMensual' => $progMensual,
                'programadoAcumulado' => $progAcum,
                'ejecutadoMensual' => $ejecMensual,
                'ejecutadoAcumulado' => $ejecAcum,
                // "Acumulado Anterior" (RESUMEN VAL./PAGOS ACUMULADOS): lo
                // ejecutado hasta el periodo ANTERIOR al corte — el mismo
                // acumulado menos lo de este periodo.
                'ejecutadoAcumuladoAnterior' => round($ejecAcum - $ejecMensual, 2),
                'pctProgramadoAcumulado' => $pctProgAcum,
                'pctEjecutadoAcumulado' => $pctEjecAcum,
                'desviacion' => round($pctEjecAcum - $pctProgAcum, 4),
                'estado' => $estado,
            ];
        }

        return [
            'periodos' => $periodos,
            'periodoSeleccionado' => $periodoKeySeleccionado,
            'items' => $this->buildTree($items, $jerarquiaPresupuesto),
            'sinProgramado' => $sinProgramado,
            'sinEjecutado' => $sinEjecutado,
        ];
    }

    /**
     * Sintetiza las filas de grupo (01, 01.01, 01.01.01…) con rollup —
     * mismo algoritmo que buildTreeItems.ts (Valorizado/Avance Real).
     */
    private function buildTree(array $leafItemsPorCodigo, Collection $jerarquiaPresupuesto): array
    {
        $byCode = $leafItemsPorCodigo;

        foreach (array_keys($leafItemsPorCodigo) as $code) {
            foreach ($this->parentCodes($code) as $parentCode) {
                if (! isset($byCode[$parentCode])) {
                    $byCode[$parentCode] = [
                        'id' => "group:{$parentCode}",
                        'item' => $parentCode,
                        'descripcion' => $jerarquiaPresupuesto[$parentCode] ?? "Partida {$parentCode}",
                        'und' => '',
                        'metradoContratado' => 0.0,
                        'metradoEjecutadoAcumulado' => 0.0,
                        'metradoEjecutadoMensual' => 0.0,
                        'parcial' => 0.0,
                        'programadoMensual' => 0.0,
                        'programadoAcumulado' => 0.0,
                        'ejecutadoMensual' => 0.0,
                        'ejecutadoAcumulado' => 0.0,
                        'ejecutadoAcumuladoAnterior' => 0.0,
                        'pctProgramadoAcumulado' => 0.0,
                        'pctEjecutadoAcumulado' => 0.0,
                        'desviacion' => 0.0,
                        'estado' => 'ADELANTADA',
                    ];
                }
            }
        }

        $codes = array_keys($byCode);
        usort($codes, 'strnatcmp');

        $hasChildren = [];
        foreach ($codes as $code) {
            foreach ($this->parentCodes($code) as $parentCode) {
                $hasChildren[$parentCode] = true;
            }
        }

        $leafCodes = array_filter($codes, fn ($c) => ! isset($hasChildren[$c]));

        foreach ($codes as $code) {
            if (! isset($hasChildren[$code])) {
                continue;
            }

            $descendientes = array_filter(
                $leafCodes,
                fn ($c) => str_starts_with($c, "{$code}.")
            );

            $sum = [
                'parcial' => 0.0, 'progMensual' => 0.0, 'progAcum' => 0.0,
                'ejecMensual' => 0.0, 'ejecAcum' => 0.0, 'ejecAcumAnterior' => 0.0,
            ];
            foreach ($descendientes as $dCode) {
                $d = $leafItemsPorCodigo[$dCode];
                $sum['parcial'] += $d['parcial'];
                $sum['progMensual'] += $d['programadoMensual'];
                $sum['progAcum'] += $d['programadoAcumulado'];
                $sum['ejecMensual'] += $d['ejecutadoMensual'];
                $sum['ejecAcum'] += $d['ejecutadoAcumulado'];
                $sum['ejecAcumAnterior'] += $d['ejecutadoAcumuladoAnterior'];
            }

            $parcial = round($sum['parcial'], 2);
            $progAcum = round($sum['progAcum'], 2);
            $ejecAcum = round($sum['ejecAcum'], 2);
            $pctProgAcum = $parcial > 0 ? round($progAcum / $parcial * 100, 4) : 0.0;
            $pctEjecAcum = $parcial > 0 ? round($ejecAcum / $parcial * 100, 4) : 0.0;
            $estado = match (true) {
                $pctEjecAcum + 0.0001 < $pctProgAcum => 'ATRASADA',
                $pctEjecAcum >= 100 => 'CULMINADA',
                default => 'ADELANTADA',
            };

            $byCode[$code] = [
                ...$byCode[$code],
                'parcial' => $parcial,
                'programadoMensual' => round($sum['progMensual'], 2),
                'programadoAcumulado' => $progAcum,
                'ejecutadoMensual' => round($sum['ejecMensual'], 2),
                'ejecutadoAcumulado' => $ejecAcum,
                'ejecutadoAcumuladoAnterior' => round($sum['ejecAcumAnterior'], 2),
                'pctProgramadoAcumulado' => $pctProgAcum,
                'pctEjecutadoAcumulado' => $pctEjecAcum,
                'desviacion' => round($pctEjecAcum - $pctProgAcum, 4),
                'estado' => $estado,
            ];
        }

        return array_map(function ($code) use ($byCode, $hasChildren) {
            return [
                ...$byCode[$code],
                'nivel' => substr_count($code, '.'),
                'isLeaf' => ! isset($hasChildren[$code]),
            ];
        }, $codes);
    }

    /** Códigos de todos los ancestros de una partida ("1.2.3" → ["1","1.2"]). */
    private function parentCodes(string $code): array
    {
        $parts = array_values(array_filter(explode('.', $code)));
        $ancestors = [];
        for ($i = 1; $i < count($parts); $i++) {
            $ancestors[] = implode('.', array_slice($parts, 0, $i));
        }

        return $ancestors;
    }

    private function decodeJsonColumn(?object $row, string $campo): array
    {
        if (! $row) {
            return [];
        }

        return json_decode($row->{$campo} ?? '', true) ?? [];
    }

    private function resolveCronoPorPartida(int $presupuestoId): Collection
    {
        return DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['partida', 'fecha_inicio', 'fecha_fin'])
            ->keyBy(fn ($r) => trim($r->partida ?? ''));
    }
}
