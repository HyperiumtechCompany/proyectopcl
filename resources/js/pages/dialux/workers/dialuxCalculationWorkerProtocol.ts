import type { CalculationConfig, CalculationRun, CalculationSnapshot } from '@/pages/dialux/domain/calculation/types';

/**
 * Protocolo start/progress/cancel/result/error (Fase 12 del plan maestro,
 * "Rendimiento: Worker y WASM", §11). Tipos compartidos entre
 * `dialuxCalculationWorker.ts` (dentro del worker) y `useDialuxCalculationWorker.ts`
 * (hilo principal) — ninguno de los dos necesita saber la forma exacta de
 * los mensajes del otro lado más allá de esta unión discriminada.
 *
 * El kernel WASM (`hooks/wasmDirectIlluminanceKernel.ts`) NO viaja en estos
 * mensajes — las funciones no son clonables por `postMessage`; el worker lo
 * carga localmente una sola vez y lo reutiliza entre cálculos sucesivos.
 */
export interface DialuxCalculationStartMessage {
    type: 'start';
    requestId: string;
    snapshot: CalculationSnapshot;
    config?: CalculationConfig;
    sceneSelectionByLevel?: Record<string, string> | null;
}

export interface DialuxCalculationCancelMessage {
    type: 'cancel';
    requestId: string;
}

export type DialuxCalculationRequestMessage = DialuxCalculationStartMessage | DialuxCalculationCancelMessage;

export interface DialuxCalculationProgressMessage {
    type: 'progress';
    requestId: string;
    completed: number;
    total: number;
}

export interface DialuxCalculationResultMessage {
    type: 'result';
    requestId: string;
    run: CalculationRun;
}

export interface DialuxCalculationErrorMessage {
    type: 'error';
    requestId: string;
    message: string;
}

export type DialuxCalculationResponseMessage = DialuxCalculationProgressMessage | DialuxCalculationResultMessage | DialuxCalculationErrorMessage;
