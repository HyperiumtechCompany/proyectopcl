import axios from 'axios';
import Decimal from 'decimal.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGanttTasks } from '../../cronogramas/v2/composables/useGanttTasks';
import type { GanttCalendarSettings as CalendarSettings } from '../../cronogramas/v2/types/calendar';
import type {
    GanttTask,
    SchedulingMode,
} from '../../cronogramas/v2/types/task';
import {
    BUDGET_FIELD_KEYS,
    defaultBudget,
    type BudgetFields,
    type DelphinRow,
} from '../types';
import type { ParsePresupuestoResult } from '../helpers/parsePresupuestoExcel';

interface Options {
    initialTasks: GanttTask[];
    initialRows: any[];
    schedulingMode: SchedulingMode;
    calendarSettings: CalendarSettings;
}

// Redondea con decimal.js a 10 decimales (no 2, y no 6) — evita el bug de
// .toFixed(2) con floats y, sobre todo, evita truncar precio_unitario/parcial
// antes de sumar o multiplicar por metrado. Con 1 partida el truncado no se
// nota, pero con miles de partidas el redondeo por-fila se acumula; y con
// metrados grandes (decenas de miles), incluso un residuo en el 7º decimal de
// precio_unitario se amplifica a céntimos frente a Insumos Consolidados
// (verificado con datos reales: metrado=75,500 × error 4.4e-7 = 0.033 de
// diferencia). Mismo criterio que decimalMul/r2 en usePresupuestoAcu.ts y que
// recalculateParciales en CostoDatabaseService.php: 10dp internamente, 2dp
// solo al formatear en pantalla.
function round2(n: number): number {
    return new Decimal(n).toDecimalPlaces(10).toNumber();
}

