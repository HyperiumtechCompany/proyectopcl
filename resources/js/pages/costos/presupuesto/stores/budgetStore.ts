import { produce } from 'immer';
import { create } from 'zustand';

// Types
export interface BudgetItemRow {
  id?: number;
  partida: string;
  descripcion: string;
  unidad: string;
  metrado: number;
  precio_unitario: number;
  parcial: number;
  metrado_source: string | null;
  item_order?: number;
  tipo_fila?: 'titulo' | 'subtitulo' | 'partida';
  // Hierarchical helper props
  _level?: number;
  _parentId?: string | null;
  _expanded?: boolean;
  _hasChildren?: boolean;
}

// Copy/paste granularity
export type CopyScope = 'node'     // nodo + todos sus descendientes
                      | 'children' // solo los hijos directos y sus subcadenas
                      | 'row';     // solo la fila individual (sin hijos)

interface BudgetState {
  rows: BudgetItemRow[];
  expandedMap: Record<string, boolean>;
  searchQuery: string;
  selectedId: string | null;
  multiSelection: string[];
  clipboard: { action: 'copy' | 'cut'; partidaId: string; scope: CopyScope } | null;
  isDirty: boolean;

  // Actions
  initialize: (initialRows: any[]) => void;
  setDirty: (dirty: boolean) => void;
  toggleExpand: (partida: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelection: (ids: string[]) => void;
  toggleMultiSelect: (id: string) => void;
  rangeSelect: (fromId: string, toId: string) => void;

  updateCell: (partida: string, field: keyof BudgetItemRow, value: any) => void;

  // Insert actions
  addNode: (parentId: string | null, type: 'titulo' | 'subtitulo' | 'partida') => void;
  addRowAfter: (partida: string, type?: 'titulo' | 'partida') => void;
  addRowBefore: (partida: string, type?: 'titulo' | 'partida') => void;

  // Row movement
  moveUp: (partida: string) => void;
  moveDown: (partida: string) => void;
  moveBlock: (partida: string, targetPartida: string, position: 'before' | 'after') => void;

  // Conversion
  convertToTitle: (partida: string) => void;
  convertToPartida: (partida: string) => void;

  // Edit Partida Code explicitly
  editPartidaCode: (oldCode: string, newCode: string) => void;
  renumberItems: () => void;

  // Delete
  deleteRow: (partida: string) => void;
  deleteMultiSelection: () => void;

  // Clipboard - granular copy/paste
  setClipboard: (action: 'copy' | 'cut' | null, partidaId?: string, scope?: CopyScope) => void;
  pasteNode: (targetParentId: string | null) => void;
  pasteAfter: (targetPartidaId: string) => void;

  // Recalculate
  calculateTree: () => void;

  // Computed
  getVisibleRows: () => BudgetItemRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const getLevel = (partida: string) => (partida.match(/\./g) || []).length;

const getParentPartida = (partida: string) => {
  const parts = partida.split('.');
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join('.');
};

const generateNextCode = (parentCode: string | null, rows: BudgetItemRow[]) => {
  if (!parentCode) {
    const rootCodes = rows
      .filter(r => getLevel(r.partida) === 0)
      .map(r => parseInt(r.partida, 10))
      .filter(n => !isNaN(n));
    const nextCode = rootCodes.length > 0 ? Math.max(...rootCodes) + 1 : 1;
    return nextCode.toString().padStart(2, '0');
  } else {
    const children = rows.filter(r => getParentPartida(r.partida) === parentCode);
    if (children.length === 0) return `${parentCode}.01`;
    const suffixCodes = children
      .map(r => {
        const parts = r.partida.split('.');
        return parseInt(parts[parts.length - 1], 10);
      })
      .filter(n => !isNaN(n));
    const nextSuffix = suffixCodes.length > 0 ? Math.max(...suffixCodes) + 1 : 1;
    return `${parentCode}.${nextSuffix.toString().padStart(2, '0')}`;
  }
};

const rebuildHierarchy = (rows: any[]) => {
  if (!rows) return [];
  const rowsMap = new Map();
  const parentsFound = new Set<string>();

  const rowsWithPartida = rows.filter(r => r && typeof r.partida === 'string');

  const sorted = [...rowsWithPartida].sort((a, b) =>
    a.partida.localeCompare(b.partida, undefined, { numeric: true, sensitivity: 'base' }),
  );

  sorted.map((r, i) => {
    const level = getLevel(r.partida);
    const parentId = getParentPartida(r.partida);
    if (parentId) parentsFound.add(parentId);

    const expanded = r._expanded !== undefined ? r._expanded : true;
    rowsMap.set(r.partida, { ...r, _level: level, _parentId: parentId, _hasChildren: false, _expanded: expanded, _index: i });
    return rowsMap.get(r.partida);
  });

  parentsFound.forEach(p => {
    if (rowsMap.has(p)) rowsMap.get(p)._hasChildren = true;
  });

  return [...rowsMap.values()];
};

const performTreeCalculation = (rows: BudgetItemRow[]) => {
  // 1. Build a map of parent -> children for O(1) lookup
  const childrenMap = new Map<string, string[]>();
  rows.forEach(row => {
    const parent = getParentPartida(row.partida);
    if (parent) {
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent)!.push(row.partida);
    }
  });

  // 2. Sort rows bottom-up (longer codes first) to ensure children are calculated before parents
  const sorted = [...rows].sort((a, b) => {
    const levelA = getLevel(a.partida);
    const levelB = getLevel(b.partida);
    if (levelA !== levelB) return levelB - levelA;
    return b.partida.localeCompare(a.partida, undefined, { numeric: true });
  });

  // 3. One-pass calculation
  const partialSums = new Map<string, number>();
  
  // First, initialize partialSums for leaf nodes (partidas without children)
  rows.forEach(row => {
    if (!childrenMap.has(row.partida)) {
      partialSums.set(row.partida, Number(row.parcial) || 0);
    }
  });

  // Then calculate upwards
  sorted.forEach(row => {
    const childrenIds = childrenMap.get(row.partida);
    if (childrenIds && childrenIds.length > 0) {
      const sum = childrenIds.reduce((acc, childId) => acc + (partialSums.get(childId) || 0), 0);
      partialSums.set(row.partida, sum);
      
      // Update original row reference
      row.parcial = sum;
      // Clear values for titles
      if (row.tipo_fila !== 'partida') {
        row.precio_unitario = 0;
        row.metrado = 0;
        row.unidad = '';
      }
    }
  });
};

/**
 * Renumeración WBS: reescribe todos los códigos `partida` preservando el orden
 * y la jerarquía actual. Retorna un nuevo array con los datos actualizados.
 */
const renumberWBS = (rows: BudgetItemRow[]): BudgetItemRow[] => {
  // Ordenar por el código actual (que define la jerarquía)
  const sorted = [...rows].sort((a, b) =>
    a.partida.localeCompare(b.partida, undefined, { numeric: true, sensitivity: 'base' }),
  );

  // Construir árbol en memoria
  type TreeNode = { row: BudgetItemRow; children: TreeNode[] };
  const roots: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const row of sorted) {
    const node: TreeNode = { row: { ...row }, children: [] };
    nodeMap.set(row.partida, node);
    const parent = getParentPartida(row.partida);
    if (!parent) {
      roots.push(node);
    } else {
      const parentNode = nodeMap.get(parent);
      if (parentNode) parentNode.children.push(node);
      else roots.push(node); // huérfano → raíz
    }
  }

