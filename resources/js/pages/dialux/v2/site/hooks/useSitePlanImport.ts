import { useCallback, useState } from 'react';
import {
    saveDialuxPlanFile,
    uploadDialuxPlanFile,
} from '@/pages/dialux/hooks/dialuxPlanStorage';
import { SITE_PLAN_SOURCE_SCENE_ID } from '../lib/planImport';

export interface SitePlanImportResult {
    originalName: string;
}

interface ImportState {
    status: 'idle' | 'processing' | 'error';
    error: string | null;
}

/**
 * useSitePlanImport — guarda el DXF/DWG del emplazamiento.
 *
 * NO monta el motor CAD (lo hace `useSiteCadPlan` en el canvas; el motor es un
 * singleton y no puede estar en dos lugares a la vez sin autodestruirse a
 * mitad del parseo) ni convierte a PNG: el canvas renderiza los vectores en
 * vivo, que es lo que se necesita para dibujar y medir sobre el plano.
 *
 * El archivo se guarda PRIMERO en IndexedDB (local, inmediato, sin limite de
 * tamano) y despues se INTENTA subir al servidor como respaldo — puede fallar
 * con un DWG grande (el backend limita a 100 MB) sin abortar nada: la copia
 * local ya alcanza para trabajar en este navegador.
 */
export function useSitePlanImport() {
    const [state, setState] = useState<ImportState>({
        status: 'idle',
        error: null,
    });

    const importFile = useCallback(
        async (
            projectId: number,
            generalModuleId: number,
            file: File,
        ): Promise<SitePlanImportResult | null> => {
            const name = file.name.toLowerCase();
            if (!name.endsWith('.dxf') && !name.endsWith('.dwg')) {
                setState({
                    status: 'error',
                    error: 'El plano debe ser un archivo .dxf o .dwg.',
                });
                return null;
            }

            setState({ status: 'processing', error: null });
            try {
                await saveDialuxPlanFile(
                    String(projectId),
                    SITE_PLAN_SOURCE_SCENE_ID,
                    file,
                );
            } catch (localError) {
                setState({
                    status: 'error',
                    error: 'No se pudo guardar el plano en este navegador.',
                });
                console.error(
                    '[site-plan] saveDialuxPlanFile fallo.',
                    localError,
                );
                return null;
            }

            try {
                await uploadDialuxPlanFile(
                    String(projectId),
                    SITE_PLAN_SOURCE_SCENE_ID,
                    file,
                    String(generalModuleId),
                );
            } catch (uploadError) {
                console.warn(
                    '[site-plan] No se pudo subir el plano al servidor; queda la copia local de este navegador.',
                    uploadError,
                );
            }

            setState({ status: 'idle', error: null });
            return { originalName: file.name };
        },
        [],
    );

    return {
        importFile,
        status: state.status,
        error: state.error,
    };
}
