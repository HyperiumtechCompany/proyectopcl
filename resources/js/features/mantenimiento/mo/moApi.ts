import axios from 'axios';
import * as importRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceImportController';
import * as moRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceMoController';
import * as scenarioRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceScenarioController';
import type { MoResponse } from './types';

async function send<T>(def: { url: string; method: string }, data?: unknown): Promise<T> {
    const response = await axios.request<T>({ url: def.url, method: def.method, data });
    return response.data;
}

export interface ImportPreview {
    available: boolean;
    reason?: string;
    source_hash?: string;
    presupuesto?: { id: number | null; nombre: string | null; moneda: string };
    stats?: Record<string, number>;
    already_imported?: boolean;
}

export interface NewPartida {
    parent_id?: string | null;
    tipo: 'ie' | 'bloque' | 'partida';
    item?: string | null;
    descripcion: string;
    unidad?: string | null;
    metrado?: string | null;
    mo_pu?: string | null;
}

export const moApi = {
    importPreview: (projectId: number, documentId: string) =>
        send<ImportPreview>(importRoutes.preview.get([projectId, documentId])),

    addPartida: (projectId: number, documentId: string, data: NewPartida) =>
        send<MoResponse>(moRoutes.storePartida.post([projectId, documentId]), data),

    deletePartida: (projectId: number, documentId: string, partidaId: string) =>
        send<MoResponse>(moRoutes.destroyPartida.delete([projectId, documentId, partidaId])),

    runImport: (projectId: number, documentId: string, sourceHash: string) =>
        send<{ revision: number; summary: Record<string, number> }>(
            importRoutes.store.post([projectId, documentId]),
            { source_hash: sourceHash, idempotency_key: crypto.randomUUID() },
        ),

    updatePartida: (
        projectId: number,
        documentId: string,
        partidaId: string,
        data: Partial<Record<'descripcion' | 'item' | 'unidad' | 'metrado' | 'mo_pu' | 'cot_cantidad' | 'cot_precio' | 'presupuesto' | 'observacion', string | null>>,
    ) => send<MoResponse>(moRoutes.updatePartida.patch([projectId, documentId, partidaId]), data),

    addSeries: (projectId: number, documentId: string, fecha: string | null, etiqueta: string | null) =>
        send<MoResponse>(moRoutes.storeSeries.post([projectId, documentId]), { fecha, etiqueta }),

    updateSeries: (projectId: number, documentId: string, serieId: string, data: { fecha?: string | null; etiqueta?: string | null }) =>
        send<MoResponse>(moRoutes.updateSeries.patch([projectId, documentId, serieId]), data),

    deleteSeries: (projectId: number, documentId: string, serieId: string) =>
        send<MoResponse>(moRoutes.destroySeries.delete([projectId, documentId, serieId])),

    setParcial: (projectId: number, documentId: string, serieId: string, partidaId: string, monto: string | null) =>
        send<MoResponse>(moRoutes.setParcial.put([projectId, documentId, serieId, partidaId]), { monto }),

    addScenario: (projectId: number, documentId: string, nombre: string, duplicarDe?: string) =>
        send<{ scenario: { id: string; nombre: string } }>(scenarioRoutes.store.post([projectId, documentId]), {
            tipo_hoja: 'mo',
            nombre,
            duplicar_de: duplicarDe ?? null,
        }),

    activateScenario: (projectId: number, documentId: string, scenarioId: string) =>
        send<MoResponse>(scenarioRoutes.activate.patch([projectId, documentId, scenarioId])),
};
