import { describe, expect, it } from 'vitest';
import { describeProjection } from '../export/siteZoneReport';
import {
    applyProjectionAdjust,
    EMPTY_PROJECTION_ADJUST,
    isProjectionAdjusted,
} from '../hooks/useSiteLightingCalculation';
import {
    adjustLinearLayout,
    armTowardAxisDeg,
    linearAxisOf,
    linearPolePositions,
} from './siteLinearProjection';
import type { SiteElement } from './types';

const sidewalk: SiteElement = {
    id: 'vereda',
    type: 'sidewalk',
    label: 'Vereda',
    vertices: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 3 },
        { x: 0, y: 3 },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
};

describe('mover la proyección antes de colocarla', () => {
    it('desplazamiento del conjunto + poste movido a mano (que ignora el desplazamiento)', () => {
        const base = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
        const adjust = { offset: { x: 1, y: 2 }, overrides: { 1: { x: 50, y: 50 } } };
        expect(applyProjectionAdjust(base, adjust)).toEqual([{ x: 1, y: 2 }, { x: 50, y: 50 }]);
        expect(applyProjectionAdjust(base, EMPTY_PROJECTION_ADJUST)).toEqual(base);
        expect(isProjectionAdjusted(EMPTY_PROJECTION_ADJUST)).toBe(false);
        expect(isProjectionAdjusted(adjust)).toBe(true);
    });

    it('vereda: un poste pasado al otro borde reorienta su brazo hacia la vía', () => {
        const axis = linearAxisOf(sidewalk, 1)!;
        const layout = linearPolePositions({ axis, arrangement: 'single', count: 2, scaleM: 1 });
        const [first] = layout.positions;
        // Reflejado respecto del eje (y = 1,5): al otro borde.
        const mirrored = { x: first.x, y: 3 - first.y };
        const adjusted = adjustLinearLayout(layout, axis, [mirrored, layout.positions[1]], 1);
        const a = (deg: number) => (deg * Math.PI) / 180;
        // Convención del brazo: dirección en planta (sin a, cos a); debe apuntar al eje.
        expect(Math.sign(Math.cos(a(adjusted.armDirectionsDeg[0])))).toBe(Math.sign(1.5 - mirrored.y));
        expect(Math.sign(Math.cos(a(layout.armDirectionsDeg[0])))).toBe(Math.sign(1.5 - first.y));
        expect(armTowardAxisDeg(axis, layout.positions[1], 1)).toBeCloseTo(layout.armDirectionsDeg[1], 9);
    });
});

describe('informe por espacio (sin recinto)', () => {
    it('describe la proyección guardada en el espacio, con el ajuste manual', () => {
        const text = describeProjection(
            {
                ...sidewalk,
                metadata: {
                    projection: {
                        mode: 'linear',
                        count: 4,
                        arrangement: 'single',
                        spacingM: 10,
                        placement: 'outside',
                        mountingHeightM: 4,
                        armLengthM: 0,
                        spacingToHeight: 3,
                        targetLux: 7.5,
                        adjusted: true,
                    },
                },
            },
            [],
        );
        expect(text).toContain('Proyección lineal unilateral: 4 postes de 4 m cada 10 m, fuera del borde, sin brazo');
        expect(text).toContain('Ēm objetivo 7.5 lx');
        expect(text).toContain('ajustadas a mano');
        expect(describeProjection(sidewalk, [])).toBe('Sin luminarias que la iluminen.');
    });
});
