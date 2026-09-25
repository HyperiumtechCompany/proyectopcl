import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, LightingResult, Room } from '@/pages/dialux/hooks/types';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import { DEFAULT_LUMINAIRE, type LightingSummary } from './exteriorLighting';
import { gateEntrance } from './gateLayout';
import {
    canopyLightPoints,
    canopyLights,
    canopyRoofGeometry,
    gateLightPoints,
    type PlacedLight,
} from './siteLightPlacement';
import {
    hasTerrainData,
    sampleGroundElevation,
    terrainElevationPoints,
} from './terrainSurface';
import type { Point2D, SiteData, SiteElement, SiteElementType } from './types';

/**
 * Cálculo luminotécnico EXTERIOR de la Planta General con el MISMO motor de
 * la V1 (`hooks/lightingEngineCore.ts::calculateLightingResult`), sin
 * modificarlo — como DIALux evo en exteriores: una superficie de cálculo por
 * área (a nivel del suelo), iluminancia punto a punto con la fotometría real
 * IES/LDT de cada luminaria, sombras de edificios y, con la reflectancia del
 * suelo, la luminancia media.
 *
 * Traducción planta → motor V1:
 *  - área (cancha, estacionamiento, calle, vereda, jardín, plataforma, zona,
 *    techado, terreno) → `Room` con su polígono en metros, plano útil a 0 m
 *    (suelo) y sin zona marginal (en exteriores se calcula toda el área);
 *  - cada cabeza de poste → `Fixture` en metros, con z = altura de la cabeza
 *    sobre la cota del área (plataformas y relieve incluidos), `photometricWeb`
 *    del catálogo compartido con la V1 y `rotation` = rumbo del brazo (C0);
 *    el factor de mantenimiento de cada poste se aplica a su flujo;
 *  - edificios (`building_block` con altura) → cajas opacas de oclusión;
 *  - sin paredes ni techo: el cielo abierto no refleja → solo luz directa
 *    (idéntico a pasar reflectancias 0 al motor). La reflectancia del suelo
 *    solo se usa para la luminancia L = E·ρ/π.
 *
 * Posición de las cabezas: misma geometría que `SiteBuilder3D.buildPole`
 * (brazo `armLengthM` hacia `armDirectionDeg`, varias luminarias repartidas
 * alrededor del eje, giro del poste `rotation`), calculada en planta para no
 * depender del visor 3D.
 */

/** Tipos de espacio sobre los que se crea una superficie de cálculo. */
export const SITE_CALCULATION_AREA_TYPES = new Set<SiteElementType>([
    'court',
    'parking',
    'street',
    'sidewalk',
    'green_area',
    'terrace_platform',
    'custom_zone',
    'canopy',
    'terrain',
    // Rampas y escaleras: superficie inclinada evaluada como plano horizontal
    // a su cota media (aproximación declarada, ver `inclinedSurfaceElevationM`).
    'ramp',
    'stair',
]);

/**
 * Cota ABSOLUTA del plano de cálculo de una rampa/escalera: la media entre
 * `fromElevationM` y `toElevationM` (cotas absolutas, mismo datum que
 * `baseElevationM`). El motor calcula sobre planos horizontales: en los
 * extremos la altura real de las luminarias sobre la superficie difiere en
 * ±desnivel/2 — se avisa en el resultado.
 */
export function inclinedSurfaceElevationM(element: SiteElement): number | undefined {
    const config = element.config;
    if (config?.kind !== 'ramp' && config?.kind !== 'stair') return undefined;
    return (config.fromElevationM + config.toElevationM) / 2;
}

/**
 * Reflectancia del suelo por tipo de espacio — ESTIMACIÓN NO NORMATIVA (valores
 * típicos de asfalto, concreto, césped). Solo afecta la luminancia informada,
 * nunca la iluminancia.
 */
export const GROUND_REFLECTANCE: Partial<Record<SiteElementType, number>> = {
    street: 0.08,
    parking: 0.08,
    sidewalk: 0.25,
    court: 0.2,
    green_area: 0.1,
    terrace_platform: 0.2,
    custom_zone: 0.2,
    canopy: 0.25,
    terrain: 0.15,
};

