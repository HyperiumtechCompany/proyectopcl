import { create } from 'zustand';
import { produce } from 'immer';
import axios from 'axios';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SupervisionGGDetalleRow {
    id?: number | null;
    parent_id?: number | null;
    tipo_fila: 'seccion' | 'detalle';
    item_codigo: string;
    concepto: string;
    unidad: string;
    cantidad: number;
    meses: number;
    importe: number;
    subtotal: number;   // cantidad * meses * importe (calculado)
    total_seccion: number; // SUM de subtotales de hijos (para secciones)
    item_order?: number;
    // UI helpers (no persisted)
    hijos?: SupervisionGGDetalleRow[];
}

// ─── Initial data (Imagen de referencia) ──────────────────────────────────────

export const initialDetalleRows: SupervisionGGDetalleRow[] = [
    {
        item_codigo: 'A',
        concepto: 'A. SUELDOS DE PERSONAL CEDE CENTRAL',
        unidad: '',
        cantidad: 0,
        meses: 0,
        importe: 0,
        subtotal: 0,
        total_seccion: 3240.00,
        tipo_fila: 'seccion',
        hijos: [
            { item_codigo: '1', concepto: 'Contador',   unidad: 'Mes', cantidad: 0.1, meses: 6, importe: 3600.00, subtotal: 2160.00, total_seccion: 0, tipo_fila: 'detalle' },
            { item_codigo: '2', concepto: 'Secretaria', unidad: 'Mes', cantidad: 0.1, meses: 6, importe: 1800.00, subtotal: 1080.00, total_seccion: 0, tipo_fila: 'detalle' },
        ],
    },
    {
        item_codigo: 'B',
        concepto: 'B. OFICINAS ADM. CEDE CENTRAL',
        unidad: '',
        cantidad: 0,
        meses: 0,
        importe: 0,
        subtotal: 0,
        total_seccion: 4400.00,
        tipo_fila: 'seccion',
        hijos: [
            { item_codigo: '1', concepto: 'Oficinas incl. Mobiliario y utiles de ofic.', unidad: 'mes', cantidad: 0.1, meses: 6, importe: 1500.00, subtotal: 900.00,  total_seccion: 0, tipo_fila: 'detalle' },
            { item_codigo: '2', concepto: 'Equipos de Cómputo, fotocopiadoras, Software, calcu', unidad: 'Und', cantidad: 1, meses: 1, importe: 3500.00, subtotal: 3500.00, total_seccion: 0, tipo_fila: 'detalle' },
        ],
    },
    {
        item_codigo: 'C',
        concepto: 'C. MOVILIDAD Y EQUIPOS DE CAMPO PARA OBRA',
        unidad: '',
        cantidad: 0,
        meses: 0,
        importe: 0,
        subtotal: 0,
        total_seccion: 38623.97,
        tipo_fila: 'seccion',
        hijos: [
            { item_codigo: '1', concepto: 'Alquiler de Camioneta uso del Personal Tecnico', unidad: 'mes', cantidad: 1,   meses: 6, importe: 6200.00, subtotal: 37200.00, total_seccion: 0, tipo_fila: 'detalle' },
            { item_codigo: '2', concepto: 'Alquiler de Equipo topografico',                unidad: 'mes', cantidad: 0.1, meses: 6, importe: 2373.28, subtotal: 1423.97, total_seccion: 0, tipo_fila: 'detalle' },
        ],
    },
];

// ─── Store ─────────────────────────────────────────────────────────────────────

interface SupervisionGGDetalleState {
    sections: SupervisionGGDetalleRow[];   // tree: each has .hijos
    loading: boolean;
    isSaving: boolean;
    projectId: number | null;
    totalGlobal: number;

