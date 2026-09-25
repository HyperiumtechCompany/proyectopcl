import type {
    DialuxAmbientDetail,
    DialuxLuminaireListItem,
    RequirementEvaluation,
} from '@/pages/dialux/export/domain/types';
import { luxColor } from '../domain/exteriorLighting';
import type {
    SiteLightingAreaResult,
    SiteLuminaire,
} from '../domain/siteLightingCalculation';
import { checkAgainstNorm, regionSource } from '../domain/siteLightingNorms';
import { siteElementLoadW } from '../domain/siteOutputs';
import { siteQuantityCheck, SITE_UTILIZATION_FACTOR } from '../domain/siteQuantityCheck';
import type { Point2D, SiteData, SiteElement, SiteNormRegion } from '../domain/types';

/**
 * Páginas por ZONA del informe de la Planta General — las mismas páginas por
 * ambiente del informe de la V1 (resumen, plano + falsos colores, luminarias,
 * objeto de cálculo, plano útil), alimentadas con cada superficie de cálculo
 * exterior (`SiteLightingAreaResult`) en el formato `DialuxAmbientDetail`.
 *
 * Diferencias con un recinto interior, declaradas en el propio informe: sin
 * techo ni paredes (reflectancias "no usadas": cielo abierto), sin UGR
 * (el deslumbramiento exterior GR no se calcula), plano útil a nivel del
 * suelo (0 m) sin zona marginal. La verificación normativa se imprime como
 * "No evaluado" (catálogo exterior pendiente de confirmar) y la comparación
 * numérica "≥ / < norma" va en la etiqueta de la zona con su fuente.
 */

export const EXTERIOR_OPERATING_HOURS = 12;

const LEGEND = [0, 1, 5, 10, 20, 50, 100];


/** Color de la escala de lux como atributos SVG (rgb + opacidad: no todos los visores leen rgba). */
function luxFill(lux: number): string {
    const [r, g, b, a] = luxColor(lux);
    return `fill="rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})" fill-opacity="${Math.max(0.35, a).toFixed(2)}"`;
}

