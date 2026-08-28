import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { EdgeCalculation } from '../domain/calculations';
import type {
    ElectricalNetworkData,
    ElectricalNode,
    GraphIssue,
    ModuleElectricalPort,
    Point,
} from '../domain/types';

const BASE_WIDTH = 1600;
const BASE_HEIGHT = 900;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const MIN_VIEW_WIDTH = BASE_WIDTH / MAX_SCALE;
const MAX_VIEW_WIDTH = BASE_WIDTH / MIN_SCALE;
const NODE_WIDTH = 200;
const NODE_HEIGHT = 112;
const MINIMAP_WIDTH = 150;
const MINIMAP_HEIGHT = 84;
const PAN_MOVE_THRESHOLD = 4;

interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function nodesBoundingBox(nodes: ElectricalNode[]) {
    if (nodes.length === 0) {
        return { minX: 0, minY: 0, maxX: BASE_WIDTH, maxY: BASE_HEIGHT };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
        maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
    }
    return { minX, minY, maxX, maxY };
}

interface Props {
    data: ElectricalNetworkData;
    ports: ModuleElectricalPort[];
    selectedId?: string;
    connectingFrom?: string;
    onSelect: (id?: string) => void;
    onStartConnection: (id: string) => void;
    onFinishConnection: (id: string) => void;
    onMove: (id: string, point: Point) => void;
    onRemove: (id: string) => void;
    calculations: EdgeCalculation[];
    issues: GraphIssue[];
    onViewInCtTable?: (nodeId: string) => void;
    /** Navega al editor de emplazamiento para dibujar/ver el trazado físico de este alimentador. Recibe el id del EDGE (no del nodo). */
    onViewInSitePlan?: (edgeId: string) => void;
}

const FIXED_NODE_TYPES = new Set([
    'service',
    'meter',
    'ats',
    'generator',
    'ups',
    'main_panel',
]);

const EDGE_STATUS_STYLES: Record<
    EdgeCalculation['status'],
    { stroke: string; dash?: string }
> = {
    complete: { stroke: 'stroke-emerald-500' },
    warning: { stroke: 'stroke-amber-500' },
    non_compliant: { stroke: 'stroke-red-500' },
    incomplete: { stroke: 'stroke-slate-400', dash: '6 4' },
};

