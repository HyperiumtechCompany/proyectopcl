import { useCallback, useRef, useState } from 'react';
import { uploadDialuxPlanFile } from '@/pages/dialux/hooks/dialuxPlanStorage';
import { detectScaleFromExtents } from '@/pages/dialux/hooks/storeHelpers';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';
import { SITE_PLAN_SCENE_ID } from '../lib/planImport';

export interface SitePlanImportResult {
    originalName: string;
    /** Tamaño estimado en metros reales (heurística por extents, igual que el editor de interiores — el usuario puede recalibrar). */
    widthUnits: number;
    heightUnits: number;
}

interface ImportState {
    status: 'idle' | 'processing' | 'error';
    error: string | null;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reusa el motor CAD ya existente (`useMlightcadEngine`, el mismo que el
 * editor de interiores) para convertir un DXF/DWG en una imagen PNG estática
 * — el emplazamiento no necesita geometría CAD editable, solo un fondo para
 * calcar. El motor se monta, abre el archivo, se captura el `<canvas>`
 * nativo como PNG y se sube al MISMO backend de planos del editor de
 * interiores (`dialux_plans`, vía `uploadDialuxPlanFile`), con un
 * `sceneId` reservado (`SITE_PLAN_SCENE_ID`) — sin backend nuevo.
 */
export function useSitePlanImport(projectId: number, generalModuleId: number) {
    const engine = useMlightcadEngine();
    const containerRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<ImportState>({
        status: 'idle',
        error: null,
    });

    const importFile = useCallback(
        async (file: File): Promise<SitePlanImportResult | null> => {
            if (!containerRef.current) {
                setState({
                    status: 'error',
                    error: 'El visor CAD todavía no está listo. Intenta de nuevo.',
                });
                return null;
            }
            setState({ status: 'processing', error: null });
            try {
                await engine.initViewer(containerRef.current);
                // El motor necesita un instante tras initViewer antes de que
                // sus comandos respondan de forma confiable — mismo margen
                // que usa MlightcadCanvas2D.tsx tras su propio initViewer.
                await wait(100);

                const opened = await engine.openFile(file);
                if (!opened) {
                    throw new Error(
                        'No se pudo abrir el archivo. Verifica que sea un DXF o DWG válido.',
                    );
                }

                engine.setViewOrigin();
                engine.fitToView();
                await wait(150);

                const extents = engine.getDocumentExtents();
                if (!extents) {
                    throw new Error('No se pudo leer el tamaño del plano.');
                }

                const canvas =
                    containerRef.current.querySelector('canvas');
                if (!canvas) {
                    throw new Error(
                        'No se pudo capturar la imagen del plano.',
                    );
                }

                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(resolve, 'image/png'),
                );
                if (!blob) {
                    throw new Error(
                        'No se pudo generar la imagen del plano.',
                    );
                }

                // Misma heurística de respaldo que el editor de interiores
                // usa cuando el DXF no declara $INSUNITS: infiere mm/cm/m
                // por el tamaño de los extents. El usuario puede corregir
                // con la calibración manual si el resultado no coincide.
                const scale = detectScaleFromExtents({
                    min_x: extents.minX,
                    min_y: extents.minY,
                    max_x: extents.maxX,
                    max_y: extents.maxY,
                });
                const widthUnits =
                    (extents.maxX - extents.minX) * scale.factor;
                const heightUnits =
                    (extents.maxY - extents.minY) * scale.factor;

                const baseName = file.name.replace(/\.(dxf|dwg)$/i, '');
                const pngFile = new File([blob], `${baseName}.png`, {
                    type: 'image/png',
                });
                await uploadDialuxPlanFile(
                    String(projectId),
                    SITE_PLAN_SCENE_ID,
                    pngFile,
                    String(generalModuleId),
                );

                setState({ status: 'idle', error: null });
                return {
                    originalName: file.name,
                    widthUnits: Math.max(1, widthUnits),
                    heightUnits: Math.max(1, heightUnits),
                };
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo importar el plano.';
                setState({ status: 'error', error: message });
                return null;
            } finally {
                engine.dispose();
            }
        },
        [engine, projectId, generalModuleId],
    );

    return {
        containerRef,
        importFile,
        status: state.status,
        error: state.error,
        loadProgress: engine.loadProgress,
    };
}
