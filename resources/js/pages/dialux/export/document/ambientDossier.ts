import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import {
    DEFAULT_MAINTENANCE_FACTOR,
    DEFAULT_REFLECTANCE_CEILING,
    DEFAULT_REFLECTANCE_FLOOR,
    DEFAULT_REFLECTANCE_WALL,
    type DialuxAmbientDetail,
    type DialuxExportAsset,
    type DialuxExportSnapshot,
    type DialuxProjectPhotometricDefaults,
    type DialuxStructuredSummaryData,
} from '../domain/types';
import { buildAmbientLuminaireList, readFixturePowerWatts } from './productPages';

/**
 * Expediente por ambiente (métricas + 5 páginas de sub-sección por ambiente)
 * del informe formal. Extraído de `buildDialuxFormalDocument.ts` (Fase 2 del
 * plan maestro) sin cambiar comportamiento.
 */

export function polygonPerimeter(vertices: Array<{ x: number; y: number }>): number {
    if (vertices.length < 3) {
        return 0;
    }

    return vertices.reduce((sum, vertex, index) => {
        const next = vertices[(index + 1) % vertices.length]!;
        return sum + Math.hypot(next.x - vertex.x, next.y - vertex.y);
    }, 0);
}

export function polygonArea(vertices: Array<{ x: number; y: number }>): number {
    return polygonAreaM2(vertices);
}

