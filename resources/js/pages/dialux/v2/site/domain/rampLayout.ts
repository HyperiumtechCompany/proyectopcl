import { pointInPolygon } from './geometry';
import { RAMP_NORM, STAIR_NORM, planStairFlights } from './siteNorms';
import type {
    Point2D,
    RampConfig,
    RampFlight,
    SiteElement,
    StairConfig,
} from './types';

export interface FlightSegment3D {
    id: string;
    kind: 'flight' | 'landing';
    /** 'arrival' = descanso de llegada (borde del fondo abierto); 'through' = descanso en línea (el camino sigue: fondo abierto); 'turn' = vuelta en U (fondo cerrado); 'corner' = giro de 90° (fondo cerrado y un lado abierto, ver openSide). */
    role?: 'turn' | 'arrival' | 'through' | 'corner';
    /** Solo para 'corner' (giro de 90°): lado (±1 sobre la perpendicular al avance) por el que sale el tramo siguiente — sin baranda. */
    openSide?: 1 | -1;
    startLocal: { x: number; z: number }; // metros, plano local centrado en (0,0)
    endLocal: { x: number; z: number };
    startY: number; // metros, relativos al inicio de la rampa (0 = fromElevationM)
    endY: number;
    widthM: number;
}

const DIRECTION_ANGLE: Record<RampFlight['direction'], number> = {
    north: -90,
    south: 90,
    east: 0,
    west: 180,
};

/** Separación entre tramos paralelos de una vuelta en U (muro/ojo intermedio), en metros. */
export const U_TURN_GAP_M = 0.2;

/**
 * Layout de una rampa recta de uno o varios tramos con giros, centrado en
 * (0,0) — coordenadas locales en metros, Y relativa al inicio (0 =
 * `fromElevationM`). Sin `flights` configurados genera un único tramo
 * sintético que cubre todo el desnivel (`toElevationM - fromElevationM`),
 * equivalente al comportamiento clásico de una rampa de un solo tramo.
 *
 * Una vuelta en U (giro de ±180°) NO regresa por la misma línea: el tramo
 * siguiente queda AL LADO del anterior (ancho + separación), unidos por un
 * descanso que abarca ambos tramos (A.120 Art. 6 g) y de al menos
 * `RAMP_NORM.landingLengthM`. El desplazamiento lateral es siempre hacia el
 * mismo lado (el que marca el signo del giro respecto del PRIMER tramo), así
 * la rampa avanza en zigzag en vez de solaparse.
 */
