import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import {
    DEFAULT_MAINTENANCE_FACTOR,
    DEFAULT_REFLECTANCE_CEILING,
    DEFAULT_REFLECTANCE_FLOOR,
    DEFAULT_REFLECTANCE_WALL,
    DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
    type DialuxAmbientDetail,
    type DialuxAmbientLuminaireItem,
    type DialuxDocumentPage,
    type DialuxExportAsset,
    type DialuxExportSnapshot,
    type DialuxFormalDocument,
    type DialuxLevelSummary,
    type DialuxLuminaireListItem,
    type DialuxLuminaireTotals,
    type DialuxProjectPhotometricDefaults,
    type DialuxStructuredSummaryData,
    type DialuxTocEntry,
    type GlossaryEntry,
} from '../domain/types';
import { selectGlossaryEntries } from './glossaryCatalog';

// 14 dejaba media página en blanco en proyectos reales: la altura real de
// fila del CSS (.toc-row ~6mm, encabezados de sección ~7-11mm) permite bastante
// más por página en una hoja A4 (~243mm útiles tras título/índice). 24 es un
// valor conservador frente a esa capacidad real (mezcla de filas simples,
// filas con subtítulo y encabezados de sección).
const TOC_ROWS_PER_PAGE = 24;

/**
 * Filas por página para listas de luminarias (proyecto/nivel). Mismo enfoque
 * que TOC_ROWS_PER_PAGE: una constante razonable, no una medición real de
 * alto de fila (no existe esa infraestructura hoy).
 */
const LUMINAIRE_ROWS_PER_PAGE = 20;

/** Filas por página para la tabla de objetos de cálculo por recinto. */
const CALCULATION_OBJECT_ROWS_PER_PAGE = 18;

/** Términos de glosario por página (cada fila ya mantiene término+definición juntos). */
const GLOSSARY_ROWS_PER_PAGE = 12;

interface PageSeed {
    id: string;
    kind: DialuxDocumentPage['kind'];
    sectionId: DialuxDocumentPage['sectionId'];
    title: string;
    subtitle: string | null;
    assetIds: string[];
    notes: string[];
    ambientId?: string | null;
    sceneId?: string | null;
    sceneName?: string | null;
    roomId?: string | null;
    rowRangeStart?: number | null;
    rowRangeEnd?: number | null;
}

/** Divide `totalRows` en tramos `[start, end)` de a lo sumo `rowsPerPage` filas. */
function chunkIndices(
    totalRows: number,
    rowsPerPage: number,
): Array<{ start: number; end: number }> {
    if (totalRows <= 0) {
        return [{ start: 0, end: 0 }];
    }

    const chunks: Array<{ start: number; end: number }> = [];
    for (let start = 0; start < totalRows; start += rowsPerPage) {
        chunks.push({ start, end: Math.min(start + rowsPerPage, totalRows) });
    }

    return chunks;
}

function toFileBaseName(projectName: string): string {
    return projectName
        .toLowerCase()
        .normalize('NFD')
        .replaceAll(/[\u0300-\u036f]/g, '')
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '')
        .slice(0, 80);
}

