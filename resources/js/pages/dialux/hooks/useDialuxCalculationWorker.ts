import { useCallback, useEffect, useRef } from 'react';
import type { CalculationConfig, CalculationRun, CalculationSnapshot } from '@/pages/dialux/domain/calculation/types';
import dialuxCalculationWorkerUrl from '@/pages/dialux/workers/dialuxCalculationWorker?worker&url';
import type {
    DialuxCalculationRequestMessage,
    DialuxCalculationResponseMessage,
} from '@/pages/dialux/workers/dialuxCalculationWorkerProtocol';

/**
 * Hook del hilo principal para el worker de cálculo (Fase 12 del plan
 * maestro, "Rendimiento: Worker y WASM"). Una sola instancia de `Worker` por
 * montaje del componente que lo use — reutilizada entre cálculos sucesivos
 * (el kernel WASM, si carga, queda cacheado DENTRO del worker) y terminada
 * al desmontar. La UI (`EditorLayout.tsx`) ya garantiza un único cálculo en
 * curso a la vez (botón "Calcular" deshabilitado mientras `isCalculating`),
 * así que este hook no necesita coordinar cálculos concurrentes.
 */
export interface UseDialuxCalculationWorkerResult {
    calculate: (
        snapshot: CalculationSnapshot,
        config?: CalculationConfig,
        sceneSelectionByLevel?: Record<string, string> | null,
        onProgress?: (completed: number, total: number) => void,
    ) => Promise<CalculationRun>;
    /** Cancela el cálculo en curso, si hay alguno. El resultado se sigue resolviendo (no rechaza) con `status:'cancelled'`. */
    cancel: () => void;
}

interface PendingRequest {
    resolve: (run: CalculationRun) => void;
    reject: (error: Error) => void;
    onProgress?: (completed: number, total: number) => void;
}

export function useDialuxCalculationWorker(): UseDialuxCalculationWorkerResult {
    const workerRef = useRef<Worker | null>(null);
    const workerBlobUrlRef = useRef<string | null>(null);
    const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
    const activeRequestIdRef = useRef<string | null>(null);

    const getWorker = useCallback((): Worker => {
        if (workerRef.current) {
            return workerRef.current;
        }

        // Worker exige que SU URL inicial sea same-origin. En desarrollo,
        // Laravel puede estar en 127.0.0.1:8000 y Vite en localhost:5173.
        // Un módulo blob local actúa como entrada y luego importa por CORS
        // el módulo real de Vite. También funciona con el asset de producción.
        const workerModuleUrl = new URL(dialuxCalculationWorkerUrl, window.location.href).href;
        const blob = new Blob(
            [`import ${JSON.stringify(workerModuleUrl)};`],
            { type: 'text/javascript' },
        );
        const blobUrl = URL.createObjectURL(blob);
        let worker: Worker;
        try {
            worker = new Worker(blobUrl, { type: 'module' });
        } catch (error) {
            URL.revokeObjectURL(blobUrl);
            throw error;
        }
        workerBlobUrlRef.current = blobUrl;
        worker.onmessage = (event: MessageEvent<DialuxCalculationResponseMessage>) => {
            const response = event.data;
            const pending = pendingRef.current.get(response.requestId);
            if (!pending) {
                return;
            }

            if (response.type === 'progress') {
                pending.onProgress?.(response.completed, response.total);
                return;
            }

            pendingRef.current.delete(response.requestId);
            if (activeRequestIdRef.current === response.requestId) {
                activeRequestIdRef.current = null;
            }

            if (response.type === 'result') {
                // No encadenar el render del modal/isolux a la misma tarea que
                // deserializa las mallas grandes recibidas desde el worker.
                window.setTimeout(() => pending.resolve(response.run), 0);
            } else {
                window.setTimeout(
                    () => pending.reject(new Error(response.message)),
                    0,
                );
            }
        };
        worker.onerror = (event: ErrorEvent) => {
            // Error fuera del try/catch del worker (ej. fallo al cargar el
            // módulo) — rechaza CUALQUIER solicitud pendiente en vez de
            // dejarla colgada para siempre.
            for (const pending of pendingRef.current.values()) {
                pending.reject(new Error(event.message || 'Error desconocido en el worker de cálculo.'));
            }
            pendingRef.current.clear();
            activeRequestIdRef.current = null;
        };

        workerRef.current = worker;
        return worker;
    }, []);

    useEffect(() => {
        const pending = pendingRef.current;
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
            if (workerBlobUrlRef.current) {
                URL.revokeObjectURL(workerBlobUrlRef.current);
                workerBlobUrlRef.current = null;
            }
            pending.clear();
        };
    }, []);

    const calculate = useCallback(
        (
            snapshot: CalculationSnapshot,
            config?: CalculationConfig,
            sceneSelectionByLevel?: Record<string, string> | null,
            onProgress?: (completed: number, total: number) => void,
        ): Promise<CalculationRun> => {
            const worker = getWorker();
            const requestId = crypto.randomUUID();
            activeRequestIdRef.current = requestId;

            return new Promise<CalculationRun>((resolve, reject) => {
                pendingRef.current.set(requestId, { resolve, reject, onProgress });
                const message: DialuxCalculationRequestMessage = {
                    type: 'start',
                    requestId,
                    snapshot,
                    config,
                    sceneSelectionByLevel,
                };
                worker.postMessage(message);
            });
        },
        [getWorker],
    );

    const cancel = useCallback(() => {
        const requestId = activeRequestIdRef.current;
        if (!requestId || !workerRef.current) {
            return;
        }
        const message: DialuxCalculationRequestMessage = { type: 'cancel', requestId };
        workerRef.current.postMessage(message);
    }, []);

    return { calculate, cancel };
}
