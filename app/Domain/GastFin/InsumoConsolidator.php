<?php

namespace App\Domain\GastFin;

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Domain\Mantenimiento\Money\MoneyAllocator;

/**
 * Expediente Técnico de Gast. Fin.: insumos de los ACU consolidados por grupo de nivel 1.
 *
 * Port fiel de flattenInsumos() + consolidateInsumos() de
 * resources/js/pages/costos/delphin/components/InsumosConsolidadosModal.tsx — mismas reglas
 * (metrado de la partida × cantidad del ACU, desperdicio en materiales, unidades "%" como monto,
 * redondeo a 10 decimales por uso) para que Gast. Fin. cuadre con el modal "Insumos consolidados".
 * Si cambia una regla allá, cambiarla acá (test de paridad en tests/Unit/GastFinConsolidatorTest.php).
 *
 * Función pura: no toca la BD.
 */
class InsumoConsolidator
{
    public const TIPOS = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'];

    /**
     * Grupo para partidas cuyo código raíz no tiene fila padre en el presupuesto.
     *
     * La clave de un grupo es su código raíz normalizado ("04"), NO presupuesto_general.id:
     * guardar el presupuesto desde Delphin borra y reinserta todas las filas (ids nuevos en cada
     * guardado), así que el id no sirve para colgar pagos ni compras. El código sí se mantiene.
     */
    public const SIN_GRUPO = '_';

    public function __construct(
        private readonly DecimalMath $math,
        private readonly MoneyAllocator $allocator,
    ) {}

    /**
     * @param  list<array{id:int, partida:string, descripcion:string, metrado:mixed, parcial:mixed}>  $partidas  en orden de presupuesto
     * @param  list<array{partida:string, mano_de_obra?:mixed, materiales?:mixed, equipos?:mixed, subcontratos?:mixed, subpartidas?:mixed}>  $acus
     * @return array{
     *     grupos: list<array{ref:string, partida:string, descripcion:string}>,
     *     insumos: array<int, array<string, array<string, array{key:string, descripcion:string, unidad:string, cantidad:string, precio:string, parcial:string, parcial_minor:int}>>>,
     *     totales: array<int, array<string, string>>,
     *     sin_metrado: array<int, int>
     * }
     */
    public function consolidate(array $partidas, array $acus): array
    {
        $grupos = [];
        $grupoRefByRoot = [];
        foreach ($partidas as $row) {
            $code = self::normalizePartida((string) $row['partida']);
            if ($code !== '' && ! str_contains($code, '.') && ! isset($grupoRefByRoot[$code])) {
                $grupoRefByRoot[$code] = $code;
                $grupos[] = ['ref' => $code, 'partida' => (string) $row['partida'], 'descripcion' => trim((string) $row['descripcion'])];
            }
        }

        $partidasAcu = [];
        foreach ($acus as $acu) {
            $partidasAcu[self::normalizePartida((string) $acu['partida'])] = true;
        }

        // Igual que flattenInsumos: metrado > 0 gana (la última fila con ese código pisa a las
        // anteriores); si no hay metrado, el parcial solo entra cuando el código aún no tiene valor.
        $cantidadByPartida = [];
        foreach ($partidas as $row) {
            $code = self::normalizePartida((string) $row['partida']);
            if ($code === '' || ! isset($partidasAcu[$code])) {
                continue;
            }
            $metrado = self::dec($row['metrado'] ?? 0);
            $parcial = self::dec($row['parcial'] ?? 0);
            if (bccomp($metrado, '0', DecimalMath::SCALE) > 0) {
                $cantidadByPartida[$code] = $metrado;
            } elseif (bccomp($parcial, '0', DecimalMath::SCALE) > 0 && ! isset($cantidadByPartida[$code])) {
                $cantidadByPartida[$code] = $parcial;
            }
        }

        $codigosPresupuesto = [];
        foreach ($partidas as $row) {
            $codigosPresupuesto[self::normalizePartida((string) $row['partida'])] = true;
        }

        $insumos = [];
        $sinMetrado = [];
        foreach ($acus as $acu) {
            $code = self::normalizePartida((string) $acu['partida']);
            if (! isset($codigosPresupuesto[$code])) {
                continue; // ACU huérfano: su partida ya no está en el presupuesto
            }

            $root = explode('.', $code)[0];
            $grupoRef = $grupoRefByRoot[$root] ?? self::SIN_GRUPO;

            // A diferencia del modal (que las descarta), una partida con metrado 0 SÍ lista sus
            // insumos, con consumo 0: el usuario ve qué lleva el nivel y puede registrar compras;
            // los montos no cambian porque 0 × cantidad del ACU = 0.
            $presupuestoCantidad = $cantidadByPartida[$code] ?? '0';
            if (bccomp($presupuestoCantidad, '0', DecimalMath::SCALE) === 0) {
                $sinMetrado[$grupoRef][$code] = true;
            }

            foreach (self::TIPOS as $tipo) {
                foreach (self::items($acu[$tipo] ?? []) as $item) {
                    $this->accumulate($insumos, $grupoRef, $tipo, $item, $presupuestoCantidad);
                }
            }
        }

        if (isset($insumos[self::SIN_GRUPO])) {
            $grupos[] = ['ref' => self::SIN_GRUPO, 'partida' => '', 'descripcion' => 'SIN NIVEL'];
        }

        $totales = [];
        foreach ($insumos as $grupoRef => $porTipo) {
            foreach ($porTipo as $tipo => $rows) {
                $total = '0';
                foreach ($rows as $key => $row) {
                    $total = bcadd($total, $row['parcial'], DecimalMath::SCALE);
                    $insumos[$grupoRef][$tipo][$key]['precio'] = bccomp($row['cantidad'], '0', DecimalMath::SCALE) !== 0
                        ? $this->math->divide($row['ponderado'], $row['cantidad'])
                        : $row['precio'];
                    unset($insumos[$grupoRef][$tipo][$key]['ponderado']);
                }
                $totales[$grupoRef][$tipo] = $this->math->normalize($total);
                $this->allocateCents($insumos[$grupoRef][$tipo], Cents::of($total));
            }
        }

        return [
            'grupos' => $grupos,
            'insumos' => $insumos,
            'totales' => $totales,
            'sin_metrado' => array_map('count', $sinMetrado), // partidas con ACU y metrado 0, por grupo
        ];
    }

