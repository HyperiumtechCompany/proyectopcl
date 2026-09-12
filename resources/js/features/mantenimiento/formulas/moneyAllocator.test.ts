import { describe, expect, it } from 'vitest';
import { allocateMoney } from './moneyAllocator';

describe('maintenance money allocation', () => {
    it('keeps all cents and resolves ties by stable input order', () => {
        const result = allocateMoney(10, { a: '1', b: '1', c: '1' });
        expect(result).toEqual({ a: 4, b: 3, c: 3 });
        expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(10);
    });
});
