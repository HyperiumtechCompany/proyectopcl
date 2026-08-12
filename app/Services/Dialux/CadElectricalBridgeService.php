<?php

namespace App\Services\Dialux;

/**
 * Puente server-side entre el Módulo Eléctrico analítico y el plano CAD
 * (`project.data`, BD): geometría + defaults para materializar tomacorrientes
 * de un Circuit y para ubicar el símbolo de un Panel -- ambas páginas Inertia
 * (canvas / eléctrico) no comparten estado en vivo, ver
 * `ElectricalProjectController::materializeOutlets`/`placePanel`.
 *
 * Los métodos de geometría espejan `resources/js/pages/dialux/hooks/outletPlacement.ts`
 * (`polygonPerimeter`/`distributeOutletsOnPerimeter`) y los defaults por
 * dispositivo espejan el subconjunto relevante de `ELECTRICAL_DEVICE_DEFAULTS`
 * en `resources/js/pages/dialux/hooks/types.ts` -- mantener sincronizados si
 * cambian ahí.
 */
class CadElectricalBridgeService
{
    /**
     * @param  array<int, array{x: float, y: float}>  $vertices
     */
    public static function polygonPerimeter(array $vertices): float
    {
        $n = count($vertices);
        if ($n < 2) {
            return 0.0;
        }

        $sum = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $a = $vertices[$i];
            $b = $vertices[($i + 1) % $n];
            $sum += hypot($b['x'] - $a['x'], $b['y'] - $a['y']);
        }

