import type { ACUComponenteRow, ACURowSummary } from '@/types/presupuestos';
import type { ReactNode } from 'react';
import { Calculator, Info, Plus, Sigma, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// ── Constraints (Delphin Express / OSCE) ─────────────────────────────────────
const MAX_MONOMIOS     = 8;
const MAX_PER_MONOMIO  = 3;
const MIN_COEF_OSCE    = 0.05;

// ── Types ─────────────────────────────────────────────────────────────────────
type InsumoType = 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'subpartidas';

const INSUMO_TIPOS: InsumoType[] = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'];

const TIPO_BADGE: Record<InsumoType, string> = {
    mano_de_obra:  'MO',
    materiales:    'MAT',
    equipos:       'EQ',
    subcontratos:  'SC',
    subpartidas:   'SP',
};

const TIPO_COLOR: Record<InsumoType, string> = {
    mano_de_obra:  'bg-sky-900/40 text-sky-300',
    materiales:    'bg-emerald-900/40 text-emerald-300',
    equipos:       'bg-amber-900/40 text-amber-300',
    subcontratos:  'bg-purple-900/40 text-purple-300',
    subpartidas:   'bg-rose-900/40 text-rose-300',
};

interface BudgetFormulaRow {
    id?: number;
    partida?: string;
    descripcion?: string;
    unidad?: string;
    metrado?: number;
    precio_unitario?: number;
    parcial?: number;
    parent_id?: number | null;
    _hasChildren?: boolean;
}

interface Props {
    rows?: BudgetFormulaRow[];
    acuRows?: ACURowSummary[];
    projectName?: string;
}

interface InsumoForFormula {
    key: string;
    tipo: InsumoType;
    codigo: string;
    descripcion: string;
    unidad: string;
    total: number;         // metrado-weighted total cost across all partidas
    coefficient: number;
}

interface Monomio {
    id: string;
    symbol: string;
    label: string;
    insumoKeys: string[];  // max MAX_PER_MONOMIO elements
    indiceBase: number;
    indiceActual: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) =>
    n.toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });

const normalize = (s: string) =>
    String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

function isLeafRow(row: BudgetFormulaRow, childIds: Set<number>): boolean {
    if (row._hasChildren) return false;
    if (row.id !== undefined && childIds.has(Number(row.id))) return false;
    return Boolean(String(row.unidad ?? '').trim()) || Number(row.metrado ?? 0) > 0;
}

function compParcial(tipo: InsumoType, comp: ACUComponenteRow): number {
    if (comp.parcial != null) return Number(comp.parcial);
    const cant   = Number(comp.cantidad ?? 0);
    const precio = tipo === 'equipos'
        ? Number(comp.precio_hora   ?? comp.precio_unitario ?? 0)
        : Number(comp.precio_unitario ?? comp.precio_hora   ?? 0);
    const fd = tipo === 'materiales' ? Math.max(1, Number(comp.factor_desperdicio ?? 1)) : 1;
    return cant * precio * fd;
}

interface ExtractResult {
    insumos: InsumoForFormula[];
    partidaCount: number;
    matchedCount: number;
}