export function buildStraightRampLayout(config: RampConfig): FlightSegment3D[] {
    const widthM = Math.max(0.5, config.widthM || 3);
    const totalRise = config.toElevationM - config.fromElevationM;
    const flights: RampFlight[] =
        config.flights && config.flights.length > 0
            ? config.flights
            : [
                  {
                      id: 'flight-1',
                      direction: 'north',
                      lengthM: Math.max(3, Math.abs(totalRise) * 6),
                      riseM: totalRise,
                  },
              ];

    const raw: FlightSegment3D[] = [];
    let cursor = { x: 0, z: 0 };
    let y = 0;
    const firstHeading = (DIRECTION_ANGLE[flights[0].direction] * Math.PI) / 180;
    // Perpendicular fija (respecto del primer tramo) hacia la que se desplazan las vueltas en U.
    const sideX = -Math.sin(firstHeading);
    const sideZ = Math.cos(firstHeading);
    let headingDeg = DIRECTION_ANGLE[flights[0].direction];
    flights.forEach((flight, index) => {
        const heading = (headingDeg * Math.PI) / 180;
        const vx = Math.cos(heading);
        const vz = Math.sin(heading);
        const length = Math.max(0.1, flight.lengthM);
        const end = { x: cursor.x + vx * length, z: cursor.z + vz * length };
        raw.push({
            id: flight.id,
            kind: 'flight',
            startLocal: cursor,
            endLocal: end,
            startY: y,
            endY: y + flight.riseM,
            widthM,
        });
        cursor = end;
        y += flight.riseM;
        const turn = flight.turnAfterDeg ?? 0;
        const isLast = index === flights.length - 1;
        const isUTurn = !isLast && Math.abs(Math.abs(turn) - 180) < 1;
        const landing = flight.landingLengthM ?? 0;
        if (isUTurn) {
            // Descanso ancho que abarca los dos tramos paralelos; el
            // siguiente tramo arranca en el borde cercano del descanso, al lado.
            const sign = turn > 0 ? 1 : -1;
            const shift = widthM + U_TURN_GAP_M;
            const landLen = Math.max(landing, RAMP_NORM.landingLengthM);
            const cx = cursor.x + vx * (landLen / 2) + sideX * sign * (shift / 2);
            const cz = cursor.z + vz * (landLen / 2) + sideZ * sign * (shift / 2);
            raw.push({
                id: `${flight.id}-landing`,
                kind: 'landing',
                role: 'turn',
                startLocal: { x: cx - (vx * landLen) / 2, z: cz - (vz * landLen) / 2 },
                endLocal: { x: cx + (vx * landLen) / 2, z: cz + (vz * landLen) / 2 },
                startY: y,
                endY: y,
                widthM: widthM * 2 + U_TURN_GAP_M,
            });
            cursor = {
                x: cursor.x + sideX * sign * shift,
                z: cursor.z + sideZ * sign * shift,
            };
        } else if (
            landing > 0 ||
            (!isLast && Math.abs(Math.abs(turn) - 90) < 1)
        ) {
            const isCorner = !isLast && Math.abs(Math.abs(turn) - 90) < 1;
            // Un giro de 90° pide un descanso cuadrado (fondo ≥ ancho); el
            // tramo siguiente sale por el costado, no desde el fondo.
            const len = isCorner ? Math.max(landing, widthM) : landing;
            const role: FlightSegment3D['role'] = isLast
                ? 'arrival'
                : isCorner
                  ? 'corner'
                  : Math.abs(turn) < 1
                    ? 'through'
                    : 'turn';
            const landingEnd = {
                x: cursor.x + vx * len,
                z: cursor.z + vz * len,
            };
            raw.push({
                id: `${flight.id}-landing`,
                kind: 'landing',
                role,
                openSide: isCorner ? (turn > 0 ? 1 : -1) : undefined,
                startLocal: cursor,
                endLocal: landingEnd,
                startY: y,
                endY: y,
                widthM,
            });
            if (isCorner) {
                const nh = ((headingDeg + turn) * Math.PI) / 180;
                cursor = {
                    x: cursor.x + vx * (len / 2) + Math.cos(nh) * (widthM / 2),
                    z: cursor.z + vz * (len / 2) + Math.sin(nh) * (widthM / 2),
                };
            } else {
                cursor = landingEnd;
            }
        }
        headingDeg += turn;
    });

    // Mismo trazado, recorrido al revés (si `reversed`): el punto que era el
    // FIN pasa a ser el INICIO (cota origen) y la altura de cada punto es
    // `total - y`, de modo que el nuevo recorrido vuelve a SUBIR de
    // `fromElevationM` a `toElevationM`.
    let segs: FlightSegment3D[] = raw;
    if (config.reversed) {
        segs = [...raw].reverse().map((seg) =>
            seg.kind === 'landing'
                ? // El descanso es el mismo objeto físico: conserva su orientación
                  // (qué bordes están abiertos/cerrados), solo cambia su cota.
                  { ...seg, startY: y - seg.endY, endY: y - seg.startY }
                : {
                      ...seg,
                      startLocal: seg.endLocal,
                      endLocal: seg.startLocal,
                      startY: y - seg.endY,
                      endY: y - seg.startY,
                  },
        );
    }

    // Descanso de llegada: plano, a la cota final, a continuación del último
    // tramo — conecta con la plataforma/piso siguiente. Se omite si el último
    // tramo ya trae su propio descanso, o si arrivalLandingM es 0.
    const arrivalLen = config.arrivalLandingM ?? RAMP_NORM.landingLengthM;
    const lastSeg = segs[segs.length - 1];
    if (
        config.flights &&
        config.flights.length > 0 &&
        arrivalLen > 0 &&
        lastSeg &&
        lastSeg.kind === 'flight'
    ) {
        const dx = lastSeg.endLocal.x - lastSeg.startLocal.x;
        const dz = lastSeg.endLocal.z - lastSeg.startLocal.z;
        const len = Math.hypot(dx, dz) || 1;
        segs = [
            ...segs,
            {
                id: 'arrival-landing',
                kind: 'landing',
                role: 'arrival',
                startLocal: lastSeg.endLocal,
                endLocal: {
                    x: lastSeg.endLocal.x + (dx / len) * arrivalLen,
                    z: lastSeg.endLocal.z + (dz / len) * arrivalLen,
                },
                startY: lastSeg.endY,
                endY: lastSeg.endY,
                widthM,
            },
        ];
    }

    const pts = segs.flatMap((seg) => [seg.startLocal, seg.endLocal]);
    const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
    const cz = (Math.min(...pts.map((p) => p.z)) + Math.max(...pts.map((p) => p.z))) / 2;
    return segs.map((seg) => ({
        ...seg,
        startLocal: { x: seg.startLocal.x - cx, z: seg.startLocal.z - cz },
        endLocal: { x: seg.endLocal.x - cx, z: seg.endLocal.z - cz },
    }));
}