        return $sum;
    }

    /**
     * Reparte `$count` puntos uniformemente sobre el perímetro del polígono.
     *
     * @param  array<int, array{x: float, y: float}>  $vertices
     * @return array<int, array{x: float, y: float}>
     */
    public static function distributeOnPerimeter(array $vertices, int $count, ?float $startOffset = null): array
    {
        $perimeter = self::polygonPerimeter($vertices);
        if ($count <= 0 || $perimeter <= 0) {
            return [];
        }

        $n = count($vertices);
        $spacing = $perimeter / $count;
        $points = [];

        for ($index = 0; $index < $count; $index++) {
            $distance = fmod(($startOffset ?? $spacing / 2) + $index * $spacing, $perimeter);
            $point = $vertices[0];

            for ($edge = 0; $edge < $n; $edge++) {
                $start = $vertices[$edge];
                $end = $vertices[($edge + 1) % $n];
                $length = hypot($end['x'] - $start['x'], $end['y'] - $start['y']);

                if ($distance <= $length || $edge === $n - 1) {
                    $ratio = $length > 0 ? min($distance / $length, 1.0) : 0.0;
                    $point = [
                        'x' => $start['x'] + ($end['x'] - $start['x']) * $ratio,
                        'y' => $start['y'] + ($end['y'] - $start['y']) * $ratio,
                    ];
                    break;
                }

                $distance -= $length;
            }

            $points[] = $point;
        }

        return $points;
    }

    /**
     * Centro del bounding box de un conjunto de polígonos (rooms de una
     * escena) -- posición default razonable para ubicar un tablero recién
     * vinculado, ya que el Panel analítico no tiene geometría propia
     * (confirmado: `Panel` no tiene x/y en ningún punto del módulo eléctrico).
     * `null` si no hay ningún polígono (la escena no tiene rooms todavía) --
     * el llamador debe caer a un default fijo (0,0) en ese caso.
     *
     * @param  array<int, array<int, array{x: float, y: float}>>  $polygons
     * @return array{x: float, y: float}|null
     */
    public static function boundingBoxCenter(array $polygons): ?array
    {
        $minX = $minY = INF;
        $maxX = $maxY = -INF;
        $any = false;

        foreach ($polygons as $polygon) {
            foreach ($polygon as $point) {
                $any = true;
                $minX = min($minX, $point['x']);
                $maxX = max($maxX, $point['x']);
                $minY = min($minY, $point['y']);
                $maxY = max($maxY, $point['y']);
            }
        }

        if (! $any) {
            return null;
        }

        return ['x' => ($minX + $maxX) / 2.0, 'y' => ($minY + $maxY) / 2.0];
    }

    /**
     * Mapea el `code` del catálogo de tipos de tomacorriente del Módulo
     * Eléctrico (`DialuxOutletType.code`, ej. "bajo"/"alto_180", ver
     * `DialuxElectricalCatalogSeeder`) al `ElectricalDeviceType` del canvas.
     * Un código de catálogo agregado por el usuario que no calce con ninguno
     * de los seed conocidos cae al genérico "outlet_floor" -- mejor un
     * símbolo aproximado que no generar nada.
     */
    public static function mapOutletTypeCodeToDeviceType(string $code): string
    {
        return match ($code) {
            'bajo' => 'outlet_floor',
            'inicial' => 'outlet_initial',
            'alto' => 'outlet_waterproof',
            'alto_180' => 'outlet_high_180',
            'comunicaciones' => 'outlet_rack',
            'techo' => 'outlet_ceiling',
            'piso' => 'outlet_floor_box',
            'exterior' => 'outlet_waterproof',
            default => 'outlet_floor',
        };
    }

    /**
     * @return array{label: string, mountingHeight: float, properties: array<string, mixed>}
     */
    public static function outletDeviceDefaults(string $deviceType): array
    {
        $base = ['boxSize' => '100x55x50', 'boxMaterial' => 'RECTO', 'ratedPowerW' => 180];

        return match ($deviceType) {
            'outlet_initial' => ['label' => 'TI', 'mountingHeight' => 1.5, 'properties' => $base],
            'outlet_high_180' => ['label' => 'TA', 'mountingHeight' => 1.8, 'properties' => $base],
            'outlet_floor_box' => ['label' => 'TP', 'mountingHeight' => 0.0, 'properties' => [
                'boxSize' => '100x100x55', 'boxMaterial' => 'RECTO', 'ratedPowerW' => 180,
            ]],
            'outlet_waterproof' => ['label' => 'T', 'mountingHeight' => 1.2, 'properties' => $base],
            'outlet_ceiling' => ['label' => 'T', 'mountingHeight' => 0.0, 'properties' => $base],
            'outlet_rack' => ['label' => 'T', 'mountingHeight' => 2.0, 'properties' => $base],
            default => ['label' => 'T', 'mountingHeight' => 0.4, 'properties' => $base],
        };
    }

    /**
     * Defaults del conductor recto tablero→tomacorriente generado (Fase
     * D.3) -- mismo calibre que ya se muestra como referencia fija en
     * `RoomOutletsSection.tsx` ("4 mm² · AWG 12") para tomacorrientes.
     *
     * @return array{wireCount: int, wireLabel: string, routeType: string, tubeSize: int, conductorType: string, sectionMm2: float}
     */
    public static function conductorDefaults(): array
    {
        return [
            'wireCount' => 2,
            'wireLabel' => 'F+N',
            'routeType' => 'floor',
            'tubeSize' => 20,
            'conductorType' => 'THW-90',
            'sectionMm2' => 4,
        ];
    }

    /**
     * Defaults de `ElectricalDevice` para el símbolo de un tablero -- espeja
     * `ELECTRICAL_DEVICE_DEFAULTS.main_panel`/`.sub_panel` de `hooks/types.ts`.
     * `$isRoot` = true (Panel.parentPanelId === null) → tablero general (TG);
     * false → tablero de distribución (TD).
     *
     * @return array{mountingHeight: float, properties: array<string, mixed>}
     */
    public static function panelDeviceDefaults(bool $isRoot): array
    {
        $shared = [
            'lengthM' => 0,
            'designFactor' => 1.25,
            'connectionType' => 'star',
            'workingTemperatureC' => 20,
            'copperResistivity' => 0.0175,
            'defaultPowerFactor' => 0.9,
            'defaultDemandFactor' => 1,
            'boxMaterial' => 'F.G. Liviano',
        ];

        return $isRoot
            ? ['mountingHeight' => 1.8, 'properties' => array_merge($shared, [
                'voltage' => '380V', 'phases' => '3O', 'upstreamVoltageDropV' => 0,
            ])]
            : ['mountingHeight' => 1.8, 'properties' => array_merge($shared, [
                'voltage' => '220V', 'phases' => '1O', 'upstreamVoltageDropV' => 6.22,
            ])];
    }
}
