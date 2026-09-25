import { pointInPolygon } from './geometry';
import type { RampFlight, SiteElement } from './types';

/**
 * Valores de REFERENCIA normativa del emplazamiento (rampas, muros de
 * contención). Ninguno está confirmado por un especialista: el estado de cada
 * fila vive en `.claude/skills/normativa-dialux/references/normativa.md` §5c.
 * Por eso los evaluadores de este archivo NUNCA devuelven "cumple": solo
 * "dentro del valor de referencia" o "revisar". Nada de esto sustituye la
 * firma de un ingeniero colegiado responsable.
 */
export const SITE_NORM_STATUS = 'pending-confirmation' as const;

export const RAMP_NORM = {
    source: 'RNE Norma Técnica A.120, Art. 6',
    /** Hay dos versiones con valores distintos; se usa la MÁS ESTRICTA (ver §5c). */
    note: 'Versión RM 072-2019: 12 % (hasta 0.25 m), 10 % (0.26-0.75 m), 8 % (0.76-1.20 m). Versión posterior: 10 % (hasta 0.30 m), 8 % (0.31-0.72 m), tramo máx. 9.00 m. Sin confirmar cuál rige para este proyecto.',
    minWidthM: 1.0,
    maxFlightLengthM: 9.0,
    landingLengthM: 1.5,
    maxTransverseSlopePct: 2,
    handrailHeightM: 0.9,
    /** Diferencia de nivel de UN tramo → pendiente máxima. */
    slopeTable: [
        { upToRiseM: 0.3, maxSlopePct: 10 },
        { upToRiseM: 0.72, maxSlopePct: 8 },
    ],
} as const;

export const RETAINING_NORM = {
    source: 'RNE Norma Técnica E.050 (RM 406-2018-VIVIENDA)',
    /** Muros de contención de más de esta altura, o cercos perimétricos sin EMS, exigen Estudio de Mecánica de Suelos (num. 6.2.1 g). */
    emsRequiredAboveM: 2.0,
    /** Factores de seguridad mínimos de muro y de talud (39.13.6 y 30.3): estático / sísmico. */
    minSafetyStatic: 1.5,
    minSafetySeismic: 1.25,
} as const;

export interface NormFinding {
    level: 'info' | 'review';
    text: string;
}

/** Pendiente máxima (%) para un tramo según su desnivel; `null` si el desnivel no figura en el cuadro (> 0.72 m: usar varios tramos o medios mecánicos). */
export function rampMaxSlopePct(riseM: number): number | null {
    const rise = Math.abs(riseM);
    for (const row of RAMP_NORM.slopeTable) {
        if (rise <= row.upToRiseM + 1e-9) return row.maxSlopePct;
    }
    return null;
}

/**
 * Tramos reglamentarios para salvar `totalRiseM`: cada tramo sube como máximo
 * lo que permite el cuadro (0.72 m ⇒ 9.00 m al 8 %), con descanso plano de
 * 1.50 m entre tramos y giro de 180° (vuelta en U) para que la rampa quede
 * compacta.
 */
export function planRampFlights(
    totalRiseM: number,
    startId = Date.now(),
): RampFlight[] {
    const total = Math.abs(totalRiseM);
    if (total < 1e-6) return [];
    const maxRise = RAMP_NORM.slopeTable[RAMP_NORM.slopeTable.length - 1].upToRiseM;
    const count = Math.max(1, Math.ceil(total / maxRise - 1e-9));
    const riseEach = totalRiseM / count;
    const slopePct = rampMaxSlopePct(riseEach) ?? 8;
    const lengthM = Math.abs(riseEach) / (slopePct / 100);
    return Array.from({ length: count }, (_, i) => ({
        id: `flight-plan-${startId}-${i}`,
        direction: 'north' as const,
        lengthM: Math.round(lengthM * 100) / 100,
        riseM: Math.round(riseEach * 1000) / 1000,
        landingLengthM: i < count - 1 ? RAMP_NORM.landingLengthM : 0,
        turnAfterDeg: i < count - 1 ? 180 : 0,
    }));
}

