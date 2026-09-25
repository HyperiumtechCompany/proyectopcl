import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, LightingResult, Room } from '@/pages/dialux/hooks/types';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import { DEFAULT_LUMINAIRE, type LightingSummary } from './exteriorLighting';
import { gateEntrance } from './gateLayout';
import { maskGrid, patchStats, planPatches } from './siteLightingPatches';
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

export { clipPolygonToRect, PATCH_ELEVATION_TOLERANCE_M } from './siteLightingPatches';

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
    /**
     * Resultado del motor V1 con la estadística de TODA la superficie
     * (Ēm/Emín/Emáx/U0 sobre todos sus parches). Su malla es la del primer
     * parche: para dibujar usar `patches`.
     */
    result: LightingResult;
    /**
     * Mallas calculadas, cada una a SU cota: una sola en superficies planas;
     * varias si la superficie tiene desnivel (terreno con relieve, zona sobre
     * varias plataformas). Los puntos que pertenecen a otra superficie de
     * cálculo más específica (p.ej. una plataforma dentro del terreno) van en
     * `null`: se calculan y dibujan en ESA superficie, a su cota.
     */
    patches: SiteLightingPatch[];
    /** Mismo formato que usa la verificación normativa del emplazamiento. */
    summary: LightingSummary;
    groundReflectance: number;
    /** Luminancia media L = Em·ρ/π (cd/m²). */
    avgLuminanceCdM2: number;
    spacingM: number;
    luminairesUsed: number;
    luminairesWithoutPhotometry: number;
    /** Luminarias propias (dentro del contorno o proyectadas para ella). */
    ownLuminaires: number;
    /** `fixture.id` de TODAS las luminarias que entraron al cálculo de esta superficie (informe por zona). */
    usedLuminaireIds: string[];
    /** Flujo mantenido (lm × Fm) de las luminarias propias. */
    ownMaintainedFluxLm: number;
}

