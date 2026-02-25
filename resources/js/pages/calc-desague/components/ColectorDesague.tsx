import { useState, useEffect, useCallback, useRef } from 'react';
import type { GradeKey, ColectorRow, ColectorState, TabDesagueProps } from '@/types/desague';

// ─── Config ───────────────────────────────────────────────────────────────────

interface DimensionEntry {
    valor: number;
    value: string;
    label: string;
}

const DIMENSION_CONFIG: { dimensions: DimensionEntry[] } = {
    dimensions: [
        { valor: 0.61, value: '0.25m x 0.50m (10" x 20")', label: 'C.R.' },
        { valor: 0.81, value: '0.30m x 0.60m (12" x 24")', label: 'C.R.' },
        { valor: 1.01, value: '0.45m x 0.60m (18" x 24")', label: 'C.R.' },
        { valor: 1.21, value: '0.60m x 0.60m (24" x 24")', label: 'C.R.' },
        { valor: 1.20, value: 'Diametro D=1.20m', label: 'B.z.' },
    ],
};

const GRADE_CONFIGS: Record<GradeKey, { title: string }> = {
    inicial: { title: 'Inicial' },
    primaria: { title: 'Primaria' },
    secundaria: { title: 'Secundaria' },
};

const GRADE_HEADER_CLASSES: Record<GradeKey, string> = {
    inicial: 'bg-gradient-to-r from-emerald-800 to-emerald-700',
    primaria: 'bg-gradient-to-r from-blue-800 to-blue-700',
    secundaria: 'bg-gradient-to-r from-purple-800 to-purple-700',
};

// ─── Defaults ────────────────────────────────────────────────────────────────

