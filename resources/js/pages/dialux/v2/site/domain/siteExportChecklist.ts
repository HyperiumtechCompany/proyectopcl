import type { SiteLightingCalculation } from './siteLightingCalculation';
import type { SiteCircuitFeed } from './siteNetworkLive';
import type { SiteOutputRow } from './siteOutputs';
import type { SiteData, SiteElement } from './types';

/**
 * Revisión antes de exportar el informe PDF de la planta (como el "¿falta
 * algo?" de DIALux evo antes de documentar): lo OBLIGATORIO bloquea la
 * exportación hasta configurarlo; lo RECOMENDADO avisa y deja exportar.
 */
export interface ExportCheckItem {
    id: string;
    level: 'required' | 'recommended';
    title: string;
    detail: string;
    /** Acción que la interfaz puede ofrecer para resolverlo. */
    action?: 'calculate';
}

const list = (names: string[], max = 4) =>
    names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} y ${names.length - max} más`;

/** Luminarias exteriores sin producto del catálogo (se calculan con el modelo genérico). */
function genericLuminaireOwners(elements: SiteElement[]): string[] {
    const names: string[] = [];
    for (const element of elements) {
        if (element.visible === false) continue;
        const config = element.config;
        if (config?.kind === 'pole' && config.mount !== 'inground' && config.productId === undefined) names.push(element.label);
        if (config?.kind === 'gate' && config.lights?.enabled && config.lights.productId === undefined) names.push(element.label);
        if (config?.kind === 'canopy' && config.lights?.enabled && config.lights.productId === undefined) names.push(element.label);
        if ((config?.kind === 'ramp' || config?.kind === 'stair') && config.lights?.enabled && config.lights.productId === undefined) {
            names.push(element.label);
        }
    }
    return names;
}

export function siteExportChecklist(input: {
    site: SiteData;
    calculation: SiteLightingCalculation | null;
    /** El cálculo corresponde a una planta anterior. */
    calculationStale: boolean;
    outputRows: SiteOutputRow[];
    feeds: Record<string, SiteCircuitFeed>;
    /** Catálogo (nombre y tipo) para detectar productos de interior usados afuera. */
    products?: ReadonlyMap<number, { name: string; fixtureType: string | null }>;
}): ExportCheckItem[] {
    const { site, calculation } = input;
    const elements = site.elements ?? [];
    const items: ExportCheckItem[] = [];

    // ── Obligatorio: sin cálculo vigente, el informe no tiene resultados.
    if (!calculation) {
        items.push({
            id: 'no-calculation',
            level: 'required',
            title: 'Falta calcular el alumbrado',
            detail: 'El informe se arma con los resultados del motor (Ēm, Emín, U0, falsos colores por espacio). Calcula antes de exportar.',
            action: 'calculate',
        });
    } else if (input.calculationStale) {
        items.push({
            id: 'stale-calculation',
            level: 'required',
            title: 'El cálculo está desactualizado',
            detail: 'La planta cambió después del último cálculo: los resultados no corresponderían a lo dibujado. Recalcula.',
            action: 'calculate',
        });
    }
    if (calculation && calculation.areas.length === 0) {
        items.push({
            id: 'no-spaces',
            level: 'required',
            title: 'No hay espacios de cálculo',
            detail: 'Dibuja al menos un espacio (vereda, cancha, estacionamiento, plataforma…) para que el informe tenga resultados.',
        });
    }

    // ── Recomendado: el informe sale, pero con datos incompletos.
    if (calculation) {
        const unlit = calculation.areas.filter((area) => area.ownLuminaires === 0 && area.type !== 'terrain');
        if (unlit.length > 0) {
            items.push({
                id: 'unlit-spaces',
                level: 'recommended',
                title: `${unlit.length} espacio(s) sin luminarias propias`,
                detail: `${list(unlit.map((area) => area.label))}: se calculan solo con sus luminarias y darán 0 lx. Proyecta luminarias en cada uno (Iluminación → Proyectar luminarias) o cámbialos a "toda la escena".`,
            });
        }
        const byId = new Map(elements.map((element) => [element.id, element]));
        const noNorm = calculation.areas.filter((area) => {
            const activities = byId.get(area.elementId)?.normReq?.activities ?? {};
            return Object.values(activities).every((value) => !value);
        });
        if (noNorm.length > 0) {
            items.push({
                id: 'no-norm',
                level: 'recommended',
                title: `${noNorm.length} espacio(s) sin actividad normativa elegida`,
                detail: `${list(noNorm.map((area) => area.label))}: se comparan con la actividad SUGERIDA por el tipo de espacio. Elige la actividad en las propiedades del espacio (Normativa) para que la verificación sea la que corresponde.`,
            });
        }
        if ((calculation.skipped ?? []).length > 0) {
            items.push({
                id: 'skipped',
                level: 'recommended',
                title: `${calculation.skipped?.length} espacio(s) tapados por otro (duplicados)`,
                detail: `${list((calculation.skipped ?? []).map((item) => item.label))}: no tienen puntos propios. Elimina el duplicado o ajusta su contorno.`,
            });
        }
    }
    const generic = genericLuminaireOwners(elements);
    if (generic.length > 0) {
        items.push({
            id: 'generic-luminaires',
            level: 'recommended',
            title: `${generic.length} luminaria(s) sin producto del catálogo`,
            detail: `${list(generic)}: se calculan con el modelo genérico (lm + haz). Elige o importa su LDT/IES para usar la fotometría real.`,
        });
    }
    // Producto de INTERIOR (empotrable, panel, downlight…) en postes o
    // balizas exteriores: la fotometría es real, pero no es una luminaria de
    // alumbrado exterior (IP, distribución, montaje). Se avisa para el informe.
    if (input.products) {
        const indoor = new Map<string, string[]>();
        for (const element of elements) {
            const config = element.config as { productId?: number; lights?: { productId?: number } } | undefined;
            const id = element.type === 'pole' ? config?.productId : config?.lights?.productId;
            const product = id !== undefined ? input.products.get(id) : undefined;
            if (!product) continue;
            const text = `${product.name} ${product.fixtureType ?? ''}`;
            if (!/recessed|empotr|panel|downlight|troffer|ceiling|techo|suspend/i.test(text)) continue;
            indoor.set(product.name, [...(indoor.get(product.name) ?? []), element.label]);
        }
        for (const [name, owners] of indoor) {
            items.push({
                id: `indoor-product-${name}`,
                level: 'recommended',
                title: `"${name}" parece una luminaria de interior`,
                detail: `Usada en ${owners.length} luminaria(s) exterior(es) (${list(owners)}). Para un informe de alumbrado exterior usa una luminaria de alumbrado público / exterior (IP65 o más) con su LDT.`,
            });
        }
    }
    const rampIssues = elements.filter((element) => {
        const config = element.config;
        if (config?.kind !== 'ramp' || !config.flights || config.flights.length === 0) return false;
        const target = config.toElevationM - config.fromElevationM;
        const sum = config.flights.reduce((acc, flight) => acc + flight.riseM, 0);
        return Math.abs(sum - target) > 0.005;
    });
    if (rampIssues.length > 0) {
        items.push({
            id: 'ramp-levels',
            level: 'recommended',
            title: `${rampIssues.length} rampa(s) cuyos tramos no suman el desnivel`,
            detail: `${list(rampIssues.map((element) => element.label))}: el 3D ya los reparte, pero guarda el ajuste ("Repartir el desnivel entre todos los tramos") o corrige la cota destino.`,
        });
    }
    const fedBlocks = new Set(
        (site.circuits ?? [])
            .filter((circuit) => input.feeds[circuit.id])
            .flatMap((circuit) => [circuit.sourceId, circuit.targetId]),
    );
    const unfed = elements.filter((element) => element.type === 'building_block' && element.moduleId && !fedBlocks.has(element.id));
    if (unfed.length > 0) {
        items.push({
            id: 'unfed-buildings',
            level: 'recommended',
            title: `${unfed.length} edificio(s) de módulo sin alimentador desde la planta`,
            detail: `${list(unfed.map((element) => `${element.label} (${element.moduleName ?? 'módulo'})`))}: su caída de tensión no incluye el recorrido real. Conéctalos (Propiedades → Conexión eléctrica → Conectar al tablero).`,
        });
    }
    const assumed = input.outputRows.filter((row) => row.assumptions.some((text) => text.startsWith('Sección supuesta')));
    if (assumed.length > 0) {
        items.push({
            id: 'assumed-sections',
            level: 'recommended',
            title: `${assumed.length} salida(s) con sección de cable supuesta`,
            detail: `${list(assumed.map((row) => `${row.outputLabel} (${row.code})`))}: define la sección en el cable para que la caída de tensión sea la real.`,
        });
    }
    const outOfLimits = input.outputRows.filter((row) => !row.voltageDropOk || !row.capacityConforms);
    if (outOfLimits.length > 0) {
        items.push({
            id: 'out-of-limits',
            level: 'recommended',
            title: `${outOfLimits.length} salida(s) fuera del límite de caída de tensión o capacidad`,
            detail: `${list(outOfLimits.map((row) => `${row.outputLabel} (${row.voltageDropPct.toFixed(2)} %)`))}: el informe las mostrará "Fuera del límite". Sube la sección o acorta el recorrido.`,
        });
    }
    return items;
}