function toDisplayLabel(value: string): string {
    return value
        .replaceAll('-', ' ')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function readFixturePowerWatts(
    fixture: DialuxExportSnapshot['fixtures'][number],
): number | null {
    return 'power' in fixture && typeof fixture.power === 'number'
        ? fixture.power
        : null;
}

function stripCopyCounter(name: string): string {
    return name.replace(/\s*[\[\(]\d+[\]\)]\s*$/, '').trim();
}

/**
 * Clave de agrupación de luminarias al estilo DIALux evo: el mismo producto
 * (misma referencia de catálogo) se consolida en una sola fila con cantidad,
 * sin importar en cuántos ambientes esté colocado ni el sufijo de copia
 * "[n]"/"(n)" del nombre de la instancia.
 */
function buildProductGroupKey(
    fixture: DialuxExportSnapshot['fixtures'][number],
): string {
    if (fixture.productId !== undefined && fixture.productId !== null) {
        return `prod::${fixture.productId}`;
    }

    return [
        (fixture.brand ?? 'sin-fabricante').trim().toLowerCase(),
        (fixture.articleNumber ?? 'sin-articulo').trim().toLowerCase(),
        stripCopyCounter(fixture.name).toLowerCase(),
    ].join('::');
}

function polygonPerimeter(vertices: Array<{ x: number; y: number }>): number {
    if (vertices.length < 3) {
        return 0;
    }

    return vertices.reduce((sum, vertex, index) => {
        const next = vertices[(index + 1) % vertices.length]!;
        return sum + Math.hypot(next.x - vertex.x, next.y - vertex.y);
    }, 0);
}

function polygonArea(vertices: Array<{ x: number; y: number }>): number {
    return polygonAreaM2(vertices);
}

function buildLuminaireList(
    snapshot: DialuxExportSnapshot,
): DialuxLuminaireListItem[] {
    const groupedFixtures = new Map<string, DialuxLuminaireListItem>();

    for (const fixture of snapshot.fixtures) {
        const ambient = snapshot.ambients.find(
            (candidate) => candidate.room.id === fixture.roomId,
        );
        const roomName =
            ambient?.roomName ??
            snapshot.rooms.find((room) => room.id === fixture.roomId)?.name ??
            null;
        const powerWatts = readFixturePowerWatts(fixture);
        const baseName = stripCopyCounter(fixture.name);
        const key = buildProductGroupKey(fixture);

        const currentItem = groupedFixtures.get(key);
        if (currentItem) {
            currentItem.quantity += 1;
            continue;
        }

        const lumens = fixture.lumens ?? null;
        const efficiency =
            lumens !== null && powerWatts !== null && powerWatts > 0
                ? Number((lumens / powerWatts).toFixed(1))
                : null;

        groupedFixtures.set(key, {
            id: fixture.id,
            name: baseName,
            model: fixture.fixtureType ?? fixture.fixtureShape ?? 'No definido',
            brand: fixture.brand ?? null,
            articleNumber:
                fixture.articleNumber ??
                fixture.productSourceFormat?.toUpperCase() ??
                fixture.fixtureType ??
                null,
            fixtureShape: fixture.fixtureShape ?? null,
            shape: fixture.fixtureShape ?? null,
            lumens,
            powerWatts,
            efficiency,
            roomName,
            ambientName: ambient?.name ?? null,
            quantity: 1,
            cct: fixture.cct ?? null,
            cri: fixture.cri ?? null,
            description: fixture.description ?? null,
            applications: fixture.applications ?? null,
            reportData: fixture.reportData ?? null,
            reportAssets: fixture.reportAssets ?? null,
            ugrTable: fixture.ugrTable ?? null,
            ugrDiagramValue: fixture.ugrDiagramValue ?? null,
            polarDiagramAssetId: fixture.polarDiagramAssetId ?? null,
            productPhotoAssetId: fixture.productPhotoAssetId ?? null,
            brandLogoAssetId: fixture.brandLogoAssetId ?? null,
            lineDrawingAssetId: fixture.lineDrawingAssetId ?? null,
        });
    }

    return [...groupedFixtures.values()].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
    );
}

function buildLuminaireTotals(
    luminaires: DialuxLuminaireListItem[],
): DialuxLuminaireTotals {
    const totalLumens = luminaires.reduce(
        (sum, luminaire) => sum + (luminaire.lumens ?? 0) * luminaire.quantity,
        0,
    );
    const totalPowerWatts = luminaires.reduce(
        (sum, luminaire) =>
            sum + (luminaire.powerWatts ?? 0) * luminaire.quantity,
        0,
    );

    return {
        totalLumens: Number(totalLumens.toFixed(0)),
        totalPowerWatts: Number(totalPowerWatts.toFixed(1)),
        overallEfficiency:
            totalPowerWatts > 0
                ? Number((totalLumens / totalPowerWatts).toFixed(1))
                : 0,
    };
}

function buildAmbientLuminaireList(
    ambient: DialuxExportSnapshot['ambients'][number],
): DialuxAmbientLuminaireItem[] {
    const groupedFixtures = new Map<string, DialuxAmbientLuminaireItem>();

    for (const fixture of ambient.fixtures) {
        const powerWatts = readFixturePowerWatts(fixture);
        const baseName = stripCopyCounter(fixture.name);
        const key = buildProductGroupKey(fixture);
        const existing = groupedFixtures.get(key);

        if (existing) {
            existing.quantity += 1;
            continue;
        }

        const lumens = fixture.lumens ?? null;
        const efficiency =
            lumens !== null && powerWatts !== null && powerWatts > 0
                ? Number((lumens / powerWatts).toFixed(1))
                : null;

        groupedFixtures.set(key, {
            id: fixture.id,
            name: baseName,
            model: fixture.fixtureType ?? fixture.fixtureShape ?? 'No definido',
            brand: fixture.brand ?? null,
            articleNumber:
                fixture.articleNumber ??
                fixture.productSourceFormat?.toUpperCase() ??
                fixture.fixtureType ??
                null,
            fixtureShape: fixture.fixtureShape ?? null,
            shape: fixture.fixtureShape ?? null,
            lumens,
            powerWatts,
            efficiency,
            roomName: ambient.roomName,
            ambientName: ambient.name,
            quantity: 1,
            reportData: fixture.reportData ?? null,
            reportAssets: fixture.reportAssets ?? null,
        });
    }

    return [...groupedFixtures.values()].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
    );
}

/**
 * Lista de luminarias consolidada a escala de nivel (varios ambientes de la
 * misma Scene). Mismo patrón de agrupación que `buildAmbientLuminaireList`,
 * generalizado a una lista de ambientes en vez de uno solo.
 */
