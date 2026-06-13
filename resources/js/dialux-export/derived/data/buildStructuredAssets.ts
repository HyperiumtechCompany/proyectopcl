import type { DialuxExportSnapshot, DialuxStructuredSummaryData, DialuxStructuredTableData, DialuxStructuredJsonData } from '../../domain/types';

export function buildAmbientTable(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredTableData {
    return {
        type: 'table',
        columns: [
            { key: 'roomName', label: 'Recinto' },
            { key: 'ambientName', label: 'Ambiente' },
            { key: 'activity', label: 'Actividad' },
            { key: 'area', label: 'Area (m2)' },
            { key: 'fixtureCount', label: 'Luminarias' },
            { key: 'coverage', label: 'Cobertura' },
        ],
        rows: snapshot.ambients.map((ambient) => ({
            roomName: ambient.roomName,
            ambientName: ambient.name,
            activity: ambient.activity ?? '-',
            area: Number(ambient.metrics.area.toFixed(2)),
            fixtureCount: ambient.metrics.fixtureCount,
            coverage: ambient.metrics.coverage,
        })),
    };
}

export function buildLightingResultsTable(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredTableData {
    return {
        type: 'table',
        columns: [
            { key: 'ambientName', label: 'Ambiente' },
            { key: 'targetLux', label: 'Lux objetivo' },
            { key: 'avgLux', label: 'E avg' },
            { key: 'minLux', label: 'E min' },
            { key: 'maxLux', label: 'E max' },
            { key: 'uniformity', label: 'Uo' },
            { key: 'g2', label: 'g2' },
            { key: 'usefulPlaneHeight', label: 'Altura plano' },
            { key: 'marginalZone', label: 'Zona marginal' },
            { key: 'ugr', label: 'UGR' },
            { key: 'status', label: 'Cumple' },
        ],
        rows: snapshot.ambients.map((ambient) => ({
            ambientName: ambient.name,
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
            usefulPlaneHeight: Number(
                ambient.metrics.usefulPlaneHeight.toFixed(3),
            ),
            marginalZone: Number(ambient.metrics.marginalZone.toFixed(3)),
            ugr:
                ambient.metrics.ugr === null
                    ? null
                    : Number(ambient.metrics.ugr.toFixed(2)),
            status: ambient.metrics.complies ? 'Si' : 'No',
        })),
    };
}

export function buildLuminaireProductTable(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredTableData {
    const grouped = new Map<
        string,
        {
            quantity: number;
            manufacturer: string;
            articleNumber: string;
            name: string;
            sourceFormat: string;
            powerWatts: number | null;
            lumens: number | null;
            efficiency: number | null;
        }
    >();

    for (const fixture of snapshot.fixtures) {
        const powerWatts =
            'power' in fixture && typeof fixture.power === 'number'
                ? fixture.power
                : null;
        const lumens = fixture.lumens ?? null;
        const key = [
            fixture.productId ?? 'sin-producto',
            fixture.brand ?? 'sin-fabricante',
            fixture.articleNumber ?? 'sin-articulo',
            fixture.name,
            lumens ?? 'sin-lumen',
            powerWatts ?? 'sin-potencia',
        ].join('::');
        const current = grouped.get(key);

        if (current) {
            current.quantity += 1;
            continue;
        }

        grouped.set(key, {
            quantity: 1,
            manufacturer: fixture.brand ?? 'Importado',
            articleNumber: fixture.articleNumber ?? '-',
            name: fixture.name,
            sourceFormat: fixture.productSourceFormat?.toUpperCase() ?? '-',
            powerWatts,
            lumens,
            efficiency:
                lumens !== null && powerWatts !== null && powerWatts > 0
                    ? Number((lumens / powerWatts).toFixed(1))
                    : null,
        });
    }

    return {
        type: 'table',
        columns: [
            { key: 'quantity', label: 'Cantidad' },
            { key: 'manufacturer', label: 'Fabricante' },
            { key: 'articleNumber', label: 'Codigo' },
            { key: 'name', label: 'Producto' },
            { key: 'sourceFormat', label: 'Formato' },
            { key: 'powerWatts', label: 'P (W)' },
            { key: 'lumens', label: 'Flujo (lm)' },
            { key: 'efficiency', label: 'lm/W' },
        ],
        rows: [...grouped.values()].map((item) => ({ ...item })),
    };
}

export function buildProjectSummary(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredSummaryData {
    return {
        type: 'summary',
        items: [
            { label: 'Proyecto', value: snapshot.project.name },
            { label: 'Escena', value: snapshot.scene.name },
            { label: 'Escala', value: snapshot.scaleConfig.displayUnit },
            {
                label: 'Ambientes calculados',
                value: `${snapshot.summary.calculatedAmbientCount}/${snapshot.summary.ambientCount}`,
            },
            {
                label: 'Ambientes conformes',
                value: `${snapshot.summary.compliantAmbientCount}/${snapshot.summary.ambientCount}`,
            },
            {
                label: 'Lux promedio',
                value: snapshot.summary.averageLux.toFixed(1),
            },
            {
                label: 'Uniformidad promedio',
                value: `${(snapshot.summary.averageUniformity * 100).toFixed(1)}%`,
            },
        ],
    };
}

export function buildTechnicalAppendix(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredJsonData {
    return {
        type: 'json',
        data: {
            formatVersion: snapshot.formatVersion,
            exportedAt: snapshot.exportedAt,
            sceneId: snapshot.scene.id,
            scaleConfig: snapshot.scaleConfig,
            visualConfig: snapshot.visualConfig,
            dxfExtents: snapshot.dxfExtents,
            ambientCount: snapshot.ambients.length,
            rooms: snapshot.rooms.map((room) => ({
                id: room.id,
                name: room.name,
                vertices: room.vertices,
            })),
            ambients: snapshot.ambients.map((ambient) => ({
                id: ambient.id,
                roomId: ambient.roomId,
                name: ambient.name,
                activity: ambient.activity,
                metrics: ambient.metrics,
                lightingResult: ambient.result,
            })),
        },
    };
}
