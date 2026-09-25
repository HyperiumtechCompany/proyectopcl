import type { PointerEvent as ReactPointerEvent } from 'react';
import { normalizeTgOutputs, tgPanelDimensions } from '../domain/tgPanel';
import type { SiteElementConfig, SiteElementType } from '../domain/types';
import { TgPanelSymbol } from './TgPanelSymbol';

/**
 * Tipos que se colocan con un clic y representan un equipo puntual — se
 * dibujan como SÍMBOLO (no como el polígono cuadrado de su huella).
 */
export const POINT_ELEMENT_TYPES = new Set<SiteElementType>([
    'tg_location',
    'transformer',
    'pole',
    'outlet',
    'sub_panel',
    'ats',
    'earth_pit',
    'mt_cell_arrival',
    'mt_cell_protection',
    'mt_cell_transformation',
    'cable_vault',
    'pull_box',
    'generator',
    'gate',
    'tree',
]);

const R = 13; // radio del símbolo en px de pantalla

interface Props {
    type: SiteElementType;
    cx: number;
    cy: number;
    /** Grados horarios — orienta el símbolo igual que el objeto 3D. */
    rotationDeg?: number;
    /** Escala visual calculada desde metros reales y el zoom actual. */
    scaleX?: number;
    scaleY?: number;
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
    scaleX = 1,
    scaleY = 1,
    config,
    color,
    selected,
    interactive,
    onPointerDown,
}: Props) {
    const stroke = selected ? '#f59e0b' : color;
    const sw = selected ? 2.5 : 1.8;
    const intrinsic = pointSymbolIntrinsicSize(type, config);
    const screenWidth = intrinsic.width * Math.abs(scaleX);
    const screenHeight = intrinsic.height * Math.abs(scaleY);
    const hitWidth = Math.max(12, screenWidth + 8);
    const hitHeight = Math.max(12, screenHeight + 8);

    return (
        <g
            transform={`translate(${cx} ${cy})`}
            style={{
                pointerEvents: interactive ? 'visiblePainted' : 'none',
                cursor: interactive ? 'move' : undefined,
            }}
            onPointerDown={onPointerDown}
        >
            {/* Zona de clic mínima para seleccionar; no altera la geometría visible. */}
            <rect
                x={-hitWidth / 2}
                y={-hitHeight / 2}
                width={hitWidth}
                height={hitHeight}
                fill="transparent"
            />
            {selected && (
                <rect
                    x={-hitWidth / 2}
                    y={-hitHeight / 2}
                    width={hitWidth}
                    height={hitHeight}
                    rx={3}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                />
            )}
            <g transform={`rotate(${rotationDeg}) scale(${scaleX} ${scaleY})`}>
                <Glyph type={type} stroke={stroke} sw={sw} config={config} />
            </g>
        </g>
    );
}

