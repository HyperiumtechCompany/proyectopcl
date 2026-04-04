// components/ControlConcurrentePanel.tsx
import axios from 'axios';
import {
    Calculator,
    ChevronDown,
    ChevronRight,
    Loader2,
    Plus,
    Save,
    Trash2,
    Users,
} from 'lucide-react';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useConsolidado } from '../stores/consolidadoStore';
import type { GastoGeneralRow } from '../stores/gastosGeneralesStore';
import { useGastosGeneralesStore } from '../stores/gastosGeneralesStore';
import { PlazoDisplay } from './PlazoDisplay';

// ─── Props ───────────────────────────────────────────────────────────────────
interface ControlConcurrentePanelProps {
    loading: boolean;
    rows: GastoGeneralRow[];
    onSaveGastoGeneral: (data: any[]) => Promise<any>;
    projectId: number;
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const DEFAULT_PCT_CC = 2;

const ITEM_JEFE = '1.2';
const ITEM_PROFESIONAL = '1.3';
const ITEM_PASAJE = '5.1';
const ITEM_VIATICO = '5.2';
const ITEM_BOLSA = '5.3';
const ITEM_CAMIONETA = '6.1';

// ─── Plantilla por defecto ───────────────────────────────────────────────────
const DEFAULT_ROWS: GastoGeneralRow[] = [
    // 1) Personal
    {
        id: -1,
        tipo_fila: 'seccion',
        item_codigo: '1',
        partida: '1',
        descripcion: '1. Personal de control (**)',
        unidad: '',
        cantidad: 0,
        periodo: 0,
        participacion: 100,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -2,
        parent_id: -1,
        tipo_fila: 'detalle',
        item_codigo: '1.1',
        partida: '1.1',
        descripcion: 'Supervisor',
        unidad: 'Mes',
        cantidad: 1,
        participacion: 20,
        periodo: 6,
        precio_unitario: 10500,
        parcial: 0,
    },
    {
        id: -3,
        parent_id: -1,
        tipo_fila: 'detalle',
        item_codigo: '1.2',
        partida: '1.2',
        descripcion: 'Jefe de Comision',
        unidad: 'Mes',
        cantidad: 1,
        participacion: 40,
        periodo: 6,
        precio_unitario: 9800,
        parcial: 0,
    },
    {
        id: -4,
        parent_id: -1,
        tipo_fila: 'detalle',
        item_codigo: '1.3',
        partida: '1.3',
        descripcion: 'Profesional (integrantes de Comision)',
        unidad: 'Mes',
        cantidad: 1,
        participacion: 40,
        periodo: 6,
        precio_unitario: 9000,
        parcial: 0,
    },
    // 2) Equipamiento
    {
        id: -10,
        tipo_fila: 'seccion',
        item_codigo: '2',
        partida: '2',
        descripcion: '2. Equipamiento',
        unidad: '',
        cantidad: 0,
        periodo: 0,
        participacion: 100,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -11,
        parent_id: -10,
        tipo_fila: 'detalle',
        item_codigo: '2.1',
        partida: '2.1',
        descripcion: 'Seguridad industrial',
        unidad: 'Glb.',
        cantidad: 1,
        participacion: 100,
        periodo: 1,
        porcentaje: 0.5,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -12,
        parent_id: -10,
        tipo_fila: 'detalle',
        item_codigo: '2.2',
        partida: '2.2',
        descripcion: 'Equipos de telecomunicaciones',
        unidad: 'Glb.',
        cantidad: 1,
        participacion: 100,
        periodo: 1,
        porcentaje: 0.5,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -13,
        parent_id: -10,
        tipo_fila: 'detalle',
        item_codigo: '2.3',
        partida: '2.3',
        descripcion: 'Equipos de computo',
        unidad: 'Glb.',
        cantidad: 1,
        participacion: 100,
        periodo: 1,
        porcentaje: 5,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -14,
        parent_id: -10,
        tipo_fila: 'detalle',
        item_codigo: '2.4',
        partida: '2.4',
        descripcion: 'Equipos e instrumentos de medicion',
        unidad: 'Glb.',
        cantidad: 1,
        participacion: 100,
        periodo: 1,
        porcentaje: 1,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -15,
        parent_id: -10,
        tipo_fila: 'detalle',
        item_codigo: '2.5',
        partida: '2.5',
        descripcion: 'Software',
        unidad: 'Glb.',
        cantidad: 1,
        participacion: 100,
        periodo: 1,
        porcentaje: 3,
        precio_unitario: 0,
        parcial: 0,
    },
    // 3) Seguros
    {
        id: -20,
        tipo_fila: 'seccion',
        item_codigo: '3',
        partida: '3',
        descripcion: '3. Seguros',
        unidad: '',
        cantidad: 0,
        periodo: 0,
        participacion: 100,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -21,
        parent_id: -20,
        tipo_fila: 'detalle',
        item_codigo: '3.1',
        partida: '3.1',
        descripcion: 'Seguros SCTR',
        unidad: 'Mes',
        cantidad: 3,
        participacion: 100,
        periodo: 6,
        precio_unitario: 110,
        parcial: 0,
    },
    // 4) Servicios especializados
    {
        id: -30,
        tipo_fila: 'seccion',
        item_codigo: '4',
        partida: '4',
        descripcion: '4. Servicios especializados',
        unidad: '',
        cantidad: 0,
        periodo: 0,
        participacion: 100,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -31,
        parent_id: -30,
        tipo_fila: 'detalle',
        item_codigo: '4.1',
        partida: '4.1',
        descripcion: 'Servicios especializados',
        unidad: 'Und',
        cantidad: 1,
        participacion: 100,
        periodo: 1,
        precio_unitario: 18500,
        parcial: 0,
    },
    // 5) Pasajes, Viaticos y bolsa de viaje
    {
        id: -40,
        tipo_fila: 'seccion',
        item_codigo: '5',
        partida: '5',
        descripcion: '5. Pasajes, Viaticos y bolsa de viaje',
        unidad: '',
        cantidad: 0,
        periodo: 0,
        participacion: 100,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -41,
        parent_id: -40,
        tipo_fila: 'detalle',
        item_codigo: '5.1',
        partida: '5.1',
        descripcion: 'Pasajes',
        unidad: 'Pje',
        cantidad: 0,
        participacion: 100,
        periodo: 1,
        precio_unitario: 100,
        parcial: 0,
    },
    {
        id: -42,
        parent_id: -40,
        tipo_fila: 'detalle',
        item_codigo: '5.2',
        partida: '5.2',
        descripcion: 'Viaticos',
        unidad: 'Dia',
        cantidad: 0,
        participacion: 100,
        periodo: 1,
        precio_unitario: 100,
        parcial: 0,
    },
    {
        id: -43,
        parent_id: -40,
        tipo_fila: 'detalle',
        item_codigo: '5.3',
        partida: '5.3',
        descripcion: 'Bolsa de viaje',
        unidad: 'Viaje',
        cantidad: 0,
        participacion: 100,
        periodo: 1,
        precio_unitario: 120,
        parcial: 0,
    },
    // 6) Alquiler de vehiculos
    {
        id: -50,
        tipo_fila: 'seccion',
        item_codigo: '6',
        partida: '6',
        descripcion: '6. Alquiler de vehiculos',
        unidad: '',
        cantidad: 0,
        periodo: 0,
        participacion: 100,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -51,
        parent_id: -50,
        tipo_fila: 'detalle',
        item_codigo: '6.1',
        partida: '6.1',
        descripcion: 'Camioneta 4x4',
        unidad: 'Dia',
        cantidad: 0,
        participacion: 100,
        periodo: 1,
        precio_unitario: 270,
        parcial: 0,
    },
    // 7) Gastos administrativos
    {
        id: -60,
        tipo_fila: 'seccion',
        item_codigo: '7',
        partida: '7',
        descripcion: '7. Gastos administrativos',
        unidad: '',
        cantidad: 0,
        periodo: 0,
        participacion: 100,
        precio_unitario: 0,
        parcial: 0,
    },
    {
        id: -61,
        parent_id: -60,
        tipo_fila: 'detalle',
        item_codigo: '7.1',
        partida: '7.1',
        descripcion: 'Gastos admi. (15%) (***)',
        unidad: 'Glb.',
        cantidad: 1,
        participacion: 100,
        periodo: 1,
        porcentaje: 15,
        precio_unitario: 0,
        parcial: 0,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getSec = (r: GastoGeneralRow) =>
    (r.item_codigo ?? r.partida ?? '').split('.')[0];
const getItem = (r: GastoGeneralRow) => r.item_codigo ?? r.partida ?? '';

/**
 * toFactor: convierte un valor de participacion almacenado como %
 * (ej: 20 → 0.20, 100 → 1.0, 40 → 0.40)
 * La participacion SIEMPRE se almacena en rango 0-100.
 */
const toFactor = (v?: number) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n === 0) return 0;
    return n / 100;
};

/**
 * toPct: convierte un porcentaje (0-100) a factor decimal (ej: 15 → 0.15)
 * Usado para campos `porcentaje` en Secciones 2 y 7.
 */
const toPct = (v?: number) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n / 100 : 0;
};

