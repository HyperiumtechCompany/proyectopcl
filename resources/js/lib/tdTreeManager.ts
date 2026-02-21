import type {
    TableRowNode,
    TableRowData,
    SplitItem,
    FlatRow,
    FlatCell,
    HeaderColumn,
    RowType,
} from '@/types/caida-tension';

// ─── Generador de IDs únicos ──────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ─── Datos por defecto según tipo de fila ────────────────────────────────────
function getDefaultData(type: RowType): TableRowData {
    const base: TableRowData = {
        tablero: '',
        voltage: '380',
        descripcion: '',
        puntos: 0,
        cargaInstalada: 0,
        potenciaInstalada: 0,
        factorDemanda: 0.9,
        maximaDemanda: 0,
        corrienteA: 0,
        corrienteDiseno: 0,
        longitudConductor: 0,
        longitudFormula: '',
        seccion: 2.5,
        caidaTension: 0,
        caidaTensionPorcentaje: 0,
        interruptor: '4x16',
        tipoConductor: 'LSOH',
        ducto: '20',
    };
    if (type === 'group') return { ...base, descripcion: 'CUARTO (TABLEROS - GRUPO ELECTRÓGENO)' };
    if (type === 'subgroup') return { ...base, descripcion: 'Nuevo Subgrupo' };
    if (type === 'subsubgroup') return { ...base, descripcion: 'Nuevo Sub-subgrupo' };
    if (type === 'splitrow') return { ...base, descripcion: 'Fila dividida' };
    return { ...base, descripcion: 'Nueva fila de datos' };
}

function makeNode(type: RowType, parentId: string | number | null = null): TableRowNode {
    return {
        id: uid(),
        type,
        parentId,
        data: getDefaultData(type),
        splitData: type === 'splitrow' ? [
            { descripcion: 'Sub-circuito 1', puntos: 1, cargaInstalada: 100 },
            { descripcion: 'Sub-circuito 2', puntos: 1, cargaInstalada: 100 },
        ] : [],
        isSplit: type === 'splitrow',
        voltage: '380',
        calculationHistory: [],
        children: [],
    };
}

// ─── Clonación profunda──────────────────────────────────────────────────────
function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Cabeceras de la tabla TD ────────────────────────────────────────────────
export const TD_HEADERS: HeaderColumn[] = [
    { key: 'tablero', label: 'TABLERO', type: 'text' },
    {
        key: 'voltage', label: 'VOLTAJE', type: 'select', options: [
            { label: '1ɸ', value: '220' },
            { label: '3ɸ', value: '380' },
            { label: '', value: '' },
        ]
    },
    { key: 'descripcion', label: 'DESCRIPCIÓN DEL LOCAL', type: 'text' },
    { key: 'puntos', label: 'PUNTOS', type: 'text' },
    { key: 'cargaInstalada', label: 'CARGA INSTALADA (W)', type: 'text' },
    { key: 'potenciaInstalada', label: 'POTENCIA INSTALADA (W)', type: 'calculation' },
    { key: 'factorDemanda', label: 'FACTOR DE DEMANDA (fd)', type: 'number' },
    { key: 'maximaDemanda', label: 'MÁXIMA DEMANDA (W)', type: 'number' },
    { key: 'corrienteA', label: 'CORRIENTE (A)', type: 'number' },
    { key: 'corrienteDiseno', label: 'CORRIENTE DISEÑO Id (A)', type: 'number' },
    { key: 'longitudConductor', label: 'LONGITUD CONDUCTOR (m)', type: 'calculation' },
    { key: 'seccion', label: 'SECCIÓN (mm²)', type: 'number' },
    { key: 'caidaTension', label: 'CAÍDA TENSIÓN (V)', type: 'number' },
    { key: 'caidaTensionPorcentaje', label: 'CAÍDA TENSIÓN (%) <2.5%', type: 'number' },
    { key: 'interruptor', label: 'INTERRUPTOR (A)', type: 'select' },
    { key: 'tipoConductor', label: 'TIPO CONDUCTOR', type: 'text' },
    { key: 'ducto', label: 'DUCTO (mm)', type: 'select' },
];

// ─── Cálculos eléctricos ─────────────────────────────────────────────────────
function calcRow(node: TableRowNode): void {
    if (node.type === 'datarow' || node.type === 'splitrow') {
        const v = parseFloat(node.voltage) || 220;
        const pi = parseFloat(String(node.data.potenciaInstalada)) || 0;
        const fd = parseFloat(String(node.data.factorDemanda)) || 0.9;
        const lon = parseFloat(String(node.data.longitudConductor)) || 0;
        const sec = parseFloat(String(node.data.seccion)) || 2.5;

        const md = pi * fd;
        const ia = v === 220 ? md / (v * 0.9) : md / (v * 0.9 * 1.732);
        const id = ia * 1.25;
        const caida = 2 * id * 0.0175 * lon / (sec || 1);
        const caidaPct = (caida / v) * 100;

        node.data.maximaDemanda = md;
        node.data.corrienteA = ia;
        node.data.corrienteDiseno = id;
        node.data.caidaTension = caida;
        node.data.caidaTensionPorcentaje = caidaPct;
    } else {
        let pi = 0;
        let md = 0;
        node.children.forEach((child) => {
            calcRow(child);
            pi += child.data.potenciaInstalada || 0;
            md += child.data.maximaDemanda || 0;
        });
        node.data.potenciaInstalada = pi;
        node.data.maximaDemanda = md;
    }
}