/**
 * Cotas de las plataformas que toca una rampa (algún vértice de la rampa cae
 * dentro de la plataforma), ordenadas y sin repetir — para proponer "de la
 * plataforma baja a la alta" sin teclear las cotas.
 */
export function platformCotasUnder(
    vertices: Point2D[],
    platforms: SiteElement[],
): number[] {
    const cotas = new Set<number>();
    for (const platform of platforms) {
        if (platform.type !== 'terrace_platform') continue;
        if (vertices.some((v) => pointInPolygon(v, platform.vertices))) {
            cotas.add(platform.baseElevationM ?? 0);
        }
    }
    return [...cotas].sort((a, b) => a - b);
}

export interface SpiralPoint3D {
    x: number;
    z: number;
    y: number; // metros, relativa al inicio (0 = fromElevationM)
}

/**
 * Polilínea del eje de una rampa helicoidal, centrada en (0,0). `footprintRadiusM`
 * es el radio disponible según la huella dibujada (limita el radio de giro).
 */
export function buildSpiralRampPolyline(
    config: RampConfig,
    footprintRadiusM: number,
    pointsPerTurn = 48,
): SpiralPoint3D[] {
    const widthM = Math.max(0.5, config.widthM || 3);
    const outerRadius = Math.max(widthM, footprintRadiusM);
    const radius = outerRadius - widthM / 2;
    const turns = Math.max(0.25, config.turns ?? 1);
    const clockwise = config.clockwise !== false;
    const startAngle = ((config.startAngleDeg ?? 0) * Math.PI) / 180;
    const totalRise = config.toElevationM - config.fromElevationM;
    const totalSteps = Math.max(8, Math.round(turns * pointsPerTurn));
    const points: SpiralPoint3D[] = [];
    for (let i = 0; i <= totalSteps; i++) {
        const t = i / totalSteps;
        const angle = startAngle + (clockwise ? -1 : 1) * t * turns * Math.PI * 2;
        points.push({
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius,
            y: totalRise * t,
        });
    }
    return points;
}

/**
 * Una escalera se modela con el mismo esquema de tramos + descansos que la
 * rampa (cada tramo al lado del anterior, descanso ancho entre ellos, descanso
 * de llegada a la plataforma siguiente); solo cambia cómo se dibuja cada tramo
 * (peldaños en vez de losa inclinada). `direction` = sentido inicial en planta.
 */
export function stairAsRampConfig(
    stair: StairConfig,
    direction: RampFlight['direction'],
): RampConfig {
    return {
        kind: 'ramp',
        fromElevationM: stair.fromElevationM,
        toElevationM: stair.toElevationM,
        widthM: stair.widthM,
        flights: planStairFlights(
            stair.toElevationM - stair.fromElevationM,
            stair.widthM,
            stair.maxStepsPerFlight ?? STAIR_NORM.maxStepsBeforeLanding,
            stair.run,
            stair.landings === 'none',
            stair.landingDepthM,
        ).map((flight) => ({ ...flight, direction })),
        arrivalLandingM: stair.arrivalLandingM ?? STAIR_NORM.landingM,
        reversed: stair.reversed,
        fitToPolygon: stair.fitToPolygon,
        handrailHeightM: stair.handrailHeightM,
    };
}
