import React from 'react';
import type { GanttTask } from '../../types/task';
import type { GanttTimeline } from '../../types/timeline';
import type { GanttBarLabel } from '../../types/cell';
import { buildWorkingDateSegments } from '../../types/calendar';
import { diffInclusiveDays, normalizeGanttDate } from '../../utils/date';

const BAR_PAD_V = 7; // px padding vertical (leaf)
const GROUP_PAD = 9; // px padding vertical (grupos)
const ROW_H = 32; // debe coincidir con ROW_HEIGHT de cell.ts
const RESIZE_W = 7; // ancho del handle de redimensión

interface Props {
    task: GanttTask;
    timeline: GanttTimeline;
    isGroup: boolean;
    isSelected: boolean;
    isCritical?: boolean;
    barLabel?: GanttBarLabel;
    /** Días de desplazamiento durante drag (positivo = derecha, negativo = izquierda) */
    previewDeltaDays?: number;
    /** null = sin drag, 'move' = arrastrando, 'resize' = redimensionando */
    dragType?: 'move' | 'resize' | null;
    onSelect: (id: number) => void;
    onDragStart?: (
        e: React.MouseEvent,
        id: number,
        type: 'move' | 'resize',
    ) => void;
}

const GanttBarComponent = function GanttBar({
    task,
    timeline,
    isGroup,
    isSelected,
    isCritical = false,
    barLabel = 'descripcion',
    previewDeltaDays = 0,
    dragType = null,
    onSelect,
    onDragStart,
}: Props) {
    const fechaInicio = normalizeGanttDate(task.fecha_inicio);
    const fechaFin = normalizeGanttDate(task.fecha_fin);
    if (!fechaInicio) return null;

    const durationDays =
        diffInclusiveDays(fechaInicio, fechaFin) ?? task.duracion_dias;
    const baseX = timeline.dateToX(fechaInicio);
    const baseW = Math.max(
        timeline.dayWidth,
        (fechaFin
            ? timeline.dateToX(fechaFin) + timeline.dayWidth
            : baseX + timeline.dayWidth) - baseX,
    );
    const pxShift = previewDeltaDays * timeline.dayWidth;

    const x = dragType === 'move' ? baseX + pxShift : baseX;
    const w =
        dragType === 'resize'
            ? Math.max(timeline.dayWidth, baseW + pxShift)
            : baseW;

    const title = `${task.descripcion}  |  ${durationDays}d  |  ${fechaInicio} -> ${fechaFin ?? '?'}`;

    const barLabelText =
        barLabel === 'costo'
            ? task.presupuesto > 0
                ? `S/ ${task.presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : ''
            : barLabel === 'empty'
              ? ''
              : task.descripcion;

    if (isGroup) {
        const bracketColor = isCritical
            ? 'border-red-400 text-red-100'
            : 'border-slate-300 text-slate-100';
        const selected = isSelected ? 'ring-1 ring-white/70' : '';

        return (
            <div
                className={`absolute cursor-pointer ${selected} transition-[filter] hover:brightness-125`}
                style={{
                    left: x,
                    top: GROUP_PAD - 2,
                    width: w,
                    height: ROW_H - GROUP_PAD,
                }}
                title={title}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(task.id);
                }}
            >
                <div
                    className={`pointer-events-none absolute top-2 right-0 left-0 border-t-2 ${bracketColor}`}
                />
                <div
                    className={`pointer-events-none absolute top-2 left-0 h-3 border-l-2 ${bracketColor}`}
                />
                <div
                    className={`pointer-events-none absolute top-2 right-0 h-3 border-r-2 ${bracketColor}`}
                />
                {w > 54 && barLabelText && (
                    <span className="pointer-events-none absolute top-0 left-1 max-w-full truncate bg-slate-900/70 px-1 text-[10px] leading-none font-semibold text-slate-100">
                        {barLabelText}
                    </span>
                )}
            </div>
        );
    }

    const padV = BAR_PAD_V;
    const barH = ROW_H - padV * 2;

    const canDrag = !!onDragStart;
    const isDragging = dragType !== null;

    const bg = isSelected
        ? 'bg-blue-400'
        : isCritical
          ? 'bg-red-600'
          : 'bg-blue-600';

    const ring = isSelected
        ? 'ring-1 ring-white/70'
        : isCritical && !isDragging
          ? 'ring-1 ring-red-400/60'
          : '';

    const progressPct =
        task.avance > 0 ? `${Math.min(100, task.avance * 100)}%` : '0%';
    const visibleSegments = buildWorkingDateSegments(
        fechaInicio,
        fechaFin ?? fechaInicio,
        timeline.calendarSettings,
    );

    return (
        <div
            className={`absolute ${ring} ${
                isDragging
                    ? 'z-30 opacity-75 shadow-lg shadow-black/40'
                    : 'transition-[filter] hover:brightness-110'
            } ${
                canDrag
                    ? isDragging
                        ? 'cursor-grabbing'
                        : 'cursor-grab'
                    : 'cursor-pointer'
            }`}
            style={{ left: x, top: padV, width: w, height: barH }}
            title={`${task.descripcion}  |  ${task.duracion_dias}d  |  ${task.fecha_inicio} → ${task.fecha_fin ?? '?'}`}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(task.id);
            }}
            onMouseDown={
                canDrag
                    ? (e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          onDragStart!(e, task.id, 'move');
                      }
                    : undefined
            }
        >
            {visibleSegments.map((segment, index) => {
                const segLeft = timeline.dateToX(segment.start) - baseX;
                const segRight =
                    timeline.dateToX(segment.end) + timeline.dayWidth - baseX;
                const segWidth = Math.max(
                    timeline.dayWidth,
                    segRight - segLeft,
                );

                return (
                    <div
                        key={`${segment.start}-${segment.end}`}
                        className={`pointer-events-none absolute top-0 bottom-0 flex items-center overflow-hidden rounded ${bg}`}
                        style={{ left: segLeft, width: segWidth }}
                    >
                        {task.avance > 0 && (
                            <div
                                className="pointer-events-none absolute inset-y-0 left-0 bg-white/25"
                                style={{ width: progressPct }}
                            />
                        )}
                        {index === 0 && segWidth > 36 && barLabelText && (
                            <span className="pointer-events-none relative z-10 truncate px-1.5 text-[10px] leading-none font-medium text-white/90">
                                {barLabelText}
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Triángulos indicadores de grupo */}
            {isGroup && (
                <>
                    <div className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 border-t-[5px] border-r-0 border-l-[5px] border-t-slate-400 border-l-transparent" />
                    <div className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 border-t-[5px] border-r-[5px] border-l-0 border-t-slate-400 border-r-transparent" />
                </>
            )}

            {/* Handle de redimensión (solo tareas hoja) */}
            {canDrag && (
                <div
                    className="absolute top-0 right-0 bottom-0 z-10 cursor-ew-resize rounded-r hover:bg-white/20 active:bg-white/30"
                    style={{ width: RESIZE_W }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        onDragStart!(e, task.id, 'resize');
                    }}
                />
            )}
        </div>
    );
};

// Custom compare function para evitar re-render de todas las barras cuando el objeto timeline
// cambia de referencia (porque las tareas cambian) pero sus dimensiones base siguen iguales.
const areEqual = (prev: Props, next: Props) => {
    return (
        prev.task === next.task &&
        prev.isGroup === next.isGroup &&
        prev.isSelected === next.isSelected &&
        prev.isCritical === next.isCritical &&
        prev.barLabel === next.barLabel &&
        prev.previewDeltaDays === next.previewDeltaDays &&
        prev.dragType === next.dragType &&
        // El render de la barra solo depende de dayWidth y projectStart
        prev.timeline.dayWidth === next.timeline.dayWidth &&
        prev.timeline.projectStart === next.timeline.projectStart
    );
};

export const GanttBar = React.memo(GanttBarComponent, areEqual);
