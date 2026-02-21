import React, { useCallback, useEffect, useState } from 'react';
import { evalFormula } from '@/lib/tdTreeManager';
import { buildInitialATSData, buildInitialTGData, buildTGRowsFromTree, recalculateAllTGRows } from '@/lib/tgCalculations';
import type { ATSRow, EditingCell, HeaderColumn, TableRowNode, TGRow, TGTableRow } from '@/types/caida-tension';
import { INTERRUPTOR_OPTIONS } from '@/types/caida-tension';

interface Props {
    tdTree: TableRowNode[];
    canEdit: boolean;
    editMode: boolean;
    initialTgState?: {
        flattenedData: TGRow[];
        atsData: ATSRow[];
        tgData: TGTableRow[];
    } | null;
    onChange: (state: { flattenedData: TGRow[]; atsData: ATSRow[]; tgData: TGTableRow[] }) => void;
    onTotalsChange: (totals: { potenciaInstalada: number; maximaDemanda: number }) => void;
}

// ─── Cabeceras comunes ────────────────────────────────────────────────────────
const COMMON_HEADERS: HeaderColumn[] = [
    { key: 'tablero', label: 'TABLERO', type: 'text' },
    {
        key: 'sistema', label: 'SISTEMA', type: 'select', options: [
            { label: '1ɸ', value: '220' }, { label: '3ɸ', value: '380' }, { label: '', value: '' },
        ],
    },
];

const CALC_HEADERS: HeaderColumn[] = [
    { key: 'corrienteA', label: 'CORRIENTE (A)', type: 'calculated' },
    { key: 'corrienteDiseno', label: 'CORRIENTE DISEÑO Id (A)', type: 'calculated' },
    { key: 'longitudConductor', label: 'LONGITUD (m)', type: 'formula' },
    { key: 'seccion', label: 'SECCIÓN (mm²)', type: 'number' },
    { key: 'caidaTension', label: 'CAÍDA (V)', type: 'calculated' },
    { key: 'caidaTensionPorcentaje', label: 'CAÍDA (%) <1.5%', type: 'calculated' },
    { key: 'interruptor', label: 'INTERRUPTOR', type: 'select_dynamic' },
    {
        key: 'tipoConductor', label: 'CONDUCTOR', type: 'select', options: [
            { label: 'N2XOH', value: 'N2XOH' }, { label: 'THW', value: 'THW' }, { label: 'THHN', value: 'THHN' }, { label: '', value: '' },
        ],
    },
    {
        key: 'ducto', label: 'DUCTO (mm)', type: 'select', options: [
            ...['15', '20', '25', '35', '40', '50', '65', '80', '100', '150', ''].map((v) => ({ label: v, value: v })),
        ],
    },
];

const MAIN_HEADERS: HeaderColumn[] = [
    { key: 'alimentador', label: 'ALIMENTADOR', type: 'text' },
    ...COMMON_HEADERS,
    { key: 'potenciaInstalada', label: 'POT. INSTALADA (W)', type: 'number' },
    { key: 'factorSimultaniedad', label: 'F.S.', type: 'number' },
    { key: 'maximaDemanda', label: 'MÁX. DEMANDA (W)', type: 'calculated' },
    ...CALC_HEADERS,
];

const ATS_HEADERS: HeaderColumn[] = [
    { key: 'alimentador', label: 'ALIMENTADOR', type: 'text' },
    ...COMMON_HEADERS,
    { key: 'maximademandaats', label: 'MÁX. DEMANDA (W)', type: 'calculated' },
    ...CALC_HEADERS,
];

const TGTB_HEADERS: HeaderColumn[] = [
    { key: 'alimentador', label: 'ALIMENTADOR', type: 'text' },
    ...COMMON_HEADERS,
    { key: 'maximademandaTG', label: 'MÁX. DEMANDA (W)', type: 'calculated' },
    ...CALC_HEADERS,
];

// ─── Helper: actualizar fila en array ────────────────────────────────────────
// Note: non-arrow regular function to avoid TSX generic-vs-JSX parsing conflict
function applyRowUpdate(
    arr: Record<string, unknown>[],
    rowId: string,
    cellKey: string,
    value: string,
    headers: HeaderColumn[],
): Record<string, unknown>[] {
    return arr.map((row) => {
        if (String(row['id']) !== rowId) return row;
        const header = headers.find((h) => h.key === cellKey);
        if (!header) return row;
        let newVal: string | number = value;
        if (header.type === 'number') newVal = parseFloat(value) || 0;
        if (header.type === 'formula') {
            return { ...row, longitudFormula: value, longitudConductor: evalFormula(value) };
        }
        return { ...row, [cellKey]: newVal };
    });
}

