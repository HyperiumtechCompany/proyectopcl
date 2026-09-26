import type {
    DialuxAmbientDetail,
    DialuxDocumentPage,
    DialuxExportAsset,
    DialuxFormalDocument,
    DialuxTocEntry,
} from '@/pages/dialux/export/domain/types';
import { DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION } from '@/pages/dialux/export/domain/types';
import { summarizeSiteForDxf } from '../domain/siteDxfExport';
import type { SiteLightingCalculation } from '../domain/siteLightingCalculation';
import { siteLuminaires } from '../domain/siteLightingCalculation';
import {
    effectiveNormChecks,
    regionSource,
    requiredLuxFor,
    SITE_NORM_REGIONS,
    type SiteNormVerdict,
} from '../domain/siteLightingNorms';
import type { SiteOutputRow } from '../domain/siteOutputs';
import { siteElementLoadW } from '../domain/siteOutputs';
import { siteQuantityCheck } from '../domain/siteQuantityCheck';
import type { SiteData, SiteElement, SiteNormRegion } from '../domain/types';
import type { LuminaireCatalogItem } from '../lib/luminaireCatalog';
import { renderSitePlanSvg } from './siteSvgPlan';
import {
    buildZoneAmbientDetail,
    groupLuminaires,
    renderZoneSvg,
    SITE_SPACE_GROUPS,
    spaceGroupOf,
    spaceTypeLabel,
    wattsPerHead,
    zoneLuminaires,
} from './siteZoneReport';

/** Filas por hoja. */
const LUMINAIRE_ROWS_PER_PAGE = 20;
// La V1 usa 18, pero en hoja apaisada solo caben 9 filas de objeto de cálculo (medido en el PDF real).
const CALCULATION_OBJECT_ROWS_PER_PAGE = 9;
// Hoja apaisada con filas de 2 líneas (medido en el PDF real: ~10 caben con las notas).
const SPACE_ROWS_PER_PAGE = 9;

function chunks(total: number, size: number): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    for (let start = 0; start < total; start += size) ranges.push({ start, end: Math.min(total, start + size) });
    return ranges;
}

/**
 * Informe PDF de la Planta General (fase D2 de
 * `plan_pendientes_exterior_electrico_documentos.md`), con el MISMO
 * generador PDF del servidor que el informe de la V1 (documento formal →
 * `formal-pdf.blade.php`): portada, índice, resumen, plano general, plano en
 * falsos colores, superficies de cálculo (Ēm/Emín/U0, norma elegida y
 * verificación de cantidad de la V1), luminarias, salidas de tableros (CT)
 * y metrado. Todo sale del modelo de la planta y del cálculo del motor V1;
 * nada se re-digita. Nunca "cumple": "≥ norma" / "< norma" con su fuente.
 */

const n = (value: number, digits = 1) =>
    Number.isFinite(value)
        ? value.toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
        : '-';

const TYPE_LABEL: Partial<Record<SiteElement['type'], string>> = {
    court: 'Cancha',
    parking: 'Estacionamiento',
    street: 'Calle',
    sidewalk: 'Vereda',
    green_area: 'Área verde',
    terrace_platform: 'Plataforma',
    custom_zone: 'Zona',
    canopy: 'Techado',
    terrain: 'Terreno',
    ramp: 'Rampa',
    stair: 'Escalera',
};

export interface SiteReportInput {
    site: SiteData;
    projectName: string;
    calculation: SiteLightingCalculation | null;
    /** El cálculo corresponde a una planta anterior (se avisa en el informe). */
    calculationStale?: boolean;
    outputRows: SiteOutputRow[];
    regions: SiteNormRegion[];
    generatedAt?: Date;
    /** Catálogo de luminarias (compartido con la V1): nombre, fabricante, CCT, IRC. */
    products?: ReadonlyMap<number, LuminaireCatalogItem>;
}