    setProjectId: (id: number) => void;
    loadFromDatabase: (projectId: number) => Promise<void>;
    saveToDatabase: () => Promise<number>; // returns grandTotal
    updateCell: (sectionIdx: number, rowIdx: number, field: keyof SupervisionGGDetalleRow, value: any) => void;
    addRow: (sectionIdx: number) => void;
    removeRow: (sectionIdx: number, rowIdx: number) => void;
    calculateTree: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcSubtotal(row: SupervisionGGDetalleRow): number {
    return Number(((row.cantidad || 0) * (row.meses || 0) * (row.importe || 0)).toFixed(2));
}

function calcSectionTotal(section: SupervisionGGDetalleRow): number {
    return Number((section.hijos || []).reduce((s, r) => s + (r.subtotal || 0), 0).toFixed(2));
}

function flattenToDbRows(sections: SupervisionGGDetalleRow[]): any[] {
    const out: any[] = [];
    let order = 0;
    for (const section of sections) {
        out.push({
            id: section.id ?? null,
            parent_id: null,
            tipo_fila: 'seccion',
            item_codigo: section.item_codigo,
            concepto: section.concepto,
            unidad: section.unidad || null,
            cantidad: 0,
            meses: 0,
            importe: 0,
            total_seccion: section.total_seccion,
            item_order: order++,
        });
        const sectionTempId = section.id ?? -out.length; // Use negative index as client-side temp id
        for (const child of (section.hijos || [])) {
            out.push({
                id: child.id ?? null,
                parent_id: section.id ?? null,  // will be remapped by server if null
                tipo_fila: 'detalle',
                item_codigo: child.item_codigo,
                concepto: child.concepto,
                unidad: child.unidad || null,
                cantidad: child.cantidad,
                meses: child.meses,
                importe: child.importe,
                total_seccion: 0,
                item_order: order++,
            });
        }
    }
    return out;
}

function buildTreeFromDbRows(dbRows: any[]): SupervisionGGDetalleRow[] {
    const sections: SupervisionGGDetalleRow[] = [];
    const byId = new Map<number, SupervisionGGDetalleRow>();

    for (const r of dbRows) {
        const row: SupervisionGGDetalleRow = {
            id: r.id,
            parent_id: r.parent_id,
            tipo_fila: r.tipo_fila,
            item_codigo: r.item_codigo || '',
            concepto: r.concepto || '',
            unidad: r.unidad || '',
            cantidad: Number(r.cantidad) || 0,
            meses: Number(r.meses) || 0,
            importe: Number(r.importe) || 0,
            subtotal: Number(r.subtotal) || 0,
            total_seccion: Number(r.total_seccion) || 0,
            item_order: r.item_order || 0,
            hijos: [],
        };
        byId.set(r.id, row);
        if (!r.parent_id) {
            sections.push(row);
        }
    }

    for (const r of dbRows) {
        if (r.parent_id && byId.has(r.parent_id) && byId.has(r.id)) {
            const parent = byId.get(r.parent_id)!;
            if (!parent.hijos) parent.hijos = [];
            parent.hijos.push(byId.get(r.id)!);
        }
    }

    return sections.sort((a, b) => (a.item_order ?? 0) - (b.item_order ?? 0));
}

// ─── Zustand Store ─────────────────────────────────────────────────────────────

export const useSupervisionGGDetalleStore = create<SupervisionGGDetalleState>((set, get) => ({
    sections: initialDetalleRows,
    loading: false,
    isSaving: false,
    projectId: null,
    totalGlobal: 46263.97,

    setProjectId: (id) => set({ projectId: id }),

    loadFromDatabase: async (projectId) => {
        set({ loading: true, projectId });
        try {
            const res = await axios.get(`/costos/proyectos/${projectId}/presupuesto/supervision-gg-detalle`);
            if (res.data?.success) {
                const rows = res.data.rows as any[];
                if (rows.length > 0) {
                    const sections = buildTreeFromDbRows(rows);
                    set({ sections, totalGlobal: res.data.total ?? 0, loading: false });
                } else {
                    // No data yet - use initial rows and calculate total
                    const total = initialDetalleRows.reduce((s, sec) => s + sec.total_seccion, 0);
                    set({ sections: initialDetalleRows, totalGlobal: Number(total.toFixed(2)), loading: false });
                }
            } else {
                set({ loading: false });
            }
        } catch (err) {
            console.error('Error loading supervision_gg_detalle:', err);
            set({ loading: false });
        }
    },

    saveToDatabase: async () => {
        const { sections, projectId, isSaving } = get();
        if (!projectId || isSaving) return get().totalGlobal;

        set({ isSaving: true });
        try {
            const rows = flattenToDbRows(sections);
            const res = await axios.patch(
                `/costos/proyectos/${projectId}/presupuesto/supervision-gg-detalle`,
                { rows }
            );
            if (res.data?.success) {
                const saved = buildTreeFromDbRows(res.data.rows ?? []);
                const total = res.data.total ?? 0;
                set({ sections: saved, totalGlobal: total, isSaving: false });
                return total;
            }
            set({ isSaving: false });
            return get().totalGlobal;
        } catch (err) {
            console.error('Error saving supervision_gg_detalle:', err);
            set({ isSaving: false });
            return get().totalGlobal;
        }
    },

    updateCell: (sectionIdx, rowIdx, field, value) => {
        set(
            produce((state: SupervisionGGDetalleState) => {
                const section = state.sections[sectionIdx];
                if (!section) return;
                const row = section.hijos?.[rowIdx];
                if (!row) return;
                (row as any)[field] = value;
                // Recalculate subtotal for editable fields
                if (['cantidad', 'meses', 'importe'].includes(field as string)) {
                    row.subtotal = calcSubtotal(row);
                }
                // Recalculate section total
                section.total_seccion = calcSectionTotal(section);
                // Recalculate global total
                state.totalGlobal = Number(
                    state.sections.reduce((s, sec) => s + sec.total_seccion, 0).toFixed(2)
                );
            })
        );
    },

    addRow: (sectionIdx) => {
        set(
            produce((state: SupervisionGGDetalleState) => {
                const section = state.sections[sectionIdx];
                if (!section) return;
                if (!section.hijos) section.hijos = [];
                const newRow: SupervisionGGDetalleRow = {
                    id: null,
                    parent_id: section.id ?? null,
                    tipo_fila: 'detalle',
                    item_codigo: '',
                    concepto: 'Nueva partida',
                    unidad: 'mes',
                    cantidad: 1,
                    meses: 1,
                    importe: 0,
                    subtotal: 0,
                    total_seccion: 0,
                };
                section.hijos.push(newRow);
                section.total_seccion = calcSectionTotal(section);
                state.totalGlobal = Number(
                    state.sections.reduce((s, sec) => s + sec.total_seccion, 0).toFixed(2)
                );
            })
        );
    },

    removeRow: (sectionIdx, rowIdx) => {
        set(
            produce((state: SupervisionGGDetalleState) => {
                const section = state.sections[sectionIdx];
                if (!section?.hijos) return;
                section.hijos.splice(rowIdx, 1);
                section.total_seccion = calcSectionTotal(section);
                state.totalGlobal = Number(
                    state.sections.reduce((s, sec) => s + sec.total_seccion, 0).toFixed(2)
                );
            })
        );
    },

    calculateTree: () => {
        set(
            produce((state: SupervisionGGDetalleState) => {
                for (const section of state.sections) {
                    for (const row of (section.hijos || [])) {
                        row.subtotal = calcSubtotal(row);
                    }
                    section.total_seccion = calcSectionTotal(section);
                }
                state.totalGlobal = Number(
                    state.sections.reduce((s, sec) => s + sec.total_seccion, 0).toFixed(2)
                );
            })
        );
    },
}));
