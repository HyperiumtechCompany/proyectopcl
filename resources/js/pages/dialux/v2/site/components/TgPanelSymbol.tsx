import {
    normalizeTgOutputs,
    tgOutputAnchorLocal,
    tgPanelDimensions,
} from '../domain/tgPanel';
import type { TgOutput } from '../domain/types';

interface Props {
    outputs?: TgOutput[];
    stroke: string;
    strokeWidth: number;
}

/** Esquema en planta del TG: gabinete, barras y salidas identificables. */
export function TgPanelSymbol({
    outputs: storedOutputs,
    stroke,
    strokeWidth,
}: Props) {
    const outputs = normalizeTgOutputs(storedOutputs);
    const { width, height, outputGap } = tgPanelDimensions(outputs.length);
    const cabinetLeft = -16;
    const cabinetRight = 10;
    const cabinetTop = -height / 2;
    const cabinetBottom = height / 2;
    const terminalX = cabinetRight + 8;
    const outputStartY = -((outputs.length - 1) * outputGap) / 2;
    const phaseXs = [-11, -3, 5];

    return (
        <g strokeLinecap="round" strokeLinejoin="round">
            <rect
                x={-24}
                y={cabinetTop - 8}
                width={width}
                height={height + 16}
                fill="transparent"
                stroke="none"
            />
            <rect
                x={cabinetLeft - 3}
                y={cabinetTop - 3}
                width={cabinetRight - cabinetLeft + 6}
                height={height + 6}
                fill="#1f2937"
                stroke={stroke}
                strokeWidth={strokeWidth}
            />
            <rect
                x={cabinetLeft}
                y={cabinetTop}
                width={cabinetRight - cabinetLeft}
                height={height}
                fill="#111827"
                stroke="#f8fafc"
                strokeWidth={1.4}
            />
            <polygon
                points={`${cabinetLeft + 5},${cabinetTop + 6} ${cabinetLeft + 5},${cabinetBottom - 6} ${cabinetRight - 4},${cabinetBottom - 6}`}
                fill="#ef1616"
                stroke="#f8fafc"
                strokeWidth={1.2}
            />
            <text
                x={cabinetLeft - 8}
                y={0}
                transform={`rotate(-90 ${cabinetLeft - 8} 0)`}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f8fafc"
                fontFamily="monospace"
                fontSize={8}
                fontWeight="bold"
                letterSpacing={2}
                stroke="none"
            >
                T-G
            </text>

            {phaseXs.map((x) => (
                <g key={`top-${x}`}>
                    <line
                        x1={x}
                        y1={cabinetTop - 3}
                        x2={x}
                        y2={cabinetTop - 7}
                        stroke="#f8fafc"
                        strokeWidth={1.2}
                    />
                    <circle
                        cx={x}
                        cy={cabinetTop - 10}
                        r={2.7}
                        fill="#1f2937"
                        stroke="#f8fafc"
                        strokeWidth={1.2}
                    />
                </g>
            ))}
            {phaseXs.map((x) => (
                <g key={`bottom-${x}`}>
                    <line
                        x1={x}
                        y1={cabinetBottom + 3}
                        x2={x}
                        y2={cabinetBottom + 7}
                        stroke="#f8fafc"
                        strokeWidth={1.2}
                    />
                    <circle
                        cx={x}
                        cy={cabinetBottom + 10}
                        r={2.7}
                        fill="#1f2937"
                        stroke="#f8fafc"
                        strokeWidth={1.2}
                    />
                </g>
            ))}

            {outputs.map((output, index) => {
                const y = outputStartY + index * outputGap;
                const anchor = tgOutputAnchorLocal(outputs, output.id);
                return (
                    <g key={output.id}>
                        <line
                            x1={cabinetRight + 3}
                            y1={y}
                            x2={terminalX - 3}
                            y2={y}
                            stroke="#f8fafc"
                            strokeWidth={1.2}
                        />
                        <circle
                            cx={anchor.x}
                            cy={anchor.y}
                            r={2.7}
                            fill="#1f2937"
                            stroke={output.color}
                            strokeWidth={1.6}
                        />
                        <text
                            x={terminalX + 4}
                            y={y - 2.5}
                            fill="#f8fafc"
                            fontFamily="monospace"
                            fontSize={5.5}
                            stroke="none"
                        >
                            {output.label}
                        </text>
                    </g>
                );
            })}
        </g>
    );
}
