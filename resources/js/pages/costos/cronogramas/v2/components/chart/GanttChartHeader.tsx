import React from 'react';
import type { GanttTimeline } from '../../types/timeline';
import {
    CHART_HEADER_BOTTOM_H,
    CHART_HEADER_TOP_H,
} from '../../types/timeline';

interface Props {
    timeline: GanttTimeline;
}

export function GanttChartHeader({ timeline }: Props) {
    return (
        <div
            className="border-b border-slate-300 bg-slate-100 select-none dark:border-slate-600 dark:bg-slate-800"
            style={{
                height: CHART_HEADER_TOP_H + CHART_HEADER_BOTTOM_H,
                minWidth: timeline.totalWidth,
            }}
        >
            {/* ── Fila 1: Meses ─────────────────────────────────────────── */}
            <div
                className="flex border-b border-slate-300 dark:border-slate-700"
                style={{ height: CHART_HEADER_TOP_H }}
            >
                {timeline.topCols.map((col, i) => (
                    <div
                        key={i}
                        className="shrink-0 overflow-hidden border-r border-slate-300 px-1 text-center text-[10px] leading-[24px] font-semibold tracking-wider text-slate-700 last:border-r-0 dark:border-slate-700 dark:text-slate-300"
                        style={{ width: col.width }}
                        title={col.label}
                    >
                        {col.width >= 28 ? col.label : ''}
                    </div>
                ))}
            </div>

            {/* ── Fila 2: Semanas / Días ────────────────────────────────── */}
            <div className="flex" style={{ height: CHART_HEADER_BOTTOM_H }}>
                {timeline.bottomCols.map((col, i) => (
                    <div
                        key={i}
                        className={`shrink-0 overflow-hidden border-r border-slate-300 text-center text-[9px] leading-[22px] last:border-r-0 dark:border-slate-700/50 ${
                            col.isHoliday
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : col.isNonWorking
                                  ? 'bg-slate-200/70 text-slate-500 dark:bg-slate-800/60 dark:text-slate-600'
                                  : 'text-slate-600 dark:text-slate-400'
                        }`}
                        style={{ width: col.width }}
                        title={col.holidayName ?? col.date}
                    >
                        {col.width >= 7 ? col.label : ''}
                    </div>
                ))}
            </div>
        </div>
    );
}
