import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildAllDialuxEvoParityFixtures, type DialuxEvoParityFixture } from './fixtures';

/**
 * Benchmark de paridad contra DIALux evo real —
 * `planes/plan_cierre_brecha_paridad_dialux_evo.md` §5.1/§5.2.
 *
 * QUÉ SÍ AFIRMA este test (robusto a la falta de fotometría real, ver
 * `fixtures.ts`):
 *   1. Un ambiente sin reflectancia asignada calcula en luz 100% directa y
 *      emite `object-without-material-reflectance` — regresión de la Causa A
 *      documentada en el plan. Si esto deja de ser cierto, algo relacionado
 *      con la resolución de materiales cambió sin querer.
 *   2. Asignar la MISMA reflectancia que DIALux evo declaró para el ambiente
 *      real acerca el resultado a la referencia — nunca lo aleja. Esto es
 *      cierto incluso con una aproximación Lambertiana de fotometría, porque
 *      la dirección del efecto (más luz reflejada → más lux) no depende de
 *      la forma exacta de la curva fotométrica.
 *
 * QUÉ NO AFIRMA: un porcentaje de error objetivo tipo "≤5%". Sin el archivo
 * IES/LDT real de fábrica, ninguna cifra de error absoluto de este test es
 * comparable a las tolerancias de
 * `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §10.3 — esas
 * tolerancias son para cuando SÍ hay fotometría real de por medio.
 *
 * HALLAZGO ORIGINAL al correr esto por primera vez (dejar registrado, no
 * borrar): con AMBAS luminarias en aproximación Lambertiana, el error
 * absoluto medido fue MUCHO mayor de lo esperado (46.7% y 71.5%, no el
 * ~10-15% que sugería la investigación de `productionCalculationConfig.ts`
 * para un caso análogo). La causa NO era principalmente first-bounce vs.
 * DIALux evo (Causa B del plan) — era que ambas luminarias reales concentran
 * intensidad muy por encima de lo que un emisor Lambertiano ideal predice a
 * igual flujo total (picos ~2-3x mayores, ver `fixtures.ts`).
 *
 * ACTUALIZACIÓN (2026-08-09): se consiguió el .ldt REAL de TEG18046 (ver
 * `realPhotometry.ts`) y `sshh-vs-bano` ya lo usa. Con fotometría real, su
 * error bajó de 71.5% a 38.9% — confirma la hipótesis (la fotometría
 * faltante era el factor dominante).
 *
 * ACTUALIZACIÓN (2026-08-18): el usuario entregó su catálogo real de
 * luminarias usadas en proyectos reales; `caseta-vs-guarderias` ahora
 * también usa fotometría real de fábrica (`GF19140_SUBSTITUTE_PHOTOMETRIC_WEB`,
 * ver procedencia completa en `realPhotometry.ts` — es un sustituto real,
 * no la Thorlux GF19140 exacta, que sigue sin conseguirse). Con AMBOS
 * fixtures en fotometría real, y usando la config de producción real
 * (`buildProductionCalculationConfig`, `interreflection: 'auto-by-shape'`),
 * los errores medidos hoy son:
 *
 *   - `sshh-vs-bano` (aspecto 2.33:1 → auto-by-shape elige first-bounce):
 *     **16.7%** (antes 38.9%). El modo `iterative` (informativo, no es el
 *     default) da **5.2%** para este mismo caso — mejor que first-bounce,
 *     lo opuesto de lo que predecía la investigación histórica de
 *     `productionCalculationConfig.ts` (basada en un SS.HH DISTINTO,
 *     proyecto "Módulo 22", con datos LDT distintos). No se cambió el
 *     default de producción por esto — un caso nuevo no es evidencia
 *     suficiente para revisar el umbral 2.0:1 ya elegido (mismo criterio
 *     "no sobreajustar a un solo caso" del plan) — pero queda registrado
 *     como evidencia a favor de revisar el umbral con más casos reales.
 *   - `caseta-vs-guarderias` (aspecto ~1.05:1 → auto-by-shape elige
 *     iterative): **11.0%** (antes 46.7%, y antes de eso etiquetado "no
 *     comparable" por falta de fotometría real).
 *
 * ACTUALIZACIÓN (Ronda 21n, mismo día): el **1.3%** que esta sección citaba
 * hasta hace un momento para `caseta-vs-guarderias` era un artefacto de OTRO
 * bug, ya corregido (`hooks/adaptiveGridSpacing.ts::resolveMeshSpacing`,
 * ver su doc-comment) — con malla adaptativa (`meshPolicy.adaptive`, el
 * default de producción), la zona marginal REAL declarada por este fixture
 * (`room.marginalZone: 0.35`, la misma que DIALux evo declara para este
 * ambiente) quedaba SILENCIOSAMENTE ignorada y reemplazada por
 * `spacingM/2` (≈0.11-0.15 m, sin relación con la norma) — el 1.3% medía el
 * resultado con un margen equivocado, no el margen real. Corregido el bug,
 * ahora SÍ se respeta `room.marginalZone: 0.35` — el 11.0% es la cifra
 * honesta. Verificado en paralelo contra un proyecto real sin ningún
 * override manual ("Vinchos"): la misma corrección mejoró Emin de 181 a
 * 280 lx (DIALux evo: 302) y Uo de 0.30 a 0.44 (DIALux evo: 0.53) — el fix
 * es correcto y ya demostró beneficio real; que ESTE fixture puntual quede
 * peor no es motivo para revertirlo (no hay que "ajustar hacia atrás" un
 * bug real solo porque un caso synthetic se veía mejor con él activo).
 * Queda como brecha real sin cerrar, no oculta.
 *
 * `MAX_PLAUSIBLE_RELATIVE_ERROR` (cota floja, no de precisión) se mantiene
 * en 0.85 sin cambios — solo existe para atrapar una regresión grosera (ej.
 * un error de unidades, NaN, o un resultado 10x fuera de rango).
 */

