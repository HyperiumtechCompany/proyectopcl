import type { ACUComponenteRow, ACURowSummary } from '@/types/presupuestos';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { DicEntry } from '../hooks/useDiccionario';
import type { DelphinRow } from '../types';
import { FormulaPolinomicaBuilder } from './FormulaPolinomicaBuilder';

// ── Insumo tipo ───────────────────────────────────────────────────────────────
const INSUMO_TIPOS = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'] as const;
type InsumoTipo = typeof INSUMO_TIPOS[number];

// ── Column widths (px) ────────────────────────────────────────────────────────
const C_IDX  = 44;    // #  + chevron
const C_DESC = 268;   // descripción
const C_UND  = 58;    // unidad
const C_CANT = 90;    // cantidad
const C_TOT  = 112;   // total S/
const C_INS  = 82;    // cada columna INEI

const L_DESC = C_IDX;
const L_UND  = L_DESC + C_DESC;
const L_CANT = L_UND  + C_UND;
const L_TOT  = L_CANT + C_CANT;

// Background colors para sticky cells (deben ser sólidos)
const BG_HEAD   = '#1e293b'; // slate-800
const BG_PARENT = '#172033'; // entre slate-800 y slate-900
const BG_LEAF   = '#020617'; // slate-950
const BG_FOOT1  = '#1e293b'; // fila total
const BG_FOOT2  = '#0f172a'; // fila coeficiente

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalize = (s: string) =>
    String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

function compParcial(tipo: InsumoTipo, comp: ACUComponenteRow): number {
    if (comp.parcial != null) return Number(comp.parcial);
    const cant   = Number(comp.cantidad ?? 0);
    const precio =
        tipo === 'equipos'
            ? Number(comp.precio_hora ?? comp.precio_unitario ?? 0)
            : Number(comp.precio_unitario ?? comp.precio_hora ?? 0);
    const fd = tipo === 'materiales' ? Math.max(1, Number(comp.factor_desperdicio ?? 1)) : 1;
    return cant * precio * fd;
}

const fmtS = (n: number) =>
    n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Returns all rows in parentId subtree in pre-order (parent first). */
function subtreePreorder(allRows: DelphinRow[], rootId: number): DelphinRow[] {
    const childrenOf = new Map<number, DelphinRow[]>();
    for (const r of allRows) {
        if (r.parent_id != null) {
            const pid = Number(r.parent_id);
            if (!childrenOf.has(pid)) childrenOf.set(pid, []);
            childrenOf.get(pid)!.push(r);
        }
    }
    for (const [, ch] of childrenOf) ch.sort((a, b) => (a.item_order ?? 0) - (b.item_order ?? 0));

    const result: DelphinRow[] = [];
    function visit(id: number) {
        const row = allRows.find((r) => r.id === id);
        if (row) result.push(row);
        for (const child of childrenOf.get(id) ?? []) visit(child.id);
    }
    visit(rootId);
    return result;
}

// ── Matrix builder ────────────────────────────────────────────────────────────
interface MatrixResult {
    /** rowId → (INEI code → S/ amount) */
    matrix: Map<number, Map<string, number>>;
    /** INEI codes sorted numerically */
    sortedCodes: string[];
    /** INEI code → description (first non-empty seen) */
    codeToDesc: Map<string, string>;
}

/**
 * Resolve the clean diccionario name for an ACU component.
 * Tries exact → prefix-of-first-word match within the same INEI code entries.
 */
function resolveCleanName(
    rawDesc: string,
    code: string,
    dicByCode: Map<string, string[]>,
): string {
    const entries = dicByCode.get(code);
    if (!entries?.length) return rawDesc;

    const normRaw  = normalize(rawDesc);
    const firstWord = normRaw.split(' ')[0];

    // 1. Exact normalized match
    for (const e of entries) {
        if (normalize(e) === normRaw) return e;
    }

    // 2. Prefix match: dicEntry (normalized) starts with the raw's first word,
    //    or the raw's first word starts with dicEntry's first word.
    //    This handles "Clavo T. 2x3/4" ↔ "Clavos" because
    //    normalize("Clavos").startsWith("clavo") === true.
    if (firstWord.length >= 3) {
        for (const e of entries) {
            const ne  = normalize(e);
            const fe  = ne.split(' ')[0];
            if (ne.startsWith(firstWord) || firstWord.startsWith(fe) || fe.startsWith(firstWord)) {
                return e;
            }
        }
    }

    // 3. Fallback — return the raw description unchanged
    return rawDesc;
}

