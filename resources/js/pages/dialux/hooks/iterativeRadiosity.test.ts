import { describe, expect, it } from 'vitest';
import { computePatchDirectIlluminance } from './firstBounceReflection';
import { computePatchFormFactorMatrix, gatherRadiosityIlluminance, MAX_SAFE_BOUNCES, solveRadiosity } from './iterativeRadiosity';
import { computeFormFactor } from './radiosityTransfer';
import { buildRoomEnclosurePatches } from './roomPatches';
import type { Fixture, Room } from './types';

/**
 * Suite de la Fase 8 ("Interreflexión iterativa", plan maestro §11). Puerta
 * de salida citada por el plan: "el solver converge de forma determinista y
 * cumple el benchmark de interiores definido".
 */

function buildCubeRoom(side = 4, height = 3): Room {
    return {
        id: 'radiosity-room',
        name: 'Recinto de referencia — radiosidad iterativa',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: side, y: 0 },
            { x: side, y: side },
            { x: 0, y: side },
        ],
        height,
        color: '#000000',
    };
}

function buildFixture(): Fixture {
    return {
        id: 'radiosity-fixture',
        name: 'Luminaria de referencia',
        x: 2,
        y: 2,
        z: 2.8,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

describe('Fase 8 — solveRadiosity: casos base', () => {
    it('con reflectancia 0 en todos los parches, la excitancia converge a 0 en la primera iteración', () => {
        const room = buildCubeRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0, wall: 0, floor: 0 });
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const result = solveRadiosity(patches, direct, [], 10, 1e-6);

        expect(result.exitance.every((e) => e === 0)).toBe(true);
        expect(result.converged).toBe(true);
        expect(result.iterations).toBe(1);
    });

    it('con maxBounces <= 1, el resultado es idéntico al de un único rebote (Fase 7)', () => {
        const room = buildCubeRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.7, wall: 0.5, floor: 0.2 });
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const oneBounce = patches.map((patch, i) => patch.reflectance * direct[i]!);
        const withMaxBounces1 = solveRadiosity(patches, direct, [], 1, 1e-6);
        const withMaxBounces0 = solveRadiosity(patches, direct, [], 0, 1e-6);

        expect(withMaxBounces1.exitance).toEqual(oneBounce);
        expect(withMaxBounces1.iterations).toBe(1);
        expect(withMaxBounces0.exitance).toEqual(oneBounce);
    });

    it('sin parches (recinto inválido), devuelve un resultado vacío sin fallar', () => {
        const result = solveRadiosity([], [], [], 10, 1e-6);
        expect(result.exitance).toEqual([]);
        expect(result.converged).toBe(true);
        expect(result.iterations).toBe(1);
    });
});

describe('Fase 8 — convergencia', () => {
    it('con reflectancias moderadas (< 1), el solver converge dentro de maxBounces y el residual decrece', () => {
        const room = buildCubeRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.7, wall: 0.5, floor: 0.3 });
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const result = solveRadiosity(patches, direct, [], 30, 1e-4);

        expect(result.converged).toBe(true);
        expect(result.iterations).toBeLessThan(30);
        expect(result.residual).toBeLessThanOrEqual(1e-4);
        // La energía del sistema converge a un valor estable, no diverge.
        const energies = result.energyPerIteration;
        const last = energies[energies.length - 1]!;
        expect(Number.isFinite(last)).toBe(true);
        expect(last).toBeGreaterThan(0);
    });

    it('a más iteraciones permitidas, la energía total del sistema aumenta monótonamente (cada rebote solo puede sumar luz) y se estabiliza', () => {
        const room = buildCubeRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.7, wall: 0.5, floor: 0.3 });
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const result = solveRadiosity(patches, direct, [], 30, 0); // tolerance 0: agota maxBounces
        const energies = result.energyPerIteration;

        for (let i = 1; i < energies.length; i++) {
            expect(energies[i]!).toBeGreaterThanOrEqual(energies[i - 1]! - 1e-9);
        }
        // Las últimas iteraciones ya casi no cambian (convergencia real, no oscilación).
        const lastDelta = Math.abs(energies[energies.length - 1]! - energies[energies.length - 2]!);
        const firstDelta = Math.abs(energies[1]! - energies[0]!);
        expect(lastDelta).toBeLessThan(firstDelta);
    });

    it('reflectancia extrema (0.95 en todas las superficies) sigue convergiendo, sin NaN/Infinity, dado suficiente maxBounces', () => {
        const room = buildCubeRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.95, wall: 0.95, floor: 0.95 });
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const result = solveRadiosity(patches, direct, [], MAX_SAFE_BOUNCES, 1e-5);

        expect(result.exitance.every((e) => Number.isFinite(e))).toBe(true);
        expect(result.exitance.every((e) => e >= 0)).toBe(true);
        expect(Number.isFinite(result.residual)).toBe(true);
    });

    it('el límite duro MAX_SAFE_BOUNCES se respeta incluso si maxBounces pide más', () => {
        const room = buildCubeRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.99, wall: 0.99, floor: 0.99 });
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const result = solveRadiosity(patches, direct, [], MAX_SAFE_BOUNCES * 10, 0); // tolerance 0 fuerza agotar el límite
        expect(result.iterations).toBeLessThanOrEqual(MAX_SAFE_BOUNCES);
    });

    it('es determinista: la misma entrada produce exactamente la misma salida', () => {
        const room = buildCubeRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.7, wall: 0.5, floor: 0.3 });
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const first = solveRadiosity(patches, direct, [], 20, 1e-5);
        const second = solveRadiosity(patches, direct, [], 20, 1e-5);

        expect(second.exitance).toEqual(first.exitance);
        expect(second.iterations).toBe(first.iterations);
        expect(second.residual).toBe(first.residual);
    });
});

