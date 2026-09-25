import type { CourtSport } from './types';

/**
 * Marcas de una cancha, en METROS, con el origen en el centro, `x` a lo largo
 * (largo de la cancha) e `y` a lo ancho. Cada marca es una polilínea.
 *
 * Son marcas ESQUEMÁTICAS para la maqueta y el plano (proporciones tomadas de
 * las medidas reglamentarias habituales de cada deporte y escaladas al largo
 * × ancho reales de la cancha dibujada); no reemplazan el trazado oficial de
 * la federación correspondiente.
 */
export type CourtLine = Array<[number, number]>;

/** Medidas de referencia (largo × ancho, m) sobre las que se definen las marcas. */
export const COURT_REFERENCE_M: Record<
    Exclude<CourtSport, 'none'>,
    { length: number; width: number; label: string }
> = {
    futsal: { length: 40, width: 20, label: 'Fútbol sala / losa' },
    basketball: { length: 28, width: 15, label: 'Básquet' },
    volleyball: { length: 18, width: 9, label: 'Vóley' },
    multi: { length: 28, width: 15, label: 'Multiuso (básquet + vóley + fútbol sala)' },
};

const rect = (l: number, w: number): CourtLine => [
    [-l / 2, -w / 2],
    [l / 2, -w / 2],
    [l / 2, w / 2],
    [-l / 2, w / 2],
    [-l / 2, -w / 2],
];

function arc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    fromDeg: number,
    toDeg: number,
    steps = 24,
): CourtLine {
    const out: CourtLine = [];
    for (let i = 0; i <= steps; i++) {
        const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
        out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
}

function basketballLines(l: number, w: number): CourtLine[] {
    const sx = l / 28;
    const sy = w / 15;
    const s = Math.min(sx, sy);
    const lines: CourtLine[] = [rect(l, w), [[0, -w / 2], [0, w / 2]]];
    lines.push(arc(0, 0, 1.8 * s, 1.8 * s, 0, 360, 32)); // círculo central
    for (const side of [-1, 1]) {
        const baseX = side * (l / 2);
        // Zona pintada (5.8 × 4.9 m) y semicírculo de tiro libre.
        const keyLen = 5.8 * sx;
        const keyHalf = (4.9 * sy) / 2;
        lines.push([
            [baseX, -keyHalf],
            [baseX - side * keyLen, -keyHalf],
            [baseX - side * keyLen, keyHalf],
            [baseX, keyHalf],
        ]);
        lines.push(arc(baseX - side * keyLen, 0, 1.8 * sx, 1.8 * sy, side > 0 ? 90 : -90, side > 0 ? 270 : 90, 20));
        // Línea de tres puntos: tramos rectos a 0.9 m de la banda + arco de 6.75 m.
        const r = 6.75 * s;
        const straight = w / 2 - 0.9 * sy;
        const centerX = baseX - side * 1.575 * sx;
        const dx = Math.sqrt(Math.max(0, r * r - straight * straight));
        const joinX = centerX - side * dx;
        lines.push([[baseX, -straight], [joinX, -straight]]);
        lines.push([[baseX, straight], [joinX, straight]]);
        const a0 = (Math.atan2(straight, dx) * 180) / Math.PI;
        lines.push(
            side > 0
                ? arc(centerX, 0, r, r, 180 - a0, 180 + a0, 30)
                : arc(centerX, 0, r, r, -a0, a0, 30),
        );
    }
    return lines;
}

function futsalLines(l: number, w: number): CourtLine[] {
    const sx = l / 40;
    const sy = w / 20;
    const s = Math.min(sx, sy);
    const lines: CourtLine[] = [rect(l, w), [[0, -w / 2], [0, w / 2]]];
    lines.push(arc(0, 0, 3 * s, 3 * s, 0, 360, 32));
    for (const side of [-1, 1]) {
        const gx = side * (l / 2);
        const post = 1.5 * sy; // medio arco = 3 m
        const r = 6 * s;
        // Área: dos cuartos de círculo desde los postes + tramo recto a 6 m de la línea de meta.
        const inner = gx - side * r;
        // Cuartos de círculo centrados en cada poste, de la línea de meta al frente del área.
        lines.push(arc(gx, post, r, r, 90, side > 0 ? 180 : 0, 16));
        lines.push(arc(gx, -post, r, r, side > 0 ? 180 : 0, side > 0 ? 270 : -90, 16));
        lines.push([[inner, -post], [inner, post]]);
    }
    return lines;
}

function volleyballLines(l: number, w: number): CourtLine[] {
    const sx = l / 18;
    return [
        rect(l, w),
        [[0, -w / 2], [0, w / 2]], // red
        [[-3 * sx, -w / 2], [-3 * sx, w / 2]], // líneas de ataque a 3 m
        [[3 * sx, -w / 2], [3 * sx, w / 2]],
    ];
}

/** Marcas de la cancha para `sport`, ajustadas a `lengthM × widthM` (largo a lo largo de `x`). */
export function courtLines(
    sport: CourtSport,
    lengthM: number,
    widthM: number,
): CourtLine[] {
    if (sport === 'none' || lengthM <= 0 || widthM <= 0) return [];
    switch (sport) {
        case 'basketball':
            return basketballLines(lengthM, widthM);
        case 'futsal':
            return futsalLines(lengthM, widthM);
        case 'volleyball':
            return volleyballLines(lengthM, widthM);
        case 'multi':
            // Perímetro y círculo central compartidos + zonas de básquet y líneas de vóley.
            return [
                ...basketballLines(lengthM, widthM),
                ...volleyballLines(lengthM, widthM).slice(2),
            ];
    }
}
