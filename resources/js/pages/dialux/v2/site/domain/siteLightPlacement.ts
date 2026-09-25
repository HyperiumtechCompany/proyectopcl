import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import { calculateFixtureGridPositions } from '@/pages/dialux/hooks/fixtureGrid';
import {
    gateAccess,
    gateEntrance,
    gateFrame,
    inwardNormal,
    isSpanGate,
} from './gateLayout';
import type { CanopyLights, SiteElement } from './types';

/**
 * Posición de las luminarias de portones (ingreso techado) y techados, en
 * METROS de planta (x, y = coordenadas de plano × escala) y altura sobre la
 * base del objeto. Fuente única para el cálculo luminotécnico
 * (`siteLightingCalculation.ts`), el 2D y el 3D (`SiteBuilder3D`), para que
 * las tres vistas pongan las luces en el mismo lugar.
 */
export interface PlacedLight {
    x: number;
    y: number;
    heightM: number;
    /**
     * Rumbo (°) del eje C0 de la fotometría en planta: hacia el interior en
     * portones, a lo largo de la cumbrera en techados. Importa con luminarias
     * asimétricas (auditoría `dialux-calc-reviewer`, Fase 6).
     */
    rotationDeg: number;
}

/**
 * Luces del ingreso de un portón en tramo — misma geometría que
 * `SiteBuilder3D.buildGateEntrance`: repartidas a lo largo del vano, a media
 * profundidad bajo la cubierta (o a 0.6 m hacia adentro si no hay cubierta).
 */
export function gateLightPoints(
    element: SiteElement,
    scaleM: number,
): PlacedLight[] {
    if (!isSpanGate(element) || element.config?.kind !== 'gate') return [];
    const { canopy, lights } = gateEntrance(element.config);
    if (!lights.enabled || lights.count <= 0) return [];
    const [a, b] = element.vertices;
    const frame = gateFrame(a, b, scaleM);
    const n = inwardNormal(frame, gateAccess(element.config).side);
    const under = canopy.enabled;
    const heightM = under
        ? Math.min(lights.heightM, canopy.heightM - 0.12)
        : lights.heightM;
    const inward = under ? canopy.depthM / 2 : 0.6;
    const points: PlacedLight[] = [];
    for (let i = 0; i < lights.count; i++) {
        const lat = ((i + 0.5) / lights.count - 0.5) * frame.lengthM;
        points.push({
            rotationDeg: (Math.atan2(n.y, n.x) * 180) / Math.PI,
            x: frame.mid.x * scaleM + frame.ux * lat + n.x * inward,
            y: frame.mid.y * scaleM + frame.uy * lat + n.y * inward,
            heightM,
        });
    }
    return points;
}

export const DEFAULT_CANOPY_LIGHTS: CanopyLights = {
    enabled: false,
    count: 4,
    lumens: 2000,
    wattage: 18,
};

export function canopyLights(element: SiteElement): CanopyLights | null {
    if (element.type !== 'canopy' || element.config?.kind !== 'canopy') {
        return null;
    }
    const lights = { ...DEFAULT_CANOPY_LIGHTS, ...(element.config.lights ?? {}) };
    return lights.enabled && canopyLightCount(lights) > 0 ? lights : null;
}

/** Total de luminarias del techado: filas × columnas si la grilla está definida. */
export function canopyLightCount(lights: CanopyLights): number {
    if (lights.rows && lights.columns) return lights.rows * lights.columns;
    return Math.max(0, lights.count);
}

/**
 * Geometría de la cubierta — MISMA que `siteScenery.buildRoofStructure`: la
 * cumbrera corre a lo LARGO (lado mayor del contorno) y las caídas a lo ANCHO;
 * `rise` = max(0.4, ancho × 0.14) en 2 caídas (0.16 en arco).
 */
