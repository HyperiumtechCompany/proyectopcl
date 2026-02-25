import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type {
    GradeKey, AnexoRow, UdColumn, UdTableNode, UdGradeTable, UdState, TabDesagueProps,
} from '@/types/desague';

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const deepClone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36);
const toNum = (v: unknown): number => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(String(v).replace(',', '.').trim());
    return isFinite(n) ? n : 0;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const GRADES: Record<GradeKey, { name: string; desc: string }> = {
    inicial: { name: 'INICIAL', desc: 'Educación Inicial (3-5 años)' },
    primaria: { name: 'PRIMARIA', desc: 'Educación Primaria (6-11 años)' },
    secundaria: { name: 'SECUNDARIA', desc: 'Educación Secundaria (12-16 años)' },
};

const APARATO_COL: Record<string, string> = {
    inodoro: 'inodoro', urinario: 'urinario', lavatorio: 'lavatorio',
    lavadero: 'lavadero', lavadero_con_triturador: 'lavadero',
    ducha: 'ducha', tina: 'ducha', bebedero: 'lavatorio', sumidero: 'sumidero',
};

const INITIAL_ANEXO: AnexoRow[] = [
    { id: uid(), aparato: 'Inodoro', tipo: 'Con Tanque - Descarga reducida', ud: 2 },
    { id: uid(), aparato: 'Inodoro', tipo: 'Con Tanque', ud: 4 },
    { id: uid(), aparato: 'Inodoro', tipo: 'C/ Válvula semiautomática y automática', ud: 8 },
    { id: uid(), aparato: 'Inodoro', tipo: 'C/ Válvula semiaut. desc. reducida', ud: 4 },
    { id: uid(), aparato: 'Lavatorio', tipo: 'Corriente', ud: 2 },
    { id: uid(), aparato: 'Lavadero', tipo: 'Cocina, ropa', ud: 2 },
    { id: uid(), aparato: 'Lavadero con triturador', tipo: '-', ud: 3 },
    { id: uid(), aparato: 'Ducha', tipo: '-', ud: 3 },
    { id: uid(), aparato: 'Tina', tipo: '-', ud: 3 },
    { id: uid(), aparato: 'Urinario', tipo: 'Con Tanque', ud: 4 },
    { id: uid(), aparato: 'Urinario', tipo: 'C/ Válvula semiautomática y automática', ud: 8 },
    { id: uid(), aparato: 'Urinario', tipo: 'C/ Válvula semiaut. desc. reducida', ud: 4 },
    { id: uid(), aparato: 'Urinario', tipo: 'Múltiple', ud: 4 },
    { id: uid(), aparato: 'Bebedero', tipo: 'Simple', ud: 2 },
    { id: uid(), aparato: 'Sumidero', tipo: 'Simple', ud: 2 },
];

// ─── Derived column definitions from Anexo ────────────────────────────────────
const PREFERRED_ORDER = ['inodoro', 'urinario', 'lavatorio', 'ducha', 'lavadero', 'sumidero'];

