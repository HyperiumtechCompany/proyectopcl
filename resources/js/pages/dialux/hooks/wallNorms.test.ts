import { describe, expect, it } from 'vitest';
import { getPeruWallPreset } from './wallNorms';

describe('wallNorms', () => {
    it('provides education wall presets for school buildings', () => {
        expect(getPeruWallPreset('brick', 'education')).toMatchObject({
            use: 'education',
            label: 'Ladrillo - Educacion / colegio',
            recommendedThickness: 0.15,
            recommendedHeight: 2.7,
        });

        expect(getPeruWallPreset('adobe', 'education')).toMatchObject({
            use: 'education',
            label: 'Adobe - Educacion / colegio',
            recommendedThickness: 0.45,
            recommendedHeight: 2.7,
        });
    });
});
