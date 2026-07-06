import Decimal from 'decimal.js';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ACUComponenteRow, ACURowSummary, PresupuestoSubsection } from '@/types/presupuestos';

const ACU_BATCH_SIZE = 8; // concurrent requests per round — keeps server load manageable

export interface AcuFlushProgress {
    done:    number;
    total:   number;
    pct:     number;
    etaSecs: number | null;
}

// Mirrors the PHP calculateACU logic — keeps visual preview consistent with DB result.
// Rounds to 6dp (not 2) so the preview matches the DB's internal precision: rounding
// each item's parcial to 2dp before summing was what made Costo Directo (metrado ×
// precio_unitario, both flattened to 2dp) diverge from Insumos Consolidados (which
// carried full precision) — see PresupuestoController::calculateAcu for the backend twin.
function r2(n: number): number { return new Decimal(n).toDecimalPlaces(6).toNumber(); }

// Multiplies operands with Decimal.js precision and rounds the result to 6dp.
// Avoids float errors like 0.57 * 31.50 = 17.954999... rounding to 17.95 instead of 17.96.
function decimalMul(...factors: number[]): number {
    return factors
        .reduce((acc, f) => acc.times(new Decimal(f)), new Decimal(1))
        .toDecimalPlaces(6)
        .toNumber();
}

export function calculateAcuLocally(acuData: Record<string, any>) {
    const manoDeObra = (acuData.mano_de_obra as any[] || []).map((item: any) => ({
        ...item,
        parcial: decimalMul(Number(item.cantidad ?? 0), Number(item.precio_unitario ?? 0)),
    }));
    const costoManoObra = r2(manoDeObra.reduce((s: number, i: any) => s + (i.parcial ?? 0), 0));

    const materiales = (acuData.materiales as any[] || []).map((item: any) => ({
        ...item,
        parcial: decimalMul(
            Number(item.cantidad ?? 0),
            Number(item.precio_unitario ?? 0),
            Math.max(1, Number(item.factor_desperdicio ?? 1))
        ),
    }));
    const costoMateriales = r2(materiales.reduce((s: number, i: any) => s + (i.parcial ?? 0), 0));

    const equipos = (acuData.equipos as any[] || []).map((item: any) => {
        const isHerramientas = String(item.descripcion ?? '').toLowerCase().includes('herramienta');
        if (isHerramientas) {
            const parcial = decimalMul(costoManoObra, Number(item.cantidad ?? 0) / 100);
            return { ...item, precio_hora: costoManoObra, parcial };
        }
        return { ...item, parcial: decimalMul(Number(item.cantidad ?? 0), Number(item.precio_hora ?? 0)) };
    });
    const costoEquipos = r2(equipos.reduce((s: number, i: any) => s + (i.parcial ?? 0), 0));

    const subcontratos = (acuData.subcontratos as any[] || []).map((item: any) => ({
        ...item,
        parcial: decimalMul(Number(item.cantidad ?? 0), Number(item.precio_unitario ?? 0)),
    }));
    const costoSubcontratos = r2(subcontratos.reduce((s: number, i: any) => s + (i.parcial ?? 0), 0));

    const subpartidas = (acuData.subpartidas as any[] || []).map((item: any) => ({
        ...item,
        parcial: decimalMul(Number(item.cantidad ?? 0), Number(item.precio_unitario ?? 0)),
    }));
    const costoSubpartidas = r2(subpartidas.reduce((s: number, i: any) => s + (i.parcial ?? 0), 0));

    return {
        costo_mano_obra: costoManoObra,
        costo_materiales: costoMateriales,
        costo_equipos: costoEquipos,
        costo_subcontratos: costoSubcontratos,
        costo_subpartidas: costoSubpartidas,
        costo_unitario_total: r2(costoManoObra + costoMateriales + costoEquipos + costoSubcontratos + costoSubpartidas),
        mano_de_obra: manoDeObra,
        materiales,
        equipos,
        subcontratos,
        subpartidas,
    };
}

export function upsertLocalAcuRow(
    rows: ACURowSummary[],
    updatedAcu: ACURowSummary,
): ACURowSummary[] {
    const exists = rows.some((acu) => acu.partida === updatedAcu.partida);
    if (!exists) return [...rows, updatedAcu];

    return rows.map((acu) => acu.partida === updatedAcu.partida ? updatedAcu : acu);
}

