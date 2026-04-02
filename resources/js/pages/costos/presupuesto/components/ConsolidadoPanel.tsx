import axios from 'axios';
import {
    Calculator,
    FileText,
    ShieldCheck,
    Plus,
    Trash2,
    Loader2,
} from 'lucide-react';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useBudgetStore } from '../stores/budgetStore';
import { useGastosGeneralesStore } from '../stores/gastosGeneralesStore';
import { useGGFijosStore } from '../stores/ggFijosStore';
import { useGGVariablesStore } from '../stores/ggVariablesStore';
import { useSupervisionStore } from '../stores/supervisionStore';

interface ConsolidadoPanelProps {
    projectId: number;
}

interface ExtraComponent {
    id: string;
    name: string;
    monto: number;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const formatMoney = (val: number) =>
    new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

const formatPct = (ratio: number) =>
    new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(ratio * 100) + '%';

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value !== 'string') return 0;
    const cleaned = value.trim().replace(/[^\d.,-]/g, '');
    if (!cleaned) return 0;

    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    let normalized = cleaned;

    if (lastDot !== -1 && lastComma !== -1) {
        const decimalSep = lastDot > lastComma ? '.' : ',';
        const thousandSep = decimalSep === '.' ? ',' : '.';
        normalized = cleaned.split(thousandSep).join('');
        if (decimalSep === ',') normalized = normalized.replace(',', '.');
    } else if (lastComma !== -1 && lastDot === -1) {
        const parts = cleaned.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            normalized = parts[0].replace(/\./g, '') + '.' + parts[1];
        } else {
            normalized = cleaned.replace(/,/g, '');
        }
    } else {
        normalized = cleaned.replace(/,/g, '');
    }

    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
};

const ratio = (numerator: number, denominator: number) =>
    denominator > 0 ? numerator / denominator : 0;

// ─── Number → Spanish words ───────────────────────────────────────────────────

const ONES = [
    '',
    'UN',
    'DOS',
    'TRES',
    'CUATRO',
    'CINCO',
    'SEIS',
    'SIETE',
    'OCHO',
    'NUEVE',
    'DIEZ',
    'ONCE',
    'DOCE',
    'TRECE',
    'CATORCE',
    'QUINCE',
    'DIECISEIS',
    'DIECISIETE',
    'DIECIOCHO',
    'DIECINUEVE',
    'VEINTE',
    'VEINTIUN',
    'VEINTIDOS',
    'VEINTITRES',
    'VEINTICUATRO',
    'VEINTICINCO',
    'VEINTISEIS',
    'VEINTISIETE',
    'VEINTIOCHO',
    'VEINTINUEVE',
];
const TENS = [
    '',
    '',
    'VEINTE',
    'TREINTA',
    'CUARENTA',
    'CINCUENTA',
    'SESENTA',
    'SETENTA',
    'OCHENTA',
    'NOVENTA',
];
const HUNDREDS = [
    '',
    'CIENTO',
    'DOSCIENTOS',
    'TRESCIENTOS',
    'CUATROCIENTOS',
    'QUINIENTOS',
    'SEISCIENTOS',
    'SETECIENTOS',
    'OCHOCIENTOS',
    'NOVECIENTOS',
];

function chunk(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    if (n < 30) return ONES[n];
    if (n < 100) {
        const t = Math.floor(n / 10);
        const o = n % 10;
        return TENS[t] + (o ? ' Y ' + ONES[o] : '');
    }
    const h = Math.floor(n / 100);
    const rem = n % 100;
    return HUNDREDS[h] + (rem ? ' ' + chunk(rem) : '');
}

function numberToWordsES(n: number): string {
    if (n === 0) return 'CERO';
    let result = '';
    let rem = Math.floor(Math.abs(n));
    if (rem >= 1_000_000) {
        const m = Math.floor(rem / 1_000_000);
        result += (m === 1 ? 'UN MILLON' : chunk(m) + ' MILLONES') + ' ';
        rem %= 1_000_000;
    }
    if (rem >= 1_000) {
        const k = Math.floor(rem / 1_000);
        result += (k === 1 ? 'MIL' : chunk(k) + ' MIL') + ' ';
        rem %= 1_000;
    }
    if (rem > 0) result += chunk(rem);
    return result.trim();
}

function amountToWords(amount: number): string {
    const intPart = Math.floor(amount);
    const decPart = Math.round((amount - intPart) * 100);
    return `SON: ${numberToWordsES(intPart)} CON ${String(decPart).padStart(2, '0')}/100 SOLES`;
}

// ─── Roman numerals ───────────────────────────────────────────────────────────

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// ─── Component ────────────────────────────────────────────────────────────────

