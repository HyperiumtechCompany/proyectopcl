import { describe, expect, it } from 'vitest';

import {
    getCanopyDraftStart,
    shouldEnableOverlayPointerEvents,
} from './cadInteraction';

const interactiveTools = new Set([
    'select',
    'room',
    'wall',
    'education-wall',
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

    it('stores canopy draft starts in scene coordinates', () => {
        const start = getCanopyDraftStart({ x: 260, y: 140 }, (x, y) => ({
            x: x / 20,
            y: y / 20,
        }));

        expect(start).toEqual({ x: 13, y: 7 });
    });
});