export interface SiteLightingPatch {
    /** Cota absoluta (m) del plano de este parche. */
    baseElevationM: number;
    result: LightingResult;
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

/** = `siteFixtureProjection.PROJECTED_FOR_KEY` (sin importarlo: evita un ciclo de módulos). */
const PROJECTED_FOR_KEY = 'projectedFor';

/**
 * Dueño de cada punto: la superficie de cálculo visible MÁS ESPECÍFICA (de
 * menor área) que lo contiene. Así una plataforma, una cancha o un jardín
 * dibujados dentro del terreno se calculan a SU cota y el terreno no los
 * repite (a otra cota) debajo.
 */
function surfaceOwnership(site: SiteData, scaleM: number) {
    const surfaces = (site.elements ?? [])
        .filter(
            (element) =>
                SITE_CALCULATION_AREA_TYPES.has(element.type) &&
                element.visible !== false &&
                element.vertices.length >= 3,
        )
        .map((element) => {
            const vertices = element.vertices.map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
            const xs = vertices.map((v) => v.x);
            const ys = vertices.map((v) => v.y);
            return {
                id: element.id,
                vertices,
                area: polygonAreaM2(element.vertices, scaleM),
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
            };
        })
        .sort((a, b) => a.area - b.area);
    return (xM: number, yM: number): string | undefined =>
        surfaces.find(
            (surface) =>
                xM >= surface.minX &&
                xM <= surface.maxX &&
                yM >= surface.minY &&
                yM <= surface.maxY &&
                pointInPolygon({ x: xM, y: yM }, surface.vertices),
        )?.id;
}

/** Cota absoluta (m) de la superficie en un punto (metros), según cómo se apoya. */
function surfaceElevationFn(
    site: SiteData,
    element: SiteElement,
    scaleM: number,
): (xM: number, yM: number) => number {
    const inclined = inclinedSurfaceElevationM(element);
    if (inclined !== undefined) return () => inclined;
    if (element.type === 'terrace_platform') {
        const z = element.baseElevationM ?? 0;
        return () => z;
    }
    const toPlan = (xM: number, yM: number) => ({ x: xM / scaleM, y: yM / scaleM });
    // Terreno y objetos apoyados sin cota propia: la superficie real bajo el
    // punto (plataforma más alta o relieve).
    if (element.type === 'terrain' || (!element.baseElevationM && !NO_PLATFORM_REST.has(element.type))) {
        return (xM, yM) => siteSurfaceElevationAt(site, toPlan(xM, yM));
    }
    const elements = site.elements ?? [];
    const relief = hasTerrainData(elements) ? terrainElevationPoints(elements) : null;
    const offset = element.baseElevationM ?? 0;
    return (xM, yM) => {
        const p = toPlan(xM, yM);
        return (relief ? sampleGroundElevation(relief, p.x, p.y) : 0) + offset;
    };
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
    const ownerAt = surfaceOwnership(site, scaleM);
    const projectedFor = new Map(
        (site.elements ?? []).map((element) => [
            element.id,
            element.metadata?.[PROJECTED_FOR_KEY] as string | undefined,
        ]),
    );
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
        if (inclinedM !== undefined && element.config && 'fromElevationM' in element.config) {
            const rise = Math.abs(element.config.toElevationM - element.config.fromElevationM);
            warnings.push(
                `${element.label}: superficie inclinada evaluada como plano horizontal a su cota media (${inclinedM.toFixed(2)} m); en los extremos la altura real difiere ±${(rise / 2).toFixed(2)} m (aproximación).`,
            );
        }
        const owns = (xM: number, yM: number) => ownerAt(xM, yM) === element.id;
        const elevationAt = surfaceElevationFn(site, element, scaleM);
        const spacingM = spacingFor(maxX - minX, maxY - minY);
        const plan = planPatches(vertices, { minX, maxX, minY, maxY }, owns, elevationAt);
        if (plan.patches.length === 0) continue;
        if (plan.tiled) {
            warnings.push(
                `${element.label}: desnivel de ${plan.elevationRangeM.toFixed(2)} m — calculada en ${plan.patches.length} parches, cada uno a su propia cota.`,
            );
        }

        const belowPlaneIds = new Set<string>();
        const usedIds = new Set<string>();
        const withoutPhotometryIds = new Set<string>();
        let fluxLm = 0;
        const patches: SiteLightingPatch[] = [];
        for (const patch of plan.patches) {
            const baseM = patch.baseElevationM;
            const nearby = luminaires.filter((lum) => {
                const heightAbove = lum.headElevationM - baseM;
                const dx = Math.max(patch.minX - lum.x, 0, lum.x - patch.maxX);
                const dy = Math.max(patch.minY - lum.y, 0, lum.y - patch.maxY);
                const radius = Math.max(
                    MIN_INFLUENCE_RADIUS_M,
                    INFLUENCE_HEIGHT_FACTOR * Math.max(0, heightAbove),
                );
                if (Math.hypot(dx, dy) > radius) return false;
                if (heightAbove <= MIN_HEIGHT_ABOVE_PLANE_M) {
                    // Por debajo del plano de cálculo (p.ej. en una plataforma más
                    // baja): no ilumina esta superficie. Se informa, no se oculta.
                    belowPlaneIds.add(lum.fixture.id);
                    return false;
                }
                return true;
            });
            for (const lum of nearby) {
                if (!usedIds.has(lum.fixture.id)) {
                    usedIds.add(lum.fixture.id);
                    fluxLm += lum.fixture.lumens;
                }
                if (!lum.hasPhotometry) withoutPhotometryIds.add(lum.fixture.id);
            }
            const fixtures = nearby.map((lum) => ({
                ...lum.fixture,
                z: lum.headElevationM - baseM,
            }));
            const maxZ = fixtures.reduce((max, f) => Math.max(max, f.z), 0);
            const room = {
                id: `site-area-${element.id}`,
                name: element.label,
                vertices: patch.vertices,
                height: maxZ + 1,
                color: '#ffffff',
                usefulPlaneHeight: 0,
                marginalZone: 0,
            } as unknown as Room;
            const raw = calculateLightingResult(
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
            patches.push({ baseElevationM: baseM, result: maskGrid(raw, owns) });
        }
        const stats = patchStats(patches);
        if (!stats) continue;
        if (belowPlaneIds.size > 0) {
            warnings.push(
                `${element.label}: ${belowPlaneIds.size} luminaria(s) cercanas quedan por debajo de esta superficie (cota inferior) y no la iluminan.`,
            );
        }
        const result: LightingResult = {
            ...patches[0].result,
            avg_lux: stats.avg,
            min_lux: stats.min,
            max_lux: stats.max,
            uniformity: stats.uniformity,
        };
        // Luminarias PROPIAS de la superficie (verificación de cantidad de la
        // V1): dentro de su contorno o proyectadas para ella.
        const own = luminaires.filter(
            (lum) =>
                projectedFor.get(lum.poleId) === element.id ||
                (lum.sourceType !== 'pole' && lum.poleId === element.id) ||
                pointInPolygon({ x: lum.x, y: lum.y }, vertices),
        );
        const groundReflectance =
            GROUND_REFLECTANCE[element.type] ?? DEFAULT_GROUND_REFLECTANCE;
        const areaM2 = polygonAreaM2(element.vertices, scaleM);
        areas.push({
            elementId: element.id,
            label: element.label,
            type: element.type,
            areaM2,
            baseElevationM: stats.weightedElevationM,
            result,
            patches,
            summary: {
                luminaires: usedIds.size,
                fluxLm,
                avgLux: stats.avg,
                minLux: stats.min,
                maxLux: stats.max,
                uniformity: stats.uniformity,
                areaM2,
            },
            groundReflectance,
            avgLuminanceCdM2: (stats.avg * groundReflectance) / Math.PI,
            spacingM,
            luminairesUsed: usedIds.size,
            luminairesWithoutPhotometry: withoutPhotometryIds.size,
            ownLuminaires: own.length,
            usedLuminaireIds: [...usedIds],
            ownMaintainedFluxLm: own.reduce((sum, lum) => sum + lum.fixture.lumens, 0),
        });
    }
    return { areas, luminaires: luminaires.length, warnings };
}
