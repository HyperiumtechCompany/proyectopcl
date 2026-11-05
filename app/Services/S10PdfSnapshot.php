<?php

namespace App\Services;

final class S10PdfSnapshot
{
    public const SECTIONS = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'];

    /** Conserva los parciales de origen mientras los recursos importados no cambien. */
    public static function calculate(array $acu): ?array
    {
        $result = [];
        $declared = null;
        $count = 0;
        $totals = [];
        foreach (self::SECTIONS as $section) {
            $items = $acu[$section] ?? [];
            if (is_string($items)) {
                $items = json_decode($items, true);
            }
            if (! is_array($items)) {
                $items = [];
            }
            $subtotal = 0.0;
            foreach ($items as &$item) {
                $source = $item['source_pdf'] ?? null;
                if (! is_array($source) || ($source['format'] ?? null) !== 's10_pdf') {
                    return null;
                }
                $price = $section === 'equipos' ? ($item['precio_hora'] ?? 0) : ($item['precio_unitario'] ?? 0);
                $pairs = [
                    [$item['cantidad'] ?? 0, $source['quantity'] ?? null],
                    [$price, $source['price'] ?? null],
                    [$item['recursos'] ?? 0, $source['resources'] ?? null],
                    [$item['factor_desperdicio'] ?? 1, $source['factor'] ?? null],
                    [$acu['rendimiento'] ?? 1, $source['rendimiento'] ?? null],
                ];
                foreach ($pairs as [$current, $original]) {
                    if (! is_numeric($original) || ! is_finite((float) $original) || (float) $current !== (float) $original) {
                        return null;
                    }
                }
                if (($item['descripcion'] ?? '') !== ($source['description'] ?? null)
                    || ($item['unidad'] ?? '') !== ($source['unit'] ?? null)
                    || ($item['cod_insumo'] ?? $item['codigo'] ?? null) !== ($source['code'] ?? null)
                    || ! is_numeric($source['partial'] ?? null) || (float) $source['partial'] < 0
                    || ! is_finite((float) $source['partial']) || ! is_numeric($source['declared_cost'] ?? null)
                    || ! is_finite((float) $source['declared_cost'])) {
                    return null;
                }
                $declared ??= (float) $source['declared_cost'];
                if ($declared !== (float) $source['declared_cost']) {
                    return null;
                }
                $item['parcial'] = (float) $source['partial'];
                $subtotal += $item['parcial'];
                $count++;
            }
            unset($item);
            $result[$section] = $items;
            $totals[] = round($subtotal, 2);
        }
        if ($count === 0 || $declared === null || abs(round(array_sum($totals), 2) - $declared) > 0.0000000001) {
            return null;
        }
        foreach (['costo_mano_obra', 'costo_materiales', 'costo_equipos', 'costo_subcontratos', 'costo_subpartidas'] as $index => $key) {
            $result[$key] = $totals[$index];
        }
        $result['costo_unitario_total'] = $declared;

        return $result;
    }
}
