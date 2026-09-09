import { produce } from 'immer';
import { create } from 'zustand';

import type { Remuneracion } from '../../../../types/presupuestos';
import { calcularRemuneracion, decimalSeguro, sumarDecimales } from '../lib/calculos';
import { useProjectParamsStore } from '../../presupuesto/stores/projectParamsStore';

export type RemuneracionRow = Remuneracion;

function recalcularFila(row: RemuneracionRow): RemuneracionRow {
    const params = useProjectParamsStore.getState().params;
    const calculo = calcularRemuneracion({
        sueldoBasico: row.sueldo_basico,
        cantidad: row.cantidad,
        meses: row.meses,
        participacion: row.participacion,
        tasas: params ? {
            asignacionFamiliarFactor: params.asignacion_familiar_factor,
            snpPorcentaje: params.snp_porcentaje,
            essaludPorcentaje: params.essalud_porcentaje,
            ctsPorcentaje: params.cts_porcentaje,
            gratificacionPorcentaje: params.gratificacion_porcentaje,
            vacacionesPorcentaje: params.vacaciones_porcentaje,
        } : undefined,
    });

    return {
        ...row,
        asignacion_familiar: calculo.asignacionFamiliar,
        snp: calculo.snp,
        essalud: calculo.essalud,
        cts: calculo.cts,
        vacaciones: calculo.vacaciones,
        gratificacion: calculo.gratificacion,
        total_mensual_unitario: calculo.totalMensual,
        total_proyecto: calculo.totalProyecto,
    };
}

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
    recalculateAll: () => void;
}

export const useRemuneracionesStore = create<RemuneracionesState>(
    (set, get) => ({
        rows: [],
        loading: false,
        isDirty: false,

        setRows: (rows) => set({ rows: rows.map(recalcularFila), isDirty: false }),
        setLoading: (loading) => set({ loading }),
        setDirty: (isDirty) => set({ isDirty }),
        recalculateAll: () => set((state) => ({
            rows: state.rows.map(recalcularFila),
            isDirty: state.rows.length > 0 || state.isDirty,
        })),

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
                            const calculo = recalcularFila(row);

                            // Monto base mensual para ESTA FILA (TOTAL MENSUAL DE LA FILA)

                            // asignación familiar (Calculada para el total de la fila)
                            const AF_UNIT = 102.5; // RMV Actual en Perú es 1025, 10% es 102.5. El usuario usaba 46, pero mantendré 102.5 o lo que guste.
                            // Sin embargo, el usuario puso 46 en el código anterior. Usaré 46 si es lo que prefieren o 102.5.
                            // Re-chequeando: el usuario puso 46. Mantengo 46 por consistencia con su entorno.
                            row.asignacion_familiar = calculo.asignacion_familiar;

                            // base remunerativa para cálculos de beneficios (PU + AF)

                            // beneficios según nuevas reglas del usuario (SOBRE EL TOTAL DE LA FILA)
                            row.gratificacion = calculo.gratificacion;
                            row.vacaciones = calculo.vacaciones;

                            // para snp es 13% (0.13)
                            row.snp = calculo.snp;

                            // para esalud es 9% (0.09) de PU
                            row.essalud = calculo.essalud;

                            // para cts es (pu + af + gratif) * 0.083333
                            row.cts = calculo.cts;

                            // total mensual (de la fila completa). SNP NO se suma al costo del empleador.
                            row.total_mensual_unitario = calculo.total_mensual_unitario;

                            // total proyecto
                            row.total_proyecto = calculo.total_proyecto;
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

            const calculadas = rows.map(recalcularFila);
            const sumar = (field: keyof RemuneracionRow, porMeses = false) => sumarDecimales(
                calculadas.map((row) => decimalSeguro(row[field]).times(porMeses ? row.meses : 1)),
            );
            const m_pu = sumarDecimales(calculadas.map((row) => {
                const calculo = calcularRemuneracion({ sueldoBasico: row.sueldo_basico, cantidad: row.cantidad, meses: row.meses, participacion: row.participacion });
                return calculo.sueldoBase;
            }));
            const m_af = sumar('asignacion_familiar');
            const m_gratif = sumar('gratificacion');
            const m_vac = sumar('vacaciones');

            // Mensual row calculated formulas as requested
            const m_snp = sumar('snp');
            const m_essalud = sumar('essalud');
            const m_cts = sumar('cts');
            const m_total = sumar('total_mensual_unitario');

            // 2. Total Project row sums (SumaProducto: meses * sueldo_basico)
            const t_pu = sumarDecimales(calculadas.map((row) => {
                const calculo = calcularRemuneracion({ sueldoBasico: row.sueldo_basico, cantidad: row.cantidad, meses: row.meses, participacion: row.participacion });
                return decimalSeguro(calculo.sueldoBase).times(row.meses);
            }));
            const t_af = sumar('asignacion_familiar', true);
            const t_gratif = sumar('gratificacion', true);
            const t_vac = sumar('vacaciones', true);

            // Total Project row calculated formulas
            const t_snp = sumar('snp', true);
            const t_essalud = sumar('essalud', true);
            const t_cts = sumar('cts', true);
            const t_total = sumarDecimales(calculadas.map((row) => row.total_proyecto));

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
            const mesesValidos = Math.max(1, Number(meses) || 1);
            set(produce((state: RemuneracionesState) => {
                state.rows.forEach(row => {
                    Object.assign(row, recalcularFila({ ...row, meses: mesesValidos }));
                });
                state.isDirty = true;
            }));
        },
    }),
);
