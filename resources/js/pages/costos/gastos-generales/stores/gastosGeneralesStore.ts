import { produce } from 'immer';
import { create } from 'zustand';

export interface GastoGeneralRow {
    id?: number;
    parent_id?: number | null;
    tipo_fila?: 'seccion' | 'detalle';
    item_codigo?: string;
    partida: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    periodo?: number;
    participacion?: number;
    porcentaje?: number;
    precio_unitario: number;
    parcial: number;
    tipo?: string; // e.g., 'fijo', 'variable'
}

interface GastosGeneralesState {
    rows: GastoGeneralRow[];
    loading: boolean;
    isDirty: boolean;
    
    setRows: (rows: GastoGeneralRow[]) => void;
    setRowsCalculated: (rows: GastoGeneralRow[]) => void;
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

/**
 * normalizeRow: normaliza una fila proveniente de la BD o de cualquier fuente.
 * - participacion: siempre en rango 0-100 (porcentaje entendible por humanos).
 *   Si la BD devuelve valores fraccionarios (p.ej. 1 = 100%), los convertimos
 *   multiplicando por 100. El motor recalculate se encarga de dividir entre 100.
 * - parcial: se recalcula si no viene de la BD (sub_total).
 */
const normalizeRow = (row: GastoGeneralRow): GastoGeneralRow => {
    const cantidad = toNumber(
        (row as any).cantidad_descripcion ?? row.cantidad,
    );
    const periodo = toNumber(
        (row as any).cantidad_tiempo ?? row.periodo,
        1,
    );
    // participacion de BD puede venir como 0-100 o como fracción 0-1.
    // Normalizamos: si viene <= 1 y no es exactamente 0 ó 100, asumimos fracción → ×100
    const rawPart = toNumber(
        (row as any).participacion ?? row.participacion,
        100,
    );
    const participacion = rawPart > 0 && rawPart <= 1 ? rawPart * 100 : rawPart;
    const porcentaje = toNumber((row as any).porcentaje ?? row.porcentaje, 0);
    const precioUnitario = toNumber(row.precio_unitario);
    const parcialRaw = toNumber((row as any).sub_total ?? row.parcial, NaN);
    // Factor siempre es participacion / 100
    const participacionFactor = participacion / 100;
    const parcial = Number.isFinite(parcialRaw)
        ? parcialRaw
        : cantidad * periodo * participacionFactor * precioUnitario;

    return {
        ...row,
        id: row.id,
        parent_id: (row as any).parent_id ?? row.parent_id ?? null,
        tipo_fila: (row as any).tipo_fila ?? row.tipo_fila,
        item_codigo: (row as any).item_codigo ?? row.item_codigo ?? row.partida,
        partida: toText(row.partida),
        descripcion: toText(row.descripcion),
        unidad: toText(row.unidad),
        cantidad,
        periodo,
        participacion,
        porcentaje,
        precio_unitario: precioUnitario,
        parcial,
    };
};

export const useGastosGeneralesStore = create<GastosGeneralesState>((set, get) => ({
    rows: [],
    loading: false,
    isDirty: false,

    setRows: (rows) => set({ rows: rows.map(normalizeRow), isDirty: false }),
    setRowsCalculated: (rows) => set({ rows: rows.map(normalizeRow) }),
    setLoading: (loading) => set({ loading }),
    setDirty: (isDirty) => set({ isDirty }),

    updateCell: (index, field, value) => {
        set(
            produce((state: GastosGeneralesState) => {
                const row = state.rows[index];
                if (row) {
                    (row as any)[field] = value;
                    if (
                        field === 'cantidad' ||
                        field === 'precio_unitario' ||
                        field === 'participacion' ||
                        field === 'periodo'
                    ) {
                        // participacion siempre en 0-100 → factor = /100
                        const participacion = toNumber(row.participacion, 100);
                        const participacionFactor = participacion / 100;
                        row.parcial =
                            (Number(row.cantidad) || 0) *
                            (Number(row.periodo) || 0) *
                            participacionFactor *
                            (Number(row.precio_unitario) || 0);
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
                    periodo: 1,
                    participacion: 100, // 100% por defecto
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
        return rows.reduce((acc, row) => {
            if (row.tipo_fila === 'seccion') return acc;
            return acc + (Number(row.parcial) || 0);
        }, 0);
    },
}));
