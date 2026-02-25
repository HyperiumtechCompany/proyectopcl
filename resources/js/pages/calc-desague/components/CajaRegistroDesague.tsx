import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
    GradeKey, CajaRegistroRow, CajaRegistroState, ResumenItem, TabDesagueProps,
} from '@/types/desague';

// ─── Config ───────────────────────────────────────────────────────────────────

interface DimensionEntry { valor: number; value: string; label: string }

const DIMENSION_CONFIG = {
    thresholds: [0.61, 0.81, 1.01, 1.21],
    dimensions: [
        { valor: 0.61, value: '0.25m x 0.50m (10" x 20")', label: 'C.R.' },
        { valor: 0.81, value: '0.30m x 0.60m (12" x 24")', label: 'C.R.' },
        { valor: 1.01, value: '0.45m x 0.60m (18" x 24")', label: 'C.R.' },
        { valor: 1.21, value: '0.60m x 0.60m (24" x 24")', label: 'C.R.' },
    ] as DimensionEntry[],
    extra: ['D=1.20m', '0.50m x 0.80m x 0.50m'],
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStaticRows(grade: GradeKey): CajaRegistroRow[] {
    return [
        { id: `static_${grade}_buzon`, tramocajalabel: 'B.z', tramocajavalue: 18, ctcaja: 0.00, cfcaja: -1.40, hcaja: 1.40, dimensionescaja: 'D=1.20m', isStatic: true },
        { id: `static_${grade}_final`, tramocajalabel: 'CAJA DE REGISTRO FINAL', tramocajavalue: '', ctcaja: -0.35, cfcaja: -1.50, hcaja: 1.15, dimensionescaja: '0.60m x 0.60m (24" x 24")', isStatic: true },
        { id: `static_${grade}_conc`, tramocajalabel: 'CONC.', tramocajavalue: '', ctcaja: -0.10, cfcaja: -0.30, hcaja: 0.20, dimensionescaja: '0.50m x 0.80m x 0.50m', isStatic: true },
    ];
}

function calculateDimension(height: number): string {
    if (height === 0) return '';
    for (let i = 0; i < DIMENSION_CONFIG.thresholds.length; i++) {
        if (height < DIMENSION_CONFIG.thresholds[i]) return DIMENSION_CONFIG.dimensions[i].value;
    }
    return DIMENSION_CONFIG.dimensions[DIMENSION_CONFIG.dimensions.length - 1].value;
}

function transformColectorData(
    gradeData: any[],
    grade: GradeKey,
    existingData: CajaRegistroRow[]
): CajaRegistroRow[] {
    return gradeData.map((item, index) => {
        const id = `${grade}_cr_${item.id ?? index}`;
        const existing = existingData.find(e => e.id === id) ?? {} as Partial<CajaRegistroRow>;
        return {
            id,
            tramocajalabel: item.cr1_num ?? 'C.R.',
            tramocajavalue: item.cr1_nval !== undefined ? item.cr1_nval : index + 1,
            ctcaja: existing.ctcaja !== undefined ? existing.ctcaja : (parseFloat(item.cr1_ct) || 0),
            cfcaja: existing.cfcaja !== undefined ? existing.cfcaja : (parseFloat(item.cr1_cf) || 0),
            hcaja: existing.hcaja !== undefined ? existing.hcaja : (parseFloat(item.cr1_h) || 0),
            dimensionescaja: existing.dimensionescaja !== undefined
                ? existing.dimensionescaja
                : (item.cr1_dim || calculateDimension(Math.abs(parseFloat(item.cr1_h) || 0))),
            isStatic: false,
        };
    });
}

function generateResumenData(rows: CajaRegistroRow[]): ResumenItem[] {
    const summary: ResumenItem[] = [
        { descripcioncaja: 'CAJA DE REGISTRO ', tipo: '0.25m x 0.50m (10" x 20")', cantidad: 0 },
        { descripcioncaja: 'CAJA DE REGISTRO ', tipo: '0.30m x 0.60m (12" x 24")', cantidad: 0 },
        { descripcioncaja: 'CAJA DE REGISTRO ', tipo: '0.45m x 0.60m (18" x 24")', cantidad: 0 },
        { descripcioncaja: 'CAJA DE REGISTRO ', tipo: '0.60m x 0.60m (24" x 24")', cantidad: 0 },
        { descripcioncaja: 'BUZON', tipo: 'D=1.20m', cantidad: 0 },
        { descripcioncaja: 'FINAL', tipo: '0.60m x 0.60m (24" x 24")', cantidad: 0 },
        { descripcioncaja: 'CONC.', tipo: '0.50m x 0.80m x 0.50m', cantidad: 0 },
    ];
    const validDims = [
        '0.25m x 0.50m (10" x 20")', '0.30m x 0.60m (12" x 24")',
        '0.45m x 0.60m (18" x 24")', '0.60m x 0.60m (24" x 24")',
    ];

    rows.forEach(row => {
        const dim = (row.dimensionescaja || '').trim();
        const label = (row.tramocajalabel || '').trim();
        if (!dim) return;

        if (dim === 'D=1.20m') {
            const r = summary.find(s => s.descripcioncaja === 'BUZON');
            if (r) r.cantidad++;
        } else if (dim === '0.50m x 0.80m x 0.50m') {
            const r = summary.find(s => s.descripcioncaja === 'CONC.');
            if (r) r.cantidad++;
        } else if (dim === '0.60m x 0.60m (24" x 24")' && (label.includes('FINAL') || label === 'CAJA DE REGISTRO FINAL')) {
            const r = summary.find(s => s.descripcioncaja === 'FINAL');
            if (r) r.cantidad++;
        } else if (validDims.includes(dim)) {
            const r = summary.find(s => s.descripcioncaja === 'CAJA DE REGISTRO ' && s.tipo === dim);
            if (r) r.cantidad++;
        }
    });
    return summary;
}

function fmtNum(value: number | string, decimals = 2): string {
    if (typeof value === 'number') return value.toFixed(decimals);
    return value !== undefined && value !== null ? String(value) : '0.00';
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

interface EditableCellProps {
    value: string | number;
    editable: boolean;
    type?: string;
    options?: string[];
    onChange: (v: string) => void;
}

function EditableCell({ value, editable, type = 'text', options, onChange }: EditableCellProps) {
    const [editing, setEditing] = useState(false);
    const [localVal, setLocalVal] = useState(String(value ?? ''));
    const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    useEffect(() => { setLocalVal(String(value ?? '')); }, [value]);
    useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const commit = (v: string) => { setEditing(false); onChange(v); };

    if (!editable) return <span className="block px-2 py-1 text-sm text-black dark:text-gray-100 font-semibold">{value}</span>;

    if (editing) {
        if (options) {
            return (
                <select
                    ref={inputRef as React.RefObject<HTMLSelectElement>}
                    value={localVal}
                    className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-blue-50 focus:ring-2 focus:ring-blue-300 outline-none text-black"
                    onChange={e => setLocalVal(e.target.value)}
                    onBlur={() => commit(localVal)}
                >
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            );
        }
        return (
            <input
                ref={inputRef as React.RefObject<HTMLInputElement>} type={type} value={localVal}
                className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-blue-50 focus:ring-2 focus:ring-blue-300 outline-none min-w-[60px] text-black"
                onChange={e => setLocalVal(e.target.value)}
                onBlur={() => commit(localVal)}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'Tab') commit(localVal);
                    else if (e.key === 'Escape') { setEditing(false); setLocalVal(String(value ?? '')); }
                }}
            />
        );
    }
    return (
        <span
            className="block px-2 py-1 text-sm text-black dark:text-gray-100 font-semibold cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
            onDoubleClick={() => setEditing(true)}
            title="Doble clic para editar"
        >{value}</span>
    );
}

