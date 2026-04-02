// hooks/useGGVariables.ts
import axios from 'axios';
import { useEffect, useCallback } from 'react';
import type { GGVariableNode } from '../stores/ggVariablesStore';
import { useGGVariablesStore } from '../stores/ggVariablesStore';

interface UseGGVariablesProps {
    projectId: number;
    subsection: string;
}

export function useGGVariables({ projectId, subsection }: UseGGVariablesProps) {
    const { nodes, loading, setNodes, setLoading, setDirty, checkAndSyncRemuneraciones, syncFromRemuneraciones } = useGGVariablesStore();

    const isActive = subsection === 'gastos_generales' || subsection === 'consolidado';
    const normalizeText = (value: string) =>
        (value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

    const applyFianzaAdelantoTotals = (rows: GGVariableNode[], totals: { efectivo: number; materiales: number }) => {
        const efectivoKey = 'fianza por garantia de adelanto en efectivo';
        const materialesKey = 'fianza por garantia de adelanto en materiales';
        let changed = false;

        const updated = rows.map((row) => {
            if (row.tipo_fila !== 'detalle') return row;
            const desc = normalizeText(row.descripcion || '');
            if (desc.includes(efectivoKey)) {
                if (Number(row.precio || 0) !== totals.efectivo) {
                    changed = true;
                    return { ...row, precio: totals.efectivo };
                }
            }
            if (desc.includes(materialesKey)) {
                if (Number(row.precio || 0) !== totals.materiales) {
                    changed = true;
                    return { ...row, precio: totals.materiales };
                }
            }
            return row;
        });

        return { rows: updated, changed };
    };

    const fetchFianzaAdelantoTotals = async () => {
        const sumRows = (rows: any[]) =>
            rows.reduce((sum, r) => {
                const avance = Number(r.avance_porcentaje ?? 100);
                if (avance >= 100) return sum;
                const parcial = Number(r.garantia_fc_sin_igv ?? 0);
                return sum + parcial;
            }, 0);

        const [efectivoRes, materialesRes] = await Promise.all([
            axios.get(`/costos/proyectos/${projectId}/presupuesto/gastos-fijos-global/desagregado`, {
                params: { tipo_calculo: 'fianza_adelanto_efectivo' }
            }),
            axios.get(`/costos/proyectos/${projectId}/presupuesto/gastos-fijos-global/desagregado`, {
                params: { tipo_calculo: 'fianza_adelanto_materiales' }
            }),
        ]);

        const efectivoRows = efectivoRes.data?.data || [];
        const materialesRows = materialesRes.data?.data || [];

        return {
            efectivo: sumRows(efectivoRows),
            materiales: sumRows(materialesRows),
        };
    };

    useEffect(() => {
        if (!isActive) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(
                    `/costos/proyectos/${projectId}/presupuesto/gastos_generales/data`
                );
                if (response.data?.success) {
                    const baseRows = response.data.rows || [];
                    try {
                        const totals = await fetchFianzaAdelantoTotals();
                        const applied = applyFianzaAdelantoTotals(baseRows, totals);
                        setNodes(applied.rows);
                        if (applied.changed) {
                            setDirty(true);
                        }
                    } catch (err) {
                        console.error('Error fetching fianza adelanto totals:', err);
                        setNodes(baseRows);
                    }
                } else {
                    setNodes([]);
                }
            } catch (error) {
                console.error('Error fetching GG Variables:', error);
                setNodes([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectId, subsection, setNodes, setLoading, isActive]);

    const saveGGVariables = useCallback(async (data: GGVariableNode[]) => {
        if (!isActive) return { success: false };

        try {
            const cleanRows = data.map(({ _level, _expanded, _fromRemuneraciones, parcial, ...rest }) => rest);

            const response = await axios.patch(
                `/costos/proyectos/${projectId}/presupuesto/gastos_generales`,
                { rows: cleanRows }
            );

            if (response.data?.success) {
                setDirty(false);
                if (response.data.rows) {
                    setNodes(response.data.rows);
                }
            }

            return response.data;
        } catch (error) {
            console.error('Error saving GG Variables:', error);
            return { success: false, error };
        }
    }, [projectId, isActive, setDirty, setNodes]);

    return {
        ggVariablesNodes: nodes,
        ggVariablesLoading: loading,
        saveGGVariables,
    };
}
