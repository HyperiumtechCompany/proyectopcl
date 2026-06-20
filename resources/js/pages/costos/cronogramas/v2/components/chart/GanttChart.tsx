import React, { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GanttTask } from '../../types/task';
import type { GanttTimeline } from '../../types/timeline';
import { MIN_DAY_WIDTH, MAX_DAY_WIDTH } from '../../types/timeline';
import { ROW_HEIGHT } from '../../types/cell';
import type { GanttBarLabel } from '../../types/cell';
import { GanttChartHeader } from './GanttChartHeader';
import { GanttBar } from './GanttBar';
import { GanttDependencyLines } from './GanttDependencyLines';
import dayjs from 'dayjs';

// ─── Drag state ───────────────────────────────────────────────────────────────
interface DragState {
    type: 'move' | 'resize';
    taskId: number;
    deltaDays: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    visibleTasks: GanttTask[];
    groupIds: Set<number>;
    criticalIds: Set<number>;
    selectedRowId: number | null;
    timeline: GanttTimeline;
    barLabel?: GanttBarLabel;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    onSelect: (id: number) => void;
    onBarCommit: (
        id: number,
        type: 'move' | 'resize',
        deltaDays: number,
    ) => void;
    onContinuousZoom?: (newDayWidth: number, cursorRatio: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
export function GanttChart({
    visibleTasks,
    groupIds,
    criticalIds,
    selectedRowId,
    timeline,
    barLabel = 'descripcion',
    scrollRef,
    onScroll,
    onSelect,
    onBarCommit,
    onContinuousZoom,
}: Props) {
    const virtualizer = useVirtualizer({
        count: visibleTasks.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 12,
    });

    const todayX = timeline.dateToX(dayjs().format('YYYY-MM-DD'));

    // ── Posiciones de inicio/fin del proyecto ─────────────────────────────────
    const projectStart = timeline.calendarSettings?.projectStart ?? null;
    const projectEnd   = timeline.calendarSettings?.projectEnd   ?? null;
    const projectStartX = projectStart ? timeline.dateToX(projectStart) : null;
    const projectEndX   = projectEnd   ? timeline.dateToX(projectEnd)   : null;

    // ── Drag state ────────────────────────────────────────────────────────────
    const [drag, setDrag] = useState<DragState | null>(null);

    // Refs para evitar stale closures en los event listeners nativos
    const deltaRef = useRef(0);
    const timelineRef = useRef(timeline);
    timelineRef.current = timeline;
    const zoomCallbackRef = useRef(onContinuousZoom);
    zoomCallbackRef.current = onContinuousZoom;

    // Limpia estilos de body si el componente se desmonta durante un drag
    useEffect(
        () => () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        },
        [],
    );

    // ── Sync encabezado horizontal ─────────────────────────────────────────────
    const headerScrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
        if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
        onScroll(e);
    }, [onScroll]);

    // ── Ctrl+Scroll zoom horizontal ───────────────────────────────────────────
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            
            // Verificamos que el mouse esté dentro del contenedor principal del Gantt
            const chartEl = scrollRef.current;
            if (!chartEl) return;
            
            // Opcional: solo interceptar si el cursor está dentro de chartEl
            // if (!chartEl.contains(e.target as Node)) return;

            e.preventDefault();
            e.stopPropagation();

            const rect = chartEl.getBoundingClientRect();
            const cursorXInContainer = e.clientX - rect.left + chartEl.scrollLeft;
            const cursorRatio = cursorXInContainer / Math.max(1, timelineRef.current.totalWidth);

            const factor = e.deltaY < 0 ? 1.12 : 0.88;
            const newDayWidth = Math.min(
                MAX_DAY_WIDTH,
                Math.max(MIN_DAY_WIDTH, timelineRef.current.dayWidth * factor),
            );

            zoomCallbackRef.current?.(newDayWidth, cursorRatio);
        };

        // Escuchar en document para asegurar que el navegador no intercepte el zoom
        document.addEventListener('wheel', handleWheel, { passive: false });
        return () => document.removeEventListener('wheel', handleWheel);
    }, [scrollRef]);

    // ── Inicio de drag desde GanttBar ─────────────────────────────────────────
    const handleBarDragStart = useCallback(
        (e: React.MouseEvent, id: number, type: 'move' | 'resize') => {
            if (e.button !== 0) return;
            e.preventDefault();

            const startX = e.clientX;
            deltaRef.current = 0;
            setDrag({ type, taskId: id, deltaDays: 0 });

            document.body.style.cursor =
                type === 'move' ? 'grabbing' : 'ew-resize';
            document.body.style.userSelect = 'none';

            const onMove = (ev: MouseEvent) => {
                const days = Math.round(
                    (ev.clientX - startX) / timelineRef.current.dayWidth,
                );
                deltaRef.current = days;
                setDrag((prev) => (prev ? { ...prev, deltaDays: days } : null));
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';

                if (deltaRef.current !== 0) {
                    onBarCommit(id, type, deltaRef.current);
                }
                setDrag(null);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        },
        [onBarCommit],
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Cabecera tiempo — fija verticalmente, sincroniza scroll horizontal */}
            <div ref={headerScrollRef} className="shrink-0 overflow-hidden">
                <GanttChartHeader timeline={timeline} />
            </div>

            {/* Cuerpo: scroll vertical + horizontal */}
            <div
                ref={scrollRef as React.RefObject<HTMLDivElement>}
                className="relative min-h-0 flex-1 overflow-auto"
                onScroll={handleScroll}
            >
            {/* Cuerpo interno */}
            <div
                style={{
                    position: 'relative',
                    height: virtualizer.getTotalSize(),
                    minWidth: timeline.totalWidth,
                }}
            >
                {/* Franjas de dias no laborables y feriados */}
                {timeline.bottomCols
                    .filter((c) => c.isNonWorking)
                    .map((col, i) => (
                        <div
                            key={i}
                            className={`pointer-events-none absolute inset-y-0 ${
                                col.isHoliday
                                    ? 'bg-amber-900/20'
                                    : 'bg-slate-800/30'
                            }`}
                            style={{ left: col.x, width: col.width }}
                            title={col.holidayName ?? col.date}
                        />
                    ))}

                {/* Guías verticales de columna */}
                {timeline.bottomCols.map((col, i) => (
                    <div
                        key={`vl-${i}`}
                        className="pointer-events-none absolute inset-y-0 w-px bg-slate-700/20"
                        style={{ left: col.x + col.width - 1 }}
                    />
                ))}

                {/* Marcador inicio del proyecto */}
                {projectStartX !== null && (
                    <div
                        className="pointer-events-none absolute inset-y-0 z-20"
                        style={{
                            left: projectStartX,
                            borderLeft: '2px dashed rgba(239,68,68,0.85)',
                        }}
                    >
                        <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-sm bg-red-600 px-1 text-[9px] font-bold text-white">
                            INICIO
                        </div>
                    </div>
                )}

                {/* Marcador fin del proyecto */}
                {projectEndX !== null && (
                    <div
                        className="pointer-events-none absolute inset-y-0 z-20"
                        style={{
                            left: projectEndX,
                            borderLeft: '2px dashed rgba(239,68,68,0.85)',
                        }}
                    >
                        <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-sm bg-red-600 px-1 text-[9px] font-bold text-white">
                            FIN
                        </div>
                    </div>
                )}

                {/* Marcador "HOY" */}
                <div
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-emerald-500/80"
                    style={{ left: todayX }}
                >
                    <div className="absolute top-0 -translate-x-1/2 rounded-sm bg-emerald-500 px-1 text-[9px] font-bold text-white">
                        HOY
                    </div>
                </div>

                {/* Líneas de dependencia (SVG detrás de las barras) */}
                <GanttDependencyLines
                    visibleTasks={visibleTasks}
                    timeline={timeline}
                    criticalIds={criticalIds}
                    totalHeight={virtualizer.getTotalSize()}
                    viewportTop={virtualizer.getVirtualItems()[0]?.start ?? 0}
                    viewportHeight={
                        (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end ?? 800) -
                        (virtualizer.getVirtualItems()[0]?.start ?? 0)
                    }
                />

                {/* Filas virtuales */}
                {virtualizer.getVirtualItems().map((vRow) => {
                    const task = visibleTasks[vRow.index];
                    if (!task) return null;

                    const isSelected = selectedRowId === task.id;
                    const isDragging = drag?.taskId === task.id;

                    return (
                        <div
                            key={task.id}
                            className={`absolute left-0 border-b border-slate-700/30 ${
                                isSelected ? 'bg-blue-900/15' : ''
                            }`}
                            style={{
                                top: vRow.start,
                                height: ROW_HEIGHT,
                                width: timeline.totalWidth,
                            }}
                            onClick={() => onSelect(task.id)}
                        >
                            <GanttBar
                                task={task}
                                timeline={timeline}
                                isGroup={groupIds.has(task.id)}
                                isSelected={isSelected}
                                isCritical={criticalIds.has(task.id)}
                                barLabel={barLabel}
                                previewDeltaDays={
                                    isDragging ? drag!.deltaDays : 0
                                }
                                dragType={isDragging ? drag!.type : null}
                                onSelect={onSelect}
                                onDragStart={handleBarDragStart}
                            />
                        </div>
                    );
                })}
            </div>
            </div>
        </div>
    );
}
