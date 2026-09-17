import type { RampConfig, RampFlight } from './types';

export interface FlightSegment3D {
    id: string;
    kind: 'flight' | 'landing';
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

/**
 * Layout de una rampa recta de uno o varios tramos con giros, centrado en
 * (0,0) — coordenadas locales en metros, Y relativa al inicio (0 =
 * `fromElevationM`). Sin `flights` configurados genera un único tramo
 * sintético que cubre todo el desnivel (`toElevationM - fromElevationM`),
 * equivalente al comportamiento clásico de una rampa de un solo tramo.
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
    let headingDeg = DIRECTION_ANGLE[flights[0].direction];
    flights.forEach((flight) => {
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
        const landing = flight.landingLengthM ?? 0;
        if (landing > 0) {
            const landingEnd = {
                x: cursor.x + vx * landing,
                z: cursor.z + vz * landing,
            };
            raw.push({
                id: `${flight.id}-landing`,
                kind: 'landing',
                startLocal: cursor,
                endLocal: landingEnd,
                startY: y,
                endY: y,
                widthM,
            });
            cursor = landingEnd;
        }
        headingDeg += flight.turnAfterDeg ?? 0;
    });

    const pts = raw.flatMap((s) => [s.startLocal, s.endLocal]);
    const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
    const cz = (Math.min(...pts.map((p) => p.z)) + Math.max(...pts.map((p) => p.z))) / 2;
    return raw.map((s) => ({
        ...s,
        startLocal: { x: s.startLocal.x - cx, z: s.startLocal.z - cz },
        endLocal: { x: s.endLocal.x - cx, z: s.endLocal.z - cz },
    }));
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