function extractInsumos(rows: BudgetFormulaRow[], acuRows: ACURowSummary[]): ExtractResult {
    const childIds = new Set<number>();
    for (const r of rows) {
        if (r.parent_id != null) childIds.add(Number(r.parent_id));
    }

    const leafRows = rows.filter((r) => isLeafRow(r, childIds));

    const acuByPartida = new Map(acuRows.map((a) => [String(a.partida ?? ''), a]));
    const acuByDesc    = new Map(
        acuRows.filter((a) => a.descripcion).map((a) => [normalize(a.descripcion), a]),
    );

    const totals = new Map<string, {
        tipo: InsumoType; codigo: string; descripcion: string; unidad: string; total: number;
    }>();
    let grandTotal   = 0;
    let matchedCount = 0;

    for (const row of leafRows) {
        const metrado = Number(row.metrado ?? 0);
        if (!metrado) continue;

        const partida = String(row.partida    ?? '');
        const desc    = String(row.descripcion ?? '');
        const acu     = acuByPartida.get(partida) ?? acuByDesc.get(normalize(desc));
        if (!acu) continue;
        matchedCount++;

        for (const tipo of INSUMO_TIPOS) {
            const comps = (acu as Record<string, ACUComponenteRow[]>)[tipo] ?? [];
            for (const comp of comps) {
                const descripcion = String(comp.descripcion ?? '').trim();
                if (!descripcion) continue;
                const unidad  = String(comp.unidad ?? '').trim() || '-';
                const parcial = compParcial(tipo, comp);
                const total   = metrado * parcial;
                if (total <= 0) continue;

                const key = `${tipo}|${normalize(descripcion)}|${unidad}`;
                const ex  = totals.get(key);
                if (ex) {
                    ex.total += total;
                } else {
                    totals.set(key, {
                        tipo,
                        codigo: String(comp.cod_insumo ?? comp.codigo ?? '').trim(),
                        descripcion,
                        unidad,
                        total,
                    });
                }
                grandTotal += total;
            }
        }
    }

    const insumos: InsumoForFormula[] = Array.from(totals.entries())
        .map(([key, v]) => ({
            key,
            ...v,
            coefficient: grandTotal > 0 ? v.total / grandTotal : 0,
        }))
        .sort((a, b) => {
            const na = parseInt(a.codigo, 10);
            const nb = parseInt(b.codigo, 10);
            if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
            if (!isNaN(na) && isNaN(nb)) return -1;
            if (isNaN(na) && !isNaN(nb)) return 1;
            const cmp = a.codigo.localeCompare(b.codigo, 'es');
            if (cmp !== 0) return cmp;
            return a.descripcion.localeCompare(b.descripcion, 'es');
        });

    return { insumos, partidaCount: leafRows.length, matchedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
export function FormulaPolinomica({ rows = [], acuRows = [], projectName }: Props) {

    const { insumos, partidaCount, matchedCount } = useMemo(
        () => extractInsumos(rows, acuRows),
        [rows, acuRows],
    );

    const grandTotal = useMemo(() => insumos.reduce((s, i) => s + i.total, 0), [insumos]);

    const [monomios,     setMonomios]     = useState<Monomio[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [symInput,     setSymInput]     = useState('');
    const [counter,      setCounter]      = useState(1);
    const [filterTipo,   setFilterTipo]   = useState<InsumoType | 'all'>('all');
    const [search,       setSearch]       = useState('');

    // Reset when insumo data changes (specialty switch / import)
    useEffect(() => {
        setMonomios([]);
        setSelectedKeys(new Set());
        setCounter(1);
        setSymInput('');
    }, [grandTotal]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const insumoByKey  = useMemo(() => new Map(insumos.map((i) => [i.key, i])), [insumos]);
    const assignedKeys = useMemo(
        () => new Set(monomios.flatMap((m) => m.insumoKeys)),
        [monomios],
    );

    const monomioData = useMemo(() =>
        monomios.map((m) => {
            const total       = m.insumoKeys.reduce((s, k) => s + (insumoByKey.get(k)?.total ?? 0), 0);
            const coefficient = grandTotal > 0 ? total / grandTotal : 0;
            const monomial    = m.indiceBase !== 0 ? coefficient * (m.indiceActual / m.indiceBase) : 0;
            return { ...m, total, coefficient, monomial };
        }),
    [monomios, insumoByKey, grandTotal]);

    const assignedTotal  = monomioData.reduce((s, m) => s + m.total, 0);
    const coeffTotal     = monomioData.reduce((s, m) => s + m.coefficient, 0);
    const reajuste       = monomioData.reduce((s, m) => s + m.monomial, 0);
    const unassignedCoef = grandTotal > 0 ? (grandTotal - assignedTotal) / grandTotal : 0;

    const formulaText = monomioData
        .filter((m) => m.coefficient > 0)
        .map((m) => `${m.coefficient.toFixed(3)}(${m.symbol}r/${m.symbol}o)`)
        .join(' + ');

    const visibleInsumos = useMemo(() => {
        const q = normalize(search);
        return insumos.filter((i) => {
            if (filterTipo !== 'all' && i.tipo !== filterTipo) return false;
            if (q && !normalize(i.descripcion).includes(q) && !normalize(i.codigo).includes(q)) return false;
            return true;
        });
    }, [insumos, filterTipo, search]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const toggleSelect = (key: string) => {
        if (assignedKeys.has(key)) return;
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const handleCreate = () => {
        if (selectedKeys.size === 0 || selectedKeys.size > MAX_PER_MONOMIO) return;
        if (monomios.length >= MAX_MONOMIOS) return;
        const sym = symInput.trim().toUpperCase().slice(0, 4) || `M${counter}`;
        setMonomios((prev) => [
            ...prev,
            {
                id: `m-${Date.now()}`,
                symbol: sym,
                label: sym,
                insumoKeys: Array.from(selectedKeys),
                indiceBase: 100,
                indiceActual: 100,
            },
        ]);
        setCounter((c) => c + 1);
        setSelectedKeys(new Set());
        setSymInput('');
    };

    const handleAddTo = (_: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        const targetId = e.target.value;
        if (!targetId) return;
        e.target.value = '';
        const mono = monomios.find((m) => m.id === targetId);
        if (!mono) return;
        const newKeys = Array.from(selectedKeys).filter((k) => !mono.insumoKeys.includes(k));
        if (mono.insumoKeys.length + newKeys.length > MAX_PER_MONOMIO) return;
        setMonomios((prev) =>
            prev.map((m) =>
                m.id === targetId ? { ...m, insumoKeys: [...m.insumoKeys, ...newKeys] } : m,
            ),
        );
        setSelectedKeys(new Set());
    };

    const handleRemoveInsumo = (monoId: string, key: string) => {
        setMonomios((prev) =>
            prev
                .map((m) => (m.id === monoId ? { ...m, insumoKeys: m.insumoKeys.filter((k) => k !== key) } : m))
                .filter((m) => m.insumoKeys.length > 0),
        );
    };

    const handleDeleteMono = (monoId: string) =>
        setMonomios((prev) => prev.filter((m) => m.id !== monoId));

    const updateMono = (monoId: string, patch: Partial<Monomio>) =>
        setMonomios((prev) => prev.map((m) => (m.id === monoId ? { ...m, ...patch } : m)));

    // ── Render ────────────────────────────────────────────────────────────────
    if (insumos.length === 0) {
        return (
            <div className="flex min-h-64 flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center">
                <Info size={22} className="mb-2 text-slate-500" />
                <p className="text-sm font-medium text-slate-300">No hay insumos para calcular.</p>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                    Importe o registre presupuesto y ACUs con sus componentes para generar la fórmula polinómica.
                </p>
            </div>
        );
    }

    const canCreate =
        selectedKeys.size > 0 &&
        selectedKeys.size <= MAX_PER_MONOMIO &&
        monomios.length < MAX_MONOMIOS;

    return (
        <div className="flex min-h-0 flex-col gap-3 text-slate-100">

            {/* ── Stats ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Calculator size={16} className="text-emerald-400" />
                        Fórmula Polinómica
                    </h3>
                    {projectName && <p className="mt-0.5 text-xs text-slate-400">{projectName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-right md:grid-cols-4">
                    <Stat label="Partidas"    value={String(partidaCount)} />
                    <Stat label="Con ACU"     value={String(matchedCount)} color="text-emerald-300" />
                    <Stat label="Insumos"     value={String(insumos.length)} color="text-sky-300" />
                    <Stat
                        label="Monomios"
                        value={`${monomioData.length} / ${MAX_MONOMIOS}`}
                        color="text-amber-300"
                    />
                </div>
            </div>

            {/* ── K expression ──────────────────────────────────────────── */}
            <div className="rounded border border-slate-800 bg-slate-900 p-3">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Sigma size={13} className="text-emerald-400" />
                    Expresión generada
                    {unassignedCoef > 0.0005 && (
                        <span className="ml-auto text-[10px] font-normal text-amber-400">
                            {fmt(unassignedCoef * 100, 1)}% sin asignar
                        </span>
                    )}
                </div>
                <div className="rounded bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                    K ={' '}
                    {formulaText || (
                        <span className="text-slate-600">
                            selecciona insumos y crea monomios para construir la fórmula
                        </span>
                    )}
                </div>
            </div>

            {/* ── Main layout ───────────────────────────────────────────── */}
            <div className="grid min-h-0 gap-3 lg:grid-cols-[1fr_18rem]">

                {/* LEFT — insumos table */}
                <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-800">

                    {/* filters */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                        <span className="text-xs font-semibold text-slate-300">Insumos</span>
                        <div className="flex rounded bg-slate-800 p-0.5">
                            <FilterBtn active={filterTipo === 'all'} onClick={() => setFilterTipo('all')}>Todo</FilterBtn>
                            {INSUMO_TIPOS.map((t) => (
                                <FilterBtn key={t} active={filterTipo === t} onClick={() => setFilterTipo(t)}>
                                    <span className={`rounded px-1 text-[9px] font-bold ${TIPO_COLOR[t]}`}>
                                        {TIPO_BADGE[t]}
                                    </span>
                                </FilterBtn>
                            ))}
                        </div>
                        <input
                            className="ml-auto min-w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none placeholder-slate-600 focus:border-sky-500"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* selection actions bar */}
                    {selectedKeys.size > 0 && (
                        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sky-900/50 bg-sky-900/20 px-3 py-1.5">
                            <span className="text-xs text-sky-300">
                                {selectedKeys.size} seleccionado{selectedKeys.size !== 1 ? 's' : ''}
                            </span>
                            {selectedKeys.size > MAX_PER_MONOMIO && (
                                <span className="text-[10px] text-amber-400">
                                    Máx. {MAX_PER_MONOMIO} por monomio
                                </span>
                            )}
                            <div className="ml-auto flex items-center gap-1.5">
                                <input
                                    className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-center text-xs font-mono font-bold text-emerald-300 outline-none placeholder-slate-600 focus:border-emerald-500 uppercase"
                                    placeholder="Símbolo"
                                    maxLength={4}
                                    value={symInput}
                                    onChange={(e) => setSymInput(e.target.value)}
                                />
                                <button
                                    disabled={!canCreate}
                                    onClick={handleCreate}
                                    className="flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                                >
                                    <Plus size={11} /> Nuevo monomio
                                </button>
                                {monomios.length > 0 && (
                                    <select
                                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none"
                                        defaultValue=""
                                        onChange={(e) => handleAddTo(e.target.value, e)}
                                    >
                                        <option value="">Agregar a…</option>
                                        {monomios.map((m) => {
                                            const free = MAX_PER_MONOMIO - m.insumoKeys.length;
                                            return (
                                                <option
                                                    key={m.id}
                                                    value={m.id}
                                                    disabled={free < 1 || selectedKeys.size > free}
                                                >
                                                    {m.symbol} — {m.label} ({m.insumoKeys.length}/{MAX_PER_MONOMIO})
                                                </option>
                                            );
                                        })}
                                    </select>
                                )}
                                <button
                                    className="rounded p-1 text-slate-500 hover:text-slate-300"
                                    onClick={() => setSelectedKeys(new Set())}
                                >
                                    <X size={11} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* table */}
                    <div className="min-h-0 flex-1 overflow-auto">
                        <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="sticky top-0 z-10 bg-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="w-8 p-2" />
                                    <th className="w-10 p-2">Tipo</th>
                                    <th className="p-2">Descripción</th>
                                    <th className="w-12 p-2 text-center">Und.</th>
                                    <th className="p-2 text-right">Monto (S/)</th>
                                    <th className="w-16 p-2 text-right">%</th>
                                    <th className="w-16 p-2 text-center">Monom.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-950">
                                {visibleInsumos.map((ins) => {
                                    const isSelected  = selectedKeys.has(ins.key);
                                    const isAssigned  = assignedKeys.has(ins.key);
                                    const assignedMono = monomios.find((m) => m.insumoKeys.includes(ins.key));
                                    return (
                                        <tr
                                            key={ins.key}
                                            onClick={!isAssigned ? () => toggleSelect(ins.key) : undefined}
                                            className={`transition-colors ${
                                                isSelected  ? 'bg-sky-900/30' :
                                                isAssigned  ? 'bg-emerald-900/10 cursor-default' :
                                                'hover:bg-slate-800/60 cursor-pointer'
                                            }`}
                                        >
                                            <td className="p-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-3 w-3"
                                                    checked={isSelected}
                                                    disabled={isAssigned}
                                                    readOnly
                                                />
                                            </td>
                                            <td className="p-2">
                                                <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${TIPO_COLOR[ins.tipo]}`}>
                                                    {TIPO_BADGE[ins.tipo]}
                                                </span>
                                            </td>
                                            <td className="p-2">
                                                <div className="font-medium text-slate-200">{ins.descripcion}</div>
                                                {ins.codigo && (
                                                    <div className="text-[10px] text-slate-500">{ins.codigo}</div>
                                                )}
                                            </td>
                                            <td className="p-2 text-center text-slate-400">{ins.unidad}</td>
                                            <td className="p-2 text-right font-mono text-slate-300">
                                                {fmt(ins.total)}
                                            </td>
                                            <td className="p-2 text-right font-mono text-sky-300">
                                                {fmt(ins.coefficient * 100, 2)}
                                            </td>
                                            <td className="p-2 text-center">
                                                {assignedMono && (
                                                    <span className="font-mono text-[10px] font-bold text-emerald-300">
                                                        {assignedMono.symbol}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT — formula builder */}
                <div className="flex flex-col gap-2">

                    {/* Summary */}
                    <div className="rounded border border-slate-800 bg-slate-900 p-3 text-xs">
                        <p className="mb-2 font-semibold text-slate-300">Resumen</p>
                        <div className="flex flex-col gap-1.5 text-slate-400">
                            <RowLine label="Total insumos"  value={`S/ ${fmt(grandTotal)}`} />
                            <RowLine label="Asignado"
                                value={`S/ ${fmt(assignedTotal)}`}
                                color={assignedTotal > 0 ? 'text-emerald-300' : undefined} />
                            {unassignedCoef > 0.0005 && (
                                <RowLine label="Sin asignar"
                                    value={`${fmt(unassignedCoef * 100, 2)}%`}
                                    color="text-amber-400" />
                            )}
                            <div className="my-1 border-t border-slate-800" />
                            <RowLine
                                label="Σ Coeficientes"
                                value={fmt(coeffTotal, 6)}
                                color={Math.abs(1 - coeffTotal) < 0.001 ? 'text-emerald-300' : 'text-amber-400'} />
                            <RowLine label="K (reajuste)" value={fmt(reajuste, 6)} color="text-amber-300" />
                        </div>
                    </div>

                    {/* Monomios */}
                    {monomioData.length === 0 ? (
                        <div className="flex-1 rounded border border-dashed border-slate-700 p-4 text-center text-[10px] text-slate-600">
                            Selecciona insumos de la izquierda y haz clic en{' '}
                            <span className="font-semibold text-slate-500">Nuevo monomio</span> para construir la fórmula.
                            <br /><br />
                            Máx. {MAX_PER_MONOMIO} insumos por monomio · {MAX_MONOMIOS} monomios en total
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 overflow-auto">
                            {monomioData.map((m) => {
                                const warnCoef = m.coefficient > 0 && m.coefficient < MIN_COEF_OSCE;
                                return (
                                    <div
                                        key={m.id}
                                        className={`rounded border p-2.5 ${
                                            warnCoef
                                                ? 'border-amber-700/50 bg-amber-900/10'
                                                : 'border-slate-700 bg-slate-900'
                                        }`}
                                    >
                                        {/* Header */}
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                className="w-14 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-center font-mono text-xs font-bold text-emerald-300 uppercase outline-none focus:border-emerald-500"
                                                value={m.symbol}
                                                maxLength={4}
                                                onChange={(e) =>
                                                    updateMono(m.id, { symbol: e.target.value.toUpperCase() })
                                                }
                                            />
                                            <input
                                                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                                                value={m.label}
                                                placeholder="Descripción…"
                                                onChange={(e) => updateMono(m.id, { label: e.target.value })}
                                            />
                                            <span className="shrink-0 font-mono text-xs font-semibold text-sky-300">
                                                {fmt(m.coefficient, 5)}
                                            </span>
                                            <button
                                                className="shrink-0 rounded p-0.5 text-slate-600 transition-colors hover:bg-red-900/40 hover:text-red-400"
                                                title="Eliminar monomio"
                                                onClick={() => handleDeleteMono(m.id)}
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>

                                        {warnCoef && (
                                            <p className="mt-0.5 text-[9px] text-amber-400">
                                                Coef. {'<'} 5% — mínimo OSCE
                                            </p>
                                        )}

                                        {/* Insumos incluidos */}
                                        <div className="mt-1.5 flex flex-col gap-1">
                                            {m.insumoKeys.map((key) => {
                                                const ins = insumoByKey.get(key);
                                                if (!ins) return null;
                                                return (
                                                    <div
                                                        key={key}
                                                        className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px]"
                                                    >
                                                        <span className={`rounded px-0.5 text-[9px] font-bold ${TIPO_COLOR[ins.tipo]}`}>
                                                            {TIPO_BADGE[ins.tipo]}
                                                        </span>
                                                        <span
                                                            className="min-w-0 flex-1 truncate text-slate-300"
                                                            title={ins.descripcion}
                                                        >
                                                            {ins.descripcion}
                                                        </span>
                                                        <span className="shrink-0 font-mono text-slate-500">
                                                            {fmt(ins.coefficient * 100, 1)}%
                                                        </span>
                                                        <button
                                                            className="shrink-0 text-slate-600 transition-colors hover:text-red-400"
                                                            title="Quitar del monomio"
                                                            onClick={() => handleRemoveInsumo(m.id, key)}
                                                        >
                                                            <X size={9} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {m.insumoKeys.length < MAX_PER_MONOMIO && (
                                                <p className="text-[9px] text-slate-700">
                                                    {MAX_PER_MONOMIO - m.insumoKeys.length} espacio{MAX_PER_MONOMIO - m.insumoKeys.length !== 1 ? 's' : ''} libre{MAX_PER_MONOMIO - m.insumoKeys.length !== 1 ? 's' : ''}
                                                </p>
                                            )}
                                        </div>

                                        {/* Índices */}
                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                            <div>
                                                <p className="mb-0.5 text-[9px] text-slate-500">Índice base</p>
                                                <input
                                                    type="number"
                                                    className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-right font-mono text-xs text-slate-200 outline-none focus:border-sky-500"
                                                    value={m.indiceBase}
                                                    onChange={(e) =>
                                                        updateMono(m.id, { indiceBase: Number(e.target.value) || 0 })
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <p className="mb-0.5 text-[9px] text-slate-500">Índice actual</p>
                                                <input
                                                    type="number"
                                                    className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-right font-mono text-xs text-slate-200 outline-none focus:border-sky-500"
                                                    value={m.indiceActual}
                                                    onChange={(e) =>
                                                        updateMono(m.id, { indiceActual: Number(e.target.value) || 0 })
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <p className="mt-1 text-right font-mono text-xs font-semibold text-amber-300">
                                            Monomio: {fmt(m.monomial, 6)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Small UI helpers ──────────────────────────────────────────────────────────
function Stat({ label, value, color = 'text-slate-200' }: { label: string; value: string; color?: string }) {
    return (
        <div className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`font-mono text-xs font-semibold ${color}`}>{value}</p>
        </div>
    );
}

function RowLine({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex justify-between gap-2">
            <span>{label}</span>
            <span className={`font-mono ${color ?? 'text-slate-200'}`}>{value}</span>
        </div>
    );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${
                active ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
        >
            {children}
        </button>
    );
}
