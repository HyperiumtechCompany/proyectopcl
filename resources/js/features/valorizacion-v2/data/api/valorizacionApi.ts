import axios from 'axios';
import * as rutas from '@/actions/App/Http/Controllers/ValorizacionV2/ValorizacionV2Controller';
import type { ValorizacionInput } from '../../types';

export interface CorteResumen {
    numero: number;
    mes: string;
    estado: string;
    resumen: { valorizado: string; liquido: string; avanceAcumulado: string };
    aprobado_at: string | null;
}

export interface DocumentoGuardado {
    public_id: string;
    nombre: string;
    revision: number;
    schema_version: number;
    datos: unknown;
    updated_at: string | null;
}

/** La versión del servidor cambió desde la última vez que se cargó (409). */
export class ConflictoGuardado extends Error {
    constructor(
        public readonly revision: number,
        public readonly datos: unknown,
        public readonly updatedAt: string | null,
    ) {
        super('La valorización fue guardada desde otra pestaña o equipo.');
    }
}

const mensajeError = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string } | undefined;

        return data?.message ?? `Error ${error.response?.status ?? 'de red'} al comunicarse con el servidor.`;
    }

    return error instanceof Error ? error.message : String(error);
};

export const valorizacionApi = {
    async guardar(projectId: number, documentoId: string, payload: { revision: number; schema_version: number; datos: ValorizacionInput }): Promise<{ revision: number; updated_at: string | null }> {
        const ruta = rutas.guardar([projectId, documentoId]);
        try {
            const { data } = await axios.request<{ revision: number; updated_at: string | null }>({ url: ruta.url, method: ruta.method, data: payload });

            return data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 409) {
                const body = error.response.data as { revision: number; datos: unknown; updated_at: string | null };
                throw new ConflictoGuardado(body.revision, body.datos, body.updated_at);
            }
            throw new Error(mensajeError(error));
        }
    },

    async aprobar(projectId: number, documentoId: string, payload: { revision: number; numero: number; mes: string; resumen: CorteResumen['resumen'] }): Promise<CorteResumen> {
        const ruta = rutas.aprobar([projectId, documentoId]);
        try {
            const { data } = await axios.request<{ corte: CorteResumen }>({ url: ruta.url, method: ruta.method, data: payload });

            return data.corte;
        } catch (error) {
            throw new Error(mensajeError(error));
        }
    },

    async reabrir(projectId: number, documentoId: string, numero: number): Promise<void> {
        const ruta = rutas.reabrir([projectId, documentoId, numero]);
        try {
            await axios.request({ url: ruta.url, method: ruta.method });
        } catch (error) {
            throw new Error(mensajeError(error));
        }
    },
};
