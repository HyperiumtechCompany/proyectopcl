import { useCallback, useState } from 'react';
import {
    cadOpenHardMax,
    deleteDialuxPlanFile,
    saveDialuxPlanFile,
    unlinkDialuxPlanFile,
    uploadDialuxPlanFile,
} from '@/pages/dialux/hooks/dialuxPlanStorage';
import { SITE_PLAN_SCENE_ID, SITE_PLAN_SOURCE_SCENE_ID } from '../lib/planImport';

export interface SitePlanImportResult {
    originalName: string;
    /** 'cad' = DXF/DWG (vectorial); 'image' = PNG/JPG de fondo (planos CAD muy pesados). */
    kind: 'cad' | 'image';
    /** Tamaño natural de la imagen (px) — su tamaño inicial en el plano antes de calibrar. */
    widthPx?: number;
    heightPx?: number;
}

interface ImportState {
    status: 'idle' | 'processing' | 'error';
    error: string | null;
}

async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
    try {
        const bitmap = await createImageBitmap(file);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
    } catch {
        return null;
    }
}

/**
 * useSitePlanImport — guarda el plano del emplazamiento.
 *
 * DXF/DWG: NO monta el motor CAD (lo hace `useSiteCadPlan` en el canvas; el
 * motor es un singleton y no puede estar en dos lugares a la vez) ni
 * convierte a PNG: el canvas renderiza los vectores en vivo. Se guarda
 * PRIMERO en IndexedDB y después se INTENTA subir al servidor (puede fallar
 * con un DWG grande sin abortar nada: la copia local alcanza).
 *
 * PNG/JPG: para planos CAD demasiado pesados para abrirse en el navegador —
 * se sube como imagen de fondo (se ve al instante, se calibra igual) y se
 * retira el CAD anterior para que el canvas no intente abrirlo.
 */
export { cadOpenHardMax };

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
            const isCad = name.endsWith('.dxf') || name.endsWith('.dwg');
            const isImage = /\.(png|jpe?g)$/.test(name);
            if (!isCad && !isImage) {
                setState({
                    status: 'error',
                    error: 'El plano debe ser un archivo .dxf, .dwg o una imagen .png / .jpg.',
                });
                return null;
            }

            setState({ status: 'processing', error: null });

            if (isImage) {
                const size = await imageSize(file);
                if (!size) {
                    setState({ status: 'error', error: 'No se pudo leer la imagen del plano.' });
                    return null;
                }
                try {
                    await uploadDialuxPlanFile(
                        String(projectId),
                        SITE_PLAN_SCENE_ID,
                        file,
                        String(generalModuleId),
                    );
                } catch (uploadError) {
                    console.error('[site-plan] No se pudo subir la imagen del plano.', uploadError);
                    setState({ status: 'error', error: 'No se pudo subir la imagen del plano al servidor.' });
                    return null;
                }
                // El CAD anterior (si lo había) ya no manda: el canvas no debe abrirlo.
                try {
                    await deleteDialuxPlanFile(String(projectId), SITE_PLAN_SOURCE_SCENE_ID);
                    await unlinkDialuxPlanFile(String(projectId), SITE_PLAN_SOURCE_SCENE_ID, String(generalModuleId));
                } catch (cleanupError) {
                    console.warn('[site-plan] No se pudo retirar el CAD anterior.', cleanupError);
                }
                setState({ status: 'idle', error: null });
                return { originalName: file.name, kind: 'image', widthPx: size.width, heightPx: size.height };
            }

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
            return { originalName: file.name, kind: 'cad' };
        },
        [],
    );

    return {
        importFile,
        status: state.status,
        error: state.error,
    };
}
