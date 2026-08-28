export interface FormulaNode {
    id: string;
    code: string;
    descripcion: string;
    coefCalculado: number;
    coefDefinido: number;
    children: FormulaNode[];
}

export interface FormulaMonomio {
    id: string;
    nomenclatura: string;
    root: FormulaNode;
}

export interface FormulaExportRow {
    nro: number | null;
    esPadre: boolean;
    esMonomio: boolean;
    nivel: number;
    codigo: string;
    descripcion: string;
    monomio: string;
    coeficiente: number;
    incidencia: number;
}

export const MAX_CHILDREN_PER_NODE = 2;

const codeCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const compareCodes = (left: string, right: string): number => codeCollator.compare(left, right);

const sortNodeChildren = (node: FormulaNode): FormulaNode => ({
    ...node,
    children: node.children.map(sortNodeChildren).sort((left, right) => compareCodes(left.code, right.code)),
});

export const sortMonomiosByCode = (monomios: FormulaMonomio[]): FormulaMonomio[] =>
    monomios
        .map((monomio) => ({ ...monomio, root: sortNodeChildren(monomio.root) }))
        .sort((left, right) => compareCodes(left.root.code, right.root.code));

const normalizeConcept = (value: string): string => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const CONCEPT_SYMBOLS: Array<[RegExp, string]> = [
    [/GASTO(?:S)? GENERAL|UTILIDAD/, 'GU'],
    [/MANO DE OBRA|PERSONAL TECNICO/, 'MA'],
    [/ARTEFACTO.*ALUMBRADO|ALUMBRADO.*ARTEFACTO/, 'AZ'],
    [/ALAMBRE|CABLE DE COBRE/, 'AL'],
    [/TUBERIA|TUBO DE/, 'TZ'],
    [/DOLAR|MONEDA EXTRANJERA/, 'DO'],
    [/MATERIAL(?:ES)? VARIO/, 'MV'],
    [/MAQUINARIA|EQUIPO/, 'EQ'],
    [/CEMENTO/, 'CE'],
    [/AGREGADO|ARENA|PIEDRA/, 'AG'],
    [/ACERO|FIERRO/, 'AC'],
    [/COMBUSTIBLE|DIESEL|GASOLINA/, 'CO'],
    [/MADERA/, 'MD'],
    [/HERRAMIENTA/, 'HE'],
];

