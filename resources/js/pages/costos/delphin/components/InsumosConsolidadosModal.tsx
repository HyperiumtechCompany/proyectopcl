import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Briefcase,
    Check,
    FileSpreadsheet,
    Layers,
    Maximize2,
    Minimize2,
    Package,
    Search,
    Users,
    Wrench,
    X,
} from 'lucide-react';

import Decimal from 'decimal.js';
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ACUComponenteRow, ACURowSummary } from '@/types/presupuestos';
import type { DelphinRow, InsumosScope } from '../types';
import { exportInsumosConsolidadosExcel } from '../helpers/exportDelphinExcel';
type InsumoType =
    | 'mano_de_obra'
    | 'materiales'
    | 'equipos'
    | 'subcontratos'
    | 'subpartidas';


interface Props {
    open: boolean;
    acuRows: ACURowSummary[];
    delphinRows: DelphinRow[];
    scope: InsumosScope;
    projectName: string;
    projectData?: any;
    onClose: () => void;
}

interface SpecialtyOption {
    id: number;
    partida: string;
    descripcion: string;
}

export interface RawInsumo {
    sourceKey: string;
    type: InsumoType;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio: number;
    precioPonderado: number;
    parcial: number;
    usos: number;
    reference: InsumoReference;
}

export interface InsumoReference {
    acuId: number;
    partida: string;
    acuDescripcion: string;
    insumoDescripcion: string;
    metrado: number;
    cantidadAcu: number;
    cantidadTotal: number;
}

export interface ConsolidatedInsumo {
    key: string;
    type: InsumoType;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio: number;
    precioPonderado: number;
    parcial: number;
    usos: number;
    sourceKeys: string[];
    variantes: string[];
    references: InsumoReference[];
}

export type InsumoSortKey =
    | 'descripcion'
    | 'codigo'
    | 'cantidad'
    | 'parcial'
    | 'usos';
type SortState = { key: InsumoSortKey; direction: 'asc' | 'desc' };

const INSUMO_TYPES: Array<{
    key: InsumoType;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
        { key: 'mano_de_obra', label: 'Mano de obra', icon: Users },
        { key: 'materiales', label: 'Materiales', icon: Package },
        { key: 'equipos', label: 'Equipos', icon: Wrench },
        { key: 'subcontratos', label: 'Sub contratos', icon: Briefcase },
        { key: 'subpartidas', label: 'Sub partidas', icon: Layers },
    ];

const fmt = (value: number, digits = 2) =>
    value.toLocaleString('es-PE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

const normalizeText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const normalizeKey = (value: string) =>
    normalizeText(value)
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, ' ');

const normalizedPartida = (value: string) =>
    value
        .split('.')
        .filter(Boolean)
        .map((part) => part.padStart(2, '0'))
        .join('.');

export function calculateInsumoUsage(
    presupuestoCantidad: number,
    acuCantidad: number,
    precio: number,
    costoFactor = 1,
): { cantidad: number; parcial: number } {
    const cantidad = presupuestoCantidad * acuCantidad;
    // Redondeo con decimal.js a 2 decimales (igual que decimalMul en usePresupuestoAcu.ts) —
    // evita arrastrar error de punto flotante en el monto de cada uso antes de consolidar.
    const parcial = new Decimal(cantidad).times(precio).times(costoFactor).toDecimalPlaces(2).toNumber();
    return { cantidad, parcial };
}

export function calculateReferencePrice(
    items: Array<{ cantidad: number; precio: number }>,
): number {
    const cantidad = items.reduce((sum, item) => sum + item.cantidad, 0);
    if (cantidad === 0) return items[0]?.precio ?? 0;

    return (
        items.reduce((sum, item) => sum + item.cantidad * item.precio, 0) /
        cantidad
    );
}


//cambio//
function itemPrecio(type: InsumoType, item: ACUComponenteRow): number {
    return type === 'equipos'
        ? Number(item.precio_hora ?? item.precio_unitario ?? 0)
        : Number(item.precio_unitario ?? item.precio_hora ?? 0);
}

function itemCostFactor(type: InsumoType, item: ACUComponenteRow): number {
    if (type === 'materiales')
        return Math.max(1, Number(item.factor_desperdicio ?? 1));
    return 1;
}

