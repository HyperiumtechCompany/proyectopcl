import type { Fixture, Project, Room, Scene } from '@/pages/dialux/hooks/types';

/**
 * Proyecto sintético con UN recinto grande (10x10 m) y UNA sola luminaria
 * pegada a una esquina — a diferencia de las fixtures de Fase 0
 * (`hooks/__fixtures__/fase0SmallFixture.ts`, 4 luminarias en grilla
 * simétrica, luz bastante pareja), esto garantiza un gradiente real de
 * iluminancia dentro del mismo recinto. Usado para probar el espaciado de
 * malla adaptativo (`hooks/adaptiveGridSpacing.ts`).
 */
export function buildGradientProject(): Project {
    const room: Room = {
        id: 'gradient-room',
        name: 'Recinto con gradiente',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        illuminanceLux: 300,
        norma: 300,
    };
    const fixtures: Fixture[] = [
        {
            id: 'gradient-fixture-1',
            name: 'Panel LED',
            x: 0.5,
            y: 0.5,
            z: 2.9,
            lumens: 3000,
            efficiency: 0.8,
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lightColor: '#ffffff',
            roomId: 'gradient-room::ambient-1',
            power: 30,
        },
    ];
    const scene: Scene = {
        id: 'gradient-scene',
        name: 'Nivel único',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures,
        lightSwitches: [],
        partitions: [],
    };
    return {
        id: 'gradient-project',
        name: 'Proyecto con gradiente',
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
        scenes: [scene],
    };
}
