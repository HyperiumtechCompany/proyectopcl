import { describe, expect, it } from 'vitest';
import type { Conductor, ElectricalDevice, Fixture, JunctionBox, LightSwitch } from '@/pages/dialux/hooks/types';
import { renderConductorEntities, renderFixtureEntities, renderLightSwitchEntities } from './lighting';

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

const FIXTURE: Fixture = {
    id: 'f1', name: 'Panel', x: 0, y: 0, z: 2.8, lumens: 4000, efficiency: 0.8,
    fixtureType: 'panel', lightColor: '#fff5e1',
};
const SWITCH: LightSwitch = {
    id: 's1', x: 0.2, y: 0.2, mountingHeight: 1.4, type: 'single', connectedFixtureIds: ['f1'],
};

describe('renderFixtureEntities / renderLightSwitchEntities', () => {
    it('dibujan el símbolo real de la Fase 5, no un placeholder vacío', () => {
        const out: string[] = [];
        renderFixtureEntities(out, 'LUMINARIAS', 'TEXTO_LUZ', [FIXTURE]);
        renderLightSwitchEntities(out, 'INTERRUPTORES', 'TEXTO_ELEC', [SWITCH]);
        expect(out.length).toBeGreaterThan(0);
        // La descripción de la luminaria (nombre/potencia/montaje) se oculta en
        // planta a pedido del usuario — la leyenda ya la muestra sin caracteres rotos.
        expect(out.join('\n')).not.toContain('Panel');
        expect(countOccurrences(out.join('\n'), '0\nCIRCLE')).toBeGreaterThan(0); // símbolo de luminaria + interruptor
    });

    it('la etiqueta del interruptor sí se dibuja (no tiene descripción larga que ocultar)', () => {
        const out: string[] = [];
        renderLightSwitchEntities(out, 'INTERRUPTORES', 'TEXTO_ELEC', [SWITCH]);
        expect(out.join('\n')).toContain('1\nS');
    });
});

describe('renderConductorEntities — nunca dibuja una LINE recta para un cable (bug reportado por el usuario)', () => {
    it('un conductor "floor" se dibuja como ARC', () => {
        const conductor: Conductor = {
            id: 'c1', sourceId: 's1', targetId: 'f1', wireCount: 2, routeType: 'floor',
            tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const out: string[] = [];
        renderConductorEntities(out, 'CABLEADO', [conductor], [FIXTURE], [SWITCH], [], []);
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nARC')).toBeGreaterThanOrEqual(1);
    });

    it('un conductor "wall_ceiling" TAMBIÉN se dibuja como ARC (curva al revés, nunca recto)', () => {
        // wireCount: 0 aísla el trazo del cable de las marcas de conteo de hilos
        // (esas sí son LINE por diseño — son marcas perpendiculares, no el cable).
        const conductor: Conductor = {
            id: 'c2', sourceId: 's1', targetId: 'f1', wireCount: 0, routeType: 'wall_ceiling',
            tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const out: string[] = [];
        renderConductorEntities(out, 'CABLEADO', [conductor], [FIXTURE], [SWITCH], [], []);
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nARC')).toBe(1);
        expect(countOccurrences(dxf, '0\nLINE')).toBe(0);
    });

    it('resuelve extremos entre TODAS las entidades del nivel, incluyendo un tablero compartido', () => {
        const device: ElectricalDevice = {
            id: 'panel1', type: 'main_panel', x: 5, y: 5, label: 'TG', mountingHeight: 1.8,
            connectedDeviceIds: [], properties: {},
        };
        const conductor: Conductor = {
            id: 'c3', sourceId: 'panel1', targetId: 'f1', wireCount: 3, routeType: 'wall_ceiling',
            tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 4, waypoints: [],
        };
        const jboxes: JunctionBox[] = [];
        const out: string[] = [];
        expect(() => renderConductorEntities(out, 'CABLEADO', [conductor], [FIXTURE], [], [device], jboxes)).not.toThrow();
        expect(out.length).toBeGreaterThan(0);
    });

    it('un extremo sin resolver (id inexistente) se ignora sin fallar', () => {
        const conductor: Conductor = {
            id: 'c4', sourceId: 'ghost', targetId: 'f1', wireCount: 1, routeType: 'floor',
            tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const out: string[] = [];
        expect(() => renderConductorEntities(out, 'CABLEADO', [conductor], [FIXTURE], [], [], [])).not.toThrow();
    });
});
