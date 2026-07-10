import React, { useMemo } from 'react';
import type { GanttTask } from '../../types/task';
import type { GanttTimeline } from '../../types/timeline';
import { ROW_HEIGHT } from '../../types/cell';
import { normalizeGanttDate } from '../../utils/date';

const HOOK = 20; // px del gancho de salida/llegada

/**
 * Construye el path SVG para una flecha de dependencia.
 *
 * Invariante: el ÚLTIMO segmento horizontal siempre llega al borde target
 * en la dirección correcta, para que markerEnd (punta) apunte bien:
 *   FC / CC  → llega al borde IZQ de succ yendo →  (último H  x2 donde x2 > punto previo)
 *   FF / CF  → llega al borde DER de succ yendo ←  (último H  x2 donde x2 < punto previo)
 *
 * Cuando no hay espacio suficiente (close/back-link), el path rodea por el
 * lateral correcto de las barras, evitando una vuelta vertical extra.
 */
export function buildArrowPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    tipo: string,
): string {
    const fmt = (n: number) => n.toFixed(1);
    const M = `M ${fmt(x1)},${fmt(y1)}`;

    if (tipo === 'FC') {
        // Llega al borde izq. de succ desde la izquierda  →
        const xj = x1 + HOOK;
        if (xj < x2) {
            // Normal: hook derecha, baja, llega →
            return `${M} H ${fmt(xj)} V ${fmt(y2)} H ${fmt(x2)}`;
        }
        // Cercano o retroceso: rodea por la izquierda.
        const xL = Math.min(x1, x2) - HOOK;
        return `${M} H ${fmt(xL)} V ${fmt(y2)} H ${fmt(x2)}`;
    }

    if (tipo === 'CC') {
        // Ambos bordes izq.; rodea por la izquierda de ambos → llega →
        const xL = Math.min(x1, x2) - HOOK;
        return `${M} H ${fmt(xL)} V ${fmt(y2)} H ${fmt(x2)}`;
    }

    if (tipo === 'FF') {
        // Ambos bordes der.; rodea por la derecha de ambos → llega ←
        const xR = Math.max(x1, x2) + HOOK;
        return `${M} H ${fmt(xR)} V ${fmt(y2)} H ${fmt(x2)}`;
    }

    if (tipo === 'CF') {
        // x1 = borde izq. pred, x2 = borde der. succ; llega ←
        const xj = x1 - HOOK;
        if (xj > x2) {
            return `${M} H ${fmt(xj)} V ${fmt(y2)} H ${fmt(x2)}`;
        }
        // Cercano o retroceso: rodea por la derecha.
        const xR = Math.max(x1, x2) + HOOK;
        return `${M} H ${fmt(xR)} V ${fmt(y2)} H ${fmt(x2)}`;
    }

    // Fallback FC
    return `${M} H ${fmt(x1 + HOOK)} V ${fmt(y2)} H ${fmt(x2)}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    visibleTasks:   GanttTask[];
    timeline:       GanttTimeline;
    criticalIds:    Set<number>;
    totalHeight:    number;
    /** Top del viewport (scrollTop del contenedor del chart) */
    viewportTop?:   number;
    /** Height del viewport del chart */
    viewportHeight?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
export function GanttDependencyLines({
    visibleTasks,
    timeline,
    criticalIds,
    totalHeight,
    viewportTop   = 0,
    viewportHeight = 800,
}: Props) {
    const ARROW_BUFFER = 200; // px extra arriba/abajo para incluir flechas parcialmente visibles
    const rowIndex = useMemo(
        () => new Map(visibleTasks.map((t, i) => [t.id, i])),
        [visibleTasks],
    );

    const getY = (id: number) => {
        const idx = rowIndex.get(id);
        return idx !== undefined ? idx * ROW_HEIGHT + ROW_HEIGHT / 2 : null;
    };
    const getBarL = (t: GanttTask) =>
        timeline.dateToX(normalizeGanttDate(t.fecha_inicio));
    const getBarR = (t: GanttTask) => {
        const end =
            normalizeGanttDate(t.fecha_fin) ??
            normalizeGanttDate(t.fecha_inicio);
        return timeline.dateToX(end) + timeline.dayWidth;
    };

    interface Arrow {
        path: string;
        x1: number; // coordenada x de origen (para el círculo de salida)
        y1: number;
        y2: number;
        critical: boolean;
    }

    const arrows = useMemo((): Arrow[] => {
        // pred.taskId contiene el item_order (Nº de fila), no el id de BD
        const taskByOrder = new Map(visibleTasks.map((t) => [t.item_order, t]));
        const taskById = new Map(visibleTasks.map((t) => [t.id, t]));
        const result: Arrow[] = [];

        for (const succ of visibleTasks) {
            if (!succ.fecha_inicio) continue;

            for (const pred of succ.predecesoras) {
                if (pred.taskId === succ.item_order) continue; // auto-loop
                const predTask =
                    taskByOrder.get(pred.taskId) ?? taskById.get(pred.taskId);
                if (!predTask?.fecha_inicio) continue;

                const y1 = getY(predTask.id);
                const y2 = getY(succ.id);
                if (y1 === null || y2 === null) continue;

                let x1: number;
                let x2: number;
                switch (pred.tipo) {
                    case 'FC':
                        x1 = getBarR(predTask);
                        x2 = getBarL(succ);
                        break;
                    case 'CC':
                        x1 = getBarL(predTask);
                        x2 = getBarL(succ);
                        break;
                    case 'FF':
                        x1 = getBarR(predTask);
                        x2 = getBarR(succ);
                        break;
                    case 'CF':
                        x1 = getBarL(predTask);
                        x2 = getBarR(succ);
                        break;
                    default:
                        x1 = getBarR(predTask);
                        x2 = getBarL(succ);
                }

                // criticalIds tiene ids de BD — usar predTask.id, no pred.taskId
                const critical =
                    criticalIds.has(predTask.id) && criticalIds.has(succ.id);

                result.push({
                    path: buildArrowPath(x1, y1, x2, y2, pred.tipo),
                    x1,
                    y1,
                    y2,
                    critical,
                });
            }
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleTasks, timeline, criticalIds]);

    // Filtrado por viewport: solo flechas cuyo y1 o y2 esté visible (+buffer)
    const visMin = viewportTop   - ARROW_BUFFER;
    const visMax = viewportTop   + viewportHeight + ARROW_BUFFER;
    const visibleArrows = arrows.filter(
        (a) => a.y1 >= visMin && a.y1 <= visMax || a.y2 >= visMin && a.y2 <= visMax,
    );

    if (!arrows.length) return null;

    return (
        <svg
            className="pointer-events-none absolute top-0 left-0"
            width={timeline.totalWidth}
            height={totalHeight}
            style={{ overflow: 'visible', zIndex: 4 }}
        >
            <defs>
                {/* ── Punta de flecha normal ── */}
                <marker
                    id="arr-norm"
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                >
                    <polygon
                        points="0,1 8,5 0,9"
                        fill="rgba(148,163,184,0.95)"
                    />
                </marker>
                {/* ── Punta de flecha crítica ── */}
                <marker
                    id="arr-crit"
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                >
                    <polygon points="0,1 8,5 0,9" fill="#ef4444" />
                </marker>
                {/* ── Círculo de origen normal ── */}
                <marker
                    id="dot-norm"
                    markerWidth="8"
                    markerHeight="8"
                    refX="4"
                    refY="4"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                >
                    <circle cx="4" cy="4" r="3" fill="rgba(148,163,184,0.85)" />
                </marker>
                {/* ── Círculo de origen crítico ── */}
                <marker
                    id="dot-crit"
                    markerWidth="8"
                    markerHeight="8"
                    refX="4"
                    refY="4"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                >
                    <circle cx="4" cy="4" r="3" fill="#ef4444" />
                </marker>
            </defs>

            {/* Normales primero, críticas encima */}
            {visibleArrows
                .filter((a) => !a.critical)
                .map((a, i) => (
                    <path
                        key={`n-${i}`}
                        d={a.path}
                        fill="none"
                        stroke="rgba(148,163,184,0.75)"
                        strokeWidth={1.5}
                        markerStart="url(#dot-norm)"
                        markerEnd="url(#arr-norm)"
                    />
                ))}
            {visibleArrows
                .filter((a) => a.critical)
                .map((a, i) => (
                    <path
                        key={`c-${i}`}
                        d={a.path}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={2}
                        markerStart="url(#dot-crit)"
                        markerEnd="url(#arr-crit)"
                    />
                ))}
        </svg>
    );
}
