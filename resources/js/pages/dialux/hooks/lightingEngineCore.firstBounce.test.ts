import { describe, expect, it } from 'vitest';
import { computePatchDirectIlluminance } from './firstBounceReflection';
import { calculateLightingResult, GRID_SPACING } from './lightingEngineCore';
import { buildRoomEnclosurePatches } from './roomPatches';
import type { Fixture, Room } from './useEditorStore';

/**
 * Suite de la Fase 7 ("Materiales e interreflexión inicial", plan maestro
 * §11). Puerta de salida citada por el plan: "reflectancia 0 reproduce
 * cálculo directo; casos de primera reflexión cumplen tolerancia acordada"
 * — se prueba end-to-end a través de `calculateLightingResult` (API
 * pública), igual que las suites de Fases 5/6.
 */

function buildRoom(side = 4, height = 3): Room {
    return {
        id: 'first-bounce-room',
        name: 'Recinto de referencia — primera reflexión',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: side, y: 0 },
            { x: side, y: side },
            { x: 0, y: side },
        ],
        height,
        color: '#000000',
        usefulPlaneHeight: 0.8,
    };
}

function buildCentralFixture(z = 2.8): Fixture {
    return {
        id: 'first-bounce-fixture',
        name: 'Luminaria de referencia',
        x: 2,
        y: 2,
        z,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

describe('Fase 7 — reflectancia 0 reproduce el cálculo directo exactamente', () => {
    it('sin surfaceReflectances (default null) el resultado es idéntico al de antes de esta fase', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const withoutParam = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const withExplicitEmpty = calculateLightingResult(room, [fixture], GRID_SPACING, [], null);
        expect(withExplicitEmpty.avg_lux).toBe(withoutParam.avg_lux);
        expect(withExplicitEmpty.grid_values).toEqual(withoutParam.grid_values);
    });

    it('pasar { ceiling: 0, wall: 0, floor: 0 } produce el mismo resultado que no pasar reflectancias', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const direct = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const withZeroReflectance = calculateLightingResult(room, [fixture], GRID_SPACING, [], { ceiling: 0, wall: 0, floor: 0 });
        expect(withZeroReflectance.avg_lux).toBe(direct.avg_lux);
        expect(withZeroReflectance.min_lux).toBe(direct.min_lux);
        expect(withZeroReflectance.max_lux).toBe(direct.max_lux);
        expect(withZeroReflectance.grid_values).toEqual(direct.grid_values);
    });
});

describe('Fase 7 — primera reflexión difusa: reflectancias crecientes', () => {
    it('reflectancias > 0 SIEMPRE aumentan (o igualan) la iluminancia respecto al cálculo directo', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const direct = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const reflected = calculateLightingResult(room, [fixture], GRID_SPACING, [], { ceiling: 0.7, wall: 0.5, floor: 0.2 });

        expect(reflected.avg_lux).toBeGreaterThan(direct.avg_lux);
        expect(reflected.min_lux).toBeGreaterThanOrEqual(direct.min_lux);
        expect(reflected.max_lux).toBeGreaterThanOrEqual(direct.max_lux);
        expect(Number.isFinite(reflected.avg_lux)).toBe(true);
    });

    it('a más reflectancia, más contribución reflejada — relación monótona creciente', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const low = calculateLightingResult(room, [fixture], GRID_SPACING, [], { ceiling: 0.3, wall: 0.2, floor: 0.1 });
        const high = calculateLightingResult(room, [fixture], GRID_SPACING, [], { ceiling: 0.8, wall: 0.6, floor: 0.3 });

        expect(high.avg_lux).toBeGreaterThan(low.avg_lux);
    });

    it('reflectancias fuera de rango (>1) se recortan — no producen energía infinita ni negativa', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const clamped = calculateLightingResult(room, [fixture], GRID_SPACING, [], { ceiling: 5, wall: 5, floor: 5 });
        const atOne = calculateLightingResult(room, [fixture], GRID_SPACING, [], { ceiling: 1, wall: 1, floor: 1 });

        expect(clamped.avg_lux).toBe(atOne.avg_lux);
        expect(Number.isFinite(clamped.avg_lux)).toBe(true);
        expect(clamped.avg_lux).toBeGreaterThan(0);
    });
});

