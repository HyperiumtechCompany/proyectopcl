import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import type { Fixture, Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildCasetaVsGuarderiasFixture, buildSsHhVsBanoFixture } from './fixtures';
import { buildAllPolygonShapeFixtures } from './radianceOracle/polygonShapeFixtures';
import { buildAllShapeVariationFixtures } from './radianceOracle/shapeVariationFixtures';

/**
 * Ronda 21c (`planes/plan_cierre_brecha_paridad_dialux_evo.md`): cierre
 * acotado de la Fase 9 (UGR profesional, `informe_brechas_evaluaciones_calculos_dialux.md`
 * §5.6 "benchmark con tolerancia acordada"). El algoritmo (observadores
 * reales, área proyectada, ángulo sólido aparente, índice de Guth,
 * luminancia de fondo, exclusiones documentadas) ya estaba implementado
 * completo desde la Fase 15 — lo que faltaba era un benchmark de INTEGRACIÓN
 * (motor de producción real, no funciones aisladas) sobre los fixtures del
 * benchmark de paridad, con valores fijados como regresión.
 *
 * No existe todavía una referencia de DIALux evo real NO-manual para
 * comparar con tolerancia numérica (ver `glareCalculation.test.ts` — "DOCUMENTA
 * UN GAP CONOCIDO" — para el único caso real conocido donde DIALux evo SÍ
 * calculó UGR y nuestro motor lo excluye, `pending-confirmation` hasta
 * verificar contra la fuente primaria CIE 117 o soporte DIAL directo). Este
 * archivo, por eso, fija dos garantías verificables HOY sin esa fuente:
 *
 * 1. Para geometrías dentro del rango de validez H/R≤2 (la mayoría de
 *    ambientes de proporción normal), el motor SÍ calcula un UGR real,
 *    finito, en un rango físicamente razonable, con observador/dirección
 *    reportados — puerta de salida de Fase 9 ("los casos soportados cumplen
 *    la tolerancia y el informe muestra observador/dirección").
 * 2. Para las geometrías desproporcionadas ya conocidas (recintos muy
 *    angostos/altos, los 2 fixtures núcleo de este mismo plan), el motor
 *    SIGUE marcando "no evaluado" de forma consistente — bloquea que una
 *    regresión futura calcule un número ahí en silencio, sin resolver
 *    primero el gap ya documentado.
 */

function roomFromShapeVariation(fixture: ReturnType<typeof buildAllShapeVariationFixtures>[number]): { room: Room; fixtures: Fixture[] } {
    return {
        room: { ...fixture.room, ceilingReflectance: fixture.reflectance.ceiling, wallReflectance: fixture.reflectance.wall, floorReflectance: fixture.reflectance.floor },
        fixtures: fixture.fixtures,
    };
}

function roomFromPolygonShape(fixture: ReturnType<typeof buildAllPolygonShapeFixtures>[number]): { room: Room; fixtures: Fixture[] } {
    const room: Room = {
        id: fixture.id,
        name: fixture.label,
        roomType: 'ambient',
        vertices: fixture.vertices,
        height: fixture.height,
        color: '#000000',
        illuminanceLux: 100,
        usefulPlaneHeight: fixture.workingPlaneHeight,
        marginalZone: fixture.marginalZone,
        ceilingReflectance: fixture.reflectance.ceiling,
        wallReflectance: fixture.reflectance.wall,
        floorReflectance: fixture.reflectance.floor,
    };
    return { room, fixtures: fixture.fixtures };
}

async function computeUgr(id: string, room: Room, fixtures: Fixture[]) {
    const scene: Scene = {
        id: `${id}-scene`,
        name: 'n',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: room.height,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'm', calibrationFactor: 1, isCalibrated: true },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures,
        lightSwitches: [],
        partitions: [],
    };
    const project: Project = { id: `${id}-project`, name: id, created_at: '', updated_at: '', scenes: [scene] };
    const config = buildProductionCalculationConfig(project);
    const { resultsByRoom } = await runProjectLightingCalculation(project, config);
    return Object.values(resultsByRoom)[0]!;
}

