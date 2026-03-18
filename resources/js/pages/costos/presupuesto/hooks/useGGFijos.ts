// hooks/useGGFijos.ts
import { useEffect, useCallback } from 'react';
import axios from 'axios';
import { useGGFijosStore, GGFijoNode } from '../stores/ggFijosStore';

interface UseGGFijosProps {
    projectId: number;
    subsection: string;
}

export function useGGFijos({ projectId, subsection }: UseGGFijosProps) {
    const { nodes, loading, setNodes, setLoading, setDirty } = useGGFijosStore();

    // Cargar datos cuando es 'gastos_fijos' o cuando está en 'gastos_generales' (se muestran ambos paneles)
    const isActive = subsection === 'gastos_fijos' || subsection === 'gastos_generales';

    useEffect(() => {
        if (!isActive) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(
                    `/costos/proyectos/${projectId}/presupuesto/gastos_fijos/data`
                );
                if (response.data?.success) {
                    setNodes(response.data.rows || []);
                } else {
                    setNodes([]);
                }
            } catch (error) {
                console.error('Error fetching GG Fijos:', error);
                setNodes([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectId, subsection, setNodes, setLoading, isActive]);

    const saveGGFijos = useCallback(async (data: GGFijoNode[]) => {
        if (!isActive) return { success: false };

        try {
            // Strip UI-only fields before sending
            const cleanRows = data.map(({ _level, _expanded, _children_count, parcial, ...rest }) => rest);

            const response = await axios.patch(
                `/costos/proyectos/${projectId}/presupuesto/gastos_fijos`,
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
            console.error('Error saving GG Fijos:', error);
            return { success: false, error };
        }
    }, [projectId, isActive, setDirty, setNodes]);

    return {
        ggFijosNodes: nodes,
        ggFijosLoading: loading,
        saveGGFijos,
    };
}