const MAX_PLAUSIBLE_RELATIVE_ERROR = 0.85;

function buildProjectForFixture(fixture: DialuxEvoParityFixture, withReflectance: boolean): Project {
    const room: Room = {
        ...fixture.room,
        ceilingReflectance: withReflectance ? fixture.reflectance.ceiling : undefined,
        wallReflectance: withReflectance ? fixture.reflectance.wall : undefined,
        floorReflectance: withReflectance ? fixture.reflectance.floor : undefined,
    };

    const scene: Scene = {
        id: `${fixture.id}-scene`,
        name: 'Nivel único',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: room.height,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: fixture.fixtures,
        lightSwitches: [],
        partitions: [],
    };

    return {
        id: `${fixture.id}-project`,
        name: fixture.label,
        created_at: '2026-08-09T00:00:00.000Z',
        updated_at: '2026-08-09T00:00:00.000Z',
        scenes: [scene],
    };
}

function relativeError(computed: number, reference: number): number {
    return Math.abs(computed - reference) / reference;
}

describe.each(buildAllDialuxEvoParityFixtures())(
    'Paridad DIALux evo — $label',
    (fixture: DialuxEvoParityFixture) => {
        it('sin reflectancia asignada: calcula en luz 100% directa y advierte la Causa A (object-without-material-reflectance)', async () => {
            const project = buildProjectForFixture(fixture, false);
            const { run } = await runProjectLightingCalculation(project, buildProductionCalculationConfig(project));

            expect(run.warnings.map((w) => w.code)).toContain('object-without-material-reflectance');
        });

        it('con la MISMA reflectancia que DIALux evo declaró: el resultado se acerca a la referencia, nunca se aleja', async () => {
            const withoutReflectance = buildProjectForFixture(fixture, false);
            const withReflectance = buildProjectForFixture(fixture, true);

            const config = buildProductionCalculationConfig(withReflectance);
            const directOnlyRun = await runProjectLightingCalculation(withoutReflectance, config);
            const withReflectanceRun = await runProjectLightingCalculation(withReflectance, config);

            const directOnlyAvg = Object.values(directOnlyRun.resultsByRoom)[0]!.avg_lux;
            const withReflectanceAvg = Object.values(withReflectanceRun.resultsByRoom)[0]!.avg_lux;

            const errorDirectOnly = relativeError(directOnlyAvg, fixture.reference.avgLux);
            const errorWithReflectance = relativeError(withReflectanceAvg, fixture.reference.avgLux);

            // Fase D del cierre de brechas (`dialux-calc-reviewer`): sin
            // fotometría real, el % de error de este fixture no mide
            // precisión del motor — mide la aproximación Lambertiana contra
            // un perfil real más concentrado (ver doc-comment de arriba).
            // Reportarlo sin esta etiqueta se lee como una cifra de
            // precisión del motor, que no es lo que es.
            const comparabilityTag = fixture.hasRealPhotometry
                ? ''
                : ' · NO COMPARABLE (sin fotometría real — ver caveats)';

            // eslint-disable-next-line no-console
            console.log(
                `[dialux-evo-parity] ${fixture.id}: referencia=${fixture.reference.avgLux} lx · ` +
                    `directo=${directOnlyAvg.toFixed(1)} lx (error ${(errorDirectOnly * 100).toFixed(1)}%) · ` +
                    `con reflectancia=${withReflectanceAvg.toFixed(1)} lx (error ${(errorWithReflectance * 100).toFixed(1)}%) · ` +
                    `fuente=${fixture.referenceSource}${comparabilityTag}`,
            );

            // Afirmación robusta (Causa A): reflectancia declarada acerca el
            // resultado a DIALux evo, sin importar la aproximación fotométrica.
            expect(errorWithReflectance).toBeLessThan(errorDirectOnly);

            // Cota floja (NO una tolerancia de precisión, ver doc-comment del
            // archivo): solo para atrapar una regresión grosera.
            expect(errorWithReflectance).toBeLessThan(MAX_PLAUSIBLE_RELATIVE_ERROR);

            if (errorWithReflectance > 0.15) {
                // El ~5-12% de `plan_cierre_brecha_paridad_dialux_evo.md`
                // §2.2/§3 asume fotometría real — con la aproximación
                // Lambertiana de este fixture (ver hallazgo en el
                // doc-comment de arriba) un error mayor NO indica por sí
                // solo una regresión del motor.
                // eslint-disable-next-line no-console
                console.warn(
                    `[dialux-evo-parity] ${fixture.id}: error residual ${(errorWithReflectance * 100).toFixed(1)}% ` +
                        `— esperado mientras no haya fotometría real (ver doc-comment). Caveats: ${fixture.caveats.join(' | ')}`,
                );
            }
        });

        /**
         * Investigación de la Causa B (`plan_cierre_brecha_paridad_dialux_evo.md`
         * §2.2/§5.4) con una variable que la investigación original de
         * `productionCalculationConfig.ts` NO controlaba: fotometría real.
         * Solo corre para fixtures con `hasRealPhotometry: true` — comparar
         * modos de interreflexión con la aproximación Lambertiana mezclaría
         * el error de fotometría con el de modelo de reflexión y no
         * demostraría nada.
         *
         * NO se usa para decidir el default de producción por sí solo (un
         * único fixture no es evidencia suficiente — el propio plan §7
         * prohíbe "cerrar esta brecha ajustando... para que un solo caso
         * cuadre"). Se deja como dato registrado para cuando haya más casos
         * con fotometría real.
         */
        (fixture.hasRealPhotometry ? it : it.skip)(
            'con fotometría real: compara first-bounce vs. iterative contra la referencia (informativo, no decide el default de producción)',
            async () => {
                const project = buildProjectForFixture(fixture, true);

                const firstBounceRun = await runProjectLightingCalculation(project, {
                    ...buildProductionCalculationConfig(project),
                    interreflection: 'first-bounce',
                });
                const iterativeRun = await runProjectLightingCalculation(project, {
                    ...buildProductionCalculationConfig(project),
                    interreflection: 'iterative',
                    maxBounces: 30,
                    convergenceTolerance: 1e-6,
                });

                const firstBounceAvg = Object.values(firstBounceRun.resultsByRoom)[0]!.avg_lux;
                const iterativeAvg = Object.values(iterativeRun.resultsByRoom)[0]!.avg_lux;
                const errorFirstBounce = relativeError(firstBounceAvg, fixture.reference.avgLux);
                const errorIterative = relativeError(iterativeAvg, fixture.reference.avgLux);

                // eslint-disable-next-line no-console
                console.log(
                    `[dialux-evo-parity][causa-b] ${fixture.id}: referencia=${fixture.reference.avgLux} lx · ` +
                        `first-bounce=${firstBounceAvg.toFixed(1)} lx (error ${(errorFirstBounce * 100).toFixed(1)}%) · ` +
                        `iterative=${iterativeAvg.toFixed(1)} lx (error ${(errorIterative * 100).toFixed(1)}%)`,
                );

                // Sin aserción de "cuál modo es mejor" a propósito: el
                // objetivo de este test es dejar el número registrado y
                // visible en cada corrida, no fijar una expectativa sobre
                // qué debería ganar — eso es precisamente lo que todavía se
                // está investigando.
            },
        );
    },
);
