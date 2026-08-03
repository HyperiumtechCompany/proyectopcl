import type { ACUComponenteRow, ACURowSummary } from '@/types/presupuestos';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { DicEntry } from '../hooks/useDiccionario';
import type { DelphinRow, ResumenPresupuesto } from '../types';
import {
    GU_CODE,
    INEI_NOMBRES,
    isPersonalEspecializado,
    MANO_DE_OBRA_ESPECIALIZADA_CODE,
    resolveIneiNombre,
} from '../data/ineiIndices';
import { FormulaPolinomicaBuilder } from './FormulaPolinomicaBuilder';

// INE 39: Gastos Generales + Utilidad no pertenecen a ningún insumo de ACU —
// se inyectan como una fila/columna sintética aparte, con el código y nombre
// oficial DS 011-79-VC, para que también puedan entrar a un monomio de la
// fórmula (tal como cualquier otro índice INEI).
const INDICE_INE_CODE = GU_CODE;
const INDICE_INE_LABEL = INEI_NOMBRES[GU_CODE];

// ── Insumo tipo ───────────────────────────────────────────────────────────────
const INSUMO_TIPOS = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'] as const;
type InsumoTipo = typeof INSUMO_TIPOS[number];

const TIPO_LABEL: Record<InsumoTipo, string> = {
    mano_de_obra: 'Mano de Obra',
    materiales: 'Materiales',
    equipos: 'Equipos',
    subcontratos: 'Subcontratos',
    subpartidas: 'Subpartidas',
};

// ── Column widths (px) ────────────────────────────────────────────────────────
const C_IDX = 44;    
const C_DESC = 268;   
const C_UND = 58;    
const C_CANT = 90;   
const C_TOT = 112; 
const C_INS = 82;    

const L_DESC = C_IDX;
const L_UND = L_DESC + C_DESC;
const L_CANT = L_UND + C_UND;
const L_TOT = L_CANT + C_CANT;

const BG_HEAD = '#1e293b'; 
const BG_PARENT = '#172033'; 
const BG_LEAF = '#020617'; 
const BG_FOOT1 = '#1e293b'; 
const BG_FOOT2 = '#0f172a'; 

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
    const cant = Number(comp.cantidad ?? 0);
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
   
    matrix: Map<number, Map<string, number>>;
    sortedCodes: string[];
    codeToDesc: Map<string, string>;
}

/**
 * Resolve the diccionario name for an ACU component, exact match only.
 * A single INEI code (e.g. "47") groups many distinct items (Peón, Oficial,
 * Capataz…), so a prefix/fuzzy match against an arbitrary entry in that group
 * used to produce wrong labels (e.g. a retroexcavador's raw brand/spec name
 * "fuzzy-matched" against an unrelated generic entry). Only an exact
 * normalized match is trustworthy; anything else is left unresolved so the
 * caller can fall back to the (always-correct) resource tipo instead of a
 * misleading guess.
 */
function resolveDiccionarioName(
    rawDesc: string,
    code: string,
    dicByCode: Map<string, string[]>,
): string | null {
    const entries = dicByCode.get(code);
    if (!entries?.length) return null;

    const normRaw = normalize(rawDesc);
    for (const e of entries) {
        if (normalize(e) === normRaw) return e;
    }

    return null;
}

