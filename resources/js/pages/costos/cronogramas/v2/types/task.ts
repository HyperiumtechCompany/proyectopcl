export type PredecessorType = 'FC' | 'CC' | 'FF' | 'CF';
export type SchedulingMode = 'automatic' | 'manual';

/** Snapshot legible del destino de una predecesora, tomado al crear el vínculo.
 *  No participa en ningún cálculo: sirve para mostrar el vínculo, avisar cuando
 *  el destino fue borrado y re-mapear vínculos legado. */
export interface PredecessorRef {
    codigo: string;
    desc: string;
}

export interface Predecessor {
    /** Legado / display para entrada manual: item_order (Nº de fila) al momento
     *  de crear o guardar el vínculo. Solo se usa como respaldo cuando falta refId. */
    taskId: number;
    tipo: PredecessorType;
    lag: number;
    /** Ancla estable: id de cronograma_general de la tarea predecesora. Inmune a
     *  la renumeración de item_order (agregar/borrar/mover/reordenar partidas). */
    refId?: number | null;
    /** Snapshot código+descripción del destino al crear el vínculo. */
    ref?: PredecessorRef | null;
}

/**
 * id de tarea estable al que apunta una predecesora.
 * Prioridad: refId (id de BD, inmune a renumeración) → taskId como item_order (legado).
 * Devuelve null si el vínculo está roto (la fila destino ya no existe).
 */
export function resolvePredecessorTaskId(
    pred: Pick<Predecessor, 'taskId' | 'refId'>,
    hasTaskId: (id: number) => boolean,
    idByItemOrder: Map<number, number>,
): number | null {
    if (pred.refId != null && hasTaskId(pred.refId)) return pred.refId;
    const byOrder = idByItemOrder.get(Number(pred.taskId));
    return byOrder != null && hasTaskId(byOrder) ? byOrder : null;
}

export interface GanttTask {
    id: number;
    parent_id: number | null;
    nivel: number;
    item_order: number;
    partida: string;
    descripcion: string;
    duracion_dias: number;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    avance: number;
    predecesoras: Predecessor[];
    presupuesto: number;
}

export type TaskField = keyof GanttTask;

export function formatPredecessoras(
    preds: Predecessor[],
    /** id → item_order en vivo. Si se pasa, el Nº mostrado se recalcula desde el
     *  árbol actual (via refId) en vez de usar el número guardado, que envejece. */
    itemOrderById?: Map<number, number>,
): string {
    if (!preds.length) return '';
    return preds
        .map((p) => {
            const lagStr =
                p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? String(p.lag) : '';
            const num =
                (itemOrderById && p.refId != null
                    ? itemOrderById.get(p.refId)
                    : undefined) ?? p.taskId;
            return `${num}${p.tipo}${lagStr}`;
        })
        .join(', ');
}

export function parsePredecessoras(text: string): Predecessor[] {
    if (!text.trim()) return [];
    const parts = text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const result: Predecessor[] = [];
    for (const part of parts) {
        const match = part.match(/^(\d+)(FC|CC|FF|CF)?([+-]\d+)?$/i);
        if (!match) continue;
        result.push({
            taskId: parseInt(match[1]),
            tipo: (match[2] ?? 'FC').toUpperCase() as PredecessorType,
            lag: match[3] ? parseInt(match[3]) : 0,
        });
    }
    return result;
}
