import React, { useCallback, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ROW_HEIGHT } from '../../types/cell';
import type { EditState, RowAction } from '../../types/cell';
import type { GanttTask } from '../../types/task';
import { useGanttColumns } from '../../composables/useGanttColumns';
import { GanttGridHeader } from './GanttGridHeader';
import { GanttGridRow }    from './GanttGridRow';
import { GridContextMenu } from './GridContextMenu';

interface Props {
    visibleTasks:   GanttTask[];
    allTasks:       GanttTask[];
    groupIds:       Set<number>;
    expandedIds:    Set<number>;
    selectedRowId:  number | null;
    editState:      EditState | null;
    scrollRef?:     React.RefObject<HTMLDivElement | null>;
    onScroll?:      (e: React.UIEvent<HTMLDivElement>) => void;
    onSelect:       (id: number) => void;
    onStartEdit:    (rowId: number, colKey: string) => void;
    onCommitField:  <K extends keyof GanttTask>(id: number, field: K, value: GanttTask[K]) => void;
    onCancelEdit:   () => void;
    onToggleExpand: (id: number) => void;
    onKeyDown:      (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onRowAction:    (taskId: number, action: RowAction) => void;
}

interface CtxState { taskId: number; x: number; y: number }

export function GanttGrid({
    visibleTasks,
    allTasks,
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

    // ── Column widths + visibility ────────────────────────────────────────────
    const { visibleColumns, hiddenKeys, resizeCol, toggleHidden } =
        useGanttColumns();

    // ── Context menu state ────────────────────────────────────────────────────
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

    // ── Virtualizer ───────────────────────────────────────────────────────────
    const virtualizer = useVirtualizer({
        count:            visibleTasks.length,
        getScrollElement: () => resolvedRef.current,
        estimateSize:     () => ROW_HEIGHT,
        overscan:         10,
    });

    // ── Stable onContextMenu ref to avoid row re-renders ─────────────────────
    const ctxRef = useRef(handleContextMenu);
    ctxRef.current = handleContextMenu;
    const stableCtx = useCallback(
        (id: number, x: number, y: number) => ctxRef.current(id, x, y),
        [],
    );

    return (
        <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onKeyDown={onKeyDown}
            tabIndex={0}
        >
            {/* Header with resize handles + column config */}
            <GanttGridHeader
                columns={visibleColumns}
                hiddenKeys={hiddenKeys}
                onResizeCol={resizeCol}
                onToggleHidden={toggleHidden}
            />

            {/* Scrollable body */}
            <div
                ref={resolvedRef}
                className="relative min-h-0 flex-1 overflow-auto outline-none"
                onScroll={onScroll}
            >
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((vRow) => {
                        const task = visibleTasks[vRow.index];
                        if (!task) return null;

                        return (
                            <GanttGridRow
                                key={task.id}
                                task={task}
                                columns={visibleColumns}
                                allTasks={allTasks}
                                isSelected={selectedRowId === task.id}
                                isGroup={groupIds.has(task.id)}
                                isExpanded={expandedIds.has(task.id)}
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
                                onCommitField={onCommitField}
                                onCancelEdit={onCancelEdit}
                                onToggleExpand={onToggleExpand}
                                onContextMenu={stableCtx}
                            />
                        );
                    })}
                </div>

                {visibleTasks.length === 0 && (
                    <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                        Sin tareas. Usa el botón{' '}
                        <span className="mx-1 font-semibold text-slate-400">
                            + Fila
                        </span>{' '}
                        para comenzar.
                    </div>
                )}
            </div>

            {/* Context menu */}
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
