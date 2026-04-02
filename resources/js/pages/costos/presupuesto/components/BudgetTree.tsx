import type { ColumnDef } from '@tanstack/react-table';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    ChevronRight,
    ChevronDown,
    ArrowUp,
    ArrowDown,
    Plus,
    Copy,
    Scissors,
    Clipboard,
    Trash2,
} from 'lucide-react';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { BudgetItemRow, CopyScope } from '../stores/budgetStore';
import { useBudgetStore } from '../stores/budgetStore';

const fmt = (n: number, d = 2) =>
    n?.toLocaleString('es-PE', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
    }) || '';

const UNIDADES_COMUNES = ['gl', 'und', 'm', 'm2', 'm3', 'kg', 'ton', 'hh', 'hm', 'dia', 'mes', 'est'];

// ─────────────────────────────────────────────────────────────────────────────
// Editable cells
// ─────────────────────────────────────────────────────────────────────────────
const EditableCell = ({
    value,
    isEditable,
    onUpdate,
    className,
    activeColor,
}: {
    value: number;
    isEditable: boolean;
    onUpdate: (val: number) => void;
    className?: string;
    activeColor?: string;
}) => {
    const [val, setVal] = useState(value?.toString() || '');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => { setVal(value?.toString() || ''); }, [value]);

    if (!isEditable) return <div className={className}>{value > 0 ? fmt(value, 2) : ''}</div>;

    if (isEditing) {
        return (
            <input
                autoFocus
                className={`w-full min-w-[60px] rounded border border-sky-500 bg-slate-900 px-1 text-right font-mono text-xs outline-none ${activeColor || 'text-white'}`}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                    setIsEditing(false);
                    const num = Number(val);
                    if (!isNaN(num) && num !== value) onUpdate(num);
                    else setVal(value?.toString() || '');
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { setIsEditing(false); const num = Number(val); if (!isNaN(num) && num !== value) onUpdate(num); else setVal(value?.toString() || ''); }
                    if (e.key === 'Escape') { setIsEditing(false); setVal(value?.toString() || ''); }
                }}
            />
        );
    }

    return (
        <div
            className={`-mx-1 min-w-[20px] cursor-text rounded px-1 transition-colors hover:bg-slate-700/80 ${className}`}
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        >
            {value > 0 ? fmt(value, 2) : '-'}
        </div>
    );
};

const StringEditableCell = ({
    value,
    isEditable,
    onUpdate,
    className,
}: {
    value: string;
    isEditable: boolean;
    onUpdate: (val: string) => void;
    className?: string;
}) => {
    const [val, setVal] = useState(value || '');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => { setVal(value || ''); }, [value]);

    if (!isEditable) return <span className={className}>{value}</span>;

    if (isEditing) {
        return (
            <input
                autoFocus
                className={`w-full rounded border border-sky-500 bg-slate-900 px-1 text-left font-sans text-xs text-white outline-none ${className}`}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => { setIsEditing(false); if (val.trim() !== value) onUpdate(val.trim()); else setVal(value || ''); }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { setIsEditing(false); if (val.trim() !== value) onUpdate(val.trim()); else setVal(value || ''); }
                    if (e.key === 'Escape') { setIsEditing(false); setVal(value || ''); }
                }}
            />
        );
    }

    return (
        <span
            className={`-mx-1 cursor-text rounded px-1 transition-colors hover:bg-slate-700/80 ${className}`}
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        >
            {value || (isEditable ? <span className="text-slate-500 italic">vacío</span> : '')}
        </span>
    );
};