export function flattenInsumos(
    acuRows: ACURowSummary[],
    delphinRows: DelphinRow[],
): RawInsumo[] {
    const rows: RawInsumo[] = [];

    // Validar datos
    if (!delphinRows?.length || !acuRows?.length) {
        console.warn('flattenInsumos: Sin datos');
        return rows;
    }

    //  1. Obtener partidas del Excel con metrado > 0
    //    Y asegurarnos de que coincidan con las partidas de los ACU
    const partidasACU = new Set(
        acuRows.map(acu => normalizedPartida(acu.partida))
    );

    //  2. Construir mapa SOLO con partidas que existen en ACU
    const presupuestoCantidadByPartida = new Map<string, number>();
    // precio_unitario REAL ya guardado en la fila del presupuesto — es la misma
    // fuente que usa Costo Directo. Se usa como ancla del reparto (en vez del
    // costo_unitario_total del objeto ACU) porque el ACU puede recalcularse
    // localmente (rendimiento, horas/día al seleccionar la partida) sin que ese
    // nuevo precio se haya reenviado todavía al presupuesto — anclar aquí evita
    // que ese desfase rompa la reconciliación con Costo Directo.
    const presupuestoPrecioByPartida = new Map<string, number>();

    for (const row of delphinRows) {
        const partida = normalizedPartida(String(row.partida ?? ''));
        if (!partida) continue;

        //  SOLO procesar partidas que están en los ACU
        if (!partidasACU.has(partida)) continue;

        const metrado = Number(row.metrado ?? 0);
        const parcial = Number(row.parcial ?? 0);

        if (metrado > 0) {
            presupuestoCantidadByPartida.set(partida, metrado);
        } else if (parcial > 0 && !presupuestoCantidadByPartida.has(partida)) {
            presupuestoCantidadByPartida.set(partida, parcial);
        }

        const precioUnitario = Number(row.precio_unitario ?? 0);
        if (precioUnitario > 0) {
            presupuestoPrecioByPartida.set(partida, precioUnitario);
        }
    }


    if (presupuestoCantidadByPartida.size === 0) {
        console.warn('flattenInsumos: No se encontraron partidas con datos');
        return rows;
    }

    //  3. SOLO tipos que existen en el Excel
    const tiposValidos: InsumoType[] = ['mano_de_obra', 'materiales', 'equipos'];

    for (const acu of acuRows) {
        const partidaKey = normalizedPartida(acu.partida);
        const presupuestoCantidad = presupuestoCantidadByPartida.get(partidaKey) ?? 0;

        if (presupuestoCantidad === 0) continue;

        // Reparto proporcional: en vez de recalcular cada componente de forma
        // independiente (metrado × cantidad × precio), se reparte el monto YA FIJO
        // de esta partida entre sus componentes según el peso real de cada uno
        // dentro del ACU. Garantiza que la suma de Insumos Consolidados SIEMPRE
        // reconcilie con Costo Directo — dos sumas independientes con redondeo en
        // cascada nunca coinciden exactamente, pero una partición de un monto
        // fijo, sí.
        const baseAcuTotal = new Decimal(acu.costo_mano_obra ?? 0)
            .plus(acu.costo_materiales ?? 0)
            .plus(acu.costo_equipos ?? 0)
            .toDecimalPlaces(2)
            .toNumber();

        if (baseAcuTotal === 0) continue;

        // Ancla al precio_unitario REAL ya guardado en el presupuesto (misma
        // fuente que Costo Directo), no al costo_unitario_total del objeto ACU
        // — éste puede haberse recalculado localmente (rendimiento, horas/día al
        // seleccionar la partida) sin haberse reenviado todavía al presupuesto.
        // Se resta la porción de subcontratos/subpartidas (no rastreada aquí,
        // igual que antes) según la proporción que reporta el ACU, para no
        // inflar mano de obra/materiales/equipos con un costo que no es suyo.
        const costoUnitarioAcu = Number(
            acu.costo_unitario_total ??
                baseAcuTotal + Number(acu.costo_subcontratos ?? 0) + Number(acu.costo_subpartidas ?? 0),
        );
        const precioUnitarioReal = presupuestoPrecioByPartida.get(partidaKey) ?? costoUnitarioAcu;
        const trackedShare = costoUnitarioAcu > 0 ? Math.min(1, Math.max(0, baseAcuTotal / costoUnitarioAcu)) : 1;

        const partidaBaseParcial = new Decimal(presupuestoCantidad)
            .times(precioUnitarioReal)
            .times(trackedShare)
            .toDecimalPlaces(2)
            .toNumber();

        const pending: Array<{
            key: InsumoType;
            descripcion: string;
            codigo: string;
            unidad: string;
            acuCantidad: number;
            precio: number;
            esHerramientas: boolean;
            itemParcialEnAcu: number;
        }> = [];

        for (const { key } of INSUMO_TYPES) {
            if (!tiposValidos.includes(key)) continue;

            for (const item of acu[key] ?? []) {
                const descripcion = String(item.descripcion ?? '').trim();
                if (!descripcion) continue;

                const codigo = String(
                    item.cod_insumo ?? item.codigo ?? '',
                ).trim();
                const acuCantidad = Number(item.cantidad ?? 0);
                const precio = itemPrecio(key, item);
                const unidad = String(item.unidad ?? '').toLowerCase().trim() || '-';
                // Mismo criterio que isHerramientasRow (AcuPanel.tsx) y recalcAcuSubtotals
                // (PresupuestoController.php): "Herramientas Manuales" se identifica por
                // descripción, no por unidad — la unidad guardada no siempre empieza con "%".
                const esHerramientas = key === 'equipos' && descripcion.toLowerCase().includes('herramienta');

                if (acuCantidad === 0 || precio === 0) continue;

                const parcialAcu = esHerramientas
                    ? (acuCantidad / 100) * precio
                    : acuCantidad * precio;
                // Parcial propio del componente dentro del ACU (mismo criterio que
                // decimalMul/calculateAcuLocally) — es la base para el peso proporcional.
                const itemParcialEnAcu = esHerramientas
                    ? new Decimal(parcialAcu).toDecimalPlaces(2).toNumber()
                    : new Decimal(acuCantidad).times(precio).times(itemCostFactor(key, item)).toDecimalPlaces(2).toNumber();

                pending.push({ key, descripcion, codigo, unidad, acuCantidad, precio, esHerramientas, itemParcialEnAcu });
            }
        }

        if (pending.length === 0) continue;

        // Reparte el monto fijo entre los componentes; el ÚLTIMO recibe el residuo
        // exacto (partidaBaseParcial − acumulado) en vez de su parte redondeada,
        // así la suma total nunca queda unos centavos corta o pasada.
        let acumulado = new Decimal(0);
        pending.forEach((p, idx) => {
            const isLast = idx === pending.length - 1;
            const peso = p.itemParcialEnAcu / baseAcuTotal;
            const monto = isLast
                ? new Decimal(partidaBaseParcial).minus(acumulado).toDecimalPlaces(2).toNumber()
                : new Decimal(peso).times(partidaBaseParcial).toDecimalPlaces(2).toNumber();
            acumulado = acumulado.plus(monto);

            const cantidadFisica = p.esHerramientas ? monto : presupuestoCantidad * p.acuCantidad;

            const baseKey = [
                p.key,
                normalizeKey(p.descripcion),
                normalizeKey(p.unidad),
                p.codigo ? normalizeKey(p.codigo) : '',
            ].join('|');

            rows.push({
                sourceKey: baseKey,
                type: p.key,
                codigo: p.codigo,
                descripcion: p.descripcion,
                unidad: p.unidad,
                cantidad: cantidadFisica,
                precio: p.esHerramientas ? 0 : p.precio,
                // Acumula desde el monto repartido (no cantidad*precio crudo) para que
                // el precio de referencia consolidado (parcial/cantidad) siempre
                // reconcilie con "Monto": Cantidad × P.REF. = Monto, sin excepciones.
                precioPonderado: p.esHerramientas ? 0 : monto,
                parcial: monto,
                usos: 1,
                reference: {
                    acuId: acu.id,
                    partida: acu.partida,
                    acuDescripcion: acu.descripcion,
                    insumoDescripcion: p.descripcion,
                    metrado: presupuestoCantidad,
                    cantidadAcu: p.acuCantidad,
                    cantidadTotal: cantidadFisica,
                },
            });
        });
    }


    return rows;
}