const DEFAULT_GROUND_REFLECTANCE = 0.2;
/**
 * Radio de influencia: max(60 m, 15 × altura de la luminaria sobre el área).
 * A una distancia horizontal de 15 h la iluminancia horizontal es cos³γ ≈
 * 0.03 % de la de la vertical (γ = atan 15) para una misma intensidad —
 * despreciable incluso para mástiles altos, sin sesgar Emín/U0.
 */
const MIN_INFLUENCE_RADIUS_M = 60;
const INFLUENCE_HEIGHT_FACTOR = 15;
/** La luminaria debe estar por encima del plano de cálculo (bolardos incluidos). */
const MIN_HEIGHT_ABOVE_PLANE_M = 0.05;
/** Tope de puntos por superficie (el espaciado crece en áreas grandes). */
const MAX_POINTS_PER_AREA = 2500;

const NO_PLATFORM_REST = new Set<SiteElementType>([
    'terrain',
    'terrace_platform',
    'contour',
    'spot_elevation',
]);

function centroidOf(vertices: Point2D[]): Point2D {
    const n = vertices.length || 1;
    return {
        x: vertices.reduce((sum, v) => sum + v.x, 0) / n,
        y: vertices.reduce((sum, v) => sum + v.y, 0) / n,
    };
}

function polygonAreaM2(vertices: Point2D[], scaleM: number): number {
    let twice = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        twice += a.x * b.y - b.x * a.y;
    }
    return (Math.abs(twice) / 2) * scaleM * scaleM;
}

/** Cota (m) de la superficie en planta: plataforma más alta que la contiene, relieve modelado o 0. */
export function siteSurfaceElevationAt(site: SiteData, point: Point2D): number {
    let platformTop: number | undefined;
    for (const element of site.elements ?? []) {
        if (element.type !== 'terrace_platform' || element.visible === false) {
            continue;
        }
        if (!pointInPolygon(point, element.vertices)) continue;
        const z = element.baseElevationM ?? 0;
        if (platformTop === undefined || z > platformTop) platformTop = z;
    }
    if (platformTop !== undefined) return platformTop;
    const elements = site.elements ?? [];
    return hasTerrainData(elements)
        ? sampleGroundElevation(terrainElevationPoints(elements), point.x, point.y)
        : 0;
}

/** Cota absoluta (m) de la base de un objeto — mismo criterio que `SiteBuilder3D.anchorNode`. */
export function siteElementBaseElevation(
    site: SiteData,
    element: SiteElement,
): number {
    const center = centroidOf(element.vertices);
    if (element.type === 'terrace_platform') return element.baseElevationM ?? 0;
    if (element.type === 'terrain') return siteSurfaceElevationAt(site, center);
    if (!element.baseElevationM && !NO_PLATFORM_REST.has(element.type)) {
        return siteSurfaceElevationAt(site, center);
    }
    const elements = site.elements ?? [];
    const ground = hasTerrainData(elements)
        ? sampleGroundElevation(terrainElevationPoints(elements), center.x, center.y)
        : 0;
    return ground + (element.baseElevationM ?? 0);
}

/** Luminaria exterior en metros y cota absoluta (antes de relativizarla a cada área). */
export interface SiteLuminaire {
    /** Objeto de la planta al que pertenece (poste, portón o techado). */
    poleId: string;
    sourceType: 'pole' | 'gate' | 'canopy';
    label: string;
    x: number;
    y: number;
    /** Cota absoluta de la cabeza (m). */
    headElevationM: number;
    fixture: Fixture;
    hasPhotometry: boolean;
}

/** Fixture V1 de una luminaria exterior (metros; z se relativiza por área). */
function exteriorFixture(
    id: string,
    name: string,
    x: number,
    y: number,
    rotationDeg: number,
    lumens: number,
    maintenance: number,
    product: LuminairePhotometry | undefined,
): Fixture {
    return {
        id,
        name,
        x,
        y,
        z: 0,
        // El mantenimiento de CADA luminaria se aplica a su flujo (el motor V1
        // lo aplicaría a todo el resultado por igual).
        lumens: lumens * maintenance,
        efficiency: product?.web ? 1 : 0.85,
        rotation: rotationDeg,
        fixtureType: 'spot',
        ...(product?.web
            ? {
                  photometricWeb: {
                      ...product.web,
                      reference_lumens: product.web.reference_lumens ?? lumens,
                  },
              }
            : {}),
    } as unknown as Fixture;
}