function buildLevelLuminaireList(
    ambients: DialuxExportSnapshot['ambients'],
): DialuxLuminaireListItem[] {
    const groupedFixtures = new Map<string, DialuxLuminaireListItem>();

    for (const ambient of ambients) {
        for (const fixture of ambient.fixtures) {
            const powerWatts = readFixturePowerWatts(fixture);
            const baseName = stripCopyCounter(fixture.name);
            const key = buildProductGroupKey(fixture);
            const existing = groupedFixtures.get(key);

            if (existing) {
                existing.quantity += 1;
                continue;
            }

            const lumens = fixture.lumens ?? null;
            const efficiency =
                lumens !== null && powerWatts !== null && powerWatts > 0
                    ? Number((lumens / powerWatts).toFixed(1))
                    : null;

            groupedFixtures.set(key, {
                id: fixture.id,
                name: baseName,
                model:
                    fixture.fixtureType ?? fixture.fixtureShape ?? 'No definido',
                brand: fixture.brand ?? null,
                articleNumber:
                    fixture.articleNumber ??
                    fixture.productSourceFormat?.toUpperCase() ??
                    fixture.fixtureType ??
                    null,
                fixtureShape: fixture.fixtureShape ?? null,
                shape: fixture.fixtureShape ?? null,
                lumens,
                powerWatts,
                efficiency,
                roomName: ambient.roomName,
                ambientName: ambient.name,
                quantity: 1,
                reportData: fixture.reportData ?? null,
                reportAssets: fixture.reportAssets ?? null,
            });
        }
    }

    return [...groupedFixtures.values()].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
    );
}

/**
 * Agregados por nivel (Scene): luminarias, totales y conteos de cumplimiento.
 * Se deriva agrupando `snapshot.ambients` por `sceneId` — funciona igual con
 * 1 nivel o con N, sin cantidades fijas.
 */
function buildLevelSummaries(
    snapshot: DialuxExportSnapshot,
): DialuxLevelSummary[] {
    const sceneOrder: string[] = [];
    const ambientsByScene = new Map<
        string,
        DialuxExportSnapshot['ambients']
    >();

    for (const ambient of snapshot.ambients) {
        let ambientsForScene = ambientsByScene.get(ambient.sceneId);
        if (!ambientsForScene) {
            ambientsForScene = [];
            ambientsByScene.set(ambient.sceneId, ambientsForScene);
            sceneOrder.push(ambient.sceneId);
        }
        ambientsForScene.push(ambient);
    }

    return sceneOrder
        .map((sceneId): DialuxLevelSummary => {
            const ambients = ambientsByScene.get(sceneId)!;
            const luminaires = buildLevelLuminaireList(ambients);

            return {
                sceneId,
                sceneName: ambients[0]!.sceneName,
                floorIndex: ambients[0]!.floorIndex,
                ambientCount: ambients.length,
                calculatedAmbientCount: ambients.filter(
                    (ambient) => ambient.result !== null,
                ).length,
                compliantAmbientCount: ambients.filter(
                    (ambient) => ambient.metrics.complies,
                ).length,
                fixtureCount: ambients.reduce(
                    (sum, ambient) => sum + ambient.fixtures.length,
                    0,
                ),
                luminaires,
                luminaireTotals: buildLuminaireTotals(luminaires),
            };
        })
        .sort((left, right) => left.floorIndex - right.floorIndex);
}

