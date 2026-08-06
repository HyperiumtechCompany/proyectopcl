import { describe, expect, it } from 'vitest';
import { evaluateUGR, guthPositionIndex } from './glareCalculation';
import { buildDefaultObservers, DEFAULT_UGR_EYE_HEIGHT } from './glareObserver';
import type { GlareObserver } from './glareObserver';
import type { Fixture, Room } from './types';

/**
 * Suite de la Fase 9 ("UGR y luminancia profesional", plan maestro §11).
 * Puerta de salida citada por el plan: "los casos UGR soportados cumplen la
 * tolerancia y el informe muestra observador/dirección" — el índice de
 * posición de Guth está marcado `pending-confirmation` (ver
 * `glareCalculation.ts`), así que estos tests verifican invariantes
 * matemáticas exactas de la fórmula (verificables independientemente de si
 * sus coeficientes coinciden letra por letra con CIE 117) y el
 * comportamiento correcto de exclusiones/observadores múltiples, no un
 * valor de referencia externo.
 */

function buildFixture(x: number, y: number, z: number, overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: `fixture-${x}-${y}-${z}`,
        name: 'Luminaria de referencia',
        x,
        y,
        z,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
        ...overrides,
    };
}

function buildObserver(overrides: Partial<GlareObserver> = {}): GlareObserver {
    return { x: 0, y: 0, eyeHeight: 1.2, viewDirectionDeg: 0, ...overrides };
}

const CONSTANT_LB = 100;

describe('Fase 9 — guthPositionIndex: invariantes exactas', () => {
    it('con sigma=0 (fuente exactamente en la línea de visión), el índice es 1 sin importar tau', () => {
        expect(guthPositionIndex(0, 0)).toBe(1);
        expect(guthPositionIndex(45, 0)).toBe(1);
        expect(guthPositionIndex(90, 0)).toBe(1);
    });

    it('con tau=0, el índice crece monótonamente con sigma (más lejos de la línea de visión, más descuento)', () => {
        const p10 = guthPositionIndex(0, 10);
        const p30 = guthPositionIndex(0, 30);
        const p60 = guthPositionIndex(0, 60);

        expect(p10).toBeGreaterThan(1);
        expect(p30).toBeGreaterThan(p10);
        expect(p60).toBeGreaterThan(p30);
    });
});

describe('Fase 9 — evaluateUGR: el índice de posición penaliza fuentes fuera de eje', () => {
    it('una luminaria alineada con la línea de visión produce más UGR que la misma luminaria desplazada 90° en azimut (misma distancia/elevación)', () => {
        const observer = buildObserver({ viewDirectionDeg: 0 }); // mira hacia +x
        const onAxis = [buildFixture(5, 0, 2.2)]; // adelante, alineado con la vista
        const offAxis = [buildFixture(0, 5, 2.2)]; // mismo desplazamiento, pero perpendicular a la vista

        const onAxisResult = evaluateUGR([observer], onAxis, [], () => CONSTANT_LB);
        const offAxisResult = evaluateUGR([observer], offAxis, [], () => CONSTANT_LB);

        expect(onAxisResult.ugr).toBeGreaterThan(offAxisResult.ugr);
    });
});

describe('Fase 9 — condiciones donde UGR no aplica (exclusiones documentadas)', () => {
    it('una luminaria a la altura del ojo o por debajo se excluye (campo visual superior únicamente)', () => {
        const observer = buildObserver();
        const belowEye = [buildFixture(5, 0, 1.0)]; // z=1.0 < eyeHeight=1.2

        const result = evaluateUGR([observer], belowEye, [], () => CONSTANT_LB);

        expect(result.ugr).toBe(0);
        expect(result.excludedFixtureCount).toBe(1);
    });

    it('una luminaria fuera del hemisferio frontal (más de 90° de la dirección de vista, ej. detrás del observador) se excluye', () => {
        // Regresión: sin esta exclusión, la aproximación polinómica de Guth
        // evaluada con sigma≈180° produce un exponente NEGATIVO y el índice
        // de posición colapsa hacia 0 en vez de crecer — eso AMPLIFICA la
        // contribución de una fuente invisible (detrás de la cabeza del
        // observador) en vez de anularla, produciendo un UGR absurdamente
        // alto. Encontrado escribiendo este mismo test.
        const observer = buildObserver({ viewDirectionDeg: 180 }); // mira en -x
        const behindObserver = [buildFixture(5, 0, 2.2)]; // está en +x: detrás del observador

        const result = evaluateUGR([observer], behindObserver, [], () => CONSTANT_LB);

        expect(result.ugr).toBe(0);
        expect(result.excludedFixtureCount).toBe(1);
    });

    it('una luminaria casi directamente encima del observador (H/R > 2) se excluye', () => {
        const observer = buildObserver();
        const almostOverhead = [buildFixture(0.1, 0, 10)]; // horizDist=0.1, dz~8.8 => H/R >> 2

        const result = evaluateUGR([observer], almostOverhead, [], () => CONSTANT_LB);

        expect(result.ugr).toBe(0);
        expect(result.excludedFixtureCount).toBe(1);
    });

    it('una luminaria ocluida por un obstáculo no aporta a la suma (pero no cuenta como "excluida por rango")', () => {
        const observer = buildObserver();
        const fixture = [buildFixture(5, 0, 2.2)];
        // Muro perpendicular a la línea observador→luminaria (que corre a lo
        // largo de X, en y=0): el muro corre a lo largo de Y (angleRad=90°),
        // centrado en x=2 (entre el observador en x=0 y la luminaria en x=5).
        const wall = { originX: 2, originY: -5, angleRad: Math.PI / 2, length: 10, thickness: 0.5, zMin: 0, zMax: 3 };

        const withoutWall = evaluateUGR([observer], fixture, [], () => CONSTANT_LB);
        const withWall = evaluateUGR([observer], fixture, [wall], () => CONSTANT_LB);

        expect(withoutWall.ugr).toBeGreaterThan(0);
        expect(withWall.ugr).toBe(0);
        expect(withWall.excludedFixtureCount).toBe(0); // ocluida, no fuera de rango
    });
});

