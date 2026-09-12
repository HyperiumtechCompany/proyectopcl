import axios from 'axios';
import * as matRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceMatController';
import * as scenarioRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceScenarioController';
import type { MatResponse } from './types';

async function send<T>(def: { url: string; method: string }, data?: unknown): Promise<T> {
    const response = await axios.request<T>({ url: def.url, method: def.method, data });
    return response.data;
}

type Decimal = string | null;

export const matApi = {
    refresh: (projectId: number, documentId: string) => send<MatResponse>(matRoutes.show.get([projectId, documentId])),

    updateMaterial: (
        projectId: number,
        documentId: string,
        materialId: string,
        data: Partial<Record<'descripcion' | 'unidad' | 'cantidad' | 'precio_unitario', Decimal>>,
    ) => send<MatResponse>(matRoutes.updateMaterial.patch([projectId, documentId, materialId]), data),

    addMaterial: (
        projectId: number,
        documentId: string,
        data: { partida_id: string; descripcion: string; unidad?: string | null; cantidad?: Decimal; precio_unitario?: Decimal },
    ) => send<MatResponse>(matRoutes.storeMaterial.post([projectId, documentId]), data),

    deleteMaterial: (projectId: number, documentId: string, materialId: string) =>
        send<MatResponse>(matRoutes.destroyMaterial.delete([projectId, documentId, materialId])),

    setCotizacion: (
        projectId: number,
        documentId: string,
        materialId: string,
        slot: number,
        data: Partial<Record<'proveedor' | 'cantidad' | 'precio', Decimal>>,
    ) => send<MatResponse>(matRoutes.setCotizacion.put([projectId, documentId, materialId, slot]), data),

    addCompra: (projectId: number, documentId: string, fecha: string | null, etiqueta: string | null) =>
        send<MatResponse>(matRoutes.storeCompra.post([projectId, documentId]), { fecha, etiqueta }),

    updateCompra: (projectId: number, documentId: string, compraId: string, data: { fecha?: string | null; etiqueta?: string | null }) =>
        send<MatResponse>(matRoutes.updateCompra.patch([projectId, documentId, compraId]), data),

    deleteCompra: (projectId: number, documentId: string, compraId: string) =>
        send<MatResponse>(matRoutes.destroyCompra.delete([projectId, documentId, compraId])),

    setCompraValor: (
        projectId: number,
        documentId: string,
        compraId: string,
        materialId: string,
        data: Partial<Record<'cantidad' | 'precio', Decimal>>,
    ) => send<MatResponse>(matRoutes.setCompraValor.put([projectId, documentId, compraId, materialId]), data),

    activateScenario: (projectId: number, documentId: string, scenarioId: string) =>
        send<MatResponse>(scenarioRoutes.activate.patch([projectId, documentId, scenarioId])),

    addScenario: (projectId: number, documentId: string, nombre: string, duplicarDe?: string) =>
        send<{ scenario: { id: string; nombre: string } }>(scenarioRoutes.store.post([projectId, documentId]), {
            tipo_hoja: 'mat',
            nombre,
            duplicar_de: duplicarDe ?? null,
        }),
};