export interface RampNormInput {
    widthM: number;
    fromElevationM: number;
    toElevationM: number;
    flights?: RampFlight[];
    /** Recorrido (m) de la rampa de un solo tramo, cuando no hay `flights`. */
    singleRunM?: number;
    /** Descanso de llegada (m); ausente = 1.50 m por defecto. */
    arrivalLandingM?: number;
}

export function evaluateRamp(input: RampNormInput): NormFinding[] {
    const findings: NormFinding[] = [];
    const review = (text: string) => findings.push({ level: 'review', text });
    if (input.widthM < RAMP_NORM.minWidthM - 1e-9) {
        review(
            `Ancho ${input.widthM.toFixed(2)} m: el mínimo de referencia es ${RAMP_NORM.minWidthM.toFixed(2)} m incluyendo pasamanos.`,
        );
    }
    const flights = input.flights ?? [];
    if (flights.length > 0) {
        const sum = flights.reduce((acc, f) => acc + f.riseM, 0);
        const target = input.toElevationM - input.fromElevationM;
        if (Math.abs(sum - target) > 0.005) {
            review(
                `Los tramos suman ${sum.toFixed(2)} m pero la cota destino exige ${target.toFixed(2)} m: la rampa termina ${Math.abs(target - sum).toFixed(2)} m ${sum < target ? 'por debajo' : 'por encima'} de la plataforma.`,
            );
        }
        if ((input.arrivalLandingM ?? RAMP_NORM.landingLengthM) < RAMP_NORM.landingLengthM - 1e-9) {
            review(
                `Descanso de llegada menor a ${RAMP_NORM.landingLengthM.toFixed(2)} m: debe haber un tramo plano que conecte con la plataforma siguiente.`,
            );
        }
        flights.forEach((flight, index) => {
            const label = `Tramo ${index + 1}`;
            const rise = Math.abs(flight.riseM);
            const allowed = rampMaxSlopePct(rise);
            if (flight.lengthM > RAMP_NORM.maxFlightLengthM + 1e-9) {
                review(
                    `${label}: ${flight.lengthM.toFixed(2)} m supera el tramo máximo de ${RAMP_NORM.maxFlightLengthM.toFixed(2)} m.`,
                );
            }
            if (allowed === null) {
                review(
                    `${label}: desnivel ${rise.toFixed(2)} m no figura en el cuadro de pendientes (máx. ${RAMP_NORM.slopeTable[1].upToRiseM} m).`,
                );
            } else if (flight.lengthM > 0) {
                const slope = (rise / flight.lengthM) * 100;
                if (slope > allowed + 0.05) {
                    review(
                        `${label}: pendiente ${slope.toFixed(1)} % supera el ${allowed} % de referencia.`,
                    );
                }
            }
            const isLast = index === flights.length - 1;
            if (!isLast && (flight.landingLengthM ?? 0) < RAMP_NORM.landingLengthM - 1e-9) {
                review(
                    `${label}: falta descanso plano de ${RAMP_NORM.landingLengthM.toFixed(2)} m antes del siguiente tramo.`,
                );
            }
        });
    } else {
        const rise = Math.abs(input.toElevationM - input.fromElevationM);
        const allowed = rampMaxSlopePct(rise);
        if (rise > RAMP_NORM.slopeTable[1].upToRiseM + 1e-9) {
            review(
                `Desnivel ${rise.toFixed(2)} m en un solo tramo: el cuadro llega a ${RAMP_NORM.slopeTable[1].upToRiseM} m. Usa "Generar tramos reglamentarios".`,
            );
        } else if (allowed !== null && input.singleRunM && input.singleRunM > 0) {
            const slope = (rise / input.singleRunM) * 100;
            if (slope > allowed + 0.05) {
                review(
                    `Pendiente ${slope.toFixed(1)} % supera el ${allowed} % de referencia.`,
                );
            }
        }
        if ((input.singleRunM ?? 0) > RAMP_NORM.maxFlightLengthM + 1e-9) {
            review(
                `Recorrido ${input.singleRunM?.toFixed(2)} m supera el tramo máximo de ${RAMP_NORM.maxFlightLengthM.toFixed(2)} m.`,
            );
        }
    }
    if (findings.length === 0) {
        findings.push({
            level: 'info',
            text: 'Dentro de los valores de referencia de A.120 (sin confirmar por especialista).',
        });
    }
    return findings;
}