const UnitSelectCell = ({
    value,
    isEditable,
    onUpdate,
    className,
}: {
    value: string;
    isEditable: boolean;
    onUpdate: (val: string) => void;
    className?: string;
}) => {
    if (!isEditable) return <span className={className}>{value}</span>;
    return (
        <select
            className={`w-full cursor-pointer appearance-none border-none bg-transparent text-center text-xs text-slate-400 outline-none transition-colors hover:text-sky-300 ${className}`}
            value={value}
            onChange={(e) => onUpdate(e.target.value)}
            onClick={(e) => e.stopPropagation()}
        >
            <option value="" className="bg-slate-800 text-slate-400">--</option>
            {UNIDADES_COMUNES.map((u) => (
                <option key={u} value={u} className="bg-slate-800 text-slate-200">{u}</option>
            ))}
        </select>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Context Menu
// ─────────────────────────────────────────────────────────────────────────────
interface ContextMenuState {
    x: number;
    y: number;
    item: BudgetItemRow;
}

const ContextMenu = ({
    ctx,
    onClose,
}: {
    ctx: ContextMenuState;
    onClose: () => void;
}) => {
    const {
        addNode, addRowAfter, moveUp, moveDown,
        setClipboard, pasteNode, pasteAfter,
        deleteRow, calculateTree,
        convertToTitle, convertToPartida,
        clipboard,
    } = useBudgetStore.getState();

    const item = ctx.item;
    const isTitle = item._hasChildren || item._level === 0;

    const menuRef = React.useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState({ top: ctx.y, left: ctx.x });
    React.useEffect(() => {
        if (!menuRef.current) return;
        const { offsetWidth: w, offsetHeight: h } = menuRef.current;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setPos({
            top:  ctx.y + h > vh ? Math.max(0, ctx.y - h) : ctx.y,
            left: ctx.x + w > vw ? Math.max(0, ctx.x - w) : ctx.x,
        });
    }, [ctx.x, ctx.y]);

    const btn = (label: string, fn: () => void, color?: string, disabled?: boolean) => (
        <button
            key={label}
            disabled={disabled}
            className={`w-full px-4 py-1.5 text-left text-[11px] transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 ${color || 'text-slate-300 hover:text-sky-300'}`}
            onClick={() => { fn(); onClose(); }}
        >
            {label}
        </button>
    );

    const divider = (key: string) => <div key={key} className="my-1 border-t border-slate-700" />;
    const label = (text: string) => (
        <div key={text} className="px-3 py-1 text-[9px] font-bold tracking-wider text-slate-500 uppercase">{text}</div>
    );

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
            <div ref={menuRef} className="fixed z-50 min-w-[210px] rounded-lg border border-slate-600 bg-slate-800 py-1.5 text-sm shadow-2xl shadow-black/60" style={{ top: pos.top, left: pos.left }}>
                {label('Insertar')}
                {btn('+ Hijo → Título', () => addNode(item.partida, 'titulo'))}
                {btn('+ Hijo → Partida', () => addNode(item.partida, 'partida'))}
                {btn('+ Fila abajo (sibling)', () => addRowAfter(item.partida, 'partida'))}
                {divider('d1')}

                {label('Mover')}
                {btn('↑  Mover arriba', () => moveUp(item.partida))}
                {btn('↓  Mover abajo', () => moveDown(item.partida))}
                {divider('d2')}

                {label('Copiar / Pegar')}
                {btn('📋 Copiar nodo completo', () => setClipboard('copy', item.partida, 'node'))}
                {btn('📋 Copiar solo hijos', () => setClipboard('copy', item.partida, 'children'))}
                {btn('📋 Copiar esta fila', () => setClipboard('copy', item.partida, 'row'))}
                {btn('✂️  Cortar nodo completo', () => setClipboard('cut', item.partida, 'node'), 'text-amber-400 hover:text-amber-300')}
                {divider('d3')}
                {btn('📌 Pegar como hijo', () => pasteNode(item.partida), 'text-emerald-400 hover:text-emerald-300', !clipboard)}
                {btn('📌 Pegar después (sibling)', () => pasteAfter(item.partida), 'text-emerald-400 hover:text-emerald-300', !clipboard)}
                {divider('d4')}

                {label('Conversión')}
                {!isTitle && btn('🔼 Convertir a Título', () => convertToTitle(item.partida), 'text-sky-400 hover:text-sky-300')}
                {isTitle && !item._hasChildren && btn('🔽 Convertir a Partida', () => convertToPartida(item.partida), 'text-orange-400 hover:text-orange-300')}
                {divider('d5')}

                {btn('⚡ Forzar Cálculo', () => calculateTree(), 'text-emerald-500 hover:text-emerald-400')}
                {btn('🔢 Generar Ítems', () => useBudgetStore.getState().renumberItems(), 'text-amber-500 hover:text-amber-400')}
                {btn('🗑  Eliminar rama', () => deleteRow(item.partida), 'text-red-500 hover:text-red-400')}
            </div>
        </>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Multi-selection floating toolbar
// ─────────────────────────────────────────────────────────────────────────────
const SelectionToolbar = ({ count }: { count: number }) => {
    const { moveUp, moveDown, deleteMultiSelection, multiSelection } = useBudgetStore.getState();

    if (count < 2) return null;

    return (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/95 px-4 py-2.5 shadow-2xl shadow-black/60 backdrop-blur-sm">
            <span className="mr-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {count} seleccionadas
            </span>
            <button
                className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-sky-800 hover:text-sky-200"
                onClick={() => multiSelection.forEach(id => moveUp(id))}
            >
                <ArrowUp size={12} /> Mover ↑
            </button>
            <button
                className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-sky-800 hover:text-sky-200"
                onClick={() => multiSelection.forEach(id => moveDown(id))}
            >
                <ArrowDown size={12} /> Mover ↓
            </button>
            <button
                className="flex items-center gap-1.5 rounded-lg bg-red-900/50 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-800/70 hover:text-red-300"
                onClick={() => deleteMultiSelection()}
            >
                <Trash2 size={12} /> Eliminar
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Memoized Row Component
// ─────────────────────────────────────────────────────────────────────────────
const MemoizedRow = React.memo(({ 
    virtualRow, 
    row, 
    isSelected, 
    isMultiSelected, 
    isTitle, 
    onRowClick, 
    onContextMenu,
    measureElement
}: { 
    virtualRow: any; 
    row: any; 
    isSelected: boolean; 
    isMultiSelected: boolean; 
    isTitle: boolean;
    onRowClick: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    measureElement: (el: HTMLDivElement | null) => void;
}) => {
    return (
        <div
            data-index={virtualRow.index}
            ref={measureElement}
            className={[
                'group absolute top-0 left-0 flex w-full cursor-pointer items-center border-b border-slate-700/60 transition-colors',
                isSelected ? 'border-sky-700/50 bg-sky-900/40' : '',
                isMultiSelected && !isSelected ? 'bg-indigo-900/30 border-indigo-700/40' : '',
                isTitle && !isSelected && !isMultiSelected ? 'bg-slate-800/60' : '',
                'hover:bg-slate-700/30',
            ].join(' ')}
            style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
            }}
            onClick={onRowClick}
            onContextMenu={onContextMenu}>
            {isMultiSelected && (<span className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500" />)}
            {row.getVisibleCells().map((cell: any) => (
                <div
                    key={cell.id}
                    className="px-2"
                    style={{
                        width: cell.column.getSize() === 150 ? 'auto' : cell.column.getSize(),
                        flex: cell.column.getSize() === 150 ? 1 : 'none',
                    }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
            ))}
        </div>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main BudgetTree
// ─────────────────────────────────────────────────────────────────────────────
interface BudgetTreeProps {
    onRowSelect?: (id: string, isPartida: boolean) => void;
}

export const BudgetTree: React.FC<BudgetTreeProps> = ({ onRowSelect }) => {
    const getVisibleRows = useBudgetStore((s) => s.getVisibleRows);
    const storeRows = useBudgetStore((s) => s.rows);
    const searchQuery = useBudgetStore((s) => s.searchQuery);
    const expandedMap = useBudgetStore((s) => s.expandedMap);
    const selectedId = useBudgetStore((s) => s.selectedId);
    const multiSelection = useBudgetStore((s) => s.multiSelection);
    const toggleExpand = useBudgetStore((s) => s.toggleExpand);
    const updateCell = useBudgetStore((s) => s.updateCell);
    const moveUp = useBudgetStore((s) => s.moveUp);
    const moveDown = useBudgetStore((s) => s.moveDown);
    const addRowAfter = useBudgetStore((s) => s.addRowAfter);
    const setSelectedId = useBudgetStore((s) => s.setSelectedId);
    const toggleMultiSelect = useBudgetStore((s) => s.toggleMultiSelect);
    const rangeSelect = useBudgetStore((s) => s.rangeSelect);

    const visibleRows = useMemo(
        () => getVisibleRows(),
        [getVisibleRows, storeRows, searchQuery, expandedMap],
    );

    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const handleRowClick = useCallback(
        (e: React.MouseEvent, item: BudgetItemRow) => {
            if (e.shiftKey && selectedId) {
                rangeSelect(selectedId, item.partida);
                return;
            }
            if (e.ctrlKey || e.metaKey) {
                toggleMultiSelect(item.partida);
                return;
            }
            setSelectedId(item.partida);
            const isPartida = !(item._level === 0 || item._hasChildren);
            if (onRowSelect) onRowSelect(item.partida, isPartida);
        },
        [selectedId, setSelectedId, toggleMultiSelect, rangeSelect, onRowSelect],
    );

    const handleContainerContextMenu = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            const targetItem = lastClickedItem.current;
            if (!targetItem) return;
            setContextMenu({ x: e.clientX, y: e.clientY, item: targetItem });
        },
        [],
    );

    const columns = useMemo<ColumnDef<BudgetItemRow>[]>(
        () => [
            {
                accessorKey: 'descripcion',
                header: 'Descripción',
                cell: ({ row: { original: item } }) => {
                    const isTitle = item._level === 0 || item._hasChildren;
                    const indent = item._level! * 18;

                    return (
                        <div style={{ paddingLeft: `${indent + 4}px` }} className="group/cell flex items-center gap-1">
                            {item._hasChildren ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(item.partida); }}
                                    className="shrink-0 text-slate-400 hover:text-slate-100 transition-colors"
                                >
                                    {expandedMap[item.partida] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                            ) : (
                                <span className="w-[13px] shrink-0" />
                            )}

                            {isTitle ? (
                                <span className="flex min-w-0 shrink items-center text-xs font-semibold tracking-wide text-sky-300">
                                    <span className="mr-1 shrink-0 text-sky-500/70">
                                        <StringEditableCell
                                            value={item.partida}
                                            isEditable={true}
                                            onUpdate={(val) => {
                                                if (val !== item.partida) {
                                                    useBudgetStore.getState().editPartidaCode(item.partida, val);
                                                }
                                            }}
                                            className="font-mono text-sky-400"
                                        />
                                    </span>
                                    <StringEditableCell
                                        value={item.descripcion}
                                        isEditable={true}
                                        onUpdate={(val) => updateCell(item.partida, 'descripcion', val)}
                                        className="max-w-full truncate"
                                    />
                                </span>
                            ) : (
                                <span className="flex min-w-0 shrink items-center text-xs text-slate-300 transition-colors hover:text-sky-200" title={item.descripcion}>
                                    <span className="mr-1 shrink-0 text-slate-500">
                                        <StringEditableCell
                                            value={item.partida}
                                            isEditable={true}
                                            onUpdate={(val) => {
                                                if (val !== item.partida) {
                                                    useBudgetStore.getState().editPartidaCode(item.partida, val);
                                                }
                                            }}
                                            className="font-mono"
                                        />
                                    </span>
                                    <StringEditableCell
                                        value={item.descripcion}
                                        isEditable={true}
                                        onUpdate={(val) => updateCell(item.partida, 'descripcion', val)}
                                        className="max-w-[260px] truncate"/>
                                </span>
                            )}

                            <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/cell:opacity-100">
                                <button
                                    title="Mover arriba"
                                    onClick={(e) => { e.stopPropagation(); moveUp(item.partida); }}
                                    className="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-sky-400 transition-colors">
                                    <ArrowUp size={11} />
                                </button>
                                <button
                                    title="Mover abajo"
                                    onClick={(e) => { e.stopPropagation(); moveDown(item.partida); }}
                                    className="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-sky-400 transition-colors">
                                    <ArrowDown size={11} />
                                </button>
                                <button
                                    title="Insertar fila abajo"
                                    onClick={(e) => { e.stopPropagation(); addRowAfter(item.partida, 'partida'); }}
                                    className="rounded p-0.5 text-slate-500 hover:bg-emerald-900/60 hover:text-emerald-400 transition-colors">
                                    <Plus size={11} />
                                </button>
                            </span>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'unidad',
                header: 'Und.',
                size: 60,
                cell: ({ row: { original: item } }) => {
                    const isPartida = item._level! > 0 && !item._hasChildren;
                    const missingUnit = isPartida && (!item.unidad || item.unidad.trim() === '');
                    return (
                        <div className={`text-center text-xs ${missingUnit ? 'relative' : 'text-slate-400'}`}>
                            {isPartida ? (
                                <>
                                    <UnitSelectCell
                                        value={item.unidad}
                                        isEditable={true}
                                        onUpdate={(val) => updateCell(item.partida, 'unidad', val)}/>
                                    {missingUnit && (
                                        <span
                                            className="absolute -top-0.5 -right-0.5 flex h-2 w-2"
                                            title="⚠ Unidad requerida para generar ACU"
                                        >
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                                        </span>
                                    )}
                                </>
                            ) : (
                                item.unidad
                            )}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'metrado',
                header: 'Cantidad',
                size: 80,
                cell: ({ row: { original: item } }) => {
                    const isPartida = item._level! > 0 && !item._hasChildren;
                    return (
                        <div className="flex justify-end text-right font-mono text-xs text-slate-300">
                            <EditableCell
                                value={item.metrado}
                                isEditable={isPartida}
                                onUpdate={(val) => updateCell(item.partida, 'metrado', val)}
                            />
                        </div>
                    );
                },
            },
            {
                accessorKey: 'precio_unitario',
                header: 'P. Unit.',
                size: 80,
                cell: ({ row: { original: item } }) => {
                    const isPartida = item._level! > 0 && !item._hasChildren;
                    const activeColor = selectedId === item.partida ? 'text-sky-300' : 'text-orange-400';
                    return (
                        <div className={`flex justify-end text-right font-mono text-xs ${activeColor}`}>
                            <EditableCell
                                value={item.precio_unitario}
                                isEditable={isPartida}
                                activeColor={activeColor}
                                onUpdate={(val) => updateCell(item.partida, 'precio_unitario', val)}/>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'parcial',
                header: 'Total',
                size: 100,
                cell: ({ row: { original: item } }) => {
                    const isTitle = item._level === 0 || item._hasChildren;
                    return (
                        <div className="pr-3 text-right font-mono text-xs font-bold">
                            <span className={isTitle ? 'text-sky-400' : 'text-slate-200'}>
                                {fmt(item.parcial, 2)}
                            </span>
                        </div>
                    );
                },
            },
        ],
        [expandedMap, toggleExpand, selectedId, updateCell, moveUp, moveDown, addRowAfter],
    );

    const table = useReactTable({
        data: visibleRows,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const { rows: tableRows } = table.getRowModel();
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: tableRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 28,
        overscan: 12,
    });

    const lastClickedItem = React.useRef<BudgetItemRow | null>(null);

    return (
        // ← FIX 1: añadir min-h-0 para romper el crecimiento infinito en flex column
        <div className="flex h-full min-h-0 flex-col border-r border-slate-700 bg-slate-900">

            {/* Table Header — fijo, no scrollea */}
            <div className="shrink-0 border-b border-slate-600 bg-slate-800">
                <table className="w-full table-fixed text-[10px] tracking-wider text-slate-500 uppercase">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-2 py-1.5 text-left font-medium"
                                        style={{ width: header.getSize() === 150 ? 'auto' : header.getSize() }}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                </table>
            </div>

            {/*
             * ← FIX 2: min-h-0 + overflow-y-auto
             *   flex-1 solo funciona correctamente cuando el padre tiene min-h-0.
             *   overflow-y-auto activa el scroll nativo del virtualizer.
             *   overflow-x-hidden evita scroll horizontal accidental.
             */}
            <div ref={parentRef}
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-900 [scrollbar-gutter:stable] scrollbar-premium"
                onContextMenu={handleContainerContextMenu}>
                {/* Contenedor virtual: alto total calculado, filas posicionadas con translateY */}
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = tableRows[virtualRow.index];
                        const item = row.original;
                        const isTitle = item._level === 0 || item._hasChildren;
                        const isSelected = selectedId === item.partida;
                        const isMultiSelected = multiSelection.includes(item.partida);

                        return (
                            <MemoizedRow
                                key={virtualRow.key}
                                virtualRow={virtualRow}
                                row={row}
                                isSelected={isSelected}
                                isMultiSelected={isMultiSelected}
                                isTitle={!!isTitle}
                                measureElement={virtualizer.measureElement}
                                onRowClick={(e) => {
                                    lastClickedItem.current = item;
                                    handleRowClick(e, item);
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    lastClickedItem.current = item;
                                    setContextMenu({ x: e.clientX, y: e.clientY, item });
                                }}/>
                        );
                    })}
                </div>
            </div>

            {/* Footer — fijo abajo */}
            <div className="shrink-0 border-t border-slate-700 bg-slate-800/50">
                <div className="flex items-center border-b border-slate-700/60 px-3 py-1.5">
                    <span className="flex-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Costo Directo Total</span>
                    <span className="font-mono text-xs font-bold text-sky-300">
                        {fmt(
                            storeRows
                                .filter((r) => !r._parentId)
                                .reduce((s, r) => s + (Number(r.parcial) || 0), 0),
                            2,
                        )}
                    </span>
                </div>
                <div className="flex items-center gap-3 px-3 py-0.5 text-[10px] text-slate-600">
                    <span>Ctrl+Click: multi-sel. | Shift+Click: rango | Click derecho: menú</span>
                    <div className="flex-1" />
                    {(() => {
                        const missingCount = storeRows.filter(
                            (r) => r._level! > 0 && !r._hasChildren && (!r.unidad || r.unidad.trim() === '')
                        ).length;
                        return missingCount > 0 ? (
                            <span className="flex items-center gap-1 text-red-400 font-semibold" title="Partidas sin unidad definida — necesaria para el ACU">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                {missingCount} sin unidad
                            </span>
                        ) : null;
                    })()}
                    <span>{visibleRows.length} visibles · {storeRows.length} total</span>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu ctx={contextMenu} onClose={() => setContextMenu(null)} />
            )}

            {/* Floating multi-selection toolbar */}
            <SelectionToolbar count={multiSelection.length} />
        </div>
    );
};