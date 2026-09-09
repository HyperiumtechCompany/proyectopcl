<?php

use App\Services\CostoDatabaseService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Nivel B — Fase 1 (aditiva, reversible).
 *
 * Agrega cronograma_general.presupuesto_general_id como vínculo real a
 * presupuesto_general.id, y hace backfill por código de partida. NO crea la FK
 * ni borra columnas todavía — los reads siguen cayendo al JOIN por partida
 * cuando presupuesto_general_id es NULL. Ver planes/costos/plan_nivel_b_...md
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $cx = DB::connection($this->connection);

        if (! Schema::connection($this->connection)->hasTable('cronograma_general')
            || ! Schema::connection($this->connection)->hasTable('presupuesto_general')) {
            return;
        }

        if (! Schema::connection($this->connection)->hasColumn('cronograma_general', 'presupuesto_general_id')) {
            Schema::connection($this->connection)->table('cronograma_general', function (Blueprint $table) {
                $table->unsignedBigInteger('presupuesto_general_id')->nullable()->after('presupuesto_id');
                $table->index('presupuesto_general_id', 'idx_cg_presupuesto_general_id');
            });
        }

        // ── Backfill por partida (exacta, luego normalizada por padding) ──────
        $svc = app(CostoDatabaseService::class);

        $exact = [];   // [presupuesto_id][partida]            => pg.id
        $norm = [];    // [presupuesto_id][partida normalizada] => pg.id
        $anyExact = []; // [partida]            => pg.id  (fallback si cg.presupuesto_id es NULL/otro)
        $anyNorm = [];  // [partida normalizada] => pg.id

        foreach ($cx->table('presupuesto_general')->whereNull('deleted_at')->get(['id', 'presupuesto_id', 'partida']) as $r) {
            $p = trim((string) $r->partida);
            if ($p === '') {
                continue;
            }
            $n = $svc->normalizePartidaCode($p);
            $exact[$r->presupuesto_id][$p] ??= $r->id;
            $norm[$r->presupuesto_id][$n] ??= $r->id;
            $anyExact[$p] ??= $r->id;
            $anyNorm[$n] ??= $r->id;
        }

        $matched = 0;
        $unmatched = [];

        foreach ($cx->table('cronograma_general')->whereNull('presupuesto_general_id')->get(['id', 'presupuesto_id', 'partida']) as $cg) {
            $p = trim((string) $cg->partida);
            if ($p === '') {
                $unmatched[] = $cg->id;

                continue;
            }
            $n = $svc->normalizePartidaCode($p);
            $pid = $cg->presupuesto_id;

            $target = $exact[$pid][$p]
                ?? $norm[$pid][$n]
                ?? $anyExact[$p]
                ?? $anyNorm[$n]
                ?? null;

            if ($target !== null) {
                $cx->table('cronograma_general')->where('id', $cg->id)
                    ->update(['presupuesto_general_id' => $target]);
                $matched++;
            } else {
                $unmatched[] = $cg->id;
            }
        }

        Log::info('Nivel B Fase 1: backfill presupuesto_general_id', [
            'connection_db' => $cx->getDatabaseName(),
            'matched' => $matched,
            'unmatched' => count($unmatched),
            'unmatched_ids' => array_slice($unmatched, 0, 50),
        ]);
    }

    public function down(): void
    {
        if (Schema::connection($this->connection)->hasColumn('cronograma_general', 'presupuesto_general_id')) {
            Schema::connection($this->connection)->table('cronograma_general', function (Blueprint $table) {
                $table->dropIndex('idx_cg_presupuesto_general_id');
                $table->dropColumn('presupuesto_general_id');
            });
        }
    }
};
