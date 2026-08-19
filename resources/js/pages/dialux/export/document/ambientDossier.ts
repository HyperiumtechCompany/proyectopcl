import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import { calculateLeni } from '@/pages/dialux/hooks/leniCalculation';
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
            // Ver comentario junto a `reflectionCeiling` más abajo: el motor
            // no usó ninguna reflectancia real para este ambiente.
            const hasMissingMaterialReflectance = ambient.metrics.warnings.some(
                (warning) => warning.code === 'object-without-material-reflectance',
            );
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
                ugrIsManual: ambient.metrics.ugrIsManual,
                ugrLimit: ambient.metrics.ugrLimit,
                ra: ambient.metrics.ra,
                raRequired: ambient.metrics.raRequired,
                interiorHeight: Number(ambient.room.height.toFixed(3)),
                // Mismo criterio de resolución que el motor de cálculo real
                // (`roomLighting.ts` — reflectancias por ambiente, 0-1 ??
                // default), no el default de proyecto: ese queda
                // desconectado de lo que el motor realmente usó para
                // interreflexión, y mostrarlo hacía que el PDF reportara
                // "70/50/20" fijo aunque el recinto tuviera otro valor.
                //
                // `materialReflectanceMissing`: cuando el motor emitió
                // `object-without-material-reflectance` para este ambiente
                // (`resolveSurfaceReflectances()` en
                // `runDirectPreviewEngineAdapters.ts` — ningún valor de
                // reflectancia asignado), el cálculo real corrió en luz 100%
                // directa, sin ninguna reflexión. Mostrar igual "70%/50%/20%"
                // en la tabla de resumen en ese caso es engañoso: parece un
                // dato usado en el cálculo cuando es solo el valor de reserva
                // de visualización (`DEFAULT_REFLECTANCE_*`). Confirmado como
                // causa real de discrepancia frente a DIALux evo — ver
                // `planes/plan_cierre_brecha_paridad_dialux_evo.md` §2.1/§5.3.
                reflectionCeiling: hasMissingMaterialReflectance
                    ? null
                    : Math.round(
                          (ambient.room.ceilingReflectance ??
                              DEFAULT_REFLECTANCE_CEILING / 100) * 100,
                      ),
                reflectionWall: hasMissingMaterialReflectance
                    ? null
                    : Math.round(
                          (ambient.room.wallReflectance ??
                              DEFAULT_REFLECTANCE_WALL / 100) * 100,
                      ),
                reflectionFloor: hasMissingMaterialReflectance
                    ? null
                    : Math.round(
                          (ambient.room.floorReflectance ??
                              DEFAULT_REFLECTANCE_FLOOR / 100) * 100,
                      ),
                // `siteSettings.maintenanceFactor` (panel "Terreno" ·
                // Mantenimiento) es el override real que también alimenta el
                // cálculo — `projectPhotometricDefaults.maintenanceFactor`
                // queda como fallback legacy por si algún snapshot viejo lo
                // trae en la raíz en vez de anidado.
                maintenanceFactor:
                    snapshot.project.siteSettings?.maintenanceFactor ??
                    projectPhotometricDefaults.maintenanceFactor ??
                    DEFAULT_MAINTENANCE_FACTOR,
                // Pedido explícito del usuario (2026-08-19): un aula y un
                // pasillo del mismo proyecto no tienen el mismo uso diario
                // real — antes esto era UN SOLO valor para todo el proyecto
                // (`ProjectSiteSettings.dailyOperatingHours`), ahora cada
                // ambiente puede tener el suyo (`ambient.room.dailyOperatingHours`,
                // resuelto en `ambientSpaces.ts` con el mismo mecanismo que
                // `illuminanceLux`) — con el valor de proyecto como respaldo,
                // y 8 h/día si tampoco existe (el valor que estaba fijo
                // antes de que ninguno de los dos campos existiera).
                dailyOperatingHours:
                    ambient.room.dailyOperatingHours ??
                    snapshot.project.siteSettings?.dailyOperatingHours ??
                    8,
                // Fase B del cierre de brechas (`dialux-calc-reviewer`,
                // hallazgo bloqueante "motor LENI/EN 15193 no existe"):
                // `calculateLeni` devuelve `null` sin `leni.buildingType`
                // definido — en ese caso el bloque "Consumo (kWh/a)" simple
                // de arriba sigue siendo lo único que se muestra.
                leni: snapshot.project.siteSettings?.leni?.buildingType
                    ? calculateLeni({
                          installedPowerWatts: totalPower ?? 0,
                          usefulAreaM2: usefulArea,
                          leni: snapshot.project.siteSettings.leni,
                      })
                    : null,
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
