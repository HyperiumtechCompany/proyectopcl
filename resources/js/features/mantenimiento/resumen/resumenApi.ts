import axios from 'axios';
import * as resumenRoutes from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceResumenController';
import type { ResumenParametros, ResumenResponse } from './types';

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

async function send<T>(def: { url: string; method: string }, data?: unknown): Promise<T> {
    const response = await axios.request<T>({ url: def.url, method: def.method, data });
    return response.data;
}

export const resumenApi = {
    updateParametros: (projectId: number, documentId: string, data: DeepPartial<ResumenParametros>) =>
        send<ResumenResponse>(resumenRoutes.updateParametros.patch([projectId, documentId]), data),
};
