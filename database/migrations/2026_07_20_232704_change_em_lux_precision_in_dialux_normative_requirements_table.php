<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * `em_lux` era unsignedInteger, pero EN 1838 exige valores fraccionarios
     * reales (p.ej. 0.5 lx para áreas antipánico) que un entero redondearía
     * a 0 — se ensancha a decimal para no perder precisión normativa.
     * Sin doctrine/dbal instalado, se usa SQL crudo en vez de ->change().
     * `MODIFY` es sintaxis exclusiva de MySQL; sqlite (usado en los tests,
     * ver phpunit.xml) no tiene tipado estricto de columnas, así que ahí el
     * ALTER es innecesario y se omite en vez de fallar.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE dialux_normative_requirements MODIFY em_lux DECIMAL(8, 2) UNSIGNED NULL');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE dialux_normative_requirements MODIFY em_lux INT UNSIGNED NULL');
        }
    }
};
