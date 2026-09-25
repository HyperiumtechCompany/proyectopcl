import { describe, expect, it } from 'vitest';
import { normalizeTgOutputs } from './tgPanel';
import type { SiteElement } from './types';
import { resolveWireEndpoints } from './wireAnchors';

function el(id: string, x: number, y: number): SiteElement {
    return {
        id,
        type: 'pole',
        label: id,
        vertices: [{ x, y }],
        style: { fillColor: '#000', strokeColor: '#000' },
        visible: true,
    } as SiteElement;
}

describe('resolveWireEndpoints', () => {
    it('mueve el primer y último waypoint a la posición actual de los artefactos anclados', () => {
        const elements = [el('a', 5, 5), el('b', 20, 20)];
        const result = resolveWireEndpoints(
            [
                { x: 0, y: 0 }, // posición vieja de "a"
                { x: 10, y: 10 }, // punto de ruteo intermedio
                { x: 1, y: 1 }, // posición vieja de "b"
            ],
            'a',
            'b',
            (id) => elements.find((e) => e.id === id),
            1,
        );
        expect(result[0]).toEqual({ x: 5, y: 5 });
        expect(result[1]).toEqual({ x: 10, y: 10 }); // intermedio intacto
        expect(result[2]).toEqual({ x: 20, y: 20 });
    });

    it('si el artefacto ya no existe, deja el waypoint guardado tal cual', () => {
        const elements = [el('a', 5, 5)];
        const result = resolveWireEndpoints(
            [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            'a',
            'borrado',
            (id) => elements.find((e) => e.id === id),
            1,
        );
        expect(result[0]).toEqual({ x: 5, y: 5 });
        expect(result[1]).toEqual({ x: 1, y: 1 });
    });

    it('con un solo waypoint no revienta (caso degenerado)', () => {
        const elements = [el('a', 5, 5)];
        const result = resolveWireEndpoints(
            [{ x: 0, y: 0 }],
            'a',
            'b',
            (id) => elements.find((e) => e.id === id),
            1,
        );
        expect(result[0]).toEqual({ x: 5, y: 5 });
        expect(result).toHaveLength(1);
    });

    it('si el extremo es un TG con salida elegida, corre el punto a esa salida (no al centro del gabinete)', () => {
        const outputs = normalizeTgOutputs();
        const tg: SiteElement = {
            id: 'tg1',
            type: 'tg_location',
            label: 'TG',
            vertices: [{ x: 5, y: 5 }],
            style: { fillColor: '#000', strokeColor: '#000' },
            visible: true,
            config: { kind: 'tg', mount: 'floor', widthM: 1.2, depthM: 0.4, heightM: 2, outputs },
        } as SiteElement;
        const elements = [tg, el('b', 20, 20)];
        const result = resolveWireEndpoints(
            [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            'tg1',
            'b',
            (id) => elements.find((e) => e.id === id),
            1,
            outputs[1].id,
        );
        // Distinta salida del TG ⇒ punto distinto del centro puro del gabinete.
        expect(result[0]).not.toEqual({ x: 5, y: 5 });
        // Pero sigue "pegado" al TG (cerca de su centro, no del waypoint viejo).
        expect(Math.hypot(result[0].x - 5, result[0].y - 5)).toBeLessThan(1);
    });
});
