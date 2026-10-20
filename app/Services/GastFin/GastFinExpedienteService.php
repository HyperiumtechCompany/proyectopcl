<?php

namespace App\Services\GastFin;

use App\Domain\GastFin\InsumoConsolidator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Lee presupuesto_general + presupuesto_acus (1 consulta cada una) y devuelve el E.T. consolidado
 * por grupo de nivel 1. Es el cálculo caro de Gast. Fin. (miles de partidas × líneas de ACU), así
 * que en MySQL se cachea con una huella del contenido de ambas tablas: editar una compra o un pago
 * no reconsolida nada, y cualquier cambio de metrado o de ACU invalida la caché sola.
 */
class GastFinExpedienteService
{
    /** Subir cuando cambie una regla de InsumoConsolidator: la huella solo mira los datos. */
    private const RULES_VERSION = 3;

    /** @var array<string, array> memo por request (varias hojas en la misma petición) */
    private array $memo = [];

    public function __construct(private readonly InsumoConsolidator $consolidator) {}

    public function forPresupuesto(int $presupuestoId): array
    {
        $connection = DB::connection('costos_tenant');
        $fingerprint = $this->fingerprint($presupuestoId);
        $memoKey = $connection->getDatabaseName().':'.$presupuestoId.':'.($fingerprint ?? 'nocache');

        if (isset($this->memo[$memoKey])) {
            return $this->memo[$memoKey];
        }

        $build = fn () => $this->build($presupuestoId);

        return $this->memo[$memoKey] = $fingerprint === null
            ? $build()
            : Cache::remember('gastfin:et:v'.self::RULES_VERSION.':'.$memoKey, now()->addDay(), $build);
    }

    private function build(int $presupuestoId): array
    {
        $connection = DB::connection('costos_tenant');

        $partidas = $connection->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->orderByRaw('COALESCE(item_order, 999999), id')
            ->get(['id', 'partida', 'descripcion', 'metrado', 'parcial'])
            ->map(fn ($row) => (array) $row)
            ->all();

        $acus = $connection->table('presupuesto_acus')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['partida', ...InsumoConsolidator::TIPOS])
            ->map(fn ($row) => (array) $row)
            ->all();

        return $this->consolidator->consolidate($partidas, $acus);
    }

    /**
     * Huella barata calculada en MySQL (no trae los JSON de ACU a PHP). Fuera de MySQL (tests en
     * SQLite) no hay CRC32 → sin caché, siempre se recalcula.
     */
    private function fingerprint(int $presupuestoId): ?string
    {
        $connection = DB::connection('costos_tenant');
        if ($connection->getDriverName() !== 'mysql') {
            return null;
        }

        $general = $connection->selectOne(
            "SELECT COUNT(*) c, COALESCE(SUM(CRC32(CONCAT_WS('|', id, partida, descripcion, metrado, parcial))), 0) h
             FROM presupuesto_general WHERE presupuesto_id = ? AND deleted_at IS NULL",
            [$presupuestoId],
        );
        $acus = $connection->selectOne(
            "SELECT COUNT(*) c, COALESCE(SUM(CRC32(CONCAT_WS('|', partida, mano_de_obra, materiales, equipos, subcontratos, subpartidas))), 0) h
             FROM presupuesto_acus WHERE presupuesto_id = ?",
            [$presupuestoId],
        );

        return md5(implode(':', [$general->c, $general->h, $acus->c, $acus->h]));
    }
}