// ─── ResumenTable ─────────────────────────────────────────────────────────────

function ResumenTable({ rows }: { rows: CajaRegistroRow[] }) {
    const data = generateResumenData(rows);
    const total = data.reduce((acc, r) => acc + r.cantidad, 0);

    // Color mapping por tipo de caja (se usa para fondo y texto)
    const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
        '0.25m x 0.50m (10" x 20")': { bg: 'bg-blue-50 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' },
        '0.30m x 0.60m (12" x 24")': { bg: 'bg-indigo-50 dark:bg-indigo-900/50', text: 'text-indigo-800 dark:text-indigo-300' },
        '0.45m x 0.60m (18" x 24")': { bg: 'bg-teal-50 dark:bg-teal-900/50', text: 'text-teal-800 dark:text-teal-300' },
        '0.60m x 0.60m (24" x 24")': { bg: 'bg-amber-50 dark:bg-amber-900/50', text: 'text-amber-800 dark:text-amber-300' },
        'D=1.20m': { bg: 'bg-purple-50 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300' },
        '0.50m x 0.80m x 0.50m': { bg: 'bg-green-50 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
    };

    const getColorFor = (tipo: string) => TYPE_COLOR[tipo] ?? { bg: 'bg-gray-50 dark:bg-gray-900/50', text: 'text-gray-800 dark:text-gray-300' };

    return (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Resumen de Tipos de Cajas
            </h3>
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-200 dark:bg-gray-700">
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-black dark:text-gray-200 font-bold">TIPO DE CAJA DE REGISTRO</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-black dark:text-gray-200 font-bold">DIMENSIONES</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-black dark:text-gray-200 font-bold w-20">N°</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => {
                            const color = getColorFor(row.tipo);
                            return (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'}>
                                    <td className="border border-gray-200 dark:border-gray-600 px-3 py-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`${color.bg} ${color.text} inline-flex items-center justify-center w-4 h-4 rounded-full`} />
                                            <span className={`${color.text} font-bold`}>{row.descripcioncaja}</span>
                                        </div>
                                    </td>
                                    <td className="border border-gray-200 dark:border-gray-600 px-3 py-1.5">
                                        <span className={`${color.text} font-semibold`}>{row.tipo}</span>
                                    </td>
                                    <td className="border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-center">
                                        <span className="font-bold text-black dark:text-gray-100">{row.cantidad}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-200 dark:bg-gray-700">
                            <td colSpan={2} className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-right font-bold text-black dark:text-gray-200">TOTAL</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-center font-bold text-black dark:text-gray-100">{total}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

// ─── GradeTable ───────────────────────────────────────────────────────────────

interface GradeTableProps {
    grade: GradeKey;
    rows: CajaRegistroRow[];
    isEdit: boolean;
    onUpdateRow: (grade: GradeKey, id: string | number, updates: Partial<CajaRegistroRow>) => void;
}

function GradeTable({ grade, rows, isEdit, onUpdateRow }: GradeTableProps) {
    const config = GRADE_CONFIGS[grade];
    const staticRows = getStaticRows(grade);
    const allRows = [...(rows || []), ...staticRows];

    const dimOptions = [
        ...DIMENSION_CONFIG.dimensions.map(d => d.value),
        ...DIMENSION_CONFIG.extra,
    ];

    const handleChange = useCallback((row: CajaRegistroRow, field: string, rawVal: string) => {
        const updates: Partial<CajaRegistroRow> = {
            [field]: (field === 'ctcaja' || field === 'cfcaja') ? parseFloat(rawVal) || 0 : rawVal,
        };

        if (field === 'ctcaja' || field === 'cfcaja') {
            const ct = field === 'ctcaja' ? parseFloat(rawVal) || 0 : row.ctcaja;
            const cf = field === 'cfcaja' ? parseFloat(rawVal) || 0 : row.cfcaja;
            updates.hcaja = parseFloat((ct - cf).toFixed(2));
            updates.dimensionescaja = calculateDimension(Math.abs(ct - cf));
        }
        onUpdateRow(grade, row.id, updates);
    }, [grade, onUpdateRow]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            <div className={`px-6 py-4 ${GRADE_HEADER_CLASSES[grade]}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-xl font-bold text-white tracking-wide">
                        ANEXO 09. CAJAS DE REGISTRO — {config.title.toUpperCase()}
                    </h2>
                </div>
            </div>

            <div className="p-6 overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden" style={{ minWidth: 640 }}>
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                            {['N°', 'TRAMO', 'CT', 'CF', 'H', 'DIMENSIONES'].map((h, i) => (
                                <th key={i} className="border border-gray-300 dark:border-gray-500 px-3 py-2 text-black dark:text-gray-100 font-bold whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allRows.map((row, idx) => {
                            const isStaticRow = row.isStatic;
                            const rowClass = isStaticRow
                                ? 'bg-gray-100/80 dark:bg-gray-700 text-gray-500 dark:text-gray-300 italic'
                                : idx % 2 === 0 ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/80';
                            return (
                                <tr key={String(row.id)} className={`transition-colors ${rowClass}`}>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center text-black dark:text-gray-100 font-semibold">
                                        <span className="block px-2 py-1 text-sm">{row.tramocajalabel}</span>
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center text-black dark:text-gray-100 font-semibold">
                                        <span className="block px-2 py-1 text-sm">{row.tramocajavalue}</span>
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center">
                                        <EditableCell value={fmtNum(row.ctcaja)} editable={isEdit && !isStaticRow} type="number" onChange={v => handleChange(row, 'ctcaja', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center">
                                        <EditableCell value={fmtNum(row.cfcaja)} editable={isEdit && !isStaticRow} type="number" onChange={v => handleChange(row, 'cfcaja', v)} />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-center text-black dark:text-gray-100 font-semibold">
                                        <span className="block px-2 py-1 text-sm">{fmtNum(row.hcaja)}</span>
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 text-black dark:text-gray-100 font-semibold">
                                        <EditableCell value={row.dimensionescaja} editable={isEdit && !isStaticRow} options={dimOptions} onChange={v => handleChange(row, 'dimensionescaja', v)} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-6 pb-6">
                <ResumenTable rows={allRows} />
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CajaRegistroDesagueProps extends TabDesagueProps {
    colectorData?: Record<GradeKey, any[]>;
    udData?: { grades?: Record<GradeKey, boolean> };
}

export default function CajaRegistroDesague({ editMode, canEdit, initialData, onChange, colectorData, udData }: CajaRegistroDesagueProps) {
    const isEdit = !!(editMode && canEdit);
    const [persistentData, setPersistentData] = useState<CajaRegistroState>(() => initialData ?? {});

    // Active grades: driven by UdDesague grade selection (same source of truth as ColectorDesague)
    const activeGrades = useMemo<GradeKey[]>(() => {
        const g = udData?.grades;
        if (g) {
            // Only show grades that are both active in UD and have colector data
            return (Object.keys(GRADE_CONFIGS) as GradeKey[]).filter(gk => g[gk]);
        }
        // Fallback: derive from colectorData rows (old behaviour)
        return (Object.keys(GRADE_CONFIGS) as GradeKey[]).filter(
            gk => (colectorData?.[gk]?.length ?? 0) > 0
        );
    }, [udData, colectorData]);

    const computedData = useMemo<CajaRegistroState>(() => {
        const result: CajaRegistroState = { ...persistentData };
        if (!colectorData) return result;
        activeGrades.forEach(grade => {
            const sourceRows = colectorData[grade] ?? [];
            result[grade] = transformColectorData(sourceRows, grade, result[grade] ?? []);
        });
        return result;
    }, [colectorData, persistentData, activeGrades]);

    const persistChange = useCallback((newData: CajaRegistroState) => {
        setPersistentData(newData);
        onChange?.(newData);
    }, [onChange]);

    const handleUpdateRow = useCallback((grade: GradeKey, id: string | number, updates: Partial<CajaRegistroRow>) => {
        const newData: CajaRegistroState = {
            ...computedData,
            [grade]: (computedData[grade] ?? []).map(row => row.id === id ? { ...row, ...updates } : row),
        };
        persistChange(newData);
    }, [computedData, persistChange]);

    return (
        <div className="w-full min-h-screen bg-transparent p-4 md:p-6 pb-24">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 shadow-xl text-white">
                <h1 className="text-xl md:text-2xl font-black mb-1">Cajas de Registro</h1>
                <p className="text-blue-100 text-sm opacity-90">Gestión de Datos Hidráulicos</p>
            </div>

            {isEdit && (
                <div className="mb-4">
                    <div className="flex items-center space-x-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-2 text-sm text-orange-700 dark:text-orange-300">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Modo edición activo — Doble clic en CT/CF para editar; clic en DIMENSIONES para seleccionar.</span>
                    </div>
                </div>
            )}

            <main>
                {activeGrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">Ningún grado seleccionado en Colector</p>
                        <p className="text-sm mt-1 text-gray-400">Las cajas de registro dependen del colector.</p>
                    </div>
                ) : (
                    activeGrades.map(grade => (
                        <GradeTable
                            key={grade} grade={grade} rows={computedData[grade] ?? []}
                            isEdit={isEdit} onUpdateRow={handleUpdateRow}
                        />
                    ))
                )}
            </main>
        </div>
    );
}