function buildMatrix(
    subtree: DelphinRow[],
    acuRows: ACURowSummary[],
    parentIdSet: Set<number>,
    dicByCode: Map<string, string[]>,
): MatrixResult {
    const acuByPartida = new Map(acuRows.map((a) => [String(a.partida ?? ''), a]));
    const acuByDesc    = new Map(
        acuRows.filter((a) => a.descripcion).map((a) => [normalize(a.descripcion), a]),
    );

    const childrenOf = new Map<number, number[]>();
    for (const r of subtree) {
        if (r.parent_id != null) {
            const pid = Number(r.parent_id);
            if (!childrenOf.has(pid)) childrenOf.set(pid, []);
            childrenOf.get(pid)!.push(r.id);
        }
    }

    const codeToDesc = new Map<string, string>();
    const leafValues = new Map<number, Map<string, number>>();

    for (const row of subtree) {
        if (parentIdSet.has(row.id)) continue;
        const metrado = Number(row.metrado ?? 0);
        if (!metrado) continue;

        const acu =
            acuByPartida.get(String(row.partida ?? '')) ??
            acuByDesc.get(normalize(String(row.descripcion ?? '')));
        if (!acu) continue;

        const rowMap = new Map<string, number>();
        for (const tipo of INSUMO_TIPOS) {
            const comps: ACUComponenteRow[] =
                ((acu as unknown) as Record<string, ACUComponenteRow[]>)[tipo] ?? [];
            for (const comp of comps) {
                const rawCod = String(comp.cod_insumo ?? comp.codigo ?? '').trim();
                if (!rawCod) continue;
                // Normalize to 2-digit INEI code: "2" → "02", "39" stays "39"
                const n = parseInt(rawCod, 10);
                const codigo = !isNaN(n) ? String(n).padStart(2, '0') : rawCod;
                const amount = metrado * compParcial(tipo, comp);
                if (amount <= 0) continue;
                rowMap.set(codigo, (rowMap.get(codigo) ?? 0) + amount);
                // Store first clean name for each INEI code using diccionario lookup
                if (comp.descripcion && !codeToDesc.get(codigo)) {
                    codeToDesc.set(
                        codigo,
                        resolveCleanName(String(comp.descripcion).trim(), codigo, dicByCode),
                    );
                }
            }
        }
        if (rowMap.size > 0) leafValues.set(row.id, rowMap);
    }

    // Roll up parent values bottom-up
    const matrix = new Map<number, Map<string, number>>(leafValues);

    function accumulate(id: number): Map<string, number> {
        const cached = matrix.get(id);
        if (cached) return cached;
        const sum = new Map<string, number>();
        for (const childId of childrenOf.get(id) ?? []) {
            for (const [code, val] of accumulate(childId)) {
                sum.set(code, (sum.get(code) ?? 0) + val);
            }
        }
        matrix.set(id, sum);
        return sum;
    }
    for (const row of subtree) accumulate(row.id);

    // Sort INEI codes numerically
    const allCodes = new Set<string>();
    for (const m of matrix.values()) for (const c of m.keys()) allCodes.add(c);
    const sortedCodes = Array.from(allCodes).sort((a, b) => {
        const na = parseInt(a, 10), nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        if (!isNaN(na)) return -1;
        if (!isNaN(nb)) return  1;
        return a.localeCompare(b, 'es');
    });

    return { matrix, sortedCodes, codeToDesc };
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
    parentId:    number;
    rows:        DelphinRow[];
    acuRows:     ACURowSummary[];
    diccionario: DicEntry[];
    projectName: string;
    onBack:      () => void;
}

