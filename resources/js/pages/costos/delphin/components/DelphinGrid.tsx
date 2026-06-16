import React, { useCallback, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CHART_HEADER_H } from '../../cronogramas/v2/types/timeline';
import { ROW_HEIGHT } from '../../cronogramas/v2/types/cell';
import type { ColumnDef, EditState, RowAction } from '../../cronogramas/v2/types/cell';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import { GanttGridRow } from '../../cronogramas/v2/components/grid/GanttGridRow';
import { GridContextMenu } from '../../cronogramas/v2/components/grid/GridContextMenu';
import type { DelphinRow } from '../types';

interface Props {
    rows:           DelphinRow[];
    allRows:        DelphinRow[];
    columns:        ColumnDef[];
    groupIds:       Set<number>;
    expandedIds:    Set<number>;
    selectedRowId:  number | null;
    editState:      EditState | null;
    scrollRef?:     React.RefObject<HTMLDivElement | null>;
    onScroll?:      (e: React.UIEvent<HTMLDivElement>) => void;
    onSelect:       (id: number) => void;
    onStartEdit:    (rowId: number, colKey: string) => void;
    onCommitField:  (id: number, field: string, value: any) => void;
    onCancelEdit:   () => void;
    onToggleExpand: (id: number) => void;
    onKeyDown:      (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onRowAction:    (taskId: number, action: RowAction) => void;
}

interface CtxState { taskId: number; x: number; y: number }

// Simple header — no column-config button (columns are controlled externally by mode)
function DelphinGridHeader({ columns }: { columns: ColumnDef[] }) {
    return (
        <div
            className="sticky top-0 z-10 flex shrink-0 items-end border-b border-slate-600 bg-slate-800 select-none"
            style={{ height: CHART_HEADER_H }}
        >
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
        </div>
    );
}

export function DelphinGrid({
    rows,
    allRows,
    columns,
    groupIds,
    expandedIds,
    selectedRowId,
    editState,
    scrollRef,
    onScroll,
    onSelect,
    onStartEdit,
    onCommitField,
    onCancelEdit,
    onToggleExpand,
    onKeyDown,
    onRowAction,
}: Props) {
    const internalRef = useRef<HTMLDivElement>(null);
    const resolvedRef = (scrollRef ?? internalRef) as React.RefObject<HTMLDivElement>;

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

    // Adapter: the loose onCommitField matches what GanttGridRow expects via its internal `as any` casts
    const adaptedCommit: <K extends keyof GanttTask>(id: number, field: K, value: GanttTask[K]) => void =
        onCommitField as any;

    return (
        <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onKeyDown={onKeyDown}
            tabIndex={0}
        >
            <DelphinGridHeader columns={columns} />

            <div
                ref={resolvedRef}
                className="relative min-h-0 flex-1 overflow-auto outline-none"
                onScroll={onScroll}
            >
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((vRow) => {
                        const row = rows[vRow.index];
                        if (!row) return null;
                        return (
                            <GanttGridRow
                                key={row.id}
                                task={row as GanttTask}
                                columns={columns}
                                allTasks={allRows as GanttTask[]}
                                isSelected={selectedRowId === row.id}
                                isGroup={groupIds.has(row.id)}
                                isExpanded={expandedIds.has(row.id)}
                                editState={editState}
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
                        Sin tareas. Usa el botón{' '}
                        <span className="mx-1 font-semibold text-slate-400">+ Fila</span>{' '}
                        para comenzar.
                    </div>
                )}
            </div>

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
