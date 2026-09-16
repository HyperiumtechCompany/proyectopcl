<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Nombre de TODAS las partidas (hoja Y grupo: "01", "01.01", "01.01.01"…)
 * para que las tablas jerárquicas (Valorizado, Avance Real, Prog vs Ejec)
 * muestren los mismos títulos de grupo que Delphin/Presupuesto.
 * presupuesto_general puede traer filas de grupo con descripcion vacía (el
 * nombre real vive en cronograma_general tras el merge de Delphin) — por
 * eso se fusionan las dos fuentes en vez de usar solo una.
 */
class PresupuestoJerarquiaService
{
    public function resolve(int $presupuestoId): Collection
    {
        $descPresupuesto = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->orderBy('item_order')
            ->get(['partida', 'descripcion'])
            ->mapWithKeys(fn ($p) => [trim($p->partida ?? '') => trim((string) ($p->descripcion ?? ''))]);

        $descCronograma = DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->orderBy('item_order')
            ->get(['partida', 'descripcion'])
            ->mapWithKeys(fn ($c) => [trim($c->partida ?? '') => trim((string) ($c->descripcion ?? ''))]);

        return $descCronograma
            ->merge($descPresupuesto->filter(fn ($d) => $d !== '')) // presupuesto pisa solo si tiene nombre
            ->filter(fn ($descripcion, $partida) => $partida !== '');
    }
}
