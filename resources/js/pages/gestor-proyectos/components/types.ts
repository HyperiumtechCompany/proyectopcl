import { FileText, Film, Image as ImageIcon, Table as TableIcon } from 'lucide-react';

export type NodeType = 'text' | 'table' | 'image' | 'video';
export type NodeStatus = 'Completo' | 'En curso' | 'Pendiente';
export type NodeColor = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'fuchsia' | 'cyan';
export type NodeShape = 'circle' | 'square';

export type TreeContent = string | { headers: string[]; rows: string[][] } | { url: string; caption: string };

export type TreeNode = {
    id: string;
    title: string;
    type: NodeType;
    shape?: NodeShape;
    color: NodeColor;
    status: NodeStatus;
    content: TreeContent;
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
    title: string;
    type: NodeType;
    shape: NodeShape;
    color: NodeColor;
    status: NodeStatus;
    content: ApiNodoContent | null;
    order: number;
}

export const COLORS: Record<NodeColor, { bg: string; text: string; border: string; line: string; soft: string }> = {
    violet: { bg: 'bg-violet-500', text: 'text-violet-300', border: 'border-violet-400/40', line: '#a78bfa', soft: 'bg-violet-500/10' },
    sky: { bg: 'bg-sky-500', text: 'text-sky-300', border: 'border-sky-400/40', line: '#7dd3fc', soft: 'bg-sky-500/10' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-300', border: 'border-emerald-400/40', line: '#6ee7b7', soft: 'bg-emerald-500/10' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-300', border: 'border-amber-400/40', line: '#fcd34d', soft: 'bg-amber-500/10' },
    rose: { bg: 'bg-rose-500', text: 'text-rose-300', border: 'border-rose-400/40', line: '#fda4af', soft: 'bg-rose-500/10' },
    fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-300', border: 'border-fuchsia-400/40', line: '#f0abfc', soft: 'bg-fuchsia-500/10' },
    cyan: { bg: 'bg-cyan-500', text: 'text-cyan-300', border: 'border-cyan-400/40', line: '#67e8f9', soft: 'bg-cyan-500/10' },
};

export const STATUS_DOT: Record<NodeStatus, string> = {
    Completo: 'bg-emerald-400',
    'En curso': 'bg-amber-400',
    Pendiente: 'bg-zinc-500',
};

export const TYPE_ICON = { text: FileText, table: TableIcon, image: ImageIcon, video: Film };
export const LEVEL_LABELS = ['Padre', 'Hijo', 'Nieto', 'Bisnieto', 'Tataranieto'];

export const NODE_TYPES: NodeType[] = ['text', 'table', 'image', 'video'];
export const NODE_SHAPES: NodeShape[] = ['circle', 'square'];
export const NODE_COLORS: NodeColor[] = ['violet', 'sky', 'emerald', 'amber', 'rose', 'fuchsia', 'cyan'];
export const NODE_STATUSES: NodeStatus[] = ['Completo', 'En curso', 'Pendiente'];
