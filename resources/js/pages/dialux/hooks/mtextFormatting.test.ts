import { describe, expect, it } from 'vitest';
import { stripMTextFormatting } from './mtextFormatting';

/**
 * Misma batería de casos que `clean_mtext_tests` en
 * `dialux-core/src/dxf_parser.rs` — ambos parsers (WASM y este fallback
 * TS) consumen el mismo tipo de archivo de forma independiente y deben
 * limpiar los códigos MTEXT de forma equivalente.
 */
describe('stripMTextFormatting', () => {
    it('descarta el código de fuente con parámetros hasta el ; de cierre', () => {
        expect(stripMTextFormatting(String.raw`\FArial|b0|i0|c0|p34;N.P.T.= +0.15`)).toBe('N.P.T.= +0.15');
    });

    it('descarta salto de párrafo y código de fuente juntos', () => {
        const raw = String.raw`\FArial|b0|i0|c0|p34;\PN.P.T.= +0.15\PN.F.P.= +0.10`;
        expect(stripMTextFormatting(raw)).toBe('N.P.T.= +0.15 N.F.P.= +0.10');
    });

    it('deja el texto plano sin códigos de control intacto', () => {
        expect(stripMTextFormatting('Recinto')).toBe('Recinto');
    });

    it('des-escapa backslash y llaves literales', () => {
        expect(stripMTextFormatting(String.raw`A\\B\{C\}D`)).toBe('A\\B{C}D');
    });

    it('descarta llaves de agrupación sueltas pero conserva el texto interno', () => {
        expect(stripMTextFormatting(String.raw`{\C1;rojo}`)).toBe('rojo');
    });

    it('no deja pasar un código de fuente sin el ; de cierre (truncado)', () => {
        expect(stripMTextFormatting(String.raw`\FArial|b0|i0`)).toBe('');
    });
});
