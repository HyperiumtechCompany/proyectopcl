<?php

use App\Domain\GastFin\InsumoConsolidator;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * gastfin_*.grupo_ref pasa de presupuesto_general.id a código raíz del nivel 1 ("04").
 *
 * Motivo: guardar el presupuesto desde Delphin borra y reinserta todas sus filas, así que los ids
 * cambian en cada guardado y lo registrado en Gast. Fin. se desenganchaba de su nivel. El código
 * de la partida raíz sí se conserva.
 *
 * Idempotente: solo convierte tablas cuya columna aún es numérica (tenants que corrieron la primera
 * versión de _000100). Los ids que ya no existen en presupuesto_general no se pueden traducir y se
 * descartan (solo pudo haber datos de prueba: el módulo aún no se desplegó).
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    /** tabla => columnas que, junto con grupo_ref, forman su clave única */
    private const TABLAS = [
        'gastfin_grupos' => ['documento_id'],
        'gastfin_mo_pago_valores' => ['pago_id', 'franja'],
        'gastfin_mat_insumos' => ['documento_id', 'insumo_key'],
        'gastfin_mat_compras' => null,
    ];

    public function up(): void
    {
        $schema = Schema::connection($this->connection);
        $db = DB::connection($this->connection);

        foreach (self::TABLAS as $tabla => $unique) {
            if (! $schema->hasTable($tabla) || ! $this->esNumerica($tabla)) {
                continue;
            }

            $schema->table($tabla, function (Blueprint $table) {
                $table->string('grupo_ref', 20)->change();
            });

            $codigos = $schema->hasTable('presupuesto_general')
                ? $db->table('presupuesto_general')->pluck('partida', 'id')
                : collect();

            foreach ($db->table($tabla)->orderBy('id')->get() as $row) {
                $partida = $codigos[(int) $row->grupo_ref] ?? null;
                $codigo = $partida === null ? null : explode('.', InsumoConsolidator::normalizePartida((string) $partida))[0];

                $choca = $codigo !== null && $unique !== null && $db->table($tabla)
                    ->where('grupo_ref', $codigo)
                    ->where('id', '!=', $row->id)
                    ->where(fn ($q) => array_map(fn (string $col) => $q->where($col, $row->{$col}), $unique))
                    ->exists();

                if ($codigo === null || $choca) {
                    $db->table($tabla)->where('id', $row->id)->delete();
                } else {
                    $db->table($tabla)->where('id', $row->id)->update(['grupo_ref' => $codigo]);
                }
            }
        }
    }

    public function down(): void
    {
        // Sin vuelta atrás: los ids de presupuesto_general cambian en cada guardado.
    }

    private function esNumerica(string $tabla): bool
    {
        $tipo = strtolower(Schema::connection($this->connection)->getColumnType($tabla, 'grupo_ref'));

        return str_contains($tipo, 'int');
    }
};
