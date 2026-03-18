import { create } from 'zustand';
import { produce } from 'immer';

export interface GastoGeneralRow {
    id?: number;
    partida: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio_unitario: number;
    parcial: number;
    tipo?: string; // e.g., 'fijo', 'variable'
}

interface GastosGeneralesState {
    rows: GastoGeneralRow[];
    loading: boolean;
    isDirty: boolean;
    
    setRows: (rows: GastoGeneralRow[]) => void;
    setLoading: (loading: boolean) => void;
    setDirty: (dirty: boolean) => void;
    updateCell: (index: number, field: keyof GastoGeneralRow, value: any) => void;
    addRow: () => void;
    removeRow: (index: number) => void;
    calculateTotal: () => number;
}

const toNumber = (value: unknown, fallback = 0): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const toText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value);
};

const normalizeRow = (row: GastoGeneralRow): GastoGeneralRow => {
    const cantidad = toNumber(row.cantidad);
    const precioUnitario = toNumber(row.precio_unitario);
    const parcialRaw = toNumber(row.parcial, NaN);
    const parcial = Number.isFinite(parcialRaw) ? parcialRaw : cantidad * precioUnitario;

    return {
        ...row,
        partida: toText(row.partida),
        descripcion: toText(row.descripcion),
        unidad: toText(row.unidad),
        cantidad,
        precio_unitario: precioUnitario,
        parcial,
    };
};

export const useGastosGeneralesStore = create<GastosGeneralesState>((set, get) => ({
    rows: [],
    loading: false,
    isDirty: false,

    setRows: (rows) => set({ rows: rows.map(normalizeRow), isDirty: false }),
    setLoading: (loading) => set({ loading }),
    setDirty: (isDirty) => set({ isDirty }),

    updateCell: (index, field, value) => {
        set(
            produce((state: GastosGeneralesState) => {
                const row = state.rows[index];
                if (row) {
                    (row as any)[field] = value;
                    if (field === 'cantidad' || field === 'precio_unitario') {
                        row.parcial = (Number(row.cantidad) || 0) * (Number(row.precio_unitario) || 0);
                    }
                    state.isDirty = true;
                }
            })
        );
    },

    addRow: () => {
        set(
            produce((state: GastosGeneralesState) => {
                state.rows.push({
                    partida: '',
                    descripcion: 'Nuevo Gasto General',
                    unidad: 'glb',
                    cantidad: 1,
                    precio_unitario: 0,
                    parcial: 0,
                });
                state.isDirty = true;
            })
        );
    },

    removeRow: (index) => {
        set(
            produce((state: GastosGeneralesState) => {
                state.rows.splice(index, 1);
                state.isDirty = true;
            })
        );
    },

    calculateTotal: () => {
        const { rows } = get();
        return rows.reduce((acc, row) => acc + (Number(row.parcial) || 0), 0);
    },
}));