// Clave canónica para matchear un componente de ACU contra el catálogo de
// insumos. Debe coincidir EXACTAMENTE con la normalización del backend
// (InsumoProductoController::normalizeDescripcion: trim + espacios colapsados
// + minúsculas) para que /insumos/resolve, el registro de pendientes y el
// parcheo posterior de insumo_id usen siempre la misma clave.
export function buildInsumoKey(tipo: string, descripcion: string, unidad: string): string {
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
    return `${tipo}|${normalize(descripcion)}|${normalize(unidad)}`;
}

export interface PendingNewInsumo {
    tipo: string;
    descripcion: string;
    unidad: string;
    precio: number;
    diccionario_id: number;
}

interface UsePresupuestoAcuProps {
    projectId: number;
    subsection: PresupuestoSubsection;
    selectedCell: { row: number; col: number; data: Record<string, any> } | null;
    selectedPartidaCode: string | null;
    selectedPartidaData: { descripcion: string; unidad: string } | null;
    lastSaved: Date | null;
    setSheetVersion: React.Dispatch<React.SetStateAction<number>>;
    refreshKey?: number;
    refetchVersion?: number;
}

export function usePresupuestoAcu({
    projectId,
    subsection,
    selectedCell,
    selectedPartidaCode,
    selectedPartidaData,
    lastSaved,
    setSheetVersion,
    refreshKey = 0,
    refetchVersion = 0,
}: UsePresupuestoAcuProps) {
    const [acuRows, setAcuRows] = useState<ACURowSummary[]>([]);
    const [acuLoading, setAcuLoading] = useState(false);
    const [acuError, setAcuError] = useState<string | null>(null);
    const [acuDirty, setAcuDirty] = useState(false);
    // Pending ACU edits not yet persisted to DB (partida → payload)
    const pendingAcuRef = useRef<Map<string, Record<string, any>>>(new Map());
    // Insumos nuevos confirmados por el usuario en un import, pendientes de
    // crearse en el catálogo — solo se crean al guardar (flushPendingInsumos),
    // nunca al confirmar el import, para no dejar insumos huérfanos si se
    // abandona el import sin guardar.
    const pendingNewInsumosRef = useRef<Map<string, PendingNewInsumo>>(new Map());

    const registerPendingInsumo = useCallback((key: string, descriptor: PendingNewInsumo) => {
        pendingNewInsumosRef.current.set(key, descriptor);
    }, []);

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
    }, [mapAcuRows, projectId, subsection, refreshKey, refetchVersion]);

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
            cod_insumo: ((item.cod_insumo as string | null | undefined) ?? (item.codigo as string | null | undefined)) || null,
            proveedor: (item.proveedor as string | null | undefined) || null,
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

    // Visual-first save: calculates locally and marks as pending (no DB call)
    const localSaveAcu = useCallback((acuData: Record<string, any>, options?: { updateProjectPrices?: boolean }) => {
        const normalized = normalizeAcuData(acuData);
        const calculated = calculateAcuLocally(normalized);
        const updatedAcu: ACURowSummary = {
            id: Number(normalized.id ?? 0),
            partida: String(normalized.partida ?? ''),
            descripcion: String(normalized.descripcion ?? ''),
            unidad: String(normalized.unidad ?? ''),
            rendimiento: Number(normalized.rendimiento ?? 1),
            ...calculated,
        };
        setAcuRows((prev) => upsertLocalAcuRow(prev, updatedAcu));
        const payload = { ...normalized };
        if (options?.updateProjectPrices !== undefined) payload.update_project_prices = options.updateProjectPrices;
        pendingAcuRef.current.set(updatedAcu.partida, payload);
        setAcuDirty(true);
        return { success: true as const, acu: updatedAcu };
    }, [normalizeAcuData]);

    // Batch-persists all pending ACU edits to DB (called on global save).
    // Cada ACU se intenta de forma INDEPENDIENTE (Promise.allSettled): si uno
    // falla (ej. un dato mal formado en una sola partida), NO bloquea a los
    // demás — solo el que falló queda pendiente para reintentar en el próximo
    // guardado, mientras el resto se persiste normalmente. Antes, un solo
    // fallo abortaba TODA la cola restante (Promise.all + throw), dejando sin
    // guardar decenas de ACUs que nunca llegaron ni siquiera a intentarse.
    // Accepts an optional AbortSignal to cancel mid-flush; pending map stays
    // dirty so the next save retries the remaining items.
    const flushPendingAcus = useCallback(
        async (onProgress?: (p: AcuFlushProgress) => void, signal?: AbortSignal): Promise<boolean> => {
            const pending = Array.from(pendingAcuRef.current.entries());
            if (pending.length === 0) return true;
            if (signal?.aborted) return false;

            const total = pending.length;
            const startMs = Date.now();
            let done = 0;
            const failures: Array<{ partida: string; message: string }> = [];

            onProgress?.({ done: 0, total, pct: 0, etaSecs: null });

            for (let i = 0; i < total; i += ACU_BATCH_SIZE) {
                if (signal?.aborted) break;

                const batch = pending.slice(i, i + ACU_BATCH_SIZE);
                const results = await Promise.allSettled(
                    batch.map(([, payload]) =>
                        axios.post(
                            `/costos/proyectos/${projectId}/presupuesto/acus/calculate`,
                            payload,
                            { signal },
                        ),
                    ),
                );

                results.forEach((result, idx) => {
                    const [partida] = batch[idx];
                    if (result.status === 'fulfilled') {
                        pendingAcuRef.current.delete(partida);
                    } else if (!axios.isCancel(result.reason)) {
                        const message = result.reason?.response?.data?.message ?? result.reason?.message ?? 'Error desconocido';
                        failures.push({ partida, message });
                        console.error(`Error al guardar ACU [partida ${partida}]:`, result.reason);
                    }
                });

                done = Math.min(i + ACU_BATCH_SIZE, total);

                if (onProgress) {
                    const elapsedSec = (Date.now() - startMs) / 1000;
                    const rate = elapsedSec > 0 ? done / elapsedSec : 0;
                    const etaSecs = rate > 0 ? Math.round((total - done) / rate) : null;
                    onProgress({ done, total, pct: Math.round((done / total) * 100), etaSecs });
                }
            }

            if (signal?.aborted) return false;

            if (failures.length > 0) {
                console.error(`${failures.length} ACU(s) no se pudieron guardar:`, failures);
                setAcuDirty(pendingAcuRef.current.size > 0);
                return false;
            }

            setAcuDirty(false);
            return true;
        },
        [projectId],
    );

    // Crea en el catálogo los insumos nuevos pendientes (registrados durante un
    // import) y parcha su insumo_id en los componentes ya encolados en
    // pendingAcuRef. Debe correr ANTES de flushPendingAcus en el flujo de
    // Guardar, para que los ACUs se persistan con el insumo_id ya resuelto.
    const flushPendingInsumos = useCallback(async (): Promise<boolean> => {
        const pending = Array.from(pendingNewInsumosRef.current.entries());
        if (pending.length === 0) return true;

        try {
            const response = await axios.post(
                `/costos/proyectos/${projectId}/presupuesto/insumos/create-batch`,
                {
                    items: pending.map(([key, descriptor]) => ({ key, ...descriptor })),
                },
            );

            if (!response.data?.success) return false;

            const resolved = new Map<string, number>(
                (response.data.items as Array<{ key: string; insumo_id: number }>).map(
                    (item) => [item.key, item.insumo_id],
                ),
            );

            for (const payload of pendingAcuRef.current.values()) {
                for (const tipo of ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'] as const) {
                    const items = payload[tipo];
                    if (!Array.isArray(items)) continue;

                    for (const item of items) {
                        if (item.insumo_id != null) continue;
                        const key = buildInsumoKey(tipo, String(item.descripcion ?? ''), String(item.unidad ?? ''));
                        const insumoId = resolved.get(key);
                        if (insumoId != null) item.insumo_id = insumoId;
                    }
                }
            }

            pendingNewInsumosRef.current.clear();
            return true;
        } catch (e) {
            console.error('Error al crear insumos pendientes:', e);
            return false;
        }
    }, [projectId]);

    return {
        acuRows,
        acuLoading,
        acuError,
        selectedAcu,
        saveAcu,
        localSaveAcu,
        flushPendingAcus,
        registerPendingInsumo,
        flushPendingInsumos,
        acuDirty,
        pendingAcuCount: pendingAcuRef.current.size,
    };
}
