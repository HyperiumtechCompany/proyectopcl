/**
 * dialuxDebug.ts — Logger de diagnóstico activable en tiempo de ejecución.
 *
 * En producción `vite.config.ts` elimina del bundle `console.log/info/debug/
 * warn/trace` (ver `esbuild.pure`), así que los diagnósticos normales no se
 * ven. `ddbg()` usa `console.error`, que SÍ sobrevive, pero solo emite cuando
 * el diagnóstico está explícitamente activado:
 *
 *   - En la consola:  `localStorage.setItem('dialux:debug', '1')`  y recargar
 *   - O en la URL:     `?dialuxdebug=1`
 *
 * Para apagarlo: `localStorage.removeItem('dialux:debug')` y recargar.
 *
 * Silencioso por defecto — no añade ruido a producción.
 */

let cachedEnabled: boolean | null = null;

/** Cualquier valor que no sea claramente "apagado" cuenta como activado. */
function isTruthyFlag(value: string | null | undefined): boolean {
    if (value == null) return false;
    const v = value.trim().toLowerCase();
    return v !== '' && v !== '0' && v !== 'false' && v !== 'off' && v !== 'no';
}

export function isDialuxDebugEnabled(): boolean {
    if (cachedEnabled !== null) return cachedEnabled;
    let enabled = false;
    try {
        if (
            typeof localStorage !== 'undefined' &&
            isTruthyFlag(localStorage.getItem('dialux:debug'))
        ) {
            enabled = true;
        }
    } catch {
        // localStorage puede lanzar en modo incógnito / con cookies bloqueadas
    }
    try {
        if (typeof location !== 'undefined') {
            const m = /[?&]dialuxdebug(?:=([^&]*))?(?:&|$)/.exec(
                location.search,
            );
            if (m && isTruthyFlag(m[1] ?? '1')) enabled = true;
        }
    } catch {
        // location siempre existe en el navegador; guard por SSR/tests
    }
    cachedEnabled = enabled;
    return enabled;
}

/**
 * Emite un diagnóstico SOLO si el modo debug está activo. `scope` es una
 * etiqueta corta (`fixture-grid`, `coord`, `dxf`…). Usa `console.error` a
 * propósito para sobrevivir al minificado de producción.
 */
export function ddbg(scope: string, ...args: unknown[]): void {
    if (!isDialuxDebugEnabled()) return;
    // eslint-disable-next-line no-console
    console.error(`[dialux:debug ${scope}]`, ...args);
}