const buildCols = (anexo: AnexoRow[]): UdColumn[] => {
    const map: Record<string, UdColumn> = {};
    anexo.forEach(row => {
        const norm = String(row.aparato || '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
        const key = APARATO_COL[norm] || norm;
        if (!map[key]) {
            map[key] = {
                key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                udValue: 0,
            };
        }
        map[key].udValue += toNum(row.ud);
    });
    const cols = Object.values(map);
    cols.sort((a, b) => {
        const indexA = PREFERRED_ORDER.indexOf(a.key);
        const indexB = PREFERRED_ORDER.indexOf(b.key);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.key.localeCompare(b.key);
    });
    return cols;
};

const SELECTABLE_OPTIONS: Record<string, number[]> = {
    inodoro: [2, 4, 8],
    urinario: [4, 8],
    lavatorio: [2],
    ducha: [3, 4],
    lavadero: [3],
    sumidero: [2]
};

const getMultiplier = (col: UdColumn, mults?: Record<string, number>) => {
    if (SELECTABLE_OPTIONS[col.key] && SELECTABLE_OPTIONS[col.key].length > 0) {
        return mults?.[col.key] ?? SELECTABLE_OPTIONS[col.key][0];
    }
    return col.udValue;
};

// ─── Calculation (pure functions) ─────────────────────────────────────────────
const rowTotal = (node: UdTableNode, cols: UdColumn[], mults?: Record<string, number>): number =>
    cols.reduce((sum, col) => sum + toNum(node.qty?.[col.key]) * getMultiplier(col, mults), 0);

const moduleTotal = (mod: UdTableNode, cols: UdColumn[], mults?: Record<string, number>): number => {
    let t = 0;
    (mod.details || []).forEach(r => { t += rowTotal(r, cols, mults); });
    (mod.children || []).forEach(ch => {
        t += rowTotal(ch, cols, mults);
        (ch.details || []).forEach(gd => { t += rowTotal(gd, cols, mults); });
    });
    return t;
};

const gradeTotal = (gradeData: UdGradeTable | undefined, cols: UdColumn[]): number =>
    (gradeData?.modules || []).reduce((s, m) => s + moduleTotal(m, cols, gradeData?.multipliers), 0);

// ─── Initial state builder ────────────────────────────────────────────────────
const buildState = (data: any): UdState => {
    const grades: Record<GradeKey, boolean> = deepClone(
        data?.grades || { inicial: true, primaria: false, secundaria: false }
    );
    const anexo: AnexoRow[] = deepClone(data?.anexo || INITIAL_ANEXO);
    const tables: Record<GradeKey, UdGradeTable> = deepClone(
        data?.tables || { inicial: { modules: [] }, primaria: { modules: [] }, secundaria: { modules: [] } }
    );

    (Object.keys(grades) as GradeKey[]).forEach(gk => {
        if (!grades[gk]) return;
        if (!tables[gk]) tables[gk] = { modules: [], multipliers: {} };
        if (!tables[gk].modules.length) {
            tables[gk].modules.push({
                id: uid(), name: 'MÓDULO 1',
                details: [{ id: uid(), nivel: 'NIVEL', desc: 'Descripción del Nivel/Aula', qty: {} }],
                children: [],
                qty: {},
            });
        }
    });
    return { grades, anexo, tables };
};

// ─── CellInput ────────────────────────────────────────────────────────────────
interface CellInputProps {
    value: string | number;
    onChange?: (v: string) => void;
    disabled?: boolean;
    type?: string;
    align?: 'left' | 'center';
    className?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    min?: string | number;
}

const CellInput = React.memo(({
    value, onChange, disabled, type = 'text', align = 'left', className = '', inputMode, min,
}: CellInputProps) => {
    const [draft, setDraft] = useState(String(value ?? ''));
    const isFocusedRef = useRef(false);
    const prevValueRef = useRef(value);

    useEffect(() => {
        if (!isFocusedRef.current && String(value ?? '') !== String(prevValueRef.current ?? '')) {
            setDraft(String(value ?? ''));
        }
        prevValueRef.current = value;
    }, [value]);

    return (
        <input
            type={type}
            value={draft}
            inputMode={inputMode}
            min={min}
            step={type === 'number' ? 'any' : undefined}
            disabled={disabled}
            className={[
                'w-full bg-transparent text-sm p-1.5 rounded',
                'focus:outline-none focus:ring-2 focus:ring-blue-400',
                align === 'center' ? 'text-center' : 'text-left',
                disabled
                    ? 'text-gray-500 dark:text-gray-400 cursor-default'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-text',
                className,
            ].filter(Boolean).join(' ')}
            onFocus={() => { isFocusedRef.current = true; }}
            onBlur={() => { isFocusedRef.current = false; }}
            onChange={e => {
                const v = e.target.value;
                setDraft(v);
                onChange?.(v);
            }}
        />
    );
});
CellInput.displayName = 'CellInput';

// ─── Flat row type for rendering ──────────────────────────────────────────────
interface FlatRow {
    type: 'module' | 'detail' | 'child' | 'grandchild';
    nodeId: string;
    modId: string;
    parentId?: string;
    node: UdTableNode;
    indent: number;
}

// ─── Main component ───────────────────────────────────────────────────────────
interface UdDesagueProps extends TabDesagueProps {
    udData?: any;
}

export default function UdDesague({ editMode, canEdit, initialData, onChange }: UdDesagueProps) {
    const isEdit = !!(editMode && canEdit);
    const [st, setSt] = useState<UdState>(() => buildState(initialData));

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveOut = useRef(onChange);
    saveOut.current = onChange;

    useEffect(() => {
        clearTimeout(saveTimer.current!);
        saveTimer.current = setTimeout(() => {
            saveOut.current?.({ grades: st.grades, anexo: st.anexo, tables: st.tables });
            const cols = buildCols(st.anexo);
            document.dispatchEvent(new CustomEvent('uddesague-data-updated', {
                detail: { accesorios: cols.length ? cols : [{ key: 'default', label: 'Default', udValue: 1 }] },
            }));
            document.dispatchEvent(new CustomEvent('grade-changed', { detail: st.grades }));
        }, 400);
        return () => clearTimeout(saveTimer.current!);
    }, [st]);

    const mut = useCallback((fn: (prev: UdState) => UdState) => setSt(prev => fn(deepClone(prev))), []);

    const cols = useMemo(() => buildCols(st.anexo), [st.anexo]);
    const activeGrades = useMemo(
        () => (Object.keys(st.grades) as GradeKey[]).filter(g => st.grades[g]),
        [st.grades]
    );
    const allGradesTotal = useMemo(
        () => activeGrades.reduce((s, g) => s + gradeTotal(st.tables[g], cols), 0),
        [activeGrades, st.tables, cols]
    );

    // ── Handlers: grade ────────────────────────────────────────────────────────
    const toggleGrade = (gk: GradeKey) => mut(next => {
        next.grades[gk] = !next.grades[gk];
        if (next.grades[gk]) {
            if (!next.tables[gk]) next.tables[gk] = { modules: [], multipliers: {} };
            if (!next.tables[gk].modules.length) {
                next.tables[gk].modules.push({
                    id: uid(), name: 'MÓDULO 1', qty: {},
                    details: [{ id: uid(), nivel: 'NIVEL', desc: 'Descripción del Nivel/Aula', qty: {} }],
                    children: [],
                });
            }
        }
        return next;
    });

    const setMultiplier = (gk: GradeKey, colKey: string, val: string) => mut(next => {
        if (!next.tables[gk].multipliers) next.tables[gk].multipliers = {};
        next.tables[gk].multipliers![colKey] = toNum(val);
        return next;
    });

    // ── Handlers: Anexo ────────────────────────────────────────────────────────
    const editAnexo = (id: string, field: keyof AnexoRow, val: string) => mut(next => {
        const row = next.anexo.find(r => r.id === id);
        if (row) (row as any)[field] = field === 'ud' ? toNum(val) : val;
        return next;
    });
    const addAnexoRow = () => mut(next => {
        next.anexo.push({ id: uid(), aparato: 'Nuevo Aparato', tipo: '-', ud: 1 });
        return next;
    });
    const delAnexoRow = (id: string) => {
        if (!confirm('¿Eliminar este aparato?')) return;
        mut(next => { next.anexo = next.anexo.filter(r => r.id !== id); return next; });
    };

    // ── Handlers: table nodes ──────────────────────────────────────────────────
    const findAndApply = (grade: UdGradeTable, nodeId: string, fn: (n: UdTableNode) => void) => {
        for (const mod of grade.modules || []) {
            if (mod.id === nodeId) { fn(mod); return; }
            for (const d of mod.details || []) { if (d.id === nodeId) { fn(d); return; } }
            for (const ch of mod.children || []) {
                if (ch.id === nodeId) { fn(ch); return; }
                for (const gd of ch.details || []) { if (gd.id === nodeId) { fn(gd); return; } }
            }
        }
    };

    const editNode = (gk: GradeKey, nodeId: string, field: string, val: string, isQty = false) => mut(next => {
        findAndApply(next.tables[gk], nodeId, node => {
            if (isQty) {
                if (!node.qty) node.qty = {};
                node.qty[field] = val;
            } else {
                (node as any)[field] = val;
            }
        });
        return next;
    });

    const addModule = (gk: GradeKey) => mut(next => {
        const n = next.tables[gk].modules.length + 1;
        next.tables[gk].modules.push({
            id: uid(), name: `MÓDULO ${n}`, qty: {},
            details: [{ id: uid(), nivel: 'NIVEL', desc: 'Descripción', qty: {} }],
            children: [],
        });
        return next;
    });

    const addRow = (gk: GradeKey, flat: FlatRow) => mut(next => {
        const mod = next.tables[gk].modules.find(m => m.id === flat.modId);
        if (!mod) return next;
        if (flat.type === 'module') {
            (mod.children = mod.children || []).push(
                { id: uid(), nivel: 'SUB-NIVEL', desc: 'Descripción', qty: {}, details: [] }
            );
        } else if (flat.type === 'detail') {
            (mod.details = mod.details || []).push(
                { id: uid(), nivel: 'NIVEL', desc: 'Descripción', qty: {} }
            );
        } else if (flat.type === 'child') {
            const ch = (mod.children || []).find(c => c.id === flat.nodeId);
            if (ch) (ch.details = ch.details || []).push(
                { id: uid(), desc: 'Descripción', qty: {} }
            );
        }
        return next;
    });

    const delRow = (gk: GradeKey, flat: FlatRow) => {
        if (!confirm('¿Eliminar esta fila?')) return;
        mut(next => {
            const gr = next.tables[gk];
            const mod = gr.modules.find(m => m.id === flat.modId);
            if (flat.type === 'module') {
                gr.modules = gr.modules.filter(m => m.id !== flat.nodeId);
            } else if (flat.type === 'detail') {
                if (mod) mod.details = (mod.details || []).filter(d => d.id !== flat.nodeId);
            } else if (flat.type === 'child') {
                if (mod) mod.children = (mod.children || []).filter(c => c.id !== flat.nodeId);
            } else if (flat.type === 'grandchild') {
                const ch = (mod?.children || []).find(c => c.id === flat.parentId);
                if (ch) ch.details = (ch.details || []).filter(gd => gd.id !== flat.nodeId);
            }
            return next;
        });
    };

    // ── Grade table renderer ───────────────────────────────────────────────────
    const GradeTable = ({ gk, info }: { gk: GradeKey; info: { name: string } }) => {
        const grade = st.tables[gk];
        if (!grade?.modules) return null;

        const rows: FlatRow[] = [];
        grade.modules.forEach(mod => {
            rows.push({ type: 'module', nodeId: mod.id, modId: mod.id, node: mod, indent: 0 });
            (mod.details || []).forEach(d =>
                rows.push({ type: 'detail', nodeId: d.id, modId: mod.id, node: d, indent: 1 })
            );
            (mod.children || []).forEach(ch => {
                rows.push({ type: 'child', nodeId: ch.id, modId: mod.id, node: ch, indent: 1 });
                (ch.details || []).forEach(gd =>
                    rows.push({ type: 'grandchild', nodeId: gd.id, modId: mod.id, parentId: ch.id, node: gd, indent: 2 })
                );
            });
        });

        const gTotal = gradeTotal(grade, cols);
        const colSums = cols.map(col => {
            const currentMult = getMultiplier(col, grade.multipliers);
            const qtySum = rows
                .filter(r => r.type !== 'module')
                .reduce((s, r) => s + toNum(r.node.qty?.[col.key]), 0);
            return { key: col.key, qtySum, udSum: qtySum * currentMult };
        });

        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
                <div className="bg-gradient-to-r from-green-500 to-teal-600 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">Cálculos para {info.name}</h3>
                    {isEdit && (
                        <button onClick={() => addModule(gk)}
                            className="bg-white text-green-600 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors shadow-sm">
                            + Módulo
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full table-auto text-sm divide-y divide-gray-200 dark:divide-gray-700">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/70">
                                {isEdit && (
                                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 w-14 px-2 py-3 border-r dark:border-gray-700 text-xs font-bold text-black dark:text-gray-400 uppercase">
                                        Acc.
                                    </th>
                                )}
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-gray-300 uppercase w-32">Módulo</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-gray-300 uppercase w-36">Nivel</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-gray-300 uppercase w-52">Descripción</th>
                                {cols.map(col => {
                                    const hasOptions = SELECTABLE_OPTIONS[col.key] && SELECTABLE_OPTIONS[col.key].length > 0;
                                    const currentMult = getMultiplier(col, grade.multipliers);
                                    return (
                                        <th key={col.key}
                                            className="px-2 py-3 text-center text-xs font-bold text-black dark:text-gray-300 uppercase min-w-[88px] border-l border-gray-200 dark:border-gray-700">
                                            <div className="leading-tight">{col.label}</div>
                                            {isEdit && hasOptions ? (
                                                <select
                                                    value={currentMult}
                                                    onChange={e => setMultiplier(gk, col.key, e.target.value)}
                                                    className="w-full mt-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded px-1 py-0.5 focus:ring-1 focus:ring-emerald-500 outline-none"
                                                >
                                                    {SELECTABLE_OPTIONS[col.key].map(opt => (
                                                        <option key={opt} value={opt}>×{opt} UD</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="text-emerald-500 text-[10px] font-semibold normal-case mt-0.5">
                                                    ×{currentMult.toFixed(1)} UD
                                                </div>
                                            )}
                                        </th>
                                    );
                                })}
                                <th className="px-3 py-3 text-center text-xs font-extrabold text-blue-600 uppercase border-l-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 min-w-[90px]">
                                    Total<br />U.D.
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 bg-white dark:bg-gray-800">
                            {rows.map(flat => {
                                const isMod = flat.type === 'module';
                                const isLeaf = flat.type !== 'module';
                                const rTotal = isLeaf ? rowTotal(flat.node, cols, grade.multipliers) : moduleTotal(flat.node, cols, grade.multipliers);

                                return (
                                    <tr key={flat.nodeId}
                                        className={[
                                            'transition-colors',
                                            isMod
                                                ? 'bg-indigo-50/60 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/30',
                                        ].join(' ')}>

                                        {isEdit && (
                                            <td className={`sticky left-0 z-10 px-1.5 py-1 border-r dark:border-gray-700 text-center ${isMod ? 'bg-indigo-50 dark:bg-indigo-900/60' : 'bg-white dark:bg-gray-800'}`}>
                                                <div className="flex gap-1 justify-center">
                                                    {flat.type !== 'grandchild' && (
                                                        <button onClick={() => addRow(gk, flat)}
                                                            className="w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors">+</button>
                                                    )}
                                                    <button onClick={() => delRow(gk, flat)}
                                                        className="w-5 h-5 bg-red-400 hover:bg-red-500 text-white rounded text-xs font-bold transition-colors">×</button>
                                                </div>
                                            </td>
                                        )}

                                        <td className="px-2 py-1">
                                            {isMod && (
                                                <CellInput value={flat.node.name ?? ''} disabled={!isEdit}
                                                    className="font-bold text-indigo-700 dark:text-indigo-300"
                                                    onChange={v => editNode(gk, flat.nodeId, 'name', v)} />
                                            )}
                                        </td>

                                        <td className="px-2 py-1" style={{ paddingLeft: `${flat.indent * 14 + 8}px` }}>
                                            {(flat.type === 'detail' || flat.type === 'child') && (
                                                <CellInput value={flat.node.nivel ?? ''} disabled={!isEdit}
                                                    onChange={v => editNode(gk, flat.nodeId, 'nivel', v)} />
                                            )}
                                        </td>

                                        <td className="px-2 py-1">
                                            {isMod
                                                ? <span className="text-xs italic text-gray-400 px-1">—</span>
                                                : <CellInput value={flat.node.desc ?? ''} disabled={!isEdit}
                                                    onChange={v => editNode(gk, flat.nodeId, 'desc', v)} />
                                            }
                                        </td>

                                        {cols.map(col => {
                                            const qty = flat.node.qty?.[col.key];
                                            const qtyNum = toNum(qty);
                                            const cellUD = qtyNum * getMultiplier(col, grade.multipliers);
                                            return (
                                                <td key={col.key}
                                                    className="px-1 py-1 border-l border-gray-100 dark:border-gray-700/50 text-center">
                                                    {isLeaf && (
                                                        <>
                                                            <CellInput
                                                                value={qty ?? ''}
                                                                disabled={!isEdit}
                                                                type="text"
                                                                inputMode="decimal"
                                                                align="center"
                                                                className={`font-mono font-semibold border rounded ${qtyNum > 0
                                                                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-900/10'
                                                                    : 'border-gray-200 dark:border-gray-600'
                                                                    }`}
                                                                onChange={v => editNode(gk, flat.nodeId, col.key, v, true)}
                                                            />
                                                            {cellUD > 0 && (
                                                                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold mt-0.5">
                                                                    ={cellUD.toFixed(1)}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                            );
                                        })}

                                        <td className="px-2 py-1 text-center border-l-2 border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10">
                                            <span className={`font-bold tabular-nums ${rTotal > 0
                                                ? isMod
                                                    ? 'text-blue-800 dark:text-blue-200 font-black text-base'
                                                    : 'text-blue-600 dark:text-blue-300'
                                                : 'text-gray-300 dark:text-gray-600 text-xs'
                                                }`}>
                                                {rTotal > 0 ? rTotal.toFixed(2) : '—'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600">
                            <tr>
                                <td colSpan={isEdit ? 4 : 3}
                                    className="px-4 py-3 text-right text-xs font-black text-black dark:text-gray-300 uppercase tracking-widest">
                                    Σ Total {info.name}
                                </td>
                                {colSums.map(cs => (
                                    <td key={cs.key}
                                        className="px-2 py-3 text-center border-l border-gray-200 dark:border-gray-700">
                                        <div className="text-xs font-bold text-black dark:text-gray-300 tabular-nums">
                                            {cs.qtySum > 0 ? cs.qtySum.toFixed(1) : '—'}
                                        </div>
                                        {cs.udSum > 0 && (
                                            <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                {cs.udSum.toFixed(1)} UD
                                            </div>
                                        )}
                                    </td>
                                ))}
                                <td className="px-3 py-3 text-center border-l-2 border-blue-300 dark:border-blue-700 bg-blue-100/50 dark:bg-blue-900/30">
                                    <span className="font-black text-blue-700 dark:text-blue-300 text-lg tabular-nums">
                                        {gTotal.toFixed(2)}
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    const anexoTotal = useMemo(() => st.anexo.reduce((s, r) => s + toNum(r.ud), 0), [st.anexo]);

    return (
        <div className="max-w-full mx-auto p-4 md:p-6 pb-24">
            {/* Page header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 shadow-xl text-white">
                <h1 className="text-xl md:text-2xl font-black mb-1">Unidades de Descarga (UD)</h1>
                <p className="text-blue-100 text-sm opacity-90">
                    Fórmula: Total fila = Σ (Cantidad<sub>col</sub> × UD_cabecera<sub>col</sub>)
                </p>
            </div>

            {/* Grade selector */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-gray-100 dark:border-gray-700">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4">Configuración de Grados</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(Object.entries(GRADES) as [GradeKey, { name: string; desc: string }][]).map(([gk, gi]) => (
                        <label key={gk} className={isEdit ? 'cursor-pointer select-none' : 'select-none'}>
                            <div className={`rounded-xl p-4 border-2 transition-all ${st.grades[gk]
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-sm'
                                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60'
                                } ${isEdit ? 'hover:shadow-md' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <input type="checkbox"
                                        checked={!!st.grades[gk]}
                                        onChange={() => isEdit && toggleGrade(gk)}
                                        disabled={!isEdit}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{gi.name}</div>
                                        <div className="text-xs text-gray-500">{gi.desc}</div>
                                        {st.grades[gk] && <div className="text-xs font-bold text-blue-600 mt-1">✓ Activo</div>}
                                    </div>
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Anexo-06 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 mb-8 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">
                        Anexo-06 — Valores U.D. por aparato (multiplicadores de cabecera)
                    </h2>
                    {isEdit && (
                        <button onClick={addAnexoRow}
                            className="bg-white text-orange-600 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-orange-50 shadow-sm transition-colors">
                            + Aparato
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-orange-50 dark:bg-orange-900/20">
                            <tr>
                                <th className="px-5 py-2.5 text-left text-xs font-bold text-black dark:text-orange-400 uppercase">Aparato Sanitario</th>
                                <th className="px-5 py-2.5 text-left text-xs font-bold text-black dark:text-orange-400 uppercase">Tipo</th>
                                <th className="px-5 py-2.5 text-center text-xs font-bold text-black dark:text-orange-400 uppercase w-32 border-l border-orange-200/50">
                                    U.D. / unidad
                                </th>
                                {isEdit && <th className="w-12" />}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {st.anexo.map(row => (
                                <tr key={row.id} className="hover:bg-orange-50/30 transition-colors">
                                    <td className="px-4 py-1">
                                        <CellInput value={row.aparato} disabled={!isEdit} className="font-medium"
                                            onChange={v => editAnexo(row.id, 'aparato', v)} />
                                    </td>
                                    <td className="px-4 py-1">
                                        <CellInput value={row.tipo} disabled={!isEdit}
                                            onChange={v => editAnexo(row.id, 'tipo', v)} />
                                    </td>
                                    <td className="px-4 py-1 border-l border-gray-100 dark:border-gray-700 bg-orange-50/20">
                                        <CellInput value={row.ud} disabled={!isEdit}
                                            type="number" min="0" align="center"
                                            className="font-bold text-orange-700 dark:text-orange-400"
                                            onChange={v => editAnexo(row.id, 'ud', v)} />
                                    </td>
                                    {isEdit && (
                                        <td className="px-2 py-1 text-center">
                                            <button onClick={() => delAnexoRow(row.id)}
                                                className="text-red-400 hover:text-red-600 text-lg font-bold transition-colors">×</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-700">
                            <tr>
                                <td colSpan={2}
                                    className="px-5 py-3 text-right font-black text-orange-800 dark:text-orange-400 text-xs uppercase tracking-widest">
                                    Total Anexo-06 =
                                </td>
                                <td className="px-5 py-3 text-center font-black text-orange-700 dark:text-orange-300 text-2xl tabular-nums border-l">
                                    {anexoTotal.toFixed(1)}
                                </td>
                                {isEdit && <td />}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Per-grade calculation tables */}
            {activeGrades.length > 0 ? (
                <div>
                    <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
                        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
                        </svg>
                        Cálculos por Grado
                    </h2>

                    {activeGrades.map(g => <GradeTable key={g} gk={g} info={GRADES[g]} />)}

                    {/* Summary */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl shadow-xl border-2 border-green-200/60 dark:border-green-800/60 p-6 md:p-8 mt-4">
                        <h2 className="text-lg font-black text-center text-gray-800 dark:text-gray-100 mb-6">
                            Informe Analítico General
                        </h2>
                        <div className={`grid grid-cols-1 gap-4 mb-8 ${activeGrades.length > 1 ? `sm:grid-cols-${activeGrades.length}` : ''}`}>
                            {activeGrades.map(g => {
                                const t = gradeTotal(st.tables[g], cols);
                                return (
                                    <div key={g} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md text-center border border-green-100 dark:border-green-800/40">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{GRADES[g].name}</div>
                                        <div className="text-4xl font-black text-green-600 dark:text-green-400 tabular-nums">{t.toFixed(2)}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">U.D.</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-green-200 dark:border-green-800/50 max-w-2xl mx-auto">
                            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 md:p-7 text-white text-center shadow-2xl ring-4 ring-blue-500/30 w-full md:w-52">
                                    <div className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">Total UD (Grados)</div>
                                    <div className="text-4xl md:text-5xl font-black tabular-nums">{allGradesTotal.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <svg className="mx-auto h-14 w-14 text-blue-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-lg font-black text-gray-700 dark:text-gray-200 mb-2">Seleccione Grados Educativos</h3>
                    <p className="text-gray-400 text-sm mb-5 max-w-xs mx-auto">
                        Active uno o más grados arriba para habilitar las tablas de cálculo.
                    </p>
                    {isEdit && (
                        <button onClick={() => toggleGrade('inicial')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors">
                            Habilitar Inicial
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}