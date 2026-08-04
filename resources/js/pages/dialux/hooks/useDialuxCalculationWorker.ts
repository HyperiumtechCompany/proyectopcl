import { useCallback, useEffect, useRef } from 'react';
import type { CalculationConfig, CalculationRun, CalculationSnapshot } from '@/pages/dialux/domain/calculation/types';
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
    const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
    const activeRequestIdRef = useRef<string | null>(null);

    const getWorker = useCallback((): Worker => {
        if (workerRef.current) {
            return workerRef.current;
        }

        const worker = new Worker(new URL('../workers/dialuxCalculationWorker.ts', import.meta.url), { type: 'module' });
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
                pending.resolve(response.run);
            } else {
                pending.reject(new Error(response.message));
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
