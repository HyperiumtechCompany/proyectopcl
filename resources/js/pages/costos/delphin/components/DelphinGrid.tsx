import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Columns3, Maximize2, Minimize2, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CHART_HEADER_H } from '../../cronogramas/v2/types/timeline';
import { ROW_HEIGHT } from '../../cronogramas/v2/types/cell';
import type { ColumnDef, EditState, RowAction } from '../../cronogramas/v2/types/cell';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import { GanttGridRow } from '../../cronogramas/v2/components/grid/GanttGridRow';
import { GridContextMenu } from '../../cronogramas/v2/components/grid/GridContextMenu';
import type { DelphinRow, ResumenPresupuesto } from '../types';

const fmtCurrency = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROW_NUM_W = 32;

/** Returns text color class for the description column based on hierarchy level */
function getDescTextClass(row: DelphinRow, isGroup: boolean): string | undefined {
    if (!isGroup) return undefined; // leaf → default text from shared cell
    if (row.nivel === 1) return 'text-amber-700 dark:text-amber-400';
    if (row.nivel === 2) return 'text-sky-700 dark:text-sky-300';
    return 'text-violet-700 dark:text-violet-300'; // nivel 3+
}

/** One row of the Costo Directo / Gastos Generales / Utilidad / Total footer.
 *  When `onPercentageChange` is given, the Cantidad column (otherwise unused
 *  on this footer) becomes a clickable, editable "%" input — persisted via
 *  gg_consolidado. Without it, the percentage is shown read-only there. */
