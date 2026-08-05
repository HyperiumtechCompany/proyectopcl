import { describe, expect, it } from 'vitest';
import { findGlazingPresetByValue, getGlazingPreset, GLAZING_PRESETS } from './glazingData';

describe('glazingData', () => {
    it('keeps every preset transmittance within the valid 0-1 range', () => {
        for (const preset of GLAZING_PRESETS) {
            expect(preset.transmittance).toBeGreaterThan(0);
            expect(preset.transmittance).toBeLessThanOrEqual(1);
        }
    });

    it('has no duplicate preset ids', () => {
        const ids = GLAZING_PRESETS.map((preset) => preset.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('never attributes a numeric value to EN 410/ISO 9050 as if they tabulated it', () => {
        for (const preset of GLAZING_PRESETS) {
            expect(preset.source.startsWith('estimacion no normativa')).toBe(true);
        }
    });

    it('looks up a preset by id', () => {
        expect(getGlazingPreset('single-clear')?.label).toBe('Vidrio simple claro (float)');
        expect(getGlazingPreset('does-not-exist')).toBeNull();
    });

    it('finds the preset matching a stored transmittance value', () => {
        expect(findGlazingPresetByValue(0.89)?.id).toBe('single-clear');
        expect(findGlazingPresetByValue(null)).toBeNull();
        expect(findGlazingPresetByValue(0.9999)).toBeNull();
    });
});