function fmt(v: number | string | undefined): string {
    if (typeof v === 'number') return v.toFixed(2);
    return String(v ?? '');
}

// ─── Celda reutilizable ───────────────────────────────────────────────────────
function EditableCell({
    value,
    rowId,
    cellKey,
    tableType,
    header,
    editingCell,
    editMode,
    canEdit,
    row,
    onStart,
    onFinish,
    onCancel,
}: {
    value: string | number;
    rowId: string;
    cellKey: string;
    tableType: 'main' | 'ats' | 'tg';
    header: HeaderColumn;
    editingCell: EditingCell;
    editMode: boolean;
    canEdit: boolean;
    row: Record<string, unknown>;
    onStart: (rowId: string, key: string, table: 'main' | 'ats' | 'tg') => void;
    onFinish: (value: string, rowId: string, key: string, table: 'main' | 'ats' | 'tg') => void;
    onCancel: () => void;
}) {
    const isEditing = editMode && editingCell.rowId === rowId && editingCell.cellKey === cellKey && editingCell.tableType === tableType;
    const isCalc = header.type === 'calculated';
    const isHighDrop = cellKey === 'caidaTensionPorcentaje' && Number(value) > 1.5;

    const cls = `px-2 py-1 border-b border-gray-200 text-xs dark:border-gray-700 ${isCalc ? 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300' : 'dark:text-gray-100'} ${isHighDrop ? 'bg-red-100 text-red-700 font-semibold dark:bg-red-500/20 dark:text-red-300' : ''} ${header.type === 'number' || isCalc ? 'text-right font-mono' : ''}`;

    const inputCls = 'w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-gray-800 focus:outline-none dark:border-blue-500 dark:bg-gray-800 dark:text-gray-100';

    const renderInput = () => {
        if (header.type === 'select' || header.type === 'select_dynamic') {
            let options: { label: string; value: string }[] = [];
            if (header.type === 'select_dynamic' && cellKey === 'interruptor') {
                const sistema = String(row['sistema'] ?? '380');
                const raw = INTERRUPTOR_OPTIONS[sistema] ?? {};
                options = Object.entries(raw).map(([k, v]) => ({ label: v, value: k }));
            } else {
                options = header.options ?? [];
            }
            return (
                <select autoFocus className={inputCls} defaultValue={String(value)}
                    onChange={(e) => onFinish(e.target.value, rowId, cellKey, tableType)} onBlur={onCancel}>
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        }

        const displayValue = header.type === 'formula' ? String((row as Record<string, string>)['longitudFormula'] ?? value) : String(value);

        return (
            <input
                autoFocus type={header.type === 'number' ? 'number' : 'text'}
                defaultValue={displayValue} step="0.01"
                placeholder={header.type === 'formula' ? 'ej: 9.38+1.8' : ''}
                className={inputCls}
                onBlur={(e) => onFinish(e.target.value, rowId, cellKey, tableType)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onFinish(e.currentTarget.value, rowId, cellKey, tableType);
                    if (e.key === 'Escape') onCancel();
                }}
            />
        );
    };

    return (
        <td className={cls} onClick={() => !isCalc && canEdit && editMode && onStart(rowId, cellKey, tableType)}>
            {isEditing ? renderInput() : fmt(value)}
        </td>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TGManager({ tdTree, canEdit, editMode, initialTgState, onChange, onTotalsChange }: Props): React.JSX.Element {
    const [editingCell, setEditingCell] = useState<EditingCell>({ rowId: null, cellKey: null, tableType: null });

    const buildInitial = useCallback(() => {
        if (initialTgState) return initialTgState;
        const flattenedData = buildTGRowsFromTree(tdTree);
        const atsData = buildInitialATSData(0);
        const tgData = buildInitialTGData(0);
        const result = recalculateAllTGRows(flattenedData, atsData, tgData);
        return { flattenedData: result.flattenedData, atsData: result.atsData, tgData: result.tgData };
    }, [initialTgState, tdTree]);

    const [state, setState] = useState(buildInitial);
    const [totals, setTotals] = useState({ potenciaInstalada: 0, maximaDemanda: 0 });

    // Reaccionar a cambios del árbol TD
    useEffect(() => {
        const flattenedData = buildTGRowsFromTree(tdTree);
        const result = recalculateAllTGRows(flattenedData, state.atsData, state.tgData);
        const newState = { flattenedData: result.flattenedData, atsData: result.atsData, tgData: result.tgData };
        setState(newState);
        setTotals(result.totals);
        onChange(newState);
        onTotalsChange(result.totals);
    }, [tdTree]); // eslint-disable-line react-hooks/exhaustive-deps

    const startEdit = useCallback((rowId: string, key: string, table: 'main' | 'ats' | 'tg') => {
        setEditingCell({ rowId, cellKey: key, tableType: table });
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingCell({ rowId: null, cellKey: null, tableType: null });
    }, []);

    const finishEdit = useCallback((value: string, rowId: string, cellKey: string, tableType: 'main' | 'ats' | 'tg') => {
        setState((prev) => {
            const toRec = (arr: unknown) => arr as unknown as Record<string, unknown>[];

            const newFlattened = tableType === 'main'
                ? applyRowUpdate(toRec(prev.flattenedData), rowId, cellKey, value, MAIN_HEADERS) as unknown as TGRow[]
                : prev.flattenedData;
            const newAts = tableType === 'ats'
                ? applyRowUpdate(toRec(prev.atsData), rowId, cellKey, value, ATS_HEADERS) as unknown as ATSRow[]
                : prev.atsData;
            const newTg = tableType === 'tg'
                ? applyRowUpdate(toRec(prev.tgData), rowId, cellKey, value, TGTB_HEADERS) as unknown as TGTableRow[]
                : prev.tgData;

            const result = recalculateAllTGRows(newFlattened, newAts, newTg);
            setTotals(result.totals);
            const newState = { flattenedData: result.flattenedData, atsData: result.atsData, tgData: result.tgData };
            onChange(newState);
            onTotalsChange(result.totals);
            return newState;
        });
        cancelEdit();
    }, [cancelEdit, onChange, onTotalsChange]);

    // Helper para renderizar una tabla genérica
    const renderTable = (
        title: string,
        gradient: string,
        rows: Record<string, unknown>[],
        headers: HeaderColumn[],
        tableType: 'main' | 'ats' | 'tg',
    ) => (
        <div className="mb-6 overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
            <div className={`px-4 py-3 bg-linear-to-r ${gradient}`}>
                <h3 className="text-sm font-bold text-white">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead className={`bg-linear-to-r ${gradient} text-white`}>
                        <tr>
                            {headers.map((h) => (
                                <th key={h.key} className="px-2 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap">
                                    {h.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {rows.map((row) => (
                            <tr key={String(row['id'])} className={row['isMainRow'] ? 'bg-blue-50 dark:bg-blue-500/15' : row['isStaticTG'] ? 'bg-gray-100 font-bold dark:bg-gray-800' : 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800'}>
                                {headers.map((h) => {
                                    if (h.key === 'alimentador' && tableType === 'main') {
                                        if (row['isMainRow'] || row['isStaticTG']) {
                                            return (
                                                <td key={h.key} rowSpan={Number(row['rowspan'] ?? 1)}
                                                    className="border-r border-gray-200 bg-blue-100 px-2 py-1 text-center text-xs font-bold dark:border-gray-700 dark:bg-blue-500/25 dark:text-blue-100">
                                                    {String(row['alimentador'] ?? '')}
                                                </td>
                                            );
                                        }
                                        return null;
                                    }
                                    return (
                                        <EditableCell
                                            key={h.key}
                                            value={row[h.key] as string | number}
                                            rowId={String(row['id'])}
                                            cellKey={h.key}
                                            tableType={tableType}
                                            header={h}
                                            editingCell={editingCell}
                                            editMode={editMode}
                                            canEdit={canEdit}
                                            row={row}
                                            onStart={startEdit}
                                            onFinish={finishEdit}
                                            onCancel={cancelEdit}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="w-full">

            {state.flattenedData.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white py-12 text-center shadow dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-sm text-gray-400 dark:text-gray-500">Los datos se cargarán automáticamente desde el tab TD.</p>
                </div>
            ) : (
                renderTable(
                    'Cálculo de Caída de Tensión — Alimentador Principal',
                    'from-blue-600 to-blue-700',
                    state.flattenedData as unknown as Record<string, unknown>[],
                    MAIN_HEADERS,
                    'main',
                )
            )}

            {renderTable('Tabla ATS — Transferencia Automática', 'from-green-600 to-green-700', state.atsData as unknown as Record<string, unknown>[], ATS_HEADERS, 'ats')}
            {renderTable('Tabla TG — Grupo Electrógeno', 'from-purple-600 to-purple-700', state.tgData as unknown as Record<string, unknown>[], TGTB_HEADERS, 'tg')}

            {/* Resumen */}
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Potencia Total del Sistema</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {totals.potenciaInstalada.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} W
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Demanda Máxima del Sistema</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {totals.maximaDemanda.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} W
                    </p>
                </div>
            </div>
        </div>
    );
}
