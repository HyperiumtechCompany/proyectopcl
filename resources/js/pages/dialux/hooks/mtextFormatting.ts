/**
 * Limpieza de códigos de formato MTEXT (DXF) — usada por el parser de
 * respaldo en TypeScript (`dxfFallbackParser.ts`) cuando el motor WASM
 * (`dialux-core`) no está disponible. Misma semántica que `clean_mtext` en
 * `dialux-core/src/dxf_parser.rs`, reimplementada en TS porque ambos
 * parsers consumen el mismo tipo de archivo (plano CAD importado como
 * base) de forma independiente.
 *
 * Sin esto, códigos como `\Ffuente|b0|i0|c0|p0;` (cambio de fuente) o `\P`
 * (salto de párrafo) quedan como texto literal en la entidad resultante —
 * bug real reproducido en un DXF exportado, donde el usuario vio
 * `\F Tssej_ New Roman|0|0|c|0|p|0|` dibujado encima del plano.
 */

/** Códigos MTEXT con parámetros terminados en `;` (fuente, color, altura, ancho, oblicuo, tracking, alineación, apilado). */
const PARAMETERIZED_CODES = new Set(['F', 'C', 'H', 'W', 'Q', 'T', 'A', 'S']);

export function stripMTextFormatting(raw: string): string {
    let result = '';
    let i = 0;

    while (i < raw.length) {
        const ch = raw[i];
        if (ch !== '\\') {
            if (ch !== '{' && ch !== '}') result += ch;
            i += 1;
            continue;
        }

        const code = raw[i + 1];
        if (code === 'P' || code === 'p' || code === '~') {
            result += ' ';
            i += 2;
        } else if (code === '\\' || code === '{' || code === '}') {
            result += code;
            i += 2;
        } else if (code !== undefined && PARAMETERIZED_CODES.has(code.toUpperCase())) {
            const terminator = raw.indexOf(';', i + 2);
            i = terminator === -1 ? raw.length : terminator + 1;
        } else if (code !== undefined) {
            // Código de toggle sin parámetros (\L, \O, \K...): descartar.
            i += 2;
        } else {
            i += 1;
        }
    }

    return result.split(/\s+/).filter(Boolean).join(' ');
}
