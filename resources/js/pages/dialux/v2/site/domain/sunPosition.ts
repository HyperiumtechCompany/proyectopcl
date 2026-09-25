/**
 * Posición aproximada del sol y estado del cielo para la vista 3D del
 * emplazamiento. Fórmulas astronómicas simples (declinación de Cooper, hora
 * solar = hora local): suficientes para orientar sombras y ambientar la
 * maqueta, NO para estudios de asoleamiento normativos.
 */

const RAD = Math.PI / 180;

/** Latitud por defecto (Lima) cuando el proyecto no tiene ubicación. */
export const DEFAULT_LATITUDE_DEG = -12;
/** Día del año por defecto: equinoccio de marzo (día ≈ noche en cualquier latitud). */
export const DEFAULT_DAY_OF_YEAR = 80;

export interface SunPosition {
    /** Elevación sobre el horizonte, grados (≤ 0 = bajo el horizonte). */
    elevationDeg: number;
    /** Acimut desde el Norte, sentido horario (90 = Este), grados 0–360. */
    azimuthDeg: number;
}

export function sunPosition(
    hour: number,
    latitudeDeg = DEFAULT_LATITUDE_DEG,
    dayOfYear = DEFAULT_DAY_OF_YEAR,
): SunPosition {
    const decl = 23.45 * Math.sin(((360 / 365) * (284 + dayOfYear)) * RAD);
    const hourAngle = 15 * (hour - 12); // negativo por la mañana
    const phi = latitudeDeg * RAD;
    const d = decl * RAD;
    const h = hourAngle * RAD;
    const sinEl =
        Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
    const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
    // Acimut desde el Norte: atan2 de las componentes este y norte del vector al sol.
    const east = -Math.cos(d) * Math.sin(h);
    const north =
        Math.cos(phi) * Math.sin(d) - Math.sin(phi) * Math.cos(d) * Math.cos(h);
    const az = (Math.atan2(east, north) / RAD + 360) % 360;
    return { elevationDeg: el / RAD, azimuthDeg: az };
}

/** Vector unitario hacia el sol en el mundo 3D del emplazamiento (x = Este, y = arriba, z = Norte). */
export function sunVector(sun: SunPosition): [number, number, number] {
    const el = sun.elevationDeg * RAD;
    const az = sun.azimuthDeg * RAD;
    return [
        Math.sin(az) * Math.cos(el),
        Math.sin(el),
        Math.cos(az) * Math.cos(el),
    ];
}

export interface SkyState {
    /** Color de fondo (RGB 0–1). */
    sky: [number, number, number];
    /** Intensidad de la luz del sol (0 con el sol bajo el horizonte). */
    sunIntensity: number;
    ambientIntensity: number;
    /** Color de la luz solar: cálida con el sol bajo. */
    sunColor: [number, number, number];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (
    a: [number, number, number],
    b: [number, number, number],
    t: number,
): [number, number, number] => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const NIGHT_SKY: [number, number, number] = [0.02, 0.04, 0.09];
const DUSK_SKY: [number, number, number] = [0.86, 0.55, 0.4];
const DAY_SKY: [number, number, number] = [0.68, 0.78, 0.88];

/** Cielo y luces globales según la elevación del sol: noche → alba/ocaso → día. */
export function skyState(elevationDeg: number): SkyState {
    const dayT = clamp01(elevationDeg / 25); // 0 en el horizonte, 1 con el sol alto
    const twilightT = clamp01((elevationDeg + 8) / 8); // 0 a −8°, 1 en el horizonte
    const sky =
        elevationDeg >= 0
            ? mix(DUSK_SKY, DAY_SKY, dayT)
            : mix(NIGHT_SKY, DUSK_SKY, twilightT);
    return {
        sky,
        sunIntensity: 1.1 * Math.pow(dayT, 0.6),
        ambientIntensity: lerp(0.14, 0.6, elevationDeg >= 0 ? dayT : 0),
        sunColor: mix([1, 0.62, 0.35], [1, 0.97, 0.9], dayT),
    };
}

/** Día del año (1–366) de una fecha "YYYY-MM-DD"; `fallback` si no se puede leer. */
export function dayOfYearFromDate(
    isoDate: string,
    fallback = DEFAULT_DAY_OF_YEAR,
): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return fallback;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const start = Date.UTC(year, 0, 0);
    const value = Date.UTC(year, month - 1, day);
    const n = Math.round((value - start) / 86400000);
    return n >= 1 && n <= 366 ? n : fallback;
}

/** Hora → texto "HH:MM". */
export function formatHour(hour: number): string {
    const total = Math.round(hour * 60);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