describe('Fase 7 — oclusión también aplica a la primera reflexión', () => {
    /**
     * Recinto de exactamente `GRID_SPACING x GRID_SPACING` (truco heredado de
     * Fase 5/6): produce una malla de 1x1 con un único punto de cálculo, para
     * controlar la posición exacta del punto.
     */
    function buildSinglePointRoom(): Room {
        return {
            id: 'first-bounce-occlusion-room',
            name: 'Punto de referencia — oclusión + reflexión',
            roomType: 'ambient',
            vertices: [
                { x: 0, y: 0 },
                { x: GRID_SPACING, y: 0 },
                { x: GRID_SPACING, y: GRID_SPACING },
                { x: 0, y: GRID_SPACING },
            ],
            height: 3,
            color: '#000000',
            usefulPlaneHeight: 0,
        };
    }

    function buildExternalFixture(): Fixture {
        return {
            id: 'first-bounce-occlusion-fixture',
            name: 'Fuente externa (otro lado del muro)',
            x: GRID_SPACING / 2,
            y: GRID_SPACING / 2 + 3,
            z: 2,
            lumens: 4000,
            efficiency: 1,
            fixtureType: 'panel',
            lightColor: '#ffffff',
        };
    }

    it('un muro que bloquea TODA la luz que entra al recinto también bloquea la primera reflexión (no hay fuga de energía)', () => {
        const room = buildSinglePointRoom();
        const fixture = buildExternalFixture();
        const wall = { originX: -1, originY: 1.5, angleRad: 0, length: GRID_SPACING + 2, thickness: 0.2, zMin: 0, zMax: 3 };
        const reflectances = { ceiling: 0.7, wall: 0.5, floor: 0.2 };

        // Sin muro: la fuente externa ilumina el recinto directamente y, con
        // reflectancias > 0, también genera primera reflexión.
        const withoutWall = calculateLightingResult(room, [fixture], GRID_SPACING, [], reflectances);
        expect(withoutWall.avg_lux).toBeGreaterThan(0);

        // Con el muro: ni el punto de cálculo NI los parches de la envolvente
        // (que también son parte del mismo recinto cerrado) reciben ninguna
        // luz de la fuente externa — la reflexión no puede fabricar energía
        // que nunca entró.
        const withWall = calculateLightingResult(room, [fixture], GRID_SPACING, [wall], reflectances);
        expect(withWall.avg_lux).toBe(0);
    });
});

describe('Fase 7 — conservación de energía en campo cercano (regresión de auditoría)', () => {
    /**
     * Un parche representa una superficie COMPLETA (una pared entera, todo
     * el piso) tratada como fuente puntual en su centroide — válido en campo
     * lejano, pero un punto de malla cercano a un parche grande (recinto
     * angosto) puede caer en su campo cercano. Sin límite físico, esa
     * cercanía puede hacer que la reflexión de UN SOLO parche aporte más luz
     * de la que ese parche recibió — viola conservación de energía (hallazgo
     * `dialux-calc-reviewer`, corregido acotando el término de ángulo sólido
     * a `π`, el máximo físico de la integral hemisférica de un emisor
     * Lambertiano). Este test reproduce el recinto angosto (1m × 6m) que
     * disparó el defecto.
     */
    function buildNarrowRoom(): Room {
        return {
            id: 'narrow-room-energy-conservation',
            name: 'Recinto angosto — regresión de conservación de energía',
            roomType: 'ambient',
            vertices: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 6 },
                { x: 0, y: 6 },
            ],
            height: 3,
            color: '#000000',
            usefulPlaneHeight: 0.8,
        };
    }

    it('la reflexión de cada punto nunca excede la cota física Σ(E_directa_parche · reflectancia_parche)', () => {
        const room = buildNarrowRoom();
        // Centrada y muy cerca del techo (2.8 de 3m de altura): la caja
        // ceiling-patch queda a solo 0.2m de la luminaria — el escenario que
        // reprodujo el desborde reportado por la auditoría (comprobado
        // ejecutando este mismo caso sin el clamp de `firstBounceReflection.ts`:
        // producía una componente reflejada de ~586 lux contra una cota física
        // de ~337 lux).
        const fixture: Fixture = {
            id: 'narrow-room-fixture',
            name: 'Luminaria de referencia',
            x: 0.5,
            y: 3,
            z: 2.8,
            lumens: 3000,
            efficiency: 1,
            fixtureType: 'panel',
            lightColor: '#ffffff',
        };
        const reflectances = { ceiling: 0.7, wall: 0.7, floor: 0.5 };

        const direct = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const reflected = calculateLightingResult(room, [fixture], GRID_SPACING, [], reflectances);

        // Misma malla (mismo recinto/spacing) en ambas corridas: se puede
        // comparar índice a índice para aislar la componente reflejada de
        // cada punto de malla, no solo el promedio.
        const patches = buildRoomEnclosurePatches(room, reflectances);
        const patchIlluminance = computePatchDirectIlluminance(patches, [fixture], []);
        const energyBound = patches.reduce((sum, patch, i) => sum + patchIlluminance[i]! * patch.reflectance, 0);

        expect(reflected.grid_values.length).toBe(direct.grid_values.length);
        for (let i = 0; i < reflected.grid_values.length; i++) {
            const directValue = direct.grid_values[i];
            const reflectedValue = reflected.grid_values[i];
            if (directValue === null || reflectedValue === null) {
                continue;
            }
            const reflectedComponent = reflectedValue - directValue;
            expect(reflectedComponent).toBeLessThanOrEqual(energyBound + 1e-6);
        }
    });
});
