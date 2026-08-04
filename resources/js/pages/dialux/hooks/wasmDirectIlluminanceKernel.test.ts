import { describe, expect, it } from 'vitest';
import { ensureWasmDirectIlluminanceKernel } from './wasmDirectIlluminanceKernel';

/**
 * `ensureWasmDirectIlluminanceKernel` carga el módulo WASM vía una URL
 * absoluta de runtime (`/dialux-core/pkg/dialux_core.js`, servida por Vite
 * desde `public/` en el navegador — ver `useWasmEngine.ts`, mismo patrón).
 * En el entorno de test (Node/vitest, sin servidor Vite) esa ruta nunca
 * resuelve, así que este test no verifica el cálculo WASM en sí (eso lo
 * cubre `cargo test` en `dialux-core/src/direct_illuminance.rs`, con los
 * mismos casos numéricos que `photometricInterpolation.test.ts`) — verifica
 * el contrato que sí importa para el motor: si el kernel no está
 * disponible, `calculateLightingResult`/`runDirectPreviewEngine` deben
 * poder seguir funcionando con el bucle TS puro, sin lanzar ni bloquear.
 */
describe('ensureWasmDirectIlluminanceKernel — degradación segura sin servidor Vite', () => {
    it('devuelve null en vez de lanzar cuando el módulo WASM no se puede cargar', async () => {
        const kernel = await ensureWasmDirectIlluminanceKernel();
        expect(kernel).toBeNull();
    });

    it('llamadas repetidas no lanzan ni quedan pendientes (cache de fallo)', async () => {
        const first = await ensureWasmDirectIlluminanceKernel();
        const second = await ensureWasmDirectIlluminanceKernel();
        expect(first).toBeNull();
        expect(second).toBeNull();
    });
});
