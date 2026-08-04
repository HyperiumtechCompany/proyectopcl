import { describe, expect, it } from 'vitest';
import { DEFAULT_UGR_EYE_HEIGHT } from './glareObserver';
import { calculateLightingResult, GRID_SPACING } from './lightingEngineCore';
import type { Fixture, Room } from './useEditorStore';

/**
 * Suite de la Fase 9 ("UGR y luminancia profesional", plan maestro §11) al
 * nivel de la API pública `calculateLightingResult` — la suite de más bajo
 * nivel (`evaluateUGR`/`guthPositionIndex`) vive en `glareCalculation.test.ts`.
 */

function buildRoom(side = 4, height = 3): Room {
    return {
        id: 'glare-wiring-room',
        name: 'Recinto de referencia — UGR con observadores',
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

function buildFixture(): Fixture {
    return {
        // Descentrada a propósito (no en (2,2), el centroide de `buildRoom()`
        // donde se ubican los 4 observadores por defecto): una luminaria
        // exactamente encima del observador tiene distancia horizontal 0,
        // lo que la excluye por la regla H/R>2 (ver `glareCalculation.ts`).
        id: 'glare-wiring-fixture',
        name: 'Luminaria de referencia',
        x: 3,
        y: 2,
        z: 2.8,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

describe('Fase 9 — compatibilidad hacia atrás', () => {
    it('sin glareConfig (default null), el resultado es idéntico al calculateUGR heredado (sin campos ugr_observer_*)', () => {
        const room = buildRoom();
        const fixture = buildFixture();
        const withoutParam = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const withExplicitNull = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, null, null);

        expect(withExplicitNull.ugr).toBe(withoutParam.ugr);
        expect(withExplicitNull.ugr_observer_x).toBeUndefined();
        expect(withExplicitNull.ugr_observer_view_direction_deg).toBeUndefined();
        expect(withExplicitNull.ugr_excluded_fixture_count).toBeUndefined();
    });
});

describe('Fase 9 — glareConfig activa el camino de observadores de Guth', () => {
    it('con glareConfig: {}, usa los observadores por defecto y reporta el observador ganador', () => {
        const room = buildRoom();
        const fixture = buildFixture();
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, null, {});

        expect(result.ugr_observer_x).toBeCloseTo(2, 9); // centroide del recinto 4x4
        expect(result.ugr_observer_y).toBeCloseTo(2, 9);
        expect(result.ugr_observer_eye_height).toBe(DEFAULT_UGR_EYE_HEIGHT);
        expect([0, 90, 180, 270]).toContain(result.ugr_observer_view_direction_deg);
        expect(result.ugr_excluded_fixture_count).toBeDefined();
    });

    it('acepta observadores personalizados', () => {
        const room = buildRoom();
        const fixture = buildFixture();
        const customObserver = { x: 1, y: 1, eyeHeight: 1.5, viewDirectionDeg: 45 };
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, null, { observers: [customObserver] });

        expect(result.ugr_observer_x).toBe(1);
        expect(result.ugr_observer_y).toBe(1);
        expect(result.ugr_observer_eye_height).toBe(1.5);
        expect(result.ugr_observer_view_direction_deg).toBe(45);
    });

    it('con interreflexión activa, más reflectancia sube la luminancia de fondo (Eind real en el ojo del observador) y por tanto BAJA el UGR', () => {
        const room = buildRoom();
        const fixture = buildFixture();
        // Comparar DOS niveles de reflectancia (ambos con interreflexión
        // activa), no "sin reflectancia" contra "con reflectancia": activar
        // `surfaceReflectances` cambia el MÉTODO de cálculo de Lb por
        // completo (de `avg/π`, el promedio directo+indirecto de toda la
        // malla, a `Eind/π`, la iluminancia indirecta real en el punto del
        // observador) — son magnitudes distintas por construcción, así que
        // comparar "método viejo" contra "método nuevo" no aísla el efecto
        // de subir la reflectancia. Con el MISMO método (Eind/π) en ambas
        // corridas, más reflectancia → más Eind → más Lb → menos UGR es la
        // comparación causal correcta y universalmente válida.
        const lowReflectances = { ceiling: 0.1, wall: 0.1, floor: 0.1 };
        const highReflectances = { ceiling: 0.8, wall: 0.8, floor: 0.8 };
        const observer = { x: 0.5, y: 0.5, eyeHeight: 1.2, viewDirectionDeg: (Math.atan2(2 - 0.5, 3 - 0.5) * 180) / Math.PI };

        const withLowReflectances = calculateLightingResult(room, [fixture], GRID_SPACING, [], lowReflectances, null, { observers: [observer] });
        const withHighReflectances = calculateLightingResult(room, [fixture], GRID_SPACING, [], highReflectances, null, { observers: [observer] });

        expect(withHighReflectances.ugr).toBeLessThan(withLowReflectances.ugr);
    });
});
