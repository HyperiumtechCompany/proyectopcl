import React, { useCallback, useRef, useState } from 'react';
import type { EditState, RowAction } from '../../types/cell';
import type { GanttTask } from '../../types/task';
import type { GanttTimeline } from '../../types/timeline';
import { GanttGrid }  from '../grid/GanttGrid';
import { GanttChart } from '../chart/GanttChart';

const MIN_GRID_W  = 380;
const MAX_GRID_W  = 1000;
const DEFAULT_W   = 720;

interface Props {
    visibleTasks:    GanttTask[];
    allTasks:        GanttTask[];
    groupIds:        Set<number>;
    criticalIds:     Set<number>;
    expandedIds:     Set<number>;
    selectedRowId:   number | null;
    editState:       EditState | null;
    timeline:        GanttTimeline;
    chartScrollRef:  React.RefObject<HTMLDivElement | null>;
    onSelect:        (id: number) => void;
    onStartEdit:     (rowId: number, colKey: string) => void;
    onCommitField:   <K extends keyof GanttTask>(id: number, field: K, value: GanttTask[K]) => void;
    onCancelEdit:    () => void;
    onToggleExpand:  (id: number) => void;
    onKeyDown:       (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onBarCommit:     (id: number, type: 'move' | 'resize', deltaDays: number) => void;
    onContinuousZoom?: (newDayWidth: number, cursorRatio: number) => void;
    onRowAction:     (taskId: number, action: RowAction) => void;
}

export function GanttShell({
    visibleTasks,
    allTasks,
    groupIds,
    criticalIds,
    expandedIds,
    selectedRowId,
    editState,
    timeline,
    chartScrollRef,
    onSelect,
    onStartEdit,
    onCommitField,
    onCancelEdit,
    onToggleExpand,
    onKeyDown,
    onBarCommit,
    onContinuousZoom,
    onRowAction,
}: Props) {
    const [gridWidth, setGridWidth] = useState(DEFAULT_W);

    // ── Scroll sync ────────────────────────────────────────────────────────
    const gridScrollRef  = useRef<HTMLDivElement>(null);
    const syncing        = useRef(false);

    const onGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (syncing.current) return;
        syncing.current = true;
        if (chartScrollRef.current) {
            chartScrollRef.current.scrollTop = e.currentTarget.scrollTop;
        }
        requestAnimationFrame(() => { syncing.current = false; });
    }, [chartScrollRef]);

    const onChartScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (syncing.current) return;
        syncing.current = true;
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = e.currentTarget.scrollTop;
        }
        requestAnimationFrame(() => { syncing.current = false; });
    }, []);

    // ── Resizer drag ────────────────────────────────────────────────────────
    const startX     = useRef(0);
    const startWidth = useRef(DEFAULT_W);

    const onResizerMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        startX.current     = e.clientX;
        startWidth.current = gridWidth;

        const onMove = (ev: MouseEvent) => {
            const delta = ev.clientX - startX.current;
            setGridWidth(w => Math.max(MIN_GRID_W, Math.min(MAX_GRID_W, startWidth.current + delta)));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [gridWidth]);

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
            {/* ── Panel izquierdo: grid ─────────────────────────────────── */}
            <div
                className="flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-slate-700"
                style={{ width: gridWidth }}
            >
                <GanttGrid
                    visibleTasks={visibleTasks}
                    allTasks={allTasks}
                    groupIds={groupIds}
                    expandedIds={expandedIds}
                    selectedRowId={selectedRowId}
                    editState={editState}
                    scrollRef={gridScrollRef}
                    onSelect={onSelect}
                    onStartEdit={onStartEdit}
                    onCommitField={onCommitField}
                    onCancelEdit={onCancelEdit}
                    onToggleExpand={onToggleExpand}
                    onKeyDown={onKeyDown}
                    onScroll={onGridScroll}
                    onRowAction={onRowAction}
                />
            </div>

            {/* ── Resizer ────────────────────────────────────────────────── */}
            <div
                className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-slate-700 transition-colors hover:bg-blue-500"
                onMouseDown={onResizerMouseDown}
            >
                <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-500/10" />
            </div>

            {/* ── Panel derecho: chart ──────────────────────────────────── */}
            <GanttChart
                visibleTasks={visibleTasks}
                groupIds={groupIds}
                criticalIds={criticalIds}
                selectedRowId={selectedRowId}
                timeline={timeline}
                scrollRef={chartScrollRef}
                onScroll={onChartScroll}
                onSelect={onSelect}
                onBarCommit={onBarCommit}
                onContinuousZoom={onContinuousZoom}
            />
        </div>
    );
}
