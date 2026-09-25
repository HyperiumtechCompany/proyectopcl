<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Catálogo de conductores: agrega el cable N2XOH (cobre, 0,6/1 kV, libre de
 * halógenos), que es el conductor POR DEFECTO de la red v2 y del puente de la
 * planta general pero no existía en `dialux_conductors` (solo THW-90): la
 * ampacidad de esos alimentadores nunca se verificaba.
 *
 * Valores = columna N2X0H de la "Tabla A" del Excel de origen
 * (`planes/Dialux/plan_caida_tension.md` §1.4), la MISMA tabla que ya usa el
 * motor CT de la V1 (`wireLengthCalculations.ts`). Referenciales, editables
 * en Catálogos; pendientes de confirmar contra la ficha del fabricante.
 *
 * Solo agrega filas del sistema (user_id null) que falten; no toca las
 * existentes ni las de usuarios.
 */
return new class extends Migration
{
    /** @var array<int, array{0: float, 1: float}> sección mm² => ampacidad A */
    private const N2XOH = [
        [2.5, 38], [4, 55], [6, 68], [10, 95], [16, 125], [25, 160], [35, 195],
        [50, 230], [70, 275], [95, 330], [120, 380], [150, 410], [185, 450],
        [240, 525], [300, 600], [400, 680], [500, 700],
    ];

    public function up(): void
    {
        $now = now();
        foreach (self::N2XOH as [$section, $ampacity]) {
            $exists = DB::table('dialux_conductors')
                ->whereNull('user_id')
                ->where('material', 'cobre')
                ->where('insulation', 'N2XOH')
                ->where('section_mm2', $section)
                ->exists();
            if ($exists) {
                continue;
            }
            DB::table('dialux_conductors')->insert([
                'user_id' => null,
                'material' => 'cobre',
                'section_mm2' => $section,
                'awg_ref' => null,
                'insulation' => 'N2XOH',
                'ampacity_a' => $ampacity,
                'price_per_meter' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('dialux_conductors')
            ->whereNull('user_id')
            ->where('insulation', 'N2XOH')
            ->delete();
    }
};