    /**
     * parcial_minor por fila: reparte el total redondeado del grupo por mayor resto, para que la
     * suma de filas en pantalla/Excel cuadre al céntimo con el total (redondear fila por fila no).
     */
    private function allocateCents(array &$rows, int $totalMinor): void
    {
        $weights = array_map(fn (array $row) => $this->math->normalize($row['parcial']), $rows);
        $allNonNegative = array_reduce($weights, fn (bool $ok, string $w) => $ok && bccomp($w, '0', DecimalMath::SCALE) >= 0, true);

        $allocated = $allNonNegative && $totalMinor > 0
            ? $this->allocator->allocate($totalMinor, $weights)
            : array_map(fn (array $row) => Cents::of($row['parcial']), $rows);

        foreach ($allocated as $key => $minor) {
            $rows[$key]['parcial_minor'] = $minor;
        }
    }

    private function accumulate(array &$insumos, string $grupoRef, string $tipo, array $item, string $presupuestoCantidad): void
    {
        $descripcion = trim((string) ($item['descripcion'] ?? ''));
        if ($descripcion === '') {
            return;
        }

        $acuCantidad = self::dec($item['cantidad'] ?? 0);
        $precio = self::dec($tipo === 'equipos'
            ? ($item['precio_hora'] ?? $item['precio_unitario'] ?? 0)
            : ($item['precio_unitario'] ?? $item['precio_hora'] ?? 0));
        $unidad = mb_strtolower(trim((string) ($item['unidad'] ?? '')));
        $unidad = $unidad === '' ? '-' : $unidad;

        if (bccomp($acuCantidad, '0', DecimalMath::SCALE) === 0 || bccomp($precio, '0', DecimalMath::SCALE) === 0) {
            return;
        }

        if (str_starts_with($unidad, '%')) {
            $parcialAcu = bcmul(bcdiv($acuCantidad, '100', DecimalMath::SCALE), $precio, DecimalMath::SCALE);
            $monto = $this->math->round(bcmul($parcialAcu, $presupuestoCantidad, DecimalMath::SCALE + 1), 10);
            [$cantidad, $parcial, $ponderado, $precio] = [$monto, $monto, '0', '0'];
        } else {
            $factor = '1';
            if ($tipo === 'materiales') {
                $desperdicio = self::dec($item['factor_desperdicio'] ?? 1);
                $factor = bccomp($desperdicio, '1', DecimalMath::SCALE) > 0 ? $desperdicio : '1';
            }
            $cantidad = bcmul($presupuestoCantidad, $acuCantidad, DecimalMath::SCALE);
            $parcial = $this->math->round(bcmul(bcmul($cantidad, $precio, DecimalMath::SCALE), $factor, DecimalMath::SCALE + 1), 10);
            $ponderado = $parcial;
        }

        $key = self::insumoKey($tipo, $descripcion, $unidad);
        $existing = $insumos[$grupoRef][$tipo][$key] ?? null;

        $insumos[$grupoRef][$tipo][$key] = $existing === null
            ? ['key' => $key, 'descripcion' => $descripcion, 'unidad' => $unidad, 'cantidad' => $cantidad, 'precio' => $precio, 'parcial' => $parcial, 'ponderado' => $ponderado]
            : [
                ...$existing,
                'cantidad' => bcadd($existing['cantidad'], $cantidad, DecimalMath::SCALE),
                'parcial' => bcadd($existing['parcial'], $parcial, DecimalMath::SCALE),
                'ponderado' => bcadd($existing['ponderado'], $ponderado, DecimalMath::SCALE),
            ];
    }

