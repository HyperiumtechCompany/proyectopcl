import { describe, expect, it } from 'vitest';
import {
    findSurfaceMaterialPresetByValue,
    getSurfaceMaterialPreset,
    SURFACE_MATERIAL_PRESETS,
} from './materialsData';

describe('materialsData', () => {
    it('keeps every preset reflectance within the valid 0-1 range', () => {
        for (const preset of SURFACE_MATERIAL_PRESETS) {
            expect(preset.reflectance).toBeGreaterThan(0);
            expect(preset.reflectance).toBeLessThanOrEqual(1);
        }
    });

    it('has no duplicate preset ids', () => {
        const ids = SURFACE_MATERIAL_PRESETS.map((preset) => preset.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('never attributes a non-normative estimate to a specific standard', () => {
        for (const preset of SURFACE_MATERIAL_PRESETS) {
            const isCieReference = preset.source.startsWith('CIE 117-1995');
            const isNonNormative = preset.source.startsWith('estimacion no normativa');
            expect(isCieReference || isNonNormative).toBe(true);
        }
    });

    it('looks up a preset by id', () => {
        expect(getSurfaceMaterialPreset('white-plaster')?.label).toBe('Blanco / yeso nuevo');
        expect(getSurfaceMaterialPreset('does-not-exist')).toBeNull();
    });

    it('finds the preset matching a stored reflectance value', () => {
        expect(findSurfaceMaterialPresetByValue(0.7)?.id).toBe('reference-ceiling');
        expect(findSurfaceMaterialPresetByValue(null)).toBeNull();
        expect(findSurfaceMaterialPresetByValue(0.9999)).toBeNull();
    });
});
