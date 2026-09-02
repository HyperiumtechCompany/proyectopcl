import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SiteElementType } from '../domain/types';

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
            {/* Zona de clic invisible, generosa. */}
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
            <Glyph type={type} stroke={stroke} sw={sw} />
        </g>
    );
}

function Glyph({
    type,
    stroke,
    sw,
}: {
    type: SiteElementType;
    stroke: string;
    sw: number;
}) {
    const common = {
        stroke,
        strokeWidth: sw,
        fill: 'none',
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    };

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
        case 'gate':
            // Portón: dos jambas + hoja abatible (diagonal) + arco de barrido.
            return (
                <>
                    <line x1={-9} y1={-9} x2={-9} y2={9} {...common} />
                    <line x1={9} y1={-9} x2={9} y2={9} {...common} />
                    <line x1={-9} y1={0} x2={7} y2={-8} {...common} />
                    <path d="M -9 0 A 10 10 0 0 1 -1 -9" {...common} />
                </>
            );
        default:
            return <circle r={5} fill={stroke} stroke="none" />;
    }
}
