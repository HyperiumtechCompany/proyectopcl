import { useMemo, useState, useCallback } from 'react';
import {
    ItemValorizado, Periodo, ViewMode, ModoCalculo,
    TotalesColumna, DistribucionMes,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna true si el periodo.key cae dentro del rango [startDate, endDate]
 * de la tarea. Soporta tanto claves "YYYY-MM" como "YYYY-MM-DD".
 */
const periodoEnRango = (
    periodoKey: string,
    startDate: string | null | undefined,
    endDate:   string | null | undefined,
): boolean => {
    if (!startDate || !endDate) return true; // Sin fechas → no bloquear

    // Normalizar clave a fecha comparable: "2026-04" → "2026-04-01"
    const keyDate = periodoKey.length === 7 ? `${periodoKey}-01` : periodoKey;

    // Fin del período: "2026-04" → "2026-04-30", "2026-04-25" → "2026-05-24"
    const keyEnd = periodoKey.length === 7
        ? `${periodoKey}-31`   // comparación lexicográfica alcanza
        : (() => {
            const d = new Date(keyDate);
            d.setDate(d.getDate() + 29);
            return d.toISOString().slice(0, 10);
        })();

    // Hay solapamiento si el período empieza antes de endDate
    // y termina después de startDate
    return keyDate <= endDate && keyEnd >= startDate;
};

// ─────────────────────────────────────────────────────────────────────────────
// DISTRIBUCIÓN GAUSS (frontend) — para redistribución manual con forma real
// ─────────────────────────────────────────────────────────────────────────────

const calcularPesosGauss = (numPeriodos: number): number[] => {
    if (numPeriodos <= 0) return [];
    if (numPeriodos === 1) return [1];

    const media  = (numPeriodos - 1) / 2;          // centro del rango
    const sigma  = numPeriodos / 6;                 // desviación estándar
    const pesos  = Array.from({ length: numPeriodos }, (_, i) => {
        const exp = -((i - media) ** 2) / (2 * sigma ** 2);
        return Math.exp(exp);
    });
    const suma = pesos.reduce((a, b) => a + b, 0);
    return pesos.map(p => p / suma);                // normalizar → suma = 1
};

/**
 * Aplica pesos Gauss a un ítem para redistribuir con forma de campana.
 * Garantiza Precisión Delfín: último período activo absorbe el residuo.
 */
const redistribuirGauss = (
    item:    ItemValorizado,
    periodos: Periodo[],
): Record<string, DistribucionMes> => {
    const nuevaDist = { ...item.distribucion };
    const periodosActivos = periodos.filter(p =>
        periodoEnRango(p.key, item.start_date, item.end_date)
    );

    if (periodosActivos.length === 0 || item.parcial <= 0) return nuevaDist;

    const pesos = calcularPesosGauss(periodosActivos.length);
    let sumaAsignada = 0;
    let ultimaKey    = '';

    periodosActivos.forEach((p, i) => {
        // Truncar a 2 decimales (no round) para acumular residuo
        const monto = Math.floor(item.parcial * pesos[i] * 100) / 100;
        nuevaDist[p.key] = {
            monto,
            porcentaje: item.parcial > 0 ? (monto / item.parcial) * 100 : 0,
        };
        sumaAsignada += monto;
        ultimaKey = p.key;
    });

    // Precisión Delfín: el último mes activo absorbe el residuo de céntimos
    if (ultimaKey) {
        const residuo = Math.round((item.parcial - sumaAsignada) * 100) / 100;
        const montoFinal = Math.round((nuevaDist[ultimaKey].monto + residuo) * 100) / 100;
        nuevaDist[ultimaKey] = {
            monto:      montoFinal,
            porcentaje: item.parcial > 0 ? (montoFinal / item.parcial) * 100 : 0,
        };
    }

    // Poner a 0 los períodos fuera de rango
    periodos.forEach(p => {
        if (!periodoEnRango(p.key, item.start_date, item.end_date)) {
            nuevaDist[p.key] = { monto: 0, porcentaje: 0 };
        }
    });

    return nuevaDist;
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const useValorizadoLogic = (
    initialItems:     ItemValorizado[],
    periodos:         Periodo[],
    totalPresupuesto: number,
    modoCalculo:      ModoCalculo = 'calendario',
) => {
    // ── Estado ────────────────────────────────────────────────────────────────
    const [viewMode,   setViewMode]   = useState<ViewMode>('monto');
    const [searchTerm, setSearchTerm] = useState('');
    const [items, setItems]           = useState<ItemValorizado[]>(() =>
        initialItems.map(item => ({
            ...item,
            distribucion: { ...item.distribucion },
        }))
    );

    // ── EDICIÓN INLINE de una celda ───────────────────────────────────────────
    /**
     * Cuando el usuario edita el monto de un mes:
     *  1. Verifica que el período esté en rango (bloqueo de celda)
     *  2. Actualiza el monto y recalcula el porcentaje
     *  3. NO toca otros meses (el usuario tiene control total)
     */
    const editarCelda = useCallback((
        itemId:     number | string,
        periodoKey: string,
        nuevoMonto: number,
    ) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            // Bloqueo: no editar fuera del rango de la tarea
            if (!periodoEnRango(periodoKey, item.start_date, item.end_date)) return item;

            const monto     = Math.max(0, nuevoMonto);
            const nuevaDist = { ...item.distribucion };
            nuevaDist[periodoKey] = {
                monto,
                porcentaje: item.parcial > 0 ? (monto / item.parcial) * 100 : 0,
            };
            return { ...item, distribucion: nuevaDist };
        }));
    }, []);

    // ── REDISTRIBUIR UNIFORMEMENTE (solo meses activos) ───────────────────────
    const redistribuirItem = useCallback((itemId: number | string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            const periodosActivos = periodos.filter(p =>
                periodoEnRango(p.key, item.start_date, item.end_date)
            );
            const numMeses = periodosActivos.length;
            if (numMeses === 0 || item.parcial <= 0) return item;

            // Truncar para acumular residuo
            const montoPorMes = Math.floor((item.parcial / numMeses) * 100) / 100;
            const pctPorMes   = 100 / numMeses;

            const nuevaDist: Record<string, DistribucionMes> = { ...item.distribucion };

            // Primero poner todo a 0
            periodos.forEach(p => { nuevaDist[p.key] = { monto: 0, porcentaje: 0 }; });

            let sumaAsignada = 0;
            let ultimaKey    = '';

            periodosActivos.forEach(p => {
                nuevaDist[p.key] = {
                    monto:      montoPorMes,
                    porcentaje: Math.round(pctPorMes * 10000) / 10000,
                };
                sumaAsignada += montoPorMes;
                ultimaKey = p.key;
            });

            // Precisión Delfín
            if (ultimaKey) {
                const residuo    = Math.round((item.parcial - sumaAsignada) * 100) / 100;
                const montoFinal = Math.round((nuevaDist[ultimaKey].monto + residuo) * 100) / 100;
                nuevaDist[ultimaKey] = {
                    monto:      montoFinal,
                    porcentaje: item.parcial > 0 ? (montoFinal / item.parcial) * 100 : 0,
                };
            }

            return { ...item, distribucion: nuevaDist };
        }));
    }, [periodos]);

    // ── REDISTRIBUIR CON GAUSS (curva S real) ─────────────────────────────────
    const redistribuirGaussItem = useCallback((itemId: number | string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return { ...item, distribucion: redistribuirGauss(item, periodos) };
        }));
    }, [periodos]);

    // ── LIMPIAR DISTRIBUCIÓN ──────────────────────────────────────────────────
    const limpiarDistribucion = useCallback((itemId: number | string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const nuevaDist: Record<string, DistribucionMes> = {};
            Object.keys(item.distribucion).forEach(k => {
                nuevaDist[k] = { monto: 0, porcentaje: 0 };
            });
            return { ...item, distribucion: nuevaDist };
        }));
    }, []);

    // ── TOTALES POR COLUMNA — solo hojas (is_leaf) para no duplicar ───────────
    const totalesFinales = useMemo<Record<string, TotalesColumna>>(() => {
        const totales: Record<string, TotalesColumna> = {};
        let acumMonto = 0;

        periodos.forEach(p => {
            const montoMes = items
                .filter(i => i.is_leaf)
                .reduce((acc, item) => acc + (item.distribucion?.[p.key]?.monto ?? 0), 0);

            acumMonto += montoMes;

            totales[p.key] = {
                monto:               montoMes,
                porcentaje:          totalPresupuesto > 0 ? (montoMes / totalPresupuesto) * 100 : 0,
                acumuladoMonto:      acumMonto,
                acumuladoPorcentaje: totalPresupuesto > 0 ? (acumMonto / totalPresupuesto) * 100 : 0,
            };
        });

        return totales;
    }, [items, periodos, totalPresupuesto]);

    // ── CURVA S DATA ──────────────────────────────────────────────────────────
    const curvaSData = useMemo(() =>
        periodos.map(p => ({
            mes:          p.labelCal,
            mesLabel:     p.label,
            key:          p.key,
            mensual:      totalesFinales[p.key]?.monto ?? 0,
            acumulado:    totalesFinales[p.key]?.acumuladoMonto ?? 0,
            pctMensual:   totalesFinales[p.key]?.porcentaje ?? 0,
            pctAcumulado: totalesFinales[p.key]?.acumuladoPorcentaje ?? 0,
        })),
    [periodos, totalesFinales]);

    // ── FILTRADO ──────────────────────────────────────────────────────────────
    const itemsFiltrados = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return items;
        return items.filter(i =>
            String(i.descripcion ?? '').toLowerCase().includes(q) ||
            String(i.item ?? '').toLowerCase().includes(q)
        );
    }, [items, searchTerm]);

    // ── ACUMULADO TOTAL (último período) ──────────────────────────────────────
    const montoAcumuladoTotal = useMemo(() => {
        if (!periodos.length) return 0;
        const lastKey = periodos[periodos.length - 1].key;
        return totalesFinales[lastKey]?.acumuladoMonto ?? 0;
    }, [periodos, totalesFinales]);

    // ── VALIDACIÓN: Desvío de cada hoja (suma meses vs parcial) ──────────────
    /**
     * Retorna la diferencia absoluta entre el parcial declarado y
     * la suma de lo distribuido en todos los meses.
     * Cualquier valor > 0.01 (tolerancia de 1 céntimo) es alerta visual.
     */
    const getDesviacion = useCallback((item: ItemValorizado): number => {
        const sumaDist = Object.values(item.distribucion).reduce(
            (s, v) => s + (v.monto ?? 0), 0
        );
        return Math.round(Math.abs(item.parcial - sumaDist) * 100) / 100;
    }, []);

    /**
     * Map de id → desvío para que TablaValorizada pueda acceder en O(1)
     * sin recalcular en cada render de fila.
     */
    const desviaciones = useMemo(() => {
        const map: Record<string | number, number> = {};
        items.filter(i => i.is_leaf).forEach(i => {
            map[i.id] = getDesviacion(i);
        });
        return map;
    }, [items, getDesviacion]);

    /** Número de hojas con desvío > 1 céntimo (para mostrar badge global) */
    const totalDesviadas = useMemo(() =>
        Object.values(desviaciones).filter(d => d > 0.01).length,
    [desviaciones]);

    // ── HELPER: ¿Está el período bloqueado para un ítem? ─────────────────────
    const isPeriodoBloqueado = useCallback((
        item:       ItemValorizado,
        periodoKey: string,
    ): boolean => !periodoEnRango(periodoKey, item.start_date, item.end_date), []);

    return {
        // Estado
        viewMode, setViewMode,
        searchTerm, setSearchTerm,
        modoCalculo,
        // Items editables
        items,
        // Acciones de edición
        editarCelda,
        redistribuirItem,
        redistribuirGaussItem,   
        limpiarDistribucion,
        // Calculados
        itemsFiltrados,
        totalesFinales,
        curvaSData,
        montoAcumuladoTotal,
        // Validación
        getDesviacion,
        desviaciones,            
        totalDesviadas,          
        // Helpers
        isPeriodoBloqueado,     
    };
};