function SummaryRow({
    columns,
    labelPrefix,
    percentage,
    amount,
    emphasize = false,
    onPercentageChange,
    saving = false,
}: {
    columns: ColumnDef[];
    labelPrefix: string;
    percentage?: number;
    amount: number;
    emphasize?: boolean;
    onPercentageChange?: (value: number) => void;
    saving?: boolean;
}) {
    const colorClass = emphasize
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-amber-700 dark:text-amber-400';

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(percentage ?? 0));

    useEffect(() => {
        if (!editing) setDraft(String(percentage ?? 0));
    }, [percentage, editing]);

    const commit = () => {
        setEditing(false);
        const parsed = Number(draft);
        if (onPercentageChange && Number.isFinite(parsed) && parsed >= 0 && parsed !== percentage) {
            onPercentageChange(parsed);
        }
    };

    return (
        <div
            className={`flex shrink-0 border-t bg-slate-100 text-xs font-bold select-none dark:bg-slate-900 ${
                emphasize
                    ? 'border-t-2 border-emerald-500/70 dark:border-emerald-600/60'
                    : 'border-slate-300 dark:border-slate-700/50'
            }`}
        >
            <div style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W }} className="shrink-0 border-r border-slate-300 dark:border-slate-700/50" />
            {columns.map((col) => (
                <div
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width }}
                    className={`shrink-0 border-r border-slate-300 px-2 py-2 last:border-r-0 dark:border-slate-700/50 ${
                        col.align === 'right'  ? 'text-right'  :
                        col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                >
                    {col.key === 'descripcion' ? (
                        <span className={`uppercase tracking-wide ${colorClass}`}>{labelPrefix}</span>
                    ) : col.key === 'metrado' && percentage !== undefined ? (
                        onPercentageChange ? (
                            editing ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    autoFocus
                                    className="w-full rounded border border-slate-400 bg-white px-1 py-0.5 text-right font-mono text-[11px] font-normal text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onBlur={commit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') commit();
                                        if (e.key === 'Escape') { setDraft(String(percentage ?? 0)); setEditing(false); }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <button
                                    type="button"
                                    className={`font-mono underline decoration-dotted underline-offset-2 hover:text-emerald-500 ${colorClass}`}
                                    title={`Editar porcentaje de ${labelPrefix.toLowerCase()}`}
                                    onClick={() => setEditing(true)}
                                >
                                    {percentage.toFixed(2)}%{saving ? '…' : ''}
                                </button>
                            )
                        ) : (
                            <span className={`font-mono ${colorClass}`}>{percentage.toFixed(2)}%</span>
                        )
                    ) : col.key === 'parcial' ? (
                        <span className={`font-mono ${colorClass}`}>{fmtCurrency(amount)}</span>
                    ) : col.key === 'item_order' ? null : (
                        <span className="text-slate-400 dark:text-slate-700">—</span>
                    )}
                </div>
            ))}
        </div>
    );
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
    hasClipboard?:      boolean;
    onRowAction:        (taskId: number, action: RowAction) => void;
    onToggleHidden:     (key: string) => void;
    onToggleDescExpand: () => void;
    onRenamePartida:    (taskId: number, newPartida: string) => void;
    columnFilters:      Record<string, string>;
    onColumnFilterChange: (key: string, value: string) => void;
    onClearColumnFilters: () => void;
    showColumnFilters:  boolean;
    /** Reports the rendered height of the header stack (title row + optional
     *  filter row) so the sibling Gantt panel can mirror it and keep rows aligned. */
    onHeaderHeightChange?: (height: number) => void;
    /** Gastos Generales / Utilidad / Total, para las filas de resumen bajo Costo Directo. */
    resumenPresupuesto?: ResumenPresupuesto;
    /** Persiste el nuevo % de utilidad (PATCH consolidado/snapshot) cuando se edita en el resumen. */
    onUtilidadPorcentajeChange?: (value: number) => void;
    savingUtilidad?: boolean;
    /** Igual que onUtilidadPorcentajeChange, para el % de Gastos Generales. */
    onGastosGeneralesPorcentajeChange?: (value: number) => void;
    savingGastosGenerales?: boolean;
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
            className="w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-2xl ring-1 ring-slate-950/5 dark:border-slate-700 dark:bg-slate-800 dark:ring-black/30"
            style={style}
        >
            <div className="mb-1 px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Columnas visibles
            </div>
            {allColumns.map((col) => {
                const isVisible = !hiddenKeys.has(col.key);
                const isLocked  = col.key === 'item_order';
                return (
                    <button
                        key={col.key}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-700"
                        disabled={isLocked}
                        onClick={() => onToggle(col.key)}
                    >
                        <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                                isVisible
                                    ? 'border-blue-500 bg-blue-600 text-white'
                                    : 'border-slate-400 bg-transparent dark:border-slate-600'
                            }`}
                        >
                            {isVisible && <Check size={9} strokeWidth={3} />}
                        </span>
                        <span className="flex-1">{col.label}</span>
                        {isLocked && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-600">fijo</span>
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
    columnFilters,
    onColumnFilterChange,
    onClearColumnFilters,
    showColumnFilters,
}: {
    columns:            ColumnDef[];
    allColumns:         ColumnDef[];
    hiddenKeys:         Set<string>;
    descExpanded:       boolean;
    onToggleHidden:     (key: string) => void;
    onToggleDescExpand: () => void;
    columnFilters:      Record<string, string>;
    onColumnFilterChange: (key: string, value: string) => void;
    onClearColumnFilters: () => void;
    showColumnFilters:  boolean;
}) {
    const hasActiveFilters = Object.values(columnFilters).some((v) => v.trim() !== '');
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
        <div className="flex shrink-0 flex-col border-b border-slate-300 bg-white shadow-sm select-none dark:border-slate-600 dark:bg-slate-800">
            <div
                className="flex items-end"
                style={{ height: CHART_HEADER_H }}
            >
                {/* Row number gutter header */}
                <div
                    className="sticky left-0 z-10 shrink-0 border-r border-slate-300 bg-slate-100 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                    style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W }}
                >
                    #
                </div>
                {columns.map((col) => (
                    <div
                        key={col.key}
                        className={`relative shrink-0 overflow-hidden truncate border-r border-slate-300 bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-700 last:border-r-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
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
                    className="flex h-full w-7 shrink-0 items-center justify-center border-l border-slate-300 bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    onClick={onToggleDescExpand}
                >
                    {descExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>

                {/* Column visibility */}
                <button
                    ref={configBtnRef}
                    data-col-config
                    title="Mostrar/ocultar columnas"
                    className="flex h-full w-7 shrink-0 items-center justify-center border-l border-slate-300 bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200"
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

            {/* Filter row: one input/select per column, aligned with the labels above */}
            {showColumnFilters && (
            <div className="flex items-center border-t border-slate-300 bg-slate-50 py-1 dark:border-slate-700/60 dark:bg-slate-900/70">
                <div
                    className="sticky left-0 z-10 flex shrink-0 items-center justify-center bg-slate-50 dark:bg-slate-900"
                    style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W }}
                >
                    {hasActiveFilters && (
                        <button
                            title="Limpiar filtros de columna"
                            className="rounded p-0.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            onClick={onClearColumnFilters}
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>
                {columns.map((col) =>
                    col.options ? (
                        <select
                            key={col.key}
                            value={columnFilters[col.key] ?? ''}
                            onChange={(e) => onColumnFilterChange(col.key, e.target.value)}
                            className="h-7 shrink-0 rounded-md border border-slate-300 bg-white px-1.5 text-[11px] font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-sky-400"
                            style={{ width: col.width }}
                        >
                            <option value="">Todos</option>
                            {col.options.filter((o) => o !== '').map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            key={col.key}
                            type="text"
                            value={columnFilters[col.key] ?? ''}
                            onChange={(e) => onColumnFilterChange(col.key, e.target.value)}
                            placeholder="Filtrar…"
                            className={`h-7 shrink-0 rounded-md border border-slate-300 bg-white px-1.5 text-[11px] font-medium text-slate-700 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-sky-400 ${
                                col.align === 'center' ? 'text-center'
                                : col.align === 'right'  ? 'text-right'
                                : 'text-left'
                            }`}
                            style={{ width: col.width }}
                        />
                    ),
                )}
            </div>
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
    hasClipboard = false,
    onRowAction,
    onToggleHidden,
    onToggleDescExpand,
    onRenamePartida,
    columnFilters,
    onColumnFilterChange,
    onClearColumnFilters,
    showColumnFilters,
    onHeaderHeightChange,
    resumenPresupuesto,
    onUtilidadPorcentajeChange,
    savingUtilidad,
    onGastosGeneralesPorcentajeChange,
    savingGastosGenerales,
}: Props) {
    const internalRef       = useRef<HTMLDivElement>(null);
    const resolvedRef       = (scrollRef ?? internalRef) as React.RefObject<HTMLDivElement>;
    const headerContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = headerContainerRef.current;
        if (!el || !onHeaderHeightChange) return;
        const measure = () => onHeaderHeightChange(Math.ceil(el.getBoundingClientRect().height));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [onHeaderHeightChange]);

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
                    columnFilters={columnFilters}
                    onColumnFilterChange={onColumnFilterChange}
                    onClearColumnFilters={onClearColumnFilters}
                    showColumnFilters={showColumnFilters}
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
                                onRenamePartida={onRenamePartida}
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

            {/* ── Resumen footer: Costo Directo + Gastos Generales + Utilidad = Total ── */}
            {hasParcialCol && (
                <>
                    <SummaryRow columns={columns} labelPrefix="Costo Directo" amount={costoDirecto} />
                    {resumenPresupuesto && (
                        <>
                            <SummaryRow
                                columns={columns}
                                labelPrefix="Gastos Generales"
                                percentage={resumenPresupuesto.gastosGeneralesPorcentaje}
                                amount={resumenPresupuesto.gastosGenerales}
                                onPercentageChange={onGastosGeneralesPorcentajeChange}
                                saving={savingGastosGenerales}
                            />
                            <SummaryRow
                                columns={columns}
                                labelPrefix="Utilidad"
                                percentage={resumenPresupuesto.utilidadPorcentaje}
                                amount={resumenPresupuesto.utilidad}
                                onPercentageChange={onUtilidadPorcentajeChange}
                                saving={savingUtilidad}
                            />
                            <SummaryRow
                                columns={columns}
                                labelPrefix="Total"
                                amount={costoDirecto + resumenPresupuesto.gastosGenerales + resumenPresupuesto.utilidad}
                                emphasize
                            />
                        </>
                    )}
                </>
            )}

            {ctx && (
                <GridContextMenu
                    x={ctx.x}
                    y={ctx.y}
                    taskId={ctx.taskId}
                    isGroup={groupIds.has(ctx.taskId)}
                    isExpanded={expandedIds.has(ctx.taskId)}
                    hasClipboard={hasClipboard}
                    onAction={handleCtxAction}
                    onClose={closeCtx}
                />
            )}
        </div>
    );
}
