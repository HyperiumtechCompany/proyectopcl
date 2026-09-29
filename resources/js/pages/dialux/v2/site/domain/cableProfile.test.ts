import { describe, expect, it } from 'vitest';
import { cableProfileM } from './cableElevation';
import { reroutedCircuitDraft } from './circuitSplit';
import { siteCircuitLengthSplit } from './siteNetworkBridge';
import type { SiteCircuit, SiteElement } from './types';

const style = { fillColor: '#000', strokeColor: '#000' };
const platform: SiteElement = {
    id: 'plat',
    type: 'terrace_platform',
    label: 'Plataforma +1.50',
    vertices: [
        { x: 10, y: -5 },
        { x: 20, y: -5 },
        { x: 20, y: 5 },
        { x: 10, y: 5 },
    ],
    baseElevationM: 1.5,
    style,
};
const point = (id: string, type: SiteElement['type'], x: number, y: number): SiteElement => ({
    id,
    type,
    label: id,
    vertices: [{ x, y }],
    style,
});

describe('perfil del cable sobre plataformas (horizontal / vertical)', () => {
    it('un tramo recto que CRUZA una plataforma cuenta su subida y bajada aunque sus puntos estén abajo', () => {
        // Caso a mano: 30 m en planta; sube 1,50 m al entrar y baja 1,50 m al salir.
        const profile = cableProfileM([{ x: 0, y: 0 }, { x: 30, y: 0 }], [platform], 1);
        expect(profile.alongM).toBeCloseTo(30, 6);
        expect(profile.riseM).toBeCloseTo(3, 6);
    });

    it('Red y CT recibe horizontal y vertical por separado (zanja incluida)', () => {
        const elements = [platform, point('tg', 'tg_location', 0, 0), point('box', 'pull_box', 30, 0)];
        const circuit: SiteCircuit = {
            id: 'c1',
            sourceId: 'tg',
            targetId: 'box',
            waypoints: [{ x: 0, y: 0 }, { x: 30, y: 0 }],
            calculatedLengthM: 0,
            wireCount: 4,
            wastePct: 0,
        };
        expect(siteCircuitLengthSplit(circuit, elements, 1)).toMatchObject({ horizontalM: 30, verticalM: 3, totalM: 33 });
        // Por zanja a 0,60 m: + bajada y subida en los extremos (2 × 0,60).
        const trench = siteCircuitLengthSplit(
            { ...circuit, route: { kind: 'underground', depthM: 0.6 }, segmentModes: ['underground'] },
            elements,
            1,
        );
        expect(trench.horizontalM).toBeCloseTo(30, 6);
        expect(trench.verticalM).toBeCloseTo(4.2, 6);
        // La reserva por desperdicio se reparte en proporción.
        const waste = siteCircuitLengthSplit({ ...circuit, wastePct: 10 }, elements, 1);
        expect(waste.horizontalM).toBeCloseTo(33, 6);
        expect(waste.verticalM).toBeCloseTo(3.3, 6);
    });
});

describe('re-trazar un cable', () => {
    const circuit: SiteCircuit = {
        id: 'c1',
        sourceId: 'tg',
        targetId: 'm1',
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        calculatedLengthM: 42,
        wireCount: 4,
        sectionMm2: 16,
        conductorType: 'N2XOH',
        tgOutputId: 'out-2',
        modulePanelId: 'td-01',
        interiorLengthM: 6,
    };

    it('conserva sección, conductor y salida; cambia el recorrido', () => {
        const draft = reroutedCircuitDraft(circuit, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], ['underground', 'underground'], 'm1');
        expect(draft).toMatchObject({ sectionMm2: 16, conductorType: 'N2XOH', tgOutputId: 'out-2', modulePanelId: 'td-01', interiorLengthM: 6 });
        expect(draft.waypoints).toHaveLength(3);
        expect(draft.segmentModes).toEqual(['underground', 'underground']);
        expect('id' in draft).toBe(false);
        expect('calculatedLengthM' in draft).toBe(false);
    });

    it('si llega a OTRO objeto, el tablero del módulo y el recorrido interior anteriores ya no aplican', () => {
        const draft = reroutedCircuitDraft(circuit, [{ x: 0, y: 0 }, { x: 5, y: 5 }], [], 'box');
        expect(draft.targetId).toBe('box');
        expect(draft.modulePanelId).toBeUndefined();
        expect(draft.interiorLengthM).toBeUndefined();
        expect(draft.segmentModes).toBeUndefined();
    });
});