const rowsEquivalent = (a: GastoGeneralRow[], b: GastoGeneralRow[]) => {
    if (a.length !== b.length) return false;
    return a.every((row, index) => {
        const next = b[index];
        return (
            row.id === next.id &&
            row.parent_id === next.parent_id &&
            row.tipo_fila === next.tipo_fila &&
            row.item_codigo === next.item_codigo &&
            row.partida === next.partida &&
            row.descripcion === next.descripcion &&
            row.unidad === next.unidad &&
            Number(row.cantidad ?? 0) === Number(next.cantidad ?? 0) &&
            Number(row.periodo ?? 0) === Number(next.periodo ?? 0) &&
            Number(row.participacion ?? 0) ===
                Number(next.participacion ?? 0) &&
            Number(row.porcentaje ?? 0) === Number(next.porcentaje ?? 0) &&
            Number(row.precio_unitario ?? 0) ===
                Number(next.precio_unitario ?? 0) &&
            Number(row.parcial ?? 0) === Number(next.parcial ?? 0)
        );
    });
};

const r2 = (n: number) => Math.round(n * 100) / 100;

const fmt = (n: number) =>
    new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
const fmtCur = (n: number) =>
    new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
    }).format(n);
/** Formatea un valor ya en fracción (0-1) como porcentaje: 0.025 → "2.50%" */
const fmtPct = (r: number) =>
    new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(r * 100) + '%';

