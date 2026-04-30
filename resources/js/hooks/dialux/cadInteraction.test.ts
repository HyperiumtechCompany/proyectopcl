import { describe, expect, it } from 'vitest';

import { shouldEnableOverlayPointerEvents } from './cadInteraction';

const interactiveTools = new Set([
    'select',
    'room',
    'wall',
    'window',
    'door',
    'canopy',
    'fixture',
    'measure',
    'calibrate',
    'pan',
]);

describe('cadInteraction', () => {
    it('disables the overlay while a CAD command is active', () => {
        expect(
            shouldEnableOverlayPointerEvents('select', true, interactiveTools),
        ).toBe(false);
    });

    it('keeps the overlay enabled for interactive tools when no CAD command is active', () => {
        expect(
            shouldEnableOverlayPointerEvents('measure', false, interactiveTools),
        ).toBe(true);
    });
});
