import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import type { SurfacePoint } from './directIlluminance';
import { computeFormFactor, patchExitanceTransferToPoint } from './radiosityTransfer';
import type { EnclosurePatch } from './roomPatches';

/**
 * Fase 8 del plan maestro ("Interreflexión iterativa", §11). Método elegido:
 * radiosidad por "gathering" iterativo (Gauss-Seidel) sobre los MISMOS
 * parches gruesos de la Fase 7 (un parche por superficie completa — el plan
 * reserva "refinar superficies adaptativamente" como trabajo pendiente, ver
 * `planes/fase8_progreso_dialux.md`): cada parche recibe, en cada iteración,
 * la luz directa de las luminarias MÁS lo que le transfieren todos los demás
 * parches según su excitancia más reciente.
 *
 * Convención de la matriz de factores de forma (`computePatchFormFactorMatrix`):
 * `matrix[i][j] = F(i→j)` — fracción del flujo emitido por `patches[i]` que
 * llega a `patches[j]`, usando la notación estándar de radiosidad. Por eso
 * `matrix[i][j]` se calcula con `computeFormFactor(patches[j], patches[i])`
 * (`radiosityTransfer.ts` define `computeFormFactor(patch, receiver)` como
 * "fracción del hemisferio de `receiver` que ocupa `patch`" — para obtener
 * `F(i→j)` hay que pasar `patch=j, receiver=i`, JUSTO AL REVÉS de lo que el
 * orden de los índices `[i][j]` sugeriría a primera vista; auditoría
 * `dialux-calc-reviewer` de esta fase detectó y corrigió el orden invertido
 * en la primera versión, verificado con la identidad de reciprocidad
 * `área_i · F(i→j) == área_j · F(j→i)` en `iterativeRadiosity.test.ts`).
 *
 * Cada FILA se normaliza para sumar como máximo 1
 * (`Σ_j F(i→j) ≤ 1`): la aproximación punto-a-parche es razonable en campo
 * lejano, pero en un recinto pequeño/cerrado varios parches cercanos pueden,
 * cada uno por separado, aparentar cubrir una fracción grande del hemisferio
 * del emisor — sin normalizar, la SUMA de fracciones hacia distintos
 * receptores puede superar el 100% del flujo del emisor. Como cada parche SÍ
 * realimenta el sistema en la siguiente iteración (a diferencia del "gather"
 * a un punto de malla, que es un sumidero), ese exceso se compone
 * geométricamente iteración tras iteración — comprobado empíricamente: sin
 * normalizar, un cubo con reflectancia uniforme (0.8) diverge (la energía
 * crece exponencialmente en vez de converger). `Σ_j F(i→j) ≤ 1` es
 * exactamente la condición físicamente correcta (un parche no puede repartir
 * más del 100% de su propio flujo entre sus receptores) y, junto con
 * reflectancia `< 1`, es la condición suficiente estándar para garantizar
 * convergencia de Gauss-Seidel (acota la suma de cada fila de la matriz de
 * iteración por `reflectancia_i < 1`).
 *
 * Con `maxBounces <= 1` el resultado es idéntico al de un único rebote
 * (Fase 7) — mismo patrón no disruptivo de fases anteriores.
 */

/**
 * Límite duro de iteraciones — "limitar rebotes, tiempo y memoria" (plan §11
 * Fase 8). Ningún llamador puede forzar más trabajo que esto, sin importar
 * `maxBounces`. El costo real es trivial incluso en este valor (recintos
 * típicos tienen ~10 parches, así que 300 iteraciones son ~10² × 300 = 30 000
 * operaciones, microsegundos) — se eligió 300, no un número menor, porque
 * reflectancias altas (0.9-0.95), comunes en acabados claros de interiores
 * reales, necesitan de 60 a más de 150 iteraciones para converger a una
 * tolerancia de 1e-6 (verificado empíricamente durante el desarrollo de esta
 * fase); un límite más bajo dejaría "no convergido" precisamente el rango de
 * reflectancia donde más importa converger bien.
 */
export const MAX_SAFE_BOUNCES = 300;

export interface RadiosityResult {
    /** Excitancia convergida (o truncada) de cada parche, en el mismo orden que `patches` — lista para usar en `gatherRadiosityIlluminance`. */
    exitance: number[];
    /** Iteraciones realmente ejecutadas (>=1; 1 equivale al resultado de la Fase 7). */
    iterations: number;
    /** Residual relativo MÁXIMO entre todos los parches en la última iteración — ver `computeMaxRelativeResidual`. */
    residual: number;
    /** `true` si `residual <= convergenceTolerance` antes de agotar `maxBounces`. */
    converged: boolean;
    /** Energía total del sistema (Σ excitancia·área) en cada iteración — "registrar energía por iteración" (plan §11 Fase 8). */
    energyPerIteration: number[];
}

/**
 * Matriz de factores de forma parche→parche (ver convención en el comentario
 * del módulo), con cada fila normalizada para sumar como máximo 1.
 * `matrix[i][j] = F(i→j)`, 0 en la diagonal (un parche plano no se
 * autoilumina).
 */
