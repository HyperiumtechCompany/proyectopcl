export type PredecessorType = 'FC' | 'CC' | 'FF' | 'CF';
export type SchedulingMode = 'automatic' | 'manual';

export interface Predecessor {
    taskId: number;
    tipo: PredecessorType;
    lag: number;
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

export function formatPredecessoras(preds: Predecessor[]): string {
    if (!preds.length) return '';
    return preds
        .map((p) => {
            const lagStr =
                p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? String(p.lag) : '';
            return `${p.taskId}${p.tipo}${lagStr}`;
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
