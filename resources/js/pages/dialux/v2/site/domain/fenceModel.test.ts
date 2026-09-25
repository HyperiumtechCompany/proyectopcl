import { describe, expect, it } from 'vitest';
import { FENCE_MODEL, fenceThicknessM, lightenHex } from './fenceModel';

describe('site/domain/fenceModel', () => {
    it('sin espesor usa el valor por defecto', () => {
        expect(fenceThicknessM(undefined)).toBe(FENCE_MODEL.defaultThicknessM);
        expect(fenceThicknessM({})).toBe(FENCE_MODEL.defaultThicknessM);
    });

    it('un espesor diminuto se sube al mínimo operativo', () => {
        expect(fenceThicknessM({ thicknessM: 0.05 })).toBe(FENCE_MODEL.minThicknessM);
        expect(fenceThicknessM({ thicknessM: 0 })).toBe(FENCE_MODEL.minThicknessM);
        expect(fenceThicknessM({ thicknessM: Number.NaN })).toBe(FENCE_MODEL.defaultThicknessM);
    });

    it('un espesor razonable se respeta', () => {
        expect(fenceThicknessM({ thicknessM: 0.3 })).toBe(0.3);
    });

    it('aclara colores y deja intactos los que no son #rrggbb', () => {
        expect(lightenHex('#000000', 0.5)).toBe('#808080');
        expect(lightenHex('#ffffff', 0.5)).toBe('#ffffff');
        expect(lightenHex('rojo', 0.5)).toBe('rojo');
    });
});