function buildMatrix(
    subtree: DelphinRow[],
    acuRows: ACURowSummary[],
    parentIdSet: Set<number>,
    dicByCode: Map<string, string[]>,
): MatrixResult {
    const acuByPartida = new Map(acuRows.map((a) => [String(a.partida ?? ''), a]));
    const acuByDesc = new Map(
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

    // Per INEI code: which tipos (mano_de_obra/materiales/…) contribute to it,
    // and which distinct diccionario names were exactly matched. A code almost
    // always groups several differently-named items (e.g. "47" = Peón +
    // Oficial + Capataz…), so there is rarely a single canonical diccionario
    // name for the whole column — the resource tipo is the only label that's
    // always correct; the diccionario name is only trustworthy as a column
    // label when every item under that code resolves to the exact same entry.
    const codeToTipos = new Map<string, Set<InsumoTipo>>();
    const codeToResolvedNames = new Map<string, Set<string>>();
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
                let codigo = !isNaN(n) ? String(n).padStart(2, '0') : rawCod;
                // 47-1: personal técnico de alta especialización (topógrafos,
                // especialistas) se factura bajo el mismo código 47 que el resto
                // de la cuadrilla — se separa por palabra clave en la descripción
                // para no diluir el índice de mano de obra estándar.
                if (tipo === 'mano_de_obra' && codigo === '47' && isPersonalEspecializado(String(comp.descripcion ?? ''))) {
                    codigo = MANO_DE_OBRA_ESPECIALIZADA_CODE;
                }
                const amount = metrado * compParcial(tipo, comp);
                if (amount <= 0) continue;
                rowMap.set(codigo, (rowMap.get(codigo) ?? 0) + amount);

                if (!codeToTipos.has(codigo)) codeToTipos.set(codigo, new Set());
                codeToTipos.get(codigo)!.add(tipo);

                if (comp.descripcion) {
                    const resolved = resolveDiccionarioName(String(comp.descripcion).trim(), codigo, dicByCode);
                    if (resolved) {
                        if (!codeToResolvedNames.has(codigo)) codeToResolvedNames.set(codigo, new Set());
                        codeToResolvedNames.get(codigo)!.add(resolved);
                    }
                }
            }
        }
        if (rowMap.size > 0) leafValues.set(row.id, rowMap);
    }

    // Final label per code, in priority order:
    // 1. Nombre oficial DS 011-79-VC (catálogo INEI_NOMBRES) — siempre que el
    //    código esté en el catálogo, es la fuente más confiable posible.
    // 2. El nombre de diccionario, solo cuando TODOS los ítems bajo ese código
    //    coinciden exactamente en el mismo nombre (códigos no catalogados,
    //    específicos de un solo material).
    // 3. El tipo de recurso (siempre correcto, aunque genérico) — ej. "47"
    //    agrupa Peón/Oficial/Capataz/etc. → "Mano de Obra".
    const codeToDesc = new Map<string, string>();
    for (const codigo of new Set([...codeToTipos.keys(), ...codeToResolvedNames.keys()])) {
        const oficial = resolveIneiNombre(codigo);
        if (oficial) {
            codeToDesc.set(codigo, oficial);
            continue;
        }
        const resolvedNames = codeToResolvedNames.get(codigo);
        if (resolvedNames && resolvedNames.size === 1) {
            codeToDesc.set(codigo, [...resolvedNames][0]);
            continue;
        }
        const tipos = codeToTipos.get(codigo);
        if (tipos && tipos.size > 0) {
            codeToDesc.set(codigo, [...tipos].map((t) => TIPO_LABEL[t]).join(' / '));
        }
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
        if (!isNaN(nb)) return 1;
        return a.localeCompare(b, 'es');
    });

    return { matrix, sortedCodes, codeToDesc };
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
    parentId: number;
    rows: DelphinRow[];
    acuRows: ACURowSummary[];
    diccionario: DicEntry[];
    projectName: string;
    resumenPresupuesto?: ResumenPresupuesto;
    onBack: () => void;
    onExportFormula?: (formulaData: any) => void;
    onMonomiosChange?: (monomios: any[]) => void;
}

