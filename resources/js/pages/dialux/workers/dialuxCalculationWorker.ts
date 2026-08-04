import { runDirectPreviewEngine } from '@/pages/dialux/domain/calculation/runDirectPreviewEngine';
import type { DirectIlluminanceBatchKernel } from '@/pages/dialux/hooks/directIlluminance';
import { ensureWasmDirectIlluminanceKernel } from '@/pages/dialux/hooks/wasmDirectIlluminanceKernel';
import type { DialuxCalculationRequestMessage, DialuxCalculationResponseMessage } from './dialuxCalculationWorkerProtocol';

/**
 * Worker de cálculo lumínico (Fase 12 del plan maestro, "Rendimiento: Worker
 * y WASM"). Corre `runDirectPreviewEngine` fuera del hilo principal —
 * `useDialuxCalculationWorker.ts` lo instancia UNA sola vez por montaje del
 * editor y lo reutiliza entre cálculos sucesivos (evita recargar el módulo
 * WASM en cada click de "Calcular", cumpliendo el objetivo de "sin
 * crecimiento de memoria entre ejecuciones repetidas").
 */

// Cacheado a nivel de worker: se intenta cargar UNA vez; si falla, todas las
// llamadas subsiguientes usan el motor TS puro (nunca bloquea el cálculo).
let kernelPromise: Promise<DirectIlluminanceBatchKernel | null> | null = null;
function getDirectIlluminanceKernel(): Promise<DirectIlluminanceBatchKernel | null> {
    kernelPromise ??= ensureWasmDirectIlluminanceKernel();
    return kernelPromise;
}

// Cancelación cooperativa (Fase 12, §"cancelación"): un `requestId` cancelado
// se marca aquí; `runDirectPreviewEngine` lo consulta ENTRE calculationObjects
// (`runOptions.isCancelled`), nunca a mitad de uno.
const cancelledRequestIds = new Set<string>();

function postResponse(response: DialuxCalculationResponseMessage): void {
    (self as unknown as { postMessage: (message: DialuxCalculationResponseMessage) => void }).postMessage(response);
}

async function handleStart(message: Extract<DialuxCalculationRequestMessage, { type: 'start' }>): Promise<void> {
    const { requestId, snapshot, config, sceneSelectionByLevel } = message;

    try {
        const kernel = await getDirectIlluminanceKernel();
        const run = await runDirectPreviewEngine(snapshot, config, sceneSelectionByLevel ?? null, {
            onProgress: (completed, total) => postResponse({ type: 'progress', requestId, completed, total }),
            isCancelled: () => cancelledRequestIds.has(requestId),
            directIlluminanceBatch: kernel ?? undefined,
        });
        postResponse({ type: 'result', requestId, run });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        postResponse({ type: 'error', requestId, message: errorMessage });
    } finally {
        cancelledRequestIds.delete(requestId);
    }
}

self.onmessage = (event: MessageEvent<DialuxCalculationRequestMessage>) => {
    const request = event.data;

    if (request.type === 'cancel') {
        cancelledRequestIds.add(request.requestId);
        return;
    }

    if (request.type === 'start') {
        void handleStart(request);
    }
};
