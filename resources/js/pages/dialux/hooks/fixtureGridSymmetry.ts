/**
 * fixtureGridSymmetry.ts -- Asesor de simetria entre modulos de grilla de
 * luminarias adyacentes (ej. una fila de 3 areas proyectadas por separado:
 * 3x2 -- 2x6 -- 4x2, donde el modulo central rompe la simetria visual/
 * luminica con los extremos, y los extremos tampoco coinciden entre si).
 *
 * Cada "modulo" es un grupo de luminarias con el mismo `gridGroupId` (creado
 * por una proyeccion confirmada, o reorganizado despues). Este archivo NO
 * construye nada por si mismo -- solo detecta la secuencia de modulos
 * alineados y adyacentes que incluye un grupo dado, decide si esa secuencia
 * es simetrica, y devuelve las correcciones (grupo -> filas/columnas
 * propuestas) para las 2 estrategias con solucion univoca: espejo total y
 * uniformidad absoluta. La progresion escalonada (opcion 3) es
 * intrinsecamente ambigua (que tamanos intermedios usar) y se deja como
 * sugerencia de texto, no como correccion automatica.
 */

import type { Fixture } from './types';

export interface FixtureGridModule {
    groupId: string;
    rows: number;
    columns: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface SymmetryCorrection {
    groupId: string;
    rows: number;
    columns: number;
}

export interface SymmetrySuggestion {
    kind: 'mirror' | 'uniform';
    label: string;
    corrections: SymmetryCorrection[];
}

export interface SymmetryCheckResult {
    sequence: FixtureGridModule[];
    mirror: SymmetrySuggestion;
    uniform: SymmetrySuggestion;
    /** true si la secuencia tiene 3+ modulos con formas distintas -- solo entonces vale la pena sugerir una progresion escalonada (guia de texto, sin boton). */
    suggestProgression: boolean;
}

const ALIGNMENT_MIN_OVERLAP = 0.4;
const ADJACENCY_GAP_FACTOR = 1.5;
const ADJACENCY_BASE_TOLERANCE_M = 0.5;
/** Tolerancia (m) para agrupar coordenadas al inferir filas/columnas de fixtures legacy sin gridRows/gridColumns persistidos. */
const LEGACY_CLUSTER_TOLERANCE_M = 0.3;

function inferDistinctCount(values: number[]): number {
    if (values.length === 0) return 1;
    const sorted = [...values].sort((a, b) => a - b);
    let count = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > LEGACY_CLUSTER_TOLERANCE_M) count++;
    }
    return count;
}

/**
 * Agrupa las luminarias del room por `gridGroupId` y arma un modulo por
 * grupo (bbox + filas/columnas). Grupos sin `gridRows`/`gridColumns`
 * persistidos (fixtures creados antes de esta fase) infieren la cantidad de
 * filas/columnas agrupando coordenadas X/Y por cercania -- aproximado, pero
 * nunca bloquea el analisis por datos viejos.
 */
export function deriveFixtureGridModules(
    fixtures: Fixture[],
    roomId: string | undefined,
): FixtureGridModule[] {
    const byGroup = new Map<string, Fixture[]>();
    for (const f of fixtures) {
        if (!f.gridGroupId) continue;
        if (roomId !== undefined && f.roomId !== roomId) continue;
        const arr = byGroup.get(f.gridGroupId) ?? [];
        arr.push(f);
        byGroup.set(f.gridGroupId, arr);
    }

    const modules: FixtureGridModule[] = [];
    for (const [groupId, group] of byGroup) {
        if (group.length === 0) continue;
        const xs = group.map((f) => f.x);
        const ys = group.map((f) => f.y);
        const rows = group[0].gridRows ?? inferDistinctCount(ys);
        const columns = group[0].gridColumns ?? inferDistinctCount(xs);
        modules.push({
            groupId,
            rows,
            columns,
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        });
    }
    return modules;
}

function overlapFraction(aMin: number, aMax: number, bMin: number, bMax: number): number {
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
    const minSpan = Math.min(aMax - aMin, bMax - bMin) || 0.01;
    return Math.max(0, overlap) / minSpan;
}

function buildAdjacentChain(
    candidates: FixtureGridModule[],
    targetGroupId: string,
    axis: 'x' | 'y',
): FixtureGridModule[] | null {
    const getMin = (m: FixtureGridModule) => (axis === 'x' ? m.minX : m.minY);
    const getMax = (m: FixtureGridModule) => (axis === 'x' ? m.maxX : m.maxY);
    const sorted = [...candidates].sort((a, b) => getMin(a) - getMin(b));
    const targetIndex = sorted.findIndex((m) => m.groupId === targetGroupId);
    if (targetIndex === -1) return null;

    const chain = [sorted[targetIndex]];

    for (let i = targetIndex + 1; i < sorted.length; i++) {
        const prev = chain[chain.length - 1];
        const span = getMax(prev) - getMin(prev);
        const gap = getMin(sorted[i]) - getMax(prev);
        if (gap > span * ADJACENCY_GAP_FACTOR + ADJACENCY_BASE_TOLERANCE_M) break;
        chain.push(sorted[i]);
    }
    for (let i = targetIndex - 1; i >= 0; i--) {
        const next = chain[0];
        const span = getMax(next) - getMin(next);
        const gap = getMin(next) - getMax(sorted[i]);
        if (gap > span * ADJACENCY_GAP_FACTOR + ADJACENCY_BASE_TOLERANCE_M) break;
        chain.unshift(sorted[i]);
    }
    return chain;
}

