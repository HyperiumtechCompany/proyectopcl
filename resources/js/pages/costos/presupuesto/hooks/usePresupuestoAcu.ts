import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ACUComponenteRow, ACURowSummary, PresupuestoSubsection } from '@/types/presupuestos';

interface UsePresupuestoAcuProps {
    projectId: number;
    subsection: PresupuestoSubsection;
    selectedCell: { row: number; col: number; data: Record<string, any> } | null;
    selectedPartidaCode: string | null;
    selectedPartidaData: { descripcion: string; unidad: string } | null;
    lastSaved: Date | null;
    setSheetVersion: React.Dispatch<React.SetStateAction<number>>;
}

export function usePresupuestoAcu({
    projectId,
    subsection,
    selectedCell,
    selectedPartidaCode,
    selectedPartidaData,
    lastSaved,
    setSheetVersion,
}: UsePresupuestoAcuProps) {
    const [acuRows, setAcuRows] = useState<ACURowSummary[]>([]);
    const [acuLoading, setAcuLoading] = useState(false);
    const [acuError, setAcuError] = useState<string | null>(null);

    const parseJsonArrayField = useCallback(
        (value: unknown): ACUComponenteRow[] => {
            if (Array.isArray(value)) return value as ACUComponenteRow[];
            if (typeof value !== 'string' || !value.trim()) return [];
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? (parsed as ACUComponenteRow[]) : [];
            } catch {
                return [];
            }
        },
        [],
    );

    const mapAcuRows = useCallback(
        (rawRows: any[]): ACURowSummary[] => {
            return rawRows.map((row) => ({
                id: Number(row.id ?? 0),
                partida: String(row.partida ?? ''),
                descripcion: String(row.descripcion ?? ''),
                unidad: String(row.unidad ?? ''),
                rendimiento: Number(row.rendimiento ?? 0),
                costo_mano_obra: Number(row.costo_mano_obra ?? 0),
                costo_materiales: Number(row.costo_materiales ?? 0),
                costo_equipos: Number(row.costo_equipos ?? 0),
                costo_subcontratos: Number(row.costo_subcontratos ?? 0),
                costo_subpartidas: Number(row.costo_subpartidas ?? 0),
                costo_unitario_total: Number(row.costo_unitario_total ?? 0),
                mano_de_obra: parseJsonArrayField(row.mano_de_obra),
                materiales: parseJsonArrayField(row.materiales),
                equipos: parseJsonArrayField(row.equipos),
                subcontratos: parseJsonArrayField(row.subcontratos),
                subpartidas: parseJsonArrayField(row.subpartidas),
            }));
        },
        [parseJsonArrayField],
    );

    const selectedAcu = useMemo(() => {
        if (!selectedPartidaCode) return null;
        
        const existingAcu = acuRows.find((row) => row.partida === selectedPartidaCode);
        if (existingAcu) {
            // Override description/unit with live budget tree data
            if (selectedPartidaData) {
                return {
                    ...existingAcu,
                    descripcion: selectedPartidaData.descripcion || existingAcu.descripcion,
                    unidad: selectedPartidaData.unidad || existingAcu.unidad,
                };
            }
            return existingAcu;
        }

        // If it's a new unsaved row or an empty ACU, return a blank template with live data
        return {
            id: 0,
            partida: selectedPartidaCode,
            descripcion: selectedPartidaData?.descripcion || 'Nueva Partida',
            unidad: selectedPartidaData?.unidad || 'und',
            rendimiento: 1,
            costo_mano_obra: 0,
            costo_materiales: 0,
            costo_equipos: 0,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: 0,
            mano_de_obra: [],
            materiales: [],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        } as ACURowSummary;
    }, [acuRows, selectedPartidaCode, selectedPartidaData]);

    const autoCalculateACU = useCallback(async () => {
        if (subsection !== 'general' || !selectedCell) return;

        const matchingAcu = acuRows.find(
            (acu) =>
                acu.descripcion
                    ?.toLowerCase()
                    .includes(
                        selectedCell.data.descripcion?.toString().toLowerCase() || '',
                    ) || acu.partida === selectedCell.data.partida,
        );

        if (!matchingAcu) return;

        const acuData = {
            id: matchingAcu.id,
            partida: matchingAcu.partida,
            descripcion: matchingAcu.descripcion,
            unidad: matchingAcu.unidad,
            rendimiento: matchingAcu.rendimiento,
            mano_de_obra: matchingAcu.mano_de_obra || [],
            materiales: matchingAcu.materiales || [],
            equipos: matchingAcu.equipos || [],
            subcontratos: (matchingAcu as any).subcontratos || [],
            subpartidas: (matchingAcu as any).subpartidas || [],
        };

        try {
            await axios.post(
                `/costos/proyectos/${projectId}/presupuesto/acus/calculate`,
                acuData
            );

            setSheetVersion((v) => v + 1);
        } catch (e) {
            console.warn('Error en auto-cálculo de ACU:', e);
        }
    }, [subsection, selectedCell, acuRows, projectId, setSheetVersion]);

    useEffect(() => {
        if (subsection !== 'general' || !selectedCell || lastSaved === null) return;

        const timer = setTimeout(() => {
            void autoCalculateACU();
        }, 500);

        return () => clearTimeout(timer);
    }, [selectedCell, subsection, lastSaved, autoCalculateACU]);

    useEffect(() => {
        if (subsection !== 'general' && subsection !== 'acus') {
            setAcuRows([]);
            setAcuError(null);
            setAcuLoading(false);
            return;
        }

        const controller = new AbortController();
        setAcuLoading(true);
        setAcuError(null);

        axios.get(`/costos/proyectos/${projectId}/presupuesto/acus/data`, {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal: controller.signal,
        })
            .then((response) => {
                const data = response.data;
                if (!data?.success || !Array.isArray(data?.rows)) {
                    setAcuRows([]);
                    return;
                }
                const parsedRows = mapAcuRows(data.rows);
                setAcuRows(parsedRows);
            })
            .catch((err: unknown) => {
                if (axios.isCancel(err)) return;
                console.warn('ACU loading error:', err);
                setAcuRows([]);
            })
            .finally(() => {
                setAcuLoading(false);
            });

        return () => controller.abort();
    }, [mapAcuRows, projectId, subsection]);

    const normalizeNumber = (value: unknown, fallback = 0): number => {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            return fallback;
        }
        return num;
    };

    const normalizeAcuComponent = (
        item: Record<string, unknown>,
        type: 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'subpartidas',
    ) => {
        const normalized: Record<string, unknown> = {
            id: item.id,
            insumo_id: item.insumo_id,
            descripcion: String(item.descripcion ?? '').trim(),
            unidad: String(item.unidad ?? '').trim() || 'und',
            cantidad: normalizeNumber(item.cantidad, 0),
        };

        if (type === 'mano_de_obra' || type === 'equipos') {
            normalized.recursos = normalizeNumber(item.recursos, 0);
        }

        if (type === 'materiales' || type === 'subcontratos' || type === 'subpartidas') {
            normalized.precio_unitario = normalizeNumber(item.precio_unitario, 0);
        }

        if (type === 'mano_de_obra') {
            normalized.precio_unitario = normalizeNumber(item.precio_unitario, 0);
        }

        if (type === 'equipos') {
            normalized.precio_hora = normalizeNumber(item.precio_hora, 0);
        }

        if (type === 'materiales') {
            const factor = normalizeNumber(item.factor_desperdicio, 1);
            normalized.factor_desperdicio = factor < 1 ? 1 : factor;
        }

        return normalized;
    };

    const normalizeAcuData = (data: Record<string, any>): Record<string, any> => {
        return {
            ...data,
            descripcion: String(data.descripcion ?? '').trim(),
            unidad: String(data.unidad ?? '').trim() || 'und',
            rendimiento:
                normalizeNumber(data.rendimiento, 1) <= 0
                    ? 1
                    : normalizeNumber(data.rendimiento, 1),
            mano_de_obra: Array.isArray(data.mano_de_obra)
                ? data.mano_de_obra.map((item: Record<string, unknown>) =>
                      normalizeAcuComponent(item, 'mano_de_obra'),
                  )
                : [],
            materiales: Array.isArray(data.materiales)
                ? data.materiales.map((item: Record<string, unknown>) =>
                      normalizeAcuComponent(item, 'materiales'),
                  )
                : [],
            equipos: Array.isArray(data.equipos)
                ? data.equipos.map((item: Record<string, unknown>) =>
                      normalizeAcuComponent(item, 'equipos'),
                  )
                : [],
            subcontratos: Array.isArray(data.subcontratos)
                ? data.subcontratos.map((item: Record<string, unknown>) =>
                      normalizeAcuComponent(item, 'subcontratos'),
                  )
                : [],
            subpartidas: Array.isArray(data.subpartidas)
                ? data.subpartidas.map((item: Record<string, unknown>) =>
                      normalizeAcuComponent(item, 'subpartidas'),
                  )
                : [],
        };
    };

    const saveAcu = useCallback(async (acuData: Record<string, any>, options?: { updateProjectPrices?: boolean }) => {
        try {
            const payload = normalizeAcuData(acuData);
            if (options?.updateProjectPrices !== undefined) {
                payload.update_project_prices = options.updateProjectPrices;
            }
            const response = await axios.post(
                `/costos/proyectos/${projectId}/presupuesto/acus/calculate`,
                payload
            );
            
            const data = response.data;
            if (data.success && data.acu) {
                const updatedAcu = mapAcuRows([data.acu])[0];
                
                setAcuRows(prev => {
                    const exists = prev.some(a => a.id === updatedAcu.id);
                    if (exists) {
                        return prev.map(a => a.id === updatedAcu.id ? updatedAcu : a);
                    } else {
                        return [...prev, updatedAcu]; // Si era nuevo o se filtró
                    }
                });
                
                setSheetVersion(v => v + 1); // Forzar actualización de tabla
                return { success: true, acu: updatedAcu };
            }
            return { success: false, error: data.message || 'Error al guardar ACU' };
        } catch (e: any) {
            console.error('Error saving ACU:', e);
            return { success: false, error: e?.response?.data?.message || e.message || 'Error de red' };
        }
    }, [projectId, mapAcuRows, setSheetVersion]);

    return {
        acuRows,
        acuLoading,
        acuError,
        selectedAcu,
        saveAcu,
    };
}
