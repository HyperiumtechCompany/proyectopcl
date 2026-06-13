import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Columns3 } from 'lucide-react';
import type { ColumnDef } from '../../types/cell';
import { COLUMNS } from '../../types/cell';
import { CHART_HEADER_H } from '../../types/timeline';

interface Props {
    columns: ColumnDef[];
    hiddenKeys: Set<string>;
    onResizeCol: (key: string, newWidth: number) => void;
    onToggleHidden: (key: string) => void;
}

// ─── Resize handle ────────────────────────────────────────────────────────────
function ResizeHandle({
    colKey,
    currentWidth,
    onResize,
}: {
    colKey: string;
    currentWidth: number;
    onResize: (key: string, w: number) => void;
}) {
    const startX = useRef(0);
    const startW = useRef(0);

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startX.current = e.clientX;
        startW.current = currentWidth;

        const onMove = (ev: MouseEvent) => {
            onResize(colKey, startW.current + (ev.clientX - startX.current));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    return (
        <div
            className="group/rh absolute inset-y-0 right-0 z-20 w-3 cursor-col-resize select-none"
            onMouseDown={onMouseDown}
        >
            <div className="absolute inset-y-1 right-0.5 w-0.5 rounded bg-transparent transition-colors group-hover/rh:bg-blue-400" />
        </div>
    );
}

// ─── Column config popover ────────────────────────────────────────────────────
function ColumnConfigPopover({
    anchor,
    hiddenKeys,
    onToggle,
    onClose,
}: {
    anchor: DOMRect;
    hiddenKeys: Set<string>;
    onToggle: (key: string) => void;
    onClose: () => void;
}) {
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-col-config]')) onClose();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const style: React.CSSProperties = {
        position: 'fixed',
        top: anchor.bottom + 4,
        right: window.innerWidth - anchor.right,
        zIndex: 9999,
    };

    return createPortal(
        <div
            data-col-config
            className="w-48 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-2xl"
            style={style}
        >
            <div className="mb-1 px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Columnas visibles
            </div>
            {COLUMNS.map((col) => {
                const isVisible = !hiddenKeys.has(col.key);
                const isLocked  = col.key === 'item_order';
                return (
                    <button
                        key={col.key}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isLocked}
                        onClick={() => onToggle(col.key)}
                    >
                        <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                                isVisible
                                    ? 'border-blue-500 bg-blue-600 text-white'
                                    : 'border-slate-600 bg-transparent'
                            }`}
                        >
                            {isVisible && <Check size={9} strokeWidth={3} />}
                        </span>
                        <span className="flex-1">{col.label}</span>
                        {isLocked && (
                            <span className="text-[9px] text-slate-600">fijo</span>
                        )}
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function GanttGridHeader({
    columns,
    hiddenKeys,
    onResizeCol,
    onToggleHidden,
}: Props) {
    const [configOpen, setConfigOpen] = useState(false);
    const configBtnRef = useRef<HTMLButtonElement>(null);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    const openConfig = () => {
        if (configBtnRef.current) {
            setAnchorRect(configBtnRef.current.getBoundingClientRect());
            setConfigOpen(true);
        }
    };

    return (
        <div
            className="sticky top-0 z-10 flex shrink-0 items-end border-b border-slate-600 bg-slate-800 select-none"
            style={{ height: CHART_HEADER_H }}
        >
            {/* Column cells */}
            {columns.map((col) => (
                <div
                    key={col.key}
                    className={`relative shrink-0 overflow-hidden truncate border-r border-slate-700 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 last:border-r-0 ${
                        col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                    }`}
                    style={{ width: col.width }}
                    title={col.label}
                >
                    {col.label}
                    <ResizeHandle
                        colKey={col.key}
                        currentWidth={col.width}
                        onResize={onResizeCol}
                    />
                </div>
            ))}

            {/* Column config button */}
            <button
                ref={configBtnRef}
                data-col-config
                className="ml-auto flex h-full w-8 shrink-0 items-center justify-center border-l border-slate-700 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
                title="Configurar columnas"
                onClick={openConfig}
            >
                <Columns3 size={13} />
            </button>

            {/* Popover */}
            {configOpen && anchorRect && (
                <ColumnConfigPopover
                    anchor={anchorRect}
                    hiddenKeys={hiddenKeys}
                    onToggle={onToggleHidden}
                    onClose={() => setConfigOpen(false)}
                />
            )}
        </div>
    );
}
