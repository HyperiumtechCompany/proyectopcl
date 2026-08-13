import { describe, expect, it } from 'vitest';

import { acceptsWireNode, wireFamilyFromShortcut } from './wireNodeFamily';

describe('atajos de familia de cableado', () => {
    it('usa alumbrado con clic derecho y tomacorrientes con Alt+clic derecho', () => {
        expect(wireFamilyFromShortcut(false)).toBe('lighting');
        expect(wireFamilyFromShortcut(true)).toBe('outlets');
    });

    it('solo permite luminarias e interruptores en una red de alumbrado', () => {
        expect(acceptsWireNode('lighting', 'fixture')).toBe(true);
        expect(acceptsWireNode('lighting', 'switch')).toBe(true);
        expect(
            acceptsWireNode('lighting', 'electrical-device', 'outlet_floor'),
        ).toBe(false);
        expect(
            acceptsWireNode('lighting', 'electrical-device', 'sub_panel'),
        ).toBe(true);
    });

    it('solo permite dispositivos tomacorriente en una red de tomas', () => {
        expect(
            acceptsWireNode('outlets', 'electrical-device', 'outlet_floor'),
        ).toBe(true);
        expect(
            acceptsWireNode('outlets', 'electrical-device', 'sub_panel'),
        ).toBe(true);
        expect(acceptsWireNode('outlets', 'fixture')).toBe(false);
    });

    it.each(['main_panel', 'sub_panel', 'arrival_panel'])(
        'acepta el tablero %s como inicio o destino de cualquier circuito',
        (panelType) => {
            expect(
                acceptsWireNode('lighting', 'electrical-device', panelType),
            ).toBe(true);
            expect(
                acceptsWireNode('outlets', 'electrical-device', panelType),
            ).toBe(true);
        },
    );
});
