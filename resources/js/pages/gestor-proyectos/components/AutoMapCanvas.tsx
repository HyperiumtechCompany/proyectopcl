import { memo, useEffect, useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from 'react';
import { COLORS } from './types';
import type { LayoutPosition, TreeNode } from './types';
import { MapNodeCard } from './MapNodeCard';

interface MapEdge {
    from: LayoutPosition;
    to: LayoutPosition;
}

const MapEdges = memo(function MapEdges({ edges, maxX, maxY }: { edges: MapEdge[]; maxX: number; maxY: number }) {
    return (
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={maxX} height={maxY}>
            {edges.map((edge, index) => {
                const isDetailEdge = edge.to.lane === 'detail';
                const x1 = isDetailEdge ? edge.from.x + 232 : edge.from.x + 232 / 2;
                const y1 = isDetailEdge ? edge.from.y + 80 / 2 : edge.from.y + 80;
                const x2 = isDetailEdge ? edge.to.x : edge.to.x + 232 / 2;
                const y2 = isDetailEdge ? edge.to.y + 80 / 2 : edge.to.y;
                const mid = isDetailEdge ? (x1 + x2) / 2 : (y1 + y2) / 2;
                const color = COLORS[edge.from.node.color] || COLORS.violet;
                return (
                    <path
                        key={`${edge.from.node.id}-${edge.to.node.id}-${index}`}
                        d={isDetailEdge ? `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}` : `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                        stroke={color.line}
                        strokeOpacity={isDetailEdge ? 0.32 : 0.52}
                        strokeWidth={1.75}
                        fill="none"
                    />
                );
            })}
        </svg>
    );
});

const MapNodes = memo(function MapNodes({
    nodeList,
    selectedId,
    onSelectNode,
    onToggleNode,
    onAddChildNode,
}: {
    nodeList: LayoutPosition[];
    selectedId: string | null;
    onSelectNode: (node: TreeNode) => void;
    onToggleNode: (id: string) => void;
    onAddChildNode: (parentId: string) => void;
}) {
    return (
        <>
            {nodeList.map((position) => (
                <MapNodeCard
                    key={position.node.id}
                    position={position}
                    isSelected={selectedId === position.node.id}
                    onSelect={onSelectNode}
                    onToggle={onToggleNode}
                    onAddChild={onAddChildNode}
                />
            ))}
        </>
    );
});

interface AutoMapCanvasProps {
    nodeList: LayoutPosition[];
    edges: MapEdge[];
    maxX: number;
    maxY: number;
    scale: number;
    pan: { x: number; y: number };
    setScale: Dispatch<SetStateAction<number>>;
    setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
    selectedId: string | null;
    onSelectNode: (node: TreeNode) => void;
    onToggleNode: (id: string) => void;
    onAddChildNode: (parentId: string) => void;
    children?: ReactNode;
}

export function AutoMapCanvas({ nodeList, edges, maxX, maxY, scale, pan, setScale, setPan, selectedId, onSelectNode, onToggleNode, onAddChildNode, children }: AutoMapCanvasProps) {
    const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.target instanceof Element && event.target.closest('[data-node]')) {
            return;
        }

        dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            panX: pan.x,
            panY: pan.y,
        };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) {
            return;
        }

        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
    };

    const onPointerUp = () => {
        dragRef.current = null;
    };

    useEffect(() => {
        const node = canvasRef.current;
        if (!node) {
            return;
        }

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const delta = -event.deltaY * 0.001;
            setScale((current) => Math.min(2, Math.max(0.3, current + delta)));
        };

        // React registra onWheel como listener pasivo por defecto, lo que impide
        // preventDefault ahi; por eso se agrega manualmente como no-pasivo.
        node.addEventListener('wheel', onWheel, { passive: false });
        return () => node.removeEventListener('wheel', onWheel);
    }, [setScale]);

    return (
        <div className="relative flex-1 min-h-0 overflow-hidden">
            <div
                ref={canvasRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                    backgroundSize: `${22 * scale}px ${22 * scale}px`,
                    backgroundPosition: `${pan.x}px ${pan.y}px`,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}>
                <div
                    className="absolute left-0 top-0"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        width: maxX,
                        height: maxY,
                    }}>
                    <MapEdges edges={edges} maxX={maxX} maxY={maxY} />
                    <MapNodes nodeList={nodeList} selectedId={selectedId} onSelectNode={onSelectNode} onToggleNode={onToggleNode} onAddChildNode={onAddChildNode} />
                </div>
            </div>
            {children}
        </div>
    );
}
