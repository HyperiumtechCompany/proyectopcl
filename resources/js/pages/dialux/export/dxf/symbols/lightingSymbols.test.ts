import { describe, expect, it } from 'vitest';
import { f, rotatePoint } from '../emitters/primitives';
import { renderFixtureSymbol, renderLightSwitchSymbol, type FixtureCatalogSymbol } from './lightingSymbols';

/**
 * Fase 5 del plan maestro DXF: símbolos reutilizables (luminarias e
 * interruptores). Criterio de cierre — el mismo renderer se puede invocar
 * tanto para la entidad en planta como para la celda de símbolo de la
 * leyenda (aquí solo se prueba el renderer; su reutilización en la leyenda
 * llega en la Fase 6).
 */

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

const ALL_KNOWN_SYMBOLS: FixtureCatalogSymbol[] = [
    'rect_red', 'rect_green', 'rect_white',
    'circle_black', 'circle_magenta',
    'spot_yellow', 'spot_orange',
    'emergency', 'emergency_perm',
];

describe('renderFixtureSymbol — cada catalogSymbol conocido', () => {
    it.each(ALL_KNOWN_SYMBOLS)('dibuja algo para "%s" sin lanzar', (symbol) => {
        const out: string[] = [];
        expect(() => renderFixtureSymbol(out, 'LUMINARIAS', { x: 1, y: 2, catalogSymbol: symbol })).not.toThrow();
        expect(out.length).toBeGreaterThan(0);
    });
});

describe('renderFixtureSymbol — emergencia normal vs. permanente', () => {
    it('"emergency" no agrega texto; "emergency_perm" agrega la marca "S"', () => {
        const outNormal: string[] = [];
        renderFixtureSymbol(outNormal, 'LUMINARIAS', { x: 0, y: 0, catalogSymbol: 'emergency' });
        const dxfNormal = outNormal.join('\n');
        expect(countOccurrences(dxfNormal, '0\nTEXT')).toBe(0);

        const outPerm: string[] = [];
        renderFixtureSymbol(outPerm, 'LUMINARIAS', { x: 0, y: 0, catalogSymbol: 'emergency_perm' });
        const dxfPerm = outPerm.join('\n');
        expect(countOccurrences(dxfPerm, '0\nTEXT')).toBe(1);
        expect(dxfPerm).toContain('1\nS');
    });
});

describe('renderFixtureSymbol — rotación', () => {
    it('rota los puntos del símbolo alrededor del origen según rotationDeg', () => {
        const x = 5;
        const y = 3;
        const r = 0.15;
        const out: string[] = [];
        renderFixtureSymbol(out, 'LUMINARIAS', { x, y, rotationDeg: 90, catalogSymbol: 'spot_yellow' });
        const dxf = out.join('\n');

        // La línea horizontal local (-r,0)→(r,0), rotada 90°, debe terminar en (x, y±r).
        const rotatedEnd = rotatePoint({ x: r, y: 0 }, 90);
        expect(dxf).toContain(f(x + rotatedEnd.x));
        expect(dxf).toContain(f(y + rotatedEnd.y));
    });

    it('rotationDeg=0 (default) coincide con no pasar rotación', () => {
        const withZero: string[] = [];
        const withoutParam: string[] = [];
        renderFixtureSymbol(withZero, 'LUMINARIAS', { x: 2, y: 2, rotationDeg: 0, catalogSymbol: 'rect_red' });
        renderFixtureSymbol(withoutParam, 'LUMINARIAS', { x: 2, y: 2, catalogSymbol: 'rect_red' });
        expect(withZero.join('\n')).toBe(withoutParam.join('\n'));
    });
});

describe('renderFixtureSymbol — fallback para símbolo desconocido', () => {
    it('un catalogSymbol no reconocido no se oculta: cae al círculo + cruz genérico', () => {
        const outUnknown: string[] = [];
        const outUndefined: string[] = [];
        renderFixtureSymbol(outUnknown, 'LUMINARIAS', { x: 1, y: 1, catalogSymbol: 'this-is-not-a-real-symbol' });
        renderFixtureSymbol(outUndefined, 'LUMINARIAS', { x: 1, y: 1 });

        expect(outUnknown.length).toBeGreaterThan(0);
        expect(outUnknown.join('\n')).toBe(outUndefined.join('\n'));

        const dxf = outUnknown.join('\n');
        expect(countOccurrences(dxf, '0\nCIRCLE')).toBe(1);
        expect(countOccurrences(dxf, '0\nLINE')).toBe(2);
    });
});

describe('renderLightSwitchSymbol', () => {
    it('dibuja un único círculo, independiente de la rotación (símbolo simétrico)', () => {
        const out0: string[] = [];
        const out45: string[] = [];
        renderLightSwitchSymbol(out0, 'INTERRUPTORES', { x: 3, y: 4 });
        renderLightSwitchSymbol(out45, 'INTERRUPTORES', { x: 3, y: 4, rotationDeg: 45 });

        expect(countOccurrences(out0.join('\n'), '0\nCIRCLE')).toBe(1);
        expect(out0.join('\n')).toBe(out45.join('\n'));
    });
});
