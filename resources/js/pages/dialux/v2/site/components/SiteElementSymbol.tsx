import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SiteElementConfig, SiteElementType } from '../domain/types';

/**
 * Tipos que se colocan con un clic y representan un equipo puntual — se
 * dibujan como SÍMBOLO (no como el polígono cuadrado de su huella).
 */
export const POINT_ELEMENT_TYPES = new Set<SiteElementType>([
    'tg_location',
    'transformer',
    'pole',
    'gate',
]);

const R = 13; // radio del símbolo en px de pantalla

interface Props {
    type: SiteElementType;
    cx: number;
    cy: number;
    /** Grados horarios — orienta el símbolo igual que el objeto 3D. */
    rotationDeg?: number;
    config?: SiteElementConfig;
    color: string;
    selected: boolean;
    interactive: boolean;
    onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
}

/** Símbolo eléctrico/arquitectónico de un equipo puntual del emplazamiento. */
export function SiteElementSymbol({
    type,
    cx,
    cy,
    rotationDeg = 0,
    config,
    color,
    selected,
    interactive,
    onPointerDown,
}: Props) {
    const stroke = selected ? '#f59e0b' : color;
    const sw = selected ? 2.5 : 1.8;

    return (
        <g
            transform={`translate(${cx} ${cy})`}
            style={{
                pointerEvents: interactive ? 'visiblePainted' : 'none',
                cursor: interactive ? 'move' : undefined,
            }}
            onPointerDown={onPointerDown}
        >
            {/* Zona de clic invisible, generosa (no rota). */}
            <circle r={R + 4} fill="transparent" />
            {selected && (
                <circle
                    r={R + 3}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                />
            )}
            <g transform={`rotate(${rotationDeg})`}>
                <Glyph type={type} stroke={stroke} sw={sw} config={config} />
            </g>
        </g>
    );
}

function Glyph({
    type,
    stroke,
    sw,
    config,
}: {
    type: SiteElementType;
    stroke: string;
    sw: number;
    config?: SiteElementConfig;
}) {
    const common = {
        stroke,
        strokeWidth: sw,
        fill: 'none',
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    };

    if (type === 'gate') {
        const g = config?.kind === 'gate' ? config : undefined;
        const openDeg =
            g?.state === 'open'
                ? g.openAngleDeg || 90
                : g?.state === 'ajar'
                  ? g.openAngleDeg || 35
                  : (g?.openAngleDeg ?? 0);
        const variant = g?.variant ?? 'swing';
        // Jambas siempre; la hoja según variante y apertura.
        const jambs = (
            <>
                <line x1={-9} y1={-9} x2={-9} y2={9} {...common} />
                {variant !== 'barrier' && (
                    <line x1={9} y1={-9} x2={9} y2={9} {...common} />
                )}
            </>
        );
        if (variant === 'sliding') {
            const off = (openDeg / 90) * 16;
            return (
                <>
                    {jambs}
                    <line
                        x1={-8 - off}
                        y1={5}
                        x2={7 - off}
                        y2={5}
                        {...common}
                    />
                </>
            );
        }
        if (variant === 'barrier') {
            const rad = (-openDeg * Math.PI) / 180;
            return (
                <>
                    {jambs}
                    <line
                        x1={-9}
                        y1={0}
                        x2={-9 + 22 * Math.cos(rad)}
                        y2={22 * Math.sin(rad)}
                        {...common}
                    />
                </>
            );
        }
        const rad = ((90 - openDeg) * Math.PI) / 180;
        const leaf = (hx: number, dir: number) => (
            <>
                <line
                    x1={hx}
                    y1={0}
                    x2={hx + dir * 15 * Math.cos(rad)}
                    y2={-15 * Math.sin(rad)}
                    {...common}
                />
                <path
                    d={`M ${hx + dir * 15} 0 A 15 15 0 0 1 ${hx + dir * 15 * Math.cos(rad)} ${-15 * Math.sin(rad)}`}
                    {...common}
                    strokeDasharray="2 2"
                />
            </>
        );
        return (
            <>
                {jambs}
                {leaf(-9, 1)}
                {variant === 'double-swing' && leaf(9, -1)}
            </>
        );
    }

    switch (type) {
        case 'transformer':
            // Dos círculos entrelazados (símbolo IEC de transformador).
            return (
                <>
                    <circle cx={-4} cy={0} r={7} {...common} />
                    <circle cx={4} cy={0} r={7} {...common} />
                </>
            );
        case 'pole':
            // Luminaria sobre poste: círculo con centro y rayos cortos.
            return (
                <>
                    <circle r={7} {...common} />
                    <circle r={1.6} fill={stroke} stroke="none" />
                    <line x1={0} y1={-11} x2={0} y2={-8} {...common} />
                    <line x1={0} y1={8} x2={0} y2={11} {...common} />
                    <line x1={-11} y1={0} x2={-8} y2={0} {...common} />
                    <line x1={8} y1={0} x2={11} y2={0} {...common} />
                </>
            );
        case 'tg_location':
            // Tablero: recinto con divisiones verticales.
            return (
                <>
                    <rect
                        x={-9}
                        y={-8}
                        width={18}
                        height={16}
                        rx={1.5}
                        {...common}
                    />
                    <line x1={-3} y1={-8} x2={-3} y2={8} {...common} />
                    <line x1={3} y1={-8} x2={3} y2={8} {...common} />
                </>
            );
        default:
            return <circle r={5} fill={stroke} stroke="none" />;
    }
}
