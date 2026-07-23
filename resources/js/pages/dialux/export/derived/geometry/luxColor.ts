/**
 * Mapeo de valores de iluminancia (lux) a color, para isolux/heatmaps.
 * Antes vivía duplicado verbatim en buildAmbientSvg.ts y buildTerrainSvg.ts —
 * fuente única aquí para que ambos (y cualquier builder futuro) coincidan.
 */

export function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number): string => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export function colorForFunctionalLux(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 240 - ratio * 200;
    return hslToHex(hue, 92, 62 - ratio * 28);
}

export function colorForTemperatureLux(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 250 - ratio * 220;
    return hslToHex(hue, 92, 58 - ratio * 22);
}

export function waveStrokeColor(level: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, level / Math.max(maxLux, 1)));
    const hue = 220 - ratio * 160;
    return hslToHex(hue, 90, 28 - ratio * 8);
}

export function waveBackdropColor(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 230 - ratio * 185;
    return hslToHex(hue, 92, 58 - ratio * 28);
}

/** Color de una celda/isolínea según el modo de visualización activo. */
export function colorForLuxMode(
    lux: number,
    maxLux: number,
    mode: 'functional' | 'temperature' | 'waves',
): string {
    if (mode === 'temperature') {
        return colorForTemperatureLux(lux, maxLux);
    }
    if (mode === 'waves') {
        return waveBackdropColor(lux, maxLux);
    }
    return colorForFunctionalLux(lux, maxLux);
}