  // DFS para asignar nuevos códigos
  const result: BudgetItemRow[] = [];
  const oldToNew = new Map<string, string>();

  const assignCodes = (nodes: TreeNode[], parentCode: string | null) => {
    nodes.forEach((node, idx) => {
      const suffix = String(idx + 1).padStart(2, '0');
      const newCode = parentCode ? `${parentCode}.${suffix}` : suffix;
      oldToNew.set(node.row.partida, newCode);
      node.row.partida = newCode;
      assignCodes(node.children, newCode);
      result.push(node.row);
    });
  };

  assignCodes(roots, null);
  return result;
};

/**
 * Obtener el bloque de filas de un nodo según el scope de copia.
 */
const getNodesByScope = (rows: BudgetItemRow[], partidaId: string, scope: CopyScope): BudgetItemRow[] => {
  const sourcePrefix = `${partidaId}.`;

  switch (scope) {
    case 'node':
      // Nodo + todos sus descendientes
      return rows.filter(r => r.partida === partidaId || r.partida.startsWith(sourcePrefix));

    case 'children':
      // Solo los hijos directos y sus descendientes (excluye el nodo raíz)
      return rows.filter(r => r.partida.startsWith(sourcePrefix));

    case 'row':
      // Solo la fila individual sin hijos
      return rows.filter(r => r.partida === partidaId);
  }
};

