// hooks/useGGFijos.ts
import axios from 'axios';
import { useEffect, useCallback } from 'react';
import type { GGFijoNode } from '../stores/ggFijosStore';
import { useGGFijosStore } from '../stores/ggFijosStore';

interface UseGGFijosProps {
    projectId: number;
    subsection: string;
}

export function useGGFijos({ projectId, subsection }: UseGGFijosProps) {
    const { nodes, loading, setNodes, setLoading, setDirty } = useGGFijosStore();
    const normalizeText = (value: string) =>
        (value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

    const ensureEnsayoCompresionRow = (rows: GGFijoNode[]) => {
        const ensayoKey = 'ensayo de compresion de testigos';
        const polizaKey = 'poliza de seguros c.a.r';

        const hasEnsayo = rows.some(r => normalizeText(r.descripcion || '').includes(ensayoKey));
        if (hasEnsayo) return { rows, injected: false };

        const polizaIndex = rows.findIndex(r => normalizeText(r.descripcion || '').includes(polizaKey));
        const segurosSeccion = rows.find(
            r => r.tipo_fila === 'seccion' && normalizeText(r.descripcion || '').includes('seguros')
        );
        const parentId = polizaIndex >= 0 ? rows[polizaIndex]?.parent_id ?? segurosSeccion?.id ?? null : segurosSeccion?.id ?? null;

        const newRow: GGFijoNode = {
            tipo_fila: 'detalle',
            tipo_calculo: 'manual',
            item_codigo: '',
            descripcion: '- Ensayo de compresion de testigos',
            unidad: 'und',
            cantidad: 25,
            costo_unitario: 44,
            parcial: 0,
            parent_id: parentId ?? null,
            item_order: 0,
        };

        const insertAt = polizaIndex >= 0 ? polizaIndex + 1 : rows.length;
        const next = [...rows];
        next.splice(insertAt, 0, newRow);
        next.forEach((r, i) => { (r as any).item_order = i; });
        return { rows: next, injected: true };
    };

    // Cargar datos cuando es 'gastos_fijos', 'gastos_generales' o 'consolidado'
    const isActive = subsection === 'gastos_fijos' || subsection === 'gastos_generales' || subsection === 'consolidado';

    useEffect(() => {
        if (!isActive) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(
                    `/costos/proyectos/${projectId}/presupuesto/gastos_fijos/data`
                );
                if (response.data?.success) {
                    const result = ensureEnsayoCompresionRow(response.data.rows || []);
                    setNodes(result.rows);
                    if (result.injected) {
                        setDirty(true);
                    }
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
