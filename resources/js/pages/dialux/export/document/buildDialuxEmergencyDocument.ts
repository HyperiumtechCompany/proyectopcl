import { evaluateEmergencyCompliance } from '@/pages/dialux/domain/calculation/emergencyCompliance';
import { findResultExtremum } from '@/pages/dialux/domain/calculation/findResultExtremum';
import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import type { LightingResult, Project } from '@/pages/dialux/hooks/useEditorStore';
import {
    DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
    type DialuxDocumentPage,
    type DialuxEmergencyRoomReport,
    type DialuxFormalDocument,
} from '../domain/types';
import { toFileBaseName } from './buildDialuxFormalDocument';

/**
 * Informe de alumbrado de EMERGENCIA (Fase 14 del plan maestro, §11:
 * "Emergencia" — puerta de salida: "los resultados de emergencia nunca se
 * confunden con iluminación normal"). Documento DELIBERADAMENTE separado
 * del informe formal normal (`buildDialuxFormalDocument.ts`): reutiliza el
 * mismo TIPO `DialuxFormalDocument` (para reusar el backend/Blade
 * existente), pero SOLO contiene páginas de emergencia — portada distinta,
 * sin fichas de producto, sin catálogo de luminarias, sin planos normales.
 *
 * Solo incluye ambientes `roomType: 'evacuation-route'|'antipanic-area'` —
 * un proyecto sin ninguno produce un informe con la tabla vacía (nunca se
 * inventan ambientes ni se reusan los del informe normal).
 */
export interface DialuxEmergencyDocumentInput {
    project: Project;
    /**
     * Resultados calculados con `config.emergencyMode: true` (ver
     * `runDirectPreviewEngine.ts`/`runProjectLightingCalculation.ts`),
     * indexados por `objectId` (== `ambient.id`) — misma convención que
     * `resultsByRoom` en el resto del sistema.
     */
    emergencyResultsByRoom: Record<string, LightingResult>;
    exportedAt: string;
}

function buildEmergencyRoomReports(input: DialuxEmergencyDocumentInput): DialuxEmergencyRoomReport[] {
    const reports: DialuxEmergencyRoomReport[] = [];

    for (const scene of input.project.scenes) {
        const ambients = deriveSceneAmbientSpaces(scene);

        for (const ambient of ambients) {
            const roomType = ambient.room.roomType;
            if (roomType !== 'evacuation-route' && roomType !== 'antipanic-area') {
                continue;
            }

            const result = input.emergencyResultsByRoom[ambient.id] ?? null;
            const minLux = result?.min_lux ?? null;
            const critical = result ? findResultExtremum(result, 'min') : null;

            reports.push({
                roomId: ambient.roomId,
                roomName: ambient.roomName,
                roomType,
                levelId: scene.id,
                levelName: scene.name,
                minLux,
                criticalPoint: critical ? { x: critical.x, y: critical.y } : null,
                evaluations: evaluateEmergencyCompliance(roomType, minLux),
            });
        }
    }

    return reports;
}

export function buildDialuxEmergencyDocument(input: DialuxEmergencyDocumentInput): DialuxFormalDocument {
    const emergencyRooms = buildEmergencyRoomReports(input);
    const projectName = input.project.name || 'dialux';

    const pages: DialuxDocumentPage[] = [
        {
            id: 'page-emergency-cover',
            kind: 'emergency-cover',
            sectionId: 'emergency-cover',
            pageNumber: 1,
            title: 'INFORME DE ALUMBRADO DE EMERGENCIA',
            subtitle: projectName,
            assetIds: [],
            notes: [
                emergencyRooms.length === 0
                    ? 'Este proyecto no tiene ambientes marcados como ruta de evacuación o área antipánico — no hay nada que evaluar todavía.'
                    : `Se evaluaron ${emergencyRooms.length} ambiente(s) de emergencia contra RNE A.130 (obligatoria en Perú) y, como referencia complementaria, EN 1838 — nunca fusionadas en un solo valor.`,
            ],
        },
        {
            id: 'page-emergency-compliance-table',
            kind: 'emergency-compliance-table',
            sectionId: 'emergency-compliance-table',
            pageNumber: 2,
            title: 'Cumplimiento normativo — alumbrado de emergencia',
            subtitle: 'RNE A.130 (obligatoria) y EN 1838 (referencia), evaluadas por separado',
            assetIds: [],
            notes: [],
            emergencyRooms,
        },
    ];

    return {
        formatVersion: '1.0.0',
        schemaVersion: DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
        title: `${projectName} · Informe de Alumbrado de Emergencia`,
        subtitle: 'RNE A.130 / EN 1838',
        fileBaseName: `${toFileBaseName(projectName)}-informe-emergencia`,
        generatedAt: input.exportedAt,
        paper: { format: 'A4', orientation: 'portrait' },
        header: { title: `${projectName} — ALUMBRADO DE EMERGENCIA`, subtitle: 'RNE A.130 / EN 1838' },
        footer: { left: 'PCL — Informe de emergencia', right: input.exportedAt.slice(0, 10) },
        metadata: [
            { label: 'Proyecto', value: projectName },
            { label: 'Tipo de informe', value: 'Alumbrado de emergencia' },
            { label: 'Exportado', value: input.exportedAt },
            { label: 'Ambientes evaluados', value: `${emergencyRooms.length}` },
        ],
        pages,
        toc: pages.map((page) => ({
            sectionId: page.sectionId,
            title: page.title,
            subtitle: page.subtitle,
            level: 0,
            pageNumber: page.pageNumber,
        })),
        luminaires: [],
        luminaireTotals: { totalLumens: 0, totalPowerWatts: 0, overallEfficiency: 0 },
        levels: [],
        ambientDetails: [],
        assets: [],
        glossary: [],
    };
}