export function ElectricalCanvas({
    data,
    ports,
    selectedId,
    connectingFrom,
    onSelect,
    onStartConnection,
    onFinishConnection,
    onMove,
    onRemove,
    calculations,
    issues,
    onViewInCtTable,
    onViewInSitePlan,
}: Props) {
    const disconnectedNodeIds = new Set(
        issues
            .filter((issue) => issue.code === 'disconnected')
            .map((issue) => issue.nodeId),
    );
    const incomingEdgeByNode = new Map(
        data.edges.map((edge) => [edge.targetNodeId, edge]),
    );
    const incomingCalculationByNode = new Map(
        data.edges.map((edge) => [
            edge.targetNodeId,
            calculations.find((item) => item.edgeId === edge.id),
        ]),
    );
    const [contextMenu, setContextMenu] = useState<
        { nodeId: string; x: number; y: number } | undefined
    >();
    const [viewBox, setViewBox] = useState<ViewBox>({
        x: 0,
        y: 0,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
    });
    const svgRef = useRef<SVGSVGElement>(null);
    const minimapRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<
        | {
              nodeId: string;
              pointerId: number;
              start: Point;
              origin: Point;
          }
        | undefined
    >(undefined);
    const panRef = useRef<
        | {
              pointerId: number;
              lastClientX: number;
              lastClientY: number;
              moved: boolean;
          }
        | undefined
    >(undefined);
    const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
    const toSvgPoint = (clientX: number, clientY: number): Point => {
        const svg = svgRef.current;
        if (!svg) return { x: clientX, y: clientY };
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const matrix = svg.getScreenCTM();
        const transformed = matrix ? point.matrixTransform(matrix.inverse()) : point;
        // Reconstruido como objeto plano — un DOMPoint/SVGPoint nativo tiene
        // x/y como accessors del prototipo (no propiedades propias), así que
        // si algún llamador lo guarda tal cual (en vez de solo leer .x/.y
        // para aritmética, como hace hoy `onMove`), `JSON.stringify` del
        // autoguardado lo serializa como `{}` y se pierde en silencio — bug
        // real confirmado en el mismo patrón de `SiteCanvas2D.tsx`.
        return { x: transformed.x, y: transformed.y };
    };
    const zoomAt = (clientX: number, clientY: number, factor: number) => {
        const point = toSvgPoint(clientX, clientY);
        setViewBox((current) => {
            const newWidth = clamp(
                current.width / factor,
                MIN_VIEW_WIDTH,
                MAX_VIEW_WIDTH,
            );
            const ratio = newWidth / current.width;
            const newHeight = current.height * ratio;
            return {
                x: point.x - (point.x - current.x) * ratio,
                y: point.y - (point.y - current.y) * ratio,
                width: newWidth,
                height: newHeight,
            };
        });
    };
    const zoomByButton = (factor: number) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    };
    const fitToView = () => {
        const bbox = nodesBoundingBox(data.nodes);
        const padding = 80;
        const aspect = BASE_WIDTH / BASE_HEIGHT;
        let width = bbox.maxX - bbox.minX + padding * 2;
        let height = bbox.maxY - bbox.minY + padding * 2;
        if (width / height > aspect) {
            height = width / aspect;
        } else {
            width = height * aspect;
        }
        width = clamp(width, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH);
        height = width / aspect;
        const centerX = (bbox.minX + bbox.maxX) / 2;
        const centerY = (bbox.minY + bbox.maxY) / 2;
        setViewBox({
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
        });
    };
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            zoomAt(
                event.clientX,
                event.clientY,
                event.deltaY < 0 ? 1.15 : 1 / 1.15,
            );
        };
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const contextNode = contextMenu
        ? nodeMap.get(contextMenu.nodeId)
        : undefined;
    const contextIncomingEdge = contextMenu
        ? incomingEdgeByNode.get(contextMenu.nodeId)
        : undefined;
    const contextIsFixed = contextNode
        ? FIXED_NODE_TYPES.has(contextNode.type)
        : false;
    return (
        <div className="relative h-full w-full">
        <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="h-full min-h-[520px] w-full touch-none bg-[radial-gradient(circle,#94a3b833_1px,transparent_1px)] bg-size-[20px_20px] select-none dark:bg-[radial-gradient(circle,#47556955_1px,transparent_1px)]"
            onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                panRef.current = {
                    pointerId: event.pointerId,
                    lastClientX: event.clientX,
                    lastClientY: event.clientY,
                    moved: false,
                };
            }}
            onContextMenu={(event) => {
                if (event.target === event.currentTarget) {
                    event.preventDefault();
                    setContextMenu(undefined);
                }
            }}
            onPointerMove={(event) => {
                const drag = dragRef.current;
                if (drag && drag.pointerId === event.pointerId) {
                    const current = toSvgPoint(event.clientX, event.clientY);
                    onMove(drag.nodeId, {
                        x: Math.max(
                            0,
                            drag.origin.x + current.x - drag.start.x,
                        ),
                        y: Math.max(
                            0,
                            drag.origin.y + current.y - drag.start.y,
                        ),
                    });
                    return;
                }
                const pan = panRef.current;
                if (!pan || pan.pointerId !== event.pointerId) return;
                const dxClient = event.clientX - pan.lastClientX;
                const dyClient = event.clientY - pan.lastClientY;
                if (
                    !pan.moved &&
                    Math.hypot(dxClient, dyClient) < PAN_MOVE_THRESHOLD
                ) {
                    return;
                }
                pan.moved = true;
                const previous = toSvgPoint(
                    pan.lastClientX,
                    pan.lastClientY,
                );
                const current = toSvgPoint(event.clientX, event.clientY);
                pan.lastClientX = event.clientX;
                pan.lastClientY = event.clientY;
                setViewBox((currentViewBox) => ({
                    ...currentViewBox,
                    x: currentViewBox.x + previous.x - current.x,
                    y: currentViewBox.y + previous.y - current.y,
                }));
            }}
            onPointerUp={(event) => {
                if (dragRef.current?.pointerId === event.pointerId) {
                    event.currentTarget.releasePointerCapture(
                        event.pointerId,
                    );
                    dragRef.current = undefined;
                    return;
                }
                const pan = panRef.current;
                if (!pan || pan.pointerId !== event.pointerId) return;
                event.currentTarget.releasePointerCapture(event.pointerId);
                if (!pan.moved) {
                    onSelect(undefined);
                    setContextMenu(undefined);
                }
                panRef.current = undefined;
            }}
            onPointerCancel={() => {
                dragRef.current = undefined;
                panRef.current = undefined;
            }}
        >
            <defs>
                <marker
                    id="network-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                >
                    <path d="M0,0 L8,4 L0,8 Z" className="fill-cyan-500" />
                </marker>
            </defs>
            {data.edges.map((edge) => {
                const source = nodeMap.get(edge.sourceNodeId);
                const target = nodeMap.get(edge.targetNodeId);
                if (!source || !target) return null;
                const x1 = source.position.x + 200;
                const y1 = source.position.y + 56;
                const x2 = target.position.x;
                const y2 = target.position.y + 56;
                const middle = (x1 + x2) / 2;
                const path = `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`;
                const calculation = calculations.find(
                    (item) => item.edgeId === edge.id,
                );
                const edgeStyle = calculation
                    ? EDGE_STATUS_STYLES[calculation.status]
                    : EDGE_STATUS_STYLES.incomplete;
                const midY = (y1 + y2) / 2;
                return (
                    <g
                        key={edge.id}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelect(edge.id);
                        }}
                        className="cursor-pointer"
                    >
                        <path
                            d={path}
                            fill="none"
                            strokeWidth={selectedId === edge.id ? 4 : 2}
                            strokeDasharray={edgeStyle.dash}
                            className={
                                selectedId === edge.id
                                    ? 'stroke-amber-500'
                                    : edgeStyle.stroke
                            }
                            markerEnd="url(#network-arrow)"
                        >
                            <title>
                                {calculation
                                    ? `ΔU propia ${calculation.ownVoltageDropPercent.toFixed(2)}% · ΔU acumulada ${calculation.accumulatedVoltageDropPercent.toFixed(2)}% · ${calculation.currentA.toFixed(1)} A · ${edge.sectionMm2} mm² · ${calculation.lengthM.toFixed(1)} m`
                                    : 'Sin datos de cálculo (longitud o demanda pendiente)'}
                            </title>
                        </path>
                        <path
                            d={path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="18"
                        />
                        <text
                            x={middle}
                            y={midY - 8}
                            textAnchor="middle"
                            className="pointer-events-none fill-slate-500 text-[10px] dark:fill-slate-300"
                        >
                            {`${edge.label ?? 'Alimentador'} · ${edge.horizontalLengthM + edge.verticalLengthM > 0 ? `${(edge.horizontalLengthM + edge.verticalLengthM).toFixed(1)} m` : 'longitud pendiente'}${calculation && calculation.lengthM > 0 && calculation.demandPowerW > 0 ? ` · ΔU ${calculation.ownVoltageDropPercent.toFixed(2)}%` : ''}`}
                        </text>
                        {selectedId === edge.id && (
                            <g
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRemove(edge.id);
                                }}
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                className="cursor-pointer"
                            >
                                <circle
                                    cx={middle}
                                    cy={midY}
                                    r="11"
                                    className="fill-red-500/15 stroke-red-500/60"
                                />
                                <text
                                    x={middle}
                                    y={midY + 4}
                                    textAnchor="middle"
                                    className="fill-red-500 text-[13px] font-bold"
                                >
                                    ×
                                </text>
                                <title>Desconectar alimentador</title>
                            </g>
                        )}
                    </g>
                );
            })}
            {data.nodes.map((node) => {
                const port = ports.find(
                    (candidate) =>
                        candidate.moduleId === node.moduleId &&
                        candidate.panelId === node.deviceId,
                );
                const moduleName = node.moduleName ?? port?.moduleName;
                const sceneName = node.sceneName ?? port?.sceneName;
                const isFixed = FIXED_NODE_TYPES.has(node.type);
                const isDisconnected = disconnectedNodeIds.has(node.id);
                const incomingCalculation = incomingCalculationByNode.get(
                    node.id,
                );
                const isAlert =
                    !isFixed &&
                    !isDisconnected &&
                    (incomingCalculation?.status === 'non_compliant' ||
                        incomingCalculation?.status === 'warning');
                const nodeStatusClass = isFixed
                    ? 'fill-white stroke-slate-400 dark:fill-slate-900 dark:stroke-slate-600'
                    : isDisconnected
                      ? 'fill-red-50 stroke-red-500 dark:fill-red-950/40'
                      : isAlert
                        ? 'fill-amber-50 stroke-amber-500 dark:fill-amber-950/40'
                        : 'fill-emerald-50 stroke-emerald-500 dark:fill-emerald-950/30';
                return (
                    <g
                        key={node.id}
                        transform={`translate(${node.position.x} ${node.position.y})`}
                        className="cursor-grab active:cursor-grabbing"
                        onPointerDown={(event) => {
                            // La selección se dispara aquí (no en onClick):
                            // setPointerCapture() más abajo redirige el
                            // pointerup/mouseup al <svg>, y el navegador solo
                            // emite "click" cuando mousedown y mouseup apuntan
                            // al mismo elemento — con la captura activa ese
                            // click nunca llegaba al nodo, así que un clic
                            // simple no seleccionaba nada.
                            setContextMenu(undefined);
                            if (
                                connectingFrom &&
                                connectingFrom !== node.id
                            ) {
                                event.stopPropagation();
                                onFinishConnection(node.id);
                                return;
                            }
                            const svg = svgRef.current;
                            if (!svg) return;
                            event.stopPropagation();
                            onSelect(node.id);
                            svg.setPointerCapture(event.pointerId);
                            dragRef.current = {
                                nodeId: node.id,
                                pointerId: event.pointerId,
                                start: toSvgPoint(event.clientX, event.clientY),
                                origin: node.position,
                            };
                        }}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onSelect(node.id);
                            setContextMenu({
                                nodeId: node.id,
                                x: event.clientX,
                                y: event.clientY,
                            });
                        }}
                    >
                        <rect
                            width="200"
                            height="112"
                            rx="12"
                            className={`${selectedId === node.id ? 'fill-amber-50 stroke-amber-500 dark:fill-amber-950/60' : nodeStatusClass} stroke-2 drop-shadow-lg ${isDisconnected ? 'animate-pulse' : ''}`}
                        />
                        <text
                            x="16"
                            y="24"
                            className="fill-slate-500 text-[10px] font-semibold uppercase dark:fill-slate-400"
                        >
                            {node.type === 'module_panel_port'
                                ? 'Tablero de módulo'
                                : node.type.replace('_', ' ')}
                        </text>
                        <text
                            x="16"
                            y="49"
                            className="fill-slate-900 text-[15px] font-bold dark:fill-white"
                        >
                            {node.label}
                        </text>
                        {moduleName && (
                            <text
                                x="16"
                                y="72"
                                className="fill-cyan-600 text-[11px] font-semibold dark:fill-cyan-400"
                            >
                                {moduleName}
                            </text>
                        )}
                        {sceneName && (
                            <text
                                x="16"
                                y="92"
                                className="fill-slate-500 text-[10px] dark:fill-slate-400"
                            >
                                {`${sceneName}${port && port.installedPowerW > 0 ? ` · ${(port.installedPowerW / 1000).toFixed(2)} kW` : ' · sin carga'}`}
                            </text>
                        )}
                        <circle
                            cx="0"
                            cy="56"
                            r="20"
                            fill="transparent"
                            className="cursor-crosshair"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onFinishConnection(node.id);
                            }}
                        />
                        <circle
                            cx="0"
                            cy="56"
                            r={connectingFrom ? 13 : 9}
                            className="pointer-events-none fill-slate-400 stroke-white stroke-2 dark:stroke-slate-900"
                        />
                        <circle
                            cx="200"
                            cy="56"
                            r="20"
                            fill="transparent"
                            className="cursor-crosshair"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onStartConnection(node.id);
                            }}
                        >
                            <title>
                                Iniciar conexión desde {node.label}
                            </title>
                        </circle>
                        <circle
                            cx="200"
                            cy="56"
                            r="11"
                            className={`pointer-events-none stroke-white stroke-2 dark:stroke-slate-900 ${connectingFrom === node.id ? 'fill-amber-500' : 'fill-cyan-500'}`}
                        />
                        {connectingFrom && connectingFrom !== node.id ? (
                            <text
                                x="100"
                                y="105"
                                textAnchor="middle"
                                className="pointer-events-none fill-emerald-500 text-[10px] font-bold"
                            >
                                CLIC PARA CONECTAR
                            </text>
                        ) : isDisconnected ? (
                            <text
                                x="100"
                                y="105"
                                textAnchor="middle"
                                className="pointer-events-none fill-red-600 text-[10px] font-bold dark:fill-red-400"
                            >
                                DESCONECTADO
                            </text>
                        ) : isAlert && incomingCalculation ? (
                            <text
                                x="100"
                                y="105"
                                textAnchor="middle"
                                className="pointer-events-none fill-amber-600 text-[10px] font-bold dark:fill-amber-400"
                            >
                                {`⚠ ΔU ${incomingCalculation.accumulatedVoltageDropPercent.toFixed(1)}%`}
                            </text>
                        ) : (
                            !isFixed && (
                                <text
                                    x="100"
                                    y="105"
                                    textAnchor="middle"
                                    className="pointer-events-none fill-emerald-600 text-[10px] font-bold dark:fill-emerald-400"
                                >
                                    ✓ conectado
                                </text>
                            )
                        )}
                        {node.type === 'module_panel_port' && (
                            <g
                                className="cursor-pointer"
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRemove(node.id);
                                }}
                            >
                                <circle
                                    cx="184"
                                    cy="16"
                                    r="10"
                                    className="fill-red-500/15 stroke-red-500/50"
                                />
                                <text
                                    x="184"
                                    y="20"
                                    textAnchor="middle"
                                    className="fill-red-500 text-[13px] font-bold"
                                >
                                    ×
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-white/80 px-2 py-1 text-[11px] text-slate-500 shadow-sm dark:bg-slate-900/80 dark:text-slate-400">
            Arrastra los tableros para ordenarlos · salida celeste → entrada
            gris para conectar · rueda para zoom
        </div>
        <div className="absolute top-2 left-2 flex flex-col gap-1">
            <button
                type="button"
                title="Acercar"
                onClick={() => zoomByButton(1.2)}
                className="rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
            >
                <ZoomIn className="h-4 w-4" />
            </button>
            <button
                type="button"
                title="Alejar"
                onClick={() => zoomByButton(1 / 1.2)}
                className="rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
            >
                <ZoomOut className="h-4 w-4" />
            </button>
            <button
                type="button"
                title="Ajustar a la vista"
                onClick={fitToView}
                className="rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
            >
                <Maximize className="h-4 w-4" />
            </button>
        </div>
        <Minimap
            minimapRef={minimapRef}
            nodes={data.nodes}
            viewBox={viewBox}
            onJump={(point) =>
                setViewBox((current) => ({
                    ...current,
                    x: point.x - current.width / 2,
                    y: point.y - current.height / 2,
                }))
            }
        />
        {contextMenu && contextNode && (
            <>
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setContextMenu(undefined)}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        setContextMenu(undefined);
                    }}
                />
                <div
                    className="fixed z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-xl dark:border-white/10 dark:bg-slate-900"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <div className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {contextNode.label}
                    </div>
                    <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                        onClick={() => {
                            onStartConnection(contextMenu.nodeId);
                            setContextMenu(undefined);
                        }}
                    >
                        Conectar desde…
                    </button>
                    <button
                        type="button"
                        disabled={!contextIncomingEdge}
                        className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-200 dark:hover:bg-white/5"
                        onClick={() => {
                            if (contextIncomingEdge)
                                onRemove(contextIncomingEdge.id);
                            setContextMenu(undefined);
                        }}
                    >
                        Desconectar alimentador
                    </button>
                    <button
                        type="button"
                        disabled={contextIsFixed}
                        className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => {
                            onRemove(contextMenu.nodeId);
                            setContextMenu(undefined);
                        }}
                    >
                        Eliminar del diagrama
                    </button>
                    {onViewInCtTable && (
                        <button
                            type="button"
                            className="block w-full border-t border-slate-100 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                            onClick={() => {
                                onViewInCtTable(contextMenu.nodeId);
                                setContextMenu(undefined);
                            }}
                        >
                            Ver en tabla CT
                        </button>
                    )}
                    {onViewInSitePlan && (
                        <button
                            type="button"
                            disabled={!contextIncomingEdge}
                            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-200 dark:hover:bg-white/5"
                            onClick={() => {
                                if (contextIncomingEdge)
                                    onViewInSitePlan(contextIncomingEdge.id);
                                setContextMenu(undefined);
                            }}
                        >
                            Ver trazado en emplazamiento
                        </button>
                    )}
                </div>
            </>
        )}
        </div>
    );
}