const INITIAL_DATA: ColectorState = {
    inicial: [
        {
            id: 1, tramo: 'C.R.1 - C.R.2', longitud: 1.41, ud: 5, diametro: 'Ø4',
            pendiente: '2.13%', cr1_num: 'C.R.', cr1_nval: '1', cr1_ct: 0.15,
            cr1_cf: -0.15, cr1_h: 0.3, cr1_dim: '0.25m x 0.50m (10" x 20")',
            cr2_num: 'C.R.', cr2_nval: '2', cr2_ct: 0.15, cr2_cf: -0.18,
            cr2_h: 0.33, cr2_dim: '0.25m x 0.50m (10" x 20")', isStatic: false,
        },
    ],
    primaria: [
        {
            id: 1, tramo: 'C.R.1 - C.R.2', longitud: 1.53, ud: 24, diametro: 'Ø4',
            pendiente: '1.96%', cr1_num: 'C.R.', cr1_nval: '1', cr1_ct: 0.15,
            cr1_cf: -0.3, cr1_h: 0.45, cr1_dim: '0.25m x 0.50m (10" x 20")',
            cr2_num: 'C.R.', cr2_nval: '2', cr2_ct: 0.15, cr2_cf: -0.33,
            cr2_h: 0.48, cr2_dim: '0.25m x 0.50m (10" x 20")', isStatic: false,
        },
        {
            id: 2, tramo: 'C.R.2 - C.R.3', longitud: 1.25, ud: 120, diametro: 'Ø4',
            pendiente: '1.60%', cr1_num: 'C.R.', cr1_nval: '2', cr1_ct: 0.15,
            cr1_cf: -0.33, cr1_h: 0.48, cr1_dim: '0.25m x 0.50m (10" x 20")',
            cr2_num: 'C.R.', cr2_nval: '3', cr2_ct: 0.15, cr2_cf: -0.35,
            cr2_h: 0.5, cr2_dim: '0.25m x 0.50m (10" x 20")', isStatic: false,
        },
    ],
    secundaria: [
        {
            id: 1, tramo: 'C.R.1 - C.R.2', longitud: 1.53, ud: 24, diametro: 'Ø4',
            pendiente: '1.96%', cr1_num: 'C.R.', cr1_nval: '', cr1_ct: 0.15,
            cr1_cf: -0.3, cr1_h: 0.45, cr1_dim: '0.25m x 0.50m (10" x 20")',
            cr2_num: 'C.R.', cr2_nval: '', cr2_ct: 0.15, cr2_cf: -0.33,
            cr2_h: 0.48, cr2_dim: '0.25m x 0.50m (10" x 20")', isStatic: false,
        },
    ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStaticRows(grade: GradeKey): ColectorRow[] {
    return [
        {
            id: `static_${grade}_bz1`, tramo: 'B.z 1 - CAJA FINAL', longitud: 0, ud: 0,
            diametro: 'Ø4', pendiente: '0%', cr1_num: 'B.z', cr1_nval: '1',
            cr1_ct: 0, cr1_cf: 0, cr1_h: 0, cr1_dim: 'Diametro D=1.20m',
            cr2_num: 'CAJA FINAL', cr2_nval: '', cr2_ct: 0, cr2_cf: 0, cr2_h: 0,
            cr2_dim: '0.25m x 0.50m (10" x 20")', isStatic: true,
        },
        {
            id: `static_${grade}_final`, tramo: 'CAJA FINAL - CONEXIÓN', longitud: 0, ud: 0,
            diametro: 'Ø4', pendiente: '0%', cr1_num: 'CAJA FINAL', cr1_nval: '',
            cr1_ct: 0, cr1_cf: 0, cr1_h: 0, cr1_dim: '0.25m x 0.50m (10" x 20")',
            cr2_num: 'CONEXIÓN', cr2_nval: '', cr2_ct: 0, cr2_cf: 0, cr2_h: 0,
            cr2_dim: '', isStatic: true,
        },
    ];
}

function calcCajaRegistroData(ct: number, cf: number): { h: number; dim: string; num: string } {
    const altura = ct - cf;
    const absAltura = Math.abs(altura);
    const dimMatch = DIMENSION_CONFIG.dimensions.find(d => absAltura < d.valor);
    const dimension = absAltura === 0 ? '' : dimMatch ? dimMatch.value : 'No definido';
    const numPrefix = dimMatch && dimMatch.label === 'C.R.' ? 'C.R.' : 'B.z.';
    return { h: parseFloat(altura.toFixed(2)), dim: dimension, num: numPrefix };
}

function calcPendiente(cr1_cf: number, cr2_cf: number, longitud: number): string {
    return (((cr1_cf - cr2_cf) / (longitud || 1)) * 100).toFixed(2) + '%';
}

function fmtNum(value: number | string, decimals = 2): string {
    if (typeof value === 'number') return value.toFixed(decimals);
    return value ? String(value) : '0.00';
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

interface EditableCellProps {
    value: string | number;
    editable: boolean;
    type?: string;
    textClassName?: string;
    onChange: (v: string) => void;
}

function EditableCell({ value, editable, type = 'text', textClassName, onChange }: EditableCellProps) {
    const [editing, setEditing] = useState(false);
    const [localVal, setLocalVal] = useState(String(value ?? ''));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setLocalVal(String(value ?? '')); }, [value]);
    useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const textColorClass = textClassName || 'text-black dark:text-gray-100';

    if (!editable) {
        return <span className={`block px-2 py-1 text-sm ${textColorClass} font-semibold`}>{value}</span>;
    }
    if (editing) {
        return (
            <input
                ref={inputRef} type={type} value={localVal}
                className="w-full px-2 py-1 text-sm text-black border border-blue-400 rounded outline-none bg-blue-50 focus:ring-2 focus:ring-blue-300 min-w-[60px]"
                onChange={e => setLocalVal(e.target.value)}
                onBlur={() => { setEditing(false); onChange(localVal); }}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'Tab') { setEditing(false); onChange(localVal); }
                    else if (e.key === 'Escape') { setEditing(false); setLocalVal(String(value ?? '')); }
                }}
            />
        );
    }
    return (
        <span
            className={`block px-2 py-1 text-sm ${textColorClass} font-semibold cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors`}
            onDoubleClick={() => setEditing(true)}
            title="Doble clic para editar"
        >
            {value}
        </span>
    );
}

// ─── GradeTable ───────────────────────────────────────────────────────────────

interface GradeTableProps {
    grade: GradeKey;
    rows: ColectorRow[];
    isEdit: boolean;
    onUpdateRow: (grade: GradeKey, id: number | string, updates: Partial<ColectorRow>) => void;
    onDeleteRow: (grade: GradeKey, id: number | string) => void;
    onAddRow: (grade: GradeKey) => void;
}

