import axios from 'axios';
import * as ggRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceGgController';
import * as scenarioRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceScenarioController';
import type { GgGrupo, GgResponse } from './types';

async function send<T>(def: { url: string; method: string }, data?: unknown): Promise<T> {
    const response = await axios.request<T>({ url: def.url, method: def.method, data });
    return response.data;
}

type Decimal = string | null;

export const ggApi = {
    seedPlantilla: (projectId: number, documentId: string) =>
        send<GgResponse>(ggRoutes.seedPlantilla.post([projectId, documentId])),

    addLinea: (
        projectId: number,
        documentId: string,
        data: { grupo: GgGrupo; rubro: string; descripcion: string; unidad?: string | null; cantidad?: Decimal; costo_unitario?: Decimal; gasto_proyectado?: Decimal },
    ) => send<GgResponse>(ggRoutes.storeLinea.post([projectId, documentId]), data),

    updateLinea: (
        projectId: number,
        documentId: string,
        lineaId: string,
        data: Partial<Record<'rubro' | 'descripcion' | 'unidad' | 'cantidad' | 'costo_unitario' | 'gasto_proyectado', Decimal>>,
    ) => send<GgResponse>(ggRoutes.updateLinea.patch([projectId, documentId, lineaId]), data),

    deleteLinea: (projectId: number, documentId: string, lineaId: string) =>
        send<GgResponse>(ggRoutes.destroyLinea.delete([projectId, documentId, lineaId])),

    renameRubro: (projectId: number, documentId: string, grupo: GgGrupo, rubro: string, nuevoRubro: string) =>
        send<GgResponse>(ggRoutes.renameRubro.patch([projectId, documentId]), { grupo, rubro, nuevo_rubro: nuevoRubro }),

    deleteRubro: (projectId: number, documentId: string, grupo: GgGrupo, rubro: string) =>
        send<GgResponse>(ggRoutes.destroyRubro.delete([projectId, documentId]), { grupo, rubro }),

    addPago: (projectId: number, documentId: string, fecha: string | null, etiqueta: string | null) =>
        send<GgResponse>(ggRoutes.storePago.post([projectId, documentId]), { fecha, etiqueta }),

    updatePago: (projectId: number, documentId: string, pagoId: string, data: { fecha?: string | null; etiqueta?: string | null }) =>
        send<GgResponse>(ggRoutes.updatePago.patch([projectId, documentId, pagoId]), data),

    deletePago: (projectId: number, documentId: string, pagoId: string) =>
        send<GgResponse>(ggRoutes.destroyPago.delete([projectId, documentId, pagoId])),

    setPagoValor: (projectId: number, documentId: string, pagoId: string, lineaId: string, monto: Decimal) =>
        send<GgResponse>(ggRoutes.setPagoValor.put([projectId, documentId, pagoId, lineaId]), { monto }),

    activateScenario: (projectId: number, documentId: string, scenarioId: string) =>
        send<GgResponse>(scenarioRoutes.activate.patch([projectId, documentId, scenarioId])),

    addScenario: (projectId: number, documentId: string, nombre: string, duplicarDe?: string) =>
        send<{ scenario: { id: string; nombre: string } }>(scenarioRoutes.store.post([projectId, documentId]), {
            tipo_hoja: 'gg',
            nombre,
            duplicar_de: duplicarDe ?? null,
        }),
};