export function consolidateInsumos(
    rawRows: RawInsumo[],
    aliases: Record<string, string>,
): ConsolidatedInsumo[] {
    const map = new Map<string, ConsolidatedInsumo>();

    for (const row of rawRows) {
        const displayName = aliases[row.sourceKey] ?? row.descripcion;
        const key = [
            row.type,
            normalizeKey(displayName),
            normalizeKey(row.unidad),
        ].join('|');
        const existing = map.get(key);

        if (existing) {
            existing.cantidad += row.cantidad;
            existing.parcial += row.parcial;
            existing.precioPonderado += row.precioPonderado;
            existing.usos += row.usos;
            existing.references.push(row.reference);
            if (row.codigo && !existing.codigo.includes(row.codigo)) {
                existing.codigo = existing.codigo
                    ? `${existing.codigo}, ${row.codigo}`
                    : row.codigo;
            }
            if (!existing.sourceKeys.includes(row.sourceKey)) {
                existing.sourceKeys.push(row.sourceKey);
            }
            if (!existing.variantes.includes(row.descripcion)) {
                existing.variantes.push(row.descripcion);
            }
        } else {
            map.set(key, {
                key,
                type: row.type,
                codigo: row.codigo,
                descripcion: displayName,
                unidad: row.unidad,
                cantidad: row.cantidad,
                precio: row.precio,
                precioPonderado: row.precioPonderado,
                parcial: row.parcial,
                usos: row.usos,
                sourceKeys: [row.sourceKey],
                variantes: [row.descripcion],
                references: [row.reference],
            });
        }
    }

    return Array.from(map.values())
        .map((row) => ({
            ...row,
            precio:
                row.cantidad !== 0
                    ? row.precioPonderado / row.cantidad
                    : row.precio,
        }))
        .sort((a, b) => b.parcial - a.parcial);
}

