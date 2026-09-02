import { useCallback, useRef, useState } from 'react';
import { uploadDialuxPlanFile } from '@/pages/dialux/hooks/dialuxPlanStorage';
import { detectScaleFromExtents } from '@/pages/dialux/hooks/storeHelpers';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';
import {
    SITE_PLAN_SCENE_ID,
    SITE_PLAN_SOURCE_SCENE_ID,
} from '../lib/planImport';

export interface SitePlanImportResult {
    originalName: string;
    /** Tamaño estimado en metros reales (heurística por extents, igual que el editor de interiores — el usuario puede recalibrar). */
    widthUnits: number;
    heightUnits: number;
    /** true si no se pudo leer el tamaño real del archivo y se usó un tamaño provisional — el llamador debe insistir en la calibración. */
    sizeIsGuess: boolean;
}

interface ImportState {
    status: 'idle' | 'processing' | 'error';
    error: string | null;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reintenta leer las extents del documento — algunos DWG (confirmado por el
 * usuario con un archivo real, "PLANTA GENERAL.dwg") tardan más que un DXF
 * en tener `header.extMin/extMax`/`getExtents()` disponibles tras
 * `openFile()`, o simplemente NUNCA los exponen (el editor de interiores ya
 * convive con esto: trata "sin extents" como caso normal, no error — ver
 * `Toolbar.tsx`, rama `else setDetectedScale(null)`). `null` tras agotar los
 * intentos NO es un fallo fatal aquí tampoco — el llamador cae a un tamaño
 * provisional y confía en la calibración manual.
 */
async function waitForExtents(
    engine: ReturnType<typeof useMlightcadEngine>,
    attempts = 6,
    intervalMs = 300,
): Promise<ReturnType<typeof engine.getDocumentExtents>> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const extents = engine.getDocumentExtents();
        if (extents) return extents;
        await wait(intervalMs);
    }
    return null;
}

/**
 * Muestrea el canvas a baja resolución (rápido) y avisa si tiene algún
 * píxel con brillo perceptible — el fondo del visor es negro puro, así que
 * cualquier trazo cuenta como "ya hay algo dibujado".
 */
function canvasHasVisibleContent(source: HTMLCanvasElement): boolean {
    const sampleSize = 48;
    const sample = document.createElement('canvas');
    sample.width = sampleSize;
    sample.height = sampleSize;
    const ctx = sample.getContext('2d');
    if (!ctx) return true; // no se puede verificar — no bloquear la importación por esto
    ctx.drawImage(source, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 20 || data[i + 1] > 20 || data[i + 2] > 20) return true;
    }
    return false;
}

/**
 * El parseo/render de un DWG grande puede tardar varios segundos en un
 * `message` handler del worker (confirmado real: 5.1s con un plano de
 * colegio de ~2700 m² de detalle) — un tiempo de espera fijo capturaba el
 * canvas todavía en negro. Se sondea el contenido real en vez de adivinar
 * cuánto esperar; si se agota el presupuesto igual se captura lo que haya
 * (mejor una imagen posiblemente incompleta que colgar la importación).
 */
async function waitForCanvasContent(
    canvas: HTMLCanvasElement,
    maxAttempts = 15,
    intervalMs = 400,
): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (canvasHasVisibleContent(canvas)) return true;
        await wait(intervalMs);
    }
    return canvasHasVisibleContent(canvas);
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
                // sus comandos respondan de forma confiable — el editor de
                // interiores nunca corre esto pegado a `openFile` (su
                // `initViewer` corre al montar el canvas, minutos antes de
                // que el usuario suba un archivo), así que aquí se le da
                // más margen a propósito.
                await wait(300);

                const opened = await engine.openFile(file);
                if (!opened) {
                    throw new Error(
                        'No se pudo abrir el archivo. Verifica que sea un DXF o DWG válido.',
                    );
                }

                const canvas =
                    containerRef.current.querySelector('canvas');
                if (!canvas) {
                    throw new Error(
                        'No se pudo capturar la imagen del plano.',
                    );
                }

                engine.setViewOrigin();
                engine.fitToView();
                // Mismo margen (500ms) que usa el editor de interiores entre
                // abrir el archivo y leer sus extents (Toolbar.tsx).
                await wait(500);

                const extents = await waitForExtents(engine);
                // Re-encuadra por si la primera llamada (antes de que las
                // extents estuvieran listas) no tuvo nada que enmarcar.
                engine.fitToView();

                // El parseo/render puede seguir en curso más allá de todo lo
                // anterior (confirmado real: 5+ segundos en un DWG grande) —
                // se espera contenido real en el canvas en vez de un tiempo
                // fijo, hasta ~6s adicionales de margen.
                const hasContent = await waitForCanvasContent(canvas);
                if (!hasContent) {
                    throw new Error(
                        'El plano tardó demasiado en renderizarse (puede ser muy pesado). Intenta de nuevo o exporta una versión más liviana.',
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

                let widthUnits: number;
                let heightUnits: number;
                const sizeIsGuess = extents === null;
                if (extents) {
                    // Misma heurística de respaldo que el editor de
                    // interiores usa cuando el DXF no declara $INSUNITS:
                    // infiere mm/cm/m por el tamaño de los extents.
                    const scale = detectScaleFromExtents({
                        min_x: extents.minX,
                        min_y: extents.minY,
                        max_x: extents.maxX,
                        max_y: extents.maxY,
                    });
                    widthUnits = (extents.maxX - extents.minX) * scale.factor;
                    heightUnits =
                        (extents.maxY - extents.minY) * scale.factor;
                } else {
                    // Sin extents disponibles (algunos DWG no las exponen):
                    // tamaño provisional que conserva la proporción real del
                    // canvas capturado — la calibración manual (obligatoria
                    // justo después de importar) corrige el tamaño real.
                    widthUnits = canvas.width / 20;
                    heightUnits = canvas.height / 20;
                }

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

                // Además del PNG, se guarda el ARCHIVO CAD ORIGINAL: es el
                // único que conserva los vectores y la escala real, y sin él
                // el plano no se puede reabrir en el motor para medir
                // distancias (base de la caída de tensión del módulo). Si esta
                // subida falla NO se aborta la importación: el PNG ya quedó
                // guardado y el emplazamiento sigue siendo utilizable.
                try {
                    await uploadDialuxPlanFile(
                        String(projectId),
                        SITE_PLAN_SOURCE_SCENE_ID,
                        file,
                        String(generalModuleId),
                    );
                } catch (sourceError) {
                    console.warn(
                        '[site-plan] No se pudo guardar el archivo CAD original; queda solo el PNG.',
                        sourceError,
                    );
                }

                setState({ status: 'idle', error: null });
                return {
                    originalName: file.name,
                    widthUnits: Math.max(1, widthUnits),
                    heightUnits: Math.max(1, heightUnits),
                    sizeIsGuess,
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