export function ConsolidadoPanel({ projectId }: ConsolidadoPanelProps) {
    // ── Stores ────────────────────────────────────────────────────────────────
    // Suscribirse al estado completo de cada store para detectar cambios dinámicos
    const budgetRows = useBudgetStore((s) => s.rows);
    const budgetInitialize = useBudgetStore((s) => s.initialize);
    const ggFijosNodes = useGGFijosStore((s) => s.nodes);
    const ggFijosSetNodes = useGGFijosStore((s) => s.setNodes);
    const ggVariablesNodes = useGGVariablesStore((s) => s.nodes);
    const ggVariablesSetNodes = useGGVariablesStore((s) => s.setNodes);
    const supervisionRows = useSupervisionStore((s) => s.rows);
    const supervisionLoadFromDatabase = useSupervisionStore(
        (s) => s.loadFromDatabase,
    );

    // Control Concurrente store
    const ccSetRows = useGastosGeneralesStore((s) => s.setRows);

    // ── Estado de carga ───────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);

    // ── Cargar datos al montar el componente ─────────────────────────────────
    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                // Cargar presupuesto general
                try {
                    const budgetRes = await axios.get(
                        `/costos/proyectos/${projectId}/presupuesto/general/data`,
                    );
                    if (budgetRes.data?.success && budgetRes.data.rows) {
                        budgetInitialize(budgetRes.data.rows);
                    }
                } catch (e) {
                    console.error('Error loading budget:', e);
                }

                // Cargar GG Fijos
                try {
                    const ggFijosRes = await axios.get(
                        `/costos/proyectos/${projectId}/presupuesto/gastos_fijos/data`,
                    );
                    if (ggFijosRes.data?.success && ggFijosRes.data.rows) {
                        ggFijosSetNodes(ggFijosRes.data.rows);
                    }
                } catch (e) {
                    console.error('Error loading GG Fijos:', e);
                }

                // Cargar GG Variables
                try {
                    const ggVarsRes = await axios.get(
                        `/costos/proyectos/${projectId}/presupuesto/gastos_generales/data`,
                    );
                    if (ggVarsRes.data?.success && ggVarsRes.data.rows) {
                        ggVariablesSetNodes(ggVarsRes.data.rows);
                    }
                } catch (e) {
                    console.error('Error loading GG Variables:', e);
                }

                // Cargar Supervisión
                try {
                    await supervisionLoadFromDatabase(projectId);
                } catch (e) {
                    console.error('Error loading supervision:', e);
                }

                // Cargar Control Concurrente
                try {
                    const ccRes = await axios.get(
                        `/costos/proyectos/${projectId}/presupuesto/control_concurrente/data`,
                    );
                    if (ccRes.data?.success && ccRes.data.rows) {
                        ccSetRows(ccRes.data.rows);
                    }
                } catch (e) {
                    console.error('Error loading Control Concurrente:', e);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [
        projectId,
        budgetInitialize,
        ggFijosSetNodes,
        ggVariablesSetNodes,
        supervisionLoadFromDatabase,
        ccSetRows,
    ]);

    // ── Calcular totales dinámicamente desde el estado ────────────────────────
    // Calcular costo directo desde budgetRows
    const parentBudgetSections = useMemo(
        () =>
            budgetRows.filter((r) =>
                typeof r._level === 'number' ? r._level === 0 : !r._parentId,
            ),
        [budgetRows],
    );
    const costoDirecto = useMemo(
        () =>
            parentBudgetSections.reduce(
                (acc, r) => acc + toNumber(r.parcial),
                0,
            ),
        [parentBudgetSections],
    );

    // Calcular GG Fijos desde los nodos del store
    const ggFijosTotal = useMemo(() => {
        return ggFijosNodes
            .filter((n) => n.tipo_fila === 'detalle')
            .reduce((acc, n) => acc + (Number(n.parcial) || 0), 0);
    }, [ggFijosNodes]);

    // Calcular GG Variables desde los nodos del store
    const ggVariablesTotal = useMemo(() => {
        return ggVariablesNodes
            .filter((n) => n.tipo_fila === 'detalle')
            .reduce((acc, n) => acc + (Number(n.parcial) || 0), 0);
    }, [ggVariablesNodes]);

    // Calcular Supervision Total desde las filas del store
    // rows[3] es la Sección IV - Gastos Generales de Supervisión
    // rows[7] es la Sección VIII - Total Gastos de Supervisión y Liquidación
    const ggSupervisionTotal = useMemo(() => {
        return toNumber(supervisionRows[3]?.total ?? 0);
    }, [supervisionRows]);

    const supervisionTotal = useMemo(() => {
        return toNumber(supervisionRows[7]?.total ?? 0);
    }, [supervisionRows]);

    // ── Local state ───────────────────────────────────────────────────────────
    const [porcentajeUtilidad, setPorcentajeUtilidad] = useState(5);
    const [componenteIIMonto, setComponenteIIMonto] = useState(0);
    const [extraComponents, setExtraComponents] = useState<ExtraComponent[]>(
        [],
    );
    const [snapshot, setSnapshot] = useState<any | null>(null);
    const snapshotSeeded = useRef(false);

    const fetchSnapshot = useCallback(async () => {
        try {
            const res = await axios.get(
                `/costos/proyectos/${projectId}/presupuesto/consolidado/snapshot`,
            );
            if (res.data?.success && res.data?.data) {
                setSnapshot(res.data.data);
            }
        } finally {
            // no-op
        }
    }, [projectId]);

    useEffect(() => {
        void fetchSnapshot();
    }, [fetchSnapshot]);

    useEffect(() => {
        if (!snapshot || snapshotSeeded.current) return;
        const utilidad = Number(snapshot.utilidad_porcentaje);
        const compII = Number(snapshot.componente_ii_monto);
        const extrasRaw = snapshot.componentes_extra_json ?? '[]';
        const extras =
            typeof extrasRaw === 'string' ? JSON.parse(extrasRaw) : extrasRaw;

        if (Number.isFinite(utilidad) && utilidad > 0) {
            setPorcentajeUtilidad(utilidad);
        }
        if (Number.isFinite(compII)) {
            setComponenteIIMonto(compII);
        }
        if (Array.isArray(extras)) {
            setExtraComponents(
                extras.map((c: any) => ({
                    id: c.id ?? crypto.randomUUID(),
                    name: c.name ?? 'NUEVO COMPONENTE',
                    monto: Number(c.monto) || 0,
                })),
            );
        }
        snapshotSeeded.current = true;
    }, [snapshot]);

    // ── Calculations: Componente I (Ejecución de Obra) ───────────────────────
    const totalGastosGenerales = ggFijosTotal + ggVariablesTotal;
    const utilidadTotal = costoDirecto * (porcentajeUtilidad / 100);
    const subTotalPresupuesto =
        costoDirecto + totalGastosGenerales + utilidadTotal;
    const igvComponenteI = subTotalPresupuesto * 0.18;
    const subTotalComponenteI = subTotalPresupuesto + igvComponenteI;

    // ── Calculations: Componente II ───────────────────────────────────────────
    const componenteIIMontoNum = toNumber(componenteIIMonto);
    const igvComponenteII = componenteIIMontoNum * 0.18;
    const subTotalComponenteII = componenteIIMontoNum + igvComponenteII;

    // ── Calculations: Extra Components ────────────────────────────────────────
    const extraCalcs = extraComponents.map((c) => {
        const monto = toNumber(c.monto);
        return {
            ...c,
            monto,
            igv: monto * 0.18,
            subtotal: monto * 1.18,
        };
    });

    // ── Grand totals ──────────────────────────────────────────────────────────
    const totalComponents =
        subTotalComponenteI +
        subTotalComponenteII +
        extraCalcs.reduce((acc, c) => acc + c.subtotal, 0);

    // Total Consolidado (sin Control Concurrente)
    const totalConsolidado = totalComponents + supervisionTotal;

    // Control Concurrente financiado por la entidad (hasta 2.0%)
    const controlConcurrenteFinanciado = totalConsolidado * 0.02;

    // Total de Inversión para la Obra = Total Consolidado + Control Concurrente
    const totalInversionObra =
        totalConsolidado + controlConcurrenteFinanciado;

    const totalConsolidadoDisplay = snapshot
        ? Number(snapshot.total_presupuesto_obra || 0) +
          Number(snapshot.total_supervision || 0)
        : totalConsolidado;
    const controlConcurrenteFinanciadoDisplay = snapshot
        ? totalConsolidadoDisplay * 0.02
        : controlConcurrenteFinanciado;
    const totalInversionDisplay = snapshot?.total_inversion_obra
        ? Number(snapshot.total_inversion_obra)
        : totalInversionObra;
    const totalConsolidadoLetras =
        snapshot?.total_letras ?? amountToWords(totalConsolidadoDisplay);
    const totalInversionLetras =
        snapshot?.total_inversion_obra_letras ??
        amountToWords(totalInversionDisplay);

    useEffect(() => {
        if (!snapshotSeeded.current) return;
        const timer = setTimeout(async () => {
            try {
                const res = await axios.patch(
                    `/costos/proyectos/${projectId}/presupuesto/consolidado/snapshot`,
                    {
                        utilidad_porcentaje: porcentajeUtilidad,
                        igv_porcentaje: 18,
                        componente_ii_monto: componenteIIMonto,
                        componentes_extra: extraComponents.map((c) => ({
                            id: c.id,
                            name: c.name,
                            monto: Number(c.monto) || 0,
                        })),
                    },
                );
                if (res.data?.success && res.data?.data) {
                    setSnapshot(res.data.data);
                }
            } catch {
                // ignore
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [porcentajeUtilidad, componenteIIMonto, extraComponents, projectId]);

    // ── Percentages ───────────────────────────────────────────────────────────
    const pctGG = ratio(totalGastosGenerales, costoDirecto);
    const pctUtil = ratio(utilidadTotal, costoDirecto);
    const pctIgvI = ratio(igvComponenteI, subTotalPresupuesto);
    const pctIgvII = ratio(igvComponenteII, componenteIIMontoNum);
    const pctSupervision = ratio(supervisionTotal, totalComponents);

    const snapshotDepsKey = useMemo(
        () =>
            [
                costoDirecto,
                ggFijosTotal,
                ggVariablesTotal,
                supervisionTotal,
                totalComponents,
            ].join('|'),
        [costoDirecto, ggFijosTotal, ggVariablesTotal, supervisionTotal, totalComponents],
    );

    useEffect(() => {
        if (!snapshotSeeded.current) return;
        const timer = setTimeout(() => {
            void fetchSnapshot();
        }, 1000);
        return () => clearTimeout(timer);
    }, [snapshotDepsKey, fetchSnapshot]);

    // ── Extra component helpers ───────────────────────────────────────────────
    const addExtraComponent = () => {
        setExtraComponents((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: 'NUEVO COMPONENTE', monto: 0 },
        ]);
    };
    const removeExtraComponent = (id: string) =>
        setExtraComponents((prev) => prev.filter((c) => c.id !== id));
    const updateExtra = (
        id: string,
        field: 'name' | 'monto',
        value: string | number,
    ) =>
        setExtraComponents((prev) =>
            prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
        );

    // Label for "TOTAL PRESUPUESTO DE OBRA COMPONENTE I + II + ..."
    const romanList = ROMAN.slice(0, 2 + extraComponents.length).join(' + ');

    // ── Shared CSS shortcuts ──────────────────────────────────────────────────
    const TH =
        'border-r border-slate-200 dark:border-slate-700 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';
    const TD = 'border-r border-slate-200 dark:border-slate-700';
    const moneyInput =
        'w-full rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-0.5 ' +
        'text-right text-[11px] text-slate-700 dark:text-slate-300 ' +
        'focus:outline-none focus:ring-1 focus:ring-amber-400 dark:focus:ring-amber-500';

    // ── Component row builder for reuse ───────────────────────────────────────
    const ComponentBlock = ({
        romanIdx,
        label,
        montoInput,
        monto,
        igv,
        subtotal,
        pctIgv,
        nameEditable,
        onNameChange,
        onMontoChange,
        onRemove,
    }: {
        romanIdx: number;
        label: string;
        montoInput?: boolean;
        monto: number;
        igv: number;
        subtotal: number;
        pctIgv: number;
        nameEditable?: boolean;
        onNameChange?: (v: string) => void;
        onMontoChange: (v: number) => void;
        onRemove?: () => void;
    }) => (
        <>
            {/* Section header */}
            <tr className="bg-slate-50 dark:bg-slate-800/50">
                <td colSpan={4} className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase dark:text-slate-400">
                            COMPONENTE {ROMAN[romanIdx]}:
                        </span>
                        {nameEditable ? (
                            <input
                                type="text"
                                className="flex-1 border-b border-dashed border-slate-300 bg-transparent text-[10px] font-black tracking-widest text-slate-500 uppercase focus:outline-none dark:border-slate-600 dark:text-slate-400"
                                value={label}
                                onChange={(e) => onNameChange?.(e.target.value)}
                                placeholder="NOMBRE DEL COMPONENTE"
                            />
                        ) : (
                            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase dark:text-slate-400">
                                {label}
                            </span>
                        )}
                        {onRemove && (
                            <button
                                onClick={onRemove}
                                className="ml-auto text-red-400 transition-colors hover:text-red-600 dark:text-red-500 dark:hover:text-red-300"
                                title="Eliminar componente"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </td>
            </tr>

            {/* Monto row */}
            <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/20">
                <td
                    className={`${TD} px-3 py-2 font-semibold text-slate-800 dark:text-slate-200`}
                >
                    Componente {ROMAN[romanIdx]}: {label}
                </td>
                <td
                    className={`${TD} px-2 py-2 text-center text-slate-600 dark:text-slate-400`}
                >
                    S/.
                </td>
                <td className={`${TD} px-3 py-2 text-right`}>
                    {montoInput ? (
                        <input
                            type="number"
                            className={moneyInput}
                            value={monto || ''}
                            placeholder="0.00"
                            min={0}
                            onChange={(e) =>
                                onMontoChange(Number(e.target.value) || 0)
                            }
                        />
                    ) : (
                        <span className="text-slate-800 dark:text-slate-200">
                            {formatMoney(monto)}
                        </span>
                    )}
                </td>
                <td className="px-3 py-2 text-right text-slate-400">—</td>
            </tr>

            {/* IGV row */}
            <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/20">
                <td
                    className={`${TD} px-3 py-2 pl-8 text-slate-600 dark:text-slate-400`}
                >
                    Impuesto General a las Ventas (18%)
                </td>
                <td
                    className={`${TD} px-2 py-2 text-center text-slate-600 dark:text-slate-400`}
                >
                    S/.
                </td>
                <td
                    className={`${TD} px-3 py-2 text-right text-slate-700 dark:text-slate-300`}
                >
                    {formatMoney(igv)}
                </td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                    {monto > 0 ? formatPct(pctIgv) : '—'}
                </td>
            </tr>

            {/* Sub Total row */}
            <tr className="bg-sky-50 dark:bg-sky-950/40">
                <td
                    className={`${TD} px-3 py-2.5 text-xs font-black tracking-wider text-sky-700 uppercase dark:text-sky-400`}
                >
                    Sub Total Presupuesto Componente {ROMAN[romanIdx]}
                </td>
                <td
                    className={`${TD} px-2 py-2.5 text-center text-xs font-black text-sky-700 dark:text-sky-400`}
                >
                    S/.
                </td>
                <td
                    className={`${TD} px-3 py-2.5 text-right font-black text-sky-800 dark:text-sky-300`}
                >
                    {formatMoney(subtotal)}
                </td>
                <td className="px-3 py-2.5 text-right text-sky-400">—</td>
            </tr>
        </>
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    // Mostrar indicador de carga mientras se cargan los datos
    if (loading) {
        return (
            <div className="flex h-full flex-col items-center justify-center bg-gray-50 dark:bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Cargando datos del consolidado...
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-gray-50 transition-colors dark:bg-slate-950">
            {/* ── Header ── */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-200 dark:bg-slate-800 dark:ring-slate-700">
                        <Calculator className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase dark:text-white">
                            Presupuesto Consolidado
                        </h1>
                        <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                            Estructura uniforme para presentación al cliente
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
                <div className="max-w-8xl mx-auto flex flex-col gap-6">
                    {/* ════════════════════════════════════════════════════════
                        1) Resumen de Análisis de Gastos Generales
                    ═════════════════════════════════════════════════════════ */}
                    <SectionCard title="Resumen de Análisis de Gastos Generales">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/60">
                                    <th className={`w-14 ${TH} text-left`}>
                                        Item
                                    </th>
                                    <th className={`${TH} text-left`}>
                                        Descripción
                                    </th>
                                    <th className={`w-14 ${TH} text-center`}>
                                        Und.
                                    </th>
                                    <th className={`w-20 ${TH} text-center`}>
                                        Cantidad
                                    </th>
                                    <th className={`w-32 ${TH} text-right`}>
                                        Precio Unitario S/.
                                    </th>
                                    <th className="w-32 px-3 py-2 text-right text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                        Valor Total S/.
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                                <GGRow
                                    label="Gastos Generales Fijos"
                                    roman="I"
                                    val={ggFijosTotal}
                                    TD={TD}
                                />
                                <GGRow
                                    label="Gastos Generales Variables"
                                    roman="II"
                                    val={ggVariablesTotal}
                                    TD={TD}
                                />
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-100 dark:bg-slate-800">
                                    <td
                                        colSpan={5}
                                        className="border-t border-slate-200 px-3 py-2 text-right text-xs font-bold tracking-wider text-slate-600 uppercase dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Total de Gastos Generales S/.
                                    </td>
                                    <td className="border-t border-slate-200 px-3 py-2 text-right font-black text-slate-900 dark:border-slate-700 dark:text-white">
                                        {formatMoney(totalGastosGenerales)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </SectionCard>

                    {/* ════════════════════════════════════════════════════════
                        2) Resumen de Análisis de Gastos de Supervisión
                    ═════════════════════════════════════════════════════════ */}
                    <SectionCard title="Resumen de Análisis de Gastos de Supervisión">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/60">
                                    <th className={`w-14 ${TH} text-left`}>
                                        Item
                                    </th>
                                    <th className={`${TH} text-left`}>
                                        Descripción
                                    </th>
                                    <th className={`w-14 ${TH} text-center`}>
                                        Und.
                                    </th>
                                    <th className={`w-20 ${TH} text-center`}>
                                        Cantidad
                                    </th>
                                    <th className={`w-32 ${TH} text-right`}>
                                        Precio Unitario S/.
                                    </th>
                                    <th className="w-32 px-3 py-2 text-right text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                        Valor Total S/.
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="font-mono text-slate-700 dark:text-slate-300">
                                <GGRow
                                    label="Gastos de Supervisión y Liquidación (VIII)"
                                    roman="I"
                                    val={supervisionTotal}
                                    TD={TD}
                                />
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-100 dark:bg-slate-800">
                                    <td
                                        colSpan={5}
                                        className="border-t border-slate-200 px-3 py-2 text-right text-xs font-bold tracking-wider text-slate-600 uppercase dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Total de Gastos de Supervisión S/.
                                    </td>
                                    <td className="border-t border-slate-200 px-3 py-2 text-right font-black text-slate-900 dark:border-slate-700 dark:text-white">
                                        {formatMoney(supervisionTotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </SectionCard>

                    {/* ════════════════════════════════════════════════════════
                        3) Detalle de Costo Directo (referencia interna)
                    ═════════════════════════════════════════════════════════ */}
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow dark:border-slate-800 dark:bg-slate-900/60">
                        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
                            <FileText
                                size={14}
                                className="text-sky-500 dark:text-sky-400"
                            />
                            <h2 className="text-[11px] font-bold tracking-widest text-slate-600 uppercase dark:text-slate-300">
                                Detalle de Costo Directo (referencia interna)
                            </h2>
                        </div>
                        <table className="w-full text-[10px]">
                            <thead className="bg-slate-200/60 dark:bg-slate-800/80">
                                <tr>
                                    <th className="w-14 px-3 py-2 text-left text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                                        Item
                                    </th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                                        Descripción
                                    </th>
                                    <th className="w-32 px-3 py-2 text-right text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                                        Monto (S/.)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                                {parentBudgetSections.map((r) => (
                                    <tr
                                        key={r.partida}
                                        className="hover:bg-slate-200/40 dark:hover:bg-slate-800/30"
                                    >
                                        <td className="px-3 py-2 font-semibold text-sky-600 dark:text-sky-400">
                                            {r.partida}
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.descripcion}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {formatMoney(
                                                Number(r.parcial) || 0,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-200/60 dark:bg-slate-800/60">
                                <tr>
                                    <td
                                        colSpan={2}
                                        className="px-3 py-2 text-right text-[10px] font-bold tracking-wider text-slate-500 uppercase"
                                    >
                                        Total Costo Directo
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                                        {formatMoney(costoDirecto)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* ════════════════════════════════════════════════════════
                        4) DESCRIPCION DEL COSTO  ← main table (improved)
                    ═════════════════════════════════════════════════════════ */}
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {/* Title bar */}
                        <div className="border-b-2 border-slate-300 bg-slate-100 px-4 py-2.5 text-center text-xs font-black tracking-widest text-slate-700 uppercase dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            DESCRIPCION DEL COSTO
                        </div>

                        <table className="w-full text-[11px]">
                            {/* Column headers */}
                            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/80">
                                <tr>
                                    <th className={`${TH} text-left`}>
                                        Descripción
                                    </th>
                                    <th className={`w-16 ${TH} text-center`}>
                                        Moneda
                                    </th>
                                    <th className={`w-40 ${TH} text-right`}>
                                        Monto
                                    </th>
                                    <th className="w-24 px-3 py-2 text-right text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                        %
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800/60">
                                {/* ── COMPONENTE I: EJECUCIÓN DE OBRA ── */}
                                <tr className="bg-slate-100 dark:bg-slate-800/70">
                                    <td
                                        colSpan={4}
                                        className="px-3 py-1.5 text-[10px] font-black tracking-widest text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        COMPONENTE I: EJECUCIÓN DE OBRA
                                    </td>
                                </tr>

                                {/* Costo Directo */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td
                                        className={`${TD} px-3 py-2 font-semibold text-slate-800 dark:text-slate-200`}
                                    >
                                        Costo Directo
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2 text-center text-slate-500 dark:text-slate-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2 text-right text-slate-800 dark:text-slate-200`}
                                    >
                                        {formatMoney(costoDirecto)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-400">
                                        —
                                    </td>
                                </tr>

                                {/* Gastos Generales */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td
                                        className={`${TD} px-3 py-2 font-semibold text-slate-800 dark:text-slate-200`}
                                    >
                                        Gastos Generales
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2 text-center text-slate-500 dark:text-slate-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2 text-right text-slate-800 dark:text-slate-200`}
                                    >
                                        {formatMoney(totalGastosGenerales)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                                        {costoDirecto > 0
                                            ? formatPct(pctGG)
                                            : '—'}
                                    </td>
                                </tr>

                                {/* Utilidad */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td className={`${TD} px-3 py-2`}>
                                        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                                            Utilidad
                                        </div>
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2 text-center text-slate-500 dark:text-slate-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2 text-right text-slate-800 dark:text-slate-200`}
                                    >
                                        {formatMoney(utilidadTotal)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.5}
                                                className="w-14 rounded border border-slate-300 bg-white px-1 py-0.5 text-right text-[10px] text-slate-700 focus:ring-1 focus:ring-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                value={porcentajeUtilidad}
                                                onChange={(e) =>
                                                    setPorcentajeUtilidad(
                                                        Number(
                                                            e.target.value,
                                                        ) || 0,
                                                    )
                                                }
                                            />
                                            <span className="text-[10px] text-slate-400">
                                                %
                                            </span>
                                        </label>
                                    </td>
                                </tr>

                                {/* Sub Total Presupuesto */}
                                <tr className="bg-slate-100 dark:bg-slate-800/60">
                                    <td
                                        className={`${TD} px-3 py-2 text-xs font-bold tracking-wide text-slate-700 uppercase dark:text-slate-300`}
                                    >
                                        Sub Total Presupuesto
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2 text-center font-bold text-slate-600 dark:text-slate-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2 text-right font-bold text-slate-900 dark:text-white`}
                                    >
                                        {formatMoney(subTotalPresupuesto)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-400">
                                        —
                                    </td>
                                </tr>

                                {/* IGV Componente I */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td
                                        className={`${TD} px-3 py-2 pl-7 text-slate-700 dark:text-slate-300`}
                                    >
                                        Impuesto General a las Ventas (18%)
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2 text-center text-slate-500 dark:text-slate-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2 text-right text-slate-700 dark:text-slate-300`}
                                    >
                                        {formatMoney(igvComponenteI)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                                        {formatPct(pctIgvI)}
                                    </td>
                                </tr>

                                {/* SUB TOTAL COMPONENTE I */}
                                <tr className="bg-sky-50 dark:bg-sky-950/50">
                                    <td
                                        className={`${TD} px-3 py-2.5 text-xs font-black tracking-wider text-sky-700 uppercase dark:text-sky-400`}
                                    >
                                        Sub Total Presupuesto Componente I
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2.5 text-center text-xs font-black text-sky-700 dark:text-sky-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2.5 text-right font-black text-sky-800 dark:text-sky-300`}
                                    >
                                        {formatMoney(subTotalComponenteI)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sky-500">
                                        —
                                    </td>
                                </tr>

                                {/* ── COMPONENTE II: MOBILIARIO Y EQUIPAMIENTO ── */}
                                <ComponentBlock
                                    romanIdx={1}
                                    label="MOBILIARIO Y EQUIPAMIENTO"
                                    montoInput
                                    monto={componenteIIMonto}
                                    igv={igvComponenteII}
                                    subtotal={subTotalComponenteII}
                                    pctIgv={pctIgvII}
                                    onMontoChange={setComponenteIIMonto}
                                />

                                {/* ── EXTRA COMPONENTS (III, IV, …) ── */}
                                {extraCalcs.map((comp, idx) => (
                                    <ComponentBlock
                                        key={comp.id}
                                        romanIdx={idx + 2} // III = index 2
                                        label={comp.name}
                                        montoInput
                                        monto={comp.monto}
                                        igv={comp.igv}
                                        subtotal={comp.subtotal}
                                        pctIgv={
                                            comp.monto > 0
                                                ? comp.igv / comp.monto
                                                : 0
                                        }
                                        nameEditable
                                        onNameChange={(v) =>
                                            updateExtra(comp.id, 'name', v)
                                        }
                                        onMontoChange={(v) =>
                                            updateExtra(comp.id, 'monto', v)
                                        }
                                        onRemove={() =>
                                            removeExtraComponent(comp.id)
                                        }
                                    />
                                ))}

                                {/* ── Add Component button row ── */}
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="border-t border-dashed border-slate-200 px-3 py-2 dark:border-slate-700"
                                    >
                                        <button
                                            onClick={addExtraComponent}
                                            className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                                        >
                                            <Plus size={13} />
                                            Agregar Componente
                                        </button>
                                    </td>
                                </tr>

                                {/* ── TOTAL PRESUPUESTO DE OBRA ── */}
                                <tr className="bg-slate-200 dark:bg-slate-700/70">
                                    <td
                                        className={`${TD} px-3 py-3 text-[11px] font-black tracking-wide text-slate-800 uppercase dark:text-slate-100`}
                                    >
                                        Total Presupuesto de Obra Componente{' '}
                                        {romanList}
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-3 text-center font-black text-slate-700 dark:text-slate-200`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-3 text-right font-black text-slate-900 dark:text-white`}
                                    >
                                        {formatMoney(totalComponents)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-500">
                                        —
                                    </td>
                                </tr>

                                {/* Gastos Supervisión y Liquidación */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td
                                        className={`${TD} px-3 py-2 font-semibold text-slate-800 dark:text-slate-200`}
                                    >
                                        Gastos de Supervisión y Liquidación
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2 text-center text-slate-500 dark:text-slate-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2 text-right text-slate-800 dark:text-slate-200`}
                                    >
                                        {formatMoney(supervisionTotal)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                                        {totalComponents > 0
                                            ? formatPct(pctSupervision)
                                            : '—'}
                                    </td>
                                </tr>

                                {/* ── TOTAL (Descripcion del costo) ── */}
                                <tr className="bg-emerald-50 dark:bg-emerald-950/40">
                                    <td
                                        className={`${TD} px-3 py-3.5 text-sm font-black tracking-widest text-emerald-800 uppercase dark:text-emerald-400`}
                                    >
                                        TOTAL
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-3.5 text-center text-sm font-black text-emerald-800 dark:text-emerald-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-3.5 text-right text-base font-black text-emerald-800 dark:text-emerald-300`}
                                    >
                                        {formatMoney(totalConsolidadoDisplay)}
                                    </td>
                                    <td className="px-3 py-3.5 text-right text-emerald-500">
                                        —
                                    </td>
                                </tr>

                                {/* ── Monto en letras (Total) ── */}
                                <tr className="bg-amber-50 dark:bg-amber-950/30">
                                    <td
                                        colSpan={4}
                                        className="px-4 py-3 text-center text-[11px] font-bold tracking-wide text-amber-800 uppercase italic dark:text-amber-400"
                                    >
                                        {totalConsolidadoLetras}
                                    </td>
                                </tr>

                                {/* ── Control Concurrente Financiado ── */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td
                                        className={`${TD} px-3 py-2 font-semibold text-slate-800 dark:text-slate-200`}
                                    >
                                        Control Concurrente Financiado por la entidad (hasta 2.0%)
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-2 text-center text-slate-500 dark:text-slate-400`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-2 text-right text-slate-800 dark:text-slate-200`}
                                    >
                                        {formatMoney(controlConcurrenteFinanciadoDisplay)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-500">
                                        —
                                    </td>
                                </tr>

                                {/* ── TOTAL DE INVERSION PARA LA OBRA ── */}
                                <tr className="bg-emerald-100 dark:bg-emerald-900/40">
                                    <td
                                        className={`${TD} px-3 py-3 text-sm font-black tracking-widest text-emerald-900 uppercase dark:text-emerald-300`}
                                    >
                                        TOTAL DE INVERSION PARA LA OBRA
                                    </td>
                                    <td
                                        className={`${TD} px-2 py-3 text-center text-sm font-black text-emerald-900 dark:text-emerald-300`}
                                    >
                                        S/.
                                    </td>
                                    <td
                                        className={`${TD} px-3 py-3 text-right text-base font-black text-emerald-900 dark:text-emerald-200`}
                                    >
                                        {formatMoney(totalInversionDisplay)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-emerald-600">
                                        —
                                    </td>
                                </tr>

                                {/* ── Monto en letras (Inversión) ── */}
                                <tr className="bg-amber-50 dark:bg-amber-950/30">
                                    <td
                                        colSpan={4}
                                        className="px-4 py-3 text-center text-[11px] font-bold tracking-wide text-amber-800 uppercase italic dark:text-amber-400"
                                    >
                                        {totalInversionLetras}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Footer note */}
                        <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/40">
                            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                            El total de supervisión se toma de la Sección VIII.
                            El IGV (18%) se calcula sobre el subtotal de cada
                            componente.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-center text-xs font-bold tracking-widest text-slate-700 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {title}
            </div>
            {children}
        </div>
    );
}

function GGRow({
    label,
    roman,
    val,
    TD,
}: {
    label: string;
    roman: string;
    val: number;
    TD: string;
}) {
    return (
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
            <td className={`${TD} w-14 px-3 py-2 text-center font-bold`}>
                {roman}
            </td>
            <td className={`${TD} px-3 py-2 font-semibold`}>{label}</td>
            <td className={`${TD} w-14 px-2 py-2 text-center`}>Glb.</td>
            <td className={`${TD} w-20 px-2 py-2 text-center`}>1.00</td>
            <td className={`${TD} w-32 px-3 py-2 text-right`}>
                {formatMoney(val)}
            </td>
            <td className="w-32 px-3 py-2 text-right">{formatMoney(val)}</td>
        </tr>
    );
}