/** Luces de portones y techados (mismo lugar que en 2D/3D, `siteLightPlacement.ts`). */
function attachedLuminaires(
    site: SiteData,
    element: SiteElement,
    photometry: ReadonlyMap<number, LuminairePhotometry>,
): SiteLuminaire[] {
    const scaleM = site.terrainScaleM || 1;
    let points: PlacedLight[] = [];
    let lumens = 0;
    let productId: number | undefined;
    let sourceType: 'gate' | 'canopy';
    if (element.type === 'gate' && element.config?.kind === 'gate') {
        const { lights } = gateEntrance(element.config);
        points = gateLightPoints(element, scaleM);
        lumens = lights.lumens;
        productId = lights.productId;
        sourceType = 'gate';
    } else if (element.type === 'canopy') {
        const lights = canopyLights(element);
        if (!lights) return [];
        points = canopyLightPoints(element, scaleM);
        lumens = lights.lumens;
        productId = lights.productId;
        sourceType = 'canopy';
    } else {
        return [];
    }
    if (points.length === 0) return [];
    const product = productId !== undefined ? photometry.get(productId) : undefined;
    const base = siteElementBaseElevation(site, element);
    return points.map((point, index) => ({
        poleId: element.id,
        sourceType,
        label: element.label,
        x: point.x,
        y: point.y,
        headElevationM: base + point.heightM,
        hasPhotometry: Boolean(product?.web),
        fixture: exteriorFixture(
            `${element.id}#${index}`,
            element.label,
            point.x,
            point.y,
            point.rotationDeg,
            lumens,
            DEFAULT_LUMINAIRE.maintenance,
            product,
        ),
    }));
}

/** Luminarias de postes, portones y techados visibles, con la fotometría del catálogo cuando la hay. */
export function siteLuminaires(
    site: SiteData,
    photometry: ReadonlyMap<number, LuminairePhotometry>,
): SiteLuminaire[] {
    const scaleM = site.terrainScaleM || 1;
    const result: SiteLuminaire[] = [];
    for (const element of site.elements ?? []) {
        if (
            (element.type === 'gate' || element.type === 'canopy') &&
            element.visible !== false
        ) {
            result.push(...attachedLuminaires(site, element, photometry));
            continue;
        }
        if (element.type !== 'pole' || element.visible === false) continue;
        const cfg = element.config?.kind === 'pole' ? element.config : undefined;
        const shaftHeight = cfg?.heightM ?? element.heightM ?? 6;
        const armLen = cfg?.armLengthM ?? 0;
        const armDir = ((cfg?.armDirectionDeg ?? 0) * Math.PI) / 180;
        const count = Math.max(1, cfg?.fixtures ?? 1);
        const product =
            cfg?.productId !== undefined ? photometry.get(cfg.productId) : undefined;
        const lumens =
            cfg?.lumens ??
            product?.totalLumens ??
            product?.web?.reference_lumens ??
            DEFAULT_LUMINAIRE.lumens;
        const maintenance = cfg?.maintenanceFactor ?? DEFAULT_LUMINAIRE.maintenance;
        const base = siteElementBaseElevation(site, element);
        const center = centroidOf(element.vertices);
        const theta = ((element.rotation ?? 0) * Math.PI) / 180;
        for (let i = 0; i < count; i++) {
            const ang = count === 1 ? armDir : armDir + (i * 2 * Math.PI) / count;
            // Local del poste (misma convención que buildPole) girado como el nodo 3D.
            const lx = Math.sin(ang);
            const ly = Math.cos(ang);
            const ux = lx * Math.cos(theta) + ly * Math.sin(theta);
            const uy = -lx * Math.sin(theta) + ly * Math.cos(theta);
            const x = center.x * scaleM + ux * armLen;
            const y = center.y * scaleM + uy * armLen;
            const headElevationM = base + shaftHeight - (armLen > 0 ? 0.1 : 0);
            result.push({
                poleId: element.id,
                sourceType: 'pole',
                label: element.label,
                x,
                y,
                headElevationM,
                hasPhotometry: Boolean(product?.web),
                fixture: exteriorFixture(
                    `${element.id}#${i}`,
                    element.label,
                    x,
                    y,
                    (Math.atan2(uy, ux) * 180) / Math.PI,
                    lumens,
                    maintenance,
                    product,
                ),
            });
        }
    }
    return result;
}

