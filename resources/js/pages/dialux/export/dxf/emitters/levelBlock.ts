import { p, type DxfLines } from './primitives';

/**
 * Nombre de bloque determinista y ASCII para el fondo arquitectónico de un
 * nivel (sección 12.1): `BASE_NIVEL_M01` (sótano 1), `BASE_NIVEL_000`
 * (planta baja), `BASE_NIVEL_001` (piso 1)... El nombre NUNCA depende del
 * nombre libre que el usuario le puso a la escena, para evitar caracteres
 * inválidos o colisiones entre dos niveles con el mismo nombre (Fase 1).
 */
export function buildLevelBlockName(floorIndex: number): string {
    const encoded = floorIndex < 0
        ? `M${String(-floorIndex).padStart(2, '0')}`
        : String(floorIndex).padStart(3, '0');
    return `BASE_NIVEL_${encoded}`;
}

/** Definición de bloque (sección 12.1/12.2) — igual patrón que `PLANO_BASE` en la Fase 0, generalizado a N bloques (uno por nivel). */
export function emitLevelBlockDefinition(out: DxfLines, blockName: string, renderContent: () => void): void {
    p(out, 0, 'BLOCK');
    p(out, 8, '0');
    p(out, 2, blockName);
    p(out, 70, 0);
    p(out, 10, '0.0'); p(out, 20, '0.0'); p(out, 30, '0.0');
    p(out, 3, blockName);
    p(out, 1, '');
    renderContent();
    p(out, 0, 'ENDBLK');
    p(out, 8, '0');
}

/**
 * Inserta un bloque de nivel en un punto, escala uniforme 1 y rotación 0
 * (sección 12.2 — nunca escala ni rota el fondo, solo lo traslada).
 */
export function emitLevelBlockInsert(out: DxfLines, layer: string, blockName: string, x: number, y: number): void {
    p(out, 0, 'INSERT');
    p(out, 8, layer);
    p(out, 2, blockName);
    p(out, 10, x.toFixed(6)); p(out, 20, y.toFixed(6)); p(out, 30, '0.0');
    p(out, 41, '1.0'); p(out, 42, '1.0'); p(out, 43, '1.0');
    p(out, 50, '0.0');
}