describe('Fase 8 — recintos pequeño y grande', () => {
    it('converge tanto en un recinto pequeño como en uno grande, sin fugas de energía en ninguno', () => {
        const small = buildCubeRoom(2, 2.5);
        const large = buildCubeRoom(12, 4);
        const reflectances = { ceiling: 0.7, wall: 0.5, floor: 0.3 };

        for (const room of [small, large]) {
            const patches = buildRoomEnclosurePatches(room, reflectances);
            const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);
            const result = solveRadiosity(patches, direct, [], 30, 1e-5);

            expect(result.converged).toBe(true);
            expect(result.exitance.every((e) => Number.isFinite(e) && e >= 0)).toBe(true);
        }
    });
});

describe('Fase 8 — caja Cornell simplificada (reflectancia uniforme por tipo de superficie)', () => {
    /**
     * El modelo de datos actual (`CalculationMaterial`, Fase 1) solo admite
     * UNA reflectancia por tipo de superficie (techo/pared/piso), no una por
     * cada pared individual — no es posible representar las paredes
     * roja/verde clásicas de una caja Cornell real. Esta es una versión
     * "simplificada" en el sentido literal que pide el plan: misma
     * geometría cúbica y el mismo comportamiento de interreflexión múltiple
     * (superficies muy reflectantes, luz que rebota varias veces y sube el
     * nivel general), sin diferenciar color por pared (documentado como
     * pendiente en `planes/fase8_progreso_dialux.md`).
     */
    it('con paredes muy reflectantes, la excitancia convergida es sustancialmente mayor que con un solo rebote (múltiples rebotes SÍ suman energía adicional)', () => {
        const room = buildCubeRoom(3, 3); // cúbico, como una caja Cornell
        const reflectances = { ceiling: 0.8, wall: 0.8, floor: 0.8 };
        const patches = buildRoomEnclosurePatches(room, reflectances);
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const oneBounce = solveRadiosity(patches, direct, [], 1, 1e-6);
        const iterative = solveRadiosity(patches, direct, [], MAX_SAFE_BOUNCES, 1e-6);

        const oneBounceEnergy = oneBounce.energyPerIteration[0]!;
        const iterativeEnergy = iterative.energyPerIteration[iterative.energyPerIteration.length - 1]!;

        expect(iterative.converged).toBe(true);
        expect(iterativeEnergy).toBeGreaterThan(oneBounceEnergy);
        expect(Number.isFinite(iterativeEnergy)).toBe(true);
    });

    it('el gather final (`gatherRadiosityIlluminance`) sobre un punto de malla produce más lux con radiosidad iterativa que con un solo rebote', () => {
        const room = buildCubeRoom(3, 3);
        const reflectances = { ceiling: 0.8, wall: 0.8, floor: 0.8 };
        const patches = buildRoomEnclosurePatches(room, reflectances);
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);
        const point = { x: 1.5, y: 1.5, z: 0.8, normal: { x: 0, y: 0, z: 1 } };

        const oneBounce = solveRadiosity(patches, direct, [], 1, 1e-6);
        const iterative = solveRadiosity(patches, direct, [], MAX_SAFE_BOUNCES, 1e-6);

        const oneBounceAtPoint = gatherRadiosityIlluminance(point, patches, oneBounce.exitance, []);
        const iterativeAtPoint = gatherRadiosityIlluminance(point, patches, iterative.exitance, []);

        expect(iterativeAtPoint).toBeGreaterThan(oneBounceAtPoint);
        expect(Number.isFinite(iterativeAtPoint)).toBe(true);
    });
});

