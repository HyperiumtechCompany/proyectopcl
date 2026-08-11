import { describe, expect, it } from 'vitest';
import { renderElectricalDeviceSymbol, renderPanelSymbol, renderWaterHeaterSymbol } from './outletSymbols';

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
    it('main_panel/sub_panel usan el símbolo dedicado de tablero (rectángulo + salidas + relleno), no el cuadrado genérico', () => {
        const out: string[] = [];
        renderElectricalDeviceSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, type: 'main_panel', label: 'TG' });
        const dxf = out.join('\n');
        // 4 (rectángulo) + 1 (diagonal) + 4 (salidas superiores) + 2 (izquierda) + 2 (derecha) = 13
        expect(countOccurrences(dxf, '0\nLINE')).toBe(13);
        expect(countOccurrences(dxf, '0\nSOLID')).toBe(1);
        expect(countOccurrences(dxf, '0\nCIRCLE')).toBe(8); // 4 arriba + 2 izq + 2 der
        expect(dxf).toContain('TG');
    });

    it('a tamaño de leyenda (sizeM pequeño) los círculos de conexión del tablero NO se solapan entre sí', () => {
        // Regresión: antes los offsets del símbolo (radio, stubs, etiqueta)
        // eran metros absolutos fijos que no escalaban con `sizeM`. A
        // tamaño de planta (sizeM=0.4, el default) se veían bien, pero a
        // tamaño de celda de leyenda (~0.09-0.25m, ver `legend.ts`) los 8
        // círculos de conexión se solapaban entre sí formando un cúmulo
        // ilegible -- reportado por un usuario abriendo el DXF real en
        // AutoCAD ("se ve como un resorte/bobina", no como un tablero).
        const out: string[] = [];
        renderPanelSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, label: 'TG', sizeM: 0.1 });
        const dxf = out.join('\n');

        const circles = [...dxf.matchAll(
            /CIRCLE\n8\n[^\n]+\n10\n(-?\d+\.\d+)\n20\n(-?\d+\.\d+)\n30\n[^\n]+\n40\n(-?\d+\.\d+)/g,
        )].map((m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]) }));
        expect(circles).toHaveLength(8);

        for (let i = 0; i < circles.length; i++) {
            for (let j = i + 1; j < circles.length; j++) {
                const dist = Math.hypot(circles[j].x - circles[i].x, circles[j].y - circles[i].y);
                expect(dist).toBeGreaterThan(circles[i].r + circles[j].r);
            }
        }
    });

    it('a sizeM=0.4 (default de planta) la geometría del tablero es idéntica a la de antes del fix de escala', () => {
        const out: string[] = [];
        renderPanelSymbol(out, 'DISP_ELECTRICOS', { x: 0, y: 0, label: 'TG' });
        const dxf = out.join('\n');

        const circles = [...dxf.matchAll(
            /CIRCLE\n8\n[^\n]+\n10\n(-?\d+\.\d+)\n20\n(-?\d+\.\d+)\n30\n[^\n]+\n40\n(-?\d+\.\d+)/g,
        )];
        expect(circles).toHaveLength(8);
        expect(Number(circles[0][3])).toBeCloseTo(0.025, 6); // PANEL_CIRCLE_RADIUS original
        expect(dxf).toContain('40\n0.070000'); // altura de etiqueta original (hw=0.2 × 0.35)
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