function normalizeForMatch(s: string): string {
    return (s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip combining diacritics
        .replace(/[^a-z0-9\s]/g, ' ') // replace punctuation/quotes/symbols with space
        .replace(/\s+/g, ' ')
        .trim();
}

// Returns true when the descriptions are similar enough to trust a code-based match.
// Tokenizes each description, counts significant words (≥4 chars) that overlap.
// A Jaccard-style ratio ≥ 0.4 on the shorter side is considered a valid match.
// This prevents "VALVULA ESFERICA" from being misrouted to "EMPALME DE TUBERIA"
// simply because they share the same partida code across different exports.
function codeMatchIsValid(existingDesc: string, importedDesc: string): boolean {
    const a = normalizeForMatch(existingDesc);
    const b = normalizeForMatch(importedDesc);
    if (!a || !b) return true;
    const tokA = a.split(/\s+/).filter((w) => w.length >= 4);
    const tokB = b.split(/\s+/).filter((w) => w.length >= 4);
    if (tokA.length === 0 || tokB.length === 0) return true;
    const setB = new Set(tokB);
    const shared = tokA.filter((w) => setB.has(w)).length;
    return shared / Math.min(tokA.length, tokB.length) >= 0.4;
}

// For orphaned rows (parent not found in file), find or create ancestor nodes.
// Returns the augmented rows (synthetic parents first, then originals with fixed parent_ids)
// plus the list of auto-created partida codes.
function makeSyntheticRow(
    id: number,
    code: string,
    parentId: number | null,
): DelphinRow {
    const codeSegs = code.split('.');

    return {
        id,
        parent_id: parentId,
        nivel: codeSegs.length,
        item_order: 0,
        partida: code,
        descripcion: code,
        duracion_dias: 0,
        fecha_inicio: null,
        fecha_fin: null,
        avance: 0,
        predecesoras: [],
        presupuesto: 0,
        unidad: '',
        metrado: 0,
        precio_unitario: 0,
        parcial: 0,
    };
}

export function resolveParentsWithSyntheticFill(
    rows: DelphinRow[],
    existingPartidaToId: Map<string, number>,
    startTmpId: number,
): { augmentedRows: DelphinRow[]; createdPartidas: string[] } {
    let nextId = startTmpId;
    const createdPartidas: string[] = [];
    const synthetic: DelphinRow[] = [];

    // Build combined lookup: existing tree + incoming rows
    const allByPartida = new Map(existingPartidaToId);
    for (const row of rows) allByPartida.set(row.partida, row.id);

    // Process shortest partidas first so parent synthetics are created before their children
    const sorted = [...rows].sort((a, b) => {
        const da = a.partida.split('.').length;
        const db = b.partida.split('.').length;
        return da !== db ? da - db : a.partida.localeCompare(b.partida);
    });

    for (const row of sorted) {
        const segs = row.partida.split('.');
        if (segs.length <= 1) continue;

        // Walk up the chain and collect any missing ancestors
        let checkCode = segs.slice(0, -1).join('.');
        const missing: string[] = [];
        while (checkCode && !allByPartida.has(checkCode)) {
            missing.unshift(checkCode);
            const cs = checkCode.split('.');
            checkCode = cs.length > 1 ? cs.slice(0, -1).join('.') : '';
        }

        for (const code of missing) {
            const codeSegs = code.split('.');
            const parentCode =
                codeSegs.length > 1 ? codeSegs.slice(0, -1).join('.') : null;
            const synId = nextId--;
            synthetic.push(
                makeSyntheticRow(
                    synId,
                    code,
                    parentCode ? (allByPartida.get(parentCode) ?? null) : null,
                ),
            );
            allByPartida.set(code, synId);
            createdPartidas.push(code);
        }
    }

    const importedCodes = new Set([
        ...rows.map((row) => row.partida),
        ...synthetic.map((row) => row.partida),
    ]);
    const siblingGroups = new Map<string, Set<number>>();
    for (const code of importedCodes) {
        const segs = code.split('.');
        const last = segs[segs.length - 1];
        if (!/^\d+$/.test(last)) continue;

        const parentCode = segs.length > 1 ? segs.slice(0, -1).join('.') : '';
        if (!siblingGroups.has(parentCode))
            siblingGroups.set(parentCode, new Set());
        siblingGroups.get(parentCode)!.add(Number(last));
    }

    const gapRows: DelphinRow[] = [];
    for (const [parentCode, numbers] of siblingGroups) {
        const ordered = [...numbers].sort((a, b) => a - b);
        if (ordered.length < 2) continue;

        for (let index = 1; index < ordered.length; index++) {
            const previous = ordered[index - 1];
            const current = ordered[index];
            for (let missing = previous + 1; missing < current; missing++) {
                const code = parentCode
                    ? `${parentCode}.${missing}`
                    : String(missing);
                if (allByPartida.has(code)) continue;

                const synId = nextId--;
                gapRows.push(
                    makeSyntheticRow(
                        synId,
                        code,
                        parentCode
                            ? (allByPartida.get(parentCode) ?? null)
                            : null,
                    ),
                );
                allByPartida.set(code, synId);
                createdPartidas.push(code);
            }
        }
    }

    // Re-resolve parent_id for every incoming row now that the map is complete
    const resolvedRows = [...synthetic, ...gapRows, ...rows].map((row) => {
        const segs = row.partida.split('.');
        if (segs.length <= 1) return { ...row, parent_id: null };
        const parentCode = segs.slice(0, -1).join('.');
        return { ...row, parent_id: allByPartida.get(parentCode) ?? null };
    });

    return {
        augmentedRows: resolvedRows.sort((a, b) =>
            a.partida.localeCompare(b.partida, undefined, { numeric: true }),
        ),
        createdPartidas,
    };
}

// When cronograma is empty but presupuesto has data, synthesize GanttTask skeletons
// so the budget tree is still visible. CPM fields (dates, duration) default to empty.
function synthesizeTasksFromRows(rows: any[]): GanttTask[] {
    const partidaToId = new Map<string, number>(
        rows.map((r: any) => [String(r.partida ?? ''), Number(r.id)]),
    );
    return rows.map((row: any) => {
        const partida = String(row.partida ?? '');
        const nivelFromPartida = partida !== '' ? partida.split('.').length : 1;
        const nivel = Number(row.nivel ?? 0) || nivelFromPartida;
        let parentId: number | null = row.parent_id ?? null;
        if (!parentId && partida.includes('.')) {
            const parts = partida.split('.');
            parts.pop();
            parentId = partidaToId.get(parts.join('.')) ?? null;
        }
        return {
            id: Number(row.id),
            parent_id: parentId,
            nivel,
            item_order: Number(row.item_order ?? 0),
            partida,
            descripcion: String(row.descripcion ?? ''),
            duracion_dias: 0,
            fecha_inicio: null,
            fecha_fin: null,
            avance: 0,
            predecesoras: [],
            presupuesto: Number(row.parcial ?? 0),
        } as GanttTask;
    });
}

export function useDelphinData({
    initialTasks,
    initialRows,
    schedulingMode,
    calendarSettings,
}: Options) {
    // If cronograma is empty but presupuesto has rows, build synthetic tasks so
    // the budget panel is visible. CPM data will be blank until the user fills it.
    const effectiveTasks: GanttTask[] =
        initialTasks.length > 0 || initialRows.length === 0
            ? initialTasks
            : synthesizeTasksFromRows(initialRows);

    // ── Budget state keyed by gantt task ID ────────────────────────────────────
    const [budgetMap, setBudgetMap] = useState<Map<number, BudgetFields>>(
        () => {
            const map = new Map<number, BudgetFields>();
            for (const task of effectiveTasks) {
                const br = initialRows.find((r) => r.partida === task.partida);
                const metrado = +(br?.metrado ?? 0);
                const precio_unitario = +(br?.precio_unitario ?? 0);
                // Siempre recalcula parcial desde metrado × precio_unitario (misma fila) en
                // vez de confiar en el valor guardado en BD: si precio_unitario se actualizó
                // (ej. sync de precio del ACU) sin que ese guardado alcanzara a persistir el
                // parcial recalculado, el valor guardado queda desincronizado — Costo Directo
                // terminaría sumando un monto viejo mientras el resto de la app (Insumos
                // Consolidados, etc.) ya usa el precio_unitario fresco. Solo se usa el valor
                // guardado como respaldo cuando no hay factores para recalcular (datos legado
                // sin metrado/precio_unitario) — evita que la columna Total se vea en cero.
                const storedParcial = +(br?.parcial ?? 0);
                const computedParcial = round2(metrado * precio_unitario);
                const parcial = computedParcial !== 0 ? computedParcial : storedParcial;
                map.set(task.id, {
                    unidad: br?.unidad ?? '',
                    metrado,
                    precio_unitario,
                    parcial,
                });
            }
            return map;
        },
    );
    const [budgetDirty, setBudgetDirty] = useState(false);
    const [isSavingBudget, setIsSavingBudget] = useState(false);

    // ── Gantt state ────────────────────────────────────────────────────────────
    // preservePartidaCodes=true: keeps Excel-imported partida codes across page reloads
    // instead of regenerating them from the task's sibling position in the tree.
    const ganttState = useGanttTasks(
        effectiveTasks,
        schedulingMode,
        calendarSettings,
        true,
    );

    // ── Pending budget from Excel import (partida or desc → BudgetFields) ─────
    const pendingBudgetRef = useRef<Map<string, BudgetFields> | null>(null);

    // Stable refs so callbacks always read the latest tasks/budget without
    // needing them as useCallback deps (avoids stale-closure bugs).
    const latestTasksRef = useRef(ganttState.tasks);
    const latestBudgetRef = useRef(budgetMap);
    latestTasksRef.current = ganttState.tasks;
    latestBudgetRef.current = budgetMap;

    // ── Sync budget entries when tasks are added/removed ──────────────────────
    const prevTaskIdsRef = useRef(new Set(initialTasks.map((t) => t.id)));

    useEffect(() => {
        const currentIds = new Set(ganttState.tasks.map((t) => t.id));

        // ── Excel import: apply pending budget keyed by partida ───────────────
        if (pendingBudgetRef.current) {
            const pending = pendingBudgetRef.current;
            pendingBudgetRef.current = null;
            const next = new Map<number, BudgetFields>();
            ganttState.tasks.forEach((t) => {
                next.set(
                    t.id,
                    pending.get(t.partida) ??
                        pending.get(normalizeForMatch(t.descripcion)) ??
                        defaultBudget(),
                );
            });
            setBudgetMap(next);
            setBudgetDirty(true);
            prevTaskIdsRef.current = currentIds;
            return;
        }

        // ── Normal sync: only fill in newly added rows with defaults ──────────
        const additions: number[] = [];
        currentIds.forEach((id) => {
            if (!prevTaskIdsRef.current.has(id)) additions.push(id);
        });
        if (additions.length > 0) {
            setBudgetMap((prev) => {
                const next = new Map(prev);
                additions.forEach((id) => {
                    if (!next.has(id)) next.set(id, defaultBudget());
                });
                return next;
            });
        }
        prevTaskIdsRef.current = currentIds;
    }, [ganttState.tasks]);

    // ── Merged rows for display (with hierarchical parcial sums) ─────────────
    const delphinRows = useMemo<DelphinRow[]>(() => {
        const raw = ganttState.tasks.map((task) => ({
            ...task,
            ...(budgetMap.get(task.id) ?? defaultBudget()),
        }));

        // Bottom-up aggregation: group nodes = sum of children; leaves keep their own parcial
        const gids = ganttState.groupIds;
        const parcialMap = new Map<number, number>();
        for (const row of raw) {
            parcialMap.set(row.id, gids.has(row.id) ? 0 : (row.parcial ?? 0));
        }
        for (let i = raw.length - 1; i >= 0; i--) {
            const row = raw[i];
            if (row.parent_id != null) {
                const pid = Number(row.parent_id);
                if (parcialMap.has(pid)) {
                    parcialMap.set(
                        pid,
                        (parcialMap.get(pid) ?? 0) +
                            (parcialMap.get(row.id) ?? 0),
                    );
                }
            }
        }

        return raw.map((row) => {
            const computed = round2(parcialMap.get(row.id) ?? row.parcial);
            return computed === row.parcial
                ? row
                : { ...row, parcial: computed };
        });
    }, [ganttState.tasks, budgetMap, ganttState.groupIds]);

    // Visible subset re-uses the already-computed hierarchical parcials from delphinRows
    const visibleDelphinRows = useMemo<DelphinRow[]>(() => {
        const parcialById = new Map(delphinRows.map((r) => [r.id, r.parcial]));
        return ganttState.visibleTasks.map((task) => ({
            ...task,
            ...(budgetMap.get(task.id) ?? defaultBudget()),
            parcial: parcialById.get(task.id) ?? 0,
        }));
    }, [ganttState.visibleTasks, budgetMap, delphinRows]);

    // ── Update budget field ────────────────────────────────────────────────────
    const updateBudgetField = useCallback(
        (id: number, field: string, value: any) => {
            setBudgetMap((prev) => {
                const next = new Map(prev);
                const cur = next.get(id) ?? defaultBudget();
                const upd = { ...cur, [field]: value };
                if (field === 'metrado' || field === 'precio_unitario') {
                    upd.parcial = round2(upd.metrado * upd.precio_unitario);
                }
                next.set(id, upd);
                return next;
            });
            setBudgetDirty(true);
        },
        [],
    );

    // ── Unified commitField ───────────────────────────────────────────────────
    const commitField = useCallback(
        (id: number, field: string, value: any) => {
            if (BUDGET_FIELD_KEYS.has(field)) {
                updateBudgetField(id, field, value);
            } else {
                ganttState.updateField(id, field as keyof GanttTask, value);
            }
        },
        [updateBudgetField, ganttState],
    );

    // ── Save budget ───────────────────────────────────────────────────────────
    const saveBudget = useCallback(
        async (projectId: number): Promise<boolean> => {
            setIsSavingBudget(true);
            try {
                const rows = ganttState.tasks.map((task) => {
                    const b = budgetMap.get(task.id) ?? defaultBudget();
                    return {
                        id: task.id,
                        partida: task.partida,
                        descripcion: task.descripcion,
                        unidad: b.unidad,
                        metrado: b.metrado,
                        precio_unitario: b.precio_unitario,
                        parcial: b.parcial,
                        item_order: task.item_order,
                        // presupuesto_general uses partida notation for hierarchy,
                        // not parent_id/nivel — omit to avoid column-not-found 500
                    };
                });
                await axios.patch(
                    `/costos/proyectos/${projectId}/presupuesto/general`,
                    { rows },
                );
                setBudgetDirty(false);
                return true;
            } catch {
                return false;
            } finally {
                setIsSavingBudget(false);
            }
        },
        [ganttState.tasks, budgetMap],
    );

    // ── Bulk import from Excel (Presupuesto General) ──────────────────────────
    const importDelphinRows = useCallback(
        ({ rows }: ParsePresupuestoResult): { createdPartidas: string[] } => {
            const existingTasks = latestTasksRef.current;
            const currentBudget = latestBudgetRef.current;

            // ── First import (empty tree) ─────────────────────────────────────
            if (existingTasks.length === 0) {
                const minRowId = rows.reduce(
                    (min, r) => Math.min(min, r.id),
                    0,
                );
                const { augmentedRows, createdPartidas } =
                    resolveParentsWithSyntheticFill(
                        rows,
                        new Map<string, number>(),
                        minRowId - 1,
                    );

                const budgetByPartida = new Map<string, BudgetFields>();
                for (const row of rows) {
                    budgetByPartida.set(row.partida, {
                        unidad: row.unidad,
                        metrado: row.metrado,
                        precio_unitario: row.precio_unitario,
                        parcial: row.parcial,
                    });
                }
                for (const row of augmentedRows) {
                    if (!budgetByPartida.has(row.partida))
                        budgetByPartida.set(row.partida, defaultBudget());
                }

                pendingBudgetRef.current = budgetByPartida;
                ganttState.importTasks(augmentedRows as GanttTask[]);
                return { createdPartidas };
            }

            // ── Subsequent imports: MERGE ─────────────────────────────────────
            const existingByPartida = new Map(
                existingTasks.map((t) => [t.partida, t]),
            );
            const existingByDesc = new Map(
                existingTasks.map((t) => [normalizeForMatch(t.descripcion), t]),
            );
            const existingPartidaToId = new Map(
                existingTasks.map((t) => [t.partida, t.id]),
            );

            // Remap ALL parsed row IDs to avoid collisions with existing IDs
            const minExistingId = existingTasks.reduce(
                (min, t) => Math.min(min, t.id),
                0,
            );
            const minParsedId = rows.reduce((min, r) => Math.min(min, r.id), 0);
            let nextRemapId = Math.min(minExistingId, minParsedId) - 1;
            const oldToNewId = new Map<number, number>();
            for (const r of rows) oldToNewId.set(r.id, nextRemapId--);

            // Apply remap: new IDs + remap parent_id refs within the same file
            const remappedRows: DelphinRow[] = rows.map((r) => ({
                ...r,
                id: oldToNewId.get(r.id)!,
                parent_id:
                    r.parent_id != null
                        ? (oldToNewId.get(r.parent_id) ?? null)
                        : null,
            }));

            const furtherNeg =
                remappedRows.reduce(
                    (min, r) => Math.min(min, r.id),
                    nextRemapId,
                ) - 1;
            const { augmentedRows: normalizedRows, createdPartidas } =
                resolveParentsWithSyntheticFill(
                    remappedRows,
                    existingPartidaToId,
                    furtherNeg,
                );

            // Separate: truly new rows vs rows that update existing partidas.
            // Code match is only accepted when the descriptions are similar (codeMatchIsValid).
            // This prevents rows like "VALVULA ESFERICA" from being treated as "already matched"
            // just because another item ("EMPALME") shares the same code in the DB.
            const newRows: DelphinRow[] = normalizedRows.filter((r) => {
                const byCode = existingByPartida.get(r.partida);
                if (
                    byCode &&
                    codeMatchIsValid(byCode.descripcion, r.descripcion)
                )
                    return false;
                if (existingByDesc.has(normalizeForMatch(r.descripcion)))
                    return false;
                return true;
            });

            // Full budget map: preserve existing, override/add with imported values.
            // Keys are either partida codes OR normalizedForMatch(description) so the
            // pending-budget resolver (which tries both) can find the correct entry even
            // when Excel codes differ from DB codes.
            const allBudgetByPartida = new Map<string, BudgetFields>();
            for (const t of existingTasks) {
                const b = currentBudget.get(t.id);
                if (b) allBudgetByPartida.set(t.partida, b);
            }
            for (const row of rows) {
                const budget: BudgetFields = {
                    unidad: row.unidad,
                    metrado: row.metrado,
                    precio_unitario: row.precio_unitario,
                    parcial: row.parcial,
                };
                // Always store by description so the pending resolver finds it via
                // the normalizeForMatch(t.descripcion) secondary lookup.
                const descKey = normalizeForMatch(row.descripcion);
                if (descKey) allBudgetByPartida.set(descKey, budget);
                // Store by code only when there is no conflicting DB item at that code.
                // Skipping avoids writing "VALVULA ESFERICA" data into the slot keyed
                // by the code that the DB uses for "EMPALME DE TUBERIA".
                const codeConflict = existingByPartida.get(row.partida);
                if (
                    !codeConflict ||
                    codeMatchIsValid(codeConflict.descripcion, row.descripcion)
                ) {
                    allBudgetByPartida.set(row.partida, budget);
                }
            }

            if (newRows.length === 0) {
                // Only budget updates — skip rebuilding task tree.
                // First pass: resolve matches and collect both budget updates and partida
                // code updates so we can update ganttState outside the setBudgetMap callback.
                const budgetUpdates = new Map<number, BudgetFields>();
                const codeUpdates: Array<{ id: number; newPartida: string }> =
                    [];

                for (const row of remappedRows) {
                    const byCode = existingByPartida.get(row.partida);
                    const validCodeHit =
                        byCode &&
                        codeMatchIsValid(byCode.descripcion, row.descripcion)
                            ? byCode
                            : undefined;
                    const existing =
                        validCodeHit ??
                        existingByDesc.get(normalizeForMatch(row.descripcion));
                    if (existing) {
                        budgetUpdates.set(existing.id, {
                            unidad: row.unidad,
                            metrado: row.metrado,
                            precio_unitario: row.precio_unitario,
                            parcial: row.parcial,
                        });
                        // When matched by description (not by code), adopt the Excel partida
                        // code so the DB and future ACU imports use the same numbering.
                        if (
                            !validCodeHit &&
                            row.partida &&
                            existing.partida !== row.partida
                        ) {
                            codeUpdates.push({
                                id: existing.id,
                                newPartida: row.partida,
                            });
                        }
                    }
                }

                setBudgetMap((prev) => {
                    const next = new Map(prev);
                    budgetUpdates.forEach((budget, id) => next.set(id, budget));
                    return next;
                });

                // Update task partida codes in gantt state so the tree reflects Excel codes
                // immediately (current session) and persists to DB on next saveBudget call.
                for (const { id, newPartida } of codeUpdates) {
                    ganttState.updateField(id, 'partida', newPartida);
                }

                setBudgetDirty(true);
                return { createdPartidas: [] };
            }

            for (const row of newRows) {
                if (!allBudgetByPartida.has(row.partida))
                    allBudgetByPartida.set(row.partida, defaultBudget());
            }

            // Remap partida codes on existing tasks that were matched by DESCRIPTION
            // (not by code) so the tree adopts Excel numbering. With preservePartidaCodes=true,
            // recomputeHierarchy will keep whichever code is stored on each task — patching
            // here ensures the Excel code survives the rebuild.
            const codeRemap = new Map<number, string>();
            for (const row of rows) {
                const byCode = existingByPartida.get(row.partida);
                const validCodeHit =
                    byCode &&
                    codeMatchIsValid(byCode.descripcion, row.descripcion)
                        ? byCode
                        : undefined;
                const existing =
                    validCodeHit ??
                    existingByDesc.get(normalizeForMatch(row.descripcion));
                if (
                    existing &&
                    !validCodeHit &&
                    row.partida &&
                    existing.partida !== row.partida
                ) {
                    codeRemap.set(existing.id, row.partida);
                }
            }
            const remappedExistingTasks =
                codeRemap.size > 0
                    ? existingTasks.map((t) =>
                          codeRemap.has(t.id)
                              ? { ...t, partida: codeRemap.get(t.id)! }
                              : t,
                      )
                    : existingTasks;

            pendingBudgetRef.current = allBudgetByPartida;
            ganttState.importTasks([...remappedExistingTasks, ...newRows]);
            return { createdPartidas };
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ganttState.importTasks, ganttState.updateField],
    );

    // ── Renombrar la partida raíz y propagar a todos sus descendientes ────────
    // Solo para nodos de nivel 1 (partidas padre). Actualiza la clave de todos
    // los hijos: "1.02" → "4.02" si el padre cambia de "1" a "4".
    const renameRootPartida = useCallback(
        (rootId: number, newPartida: string) => {
            const trimmed = newPartida.trim();
            if (!trimmed) return;
            const currentTasks = latestTasksRef.current;
            const rootTask = currentTasks.find((t) => t.id === rootId);
            if (!rootTask || rootTask.nivel !== 1) return;
            const oldPartida = rootTask.partida;
            if (trimmed === oldPartida) return;

            const updates: Array<{ id: number; partida: string }> = [
                { id: rootId, partida: trimmed },
            ];
            const prefix = oldPartida + '.';
            for (const task of currentTasks) {
                if (task.partida.startsWith(prefix)) {
                    updates.push({
                        id: task.id,
                        partida: trimmed + '.' + task.partida.slice(prefix.length),
                    });
                }
            }

            ganttState.batchUpdatePartidas(updates);
            setBudgetDirty(true);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ganttState.batchUpdatePartidas],
    );

    // ── Import Cronograma (MS Project XML) with budget preservation ───────────
    // When budget data already exists, the incoming tasks are matched by partida
    // (exact) then by normalized description (fallback) so that budget fields
    // survive the import instead of being wiped out.
    const importCronogramaTasks = useCallback(
        (newTasks: GanttTask[]) => {
            const existingTasks = latestTasksRef.current;
            const currentBudget = latestBudgetRef.current;
            const hasBudget = existingTasks.some((t) => {
                const b = currentBudget.get(t.id);
                return (
                    b && (b.metrado > 0 || b.precio_unitario > 0 || !!b.unidad)
                );
            });

            if (!hasBudget) {
                ganttState.importTasks(newTasks);
                return;
            }

            // Build pending budget keyed by BOTH partida and normalized description.
            // After importTasks → recomputeHierarchy regenerates partida codes; the
            // useEffect will try partida first, then description as fallback.
            const pending = new Map<string, BudgetFields>();
            for (const t of existingTasks) {
                const b = currentBudget.get(t.id);
                if (!b) continue;
                if (t.partida) pending.set(t.partida, b);
                const desc = normalizeForMatch(t.descripcion);
                if (desc && !pending.has(desc)) pending.set(desc, b);
            }

            pendingBudgetRef.current = pending;
            ganttState.importTasks(newTasks);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ganttState.importTasks],
    );

    return {
        delphinRows,
        visibleDelphinRows,
        budgetDirty,
        isSavingBudget,
        saveBudget,
        commitField,
        tasks: ganttState.tasks,
        visibleTasks: ganttState.visibleTasks,
        taskById: ganttState.taskById,
        groupIds: ganttState.groupIds,
        expandedIds: ganttState.expandedIds,
        isDirty: ganttState.isDirty,
        isSaving: ganttState.isSaving,
        updateField: ganttState.updateField,
        toggleExpand: ganttState.toggleExpand,
        expandAll: ganttState.expandAll,
        collapseAll: ganttState.collapseAll,
        addTaskAfter: ganttState.addTaskAfter,
        addChildTask: ganttState.addChildTask,
        deleteTask: ganttState.deleteTask,
        indentTask: ganttState.indentTask,
        outdentTask: ganttState.outdentTask,
        moveTaskUp: ganttState.moveTaskUp,
        moveTaskDown: ganttState.moveTaskDown,
        duplicateTask: ganttState.duplicateTask,
        saveTasks: ganttState.saveTasks,
        applyBarMove: ganttState.applyBarMove,
        importTasks: ganttState.importTasks,
        importDelphinRows,
        importCronogramaTasks,
        renameRootPartida,
    };
}