export function sortInsumos<T extends Pick<ConsolidatedInsumo, InsumoSortKey>>(
    rows: T[],
    sort: SortState,
): T[] {
    const direction = sort.direction === 'asc' ? 1 : -1;

    return [...rows].sort((first, second) => {
        const firstValue = first[sort.key];
        const secondValue = second[sort.key];

        if (typeof firstValue === 'string' && typeof secondValue === 'string') {
            return (
                firstValue.localeCompare(secondValue, 'es', {
                    numeric: true,
                    sensitivity: 'base',
                }) * direction
            );
        }

        return (Number(firstValue) - Number(secondValue)) * direction;
    });
}

export function sumInsumoTotals(totals: Array<{ total: number }>): number {
    return totals.reduce((sum, item) => sum + item.total, 0);
}

export function getSpecialtyAcus(
    acuRows: ACURowSummary[],
    delphinRows: DelphinRow[],
    parentId: number | null,
): ACURowSummary[] {
    if (parentId === null) return [];

    const descendantIds = new Set<number>([parentId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const row of delphinRows) {
            if (
                row.parent_id != null &&
                descendantIds.has(Number(row.parent_id)) &&
                !descendantIds.has(row.id)
            ) {
                descendantIds.add(row.id);
                changed = true;
            }
        }
    }

    const partidas = new Set(
        delphinRows
            .filter((row) => descendantIds.has(row.id))
            .map((row) => normalizedPartida(String(row.partida ?? ''))),
    );

    return acuRows.filter((acu) =>
        partidas.has(normalizedPartida(acu.partida)),
    );
}

function SortableHeader({
    label,
    sortKey,
    sort,
    align = 'left',
    onSort,
}: {
    label: string;
    sortKey: InsumoSortKey;
    sort: SortState;
    align?: 'left' | 'right' | 'center';
    onSort: (key: InsumoSortKey) => void;
}) {
    const active = sort.key === sortKey;
    const Icon = !active
        ? ArrowUpDown
        : sort.direction === 'asc'
            ? ArrowUp
            : ArrowDown;
    const alignment =
        align === 'right'
            ? 'justify-end text-right'
            : align === 'center'
                ? 'justify-center text-center'
                : 'justify-start text-left';

    return (
        <th className={`border-b border-slate-700 p-0 ${alignment}`}>
            <button
                type="button"
                className={`flex w-full items-center gap-1 p-2 transition-colors hover:bg-slate-700 hover:text-slate-100 ${active ? 'text-sky-300' : ''} ${alignment}`}
                onClick={() => onSort(sortKey)}
                title={`Ordenar por ${label.toLowerCase()}`}
            >
                <span>{label}</span>
                <Icon
                    size={11}
                    className={active ? 'opacity-100' : 'opacity-40'}
                />
            </button>
        </th>
    );
}

