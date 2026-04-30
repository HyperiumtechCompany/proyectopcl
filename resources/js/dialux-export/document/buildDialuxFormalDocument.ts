import type {
    DialuxAmbientDetail,
    DialuxAmbientLuminaireItem,
    DialuxDocumentPage,
    DialuxExportAsset,
    DialuxExportSnapshot,
    DialuxFormalDocument,
    DialuxLuminaireListItem,
    DialuxLuminaireTotals,
    DialuxStructuredSummaryData,
    DialuxTocEntry,
} from '../domain/types';

const TOC_ROWS_PER_PAGE = 18;

interface PageSeed {
    id: string;
    kind: DialuxDocumentPage['kind'];
    sectionId: DialuxDocumentPage['sectionId'];
    title: string;
    subtitle: string | null;
    assetIds: string[];
    notes: string[];
    ambientId?: string | null;
    roomId?: string | null;
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
        const key = [
            fixture.productId ?? 'sin-producto',
            fixture.name,
            fixture.brand ?? 'sin-fabricante',
            fixture.articleNumber ?? 'sin-articulo',
            fixture.fixtureType ?? 'sin-tipo',
            fixture.lumens ?? 'sin-lumen',
            roomName ?? 'sin-recinto',
            ambient?.name ?? 'sin-ambiente',
        ].join('::');

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
            name: fixture.name,
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
        (sum, luminaire) => sum + (luminaire.powerWatts ?? 0) * luminaire.quantity,
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
        const key = [
            fixture.productId ?? 'sin-producto',
            fixture.name,
            fixture.brand ?? 'sin-fabricante',
            fixture.articleNumber ?? 'sin-articulo',
            fixture.fixtureType,
            fixture.fixtureShape ?? 'sin-forma',
            fixture.lumens ?? 'sin-lumen',
            powerWatts ?? 'sin-potencia',
        ].join('::');
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
            name: fixture.name,
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

function buildAmbientDetails(
    snapshot: DialuxExportSnapshot,
    assets: DialuxExportAsset[],
): DialuxAmbientDetail[] {
    const assetIds = new Set(assets.map((asset) => asset.id));

    return [...snapshot.ambients]
        .sort((left, right) => {
            const roomCompare = left.roomName.localeCompare(right.roomName, 'es');

            if (roomCompare !== 0) {
                return roomCompare;
            }

            return left.index - right.index;
        })
        .map((ambient, index) => {
            const luminaires = buildAmbientLuminaireList(ambient);
            const totalPower = luminaires.reduce<number | null>((sum, luminaire) => {
                if (luminaire.powerWatts === null) {
                    return sum;
                }

                return (sum ?? 0) + luminaire.powerWatts * luminaire.quantity;
            }, null);

            const planAssetId = `ambient-plan-svg-${ambient.id}`;
            const isoluxAssetId = `isolux-svg-${ambient.id}`;

            return {
                ambientId: ambient.id,
                roomId: ambient.roomId,
                roomName: ambient.roomName,
                ambientName: ambient.name,
                activity: ambient.activity,
                area: Number(ambient.metrics.area.toFixed(2)),
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
                usefulPlaneHeight: Number(
                    ambient.metrics.usefulPlaneHeight.toFixed(3),
                ),
                marginalZone: Number(ambient.metrics.marginalZone.toFixed(3)),
                calculationIndex: `WP${index + 1}`,
                fixtureCount: ambient.metrics.fixtureCount,
                totalPowerWatts:
                    totalPower === null ? null : Number(totalPower.toFixed(2)),
                lumensRequired: Number(ambient.metrics.lumensRequired.toFixed(2)),
                fixtureLumens: Number(ambient.metrics.fixtureLumens.toFixed(2)),
                exactQuantity: Number(ambient.metrics.exactQuantity.toFixed(2)),
                roundedQuantity: ambient.metrics.roundedQuantity,
                coverage: toDisplayLabel(ambient.metrics.coverage),
                complianceLabel: ambient.metrics.complies ? 'Cumple' : 'Revisar',
                planAssetId: assetIds.has(planAssetId) ? planAssetId : null,
                isoluxAssetId: assetIds.has(isoluxAssetId) ? isoluxAssetId : null,
                luminaires,
                fixturePositions: ambient.fixtures.map((fixture, fixtureIndex) => ({
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
                })),
            };
        });
}

function findStructuredSummaryData(
    assets: DialuxExportAsset[],
    id: string,
): DialuxStructuredSummaryData | null {
    const asset = assets.find((candidate) => candidate.id === id);

    if (!asset || asset.kind !== 'structured' || asset.data.type !== 'summary') {
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
    const summaryData = findStructuredSummaryData(assets, 'project-summary-data');
    const coverAssetId =
        assets.find((asset) => asset.id === 'viewer-capture-3d')?.id ??
        assets.find((asset) => asset.id === 'formal-cover-svg')?.id ??
        assets.find((asset) => asset.id === 'viewer-capture')?.id ??
        assets.find((asset) => asset.purpose === 'formal-cover')?.id ??
        '';
    const preliminaryAssetIds = [
        'project-summary-data',
        'viewer-capture',
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
            notes: buildPreliminaryNotes(
                snapshot,
                luminaires,
                summaryData,
            ),
        },
    ];
}

function buildTechnicalPageSeeds(
    snapshot: DialuxExportSnapshot,
    luminaires: DialuxLuminaireListItem[],
    ambientDetails: DialuxAmbientDetail[],
    assets: DialuxExportAsset[]
): PageSeed[] {
    const seeds: PageSeed[] = [];

    // 1. Lista de luminarias
    seeds.push({
        id: 'page-terrain-luminaires',
        kind: 'luminaire-list',
        sectionId: 'cad-overview-luminaires',
        title: 'Lista de luminarias',
        subtitle: 'Terreno 1 - Edificación 1',
        assetIds: [],
        notes: []
    });

    // 2. Fichas de producto de luminarias (Detalles técnicos)
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
            notes: []
        });
    });

    // 3. Plano base importado (Solo CAD DXF o Bitmap)
    const cadAssetId = assets.some((a) => a.id === 'viewer-capture')
        ? 'viewer-capture'
        : (assets.some((a) => a.id === 'cad-base-bitmap')
            ? 'cad-base-bitmap'
            : (assets.some((a) => a.id === 'cad-overview-svg') ? 'cad-overview-svg' : null));

    if (cadAssetId) {
        seeds.push({
            id: 'page-terrain-cad',
            kind: 'terrain-cad',
            sectionId: 'cad-overview',
            title: 'Terreno 1 - Edificación 1',
            subtitle: 'Plano base importado',
            assetIds: [cadAssetId],
            notes: []
        });
    }

    // 4. Lista de locales (Ambients)
    seeds.push({
        id: 'page-terrain-ambient-list',
        kind: 'ambient-list',
        sectionId: 'ambient-list',
        title: 'Lista de locales / Escena de luz 1',
        subtitle: 'Terreno 1 - Edificacion 1',
        assetIds: [],
        notes: []
    });

    // 5. Plano Arquitectónico (Recintos y luminarias sobre el CAD)
    const architecturalAssetId = assets.some((a) => a.id === 'viewer-capture')
        ? 'viewer-capture'
        : (assets.some((a) => a.id === 'drawn-terrain-svg')
            ? 'drawn-terrain-svg'
            : cadAssetId);

    if (architecturalAssetId) {
        seeds.push({
            id: 'page-terrain-architectural',
            kind: 'terrain-architectural',
            sectionId: 'architectural-overview',
            title: 'Terreno 1 - Edificación 1',
            subtitle: 'Plano Arquitectónico',
            assetIds: [architecturalAssetId],
            notes: []
        });
    }

    // 6. Objetos de calculo de los planos utiles
    seeds.push({
        id: 'page-terrain-calculation-objects',
        kind: 'calculation-object-list',
        sectionId: 'calculation-object-list',
        title: 'Objetos de calculo / Escena de luz 1',
        subtitle: 'Terreno 1 - Edificacion 1',
        assetIds: [],
        notes: []
    });

    // Secuencia por Recinto (Room)
    snapshot.rooms.forEach((room) => {
        const roomAmbients = ambientDetails.filter(a => a.roomId === room.id);
        if (roomAmbients.length === 0) return;

        // Room Level Pages
        seeds.push({
            id: `page-room-ambient-list-${room.id}`,
            kind: 'room-ambient-list',
            sectionId: `room-ambient-list:${room.id}`,
            title: `Lista de locales / Escena de luz 1`,
            subtitle: null,
            assetIds: ['drawn-terrain-svg'],
            notes: [],
            roomId: room.id,
        });

        seeds.push({
            id: `page-room-luminaires-${room.id}`,
            kind: 'room-luminaires',
            sectionId: `room-luminaires:${room.id}`,
            title: `Lista de luminarias`,
            subtitle: null,
            assetIds: [],
            notes: [],
            roomId: room.id,
        });

        seeds.push({
            id: `page-room-calculation-object-${room.id}`,
            kind: 'room-calculation-object',
            sectionId: `room-calculation-object:${room.id}`,
            title: `Objetos de cálculo / Escena de luz 1`,
            subtitle: null,
            assetIds: [],
            notes: [],
            roomId: room.id,
        });

        // Ambient Level Pages
        roomAmbients.forEach((detail) => {
            seeds.push({
                id: `page-ambient-summary-${detail.ambientId}`,
                kind: 'ambient-summary',
                sectionId: `ambient-summary:${detail.ambientId}`,
                title: `Resumen / Escena de luz 1`,
                subtitle: `${detail.ambientName}`,
                assetIds: [],
                notes: [],
                ambientId: detail.ambientId,
                roomId: room.id,
            });

            if (detail.isoluxAssetId) {
                seeds.push({
                    id: `page-ambient-useful-plane-${detail.ambientId}`,
                    kind: 'ambient-useful-plane',
                    sectionId: `ambient-useful-plane:${detail.ambientId}`,
                    title: `Plano util (${detail.ambientName}) / Escena de luz 1 / Iluminancia perpendicular`,
                    subtitle: `(Adaptativamente)`,
                    assetIds: [detail.isoluxAssetId],
                    notes: [],
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            seeds.push({
                id: `page-ambient-results-${detail.ambientId}`,
                kind: 'ambient-results',
                sectionId: `ambient-results:${detail.ambientId}`,
                title: `Resultados`,
                subtitle: `${detail.ambientName}`,
                assetIds: [],
                notes: [],
                ambientId: detail.ambientId,
                roomId: room.id,
            });

            if (detail.luminaires.length > 0) {
                seeds.push({
                    id: `page-ambient-luminaires-${detail.ambientId}`,
                    kind: 'ambient-luminaires',
                    sectionId: `ambient-luminaires:${detail.ambientId}`,
                    title: `Lista de luminarias`,
                    subtitle: `${detail.ambientName}`,
                    assetIds: [],
                    notes: [],
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            if (detail.planAssetId) {
                const productAssetIds = detail.luminaires.flatMap((luminaire) =>
                    [
                        luminaire.productPhotoAssetId,
                        luminaire.brandLogoAssetId,
                        luminaire.lineDrawingAssetId,
                        luminaire.polarDiagramAssetId,
                    ].filter((assetId): assetId is string => Boolean(assetId)),
                );

                seeds.push({
                    id: `page-ambient-plan-${detail.ambientId}`,
                    kind: 'ambient-plan',
                    sectionId: `ambient-plan:${detail.ambientId}`,
                    title: `Plano de situación de luminarias`,
                    subtitle: `${detail.ambientName}`,
                    assetIds: [detail.planAssetId, ...productAssetIds],
                    notes: [],
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            if (detail.luminaires.length > 0) {
                const productAssetIds = detail.luminaires.flatMap((luminaire) =>
                    [
                        luminaire.productPhotoAssetId,
                        luminaire.brandLogoAssetId,
                        luminaire.lineDrawingAssetId,
                        luminaire.polarDiagramAssetId,
                    ].filter((assetId): assetId is string => Boolean(assetId)),
                );

                seeds.push({
                    id: `page-ambient-products-${detail.ambientId}`,
                    kind: 'ambient-products',
                    sectionId: `ambient-products:${detail.ambientId}`,
                    title: `Productos usados`,
                    subtitle: `${detail.ambientName}`,
                    assetIds: productAssetIds,
                    notes: [],
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            seeds.push({
                id: `page-ambient-calculation-object-${detail.ambientId}`,
                kind: 'ambient-calculation-object',
                sectionId: `ambient-calculation-object:${detail.ambientId}`,
                title: `Objetos de cálculo / Escena de luz 1`,
                subtitle: `${detail.ambientName}`,
                assetIds: [],
                notes: [],
                ambientId: detail.ambientId,
                roomId: room.id,
            });

            if (false && detail.isoluxAssetId) {
                seeds.push({
                    id: `page-ambient-useful-plane-${detail.ambientId}`,
                    kind: 'ambient-useful-plane',
                    sectionId: `ambient-useful-plane:${detail.ambientId}`,
                    title: `Plano útil (${detail.ambientName}) / Escena de luz 1 / Iluminancia perpendicular`,
                    subtitle: `(Adaptativamente)`,
                    assetIds: [detail.isoluxAssetId],
                    notes: [],
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }
        });
    });

    // Glosario
    seeds.push({
        id: 'page-glossary',
        kind: 'glossary',
        sectionId: 'glossary',
        title: 'Glosario',
        subtitle: null,
        assetIds: [],
        notes: []
    });

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
    let currentRoomId: string | null = null;
    let currentAmbientId: string | null = null;
    let productSheetHeaderAdded = false;

    technicalPageSeeds.forEach((seed, index) => {
        // Special TOC Group: Fichas de producto
        if (seed.kind === 'product-sheet' && !productSheetHeaderAdded) {
            entries.push({
                sectionId: 'product-sheets-header',
                title: 'Fichas de producto',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large'
            });
            productSheetHeaderAdded = true;
        }

        // Special TOC Group: Terreno
        if (seed.kind === 'terrain-cad') {
            entries.push({
                sectionId: 'terrain-header',
                title: 'Terreno 1',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-label',
                size: 'small'
            });
            entries.push({
                sectionId: 'edification-header',
                title: 'Edificación 1',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large'
            });
            // We skip rendering 'terrain-cad' in TOC since the user's TOC just shows "Lista de luminarias" under "Edificación 1"
            return;
        }

        // Room Transition Group
        if (seed.roomId && seed.roomId !== currentRoomId) {
            const room = snapshot.rooms.find(r => r.id === seed.roomId);
            currentRoomId = seed.roomId;
            if (room) {
                entries.push({
                    sectionId: `room-group-label-${room.id}`,
                    title: 'Terreno 1 - Edificación 1',
                    subtitle: null,
                    level: 0,
                    pageNumber: 0,
                    kind: 'section-label',
                    size: 'small'
                });
                entries.push({
                    sectionId: `room-group-heading-${room.id}`,
                    title: room.name,
                    subtitle: null,
                    level: 0,
                    pageNumber: 0,
                    kind: 'section-heading',
                    size: 'large'
                });
            }
        }

        // Ambient Transition Group
        if (seed.ambientId && seed.ambientId !== currentAmbientId && currentRoomId) {
            const room = snapshot.rooms.find(r => r.id === currentRoomId);
            currentAmbientId = seed.ambientId;
            if (room) {
                entries.push({
                    sectionId: `ambient-group-label-${seed.ambientId}`,
                    title: `Terreno 1 - Edificación 1 - ${room.name}`,
                    subtitle: null,
                    level: 0,
                    pageNumber: 0,
                    kind: 'section-label',
                    size: 'small'
                });
                entries.push({
                    sectionId: `ambient-group-heading-${seed.ambientId}`,
                    title: seed.subtitle ?? 'Sin nombre',
                    subtitle: null,
                    level: 0,
                    pageNumber: 0,
                    kind: 'section-heading',
                    size: 'large'
                });
            }
        }

        let level = 0;
        let title = seed.title;

        if (seed.kind === 'product-sheet') {
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
            kind: 'item'
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
            snapshot
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
    const ambientDetails = buildAmbientDetails(snapshot, assets);
    const fixedPageSeeds = buildFixedPageSeeds(snapshot, luminaires, assets);
    const technicalPageSeeds = buildTechnicalPageSeeds(snapshot, luminaires, ambientDetails, assets);
    const fixedPageCount = fixedPageSeeds.length;
    const toc = generateFormalTocFromSeeds(
        fixedPageCount,
        fixedPageSeeds,
        technicalPageSeeds,
        snapshot
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
        });
    });

    return {
        formatVersion: '1.0.0',
        title: `${snapshot.project.name} · Reporte DIAlux`,
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
            left: 'DIAlux Web',
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
                value: snapshot.summary.ambientCount > 0
                    && snapshot.summary.compliantAmbientCount >= snapshot.summary.ambientCount
                    ? 'Conforme'
                    : 'Revisar',
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
        ambientDetails,
        assets,
    };
}

export function generateDialuxToc(
    document: DialuxFormalDocument,
): DialuxTocEntry[] {
    return document.toc;
}
