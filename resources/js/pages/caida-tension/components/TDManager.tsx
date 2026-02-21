import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TD_HEADERS, addDataRow, addGroup, addSplitRow, addSubSubgroup, addSubgroup, createInitialTree, deleteRow, exportTree, flattenTree, getTotals, importTree, updateCellValue } from '@/lib/tdTreeManager';
import type { CellType, EditingCell, FlatRow, HeaderColumn, TableRowNode } from '@/types/caida-tension';
import { DUCTO_OPTIONS, INTERRUPTOR_OPTIONS } from '@/types/caida-tension';

interface Props {
    initialTree: TableRowNode[] | null;
    canEdit: boolean;
    /** editMode is lifted to Show.tsx — passed in as controlled state */
    editMode: boolean;
    onEditModeChange: (v: boolean) => void;
    onChange: (tree: TableRowNode[]) => void;
    onExport?: () => void;
    onImport?: (file: File) => void;
}

function fmt(value: string | number, type: CellType): string {
    if ((type === 'number' || type === 'calculation') && typeof value === 'number') {
        return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(value ?? '');
}

function getRowClass(type: string): string {
    const base = 'border-b border-gray-200 text-xs dark:border-gray-700';
    if (type === 'group') return `${base} bg-gray-800 text-white font-bold dark:bg-gray-950`;
    if (type === 'subgroup') return `${base} bg-gray-600 text-white font-semibold dark:bg-gray-800`;
    if (type === 'subsubgroup') return `${base} bg-amber-200 text-gray-800 font-semibold dark:bg-amber-500/20 dark:text-amber-200`;
    return `${base} bg-white hover:bg-blue-50 dark:bg-gray-900 dark:hover:bg-blue-950/30`;
}

export default function TDManager({ initialTree, canEdit, editMode, onEditModeChange, onChange, onExport, onImport }: Props) {
    // Inicializar el árbol UNA sola vez — onChange se propaga desde los handlers, no useEffect
    const [tree, setTree] = useState<TableRowNode[]>(() => initialTree ?? createInitialTree());
    const [editingCell, setEditingCell] = useState<EditingCell>({ rowId: null, cellKey: null, splitIndex: 0 });
    const fileRef = useRef<HTMLInputElement>(null);

    // Wrapper: aplica mutación, actualiza estado local Y propaga al padre en la misma operación
    const mutate = useCallback((fn: (prev: TableRowNode[]) => TableRowNode[]) => {
        setTree((prev) => {
            const next = fn(prev);
            // Propagar hacia Show.tsx de forma asíncrona para que React no anide setState
            setTimeout(() => onChange(next), 0);
            return next;
        });
    }, [onChange]);

    // Escuchar el evento global disparado por el botón "++ Grupo TG" del navbar de Show.tsx
    useEffect(() => {
        const handler = () => mutate((p) => addGroup(p));
        window.addEventListener('td:addGroup', handler);
        return () => window.removeEventListener('td:addGroup', handler);
    }, [mutate]);

    const flat = flattenTree(tree);
    const totals = getTotals(tree);

    const startEdit = useCallback((rowId: string | number, cellKey: string, splitIndex = 0) => {
        if (!editMode || !canEdit) return;
        setEditingCell({ rowId, cellKey, splitIndex });
    }, [editMode, canEdit]);

    const finishEdit = useCallback((value: string, rowId: string | number, cellKey: string, splitIndex = 0) => {
        mutate((prev) => updateCellValue(prev, rowId, cellKey, value, splitIndex));
        setEditingCell({ rowId: null, cellKey: null, splitIndex: 0 });
    }, [mutate]);

    const cancelEdit = useCallback(() => {
        setEditingCell({ rowId: null, cellKey: null, splitIndex: 0 });
    }, []);

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (onImport) { onImport(file); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const imported = importTree(String(ev.target?.result ?? ''));
            if (imported) { mutate(() => imported); }
            else { alert('Error al importar el JSON'); }
        };
        reader.readAsText(file);
        // reset input so same file can be re-selected
        e.target.value = '';
    };

    const handleExport = () => {
        if (onExport) { onExport(); return; }
        const json = exportTree(tree);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tableros-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Renderizar input de edición
    const renderEditInput = (row: FlatRow, header: HeaderColumn) => {
        const cell = row.cells.find((c) => c.key === header.key);
        if (!cell) return null;

        const isEditing =
            editMode &&
            editingCell.rowId === row.id &&
            editingCell.cellKey === header.key &&
            editingCell.splitIndex === row.splitIndex;

        if (!isEditing) {
            return (
                <div
                    className={`block w-full min-h-[20px] ${editMode && canEdit && cell.type !== 'calculation' ? 'cursor-text hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded px-1' : ''}`}
                    onClick={() => startEdit(row.id, header.key, row.splitIndex)}
                >
                    {fmt(cell.value, cell.type)}
                </div>
            );
        }

        const inputCls = 'w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-500 dark:bg-gray-800 dark:text-gray-100';

        if (header.type === 'select' && header.key === 'voltage') {
            return (
                <select
                    autoFocus
                    defaultValue={String(cell.value)}
                    className={inputCls}
                    onChange={(e) => finishEdit(e.target.value, row.id, header.key, row.splitIndex)}
                    onBlur={cancelEdit}
                >
                    {header.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            );
        }

        if (header.type === 'select' && header.key === 'interruptor') {
            const voltageCell = row.cells.find((c) => c.key === 'voltage');
            const voltageKey = String(voltageCell?.value ?? '380');
            const opts = INTERRUPTOR_OPTIONS[voltageKey] ?? {};
            return (
                <select
                    autoFocus
                    defaultValue={String(cell.value)}
                    className={inputCls}
                    onChange={(e) => finishEdit(e.target.value, row.id, header.key, row.splitIndex)}
                    onBlur={cancelEdit}
                >
                    {Object.entries(opts).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
            );
        }

        if (header.type === 'select' && header.key === 'ducto') {
            return (
                <select
                    autoFocus
                    defaultValue={String(cell.value)}
                    className={inputCls}
                    onChange={(e) => finishEdit(e.target.value, row.id, header.key, row.splitIndex)}
                    onBlur={cancelEdit}
                >
                    {Object.entries(DUCTO_OPTIONS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
            );
        }

        return (
            <input
                autoFocus
                type={header.type === 'number' ? 'number' : 'text'}
                defaultValue={String(cell.value)}
                step={header.key === 'factorDemanda' ? '0.01' : 'any'}
                placeholder={header.type === 'calculation' ? 'Ej: =100+200' : ''}
                className={inputCls}
                onBlur={(e) => finishEdit(e.target.value, row.id, header.key, row.splitIndex)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') finishEdit(e.currentTarget.value, row.id, header.key, row.splitIndex);
                    if (e.key === 'Escape') cancelEdit();
                }}
            />
        );
    };

    return (
        <div className="w-full">
            {/* Acción secundaria: sólo botón importar (el resto está en el navbar de Show.tsx) */}
            {canEdit && (
                <div className="mb-3 flex items-center gap-2">
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="rounded bg-purple-500 px-2.5 py-1 text-xs text-white transition-colors hover:bg-purple-600"
                    >
                        Importar JSON
                    </button>
                    <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />
                    {editMode && (
                        <span className="text-xs text-orange-500 dark:text-orange-400">
                            ✏️ Modo edición activo — haz clic en cualquier celda para editarla
                        </span>
                    )}
                </div>
            )}

            {/* Tabla */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-900">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-orange-200 dark:bg-orange-500/20">
                            {TD_HEADERS.map((h) => (
                                <th
                                    key={h.key}
                                    className="whitespace-nowrap border border-gray-300 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-600 dark:text-gray-200"
                                >
                                    {h.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {flat.map((row) => (
                            <tr key={row.uniqueId} className={getRowClass(row.type)}>
                                {row.cells.map((cell, ci) => {
                                    if (cell.visible === false) return null;
                                    const header = TD_HEADERS[ci];
                                    const isNumeric = cell.type === 'number' || cell.type === 'calculation';
                                    return (
                                        <td
                                            key={`${row.uniqueId}-${cell.key}`}
                                            colSpan={cell.colspan}
                                            rowSpan={cell.rowspan}
                                            className={`border border-gray-300 px-2 py-1 align-middle dark:border-gray-600 ${isNumeric ? 'text-right' : ''} ${editMode && canEdit && cell.type !== 'calculation' ? 'cursor-text' : ''}`}
                                        >
                                            {renderEditInput(row, header)}

                                            {/* Controles inline de árbol — sólo en celda descripcion, splitIndex 0, modo edit */}
                                            {editMode && canEdit && cell.key === 'descripcion' && row.splitIndex === 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {row.type === 'group' && (
                                                        <button
                                                            onClick={() => mutate((p) => addSubgroup(p, row.id))}
                                                            className="rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white transition-colors hover:bg-blue-600"
                                                        >
                                                            + TD
                                                        </button>
                                                    )}
                                                    {row.type === 'subgroup' && (
                                                        <>
                                                            <button onClick={() => mutate((p) => addDataRow(p, row.id))} className="rounded bg-green-500 px-1.5 py-0.5 text-xs text-white transition-colors hover:bg-green-600">+ Normal</button>
                                                            <button onClick={() => mutate((p) => addSplitRow(p, row.id))} className="rounded bg-yellow-400 px-1.5 py-0.5 text-xs text-gray-900 transition-colors hover:bg-yellow-500">+ Split</button>
                                                            <button onClick={() => mutate((p) => addSubSubgroup(p, row.id))} className="rounded bg-purple-500 px-1.5 py-0.5 text-xs text-white transition-colors hover:bg-purple-600">+ Sub-TD</button>
                                                        </>
                                                    )}
                                                    {row.type === 'subsubgroup' && (
                                                        <>
                                                            <button onClick={() => mutate((p) => addDataRow(p, row.id))} className="rounded bg-green-500 px-1.5 py-0.5 text-xs text-white transition-colors hover:bg-green-600">+ Normal</button>
                                                            <button onClick={() => mutate((p) => addSplitRow(p, row.id))} className="rounded bg-yellow-400 px-1.5 py-0.5 text-xs text-gray-900 transition-colors hover:bg-yellow-500">+ Split</button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('¿Eliminar esta fila y sus hijos?')) {
                                                                mutate((p) => deleteRow(p, row.id));
                                                            }
                                                        }}
                                                        className="rounded bg-red-500 px-1.5 py-0.5 text-xs text-white transition-colors hover:bg-red-600"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totales */}
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Potencia Instalada Total</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {totals.potenciaInstalada.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} W
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Máxima Demanda Total</p>
                    <p className="text-2xl font-bold text-green-600">
                        {totals.maximaDemanda.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} W
                    </p>
                </div>
            </div>

            {/* Botón exportar oculto — llamado desde Show.tsx navbar */}
            <button id="td-export-trigger" className="hidden" onClick={handleExport} />
        </div>
    );
}
