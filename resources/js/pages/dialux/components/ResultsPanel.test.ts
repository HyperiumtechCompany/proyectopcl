import { describe, expect, it } from 'vitest';
import { isRoomCompliant } from './ResultsPanel';

const compliantValues = {
    avgLux: 300,
    illuminanceLux: 200,
    uniformity: 0.6,
    uniformityTarget: 0.4,
    ugr: 18,
    ugrLimit: 22,
    hasNormativeSource: true,
};

describe('isRoomCompliant', () => {
    it('exige conjuntamente norma, iluminancia, uniformidad y UGR', () => {
        expect(isRoomCompliant(compliantValues)).toBe(true);
        expect(isRoomCompliant({ ...compliantValues, avgLux: 199 })).toBe(false);
        expect(isRoomCompliant({ ...compliantValues, uniformity: 0.39 })).toBe(false);
        expect(isRoomCompliant({ ...compliantValues, ugr: 22.1 })).toBe(false);
        expect(isRoomCompliant({ ...compliantValues, hasNormativeSource: false })).toBe(false);
    });

    it('respeta los límites particulares de cada tipo de ambiente', () => {
        expect(
            isRoomCompliant({
                ...compliantValues,
                uniformity: 0.3,
                uniformityTarget: 0.25,
                ugr: 25,
                ugrLimit: 28,
            }),
        ).toBe(true);
    });
});