/**
 * Busca la secuencia de modulos alineados (misma fila o misma columna) y
 * adyacentes (sin huecos grandes) a lo largo de un eje que incluye a
 * `groupId`, ordenada por posicion. `null` si no forma parte de ninguna
 * secuencia de 2 o mas.
 */
export function findAdjacentModuleSequence(
    modules: FixtureGridModule[],
    groupId: string,
): FixtureGridModule[] | null {
    const target = modules.find((m) => m.groupId === groupId);
    if (!target) return null;

    const rowCandidates = modules.filter(
        (m) =>
            m.groupId === target.groupId ||
            overlapFraction(m.minY, m.maxY, target.minY, target.maxY) >= ALIGNMENT_MIN_OVERLAP,
    );
    const rowSeq = buildAdjacentChain(rowCandidates, groupId, 'x');
    if (rowSeq && rowSeq.length >= 2) return rowSeq;

    const colCandidates = modules.filter(
        (m) =>
            m.groupId === target.groupId ||
            overlapFraction(m.minX, m.maxX, target.minX, target.maxX) >= ALIGNMENT_MIN_OVERLAP,
    );
    const colSeq = buildAdjacentChain(colCandidates, groupId, 'y');
    if (colSeq && colSeq.length >= 2) return colSeq;

    return null;
}

function sameShape(a: FixtureGridModule, b: FixtureGridModule): boolean {
    return a.rows === b.rows && a.columns === b.columns;
}

/** Uniforme (todas iguales) cuenta como caso particular de espejo -- ambos son "simetrico". */
export function isSequenceSymmetric(sequence: FixtureGridModule[]): boolean {
    const n = sequence.length;
    for (let i = 0; i < Math.floor(n / 2); i++) {
        if (!sameShape(sequence[i], sequence[n - 1 - i])) return false;
    }
    return true;
}

function formatSequence(sequence: FixtureGridModule[], overrides: Map<string, { rows: number; columns: number }>): string {
    return sequence
        .map((m) => {
            const o = overrides.get(m.groupId);
            const columns = o?.columns ?? m.columns;
            const rows = o?.rows ?? m.rows;
            return `${columns}×${rows}`;
        })
        .join(' — ');
}

/**
 * Simetria espejo total: para cada pareja de modulos equidistantes de los
 * extremos, el mas cercano al inicio de la secuencia impone su forma al
 * otro (el elemento central, si la secuencia es impar, no se toca).
 */
export function suggestMirrorCorrection(sequence: FixtureGridModule[]): SymmetrySuggestion {
    const n = sequence.length;
    const overrides = new Map<string, { rows: number; columns: number }>();
    for (let i = 0; i < Math.floor(n / 2); i++) {
        const j = n - 1 - i;
        const a = sequence[i];
        const b = sequence[j];
        if (!sameShape(a, b)) {
            overrides.set(a.groupId, { rows: a.rows, columns: a.columns });
            overrides.set(b.groupId, { rows: a.rows, columns: a.columns });
        }
    }
    const corrections: SymmetryCorrection[] = [...overrides.entries()].map(([groupId, shape]) => ({
        groupId,
        ...shape,
    }));
    return {
        kind: 'mirror',
        label: `Simetría espejo: ${formatSequence(sequence, overrides)}`,
        corrections,
    };
}

/**
 * Uniformidad absoluta: todos los modulos toman la forma mas frecuente en
 * la secuencia (empate = la del primer modulo).
 */
export function suggestUniformCorrection(sequence: FixtureGridModule[]): SymmetrySuggestion {
    const counts = new Map<string, { rows: number; columns: number; count: number }>();
    for (const m of sequence) {
        const key = `${m.columns}x${m.rows}`;
        const entry = counts.get(key) ?? { rows: m.rows, columns: m.columns, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
    }
    let best = { rows: sequence[0].rows, columns: sequence[0].columns, count: 0 };
    for (const entry of counts.values()) {
        if (entry.count > best.count) best = entry;
    }

    const overrides = new Map<string, { rows: number; columns: number }>();
    const corrections: SymmetryCorrection[] = [];
    for (const m of sequence) {
        if (m.rows === best.rows && m.columns === best.columns) continue;
        overrides.set(m.groupId, { rows: best.rows, columns: best.columns });
        corrections.push({ groupId: m.groupId, rows: best.rows, columns: best.columns });
    }
    return {
        kind: 'uniform',
        label: `Uniformidad: ${formatSequence(sequence, overrides)}`,
        corrections,
    };
}

/**
 * Punto de entrada: analiza la secuencia de modulos adyacentes a
 * `newGroupId` dentro del room y devuelve las sugerencias de correccion si
 * la secuencia es asimetrica. `null` si no aplica (grupo aislado, o ya
 * simetrico -- ningun aviso que mostrar).
 */
export function checkGroupSymmetry(
    fixtures: Fixture[],
    roomId: string | undefined,
    newGroupId: string,
): SymmetryCheckResult | null {
    const modules = deriveFixtureGridModules(fixtures, roomId);
    const sequence = findAdjacentModuleSequence(modules, newGroupId);
    if (!sequence || sequence.length < 2) return null;
    if (isSequenceSymmetric(sequence)) return null;

    const distinctShapes = new Set(sequence.map((m) => `${m.columns}x${m.rows}`));
    return {
        sequence,
        mirror: suggestMirrorCorrection(sequence),
        uniform: suggestUniformCorrection(sequence),
        suggestProgression: sequence.length >= 3 && distinctShapes.size >= 3,
    };
}