/** Luminarias que entraron al cálculo de la zona, numeradas de izquierda a derecha y de arriba abajo. */
export function zoneLuminaires(area: SiteLightingAreaResult, all: SiteLuminaire[]): SiteLuminaire[] {
    const used = new Set(area.usedLuminaireIds);
    return all
        .filter((lum) => used.has(lum.fixture.id))
        .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function renderZoneSvg(
    site: SiteData,
    area: SiteLightingAreaResult,
    luminaires: SiteLuminaire[],
    mode: 'plan' | 'isolux',
): { svg: string; width: number; height: number } {
    const scaleM = site.terrainScaleM || 1;
    const element = (site.elements ?? []).find((item) => item.id === area.elementId);
    const polygon = (element?.vertices ?? []).map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
    const points = [...polygon, ...luminaires.map((lum) => ({ x: lum.x, y: lum.y }))];
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const extent = Math.max(maxX - minX, maxY - minY, 4);
    const margin = extent * 0.08;
    const legendW = mode === 'isolux' ? extent * 0.18 : 0;
    const vb = { x: minX - margin, y: minY - margin, w: maxX - minX + 2 * margin + legendW, h: maxY - minY + 2 * margin };
    const stroke = extent / 500;
    const text = Math.max(0.12, extent / 60);
    const pts = (list: Point2D[]) => list.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
    const parts: string[] = [`<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff"/>`];

    // Contexto: lo que rodea a la zona, en gris claro.
    for (const other of site.elements ?? []) {
        if (other.id === area.elementId || other.visible === false || other.vertices.length < 2) continue;
        const poly = other.vertices.map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
        // Fuera del recuadro de la zona (intersección de rectángulos: un
        // terreno que la rodea sí se dibuja aunque ningún vértice caiga dentro).
        const xs = poly.map((p) => p.x);
        const ys = poly.map((p) => p.y);
        if (Math.max(...xs) < vb.x || Math.min(...xs) > vb.x + vb.w || Math.max(...ys) < vb.y || Math.min(...ys) > vb.y + vb.h) continue;
        parts.push(`<polygon points="${pts(poly)}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="${stroke}"/>`);
    }
    parts.push(`<polygon points="${pts(polygon)}" fill="${mode === 'plan' ? '#e0f2fe' : 'none'}" stroke="#0f172a" stroke-width="${stroke * 2}"/>`);

    const cells = area.patches.flatMap((patch) => {
        const r = patch.result;
        const cw = r.grid_cell_width ?? 0;
        const ch = r.grid_cell_height ?? 0;
        if (cw <= 0 || ch <= 0) return [];
        return r.grid_values.flatMap((value, index) =>
            value === null
                ? []
                : [{
                      x: (r.grid_origin_x ?? 0) + (index % r.grid_cols) * cw,
                      y: (r.grid_origin_y ?? 0) + Math.floor(index / r.grid_cols) * ch,
                      w: cw,
                      h: ch,
                      value,
                  }],
        );
    });
    if (mode === 'plan') {
        // Dónde se calcula: los puntos de la malla (máx. ~1500 dibujados).
        const every = Math.max(1, Math.ceil(cells.length / 1500));
        cells.forEach((cell, index) => {
            if (index % every !== 0) return;
            parts.push(`<circle cx="${(cell.x + cell.w / 2).toFixed(3)}" cy="${(cell.y + cell.h / 2).toFixed(3)}" r="${(Math.min(cell.w, cell.h) * 0.12).toFixed(3)}" fill="#0369a1"/>`);
        });
    } else {
        for (const cell of cells) {
            parts.push(`<rect x="${cell.x.toFixed(3)}" y="${cell.y.toFixed(3)}" width="${cell.w.toFixed(3)}" height="${cell.h.toFixed(3)}" ${luxFill(cell.value)}/>`);
        }
        // Valor en lx de los puntos (como el plano útil de DIALux): todos si la
        // malla es chica; si no, uno de cada k por fila y columna (~400 rótulos).
        if (cells.length > 0) {
            const k = Math.max(1, Math.ceil(Math.sqrt(cells.length / 400)));
            const size = Math.min(cells[0].w, cells[0].h) * 0.32 * k;
            for (const cell of cells) {
                const col = Math.round((cell.x - cells[0].x) / cell.w);
                const row = Math.round((cell.y - cells[0].y) / cell.h);
                if (col % k !== 0 || row % k !== 0) continue;
                parts.push(`<text x="${(cell.x + cell.w / 2).toFixed(3)}" y="${(cell.y + cell.h / 2 + size * 0.35).toFixed(3)}" font-size="${size.toFixed(3)}" text-anchor="middle" font-family="Arial, sans-serif" fill="#0f172a">${cell.value >= 10 ? Math.round(cell.value) : cell.value.toFixed(1)}</text>`);
            }
        }
        const lx = maxX + margin * 1.5;
        parts.push(`<text x="${lx}" y="${minY + text}" font-size="${text}" font-weight="bold" font-family="Arial, sans-serif">E (lx)</text>`);
        LEGEND.forEach((lux, index) => {
            const y = minY + text * (1.6 + index * 1.4);
            parts.push(
                `<rect x="${lx}" y="${y}" width="${text * 1.8}" height="${text}" ${luxFill(lux)} stroke="#334155" stroke-width="${stroke}"/>`,
                `<text x="${lx + text * 2.2}" y="${y + text * 0.85}" font-size="${text * 0.85}" font-family="Arial, sans-serif">${index === LEGEND.length - 1 ? `≥ ${lux}` : lux}</text>`,
            );
        });
    }

    luminaires.forEach((lum, index) => {
        const r = Math.max(0.15, extent / 90);
        parts.push(
            `<circle cx="${lum.x.toFixed(3)}" cy="${lum.y.toFixed(3)}" r="${r.toFixed(3)}" fill="#facc15" stroke="#854d0e" stroke-width="${stroke}"/>`,
        );
        if (mode === 'plan') {
            parts.push(`<text x="${(lum.x + r * 1.3).toFixed(3)}" y="${(lum.y - r * 0.8).toFixed(3)}" font-size="${text}" font-weight="bold" font-family="Arial, sans-serif" fill="#854d0e">${index + 1}</text>`);
        }
    });
    const width = Math.round(vb.w * 20);
    const height = Math.round(vb.h * 20);
    return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vb.x.toFixed(3)} ${vb.y.toFixed(3)} ${vb.w.toFixed(3)} ${vb.h.toFixed(3)}">${parts.join('')}</svg>`,
        width,
        height,
    };
}

