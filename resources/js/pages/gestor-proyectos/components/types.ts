import { FileText, Film, Image as ImageIcon, Table as TableIcon } from 'lucide-react';

export type NodeType = 'text' | 'table' | 'image' | 'video';
export type NodeStatus = 'Completo' | 'En curso' | 'Pendiente';
export type NodeColor = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'fuchsia' | 'cyan';
export type NodeShape = 'circle' | 'square';
export type NodeRole = 'head' | 'tail' | null;

export type TreeContent = string | { headers: string[]; rows: string[][] } | { url: string; caption: string };

export type TreeNode = {
    id: string;
    title: string;
    type: NodeType;
    shape?: NodeShape;
    color: NodeColor;
    status: NodeStatus;
    content: TreeContent;
    role: NodeRole;
    /** Peso propio, solo se usa cuando el nodo no tiene hijos (hoja). */
    peso: number | null;
    /** Dias propios, solo se usa cuando el nodo no tiene hijos (hoja). */
    dias: number | null;
    /** Suma ascendente: en hojas es `peso`; en nodos con hijos, la suma de `pesoTotal` de sus hijos. */
    pesoTotal: number;
    /** Suma ascendente: en hojas es `dias`; en nodos con hijos, la suma de `diasTotal` de sus hijos. */
    diasTotal: number;
    /** Avance 0-100. En hojas sale del Estado; en nodos con hijos, promedio ponderado por `pesoTotal` de sus hijos. */
    avance: number;
    children: TreeNode[];
};

export type LayoutPosition = {
    x: number;
    y: number;
    node: TreeNode;
    parentId: string | null;
    rootId: string;
    depth: number;
    lane: 'main' | 'detail';
    hasChildren: boolean;
    expanded: boolean;
};

/** Forma del JSON `content` tal como lo persiste el backend (columna `content`). */
export interface ApiNodoContent {
    text?: string;
    headers?: string[];
    rows?: string[][];
    url?: string;
    caption?: string;
}

/** DTO plano que devuelve/recibe el backend para un nodo del arbol. */
export interface ApiNodo {
    id: number;
    parent_id: number | null;
    role: NodeRole;
    title: string;
    type: NodeType;
    shape: NodeShape;
    color: NodeColor;
    status: NodeStatus;
    content: ApiNodoContent | null;
    order: number;
    peso: number | null;
    dias: number | null;
}

export const COLORS: Record<NodeColor, { bg: string; text: string; border: string; ring: string; line: string; soft: string }> = {
    violet: { bg: 'bg-violet-500', text: 'text-violet-300', border: 'border-violet-400/40', ring: 'ring-violet-400/40', line: '#a78bfa', soft: 'bg-violet-500/10' },
    sky: { bg: 'bg-sky-500', text: 'text-sky-300', border: 'border-sky-400/40', ring: 'ring-sky-400/40', line: '#7dd3fc', soft: 'bg-sky-500/10' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-300', border: 'border-emerald-400/40', ring: 'ring-emerald-400/40', line: '#6ee7b7', soft: 'bg-emerald-500/10' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-300', border: 'border-amber-400/40', ring: 'ring-amber-400/40', line: '#fcd34d', soft: 'bg-amber-500/10' },
    rose: { bg: 'bg-rose-500', text: 'text-rose-300', border: 'border-rose-400/40', ring: 'ring-rose-400/40', line: '#fda4af', soft: 'bg-rose-500/10' },
    fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-300', border: 'border-fuchsia-400/40', ring: 'ring-fuchsia-400/40', line: '#f0abfc', soft: 'bg-fuchsia-500/10' },
    cyan: { bg: 'bg-cyan-500', text: 'text-cyan-300', border: 'border-cyan-400/40', ring: 'ring-cyan-400/40', line: '#67e8f9', soft: 'bg-cyan-500/10' },
};

export const STATUS_DOT: Record<NodeStatus, string> = {
    Completo: 'bg-emerald-400',
    'En curso': 'bg-amber-400',
    Pendiente: 'bg-zinc-500',
};

/** Avance (0-100) que aporta una hoja segun su Estado, base del calculo ascendente de `avance`. */
export const STATUS_PROGRESS: Record<NodeStatus, number> = {
    Completo: 100,
    'En curso': 50,
    Pendiente: 0,
};

export type AvanceTier = { bg: string; border: string; ring: string; text: string; label: string };

/** Semaforo visual del avance ponderado: <50% rojo, 50-99% naranja, 100% verde. */
export function avanceTier(avance: number): AvanceTier {
    if (avance >= 100) {
        return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/60', ring: 'ring-emerald-500/40', text: 'text-emerald-300', label: 'Completo' };
    }

    if (avance >= 50) {
        return { bg: 'bg-orange-500/10', border: 'border-orange-500/60', ring: 'ring-orange-500/40', text: 'text-orange-300', label: 'En avance' };
    }

    return { bg: 'bg-red-500/10', border: 'border-red-500/60', ring: 'ring-red-500/40', text: 'text-red-300', label: 'Riesgo' };
}

export const TYPE_ICON = { text: FileText, table: TableIcon, image: ImageIcon, video: Film };
export const LEVEL_LABELS = ['Padre', 'Hijo', 'Nieto', 'Bisnieto', 'Tataranieto'];

export const NODE_TYPES: NodeType[] = ['text', 'table', 'image', 'video'];
export const NODE_SHAPES: NodeShape[] = ['circle', 'square'];
export const NODE_COLORS: NodeColor[] = ['violet', 'sky', 'emerald', 'amber', 'rose', 'fuchsia', 'cyan'];
export const NODE_STATUSES: NodeStatus[] = ['Completo', 'En curso', 'Pendiente'];
