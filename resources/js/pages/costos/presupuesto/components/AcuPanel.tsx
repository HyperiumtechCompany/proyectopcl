import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Calculator,
    Users,
    Package,
    Wrench,
    Search,
    X,
    Plus,
    Loader2,
} from 'lucide-react';
import { Command } from 'cmdk';
import axios from 'axios';
import type { ACUComponenteRow, ACURowSummary, InsumoProducto } from '@/types/presupuestos';

const fmt = (n: number | undefined | null, d = 2) =>
    (n ?? 0).toLocaleString('es-PE', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
    });

const sectionIcon = {
    mano_de_obra: Users,
    materiales: Package,
    equipos: Wrench,
};
const sectionColor = {
    mano_de_obra: 'text-blue-400',
    materiales: 'text-emerald-400',
    equipos: 'text-amber-400',
};
const sectionLabel = {
    mano_de_obra: 'MANO DE OBRA',
    materiales: 'MATERIALES',
    equipos: 'EQUIPOS',
};

function ResourceSearchDialog({
    open,
    onOpenChange,
    onSelect,
    targetType,
    projectId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (resource: any) => void;
    targetType: 'mano_de_obra' | 'materiales' | 'equipos' | null;
    projectId: number;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<InsumoProducto[]>([]);
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [catalogEmpty, setCatalogEmpty] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch products from API with debounce
    useEffect(() => {
        if (!open) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const params: Record<string, string> = {};
                if (query.trim()) params.q = query.trim();
                if (targetType) params.tipo = targetType;

                const response = await axios.get(`/costos/proyectos/${projectId}/presupuesto/insumos/search`, { params });
                if (response.data?.success) {
                    const prods = response.data.productos || [];
                    setResults(prods);
                    // If no query and 0 results → catalog is empty
                    if (!query.trim() && prods.length === 0) {
                        setCatalogEmpty(true);
                    } else {
                        setCatalogEmpty(false);
                    }
                }
            } catch (err) {
                console.warn('Error searching insumos:', err);
                setResults([]);
                setCatalogEmpty(true);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, open, targetType, projectId]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setQuery('');
            setResults([]);
            setCatalogEmpty(false);
        }
    }, [open]);

    const handleSeedCatalog = async () => {
        setSeeding(true);
        try {
            const response = await axios.post(`/costos/proyectos/${projectId}/presupuesto/insumos/seed`);
            if (response.data?.success) {
                setCatalogEmpty(false);
                // Re-trigger search to load newly seeded data
                setQuery('');
                setResults([]);
                // Small delay then re-fetch
                setTimeout(async () => {
                    try {
                        const params: Record<string, string> = {};
                        if (targetType) params.tipo = targetType;
                        const res = await axios.get(`/costos/proyectos/${projectId}/presupuesto/insumos/search`, { params });
                        if (res.data?.success) {
                            setResults(res.data.productos || []);
                        }
                    } catch (_) {}
                }, 200);
            }
        } catch (err) {
            console.warn('Error seeding catalog:', err);
        } finally {
            setSeeding(false);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh] transition-opacity"
            onClick={() => onOpenChange(false)}
        >
            <div
                className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <Command
                    label="Buscador de recursos"
                    className="flex h-full flex-col bg-slate-900 text-slate-200"
                    shouldFilter={false}
                >
                    <div className="flex items-center border-b border-slate-700/80 px-3 py-3">
                        <Search
                            size={18}
                            className="mx-2 shrink-0 text-slate-500"
                        />
                        <Command.Input
                            value={query}
                            onValueChange={setQuery}
                            autoFocus
                            placeholder={`Buscar ${targetType ? sectionLabel[targetType].toLowerCase() : 'recurso'} (ej. Cemento, Peón, 0202...)`}
                            className="flex-1 border-none bg-transparent py-1 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:ring-0"
                        />
                        {(loading || seeding) && (
                            <Loader2
                                size={16}
                                className="mx-1 shrink-0 animate-spin text-sky-400"
                            />
                        )}
                        <button
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                            onClick={() => onOpenChange(false)}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <Command.List className="scrollbar-thin max-h-[350px] overflow-y-auto p-2">
                        {!loading && results.length === 0 && (
                            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-slate-500">
                                {catalogEmpty && !query.trim() ? (
                                    <>
                                        <Package size={32} className="opacity-30" />
                                        <p>El catálogo de insumos está vacío.</p>
                                        <button
                                            onClick={handleSeedCatalog}
                                            disabled={seeding}
                                            className="mt-1 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                                        >
                                            {seeding
                                                ? 'Inicializando catálogo...'
                                                : '📦 Inicializar Catálogo Base (64 insumos)'}
                                        </button>
                                        <p className="text-[11px] text-slate-600">
                                            Carga mano de obra, materiales y equipos de construcción
                                        </p>
                                    </>
                                ) : query.trim() ? (
                                    'No se encontraron recursos.'
                                ) : (
                                    'Escriba para buscar insumos...'
                                )}
                            </div>
                        )}
                        {results.map((r) => (
                            <Command.Item
                                key={r.id}
                                onSelect={() => {
                                    onSelect(r);
                                    onOpenChange(false);
                                }}
                                className="group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors outline-none hover:bg-sky-900/40 aria-selected:bg-sky-900/40"
                            >
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium text-slate-200 group-hover:text-sky-300">
                                        {r.descripcion}
                                    </span>
                                    <div className="mt-0.5 flex items-center gap-2">
                                        <span className="font-mono text-[10px] text-slate-500">
                                            {r.codigo}
                                        </span>
                                        {r.clase && (
                                            <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                                                {r.clase.descripcion}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end text-right">
                                    <span className="text-sm font-semibold text-emerald-400">
                                        {fmt(r.precio)}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {r.unidad}
                                    </span>
                                </div>
                            </Command.Item>
                        ))}
                    </Command.List>
                </Command>
            </div>
        </div>
    );
}

function EditableAcuCell({
    value,
    onUpdate,
    className,
}: {
    value: number;
    onUpdate: (val: number) => void;
    className?: string;
}) {
    const [val, setVal] = useState(value?.toString() || '');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setVal(value?.toString() || '');
    }, [value]);

    if (isEditing) {
        return (
            <input
                autoFocus
                className={`w-full min-w-[50px] rounded border border-sky-500 bg-slate-800 px-1 text-right font-mono text-xs text-white outline-none ${className}`}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                    setIsEditing(false);
                    const num = Number(val);
                    if (!isNaN(num) && num !== value) onUpdate(num);
                    else setVal(value?.toString() || '');
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        setIsEditing(false);
                        const num = Number(val);
                        if (!isNaN(num) && num !== value) onUpdate(num);
                        else setVal(value?.toString() || '');
                    }
                    if (e.key === 'Escape') {
                        setIsEditing(false);
                        setVal(value?.toString() || '');
                    }
                }}
            />
        );
    }

    return (
        <div
            className={`-mx-1 min-w-[20px] cursor-text rounded px-1 transition-colors hover:bg-slate-700/80 ${className}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            {value >= 0 ? fmt(value, 2) : '-'}
        </div>
    );
}

function AcuSection({
    type,
    items,
    subtotal,
    rendimiento,
    onAddClick,
    onUpdateItem,
    onDeleteItem,
}: {
    type: 'mano_de_obra' | 'materiales' | 'equipos';
    items: ACUComponenteRow[];
    subtotal: number;
    rendimiento: number;
    onAddClick: (type: 'mano_de_obra' | 'materiales' | 'equipos') => void;
    onUpdateItem: (
        type: 'mano_de_obra' | 'materiales' | 'equipos',
        index: number,
        field: string,
        value: number,
    ) => void;
    onDeleteItem: (
        type: 'mano_de_obra' | 'materiales' | 'equipos',
        index: number,
    ) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const Icon = sectionIcon[type];
    const color = sectionColor[type];
    const label = sectionLabel[type];

    return (
        <div className="border-b border-slate-700">
            <div
                className="hover:bg-slate-750 flex cursor-pointer items-center gap-2 bg-slate-800/80 px-3 py-1.5 select-none"
                onClick={() => setExpanded((e) => !e)}
            >
                {expanded ? (
                    <ChevronDown size={13} className="text-slate-400" />
                ) : (
                    <ChevronRight size={13} className="text-slate-400" />
                )}
                <Icon size={13} className={color} />
                <span className="text-xs font-semibold tracking-wide text-slate-200">
                    {label}
                </span>
                <span className={`ml-auto text-xs font-bold ${color}`}>
                    {fmt(subtotal)}
                </span>
            </div>

            {expanded && (
                <table className="w-full text-xs">
                    <tbody>
                        {items.map((item, idx) => (
                            <tr
                                key={`${type}-${idx}`}
                                className="group border-b border-slate-700/50 hover:bg-slate-700/40"
                            >
                                <td
                                    className="w-28 cursor-pointer py-1 pr-2 pl-8 font-mono text-[10px] text-slate-500 transition-colors group-hover:text-red-400"
                                    title="Eliminar recurso"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteItem(type, idx);
                                    }}
                                >
                                    {item.codigo || 'X'}
                                </td>
                                <td className="min-w-0 px-2 py-1 text-slate-200">
                                    <span className="block max-w-xs truncate">
                                        {item.descripcion}
                                    </span>
                                </td>
                                <td className="w-10 px-2 py-1 text-center text-slate-400">
                                    {item.unidad}
                                </td>
                                <td className="w-16 px-2 py-1 text-right text-slate-300">
                                    <EditableAcuCell
                                        value={item.cantidad ?? 0}
                                        onUpdate={(v) =>
                                            onUpdateItem(
                                                type,
                                                idx,
                                                'cantidad',
                                                v,
                                            )
                                        }
                                    />
                                </td>
                                <td className="w-16 px-2 py-1 text-right text-slate-300">
                                    {rendimiento
                                        ? (
                                              (item.cantidad || 0) / rendimiento
                                          ).toFixed(4)
                                        : '-'}
                                </td>
                                <td className="w-14 px-2 py-1 text-right text-slate-300">
                                    {type === 'materiales' ? (
                                        <EditableAcuCell
                                            value={item.factor_desperdicio ?? 1}
                                            onUpdate={(v) =>
                                                onUpdateItem(
                                                    type,
                                                    idx,
                                                    'factor_desperdicio',
                                                    v,
                                                )
                                            }
                                        />
                                    ) : (
                                        '-'
                                    )}
                                </td>
                                <td className="w-20 px-2 py-1 text-right text-slate-300">
                                    <EditableAcuCell
                                        value={
                                            type === 'equipos'
                                                ? (item.precio_hora ?? 0)
                                                : (item.precio_unitario ?? 0)
                                        }
                                        onUpdate={(v) =>
                                            onUpdateItem(
                                                type,
                                                idx,
                                                type === 'equipos'
                                                    ? 'precio_hora'
                                                    : 'precio_unitario',
                                                v,
                                            )
                                        }
                                    />
                                </td>
                                <td className="w-20 px-2 py-1 pr-3 text-right font-semibold text-slate-100">
                                    {fmt(item.parcial, 2)}
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-8 py-2 text-[10px] text-slate-500 italic"
                                >
                                    Sin registros
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td
                                colSpan={8}
                                className="border-t border-slate-700/50 bg-slate-900/50 px-8 py-1.5"
                            >
                                <button
                                    className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-sky-500 uppercase transition-colors hover:text-sky-300"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddClick(type);
                                    }}
                                >
                                    <Plus size={11} className="stroke-3" />{' '}
                                    Añadir {label.toLowerCase()}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
}

interface AcuPanelProps {
    acuLoading: boolean;
    acuRows: ACURowSummary[];
    selectedAcu: ACURowSummary | null;
    projectId: number;
    selectedCell?: {
        row: number;
        col: number;
        data: Record<string, any>;
    } | null;
    onSaveAcu?: (
        acuData: Record<string, any>,
    ) => Promise<{ success: boolean; acu?: any; error?: string }>;
}

export function AcuPanel({
    acuLoading,
    selectedAcu,
    selectedCell,
    onSaveAcu,
    acuRows,
    projectId,
}: AcuPanelProps) {
    const [rendimiento, setRendimiento] = useState(1);
    const [perDay, setPerDay] = useState(true);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchTargetType, setSearchTargetType] = useState<
        'mano_de_obra' | 'materiales' | 'equipos' | null
    >(null);

    useEffect(() => {
        if (selectedAcu) {
            setRendimiento(selectedAcu.rendimiento || 1);
        }
    }, [selectedAcu]);

    const handleAddResourceClick = (
        type: 'mano_de_obra' | 'materiales' | 'equipos',
    ) => {
        setSearchTargetType(type);
        setSearchOpen(true);
    };

    const handleResourceSelected = async (resource: any) => {
        if (!selectedAcu || !onSaveAcu || !searchTargetType) return;

        const newComponent = {
            codigo: resource.codigo,
            descripcion: resource.descripcion,
            unidad: resource.unidad,
            cantidad: 1,
            precio_unitario: resource.tipo === 'equipos' ? 0 : resource.precio,
            precio_hora: resource.tipo === 'equipos' ? resource.precio : 0,
            factor_desperdicio: resource.tipo === 'materiales' ? 1.05 : 1,
        };

        const updatedAcuData = {
            ...selectedAcu,
            [searchTargetType]: [
                ...((selectedAcu[
                    searchTargetType as keyof ACURowSummary
                ] as any[]) || []),
                newComponent,
            ],
        };

        await onSaveAcu(updatedAcuData);
    };

    const handleUpdateItem = async (
        type: 'mano_de_obra' | 'materiales' | 'equipos',
        index: number,
        field: string,
        value: number,
    ) => {
        if (!selectedAcu || !onSaveAcu) return;
        const arr = [
            ...((selectedAcu[type as keyof ACURowSummary] as any[]) || []),
        ];
        arr[index] = { ...arr[index], [field]: value };
        await onSaveAcu({ ...selectedAcu, [type]: arr });
    };

    const handleDeleteItem = async (
        type: 'mano_de_obra' | 'materiales' | 'equipos',
        index: number,
    ) => {
        if (!selectedAcu || !onSaveAcu) return;
        const arr = [
            ...((selectedAcu[type as keyof ACURowSummary] as any[]) || []),
        ];
        arr.splice(index, 1);
        await onSaveAcu({ ...selectedAcu, [type]: arr });
    };

    const handleUpdateRendimiento = async (newRendimiento: number) => {
        if (!selectedAcu || !onSaveAcu) return;
        setRendimiento(newRendimiento);
        await onSaveAcu({ ...selectedAcu, rendimiento: newRendimiento });
    };

    if (acuLoading) {
        return (
            <div className="bg-slate-850 flex h-full flex-col items-center justify-center gap-3 text-slate-500">
                <p className="text-sm">Cargando ACU...</p>
            </div>
        );
    }

    if (!selectedAcu) {
        return (
            <div className="bg-slate-850 flex h-full flex-col items-center justify-center gap-3 text-slate-500">
                <Calculator size={40} className="opacity-30" />
                <p className="text-sm">
                    Seleccione una partida para ver el ACU
                </p>
            </div>
        );
    }

    const grandTotal = selectedAcu.costo_unitario_total || 0;

    return (
        <div className="bg-slate-850 flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-slate-700 bg-slate-800 px-4 py-2.5">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-[10px] tracking-widest text-slate-500 uppercase">
                            Análisis de Costo Unitario
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                            <span className="text-slate-500">Presupuesto:</span>{' '}
                            <span className="font-medium text-sky-400">
                                PROYECTO
                            </span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500">
                            Hecho por:{' '}
                            <span className="text-slate-300">
                                Administrador
                            </span>
                        </p>
                        {selectedCell && (
                            <p className="mt-0.5 text-[10px] text-slate-500">
                                Fila:{' '}
                                <span className="text-slate-300">
                                    {selectedCell.row}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        <span className="font-mono font-semibold text-sky-400">
                            {selectedAcu.partida}
                        </span>
                        {' — '}
                        <span className="text-slate-200">
                            {selectedAcu.descripcion}
                        </span>
                    </span>
                </div>
            </div>

            {/* Rendimiento bar */}
            <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-800/50 px-3 py-2">
                <span className="text-xs text-slate-400">Rendimiento:</span>
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        value={rendimiento}
                        onChange={(e) => setRendimiento(Number(e.target.value))}
                        onBlur={(e) =>
                            handleUpdateRendimiento(Number(e.target.value))
                        }
                        onKeyDown={(e) =>
                            e.key === 'Enter' &&
                            handleUpdateRendimiento(
                                Number((e.target as HTMLInputElement).value),
                            )
                        }
                        className="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-0.5 text-right text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">
                        {selectedAcu.unidad || 'Und.'}
                    </span>
                </div>
                <div className="flex items-center gap-1 overflow-hidden rounded border border-slate-600">
                    <button
                        onClick={() => setPerDay(true)}
                        className={`px-2 py-0.5 text-xs transition-colors ${perDay ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Por día
                    </button>
                    <button
                        onClick={() => setPerDay(false)}
                        className={`px-2 py-0.5 text-xs transition-colors ${!perDay ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Hora
                    </button>
                </div>
                <span className="ml-auto text-[10px] text-slate-500">
                    Horas por Día:
                </span>
                <input
                    type="number"
                    defaultValue={8}
                    className="w-12 rounded border border-slate-600 bg-slate-700 px-2 py-0.5 text-right text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                />
            </div>

            {/* Column headers */}
            <div
                className="grid border-b border-slate-700 bg-slate-800/30 text-[10px] font-medium tracking-wider text-slate-500 uppercase"
                style={{
                    gridTemplateColumns:
                        '7rem 1fr 2.5rem 4rem 4rem 3.5rem 5rem 5rem',
                }}
            >
                <div className="px-3 py-1.5">Cod. Insumo</div>
                <div className="px-2 py-1.5">Descripción</div>
                <div className="px-2 py-1.5 text-center">Und.</div>
                <div className="px-2 py-1.5 text-right">Cuadr.</div>
                <div className="px-2 py-1.5 text-right">Recur.</div>
                <div className="px-2 py-1.5 text-right">%D.</div>
                <div className="px-2 py-1.5 text-right">Precio</div>
                <div className="px-2 py-1.5 pr-3 text-right">Total</div>
            </div>

            {/* Sections */}
            <div className="scrollbar-thin relative flex-1 overflow-auto border-l border-slate-700 bg-slate-900">
                <AcuSection
                    type="mano_de_obra"
                    items={selectedAcu.mano_de_obra || []}
                    subtotal={selectedAcu.costo_mano_obra || 0}
                    rendimiento={rendimiento}
                    onAddClick={handleAddResourceClick}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                />
                <AcuSection
                    type="materiales"
                    items={selectedAcu.materiales || []}
                    subtotal={selectedAcu.costo_materiales || 0}
                    rendimiento={rendimiento}
                    onAddClick={handleAddResourceClick}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                />
                <AcuSection
                    type="equipos"
                    items={selectedAcu.equipos || []}
                    subtotal={selectedAcu.costo_equipos || 0}
                    rendimiento={rendimiento}
                    onAddClick={handleAddResourceClick}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                />

                {/* Empty sections */}
                {(['SUB-CONTRATOS', 'SUB-PARTIDAS'] as const).map((label) => (
                    <div
                        key={label}
                        className="flex items-center justify-between border-b border-slate-700 bg-slate-800/40 px-3 py-1.5"
                    >
                        <span className="text-xs font-semibold text-slate-500">
                            {label}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                            0.00
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t-2 border-sky-600/50 bg-slate-800 px-4 py-2.5">
                <span className="text-sm font-bold tracking-wide text-slate-300">
                    TOTAL ACU.
                </span>
                <span className="font-mono text-lg font-bold text-sky-400">
                    {fmt(grandTotal)}
                </span>
            </div>

            {/* Dialog for Searching Resources */}
            <ResourceSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                onSelect={handleResourceSelected}
                targetType={searchTargetType}
                projectId={projectId}
            />
        </div>
    );
}
