import { describe, expect, it } from 'vitest';
import { detectDxfUnitFromHeader, parseDxfTextFallback } from './dxfFallbackParser';

/** Construye un DXF mínimo válido con un $INSUNITS declarado en la sección HEADER. */
function buildDxfHeader(insunitsCode: number): string {
    return [
        '0', 'SECTION',
        '2', 'HEADER',
        '9', '$INSUNITS',
        '70', String(insunitsCode),
        '0', 'ENDSEC',
        '0', 'EOF',
    ].join('\n');
}

describe('dxfFallbackParser — detección de escala real del CAD', () => {
    it('detecta metros ($INSUNITS=6): una casa de 20x20 en el CAD debe valer 20x20 en el sistema', () => {
        const detected = detectDxfUnitFromHeader(buildDxfHeader(6));

        expect(detected).not.toBeNull();
        expect(detected?.unit).toBe('m');
        // factor=1 significa que las coordenadas del DXF (20, 20) se usan tal
        // cual en metros — sin esto, un plano en mm/cm se malinterpretaría.
        expect(detected?.factor).toBe(1);
    });

    it('detecta milímetros ($INSUNITS=4)', () => {
        const detected = detectDxfUnitFromHeader(buildDxfHeader(4));

        expect(detected?.unit).toBe('mm');
        expect(detected?.factor).toBe(0.001);
    });

    it('detecta centímetros ($INSUNITS=5)', () => {
        const detected = detectDxfUnitFromHeader(buildDxfHeader(5));

        expect(detected?.unit).toBe('cm');
        expect(detected?.factor).toBe(0.01);
    });

    it('devuelve null si el DXF no declara $INSUNITS (el heurístico de extents debe decidir)', () => {
        const withoutHeader = [
            '0', 'SECTION',
            '2', 'ENTITIES',
            '0', 'ENDSEC',
            '0', 'EOF',
        ].join('\n');

        expect(detectDxfUnitFromHeader(withoutHeader)).toBeNull();
    });

    it('devuelve null si $INSUNITS declara una unidad no métrica soportada (ej. pulgadas=1)', () => {
        expect(detectDxfUnitFromHeader(buildDxfHeader(1))).toBeNull();
    });
});

/** Construye un DXF mínimo con una sola entidad en ENTITIES, dada como pares código/valor ya en líneas. */
function buildDxfWithEntity(entityLines: string[]): string {
    return ['0', 'SECTION', '2', 'ENTITIES', ...entityLines, '0', 'ENDSEC', '0', 'EOF'].join('\n');
}

describe('dxfFallbackParser — MTEXT: limpieza de códigos de formato', () => {
    /**
     * Bug real reproducido en un DXF exportado: un plano base importado por
     * un usuario traía un MTEXT con código de fuente (`\F...;`) seguido de
     * un salto de párrafo (`\P`) — sin limpiar, ese código quedaba como
     * texto literal (`\F Tssej_ New Roman|0|0|c|0|p|0|`) dibujado encima
     * del plano. Mismo caso cubierto en `dialux-core/src/dxf_parser.rs`
     * (`clean_mtext_tests`) para el parser WASM equivalente.
     */
    it('limpia el código de fuente y convierte el salto de párrafo en espacio', () => {
        const dxf = buildDxfWithEntity([
            '0', 'MTEXT',
            '8', '0',
            '10', '0',
            '20', '0',
            '40', '2.5',
            '1', String.raw`\FArial|b0|i0|c0|p34;\PN.P.T.= +0.15`,
        ]);

        const parsed = parseDxfTextFallback(dxf);

        expect(parsed.entities).toHaveLength(1);
        const entity = parsed.entities![0];
        expect(entity.type).toBe('text');
        expect((entity as { text: string }).text).toBe('N.P.T.= +0.15');
    });

    it('concatena los chunks de continuación (código 3) con el código 1 final, en orden', () => {
        const dxf = buildDxfWithEntity([
            '0', 'MTEXT',
            '8', '0',
            '10', '0',
            '20', '0',
            '40', '2.5',
            '3', 'ABC',
            '3', 'DEF',
            '1', 'GHI',
        ]);

        const parsed = parseDxfTextFallback(dxf);

        expect((parsed.entities![0] as { text: string }).text).toBe('ABCDEFGHI');
    });

    it('deja el texto plano (TEXT, sin códigos MTEXT) sin tocar', () => {
        const dxf = buildDxfWithEntity([
            '0', 'TEXT',
            '8', '0',
            '10', '0',
            '20', '0',
            '40', '2.5',
            '1', 'Recinto',
        ]);

        const parsed = parseDxfTextFallback(dxf);

        expect((parsed.entities![0] as { text: string }).text).toBe('Recinto');
    });
});
