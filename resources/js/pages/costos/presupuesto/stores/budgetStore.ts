import { create } from 'zustand';
import { produce } from 'immer';

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
  // Hierarchical helper props
  _level?: number;
  _parentId?: string | null;
  _expanded?: boolean;
  _hasChildren?: boolean;
}

interface BudgetState {
  rows: BudgetItemRow[];
  expandedMap: Record<string, boolean>;
  searchQuery: string;
  selectedId: string | null;
  clipboard: { action: 'copy' | 'cut'; partidaId: string } | null;
  isDirty: boolean;

  // Actions
  initialize: (initialRows: any[]) => void;
  setDirty: (dirty: boolean) => void;
  toggleExpand: (partida: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedId: (id: string | null) => void;
  updateCell: (partida: string, field: keyof BudgetItemRow, value: any) => void;
  addNode: (parentId: string | null, type: 'titulo' | 'subtitulo' | 'partida') => void;
  deleteRow: (partida: string) => void;
  setClipboard: (action: 'copy' | 'cut' | null, partidaId?: string) => void;
  pasteNode: (targetParentId: string | null) => void;
  calculateTree: () => void;
  
  // Computed
  getVisibleRows: () => BudgetItemRow[];
}

// Helpers for the hierarchy
const getLevel = (partida: string) => (partida.match(/\./g) || []).length;
const getParentPartida = (partida: string) => {
  const parts = partida.split('.');
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join('.');
};

const generateNextCode = (parentCode: string | null, rows: BudgetItemRow[]) => {
  if (!parentCode) {
    const rootCodes = rows.filter(r => getLevel(r.partida) === 0).map(r => parseInt(r.partida, 10)).filter(n => !isNaN(n));
    const nextCode = rootCodes.length > 0 ? Math.max(...rootCodes) + 1 : 1;
    return nextCode.toString().padStart(2, '0');
  } else {
    const children = rows.filter(r => getParentPartida(r.partida) === parentCode);
    if (children.length === 0) {
      return `${parentCode}.01`;
    }
    const suffixCodes = children.map(r => {
      const parts = r.partida.split('.');
      return parseInt(parts[parts.length - 1], 10);
    }).filter(n => !isNaN(n));
    const nextSuffix = suffixCodes.length > 0 ? Math.max(...suffixCodes) + 1 : 1;
    return `${parentCode}.${nextSuffix.toString().padStart(2, '0')}`;
  }
};

const rebuildHierarchy = (rows: any[]) => {
  const rowsMap = new Map();
  const parentsFound = new Set<string>();

  // Sort rows properly by WBS numerical order
  const sorted = [...rows].sort((a, b) => a.partida.localeCompare(b.partida, undefined, { numeric: true, sensitivity: 'base' }));

  const enhanced = sorted.map((r, i) => {
    const level = getLevel(r.partida);
    const parentId = getParentPartida(r.partida);
    if (parentId) parentsFound.add(parentId);
    
    // Ensure _expanded is preserved if it already exists, otherwise default true
    const expanded = r._expanded !== undefined ? r._expanded : true;
    
    rowsMap.set(r.partida, { ...r, _level: level, _parentId: parentId, _hasChildren: false, _expanded: expanded, _index: i });
    return rowsMap.get(r.partida);
  });

  parentsFound.forEach(p => {
    if (rowsMap.has(p)) rowsMap.get(p)._hasChildren = true;
  });

  return enhanced;
};

const performTreeCalculation = (rows: BudgetItemRow[]) => {
  // Deep clone to avoid mutating standard params before immer handles it if needed, or we just mutate directly in immer
  // Since we use immer, we can just mutate the array passed
  const sorted = [...rows].sort((a, b) => b.partida.localeCompare(a.partida, undefined, { numeric: true, sensitivity: 'base' })); // Bottom-up
  
  const partialSums = new Map<string, number>();

  sorted.forEach(row => {
    // If it's a leaf (no children in the current rows structure)
    // Actually we can just check if any row has it as parent
    const hasChildren = sorted.some(r => getParentPartida(r.partida) === row.partida);
    
    if (!hasChildren) {
      // Leaf node: keep its own parcial
      partialSums.set(row.partida, Number(row.parcial) || 0);
    } else {
      // Parent node: sum of its direct children
      const children = sorted.filter(r => getParentPartida(r.partida) === row.partida);
      const sum = children.reduce((acc, child) => acc + (Number(partialSums.get(child.partida)) || 0), 0);
      partialSums.set(row.partida, sum);
      
      // Update the row's parcial and metadata
      const originalRow = rows.find(r => r.partida === row.partida);
      if (originalRow) {
        originalRow.parcial = sum;
        originalRow.precio_unitario = 0; // Parents don't have price/quantity
        originalRow.metrado = 0;
        originalRow.unidad = '';
      }
    }
  });
};

export const useBudgetStore = create<BudgetState>((set, get) => ({
  rows: [],
  expandedMap: {},
  searchQuery: '',
  selectedId: null,
  clipboard: null,
  isDirty: false,

  setDirty: (dirty) => set({ isDirty: dirty }),

  initialize: (initialRows) => {
    const enhanced = rebuildHierarchy(initialRows);
    
    // Default expanded state for top level if freshly initializing
    const expandedMap: Record<string, boolean> = {};
    enhanced.forEach(r => {
      expandedMap[r.partida] = r._level! < 1; // Expand only first couple levels by default
    });

    set({ rows: enhanced, expandedMap, isDirty: false });
  },

  toggleExpand: (partida) => {
    set(produce((state: BudgetState) => {
      state.expandedMap[partida] = !state.expandedMap[partida];
    }));
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedId: (selectedId) => set({ selectedId }),

  updateCell: (partida, field, value) => {
    set(produce((state: BudgetState) => {
      const row = state.rows.find(r => r.partida === partida);
      if (row) {
        (row as any)[field] = value;
        // recalculate simple math
        if (field === 'metrado' || field === 'precio_unitario') {
          row.parcial = Number(row.metrado || 0) * Number(row.precio_unitario || 0);
        }
      }
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  addNode: (parentId, type) => {
    set(produce((state: BudgetState) => {
      const newCode = generateNextCode(parentId, state.rows);
      
      let descripcion = 'Nueva partida';
      let unidad = 'und';
      
      if (type === 'titulo') {
        descripcion = 'NUEVO TÍTULO';
        unidad = '';
      } else if (type === 'subtitulo') {
        descripcion = 'Nuevo subtítulo';
        unidad = '';
      }

      const newRow: BudgetItemRow = {
        partida: newCode,
        descripcion,
        unidad,
        metrado: 0,
        precio_unitario: 0,
        parcial: 0,
        metrado_source: null
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

  deleteRow: (partida) => {
    set(produce((state: BudgetState) => {
      const prefix = `${partida}.`;
      state.rows = state.rows.filter(r => r.partida !== partida && !r.partida.startsWith(prefix));
      state.rows = rebuildHierarchy(state.rows);
      performTreeCalculation(state.rows);
      
      if (state.selectedId === partida || (state.selectedId && state.selectedId.startsWith(prefix))) {
        state.selectedId = null;
      }
      state.isDirty = true;
    }));
  },

  setClipboard: (action, partidaId) => set({ clipboard: action && partidaId ? { action, partidaId } : null }),

  pasteNode: (targetParentId) => {
    set(produce((state: BudgetState) => {
      const { clipboard, rows } = state;
      if (!clipboard) return;

      const sourcePrefix = `${clipboard.partidaId}.`;
      const nodesToCopy = rows.filter(r => r.partida === clipboard.partidaId || r.partida.startsWith(sourcePrefix));
      
      if (nodesToCopy.length === 0) return;

      const newBaseCode = generateNextCode(targetParentId, rows);
      
      const newNodes = nodesToCopy.map(node => {
        // Replace the base part of the WBS with the newBaseCode
        // e.g., if copying '01.02' to '02.01', '01.02.01' becomes '02.01.01'
        const suffix = node.partida.substring(clipboard.partidaId.length);
        const newPartidaCode = `${newBaseCode}${suffix}`;
        
        return {
          ...node,
          id: undefined, // ensure fresh DB insertion later
          partida: newPartidaCode
        };
      });

      if (clipboard.action === 'cut') {
        state.rows = state.rows.filter(r => r.partida !== clipboard.partidaId && !r.partida.startsWith(sourcePrefix));
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

  calculateTree: () => {
    set(produce((state: BudgetState) => {
      performTreeCalculation(state.rows);
      state.isDirty = true;
    }));
  },

  getVisibleRows: () => {
    const { rows, expandedMap, searchQuery } = get();
    
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      return rows.filter(r => 
        r.partida.includes(lowerQ) || 
        r.descripcion.toLowerCase().includes(lowerQ)
      );
    }

    const visible: BudgetItemRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // A row is visible if all its ancestors are expanded
      let isVisible = true;
      let parentId = r._parentId;
      while (parentId) {
        if (!expandedMap[parentId]) {
          isVisible = false;
          break;
        }
        parentId = getParentPartida(parentId);
      }
      
      if (isVisible) visible.push(r);
    }
    return visible;
  }
}));