function calcAllTotals(tree: TableRowNode[]): void {
    tree.forEach(calcRow);
}

// ─── Aplanar árbol para renderizado ──────────────────────────────────────────
export function flattenTree(tree: TableRowNode[]): FlatRow[] {
    const result: FlatRow[] = [];

    const flatten = (arr: TableRowNode[], level: number) => {
        arr.forEach((item) => {
            if (item.isSplit && item.splitData.length > 0) {
                item.splitData.forEach((splitItem, splitIndex) => {
                    const cells: FlatCell[] = TD_HEADERS.map((h) => {
                        let value: string | number = '';
                        let rowspan = 1;
                        let visible = true;

                        if (['descripcion', 'puntos', 'cargaInstalada'].includes(h.key)) {
                            value = (splitItem as unknown as Record<string, string | number>)[h.key] ?? '';
                        } else if (h.key === 'voltage') {
                            if (splitIndex === 0) { value = item.voltage; rowspan = item.splitData.length; }
                            else { value = ''; visible = false; }
                        } else {
                            if (splitIndex === 0) { value = (item.data as unknown as Record<string, string | number>)[h.key] ?? ''; rowspan = item.splitData.length; }
                            else { value = ''; visible = false; }
                        }
                        return { key: h.key, value, type: h.type, rowspan, visible };
                    });

                    result.push({
                        id: item.id,
                        uniqueId: `${item.id}-${splitIndex}`,
                        type: item.type,
                        level,
                        cells,
                        parentId: item.parentId,
                        splitIndex,
                        isSplit: true,
                        calculationHistory: item.calculationHistory,
                    });
                });
            } else {
                const cells: FlatCell[] = TD_HEADERS.map((h) => ({
                    key: h.key,
                    value: h.key === 'voltage' ? item.voltage : (item.data as unknown as Record<string, string | number>)[h.key] ?? '',
                    type: h.type,
                }));
                result.push({
                    id: item.id,
                    uniqueId: String(item.id),
                    type: item.type,
                    level,
                    cells,
                    parentId: item.parentId,
                    splitIndex: 0,
                    isSplit: false,
                    calculationHistory: item.calculationHistory,
                });
            }

            if (item.children.length > 0) flatten(item.children, level + 1);
        });
    };

    flatten(tree, 0);
    return result;
}

// ─── Totales globales ─────────────────────────────────────────────────────────
export function getTotals(tree: TableRowNode[]) {
    let potenciaInstalada = 0;
    let maximaDemanda = 0;
    tree.forEach((n) => {
        potenciaInstalada += n.data.potenciaInstalada || 0;
        maximaDemanda += n.data.maximaDemanda || 0;
    });
    return { potenciaInstalada, maximaDemanda };
}

// ─── Buscar nodo por id ───────────────────────────────────────────────────────
function findById(tree: TableRowNode[], id: string | number): TableRowNode | null {
    for (const node of tree) {
        if (node.id === id) return node;
        const found = findById(node.children, id);
        if (found) return found;
    }
    return null;
}

function deleteById(arr: TableRowNode[], id: string | number): boolean {
    const idx = arr.findIndex((n) => n.id === id);
    if (idx !== -1) { arr.splice(idx, 1); return true; }
    for (const n of arr) {
        if (deleteById(n.children, id)) return true;
    }
    return false;
}

// ─── Contadores para nombres de tablero ───────────────────────────────────────
// ─── Generador de nombres de tablero basado en el estado actual del padre ───
function nextTableroName(type: RowType, parentNode: TableRowNode | null): string {
    if (type === 'group' || !parentNode) return 'TG';

    if (type === 'subgroup') {
        const existing = parentNode.children
            .filter((c) => c.type === 'subgroup')
            .map((c) => c.data.tablero || '');
        let max = 0;
        existing.forEach((name) => {
            const match = name.match(/TD-(\d+)/);
            if (match && parseInt(match[1]!, 10) > max) max = parseInt(match[1]!, 10);
        });
        return `TD-${String(max + 1).padStart(2, '0')}`;
    }

    if (type === 'subsubgroup') {
        const pName = String(parentNode.data.tablero || 'TD');
        const existing = parentNode.children
            .filter((c) => c.type === 'subsubgroup')
            .map((c) => String(c.data.tablero || ''));
        let max = 0;
        existing.forEach((name) => {
            const parts = name.split('.');
            if (parts.length > 1) {
                const num = parseInt(parts[parts.length - 1]!, 10);
                if (!isNaN(num) && num > max) max = num;
            }
        });
        return `${pName}.${String(max + 1).padStart(2, '0')}`;
    }

    // datarow / splitrow
    const existing = parentNode.children
        .filter((c) => c.type === 'datarow' || c.type === 'splitrow')
        .map((c) => String(c.data.tablero || ''));
    let max = 0;
    existing.forEach((name) => {
        const match = name.match(/^C-(\d+)$/);
        if (match && parseInt(match[1]!, 10) > max) max = parseInt(match[1]!, 10);
    });
    return `C-${max + 1}`;
}

