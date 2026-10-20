import axios from 'axios';
import * as routes from '@/actions/App/Http/Controllers/GastFin/GastFinController';
import type { ResumenParametros } from '../mantenimiento/resumen/types';
import type {
    Franja,
    GastFinResumenResponse,
    GastFinShowResponse,
    GrupoTipo,
    GrupoUpdateResponse,
    MatDeltaResponse,
    MatResponse,
    MoResponse,
} from './types';

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
type Decimal = string | null;

async function send<T>(def: { url: string; method: string }, data?: unknown): Promise<T> {
    const response = await axios.request<T>({ url: def.url, method: def.method, data });
    return response.data;
}

/** Mensaje legible: validación/negocio del backend, o el código HTTP / error de JS si no hay mensaje. */
export function errorMessage(error: unknown, fallback = 'No se pudo guardar el cambio.'): string {
    const response = (error as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } }).response;
    const data = response?.data;
    const message = Object.values(data?.errors ?? {})[0]?.[0] ?? data?.message;
    if (message) return message;
    const detail = response?.status ? `HTTP ${response.status}` : error instanceof Error ? error.message : '';
    return detail ? `${fallback} (${detail})` : fallback;
}

export const gastFinApi = {
    show: (projectId: number) => send<GastFinShowResponse>(routes.show.get(projectId)),

    updateGrupo: (projectId: number, grupoRef: string, data: { tipo?: GrupoTipo | null; mo_aprobado?: Decimal; mat_aprobado?: Decimal }) =>
        send<GrupoUpdateResponse>(routes.updateGrupo.patch([projectId, grupoRef]), data),

    resumen: (projectId: number) => send<GastFinResumenResponse>(routes.resumen.get(projectId)),

    updateParametros: (projectId: number, data: DeepPartial<ResumenParametros>) =>
        send<GastFinResumenResponse>(routes.updateParametros.patch(projectId), data),

    mo: (projectId: number) => send<MoResponse>(routes.mo.get(projectId)),

    addMoPago: (projectId: number, data: { nombre: string; fecha?: string | null }) => send<MoResponse>(routes.storeMoPago.post(projectId), data),

    updateMoPago: (projectId: number, pagoId: string, data: { nombre?: string; fecha?: string | null }) =>
        send<MoResponse>(routes.updateMoPago.patch([projectId, pagoId]), data),

    deleteMoPago: (projectId: number, pagoId: string) => send<MoResponse>(routes.destroyMoPago.delete([projectId, pagoId])),

    setMoValor: (projectId: number, pagoId: string, grupoRef: string, franja: Franja, data: { etiqueta?: string | null; monto?: Decimal }) =>
        send<MoResponse>(routes.setMoValor.put([projectId, pagoId, grupoRef, franja]), data),

    mat: (projectId: number, grupoRef: string) => send<MatResponse>(routes.mat.get([projectId, grupoRef])),

    setCotizacion: (projectId: number, grupoRef: string, insumoKey: string, data: { cantidad?: Decimal; precio?: Decimal }) =>
        send<MatDeltaResponse>(routes.setMatCotizacion.put([projectId, grupoRef]), { insumo_key: insumoKey, ...data }),

    addCompra: (projectId: number, grupoRef: string, fecha: string | null) => send<MatResponse>(routes.storeMatCompra.post([projectId, grupoRef]), { fecha }),

    updateCompra: (projectId: number, compraId: string, fecha: string | null) => send<MatResponse>(routes.updateMatCompra.patch([projectId, compraId]), { fecha }),

    deleteCompra: (projectId: number, compraId: string) => send<MatResponse>(routes.destroyMatCompra.delete([projectId, compraId])),

    setCompraValor: (projectId: number, compraId: string, insumoKey: string, data: { cantidad?: Decimal; precio?: Decimal; proveedor?: string | null }) =>
        send<MatDeltaResponse>(routes.setMatCompraValor.put([projectId, compraId]), { insumo_key: insumoKey, ...data }),

    addInsumo: (projectId: number, grupoRef: string, data: { descripcion: string; unidad?: string | null }) =>
        send<MatResponse>(routes.storeMatInsumo.post([projectId, grupoRef]), data),

    updateInsumo: (projectId: number, insumoId: string, data: { descripcion?: string; unidad?: string | null }) =>
        send<MatResponse>(routes.updateMatInsumo.patch([projectId, insumoId]), data),

    deleteInsumo: (projectId: number, insumoId: string) => send<MatResponse>(routes.destroyMatInsumo.delete([projectId, insumoId])),
};
