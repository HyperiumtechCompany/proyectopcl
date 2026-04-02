import { produce } from 'immer';
import { create } from 'zustand';

import type { Remuneracion } from '../../../../types/presupuestos';

export type RemuneracionRow = Remuneracion;

interface RemuneracionesState {
    rows: RemuneracionRow[];
    loading: boolean;
    isDirty: boolean;

    setRows: (rows: RemuneracionRow[]) => void;
    setLoading: (loading: boolean) => void;
    setDirty: (dirty: boolean) => void;
    updateCell: (
        index: number,
        field: keyof RemuneracionRow,
        value: any,
    ) => void;
    addRow: (
        ggVariableId: number | null,
        presupuestoId: number,
        cargo?: string,
    ) => void;
    removeRow: (index: number) => void;
    calculateTotal: () => number;
    getSummary: () => {
        mensual: any;
        total: any;
    };
    setMesesAll: (meses: number) => void;
}

export const useRemuneracionesStore = create<RemuneracionesState>(
    (set, get) => ({
        rows: [],
        loading: false,
        isDirty: false,

        setRows: (rows) => set({ rows, isDirty: false }),
        setLoading: (loading) => set({ loading }),
        setDirty: (isDirty) => set({ isDirty }),

        updateCell: (index, field, value) => {
            set(
                produce((state: RemuneracionesState) => {
                    const row = state.rows[index];
                    if (row) {
                        (row as any)[field] = value;

                        // Solo calculamos si cambian los inputs base
                        const baseFields = [
                            'sueldo_basico',
                            'asignacion_familiar',
                            'cantidad',
                            'meses',
                            'participacion',
                        ];

                        if (baseFields.includes(field as string)) {
                            const s = Number(row.sueldo_basico) || 0;
                            const cantidad = Number(row.cantidad) || 0;
                            const meses = Number(row.meses) || 0;
                            const participacion =
                                (Number(row.participacion) || 100) / 100;

                            // Monto base mensual para ESTA FILA (TOTAL MENSUAL DE LA FILA)
                            const pu_total = s * cantidad * participacion;

                            // asignación familiar (Calculada para el total de la fila)
                            const AF_UNIT = 102.5; // RMV Actual en Perú es 1025, 10% es 102.5. El usuario usaba 46, pero mantendré 102.5 o lo que guste.
                            // Sin embargo, el usuario puso 46 en el código anterior. Usaré 46 si es lo que prefieren o 102.5.
                            // Re-chequeando: el usuario puso 46. Mantengo 46 por consistencia con su entorno.
                            const af_row = 46 * cantidad * participacion;
                            row.asignacion_familiar = Number(af_row.toFixed(2));
                            const af = row.asignacion_familiar;

                            // base remunerativa para cálculos de beneficios (PU + AF)
                            const base = pu_total + af;

                            // beneficios según nuevas reglas del usuario (SOBRE EL TOTAL DE LA FILA)
                            row.gratificacion = Number(
                                ((s + af) / 12).toFixed(2),
                            );
                            row.vacaciones = Number(((s + af) / 12).toFixed(2));

                            // para snp es 13% (0.13)
                            row.snp = Number(((s + af) * 0.13).toFixed(2));

                            // para esalud es 9% (0.09) de PU
                            row.essalud = Number((s * 0.09).toFixed(2));

                            // para cts es (pu + af + gratif) * 0.083333
                            row.cts = Number(
                                (
                                    (s + af + row.gratificacion) *
                                    0.083333
                                ).toFixed(2),
                            );

                            // total mensual (de la fila completa). SNP NO se suma al costo del empleador.
                            row.total_mensual_unitario = Number(
                                (
                                    s +
                                    af +
                                    row.essalud +
                                    row.cts +
                                    row.vacaciones +
                                    row.gratificacion
                                ).toFixed(2),
                            );

                            // total proyecto
                            row.total_proyecto = Number(
                                (row.total_mensual_unitario * meses).toFixed(2),
                            );
                        }
                        state.isDirty = true;
                    }
                }),
            );
        },

        addRow: (ggVariableId, presupuestoId, cargo = 'Nuevo Cargo') => {
            set(
                produce((state: RemuneracionesState) => {
                    state.rows.push({
                        presupuesto_id: presupuestoId,
                        gg_variable_id: ggVariableId,
                        cargo: cargo,
                        categoria: 'Profesional',
                        participacion: 100,
                        cantidad: 1,
                        meses: 1,
                        sueldo_basico: 0,
                        asignacion_familiar: 0,
                        snp: 0,
                        essalud: 0,
                        cts: 0,
                        vacaciones: 0,
                        gratificacion: 0,
                        total_mensual_unitario: 0,
                        total_proyecto: 0,
                    });
                    state.isDirty = true;
                }),
            );
        },

        removeRow: (index) => {
            set(
                produce((state: RemuneracionesState) => {
                    state.rows.splice(index, 1);
                    state.isDirty = true;
                }),
            );
        },

        getSummary: () => {
            const { rows } = get();

            // 1. Mensual row sums (Sum of row columns)
            const m_pu = rows.reduce(
                (acc, r) => acc + (Number(r.sueldo_basico) || 0),
                0,
            );
            const m_af = rows.reduce(
                (acc, r) => acc + (Number(r.asignacion_familiar) || 0),
                0,
            );
            const m_gratif = rows.reduce(
                (acc, r) => acc + (Number(r.gratificacion) || 0),
                0,
            );
            const m_vac = rows.reduce(
                (acc, r) => acc + (Number(r.vacaciones) || 0),
                0,
            );

            // Mensual row calculated formulas as requested
            const m_snp = (m_pu + m_af) * 0.13;
            const m_essalud = m_pu * 0.09;
            const m_cts = (m_pu + m_af + m_gratif) * 0.083333;
            const m_total = m_pu + m_af + m_essalud + m_gratif + m_vac + m_cts;

            // 2. Total Project row sums (SumaProducto: meses * sueldo_basico)
            const t_pu = rows.reduce(
                (acc, r) =>
                    acc + (Number(r.sueldo_basico) || 0) * (Number(r.meses) || 0),
                0,
            );
            const t_af = rows.reduce(
                (acc, r) =>
                    acc + (Number(r.asignacion_familiar) || 0) * (Number(r.meses) || 0),
                0,
            );
            const t_gratif = rows.reduce(
                (acc, r) => (acc + (Number(r.gratificacion) || 0) * (Number(r.meses) || 0)),
                0,
            );
            const t_vac = rows.reduce(
                (acc, r) => (acc + (Number(r.vacaciones) || 0) * (Number(r.meses) || 0)),
                0,
            );

            // Total Project row calculated formulas
            const t_snp = (t_pu + t_af) * 0.13;
            const t_essalud = t_pu * 0.09; 
            const t_cts = (t_pu + t_af + t_gratif) * 0.083333;
            const t_total = t_pu + t_af + t_essalud + t_gratif + t_vac + t_cts;

            return {
                mensual: {
                    pu: m_pu,
                    af: m_af,
                    snp: m_snp,
                    essalud: m_essalud,
                    cts: m_cts,
                    vac: m_vac,
                    gratif: m_gratif,
                    total: m_total,
                },
                total: {
                    pu: t_pu,
                    af: t_af,
                    snp: t_snp,
                    essalud: t_essalud,
                    cts: t_cts,
                    vac: t_vac,
                    gratif: t_gratif,
                    total: t_total,
                },
            };
        },

        calculateTotal: () => {
            const { getSummary } = get();
            return getSummary().total.total;
        },

        setMesesAll: (meses) => {
            set(produce((state: RemuneracionesState) => {
                state.rows.forEach(row => {
                    row.meses = meses;
                    row.total_proyecto = Number((row.total_mensual_unitario * meses).toFixed(2));
                });
                state.isDirty = true;
            }));
        },
    }),
);
