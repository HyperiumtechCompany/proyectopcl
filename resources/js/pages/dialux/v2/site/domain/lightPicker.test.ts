import { describe, expect, it } from 'vitest';
import { pickSpreadSources } from './lightPicker';

describe('domain/lightPicker', () => {
    it('con pocas fuentes las devuelve todas', () => {
        const s = [{ x: 0, z: 0, lumens: 1 }];
        expect(pickSpreadSources(s, 8)).toBe(s);
    });

    it('reparte las luces: no toma las 8 primeras si están todas juntas', () => {
        const cluster = Array.from({ length: 8 }, (_, i) => ({ x: i * 0.1, z: 0, lumens: 1500 }));
        const far = { x: 100, z: 100, lumens: 1000 };
        const picked = pickSpreadSources([...cluster, far], 8);
        expect(picked).toHaveLength(8);
        expect(picked).toContain(far);
    });
});
