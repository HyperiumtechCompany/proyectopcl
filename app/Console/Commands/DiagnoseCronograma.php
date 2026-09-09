<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DiagnoseCronograma extends Command
{
    protected $signature = 'cronograma:diagnose {projectId} {--json}';

    protected $description = 'Reporte de solo lectura del estado de cronograma_general de un proyecto (predecesoras, JOIN con presupuesto, duplicados)';

    public function handle(): int
    {
        $project = CostoProject::find($this->argument('projectId'));
        if (! $project) {
            $this->error("Proyecto {$this->argument('projectId')} no encontrado.");

            return self::FAILURE;
        }

        $service = app(CostoDatabaseService::class);
        $service->setTenantConnection($project->database_name);
        $cx = DB::connection('costos_tenant');

        $pid = $cx->table('presupuestos')->whereNull('deleted_at')->orderBy('id')->value('id');
        if (! $pid) {
            $this->error('El proyecto no tiene un presupuesto.');

            return self::FAILURE;
        }

        $rows = $cx->table('cronograma_general')->where('presupuesto_id', $pid)->orderBy('item_order')->get();
        $byId = $rows->keyBy('id');
        $byItemOrder = $rows->keyBy('item_order');
        $presupuestoPartidas = $cx->table('presupuesto_general')->where('presupuesto_id', $pid)->pluck('partida')->flip();

        // ── Resumen ──────────────────────────────────────────────────────────
        $conPreds = $rows->filter(fn ($r) => ! empty($r->predecesoras))->count();
        $sinFecha = $rows->filter(fn ($r) => empty($r->fecha_inicio))->count();
        $durCero = $rows->filter(fn ($r) => (int) $r->duracion_dias === 0)->count();
        $ioDistintos = $rows->pluck('item_order')->unique()->count();
        $partDup = $rows->groupBy('partida')->filter(fn ($g) => $g->count() > 1)->keys();
        $ioDup = $rows->groupBy('item_order')->filter(fn ($g) => $g->count() > 1)->keys();
        $joinRoto = $rows->filter(fn ($r) => ! isset($presupuestoPartidas[$r->partida]));

        // ── Nivel B Fase 1: FK presupuesto_general_id ────────────────────────
        $fkCol = Schema::connection('costos_tenant')
            ->hasColumn('cronograma_general', 'presupuesto_general_id');
        $fkNull = 0;
        $fkParcialMismatch = 0;
        if ($fkCol) {
            $pgById = $cx->table('presupuesto_general')->where('presupuesto_id', $pid)
                ->pluck('parcial', 'id');
            $pgByPartida = $cx->table('presupuesto_general')->where('presupuesto_id', $pid)
                ->pluck('parcial', 'partida');
            foreach ($rows as $r) {
                if ($r->presupuesto_general_id === null) {
                    $fkNull++;

                    continue;
                }
                $fkParcial = round((float) ($pgById[$r->presupuesto_general_id] ?? 0), 2);
                $partidaParcial = round((float) ($pgByPartida[$r->partida] ?? 0), 2);
                if (abs($fkParcial - $partidaParcial) >= 0.01) {
                    $fkParcialMismatch++;
                }
            }
        }

        // ── Predecesoras: refId vs source(item_order) ────────────────────────
        $refIdUsados = 0;
        $legadoSoloItemOrder = 0;
        $rotasRefId = 0;
        $cruzadasItemOrder = 0; // source apunta a un item_order que no coincide con el ref snapshot
        $detalle = [];

        foreach ($rows as $r) {
            $links = $r->predecesoras ? json_decode($r->predecesoras, true) : [];
            if (! is_array($links)) {
                continue;
            }
            foreach ($links as $l) {
                $refId = $l['refId'] ?? null;
                $source = (int) ($l['source'] ?? $l['taskId'] ?? 0);
                $refSnap = $l['ref'] ?? null;

                if ($refId !== null) {
                    $refIdUsados++;
                    $target = $byId->get((int) $refId);
                    if (! $target) {
                        $rotasRefId++;
                        $detalle[] = sprintf(
                            'Fila #%d (%s): refId %d ROTO — apuntaba a %s',
                            $r->item_order, $r->partida, $refId,
                            $refSnap ? "{$refSnap['codigo']} {$refSnap['desc']}" : '¿?'
                        );
                    }
                } else {
                    $legadoSoloItemOrder++;
                    $target = $byItemOrder->get($source);
                    if ($target && $refSnap && ! empty($refSnap['codigo']) && $target->partida !== $refSnap['codigo']) {
                        $cruzadasItemOrder++;
                        $detalle[] = sprintf(
                            'Fila #%d (%s): source %d ahora es "%s" pero el snapshot decía "%s %s"',
                            $r->item_order, $r->partida, $source, $target->partida,
                            $refSnap['codigo'], $refSnap['desc']
                        );
                    } elseif (! $target) {
                        $detalle[] = sprintf('Fila #%d (%s): source %d no existe', $r->item_order, $r->partida, $source);
                    }
                }
            }
        }

        $report = [
            'proyecto' => ['id' => $project->id, 'nombre' => $project->nombre, 'db' => $project->database_name],
            'presupuesto_id' => $pid,
            'filas' => $rows->count(),
            'item_orders_distintos' => $ioDistintos,
            'con_predecesoras' => $conPreds,
            'sin_fecha_inicio' => $sinFecha,
            'duracion_cero' => $durCero,
            'item_order_duplicados' => $ioDup->all(),
            'partida_duplicadas' => $partDup->all(),
            'partidas_sin_presupuesto' => $joinRoto->map(fn ($r) => "{$r->item_order} · {$r->partida} · {$r->descripcion}")->values()->all(),
            'predecesoras' => [
                'con_refId' => $refIdUsados,
                'legado_solo_item_order' => $legadoSoloItemOrder,
                'refId_rotos' => $rotasRefId,
                'item_order_cruzados_vs_snapshot' => $cruzadasItemOrder,
            ],
            'nivel_b' => [
                'fk_column' => $fkCol,
                'filas_sin_fk' => $fkNull,
                'fk_vs_partida_parcial_mismatch' => $fkParcialMismatch,
            ],
            'detalle' => $detalle,
        ];

        if ($this->option('json')) {
            $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            return self::SUCCESS;
        }

        $this->info("Proyecto [{$project->id}] {$project->nombre}  —  presupuesto_id {$pid}");
        $this->table(['métrica', 'valor'], [
            ['filas', $rows->count()],
            ['item_orders distintos', $ioDistintos.($ioDistintos < $rows->count() ? '  ⚠ < filas' : '')],
            ['con predecesoras', $conPreds],
            ['sin fecha_inicio', $sinFecha],
            ['duración = 0', $durCero],
            ['item_order duplicados', $ioDup->isEmpty() ? '—' : $ioDup->implode(', ').'  ⚠'],
            ['partida duplicadas', $partDup->isEmpty() ? '—' : $partDup->implode(', ').'  ⚠'],
            ['partidas sin presupuesto (JOIN roto)', $joinRoto->count().($joinRoto->count() ? '  ⚠' : '')],
            ['predecesoras con refId', $refIdUsados],
            ['predecesoras legado (item_order)', $legadoSoloItemOrder],
            ['refId rotos', $rotasRefId.($rotasRefId ? '  ⚠' : '')],
            ['item_order cruzados vs snapshot', $cruzadasItemOrder.($cruzadasItemOrder ? '  ⚠' : '')],
            ['[Nivel B] FK presupuesto_general_id', $fkCol ? 'columna presente' : 'columna ausente (fase 1 sin correr)'],
            ['[Nivel B] filas sin FK (fallback partida)', $fkCol ? $fkNull.($fkNull ? '  (ok si son títulos/renombres)' : '') : '—'],
            ['[Nivel B] FK vs partida: parcial distinto', $fkCol ? $fkParcialMismatch.($fkParcialMismatch ? '  ⚠ DIVERGEN' : '  ✓') : '—'],
        ]);

        if (! empty($detalle)) {
            $this->newLine();
            $this->warn('Detalle de vínculos sospechosos:');
            foreach ($detalle as $d) {
                $this->line("  • {$d}");
            }
        }

        $this->newLine();
        if ($fkCol && $fkParcialMismatch > 0) {
            $this->error("⚠ Nivel B: {$fkParcialMismatch} filas donde el JOIN por FK y el JOIN por partida dan un parcial distinto. Revisar ANTES de retirar el fallback por partida.");
        }
        if ($rotasRefId === 0 && $cruzadasItemOrder === 0 && $joinRoto->isEmpty() && $ioDup->isEmpty() && $partDup->isEmpty() && $fkParcialMismatch === 0) {
            $this->info('✓ Sin señales de corrupción. El cronograma se ve sano.');
        } else {
            $this->error('⚠ Hay señales de daño previo. Revisar el detalle; puede requerir re-ingresar vínculos.');
        }

        return self::SUCCESS;
    }
}