function GradeTable({ grade, rows, isEdit, onUpdateRow, onDeleteRow, onAddRow }: GradeTableProps) {
    const config = GRADE_CONFIGS[grade];

    // Merge static rows if not present
    const hasStatic = rows?.some(r => r.isStatic);
    let allRows = rows || [];

    if (!hasStatic) {
        const dynamicRows = rows || [];
        const totalUD = dynamicRows.length > 0 ? Number(dynamicRows[dynamicRows.length - 1]?.ud) || 0 : 0;
        // Si UD > 120 usamos Diametro D=1.20m para las filas estáticas (captura H y dimensiones)
        const staticDiametro = totalUD > 120 ? 'Diametro D=1.20m' : (totalUD > 180 ? 'Ø6' : 'Ø4');
        const staticRows = getStaticRows(grade).map(sr => ({ ...sr, ud: totalUD, diametro: staticDiametro }));
        allRows = [...dynamicRows, ...staticRows];
    }

    // ── Cell change handler (unified for ALL rows, static or not) ──────────────
    const handleCellChange = useCallback((row: ColectorRow, field: string, rawVal: string) => {
        const updates: Partial<ColectorRow> = {};

        if (field === 'longitud') {
            const longitud = parseFloat(rawVal) || 0;
            updates.longitud = longitud;
            updates.pendiente = calcPendiente(row.cr1_cf, row.cr2_cf, longitud);

        } else if (field === 'ud') {
            const ud = parseInt(rawVal) || 0;
            updates.ud = ud;
            updates.diametro = ud > 120 ? 'Diametro D=1.20m' : (ud > 180 ? 'Ø6' : 'Ø4');

        } else if (field === 'cr1_ct' || field === 'cr1_cf') {
            const ct = field === 'cr1_ct' ? parseFloat(rawVal) || 0 : row.cr1_ct;
            const cf = field === 'cr1_cf' ? parseFloat(rawVal) || 0 : row.cr1_cf;
            (updates as any)[field] = parseFloat(rawVal) || 0;
            const calc = calcCajaRegistroData(ct, cf);
            updates.cr1_h = calc.h;
            updates.cr1_dim = calc.dim;
            updates.cr1_num = calc.num; // ← now applies to ALL rows including static

            const newCr1Cf = field === 'cr1_cf' ? parseFloat(rawVal) || 0 : row.cr1_cf;
            updates.pendiente = calcPendiente(newCr1Cf, row.cr2_cf, row.longitud);
            updates.tramo = `${calc.num}${row.cr1_nval} - ${row.cr2_num}${row.cr2_nval}`;

        } else if (field === 'cr2_ct' || field === 'cr2_cf') {
            const ct = field === 'cr2_ct' ? parseFloat(rawVal) || 0 : row.cr2_ct;
            const cf = field === 'cr2_cf' ? parseFloat(rawVal) || 0 : row.cr2_cf;
            (updates as any)[field] = parseFloat(rawVal) || 0;
            const calc = calcCajaRegistroData(ct, cf);
            updates.cr2_h = calc.h;
            updates.cr2_dim = calc.dim;
            updates.cr2_num = calc.num; // ← now applies to ALL rows including static

            const newCr2Cf = field === 'cr2_cf' ? parseFloat(rawVal) || 0 : row.cr2_cf;
            updates.pendiente = calcPendiente(row.cr1_cf, newCr2Cf, row.longitud);
            updates.tramo = `${row.cr1_num}${row.cr1_nval} - ${calc.num}${row.cr2_nval}`;

        } else if (field === 'cr1_nval') {
            updates.cr1_nval = rawVal;
            updates.tramo = `${row.cr1_num}${rawVal} - ${row.cr2_num}${row.cr2_nval}`;
        } else if (field === 'cr2_nval') {
            updates.cr2_nval = rawVal;
            updates.tramo = `${row.cr1_num}${row.cr1_nval} - ${row.cr2_num}${rawVal}`;
        } else if (field === 'cr1_num') {
            updates.cr1_num = rawVal;
            updates.tramo = `${rawVal}${row.cr1_nval} - ${row.cr2_num}${row.cr2_nval}`;
        } else if (field === 'cr2_num') {
            updates.cr2_num = rawVal;
            updates.tramo = `${row.cr1_num}${row.cr1_nval} - ${rawVal}${row.cr2_nval}`;
        } else if (field === 'tramo') {
            updates.tramo = rawVal;
        } else if (field === 'diametro') {
            updates.diametro = rawVal;
        } else if (field === 'pendiente') {
            updates.pendiente = rawVal;
        } else if (field === 'cr1_h') {
            updates.cr1_h = parseFloat(rawVal) || 0;
        } else if (field === 'cr1_dim') {
            updates.cr1_dim = rawVal;
        } else if (field === 'cr2_h') {
            updates.cr2_h = parseFloat(rawVal) || 0;
        } else if (field === 'cr2_dim') {
            updates.cr2_dim = rawVal;
        }

        onUpdateRow(grade, row.id, updates);
    }, [grade, onUpdateRow]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            <div className={`px-6 py-4 ${GRADE_HEADER_CLASSES[grade]}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-xl font-bold text-white tracking-wide">
                        ANEXO 08. COLECTORES — {config.title.toUpperCase()}
                    </h2>
                    <div className="flex items-center space-x-3 text-sm text-white/80">
                        <span>Filas: <span className="font-semibold text-white">{(rows || []).length}</span></span>
                        {isEdit && (
                            <button
                                onClick={() => onAddRow(grade)}
                                className="inline-flex items-center px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border-2 border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 hover:scale-105"
                            >
                                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Agregar Fila
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden" style={{ minWidth: '1200px' }}>
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                            <th rowSpan={2} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold whitespace-nowrap">TRAMO</th>
                            <th rowSpan={2} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold whitespace-nowrap">LONGITUD (m)</th>
                            <th rowSpan={2} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold">UD</th>
                            <th rowSpan={2} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold">DIAMETRO</th>
                            <th rowSpan={2} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold">PENDIENTE</th>
                            <th colSpan={6} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold text-center bg-emerald-100 dark:bg-emerald-900/40">CAJA REGISTRO (INICIAL)</th>
                            <th colSpan={6} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold text-center bg-blue-100 dark:bg-blue-900/40">CAJA REGISTRO (FINAL)</th>
                            {isEdit && <th rowSpan={2} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-black dark:text-gray-100 font-bold">ACCIONES</th>}
                        </tr>
                        <tr className="bg-gray-50 dark:bg-gray-800">
                            {['N°', 'N°', 'CT (m)', 'CF/CLL (m)', 'H (m)', 'DIMENSIONES'].map((h, i) => (
                                <th key={`cr1-${i}`} className="border border-gray-400 dark:border-gray-500 px-2 py-1 text-black dark:text-gray-100 font-bold bg-emerald-50 dark:bg-emerald-900/20 whitespace-nowrap">{h}</th>
                            ))}
                            {['N°', 'N°', 'CT (m)', 'CF/CLL (m)', 'H (m)', 'DIMENSIONES'].map((h, i) => (
                                <th key={`cr2-${i}`} className="border border-gray-400 dark:border-gray-500 px-2 py-1 text-black dark:text-gray-100 font-bold bg-blue-50 dark:bg-blue-900/20 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allRows.map((row, idx) => {
                            const isStaticRow = row.isStatic;
                            const rowClass = isStaticRow
                                ? 'bg-amber-50 dark:bg-amber-900/20'
                                : idx % 2 === 0
                                    ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    : 'bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/80';

                            const isPendienteNegativa = parseFloat(row.pendiente) < 0;
                            const pendienteColor = isPendienteNegativa ? 'text-red-600 dark:text-red-400' : 'text-black dark:text-gray-100';
                            const cf1Color = row.cr1_cf < 1 ? 'text-yellow-600 dark:text-yellow-400' : '';
                            const cf2Color = row.cr2_cf < 1 ? 'text-yellow-600 dark:text-yellow-400' : '';

                            return (
                                <tr key={String(row.id)} className={`transition-colors ${rowClass}`}>
                                    {/* TRAMO — editable */}
                                    <td className="border border-gray-300 dark:border-gray-600 text-center text-black dark:text-gray-100 font-semibold">
                                        <EditableCell
                                            value={row.tramo}
                                            editable={isEdit}
                                            type="text"
                                            textClassName="whitespace-nowrap"
                                            onChange={v => handleCellChange(row, 'tramo', v)}
                                        />
                                    </td>

                                    {/* LONGITUD — editable for ALL rows */}
                                    <td className="border border-gray-300 dark:border-gray-600 text-center">
                                        <EditableCell
                                            value={fmtNum(row.longitud)}
                                            editable={isEdit}
                                            type="number"
                                            onChange={v => handleCellChange(row, 'longitud', v)}
                                        />
                                    </td>

                                    {/* UD — editable for ALL rows (static included) */}
                                    <td className="border border-gray-300 dark:border-gray-600 text-center">
                                        <EditableCell
                                            value={row.ud}
                                            editable={isEdit}
                                            type="number"
                                            onChange={v => handleCellChange(row, 'ud', v)}
                                        />
                                    </td>

                                    {/* DIAMETRO — editable */}
                                    <td className="border border-gray-300 dark:border-gray-600 text-center">
                                        <EditableCell
                                            value={row.diametro}
                                            editable={isEdit}
                                            type="text"
                                            onChange={v => handleCellChange(row, 'diametro', v)}
                                        />
                                    </td>

                                    {/* PENDIENTE — editable */}
                                    <td className="border border-gray-300 dark:border-gray-600 text-center">
                                        <EditableCell
                                            value={row.pendiente}
                                            editable={isEdit}
                                            type="text"
                                            textClassName={pendienteColor}
                                            onChange={v => handleCellChange(row, 'pendiente', v)}
                                        />
                                    </td>

                                    {/* CR1 — fully editable for ALL rows */}
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-emerald-50/20 dark:bg-emerald-900/10">
                                        <EditableCell value={row.cr1_num} editable={isEdit} type="text" onChange={v => handleCellChange(row, 'cr1_num', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-emerald-50/20 dark:bg-emerald-900/10">
                                        <EditableCell value={row.cr1_nval} editable={isEdit} type="text" onChange={v => handleCellChange(row, 'cr1_nval', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-emerald-50/20 dark:bg-emerald-900/10">
                                        <EditableCell value={fmtNum(row.cr1_ct)} editable={isEdit} type="number" onChange={v => handleCellChange(row, 'cr1_ct', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-emerald-50/20 dark:bg-emerald-900/10">
                                        <EditableCell value={fmtNum(row.cr1_cf)} editable={isEdit} type="number" textClassName={cf1Color} onChange={v => handleCellChange(row, 'cr1_cf', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-emerald-50/20 dark:bg-emerald-900/10">
                                        <EditableCell
                                            value={fmtNum(row.cr1_h)}
                                            editable={isEdit}
                                            type="number"
                                            onChange={v => handleCellChange(row, 'cr1_h', v)}
                                        />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 bg-emerald-50/20 dark:bg-emerald-900/10">
                                        <EditableCell
                                            value={row.cr1_dim}
                                            editable={isEdit}
                                            type="text"
                                            onChange={v => handleCellChange(row, 'cr1_dim', v)}
                                        />
                                    </td>

                                    {/* CR2 — fully editable for ALL rows */}
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-blue-50/20 dark:bg-blue-900/10">
                                        <EditableCell value={row.cr2_num} editable={isEdit} type="text" onChange={v => handleCellChange(row, 'cr2_num', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-blue-50/20 dark:bg-blue-900/10">
                                        <EditableCell value={row.cr2_nval} editable={isEdit} type="text" onChange={v => handleCellChange(row, 'cr2_nval', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-blue-50/20 dark:bg-blue-900/10">
                                        <EditableCell value={fmtNum(row.cr2_ct)} editable={isEdit} type="number" onChange={v => handleCellChange(row, 'cr2_ct', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-blue-50/20 dark:bg-blue-900/10">
                                        <EditableCell value={fmtNum(row.cr2_cf)} editable={isEdit} type="number" textClassName={cf2Color} onChange={v => handleCellChange(row, 'cr2_cf', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center bg-blue-50/20 dark:bg-blue-900/10">
                                        <EditableCell
                                            value={fmtNum(row.cr2_h)}
                                            editable={isEdit}
                                            type="number"
                                            onChange={v => handleCellChange(row, 'cr2_h', v)}
                                        />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 bg-blue-50/20 dark:bg-blue-900/10">
                                        <EditableCell
                                            value={row.cr2_dim}
                                            editable={isEdit}
                                            type="text"
                                            onChange={v => handleCellChange(row, 'cr2_dim', v)}
                                        />
                                    </td>

                                    {/* ACCIONES */}
                                    {isEdit && (
                                        <td className="border border-gray-300 dark:border-gray-600 text-center">
                                            {isStaticRow ? (
                                                <span className="text-amber-500 text-[10px] px-1 font-semibold">Estático</span>
                                            ) : (
                                                <button
                                                    onClick={() => onDeleteRow(grade, row.id)}
                                                    className="mx-auto flex items-center justify-center w-7 h-7 bg-red-500 text-white rounded hover:bg-red-600 text-xs transition-colors"
                                                    title="Eliminar fila"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ColectorDesagueProps extends TabDesagueProps {
    udData?: { grades?: Record<GradeKey, boolean> };
}

export default function ColectorDesague({ editMode, canEdit, initialData, onChange, udData }: ColectorDesagueProps) {
    const isEdit = !!(editMode && canEdit);
    const [persistentData, setPersistentData] = useState<ColectorState>(() => {
        if (initialData) {
            const processedData = { ...initialData } as ColectorState;
            (Object.keys(GRADE_CONFIGS) as GradeKey[]).forEach(grade => {
                if (processedData[grade]) {
                    const hasStatic = processedData[grade]?.some(r => r.isStatic);
                    if (!hasStatic) {
                        const dynamicRows = processedData[grade] || [];
                        const totalUD = dynamicRows.length > 0 ? Number(dynamicRows[dynamicRows.length - 1].ud) || 0 : 0;
                        // Si UD > 120 usamos Diametro D=1.20m para las filas estáticas
                        const staticDiametro = totalUD > 120 ? 'Diametro D=1.20m' : (totalUD > 180 ? 'Ø6' : 'Ø4');
                        const staticRows = getStaticRows(grade).map(sr => ({ ...sr, ud: totalUD, diametro: staticDiametro }));
                        processedData[grade] = [...dynamicRows, ...staticRows];
                    }
                }
            });
            return processedData;
        }
        return JSON.parse(JSON.stringify(INITIAL_DATA));
    });
    const [nextIds, setNextIds] = useState<Record<GradeKey, number>>({ inicial: 2, primaria: 4, secundaria: 2 });

    const activeGradesObj: Record<GradeKey, boolean> = udData?.grades ?? { inicial: true, primaria: false, secundaria: false };
    const gradeEntries = (Object.keys(GRADE_CONFIGS) as GradeKey[]).filter(g => activeGradesObj[g]);

    const persistChange = useCallback((newData: ColectorState) => {
        setPersistentData(newData);
        onChange?.(newData);
    }, [onChange]);

    const handleUpdateRow = useCallback((grade: GradeKey, id: number | string, updates: Partial<ColectorRow>) => {
        let newGradeRows = (persistentData[grade] || []).map(row =>
            row.id === id ? { ...row, ...updates } : row
        );

        // Sync UD from the last dynamic row to static rows whenever UD changes on any row
        if ('ud' in updates) {
            const dynamicRows = newGradeRows.filter(r => !r.isStatic);
            const totalUD = dynamicRows.length > 0 ? Number(dynamicRows[dynamicRows.length - 1].ud) || 0 : 0;
            const staticDiametro = totalUD > 180 ? 'Ø6' : 'Ø4';

            newGradeRows = newGradeRows.map(row => {
                if (row.isStatic) {
                    return { ...row, ud: totalUD, diametro: staticDiametro };
                }
                return row;
            });
        }

        const newData: ColectorState = { ...persistentData, [grade]: newGradeRows };
        persistChange(newData);
    }, [persistentData, persistChange]);

    const handleDeleteRow = useCallback((grade: GradeKey, id: number | string) => {
        let newArr = (persistentData[grade] || []).filter(row => row.id !== id);

        const dynamicRows = newArr.filter(r => !r.isStatic);
        const totalUD = dynamicRows.length > 0 ? Number(dynamicRows[dynamicRows.length - 1].ud) || 0 : 0;
        const staticDiametro = totalUD > 120 ? 'Diametro D=1.20m' : (totalUD > 180 ? 'Ø6' : 'Ø4');

        newArr = newArr.map(row => {
            if (row.isStatic) {
                return { ...row, ud: totalUD, diametro: staticDiametro };
            }
            return row;
        });

        const newData: ColectorState = { ...persistentData, [grade]: newArr };
        persistChange(newData);
    }, [persistentData, persistChange]);

    const handleAddRow = useCallback((grade: GradeKey) => {
        const nextId = nextIds[grade];
        const newRow: ColectorRow = {
            id: Date.now(), tramo: `C.R.${nextId} - C.R.${nextId + 1}`, longitud: 0, ud: 0,
            diametro: 'Ø4', pendiente: '0%', cr1_num: 'C.R.', cr1_nval: String(nextId),
            cr1_ct: 0, cr1_cf: 0, cr1_h: 0, cr1_dim: '0.25m x 0.50m (10" x 20")',
            cr2_num: 'C.R.', cr2_nval: String(nextId + 1), cr2_ct: 0, cr2_cf: 0,
            cr2_h: 0, cr2_dim: '0.25m x 0.50m (10" x 20")', isStatic: false,
        };

        const currentRows = persistentData[grade] || [];
        const dynamicRows = currentRows.filter(r => !r.isStatic);
        let staticRows = currentRows.filter(r => r.isStatic);

        const newRows = [...dynamicRows, newRow];
        const totalUD = newRows.length > 0 ? Number(newRows[newRows.length - 1].ud) || 0 : 0;
        const staticDiametro = totalUD > 120 ? 'Diametro D=1.20m' : (totalUD > 180 ? 'Ø6' : 'Ø4');

        if (staticRows.length === 0) {
            staticRows = getStaticRows(grade).map(sr => ({ ...sr, ud: totalUD, diametro: staticDiametro }));
        } else {
            staticRows = staticRows.map(sr => ({ ...sr, ud: totalUD, diametro: staticDiametro }));
        }

        const newData: ColectorState = {
            ...persistentData,
            [grade]: [...newRows, ...staticRows],
        };
        persistChange(newData);
        setNextIds(prev => ({ ...prev, [grade]: prev[grade] + 2 }));
    }, [nextIds, persistentData, persistChange]);

    return (
        <div className="w-full min-h-screen bg-transparent p-4 md:p-6 pb-24">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 shadow-xl text-white">
                <h1 className="text-xl md:text-2xl font-black mb-1">Sistema de Colector</h1>
                <p className="text-blue-100 text-sm opacity-90">Gestión de Datos Hidráulicos</p>
            </div>

            {isEdit && (
                <div className="mb-4">
                    <div className="flex items-center space-x-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-2 text-sm text-orange-700 dark:text-orange-300">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Modo edición activo — Doble clic sobre una celda para editarla. Las filas <span className="font-bold text-amber-600 dark:text-amber-400">EST</span> son estáticas pero totalmente editables.</span>
                    </div>
                </div>
            )}

            <main>
                {gradeEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <svg className="w-16 h-16 mb-4 opacity-40 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">Ningún grado seleccionado</p>
                        <p className="text-sm mt-1 text-gray-400">Activa un grado en la pestaña de "Unidades de Descarga" para ver sus datos.</p>
                    </div>
                ) : (
                    gradeEntries.map(grade => (
                        <GradeTable
                            key={grade} grade={grade} rows={persistentData[grade] ?? []}
                            isEdit={isEdit}
                            onUpdateRow={handleUpdateRow}
                            onDeleteRow={handleDeleteRow}
                            onAddRow={handleAddRow}
                        />
                    ))
                )}
            </main>
        </div>
    );
}