function perimeter(vertices: Point2D[]): number {
    return vertices.reduce((sum, v, i) => {
        const next = vertices[(i + 1) % vertices.length];
        return sum + Math.hypot(next.x - v.x, next.y - v.y);
    }, 0);
}

/** Potencia (W) de cada cabeza: la del equipo (poste/portón/techado) entre TODAS sus cabezas. */
export function wattsPerHead(site: SiteData, all: SiteLuminaire[]): Map<string, number> {
    const elementsById = new Map((site.elements ?? []).map((element) => [element.id, element]));
    const heads = new Map<string, number>();
    for (const lum of all) heads.set(lum.poleId, (heads.get(lum.poleId) ?? 0) + 1);
    const result = new Map<string, number>();
    for (const lum of all) {
        const source = elementsById.get(lum.poleId);
        if (source) result.set(lum.fixture.id, siteElementLoadW(source).watts / Math.max(1, heads.get(lum.poleId) ?? 1));
    }
    return result;
}

/** Agrupa las luminarias de la zona por equipo idéntico (nombre, flujo, potencia). */
function groupLuminaires(
    luminaires: SiteLuminaire[],
    watts: Map<string, number>,
    elementsById: Map<string, SiteElement>,
    zoneName: string,
): DialuxLuminaireListItem[] {
    const groups = new Map<string, DialuxLuminaireListItem>();
    for (const lum of luminaires) {
        const source = elementsById.get(lum.poleId);
        const power = watts.get(lum.fixture.id) ?? null;
        const productId = source?.config?.kind === 'pole' ? source.config.productId : undefined;
        const name =
            lum.sourceType === 'pole'
                ? `Luminaria de poste${productId !== undefined ? ` (catálogo #${productId})` : ''}`
                : lum.sourceType === 'gate'
                  ? 'Luminaria de portón'
                  : 'Luminaria de techado';
        const key = `${name}|${Math.round(lum.fixture.lumens)}|${Math.round(power ?? 0)}`;
        const current = groups.get(key);
        if (current) {
            current.quantity += 1;
            continue;
        }
        groups.set(key, {
            id: key,
            name,
            model: lum.hasPhotometry ? 'Fotometría IES/LDT' : 'Modelo genérico (sin fotometría)',
            brand: null,
            articleNumber: null,
            fixtureShape: null,
            shape: null,
            lumens: Math.round(lum.fixture.lumens),
            powerWatts: power !== null ? Math.round(power * 10) / 10 : null,
            efficiency: power ? Math.round((lum.fixture.lumens / power) * 10) / 10 : null,
            roomName: 'Planta general',
            ambientName: zoneName,
            quantity: 1,
        });
    }
    return [...groups.values()];
}

const SPACE_LABEL: Partial<Record<SiteElement['type'], string>> = {
    court: 'Cancha deportiva',
    parking: 'Estacionamiento',
    street: 'Calle / pasaje',
    sidewalk: 'Vereda / pasadizo',
    green_area: 'Área verde',
    terrace_platform: 'Plataforma',
    custom_zone: 'Zona / patio',
    canopy: 'Techado (bajo cubierta)',
    terrain: 'Terreno (resto no cubierto por otros espacios)',
    ramp: 'Rampa',
    stair: 'Escalera',
};

const ARRANGEMENT_LABEL: Record<string, string> = {
    single: 'unilateral',
    staggered: 'tresbolillo',
    opposite: 'pareada',
};

const fmt = (value: unknown, digits = 1) =>
    typeof value === 'number' && Number.isFinite(value)
        ? value.toLocaleString('es-PE', { maximumFractionDigits: digits })
        : '-';

/**
 * Cómo se proyectaron las luminarias del ESPACIO (no hay recinto): lo guarda
 * la proyección al colocar (`metadata.projection`); si no hubo proyección se
 * dice qué luminarias lo iluminan.
 */
export function describeProjection(element: SiteElement | undefined, luminaires: SiteLuminaire[]): string {
    const projection = element?.metadata?.projection as Record<string, unknown> | undefined;
    const adjusted = projection?.adjusted ? '; posiciones ajustadas a mano después de proyectar' : '';
    if (projection?.mode === 'linear') {
        return (
            `Proyección lineal ${ARRANGEMENT_LABEL[String(projection.arrangement)] ?? ''}: ${fmt(projection.count, 0)} postes de ${fmt(projection.mountingHeightM)} m cada ${fmt(projection.spacingM)} m, ` +
            `${projection.placement === 'inside' ? 'dentro' : 'fuera'} del borde, ${Number(projection.armLengthM) > 0 ? `brazo ${fmt(projection.armLengthM)} m hacia la vía` : 'sin brazo'}; ` +
            `separación máx. ${fmt(projection.spacingToHeight)} × h; Ēm objetivo ${fmt(projection.targetLux, 1)} lx${adjusted}.`
        );
    }
    if (projection?.mode === 'grid') {
        return (
            `Proyección en grilla ${fmt(projection.columns, 0)} × ${fmt(projection.rows, 0)} = ${fmt(projection.count, 0)} postes de ${fmt(projection.mountingHeightM)} m ` +
            `(reparto ½-1-1-½, separación máx. ${fmt(projection.spacingToHeight)} × h); Ēm objetivo ${fmt(projection.targetLux, 1)} lx${adjusted}.`
        );
    }
    const lights = element?.config?.kind === 'canopy' ? element.config.lights : undefined;
    if (element?.type === 'canopy' && lights?.enabled) {
        return `Luminarias bajo la cubierta: ${fmt(lights.columns ?? 0, 0)} × ${fmt(lights.rows ?? 0, 0)} (reparto ½-1-1-½; en techo a 2 caídas, ninguna en la cumbrera).`;
    }
    if (luminaires.length === 0) return 'Sin luminarias que la iluminen.';
    return `Sin proyección: iluminada por ${luminaires.length} luminaria(s) colocadas a mano o de espacios vecinos.`;
}

export function buildZoneAmbientDetail(input: {
    site: SiteData;
    area: SiteLightingAreaResult;
    luminaires: SiteLuminaire[];
    /** W por cabeza (`wattsPerHead` sobre TODAS las luminarias de la planta). */
    watts: Map<string, number>;
    regions: SiteNormRegion[];
    planAssetId: string;
    isoluxAssetId: string;
    calculatedAt: string;
    stale: boolean;
}): DialuxAmbientDetail {
    const { site, area, luminaires } = input;
    const scaleM = site.terrainScaleM || 1;
    const elementsById = new Map((site.elements ?? []).map((element) => [element.id, element]));
    const element = elementsById.get(area.elementId);
    const checks = input.regions
        .filter((region) => element?.normReq?.activities[region])
        .map((region) => checkAgainstNorm(region, element?.normReq?.activities[region], area.summary));
    const check = checks.find((item) => item.activity?.illuminanceLux);
    const activity = check?.activity;
    const quantity = siteQuantityCheck(area, activity?.illuminanceLux);
    const source = check ? regionSource(check.region) : undefined;
    const verdict = !check
        ? 'Sin actividad normativa elegida'
        : `${check.emVerdict === 'meets' ? '≥ norma' : check.emVerdict === 'below' ? '< norma' : 'sin datos'} (${activity?.title ?? ''})`;
    const evaluation = (
        metric: string,
        calculatedValue: number,
        requiredValue: number | null,
    ): RequirementEvaluation => ({
        metric,
        calculatedValue,
        operator: '>=',
        requiredValue,
        unit: metric === 'illuminance' ? 'lx' : '',
        // Catálogo exterior pendiente de confirmar: se muestra el número
        // exigido, nunca "Conforme".
        status: 'not-evaluated',
        ...(source ? { source: source.slice(0, 160) } : {}),
    });
    const totalPower = luminaires.reduce((sum, lum) => sum + (input.watts.get(lum.fixture.id) ?? 0), 0);
    const vertices = (element?.vertices ?? []).map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
    const r = area.patches[0]?.result;
    return {
        ambientId: `site-${area.elementId}`,
        sceneId: 'site',
        sceneName: 'Planta general',
        floorIndex: 0,
        roomId: area.elementId,
        roomName: 'Planta general (exterior)',
        ambientName: area.label,
        activity: activity ? `${activity.title}${activity.category ? ` — ${activity.category}` : ''}` : null,
        area: area.areaM2,
        perimeter: perimeter(vertices),
        usefulArea: area.areaM2,
        targetLux: activity?.illuminanceLux ?? 0,
        avgLux: area.result.avg_lux,
        minLux: area.result.min_lux,
        maxLux: area.result.max_lux,
        uniformity: area.result.uniformity,
        g2: area.result.max_lux > 0 ? area.result.min_lux / area.result.max_lux : null,
        uniformityTarget: activity?.uniformity ?? null,
        ugr: null,
        ugrIsManual: false,
        ugrLimit: null,
        ra: null,
        raRequired: activity?.ra ?? null,
        interiorHeight: 0,
        reflectionCeiling: null,
        reflectionWall: null,
        reflectionFloor: null,
        maintenanceFactor: 1,
        dailyOperatingHours: EXTERIOR_OPERATING_HOURS,
        minimumDailyOperatingHours: EXTERIOR_OPERATING_HOURS - 2,
        maximumDailyOperatingHours: EXTERIOR_OPERATING_HOURS + 2,
        leni: null,
        usefulPlaneHeight: 0,
        marginalZone: 0,
        calculationIndex: r ? `${r.grid_cols} × ${r.grid_rows}${area.patches.length > 1 ? ` (${area.patches.length} parches)` : ''}` : '-',
        fixtureCount: luminaires.length,
        totalPowerWatts: Math.round(totalPower * 10) / 10,
        lumensRequired: quantity?.lumensRequired ?? 0,
        fixtureLumens: quantity?.lumensEach ?? 0,
        exactQuantity: quantity && Number.isFinite(quantity.exactQuantity) ? quantity.exactQuantity : 0,
        roundedQuantity: area.ownLuminaires,
        coverage: quantity ? { optimal: 'Óptimo', insufficient: 'Insuficiente', excessive: 'Excesivo' }[quantity.coverage] : '-',
        complianceLabel: verdict.slice(0, 255),
        planAssetId: input.planAssetId,
        isoluxAssetId: input.isoluxAssetId,
        requirementEvaluations: activity
            ? [
                  evaluation('illuminance', area.result.avg_lux, activity.illuminanceLux),
                  ...(activity.uniformity !== null ? [evaluation('uniformity', area.result.uniformity, activity.uniformity)] : []),
              ]
            : [],
        provenance: {
            engine: 'Motor luminotécnico V1 (punto a punto, exteriores)',
            engineVersion: 'site-v1',
            calculatedAt: input.calculatedAt,
            status: input.stale ? 'stale' : 'calculated',
            configSummary: `Cielo abierto, sin reflexiones; Fm por luminaria; Fu ${SITE_UTILIZATION_FACTOR} en el método de lúmenes`,
        },
        warnings: [
            {
                objectId: area.elementId,
                code: 'exterior-no-reflections',
                message: 'Superficie exterior: sin techo ni paredes (reflectancias no usadas) y sin UGR; el factor de mantenimiento ya está aplicado al flujo de cada luminaria.',
            },
            ...(activity?.minLux
                ? [{
                      objectId: area.elementId,
                      code: 'exterior-min-lux',
                      message: `La clase exige además Emín ≥ ${activity.minLux} lx (calculado ${area.result.min_lux.toFixed(2)} lx).`,
                  }]
                : []),
        ],
        luminaires: groupLuminaires(luminaires, input.watts, elementsById, area.label),
        exterior: {
            spaceType: (element ? (SPACE_LABEL[element.type] ?? element.type) : area.type).slice(0, 120),
            projection: describeProjection(element, luminaires).slice(0, 500),
            surface: `A nivel del suelo (cota ${area.baseElevationM.toFixed(2)} m), malla de ${area.spacingM.toFixed(2)} m${area.patches.length > 1 ? `, ${area.patches.length} parches por desnivel` : ''}`.slice(0, 255),
        },
        fixturePositions: luminaires.map((lum, index) => ({
            id: lum.fixture.id,
            name: `${index + 1}. ${lum.label}`.slice(0, 255),
            productName: lum.hasPhotometry ? 'Fotometría IES/LDT' : 'Modelo genérico',
            x: Math.round(lum.x * 100) / 100,
            y: Math.round(lum.y * 100) / 100,
            mountingHeight: Math.round((lum.headElevationM - area.baseElevationM) * 100) / 100,
            brand: null,
            articleNumber: null,
            lumens: Math.round(lum.fixture.lumens),
            powerWatts: input.watts.has(lum.fixture.id)
                ? Math.round(input.watts.get(lum.fixture.id)! * 10) / 10
                : null,
        })),
    };
}