describe('Benchmark de integración — UGR (Fase 9, motor de producción real)', () => {
    describe('geometrías dentro del rango de validez H/R≤2: UGR se calcula, no queda "no evaluado"', () => {
        const shapeVariation = buildAllShapeVariationFixtures();
        const polygonShapes = buildAllPolygonShapeFixtures();
        // Regresión: valores medidos el 2026-08-18 con el motor real
        // (`buildDefaultObservers` + `evaluateUGR`) — si cambian, debe ser
        // por un cambio DELIBERADO del solver, nunca silencioso.
        //
        // Actualizado en Ronda 21i (cambio deliberado documentado): la
        // luminancia de fondo de UGR usa Eind/π cuando hay interreflexión
        // activa (ver el warning `ugr-background-luminance-method-changed`
        // en `runDirectPreviewEngine.ts`), y `buildProductionCalculationConfig`
        // ahora resuelve `interreflection: 'auto-by-shape'` en vez de
        // `'first-bounce'` fijo — para las 4 formas compactas de abajo
        // (aspecto bounding-box < 2.0:1) eso activa `iterative`, bajando el
        // UGR reportado (~13-15% menos) frente a los valores congelados con
        // `first-bounce`. `long-corridor` (elongado, aspecto ≥ 2.0:1) sigue
        // en `first-bounce` y su valor no cambió.
        const knownUgr: Record<string, number> = {
            'long-corridor': 11.58,
            'large-square': 11.17,
            'l-shape': 13.36,
            'chamfered-pentagon': 12.62,
            trapezoid: 13.32,
        };

        const cases = [
            ...shapeVariation.filter((f) => f.id !== 'small-dark-square').map((f) => ({ id: f.id, ...roomFromShapeVariation(f) })),
            ...polygonShapes.map((f) => ({ id: f.id, ...roomFromPolygonShape(f) })),
        ];

        it.each(cases)('$id: UGR calculado, finito, en rango físico razonable, con observador reportado', async ({ id, room, fixtures }) => {
            const result = await computeUgr(id, room, fixtures);

            expect((result as any).ugr_not_evaluated).toBe(false);
            expect((result as any).ugr_excluded_fixture_count).toBe(0);
            expect(Number.isFinite(result.ugr)).toBe(true);
            // Techo generoso (35): CIE 117 típicamente reporta UGR en 10-30
            // para instalaciones reales; no es una cota física estricta, es
            // una cota de sanidad contra un resultado degenerado.
            expect(result.ugr).toBeGreaterThan(0);
            expect(result.ugr).toBeLessThan(35);
            expect((result as any).ugr_observer_x).toBeTypeOf('number');
            expect((result as any).ugr_observer_y).toBeTypeOf('number');
            expect((result as any).ugr_observer_eye_height).toBeCloseTo(1.2, 5);

            const known = knownUgr[id];
            if (known !== undefined) {
                expect(result.ugr).toBeCloseTo(known, 1);
            }
        });
    });

    describe('geometrías desproporcionadas (altas/angostas): "no evaluado" es el comportamiento correcto documentado, no un bug', () => {
        it('sshh-vs-bano (2.209×0.950 m, montaje 3.5 m): UGR no evaluado, 1 luminaria excluida por H/R>2', async () => {
            const fixture = buildSsHhVsBanoFixture();
            const room: Room = { ...fixture.room, ceilingReflectance: fixture.reflectance.ceiling, wallReflectance: fixture.reflectance.wall, floorReflectance: fixture.reflectance.floor };
            const result = await computeUgr(fixture.id, room, fixture.fixtures);

            expect((result as any).ugr_not_evaluated).toBe(true);
            expect((result as any).ugr_excluded_fixture_count).toBe(1);
            expect(result.ugr).toBe(0);
        });

        it('caseta-vs-guarderias (2.1×2.21 m, montaje 3.5 m): UGR no evaluado, 1 luminaria excluida por H/R>2', async () => {
            const fixture = buildCasetaVsGuarderiasFixture();
            const room: Room = { ...fixture.room, ceilingReflectance: fixture.reflectance.ceiling, wallReflectance: fixture.reflectance.wall, floorReflectance: fixture.reflectance.floor };
            const result = await computeUgr(fixture.id, room, fixture.fixtures);

            expect((result as any).ugr_not_evaluated).toBe(true);
            expect((result as any).ugr_excluded_fixture_count).toBe(1);
            expect(result.ugr).toBe(0);
        });

        it('small-dark-square (1.3×1.3 m, techo 2.6 m): UGR no evaluado, 1 luminaria excluida por H/R>2', async () => {
            const fixture = buildAllShapeVariationFixtures().find((f) => f.id === 'small-dark-square')!;
            const { room, fixtures } = roomFromShapeVariation(fixture);
            const result = await computeUgr(fixture.id, room, fixtures);

            expect((result as any).ugr_not_evaluated).toBe(true);
            expect((result as any).ugr_excluded_fixture_count).toBe(1);
            expect(result.ugr).toBe(0);
        });
    });
});