// ─── Motor de calculo (puro) ──────────────────────────────────────────────────
export const recalculate = (source: GastoGeneralRow[]): GastoGeneralRow[] => {
    const rows = source.map((r) => ({ ...r }));
    const details = (sec: string) =>
        rows.filter((r) => r.tipo_fila !== 'seccion' && getSec(r) === sec);
    const secTotal = (sec: string) =>
        details(sec).reduce((s, r) => s + (Number(r.parcial) || 0), 0);

    // Seccion 1 — personal, calculo directo
    details('1').forEach((row) => {
        row.parcial = r2(
            (Number(row.cantidad) || 0) *
                (Number(row.periodo) || 0) *
                toFactor(row.participacion) *
                (Number(row.precio_unitario) || 0),
        );
    });

    const totalPersonal = secTotal('1');

    // Seccion 2 — equipamiento
    // Si la fila tiene `porcentaje` (> 0):
    //   precio_unitario = Total_Personal_Seccion1 × (porcentaje/100)  [auto-calculado]
    //   parcial         = Total_Personal_Seccion1 × (porcentaje/100)  [= precio_unitario]
    // Si NO tiene porcentaje (fila manual):
    //   parcial = cantidad × periodo × (participacion/100) × precio_unitario
    details('2').forEach((row) => {
        const pct = Number(row.porcentaje ?? 0);
        if (pct > 0) {
            // Auto-calcula precio_unitario como fracción del personal total
            row.precio_unitario = r2(totalPersonal * (pct / 100));
            // Aseguramos que parcial considere cantidad, periodo y participación (por defecto 1,1,100)
            row.parcial = r2(
                (Number(row.cantidad) || 0) *
                    (Number(row.periodo) || 0) *
                    toFactor(row.participacion) *
                    (Number(row.precio_unitario) || 0),
            );
        } else {
            // Fórmula estándar para filas sin porcentaje automático
            row.parcial = r2(
                (Number(row.cantidad) || 0) *
                    (Number(row.periodo) || 0) *
                    toFactor(row.participacion) *
                    (Number(row.precio_unitario) || 0),
            );
        }
    });

    // Secciones 3-6 — calculo directo
    ['3', '4', '5', '6'].forEach((sec) => {
        details(sec).forEach((row) => {
            row.parcial = r2(
                (Number(row.cantidad) || 0) *
                    (Number(row.periodo) || 0) *
                    toFactor(row.participacion) *
                    (Number(row.precio_unitario) || 0),
            );
        });
    });

    // Seccion 7 — gastos admin, precio = % de secciones 1-6
    const base16 = ['1', '2', '3', '4', '5', '6'].reduce(
        (a, s) => a + secTotal(s),
        0,
    );
    details('7').forEach((row) => {
        const pct7 = Number(row.porcentaje ?? 0);
        if (pct7 > 0) {
            // Auto-calcula precio_unitario como % de la suma secciones 1-6
            row.precio_unitario = r2(base16 * (pct7 / 100));
            // Aseguramos que parcial considere factores (por defecto 1,1,100)
            row.parcial = r2(
                (Number(row.cantidad) || 0) *
                    (Number(row.periodo) || 0) *
                    toFactor(row.participacion) *
                    (Number(row.precio_unitario) || 0),
            );
        } else {
            // Precio manual: fórmula estándar
            row.parcial = r2(
                (Number(row.cantidad) || 0) *
                    (Number(row.periodo) || 0) *
                    toFactor(row.participacion) *
                    (Number(row.precio_unitario) || 0),
            );
        }
    });

    // Totales de seccion
    rows.forEach((row) => {
        if (row.tipo_fila === 'seccion')
            row.parcial = r2(secTotal(getSec(row)));
    });

    return rows;
};

// ID temporal auto-decrementado (nunca colisiona con IDs positivos de BD)
let _tmpId = -2000;
const nextId = () => --_tmpId;