describe('Fase 9 — evaluateUGR: múltiples observadores/direcciones, reporta el peor caso', () => {
    it('devuelve el UGR máximo y el observador que lo produjo', () => {
        const facingFixture = buildObserver({ viewDirectionDeg: 0 }); // mira hacia la luminaria
        const facingAway = buildObserver({ viewDirectionDeg: 180 }); // mira en sentido opuesto
        const fixtures = [buildFixture(5, 0, 2.2)];

        const result = evaluateUGR([facingAway, facingFixture], fixtures, [], () => CONSTANT_LB);

        expect(result.observer).not.toBeNull();
        expect(result.observer!.viewDirectionDeg).toBe(0);
        expect(result.ugr).toBeGreaterThan(0);
    });

    it('sin observadores, devuelve ugr=0 y observer=null', () => {
        const result = evaluateUGR([], [buildFixture(5, 0, 2.2)], [], () => CONSTANT_LB);
        expect(result.ugr).toBe(0);
        expect(result.observer).toBeNull();
    });
});

describe('Fase 9 — observador en punto medio de pared vs. centroide', () => {
    it('en un ambiente de proporción normal (4×4 m, techo 3 m), el observador de pared SÍ evalúa una luminaria que el centroide excluía', () => {
        const room: Room = {
            id: 'room-normal',
            name: 'Ambiente de proporción normal',
            roomType: 'ambient',
            vertices: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 4 },
                { x: 0, y: 4 },
            ],
            height: 3,
            color: '#000000',
        };
        // Luminaria centrada — con el observador en el centroide (comportamiento
        // viejo) esto disparaba la exclusión H/R>2 (distancia horizontal 0).
        const fixtures = [buildFixture(2, 2, 3)];
        const observers = buildDefaultObservers(room, DEFAULT_UGR_EYE_HEIGHT);

        const result = evaluateUGR(observers, fixtures, [], () => CONSTANT_LB);

        expect(result.fullyExcluded).toBe(false);
        expect(result.excludedFixtureCount).toBe(0);
    });

    it('DOCUMENTA UN GAP CONOCIDO: en un ambiente desproporcionadamente alto y angosto (ej. caseta de control real, 2.1×2.3 m con techo de 4.67 m), NINGÚN punto dentro del ambiente cumple H/R≤2 — el observador de pared reduce pero no elimina el problema', () => {
        const room: Room = {
            id: 'room-caseta',
            name: 'Caseta de Control (geometría real del proyecto de prueba)',
            roomType: 'ambient',
            vertices: [
                { x: 0, y: 0 },
                { x: 2.1, y: 0 },
                { x: 2.1, y: 2.32 },
                { x: 0, y: 2.32 },
            ],
            height: 4.67,
            color: '#000000',
        };
        const fixtures = [buildFixture(0.525, 1.16, 4.67), buildFixture(1.576, 1.16, 4.67)];
        const observers = buildDefaultObservers(room, DEFAULT_UGR_EYE_HEIGHT);

        const result = evaluateUGR(observers, fixtures, [], () => CONSTANT_LB);

        // El DIALux evo real SÍ evalúa UGR para este mismo ambiente/luminarias
        // (RUG=22, Conforme) — nuestro motor sigue marcándolo "no evaluado"
        // incluso con el observador movido a la pared, porque para un techo
        // más de 2x más alto que el ambiente es ancho, la razón H/R (altura
        // del ojo a la luminaria / distancia horizontal) supera 2 desde
        // CUALQUIER punto posible dentro del ambiente, no solo el centroide.
        // Esto sugiere que el criterio H/R>2 en sí (o cómo se mide H aquí)
        // no coincide con el de DIALux real — pendiente de verificar contra
        // fuente primaria antes de tocar el umbral (ver `guthPositionIndex`,
        // ya marcado `pending-confirmation` por el mismo motivo).
        expect(result.fullyExcluded).toBe(true);
    });
});

describe('Fase 9 — robustez numérica', () => {
    it('nunca produce NaN/Infinity ni UGR negativo, incluso con luminaria muy cercana al ojo', () => {
        const observer = buildObserver();
        const veryClose = [buildFixture(0.001, 0, 1.201)];

        const result = evaluateUGR([observer], veryClose, [], () => CONSTANT_LB);

        expect(Number.isFinite(result.ugr)).toBe(true);
        expect(result.ugr).toBeGreaterThanOrEqual(0);
    });

    it('es determinista: la misma entrada produce exactamente la misma salida', () => {
        const observer = buildObserver();
        const fixtures = [buildFixture(5, 0, 2.2), buildFixture(-3, 4, 3)];

        const first = evaluateUGR([observer], fixtures, [], () => CONSTANT_LB);
        const second = evaluateUGR([observer], fixtures, [], () => CONSTANT_LB);

        expect(second.ugr).toBe(first.ugr);
    });
});
