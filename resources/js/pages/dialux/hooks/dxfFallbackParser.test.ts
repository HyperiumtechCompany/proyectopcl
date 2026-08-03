import { describe, expect, it } from 'vitest';
import { detectDxfUnitFromHeader } from './dxfFallbackParser';

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
