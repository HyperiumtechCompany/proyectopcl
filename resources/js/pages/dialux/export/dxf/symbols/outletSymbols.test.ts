import { describe, expect, it } from 'vitest';
import { renderElectricalDeviceSymbol, renderWaterHeaterSymbol } from './outletSymbols';

/**
 * Fase 5 del plan maestro DXF: símbolos de tomacorrientes y tableros.
 * Pruebas requeridas — tomas bajas, altas, techo y piso; fallback para
 * dispositivo/símbolo desconocido.
 */

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe('renderElectricalDeviceSymbol — tomas bajas, altas, techo y piso', () => {
    it('toma baja (outlet_floor): círculo + línea + etiqueta', () => {
        const out: string[] = [];
        renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, type: 'outlet_floor', label: 'T-01' });
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nCIRCLE')).toBe(1);
        expect(countOccurrences(dxf, '0\nLINE')).toBe(1);
        expect(dxf).toContain('T-01');
    });

    it('toma alta (outlet_high_180): misma forma que la toma baja, distinta altura de montaje (no afecta la geometría del símbolo)', () => {
        const out: string[] = [];
        renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, type: 'outlet_high_180', label: 'TA-01' });
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nCIRCLE')).toBe(1);
        expect(countOccurrences(dxf, '0\nLINE')).toBe(1);
    });

    it('toma de techo (outlet_ceiling): forma distinta (cruz de 4 líneas + círculo pequeño), sin texto', () => {
        const out: string[] = [];
        renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, type: 'outlet_ceiling' });
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nLINE')).toBe(4);
        expect(countOccurrences(dxf, '0\nCIRCLE')).toBe(1);
        expect(countOccurrences(dxf, '0\nTEXT')).toBe(0);
    });

    it('toma de piso (outlet_floor_box): rectángulo + etiqueta forzada a "TP" sin importar el label pedido', () => {
        const out: string[] = [];
        renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, type: 'outlet_floor_box', label: 'TP-05' });
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nLINE')).toBe(4); // rectángulo
        expect(dxf).toContain('1\nTP');
        expect(dxf).not.toContain('TP-05');
    });

    it('toma waterproof agrega "AP" y la altura de montaje además del símbolo base', () => {
        const out: string[] = [];
        renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, type: 'outlet_waterproof', label: 'T-02' });
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nTEXT')).toBe(3); // label + "AP" + "1.20m"
        expect(dxf).toContain('1\nAP');
        expect(dxf).toContain('1.20m');
    });
});

describe('renderElectricalDeviceSymbol — tableros/medidores y fallback', () => {
    it('un tipo de dispositivo sin forma dedicada (tablero) cae al cuadrado genérico, no se oculta', () => {
        const out: string[] = [];
        renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, type: 'main_panel', label: 'TG' });
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nLINE')).toBe(4);
        expect(dxf).toContain('TG');
    });

    it('un type completamente desconocido también cae al cuadrado genérico, sin lanzar', () => {
        const out: string[] = [];
        expect(() => renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', {
            x: 0, y: 0, type: 'this-is-not-a-real-device-type', label: 'X',
        })).not.toThrow();
        expect(countOccurrences(out.join('\n'), '0\nLINE')).toBe(4);
    });
});

describe('renderWaterHeaterSymbol', () => {
    it('siempre muestra "TE" sin importar el label pedido', () => {
        const out: string[] = [];
        renderWaterHeaterSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, label: 'ALGO-DISTINTO' });
        const dxf = out.join('\n');
        expect(dxf).toContain('1\nTE');
        expect(dxf).not.toContain('ALGO-DISTINTO');
    });
});
