// hooks/usePresupuestoRemuneraciones.ts
import axios from 'axios';
import { useEffect, useCallback } from 'react';
import { useRemuneracionesStore } from '../stores/remuneracionesStore';

interface UsePresupuestoRemuneracionesProps {
    projectId: number;
    subsection: string;
}

export function usePresupuestoRemuneraciones({
    projectId,
    subsection,
}: UsePresupuestoRemuneracionesProps) {
    const { rows, loading, setRows, setLoading, setDirty } = useRemuneracionesStore();

    useEffect(() => {
        if (subsection !== 'remuneraciones') {
            return;
        }

        const fetchRemuneracionData = async () => {
            setLoading(true);
            try {
                // Remuneraciones are global to the project budget now
                const endpoint = `/costos/proyectos/${projectId}/presupuesto/remuneraciones/data`;
                
                const response = await axios.get(endpoint);
                if (response.data?.success) {
                    setRows(response.data.rows || []);
                } else {
                    setRows([]);
                }
            } catch (error) {
                console.error('Error fetching remuneracion data:', error);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRemuneracionData();
    }, [projectId, subsection, setRows, setLoading]);

    const saveRemuneracion = useCallback(async (data: any) => {
        try {
            const response = await axios.patch(
                `/costos/proyectos/${projectId}/presupuesto/remuneraciones`,
                { rows: data }
            );
            
            if (response.data?.success) {
                if (response.data.rows) {
                    setRows(response.data.rows);
                }
                setDirty(false);
            }
            
            return response.data;
        } catch (error) {
            console.error('Error saving remuneracion:', error);
            throw error; // Rethrow to let the UI handle the error state if needed
        }
    }, [projectId, setDirty]);

    return {
        remuneracionesRows: rows,
        remuneracionesLoading: loading,
        saveRemuneracion,
    };
}