/**
 * Desnivel máximo entre una plataforma y las plataformas vecinas que tocan
 * su borde (un vértice de una dentro de la otra) — es la altura del muro de
 * contención / talud que las separa.
 */
export function platformRetentionDropM(
    platform: SiteElement,
    all: SiteElement[],
): number {
    const top = platform.baseElevationM ?? 0;
    let maxDrop = 0;
    for (const other of all) {
        if (other.id === platform.id || other.type !== 'terrace_platform') continue;
        const touches =
            platform.vertices.some((v) => pointInPolygon(v, other.vertices)) ||
            other.vertices.some((v) => pointInPolygon(v, platform.vertices));
        if (!touches) continue;
        maxDrop = Math.max(maxDrop, Math.abs(top - (other.baseElevationM ?? 0)));
    }
    return maxDrop;
}

export function evaluatePlatformRetention(dropM: number): NormFinding[] {
    if (dropM < 1e-6) return [];
    const findings: NormFinding[] = [];
    if (dropM > RETAINING_NORM.emsRequiredAboveM + 1e-9) {
        findings.push({
            level: 'review',
            text: `Desnivel de ${dropM.toFixed(2)} m con la plataforma vecina: un muro de contención de más de ${RETAINING_NORM.emsRequiredAboveM.toFixed(2)} m exige Estudio de Mecánica de Suelos firmado por el profesional responsable (${RETAINING_NORM.source}, num. 6.2.1 g).`,
        });
    }
    findings.push({
        level: 'info',
        text: `Muro/talud de contención: factor de seguridad mínimo ${RETAINING_NORM.minSafetyStatic} (estático) y ${RETAINING_NORM.minSafetySeismic} (sísmico), con drenaje (E.050 39.13.6, 39.13.8, 30.3). El ángulo de talud del modelo es geométrico, no un análisis de estabilidad.`,
    });
    return findings;
}

/** Valores de referencia de escalera exterior: los ya citados en el código (`hooks/stairNorms.ts`, preset vivienda RNE A.010) y A.120 Art. 6-7 para pasamanos. Sin confirmar por especialista. */
export const STAIR_NORM = {
    source: 'RNE A.010 (valores ya citados en hooks/stairNorms.ts) + A.120 Art. 6-7',
    maxRiserM: 0.175,
    minTreadM: 0.28,
    minWidthM: 0.9,
    handrailHeightM: 0.9,
    maxStepsBeforeLanding: 18,
    /** Huella con la que se generan los tramos (≥ minTreadM). */
    treadM: 0.3,
    /** Fondo mínimo de descanso (≥ ancho de la escalera). */
    landingM: 1.2,
} as const;

/** Peldaños necesarios para salvar un desnivel sin pasar la contrahuella de referencia. */
export function stairStepCount(riseM: number): number {
    return Math.max(1, Math.ceil(Math.abs(riseM) / STAIR_NORM.maxRiserM - 1e-9));
}

/**
 * Tramos de una escalera para salvar `totalRiseM`: los peldaños se reparten
 * en tramos de a lo sumo `maxSteps`, con un descanso plano entre ellos.
 * `shape`: 'straight' = tramos en línea; 'L' = giro de 90°; 'U' = vuelta de
 * 180° (mismo modelo que la rampa: cada tramo queda al lado del anterior).
 */