/**
 * Edificios y cubiertas opacas como cajas de oclusión (en metros), relativas a
 * la cota `baseM` del área. Una cubierta de techado opaca es una losa delgada a
 * la altura del alero: hace sombra a los postes, pero no a sus propias
 * luminarias (cuelgan por debajo). Se aproxima por su rectángulo envolvente,
 * a la altura de la cumbrera (en 2 caídas la luz rasante de un poste que
 * entre por debajo de la pendiente no se bloquea: aproximación declarada).
 */
function buildingOcclusionBoxes(
    site: SiteData,
    baseM: number,
): OcclusionBox[] {
    const scaleM = site.terrainScaleM || 1;
    const boxes: OcclusionBox[] = [];
    for (const element of site.elements ?? []) {
        if (
            element.type === 'canopy' &&
            element.config?.kind === 'canopy' &&
            !element.config.translucent &&
            element.visible !== false &&
            element.vertices.length >= 3
        ) {
            const xs = element.vertices.map((v) => v.x * scaleM);
            const ys = element.vertices.map((v) => v.y * scaleM);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            // Losa a la altura de la CUMBRERA (alero + rise en 2 caídas/arco):
            // las luminarias propias cuelgan bajo la pendiente — por encima del
            // alero — y nunca deben quedar tapadas por su propia cubierta.
            const { rise } = canopyRoofGeometry(element, scaleM);
            const eave =
                siteElementBaseElevation(site, element) -
                baseM +
                element.config.heightM +
                rise;
            boxes.push({
                originX: Math.min(...xs),
                originY: (minY + maxY) / 2,
                angleRad: 0,
                length: Math.max(...xs) - Math.min(...xs),
                thickness: maxY - minY,
                zMin: eave,
                zMax: eave + 0.15,
            });
            continue;
        }
        if (
            element.type !== 'building_block' ||
            element.visible === false ||
            element.vertices.length < 3 ||
            !(element.heightM && element.heightM > 0)
        ) {
            continue;
        }
        const xs = element.vertices.map((v) => v.x * scaleM);
        const ys = element.vertices.map((v) => v.y * scaleM);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const zMin = siteElementBaseElevation(site, element) - baseM;
        boxes.push({
            originX: minX,
            originY: (minY + maxY) / 2,
            angleRad: 0,
            length: maxX - minX,
            thickness: maxY - minY,
            zMin,
            zMax: zMin + element.heightM,
        });
    }
    return boxes;
}

export interface SiteLightingAreaResult {
    elementId: string;
    label: string;
    type: SiteElementType;
    areaM2: number;
    /** Cota absoluta (m) de la superficie de cálculo (para apoyar el mapa en 3D). */
    baseElevationM: number;
    /** Resultado completo del motor V1 (malla en metros, `grid_values`…). */
    result: LightingResult;
    /** Mismo formato que usa la verificación normativa del emplazamiento. */
    summary: LightingSummary;
    groundReflectance: number;
    /** Luminancia media L = Em·ρ/π (cd/m²). */
    avgLuminanceCdM2: number;
    spacingM: number;
    luminairesUsed: number;
    luminairesWithoutPhotometry: number;
}

export interface SiteLightingCalculation {
    areas: SiteLightingAreaResult[];
    luminaires: number;
    warnings: string[];
}

function spacingFor(widthM: number, lengthM: number): number {
    const target = Math.sqrt((widthM * lengthM) / MAX_POINTS_PER_AREA);
    const spacing = Math.max(0.5, target);
    return Math.ceil(spacing * 4) / 4; // múltiplos de 0.25 m
}

