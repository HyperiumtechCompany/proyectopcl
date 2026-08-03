/**
 * `<defs>` estáticos reutilizados por los overlays SVG del canvas 2D.
 * Extraído de `MlightcadCanvas2D.tsx` (Fase 2, extracción conservadora):
 * sin props, sin estado — el mismo markup exacto, solo movido de archivo.
 */
export function CanvasSvgDefs() {
    return (
        <defs>
            <pattern id="hatch-canopy-svg" patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={8} stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.5} />
            </pattern>
            <filter id="glow-fixture">
                <feGaussianBlur stdDeviation={3} result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    );
}