export function FormulaPolinomicaSplitView({ parentId, rows, acuRows, diccionario, projectName, onBack }: Props) {

    // Subtree en pre-order
    const subtree   = useMemo(() => subtreePreorder(rows, parentId), [rows, parentId]);
    const parentRow = useMemo(() => rows.find((r) => r.id === parentId), [rows, parentId]);
    const rootNivel = parentRow?.nivel ?? 1;

    // Set de IDs que son padres (tienen hijos)
    const parentIdSet = useMemo(() => {
        const s = new Set<number>();
        for (const r of rows) if (r.parent_id != null) s.add(Number(r.parent_id));
        return s;
    }, [rows]);

    // Diccionario: code → [clean names] para fuzzy matching.
    // Indexamos bajo la forma exacta del diccionario ("02") Y bajo el entero sin cero ("2")
    // porque los ACU importados de Delphin/S10 a veces omiten el cero inicial.
    const dicByCode = useMemo(() => {
        const m = new Map<string, string[]>();
        const add = (key: string, desc: string) => {
            if (!m.has(key)) m.set(key, []);
            m.get(key)!.push(desc);
        };
        for (const entry of diccionario) {
            add(entry.codigo, entry.descripcion);
            const numStr = String(parseInt(entry.codigo, 10));
            if (numStr !== entry.codigo) add(numStr, entry.descripcion);
        }
        return m;
    }, [diccionario]);

    // Mapa de insumos INEI por fila
    const { matrix, sortedCodes, codeToDesc } = useMemo(
        () => buildMatrix(subtree, acuRows, parentIdSet, dicByCode),
        [subtree, acuRows, parentIdSet, dicByCode],
    );

    // ── Expand / Collapse ─────────────────────────────────────────────────────
    const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
        // Inicializar todos los padres como expandidos
        const ps = new Set<number>();
        for (const r of rows) if (r.parent_id != null) ps.add(Number(r.parent_id));
        const sub = subtreePreorder(rows, parentId);
        return new Set(sub.filter((r) => ps.has(r.id)).map((r) => r.id));
    });

    // Cuando cambia el parentId, reiniciar estado
    useEffect(() => {
        const ps = new Set<number>();
        for (const r of rows) if (r.parent_id != null) ps.add(Number(r.parent_id));
        const sub = subtreePreorder(rows, parentId);
        setExpandedIds(new Set(sub.filter((r) => ps.has(r.id)).map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parentId]);

    const toggleExpand = useCallback((id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const expandAll  = useCallback(() =>
        setExpandedIds(new Set(subtree.filter((r) => parentIdSet.has(r.id)).map((r) => r.id))),
    [subtree, parentIdSet]);

    const collapseAll = useCallback(() =>
        setExpandedIds(new Set()),
    []);

    // rowById para navegación en visibleRows
    const rowById = useMemo(() => new Map(subtree.map((r) => [r.id, r])), [subtree]);

    // Filas visibles según estado de expansión (O(n·depth))
    const visibleRows = useMemo(() => {
        const skipping = new Set<number>();
        const result: DelphinRow[] = [];
        for (const row of subtree) {
            let pid: number | null = row.parent_id;
            let hidden = false;
            while (pid !== null) {
                if (skipping.has(pid)) { hidden = true; break; }
                pid = rowById.get(pid)?.parent_id ?? null;
            }
            if (!hidden) {
                result.push(row);
                if (parentIdSet.has(row.id) && !expandedIds.has(row.id)) {
                    skipping.add(row.id);
                }
            }
        }
        return result;
    }, [subtree, expandedIds, parentIdSet, rowById]);

    // ── Totales y coeficientes ────────────────────────────────────────────────
    // Total presupuesto del padre seleccionado (base para coeficiente de incidencia)
    const budgetTotal = Number(parentRow?.parcial ?? 0);
    const parentMap   = matrix.get(parentId) ?? new Map<string, number>();

    // Suma total cubierta por insumos con ACU
    const insumoTotalCovered = Array.from(parentMap.values()).reduce((s, v) => s + v, 0);
    const cobertura = budgetTotal > 0 ? insumoTotalCovered / budgetTotal : 0;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-900">

            {/* ── Cabecera ─────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                >
                    <ArrowLeft size={12} /> Volver
                </button>
                <div className="h-4 w-px shrink-0 bg-slate-700" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-amber-400">
                        {parentRow?.partida && (
                            <span className="mr-1.5 font-mono text-slate-500">{parentRow.partida}</span>
                        )}
                        {parentRow?.descripcion}
                    </p>
                    <p className="text-[10px] text-slate-500">{projectName}</p>
                </div>
                {/* Cobertura ACU */}
                <div className="shrink-0 text-right">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">ACU cubierto</p>
                    <p className={`font-mono text-xs font-semibold ${cobertura >= 0.95 ? 'text-emerald-300' : cobertura >= 0.7 ? 'text-amber-300' : 'text-red-400'}`}>
                        {(cobertura * 100).toFixed(1)}%
                    </p>
                </div>
                <div className="mx-1 h-4 w-px shrink-0 bg-slate-700" />
                <div className="shrink-0 text-right">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Total presupuesto</p>
                    <p className="font-mono text-xs font-semibold text-emerald-300">
                        S/ {fmtS(budgetTotal)}
                    </p>
                </div>
            </div>

            {/* ── Split vertical ───────────────────────────────────────────── */}
            <Group orientation="vertical" className="min-h-0 flex-1">

                {/* ═══ SUPERIOR: Tabla presupuesto + columnas INEI ═══════════ */}
                <Panel defaultSize={65} minSize={20} className="flex min-h-0 flex-col overflow-hidden">

                    {/* Barra de info + controles árbol */}
                    <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Incidencia de insumos por partida
                        </span>
                        <span className="rounded bg-sky-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300">
                            {sortedCodes.length} índ. INEI
                        </span>
                        <span className="ml-auto text-[9px] text-slate-600">DS 011-79-VC</span>
                        <div className="flex gap-1">
                            <button
                                onClick={expandAll}
                                title="Expandir todo"
                                className="flex items-center rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
                            >
                                <ChevronsUpDown size={11} />
                            </button>
                            <button
                                onClick={collapseAll}
                                title="Colapsar todo"
                                className="flex items-center rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
                            >
                                <ChevronsDownUp size={11} />
                            </button>
                        </div>
                    </div>

                    {/* Tabla con scroll horizontal */}
                    <div className="min-h-0 flex-1 overflow-auto">
                        <table
                            className="border-collapse text-[11px]"
                            style={{
                                minWidth: C_IDX + C_DESC + C_UND + C_CANT + C_TOT + sortedCodes.length * C_INS,
                            }}
                        >
                            {/* ─ THEAD ─────────────────────────────────────── */}
                            <thead className="sticky top-0 z-20">
                                <tr>
                                    {/* # */}
                                    <th style={{ position: 'sticky', left: 0, width: C_IDX, minWidth: C_IDX, zIndex: 30, backgroundColor: BG_HEAD }}
                                        className="border-b border-r border-slate-700 p-1.5 text-center text-[10px] font-semibold text-slate-400">
                                        #
                                    </th>
                                    {/* Descripción */}
                                    <th style={{ position: 'sticky', left: L_DESC, width: C_DESC, minWidth: C_DESC, zIndex: 30, backgroundColor: BG_HEAD }}
                                        className="border-b border-r border-slate-700 p-1.5 text-left text-[10px] font-semibold text-slate-400">
                                        Item / Descripción
                                    </th>
                                    {/* Und */}
                                    <th style={{ position: 'sticky', left: L_UND, width: C_UND, minWidth: C_UND, zIndex: 30, backgroundColor: BG_HEAD }}
                                        className="border-b border-r border-slate-700 p-1.5 text-center text-[10px] font-semibold text-slate-400">
                                        Und.
                                    </th>
                                    {/* Cantidad */}
                                    <th style={{ position: 'sticky', left: L_CANT, width: C_CANT, minWidth: C_CANT, zIndex: 30, backgroundColor: BG_HEAD }}
                                        className="border-b border-r border-slate-700 p-1.5 text-right text-[10px] font-semibold text-slate-400">
                                        Cantidad
                                    </th>
                                    {/* Total */}
                                    <th style={{ position: 'sticky', left: L_TOT, width: C_TOT, minWidth: C_TOT, zIndex: 30, backgroundColor: BG_HEAD }}
                                        className="border-b border-r border-slate-700 p-1.5 text-right text-[10px] font-semibold text-slate-400">
                                        Total (S/)
                                    </th>

                                    {/* Columnas INEI — horizontal, código arriba, texto abajo */}
                                    {sortedCodes.map((code) => {
                                        const desc = codeToDesc.get(code) ?? '';
                                        return (
                                            <th
                                                key={code}
                                                title={desc ? `${code} ${desc}` : code}
                                                style={{ width: C_INS, minWidth: C_INS, backgroundColor: BG_HEAD }}
                                                className="border-b border-r border-slate-700 p-1 align-top"
                                            >
                                                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                                                    <span className="text-[11px] font-bold tabular-nums text-sky-300">
                                                        {code}
                                                    </span>
                                                    {desc ? (
                                                        <span
                                                            className="text-center text-[8px] leading-tight text-slate-400"
                                                            style={{
                                                                maxWidth: C_INS - 6,
                                                                wordBreak: 'break-word',
                                                                overflowWrap: 'break-word',
                                                                whiteSpace: 'normal',
                                                            }}
                                                        >
                                                            {desc.length > 38 ? desc.slice(0, 38) + '…' : desc}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[8px] italic text-slate-600">—</span>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>

                            {/* ─ TBODY ─────────────────────────────────────── */}
                            <tbody>
                                {visibleRows.map((row, idx) => {
                                    const isGroup   = parentIdSet.has(row.id);
                                    const isExpanded = expandedIds.has(row.id);
                                    const rowMap    = matrix.get(row.id) ?? new Map<string, number>();
                                    const indent    = Math.max(0, (row.nivel ?? rootNivel) - rootNivel);
                                    const bg        = isGroup ? BG_PARENT : BG_LEAF;

                                    return (
                                        <tr key={row.id}>
                                            {/* # + chevron */}
                                            <td
                                                style={{ position: 'sticky', left: 0, width: C_IDX, backgroundColor: bg, zIndex: 10 }}
                                                className="border-b border-r border-slate-800 p-1"
                                            >
                                                <div className="flex items-center justify-center">
                                                    {isGroup ? (
                                                        <button
                                                            onClick={() => toggleExpand(row.id)}
                                                            className="flex items-center justify-center rounded p-0.5 text-amber-500 transition-colors hover:bg-slate-700 hover:text-amber-300"
                                                        >
                                                            {isExpanded
                                                                ? <ChevronDown size={13} />
                                                                : <ChevronRight size={13} />
                                                            }
                                                        </button>
                                                    ) : (
                                                        <span className="select-none text-[9px] text-slate-700">{idx + 1}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Descripción */}
                                            <td
                                                style={{
                                                    position: 'sticky',
                                                    left: L_DESC,
                                                    width: C_DESC,
                                                    maxWidth: C_DESC,
                                                    backgroundColor: bg,
                                                    paddingLeft: 6 + indent * 14,
                                                    zIndex: 10,
                                                }}
                                                className="border-b border-r border-slate-800 py-1.5 pr-2"
                                            >
                                                <div className="flex items-baseline gap-1.5 overflow-hidden">
                                                    {row.partida && (
                                                        <span className="shrink-0 font-mono text-[9px] text-slate-500">
                                                            {row.partida}
                                                        </span>
                                                    )}
                                                    <span className={`truncate leading-snug ${isGroup ? 'font-semibold text-amber-400' : 'text-slate-300'}`}>
                                                        {row.descripcion || <span className="italic text-slate-600">Sin descripción</span>}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Und */}
                                            <td
                                                style={{ position: 'sticky', left: L_UND, width: C_UND, backgroundColor: bg, zIndex: 10 }}
                                                className="border-b border-r border-slate-800 p-1.5 text-center text-[10px] text-slate-400"
                                            >
                                                {row.unidad || (isGroup ? '' : '–')}
                                            </td>

                                            {/* Cantidad */}
                                            <td
                                                style={{ position: 'sticky', left: L_CANT, width: C_CANT, backgroundColor: bg, zIndex: 10 }}
                                                className="border-b border-r border-slate-800 p-1.5 text-right font-mono text-[10px] text-slate-300"
                                            >
                                                {!isGroup && Number(row.metrado) > 0 ? fmtS(Number(row.metrado)) : ''}
                                            </td>

                                            {/* Total */}
                                            <td
                                                style={{ position: 'sticky', left: L_TOT, width: C_TOT, backgroundColor: bg, zIndex: 10 }}
                                                className={`border-b border-r border-slate-800 p-1.5 text-right font-mono text-[10px] ${isGroup ? 'font-semibold text-slate-100' : 'text-slate-300'}`}
                                            >
                                                {Number(row.parcial) > 0 ? fmtS(Number(row.parcial)) : ''}
                                            </td>

                                            {/* Valores INEI */}
                                            {sortedCodes.map((code) => {
                                                const val = rowMap.get(code) ?? 0;
                                                return (
                                                    <td
                                                        key={code}
                                                        style={{ width: C_INS }}
                                                        className={`border-b border-r border-slate-800/50 p-1.5 text-right font-mono text-[10px] ${
                                                            val > 0
                                                                ? isGroup
                                                                    ? 'font-semibold text-slate-100'
                                                                    : 'text-slate-300'
                                                                : 'text-transparent select-none'
                                                        }`}
                                                    >
                                                        {val > 0 ? fmtS(val) : '·'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>

                            {/* ─ TFOOT ─────────────────────────────────────── */}
                            <tfoot className="sticky bottom-0 z-20">
                                {/* Fila: Total S/ por índice */}
                                <tr>
                                    <td
                                        colSpan={5}
                                        style={{ position: 'sticky', left: 0, backgroundColor: BG_FOOT1, zIndex: 30 }}
                                        className="border-t-2 border-slate-600 p-1.5 text-right text-[10px] font-bold text-slate-200"
                                    >
                                        Total insumos (S/)
                                    </td>
                                    {sortedCodes.map((code) => {
                                        const val = parentMap.get(code) ?? 0;
                                        return (
                                            <td
                                                key={code}
                                                style={{ width: C_INS, backgroundColor: BG_FOOT1 }}
                                                className="border-t-2 border-r border-slate-600 border-r-slate-700 p-1.5 text-right font-mono text-[10px] font-bold text-emerald-300"
                                            >
                                                {val > 0 ? fmtS(val) : ''}
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Fila: Coeficiente de incidencia = insumo_total / presupuesto_total */}
                                <tr>
                                    <td
                                        colSpan={5}
                                        style={{ position: 'sticky', left: 0, backgroundColor: BG_FOOT2, zIndex: 30 }}
                                        className="border-t border-slate-700 p-1.5 text-right text-[10px] font-bold text-sky-400"
                                    >
                                        Coef. incidencia
                                    </td>
                                    {sortedCodes.map((code) => {
                                        const val  = parentMap.get(code) ?? 0;
                                        // normalizar sobre total insumos (no presupuesto con GG)
                                        const coef = insumoTotalCovered > 0 ? val / insumoTotalCovered : 0;
                                        return (
                                            <td
                                                key={code}
                                                style={{ width: C_INS, backgroundColor: BG_FOOT2 }}
                                                className="border-t border-r border-slate-700 p-1.5 text-right font-mono text-[10px] font-semibold text-sky-300"
                                                title={coef > 0 ? `${(coef * 100).toFixed(2)}%` : ''}
                                            >
                                                {coef > 0 ? coef.toFixed(3) : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Panel>

                <Separator className="h-1.5 cursor-row-resize border-y border-slate-700 bg-slate-800 transition-colors hover:bg-sky-600 active:bg-sky-500" />

                {/* ═══ INFERIOR: Constructor de monomios ══════════════════════ */}
                <Panel defaultSize={40} minSize={20} className="flex min-h-0 flex-col overflow-hidden bg-slate-900">
                    <FormulaPolinomicaBuilder
                        parentMap={parentMap}
                        budgetTotal={budgetTotal}
                        codeToDesc={codeToDesc}
                        sortedCodes={sortedCodes}
                    />
                </Panel>
            </Group>
        </div>
    );
}