/**
 * Remap de códigos: dado un bloque de nodos, reescribe sus códigos
 * para que encajen en el nuevo parentCode.
 */
const remapBlock = (
  nodesToCopy: BudgetItemRow[],
  originalBaseCode: string,
  newBaseCode: string,
): BudgetItemRow[] => {
  return nodesToCopy.map(node => {
    const suffix = node.partida.substring(originalBaseCode.length);
    return {
      ...node,
      id: undefined,
      partida: `${newBaseCode}${suffix}`,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Optimized visibility: O(n) instead of O(n²)
// ─────────────────────────────────────────────────────────────────────────────
const buildCollapsedSet = (rows: BudgetItemRow[], expandedMap: Record<string, boolean>): Set<string> => {
  const hidden = new Set<string>();
  const rowMap = new Map(rows.map(r => [r.partida, r]));
  const sorted = [...rows].sort((a, b) => a.partida.localeCompare(b.partida, undefined, { numeric: true }));

  sorted.forEach((r) => {
    const parentId = getParentPartida(r.partida);
    if (parentId) {
      const isParentHidden = hidden.has(parentId);
      const parentRow = rowMap.get(parentId);
      const isParentCollapsed = expandedMap[parentId] === false && parentRow?._hasChildren;

      if (isParentHidden || isParentCollapsed) {
        hidden.add(r.partida);
      }
    }
  });

  return hidden;
};

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
export const useBudgetStore = create<BudgetState>((set, get) => ({
  rows: [],
  expandedMap: {},
  searchQuery: '',
  selectedId: null,
  multiSelection: [],
  clipboard: null,
  isDirty: false,

  setDirty: (dirty) => set({ isDirty: dirty }),

  initialize: (initialRows) => {
    const enhanced = rebuildHierarchy(initialRows);
    performTreeCalculation(enhanced);

    const expandedMap: Record<string, boolean> = {};
    enhanced.forEach(r => {
      expandedMap[r.partida] = r._level! < 1; // Top level expanded by default
    });

    set({ rows: enhanced, expandedMap, isDirty: false, multiSelection: [], clipboard: null });
  },

  toggleExpand: (partida) => {
    set(produce((state: BudgetState) => {
      state.expandedMap[partida] = !state.expandedMap[partida];
    }));
  },

  expandAll: () => {
    set(produce((state: BudgetState) => {
      state.rows.forEach(r => {
        if (r._hasChildren) state.expandedMap[r.partida] = true;
      });
    }));
  },

  collapseAll: () => {
    set(produce((state: BudgetState) => {
      state.rows.forEach(r => {
        if (r._hasChildren) state.expandedMap[r.partida] = false;
      });
    }));
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedId: (selectedId) => set({ selectedId, multiSelection: selectedId ? [selectedId] : [] }),

  setMultiSelection: (ids) => set({ multiSelection: ids }),

  toggleMultiSelect: (id) => {
    set(produce((state: BudgetState) => {
      const idx = state.multiSelection.indexOf(id);
      if (idx >= 0) {
        state.multiSelection.splice(idx, 1);
      } else {
        state.multiSelection.push(id);
      }
      if (state.multiSelection.length === 1) {
        state.selectedId = state.multiSelection[0];
      }
    }));
  },

  rangeSelect: (fromId, toId) => {
    const { rows, expandedMap } = get();
    const hidden = buildCollapsedSet(rows, expandedMap);
    const visible = rows.filter(r => !hidden.has(r.partida));
    const fromIdx = visible.findIndex(r => r.partida === fromId);
    const toIdx = visible.findIndex(r => r.partida === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    const ids = visible.slice(start, end + 1).map(r => r.partida);
    set({ multiSelection: ids, selectedId: toId });
  },

  updateCell: (partida, field, value) => {
    set(produce((state: BudgetState) => {
      const row = state.rows.find(r => r.partida === partida);
      if (row) {
        (row as any)[field] = value;
        if (field === 'metrado' || field === 'precio_unitario') {
          row.parcial = Number(row.metrado || 0) * Number(row.precio_unitario || 0);
        }
      }
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  editPartidaCode: (oldCode, newCode) => {
    set(produce((state: BudgetState) => {
      if (oldCode === newCode || !newCode.trim()) return;
      if (state.rows.some(r => r.partida === newCode.trim())) {
        alert("El código de ítem ya existe.");
        return;
      }

      const cleanNewCode = newCode.trim();
      const prefixOld = `${oldCode}.`;
      const prefixNew = `${cleanNewCode}.`;

      state.rows.forEach(r => {
        if (r.partida === oldCode) {
          r.partida = cleanNewCode;
        } else if (r.partida.startsWith(prefixOld)) {
          r.partida = prefixNew + r.partida.substring(prefixOld.length);
        }
      });

      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);

      if (state.selectedId === oldCode) state.selectedId = cleanNewCode;
      state.multiSelection = state.multiSelection.map(id => {
        if (id === oldCode) return cleanNewCode;
        if (id.startsWith(prefixOld)) return prefixNew + id.substring(prefixOld.length);
        return id;
      });

      const newExpanded: Record<string, boolean> = {};
      Object.keys(state.expandedMap).forEach(key => {
        if (key === oldCode) {
          newExpanded[cleanNewCode] = state.expandedMap[key];
        } else if (key.startsWith(prefixOld)) {
          newExpanded[prefixNew + key.substring(prefixOld.length)] = state.expandedMap[key];
        } else {
          newExpanded[key] = state.expandedMap[key];
        }
      });
      state.expandedMap = newExpanded;
      state.isDirty = true;
    }));
  },

  renumberItems: () => {
    set(produce((state: BudgetState) => {
      state.rows = renumberWBS(state.rows);
      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  // ── Insert actions ────────────────────────────────────────────────────────

  addNode: (parentId, type) => {
    set(produce((state: BudgetState) => {
      const newCode = generateNextCode(parentId, state.rows);

      let descripcion = 'Nueva partida';
      let unidad = 'und';
      if (type === 'titulo') { descripcion = 'NUEVO TÍTULO'; unidad = ''; }
      else if (type === 'subtitulo') { descripcion = 'Nuevo subtítulo'; unidad = ''; }

      const newRow: BudgetItemRow = {
        partida: newCode,
        descripcion,
        unidad,
        metrado: 0,
        precio_unitario: 0,
        parcial: 0,
        metrado_source: null,
        tipo_fila: type === 'partida' ? 'partida' : type === 'subtitulo' ? 'subtitulo' : 'titulo',
      };

      state.rows.push(newRow);

      if (parentId && !state.expandedMap[parentId]) {
        state.expandedMap[parentId] = true;
      }

      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  addRowAfter: (partida, type = 'partida') => {
    set(produce((state: BudgetState) => {
      const parentCode = getParentPartida(partida);
      const siblings = state.rows
        .filter(r => getParentPartida(r.partida) === parentCode)
        .sort((a, b) => a.partida.localeCompare(b.partida, undefined, { numeric: true, sensitivity: 'base' }));

      const idx = siblings.findIndex(s => s.partida === partida);
      const nextSibling = siblings[idx + 1];

      // Generate code between current and next sibling
      const newCode = generateNextCode(parentCode, state.rows);

      const newRow: BudgetItemRow = {
        partida: newCode,
        descripcion: type === 'titulo' ? 'NUEVO TÍTULO' : 'Nueva partida',
        unidad: type === 'titulo' ? '' : 'und',
        metrado: 0,
        precio_unitario: 0,
        parcial: 0,
        metrado_source: null,
        tipo_fila: type,
      };

      state.rows.push(newRow);
      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  addRowBefore: (partida, type = 'partida') => {
    // Same sibling insertion — renumberWBS handles the ordering
    get().addRowAfter(partida, type);
  },

  // ── Row movement ──────────────────────────────────────────────────────────

  moveUp: (partida) => {
    set(produce((state: BudgetState) => {
      const parentCode = getParentPartida(partida);
      const siblings = state.rows
        .filter(r => getParentPartida(r.partida) === parentCode)
        .sort((a, b) => a.partida.localeCompare(b.partida, undefined, { numeric: true, sensitivity: 'base' }));

      const idx = siblings.findIndex(s => s.partida === partida);
      if (idx <= 0) return; // already first

      // Swap WBS codes between the block and the previous sibling block
      const current = siblings[idx];
      const prev = siblings[idx - 1];

      const currentPrefix = current.partida;
      const prevPrefix = prev.partida;
      const tempPrefix = '__TEMP__';

      // Swap all rows belonging to each block
      state.rows.forEach(r => {
        if (r.partida === currentPrefix || r.partida.startsWith(`${currentPrefix}.`)) {
          r.partida = r.partida.replace(currentPrefix, tempPrefix);
        }
      });
      state.rows.forEach(r => {
        if (r.partida === prevPrefix || r.partida.startsWith(`${prevPrefix}.`)) {
          r.partida = r.partida.replace(prevPrefix, currentPrefix);
        }
      });
      state.rows.forEach(r => {
        if (r.partida === tempPrefix || r.partida.startsWith(`${tempPrefix}.`)) {
          r.partida = r.partida.replace(tempPrefix, prevPrefix);
        }
      });

      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  moveDown: (partida) => {
    set(produce((state: BudgetState) => {
      const parentCode = getParentPartida(partida);
      const siblings = state.rows
        .filter(r => getParentPartida(r.partida) === parentCode)
        .sort((a, b) => a.partida.localeCompare(b.partida, undefined, { numeric: true, sensitivity: 'base' }));

      const idx = siblings.findIndex(s => s.partida === partida);
      if (idx >= siblings.length - 1) return; // already last

      const current = siblings[idx];
      const next = siblings[idx + 1];

      // Use the same swap logic as moveUp but with next sibling
      const currentPrefix = current.partida;
      const nextPrefix = next.partida;
      const tempPrefix = '__TEMP__';

      state.rows.forEach(r => {
        if (r.partida === currentPrefix || r.partida.startsWith(`${currentPrefix}.`)) {
          r.partida = r.partida.replace(currentPrefix, tempPrefix);
        }
      });
      state.rows.forEach(r => {
        if (r.partida === nextPrefix || r.partida.startsWith(`${nextPrefix}.`)) {
          r.partida = r.partida.replace(nextPrefix, currentPrefix);
        }
      });
      state.rows.forEach(r => {
        if (r.partida === tempPrefix || r.partida.startsWith(`${tempPrefix}.`)) {
          r.partida = r.partida.replace(tempPrefix, nextPrefix);
        }
      });

      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  moveBlock: (partida, targetPartida, position) => {
    // Complex multi-level move: cut + paste sibling
    set(produce((state: BudgetState) => {
      const sourcePrefix = `${partida}.`;
      const block = state.rows.filter(r => r.partida === partida || r.partida.startsWith(sourcePrefix));

      if (block.length === 0) return;

      // Remove from current position
      state.rows = state.rows.filter(r => r.partida !== partida && !r.partida.startsWith(sourcePrefix));

      // Get target parent
      const targetParent = getParentPartida(targetPartida);
      const newBaseCode = generateNextCode(targetParent, state.rows);
      const remapped = remapBlock(block, partida, newBaseCode);

      state.rows.push(...remapped);
      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  // ── Conversion ────────────────────────────────────────────────────────────

  convertToTitle: (partida) => {
    set(produce((state: BudgetState) => {
      const row = state.rows.find(r => r.partida === partida);
      if (!row) return;

      row.tipo_fila = 'titulo';
      row.descripcion = row.descripcion.toUpperCase();
      row.metrado = 0;
      row.precio_unitario = 0;
      row.parcial = 0;
      row.unidad = '';

      // Promover/desvincular del nodo padre (outdent)
      // Ejemplo: si era 01.01.01 (hijo de 01.01), al añadir '/' se ordena ASCII: '.'(46) < '/'(47) < '0'(48)
      // Así, '01.01/z' se ordena DESPUÉS de todos los hijos '01.01.xx' pero ANTES de '01.02'
      // Y getParentPartida('01.01/z') dividirá por el último punto, devolviendo '01', subiéndolo de nivel.
      const parts = row.partida.split('.');
      if (parts.length > 1) {
        const grandParentCode = parts.slice(0, -2).join('.');
        const newCode = grandParentCode === '' ? generateNextCode(null, state.rows) : generateNextCode(grandParentCode, state.rows);
        row.partida = newCode;
      }

      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  convertToPartida: (partida) => {
    set(produce((state: BudgetState) => {
      const row = state.rows.find(r => r.partida === partida);
      if (!row) return;
      // Can only convert if no children
      const hasChildren = state.rows.some(r => getParentPartida(r.partida) === partida);
      if (hasChildren) return;

      row.tipo_fila = 'partida';
      row.unidad = 'und';

      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteRow: (partida) => {
    set(produce((state: BudgetState) => {
      const prefix = `${partida}.`;
      state.rows = state.rows.filter(r => r.partida !== partida && !r.partida.startsWith(prefix));
      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);

      if (state.selectedId === partida || (state.selectedId && state.selectedId.startsWith(prefix))) {
        state.selectedId = null;
      }
      state.multiSelection = state.multiSelection.filter(id => id !== partida && !id.startsWith(prefix));
      state.isDirty = true;
    }));
  },

  deleteMultiSelection: () => {
    set(produce((state: BudgetState) => {
      const toDelete = new Set(state.multiSelection);
      // Expand to include descendants
      const toDeleteFull = new Set<string>();
      state.rows.forEach(r => {
        for (const id of toDelete) {
          if (r.partida === id || r.partida.startsWith(`${id}.`)) {
            toDeleteFull.add(r.partida);
          }
        }
      });
      state.rows = state.rows.filter(r => !toDeleteFull.has(r.partida));
      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.selectedId = null;
      state.multiSelection = [];
      state.isDirty = true;
    }));
  },

  // ── Clipboard ─────────────────────────────────────────────────────────────

  setClipboard: (action, partidaId, scope = 'node') =>
    set({ clipboard: action && partidaId ? { action, partidaId, scope } : null }),

  pasteNode: (targetParentId) => {
    set(produce((state: BudgetState) => {
      const { clipboard, rows } = state;
      if (!clipboard) return;

      const nodesToCopy = getNodesByScope(rows, clipboard.partidaId, clipboard.scope);
      if (nodesToCopy.length === 0) return;

      const newBaseCode = generateNextCode(targetParentId, rows);

      // For 'children' scope, the base code of each child's original parent is the clipboard root
      const originalBase = clipboard.scope === 'children'
        ? clipboard.partidaId
        : clipboard.partidaId;

      const newNodes: BudgetItemRow[] = nodesToCopy.map(node => {
        const suffix = clipboard.scope === 'children'
          ? node.partida.substring(clipboard.partidaId.length) // removes root prefix
          : node.partida.substring(clipboard.partidaId.length); // same for full node

        const newPartidaCode = clipboard.scope === 'row'
          ? newBaseCode // single row → direct code
          : `${newBaseCode}${suffix}`;

        return {
          ...node,
          id: undefined,
          partida: newPartidaCode,
        };
      });

      if (clipboard.action === 'cut') {
        const sourcePrefix = `${clipboard.partidaId}.`;
        if (clipboard.scope === 'node') {
          state.rows = state.rows.filter(r => r.partida !== clipboard.partidaId && !r.partida.startsWith(sourcePrefix));
        } else if (clipboard.scope === 'children') {
          state.rows = state.rows.filter(r => !r.partida.startsWith(sourcePrefix));
        }
        // For 'row' scope on cut, only remove that row
        if (clipboard.scope === 'row') {
          state.rows = state.rows.filter(r => r.partida !== clipboard.partidaId);
        }
        state.clipboard = null;
      }

      state.rows.push(...newNodes);

      if (targetParentId && !state.expandedMap[targetParentId]) {
        state.expandedMap[targetParentId] = true;
      }

      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  pasteAfter: (targetPartidaId) => {
    set(produce((state: BudgetState) => {
      const { clipboard, rows } = state;
      if (!clipboard) return;

      const nodesToCopy = getNodesByScope(rows, clipboard.partidaId, clipboard.scope);
      if (nodesToCopy.length === 0) return;

      const targetParent = getParentPartida(targetPartidaId);
      const newBaseCode = generateNextCode(targetParent, rows);

      const newNodes: BudgetItemRow[] = nodesToCopy.map(node => {
        const suffix = clipboard.scope === 'row'
          ? ''
          : node.partida.substring(clipboard.partidaId.length);

        return {
          ...node,
          id: undefined,
          partida: clipboard.scope === 'row' ? newBaseCode : `${newBaseCode}${suffix}`,
        };
      });

      if (clipboard.action === 'cut') {
        const sourcePrefix = `${clipboard.partidaId}.`;
        state.rows = state.rows.filter(r => r.partida !== clipboard.partidaId && !r.partida.startsWith(sourcePrefix));
        state.clipboard = null;
      }

      state.rows.push(...newNodes);
      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  calculateTree: () => {
    set(produce((state: BudgetState) => {
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  // ── Visibility (optimized O(n)) ───────────────────────────────────────────
  getVisibleRows: () => {
    const { rows, expandedMap, searchQuery } = get();

    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      return rows.filter(r =>
        r.partida.includes(lowerQ) ||
        r.descripcion.toLowerCase().includes(lowerQ),
      );
    }

    const hidden = buildCollapsedSet(rows, expandedMap);
    return rows.filter(r => !hidden.has(r.partida));
  },
}));
