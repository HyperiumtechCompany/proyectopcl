// hooks/usePresupuestoGastosGenerales.ts
import axios from 'axios';
import { useEffect, useCallback } from 'react';
import { useGastosGeneralesStore } from '../stores/gastosGeneralesStore';

interface UsePresupuestoGastosGeneralesProps {
    projectId: number;
    subsection: string;
}

export function usePresupuestoGastosGenerales({
    projectId,
    subsection,
}: UsePresupuestoGastosGeneralesProps) {
    const { rows, loading, setRows, setLoading, setDirty } = useGastosGeneralesStore();

    const isGGSubsection = [
        'gastos_generales', 
        'gastos_fijos', 
        'supervision', 
        'control_concurrente'
    ].includes(subsection);

    useEffect(() => {
        if (!isGGSubsection) {
            return;
        }

        const fetchGastoGeneralData = async () => {
            setLoading(true);
            try {
                const endpoint = `/costos/proyectos/${projectId}/presupuesto/${subsection}/data`;

                const response = await axios.get(endpoint);
                if (response.data?.success) {
                    setRows(response.data.rows || []);
                } else {
                    setRows([]);
                }
            } catch (error) {
                console.error(`Error fetching ${subsection} data:`, error);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        fetchGastoGeneralData();
    }, [projectId, subsection, setRows, setLoading, isGGSubsection]);

    const saveGastoGeneral = useCallback(async (data: any) => {
        if (!isGGSubsection) return { success: false, error: 'Invalid subsection' };
        
        try {
            const response = await axios.patch(
                `/costos/proyectos/${projectId}/presupuesto/${subsection}`,
                { rows: data },
            );
            
            if (response.data?.success) {
                setDirty(false);
            }
            
            return response.data;
        } catch (error) {
            console.error('Error saving gasto general:', error);
            return { success: false, error };
        }
    }, [projectId, setDirty]);

    return {
        gastosGeneralesRows: rows,
        gastosGeneralesLoading: loading,
        saveGastoGeneral,
    };
}
