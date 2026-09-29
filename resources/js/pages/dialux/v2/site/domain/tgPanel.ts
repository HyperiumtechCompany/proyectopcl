import type { Point2D, TgConfig, TgOutput } from './types';

export const TG_MIN_OUTPUTS = 1;
export const TG_MAX_OUTPUTS = 24;
export const TG_DIMENSION_DEFAULTS = {
    widthM: 1.2,
    depthM: 0.4,
    heightM: 2,
} as const;

export function tgDimensions(config?: TgConfig): {
    widthM: number;
    depthM: number;
    heightM: number;
} {
    return {
        widthM: Math.max(0.3, config?.widthM ?? TG_DIMENSION_DEFAULTS.widthM),
        depthM: Math.max(0.15, config?.depthM ?? TG_DIMENSION_DEFAULTS.depthM),
        heightM: Math.max(
            0.6,
            config?.heightM ?? TG_DIMENSION_DEFAULTS.heightM,
        ),
    };
}

/** Huella física del gabinete en coordenadas de plano, no el tamaño simbólico SVG. */
export function tgFootprintVertices(
    center: Point2D,
    config: TgConfig | undefined,
    scaleM: number,
    rotationDeg = 0,
): Point2D[] {
    const { widthM, depthM } = tgDimensions(config);
    const halfWidth = widthM / Math.max(scaleM, 1e-9) / 2;
    const halfDepth = depthM / Math.max(scaleM, 1e-9) / 2;
    const radians = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return [
        { x: -halfWidth, y: -halfDepth },
        { x: halfWidth, y: -halfDepth },
        { x: halfWidth, y: halfDepth },
        { x: -halfWidth, y: halfDepth },
    ].map((point) => ({
        x: center.x + point.x * cos - point.y * sin,
        y: center.y + point.x * sin + point.y * cos,
    }));
}

const OUTPUT_COLORS = [
    '#22c55e',
    '#fb7185',
    '#fde047',
    '#f97316',
    '#38bdf8',
    '#a78bfa',
];

/**
 * Color ÚNICO de la salida `index`: los 6 de siempre y, desde la 7ª, tonos
 * repartidos por el ángulo áureo (no se repiten hasta las 24 salidas).
 */
export function tgOutputColor(index: number): string {
    if (index < OUTPUT_COLORS.length) return OUTPUT_COLORS[index];
    const hue = ((index - OUTPUT_COLORS.length) * 137.508 + 15) % 360;
    const lightness = index % 2 === 0 ? 0.52 : 0.4;
    const saturation = 0.75;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const channel = (n: number) => {
        const k = (n + hue / 30) % 12;
        const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function createTgOutput(index: number): TgOutput {
    return {
        id: `tg-output-${index + 1}`,
        label: String(index + 1),
        color: tgOutputColor(index),
    };
}

export function normalizeTgOutputs(outputs?: TgOutput[]): TgOutput[] {
    const valid = outputs?.filter((output) => output.id) ?? [];
    if (valid.length === 0) {
        return Array.from({ length: 5 }, (_, index) => createTgOutput(index));
    }
    // Cada salida con color propio: una repetida (p.ej. la 7ª creada con la
    // paleta vieja de 6 colores) toma su color único para no confundirse.
    const seen = new Set<string>();
    return valid.slice(0, TG_MAX_OUTPUTS).map((output, index) => {
        const color = (output.color ?? '').toLowerCase();
        if (color && !seen.has(color)) {
            seen.add(color);
            return output;
        }
        let candidate = index;
        while (seen.has(tgOutputColor(candidate).toLowerCase())) candidate += 1;
        const unique = tgOutputColor(candidate);
        seen.add(unique.toLowerCase());
        return { ...output, color: unique };
    });
}

export function resizeTgOutputs(
    outputs: TgOutput[] | undefined,
    count: number,
): TgOutput[] {
    const nextCount = Math.min(
        TG_MAX_OUTPUTS,
        Math.max(TG_MIN_OUTPUTS, Math.round(count || TG_MIN_OUTPUTS)),
    );
    const current = normalizeTgOutputs(outputs);

    return Array.from({ length: nextCount }, (_, index) => {
        return current[index] ?? createTgOutput(index);
    });
}

export function tgPanelDimensions(outputCount: number): {
    width: number;
    height: number;
    outputGap: number;
} {
    const count = Math.min(
        TG_MAX_OUTPUTS,
        Math.max(TG_MIN_OUTPUTS, outputCount),
    );
    const outputGap = count > 10 ? 6 : 8;

    return {
        width: 62,
        height: Math.max(58, 18 + (count - 1) * outputGap),
        outputGap,
    };
}

export function tgOutputPhysicalLocal(
    outputs: TgOutput[] | undefined,
    outputId: string | undefined,
    config?: TgConfig,
): { xM: number; yM: number; heightM: number; output: TgOutput } {
    const normalized = normalizeTgOutputs(outputs);
    const found = normalized.findIndex((output) => output.id === outputId);
    const index = found >= 0 ? found : 0;
    const { widthM, depthM, heightM } = tgDimensions(config);
    const usableDepthM = Math.max(0.08, depthM - 0.12);

    return {
        xM: widthM / 2 + 0.08,
        yM:
            normalized.length === 1
                ? 0
                : -usableDepthM / 2 +
                  (index * usableDepthM) / (normalized.length - 1),
        heightM:
            heightM *
            (0.75 - (index / Math.max(1, normalized.length - 1)) * 0.5),
        output: normalized[index],
    };
}

/**
 * Desplazamiento en PLANTA (unidades de plano, no px de pantalla) del punto
 * donde una salida concreta del TG amarra su cable — mismo criterio que
 * `tgOutputAnchorLocal` (una salida por fila, hacia la derecha del gabinete,
 * girado con el TG) pero en metros reales, para que el cable la siga sin
 * depender del zoom ni de convertir ida y vuelta por pantalla, e igual en 2D
 * y 3D. Se suma al centro YA calculado del elemento (`elementBox(...).center`).
 */
export function tgOutputPlanOffset(
    outputs: TgOutput[] | undefined,
    outputId: string | undefined,
    rotationDeg: number,
    scaleM: number,
    config?: TgConfig,
): Point2D {
    if (!(scaleM > 0)) return { x: 0, y: 0 };
    const local = tgOutputPhysicalLocal(outputs, outputId, config);
    const localX = local.xM;
    const localY = local.yM;
    const radians = (rotationDeg * Math.PI) / 180;
    const worldDxM = localX * Math.cos(radians) - localY * Math.sin(radians);
    const worldDyM = localX * Math.sin(radians) + localY * Math.cos(radians);
    return { x: worldDxM / scaleM, y: worldDyM / scaleM };
}

/** Punto local (px del símbolo SVG) donde continúa el cable de una salida. */
export function tgOutputAnchorLocal(
    outputs: TgOutput[] | undefined,
    outputId?: string,
): { x: number; y: number; output: TgOutput } {
    const normalized = normalizeTgOutputs(outputs);
    const found = normalized.findIndex((output) => output.id === outputId);
    const index = found >= 0 ? found : 0;
    const { outputGap } = tgPanelDimensions(normalized.length);

    return {
        x: 18,
        y: -((normalized.length - 1) * outputGap) / 2 + index * outputGap,
        output: normalized[index],
    };
}