function buildAmbientDetails(
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

function findStructuredSummaryData(
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

function buildPreliminaryNotes(
    snapshot: DialuxExportSnapshot,
    luminaires: DialuxLuminaireListItem[],
    summaryAsset: DialuxStructuredSummaryData | null,
): string[] {
    const missingResults =
        snapshot.summary.calculatedAmbientCount < snapshot.summary.ambientCount;
    const hasFixtures = snapshot.summary.fixtureCount > 0;
    const summaryLine = summaryAsset?.items
        .map((item) => `${item.label}: ${item.value}`)
        .join(' | ');

    return [
        'Objetivo del estudio: documentar en formato formal el estado del modelado luminico, la jerarquia recinto -> ambiente y los principales indicadores tecnicos del proyecto exportado.',
        `Alcance del documento: ${snapshot.summary.roomCount} recinto(s), ${snapshot.summary.ambientCount} ambiente(s) derivado(s) y ${snapshot.summary.fixtureCount} luminaria(s) registradas en la escena activa.`,
        'Base de calculo: los lux promedio, uniformidad y UGR se leen desde los resultados almacenados por ambiente; las cantidades propuestas se derivan de area, lux objetivo y flujo luminoso disponible.',
        'Criterios de lectura: E avg se compara con el lux objetivo del ambiente, Uo describe uniformidad del plano util y UGR resume control de deslumbramiento cuando el resultado esta disponible.',
        missingResults
            ? 'Advertencia: no todos los ambientes cuentan con resultados de calculo; las secciones tecnicas deben interpretarse como avance parcial hasta recalcular la escena completa.'
            : 'Estado del calculo: todos los ambientes del snapshot cuentan con resultados luminotecnicos listos para su lectura en el reporte.',
        hasFixtures
            ? `Inventario preliminar: ${luminaires.length} tipologia(s) de luminarias detectadas y agrupadas para las paginas tecnicas posteriores.`
            : 'Inventario preliminar: la escena activa no registra luminarias, por lo que la propuesta tecnica requiere completar activos antes de emitir un informe final.',
        summaryLine
            ? `Resumen del proyecto: ${summaryLine}`
            : 'Resumen del proyecto: usar metadata y assets estructurados como fuente unica de lectura para las siguientes secciones del reporte.',
    ];
}

function buildFixedPageSeeds(
    snapshot: DialuxExportSnapshot,
    luminaires: DialuxLuminaireListItem[],
    assets: DialuxExportAsset[],
): PageSeed[] {
    const summaryData = findStructuredSummaryData(
        assets,
        'project-summary-data',
    );
    const coverAssetId =
        assets.find((asset) => asset.id === 'viewer-capture-3d')?.id ??
        assets.find((asset) => asset.id === 'formal-cover-svg')?.id ??
        assets.find((asset) => asset.id === 'viewer-capture')?.id ??
        assets.find((asset) => asset.purpose === 'formal-cover')?.id ??
        '';
    const preliminaryAssetIds = [
        'project-summary-data',
        'viewer-capture',
        'formal-cover-svg',
        'terrain-with-isolux-svg',
        'cad-overview-svg',
        'lighting-results-data',
    ].filter((id) => assets.some((asset) => asset.id === id));

    return [
        {
            id: 'page-cover',
            kind: 'cover',
            sectionId: 'cover',
            title: 'Portada',
            subtitle: snapshot.scene.name,
            assetIds: coverAssetId ? [coverAssetId] : [],
            notes: [],
        },
        {
            id: 'page-preliminary-observations',
            kind: 'preliminary-observations',
            sectionId: 'preliminary-observations',
            title: 'Observaciones preliminares',
            subtitle: 'Base tecnica y criterios iniciales del reporte',
            assetIds: preliminaryAssetIds,
            notes: buildPreliminaryNotes(snapshot, luminaires, summaryData),
        },
    ];
}

function buildTechnicalPageSeeds(
    snapshot: DialuxExportSnapshot,
    luminaires: DialuxLuminaireListItem[],
    ambientDetails: DialuxAmbientDetail[],
    assets: DialuxExportAsset[],
    levelSummaries: DialuxLevelSummary[],
    glossaryEntries: GlossaryEntry[],
): PageSeed[] {
    const seeds: PageSeed[] = [];

    // ── Bloque 1: Planos del terreno (lo primero y más importante del informe) ──
    // Orden DIALux evo solicitado: plano solo → plano con dibujo → plano con isolux.

    // 1a. Plano base importado (solo CAD DXF, sin recintos)
    const cadSvgAssetId = assets.some((a) => a.id === 'cad-overview-svg')
        ? 'cad-overview-svg'
        : assets.some((a) => a.id === 'cad-base-bitmap')
          ? 'cad-base-bitmap'
          : null;

    if (cadSvgAssetId) {
        seeds.push({
            id: 'page-terrain-cad',
            kind: 'terrain-cad',
            sectionId: 'cad-overview',
            title: 'Terreno 1 - Edificación 1',
            subtitle: 'Plano base importado',
            assetIds: [cadSvgAssetId],
            notes: [],
        });
    }

    // 1b. Lista de locales (CAD + recintos dibujados, sin isolux).
    // La captura compuesta del editor (CAD + overlay alineados) es la fuente
    // preferida; el SVG sintético queda como fallback sin DOM/captura.
    const drawnTerrainAssetId = assets.some(
        (a) => a.id === 'composite-plan-bitmap',
    )
        ? 'composite-plan-bitmap'
        : assets.some((a) => a.id === 'drawn-terrain-svg')
          ? 'drawn-terrain-svg'
          : cadSvgAssetId;

    seeds.push({
        id: 'page-terrain-ambient-list',
        kind: 'ambient-list',
        sectionId: 'ambient-list',
        title: 'Lista de locales / Escena de luz 1',
        subtitle: 'Terreno 1 - Edificacion 1',
        assetIds: drawnTerrainAssetId ? [drawnTerrainAssetId] : [],
        notes: [],
    });

    // 1c. Plano Arquitectónico con Isolux superpuesto (CAD + recintos + isolux)
    const terrainIsoluxAssetId = assets.some(
        (a) => a.id === 'composite-isolux-bitmap',
    )
        ? 'composite-isolux-bitmap'
        : assets.some((a) => a.id === 'terrain-with-isolux-svg')
          ? 'terrain-with-isolux-svg'
          : drawnTerrainAssetId;

    if (terrainIsoluxAssetId) {
        seeds.push({
            id: 'page-terrain-architectural',
            kind: 'terrain-architectural',
            sectionId: 'architectural-overview',
            title: 'Terreno 1 - Edificación 1',
            subtitle: 'Plano Arquitectónico con Isolux',
            assetIds: [terrainIsoluxAssetId],
            notes: [],
        });
    }

    // ── Bloque 2: Luminarias agrupadas por producto + fichas técnicas ──

    // 2a. Lista de luminarias (una fila por producto, con cantidad).
    // Se divide en varias páginas cuando excede LUMINAIRE_ROWS_PER_PAGE, en
    // vez de un solo seed con la tabla completa (que el CSS de la página
    // recortaría en silencio con overflow:hidden).
    chunkIndices(luminaires.length, LUMINAIRE_ROWS_PER_PAGE).forEach(
        (range, index) => {
            seeds.push({
                id: index === 0 ? 'page-terrain-luminaires' : `page-terrain-luminaires-p${index + 1}`,
                kind: 'luminaire-list',
                sectionId: 'cad-overview-luminaires',
                title: 'Lista de luminarias',
                subtitle:
                    index === 0
                        ? 'Terreno 1 - Edificación 1'
                        : `Terreno 1 - Edificación 1 (continuación)`,
                assetIds: [],
                notes: [],
                rowRangeStart: range.start,
                rowRangeEnd: range.end,
            });
        },
    );

    // 2b. Fichas de producto (una por producto único, no por instancia)
    luminaires.forEach((lum) => {
        const assetIds: string[] = [];
        if (lum.brandLogoAssetId) assetIds.push(lum.brandLogoAssetId);
        if (lum.productPhotoAssetId) assetIds.push(lum.productPhotoAssetId);
        if (lum.lineDrawingAssetId) assetIds.push(lum.lineDrawingAssetId);
        if (lum.polarDiagramAssetId) assetIds.push(lum.polarDiagramAssetId);

        seeds.push({
            id: `page-product-sheet-${lum.id}`,
            kind: 'product-sheet',
            sectionId: `product-sheet:${lum.id}`,
            title: 'Ficha de producto',
            subtitle: lum.name,
            assetIds: assetIds,
            notes: [],
        });
    });

    // Secuencia por Recinto (Room) → 5 sub-secciones por local (estructura DIALux)
    // Sorted by floorIndex so rooms belonging to "1° NIVEL" appear before "2° NIVEL".
    const sortedRooms = [...snapshot.rooms].sort((a, b) => {
        const aFloor = ambientDetails.find((d) => d.roomId === a.id)?.floorIndex ?? 0;
        const bFloor = ambientDetails.find((d) => d.roomId === b.id)?.floorIndex ?? 0;
        return aFloor - bFloor;
    });
    const emittedLevelSummaryForScene = new Set<string>();

    sortedRooms.forEach((room) => {
        const roomAmbients = ambientDetails.filter((a) => a.roomId === room.id);
        if (roomAmbients.length === 0) return;
        const levelSceneId = roomAmbients[0]?.sceneId ?? null;
        const levelSceneNameForRoom = roomAmbients[0]?.sceneName ?? null;

        // Lista de luminarias del nivel: una vez por nivel (Scene), antes de
        // sus locales. Funciona igual con 1 nivel o con N (no asume cantidad fija).
        if (levelSceneId && !emittedLevelSummaryForScene.has(levelSceneId)) {
            emittedLevelSummaryForScene.add(levelSceneId);
            const levelSummary = levelSummaries.find(
                (level) => level.sceneId === levelSceneId,
            );

            const levelLuminaireCount = levelSummary?.luminaires.length ?? 0;
            const levelListSubtitle = levelSummary?.sceneName ?? levelSceneNameForRoom;
            chunkIndices(levelLuminaireCount, LUMINAIRE_ROWS_PER_PAGE).forEach(
                (range, index) => {
                    seeds.push({
                        id:
                            index === 0
                                ? `page-level-luminaires-${levelSceneId}`
                                : `page-level-luminaires-${levelSceneId}-p${index + 1}`,
                        kind: 'level-luminaire-list',
                        sectionId: `level-luminaire-list:${levelSceneId}`,
                        title: 'Lista de luminarias del nivel',
                        subtitle:
                            index === 0
                                ? levelListSubtitle
                                : `${levelListSubtitle ?? 'Nivel'} (continuación)`,
                        assetIds: [],
                        notes: [],
                        sceneId: levelSceneId,
                        sceneName: levelSceneNameForRoom,
                        rowRangeStart: range.start,
                        rowRangeEnd: range.end,
                    });
                },
            );
        }
        const levelSceneName = roomAmbients[0]?.sceneName ?? null;

        // Nivel: Lista de locales (bloques por local con Ptotal, área,
        // potencia específica y Ē, como la página "Lista de locales" de evo)
        seeds.push({
            id: `page-room-ambient-list-${room.id}`,
            kind: 'room-ambient-list',
            sectionId: `room-ambient-list:${room.id}`,
            title: 'Lista de locales / Escena de luz 1',
            subtitle: room.name,
            assetIds: [],
            notes: [],
            sceneId: levelSceneId,
            sceneName: levelSceneName,
            roomId: room.id,
        });

        // Nivel: Lista de luminarias
        seeds.push({
            id: `page-room-luminaires-${room.id}`,
            kind: 'room-luminaires',
            sectionId: `room-luminaires:${room.id}`,
            title: 'Lista de luminarias',
            subtitle: room.name,
            assetIds: [],
            notes: [],
            sceneId: levelSceneId,
            sceneName: levelSceneName,
            roomId: room.id,
        });

        // Nivel: Objetos de cálculo / Escena de luz 1 (todos los locales del
        // nivel). Se pagina igual que las listas de luminarias (Fase 4): un
        // recinto con más ambientes que los que caben en una hoja no debe
        // recortarlos en silencio.
        chunkIndices(roomAmbients.length, CALCULATION_OBJECT_ROWS_PER_PAGE).forEach(
            (range, index) => {
                seeds.push({
                    id:
                        index === 0
                            ? `page-room-calculation-objects-${room.id}`
                            : `page-room-calculation-objects-${room.id}-p${index + 1}`,
                    kind: 'calculation-object-list',
                    sectionId: `room-calculation-object:${room.id}`,
                    title: 'Objetos de cálculo / Escena de luz 1',
                    subtitle: index === 0 ? room.name : `${room.name} (continuación)`,
                    assetIds: [],
                    notes: [],
                    sceneId: levelSceneId,
                    sceneName: levelSceneName,
                    roomId: room.id,
                    rowRangeStart: range.start,
                    rowRangeEnd: range.end,
                });
            },
        );

        // Sub-secciones por local (5 páginas fijas por ambiente)
        roomAmbients.forEach((detail) => {
            // Sub-sección 1: Resumen / Escena de luz 1 (métricas + resultados, sin imagen)
            seeds.push({
                id: `page-ambient-summary-${detail.ambientId}`,
                kind: 'ambient-summary',
                sectionId: `ambient-summary:${detail.ambientId}`,
                title: 'Resumen / Escena de luz 1',
                subtitle: detail.ambientName,
                assetIds: [],
                notes: [],
                sceneId: detail.sceneId,
                sceneName: detail.sceneName,
                ambientId: detail.ambientId,
                roomId: room.id,
            });

            // Sub-sección 2: Plano de situación de luminarias
            if (detail.planAssetId) {
                seeds.push({
                    id: `page-ambient-plan-${detail.ambientId}`,
                    kind: 'ambient-plan',
                    sectionId: `ambient-plan:${detail.ambientId}`,
                    title: 'Plano de situación de luminarias',
                    subtitle: detail.ambientName,
                    assetIds: [detail.planAssetId],
                    notes: [],
                    sceneId: detail.sceneId,
                    sceneName: detail.sceneName,
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            // Sub-sección 3: Lista de luminarias del ambiente
            if (detail.luminaires.length > 0) {
                seeds.push({
                    id: `page-ambient-luminaires-${detail.ambientId}`,
                    kind: 'ambient-luminaires',
                    sectionId: `ambient-luminaires:${detail.ambientId}`,
                    title: 'Lista de luminarias',
                    subtitle: detail.ambientName,
                    assetIds: [],
                    notes: [],
                    sceneId: detail.sceneId,
                    sceneName: detail.sceneName,
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            // Sub-sección 4: Objetos de cálculo / Escena de luz 1
            seeds.push({
                id: `page-ambient-calculation-object-${detail.ambientId}`,
                kind: 'ambient-calculation-object',
                sectionId: `ambient-calculation-object:${detail.ambientId}`,
                title: 'Objetos de cálculo / Escena de luz 1',
                subtitle: detail.ambientName,
                assetIds: [],
                notes: [],
                sceneId: detail.sceneId,
                sceneName: detail.sceneName,
                ambientId: detail.ambientId,
                roomId: room.id,
            });

            // Sub-sección 5: Plano útil / Iluminancia perpendicular (mapa isolux)
            if (detail.isoluxAssetId) {
                seeds.push({
                    id: `page-ambient-useful-plane-${detail.ambientId}`,
                    kind: 'ambient-useful-plane',
                    sectionId: `ambient-useful-plane:${detail.ambientId}`,
                    title: `Plano útil (${detail.ambientName}) / Iluminancia perpendicular`,
                    subtitle: detail.ambientName,
                    assetIds: [detail.isoluxAssetId],
                    notes: [],
                    sceneId: detail.sceneId,
                    sceneName: detail.sceneName,
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }
        });
    });

    // Glosario: solo los términos que este informe realmente usa (ver
    // glossaryCatalog.ts), paginado igual que las demás tablas largas.
    chunkIndices(glossaryEntries.length, GLOSSARY_ROWS_PER_PAGE).forEach(
        (range, index) => {
            seeds.push({
                id: index === 0 ? 'page-glossary' : `page-glossary-p${index + 1}`,
                kind: 'glossary',
                sectionId: 'glossary',
                title: 'Glosario',
                subtitle: index === 0 ? '' : 'Continuación',
                assetIds: [],
                notes: [],
                rowRangeStart: range.start,
                rowRangeEnd: range.end,
            });
        },
    );

    return seeds;
}

function buildTocEntries(
    tocPageCount: number,
    fixedPageSeeds: PageSeed[],
    technicalPageSeeds: PageSeed[],
    fixedPageCount: number,
    snapshot: DialuxExportSnapshot,
): DialuxTocEntry[] {
    const entries: DialuxTocEntry[] = fixedPageSeeds.map((seed, index) => ({
        sectionId: seed.sectionId,
        title: seed.title,
        subtitle: seed.subtitle,
        level: 0,
        pageNumber: index + 1,
    }));

    entries.push({
        sectionId: 'content',
        title: 'Contenido',
        subtitle: null,
        level: 0,
        pageNumber: fixedPageCount + 1,
    });

    const firstTechnicalPage = fixedPageCount + tocPageCount + 1;
    let currentSceneId: string | null = null;
    let currentRoomId: string | null = null;
    let currentAmbientId: string | null = null;
    let productSheetHeaderAdded = false;
    let terrainHeaderAdded = false;

    technicalPageSeeds.forEach((seed, index) => {
        // Special TOC Group: Terreno (antes de la primera página de planos del bloque general)
        if (
            !terrainHeaderAdded &&
            (seed.kind === 'terrain-cad' ||
                seed.kind === 'ambient-list' ||
                seed.kind === 'terrain-architectural' ||
                seed.kind === 'luminaire-list')
        ) {
            entries.push({
                sectionId: 'terrain-header',
                title: 'Terreno 1',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-label',
                size: 'small',
            });
            entries.push({
                sectionId: 'edification-header',
                title: snapshot.project.name,
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large',
            });
            terrainHeaderAdded = true;
        }

        // Special TOC Group: Fichas de producto
        if (seed.kind === 'product-sheet' && !productSheetHeaderAdded) {
            entries.push({
                sectionId: 'product-sheets-header',
                title: 'Fichas de producto',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large',
            });
            productSheetHeaderAdded = true;
        }

        if (seed.sceneId && seed.sceneId !== currentSceneId) {
            currentSceneId = seed.sceneId;
            entries.push({
                sectionId: `scene-group-label-${seed.sceneId}`,
                title: snapshot.project.name,
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-label',
                size: 'small',
            });
            entries.push({
                sectionId: `scene-group-heading-${seed.sceneId}`,
                title: seed.sceneName ?? 'Nivel',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large',
            });
        }

        // Room transition tracking.
        if (seed.roomId && seed.roomId !== currentRoomId) {
            currentRoomId = seed.roomId;
        }

        // Ambient Transition Group
        if (seed.ambientId && seed.ambientId !== currentAmbientId) {
            const ambient = snapshot.ambients.find(
                (a) => a.id === seed.ambientId,
            );
            currentAmbientId = seed.ambientId;
            if (ambient) {
                entries.push({
                    sectionId: `ambient-group-label-${ambient.id}`,
                    title: ambient.roomName,
                    subtitle: null,
                    level: 1,
                    pageNumber: 0,
                    kind: 'section-label',
                    size: 'small',
                });
                entries.push({
                    sectionId: `ambient-group-heading-${ambient.id}`,
                    title: ambient.name,
                    subtitle: null,
                    level: 1,
                    pageNumber: 0,
                    kind: 'section-heading',
                    size: 'large',
                });
            }
        }

        let level = 0;
        let title = seed.title;

        if (seed.kind === 'product-sheet') {
            title = seed.subtitle ?? seed.title;
            level = 0;
        } else if (
            seed.kind === 'terrain-cad' ||
            seed.kind === 'terrain-architectural'
        ) {
            // En el índice se lee mejor el subtítulo descriptivo del plano
            // ("Plano base importado", "Plano Arquitectónico con Isolux").
            title = seed.subtitle ?? seed.title;
            level = 0;
        } else if (
            seed.kind === 'ambient-plan' ||
            seed.kind === 'ambient-luminaires' ||
            seed.kind === 'ambient-products' ||
            seed.kind === 'ambient-calculation-object' ||
            seed.kind === 'ambient-useful-plane' ||
            seed.kind === 'ambient-summary' ||
            seed.kind === 'ambient-results' ||
            seed.kind === 'ambient-list' ||
            seed.kind === 'calculation-object-list' ||
            seed.kind === 'room-ambient-list' ||
            seed.kind === 'room-luminaires' ||
            seed.kind === 'room-calculation-object'
        ) {
            level = 0; // The user TOC doesn't indent them visually, it just lists them under the headers
        }

        entries.push({
            sectionId: seed.sectionId,
            title: title,
            subtitle: null,
            level,
            pageNumber: firstTechnicalPage + index,
            kind: 'item',
        });
    });

    return entries;
}

function generateFormalTocFromSeeds(
    fixedPageCount: number,
    fixedPageSeeds: PageSeed[],
    technicalPageSeeds: PageSeed[],
    snapshot: DialuxExportSnapshot,
): DialuxTocEntry[] {
    let tocPageCount = 1;

    while (true) {
        const tocEntries = buildTocEntries(
            tocPageCount,
            fixedPageSeeds,
            technicalPageSeeds,
            fixedPageCount,
            snapshot,
        );
        const nextTocPageCount = Math.max(
            1,
            Math.ceil(tocEntries.length / TOC_ROWS_PER_PAGE),
        );

        if (nextTocPageCount === tocPageCount) {
            return tocEntries;
        }

        tocPageCount = nextTocPageCount;
    }
}

export function buildDialuxFormalDocument(
    snapshot: DialuxExportSnapshot,
    assets: DialuxExportAsset[],
): DialuxFormalDocument {
    const luminaires = buildLuminaireList(snapshot);
    const luminaireTotals = buildLuminaireTotals(luminaires);
    const levelSummaries = buildLevelSummaries(snapshot);
    const ambientDetails = buildAmbientDetails(snapshot, assets);
    const glossaryEntries = selectGlossaryEntries({
        hasCct: luminaires.some((lum) => lum.cct != null),
        hasCri: luminaires.some((lum) => lum.cri != null),
        hasIsolux: ambientDetails.some((detail) => detail.isoluxAssetId !== null),
        hasMultipleLevels: levelSummaries.length > 1,
    });
    const fixedPageSeeds = buildFixedPageSeeds(snapshot, luminaires, assets);
    const technicalPageSeeds = buildTechnicalPageSeeds(
        snapshot,
        luminaires,
        ambientDetails,
        assets,
        levelSummaries,
        glossaryEntries,
    );
    const fixedPageCount = fixedPageSeeds.length;
    const toc = generateFormalTocFromSeeds(
        fixedPageCount,
        fixedPageSeeds,
        technicalPageSeeds,
        snapshot,
    );
    const tocPageCount = Math.max(1, Math.ceil(toc.length / TOC_ROWS_PER_PAGE));

    const pages: DialuxDocumentPage[] = [
        ...fixedPageSeeds.map((seed, index) => ({
            id: seed.id,
            kind: seed.kind,
            sectionId: seed.sectionId,
            pageNumber: index + 1,
            title: seed.title,
            subtitle: seed.subtitle,
            assetIds: seed.assetIds,
            notes: seed.notes,
            ambientId: seed.ambientId ?? null,
            roomId: seed.roomId ?? null,
            sceneId: seed.sceneId ?? null,
            sceneName: seed.sceneName ?? null,
            rowRangeStart: seed.rowRangeStart ?? null,
            rowRangeEnd: seed.rowRangeEnd ?? null,
        })),
        ...Array.from({ length: tocPageCount }, (_, index) => ({
            id: `page-content-${index + 1}`,
            kind: 'toc' as const,
            sectionId: 'content' as const,
            pageNumber: fixedPageCount + 1 + index,
            title: 'Contenido',
            subtitle:
                tocPageCount > 1
                    ? `Indice ${index + 1} de ${tocPageCount}`
                    : 'Indice del documento',
            assetIds: [],
            notes: [],
        })),
    ];

    const firstTechnicalPage = fixedPageCount + tocPageCount + 1;

    technicalPageSeeds.forEach((seed, index) => {
        pages.push({
            id: seed.id,
            kind: seed.kind,
            sectionId: seed.sectionId,
            pageNumber: firstTechnicalPage + index,
            title: seed.title,
            subtitle: seed.subtitle,
            assetIds: seed.assetIds,
            notes: seed.notes,
            ambientId: seed.ambientId ?? null,
            roomId: seed.roomId ?? null,
            sceneId: seed.sceneId ?? null,
            sceneName: seed.sceneName ?? null,
            rowRangeStart: seed.rowRangeStart ?? null,
            rowRangeEnd: seed.rowRangeEnd ?? null,
        });
    });

    return {
        formatVersion: '1.0.0',
        schemaVersion: DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
        title: `${snapshot.project.name} · Informe Luminotécnico PCL`,
        subtitle: snapshot.scene.name,
        fileBaseName: `${toFileBaseName(snapshot.project.name || 'dialux')}-reporte-formal`,
        generatedAt: snapshot.exportedAt,
        paper: {
            format: 'A4',
            orientation: 'portrait',
        },
        header: {
            title: snapshot.project.name,
            subtitle: snapshot.scene.name,
        },
        footer: {
            left: 'PCL',
            right: snapshot.exportedAt.slice(0, 10),
        },
        metadata: [
            { label: 'Proyecto', value: snapshot.project.name },
            { label: 'Escena', value: snapshot.scene.name },
            { label: 'Exportado', value: snapshot.exportedAt },
            { label: 'Formato', value: 'A4 vertical' },
            { label: 'Ambientes', value: `${snapshot.summary.ambientCount}` },
            { label: 'Luminarias', value: `${snapshot.summary.fixtureCount}` },
            {
                label: 'Estado calculo',
                value:
                    snapshot.summary.ambientCount === 0
                        ? 'Sin ambientes'
                        : snapshot.summary.calculatedAmbientCount === 0
                          ? 'Sin calcular'
                          : snapshot.summary.calculatedAmbientCount <
                              snapshot.summary.ambientCount
                            ? `Parcial (${snapshot.summary.calculatedAmbientCount}/${snapshot.summary.ambientCount})`
                            : snapshot.summary.compliantAmbientCount >=
                                snapshot.summary.ambientCount
                              ? 'Conforme'
                              : `Revisar (${snapshot.summary.compliantAmbientCount}/${snapshot.summary.ambientCount})`,
            },
            {
                label: 'Lux promedio',
                value: snapshot.summary.averageLux.toFixed(1),
            },
        ],
        pages,
        toc,
        luminaires,
        luminaireTotals,
        levels: levelSummaries,
        ambientDetails,
        assets,
        glossary: glossaryEntries,
    };
}

export function generateDialuxToc(
    document: DialuxFormalDocument,
): DialuxTocEntry[] {
    return document.toc;
}
