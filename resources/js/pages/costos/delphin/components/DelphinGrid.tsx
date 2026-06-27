import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Columns3, Maximize2, Minimize2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CHART_HEADER_H } from '../../cronogramas/v2/types/timeline';
import { ROW_HEIGHT } from '../../cronogramas/v2/types/cell';
import type { ColumnDef, EditState, RowAction } from '../../cronogramas/v2/types/cell';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import { GanttGridRow } from '../../cronogramas/v2/components/grid/GanttGridRow';
import { GridContextMenu } from '../../cronogramas/v2/components/grid/GridContextMenu';
import type { DelphinRow } from '../types';

const fmtCurrency = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROW_NUM_W = 32;

/** Returns text color class for the description column based on hierarchy level */
function getDescTextClass(row: DelphinRow, isGroup: boolean): string | undefined {
    if (!isGroup) return undefined; // leaf → default (text-slate-200)
    if (row.nivel === 1) return 'text-amber-400';
    if (row.nivel === 2) return 'text-sky-300';
    return 'text-violet-300'; // nivel 3+
}

interface Props {
    rows:               DelphinRow[];
    allRows:            DelphinRow[];
    columns:            ColumnDef[];
    allColumns:         ColumnDef[];
    hiddenKeys:         Set<string>;
    descExpanded:       boolean;
    groupIds:           Set<number>;
    expandedIds:        Set<number>;
    selectedRowId:      number | null;
    editState:          EditState | null;
    scrollRef?:         React.RefObject<HTMLDivElement | null>;
    scrollToRowId?:     number | null;
    onScroll?:          (e: React.UIEvent<HTMLDivElement>) => void;
    onSelect:           (id: number) => void;
    onStartEdit:        (rowId: number, colKey: string) => void;
    onCommitField:      (id: number, field: string, value: any) => void;
    onCancelEdit:       () => void;
    onToggleExpand:     (id: number) => void;
    onKeyDown:          (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onRowAction:        (taskId: number, action: RowAction) => void;
    onToggleHidden:     (key: string) => void;
    onToggleDescExpand: () => void;
}

interface CtxState { taskId: number; x: number; y: number }

// ─── Column config popover ────────────────────────────────────────────────────
function ColumnConfigPopover({
    anchor,
    allColumns,
    hiddenKeys,
    onToggle,
    onClose,
}: {
    anchor:     DOMRect;
    allColumns: ColumnDef[];
    hiddenKeys: Set<string>;
    onToggle:   (key: string) => void;
    onClose:    () => void;
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
        top:      anchor.bottom + 4,
        right:    window.innerWidth - anchor.right,
        zIndex:   9999,
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
            {allColumns.map((col) => {
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
function DelphinGridHeader({
    columns,
    allColumns,
    hiddenKeys,
    descExpanded,
    onToggleHidden,
    onToggleDescExpand,
}: {
    columns:            ColumnDef[];
    allColumns:         ColumnDef[];
    hiddenKeys:         Set<string>;
    descExpanded:       boolean;
    onToggleHidden:     (key: string) => void;
    onToggleDescExpand: () => void;
}) {
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
            className="flex shrink-0 items-end border-b border-slate-600 bg-slate-800 select-none"
            style={{ height: CHART_HEADER_H }}
        >
            {/* Row number gutter header */}
            <div
                className="shrink-0 border-r border-slate-700 px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 sticky left-0 bg-slate-800 z-10"
                style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W }}
            >
                #
            </div>
            {columns.map((col) => (
                <div
                    key={col.key}
                    className={`relative shrink-0 overflow-hidden truncate border-r border-slate-700 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 last:border-r-0 ${
                        col.align === 'center' ? 'text-center'
                        : col.align === 'right'  ? 'text-right'
                        : 'text-left'
                    }`}
                    style={{ width: col.width }}
                    title={col.label}
                >
                    {col.label}
                </div>
            ))}

            {/* Expand/collapse description width */}
            <button
                title={descExpanded ? 'Contraer columna descripción' : 'Ampliar columna descripción'}
                className="flex h-full w-7 shrink-0 items-center justify-center border-l border-slate-700 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
                onClick={onToggleDescExpand}
            >
                {descExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>

            {/* Column visibility */}
            <button
                ref={configBtnRef}
                data-col-config
                title="Mostrar/ocultar columnas"
                className="flex h-full w-7 shrink-0 items-center justify-center border-l border-slate-700 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
                onClick={openConfig}
            >
                <Columns3 size={13} />
            </button>

            {configOpen && anchorRect && (
                <ColumnConfigPopover
                    anchor={anchorRect}
                    allColumns={allColumns}
                    hiddenKeys={hiddenKeys}
                    onToggle={onToggleHidden}
                    onClose={() => setConfigOpen(false)}
                />
            )}
        </div>
    );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
export function DelphinGrid({
    rows,
    allRows,
    columns,
    allColumns,
    hiddenKeys,
    descExpanded,
    groupIds,
    expandedIds,
    selectedRowId,
    editState,
    scrollRef,
    scrollToRowId,
    onScroll,
    onSelect,
    onStartEdit,
    onCommitField,
    onCancelEdit,
    onToggleExpand,
    onKeyDown,
    onRowAction,
    onToggleHidden,
    onToggleDescExpand,
}: Props) {
    const internalRef       = useRef<HTMLDivElement>(null);
    const resolvedRef       = (scrollRef ?? internalRef) as React.RefObject<HTMLDivElement>;
    const headerContainerRef = useRef<HTMLDivElement>(null);

    const [ctx, setCtx] = useState<CtxState | null>(null);

    const handleContextMenu = useCallback(
        (taskId: number, x: number, y: number) => setCtx({ taskId, x, y }),
        [],
    );
    const closeCtx = useCallback(() => setCtx(null), []);
    const handleCtxAction = useCallback(
        (action: RowAction) => {
            if (!ctx) return;
            onRowAction(ctx.taskId, action);
            closeCtx();
        },
        [ctx, onRowAction, closeCtx],
    );

    const ctxRef = useRef(handleContextMenu);
    ctxRef.current = handleContextMenu;
    const stableCtx = useCallback(
        (id: number, x: number, y: number) => ctxRef.current(id, x, y),
        [],
    );

    const virtualizer = useVirtualizer({
        count:            rows.length,
        getScrollElement: () => resolvedRef.current,
        estimateSize:     () => ROW_HEIGHT,
        overscan:         10,
    });

    useEffect(() => {
        if (scrollToRowId == null) return;
        const index = rows.findIndex(r => r.id === scrollToRowId);
        if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollToRowId, rows]);

    const adaptedCommit: <K extends keyof GanttTask>(id: number, field: K, value: GanttTask[K]) => void =
        onCommitField as any;

    // Costo Directo = sum of all root nodes (nivel 1) from full dataset
    const hasParcialCol = columns.some((c) => c.key === 'parcial');
    const costoDirecto = useMemo(
        () => allRows.filter((r) => r.nivel === 1).reduce((s, r) => s + (r.parcial ?? 0), 0),
        [allRows],
    );

    return (
        <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onKeyDown={onKeyDown}
            tabIndex={0}
        >
            {/* overflow-x: hidden lets scrollLeft be set via JS (scroll sync) */}
            <div ref={headerContainerRef} style={{ overflowX: 'hidden' }}>
                <DelphinGridHeader
                    columns={columns}
                    allColumns={allColumns}
                    hiddenKeys={hiddenKeys}
                    descExpanded={descExpanded}
                    onToggleHidden={onToggleHidden}
                    onToggleDescExpand={onToggleDescExpand}
                />
            </div>

            <div
                ref={resolvedRef}
                className="relative min-h-0 flex-1 overflow-auto outline-none"
                onScroll={(e) => {
                    if (headerContainerRef.current) {
                        headerContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
                    }
                    onScroll?.(e);
                }}
            >
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((vRow) => {
                        const row = rows[vRow.index];
                        if (!row) return null;
                        const isGroup = groupIds.has(row.id);
                        return (
                            <GanttGridRow
                                key={row.id}
                                task={row as GanttTask}
                                columns={columns}
                                allTasks={allRows as GanttTask[]}
                                isSelected={selectedRowId === row.id}
                                isGroup={isGroup}
                                isExpanded={expandedIds.has(row.id)}
                                editState={editState}
                                descTextClass={getDescTextClass(row, isGroup)}
                                rowIndex={vRow.index}
                                style={{
                                    position: 'absolute',
                                    top:      vRow.start,
                                    left:     0,
                                    right:    0,
                                    height:   ROW_HEIGHT,
                                }}
                                onSelect={onSelect}
                                onStartEdit={onStartEdit}
                                onCommitField={adaptedCommit}
                                onCancelEdit={onCancelEdit}
                                onToggleExpand={onToggleExpand}
                                onContextMenu={stableCtx}
                            />
                        );
                    })}
                </div>

                {rows.length === 0 && (
                    <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                        Sin resultados.
                    </div>
                )}
            </div>

            {/* ── Costo Directo footer (budget mode only) ──────────────────── */}
            {hasParcialCol && (
                <div className="flex shrink-0 border-t-2 border-amber-600/60 bg-slate-900 text-xs font-bold select-none">
                    {/* Row number gutter footer */}
                    <div style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W }} className="shrink-0 border-r border-slate-700/50" />
                    {columns.map((col) => (
                        <div
                            key={col.key}
                            style={{ width: col.width, minWidth: col.width }}
                            className={`shrink-0 border-r border-slate-700/50 px-2 py-2 last:border-r-0 ${
                                col.align === 'right'  ? 'text-right'  :
                                col.align === 'center' ? 'text-center' : 'text-left'
                            }`}
                        >
                            {col.key === 'descripcion' ? (
                                <span className="text-amber-400 uppercase tracking-wide">Costo Directo</span>
                            ) : col.key === 'parcial' ? (
                                <span className="font-mono text-amber-400">{fmtCurrency(costoDirecto)}</span>
                            ) : col.key === 'item_order' ? null : (
                                <span className="text-slate-700">—</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {ctx && (
                <GridContextMenu
                    x={ctx.x}
                    y={ctx.y}
                    taskId={ctx.taskId}
                    isGroup={groupIds.has(ctx.taskId)}
                    isExpanded={expandedIds.has(ctx.taskId)}
                    onAction={handleCtxAction}
                    onClose={closeCtx}
                />
            )}
        </div>
    );
}
