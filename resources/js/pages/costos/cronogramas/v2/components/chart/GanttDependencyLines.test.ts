import { describe, expect, it } from 'vitest';
import { buildArrowPath } from './GanttDependencyLines';

describe('buildArrowPath', () => {
    it('routes close finish-to-start dependencies directly around the left side', () => {
        const path = buildArrowPath(300, 48, 280, 80, 'FC');

        expect(path).toBe('M 300.0,48.0 H 260.0 V 80.0 H 280.0');
    });

    it('routes close start-to-finish dependencies directly around the right side', () => {
        const path = buildArrowPath(280, 48, 300, 80, 'CF');

        expect(path).toBe('M 280.0,48.0 H 320.0 V 80.0 H 300.0');
    });
});