// ─── Componentes Auxiliares ───────────────────────────────────────────────────
const NumCell = React.memo(
    ({
        rowId,
        field,
        value,
        disabled,
        colorClass,
        title,
        onChange,
    }: {
        rowId: number | string;
        field: keyof GastoGeneralRow;
        value?: number | string;
        disabled?: boolean;
        colorClass?: string;
        title?: string;
        onChange: (
            rowId: number | string,
            field: keyof GastoGeneralRow,
            value: string | number,
        ) => void;
    }) => (
        <input
            type="number"
            step="any"
            disabled={disabled}
            title={title}
            value={value ?? ''}
            onChange={(e) => {
                const val = e.target.value;
                onChange(rowId, field, val === '' ? '' : val); // Mantenemos string mientras edita para evitar corte de decimales
            }}
            className={[
                'w-full rounded border-none bg-transparent p-1.5 text-right font-mono text-xs transition-all focus:outline-none',
                disabled
                    ? 'cursor-not-allowed text-slate-600'
                    : `focus:bg-slate-700/60 focus:ring-1 focus:ring-emerald-500/40 ${colorClass ?? 'text-slate-300'}`,
            ].join(' ')}
        />
    ),
);

// ─── Componente principal ─────────────────────────────────────────────────────
export function ControlConcurrentePanel({
    loading,
    rows: storeRows,
    onSaveGastoGeneral,
    projectId,
}: ControlConcurrentePanelProps) {
    const { setRows, setRowsCalculated, setDirty, isDirty } =
        useGastosGeneralesStore();
    const { consolidadoBase: consolidadoBaseLocal } = useConsolidado();

    const [consolidadoBaseSnapshot, setConsolidadoBaseSnapshot] = useState<
        number | null
    >(null);

    // Traemos costo directo y utilidad para una base de inversion completa
    const [extraBase, setExtraBase] = useState(0);

    // Estado local de filas (siempre editable, siempre calculado)
    const [localRows, setLocalRows] = useState<GastoGeneralRow[]>([]);
    const seeded = useRef(false);

    // Parametros del panel de visitas
    const [nVisitas, setNVisitas] = useState(3.1);
    const [duracionVisita, setDuracion] = useState(4);
    const [pctCCInput, setPctCCInput] = useState<number | string>(
        DEFAULT_PCT_CC,
    );

    // Expansion del arbol
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // ── Inicializacion: sembrar plantilla o cargar desde BD ───────────────────
    useEffect(() => {
        if (loading || seeded.current) return;
        seeded.current = true;
        const source = storeRows.length > 0 ? storeRows : DEFAULT_ROWS;
        const calculated = recalculate(source);
        setLocalRows(calculated);
        const exp: Record<string, boolean> = {};
        calculated.forEach((r) => {
            if (r.tipo_fila === 'seccion') exp[getSec(r)] = true;
        });
        setExpanded(exp);
        if (storeRows.length === 0) {
            setRows(calculated);
            setRowsCalculated(calculated);
        }
    }, [loading, storeRows]);

    // ── Si la BD carga datos despues (eg. fetch async) ────────────────────────
    useEffect(() => {
        if (!seeded.current || storeRows.length === 0) return;
        if (isDirty) return; // Evita sobreescribir la edicion local por actualizaciones en cadena del store
        const calculated = recalculate(storeRows);
        setLocalRows(calculated);
    }, [storeRows, isDirty]);

    // ── Derivadas de Personal para el panel de visitas ────────────────────────
    const nComisionados = useMemo(() => {
        const jefe = localRows.find((r) => getItem(r) === ITEM_JEFE);
        const prof = localRows.find((r) => getItem(r) === ITEM_PROFESIONAL);
        return (Number(jefe?.cantidad) || 0) + (Number(prof?.cantidad) || 0);
    }, [localRows]);

    const cantidadPasaje = r2(nVisitas * nComisionados);
    const totalDias = r2(duracionVisita * nComisionados * nVisitas);

    // ── Rellenar filas auto cuando cambian los parametros de visita ───────────
    const applyVisitParams = useCallback(
        (
            base: GastoGeneralRow[],
            cpasaje: number,
            tdias: number,
            nvis: number,
        ) => {
            const updated = base.map((row) => {
                const item = getItem(row);
                if (item === ITEM_PASAJE) return { ...row, cantidad: cpasaje };
                if (item === ITEM_VIATICO) return { ...row, cantidad: tdias };
                if (item === ITEM_BOLSA) return { ...row, cantidad: nvis };
                if (item === ITEM_CAMIONETA) return { ...row, cantidad: tdias };
                return row;
            });
            return recalculate(updated);
        },
        [],
    );

    useEffect(() => {
        if (localRows.length === 0) return;
        const calc = applyVisitParams(
            localRows,
            cantidadPasaje,
            totalDias,
            nVisitas,
        );
        if (rowsEquivalent(localRows, calc)) return;
        setLocalRows(calc);
    }, [nVisitas, duracionVisita, nComisionados]);

    // ── Mutar una celda por ID de fila ────────────────────────────────────────
    const handleCell = useCallback(
        (rowKey: number | string, field: keyof GastoGeneralRow, value: any) => {
            setLocalRows((prev) => {
                const updated = prev.map((r) => {
                    const keyMatch =
                        r.id === rowKey ||
                        (typeof rowKey === 'string' && getItem(r) === rowKey);
                    return keyMatch ? { ...r, [field]: value } : r;
                });
                return recalculate(updated);
            });
        },
        [],
    );

    // ── Agregar fila a una seccion especifica ─────────────────────────────────
    const handleAddRow = useCallback((secCode: string) => {
        setLocalRows((prev) => {
            const sectionRow = prev.find(
                (r) => r.tipo_fila === 'seccion' && getSec(r) === secCode,
            );
            const parentId = sectionRow?.id ?? null;
            const siblings = prev.filter(
                (r) => r.tipo_fila === 'detalle' && getSec(r) === secCode,
            );
            const nextNum =
                siblings.reduce((max, r) => {
                    const n = parseInt(r.partida?.split('.')[1] || '0', 10);
                    return n > max ? n : max;
                }, 0) + 1;
            const newRow: GastoGeneralRow = {
                id: Date.now(),
                parent_id: parentId,
                tipo_fila: 'detalle',
                partida: `${secCode}.${nextNum}`,
                descripcion: '',
                unidad: '',
                cantidad: 0,
                periodo: 0,
                participacion: 0,
                porcentaje: undefined,
                precio_unitario: 0,
                parcial: 0,
                item_codigo: '',
            };
            const sectionIdx = prev.findIndex(
                (r) => r.tipo_fila === 'seccion' && getSec(r) === secCode,
            );
            const lastIdx = prev.reduce((acc, r, i) => {
                if (r.tipo_fila === 'detalle' && getSec(r) === secCode)
                    return i;
                return acc;
            }, -1);
            const insertAt =
                lastIdx >= 0 ? lastIdx + 1 : Math.max(sectionIdx + 1, 0);
            const arr = [...prev];
            arr.splice(insertAt, 0, newRow);
            return recalculate(arr);
        });
    }, []);

    // ── Eliminar fila por ID ───────────────────────────────────────────────────
    const handleRemove = useCallback((rowKey: number | string) => {
        setLocalRows((prev) => {
            const filtered = prev.filter((r) => {
                const keyMatch =
                    r.id === rowKey ||
                    (typeof rowKey === 'string' && getItem(r) === rowKey);
                return !keyMatch;
            });
            return recalculate(filtered);
        });
    }, []);

    // ── Totales ───────────────────────────────────────────────────────────────
    const totalFilas = useMemo(
        () =>
            localRows.reduce(
                (acc, r) =>
                    r.tipo_fila === 'seccion'
                        ? acc
                        : acc + (Number(r.parcial) || 0),
                0,
            ),
        [localRows],
    );

    const consolidadoBase = consolidadoBaseSnapshot ?? consolidadoBaseLocal;
    const baseInversionTotal = consolidadoBase + extraBase;

    const pctCC = useMemo(() => toPct(Number(pctCCInput) || 0), [pctCCInput]);
    const valorCC = r2(baseInversionTotal * pctCC);
    const porcentajeReal =
        baseInversionTotal > 0 ? totalFilas / baseInversionTotal : 0;

    useEffect(() => {
        let mounted = true;
        axios
            .get(
                `/costos/proyectos/${projectId}/presupuesto/consolidado/snapshot`,
            )
            .then((res) => {
                if (!mounted) return;
                if (res.data?.success && res.data?.data) {
                    const data = res.data.data;
                    // Base completa: GGs + Supervision + Costo Directo + Utilidad (si vienen)
                    const baseGG =
                        Number(data.total_gg_fijos || 0) +
                        Number(data.total_gg_variables || 0) +
                        Number(data.total_supervision || 0);

                    const cd = Number(data.total_costo_directo || 0);
                    const ut = Number(data.total_utilidad || 0);

                    if (Number.isFinite(baseGG) && baseGG > 0) {
                        setConsolidadoBaseSnapshot(baseGG);
                    }
                    if (cd > 0 || ut > 0) {
                        setExtraBase(cd + ut);
                    }
                }
            })
            .catch(() => {
                // fallback to local consolidado
            });
        return () => {
            mounted = false;
        };
    }, [projectId]);

    // ── Guardar ───────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!isDirty) return;
        const payload = localRows.map((row) => ({
            id: row.id,
            parent_id: row.parent_id ?? null,
            tipo_fila: row.tipo_fila ?? 'detalle',
            item_codigo: row.item_codigo ?? row.partida,
            descripcion: row.descripcion,
            unidad: row.unidad,
            // participacion se almacena en BD como porcentaje (0-100)
            participacion: Number(row.participacion) || 0,
            cantidad_descripcion: Number(row.cantidad) || 0,
            cantidad_tiempo: Number(row.periodo) || 0,
            precio_unitario: Number(row.precio_unitario) || 0,
            porcentaje:
                String(row.porcentaje) === '' || row.porcentaje == null
                    ? null
                    : Number(row.porcentaje),
        }));
        await onSaveGastoGeneral(payload);
        setDirty(false);
    };

    // ─────────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-900/50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                    <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
                        Cargando control concurrente...
                    </span>
                </div>
            </div>
        );
    }

    // ── Flags de celdas auto-calculadas ──────────────────────────────────────
    const isAutoPrice = (row: GastoGeneralRow) =>
        (getSec(row) === '2' || getSec(row) === '7') &&
        Number(row.porcentaje ?? 0) > 0;

    const isAutoQty = (row: GastoGeneralRow) =>
        [ITEM_PASAJE, ITEM_VIATICO, ITEM_BOLSA, ITEM_CAMIONETA].includes(
            getItem(row),
        );

    // Agrupar secciones con sus hijos para render
    const sections = localRows
        .filter((r) => r.tipo_fila === 'seccion')
        .map((sec) => ({
            sec,
            secCode: getSec(sec),
            children: localRows.filter(
                (r) => r.tipo_fila === 'detalle' && getSec(r) === getSec(sec),
            ),
        }));

    return (
        <div className="flex h-full flex-col bg-slate-900">
            {/* ── Cabecera ── */}
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/80 px-4 py-3 backdrop-blur-sm">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-200 uppercase">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        Control Concurrente
                    </h2>
                    <p className="mt-0.5 text-[10px] font-medium tracking-tight text-slate-500 uppercase">
                        Gastos de control y supervision de obra
                    </p>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                        Total CC
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                        {fmtCur(totalFilas)}
                    </span>
                </div>
            </div>

            {/* ── Plazo del proyecto ── */}
            <div className="border-b border-slate-700 bg-slate-800/30 px-4 py-2">
                <PlazoDisplay variant="compact" color="emerald" />
            </div>

            {/* ── Panel resumen porcentaje dinámico ── */}
            <div className="border-b border-slate-700 bg-slate-800/40 px-4 py-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-800/60 px-4 py-2 text-xs">
                    {/* Primera línea - Cálculo automático */}
                    <label className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Calculo automatico
                        </span>
                        <input
                            type="number"
                            min={0}
                            step="any"
                            value={pctCCInput}
                            onChange={(e) =>
                                setPctCCInput(
                                    e.target.value === '' ? '' : e.target.value,
                                )
                            }
                            className="w-16 rounded border border-slate-600 bg-slate-700/60 px-1.5 py-1 text-right font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            %
                        </span>
                    </label>
                    <span className="whitespace-nowrap">
                        <span className="text-slate-500">Consolidado: </span>
                        <span className="font-mono font-semibold text-slate-300">
                            {fmt(consolidadoBase)}
                        </span>
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="text-slate-500">Financiado: </span>
                        <span className="font-mono font-semibold text-emerald-400">
                            {fmt(valorCC)}
                        </span>
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="text-slate-500">Real: </span>
                        <span className="font-mono font-semibold text-emerald-300">
                            {fmt(totalFilas)}
                        </span>
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="text-slate-500">% Real: </span>
                        <span
                            className={`font-mono font-semibold ${porcentajeReal > pctCC ? 'text-red-400' : 'text-amber-400'}`}
                        >
                            {fmtPct(porcentajeReal)}
                        </span>
                    </span>

                    {/* Separador vertical */}
                    <div className="h-6 w-px bg-slate-700" />

                    {/* Título de visitas compacto */}
                    <div className="flex items-center gap-1 whitespace-nowrap">
                        <Users className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Visitas
                        </span>
                    </div>

                    {/* N° de visitas */}
                    <label className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            Visitas
                        </span>
                        <input
                            type="number"
                            min={0}
                            step="any"
                            value={nVisitas || ''}
                            placeholder="0"
                            onChange={(e) =>
                                setNVisitas(parseFloat(e.target.value) || 0)
                            }
                            className="w-16 rounded border border-slate-600 bg-slate-700/60 px-1.5 py-1 text-right font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                    </label>

                    {/* Duración de visita */}
                    <label className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            Duración
                        </span>
                        <input
                            type="number"
                            min={0}
                            step="any"
                            value={duracionVisita || ''}
                            placeholder="0"
                            onChange={(e) =>
                                setDuracion(parseFloat(e.target.value) || 0)
                            }
                            className="w-16 rounded border border-slate-600 bg-slate-700/60 px-1.5 py-1 text-right font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                    </label>

                    {/* Valores derivados */}
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 rounded bg-slate-700/50 px-1.5 py-1">
                            <Calculator className="h-3 w-3 text-emerald-400" />
                            <span className="text-[10px] text-slate-500">
                                Com:
                            </span>
                            <span className="font-mono text-xs font-bold text-emerald-300">
                                {nComisionados}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 rounded bg-slate-700/50 px-1.5 py-1">
                            <Calculator className="h-3 w-3 text-amber-400" />
                            <span className="text-[10px] text-slate-500">
                                Pas:
                            </span>
                            <span className="font-mono text-xs font-bold text-amber-300">
                                {cantidadPasaje}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 rounded bg-slate-700/50 px-1.5 py-1">
                            <Calculator className="h-3 w-3 text-sky-400" />
                            <span className="text-[10px] text-slate-500">
                                Dias:
                            </span>
                            <span className="font-mono text-xs font-bold text-sky-300">
                                {totalDias}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tabla DataTree ── */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-800/95 text-[10px] font-bold tracking-wider text-slate-400 uppercase backdrop-blur-sm">
                        <tr>
                            <th className="border-b border-slate-700 p-2 pl-4">
                                Concepto / Gasto
                            </th>
                            <th className="w-16 border-b border-slate-700 p-2 text-center">
                                Und.
                            </th>
                            <th className="w-20 border-b border-slate-700 p-2 text-right">
                                Cant.
                            </th>
                            <th className="w-20 border-b border-slate-700 p-2 text-right">
                                Partic. %
                            </th>
                            <th className="w-20 border-b border-slate-700 p-2 text-right">
                                Periodo
                            </th>
                            <th className="w-14 border-b border-slate-700 p-2 text-right">
                                %
                            </th>
                            <th className="w-28 border-b border-slate-700 p-2 text-right">
                                P.Unit.
                            </th>
                            <th className="w-28 border-b border-slate-700 p-2 text-right">
                                Sub total
                            </th>
                            <th className="w-28 border-b border-slate-700 p-2 text-right">
                                Total S/.
                            </th>
                            <th className="w-8 border-b border-slate-700 p-2" />
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-800/40">
                        {sections.map(({ sec, secCode, children }) => {
                            const isExp = expanded[secCode] !== false;
                            return (
                                <React.Fragment
                                    key={
                                        sec.id ?? sec.item_codigo ?? sec.partida
                                    }
                                >
                                    {/* Fila seccion */}
                                    <tr className="bg-slate-800/70">
                                        <td
                                            className="cursor-pointer p-2 pl-3 select-none"
                                            colSpan={8}
                                            onClick={() =>
                                                setExpanded((p) => ({
                                                    ...p,
                                                    [secCode]: !p[secCode],
                                                }))
                                            }
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExp ? (
                                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                                ) : (
                                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                                )}
                                                <span className="text-[11px] font-bold tracking-widest text-emerald-300 uppercase">
                                                    {sec.descripcion}
                                                </span>
                                                <span className="text-[9px] text-slate-600">
                                                    ({children.length} items)
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-emerald-300">
                                            {fmt(Number(sec.parcial) || 0)}
                                        </td>
                                        <td />
                                    </tr>

                                    {/* Filas de detalle */}
                                    {isExp &&
                                        children.map((row) => {
                                            const autoP = isAutoPrice(row);
                                            const autoQ = isAutoQty(row);
                                            const rowKey =
                                                row.id ?? getItem(row);
                                            return (
                                                <tr
                                                    key={rowKey}
                                                    className="group transition-colors hover:bg-slate-800/40"
                                                >
                                                    {/* Descripcion */}
                                                    <td className="p-1 pl-10">
                                                        <input
                                                            type="text"
                                                            value={
                                                                row.descripcion ??
                                                                ''
                                                            }
                                                            placeholder="Descripcion..."
                                                            onChange={(e) =>
                                                                handleCell(
                                                                    rowKey,
                                                                    'descripcion',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="w-full rounded border-none bg-transparent px-2 py-1 text-xs text-slate-300 transition-all focus:bg-slate-700/60 focus:ring-1 focus:ring-emerald-500/40 focus:outline-none"
                                                        />
                                                    </td>

                                                    {/* Unidad */}
                                                    <td className="p-1">
                                                        <input
                                                            type="text"
                                                            value={
                                                                row.unidad ?? ''
                                                            }
                                                            onChange={(e) =>
                                                                handleCell(
                                                                    rowKey,
                                                                    'unidad',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="w-full rounded border-none bg-transparent px-1.5 py-1 text-center text-xs text-slate-400 transition-all focus:bg-slate-700/60 focus:ring-1 focus:ring-emerald-500/40 focus:outline-none"
                                                        />
                                                    </td>

                                                    {/* Cantidad */}
                                                    <td className="p-1">
                                                        <NumCell
                                                            rowId={rowKey}
                                                            field="cantidad"
                                                            value={row.cantidad}
                                                            disabled={autoQ}
                                                            title={
                                                                autoQ
                                                                    ? 'Calculado desde parametros de visitas'
                                                                    : undefined
                                                            }
                                                            colorClass="text-slate-200"
                                                            onChange={
                                                                handleCell
                                                            }
                                                        />
                                                    </td>

                                                    {/* Participacion */}
                                                    <td className="p-1">
                                                        <NumCell
                                                            rowId={rowKey}
                                                            field="participacion"
                                                            value={
                                                                row.participacion
                                                            }
                                                            title="Participación en % (0-100). Ej: 20 = 20%"
                                                            colorClass="text-slate-300"
                                                            onChange={
                                                                handleCell
                                                            }
                                                        />
                                                    </td>

                                                    {/* Periodo */}
                                                    <td className="p-1">
                                                        <NumCell
                                                            rowId={rowKey}
                                                            field="periodo"
                                                            value={row.periodo}
                                                            colorClass="text-slate-300"
                                                            onChange={
                                                                handleCell
                                                            }
                                                        />
                                                    </td>

                                                    {/* Porcentaje */}
                                                    <td className="p-1">
                                                        <NumCell
                                                            rowId={rowKey}
                                                            field="porcentaje"
                                                            value={
                                                                row.porcentaje
                                                            }
                                                            colorClass="text-amber-300/80"
                                                            onChange={
                                                                handleCell
                                                            }
                                                        />
                                                    </td>

                                                    {/* Precio unitario */}
                                                    <td className="p-1">
                                                        <NumCell
                                                            rowId={rowKey}
                                                            field="precio_unitario"
                                                            value={
                                                                row.precio_unitario
                                                            }
                                                            disabled={autoP}
                                                            title={
                                                                autoP
                                                                    ? 'Calculado automaticamente por porcentaje'
                                                                    : undefined
                                                            }
                                                            colorClass="text-emerald-400/90"
                                                            onChange={
                                                                handleCell
                                                            }
                                                        />
                                                    </td>

                                                    {/* Sub total */}
                                                    <td className="p-2 text-right font-mono font-semibold text-slate-200">
                                                        {fmt(
                                                            Number(
                                                                row.parcial,
                                                            ) || 0,
                                                        )}
                                                    </td>

                                                    {/* Total S/. (vacio en detalle) */}
                                                    <td className="p-2 text-right text-slate-700">
                                                        —
                                                    </td>

                                                    {/* Eliminar */}
                                                    <td className="p-1 text-center">
                                                        <button
                                                            onClick={() =>
                                                                handleRemove(
                                                                    rowKey,
                                                                )
                                                            }
                                                            title="Eliminar fila"
                                                            className="rounded p-1 text-slate-700 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-900/30 hover:text-red-400"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                    {/* Boton agregar en seccion */}
                                    {isExp && (
                                        <tr className="bg-slate-900/20">
                                            <td
                                                colSpan={10}
                                                className="py-1 pl-10"
                                            >
                                                <button
                                                    onClick={() =>
                                                        handleAddRow(secCode)
                                                    }
                                                    className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-all hover:bg-slate-700/40 hover:text-emerald-400"
                                                >
                                                    <Plus className="h-3 w-3" />
                                                    Anadir item a esta seccion
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {localRows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={10}
                                    className="p-12 text-center text-slate-500 italic"
                                >
                                    Sin datos. Cargando plantilla...
                                </td>
                            </tr>
                        )}
                    </tbody>

                    <tfoot className="sticky bottom-0 bg-slate-800/95 backdrop-blur-sm">
                        <tr className="border-t-2 border-slate-600">
                            <td
                                colSpan={8}
                                className="p-3 pl-4 text-right text-xs font-bold text-slate-200 uppercase"
                            >
                                Total Control Concurrente:
                            </td>
                            <td className="p-3 text-right font-mono text-base font-bold text-emerald-400">
                                {fmtCur(totalFilas)}
                            </td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between border-t border-slate-700 bg-slate-800/40 px-4 py-3 backdrop-blur-sm">
                <span className="text-[10px] text-slate-600 italic">
                    Usa el boton "+" dentro de cada seccion para agregar items
                </span>
                <div className="flex items-center gap-4">
                    {isDirty && (
                        <span className="flex animate-pulse items-center gap-1.5 text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Cambios pendientes
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!isDirty || loading}
                        className={[
                            'flex items-center gap-2 rounded-lg px-6 py-2 text-xs font-bold text-white shadow-lg transition-all',
                            isDirty && !loading
                                ? 'bg-emerald-600 shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95'
                                : 'cursor-not-allowed bg-slate-700 opacity-50',
                        ].join(' ')}
                    >
                        <Save className="h-4 w-4" />
                        {loading
                            ? 'Guardando...'
                            : 'Guardar Control Concurrente'}
                    </button>
                </div>
            </div>
        </div>
    );
}