// ─── Evaluador de fórmulas simple ────────────────────────────────────────────
export function evalFormula(expr: string): number {
    if (!expr) return 0;
    const clean = expr.startsWith('=') ? expr.slice(1) : expr;
    try {
        const result = Function(`"use strict"; return (${clean.replace(/[^0-9+\-*/().\s]/g, '')})`)() as number;
        return isNaN(result) ? 0 : parseFloat(result.toFixed(4));
    } catch {
        return parseFloat(clean) || 0;
    }
}

// ─── API pública del manager ──────────────────────────────────────────────────

export function createInitialTree(): TableRowNode[] {
    const tg = makeNode('group');
    tg.data.tablero = 'TG';
    tg.data.descripcion = 'CUARTO (TABLEROS - GRUPO ELECTRÓGENO)';
    return [tg];
}

export function addGroup(tree: TableRowNode[]): TableRowNode[] {
    // Deep clone para evitar mutación
    const next = deepClone(tree);
    const node = makeNode('group');
    node.data.tablero = 'TG';
    next.push(node);
    calcAllTotals(next);
    return next;
}

export function addSubgroup(tree: TableRowNode[], parentId: string | number): TableRowNode[] {
    const next = deepClone(tree);
    const parent = findById(next, parentId);
    if (!parent || parent.type !== 'group') return tree;
    const node = makeNode('subgroup', parentId);
    node.data.tablero = nextTableroName('subgroup', parent);
    node.data.descripcion = node.data.tablero;
    // Immutable push via spread
    parent.children = [...parent.children, node];
    calcAllTotals(next);
    return next;
}

export function addSubSubgroup(tree: TableRowNode[], parentId: string | number): TableRowNode[] {
    const next = deepClone(tree);
    const parent = findById(next, parentId);
    if (!parent || parent.type !== 'subgroup') return tree;
    const node = makeNode('subsubgroup', parentId);
    node.data.tablero = nextTableroName('subsubgroup', parent);
    node.data.descripcion = node.data.tablero;
    parent.children = [...parent.children, node];
    calcAllTotals(next);
    return next;
}

export function addDataRow(tree: TableRowNode[], parentId: string | number): TableRowNode[] {
    const next = deepClone(tree);
    const parent = findById(next, parentId);
    if (!parent || !['subgroup', 'subsubgroup'].includes(parent.type)) return tree;
    const node = makeNode('datarow', parentId);
    node.data.tablero = nextTableroName('datarow', parent);
    node.data.descripcion = 'Nueva fila de datos';
    parent.children = [...parent.children, node];
    calcAllTotals(next);
    return next;
}

export function addSplitRow(tree: TableRowNode[], parentId: string | number): TableRowNode[] {
    const next = deepClone(tree);
    const parent = findById(next, parentId);
    if (!parent || !['subgroup', 'subsubgroup'].includes(parent.type)) return tree;
    const node = makeNode('splitrow', parentId);
    node.data.tablero = nextTableroName('splitrow', parent);
    parent.children = [...parent.children, node];
    calcAllTotals(next);
    return next;
}

export function deleteRow(tree: TableRowNode[], id: string | number): TableRowNode[] {
    const next = deepClone(tree);
    deleteById(next, id);
    calcAllTotals(next);
    return next;
}

export function updateCellValue(
    tree: TableRowNode[],
    rowId: string | number,
    cellKey: string,
    value: string | number,
    splitIndex = 0,
): TableRowNode[] {
    const next = deepClone(tree);
    const node = findById(next, rowId);
    if (!node) return tree;

    const header = TD_HEADERS.find((h) => h.key === cellKey);
    const type = header?.type ?? 'text';

    let processed: string | number = value;
    if (type === 'calculation' && String(value).startsWith('=')) {
        const result = evalFormula(String(value));
        node.calculationHistory.push({ expression: String(value), result });
        processed = result;
    } else if (type === 'number') {
        processed = parseFloat(String(value)) || 0;
    }

    if (node.isSplit && ['descripcion', 'puntos', 'cargaInstalada'].includes(cellKey)) {
        if (node.splitData[splitIndex]) {
            (node.splitData[splitIndex] as unknown as Record<string, string | number>)[cellKey] = processed;
        }
    } else if (cellKey === 'voltage') {
        node.voltage = String(value);
        node.data.voltage = String(value);
    } else {
        (node.data as unknown as Record<string, string | number>)[cellKey] = processed;
    }

    calcAllTotals(next);
    return next;
}

export function exportTree(tree: TableRowNode[]): string {
    return JSON.stringify(tree, null, 2);
}

export function importTree(jsonString: string): TableRowNode[] | null {
    try {
        const data = JSON.parse(jsonString) as TableRowNode[];
        calcAllTotals(data);
        return data;
    } catch {
        return null;
    }
}
