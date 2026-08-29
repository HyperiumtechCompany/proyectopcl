import {
    ChevronDown,
    ChevronRight,
    RefreshCw,
    X,
    TrendingUp,
    AlertTriangle,
    Lock,
    Plus,
    Trash2,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import axios from 'axios';
import Decimal from 'decimal.js';
import { ajustarResiduoMonetario } from '../helpers/ajustarResiduoMonetario';
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type {
    ItemValorizado,
    Periodo,
    ViewMode,
    TotalesColumna,
    FinDefaults,
    ComponenteExtra,
    ConceptoAdicional,
} from '../types';
import {
    calcularResumenFinanciero,
    type ConceptoCalculado,
} from '../helpers/calcularResumenFinanciero';

// FORMATOS
const fmtN = (v: number) =>
    (v ?? 0).toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
const fmtS = (v: number) => `S/. ${fmtN(v)}`;
const fmtP = (v: number) => `${(v ?? 0).toFixed(4)}%`;

const nivel = (item: string) => (item?.split('.').length ?? 1) - 1;

const bgNivel = (n: number, isLeaf: boolean): string => {
    if (isLeaf) return '';
    if (n === 0) return 'bg-slate-800 text-white';
    if (n === 1) return 'bg-slate-200 text-slate-900';
    if (n === 2) return 'bg-slate-100 text-slate-800';
    return 'bg-slate-50 text-slate-700';
};

const parentCodes = (code: string): string[] => {
    const parts = code.split('.').filter(Boolean);
    return parts.slice(0, -1).map((_, idx) => parts.slice(0, idx + 1).join('.'));
};

const emptyDistribucion = (periodos: Periodo[]) =>
    Object.fromEntries(
        periodos.map((p) => [p.key, { monto: 0, porcentaje: 0 }]),
    ) as ItemValorizado['distribucion'];

// TIPOS
interface FinancieroState {
    pctGastosGenerales: number;
    pctUtilidad: number;
    pctIGV: number;
    montoMobiliario: number;
    pctIGVMobiliario: number;
    pctSupervision: number;
}

// CELDA EDITABLE PARTIDAS
interface EditableCellProps {
    value: number;
    viewMode: ViewMode;
    parcial: number;
    onChange: (v: number) => void;
    isPico: boolean;
    bloqueada: boolean;
}
const EditableCell: React.FC<EditableCellProps> = ({
    value,
    viewMode,
    parcial,
    onChange,
    isPico,
    bloqueada,
}) => {
    const [editing, setEditing] = useState(false);
    const [rawVal, setRawVal] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    if (bloqueada)
        return (
            <td
                className="cursor-not-allowed border border-slate-200 bg-slate-50 p-2 text-center"
                title="Fuera del rango de ejecución"
            >
                <Lock className="mx-auto h-3 w-3 text-slate-300" />
            </td>
        );

    const startEdit = () => {
        setRawVal(value.toFixed(2));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };
    const commitEdit = () => {
        const parsed = parseFloat(rawVal.replace(/,/g, '.'));
        if (!isNaN(parsed)) {
            const finalVal =
                viewMode === 'porcentaje' ? (parsed / 100) * parcial : parsed;
            onChange(Math.max(0, finalVal));
        }
        setEditing(false);
    };
    const display =
        viewMode === 'monto'
            ? fmtN(value)
            : fmtP(parcial > 0 ? (value / parcial) * 100 : 0);
    const hasValue = value > 0;

    if (editing)
        return (
            <td
                className={`border border-slate-200 p-0 ${isPico ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={rawVal}
                    onChange={(e) => setRawVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="h-full w-full border-0 bg-yellow-50 px-2 py-2 text-right font-mono text-xs outline-none focus:ring-2 focus:ring-blue-400"
                />
            </td>
        );

    return (
        <td
            onClick={startEdit}
            title="Clic para editar"
            className={`cursor-pointer border border-slate-200 p-2 text-right font-mono text-[11px] transition-colors select-none ${hasValue ? 'font-semibold text-slate-800 hover:bg-blue-50' : 'text-slate-300 hover:bg-slate-50'} ${isPico && hasValue ? 'bg-amber-50/20 ring-1 ring-amber-300 ring-inset' : ''}`}
        >
            {hasValue ? display : '—'}
        </td>
    );
};

// CELDA % EDITABLE
const PctCell: React.FC<{ value: number; onChange: (v: number) => void }> = ({
    value,
    onChange,
}) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const startEdit = () => {
        setRaw(value.toFixed(2));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };
    const commit = () => {
        const p = parseFloat(raw.replace(/,/g, '.'));
        if (!isNaN(p)) onChange(Math.max(0, p));
        setEditing(false);
    };

    if (editing)
        return (
            <td className="w-20 border border-slate-300 p-0">
                <input
                    ref={inputRef}
                    type="text"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="h-full w-full border-0 bg-yellow-50 px-2 py-1.5 text-center font-mono text-[11px] text-slate-900 outline-none"
                />
            </td>
        );
    return (
        <td
            onClick={startEdit}
            title="Clic para editar %"
            className="w-20 cursor-pointer border border-slate-300 bg-slate-100 p-2 text-center text-[11px] font-semibold text-slate-600 transition-colors select-none hover:bg-yellow-50"
        >
            {value.toFixed(2)}%
        </td>
    );
};

// CELDA MONTO EDITABLE
const MontoCell: React.FC<{ value: number; onChange: (v: number) => void }> = ({
    value,
    onChange,
}) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const startEdit = () => {
        setRaw(value.toFixed(2));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };
    const commit = () => {
        const p = parseFloat(raw.replace(/,/g, '.'));
        if (!isNaN(p)) onChange(Math.max(0, p));
        setEditing(false);
    };

    if (editing)
        return (
            <td className="border border-slate-300 p-0">
                <input
                    ref={inputRef}
                    type="text"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="h-full w-full border-0 bg-yellow-50 px-2 py-1.5 text-right font-mono text-[11px] text-slate-900 outline-none"
                />
            </td>
        );
    return (
        <td
            onClick={startEdit}
            title="Clic para editar monto"
            className="cursor-pointer border border-slate-300 bg-slate-100 p-2 text-right text-[11px] font-semibold text-slate-700 tabular-nums transition-colors select-none hover:bg-yellow-50"
        >
            {value > 0 ? fmtS(value) : '—'}
        </td>
    );
};

// BADGE DESVÍO
const BadgeDesviacion: React.FC<{ desvio: number }> = ({ desvio }) => {
    if (desvio <= 0.01) return null;
    return (
        <span
            title={`Diferencia: S/. ${fmtN(desvio)}`}
            className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[8px] font-black text-rose-700"
        >
            <AlertTriangle className="h-2.5 w-2.5" />
            S/. {fmtN(desvio)}
        </span>
    );
};

// PROPS
interface Props {
    items: ItemValorizado[];
    periodos: Periodo[];
    viewMode: ViewMode;
    totales: Record<string, TotalesColumna>;
    totalPresupuesto: number;
    onEditarCelda: (
        itemId: number | string,
        key: string,
        monto: number,
    ) => void;
    onRedistribuir: (itemId: number | string) => void;
    onRedistribuirGauss: (itemId: number | string) => void;
    onLimpiar: (itemId: number | string) => void;
    mesPicoKey?: string;
    diasPorMes?: Record<string, number>;
    jerarquiaPresupuesto?: Record<string, string>;
    desviaciones?: Record<string | number, number>;
    totalDesviadas?: number;
    isPeriodoBloqueado: (item: ItemValorizado, key: string) => boolean;
    totalesPorItem?: Record<string | number, number>;
    totalGeneralPeriodos?: number;
    // Valores iniciales de la sección financiera (% reales del presupuesto,
    // ver CronoValorizadoController::resolveFinDefaults())
    finDefaults?: FinDefaults;
    // Proyecto actual — para persistir altas/bajas de componentes extra en
    // gg_consolidado (mismo endpoint que usa el panel Consolidado).
    projectId?: string;
    onFinDefaultsChange?: (values: FinDefaults) => void;
    // Reporta el "Presupuesto Total" final ya calculado (con GG/Utilidad/IGV/
    // Componentes/conceptos) Y su reparto mensual — lo usa el padre para el
    // Cronograma de Desembolsos, que debe basarse en el monto real del
    // contrato (no en el Costo Directo puro) tanto en el total como mes a
    // mes, y reaccionar a cualquier cambio en Valorizado (%, componentes,
    // conceptos), no solo al cargar la página.
    onPresupuestoTotalChange?: (data: {
        total: number;
        distribucionMensual: Record<string, number>;
    }) => void;
}

// COMPONENTE PRINCIPAL
const TablaValorizada: React.FC<Props> = ({
    items = [],
    periodos = [],
    viewMode,
    totales = {},
    totalPresupuesto = 0,
    onEditarCelda,
    onRedistribuir,
    onRedistribuirGauss,
    onLimpiar,
    mesPicoKey,
    diasPorMes,
    jerarquiaPresupuesto = {},
    desviaciones = {},
    totalDesviadas = 0,
    isPeriodoBloqueado,
    totalesPorItem = {},
    totalGeneralPeriodos = 0,
    finDefaults = {},
    projectId,
    onFinDefaultsChange,
    onPresupuestoTotalChange,
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const [fin, setFin] = useState<FinancieroState>({
        pctGastosGenerales: finDefaults.pctGastosGenerales ?? 11.56,
        pctUtilidad: finDefaults.pctUtilidad ?? 5.0,
        pctIGV: finDefaults.pctIGV ?? 18.0,
        montoMobiliario: finDefaults.montoMobiliario ?? 0,
        pctIGVMobiliario: finDefaults.pctIGVMobiliario ?? 18.0,
        pctSupervision: finDefaults.pctSupervision ?? 5.13,
    });
    const [hasComponentII, setHasComponentII] = useState(
        () => (finDefaults.montoMobiliario ?? 0) > 0,
    );
    const setPct = useCallback((key: keyof FinancieroState, val: number) => {
        setFin((prev) => ({ ...prev, [key]: val }));
    }, []);
    const removeComponentII = useCallback(() => {
        if (!window.confirm('¿Eliminar el Componente II de este presupuesto?')) return;

        setHasComponentII(false);
        setFin((prev) => ({ ...prev, montoMobiliario: 0 }));
        if (projectId) {
            void axios.patch(
                `/costos/proyectos/${projectId}/presupuesto/consolidado/snapshot`,
                { componente_ii_monto: 0 },
            );
        }
    }, [projectId]);

    // ── Componentes extra (III, IV, ...) ──────────────────────────────────
    // Mismo dato que el panel Consolidado (gg_consolidado.componentes_extra_json):
    // se editan aquí y se persisten en el mismo snapshot, para que ambas
    // pantallas siempre coincidan (una sola fuente de verdad).
    const [extraComponents, setExtraComponents] = useState<ComponenteExtra[]>(
        () => finDefaults.componentesExtra ?? [],
    );
    const [additionalConcepts, setAdditionalConcepts] = useState<ConceptoAdicional[]>(
        () => finDefaults.conceptosAdicionales ?? [],
    );
    useEffect(() => {
        onFinDefaultsChange?.({
            ...fin,
            componentesExtra: extraComponents,
            conceptosAdicionales: additionalConcepts,
        });
    }, [fin, extraComponents, additionalConcepts, onFinDefaultsChange]);
    const extraSeeded = useRef(false);

    // Costo Directo + cascada completa (GG/Utilidad/IGV/Componentes/conceptos),
    // vía el mismo helper que usan exportHelpers.ts y (para Desembolso)
    // CronogramaValorizado.tsx — una sola fuente de verdad para esta fórmula.
    // Se calcula ANTES del "return early" de abajo (items.length === 0) para
    // no romper las reglas de hooks: un useEffect no puede declararse
    // condicionalmente según ese return.
    const costoDirectoResumen =
        totalPresupuesto > 0 ? totalPresupuesto : totalGeneralPeriodos;
    const resumenFinanciero = useMemo(
        () =>
            calcularResumenFinanciero({
                costoDirecto: costoDirectoResumen,
                pctGastosGenerales: fin.pctGastosGenerales,
                pctUtilidad: fin.pctUtilidad,
                pctIGV: fin.pctIGV,
                montoMobiliario: fin.montoMobiliario,
                pctIGVMobiliario: fin.pctIGVMobiliario,
                hasComponentII,
                componentesExtra: extraComponents,
                conceptosAdicionales: additionalConcepts,
            }),
        [costoDirectoResumen, fin, hasComponentII, extraComponents, additionalConcepts],
    );
    // cdPorPeriodo/cdTotalReal/propDist se calculan aquí (antes del "return
    // early" de más abajo) para poder reportar distribucionMensual al padre.
    // Sin esto, el Cronograma de Desembolsos usaba el Costo Directo puro por
    // mes (`totalesFinales`) en vez de la valorización real (con GG/Utilidad/
    // IGV/conceptos ya sumados) — cualquier cambio en los conceptos de
    // Valorizado no se reflejaba ahí ("sigue con 79, no veo cambios").
    let cdPorPeriodo: Record<string, number> = {};
    periodos.forEach((p) => {
        cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0;
    });
    cdPorPeriodo = ajustarResiduoMonetario(
        cdPorPeriodo,
        periodos.map((p) => p.key),
        costoDirectoResumen,
    );
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);

    // Presupuesto suma los parciales con su precisión interna y redondea una
    // sola vez al final. El cronograma reparte cada partida en céntimos, por lo
    // que sumar esos redondeos puede diferir S/ 0.01. El último período activo
    // absorbe únicamente ese residuo para que F28 y sus meses concilien con el
    // Costo Directo oficial, sin alterar las partidas individuales.

    // Reparto proporcional con ajuste de residuo (Decimal.js): sin esto, cada
    // celda se redondeaba a 2 decimales por separado y la suma de los meses
    // casi nunca cuadraba exacto con el total de su propia fila. El último
    // período con peso > 0 absorbe el residuo — mismo patrón que ya usa el
    // backend en CronoValorizadoController::distribuirPorDiasCalendario().
    const propDist = (total: number): Record<string, number> => {
        const r: Record<string, number> = {};
        if (cdTotalReal <= 0) {
            periodos.forEach((p) => {
                r[p.key] = 0;
            });
            return r;
        }

        const totalDec = new Decimal(total);
        let sumaAsignada = new Decimal(0);
        let ultimaKey: string | null = null;

        periodos.forEach((p) => {
            const peso = cdPorPeriodo[p.key] ?? 0;
            const monto = totalDec
                .times(peso)
                .dividedBy(cdTotalReal)
                .toDecimalPlaces(2)
                .toNumber();
            r[p.key] = monto;
            sumaAsignada = sumaAsignada.plus(monto);
            if (peso !== 0) {
                ultimaKey = p.key;
            }
        });

        if (ultimaKey !== null) {
            const residuo = totalDec.minus(sumaAsignada);
            if (!residuo.isZero()) {
                r[ultimaKey] = new Decimal(r[ultimaKey]).plus(residuo).toDecimalPlaces(2).toNumber();
            }
        }

        return r;
    };

    useEffect(() => {
        // Desembolso usa el "PRESUPUESTADO DE OBRA INFRAESTRUCTURA" (Costo
        // Directo + GG + Utilidad + IGV) — NO el Presupuesto Total con
        // Componentes II/III ni conceptos (Supervisión, Coordinación, Gestión
        // Administrativa, Control Concurrente, ...) sumados. Esos son costos
        // administrativos/de otros componentes que no forman parte del
        // contrato de obra sobre el que se calculan los adelantos.
        onPresupuestoTotalChange?.({
            total: resumenFinanciero.presupI,
            distribucionMensual: propDist(resumenFinanciero.presupI),
        });
    }, [resumenFinanciero.presupI, totales, periodos, onPresupuestoTotalChange]);

    const addExtraComponent = useCallback(() => {
        setExtraComponents((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                name: 'NUEVO COMPONENTE',
                monto: 0,
            },
        ]);
    }, []);
    const removeExtraComponent = useCallback((id: string) => {
        setExtraComponents((prev) => prev.filter((c) => c.id !== id));
    }, []);
    const updateExtraComponent = useCallback(
        (id: string, field: 'name' | 'monto', value: string | number) => {
            setExtraComponents((prev) =>
                prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
            );
        },
        [],
    );

    // Persistencia con debounce, igual que ConsolidadoPanel.tsx. Solo se
    // manda `componentes_extra` — el backend conserva GG/Utilidad/IGV/
    // Mobiliario ya guardados (ver PresupuestoController::recalculateConsolidadoSnapshot,
    // que hace fallback a $existing cuando un campo no llega en el request).
    useEffect(() => {
        if (!extraSeeded.current) {
            extraSeeded.current = true;
            return;
        }
        if (!projectId) return;
        const timer = setTimeout(() => {
            void axios
                .patch(
                    `/costos/proyectos/${projectId}/presupuesto/consolidado/snapshot`,
                    {
                        componentes_extra: extraComponents.map((c) => ({
                            id: c.id,
                            name: c.name,
                            monto: Number(c.monto) || 0,
                        })),
                        conceptos_adicionales: additionalConcepts.map((concepto) => ({
                            ...concepto,
                            valor: Number(concepto.valor) || 0,
                        })),
                    },
                )
                .catch(() => {
                    // silencioso: no bloquea la edición local si falla el guardado
                });
        }, 800);
        return () => clearTimeout(timer);
    }, [extraComponents, additionalConcepts, projectId]);

    const toggleCollapse = useCallback((code: string) => {
        setCollapsed((prev) => {
            const n = new Set(prev);
            if (n.has(code)) n.delete(code);
            else n.add(code);
            return n;
        });
    }, []);

    const treeItems = useMemo<ItemValorizado[]>(() => {
        const byCode = new Map<string, ItemValorizado>();

        items.forEach((item) => {
            const code = item.item || '';
            if (!code) return;
            byCode.set(code, { ...item });

            parentCodes(code).forEach((parentCode) => {
                if (!byCode.has(parentCode)) {
                    byCode.set(parentCode, {
                        parent_id: null,
                        id: `group:${parentCode}`,
                        item: parentCode,
                        descripcion:
                            jerarquiaPresupuesto[parentCode] ??
                            `Partida ${parentCode}`,
                        und: '',
                        metrado: 0,
                        precio: 0,
                        parcial: 0,
                        is_leaf: false,
                        distribucion: emptyDistribucion(periodos),
                    });
                }
            });
        });

        const codes = [...byCode.keys()].sort((a, b) =>
            a.localeCompare(b, 'es', { numeric: true }),
        );

        const hasChildren = new Set<string>();
        codes.forEach((code) => {
            parentCodes(code).forEach((parentCode) => hasChildren.add(parentCode));
        });

        const leafItems = items.filter(
            (item) => item.item && !hasChildren.has(item.item),
        );

        codes.forEach((code) => {
            const row = byCode.get(code);
            if (!row || !hasChildren.has(code)) return;

            const descendants = leafItems.filter((item) =>
                item.item.startsWith(`${code}.`),
            );
            const parcial = descendants.reduce(
                (acc, item) => acc + (item.parcial ?? 0),
                0,
            );
            const distribucion = emptyDistribucion(periodos);

            descendants.forEach((item) => {
                periodos.forEach((periodo) => {
                    const monto = item.distribucion?.[periodo.key]?.monto ?? 0;
                    distribucion[periodo.key].monto += monto;
                });
            });

            periodos.forEach((periodo) => {
                const monto = distribucion[periodo.key].monto;
                distribucion[periodo.key] = {
                    monto: Math.round(monto * 100) / 100,
                    porcentaje:
                        parcial > 0 ? (monto / parcial) * 100 : 0,
                };
            });

            byCode.set(code, {
                ...row,
                parcial,
                distribucion,
                is_leaf: false,
            });
        });

        return codes
            .map((code) => byCode.get(code))
            .filter((item): item is ItemValorizado => Boolean(item));
    }, [items, periodos, jerarquiaPresupuesto]);

    const childCodes = useMemo(() => {
        const result = new Set<string>();
        treeItems.forEach((item) => {
            parentCodes(item.item || '').forEach((parentCode) =>
                result.add(parentCode),
            );
        });
        return result;
    }, [treeItems]);

    const visibleItems = useMemo(
        () =>
            treeItems.filter((item) => {
                const code = item.item || '';
                for (const col of collapsed) {
                    if (
                        code.startsWith(`${col}.`) ||
                        code.startsWith(`${col} `)
                    )
                        return false;
                }
                return true;
            }),
        [treeItems, collapsed],
    );

    const nCols = 7 + periodos.length + 1;
    const rowVirtualizer = useVirtualizer({
        count: visibleItems.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 42,
        overscan: 18,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const topSpacer = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const bottomSpacer =
        virtualRows.length > 0
            ? rowVirtualizer.getTotalSize() -
              virtualRows[virtualRows.length - 1].end
            : 0;

    if (items.length === 0)
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-400">
                <span className="text-5xl">📋</span>
                <p className="mt-4 font-bold">No hay partidas para mostrar</p>
            </div>
        );

    const costoDirecto = costoDirectoResumen;

    const {
        montoGG,
        montoUT,
        subTotal,
        montoIGV,
        presupI,
        montoIGVMob,
        subTotalII,
        extraCalcs,
        extraComponentsTotal,
        romanList,
        totalI_II,
        amarillos,
        rojosNormales,
        rojosFinales,
        amarilloCalcs,
        rojoCalcs,
        rojoFinalCalcs,
        presupuestoSubTotal,
        presupuestoTotalIntermedio,
        presupuestoTotal: presupTotal,
    } = resumenFinanciero;
    // cdPorPeriodo/cdTotalReal/propDist ya están definidos más arriba (antes
    // del return early), donde también se usan para reportar
    // distribucionMensual al padre — ver el useEffect de onPresupuestoTotalChange.

    const distGG = propDist(montoGG);
    const distUT = propDist(montoUT);
    const distSub = propDist(subTotal);
    const distIGV = propDist(montoIGV);
    const distPresI = propDist(presupI);
    const distPresupuestoTotal = propDist(presupTotal);

    let acumuladoValorizado = 0;
    const valorizadoAcumulado: Record<string, number> = {};
    const avanceMensualIntegrado: Record<string, number> = {};
    const avanceAcumuladoIntegrado: Record<string, number> = {};
    periodos.forEach((p) => {
        const mensual = distPresupuestoTotal[p.key] ?? 0;
        acumuladoValorizado += mensual;
        valorizadoAcumulado[p.key] = acumuladoValorizado;
        avanceMensualIntegrado[p.key] = presupTotal > 0 ? (mensual / presupTotal) * 100 : 0;
        avanceAcumuladoIntegrado[p.key] = presupTotal > 0 ? (acumuladoValorizado / presupTotal) * 100 : 0;
    });

    const finTd = (v: number, key: string, cls: string) => {
        const darkBackground = cls.includes('bg-slate-7') || cls.includes('bg-slate-8') || cls.includes('bg-slate-9');
        const valueColor = darkBackground
            ? (v > 0 ? 'text-white' : 'text-slate-500')
            : (v > 0 ? 'text-slate-700' : 'text-slate-300');

        return (
            <td
                key={key}
                className={`border border-slate-300 p-2 text-right text-[11px] font-medium tabular-nums ${cls} ${valueColor} ${key === mesPicoKey && v > 0 ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
            >
                {v > 0 ? fmtN(v) : '—'}
            </td>
        );
    };

    const updateConcepto = (id: string, patch: Partial<ConceptoAdicional>) =>
        setAdditionalConcepts((current) =>
            current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );

    // Fila editable de un "concepto de valorización" (amarillo o rojo): nombre,
    // tipo (% o monto), categoría (a qué etapa de la cascada pertenece) y su
    // valor. El monto ya viene calculado según su categoría (ver cálculo de
    // amarilloCalcs/rojoCalcs/rojoFinalCalcs arriba).
    const renderConceptoRow = (concepto: ConceptoCalculado) => {
        const distribucion = propDist(concepto.monto);
        return (
            <tr key={concepto.id} className="bg-slate-50 text-slate-800">
                <td className="border border-slate-300 p-1 text-center">
                    <button
                        type="button"
                        onClick={() =>
                            setAdditionalConcepts((current) =>
                                current.filter((item) => item.id !== concepto.id),
                            )
                        }
                        title="Eliminar concepto"
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </td>
                <td className="sticky left-0 z-10 border border-slate-300 bg-slate-50 p-1">
                    <input
                        value={concepto.name}
                        onChange={(event) =>
                            updateConcepto(concepto.id, { name: event.target.value })
                        }
                        className="w-full bg-transparent p-1 text-[11px] font-semibold uppercase outline-none"
                    />
                </td>
                <td className="border border-slate-300 p-1">
                    <select
                        value={concepto.tipo}
                        onChange={(event) =>
                            updateConcepto(concepto.id, {
                                tipo: event.target.value as ConceptoAdicional['tipo'],
                            })
                        }
                        className="w-full bg-transparent text-[9px] outline-none"
                        title="Tipo de valor"
                    >
                        <option value="porcentaje">%</option>
                        <option value="monto">S/.</option>
                    </select>
                </td>
                <td className="border border-slate-300 p-1">
                    <select
                        value={concepto.categoria ?? 'rojo'}
                        onChange={(event) =>
                            updateConcepto(concepto.id, {
                                categoria: event.target.value as ConceptoAdicional['categoria'],
                            })
                        }
                        className="w-full bg-transparent text-[8px] outline-none"
                        title="Etapa de cálculo: amarillo suma al Sub Total; rojo aplica % sobre el Sub Total; rojo final aplica sobre el resultado de los rojos"
                    >
                        <option value="amarillo">Amarillo</option>
                        <option value="rojo">Rojo</option>
                        <option value="rojo_final">Rojo final</option>
                    </select>
                </td>
                <td className="border border-slate-300 p-2" />
                {concepto.tipo === 'porcentaje' ? (
                    <PctCell
                        value={Number(concepto.valor) || 0}
                        onChange={(valor) => updateConcepto(concepto.id, { valor })}
                    />
                ) : (
                    <MontoCell
                        value={Number(concepto.valor) || 0}
                        onChange={(valor) => updateConcepto(concepto.id, { valor })}
                    />
                )}
                <td className="border border-slate-300 p-2" />
                {periodos.map((p) => finTd(distribucion[p.key] ?? 0, p.key, 'bg-slate-50'))}
                <td className="sticky right-0 z-10 border border-slate-300 bg-slate-50 p-2.5 text-right font-semibold tabular-nums">
                    {fmtS(concepto.monto)}
                </td>
            </tr>
        );
    };

    return (
        <div
            ref={tableRef}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
            {/* Leyenda */}
            <div className="flex items-center gap-5 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-semibold tracking-wider text-slate-500 uppercase">
                <span>📌 Clic en celda para editar</span>
                <span>⟳ = Uniforme</span>
                <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> = Gauss (Curva S)
                </span>
                <span>✕ = Limpiar</span>
                <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" /> = Fuera de rango
                </span>
                <span className="ml-auto flex items-center gap-4">
                    {totalDesviadas > 0 && (
                        <span className="flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-600">
                            <AlertTriangle className="h-3 w-3" />
                            {totalDesviadas} partida
                            {totalDesviadas > 1 ? 's' : ''} con desvío
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-3 rounded-sm bg-amber-400" />{' '}
                        Mes pico
                    </span>
                </span>
            </div>

            <div ref={scrollRef} className="max-h-[72vh] overflow-auto">
                <table
                    className="w-full border-collapse text-[11px]"
                    style={{
                        minWidth: `${Math.max(1240, 820 + periodos.length * 95)}px`,
                    }}
                >
                    {/* ══════════════ ENCABEZADO ══════════════ */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-900 text-[10px] font-bold tracking-wider text-white uppercase">
                            <th className="w-10 border border-slate-700 p-2.5 text-center">
                                N°
                            </th>
                            <th className="sticky left-0 z-30 min-w-[360px] border border-slate-700 bg-slate-900 p-2.5 text-left">
                                ÍTEM / DESCRIPCIÓN
                            </th>
                            <th className="w-12 border border-slate-700 p-2.5 text-center">
                                UND
                            </th>
                            <th className="w-24 border border-slate-700 p-2.5 text-right">
                                METRADO
                            </th>
                            <th className="w-28 border border-slate-700 p-2.5 text-right">
                                P.U. (S/.)
                            </th>
                            <th className="w-32 border border-slate-700 bg-blue-900 p-2.5 text-right">
                                PARCIAL (S/.)
                            </th>
                            <th className="w-20 border border-slate-700 bg-slate-800 p-2.5 text-center">
                                ACC.
                            </th>
                            {periodos.map((p) => (
                                <th
                                    key={p.key}
                                    className={`min-w-[88px] border border-slate-700 p-2.5 text-center ${p.key === mesPicoKey ? 'bg-amber-700' : ''}`}
                                >
                                    <div>{p.label}</div>
                                    <div className="text-[8px] font-normal text-slate-400 normal-case">
                                        {p.labelCal}
                                    </div>
                                </th>
                            ))}
                            <th className="sticky right-0 z-30 min-w-[110px] border border-slate-700 bg-emerald-900 p-2.5 text-center text-emerald-200">
                                <div>TOTAL</div>
                                <div className="text-[8px] font-normal text-emerald-400 normal-case">
                                    S/. acumulado
                                </div>
                            </th>
                        </tr>
                    </thead>

                    {/* ══════════════ CUERPO ══════════════ */}
                    <tbody>
                        {topSpacer > 0 && (
                            <tr aria-hidden="true">
                                <td
                                    colSpan={nCols}
                                    style={{
                                        height: topSpacer,
                                        padding: 0,
                                        border: 0,
                                    }}
                                />
                            </tr>
                        )}
                        {virtualRows.map((virtualRow) => {
                            const item = visibleItems[virtualRow.index];
                            if (!item) return null;
                            const idx = virtualRow.index;
                            const n = nivel(item.item);
                            const hasKids = childCodes.has(item.item);
                            const isLeaf = !hasKids;
                            const isCollapsed = collapsed.has(item.item);
                            const bg = bgNivel(n, isLeaf);
                            const isDarkSummaryRow = !isLeaf && n === 0;
                            const desvio = isLeaf
                                ? (desviaciones[item.id] ?? 0)
                                : 0;
                            const tieneDesv = desvio > 0.01;
                            const totalFila = isLeaf
                                ? (totalesPorItem[item.id] ?? 0)
                                : periodos.reduce(
                                      (acc, p) =>
                                          acc +
                                          (item.distribucion?.[p.key]?.monto ??
                                              0),
                                      0,
                                  );

                            return (
                                <tr
                                    key={item.id}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    className={`${bg || (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')} transition-colors hover:bg-blue-50/30 ${tieneDesv ? 'ring-1 ring-rose-200 ring-inset' : ''}`}
                                >
                                    <td className={`border border-slate-200 p-2 text-center tabular-nums ${isDarkSummaryRow ? 'text-slate-200' : 'text-slate-400'}`}>
                                        {idx + 1}
                                    </td>
                                    <td
                                        className={`sticky left-0 z-10 border border-slate-200 p-2 shadow-[1px_0_4px_rgba(0,0,0,0.05)] ${
                                            n === 0
                                                ? 'bg-slate-800 text-white'
                                                : n === 1
                                                  ? 'bg-slate-200 text-slate-900'
                                                  : n === 2
                                                    ? 'bg-slate-100 text-slate-800'
                                                    : 'bg-white text-slate-700'
                                        }`}
                                        style={{
                                            paddingLeft: `${8 + n * 18}px`,
                                        }}
                                    >
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            {hasKids ? (
                                                <button
                                                    onClick={() =>
                                                        toggleCollapse(
                                                            item.item,
                                                        )
                                                    }
                                                    className="h-3.5 w-3.5 shrink-0 text-slate-400 hover:text-blue-600"
                                                    title={
                                                        isCollapsed
                                                            ? 'Expandir'
                                                            : 'Colapsar'
                                                    }
                                                >
                                                    {isCollapsed ? (
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                            <span
                                                className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                                                    n === 0
                                                        ? 'border-slate-500 bg-slate-700 text-slate-100'
                                                        : n === 1
                                                          ? 'border-slate-400 bg-white/70 text-slate-700'
                                                          : 'border-slate-200 bg-slate-50 text-slate-500'
                                                }`}
                                            >
                                                {item.item}
                                            </span>
                                            <span
                                                className={`min-w-0 leading-tight ${n <= 1 ? 'font-bold' : n === 2 ? 'font-semibold' : 'font-normal'} ${isLeaf ? 'italic' : ''}`}
                                            >
                                                {item.descripcion}
                                            </span>
                                            {tieneDesv && (
                                                <BadgeDesviacion
                                                    desvio={desvio}
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className={`border border-slate-200 p-2 text-center text-[10px] uppercase ${isDarkSummaryRow ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {item.und || '—'}
                                    </td>
                                    <td className={`border border-slate-200 p-2 text-right font-mono tabular-nums ${isDarkSummaryRow ? 'text-slate-100' : 'text-slate-600'}`}>
                                        {item.metrado > 0
                                            ? fmtN(item.metrado)
                                            : '—'}
                                    </td>
                                    <td className={`border border-slate-200 p-2 text-right font-mono tabular-nums ${isDarkSummaryRow ? 'text-slate-100' : 'text-slate-600'}`}>
                                        {item.precio > 0
                                            ? fmtN(item.precio)
                                            : '—'}
                                    </td>
                                    <td className={`border border-slate-200 p-2 text-right font-bold tabular-nums ${isDarkSummaryRow ? 'bg-blue-950/20 text-white' : 'bg-blue-50/20 text-blue-800'}`}>
                                        {item.parcial > 0
                                            ? fmtS(item.parcial)
                                            : '—'}
                                    </td>
                                    <td className={`border border-slate-200 p-2 text-center ${isDarkSummaryRow ? 'bg-slate-800 text-slate-200' : 'bg-slate-50'}`}>
                                        {isLeaf && (
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() =>
                                                        onRedistribuir(item.id)
                                                    }
                                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                                    title="Redistribuir uniformemente"
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        onRedistribuirGauss(
                                                            item.id,
                                                        )
                                                    }
                                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                                    title="Redistribuir con curva Gauss"
                                                >
                                                    <TrendingUp className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        onLimpiar(item.id)
                                                    }
                                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                    title="Limpiar distribución"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    {periodos.map((p) => {
                                        const dist = item.distribucion?.[p.key];
                                        const monto = dist?.monto ?? 0;
                                        const isPico = p.key === mesPicoKey;
                                        if (!isLeaf)
                                            return (
                                                <td
                                                    key={p.key}
                                                    className={`border border-slate-200 p-2 text-right text-[11px] font-semibold tabular-nums ${isDarkSummaryRow ? (monto > 0 ? 'text-white' : 'text-slate-500') : (monto > 0 ? 'text-slate-700' : 'text-slate-200')} ${isPico && monto > 0 ? (isDarkSummaryRow ? 'bg-amber-500/15' : 'bg-amber-50/30') : ''}`}
                                                >
                                                    {monto > 0
                                                        ? viewMode === 'monto'
                                                            ? fmtN(monto)
                                                            : fmtP(
                                                                  item.parcial >
                                                                      0
                                                                      ? (monto /
                                                                            item.parcial) *
                                                                            100
                                                                      : 0,
                                                              )
                                                        : '—'}
                                                </td>
                                            );
                                        const bloqueada = isPeriodoBloqueado(
                                            item,
                                            p.key,
                                        );
                                        return (
                                            <EditableCell
                                                key={p.key}
                                                value={monto}
                                                viewMode={viewMode}
                                                parcial={item.parcial}
                                                onChange={(v) =>
                                                    onEditarCelda(
                                                        item.id,
                                                        p.key,
                                                        v,
                                                    )
                                                }
                                                isPico={isPico}
                                                bloqueada={bloqueada}
                                            />
                                        );
                                    })}
                                    <td
                                        className={`sticky right-0 z-10 border border-slate-200 p-2 text-right text-[11px] font-bold tabular-nums shadow-[-1px_0_4px_rgba(0,0,0,0.05)] ${
                                            totalFila > 0
                                                ? tieneDesv
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : 'bg-emerald-50/60 text-emerald-800'
                                                : 'bg-slate-50 text-slate-300'
                                        }`}
                                        title={
                                            tieneDesv
                                                ? `Desvío: S/. ${fmtN(desvio)}`
                                                : 'Total acumulado'
                                        }
                                    >
                                        {totalFila > 0 ? fmtS(totalFila) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                        {bottomSpacer > 0 && (
                            <tr aria-hidden="true">
                                <td
                                    colSpan={nCols}
                                    style={{
                                        height: bottomSpacer,
                                        padding: 0,
                                        border: 0,
                                    }}
                                />
                            </tr>
                        )}
                    </tbody>

                    {/* ══════════════ FOOTER ══════════════ */}
                    <tfoot className="text-[11px]">
                        {/* ════════ BANDA DIVISORIA PARTIDAS → RESUMEN FINANCIERO ════════ */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{ padding: 0, border: 'none' }}
                            >
                                <div
                                    style={{
                                        background: '#1e293b',
                                        padding: '5px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        borderTop: '3px solid #475569',
                                        borderBottom: '3px solid #475569',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: '#94a3b8',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                        }}
                                    >
                                        ▼ RESUMEN FINANCIERO DEL PRESUPUESTO
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {/* ── COSTO DIRECTO ── */}
                        <tr className="bg-slate-100 font-bold text-slate-900">
                            <td className="border border-slate-300 p-2 text-center text-[10px] text-slate-400" />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-left text-[11px] tracking-wide uppercase">
                                COSTO DIRECTO
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right tabular-nums">
                                {costoDirecto > 0 ? fmtS(costoDirecto) : '—'}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(
                                    cdPorPeriodo[p.key] ?? 0,
                                    p.key,
                                    'bg-white',
                                ),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                {costoDirecto > 0 ? fmtS(costoDirecto) : '—'}
                            </td>
                        </tr>

                        {/* ── GASTOS GENERALES ── */}
                        <tr className="bg-white text-slate-800">
                            <PctCell
                                value={fin.pctGastosGenerales}
                                onChange={(v) =>
                                    setPct('pctGastosGenerales', v)
                                }
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                GASTOS GENERALES
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoGG)}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(distGG[p.key] ?? 0, p.key, 'bg-white'),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoGG)}
                            </td>
                        </tr>

                        {/* ── UTILIDAD ── */}
                        <tr className="bg-white text-slate-800">
                            <PctCell
                                value={fin.pctUtilidad}
                                onChange={(v) => setPct('pctUtilidad', v)}
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                UTILIDAD
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoUT)}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(distUT[p.key] ?? 0, p.key, 'bg-white'),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoUT)}
                            </td>
                        </tr>

                        {/* ── SUB TOTAL ── */}
                        <tr className="bg-slate-200 font-bold text-slate-900">
                            <td className="border border-slate-300 p-2" />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-slate-200 p-2.5 text-left text-[11px] tracking-wider uppercase">
                                SUB TOTAL
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right text-[11px] font-bold tabular-nums">
                                {fmtS(subTotal)}
                            </td>
                            <td className="border border-slate-300 bg-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(
                                    distSub[p.key] ?? 0,
                                    p.key,
                                    'bg-slate-50',
                                ),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-slate-200 p-2.5 text-right font-bold tabular-nums">
                                {fmtS(subTotal)}
                            </td>
                        </tr>

                        {/* ── I.G.V. ── */}
                        <tr className="bg-white text-slate-800">
                            <PctCell
                                value={fin.pctIGV}
                                onChange={(v) => setPct('pctIGV', v)}
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                I.G.V.
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoIGV)}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(distIGV[p.key] ?? 0, p.key, 'bg-white'),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoIGV)}
                            </td>
                        </tr>

                        {/* ── PRESUPUESTADO COMP. I ── */}
                        <tr className="bg-slate-700 font-bold text-white">
                            <td
                                colSpan={5}
                                className="border border-slate-600 p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                PRESUPUESTADO DE OBRA INFRAESTRUCTURA COMPONENTE
                                I
                            </td>
                            <td className="border border-slate-600 bg-slate-800 p-2.5 text-right font-bold text-emerald-300 tabular-nums">
                                {fmtS(presupI)}
                            </td>
                            <td className="border border-slate-600 bg-slate-800" />
                            {periodos.map((p) =>
                                finTd(
                                    distPresI[p.key] ?? 0,
                                    p.key,
                                    'bg-slate-700 text-slate-200',
                                ),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-600 bg-slate-800 p-2.5 text-right font-bold text-white tabular-nums">
                                {fmtS(presupI)}
                            </td>
                        </tr>

                        {hasComponentII && <React.Fragment>
                        {/* SEPARADOR COMPONENTE II */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{
                                    height: 2,
                                    padding: 0,
                                    border: 'none',
                                    background: '#94a3b8',
                                }}
                            />
                        </tr>

                        {/* ── MOBILIARIO Y EQUIPAMIENTO COMP. II ── */}
                        <tr className="bg-white text-slate-700">
                            <td className="border border-slate-300 p-1 text-center">
                                <button
                                    type="button"
                                    onClick={removeComponentII}
                                    title="Eliminar Componente II"
                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </td>
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                MOBILIARIO Y EQUIPAMIENTO COMPONENTE II
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <MontoCell
                                value={fin.montoMobiliario}
                                onChange={(v) => setPct('montoMobiliario', v)}
                            />
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                >
                                    —
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fin.montoMobiliario > 0
                                    ? fmtS(fin.montoMobiliario)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── IGV MOBILIARIO ── */}
                        <tr className="bg-white text-slate-700">
                            <PctCell
                                value={fin.pctIGVMobiliario}
                                onChange={(v) => setPct('pctIGVMobiliario', v)}
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                IGV (MOBILIARIO Y EQUIPAMIENTO)
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fin.montoMobiliario > 0
                                    ? fmtS(montoIGVMob)
                                    : '—'}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                >
                                    —
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fin.montoMobiliario > 0
                                    ? fmtS(montoIGVMob)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── SUB TOTAL COMPONENTE II ── */}
                        <tr className="bg-slate-100 font-bold text-slate-800">
                            <td
                                colSpan={5}
                                className="border border-slate-300 p-2.5 text-right text-[10px] tracking-wider uppercase"
                            >
                                SUB TOTAL COMPONENTE II
                            </td>
                            <td className="border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                {subTotalII > 0 ? fmtS(subTotalII) : '—'}
                            </td>
                            <td className="border border-slate-300 bg-slate-200" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                >
                                    —
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                {subTotalII > 0 ? fmtS(subTotalII) : '—'}
                            </td>
                        </tr>

                        {/* ── COMPONENTES EXTRA (III, IV, ...) ── */}
                        </React.Fragment>}
                        {extraCalcs.map((comp, idx) => {
                            // Numeración arábiga independiente (1, 2, 3...) — no
                            // roman ni ligada a hasComponentII, para no
                            // confundirse con los componentes oficiales I
                            // (Obra) / II (Mobiliario y Equipamiento).
                            const numero = idx + 1;
                            return (
                                <React.Fragment key={comp.id}>
                                    {/* Nombre + monto (editable) */}
                                    <tr className="bg-white text-slate-700">
                                        <td className="border border-slate-300 p-1 text-center">
                                            <button
                                                onClick={() =>
                                                    removeExtraComponent(
                                                        comp.id,
                                                    )
                                                }
                                                className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                title="Quitar componente"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </td>
                                        <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="shrink-0 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                                                    COMPONENTE {numero}:
                                                </span>
                                                <input
                                                    type="text"
                                                    value={comp.name}
                                                    onChange={(e) =>
                                                        updateExtraComponent(
                                                            comp.id,
                                                            'name',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="NOMBRE DEL COMPONENTE"
                                                    className="min-w-0 flex-1 border-b border-dashed border-slate-300 bg-transparent text-[11px] font-semibold tracking-wide text-slate-800 uppercase outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        </td>
                                        <td className="border border-slate-300 p-2" />
                                        <td className="border border-slate-300 p-2" />
                                        <td className="border border-slate-300 p-2" />
                                        <MontoCell
                                            value={comp.monto}
                                            onChange={(v) =>
                                                updateExtraComponent(
                                                    comp.id,
                                                    'monto',
                                                    v,
                                                )
                                            }
                                        />
                                        <td className="border border-slate-300 p-2" />
                                        {periodos.map((p) => (
                                            <td
                                                key={p.key}
                                                className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                            >
                                                —
                                            </td>
                                        ))}
                                        <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                            {comp.monto > 0
                                                ? fmtS(comp.monto)
                                                : '—'}
                                        </td>
                                    </tr>

                                    {/* IGV del componente extra */}
                                    <tr className="bg-white text-slate-700">
                                        <td className="border border-slate-300 p-2" />
                                        <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                            IGV (Componente {numero})
                                        </td>
                                        <td className="border border-slate-300 p-2" />
                                        <td className="border border-slate-300 p-2" />
                                        <td className="border border-slate-300 p-2" />
                                        <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                            {comp.monto > 0
                                                ? fmtS(comp.igv)
                                                : '—'}
                                        </td>
                                        <td className="border border-slate-300 p-2" />
                                        {periodos.map((p) => (
                                            <td
                                                key={p.key}
                                                className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                            >
                                                —
                                            </td>
                                        ))}
                                        <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                            {comp.monto > 0
                                                ? fmtS(comp.igv)
                                                : '—'}
                                        </td>
                                    </tr>

                                    {/* Sub total del componente extra */}
                                    <tr className="bg-slate-100 font-bold text-slate-800">
                                        <td
                                            colSpan={5}
                                            className="border border-slate-300 p-2.5 text-right text-[10px] tracking-wider uppercase"
                                        >
                                            SUB TOTAL COMPONENTE {numero}
                                        </td>
                                        <td className="border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                            {comp.subtotal > 0 ? fmtS(comp.subtotal) : '—'}
                                        </td>
                                        <td className="border border-slate-300 bg-slate-200" />
                                        {periodos.map((p) => (
                                            <td
                                                key={p.key}
                                                className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                            >
                                                —
                                            </td>
                                        ))}
                                        <td className="sticky right-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                            {comp.subtotal > 0
                                                ? fmtS(comp.subtotal)
                                                : '—'}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}

                        {/* ── AGREGAR COMPONENTE ──
                            Dos botones separados (antes uno solo hacía las dos
                            cosas y el texto quedaba mal — activar Mobiliario
                            "Componente II" oficial vs. agregar un componente
                            genérico se confundían entre sí). */}
                        <tr>
                            <td
                                colSpan={nCols}
                                className="border border-dashed border-slate-300 bg-white p-2"
                            >
                                <div className="flex items-center gap-4">
                                    {!hasComponentII && (
                                        <button
                                            onClick={() => setHasComponentII(true)}
                                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 transition-colors hover:text-slate-700"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Agregar Componente II (Mobiliario y Equipamiento)
                                        </button>
                                    )}
                                    <button
                                        onClick={addExtraComponent}
                                        className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 transition-colors hover:text-amber-700"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Agregar Componente
                                    </button>
                                </div>
                            </td>
                        </tr>

                        {/* ── TOTAL PRESUPUESTO COMPONENTE I+II+... ── */}
                        <tr className="bg-slate-800 font-bold text-white">
                            <td
                                colSpan={5}
                                className="border border-slate-600 p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                TOTAL PRESUPUESTO DE OBRA COMPONENTE {romanList}
                            </td>
                            <td className="border border-slate-600 bg-slate-900 p-2.5 text-right font-bold text-emerald-300 tabular-nums">
                                {fmtS(totalI_II)}
                            </td>
                            <td className="border border-slate-600 bg-slate-900" />
                            {periodos.map((p) =>
                                finTd(
                                    propDist(totalI_II)[p.key] ?? 0,
                                    p.key,
                                    'bg-slate-800 text-slate-200',
                                ),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-600 bg-slate-900 p-2.5 text-right text-[12px] font-bold tabular-nums">
                                {fmtS(totalI_II)}
                            </td>
                        </tr>

                        {/* SEPARADOR */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{
                                    height: 2,
                                    padding: 0,
                                    border: 'none',
                                    background: '#94a3b8',
                                }}
                            />
                        </tr>

                        {/* ── CONCEPTOS AMARILLOS: se suman al Presupuestado de Obra ──
                            (plan_valorizado_compatibilidad.md sección 6-7) */}
                        {amarilloCalcs.map(renderConceptoRow)}

                        {amarillos.length > 0 && (
                            <tr className="bg-slate-100 font-bold text-slate-800">
                                <td
                                    colSpan={5}
                                    className="border border-slate-300 p-2.5 text-right text-[10px] tracking-wider uppercase"
                                >
                                    PRESUPUESTO SUB TOTAL
                                </td>
                                <td className="border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                    {fmtS(presupuestoSubTotal)}
                                </td>
                                <td className="border border-slate-300 bg-slate-200" />
                                {periodos.map((p) =>
                                    finTd(
                                        propDist(presupuestoSubTotal)[p.key] ?? 0,
                                        p.key,
                                        'bg-slate-50',
                                    ),
                                )}
                                <td className="sticky right-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                    {fmtS(presupuestoSubTotal)}
                                </td>
                            </tr>
                        )}

                        {/* ── CONCEPTOS ROJOS: % (o monto) sobre el Presupuesto Sub Total ── */}
                        {rojoCalcs.map(renderConceptoRow)}

                        {/* ── PRESUPUESTO TOTAL (intermedio, solo si hay un "rojo final" después) ── */}
                        {rojosFinales.length > 0 && (
                            <tr className="bg-slate-800 font-bold text-white">
                                <td
                                    colSpan={5}
                                    className="border border-slate-700 p-2.5 text-right text-[10px] tracking-widest uppercase"
                                >
                                    PRESUPUESTO TOTAL
                                </td>
                                <td className="border border-slate-700 bg-slate-900 p-2.5 text-right font-bold text-emerald-300 tabular-nums">
                                    {fmtS(presupuestoTotalIntermedio)}
                                </td>
                                <td className="border border-slate-700 bg-slate-900" />
                                {periodos.map((p) =>
                                    finTd(
                                        propDist(presupuestoTotalIntermedio)[p.key] ?? 0,
                                        p.key,
                                        'bg-slate-700 text-slate-200',
                                    ),
                                )}
                                <td className="sticky right-0 z-10 border border-slate-700 bg-slate-900 p-2.5 text-right font-bold text-white tabular-nums">
                                    {fmtS(presupuestoTotalIntermedio)}
                                </td>
                            </tr>
                        )}

                        {/* ── CONCEPTOS ROJO_FINAL (ej. Control Concurrente): sobre el intermedio ── */}
                        {rojoFinalCalcs.map(renderConceptoRow)}

                        <tr>
                            <td
                                colSpan={nCols}
                                className="border border-dashed border-slate-300 bg-white p-2"
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAdditionalConcepts((current) => [
                                            ...current,
                                            {
                                                id: crypto.randomUUID(),
                                                name: 'NUEVO CONCEPTO',
                                                tipo: 'porcentaje',
                                                valor: 0,
                                                categoria: 'rojo',
                                            },
                                        ])
                                    }
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 transition-colors hover:text-amber-700"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Agregar concepto de valorización
                                </button>
                            </td>
                        </tr>

                        {/* ── PRESUPUESTO TOTAL (final) ── */}
                        <tr className="bg-slate-900 text-[12px] font-bold text-white">
                            <td className="border border-slate-700 p-2" />
                            <td className="sticky left-0 z-10 border border-slate-700 bg-slate-900 p-3 text-left text-[11px] tracking-widest uppercase">
                                PRESUPUESTO TOTAL
                            </td>
                            <td className="border border-slate-700 p-2" />
                            <td className="border border-slate-700 p-2" />
                            <td className="border border-slate-700 p-2" />
                            <td className="border border-slate-700 p-3 text-right text-[12px] font-bold text-emerald-300 tabular-nums">
                                {fmtS(presupTotal)}
                            </td>
                            <td className="border border-slate-700 p-2" />
                            {periodos.map((p) => {
                                const v = distPresupuestoTotal[p.key] ?? 0;
                                return (
                                    <td
                                        key={p.key}
                                        className={`border border-slate-700 p-2.5 text-right font-bold tabular-nums ${v > 0 ? 'text-slate-200' : 'text-slate-600'} ${p.key === mesPicoKey && v > 0 ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
                                    >
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="sticky right-0 z-10 border-2 border-emerald-500 bg-slate-900 p-3 text-right text-[13px] font-bold text-emerald-300 tabular-nums">
                                {fmtS(presupTotal)}
                            </td>
                        </tr>

                        {/* ════════ BANDA DIVISORIA RESUMEN → VALORIZACIÓN ════════ */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{ padding: 0, border: 'none' }}
                            >
                                <div
                                    style={{
                                        background: '#0f172a',
                                        padding: '5px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        borderTop: '3px solid #334155',
                                        borderBottom: '3px solid #334155',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                        }}
                                    >
                                        ▼ VALORIZACIÓN Y AVANCE DE OBRA
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {/* ── VALORIZACIÓN MENSUAL (S/.) ── */}
                        <tr className="bg-[#0d2060] font-bold text-white">
                            <td
                                colSpan={6}
                                className="border border-[#1a3070] p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                Valorización Mensual (S/.)
                            </td>
                            <td className="border border-[#1a3070] bg-[#081840]" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className={`border border-[#1a3070] p-2.5 text-center tabular-nums ${p.key === mesPicoKey ? 'bg-amber-700' : ''}`}
                                >
                                    {(distPresupuestoTotal[p.key] ?? 0) > 0
                                        ? fmtN(distPresupuestoTotal[p.key])
                                        : '—'}
                                </td>
                            ))}
                            <td className="sticky right-0 border border-[#1a3070] bg-emerald-900 p-2.5 text-center font-bold text-emerald-200 tabular-nums">
                                {presupTotal > 0
                                    ? fmtN(presupTotal)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── % AVANCE MENSUAL ── */}
                        <tr className="bg-[#1a2030] text-[10px] text-slate-400">
                            <td
                                colSpan={6}
                                className="border border-[#2a3044] p-2 text-right tracking-wider uppercase"
                            >
                                % Avance Mensual
                            </td>
                            <td className="border border-[#2a3044]" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-[#2a3044] p-2 text-center tabular-nums"
                                >
                                    {(avanceMensualIntegrado[p.key] ?? 0) > 0
                                        ? `${avanceMensualIntegrado[p.key].toFixed(3)}%`
                                        : '—'}
                                </td>
                            ))}
                            <td className="sticky right-0 border border-[#2a3044] bg-[#111824] p-2 text-center">
                                —
                            </td>
                        </tr>

                        {/* ── DÍAS TRABAJADOS ── */}
                        {diasPorMes && (
                            <tr className="bg-[#141e38] text-[10px] text-slate-300">
                                <td
                                    colSpan={6}
                                    className="border border-[#1e2a4a] p-2 text-right font-semibold tracking-wider uppercase"
                                >
                                    Días Trabajados
                                </td>
                                <td className="border border-[#1e2a4a]" />
                                {periodos.map((p) => {
                                    const dias = diasPorMes[p.key] ?? 0;
                                    return (
                                        <td
                                            key={p.key}
                                            className="border border-[#1e2a4a] p-2 text-center font-mono tabular-nums"
                                        >
                                            {dias > 0 ? dias : '—'}
                                        </td>
                                    );
                                })}
                                <td className="sticky right-0 border border-[#1e2a4a] bg-[#0c1428] p-2 text-center">
                                    —
                                </td>
                            </tr>
                        )}

                        {/* ── VALORIZACIÓN ACUMULADA (S/.) ── */}
                        <tr className="bg-[#0a2e1a] font-bold text-white">
                            <td
                                colSpan={6}
                                className="border border-[#0e4025] p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                Valorización Acumulada (S/.)
                            </td>
                            <td className="border border-[#0e4025] bg-[#062010]" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-[#0e4025] p-2.5 text-center text-emerald-300 tabular-nums"
                                >
                                    {(valorizadoAcumulado[p.key] ?? 0) > 0
                                        ? fmtN(valorizadoAcumulado[p.key])
                                        : '—'}
                                </td>
                            ))}
                            <td className="sticky right-0 border border-[#0e4025] bg-[#062010] p-2.5 text-center text-emerald-200 tabular-nums">
                                {presupTotal > 0
                                    ? fmtN(presupTotal)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── % AVANCE ACUMULADO (CURVA S) ── */}
                        <tr className="bg-[#0a1e10] text-[10px] text-slate-400">
                            <td
                                colSpan={6}
                                className="border border-[#0e2a18] p-2 text-right tracking-wider uppercase"
                            >
                                % Avance Acumulado (Curva S)
                            </td>
                            <td className="border border-[#0e2a18]" />
                            {periodos.map((p) => {
                                const pct = avanceAcumuladoIntegrado[p.key] ?? 0;
                                return (
                                    <td
                                        key={p.key}
                                        className="border border-[#0e2a18] p-2 text-center tabular-nums"
                                    >
                                        {pct > 0 ? (
                                            <span className="font-bold text-emerald-400">
                                                {pct.toFixed(2)}%
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                );
                            })}
                            <td className="sticky right-0 border border-[#0e2a18] bg-[#062010] p-2 text-center">
                                {presupTotal > 0 ? (
                                    <span className="font-bold text-emerald-400">
                                        100.00%
                                    </span>
                                ) : (
                                    '—'
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default TablaValorizada;