function Minimap({
    minimapRef,
    nodes,
    viewBox,
    onJump,
}: {
    minimapRef: { current: SVGSVGElement | null };
    nodes: ElectricalNode[];
    viewBox: ViewBox;
    onJump: (point: Point) => void;
}) {
    const bbox = nodesBoundingBox(nodes);
    const padding = 100;
    const minX = Math.min(bbox.minX - padding, viewBox.x);
    const minY = Math.min(bbox.minY - padding, viewBox.y);
    const maxX = Math.max(bbox.maxX + padding, viewBox.x + viewBox.width);
    const maxY = Math.max(bbox.maxY + padding, viewBox.y + viewBox.height);
    const width = maxX - minX;
    const height = maxY - minY;
    const jump = (event: PointerEvent<SVGSVGElement>) => {
        const svg = minimapRef.current;
        if (!svg) return;
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const logical = point.matrixTransform(matrix.inverse());
        onJump({ x: logical.x, y: logical.y });
    };
    return (
        <svg
            ref={minimapRef}
            viewBox={`${minX} ${minY} ${width} ${height}`}
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            onPointerDown={jump}
            className="absolute right-2 bottom-2 cursor-pointer touch-none rounded border border-slate-300 bg-white/90 shadow dark:border-white/10 dark:bg-slate-900/90"
        >
            {nodes.map((node) => (
                <rect
                    key={node.id}
                    x={node.position.x}
                    y={node.position.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    className="fill-cyan-500/70"
                />
            ))}
            <rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.width}
                height={viewBox.height}
                fill="none"
                strokeWidth={Math.max(2, width / 150)}
                className="stroke-amber-500"
            />
        </svg>
    );
}
