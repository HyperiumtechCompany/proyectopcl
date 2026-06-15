import React, { useCallback, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import type { GanttTask } from '../../types/task';

// ─── Node geometry ─────────────────────────────────────────────────────────────
const NW = 220;   // node width
const NH = 94;    // node height (increased for multi-line names)
const H_GAP = 90; // horizontal gap between columns
const V_GAP = 20; // vertical gap within column
const PAD = 56;   // canvas padding

// CPM row heights (sum = NH)
const ROW_TOP = 20;     // ES / DUR / EF
const ROW_MID = 54;     // name — taller to fit up to 3 wrapped lines
const ROW_BOT = 20;     // LS / TF / LF

// Text layout inside middle row
const NAME_FONT = 10;
const NAME_LINE_H = 14;  // px between baselines
const NAME_MAX_LINES = 3;
const NAME_MAX_CHARS = 30; // chars per line (approx 6px/char at 10px bold)

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CpmData {
    es: string;   // Early Start  (DD/MM)
    ef: string;   // Early Finish (DD/MM)
    ls: string;   // Late Start   (DD/MM)
    lf: string;   // Late Finish  (DD/MM)
    dur: string;  // duration label
    tf: number;   // Total Float (days)
}

interface NetNode {
    task: GanttTask;
    level: number;
    row: number;
    x: number;
    y: number;
    cpm: CpmData;
}

interface NetEdge {
    fromId: number;
    toId: number;
    critical: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(d: string | null | undefined): string {
    if (!d) return '—';
    return d.slice(8, 10) + '/' + d.slice(5, 7);
}

/**
 * Break a string into lines of ≤ maxChars characters, word-aware.
 * The last allowed line gets "…" if text was cut.
 */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
    if (!text) return ['—'];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';

    for (const word of words) {
        if (lines.length >= maxLines) break;
        const candidate = cur ? `${cur} ${word}` : word;
        if (candidate.length <= maxChars) {
            cur = candidate;
        } else {
            if (cur) {
                lines.push(cur);
                cur = '';
                if (lines.length >= maxLines) break;
            }
            // Single word longer than maxChars → force-break it
            if (word.length > maxChars) {
                const slice = word.slice(0, maxChars - 1);
                lines.push(lines.length < maxLines - 1 ? slice + '-' : slice + '…');
                cur = word.slice(maxChars - 1);
            } else {
                cur = word;
            }
        }
    }

    if (cur && lines.length < maxLines) lines.push(cur);

    // If we couldn't fit everything, mark the last line with "…"
    const fullText = lines.join(' ') + (cur && lines.length >= maxLines ? ' ' + cur : '');
    if (fullText.trimEnd() !== text && lines.length > 0) {
        const last = lines[lines.length - 1];
        if (!last.endsWith('…')) {
            lines[lines.length - 1] =
                last.length < maxChars ? last + '…' : last.slice(0, maxChars - 1) + '…';
        }
    }

    return lines.length ? lines : ['—'];
}

function addDays(dateStr: string | null | undefined, days: number): string {
    if (!dateStr) return '—';
    return dayjs(dateStr).add(days, 'day').format('DD/MM');
}

// ─── Layout computation ────────────────────────────────────────────────────────
function buildLayout(
    tasks: GanttTask[],
    criticalIds: Set<number>,
    floatByTask: Map<number, number>,
): { nodes: NetNode[]; edges: NetEdge[]; canvasW: number; canvasH: number } {
    if (!tasks.length) return { nodes: [], edges: [], canvasW: 0, canvasH: 0 };

    // pred.taskId is item_order — translate to DB id
    const orderToId = new Map(tasks.map((t) => [t.item_order, t.id]));
    const taskById  = new Map(tasks.map((t) => [t.id, t]));

    // ── Assign levels (longest path from source) ──────────────────────────────
    const levels = new Map<number, number>();
    const visiting = new Set<number>();

    function lvl(id: number): number {
        if (levels.has(id)) return levels.get(id)!;
        if (visiting.has(id)) return 0; // cycle guard
        visiting.add(id);
        const task = taskById.get(id);
        const validPreds = (task?.predecesoras ?? [])
            .map((p) => orderToId.get(p.taskId))
            .filter((pid): pid is number => pid !== undefined && taskById.has(pid));
        const l = validPreds.length
            ? Math.max(...validPreds.map(lvl)) + 1
            : 0;
        levels.set(id, l);
        visiting.delete(id);
        return l;
    }
    tasks.forEach((t) => lvl(t.id));

    // ── Group by level ────────────────────────────────────────────────────────
    const byLevel = new Map<number, GanttTask[]>();
    tasks.forEach((t) => {
        const l = levels.get(t.id) ?? 0;
        if (!byLevel.has(l)) byLevel.set(l, []);
        byLevel.get(l)!.push(t);
    });

    // Sort within level for visual stability
    byLevel.forEach((arr) =>
        arr.sort((a, b) =>
            a.parent_id !== b.parent_id
                ? (a.parent_id ?? 0) - (b.parent_id ?? 0)
                : a.item_order - b.item_order,
        ),
    );

    const maxLevel = Math.max(...Array.from(byLevel.keys()));
    const maxRows  = Math.max(...Array.from(byLevel.values()).map((a) => a.length));

    const canvasW = (maxLevel + 1) * NW + maxLevel * H_GAP + PAD * 2;
    const canvasH = maxRows * NH + (maxRows - 1) * V_GAP + PAD * 2;

    // ── Build nodes ───────────────────────────────────────────────────────────
    const nodes: NetNode[] = [];
    byLevel.forEach((arr, lv) => {
        const colH = arr.length * NH + (arr.length - 1) * V_GAP;
        const top  = PAD + (canvasH - PAD * 2 - colH) / 2;
        arr.forEach((task, row) => {
            const tf  = floatByTask.get(task.id) ?? 0;
            const cpm: CpmData = {
                es:  fmt(task.fecha_inicio),
                ef:  fmt(task.fecha_fin),
                ls:  addDays(task.fecha_inicio, tf),
                lf:  addDays(task.fecha_fin,    tf),
                dur: task.duracion_dias ? `${task.duracion_dias}d` : '—',
                tf,
            };
            nodes.push({
                task,
                level: lv,
                row,
                x: PAD + lv * (NW + H_GAP),
                y: top + row * (NH + V_GAP),
                cpm,
            });
        });
    });

    // ── Build edges ───────────────────────────────────────────────────────────
    const nodeById = new Map(nodes.map((n) => [n.task.id, n]));
    const edges: NetEdge[] = [];
    nodes.forEach((toN) => {
        (toN.task.predecesoras ?? []).forEach((pred) => {
            const fromId = orderToId.get(pred.taskId);
            if (fromId === undefined || !nodeById.has(fromId)) return;
            edges.push({
                fromId,
                toId: toN.task.id,
                critical: criticalIds.has(fromId) && criticalIds.has(toN.task.id),
            });
        });
    });

    return { nodes, edges, canvasW, canvasH };
}

// ─── Orthogonal step path (H → V → H) ──────────────────────────────────────────
function orthoPath(from: NetNode, to: NetNode): string {
    const x1 = from.x + NW;
    const y1 = from.y + NH / 2;
    const x2 = to.x;
    const y2 = to.y + NH / 2;

    if (Math.abs(y1 - y2) < 3) {
        // Straight horizontal
        return `M ${x1} ${y1} H ${x2}`;
    }
    const mx = x1 + (x2 - x1) / 2;
    return `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
}

// ─── SVG markers ───────────────────────────────────────────────────────────────
function Markers() {
    return (
        <defs>
            <marker id="net-arr" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7" fill="#475569" />
            </marker>
            <marker id="net-arr-crit" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7" fill="#ef4444" />
            </marker>
        </defs>
    );
}

// ─── CPM Node card ──────────────────────────────────────────────────────────────
const DIVIDER = '#1e293b';

function CpmNode({
    node,
    criticalIds,
    groupIds,
    selected,
    onSelect,
}: {
    node: NetNode;
    criticalIds: Set<number>;
    groupIds: Set<number>;
    selected: boolean;
    onSelect: (id: number) => void;
}) {
    const { task, cpm } = node;
    const isCrit  = criticalIds.has(task.id);
    const isGroup = groupIds.has(task.id);
    const isNearCrit = !isCrit && cpm.tf >= 0 && cpm.tf <= 3;

    // ── Colors ────────────────────────────────────────────────────────────────
    const borderColor = selected
        ? '#60a5fa'
        : isCrit
          ? '#ef4444'
          : isNearCrit
            ? '#f97316'
            : isGroup
              ? '#3b82f6'
              : '#334155';

    const topBg  = isCrit ? '#450a0a' : isGroup ? '#0c1a2e' : '#0f172a';
    const midBg  = isCrit ? '#3b0808' : isGroup ? '#0a1525' : '#0d1424';
    const botBg  = isCrit ? '#450a0a' : isGroup ? '#0c1a2e' : '#0f172a';

    const topText  = isCrit ? '#fca5a5' : '#94a3b8';
    const midColor = isCrit ? '#fca5a5' : isGroup ? '#93c5fd' : '#e2e8f0';
    const botText  = isCrit ? '#fca5a5' : '#94a3b8';
    const tfColor  = isCrit ? '#ef4444' : isNearCrit ? '#f97316' : '#64748b';

    const yw = NW / 3; // each third-column width
    const nameLines = wrapText(
        task.descripcion || `Tarea ${task.id}`,
        NAME_MAX_CHARS,
        NAME_MAX_LINES,
    );
    // Center the text block vertically within ROW_MID
    // Reserve 12px at the bottom for the item-order badge
    const textAreaH = ROW_MID - 12;
    const blockH = nameLines.length * NAME_LINE_H;
    const nameStartY = ROW_TOP + (textAreaH - blockH) / 2 + NAME_LINE_H * 0.75;

    return (
        <g
            transform={`translate(${node.x},${node.y})`}
            onClick={() => onSelect(task.id)}
            style={{ cursor: 'pointer' }}
        >
            {/* ── Top row: ES | DUR | EF ─────────────────────────────────── */}
            <rect width={NW} height={ROW_TOP} rx={0} fill={topBg} />
            {/* Dividers */}
            <line x1={yw} y1={0} x2={yw} y2={ROW_TOP} stroke={DIVIDER} strokeWidth={1} />
            <line x1={yw * 2} y1={0} x2={yw * 2} y2={ROW_TOP} stroke={DIVIDER} strokeWidth={1} />
            {/* ES */}
            <text x={5} y={ROW_TOP / 2} dominantBaseline="middle" fontSize={9} fill={topText} fontFamily="monospace">
                {cpm.es}
            </text>
            {/* DUR */}
            <text x={NW / 2} y={ROW_TOP / 2} dominantBaseline="middle" textAnchor="middle" fontSize={9} fontWeight={700} fill={topText}>
                {cpm.dur}
            </text>
            {/* EF */}
            <text x={NW - 5} y={ROW_TOP / 2} dominantBaseline="middle" textAnchor="end" fontSize={9} fill={topText} fontFamily="monospace">
                {cpm.ef}
            </text>

            {/* ── Middle row: multi-line name ────────────────────────────── */}
            <rect y={ROW_TOP} width={NW} height={ROW_MID} fill={midBg} />
            <line x1={0} y1={ROW_TOP} x2={NW} y2={ROW_TOP} stroke={DIVIDER} strokeWidth={1} />

            {/* Task name — wrapped lines via <tspan> */}
            <text
                x={NW / 2}
                y={nameStartY}
                textAnchor="middle"
                fontSize={NAME_FONT}
                fontWeight={600}
                fill={midColor}
            >
                {nameLines.map((line, i) => (
                    <tspan key={i} x={NW / 2} dy={i === 0 ? 0 : NAME_LINE_H}>
                        {line}
                    </tspan>
                ))}
            </text>

            {/* Item-order badge at the bottom of the middle area */}
            <text
                x={NW - 6}
                y={ROW_TOP + ROW_MID - 4}
                textAnchor="end"
                fontSize={8}
                fill="#475569"
            >
                #{task.item_order}
            </text>

            {/* ── Bottom row: LS | TF | LF ───────────────────────────────── */}
            <rect y={ROW_TOP + ROW_MID} width={NW} height={ROW_BOT} fill={botBg} />
            <line x1={0} y1={ROW_TOP + ROW_MID} x2={NW} y2={ROW_TOP + ROW_MID} stroke={DIVIDER} strokeWidth={1} />
            <line x1={yw} y1={ROW_TOP + ROW_MID} x2={yw} y2={NH} stroke={DIVIDER} strokeWidth={1} />
            <line x1={yw * 2} y1={ROW_TOP + ROW_MID} x2={yw * 2} y2={NH} stroke={DIVIDER} strokeWidth={1} />
            {/* LS */}
            <text
                x={5}
                y={ROW_TOP + ROW_MID + ROW_BOT / 2}
                dominantBaseline="middle"
                fontSize={9}
                fill={botText}
                fontFamily="monospace"
            >
                {cpm.ls}
            </text>
            {/* TF */}
            <text
                x={NW / 2}
                y={ROW_TOP + ROW_MID + ROW_BOT / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                fill={tfColor}
            >
                HT:{cpm.tf}d
            </text>
            {/* LF */}
            <text
                x={NW - 5}
                y={ROW_TOP + ROW_MID + ROW_BOT / 2}
                dominantBaseline="middle"
                textAnchor="end"
                fontSize={9}
                fill={botText}
                fontFamily="monospace"
            >
                {cpm.lf}
            </text>

            {/* ── Outer border ───────────────────────────────────────────── */}
            <rect
                width={NW}
                height={NH}
                rx={3}
                ry={3}
                fill="none"
                stroke={borderColor}
                strokeWidth={selected ? 2 : 1}
            />

            {/* Critical path top accent bar */}
            {isCrit && (
                <rect width={NW} height={3} rx={2} fill="#ef4444" />
            )}
        </g>
    );
}

// ─── Legend node template ──────────────────────────────────────────────────────
function LegendTemplate() {
    return (
        <div className="flex items-center gap-4 text-[10px] text-slate-400">
            {/* Mini CPM node */}
            <div className="rounded border border-slate-600 bg-slate-900 text-[9px] font-mono leading-none">
                <div className="flex border-b border-slate-700">
                    <span className="border-r border-slate-700 px-1.5 py-0.5 text-slate-400">
                        IC
                    </span>
                    <span className="flex-1 px-1 py-0.5 text-center font-bold text-slate-300">
                        Dur
                    </span>
                    <span className="border-l border-slate-700 px-1.5 py-0.5 text-slate-400">
                        TC
                    </span>
                </div>
                <div className="px-2 py-1 text-center text-[10px] font-semibold text-slate-200">
                    NOMBRE
                </div>
                <div className="flex border-t border-slate-700">
                    <span className="border-r border-slate-700 px-1.5 py-0.5 text-slate-400">
                        IT
                    </span>
                    <span className="flex-1 px-1 py-0.5 text-center font-bold text-slate-500">
                        HT
                    </span>
                    <span className="border-l border-slate-700 px-1.5 py-0.5 text-slate-400">
                        TT
                    </span>
                </div>
            </div>
            {/* Key */}
            <div className="flex flex-col gap-0.5">
                <span>
                    <b className="text-slate-300">IC/TC</b> = Inicio / Término
                    Temprano
                </span>
                <span>
                    <b className="text-slate-300">IT/TT</b> = Inicio / Término
                    Tardío
                </span>
                <span>
                    <b className="text-slate-300">HT</b> = Holgura Total (días)
                </span>
            </div>
            {/* Color guide */}
            <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-3.5 rounded-sm border border-red-500 bg-red-950" />
                    Ruta crítica (HT=0)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-3.5 rounded-sm border border-orange-500 bg-slate-900" />
                    Casi crítica (HT≤3)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-3.5 rounded-sm border border-blue-500 bg-slate-900" />
                    Partida/Grupo
                </span>
            </div>
        </div>
    );
}

// ─── Zoom controls ─────────────────────────────────────────────────────────────
function ZoomBar({
    scale,
    onIn,
    onOut,
    onReset,
    onFit,
}: {
    scale: number;
    onIn: () => void;
    onOut: () => void;
    onReset: () => void;
    onFit: () => void;
}) {
    return (
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-1">
            <button
                className="flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-sm font-bold text-slate-200 hover:bg-slate-600"
                onClick={onIn}
                title="Acercar"
            >
                +
            </button>
            <div className="flex h-6 w-7 items-center justify-center rounded bg-slate-800 text-[10px] text-slate-400 tabular-nums">
                {Math.round(scale * 100)}%
            </div>
            <button
                className="flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-sm font-bold text-slate-200 hover:bg-slate-600"
                onClick={onOut}
                title="Alejar"
            >
                −
            </button>
            <button
                className="mt-1 flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-[9px] text-slate-300 hover:bg-slate-600"
                onClick={onFit}
                title="Ajustar a ventana"
            >
                ⊡
            </button>
            <button
                className="flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-[9px] text-slate-300 hover:bg-slate-600"
                onClick={onReset}
                title="100%"
            >
                1:1
            </button>
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export interface DiagramaRedProps {
    tasks: GanttTask[];
    criticalIds: Set<number>;
    groupIds: Set<number>;
    floatByTask: Map<number, number>;
}

export function DiagramaRed({
    tasks,
    criticalIds,
    groupIds,
    floatByTask,
}: DiagramaRedProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // ── Pan / zoom ─────────────────────────────────────────────────────────────
    const [vp, setVp] = useState({ x: PAD, y: PAD, scale: 0.8 });
    const drag = useRef<{
        sx: number; sy: number; tx: number; ty: number; moved: boolean;
    } | null>(null);

    const [selectedId, setSelectedId] = useState<number | null>(null);

    // ── Layout ─────────────────────────────────────────────────────────────────
    const { nodes, edges, canvasW, canvasH } = useMemo(
        () => buildLayout(tasks, criticalIds, floatByTask),
        [tasks, criticalIds, floatByTask],
    );

    const nodeById = useMemo(
        () => new Map(nodes.map((n) => [n.task.id, n])),
        [nodes],
    );

    // ── Fit-to-window ──────────────────────────────────────────────────────────
    const fitView = useCallback(() => {
        const el = containerRef.current;
        if (!el || !canvasW || !canvasH) return;
        const { width: vw, height: vh } = el.getBoundingClientRect();
        const s = Math.min(
            (vw - PAD * 2) / canvasW,
            (vh - PAD * 2) / canvasH,
            1,
        );
        setVp({ x: (vw - canvasW * s) / 2, y: (vh - canvasH * s) / 2, scale: s });
    }, [canvasW, canvasH]);

    // ── Mouse pan ─────────────────────────────────────────────────────────────
    const onMD = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return;
            drag.current = { sx: e.clientX, sy: e.clientY, tx: vp.x, ty: vp.y, moved: false };
        },
        [vp.x, vp.y],
    );

    const onMM = useCallback((e: React.MouseEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        d.moved = true;
        setVp((v) => ({ ...v, x: d.tx + dx, y: d.ty + dy }));
    }, []);

    const onMU = useCallback(() => { drag.current = null; }, []);

    // ── Wheel zoom ─────────────────────────────────────────────────────────────
    const onWheel = useCallback((e: React.WheelEvent) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setVp((v) => {
            const ns = Math.max(0.1, Math.min(4, v.scale * f));
            const r  = ns / v.scale;
            return { x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r, scale: ns };
        });
    }, []);

    const zoomIn  = () => setVp((v) => ({ ...v, scale: Math.min(4,   v.scale * 1.2) }));
    const zoomOut = () => setVp((v) => ({ ...v, scale: Math.max(0.1, v.scale / 1.2) }));
    const reset   = () => setVp({ x: PAD, y: PAD, scale: 0.8 });

    const handleSelect = useCallback((id: number) => {
        if (drag.current?.moved) return;
        setSelectedId((p) => (p === id ? null : id));
    }, []);

    // ── Empty state ────────────────────────────────────────────────────────────
    if (!tasks.length) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No hay tareas para mostrar.
            </div>
        );
    }

    const totalLevels = nodes.length ? Math.max(...nodes.map((n) => n.level)) + 1 : 0;
    const edgesCount  = edges.length;
    const critCount   = Array.from(criticalIds).filter((id) =>
        nodes.some((n) => n.task.id === id),
    ).length;

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full select-none overflow-hidden bg-slate-950"
            style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
            onMouseDown={onMD}
            onMouseMove={onMM}
            onMouseUp={onMU}
            onMouseLeave={onMU}
            onWheel={onWheel}
        >
            {/* ── Header stats ──────────────────────────────────────────────── */}
            <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur-sm">
                <span>
                    <span className="font-semibold text-slate-200">{nodes.length}</span> actividades
                </span>
                <span className="text-slate-700">|</span>
                <span>
                    <span className="font-semibold text-slate-200">{edgesCount}</span> dependencias
                </span>
                <span className="text-slate-700">|</span>
                <span>
                    <span className="font-semibold text-red-400">{critCount}</span> en ruta crítica
                </span>
                <span className="text-slate-700">|</span>
                <span>
                    <span className="font-semibold text-slate-200">{totalLevels}</span> etapas
                </span>
            </div>

            {/* ── Zoom controls ─────────────────────────────────────────────── */}
            <ZoomBar
                scale={vp.scale}
                onIn={zoomIn}
                onOut={zoomOut}
                onReset={reset}
                onFit={fitView}
            />

            {/* ── Legend ────────────────────────────────────────────────────── */}
            <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-slate-800 bg-slate-900/90 px-4 py-2.5 backdrop-blur-sm">
                <LegendTemplate />
            </div>

            {/* ── SVG ───────────────────────────────────────────────────────── */}
            <svg width="100%" height="100%" style={{ display: 'block' }}>
                <Markers />

                <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>
                    {/* Dot grid background */}
                    <defs>
                        <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                            <circle cx="0.8" cy="0.8" r="0.8" fill="#1e293b" />
                        </pattern>
                    </defs>
                    <rect
                        x={-4000} y={-4000}
                        width={canvasW + 8000} height={canvasH + 8000}
                        fill="url(#dot-grid)"
                    />

                    {/* Column level guides (subtle vertical bands) */}
                    {Array.from({ length: totalLevels }, (_, i) => (
                        <rect
                            key={i}
                            x={PAD + i * (NW + H_GAP) - 8}
                            y={0}
                            width={NW + 16}
                            height={canvasH}
                            fill={i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent'}
                            rx={4}
                        />
                    ))}

                    {/* ── Edges (below nodes) ──────────────────────────────── */}
                    {edges.map((edge, i) => {
                        const from = nodeById.get(edge.fromId);
                        const to   = nodeById.get(edge.toId);
                        if (!from || !to) return null;
                        return (
                            <path
                                key={i}
                                d={orthoPath(from, to)}
                                fill="none"
                                stroke={edge.critical ? '#ef4444' : '#334155'}
                                strokeWidth={edge.critical ? 2 : 1.2}
                                strokeLinejoin="round"
                                markerEnd={`url(#${edge.critical ? 'net-arr-crit' : 'net-arr'})`}
                            />
                        );
                    })}

                    {/* ── Nodes ───────────────────────────────────────────── */}
                    {nodes.map((node) => (
                        <CpmNode
                            key={node.task.id}
                            node={node}
                            criticalIds={criticalIds}
                            groupIds={groupIds}
                            selected={selectedId === node.task.id}
                            onSelect={handleSelect}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
}
