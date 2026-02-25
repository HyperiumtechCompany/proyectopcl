import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
    GradeKey, UvDimensionRow, UvGradeRow, UvAccessory, TabDesagueProps,
} from '@/types/desague';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = (): string => crypto.randomUUID();
const deepClone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

function calcDiametroVentilacion(ud: number): string {
    if (ud < 100) return '2"';
    if (ud < 500) return '3"';
    if (ud < 1000) return '6"';
    return '≥6"';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADES: Record<GradeKey, string> = {
    inicial: 'INICIAL', primaria: 'PRIMARIA', secundaria: 'SECUNDARIA',
};

const GRADE_HEADER_CLASSES: Record<GradeKey, string> = {
    inicial: 'bg-gradient-to-r from-emerald-700 to-teal-600',
    primaria: 'bg-gradient-to-r from-blue-700 to-indigo-600',
    secundaria: 'bg-gradient-to-r from-purple-700 to-violet-600',
};

const DEFAULT_ACCESORIOS: UvAccessory[] = [
    { key: 'inodoro', label: 'INODORO', totalCategoryCount: 6.0 },
    { key: 'urinario', label: 'URINARIO', totalCategoryCount: 4.0 },
    { key: 'lavatorio', label: 'LAVATORIO', totalCategoryCount: 1.5 },
    { key: 'ducha', label: 'DUCHA', totalCategoryCount: 2.0 },
    { key: 'lavadero', label: 'LAVADERO', totalCategoryCount: 3.0 },
    { key: 'sumidero', label: 'SUMIDERO', totalCategoryCount: 2.0 },
];

const SELECTABLE_OPTIONS: Record<string, number[]> = {
    inodoro: [2, 4, 8],
    urinario: [4, 8],
    lavatorio: [2],
    ducha: [3, 4],
    lavadero: [3],
    sumidero: [2]
};

const getMultiplier = (accKey: string, mults?: Record<string, number>) => {
    if (SELECTABLE_OPTIONS[accKey] && SELECTABLE_OPTIONS[accKey].length > 0) {
        return mults?.[accKey] ?? SELECTABLE_OPTIONS[accKey][0];
    }
    const acc = DEFAULT_ACCESORIOS.find(a => a.key === accKey);
    return acc ? acc.totalCategoryCount : 0;
};

const INITIAL_DIM_ROWS: UvDimensionRow[] = [
    { id: uid(), diametro: '2', tipo: 'pulg.', size2: '60', size3: '', size4: '' },
    { id: uid(), diametro: '2', tipo: 'pulg.', size2: '45', size3: '-', size4: '-' },
    { id: uid(), diametro: '3', tipo: 'pulg.', size2: '', size3: '100', size4: '' },
    { id: uid(), diametro: '3', tipo: 'pulg.', size2: '', size3: '75', size4: '-' },
    { id: uid(), diametro: '4', tipo: 'pulg.', size2: '', size3: '', size4: '150' },
    { id: uid(), diametro: '4', tipo: 'pulg.', size2: '', size3: '', size4: '100' },
];

function buildInitialGradeData(accesorios: UvAccessory[]): Record<GradeKey, UvGradeRow[]> {
    const accDefaults = (gk: GradeKey): Record<string, number> => {
        const seed: Record<string, number> = {};
        accesorios.forEach(a => { seed[`acc_${a.key}`] = 0; });
        if (gk === 'inicial') { seed['acc_lavatorio'] = 2; seed['acc_inodoro'] = 2; }
        if (gk === 'primaria') { seed['acc_lavatorio'] = 4; seed['acc_inodoro'] = 4; }
        if (gk === 'secundaria') { seed['acc_lavatorio'] = 6; seed['acc_inodoro'] = 6; }
        return seed;
    };

    const out: Record<GradeKey, UvGradeRow[]> = { inicial: [], primaria: [], secundaria: [] };
    (Object.keys(GRADES) as GradeKey[]).forEach(gk => {
        const child: UvGradeRow = {
            id: uid(), tipo: 'child', nivel: 'SS.HH. PRINCIPAL',
            descripcion: `Servicios higiénicos ${gk}`,
            totalUD: 0, diametroVentilacion: '2"',
            _children: [],
            ...accDefaults(gk),
        };
        const parent: UvGradeRow = {
            id: uid(), tipo: 'module',
            nivel: `MODULO SS.HH. ${gk.toUpperCase()}`,
            descripcion: `Servicios higiénicos nivel ${gk}`,
            totalUD: 0, diametroVentilacion: '3"',
            _children: [child],
            ...Object.fromEntries(accesorios.map(a => [`acc_${a.key}`, 0])),
        };
        out[gk] = [parent];
    });
    return out;
}

// ─── Calculation helpers ──────────────────────────────────────────────────────

function calcRowUD(row: UvGradeRow, accesorios: UvAccessory[], mults?: Record<string, number>): number {
    return accesorios.reduce((sum, acc) => sum + (Number(row[`acc_${acc.key}`] ?? 0) * getMultiplier(acc.key, mults)), 0);
}

function updateTotalsInPlace(items: UvGradeRow[], accesorios: UvAccessory[], mults?: Record<string, number>): void {
    items.forEach(item => {
        const ud = calcRowUD(item, accesorios, mults);
        item.totalUD = ud;
        item.diametroVentilacion = calcDiametroVentilacion(ud);
        if (item._children?.length) updateTotalsInPlace(item._children, accesorios, mults);
    });
}

// ─── Flat-row for table rendering ─────────────────────────────────────────────

interface FlatUvRow {
    row: UvGradeRow;
    path: string[];
    depth: number;
}

function flattenRows(rows: UvGradeRow[], path: string[] = [], depth = 0): FlatUvRow[] {
    const out: FlatUvRow[] = [];
    rows.forEach(r => {
        const myPath = [...path, String(r.id)];
        out.push({ row: r, path: myPath, depth });
        if (r._children?.length) out.push(...flattenRows(r._children, myPath, depth + 1));
    });
    return out;
}

// ─── Editable cell ────────────────────────────────────────────────────────────

interface CellInputProps {
    value: string | number;
    disabled?: boolean;
    type?: string;
    onChange?: (v: string) => void;
    className?: string;
}

const CellInput = React.memo(({ value, disabled, type = 'text', onChange, className = '' }: CellInputProps) => {
    const [draft, setDraft] = useState(String(value ?? ''));
    const focused = useRef(false);
    const prev = useRef(value);

    useEffect(() => {
        if (!focused.current && String(value ?? '') !== String(prev.current ?? '')) setDraft(String(value ?? ''));
        prev.current = value;
    }, [value]);

    return (
        <input
            type={type}
            step={type === 'number' ? 'any' : undefined}
            value={draft}
            disabled={disabled}
            className={[
                'w-full bg-transparent text-sm p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400',
                disabled
                    ? 'text-gray-700 dark:text-gray-300 cursor-default'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-text',
                className,
            ].join(' ')}
            onFocus={() => { focused.current = true; }}
            onBlur={() => { focused.current = false; }}
            onChange={e => { setDraft(e.target.value); onChange?.(e.target.value); }}
        />
    );
});
CellInput.displayName = 'CellInput';

// ─── Main component ───────────────────────────────────────────────────────────

interface UvDesagueProps extends TabDesagueProps {
    udData?: { grades?: Record<GradeKey, boolean>; tables?: Record<GradeKey, { multipliers?: Record<string, number> }> };
}

export default function UvDesague({ editMode, canEdit, initialData, onChange, udData }: UvDesagueProps) {
    const isEdit = !!(editMode && canEdit);

    const [accesorios] = useState<UvAccessory[]>(DEFAULT_ACCESORIOS);

    const [dimensionRows, setDimensionRows] = useState<UvDimensionRow[]>(
        () => initialData?.dimensionRows ?? deepClone(INITIAL_DIM_ROWS)
    );
    const [gradeData, setGradeData] = useState<Record<GradeKey, UvGradeRow[]>>(
        () => initialData?.gradeData ?? buildInitialGradeData(accesorios)
    );

    const udMultipliers = useMemo(() => {
        const m: Record<GradeKey, Record<string, number>> = { inicial: {}, primaria: {}, secundaria: {} };
        const tables = udData?.tables;
        if (tables) {
            (Object.keys(tables) as GradeKey[]).forEach(gk => {
                if (tables[gk]?.multipliers) {
                    m[gk] = tables[gk].multipliers!;
                }
            });
        }
        return m;
    }, [udData]);

    // Keep totals updated whenever accesorios change or udMultipliers change
    useEffect(() => {
        setGradeData(prev => {
            const next = deepClone(prev);
            (Object.keys(next) as GradeKey[]).forEach(g => updateTotalsInPlace(next[g], accesorios, udMultipliers[g]));
            return next;
        });
    }, [accesorios, udMultipliers]);

    // Notify parent on every change
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveOut = useRef(onChange);
    saveOut.current = onChange;
    useEffect(() => {
        clearTimeout(saveTimer.current!);
        saveTimer.current = setTimeout(() => {
            saveOut.current?.({ dimensionRows, gradeData });
        }, 400);
        return () => clearTimeout(saveTimer.current!);
    }, [dimensionRows, gradeData]);

    // Active grades from udData
    const activeGrades = useMemo<GradeKey[]>(() => {
        const g = udData?.grades ?? { inicial: true, primaria: false, secundaria: false };
        return (Object.keys(g) as GradeKey[]).filter(k => g[k]);
    }, [udData]);

    // ── Dimension rows handlers ───────────────────────────────────────────────
    const addDimRow = () =>
        setDimensionRows(prev => [...prev, { id: uid(), diametro: '', tipo: 'pulg.', size2: '', size3: '', size4: '' }]);

    const removeDimRow = (id: string) =>
        setDimensionRows(prev => prev.filter(r => r.id !== id));

    const updateDimRow = useCallback((id: string, field: keyof UvDimensionRow, val: string) =>
        setDimensionRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
        , []);

    // ── Grade data mutation helper ─────────────────────────────────────────────
    const mutGradeData = useCallback((
        grade: GradeKey,
        path: string[],
        fn: (row: UvGradeRow) => void
    ) => {
        setGradeData(prev => {
            const next = deepClone(prev);
            let current = next[grade];
            for (let i = 0; i < path.length - 1; i++) {
                const found = current.find(r => String(r.id) === path[i]);
                if (!found?._children) return prev;
                current = found._children;
            }
            const row = current.find(r => String(r.id) === path[path.length - 1]);
            if (row) { fn(row); updateTotalsInPlace(next[grade], accesorios, udMultipliers[grade]); }
            return next;
        });
    }, [accesorios, udMultipliers]);

    const handleAccChange = useCallback((grade: GradeKey, path: string[], accKey: string, val: string) => {
        mutGradeData(grade, path, row => { row[`acc_${accKey}`] = parseFloat(val) || 0; });
    }, [mutGradeData]);

    const handleNivelChange = useCallback((grade: GradeKey, path: string[], val: string) => {
        mutGradeData(grade, path, row => { row.nivel = val; });
    }, [mutGradeData]);

    const handleDescChange = useCallback((grade: GradeKey, path: string[], val: string) => {
        mutGradeData(grade, path, row => { row.descripcion = val; });
    }, [mutGradeData]);

    const addModuleRow = useCallback((grade: GradeKey) => {
        setGradeData(prev => {
            const next = deepClone(prev);
            const newMod: UvGradeRow = {
                id: uid(), tipo: 'module', nivel: 'NUEVO MÓDULO',
                descripcion: 'Descripción', totalUD: 0, diametroVentilacion: '',
                _children: [],
                ...Object.fromEntries(accesorios.map(a => [`acc_${a.key}`, 0])),
            };
            next[grade].push(newMod);
            return next;
        });
    }, [accesorios]);

    const addChildRow = useCallback((grade: GradeKey, path: string[]) => {
        setGradeData(prev => {
            const next = deepClone(prev);
            let current = next[grade];
            let target: UvGradeRow | undefined;
            for (let i = 0; i < path.length - 1; i++) {
                target = current.find(r => String(r.id) === path[i]);
                if (!target?._children) return prev;
                current = target._children;
            }
            target = current.find(r => String(r.id) === path[path.length - 1]);
            if (!target) return prev;
            const newChild: UvGradeRow = {
                id: uid(),
                tipo: target.tipo === 'module' ? 'child' : 'grandchild',
                nivel: 'NUEVO NIVEL', descripcion: 'Detalle',
                totalUD: 0, diametroVentilacion: '', _children: [],
                ...Object.fromEntries(accesorios.map(a => [`acc_${a.key}`, 0])),
            };
            (target._children = target._children ?? []).push(newChild);
            updateTotalsInPlace(next[grade], accesorios, udMultipliers[grade]);
            return next;
        });
    }, [accesorios, udMultipliers]);

    const deleteRow = useCallback((grade: GradeKey, path: string[]) => {
        if (!confirm('¿Eliminar esta fila y sus hijos?')) return;
        setGradeData(prev => {
            const next = deepClone(prev);
            let current = next[grade];
            for (let i = 0; i < path.length - 1; i++) {
                const found = current.find(r => String(r.id) === path[i]);
                if (!found?._children) return prev;
                current = found._children;
            }
            const idx = current.findIndex(r => String(r.id) === path[path.length - 1]);
            if (idx === -1) return prev;
            current.splice(idx, 1);
            updateTotalsInPlace(next[grade], accesorios, udMultipliers[grade]);
            return next;
        });
    }, [accesorios, udMultipliers]);

    // ── Render grade table ────────────────────────────────────────────────────
    const renderGradeTable = (grade: GradeKey) => {
        const flatRows = flattenRows(gradeData[grade] ?? []);

        return (
            <div key={grade} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
                <div className={`px-4 py-3 flex items-center justify-between ${GRADE_HEADER_CLASSES[grade]}`}>
                    <h3 className="text-base font-bold text-white">APARATOS VENTILADOS — {GRADES[grade]}</h3>
                    {isEdit && (
                        <button onClick={() => addModuleRow(grade)}
                            className="bg-white text-green-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-50 shadow-sm">
                            + Módulo
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border border-gray-200 dark:border-gray-700" style={{ minWidth: 700 }}>
                        <thead className="bg-gray-50 dark:bg-gray-900/60">
                            <tr>
                                {isEdit && <th className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-black dark:text-gray-300 font-bold w-16">Acc.</th>}
                                <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left text-black dark:text-gray-300 font-bold">Nivel</th>
                                <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left text-black dark:text-gray-300 font-bold w-48">Descripción</th>
                                {accesorios.map(a => {
                                    const currentMult = getMultiplier(a.key, udMultipliers[grade]);
                                    return (
                                        <th key={a.key} className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-center text-black dark:text-gray-300 font-bold min-w-[72px]">
                                            <div>{a.label}</div>
                                            <div className="text-emerald-500 text-[9px] font-semibold mt-0.5">
                                                ×{currentMult.toFixed(1)} UD
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-center text-blue-600 font-bold min-w-[72px]">Total UD</th>
                                <th className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-center text-teal-600 font-bold min-w-[60px]">Ø Vent.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {flatRows.map(({ row, path, depth }) => {
                                const isMod = row.tipo === 'module';
                                const rowBg = isMod
                                    ? 'bg-indigo-50/50 dark:bg-indigo-900/20'
                                    : depth === 2
                                        ? 'bg-gray-50/50 dark:bg-gray-800/40'
                                        : 'bg-white dark:bg-gray-800';
                                return (
                                    <tr key={String(row.id)} className={`transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/10 ${rowBg}`}>
                                        {isEdit && (
                                            <td className="border border-gray-100 dark:border-gray-700 px-1.5 py-1 text-center">
                                                <div className="flex gap-1 justify-center">
                                                    {row.tipo !== 'grandchild' && (
                                                        <button onClick={() => addChildRow(grade, path)}
                                                            className="w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold">+</button>
                                                    )}
                                                    <button onClick={() => deleteRow(grade, path)}
                                                        className="w-5 h-5 bg-red-400 hover:bg-red-500 text-white rounded text-xs font-bold">×</button>
                                                </div>
                                            </td>
                                        )}
                                        <td className="border border-gray-100 dark:border-gray-700 px-2 py-1"
                                            style={{ paddingLeft: `${depth * 16 + 8}px` }}>
                                            <CellInput value={row.nivel} disabled={!isEdit}
                                                className={isMod ? 'font-bold text-indigo-700 dark:text-indigo-300' : ''}
                                                onChange={v => handleNivelChange(grade, path, v)} />
                                        </td>
                                        <td className="border border-gray-100 dark:border-gray-700 px-2 py-1">
                                            <CellInput value={row.descripcion} disabled={!isEdit}
                                                onChange={v => handleDescChange(grade, path, v)} />
                                        </td>
                                        {accesorios.map(a => (
                                            <td key={a.key} className="border border-gray-100 dark:border-gray-700 px-1 py-1 text-center">
                                                {!isMod ? (
                                                    <CellInput
                                                        value={row[`acc_${a.key}`] ?? 0}
                                                        disabled={!isEdit}
                                                        type="number"
                                                        className="text-center font-mono font-semibold"
                                                        onChange={v => handleAccChange(grade, path, a.key, v)}
                                                    />
                                                ) : (
                                                    <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                                )}
                                            </td>
                                        ))}
                                        <td className="border border-gray-100 dark:border-gray-700 px-2 py-1 text-center bg-blue-50/40 dark:bg-blue-900/10">
                                            <span className={`font-bold tabular-nums ${row.totalUD > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-300 text-xs'}`}>
                                                {row.totalUD > 0 ? row.totalUD.toFixed(2) : '—'}
                                            </span>
                                        </td>
                                        <td className="border border-gray-100 dark:border-gray-700 px-2 py-1 text-center">
                                            <span className="font-semibold text-teal-700 dark:text-teal-300 text-xs">{row.diametroVentilacion}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-full mx-auto p-4 md:p-6 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 shadow-xl text-white">
                <h1 className="text-xl md:text-2xl font-black mb-1">ANEXO 10. Cálculo de las Ventilaciones</h1>
                <p className="text-blue-100 text-sm opacity-90">Sistema de cálculo para instituciones educativas</p>
            </div>

            {/* Dimension table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 mb-8 overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-5 py-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">DIMENSIONES DE LOS TUBOS DE VENTILACIÓN</h2>
                    {isEdit && (
                        <button onClick={addDimRow}
                            className="bg-white text-orange-600 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-orange-50 shadow-sm">
                            + Fila
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                {['DIÁMETRO DESAGÜE', 'TIPO', '2"', '3"', '4"'].map((h, i) => (
                                    <th key={i} className="px-4 py-2.5 text-left text-xs font-bold text-black dark:text-gray-300 uppercase">{h}</th>
                                ))}
                                {isEdit && <th className="px-4 py-2.5 w-12" />}
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                            {dimensionRows.map(row => (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    {(['diametro', 'tipo', 'size2', 'size3', 'size4'] as (keyof UvDimensionRow)[]).map(f => (
                                        <td key={f} className="px-4 py-1.5">
                                            {isEdit ? (
                                                <CellInput value={row[f]} disabled={false}
                                                    onChange={v => updateDimRow(row.id, f, v)} />
                                            ) : (
                                                <span className="text-black dark:text-gray-100 font-medium">{row[f]}</span>
                                            )}
                                        </td>
                                    ))}
                                    {isEdit && (
                                        <td className="px-2 py-1 text-center">
                                            <button onClick={() => removeDimRow(row.id)}
                                                className="text-red-400 hover:text-red-600 font-bold text-lg">×</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grade tables */}
            {activeGrades.length > 0 ? (
                <div>
                    <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-5">Cálculos por Grado Educativo</h2>
                    {activeGrades.map(grade => renderGradeTable(grade))}
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-black text-gray-700 dark:text-gray-200 mb-2">Seleccione Grados Educativos</h3>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto">
                        Active un grado en la pestaña "Unidades de Descarga" para ver sus cálculos de ventilación.
                    </p>
                </div>
            )}
        </div>
    );
}