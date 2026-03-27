import type { ColumnDef } from '@tanstack/react-table';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import type { BudgetItemRow } from '../stores/budgetStore';
import { useBudgetStore } from '../stores/budgetStore';

const fmt = (n: number, d = 2) =>
    n?.toLocaleString('es-PE', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
    }) || '';

const UNIDADES_COMUNES = [
    'gl',
    'und',
    'm',
    'm2',
    'm3',
    'kg',
    'ton',
    'hh',
    'hm',
    'dia',
    'mes',
    'est',
];

interface BudgetTreeProps {
    onRowSelect?: (id: string, isPartida: boolean) => void;
    onContextMenu?: (e: React.MouseEvent, row: BudgetItemRow) => void;
}

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

    useEffect(() => {
        setVal(value?.toString() || '');
    }, [value]);

    if (!isEditable) {
        return (
            <div className={className}>{value > 0 ? fmt(value, 2) : ''}</div>
        );
    }

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
                    if (e.key === 'Enter') {
                        setIsEditing(false);
                        const num = Number(val);
                        if (!isNaN(num) && num !== value) onUpdate(num);
                        else setVal(value?.toString() || '');
                    }
                    if (e.key === 'Escape') {
                        setIsEditing(false);
                        setVal(value?.toString() || '');
                    }
                }}
            />
        );
    }

    return (
        <div
            className={`-mx-1 min-w-[20px] cursor-text rounded px-1 transition-colors hover:bg-slate-700/80 ${className}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
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

    useEffect(() => {
        setVal(value || '');
    }, [value]);

    if (!isEditable) {
        return <span className={className}>{value}</span>;
    }

    if (isEditing) {
        return (
            <input
                autoFocus
                className={`w-full rounded border border-sky-500 bg-slate-900 px-1 text-left font-sans text-xs text-white outline-none ${className}`}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                    setIsEditing(false);
                    if (val.trim() !== value) onUpdate(val.trim());
                    else setVal(value || '');
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        setIsEditing(false);
                        if (val.trim() !== value) onUpdate(val.trim());
                        else setVal(value || '');
                    }
                    if (e.key === 'Escape') {
                        setIsEditing(false);
                        setVal(value || '');
                    }
                }}
            />
        );
    }

    return (
        <span
            className={`-mx-1 cursor-text rounded px-1 transition-colors hover:bg-slate-700/80 ${className}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            {value ||
                (isEditable ? (
                    <span className="text-slate-500 italic">vacío</span>
                ) : (
                    ''
                ))}
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
    if (!isEditable) {
        return <span className={className}>{value}</span>;
    }

    return (
        <select
            className={`w-full cursor-pointer appearance-none border-none bg-transparent text-center text-xs text-slate-400 transition-colors outline-none hover:text-sky-300 ${className}`}
            value={value}
            onChange={(e) => onUpdate(e.target.value)}
            onClick={(e) => e.stopPropagation()}
        >
            <option value="" className="bg-slate-800 text-slate-400">
                --
            </option>
            {UNIDADES_COMUNES.map((u) => (
                <option
                    key={u}
                    value={u}
                    className="bg-slate-800 text-slate-200"
                >
                    {u}
                </option>
            ))}
        </select>
    );
};

export const BudgetTree: React.FC<BudgetTreeProps> = ({
    onRowSelect,
    onContextMenu,
}) => {
    const getVisibleRows = useBudgetStore((state) => state.getVisibleRows);
    const storeRows = useBudgetStore((state) => state.rows);
    const searchQuery = useBudgetStore((state) => state.searchQuery);
    const expandedMap = useBudgetStore((state) => state.expandedMap);
    const visibleRows = useMemo(
        () => getVisibleRows(),
        [getVisibleRows, storeRows, searchQuery, expandedMap],
    );

    const selectedId = useBudgetStore((state) => state.selectedId);
    const toggleExpand = useBudgetStore((state) => state.toggleExpand);
    const updateCell = useBudgetStore((state) => state.updateCell);

    const columns = useMemo<ColumnDef<BudgetItemRow>[]>(
        () => [
            {
                accessorKey: 'descripcion',
                header: 'Descripción',
                cell: ({ row: { original: item } }) => {
                    const isTitle = item._level === 0 || item._hasChildren;
                    const indent = item._level! * 20;

                    return (
                        <div
                            style={{ paddingLeft: `${indent + 8}px` }}
                            className="flex items-center gap-1"
                        >
                            {item._hasChildren ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand(item.partida);
                                    }}
                                    className="shrink-0 text-slate-50 hover:text-slate-200"
                                >
                                    {expandedMap[item.partida] ? (
                                        <ChevronDown size={14} />
                                    ) : (
                                        <ChevronRight size={14} />
                                    )}
                                </button>
                            ) : (
                                <span className="w-[14px] shrink-0" />
                            )}

                            {isTitle ? (
                                <span className="flex min-w-0 shrink items-center text-xs font-semibold tracking-wide text-sky-300">
                                    <span className="mr-1 shrink-0">
                                        {item.partida} -
                                    </span>
                                    <StringEditableCell
                                        value={item.descripcion}
                                        isEditable={true}
                                        onUpdate={(val) =>
                                            updateCell(
                                                item.partida,
                                                'descripcion',
                                                val,
                                            )
                                        }
                                        className="max-w-full truncate"
                                    />
                                </span>
                            ) : (
                                <span
                                    className="flex min-w-0 shrink items-center text-xs text-slate-300 transition-colors hover:text-sky-300"
                                    title={item.descripcion}
                                >
                                    <span className="mr-1 shrink-0">
                                        {item.partida} -
                                    </span>
                                    <StringEditableCell
                                        value={item.descripcion}
                                        isEditable={true}
                                        onUpdate={(val) =>
                                            updateCell(
                                                item.partida,
                                                'descripcion',
                                                val,
                                            )
                                        }
                                        className="max-w-[250px] truncate"
                                    />
                                </span>
                            )}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'unidad',
                header: 'Und.',
                size: 60,
                cell: ({ row: { original: item } }) => (
                    <div className="text-center text-xs text-slate-400">
                        {item._level! > 0 && !item._hasChildren ? (
                            <UnitSelectCell
                                value={item.unidad}
                                isEditable={true}
                                onUpdate={(val) =>
                                    updateCell(item.partida, 'unidad', val)
                                }
                            />
                        ) : (
                            item.unidad
                        )}
                    </div>
                ),
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
                                onUpdate={(val) =>
                                    updateCell(item.partida, 'metrado', val)
                                }
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
                    const activeColor =
                        selectedId === item.partida
                            ? 'text-sky-300'
                            : 'text-orange-400';
                    return (
                        <div
                            className={`flex justify-end text-right font-mono text-xs ${activeColor}`}
                        >
                            <EditableCell
                                value={item.precio_unitario}
                                isEditable={isPartida}
                                activeColor={activeColor}
                                onUpdate={(val) =>
                                    updateCell(
                                        item.partida,
                                        'precio_unitario',
                                        val,
                                    )
                                }
                            />
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
                            <span
                                className={
                                    isTitle ? 'text-sky-400' : 'text-slate-200'
                                }
                            >
                                {fmt(item.parcial, 2)}
                            </span>
                        </div>
                    );
                },
            },
        ],
        [expandedMap, toggleExpand, selectedId, updateCell],
    );

    const table = useReactTable({
        data: visibleRows,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const { rows } = table.getRowModel();

    const parentRef = React.useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 28, // height of a row
        overscan: 10,
    });

    return (
        <div className="flex h-full flex-col border-r border-slate-700 bg-slate-900">
            {/* Table Header */}
            <div className="shrink-0 border-b border-slate-600 bg-slate-800">
                <table className="w-full table-fixed text-[10px] tracking-wider text-slate-500 uppercase">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-2 py-1.5 text-left font-medium"
                                        style={{
                                            width:
                                                header.getSize() === 150
                                                    ? 'auto'
                                                    : header.getSize(),
                                        }}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext(),
                                              )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                </table>
            </div>

            {/* Virtualized Body */}
            <div
                ref={parentRef}
                className="scrollbar-thin flex-1 overflow-auto bg-slate-900"
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        const item = row.original;
                        const isTitle = item._level === 0 || item._hasChildren;
                        const isPartida = !isTitle;
                        const isSelected = selectedId === item.partida;

                        return (
                            <div
                                key={virtualRow.key}
                                data-index={virtualRow.index}
                                ref={virtualizer.measureElement}
                                className={`group absolute top-0 left-0 flex w-full cursor-pointer items-center border-b border-slate-700/60 transition-colors hover:bg-slate-700/30 ${isSelected ? 'border-sky-700/50 bg-sky-900/40' : ''} ${isTitle ? 'bg-slate-800/60' : ''} `}
                                style={{
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                onClick={() => {
                                    useBudgetStore
                                        .getState()
                                        .setSelectedId(item.partida);
                                    if (onRowSelect)
                                        onRowSelect(item.partida, isPartida);
                                }}
                                onContextMenu={(e) => {
                                    if (onContextMenu) onContextMenu(e, item);
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <div
                                        key={cell.id}
                                        className="px-2"
                                        style={{
                                            width:
                                                cell.column.getSize() === 150
                                                    ? 'auto'
                                                    : cell.column.getSize(),
                                            flex:
                                                cell.column.getSize() === 150
                                                    ? 1
                                                    : 'none',
                                        }}
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Info */}
            <div className="flex shrink-0 items-center gap-3 border-t border-slate-700 bg-slate-800/50 px-3 py-1 text-[10px] text-slate-500">
                <span>PROYECTO: (Incidencia de costos)</span>
                <div className="flex-1" />
                <span>{visibleRows.length} partidas (Visibles)</span>
            </div>
        </div>
    );
};