export function planStairFlights(
    totalRiseM: number,
    widthM: number,
    maxSteps: number = STAIR_NORM.maxStepsBeforeLanding,
    shape: 'straight' | 'L' | 'U' = 'straight',
    /** Escalera recta continua: UN tramo con todos los peldaños y sin descanso intermedio. */
    continuous = false,
    /** Fondo del descanso (m); ausente = el mayor entre `widthM` y el mínimo de referencia. */
    landingDepthM?: number,
): RampFlight[] {
    const turn = continuous ? 0 : shape === 'U' ? 180 : shape === 'L' ? 90 : 0;
    const total = Math.abs(totalRiseM);
    if (total < 1e-6) return [];
    const steps = stairStepCount(total);
    const count = continuous ? 1 : Math.max(1, Math.ceil(steps / Math.max(1, maxSteps)));
    const riser = totalRiseM / steps;
    return Array.from({ length: count }, (_, i) => {
        const n = Math.floor(steps / count) + (i < steps % count ? 1 : 0);
        const last = i === count - 1;
        return {
            id: `stair-flight-${i}`,
            direction: 'east' as const,
            lengthM: Math.round(n * STAIR_NORM.treadM * 100) / 100,
            riseM: Math.round(riser * n * 1000) / 1000,
            landingLengthM: last
                ? 0
                : (landingDepthM ?? Math.max(widthM, STAIR_NORM.landingM)),
            turnAfterDeg: last ? 0 : turn,
        };
    });
}

export function evaluateStair(input: {
    fromElevationM: number;
    toElevationM: number;
    widthM: number;
    maxStepsPerFlight?: number;
    shape?: 'straight' | 'L' | 'U';
    /** Escalera recta continua (sin descansos intermedios). */
    continuous?: boolean;
    /** Fondo del descanso configurado (m). */
    landingDepthM?: number;
    /** Huella real (m); si falta se usa la con la que se generan los tramos. */
    treadM?: number;
}): NormFinding[] {
    const findings: NormFinding[] = [];
    const rise = Math.abs(input.toElevationM - input.fromElevationM);
    if (rise < 1e-6) {
        return [
            {
                level: 'review',
                text: 'Cota origen y destino iguales: la escalera no salva ningún desnivel.',
            },
        ];
    }
    const steps = stairStepCount(rise);
    const riser = rise / steps;
    const tread = input.treadM ?? STAIR_NORM.treadM;
    const flights = planStairFlights(
        rise,
        input.widthM,
        input.maxStepsPerFlight ?? STAIR_NORM.maxStepsBeforeLanding,
        input.shape,
        input.continuous,
    ).length;
    if (tread < STAIR_NORM.minTreadM - 1e-9) {
        findings.push({
            level: 'review',
            text: `Huella de ${tread.toFixed(2)} m < ${STAIR_NORM.minTreadM} m de referencia.`,
        });
    }
    if (
        !input.continuous &&
        input.landingDepthM !== undefined &&
        input.landingDepthM < input.widthM - 1e-9
    ) {
        findings.push({
            level: 'review',
            text: `Descanso de ${input.landingDepthM.toFixed(2)} m de fondo < ${input.widthM.toFixed(2)} m de ancho de la escalera: la referencia pide un descanso al menos tan profundo como el ancho.`,
        });
    }
    if (input.widthM < STAIR_NORM.minWidthM - 1e-9) {
        findings.push({
            level: 'review',
            text: `Ancho ${input.widthM.toFixed(2)} m < ${STAIR_NORM.minWidthM.toFixed(2)} m de referencia.`,
        });
    }
    if (input.continuous && steps > STAIR_NORM.maxStepsBeforeLanding) {
        findings.push({
            level: 'review',
            text: `Escalera continua de ${steps} peldaños: pasa de los ${STAIR_NORM.maxStepsBeforeLanding} seguidos de referencia; considera un descanso intermedio.`,
        });
    }
    if (
        !input.continuous &&
        (input.maxStepsPerFlight ?? STAIR_NORM.maxStepsBeforeLanding) > STAIR_NORM.maxStepsBeforeLanding
    ) {
        findings.push({
            level: 'review',
            text: `Más de ${STAIR_NORM.maxStepsBeforeLanding} peldaños seguidos: la referencia pide descanso antes.`,
        });
    }
    if (findings.length === 0) {
        findings.push({
            level: 'info',
            text: `${steps} peldaños de ${(riser * 100).toFixed(1)} cm de contrahuella y ${(tread * 100).toFixed(0)} cm de huella, en ${flights} tramo${flights > 1 ? 's con descanso' : input.continuous ? ' recto continuo' : ''}: dentro de la referencia (sin confirmar por especialista).`,
        });
    }
    return findings;
}
