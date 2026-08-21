import { useRef } from 'react';
import type {
    ElectricalNetworkData,
    ModuleElectricalPort,
    Point,
} from '../domain/types';

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
}

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
}: Props) {
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<
        | {
              nodeId: string;
              pointerId: number;
              start: Point;
              origin: Point;
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
        return matrix ? point.matrixTransform(matrix.inverse()) : point;
    };
    return (
        <svg
            ref={svgRef}
            viewBox="0 0 1600 900"
            className="h-full min-h-[520px] w-full touch-none bg-[radial-gradient(circle,#94a3b833_1px,transparent_1px)] bg-size-[20px_20px] select-none dark:bg-[radial-gradient(circle,#47556955_1px,transparent_1px)]"
            onPointerDown={(event) =>
                event.target === event.currentTarget && onSelect(undefined)
            }
            onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const current = toSvgPoint(event.clientX, event.clientY);
                onMove(drag.nodeId, {
                    x: Math.max(0, drag.origin.x + current.x - drag.start.x),
                    y: Math.max(0, drag.origin.y + current.y - drag.start.y),
                });
            }}
            onPointerUp={(event) => {
                if (dragRef.current?.pointerId !== event.pointerId) return;
                event.currentTarget.releasePointerCapture(event.pointerId);
                dragRef.current = undefined;
            }}
            onPointerCancel={() => {
                dragRef.current = undefined;
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
                            className={
                                selectedId === edge.id
                                    ? 'stroke-amber-500'
                                    : 'stroke-cyan-500'
                            }
                            markerEnd="url(#network-arrow)"
                        />
                        <path
                            d={path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="18"
                        />
                        <text
                            x={middle}
                            y={(y1 + y2) / 2 - 8}
                            textAnchor="middle"
                            className="pointer-events-none fill-slate-500 text-[10px] dark:fill-slate-300"
                        >
                            {edge.label ?? 'Alimentador'}
                        </text>
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
                return (
                    <g
                        key={node.id}
                        transform={`translate(${node.position.x} ${node.position.y})`}
                        className="cursor-grab active:cursor-grabbing"
                        onPointerDown={(event) => {
                            const svg = svgRef.current;
                            if (!svg) return;
                            event.stopPropagation();
                            svg.setPointerCapture(event.pointerId);
                            dragRef.current = {
                                nodeId: node.id,
                                pointerId: event.pointerId,
                                start: toSvgPoint(event.clientX, event.clientY),
                                origin: node.position,
                            };
                        }}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelect(node.id);
                        }}
                    >
                        <rect
                            width="200"
                            height="112"
                            rx="12"
                            className={`${selectedId === node.id ? 'fill-amber-50 stroke-amber-500 dark:fill-amber-950/60' : 'fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700'} stroke-2 drop-shadow-lg`}
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
                                {sceneName}
                            </text>
                        )}
                        <circle
                            cx="0"
                            cy="56"
                            r="8"
                            className="cursor-crosshair fill-slate-400 stroke-white stroke-2 dark:stroke-slate-900"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onFinishConnection(node.id);
                            }}
                        />
                        <circle
                            cx="200"
                            cy="56"
                            r="8"
                            className={`cursor-crosshair stroke-white stroke-2 dark:stroke-slate-900 ${connectingFrom === node.id ? 'fill-amber-500' : 'fill-cyan-500'}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onStartConnection(node.id);
                            }}
                        />
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
    );
}