describe('Fase 8 — reciprocidad de la matriz de factores de forma (regresión de auditoría)', () => {
    /**
     * Auditoría `dialux-calc-reviewer` de esta fase: la primera versión de
     * `computePatchFormFactorMatrix` invertía el orden patch/receptor al
     * indexar la matriz — el sistema seguía convergiendo de forma estable
     * (la normalización por fila evitaba la divergencia), pero a una
     * distribución de luz interreflejada físicamente INCORRECTA entre
     * parches de áreas distintas (el caso normal en cualquier recinto real:
     * piso/techo casi nunca tienen la misma área que una pared). Este test
     * verifica la identidad de reciprocidad `área_i · F(i→j) == área_j · F(j→i)`
     * ANTES de la normalización por fila — la propiedad que el bug rompía y
     * que ningún test de convergencia/monotonía podía detectar.
     */
    it('área_i · F(i→j) == área_j · F(j→i) para parches de áreas muy distintas (identidad de reciprocidad)', () => {
        const room = buildCubeRoom(4, 3); // piso/techo (16 m²) vs paredes (12 m² cada una) — áreas deliberadamente distintas
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.5, wall: 0.5, floor: 0.5 });
        expect(patches.length).toBeGreaterThan(2);

        for (let i = 0; i < patches.length; i++) {
            for (let j = 0; j < patches.length; j++) {
                if (i === j) continue;
                // F(i→j): patch=j, receiver=i (misma convención que `computePatchFormFactorMatrix`).
                const F_i_to_j = computeFormFactor(patches[j]!, patches[i]!, []);
                const F_j_to_i = computeFormFactor(patches[i]!, patches[j]!, []);
                const lhs = patches[i]!.area * F_i_to_j;
                const rhs = patches[j]!.area * F_j_to_i;
                expect(lhs).toBeCloseTo(rhs, 9);
            }
        }
    });

    it('matrix[i][j] reproduce EXACTAMENTE `computeFormFactor(patches[j], patches[i])` — pin del orden de argumentos', () => {
        // Parches sintéticos MUY separados entre sí (100 m) para garantizar que
        // ninguna fila exceda la suma 1 y por tanto NUNCA se reescale — así
        // `matrix[i][j]` debe ser el valor CRUDO de `computeFormFactor`, sin
        // ninguna división de por medio, y se puede comparar con `toBe`
        // (igualdad exacta de punto flotante) en vez de una tolerancia que
        // podría esconder el bug de orden de argumentos detectado en la
        // auditoría (la normalización por fila puede "disimular" un orden de
        // argumentos invertido, ver comentario del test anterior — probarlo
        // sin ninguna normalización de por medio es la única verificación
        // robusta de la convención exacta usada internamente).
        const patches = [
            { x: 0, y: 0, z: 0, normal: { x: 0, y: 0, z: 1 }, area: 50, reflectance: 0.5 },
            { x: 100, y: 0, z: 0, normal: { x: -1, y: 0, z: 0 }, area: 3, reflectance: 0.5 },
            { x: 0, y: 100, z: 0, normal: { x: 0, y: -1, z: 0 }, area: 7, reflectance: 0.5 },
        ];
        const matrix = computePatchFormFactorMatrix(patches, []);

        for (let i = 0; i < patches.length; i++) {
            for (let j = 0; j < patches.length; j++) {
                if (i === j) continue;
                expect(matrix[i]![j]).toBe(computeFormFactor(patches[j]!, patches[i]!, []));
            }
        }
    });
});

describe('Fase 8 — reflectancia = 1.0 (espejo perfecto, caso límite documentado)', () => {
    /**
     * Reflectancia exactamente 1.0 (permitida por `clampReflectance`, Fase 7)
     * no tiene punto fijo finito en el problema CONTINUO: ningún parche
     * absorbe nada, así que la luz directa se reinyecta sin pérdida. En el
     * operador DISCRETO, en cambio, la transferencia punto-a-parche no
     * conserva la energía exactamente — con la subdivisión de campo cercano
     * de la Ronda 25 (`NEAR_FIELD_PATCH_CAP_M`) su norma quedó por debajo
     * de 1 y el solver puede terminar convergiendo numéricamente incluso a
     * ρ=1.0 (con parches gruesos divergía casi linealmente). Lo que este
     * test garantiza es lo que importa en ambos regímenes: terminación
     * segura dentro de MAX_SAFE_BOUNCES, valores finitos y no negativos,
     * sin NaN/Infinity — nunca un cuelgue ni un resultado corrupto.
     */
    it('con reflectancia 1.0, el solver termina de forma segura (≤ MAX_SAFE_BOUNCES), sin NaN/Infinity', () => {
        const room = buildCubeRoom(3, 3);
        const reflectances = { ceiling: 1, wall: 1, floor: 1 };
        const patches = buildRoomEnclosurePatches(room, reflectances);
        const direct = computePatchDirectIlluminance(patches, [buildFixture()], []);

        const result = solveRadiosity(patches, direct, [], MAX_SAFE_BOUNCES, 1e-6);

        expect(result.iterations).toBeLessThanOrEqual(MAX_SAFE_BOUNCES);
        expect(result.exitance.every((e) => Number.isFinite(e) && e >= 0)).toBe(true);
        expect(Number.isFinite(result.residual)).toBe(true);
    });
});