function table(
    id: string,
    title: string,
    columns: Array<[string, string]>,
    rows: Array<Record<string, string | number | null>>,
): DialuxExportAsset {
    return {
        id,
        title,
        purpose: 'technical-appendix',
        kind: 'structured',
        mimeType: 'application/json',
        data: { type: 'table', columns: columns.map(([key, label]) => ({ key, label })), rows },
    };
}

export function buildSiteFormalDocument(input: SiteReportInput): DialuxFormalDocument {
    const { site, calculation } = input;
    const generatedAt = input.generatedAt ?? new Date();
    const date = generatedAt.toLocaleDateString('es-PE');
    const byId = new Map((site.elements ?? []).map((element) => [element.id, element]));
    const summary = summarizeSiteForDxf(site);
    const assets: DialuxExportAsset[] = [];
    const pages: Array<Omit<DialuxDocumentPage, 'pageNumber'>> = [];
    const ambientDetails: DialuxAmbientDetail[] = [];
    /** Entrada del índice por página (false = no aparece). */
    const tocOverrides = new Map<string, { title: string; level: number } | false>();
    const page = (
        id: string,
        kind: DialuxDocumentPage['kind'],
        sectionId: DialuxDocumentPage['sectionId'],
        title: string,
        assetIds: string[],
        notes: string[] = [],
        subtitle: string | null = null,
        ambientId: string | null = null,
        extra: Partial<Pick<DialuxDocumentPage, 'roomId' | 'rowRangeStart' | 'rowRangeEnd'>> & {
            toc?: { title: string; level: number } | false;
        } = {},
    ) => {
        const { toc, ...fields } = extra;
        if (toc !== undefined) tocOverrides.set(id, toc);
        pages.push({
            id,
            kind,
            sectionId,
            title,
            subtitle,
            assetIds,
            ...(ambientId ? { ambientId } : {}),
            ...fields,
            // El servidor valida notas de hasta 500 caracteres.
            notes: notes.map((note) => (note.length > 490 ? `${note.slice(0, 487)}...` : note)),
        });
    };

    // ── Planos (vectoriales).
    const plan = renderSitePlanSvg(site, { title: 'Planta general' });
    assets.push({
        id: 'formal-cover-svg',
        title: 'Planta general',
        purpose: 'cad-overview',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg: plan.svg,
        width: plan.width,
        height: plan.height,
    });
    const isolux = calculation
        ? renderSitePlanSvg(site, {
              calculation,
              title: 'Iluminancia en falsos colores (motor V1)',
              regions: input.regions,
          })
        : null;
    if (isolux) {
        assets.push({
            id: 'site-isolux-svg',
            title: 'Falsos colores',
            purpose: 'isolux',
            kind: 'vector',
            mimeType: 'image/svg+xml',
            svg: isolux.svg,
            width: isolux.width,
            height: isolux.height,
        } as DialuxExportAsset);
    }

    // ── Resumen.
    const lightingKw = summary.lightingW / 1000;
    const metadata = [
        { label: 'Proyecto', value: input.projectName || 'Proyecto' },
        { label: 'Módulo', value: 'Planta general (exteriores)' },
        { label: 'Fecha', value: date },
        { label: 'Postes', value: String(summary.poles) },
        { label: 'Potencia de alumbrado', value: `${n(lightingKw, 2)} kW` },
        { label: 'Tomacorrientes', value: String(summary.outlets) },
        { label: 'Tableros', value: String(summary.panels) },
        { label: 'Superficies calculadas', value: String(calculation?.areas.length ?? 0) },
    ];
    assets.push({
        id: 'site-summary',
        title: 'Resumen del proyecto',
        purpose: 'project-summary',
        kind: 'structured',
        mimeType: 'application/json',
        data: { type: 'summary', items: metadata },
    });

    page('page-cover', 'cover', 'cover', input.projectName || 'Planta general', ['formal-cover-svg']);
    page('page-toc', 'toc', 'content', 'Contenido', []);
    page('page-summary', 'site-section', 'preliminary-observations', 'Resumen y método de cálculo', ['site-summary'], [
        'Cálculo luminotécnico: motor punto a punto de la V1 con la fotometría IES/LDT de cada luminaria, sombras de edificios y cubiertas; cielo abierto (sin reflexiones). Superficies con desnivel calculadas por parches, cada uno a su cota.',
        'Comparación con la norma elegida por el cliente: numérica ("≥ norma" / "< norma"), no declaración de cumplimiento. Catálogo exterior EN 12464-2:2014 / EN 13201-2:2015 con valores pendientes de confirmar contra el texto oficial.',
        'Verificación de cantidad: método de lúmenes de la V1 (propias / exactas; < 90 % insuficiente, > 150 % excesivo), estimación previa al cálculo punto a punto.',
        ...(calculation ? [] : ['No se ejecutó "Calcular alumbrado": el informe no incluye resultados luminotécnicos.']),
        ...(input.calculationStale ? ['Atención: la planta cambió después del último cálculo; recalcular antes de entregar.'] : []),
        ...(calculation?.warnings.slice(0, 6) ?? []),
    ]);
    page('page-plan', 'terrain-cad', 'terrain', 'Planta general', ['formal-cover-svg']);
    if (isolux) page('page-isolux', 'terrain-cad', 'isolux', 'Falsos colores', ['site-isolux-svg']);

    // ── Luminarias del proyecto (lista de la V1 / DIALux evo: por producto).
    const allLuminaires = siteLuminaires(site, new Map());
    const watts = wattsPerHead(site, allLuminaires);
    const projectLuminaires = groupLuminaires(allLuminaires, watts, byId, null, input.products, 'Planta general');
    chunks(projectLuminaires.length, LUMINAIRE_ROWS_PER_PAGE).forEach((range, index) =>
        page(
            `page-luminaire-list-${index}`,
            'luminaire-list',
            'luminaire-list',
            index === 0 ? 'Lista de luminarias' : 'Lista de luminarias (continuación)',
            [],
            [],
            'Planta general',
            null,
            { rowRangeStart: range.start, rowRangeEnd: range.end, ...(index > 0 ? { toc: false } : {}) },
        ),
    );

    // ── Espacios (locales), agrupados por recinto (categoría), y objetos de cálculo.
    if (calculation && calculation.areas.length > 0) {
        const groupIndex = new Map(SITE_SPACE_GROUPS.map((group, index) => [group.id, index]));
        // Nombres únicos como los locales de DIALux ("Escalera 1", "Escalera 2"…).
        const labelCount = new Map<string, number>();
        for (const area of calculation.areas) labelCount.set(area.label, (labelCount.get(area.label) ?? 0) + 1);
        const labelSeen = new Map<string, number>();
        const areas = [...calculation.areas]
            .sort(
                (a, b) =>
                    (groupIndex.get(spaceGroupOf(a.type).id) ?? 99) - (groupIndex.get(spaceGroupOf(b.type).id) ?? 99),
            )
            .map((area) => {
                if ((labelCount.get(area.label) ?? 0) < 2) return area;
                const k = (labelSeen.get(area.label) ?? 0) + 1;
                labelSeen.set(area.label, k);
                return { ...area, label: `${area.label} ${k}` };
            });
        const verdictOf = (value: SiteNormVerdict | undefined) =>
            value === 'meets' ? '≥ norma' : value === 'below' ? '< norma' : 'sin datos';
        const normRows: Array<Record<string, string>> = [];
        const rows = areas.map((area) => {
            const element = byId.get(area.elementId);
            const checks = effectiveNormChecks(element, input.regions, area.summary);
            const first = checks.find((check) => check.activity?.illuminanceLux);
            const quantity = siteQuantityCheck(area, first?.activity?.illuminanceLux);
            for (const check of checks) {
                normRows.push({
                    name: area.label,
                    norm: SITE_NORM_REGIONS.find((region) => region.id === check.region)?.label ?? check.region,
                    activity: `${check.activity?.title ?? '-'}${check.suggested ? ' (sugerida)' : ''}`,
                    em: check.activity ? `${n(area.result.avg_lux)} / ${check.activity.illuminanceLux}` : '-',
                    emin: check.activity?.minLux ? `${n(area.result.min_lux)} / ${check.activity.minLux}` : '-',
                    u0: check.activity?.uniformity ? `${n(area.result.uniformity, 2)} / ${check.activity.uniformity}` : '-',
                    emVerdict: verdictOf(check.emVerdict),
                    uoVerdict: check.activity?.uniformity ? verdictOf(check.uoVerdict) : '-',
                });
            }
            return {
                group: spaceGroupOf(area.type).name,
                name: area.label,
                type: TYPE_LABEL[area.type] ?? area.type,
                area: n(area.areaM2, 0),
                em: n(area.result.avg_lux),
                emin: n(area.result.min_lux),
                emax: n(area.result.max_lux),
                u0: n(area.result.uniformity, 2),
                required: first?.activity
                    ? `${first.activity.illuminanceLux} lx${first.activity.uniformity ? ` · U0 ${first.activity.uniformity}` : ''}${first.suggested ? ' *' : ''}`
                    : '-',
                verdict: first ? verdictOf(first.emVerdict) : 'Sin actividad',
                lum: quantity && Number.isFinite(quantity.exactQuantity)
                    ? `${area.ownLuminaires} / ${n(quantity.exactQuantity, 1)}`
                    : String(area.ownLuminaires),
                coverage: quantity
                    ? { optimal: 'Óptimo', insufficient: 'Insuficiente', excessive: 'Excesivo' }[quantity.coverage]
                    : '-',
            };
        });
        const columns: Array<[string, string]> = [
            ['group', 'Recinto'],
            ['name', 'Espacio'],
            ['type', 'Tipo'],
            ['area', 'm²'],
            ['em', 'Ēm lx'],
            ['emin', 'Emín'],
            ['emax', 'Emáx'],
            ['u0', 'U0'],
            ['required', 'Exigido'],
            ['verdict', 'Ēm vs norma'],
            ['lum', 'Lum. prop./exact.'],
            ['coverage', 'Cobertura'],
        ];
        const sources = [...new Set(input.regions.map(regionSource))];
        const skipped = calculation.skipped ?? [];
        chunks(rows.length, SPACE_ROWS_PER_PAGE).forEach((range, index) => {
            const assetId = index === 0 ? 'site-areas' : `site-areas-${index}`;
            const title = index === 0 ? 'Lista de espacios' : 'Lista de espacios (continuación)';
            assets.push(table(assetId, title, columns, rows.slice(range.start, range.end)));
            const last = range.end === rows.length;
            page(
                index === 0 ? 'page-areas' : `page-areas-${index}`,
                'site-section',
                'lighting-results',
                title,
                [assetId],
                [
                    ...(index === 0
                        ? [
                              'Cada espacio exterior (calle, vereda, rampa, escalera, cancha, techado, plataforma…) es un local con su propio objeto de cálculo, agrupado por recinto (categoría) como los locales de DIALux evo. "Exigido": primera norma elegida (* = actividad sugerida por el tipo de espacio); el detalle por norma va en "Comparación con las normas".',
                          ]
                        : []),
                    ...(last && skipped.length > 0
                        ? [
                              `Espacios sin calcular (${skipped.length}): ${skipped
                                  .map((item) => `${item.label} — ${spaceTypeLabel(item.type).toLowerCase()}${item.coveredByLabel ? `, cubierto por "${item.coveredByLabel}"` : ''}`)
                                  .join('; ')}. Un espacio cubierto por completo por otro (p. ej. un duplicado superpuesto) no tiene puntos propios.`,
                          ]
                        : []),
                ],
                null,
                null,
                index > 0 ? { toc: false } : {},
            );
        });
        const normColumns: Array<[string, string]> = [
            ['name', 'Espacio'],
            ['norm', 'Norma'],
            ['activity', 'Actividad / clase'],
            ['em', 'Ēm calc. / exig. (lx)'],
            ['emin', 'Emín calc. / exig. (lx)'],
            ['u0', 'U0 calc. / exig.'],
            ['emVerdict', 'Ēm'],
            ['uoVerdict', 'U0'],
        ];
        chunks(normRows.length, SPACE_ROWS_PER_PAGE).forEach((range, index) => {
            const assetId = `site-norms-${index}`;
            const title = index === 0 ? 'Comparación con las normas' : 'Comparación con las normas (continuación)';
            assets.push(table(assetId, title, normColumns, normRows.slice(range.start, range.end)));
            page(
                `page-norms-${index}`,
                'site-section',
                'lighting-results',
                title,
                [assetId],
                index === 0
                    ? [
                          'Comparación numérica con cada norma elegida por el cliente ("≥ norma" / "< norma"); no es una declaración de cumplimiento.',
                          `Fuentes: ${sources.join('; ')}.`,
                      ]
                    : [],
                null,
                null,
                index > 0 ? { toc: false } : {},
            );
        });

        // Fichas por espacio: las 5 páginas por ambiente de la V1.
        const zonePages = new Map<string, () => void>();
        for (const area of areas) {
            const luminaires = zoneLuminaires(area, allLuminaires);
            const planId = `zone-plan-${area.elementId}`;
            const isoluxId = `zone-isolux-${area.elementId}`;
            const planSvg = renderZoneSvg(site, area, luminaires, 'plan');
            const isoluxSvg = renderZoneSvg(
                site,
                area,
                luminaires,
                'isolux',
                requiredLuxFor(byId.get(area.elementId), input.regions, area.summary)?.lux ?? null,
            );
            assets.push(
                { id: planId, title: `Plano de luminarias — ${area.label}`, purpose: 'ambient-plan', kind: 'vector', mimeType: 'image/svg+xml', ...planSvg },
                { id: isoluxId, title: `Plano útil — ${area.label}`, purpose: 'isolux', kind: 'vector', mimeType: 'image/svg+xml', ...isoluxSvg },
            );
            const detail = buildZoneAmbientDetail({
                site,
                area,
                luminaires,
                watts,
                regions: input.regions,
                planAssetId: planId,
                isoluxAssetId: isoluxId,
                calculatedAt: generatedAt.toISOString(),
                stale: Boolean(input.calculationStale),
                products: input.products,
            });
            ambientDetails.push(detail);
            const id = detail.ambientId;
            const zone = area.label;
            const type = spaceTypeLabel(area.type);
            const room = { roomId: detail.roomId };
            zonePages.set(id, () => {
                page(`page-zone-summary-${id}`, 'ambient-summary', `ambient-summary:${id}`, zone, [], [], `${type} — espacio y proyección de luminarias`, id, {
                    ...room,
                    toc: {
                        title: zone.toLowerCase().startsWith(type.split(' ')[0].toLowerCase()) ? zone : `${zone} (${type})`,
                        level: 2,
                    },
                });
                page(`page-zone-plan-${id}`, 'ambient-plan', `ambient-plan:${id}`, zone, [planId, isoluxId], [], 'Plano de luminarias y falsos colores', id, room);
                page(`page-zone-luminaires-${id}`, 'ambient-luminaires', `ambient-luminaires:${id}`, zone, [], [], 'Lista de luminarias', id, room);
                page(`page-zone-calc-${id}`, 'ambient-calculation-object', `ambient-calculation-object:${id}`, zone, [], [], 'Objeto de cálculo', id, room);
                page(`page-zone-plane-${id}`, 'ambient-useful-plane', `ambient-useful-plane:${id}`, zone, [isoluxId], [], 'Plano útil (valores en lx)', id, room);
            });
        }

        // Objetos de cálculo de todo el proyecto (paginado como la V1).
        chunks(ambientDetails.length, CALCULATION_OBJECT_ROWS_PER_PAGE).forEach((range, index) =>
            page(
                `page-calc-objects-${index}`,
                'calculation-object-list',
                'calculation-object-list',
                index === 0 ? 'Objetos de cálculo' : 'Objetos de cálculo (continuación)',
                [],
                [],
                'Planta general / Escena de luz 1',
                null,
                { rowRangeStart: range.start, rowRangeEnd: range.end, ...(index > 0 ? { toc: false } : {}) },
            ),
        );

        // Por recinto: lista de locales, luminarias y objetos de cálculo del
        // grupo (páginas de recinto de la V1), luego la ficha de cada espacio.
        const groups = [...SITE_SPACE_GROUPS, spaceGroupOf('__otros__')];
        for (const group of groups) {
            const members = ambientDetails.filter((detail) => detail.roomId === group.id);
            if (members.length === 0) continue;
            const room = { roomId: group.id };
            page(`page-group-locals-${group.id}`, 'room-ambient-list', `room-ambient-list:${group.id}`, 'Lista de locales / Escena de luz 1', [], [], group.name, null, {
                ...room,
                toc: { title: `Recinto: ${group.name} (${members.length} espacio${members.length === 1 ? '' : 's'})`, level: 1 },
            });
            page(`page-group-luminaires-${group.id}`, 'room-luminaires', `room-luminaires:${group.id}`, 'Lista de luminarias', [], [], group.name, null, { ...room, toc: false });
            chunks(members.length, CALCULATION_OBJECT_ROWS_PER_PAGE).forEach((range, index) =>
                page(
                    `page-group-calc-${group.id}-${index}`,
                    'calculation-object-list',
                    `room-calculation-object:${group.id}:${index}`,
                    index === 0 ? 'Objetos de cálculo' : 'Objetos de cálculo (continuación)',
                    [],
                    [],
                    group.name,
                    null,
                    { ...room, rowRangeStart: range.start, rowRangeEnd: range.end, toc: false },
                ),
            );
            for (const member of members) zonePages.get(member.ambientId)?.();
        }
    }

    // ── Luminarias (agrupadas por equipo idéntico).
    const groups = new Map<string, { label: string; count: number; lumens: number; watts: number }>();
    for (const element of site.elements ?? []) {
        if (element.visible === false || !['pole', 'gate', 'canopy'].includes(element.type)) continue;
        const heads = siteLuminaires({ ...site, elements: [element] }, new Map());
        if (heads.length === 0) continue;
        const cfg = element.config?.kind === 'pole' ? element.config : undefined;
        const lumens = heads.reduce((sum, head) => sum + head.fixture.lumens, 0);
        const watts = siteElementLoadW(element).watts;
        const key = `${element.type}|${cfg?.productId ?? ''}|${cfg?.heightM ?? ''}|${Math.round(lumens)}|${watts}`;
        const label =
            element.type === 'pole'
                ? `Poste ${cfg?.heightM ?? '-'} m, ${cfg?.fixtures ?? 1} luminaria(s)${cfg?.productId !== undefined ? ` · catálogo #${cfg.productId}` : ''}`
                : element.type === 'gate'
                  ? `Luces de portón (${heads.length})`
                  : `Luminarias de techado (${heads.length})`;
        const current = groups.get(key) ?? { label, count: 0, lumens, watts };
        current.count += 1;
        groups.set(key, current);
    }
    const lumRows = [...groups.values()].map((group) => ({
        item: group.label,
        count: group.count,
        lm: n(group.lumens, 0),
        w: n(group.watts, 0),
        totalW: n(group.watts * group.count, 0),
    }));
    assets.push(
        table('site-luminaires', 'Postes y soportes de luminarias', [
            ['item', 'Equipo'],
            ['count', 'Cant.'],
            ['lm', 'lm mantenidos c/u'],
            ['w', 'W c/u'],
            ['totalW', 'W total'],
        ], lumRows),
    );
    page('page-luminaires', 'site-section', 'luminaire-list', 'Postes y soportes', ['site-luminaires']);

    // ── Salidas de tableros (motor CT de la V1).
    if (input.outputRows.length > 0) {
        assets.push(
            table('site-outputs', 'Salidas de tableros de la planta', [
                ['panel', 'Tablero'],
                ['output', 'Salida'],
                ['loads', 'Cargas'],
                ['kw', 'kW inst.'],
                ['phase', 'Fase'],
                ['cable', 'Conductor'],
                ['length', 'L (m)'],
                ['itm', 'ITM'],
                ['du', 'ΔU acum. %'],
                ['status', 'Estado'],
            ], input.outputRows.map((row) => ({
                panel: byId.get(row.panelElementId)?.label ?? '-',
                output: row.outputLabel,
                loads: row.loadsDetail,
                kw: n(row.installedPowerW / 1000, 2),
                phase: row.phaseBalance,
                cable: `${n(row.sectionMm2, 1)} mm² ${row.conductorType}`,
                length: n(row.lengthM, 1),
                itm: row.itm || '-',
                du: n(row.voltageDropPct, 2),
                status: row.voltageDropOk && row.capacityConforms ? 'Dentro del límite' : 'Fuera del límite',
            }))),
        );
        page('page-outputs', 'site-section', 'technical-appendix', 'Salidas de tableros (CT)', ['site-outputs'], [
            'Calculadas con el motor CT de la V1, con la caída de la red hasta cada tablero. Límites configurados (referencia CNE-Utilización 050-102, edición sin confirmar).',
        ]);
    }

    // ── Metrado.
    assets.push(
        table('site-bom', 'Metrado de cable', [
            ['item', 'Conductor'],
            ['length', 'Longitud (m)'],
        ], [
            ...summary.cableByType.map((row) => ({ item: row.label, length: n(row.lengthM, 1) })),
            ...(summary.feederLengthM > 0 ? [{ item: 'Alimentadores trazados', length: n(summary.feederLengthM, 1) }] : []),
        ]),
    );
    page('page-bom', 'site-section', 'technical-appendix', 'Metrado', ['site-bom'], [
        'Longitudes con recorrido real, cotas, subida por equipo y desperdicio (mismo metrado que Red y CT).',
    ]);

    const numbered: DialuxDocumentPage[] = pages.map((item, index) => ({ ...item, pageNumber: index + 1 }));
    const toc: DialuxTocEntry[] = numbered
        .filter((item) => item.kind !== 'cover' && item.kind !== 'toc')
        .filter((item) => tocOverrides.get(item.id) !== false)
        .filter((item) => !item.ambientId || tocOverrides.has(item.id))
        .map((item) => {
            const override = tocOverrides.get(item.id);
            return {
                sectionId: item.sectionId,
                title: (override ? override.title : item.title).slice(0, 255),
                subtitle: override ? null : item.subtitle,
                level: override ? override.level : 0,
                pageNumber: item.pageNumber,
                kind: 'item' as const,
            };
        });
    const fileBase = `${(input.projectName || 'planta').replace(/[^a-zA-Z0-9_-]/g, '_')}_planta_general`;
    return {
        formatVersion: '1.0.0',
        schemaVersion: DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
        title: input.projectName || 'Planta general',
        subtitle: 'Planta general — alumbrado exterior y salidas eléctricas',
        fileBaseName: fileBase,
        generatedAt: generatedAt.toISOString(),
        paper: { format: 'A4', orientation: 'portrait' },
        header: { title: input.projectName || 'Planta general', subtitle: 'Planta general' },
        footer: { left: `Generado el ${date}`, right: 'Dialux web' },
        metadata,
        pages: numbered,
        toc,
        luminaires: projectLuminaires,
        luminaireTotals: {
            totalLumens: [...groups.values()].reduce((sum, g) => sum + g.lumens * g.count, 0),
            totalPowerWatts: summary.lightingW,
            overallEfficiency: summary.lightingW > 0
                ? [...groups.values()].reduce((sum, g) => sum + g.lumens * g.count, 0) / summary.lightingW
                : 0,
        },
        levels: [],
        ambientDetails,
        assets,
        glossary: [],
    };
}