export function canopyRoofGeometry(element: SiteElement, scaleM: number) {
    const cfg = element.config?.kind === 'canopy' ? element.config : undefined;
    const xs = element.vertices.map((v) => v.x * scaleM);
    const ys = element.vertices.map((v) => v.y * scaleM);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const widthX = Math.max(...xs) - minX;
    const lengthY = Math.max(...ys) - minY;
    const ridgeAlongX = widthX >= lengthY;
    const span = Math.min(widthX, lengthY);
    const roof = cfg?.roof ?? 'flat';
    const rise =
        roof === 'flat'
            ? 0
            : Math.max(0.4, span * (roof === 'arched' ? 0.16 : 0.14));
    const eaveM = cfg?.heightM ?? 3;
    /** Altura de la cara inferior de la cubierta en (x, y) metros. */
    const undersideAt = (x: number, y: number) => {
        if (roof === 'flat' || span <= 0) return eaveM;
        const u = ridgeAlongX ? (y - minY) / lengthY : (x - minX) / widthX;
        const t =
            roof === 'arched' ? 1 - Math.pow(2 * u - 1, 2) : 1 - Math.abs(2 * u - 1);
        return eaveM + rise * Math.max(0, t);
    };
    return { roof, ridgeAlongX, span, rise, eaveM, undersideAt };
}

/**
 * Regla de techo a 2 caídas: con la distribución ½-1-1-½ una luminaria cae en
 * la cumbrera solo si la cantidad A LO ANCHO (a través de las caídas) es
 * impar — se sube al par siguiente para que queden simétricas en cada caída.
 */
export function applyRoofRule(
    element: SiteElement,
    scaleM: number,
    rows: number,
    columns: number,
): { rows: number; columns: number; adjusted: boolean } {
    const geometry = canopyRoofGeometry(element, scaleM);
    if (geometry.roof !== 'gable') return { rows, columns, adjusted: false };
    // Cumbrera a lo largo de X → las caídas van en Y → filas (vertical) pares.
    if (geometry.ridgeAlongX && rows % 2 === 1) {
        return { rows: rows + 1, columns, adjusted: true };
    }
    if (!geometry.ridgeAlongX && columns % 2 === 1) {
        return { rows, columns: columns + 1, adjusted: true };
    }
    return { rows, columns, adjusted: false };
}

/**
 * Luces de un techado. Con filas × columnas: grilla de la V1
 * (`calculateFixtureGridPositions`, borde = ½ separación), regla de la
 * cumbrera en 2 caídas y altura = 15 cm bajo la cubierta EN ESE PUNTO (sigue
 * la pendiente). Sin grilla (datos previos): reparto por cantidad.
 */
export function canopyLightPoints(
    element: SiteElement,
    scaleM: number,
): PlacedLight[] {
    const lights = canopyLights(element);
    if (!lights || element.config?.kind !== 'canopy' || element.vertices.length < 3) {
        return [];
    }
    const geometry = canopyRoofGeometry(element, scaleM);
    const heightAt = (x: number, y: number) => {
        const underside = geometry.undersideAt(x, y) - 0.15;
        return Math.max(
            0.5,
            lights.mountHeightM !== undefined
                ? Math.min(lights.mountHeightM, underside)
                : underside,
        );
    };

    if (lights.rows && lights.columns) {
        const { rows, columns } = applyRoofRule(
            element,
            scaleM,
            lights.rows,
            lights.columns,
        );
        const verticesM = element.vertices.map((v) => ({
            x: v.x * scaleM,
            y: v.y * scaleM,
        }));
        return calculateFixtureGridPositions(verticesM, rows, columns).map((p) => ({
            x: p.x,
            y: p.y,
            heightM: heightAt(p.x, p.y),
            rotationDeg: geometry.ridgeAlongX ? 0 : 90,
        }));
    }

    // Legado: solo cantidad → grilla densificada dentro del contorno.
    const count = canopyLightCount(lights);
    const xs = element.vertices.map((v) => v.x);
    const ys = element.vertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const length = Math.max(...ys) - minY;
    if (width <= 0 || length <= 0) return [];
    let cols = Math.max(1, Math.round(Math.sqrt((count * width) / length)));
    for (let attempt = 0; attempt < 12; attempt++) {
        const rows = Math.max(1, Math.ceil(count / cols) + attempt);
        const inside: PlacedLight[] = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const px = minX + ((col + 0.5) / cols) * width;
                const py = minY + ((row + 0.5) / rows) * length;
                if (pointInPolygon({ x: px, y: py }, element.vertices)) {
                    inside.push({
                        x: px * scaleM,
                        y: py * scaleM,
                        heightM: heightAt(px * scaleM, py * scaleM),
                        rotationDeg: geometry.ridgeAlongX ? 0 : 90,
                    });
                }
            }
        }
        if (inside.length >= count) {
            const step = inside.length / count;
            return Array.from(
                { length: count },
                (_, i) => inside[Math.floor(i * step)],
            );
        }
        if (attempt % 2 === 1) cols += 1;
    }
    return [];
}