export function FormulaPolinomicaSplitView({ parentId, rows, acuRows, diccionario, projectName,
    resumenPresupuesto, onBack, onExportFormula, onMonomiosChange }: Props) {

    // Subtree en pre-order
    const subtree = useMemo(() => subtreePreorder(rows, parentId), [rows, parentId]);
    const parentRow = useMemo(() => rows.find((r) => r.id === parentId), [rows, parentId]);
    const rootNivel = parentRow?.nivel ?? 1;

    // Set de IDs que son padres (tienen hijos)
    const parentIdSet = useMemo(() => {
        const s = new Set<number>();
        for (const r of rows) if (r.parent_id != null) s.add(Number(r.parent_id));
        return s;
    }, [rows]);

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

    // Gastos Generales + Utilidad (proyecto completo, desde gg_consolidado) — no
    // están atados a ninguna partida, así que no participan del recorrido normal
    // del árbol; se inyectan aparte como índice 39.
    const ggUtilidad = resumenPresupuesto
        ? resumenPresupuesto.gastosGenerales + resumenPresupuesto.utilidad
        : 0;

    // Mapa de insumos INEI por fila
    const { matrix, sortedCodes, codeToDesc } = useMemo(() => {
        const base = buildMatrix(subtree, acuRows, parentIdSet, dicByCode);
        if (ggUtilidad <= 0) return base;

        const matrix = new Map(base.matrix);
        const parentEntry = new Map(matrix.get(parentId) ?? new Map<string, number>());
        parentEntry.set(INDICE_INE_CODE, (parentEntry.get(INDICE_INE_CODE) ?? 0) + ggUtilidad);
        matrix.set(parentId, parentEntry);

        const sortedCodes = base.sortedCodes.includes(INDICE_INE_CODE)
            ? base.sortedCodes
            : [...base.sortedCodes, INDICE_INE_CODE].sort((a, b) => {
                  const na = parseInt(a, 10), nb = parseInt(b, 10);
                  if (!isNaN(na) && !isNaN(nb)) return na - nb;
                  if (!isNaN(na)) return -1;
                  if (!isNaN(nb)) return 1;
                  return a.localeCompare(b, 'es');
              });

        // Nombre oficial del índice 39, aun si diccionario ya usa ese código
        // para otros insumos (semilla de datos ambigua) — este siempre gana.
        const codeToDesc = new Map(base.codeToDesc);
        codeToDesc.set(INDICE_INE_CODE, INDICE_INE_LABEL);

        return { matrix, sortedCodes, codeToDesc };
    }, [subtree, acuRows, parentIdSet, dicByCode, ggUtilidad, parentId]);

    // ── Expand / Collapse ─────────────────────────────────────────────────────
    const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
        // Inicializar todos los padres como expandidos
        const ps = new Set<number>();
        for (const r of rows) if (r.parent_id != null) ps.add(Number(r.parent_id));
        const sub = subtreePreorder(rows, parentId);
        return new Set(sub.filter((r) => ps.has(r.id)).map((r) => r.id));
    });

    const [builderMonomios, setBuilderMonomios] = useState<any[]>([]);
    const [isDataReady, setIsDataReady] = useState(false);

    useEffect(() => {
        
        if (builderMonomios.length > 0) {
            
            setIsDataReady(true);
        } else {
            
            setIsDataReady(false);
        }
    }, [builderMonomios]);
    useEffect(() => {
        
        if (onMonomiosChange) {
            
            onMonomiosChange(builderMonomios);
        }
    }, [builderMonomios, onMonomiosChange]);


    // ── Obtener datos de la fórmula para exportar ──────────────────────────────
    const getFormulaData = useCallback(() => {
        
        const monomios = builderMonomios;

        if (!monomios || monomios.length === 0) {
            return {
                formula: 'K = No hay monomios configurados',
                monomios: [],  // ← Array vacío
                totalK: 0,
                hasData: false,
            };
        }

    
        const formula = monomios
            .filter(m => m.indices.some((i: any) => i.coefDefinido > 0))
            .map((m: any) => {
                const coef = m.indices.reduce((s: number, i: any) => s + i.coefDefinido, 0);
                return `${coef.toFixed(3)} ${m.nomenclatura}r`;
            })
            .join(' + ');


        const result = {
            formula: `K = ${formula}`,
            monomios: monomios.map((m: any) => ({
                nro: monomios.indexOf(m) + 1,
                esPadre: true,
                descripcion: m.indices[0]?.descripcion || 'Monomio',
                monomio: m.nomenclatura || '',
                coeficiente: m.indices.reduce((s: number, i: any) => s + i.coefDefinido, 0),
                incidencia: m.indices.reduce((s: number, i: any) => s + i.coefDefinido, 0) * 100,
                indices_agrupados: m.indices.slice(1).map((i: any) => ({
                    codigo: i.code,
                    descripcion: i.descripcion,
                    coeficiente: i.coefDefinido
                }))
            })),
            totalK: monomios.reduce((s: number, m: any) => s + m.indices.reduce((sum: number, i: any) => sum + i.coefDefinido, 0), 0),
            hasData: true,
            parentId: parentId,
            projectName: projectName,
        };


        return result;
    }, [builderMonomios, parentId, projectName]);

    const handleExportFormula = useCallback(() => {
        
        const data = getFormulaData();

        // Validar que hay datos para exportar
        if (!data.hasData || data.monomios.length === 0) {
            alert('⚠️ NO HAY MONOMIOS CONFIGURADOS\n\n');
            return;
        }

        // Verificar que la suma de coeficientes sea aproximadamente 1.0
        if (Math.abs(data.totalK - 1.0) > 0.005) {
            if (!confirm(
                `⚠️ La suma de coeficientes es ${data.totalK.toFixed(3)}, no es exactamente 1.000.\n\n` +
                '¿Deseas exportar de todas formas?'
            )) {
                return;
            }
        }

       
        onExportFormula?.(data.monomios);
    }, [getFormulaData, onExportFormula, builderMonomios]);

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

    const expandAll = useCallback(() =>
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
    const parentMap = matrix.get(parentId) ?? new Map<string, number>();

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
                                    const isGroup = parentIdSet.has(row.id);
                                    const isExpanded = expandedIds.has(row.id);
                                    const rowMap = matrix.get(row.id) ?? new Map<string, number>();
                                    const indent = Math.max(0, (row.nivel ?? rootNivel) - rootNivel);
                                    const bg = isGroup ? BG_PARENT : BG_LEAF;

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
                                                        className={`border-b border-r border-slate-800/50 p-1.5 text-right font-mono text-[10px] ${val > 0
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

                                {/* Fila sintética: Gastos Generales + Utilidad → índice 39 (INE) */}
                                {ggUtilidad > 0 && (
                                    <tr>
                                        <td
                                            style={{ position: 'sticky', left: 0, width: C_IDX, backgroundColor: BG_PARENT, zIndex: 10 }}
                                            className="border-b border-r border-slate-800 p-1"
                                        />
                                        <td
                                            style={{ position: 'sticky', left: L_DESC, width: C_DESC, maxWidth: C_DESC, backgroundColor: BG_PARENT, zIndex: 10 }}
                                            className="border-b border-r border-slate-800 py-1.5 pr-2"
                                        >
                                            <div className="flex items-baseline gap-1.5 overflow-hidden">
                                                <span className="shrink-0 font-mono text-[9px] text-slate-500">{INDICE_INE_CODE}</span>
                                                <span className="truncate leading-snug font-semibold text-amber-400">{INDICE_INE_LABEL}</span>
                                            </div>
                                        </td>
                                        <td style={{ position: 'sticky', left: L_UND, width: C_UND, backgroundColor: BG_PARENT, zIndex: 10 }}
                                            className="border-b border-r border-slate-800 p-1.5 text-center text-[10px] text-slate-400" />
                                        <td style={{ position: 'sticky', left: L_CANT, width: C_CANT, backgroundColor: BG_PARENT, zIndex: 10 }}
                                            className="border-b border-r border-slate-800 p-1.5 text-right font-mono text-[10px] text-slate-300" />
                                        <td
                                            style={{ position: 'sticky', left: L_TOT, width: C_TOT, backgroundColor: BG_PARENT, zIndex: 10 }}
                                            className="border-b border-r border-slate-800 p-1.5 text-right font-mono text-[10px] font-semibold text-slate-100"
                                        >
                                            {fmtS(ggUtilidad)}
                                        </td>
                                        {sortedCodes.map((code) => {
                                            const val = code === INDICE_INE_CODE ? ggUtilidad : 0;
                                            return (
                                                <td
                                                    key={code}
                                                    style={{ width: C_INS }}
                                                    className={`border-b border-r border-slate-800/50 p-1.5 text-right font-mono text-[10px] ${
                                                        val > 0 ? 'font-semibold text-slate-100' : 'text-transparent select-none'
                                                    }`}
                                                >
                                                    {val > 0 ? fmtS(val) : '·'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )}
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
                                        const val = parentMap.get(code) ?? 0;
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
                        onMonomiosChange={(monomios) => {
                           

                            // ✅ Forzar actualización con setTimeout
                            setTimeout(() => {
                                setBuilderMonomios(monomios);
                            }, 0);
                        }}
                    />
                </Panel>
            </Group>
        </div>
    );
}