export function InsumosConsolidadosModal({
    open, acuRows, delphinRows, scope, projectName, projectData, onClose,
}: Props) {
    const [activeType, setActiveType] = useState<InsumoType>('mano_de_obra');
    const [search, setSearch] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const handleColumnFilterChange = (key: string, value: string) =>
        setColumnFilters((prev) => ({ ...prev, [key]: value }));
    const hasColumnFilters = Object.values(columnFilters).some((v) => v.trim() !== '');
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [mergeName, setMergeName] = useState('');
    const [aliases, setAliases] = useState<Record<string, string>>({});
    const [sort, setSort] = useState<SortState>({
        key: 'parcial',
        direction: 'desc',
    });
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<
        number | null
    >(null);
    const [referenceRow, setReferenceRow] = useState<ConsolidatedInsumo | null>(
        null,
    );
    const [isMaximized, setIsMaximized] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{
        pointerId: number;
        x: number;
        y: number;
        originX: number;
        originY: number;
    } | null>(null);

    const specialties = useMemo<SpecialtyOption[]>(() => {
        return delphinRows
            .filter((row) => row.parent_id == null)
            .map((row) => ({
                id: row.id,
                partida: row.partida,
                descripcion: row.descripcion,
            }));
    }, [delphinRows]);
    const activeSpecialtyId = selectedSpecialtyId ?? specialties[0]?.id ?? null;
    const scopedAcuRows = useMemo(
        () =>
            !open
                ? []
                : scope === 'presupuesto'
                    ? acuRows
                    : getSpecialtyAcus(acuRows, delphinRows, activeSpecialtyId),
        [open, acuRows, activeSpecialtyId, delphinRows, scope],
    );

    const rawRows = useMemo(
        () => (open ? flattenInsumos(scopedAcuRows, delphinRows) : []),
        [open, delphinRows, scopedAcuRows],
    );
    const consolidated = useMemo(
        () => consolidateInsumos(rawRows, aliases),
        [rawRows, aliases],
    );
    const typeRows = useMemo(() => {
        const query = normalizeText(search);
        const activeColumnFilters = Object.entries(columnFilters)
            .map(([key, value]) => [key, normalizeText(value)] as const)
            .filter(([, value]) => value !== '');

        const filteredRows = consolidated.filter((row) => {
            if (row.type !== activeType) {
                return false;
            }
            if (query) {
                const matchesQuery =
                    normalizeText(row.descripcion).includes(query) ||
                    normalizeText(row.codigo).includes(query) ||
                    normalizeText(row.unidad).includes(query);
                if (!matchesQuery) return false;
            }
            for (const [key, value] of activeColumnFilters) {
                const cellValue = normalizeText(String((row as unknown as Record<string, unknown>)[key] ?? ''));
                if (!cellValue.includes(value)) return false;
            }
            return true;
        });

        return sortInsumos(filteredRows, sort);
    }, [activeType, consolidated, search, columnFilters, sort]);

    // Agregar después de la definición de typeRows
    const allTypesRows = useMemo(() => {
        const result: Record<string, ConsolidatedInsumo[]> = {};
        for (const { key } of INSUMO_TYPES) {
            const rows = consolidated.filter((row) => row.type === key);
            if (rows.length > 0) {
                result[key] = sortInsumos(rows, { key: 'parcial', direction: 'desc' });
            }
        }
        return result;
    }, [consolidated]);

    const selectedRows = useMemo(
        () => typeRows.filter((row) => selectedKeys.has(row.key)),
        [typeRows, selectedKeys],
    );

    const totalsByType = useMemo(() => {
        return INSUMO_TYPES.reduce<
            Record<InsumoType, { count: number; total: number }>
        >(
            (acc, { key }) => {
                const rows = consolidated.filter((row) => row.type === key);
                acc[key] = {
                    count: rows.length,
                    total: rows.reduce((sum, row) => sum + row.parcial, 0),
                };
                return acc;
            },
            {} as Record<InsumoType, { count: number; total: number }>,
        );
    }, [consolidated]);

    const activeTotal = totalsByType[activeType]?.total ?? 0;
    const grandTotal = sumInsumoTotals(Object.values(totalsByType));
    const canMerge =
        selectedRows.length >= 2 &&
        new Set(selectedRows.map((row) => row.unidad)).size === 1;

    const toggleSelected = (key: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleMerge = () => {
        if (!canMerge) {
            return;
        }

        const targetName = mergeName.trim() || selectedRows[0].descripcion;
        setAliases((prev) => {
            const next = { ...prev };
            for (const row of selectedRows) {
                for (const sourceKey of row.sourceKeys) {
                    next[sourceKey] = targetName;
                }
            }
            return next;
        });
        setSelectedKeys(new Set());
        setMergeName('');
    };

    const handleTypeChange = (type: InsumoType) => {
        setActiveType(type);
        setSelectedKeys(new Set());
        setMergeName('');
        setReferenceRow(null);
    };

    const handleSort = (key: InsumoSortKey) => {
        setSort((current) => ({
            key,
            direction:
                current.key === key && current.direction === 'asc'
                    ? 'desc'
                    : 'asc',
        }));
    };

    if (!open) {
        return null;
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (isMaximized) return;
        if ((event.target as HTMLElement).closest('button, select, input'))
            return;
        dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            originX: position.x,
            originY: position.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        setPosition({
            x: drag.originX + event.clientX - drag.x,
            y: drag.originY + event.clientY - drag.y,
        });
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId === event.pointerId)
            dragRef.current = null;
    };

    return createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4">
            <div
                style={{
                    transform: isMaximized
                        ? undefined
                        : `translate(${position.x}px, ${position.y}px)`,
                }}
                className={`relative flex min-h-[50vh] min-w-[50vw] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl ${isMaximized
                    ? '!h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] resize-none'
                    : 'h-[86vh] max-h-[calc(100vh-2rem)] w-[90vw] max-w-[calc(100vw-2rem)] resize'
                    }`}
            >
                <div
                    className="flex shrink-0 cursor-move touch-none items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3 select-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <div>
                        <h2 className="text-sm font-semibold text-slate-100">
                            Insumos consolidados
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-400">
                            {scope === 'presupuesto'
                                ? 'Por presupuesto'
                                : 'Por especialidad'}{' '}
                            · {projectName}
                        </p>
                    </div>
                    {scope === 'especialidad' && (
                        <select
                            value={activeSpecialtyId ?? ''}
                            onChange={(event) => {
                                setSelectedSpecialtyId(
                                    Number(event.target.value),
                                );
                                setReferenceRow(null);
                            }}
                            className="mx-4 min-w-72 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                        >
                            {specialties.map((specialty) => (
                                <option key={specialty.id} value={specialty.id}>
                                    {specialty.partida} ·{' '}
                                    {specialty.descripcion}
                                </option>
                            ))}
                        </select>
                    )}

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-950/50 hover:text-emerald-300"
                            title="Exportar insumos a Excel"
                            onClick={() => {
                                const specialty = scope === 'especialidad'
                                    ? specialties.find(s => s.id === activeSpecialtyId)?.descripcion ?? 'General'
                                    : 'Presupuesto general';
                                exportInsumosConsolidadosExcel(allTypesRows, specialty, projectName, projectData);
                            }}
                        >
                            <FileSpreadsheet size={14} />
                            Exportar
                        </button>
                        <button
                            type="button"
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                            onClick={() =>
                                setIsMaximized((current) => !current)
                            }
                            title={
                                isMaximized
                                    ? 'Restaurar tamaño'
                                    : 'Maximizar modal'
                            }
                            aria-label={
                                isMaximized
                                    ? 'Restaurar tamaño del modal'
                                    : 'Maximizar modal'
                            }
                        >
                            {isMaximized ? (
                                <Minimize2 size={15} />
                            ) : (
                                <Maximize2 size={15} />
                            )}
                        </button>
                        <button
                            type="button"
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                            onClick={onClose}
                            aria-label="Cerrar insumos consolidados"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr]">
                    <aside className="min-h-0 border-r border-slate-800 bg-slate-950/30 p-3">
                        <div className="flex flex-col gap-1">
                            {INSUMO_TYPES.map(({ key, label, icon: Icon }) => {
                                const active = activeType === key;
                                const totals = totalsByType[key] ?? {
                                    count: 0,
                                    total: 0,
                                };
                                return (
                                    <button
                                        key={key}
                                        className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left transition-colors ${active
                                            ? 'bg-sky-700 text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        onClick={() => handleTypeChange(key)}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <Icon
                                                size={14}
                                                className="shrink-0"
                                            />
                                            <span className="truncate text-xs font-medium">
                                                {label}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                                            <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
                                                {totals.count}
                                            </span>
                                            <span
                                                className={`font-mono text-[10px] ${active ? 'text-sky-100' : 'text-slate-500'}`}
                                            >
                                                S/ {fmt(totals.total)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 divide-y divide-slate-800 rounded border border-slate-800 bg-slate-900">
                            <div className="p-3">
                                <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                                    Subtotal seleccionado
                                </p>
                                <p className="mt-1 font-mono text-lg font-semibold text-sky-300">
                                    S/ {fmt(activeTotal)}
                                </p>
                            </div>
                            <div className="bg-emerald-950/30 p-3">
                                <p className="text-[10px] font-semibold tracking-wider text-emerald-500 uppercase">
                                    Total general
                                </p>
                                <p className="mt-1 font-mono text-lg font-bold text-emerald-300">
                                    S/ {fmt(grandTotal)}
                                </p>
                            </div>
                        </div>
                    </aside>

                    <section className="flex min-h-0 flex-col">
                        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
                            <div className="relative min-w-64 flex-1">
                                <Search
                                    className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-500"
                                    size={14}
                                />
                                <input
                                    className="w-full rounded border border-slate-700 bg-slate-950 px-8 py-1.5 text-xs text-slate-100 transition-colors outline-none placeholder:text-slate-600 focus:border-sky-500"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Buscar insumo, codigo o unidad"
                                />
                            </div>

                            <div className="flex min-w-0 items-center gap-2">
                                <input
                                    className="w-72 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 transition-colors outline-none placeholder:text-slate-600 focus:border-sky-500 disabled:opacity-50"
                                    value={mergeName}
                                    disabled={selectedRows.length < 2}
                                    onChange={(event) =>
                                        setMergeName(event.target.value)
                                    }
                                    placeholder="Nombre para fusion manual"
                                />
                                <button
                                    className="flex shrink-0 items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                                    disabled={!canMerge}
                                    onClick={handleMerge}
                                >
                                    <Check size={13} />
                                    Fusionar
                                </button>
                            </div>
                        </div>

                        {selectedRows.length >= 2 && !canMerge && (
                            <div className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-2 text-xs text-amber-300">
                                Solo se pueden fusionar insumos de la misma
                                unidad.
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-auto">
                            <table className="w-full border-collapse text-left text-[11px]">
                                <thead className="sticky top-0 z-10 bg-slate-800 text-[10px] tracking-wider text-slate-400 uppercase">
                                    <tr>
                                        <th className="w-9 border-b border-slate-700 p-2"></th>
                                        <SortableHeader
                                            label="Codigo"
                                            sortKey="codigo"
                                            sort={sort}
                                            onSort={handleSort}
                                        />
                                        <SortableHeader
                                            label="Descripcion consolidada"
                                            sortKey="descripcion"
                                            sort={sort}
                                            onSort={handleSort}
                                        />
                                        <th className="border-b border-slate-700 p-2 text-center">
                                            Und.
                                        </th>
                                        <SortableHeader
                                            label="Cantidad"
                                            sortKey="cantidad"
                                            sort={sort}
                                            align="right"
                                            onSort={handleSort}
                                        />
                                        <th className="border-b border-slate-700 p-2 text-right">
                                            P. ref.
                                        </th>
                                        <SortableHeader
                                            label="Monto"
                                            sortKey="parcial"
                                            sort={sort}
                                            align="right"
                                            onSort={handleSort}
                                        />
                                        <SortableHeader
                                            label="Usos"
                                            sortKey="usos"
                                            sort={sort}
                                            align="center"
                                            onSort={handleSort}
                                        />
                                        <th className="w-12 border-b border-slate-700 p-2 text-center">
                                            Ref.
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-800/60">
                                        <th className="border-b border-slate-700 p-1 text-center">
                                            {hasColumnFilters && (
                                                <button
                                                    type="button"
                                                    title="Limpiar filtros de columna"
                                                    className="text-slate-500 transition-colors hover:text-red-400"
                                                    onClick={() => setColumnFilters({})}
                                                >
                                                    <X size={11} />
                                                </button>
                                            )}
                                        </th>
                                        {(
                                            [
                                                ['codigo', 'left'],
                                                ['descripcion', 'left'],
                                                ['unidad', 'center'],
                                                ['cantidad', 'right'],
                                                ['precio', 'right'],
                                                ['parcial', 'right'],
                                                ['usos', 'center'],
                                            ] as const
                                        ).map(([key, align]) => (
                                            <th key={key} className="border-b border-slate-700 p-1">
                                                <input
                                                    value={columnFilters[key] ?? ''}
                                                    onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                                                    placeholder="Filtrar…"
                                                    className={`w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-normal normal-case text-slate-200 tracking-normal outline-none placeholder:text-slate-600 focus:border-sky-500 ${
                                                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                                                    }`}
                                                />
                                            </th>
                                        ))}
                                        <th className="border-b border-slate-700 p-1"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {typeRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="p-10 text-center text-slate-500"
                                            >
                                                {hasColumnFilters || search ? (
                                                    <>
                                                        Sin resultados para este filtro.{' '}
                                                        <button
                                                            type="button"
                                                            className="text-sky-400 hover:text-sky-300"
                                                            onClick={() => { setColumnFilters({}); setSearch(''); }}
                                                        >
                                                            Limpiar filtros
                                                        </button>
                                                    </>
                                                ) : (
                                                    'No hay insumos para esta categoria.'
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        typeRows.map((row) => {
                                            const selected = selectedKeys.has(
                                                row.key,
                                            );
                                            return (
                                                <tr
                                                    key={row.key}
                                                    className={`transition-colors ${selected
                                                        ? 'bg-sky-950/60'
                                                        : 'hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                                                            checked={selected}
                                                            onChange={() =>
                                                                toggleSelected(
                                                                    row.key,
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td
                                                        className="max-w-32 truncate p-2 font-mono text-slate-400"
                                                        title={row.codigo}
                                                    >
                                                        {row.codigo || '-'}
                                                    </td>
                                                    <td className="min-w-72 p-2">
                                                        <div className="font-medium text-slate-100">
                                                            {row.descripcion}
                                                        </div>
                                                        {row.variantes.length >
                                                            1 && (
                                                                <div className="mt-0.5 text-[10px] text-slate-500">
                                                                    {
                                                                        row
                                                                            .variantes
                                                                            .length
                                                                    }{' '}
                                                                    variantes
                                                                    fusionadas
                                                                </div>
                                                            )}
                                                    </td>
                                                    <td className="p-2 text-center text-slate-400">
                                                        {row.unidad}
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-amber-300">
                                                        {row.precio === 0 ? '—' : fmt(row.cantidad, 4)}
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-emerald-300">
                                                        {row.precio === 0 ? '—' : fmt(row.precio)}
                                                    </td>
                                                    <td className="p-2 text-right font-mono font-semibold text-sky-300">
                                                        {fmt(row.parcial)}
                                                    </td>
                                                    <td className="p-2 text-center text-slate-400">
                                                        {row.usos}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button
                                                            type="button"
                                                            className="inline-flex rounded p-1.5 text-sky-400 transition-colors hover:bg-sky-950 hover:text-sky-200"
                                                            onClick={() =>
                                                                setReferenceRow(
                                                                    row,
                                                                )
                                                            }
                                                            title={`Ver de dónde proviene ${row.descripcion}`}
                                                            aria-label={`Ver referencias de ${row.descripcion}`}
                                                        >
                                                            <Search size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {referenceRow && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-6">
                        <div className="flex max-h-[75vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-700 bg-slate-800 px-4 py-3">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-slate-100">
                                        Referencias del insumo
                                    </h3>
                                    <p className="mt-1 truncate text-xs text-sky-300">
                                        {referenceRow.descripcion}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                                    onClick={() => setReferenceRow(null)}
                                    aria-label="Cerrar referencias"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="overflow-auto">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead className="sticky top-0 bg-slate-800 text-[10px] tracking-wider text-slate-400 uppercase">
                                        <tr>
                                            <th className="p-2">
                                                Partida / ACU de origen
                                            </th>
                                            <th className="p-2">
                                                Insumo original
                                            </th>
                                            <th className="p-2 text-right">
                                                Metrado
                                            </th>
                                            <th className="p-2 text-right">
                                                Cant. ACU
                                            </th>
                                            <th className="p-2 text-right">
                                                Cant. total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {referenceRow.references.map(
                                            (reference, index) => (
                                                <tr
                                                    key={`${reference.acuId}-${index}`}
                                                    className="hover:bg-slate-800/50"
                                                >
                                                    <td className="p-2">
                                                        <div className="font-mono text-sky-300">
                                                            {reference.partida}
                                                        </div>
                                                        <div className="mt-0.5 text-slate-300">
                                                            {
                                                                reference.acuDescripcion
                                                            }
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-slate-300">
                                                        {
                                                            reference.insumoDescripcion
                                                        }
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-slate-300">
                                                        {fmt(
                                                            reference.metrado,
                                                            4,
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-amber-300">
                                                        {fmt(
                                                            reference.cantidadAcu,
                                                            4,
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-emerald-300">
                                                        {fmt(
                                                            reference.cantidadTotal,
                                                            4,
                                                        )}
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="border-t border-slate-700 px-4 py-2 text-right text-[11px] text-slate-400">
                                {referenceRow.references.length}{' '}
                                {referenceRow.references.length === 1
                                    ? 'referencia'
                                    : 'referencias'}{' '}
                                encontradas
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