export function computePatchFormFactorMatrix(patches: EnclosurePatch[], obstacles: OcclusionBox[]): number[][] {
    const n = patches.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

    for (let i = 0; i < n; i++) {
        let rowSum = 0;
        for (let j = 0; j < n; j++) {
            if (j === i) {
                continue;
            }
            // F(i→j): fracción del hemisferio de i que ocupa j. `computeFormFactor(patch, receiver)`
            // devuelve F(receiver→patch), así que para F(i→j) hay que llamar con patch=j, receiver=i.
            const formFactor = computeFormFactor(patches[j]!, patches[i]!, obstacles);
            matrix[i]![j] = formFactor;
            rowSum += formFactor;
        }
        if (rowSum > 1) {
            for (let j = 0; j < n; j++) {
                matrix[i]![j] = matrix[i]![j]! / rowSum;
            }
        }
    }

    return matrix;
}

/** Energía reflejada total del sistema (proporcional al flujo luminoso total emitido por los parches, en lux·m²) — "registrar energía por iteración" (plan §11 Fase 8). */
function computeSystemEnergy(patches: EnclosurePatch[], exitance: number[]): number {
    let energy = 0;
    for (let i = 0; i < patches.length; i++) {
        energy += exitance[i]! * patches[i]!.area;
    }
    return energy;
}

/**
 * Residual relativo MÁXIMO entre todos los parches (no un agregado
 * ponderado por área) — un criterio agregado (ej. energía total del
 * sistema) puede reportar "converged" mientras un parche pequeño (área
 * chica, poco peso en el agregado) todavía cambia de forma significativa;
 * el máximo por parche detecta ese caso (auditoría `dialux-calc-reviewer`
 * de esta fase).
 */
function computeMaxRelativeResidual(previous: number[], next: number[]): number {
    let maxResidual = 0;
    for (let i = 0; i < next.length; i++) {
        const prev = previous[i]!;
        const curr = next[i]!;
        const relative = prev > 1e-9 ? Math.abs(curr - prev) / prev : curr > 1e-9 ? 1 : 0;
        if (relative > maxResidual) {
            maxResidual = relative;
        }
    }
    return maxResidual;
}

/**
 * Resuelve la excitancia de cada parche por radiosidad iterativa.
 *
 * `directIlluminance[i]` es la iluminancia DIRECTA de las luminarias sobre
 * `patches[i]` (fija durante toda la iteración — las luminarias no cambian
 * entre rebotes). `maxBounces <= 1` devuelve el resultado de un solo rebote
 * sin iterar (idéntico a `firstBounceIlluminance` de la Fase 7).
 */
export function solveRadiosity(
    patches: EnclosurePatch[],
    directIlluminance: number[],
    obstacles: OcclusionBox[],
    maxBounces: number,
    convergenceTolerance: number,
): RadiosityResult {
    const n = patches.length;
    const safeMaxBounces = Math.min(Math.max(1, Number.isFinite(maxBounces) ? Math.floor(maxBounces) : 1), MAX_SAFE_BOUNCES);
    const safeTolerance = Number.isFinite(convergenceTolerance) ? Math.max(0, convergenceTolerance) : 0;

    // Rebote 1: cada parche solo refleja la luz directa que recibió — mismo
    // resultado que la Fase 7 (`firstBounceIlluminance`), sin ningún parche
    // recibiendo todavía lo que reflejan los demás.
    let exitance = patches.map((patch, i) => patch.reflectance * directIlluminance[i]!);
    const energyPerIteration = [computeSystemEnergy(patches, exitance)];

    if (n === 0 || safeMaxBounces <= 1 || energyPerIteration[0] === 0) {
        return { exitance, iterations: 1, residual: 0, converged: true, energyPerIteration };
    }

    const formFactorMatrix = computePatchFormFactorMatrix(patches, obstacles);
    let converged = false;
    let residual = Infinity;
    let iterations = 1;

    for (let bounce = 1; bounce < safeMaxBounces; bounce++) {
        const previousExitance = exitance;
        exitance = exitance.slice();

        // Gauss-Seidel, no Jacobi: cada parche usa la excitancia YA
        // actualizada de los parches anteriores en este mismo barrido (no la
        // congelada de la iteración previa) — converge más rápido.
        for (let i = 0; i < n; i++) {
            let incident = directIlluminance[i]!;
            for (let j = 0; j < n; j++) {
                if (j === i) {
                    continue;
                }
                incident += exitance[j]! * formFactorMatrix[i]![j]!;
            }
            exitance[i] = patches[i]!.reflectance * incident;
        }

        energyPerIteration.push(computeSystemEnergy(patches, exitance));
        residual = computeMaxRelativeResidual(previousExitance, exitance);
        iterations = bounce + 1;

        if (residual <= safeTolerance) {
            converged = true;
            break;
        }
    }

    return { exitance, iterations, residual, converged, energyPerIteration };
}

/**
 * Reúne la contribución de radiosidad (excitancia ya convergida o truncada
 * por `solveRadiosity`) sobre un punto de malla — "gather" final, análogo a
 * `firstBounceIlluminance` de la Fase 7 pero usando la excitancia total del
 * sistema en vez de un único rebote directo.
 */
export function gatherRadiosityIlluminance(
    point: SurfacePoint,
    patches: EnclosurePatch[],
    exitance: number[],
    obstacles: OcclusionBox[],
): number {
    let sum = 0;
    for (let i = 0; i < patches.length; i++) {
        sum += patchExitanceTransferToPoint(point, patches[i]!, exitance[i]!, obstacles);
    }
    return sum;
}
