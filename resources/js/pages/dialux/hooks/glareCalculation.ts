import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { isSegmentOccluded } from '@/pages/dialux/domain/geometry/segmentOcclusion';
import { luminousArea } from './directIlluminance';
import type { GlareObserver } from './glareObserver';
import { candela } from './photometricInterpolation';
import type { Fixture } from './types';

/**
 * Fase 9 del plan maestro ("UGR y luminancia profesional", §11). Evalúa UGR
 * con observadores reales (posición/altura/dirección) e índice de posición
 * de Guth, en vez del indicador central aproximado de `direct-preview-v1`
 * (`lightingEngineCore.ts` → `calculateUGR`, que sigue existiendo SIN
 * cambios como camino por defecto — este módulo es un camino nuevo, opcional,
 * que no altera los goldens de Fase 0).
 */

const MATH_PI = Math.PI;

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface UgrResult {
    ugr: number;
    /** Observador/dirección que produjo el peor caso (máximo) — `null` si no hubo ningún observador válido. Plan §11 Fase 9: "reportar máximo y ubicación". */
    observer: GlareObserver | null;
    /** Luminarias excluidas de la suma en el observador ganador (campo visual inferior o fuera del rango de validez H/R — ver `computeUgrForObserver`). */
    excludedFixtureCount: number;
}

/**
 * Aproximación analítica del índice de posición de Guth.
 *
 * ESTADO: `pending-confirmation`. Es la forma cerrada ampliamente reproducida
 * en software e investigación de iluminación como ajuste de las curvas
 * empíricas originales de Guth (Luckiesh & Guth, 1949; Guth, 1963,
 * "A method for the evaluation of discomfort glare", Illuminating
 * Engineering 58(5)), pero sus coeficientes numéricos NO fueron verificados
 * letra por letra contra el texto primario de CIE 117-1995 ("Discomfort
 * Glare in Interior Lighting") en este ciclo — no se pudo acceder a ese
 * documento con las herramientas disponibles. DIALux evo documenta usar una
 * tabla de interpolación (coordenadas R, T, H respecto al observador) en vez
 * de esta fórmula cerrada (fuente: documentación de soporte de DIALux evo,
 * artículo "UGR Verfahren - Unified Glare Rating").
 *
 * NO declarar UGR como "validado" en la matriz de paridad del plan (§23)
 * mientras este estado siga en `pending-confirmation` — un especialista debe
 * confirmar estos coeficientes contra la fuente primaria antes de esa
 * declaración.
 *
 * `tauDeg`: componente horizontal (azimutal) del ángulo entre la línea de
 * visión y la dirección a la fuente. `sigmaDeg`: ángulo total (3D) entre la
 * línea de visión y la fuente. Ambos en grados. Válido solo para fuentes en
 * el campo visual SUPERIOR — ver `computeUgrForObserver`.
 */
export function guthPositionIndex(tauDeg: number, sigmaDeg: number): number {
    const exponent =
        (35.2 - 0.31889 * tauDeg - 1.22 * Math.exp((-2 * tauDeg) / 9)) * 1e-3 * sigmaDeg +
        (21 + 0.26667 * tauDeg - 0.002963 * tauDeg * tauDeg) * 1e-5 * sigmaDeg * sigmaDeg;
    return Math.exp(exponent);
}