function toDisplayLabel(value: string): string {
    return value
        .replaceAll('-', ' ')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function findStructuredSummaryData(
    assets: DialuxExportAsset[],
    id: string,
): DialuxStructuredSummaryData | null {
    const asset = assets.find((candidate) => candidate.id === id);

    if (
        !asset ||
        asset.kind !== 'structured' ||
        asset.data.type !== 'summary'
    ) {
        return null;
    }

    return asset.data;
}

export function buildAmbientDetails(
    snapshot: DialuxExportSnapshot,
    assets: DialuxExportAsset[],
): DialuxAmbientDetail[] {
    const assetIds = new Set(assets.map((asset) => asset.id));
    const projectPhotometricDefaults: DialuxProjectPhotometricDefaults =
        snapshot.project as DialuxProjectPhotometricDefaults;

    return [...snapshot.ambients]
        .sort((left, right) => {
            // Sort by floor first so "1° NIVEL" rooms come before "2° NIVEL".
            if (left.floorIndex !== right.floorIndex) {
                return left.floorIndex - right.floorIndex;
            }
            const roomCompare = left.roomName.localeCompare(
                right.roomName,
                'es',
            );
            if (roomCompare !== 0) {
                return roomCompare;
            }
            return left.index - right.index;
        })
        .map((ambient, index) => {
            const luminaires = buildAmbientLuminaireList(ambient);
            const totalPower = luminaires.reduce<number | null>(
                (sum, luminaire) => {
                    if (luminaire.powerWatts === null) {
                        return sum;
                    }

                    return (
                        (sum ?? 0) + luminaire.powerWatts * luminaire.quantity
                    );
                },
                null,
            );

            const planAssetId = `ambient-plan-svg-${ambient.id}`;
            const isoluxAssetId = `isolux-svg-${ambient.id}`;

            // Perímetro en las mismas unidades que metrics.area: si los vértices
            // están en otra escala, se corrige con la razón de áreas. El plano
            // útil descuenta la zona marginal en todo el contorno (aprox. de
            // polígono interior: A' = A - P·m + 4·m²), igual que DIALux evo
            // distingue "(Área)" de "(Plano útil)" en la potencia específica.
            const rawVertices = ambient.room.vertices ?? [];
            const rawArea = polygonArea(rawVertices);
            const scaleRatio =
                rawArea > 0 ? Math.sqrt(ambient.metrics.area / rawArea) : 1;
            const perimeter = polygonPerimeter(rawVertices) * scaleRatio;
            const marginal = ambient.metrics.marginalZone;
            const usefulArea = Math.min(
                ambient.metrics.area,
                Math.max(
                    ambient.metrics.area -
                        perimeter * marginal +
                        4 * marginal * marginal,
                    0.01,
                ),
            );

            return {
                ambientId: ambient.id,
                sceneId: ambient.sceneId,
                sceneName: ambient.sceneName,
                floorIndex: ambient.floorIndex,
                roomId: ambient.roomId,
                roomName: ambient.roomName,
                ambientName: ambient.name,
                activity: ambient.activity,
                area: Number(ambient.metrics.area.toFixed(2)),
                perimeter: Number(perimeter.toFixed(3)),
                usefulArea: Number(usefulArea.toFixed(2)),
                targetLux: ambient.metrics.illuminanceLux,
                avgLux:
                    ambient.metrics.avgLux === null
                        ? null
                        : Number(ambient.metrics.avgLux.toFixed(2)),
                minLux:
                    ambient.metrics.minLux === null
                        ? null
                        : Number(ambient.metrics.minLux.toFixed(2)),
                maxLux:
                    ambient.metrics.maxLux === null
                        ? null
                        : Number(ambient.metrics.maxLux.toFixed(2)),
                uniformity:
                    ambient.metrics.uniformity === null
                        ? null
                        : Number(ambient.metrics.uniformity.toFixed(3)),
                g2:
                    ambient.metrics.g2 === null
                        ? null
                        : Number(ambient.metrics.g2.toFixed(3)),
                uniformityTarget: ambient.metrics.uniformityTarget,
                ugr:
                    ambient.metrics.ugr === null
                        ? null
                        : Number(ambient.metrics.ugr.toFixed(2)),
                ugrLimit: ambient.metrics.ugrLimit,
                interiorHeight: Number(ambient.room.height.toFixed(3)),
                reflectionCeiling:
                    projectPhotometricDefaults.reflectionCeiling ??
                    DEFAULT_REFLECTANCE_CEILING,
                reflectionWall:
                    projectPhotometricDefaults.reflectionWall ??
                    DEFAULT_REFLECTANCE_WALL,
                reflectionFloor:
                    projectPhotometricDefaults.reflectionFloor ??
                    DEFAULT_REFLECTANCE_FLOOR,
                maintenanceFactor:
                    projectPhotometricDefaults.maintenanceFactor ??
                    DEFAULT_MAINTENANCE_FACTOR,
                usefulPlaneHeight: Number(
                    ambient.metrics.usefulPlaneHeight.toFixed(3),
                ),
                marginalZone: Number(ambient.metrics.marginalZone.toFixed(3)),
                calculationIndex: `WP${index + 1}`,
                fixtureCount: ambient.metrics.fixtureCount,
                totalPowerWatts:
                    totalPower === null ? null : Number(totalPower.toFixed(2)),
                lumensRequired: Number(
                    ambient.metrics.lumensRequired.toFixed(2),
                ),
                fixtureLumens: Number(ambient.metrics.fixtureLumens.toFixed(2)),
                exactQuantity: Number(ambient.metrics.exactQuantity.toFixed(2)),
                roundedQuantity: ambient.metrics.roundedQuantity,
                coverage: toDisplayLabel(ambient.metrics.coverage),
                complianceLabel: ambient.metrics.complies
                    ? 'Cumple'
                    : 'Revisar',
                planAssetId: assetIds.has(planAssetId) ? planAssetId : null,
                isoluxAssetId: assetIds.has(isoluxAssetId)
                    ? isoluxAssetId
                    : null,
                requirementEvaluations: ambient.metrics.requirementEvaluations,
                provenance: ambient.metrics.provenance,
                warnings: ambient.metrics.warnings,
                luminaires,
                fixturePositions: ambient.fixtures.map(
                    (fixture, fixtureIndex) => ({
                        id: fixture.id,
                        name: `Luminaria ${fixtureIndex + 1}`,
                        productName: fixture.name,
                        x: Number(fixture.x.toFixed(3)),
                        y: Number(fixture.y.toFixed(3)),
                        mountingHeight:
                            typeof fixture.z === 'number'
                                ? Number(fixture.z.toFixed(3))
                                : null,
                        brand: fixture.brand ?? null,
                        articleNumber:
                            fixture.articleNumber ??
                            fixture.productSourceFormat?.toUpperCase() ??
                            fixture.fixtureType ??
                            null,
                        lumens: fixture.lumens ?? null,
                        powerWatts: readFixturePowerWatts(fixture),
                    }),
                ),
            };
        });
}
