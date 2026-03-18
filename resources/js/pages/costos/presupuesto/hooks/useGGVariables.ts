// hooks/useGGVariables.ts
import { useEffect, useCallback } from 'react';
import axios from 'axios';
import { useGGVariablesStore, GGVariableNode } from '../stores/ggVariablesStore';

interface UseGGVariablesProps {
    projectId: number;
    subsection: string;
}

export function useGGVariables({ projectId, subsection }: UseGGVariablesProps) {
    const { nodes, loading, setNodes, setLoading, setDirty, checkAndSyncRemuneraciones, syncFromRemuneraciones } = useGGVariablesStore();

    const isActive = subsection === 'gastos_generales';

    useEffect(() => {
        if (!isActive) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(
                    `/costos/proyectos/${projectId}/presupuesto/gastos_generales/data`
                );
                if (response.data?.success) {
                    setNodes(response.data.rows || []);
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