/** Caja intrínseca del glifo, antes de convertir sus dimensiones reales a px. */
export function pointSymbolIntrinsicSize(
    type: SiteElementType,
    config?: SiteElementConfig,
): { width: number; height: number } {
    if (type === 'tg_location') {
        const outputs = normalizeTgOutputs(
            config?.kind === 'tg' ? config.outputs : undefined,
        );
        const panel = tgPanelDimensions(outputs.length);
        return { width: panel.width, height: panel.height + 26 };
    }

    // El glifo de la caja ocupa exactamente 12×12; usar el contenedor genérico
    // de 26×26 la hacía verse a menos de la mitad de su tamaño real.
    if (type === 'pull_box') return { width: 12, height: 12 };

    return { width: R * 2, height: R * 2 };
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

    if (type === 'tree') {
        // Copa (circunferencia con lóbulos) + tronco; palmera = estrella; conífera = triángulo.
        const species = config?.kind === 'tree' ? config.species : 'broadleaf';
        if (species === 'palm') {
            return (
                <>
                    {[0, 60, 120, 180, 240, 300].map((deg) => (
                        <line
                            key={deg}
                            x1={0}
                            y1={0}
                            x2={11 * Math.cos((deg * Math.PI) / 180)}
                            y2={11 * Math.sin((deg * Math.PI) / 180)}
                            {...common}
                        />
                    ))}
                    <circle r={2} {...common} fill={stroke} />
                </>
            );
        }
        if (species === 'conifer') {
            return (
                <>
                    <path
                        d="M0 -11 L9 8 L-9 8 Z"
                        {...common}
                        fill="#16a34a33"
                    />
                    <circle r={1.6} {...common} fill={stroke} />
                </>
            );
        }
        return (
            <>
                <circle r={11} {...common} fill="#16a34a33" />
                <path
                    d="M-6 -3 Q-2 -8 3 -5 M-3 4 Q2 8 6 3"
                    {...common}
                    strokeWidth={1}
                />
                <circle r={1.8} {...common} fill={stroke} />
            </>
        );
    }

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
        case 'outlet':
            // Tomacorriente exterior: caja IP65 (tapa abisagrada) con dos pines + tierra.
            return (
                <>
                    <rect
                        x={-8}
                        y={-8}
                        width={16}
                        height={16}
                        rx={2}
                        {...common}
                    />
                    <path d="M-8 -8 Q0 -13 8 -8" {...common} />
                    <circle
                        cx={-3}
                        cy={2}
                        r={1.4}
                        fill={stroke}
                        stroke="none"
                    />
                    <circle cx={3} cy={2} r={1.4} fill={stroke} stroke="none" />
                    <line x1={0} y1={-3} x2={0} y2={-1} {...common} />
                </>
            );
        case 'tg_location':
            return (
                <TgPanelSymbol
                    outputs={config?.kind === 'tg' ? config.outputs : undefined}
                    stroke={stroke}
                    strokeWidth={sw}
                />
            );
        case 'sub_panel':
            // Mismo lenguaje visual que v1 (PanelSymbol): gabinete con bornes a los lados + etiqueta "TD".
            return (
                <>
                    <text
                        x={0}
                        y={-12}
                        textAnchor="middle"
                        fontSize={7}
                        fontWeight="bold"
                        fill={stroke}
                        fontFamily="monospace"
                    >
                        TD
                    </text>
                    <circle cx={-10} cy={-4} r={1.6} {...common} />
                    <circle cx={-10} cy={0} r={1.6} {...common} />
                    <circle cx={-10} cy={4} r={1.6} {...common} />
                    <circle cx={10} cy={-4} r={1.6} {...common} />
                    <circle cx={10} cy={0} r={1.6} {...common} />
                    <circle cx={10} cy={4} r={1.6} {...common} />
                    <rect x={-8} y={-8} width={16} height={16} {...common} />
                </>
            );
        case 'ats':
            // Mismo lenguaje visual que v1 (ATSSymbol): recuadro doble relleno con etiqueta "ATS".
            return (
                <>
                    <rect
                        x={-10}
                        y={-9}
                        width={20}
                        height={18}
                        rx={1.5}
                        {...common}
                    />
                    <rect
                        x={-8}
                        y={-7}
                        width={16}
                        height={14}
                        fill={stroke}
                        stroke="none"
                    />
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={6}
                        fontWeight="bold"
                        fill="white"
                        fontFamily="monospace"
                    >
                        ATS
                    </text>
                </>
            );
        case 'earth_pit':
            // Mismo lenguaje visual que v1 (EarthPitSymbol): círculo simple sin relleno.
            return <circle r={7} {...common} />;
        case 'mt_cell_arrival':
        case 'mt_cell_protection': {
            // Celda de 2 cámaras (CMP + CMR remonte) del legend CAD real: caja
            // dividida por una línea a ~56% (0.48/0.85), como en el plano.
            const code = type === 'mt_cell_arrival' ? 'LL' : 'PT';
            return (
                <>
                    <text
                        x={0}
                        y={-13}
                        textAnchor="middle"
                        fontSize={6}
                        fontWeight="bold"
                        fill={stroke}
                        fontFamily="monospace"
                    >
                        {code}
                    </text>
                    <rect x={-11} y={-9} width={22} height={18} {...common} />
                    <line x1={-1.5} y1={-9} x2={-1.5} y2={9} {...common} />
                </>
            );
        }
        case 'mt_cell_transformation':
            // Celda de transformación del legend CAD real: caja con aspas
            // (equipo) + dos rieles/bujes verticales, como en el plano.
            return (
                <>
                    <rect x={-12} y={-9} width={24} height={18} {...common} />
                    <line
                        x1={-12}
                        y1={-9}
                        x2={12}
                        y2={9}
                        {...common}
                        strokeWidth={sw * 0.7}
                    />
                    <line
                        x1={12}
                        y1={-9}
                        x2={-12}
                        y2={9}
                        {...common}
                        strokeWidth={sw * 0.7}
                    />
                    <line
                        x1={-4}
                        y1={-9}
                        x2={-4}
                        y2={9}
                        {...common}
                        strokeWidth={sw * 1.3}
                    />
                    <line
                        x1={4}
                        y1={-9}
                        x2={4}
                        y2={9}
                        {...common}
                        strokeWidth={sw * 1.3}
                    />
                </>
            );
        case 'cable_vault':
            // Buzón de registro: mismo lenguaje que v1 (JunctionBoxSymbol) pero
            // con los 2 terminales + punto central del símbolo del legend real.
            return (
                <>
                    <rect x={-9} y={-9} width={18} height={18} {...common} />
                    <line
                        x1={-5}
                        y1={-5}
                        x2={-5}
                        y2={5}
                        {...common}
                        strokeWidth={sw * 1.4}
                    />
                    <line
                        x1={5}
                        y1={-5}
                        x2={5}
                        y2={5}
                        {...common}
                        strokeWidth={sw * 1.4}
                    />
                    <circle cx={0} cy={0} r={1.4} fill={stroke} stroke="none" />
                </>
            );
        case 'pull_box':
            // Caja de pase: cuadro pequeño relleno con aspas, como en el legend.
            return (
                <>
                    <rect
                        x={-6}
                        y={-6}
                        width={12}
                        height={12}
                        fill={stroke}
                        opacity={0.85}
                    />
                    <line
                        x1={-6}
                        y1={-6}
                        x2={6}
                        y2={6}
                        stroke="#0f172a"
                        strokeWidth={1}
                    />
                    <line
                        x1={6}
                        y1={-6}
                        x2={-6}
                        y2={6}
                        stroke="#0f172a"
                        strokeWidth={1}
                    />
                </>
            );
        case 'generator':
            // Grupo electrógeno: cabina rectangular + etiqueta "GE".
            return (
                <>
                    <text
                        x={0}
                        y={-13}
                        textAnchor="middle"
                        fontSize={7}
                        fontWeight="bold"
                        fill={stroke}
                        fontFamily="monospace"
                    >
                        GE
                    </text>
                    <rect
                        x={-13}
                        y={-8}
                        width={26}
                        height={16}
                        rx={1.5}
                        {...common}
                    />
                    <line
                        x1={-13}
                        y1={-2}
                        x2={13}
                        y2={-2}
                        {...common}
                        strokeWidth={sw * 0.7}
                    />
                </>
            );
        default:
            return <circle r={5} fill={stroke} stroke="none" />;
    }
}
