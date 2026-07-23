import { describe, expect, it } from 'vitest';
import { buildLevelBlockName, emitLevelBlockDefinition, emitLevelBlockInsert } from './levelBlock';

describe('buildLevelBlockName', () => {
    it('sótano, planta baja y piso superior producen los nombres del ejemplo del plan (sección 12.1)', () => {
        expect(buildLevelBlockName(-1)).toBe('BASE_NIVEL_M01');
        expect(buildLevelBlockName(0)).toBe('BASE_NIVEL_000');
        expect(buildLevelBlockName(1)).toBe('BASE_NIVEL_001');
    });

    it('nombres ASCII seguros y sin caracteres inválidos para cualquier floorIndex', () => {
        for (const floorIndex of [-10, -1, 0, 1, 10, 99]) {
            expect(buildLevelBlockName(floorIndex)).toMatch(/^[A-Z0-9_]+$/);
        }
    });
});

describe('emitLevelBlockDefinition / emitLevelBlockInsert', () => {
    it('define un bloque con el contenido dado y lo inserta escala 1 rotación 0 en el punto pedido', () => {
        const out: string[] = [];
        emitLevelBlockDefinition(out, 'BASE_NIVEL_000', () => {
            out.push('0\nLINE');
        });
        emitLevelBlockInsert(out, 'DXF_BASE', 'BASE_NIVEL_000', 12.5, -3.25);

        const dxf = out.join('\n');
        expect(dxf).toContain('0\nBLOCK');
        expect(dxf).toContain('2\nBASE_NIVEL_000');
        expect(dxf).toContain('0\nENDBLK');
        expect(dxf).toContain('0\nINSERT');
        expect(dxf).toContain('10\n12.500000');
        expect(dxf).toContain('20\n-3.250000');
        expect(dxf).toContain('50\n0.0');
    });
});