/** Calcula todas las superficies de cálculo del emplazamiento con el motor V1. */
export function calculateSiteLighting(
    site: SiteData,
    photometry: ReadonlyMap<number, LuminairePhotometry>,
    /** Calcula solo estas superficies (vista previa de la proyección: más rápido). */
    onlyAreaIds?: ReadonlySet<string>,
): SiteLightingCalculation {
    const scaleM = site.terrainScaleM || 1;
    const luminaires = siteLuminaires(site, photometry);
    const warnings: string[] = [];
    if (luminaires.length === 0) {
        warnings.push(
            'No hay luminarias en la planta general (postes, portones con luces o techados con luminarias).',
        );
    }
    const withoutPhotometry = luminaires.filter((lum) => !lum.hasPhotometry);
    if (withoutPhotometry.length > 0) {
        warnings.push(
            `${withoutPhotometry.length} luminaria(s) sin fotometría IES/LDT: el motor usa su modelo lambertiano por flujo. Elige un producto del catálogo para el cálculo real.`,
        );
    }

    const areas: SiteLightingAreaResult[] = [];
    for (const element of site.elements ?? []) {
        if (
            !SITE_CALCULATION_AREA_TYPES.has(element.type) ||
            element.visible === false ||
            element.vertices.length < 3 ||
            (onlyAreaIds && !onlyAreaIds.has(element.id))
        ) {
            continue;
        }
        const vertices = element.vertices.map((v) => ({
            x: v.x * scaleM,
            y: v.y * scaleM,
        }));
        const xs = vertices.map((v) => v.x);
        const ys = vertices.map((v) => v.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const inclinedM = inclinedSurfaceElevationM(element);
        const baseM = inclinedM ?? siteElementBaseElevation(site, element);
        if (inclinedM !== undefined && element.config && 'fromElevationM' in element.config) {
            const rise = Math.abs(element.config.toElevationM - element.config.fromElevationM);
            warnings.push(
                `${element.label}: superficie inclinada evaluada como plano horizontal a su cota media (${inclinedM.toFixed(2)} m); en los extremos la altura real difiere ±${(rise / 2).toFixed(2)} m (aproximación).`,
            );
        }
        let belowPlane = 0;
        const nearby = luminaires.filter((lum) => {
            const heightAbove = lum.headElevationM - baseM;
            const dx = Math.max(minX - lum.x, 0, lum.x - maxX);
            const dy = Math.max(minY - lum.y, 0, lum.y - maxY);
            const radius = Math.max(
                MIN_INFLUENCE_RADIUS_M,
                INFLUENCE_HEIGHT_FACTOR * Math.max(0, heightAbove),
            );
            if (Math.hypot(dx, dy) > radius) return false;
            if (heightAbove <= MIN_HEIGHT_ABOVE_PLANE_M) {
                // Por debajo del plano de cálculo (p.ej. en una plataforma más
                // baja): no ilumina esta superficie. Se informa, no se oculta.
                belowPlane += 1;
                return false;
            }
            return true;
        });
        if (belowPlane > 0) {
            warnings.push(
                `${element.label}: ${belowPlane} luminaria(s) cercanas quedan por debajo de esta superficie (cota inferior) y no la iluminan.`,
            );
        }
        const fixtures = nearby.map((lum) => ({
            ...lum.fixture,
            z: lum.headElevationM - baseM,
        }));
        const maxZ = fixtures.reduce((max, f) => Math.max(max, f.z), 0);
        const room = {
            id: `site-area-${element.id}`,
            name: element.label,
            vertices,
            height: maxZ + 1,
            color: '#ffffff',
            usefulPlaneHeight: 0,
            marginalZone: 0,
        } as unknown as Room;
        const spacingM = spacingFor(maxX - minX, maxY - minY);
        const result = calculateLightingResult(
            room,
            fixtures,
            spacingM,
            buildingOcclusionBoxes(site, baseM),
            null,
            null,
            null,
            undefined,
            1,
            0,
            false,
        );
        const groundReflectance =
            GROUND_REFLECTANCE[element.type] ?? DEFAULT_GROUND_REFLECTANCE;
        const areaM2 = polygonAreaM2(element.vertices, scaleM);
        areas.push({
            elementId: element.id,
            label: element.label,
            type: element.type,
            areaM2,
            baseElevationM: baseM,
            result,
            summary: {
                luminaires: fixtures.length,
                fluxLm: fixtures.reduce((sum, f) => sum + f.lumens, 0),
                avgLux: result.avg_lux,
                minLux: result.min_lux,
                maxLux: result.max_lux,
                uniformity: result.uniformity,
                areaM2,
            },
            groundReflectance,
            avgLuminanceCdM2: (result.avg_lux * groundReflectance) / Math.PI,
            spacingM,
            luminairesUsed: fixtures.length,
            luminairesWithoutPhotometry: nearby.filter((lum) => !lum.hasPhotometry)
                .length,
        });
    }
    return { areas, luminaires: luminaires.length, warnings };
}
