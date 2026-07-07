import { memo } from 'react';
import { ChevronRight, FileText, Plus } from 'lucide-react';
import { COLORS, LEVEL_LABELS, STATUS_DOT, TYPE_ICON } from './types';
import type { LayoutPosition, TreeNode } from './types';
import { NODE_H, NODE_W } from './layout';

interface MapNodeCardProps {
    position: LayoutPosition;
    isSelected: boolean;
    onSelect: (node: TreeNode) => void;
    onToggle: (id: string) => void;
    onAddChild: (parentId: string) => void;
}

function MapNodeCardComponent({ position, isSelected, onSelect, onToggle, onAddChild }: MapNodeCardProps) {
    const color = COLORS[position.node.color] || COLORS.violet;
    const Icon = TYPE_ICON[position.node.type] || FileText;
    const isRoot = position.parentId === null;
    const isCircle = position.node.shape === 'circle';
    const levelLabel = isRoot ? 'Padre' : position.lane === 'main' ? 'Hijo' : (LEVEL_LABELS[position.depth] ?? `Nivel ${position.depth + 1}`);
    const detailDepth = position.lane === 'detail' ? Math.max(1, position.depth) : 0;
    const visualScale = Math.max(0.9, 1 - detailDepth * 0.025);
    const visualOpacity = Math.max(0.78, 1 - detailDepth * 0.035);

    return (
        <div
            data-node
            style={{ left: position.x, top: position.y, width: NODE_W, height: NODE_H, transform: `scale(${visualScale})`, transformOrigin: 'center top', opacity: visualOpacity }}
            className="absolute">
            <button
                onClick={() => onSelect(position.node)}
                className={`group relative flex h-full w-full flex-col justify-between rounded-lg border bg-[#13151b] p-3 text-left shadow-[0_1px_0_rgba(255,255,255,0.03)] transition-all hover:border-white/20 ${isSelected ? color.border.replace('/40', '/90') : 'border-white/10'} ${isSelected ? `ring-1 ${color.border.replace('border-', 'ring-')}` : ''}`}>
                <span className={`absolute left-0 top-2 bottom-2 w-0.75 rounded-full ${color.bg}`} />

                <div className="pl-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${isCircle ? 'rounded-full' : 'rounded-sm'} ${color.soft}`}>
                                <Icon size={11} className={color.text} />
                            </span>
                            <span className="truncate text-[13px] font-medium leading-tight text-zinc-100">{position.node.title}</span>
                        </div>
                        {isRoot && (
                            <span className="shrink-0 rounded border border-white/10 px-1 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">Proyecto</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 pl-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[position.node.status] || 'bg-zinc-600'}`} />
                        <span className="text-[10.5px] text-zinc-500">{position.node.status || '-'}</span>
                        <span className="text-zinc-700">/</span>
                        <span className="text-[10.5px] uppercase tracking-wide text-zinc-600">{levelLabel}</span>
                    </div>
                </div>

                {position.hasChildren && (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggle(position.node.id);
                        }}
                        className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#1a1d27] text-zinc-300 transition-transform hover:scale-110 hover:border-white/30">
                        <ChevronRight size={13} className={`transition-transform ${position.expanded ? 'rotate-180' : ''}`} />
                    </span>
                )}

                {!position.hasChildren && (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                            event.stopPropagation();
                            onAddChild(position.node.id);
                        }}
                        title="Anadir nodo hijo"
                        className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-white/15 bg-[#1a1d27] text-zinc-500 opacity-0 transition-colors hover:border-white/30 hover:text-zinc-200 group-hover:opacity-100"
                    >
                        <Plus size={12} />
                    </span>
                )}
            </button>
        </div>
    );
}

export const MapNodeCard = memo(MapNodeCardComponent);