function computeUgrForObserver(observer: GlareObserver, fixtures: Fixture[], obstacles: OcclusionBox[], lb: number): { ugr: number; excluded: number } {
    if (lb <= 0) {
        return { ugr: 0, excluded: 0 };
    }

    const viewRad = (observer.viewDirectionDeg * MATH_PI) / 180;
    const view: Vector3 = { x: Math.cos(viewRad), y: Math.sin(viewRad), z: 0 };
    let sum = 0;
    let excluded = 0;

    for (const fixture of fixtures) {
        const dx = fixture.x - observer.x;
        const dy = fixture.y - observer.y;
        const dz = fixture.z - observer.eyeHeight;
        const dist2 = dx * dx + dy * dy + dz * dz;

        if (dist2 < 0.01) {
            continue;
        }

        // El índice de posición de Guth solo está definido en el campo
        // visual SUPERIOR — una fuente a la altura del ojo o por debajo
        // queda fuera del rango válido (plan §11 Fase 9: "documentar
        // condiciones donde UGR no aplica").
        if (dz <= 0) {
            excluded++;
            continue;
        }

        const horizDist = Math.sqrt(dx * dx + dy * dy);
        // H/R > 2 fuera del rango de validez de la tabla de posición —
        // documentado por el soporte de DIALux evo ("Luminaires with a
        // position index outside the validity range of the table are not
        // considered in the UGR calculation. This is the case, for example,
        // in H/R > 2").
        if (horizDist < 1e-6 || dz / horizDist > 2) {
            excluded++;
            continue;
        }

        const dist = Math.sqrt(dist2);
        const dirUnit: Vector3 = { x: dx / dist, y: dy / dist, z: dz / dist };
        const cosSigma = Math.max(-1, Math.min(1, dirUnit.x * view.x + dirUnit.y * view.y + dirUnit.z * view.z));
        const sigmaDeg = (Math.acos(cosSigma) * 180) / MATH_PI;

        // La aproximación analítica de Guth es un ajuste polinómico válido
        // cerca de la línea de visión — evaluada fuera del campo visual
        // frontal (fuente a más de 90° de la dirección de vista, ej.
        // directamente detrás del observador) el exponente se vuelve
        // negativo y el índice de posición COLAPSA hacia 0 en vez de crecer,
        // lo que invierte el efecto físico esperado (amplifica la
        // contribución de una fuente invisible en vez de descartarla).
        // Verificado empíricamente durante el desarrollo de esta fase.
        // Excluir fuentes fuera del hemisferio frontal (`sigma > 90°`) es a
        // la vez la corrección de ese artefacto Y la condición físicamente
        // correcta: una luminaria detrás de la cabeza del observador no está
        // en su campo visual y no puede deslumbrarlo por visión directa
        // (plan §11 Fase 9: "documentar condiciones donde UGR no aplica").
        if (sigmaDeg > 90) {
            excluded++;
            continue;
        }

        // Una luminaria oculta al observador tampoco puede deslumbrarlo.
        if (
            obstacles.length > 0 &&
            isSegmentOccluded({ x: observer.x, y: observer.y, z: observer.eyeHeight }, { x: fixture.x, y: fixture.y, z: fixture.z }, obstacles)
        ) {
            continue;
        }

        const horizUnit = { x: dx / horizDist, y: dy / horizDist };
        const cosTau = Math.max(-1, Math.min(1, horizUnit.x * view.x + horizUnit.y * view.y));
        const tauDeg = (Math.acos(cosTau) * 180) / MATH_PI;

        const positionIndex = guthPositionIndex(tauDeg, sigmaDeg);

        // Ángulo real fixture→observador (misma convención que
        // `illuminanceFromFixture`/el `calculateUGR` heredado) para
        // consultar la matriz fotométrica — es la orientación de la propia
        // luminaria, independiente de hacia dónde mira el observador.
        const gammaDeg = (Math.acos(Math.min(1, Math.max(-1, dz / dist))) * 180) / MATH_PI;
        const rawAzimuthDeg = (Math.atan2(-dy, -dx) * 180) / MATH_PI;
        const azimuthDeg = rawAzimuthDeg - (fixture.rotation ?? 0);

        // `cosGammaObserver` es el escorzo (foreshortening) del área
        // luminosa vista desde el observador — mismo coseno usado para
        // `gammaDeg` (`dz/dist`), reutilizado sin recalcular con acos/cos.
        // Un valor casi 0 significa la luminaria vista casi de canto: el
        // ángulo sólido aparente también tiende a 0 ahí, así que se descarta
        // directamente para evitar una división por un valor casi nulo.
        const cosGammaObserver = Math.max(0, dz / dist);
        if (cosGammaObserver < 1e-6) {
            continue;
        }

        const area = luminousArea(fixture);
        // Luminancia de la superficie emisora: `L = I(γ)/(A·cosγ)`, con el
        // ÁREA PROYECTADA (`A·cosγ`) en el denominador — no el área plana sin
        // escorzar. El `calculateUGR` heredado dividía por `área` sin este
        // escorzo (`candela/area`); combinado con el ángulo sólido aparente
        // de abajo (que SÍ escorza con `cosγ`), esa versión ya subestimaba
        // el término para ángulos oblicuos, y sumarle otro `cosγ` sin
        // corregir la luminancia habría producido un decaimiento neto
        // `cos³γ` en vez del `cosγ` físicamente correcto para una fuente
        // Lambertiana (auditoría `dialux-calc-reviewer` de esta fase,
        // verificado numéricamente: a γ=60° el término sin esta corrección
        // era solo 25% del valor físico esperado).
        const luminance = candela(fixture, gammaDeg, azimuthDeg) / (area * cosGammaObserver);
        // Ángulo sólido APARENTE (plan §11 Fase 9: "implementar ángulo sólido
        // aparente") — la fórmula CIE completa: `ω = A·cosγ/d²`. El
        // `calculateUGR` heredado omitía este escorzo por completo
        // (`area/dist2` sin corrección).
        const apparentSolidAngle = (area * cosGammaObserver) / dist2;
        sum += (luminance * luminance * apparentSolidAngle) / (positionIndex * positionIndex);
    }

    if (sum <= 0) {
        return { ugr: 0, excluded };
    }

    return { ugr: Math.max(0, 8 * Math.log10((0.25 / lb) * sum)), excluded };
}

/**
 * Evalúa UGR en varios observadores/direcciones y reporta el PEOR caso
 * (máximo) junto con el observador que lo produjo (plan §11 Fase 9:
 * "evaluar varios observadores/direcciones" + "reportar máximo y
 * ubicación"). `computeBackgroundLuminance` se invoca por observador porque
 * la luminancia de fondo puede depender de su posición (Eind varía punto a
 * punto cuando hay datos de interreflexión — Fases 7/8).
 */
export function evaluateUGR(
    observers: GlareObserver[],
    fixtures: Fixture[],
    obstacles: OcclusionBox[],
    computeBackgroundLuminance: (observer: GlareObserver) => number,
): UgrResult {
    let best: UgrResult = { ugr: 0, observer: null, excludedFixtureCount: 0 };

    for (const observer of observers) {
        const lb = computeBackgroundLuminance(observer);
        const { ugr, excluded } = computeUgrForObserver(observer, fixtures, obstacles, lb);
        if (best.observer === null || ugr > best.ugr) {
            best = { ugr, observer, excludedFixtureCount: excluded };
        }
    }

    return best;
}