export function deriveMonomioSymbol(description: string): string {
    const concept = normalizeConcept(description);
    const matched = CONCEPT_SYMBOLS.find(([pattern]) => pattern.test(concept));
    if (matched) return matched[1];

    const words = concept
        .replace(/[^A-Z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2 && !['DEL', 'LOS', 'LAS', 'PARA', 'CON'].includes(word));
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`;
    return (words[0] ?? 'IN').slice(0, 2).padEnd(2, 'X');
}

function uniqueSymbol(preferred: string, used: Set<string>): string {
    if (!used.has(preferred)) return preferred;
    let suffix = 2;
    while (used.has(`${preferred}${suffix}`)) suffix++;
    return `${preferred}${suffix}`;
}

export function sumNode(node: FormulaNode): number {
    return node.coefDefinido + node.children.reduce((sum, child) => sum + sumNode(child), 0);
}

export function flattenNodes(node: FormulaNode): FormulaNode[] {
    return [node, ...node.children.flatMap(flattenNodes)];
}

export function buildInitialMonomios(
    parentMap: Map<string, number>,
    sortedCodes: string[],
    codeToDesc: Map<string, string>,
): FormulaMonomio[] {
    const total = Array.from(parentMap.values()).reduce((sum, value) => sum + value, 0);
    if (total <= 0) return [];

    const usedSymbols = new Set<string>();
    const monomios = sortedCodes
        .filter((code) => (parentMap.get(code) ?? 0) > 0)
        .map((code) => {
            const calculated = (parentMap.get(code) ?? 0) / total;
            const nomenclatura = uniqueSymbol(deriveMonomioSymbol(codeToDesc.get(code) ?? `Índice ${code}`), usedSymbols);
            usedSymbols.add(nomenclatura);
            return {
                id: `m-${code}`,
                nomenclatura,
                root: {
                    id: `i-${code}`,
                    code,
                    descripcion: codeToDesc.get(code) ?? `Índice ${code}`,
                    coefCalculado: calculated,
                    coefDefinido: Number(calculated.toFixed(3)),
                    children: [],
                },
            };
        });

    const definedTotal = monomios.reduce((sum, monomio) => sum + monomio.root.coefDefinido, 0);
    const residual = Number((1 - definedTotal).toFixed(3));
    if (monomios.length > 0 && residual !== 0) {
        const representative = monomios.reduce((largest, current) =>
            current.root.coefDefinido > largest.root.coefDefinido ? current : largest,
        );
        representative.root.coefDefinido = Number((representative.root.coefDefinido + residual).toFixed(3));
    }

    return monomios;
}

/**
 * Actualiza los textos derivados del catálogo al cargar una fórmula guardada.
 * La estructura, los identificadores y los coeficientes definidos por el usuario
 * se conservan intactos, incluido el orden personalizado por el usuario. Solo
 * se reemplazan los textos que pudieron quedar persistidos desde un catálogo
 * anterior.
 */
export function reconcileMonomiosWithCatalog(
    monomios: FormulaMonomio[],
    codeToDesc: Map<string, string>,
): FormulaMonomio[] {
    const reconcileNode = (node: FormulaNode): FormulaNode => ({
        ...node,
        descripcion: codeToDesc.get(node.code) ?? node.descripcion,
        children: node.children.map(reconcileNode),
    });
    const usedSymbols = new Set<string>();

    return monomios.map((monomio) => {
        const root = reconcileNode(monomio.root);
        const officialDescription = codeToDesc.get(root.code);
        const nomenclatura = officialDescription
            ? uniqueSymbol(deriveMonomioSymbol(officialDescription), usedSymbols)
            : uniqueSymbol(monomio.nomenclatura, usedSymbols);
        usedSymbols.add(nomenclatura);

        return { ...monomio, nomenclatura, root };
    });
}

function containsNode(node: FormulaNode, id: string): boolean {
    return node.id === id || node.children.some((child) => containsNode(child, id));
}

function detachNode(
    monomios: FormulaMonomio[],
    nodeId: string,
): { forest: FormulaMonomio[]; node: FormulaNode | null } {
    let detached: FormulaNode | null = null;

    const removeFromNode = (node: FormulaNode): FormulaNode => ({
        ...node,
        children: node.children
            .filter((child) => {
                if (child.id !== nodeId) return true;
                detached = child;
                return false;
            })
            .map(removeFromNode),
    });

    const forest = monomios
        .filter((monomio) => {
            if (monomio.root.id !== nodeId) return true;
            detached = monomio.root;
            return false;
        })
        .map((monomio) => ({ ...monomio, root: removeFromNode(monomio.root) }));

    return { forest, node: detached };
}

function appendChild(node: FormulaNode, targetId: string, child: FormulaNode): FormulaNode {
    if (node.id === targetId) return { ...node, children: [...node.children, child] };
    return { ...node, children: node.children.map((item) => appendChild(item, targetId, child)) };
}

export function canMoveNode(
    monomios: FormulaMonomio[],
    sourceId: string,
    targetId: string,
): boolean {
    if (sourceId === targetId) return false;
    const nodes = monomios.flatMap((monomio) => flattenNodes(monomio.root));
    const source = nodes.find((node) => node.id === sourceId);
    const target = nodes.find((node) => node.id === targetId);
    return Boolean(
        source &&
            target &&
            target.children.length < MAX_CHILDREN_PER_NODE &&
            !containsNode(source, targetId),
    );
}

export function moveNode(
    monomios: FormulaMonomio[],
    sourceId: string,
    targetId: string,
): FormulaMonomio[] {
    if (!canMoveNode(monomios, sourceId, targetId)) return monomios;
    const { forest, node } = detachNode(monomios, sourceId);
    if (!node) return monomios;
    return forest.map((monomio) => ({
        ...monomio,
        root: appendChild(monomio.root, targetId, node),
    }));
}

export function moveNodeWithinSiblings(
    monomios: FormulaMonomio[],
    nodeId: string,
    direction: -1 | 1,
): FormulaMonomio[] {
    const rootIndex = monomios.findIndex((monomio) => monomio.root.id === nodeId);
    if (rootIndex >= 0) {
        const targetIndex = rootIndex + direction;
        if (targetIndex < 0 || targetIndex >= monomios.length) return monomios;
        const reordered = [...monomios];
        [reordered[rootIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[rootIndex]];
        return reordered;
    }

    let moved = false;
    const reorderChildren = (node: FormulaNode): FormulaNode => {
        const childIndex = node.children.findIndex((child) => child.id === nodeId);
        if (childIndex >= 0) {
            const targetIndex = childIndex + direction;
            if (targetIndex < 0 || targetIndex >= node.children.length) return node;
            const children = [...node.children];
            [children[childIndex], children[targetIndex]] = [children[targetIndex], children[childIndex]];
            moved = true;
            return { ...node, children };
        }
        return { ...node, children: node.children.map(reorderChildren) };
    };

    const reordered = monomios.map((monomio) => ({ ...monomio, root: reorderChildren(monomio.root) }));
    return moved ? reordered : monomios;
}

export function reorderNodeAmongSiblings(
    monomios: FormulaMonomio[],
    sourceId: string,
    targetId: string,
    placement: 'before' | 'after',
): FormulaMonomio[] {
    if (sourceId === targetId) return monomios;

    const reorder = <T extends { id: string }>(items: T[]): T[] | null => {
        const source = items.find((item) => item.id === sourceId);
        const target = items.find((item) => item.id === targetId);
        if (!source || !target) return null;
        const remaining = items.filter((item) => item.id !== sourceId);
        const targetIndex = remaining.findIndex((item) => item.id === targetId);
        remaining.splice(placement === 'before' ? targetIndex : targetIndex + 1, 0, source);
        return remaining;
    };

    const roots = monomios.map((monomio) => ({ id: monomio.root.id, monomio }));
    const reorderedRoots = reorder(roots);
    if (reorderedRoots) return reorderedRoots.map(({ monomio }) => monomio);

    let changed = false;
    const reorderChildren = (node: FormulaNode): FormulaNode => {
        const reordered = reorder(node.children);
        if (reordered) {
            changed = true;
            return { ...node, children: reordered };
        }
        return { ...node, children: node.children.map(reorderChildren) };
    };
    const result = monomios.map((monomio) => ({ ...monomio, root: reorderChildren(monomio.root) }));
    return changed ? result : monomios;
}

export function flattenMonomiosForExport(monomios: FormulaMonomio[]): FormulaExportRow[] {
    const rows: FormulaExportRow[] = [];

    const visit = (
        node: FormulaNode,
        level: number,
        monomio: FormulaMonomio,
        nro: number,
    ) => {
        const nodeTotal = sumNode(node);
        rows.push({
            nro: level === 0 ? nro : null,
            esPadre: level === 0,
            esMonomio: true,
            nivel: level,
            codigo: node.code,
            descripcion: node.descripcion,
            monomio: level === 0 ? monomio.nomenclatura : '',
            coeficiente: nodeTotal,
            incidencia: nodeTotal > 0 ? 100 : 0,
        });
        rows.push({
            nro: null,
            esPadre: false,
            esMonomio: false,
            nivel: level + 1,
            codigo: node.code,
            descripcion: node.descripcion,
            monomio: '',
            coeficiente: node.coefDefinido,
            incidencia: nodeTotal > 0 ? (node.coefDefinido / nodeTotal) * 100 : 0,
        });
        node.children.forEach((child) => visit(child, level + 1, monomio, nro));
    };

    monomios.forEach((monomio, index) => visit(monomio.root, 0, monomio, index + 1));
    return rows;
}