    public static function insumoKey(string $tipo, string $descripcion, string $unidad): string
    {
        return $tipo.'|'.self::normalizeKey($descripcion).'|'.self::normalizeKey($unidad);
    }

    /** normalizeKey() del modal: sin tildes, minúsculas, solo [\w\s.-], espacios colapsados. */
    public static function normalizeKey(string $value): string
    {
        // Las mismas descripciones se repiten miles de veces entre ACUs: memo por proceso.
        static $memo = [];
        if (isset($memo[$value])) {
            return $memo[$value];
        }
        if (count($memo) > 50000) {
            $memo = [];
        }

        return $memo[$value] = self::computeNormalizeKey($value);
    }

    private static function computeNormalizeKey(string $value): string
    {
        if (class_exists(\Normalizer::class)) {
            $value = (string) \Normalizer::normalize($value, \Normalizer::FORM_D);
        }
        $value = (string) preg_replace('/\p{Mn}/u', '', $value);
        $value = trim((string) preg_replace('/\s+/u', ' ', mb_strtolower($value)));
        $value = (string) preg_replace('/[^A-Za-z0-9_\s.\-]/u', '', $value);

        return (string) preg_replace('/\s+/u', ' ', $value);
    }

    /** "4.1.1" → "04.01.01" (normalizedPartida del modal). */
    public static function normalizePartida(string $value): string
    {
        $parts = array_filter(explode('.', trim($value)), fn (string $part) => $part !== '');

        return implode('.', array_map(fn (string $part) => str_pad($part, 2, '0', STR_PAD_LEFT), $parts));
    }

    /** @return list<array<string, mixed>> */
    private static function items(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        return is_array($value) ? array_values(array_filter($value, 'is_array')) : [];
    }

    /** Numérico de BD/JSON → string bcmath (nunca notación científica). */
    public static function dec(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '0';
        }
        if (is_float($value)) {
            return rtrim(rtrim(sprintf('%.10F', $value), '0'), '.') ?: '0';
        }
        $value = trim((string) $value);

        return is_numeric($value) && ! str_contains(strtolower($value), 'e') ? $value : (is_numeric($value) ? self::dec((float) $value) : '0');
    }
}
