import axios from 'axios';
import { Command } from 'cmdk';
import Decimal from 'decimal.js';
import {
    ChevronRight,
    ChevronDown,
    Calculator,
    Users,
    Package,
    Wrench,
    Briefcase,
    Layers,
    Pencil,
    Search,
    X,
    Plus,
    Loader2,
    Trash2,
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
    ACUComponenteRow,
    ACURowSummary,
    InsumoProducto,
} from '@/types/presupuestos';
import { calculateAcuLocally } from '../hooks/usePresupuestoAcu';
import { useProjectParamsStore } from '../stores/projectParamsStore';

const fmt = (n: number | undefined | null, d = 2) =>
    (n ?? 0).toLocaleString('es-PE', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
    });

const fmtCantidad = (n: number | undefined | null) =>
    fmt(new Decimal(n ?? 0).toDecimalPlaces(4).toNumber(), 4);

const UNIT_LABELS: Record<string, string> = {
    'm2': 'm²',
    'm3': 'm³',
};
const displayUnit = (u: string) => UNIT_LABELS[u] ?? u;

const sectionIcon = {
    mano_de_obra: Users,
    materiales: Package,
    equipos: Wrench,
    subcontratos: Briefcase,
    subpartidas: Layers,
};
const sectionColor = {
    mano_de_obra: 'text-blue-400',
    materiales: 'text-emerald-400',
    equipos: 'text-amber-400',
    subcontratos: 'text-violet-400',
    subpartidas: 'text-cyan-400',
};
const sectionLabel = {
    mano_de_obra: 'MANO DE OBRA',
    materiales: 'MATERIALES',
    equipos: 'EQUIPOS',
    subcontratos: 'SUB-CONTRATOS',
    subpartidas: 'SUB-PARTIDAS',
};

const ACU_GRID_TEMPLATE = '7rem 1fr 2.5rem 4rem 4rem 3.5rem 5rem 5rem';

const isHerramientasRow = (item: ACUComponenteRow) =>
    (item.descripcion || '').toLowerCase().includes('herramienta');

// Redondeo a 4 decimales para valores de "cantidad" ingresados manualmente
// (materiales, subcontratos, subpartidas, % de herramientas).
const roundCantidad = (n: number) => new Decimal(n).toDecimalPlaces(4).toNumber();

// Redondeo a 2 decimales para precios (precio_unitario / precio_hora).
const roundPrecio = (n: number) => new Decimal(n).toDecimalPlaces(2).toNumber();

// Cantidad calculada (mano de obra/equipos via recursos/rendimiento) usa
// 4 decimales para mantener el mismo criterio que Delphin al importar.
const computeCantidadFromRecursosBase = (
    recursos: number,
    perDay: boolean,
    hoursPerDay: number,
    rendimiento: number,
) => {
    const safeRend = rendimiento || 1;
    if (perDay) {
        return roundCantidad((recursos * hoursPerDay) / safeRend);
    }
    return roundCantidad(recursos / safeRend);
};

const computeRecursosFromCantidadBase = (
    cantidad: number,
    perDay: boolean,
    hoursPerDay: number,
    rendimiento: number,
) => {
    const safeRend = rendimiento || 1;
    if (perDay) {
        return (cantidad * safeRend) / hoursPerDay;
    }
    return cantidad * safeRend;
};

type AcuSectionType = 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'subpartidas';

export function createAcuComponentFromResource(
    resource: InsumoProducto,
    targetType: AcuSectionType,
    cantidad: number,
    recursos?: number,
): ACUComponenteRow {
    const isEquipment = targetType === 'equipos';
    const precio = roundPrecio(resource.precio);

    return {
        insumo_id: resource.id,
        // El código INEI (2 dígitos, ej. "47") vive en diccionario.codigo, no en
        // resource.codigo (= insumo_productos.codigo_producto, un código compuesto
        // como "021060001"). Agrupar por ese código compuesto rompía la Fórmula
        // Polinómica (cada insumo del catálogo caía en su propia "columna" en vez
        // de agruparse con el resto de su índice INEI). Con fallback a
        // resource.codigo cuando el insumo no tiene diccionario asociado.
        cod_insumo: resource.diccionario?.codigo ?? resource.codigo,
        // Se conserva el código compuesto del catálogo aparte, para uso futuro
        // (búsqueda exacta del insumo, re-sincronización de precios, exportaciones)
        // sin perderlo al resolver el código corto de arriba.
        codigo_producto: resource.codigo,
        descripcion: resource.descripcion,
        unidad: resource.unidad?.abreviatura_unidad ?? resource.unidad?.descripcion_singular ?? '',
        cantidad,
        recursos,
        precio_unitario: isEquipment ? 0 : precio,
        precio_hora: isEquipment ? precio : 0,
        factor_desperdicio: 1,
    };
}

function recalculateAcu(acu: ACURowSummary): ACURowSummary {
    return { ...acu, ...calculateAcuLocally(acu) };
}

function SearchableSelect({
    options,
    value,
    onChange,
    placeholder,
    disabled = false,
}: {
    options: { value: string | number; label: string }[];
    value: string | number;
    onChange: (val: string | number) => void;
    placeholder?: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(
        (o) => o.value.toString() === value?.toString(),
    );
    const filteredOptions = options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="relative" ref={ref}>
            <div
                className={`flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
                onClick={() => !disabled && setOpen(!open)}
            >
                <span className="truncate">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={12} className="shrink-0 text-slate-400" />
            </div>
            {open && (
                <div className="absolute z-70 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-700 bg-slate-800 shadow-xl">
                    <div className="sticky top-0 bg-slate-800 p-1">
                        <input
                            autoFocus
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {filteredOptions.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-slate-500">
                            Sin resultados
                        </div>
                    ) : (
                        filteredOptions.map((o) => (
                            <div
                                key={o.value}
                                className={`cursor-pointer px-2 py-1.5 text-xs hover:bg-sky-600 hover:text-white ${
                                    value?.toString() === o.value.toString()
                                        ? 'bg-sky-900/40 text-sky-200'
                                        : 'text-slate-200'
                                }`}
                                onClick={() => {
                                    onChange(o.value);
                                    setOpen(false);
                                    setSearch('');
                                }}
                            >
                                {o.label}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

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
    targetType: 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'subpartidas' | null;
    projectId: number;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<InsumoProducto[]>([]);
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [catalogEmpty, setCatalogEmpty] = useState(false);
    const [refreshSeed, setRefreshSeed] = useState(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
    const [editorSaving, setEditorSaving] = useState(false);
    const [diccionarios, setDiccionarios] = useState<
        Array<{ id: number; codigo: string; descripcion: string }>
    >([]);
    const [unidades, setUnidades] = useState<
        Array<{ id: number; descripcion: string; descripcion_singular: string; abreviatura_unidad: string }>
    >([]);
    const [dependenciesLoading, setDependenciesLoading] = useState(false);
    const [editorForm, setEditorForm] = useState({
        id: null as number | null,
        codigo_producto: '',
        descripcion: '',
        especificaciones: '',
        diccionario_id: '',
        unidad_id: '',
        tipo_proveedor: '106',
        costo_unitario_lista: 0,
        costo_unitario: 0,
        costo_flete: 0,
        tipo: (targetType ?? 'materiales') as
            | 'mano_de_obra'
            | 'materiales'
            | 'equipos'
            | 'subcontratos'
            | 'subpartidas',
    });

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

                const response = await axios.get(
                    `/costos/proyectos/${projectId}/presupuesto/insumos/search`,
                    { params },
                );
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
    }, [query, open, targetType, projectId, refreshSeed]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setQuery('');
            setResults([]);
            setCatalogEmpty(false);
        }
    }, [open]);

    useEffect(() => {
        if (!editorOpen) return;
        if (diccionarios.length > 0 && unidades.length > 0) return;
        if (dependenciesLoading) return;

        setDependenciesLoading(true);
        Promise.all([
            axios.get(`/costos/proyectos/${projectId}/presupuesto/insumos/diccionarios`),
            axios.get(`/costos/proyectos/${projectId}/presupuesto/insumos/unidades`)
        ])
        .then(([resDic, resUnd]) => {
            if (resDic.data?.success) setDiccionarios(resDic.data.diccionarios || []);
            if (resUnd.data?.success) setUnidades(resUnd.data.unidades || []);
        })
        .catch(() => {
            setDiccionarios([]);
            setUnidades([]);
        })
        .finally(() => setDependenciesLoading(false));
    }, [editorOpen, diccionarios.length, unidades.length, dependenciesLoading, projectId]);

    useEffect(() => {
        if (!editorOpen) return;
        setEditorForm((prev) => ({
            ...prev,
            tipo: (targetType ?? prev.tipo) as
                | 'mano_de_obra'
                | 'materiales'
                | 'equipos'
                | 'subcontratos'
                | 'subpartidas',
        }));
    }, [targetType, editorOpen]);

    const openCreate = () => {
        setEditorMode('create');
        setEditorForm({
            id: null,
            codigo_producto: '',
            descripcion: '',
            especificaciones: '',
            diccionario_id: '',
            unidad_id: '',
            tipo_proveedor: '106',
            costo_unitario_lista: 0,
            costo_unitario: 0,
            costo_flete: 0,
            tipo: (targetType ?? 'materiales') as
                | 'mano_de_obra'
                | 'materiales'
                | 'equipos'
                | 'subcontratos'
                | 'subpartidas',
        });
        setEditorOpen(true);
    };

    const openEdit = (item: InsumoProducto) => {
        setEditorMode('edit');
        setEditorForm({
            id: item.id,
            codigo_producto: item.codigo ?? '',
            descripcion: item.descripcion,
            especificaciones: item.especificaciones || '',
            diccionario_id: item.diccionario_id?.toString() || '',
            unidad_id: item.unidad_id?.toString() || '',
            tipo_proveedor: item.tipo_proveedor || '106',
            costo_unitario_lista: item.costo_unitario_lista ?? 0,
            costo_unitario: item.precio ?? 0,
            costo_flete: item.costo_flete ?? 0,
            tipo: item.tipo,
        });
        setEditorOpen(true);
    };

    const handleSeedCatalog = async () => {
        setSeeding(true);
        try {
            const response = await axios.post(
                `/costos/proyectos/${projectId}/presupuesto/insumos/seed`,
            );
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
                        const res = await axios.get(
                            `/costos/proyectos/${projectId}/presupuesto/insumos/search`,
                            { params },
                        );
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

    const handleSaveInsumo = async () => {
        if (editorSaving) return;
        setEditorSaving(true);
        try {
            if (!editorForm.diccionario_id || !editorForm.unidad_id || !editorForm.tipo_proveedor) {
                alert('Seleccione un diccionario, unidad y tipo de proveedor válidos.');
                setEditorSaving(false);
                return;
            }
            const payload = {
                descripcion: editorForm.descripcion.trim(),
                especificaciones: editorForm.especificaciones?.trim() || null,
                diccionario_id: Number(editorForm.diccionario_id),
                unidad_id: Number(editorForm.unidad_id),
                tipo_proveedor: editorForm.tipo_proveedor,
                costo_unitario_lista: Number(
                    editorForm.costo_unitario_lista || 0,
                ),
                costo_unitario: Number(editorForm.costo_unitario || 0),
                costo_flete: Number(editorForm.costo_flete || 0),
                tipo: editorForm.tipo,
            };

            if (editorMode === 'create') {
                await axios.post(
                    `/costos/proyectos/${projectId}/presupuesto/insumos`,
                    payload,
                );
            } else if (editorForm.id) {
                await axios.put(
                    `/costos/proyectos/${projectId}/presupuesto/insumos/${editorForm.id}`,
                    payload,
                );
            }

            setEditorOpen(false);
            setRefreshSeed((v) => v + 1);
        } catch (err) {
            console.warn('Error saving insumo:', err);
            alert('No se pudo guardar el insumo. Verifique los campos.');
        } finally {
            setEditorSaving(false);
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
                            className="mr-2 rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-500"
                            onClick={openCreate}
                        >
                            + Nuevo
                        </button>
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
                                        <Package
                                            size={32}
                                            className="opacity-30"
                                        />
                                        <p>
                                            El catálogo de insumos está vacío.
                                        </p>
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
                                            Carga mano de obra, materiales y
                                            equipos de construcción
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
                                        {r.diccionario && (
                                            <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                                                {r.diccionario.codigo} - {r.diccionario.descripcion}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end text-right">
                                    <span className="text-sm font-semibold text-emerald-400">
                                        {fmt(r.precio)}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {r.unidad?.abreviatura_unidad || '-'}
                                    </span>
                                    <button
                                        className="mt-1 inline-flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEdit(r);
                                        }}
                                    >
                                        <Pencil size={10} />
                                        Editar
                                    </button>
                                </div>
                            </Command.Item>
                        ))}
                    </Command.List>
                </Command>
            </div>

            {editorOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
                    onClick={() => setEditorOpen(false)}
                >
                    <div
                        className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-200 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold tracking-wide">
                                {editorMode === 'create'
                                    ? 'Nuevo Insumo'
                                    : 'Editar Insumo'}
                            </h3>
                            <button
                                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                                onClick={() => setEditorOpen(false)}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <label className="col-span-1 flex flex-col gap-1">
                                Código (Autogenerado)
                                <input
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                                    value={editorForm.codigo_producto ?? ''}
                                    disabled
                                    placeholder={editorMode === 'create' ? 'Se generará al guardar...' : ''}
                                />
                            </label>
                            <label className="col-span-1 flex flex-col gap-1">
                                Unidad
                                <SearchableSelect
                                    options={unidades.map(u => ({ value: u.id, label: u.descripcion_singular || u.abreviatura_unidad }))}
                                    value={editorForm.unidad_id ?? ''}
                                    onChange={(val) => setEditorForm(prev => ({ ...prev, unidad_id: val.toString() }))}
                                    placeholder={dependenciesLoading ? 'Cargando...' : 'Seleccione...'}
                                />
                            </label>
                            <label className="col-span-2 flex flex-col gap-1">
                                Descripción
                                <input
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                                    value={editorForm.descripcion ?? ''}
                                    onChange={(e) =>
                                        setEditorForm((prev) => ({
                                            ...prev,
                                            descripcion: e.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="col-span-2 flex flex-col gap-1">
                                Especificaciones
                                <input
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                                    value={editorForm.especificaciones ?? ''}
                                    onChange={(e) =>
                                        setEditorForm((prev) => ({
                                            ...prev,
                                            especificaciones: e.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="col-span-1 flex flex-col gap-1">
                                Diccionario
                                <SearchableSelect
                                    options={diccionarios.map(d => ({ value: d.id, label: `${d.codigo} - ${d.descripcion}` }))}
                                    value={editorForm.diccionario_id ?? ''}
                                    onChange={(val) => setEditorForm(prev => ({ ...prev, diccionario_id: val.toString() }))}
                                    placeholder={dependenciesLoading ? 'Cargando...' : 'Seleccione...'}
                                />
                            </label>
                            <label className="col-span-1 flex flex-col gap-1">
                                Tipo de Proveedor
                                <select
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                                    value={editorForm.tipo_proveedor ?? ''}
                                    onChange={(e) =>
                                        setEditorForm((prev) => ({
                                            ...prev,
                                            tipo_proveedor: e.target.value,
                                        }))
                                    }
                                >
                                    <option value="106">Local (106)</option>
                                    <option value="001">Sin Clasificar (001)</option>
                                </select>
                            </label>
                            <label className="col-span-1 flex flex-col gap-1">
                                Tipo
                                <select
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                                    value={editorForm.tipo ?? ''}
                                    disabled
                                    onChange={(e) =>
                                        setEditorForm((prev) => ({
                                            ...prev,
                                            tipo: e.target.value as
                                                | 'mano_de_obra'
                                                | 'materiales'
                                                | 'equipos'
                                                | 'subcontratos'
                                                | 'subpartidas',
                                        }))
                                    }
                                >
                                    <option value="mano_de_obra">
                                        Mano de obra
                                    </option>
                                    <option value="materiales">
                                        Materiales
                                    </option>
                                    <option value="equipos">Equipos</option>
                                    <option value="subcontratos">Sub-contratos</option>
                                    <option value="subpartidas">Sub-partidas</option>
                                </select>
                            </label>
                            <label className="col-span-1 flex flex-col gap-1">
                                Precio Lista
                                <input
                                    type="number"
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                                    value={editorForm.costo_unitario_lista ?? ''}
                                    onChange={(e) =>
                                        setEditorForm((prev) => ({
                                            ...prev,
                                            costo_unitario_lista: Number(
                                                e.target.value,
                                            ),
                                        }))
                                    }
                                />
                            </label>
                            <label className="col-span-1 flex flex-col gap-1">
                                Precio
                                <input
                                    type="number"
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                                    value={editorForm.costo_unitario ?? ''}
                                    onChange={(e) =>
                                        setEditorForm((prev) => ({
                                            ...prev,
                                            costo_unitario: Number(
                                                e.target.value,
                                            ),
                                        }))
                                    }
                                />
                            </label>
                            <label className="col-span-1 flex flex-col gap-1">
                                Flete
                                <input
                                    type="number"
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                                    value={editorForm.costo_flete ?? ''}
                                    onChange={(e) =>
                                        setEditorForm((prev) => ({
                                            ...prev,
                                            costo_flete: Number(e.target.value),
                                        }))
                                    }
                                />
                            </label>
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                className="rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
                                onClick={() => setEditorOpen(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
                                onClick={handleSaveInsumo}
                                disabled={editorSaving}
                            >
                                {editorSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditableAcuCell({
    value,
    onUpdate,
    className,
    decimals = 2,
}: {
    value: number;
    onUpdate: (val: number) => void;
    className?: string;
    decimals?: number;
}) {
    const [val, setVal] = useState(value?.toString() || '');
    const [isEditing, setIsEditing] = useState(false);
    const numericValue = Number(value ?? 0);

    useEffect(() => {
        setVal(value?.toString() || '');
    }, [value]);

    if (isEditing) {
        return (
            <input
                autoFocus
            className={`w-full min-w-[50px] rounded border border-sky-500 bg-white px-1 text-right font-mono text-xs text-slate-900 outline-none dark:bg-slate-800 dark:text-white ${className}`}
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
            className={`-mx-1 min-w-[20px] cursor-text rounded px-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/80 ${className}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            {numericValue >= 0 ? fmt(numericValue, decimals) : '-'}
        </div>
    );
}

function EditableTextCell({
    value,
    onUpdate,
    className,
}: {
    value: string;
    onUpdate: (val: string) => void;
    className?: string;
}) {
    const [val, setVal] = useState(value ?? '');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setVal(value ?? '');
    }, [value]);

    if (isEditing) {
        return (
            <input
                autoFocus
                className={`w-full min-w-[80px] rounded border border-sky-500 bg-white px-1 text-left text-xs text-slate-900 outline-none dark:bg-slate-800 dark:text-white ${className || ''}`}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                    const trimmed = val.trim();
                    if (!trimmed) {
                        setVal(value ?? '');
                        setIsEditing(false);
                        return;
                    }
                    setIsEditing(false);
                    onUpdate(trimmed);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const trimmed = val.trim();
                        if (!trimmed) {
                            setVal(value ?? '');
                            setIsEditing(false);
                            return;
                        }
                        setIsEditing(false);
                        onUpdate(trimmed);
                    }
                    if (e.key === 'Escape') {
                        setIsEditing(false);
                        setVal(value ?? '');
                    }
                }}
            />
        );
    }

    return (
        <button
            type="button"
            className={`w-full text-left text-slate-700 hover:text-sky-600 dark:text-slate-200 dark:hover:text-sky-300 ${className || ''}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            {value || '-'}
        </button>
    );
}

function AcuSection({
    type,
    items,
    subtotal,
    rendimiento,
    perDay,
    hoursPerDay,
    manoObraTotal,
    onAddClick,
    onUpdateItem,
    onDeleteItem,
}: {
    type:
        | 'mano_de_obra'
        | 'materiales'
        | 'equipos'
        | 'subcontratos'
        | 'subpartidas';
    items: ACUComponenteRow[];
    subtotal: number;
    rendimiento: number;
    perDay: boolean;
    hoursPerDay: number;
    manoObraTotal: number;
    onAddClick: (
        type:
            | 'mano_de_obra'
            | 'materiales'
            | 'equipos'
            | 'subcontratos'
            | 'subpartidas',
    ) => void;
    onUpdateItem: (
        type:
            | 'mano_de_obra'
            | 'materiales'
            | 'equipos'
            | 'subcontratos'
            | 'subpartidas',
        index: number,
        field: string,
        value: string | number,
    ) => void;
    onDeleteItem: (
        type:
            | 'mano_de_obra'
            | 'materiales'
            | 'equipos'
            | 'subcontratos'
            | 'subpartidas',
        index: number,
    ) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const Icon = sectionIcon[type];
    const color = sectionColor[type];
    const label = sectionLabel[type];
    const isCrewType = type === 'mano_de_obra' || type === 'equipos';

    return (
        <div className="border-b border-slate-300 dark:border-slate-700">
            <div
                className="flex cursor-pointer items-center gap-2 bg-slate-100 px-3 py-1.5 select-none hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700"
                onClick={() => setExpanded((e) => !e)}
            >
                {expanded ? (
                    <ChevronDown size={13} className="text-slate-500 dark:text-slate-400" />
                ) : (
                    <ChevronRight size={13} className="text-slate-500 dark:text-slate-400" />
                )}
                <Icon size={13} className={color} />
                <span className="text-xs font-semibold tracking-wide text-slate-800 dark:text-slate-200">
                    {label}
                </span>
                <span className={`ml-auto text-xs font-bold ${color}`}>
                    {fmt(subtotal)}
                </span>
            </div>

            {expanded && (
                <table className="w-full table-fixed text-xs">
                    <tbody>
                        {items.map((item, idx) => {
                            const recursosValue =
                                item.recursos !== null &&
                                item.recursos !== undefined
                                    ? Number(item.recursos) || 0
                                    : computeRecursosFromCantidadBase(
                                          item.cantidad ?? 0,
                                          perDay,
                                          hoursPerDay,
                                          rendimiento,
                                      );
                            const isHerramientas =
                                type === 'equipos' && isHerramientasRow(item);
                            const cantidadDisplay =
                                isCrewType && !isHerramientas
                                    ? computeCantidadFromRecursosBase(
                                          recursosValue,
                                          perDay,
                                          hoursPerDay,
                                          rendimiento,
                                      )
                                    : (item.cantidad ?? 0);

                            return (
                                <tr
                                    key={`${type}-${idx}`}
                                    className="group border-b border-slate-200 hover:bg-slate-100 dark:border-slate-700/50 dark:hover:bg-slate-700/40"
                                >
                                    <td className="w-28 py-1 pr-2 pl-2 font-mono text-[10px] text-slate-500 dark:text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-red-400"
                                                title="Eliminar recurso"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteItem(type, idx);
                                                }}
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                            <span className="truncate">
                                                {item.cod_insumo ?? item.codigo ?? '—'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="min-w-0 px-2 py-1 text-slate-800 dark:text-slate-200">
                                        <EditableTextCell
                                            value={item.descripcion || ''}
                                            onUpdate={(v) =>
                                                onUpdateItem(
                                                    type,
                                                    idx,
                                                    'descripcion',
                                                    v,
                                                )
                                            }
                                        />
                                        {item.proveedor && (
                                            <span className="block truncate text-[9px] leading-none text-slate-500">
                                                {item.proveedor}
                                            </span>
                                        )}
                                    </td>
                                    <td className="w-12 px-2 py-1 text-center text-slate-600 dark:text-slate-400">
                                        <EditableTextCell
                                            value={item.unidad || ''}
                                            onUpdate={(v) =>
                                                onUpdateItem(
                                                    type,
                                                    idx,
                                                    'unidad',
                                                    v,
                                                )
                                            }
                                            className="text-center"
                                        />
                                    </td>
                                    <td className="w-16 px-2 py-1 text-right text-slate-700 dark:text-slate-300">
                                        {isCrewType && !isHerramientas ? (
                                            <EditableAcuCell
                                                value={recursosValue}
                                                onUpdate={(v) =>
                                                    onUpdateItem(
                                                        type,
                                                        idx,
                                                        'recursos',
                                                        v,
                                                    )
                                                }
                                            />
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                    <td className="w-16 px-2 py-1 text-right text-slate-700 dark:text-slate-300">
                                        {isCrewType && !isHerramientas ? (
                                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                                                {fmtCantidad(cantidadDisplay)}
                                            </span>
                                        ) : (
                                            <EditableAcuCell
                                                value={item.cantidad ?? 0}
                                                decimals={4}
                                                onUpdate={(v) =>
                                                    onUpdateItem(
                                                        type,
                                                        idx,
                                                        'cantidad',
                                                        v,
                                                    )
                                                }
                                            />
                                        )}
                                    </td>
                                    <td className="w-14 px-2 py-1 text-right text-slate-700 dark:text-slate-300">
                                        {type === 'materiales' ? (
                                            <EditableAcuCell
                                                value={
                                                    item.factor_desperdicio ?? 1
                                                }
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
                                    <td className="w-20 px-2 py-1 text-right text-slate-700 dark:text-slate-300">
                                        {isHerramientas ? (
                                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                                                {fmt(manoObraTotal || 0, 2)}
                                            </span>
                                        ) : (
                                            <EditableAcuCell
                                                value={
                                                    type === 'equipos'
                                                        ? (item.precio_hora ??
                                                          0)
                                                        : (item.precio_unitario ??
                                                          0)
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
                                        )}
                                    </td>
                                    <td className="w-20 px-2 py-1 pr-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                                        {fmt(item.parcial, 2)}
                                    </td>
                                </tr>
                            );
                        })}
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
                                className="border-t border-slate-200 bg-slate-50 px-8 py-1.5 dark:border-slate-700/50 dark:bg-slate-900/50"
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
        options?: { updateProjectPrices?: boolean }
    ) => Promise<{ success: boolean; acu?: any; error?: string }>;
    onAcuChange?: (
        acuData: Record<string, any>,
        options?: { updateProjectPrices?: boolean }
    ) => void;
}

export const AcuPanel = React.memo(function AcuPanel({
    acuLoading,
    selectedAcu,
    selectedCell,
    onSaveAcu,
    onAcuChange,
    acuRows,
    projectId,
}: AcuPanelProps) {
    type SectionType = AcuSectionType;
    type SearchType = 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'subpartidas';

    const [rendimiento, setRendimiento] = useState(1);
    const [perDay, setPerDay] = useState(true);

    const globalHours = useProjectParamsStore(s => s.getJornadaHoras());
    const [hoursPerDay, setHoursPerDay] = useState(globalHours || 8);
    const [updateProjectPrices, setUpdateProjectPrices] = useState(true);
    const [searchOpen, setSearchOpen] = useState(false);

    // Local working copy — all edits apply here; only flushed to DB on "Guardar"
    const [localAcu, setLocalAcu] = useState<ACURowSummary | null>(selectedAcu);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const prevPartidaRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (globalHours) setHoursPerDay(globalHours);
    }, [globalHours]);
    const [searchTargetType, setSearchTargetType] = useState<SearchType | null>(
        null,
    );

    // Sync localAcu only when a different partida is selected (not on every prop update)
    useEffect(() => {
        const newPartida = selectedAcu?.partida;
        if (newPartida !== prevPartidaRef.current) {
            prevPartidaRef.current = newPartida;
            setIsDirty(false);
            if (!selectedAcu) {
                setLocalAcu(null);
                return;
            }
            const loadedRendimiento = selectedAcu.rendimiento || 1;
            setRendimiento(loadedRendimiento);

            // Normalize crew item quantities on load: cantidad = (recursos × horasPerDia) / rendimiento.
            // This ensures the calculation is always consistent with the stored recursos and rendimiento,
            // regardless of whether the data came from a direct import or a previous session with
            // different horasPerDia settings.
            const normalizeItems = (items: ACUComponenteRow[]): ACUComponenteRow[] =>
                items.map((item) => {
                    if (isHerramientasRow(item)) return item;
                    const rec = Number(item.recursos ?? 0);
                    if (rec <= 0) return item; // no recursos data — keep stored cantidad
                    const qty = computeCantidadFromRecursosBase(rec, perDay, hoursPerDay, loadedRendimiento);
                    return { ...item, recursos: rec, cantidad: qty };
                });

            setLocalAcu(recalculateAcu({
                ...selectedAcu,
                mano_de_obra: normalizeItems(selectedAcu.mano_de_obra || []),
                equipos: normalizeItems(selectedAcu.equipos || []),
            }));
        }
    }, [selectedAcu]); // eslint-disable-line react-hooks/exhaustive-deps

    const computeCantidadFromRecursos = (
        recursos: number,
        nextPerDay = perDay,
        nextHoursPerDay = hoursPerDay,
        nextRendimiento = rendimiento,
    ) =>
        computeCantidadFromRecursosBase(
            recursos,
            nextPerDay,
            nextHoursPerDay,
            nextRendimiento,
        );

    const computeRecursosFromCantidad = (
        cantidad: number,
        nextPerDay = perDay,
        nextHoursPerDay = hoursPerDay,
        nextRendimiento = rendimiento,
    ) =>
        computeRecursosFromCantidadBase(
            cantidad,
            nextPerDay,
            nextHoursPerDay,
            nextRendimiento,
        );

    const normalizeCrewItems = (
        items: ACUComponenteRow[],
        nextPerDay = perDay,
        nextHoursPerDay = hoursPerDay,
        nextRendimiento = rendimiento,
    ) =>
        items.map((item) => {
            if (isHerramientasRow(item)) {
                return item;
            }
            const recursos = Number(item.recursos ?? 0) || 0;
            const cantidad = computeCantidadFromRecursos(
                recursos,
                nextPerDay,
                nextHoursPerDay,
                nextRendimiento,
            );

            return { ...item, recursos, cantidad };
        });

    const ensureHerramientasPrecio = (
        items: ACUComponenteRow[],
        manoObraTotal: number,
    ) =>
        items.map((item) =>
            isHerramientasRow(item)
                ? { ...item, precio_hora: manoObraTotal }
                : item,
        );

    const recalcCrewForModeChange = (
        items: ACUComponenteRow[],
        fromPerDay: boolean,
        fromHoursPerDay: number,
        fromRendimiento: number,
        toPerDay: boolean,
        toHoursPerDay: number,
        toRendimiento: number,
    ) =>
        items.map((item) => {
            if (isHerramientasRow(item)) {
                return item;
            }
            const recursos = Number(item.recursos ?? 0) || 0;
            const cantidad = computeCantidadFromRecursosBase(
                recursos,
                toPerDay,
                toHoursPerDay,
                toRendimiento,
            );
            return { ...item, recursos: Number(recursos) || 0, cantidad };
        });

    const handleSave = useCallback(async () => {
        if (!localAcu || !onSaveAcu) return;
        setIsSaving(true);
        const result = await onSaveAcu(localAcu, { updateProjectPrices });
        if (result.success && result.acu) {
            setLocalAcu(result.acu as ACURowSummary);
            setIsDirty(false);
        }
        setIsSaving(false);
    }, [localAcu, onSaveAcu, updateProjectPrices]);

    useEffect(() => {
        if (!isDirty || !localAcu || !onAcuChange) return;

        onAcuChange(localAcu, { updateProjectPrices });
        setIsDirty(false);
    }, [isDirty, localAcu, onAcuChange, updateProjectPrices]);

    const handleAddResourceClick = (type: SectionType) => {
        if (!localAcu) return;
        setSearchTargetType(type);
        setSearchOpen(true);
    };

    const handleResourceSelected = (resource: any) => {
        if (!localAcu || !searchTargetType) return;

        const isCrewType =
            searchTargetType === 'mano_de_obra' ||
            searchTargetType === 'equipos';
        const recursos = isCrewType ? 1 : undefined;
        const cantidad = isCrewType
            ? computeCantidadFromRecursos(recursos ?? 0)
            : 1;

        const newComponent = createAcuComponentFromResource(resource, searchTargetType, cantidad, recursos);

        setLocalAcu((prev) => {
            if (!prev) return prev;
            return recalculateAcu({
                ...prev,
                [searchTargetType]: [
                    ...((prev[searchTargetType as keyof ACURowSummary] as any[]) || []),
                    newComponent,
                ],
            });
        });
        setIsDirty(true);
        setSearchOpen(false);
    };

    const handleUpdateItem = (
        type: SectionType,
        index: number,
        field: string,
        value: string | number,
    ) => {
        setLocalAcu((prev) => {
            if (!prev) return prev;
            const arr = [...((prev[type as keyof ACURowSummary] as any[]) || [])];
            const currentItem = arr[index] || {};
            const isEquipos = type === 'equipos';
            const isHerramientas = isEquipos && isHerramientasRow(currentItem);

            if (field === 'recursos' && (type === 'mano_de_obra' || type === 'equipos')) {
                const recursos = Number(value) || 0;
                const cantidad = computeCantidadFromRecursos(recursos);
                arr[index] = { ...currentItem, recursos, cantidad };
            } else if (isHerramientas && field === 'cantidad') {
                arr[index] = {
                    ...currentItem,
                    cantidad: roundCantidad(Number(value) || 0),
                    precio_hora: prev.costo_mano_obra || 0,
                };
            } else if (field === 'cantidad') {
                arr[index] = { ...currentItem, cantidad: roundCantidad(Number(value) || 0) };
            } else if (field === 'precio_unitario' || field === 'precio_hora') {
                arr[index] = { ...currentItem, [field]: roundPrecio(Number(value) || 0) };
            } else {
                arr[index] = { ...currentItem, [field]: value };
            }

            if (isHerramientas) {
                arr[index] = { ...arr[index], precio_hora: prev.costo_mano_obra || 0 };
            }

            return recalculateAcu({ ...prev, [type]: arr });
        });
        setIsDirty(true);
    };

    const handleDeleteItem = (type: SectionType, index: number) => {
        setLocalAcu((prev) => {
            if (!prev) return prev;
            const arr = [...((prev[type as keyof ACURowSummary] as any[]) || [])];
            arr.splice(index, 1);
            return recalculateAcu({ ...prev, [type]: arr });
        });
        setIsDirty(true);
    };

    const handleUpdateRendimiento = (newRendimiento: number) => {
        const safeRend = Number(newRendimiento);
        if (!safeRend || safeRend <= 0) return;
        setRendimiento(safeRend);
        setLocalAcu((prev) => {
            if (!prev) return prev;
            return recalculateAcu({
                ...prev,
                rendimiento: safeRend,
                mano_de_obra: recalcCrewForModeChange(
                    prev.mano_de_obra || [],
                    perDay, hoursPerDay, rendimiento,
                    perDay, hoursPerDay, safeRend,
                ),
                equipos: ensureHerramientasPrecio(
                    recalcCrewForModeChange(
                        prev.equipos || [],
                        perDay, hoursPerDay, rendimiento,
                        perDay, hoursPerDay, safeRend,
                    ),
                    prev.costo_mano_obra || 0,
                ),
            });
        });
        setIsDirty(true);
    };

    const handleTogglePerDay = (nextPerDay: boolean) => {
        setPerDay(nextPerDay);
        setLocalAcu((prev) => {
            if (!prev) return prev;
            return recalculateAcu({
                ...prev,
                mano_de_obra: recalcCrewForModeChange(
                    prev.mano_de_obra || [],
                    perDay, hoursPerDay, rendimiento,
                    nextPerDay, hoursPerDay, rendimiento,
                ),
                equipos: ensureHerramientasPrecio(
                    recalcCrewForModeChange(
                        prev.equipos || [],
                        perDay, hoursPerDay, rendimiento,
                        nextPerDay, hoursPerDay, rendimiento,
                    ),
                    prev.costo_mano_obra || 0,
                ),
            });
        });
        setIsDirty(true);
    };

    const handleHoursPerDayChange = (nextHoursPerDay: number) => {
        const safeHours = Number(nextHoursPerDay);
        if (!safeHours || safeHours <= 0) return;
        setHoursPerDay(safeHours);
        setLocalAcu((prev) => {
            if (!prev) return prev;
            return recalculateAcu({
                ...prev,
                mano_de_obra: recalcCrewForModeChange(
                    prev.mano_de_obra || [],
                    perDay, hoursPerDay, rendimiento,
                    perDay, safeHours, rendimiento,
                ),
                equipos: ensureHerramientasPrecio(
                    recalcCrewForModeChange(
                        prev.equipos || [],
                        perDay, hoursPerDay, rendimiento,
                        perDay, safeHours, rendimiento,
                    ),
                    prev.costo_mano_obra || 0,
                ),
            });
        });
        setIsDirty(true);
    };

    if (acuLoading) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500 dark:bg-slate-950">
                <p className="text-sm">Cargando ACU...</p>
            </div>
        );
    }

    if (!localAcu) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500 dark:bg-slate-950">
                <Calculator size={40} className="opacity-30" />
                <p className="text-sm">
                    Seleccione una partida para ver el ACU
                </p>
                <p className="max-w-xs text-center text-xs text-slate-500 dark:text-slate-600">
                    (Asegúrese de que la partida tenga una <strong>unidad asignada</strong> en el presupuesto general)
                </p>
            </div>
        );
    }

    const grandTotal = localAcu.costo_unitario_total || 0;

    return (
        <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            {/* Header */}
            <div className="border-b border-slate-300 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-[10px] tracking-widest text-slate-500 uppercase">
                            Análisis de Costo Unitario
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500">Presupuesto:</span>{' '}
                            <span className="font-medium text-sky-600 dark:text-sky-400">
                                PROYECTO
                            </span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500">
                            Hecho por:{' '}
                            <span className="text-slate-700 dark:text-slate-300">
                                Administrador
                            </span>
                        </p>
                        {selectedCell && (
                            <p className="mt-0.5 text-[10px] text-slate-500">
                                Fila:{' '}
                                <span className="text-slate-700 dark:text-slate-300">
                                    {selectedCell.row}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                            {localAcu.partida}
                        </span>
                        {' — '}
                        <span className="text-slate-900 dark:text-slate-200">
                            {localAcu.descripcion}
                        </span>
                    </span>
                </div>
            </div>

            {/* Rendimiento bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                <span className="text-xs text-slate-600 dark:text-slate-400">Rendimiento:</span>
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
                        className="w-20 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-xs text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                        {displayUnit(localAcu.unidad || 'Und.')}
                    </span>
                </div>
                <div className="flex items-center gap-1 overflow-hidden rounded border border-slate-300 dark:border-slate-600">
                    <button
                        onClick={() => handleTogglePerDay(true)}
                        className={`px-2 py-0.5 text-xs transition-colors ${perDay ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Por día
                    </button>
                    <button
                        onClick={() => handleTogglePerDay(false)}
                        className={`px-2 py-0.5 text-xs transition-colors ${!perDay ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Hora
                    </button>
                </div>
                <span className="ml-auto text-[10px] text-slate-500">
                    Horas por Día:
                </span>
                <input
                    type="number"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(Number(e.target.value))}
                    onBlur={(e) =>
                        handleHoursPerDayChange(Number(e.target.value))
                    }
                    className="w-12 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-xs text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
                <div className="ml-auto flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-700/50">
                    <input
                        type="checkbox"
                        id="update-global-prices"
                        checked={updateProjectPrices}
                        onChange={(e) => setUpdateProjectPrices(e.target.checked)}
                        className="h-3 w-3 rounded border-slate-400 bg-white text-sky-500 focus:ring-sky-500 dark:border-slate-500 dark:bg-slate-800 dark:focus:ring-offset-slate-800"
                    />
                    <label htmlFor="update-global-prices" className="cursor-pointer select-none text-[10px] text-slate-700 dark:text-slate-300">
                        Actualizar precio en todo el proyecto
                    </label>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <div className="flex h-full flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-700/80 dark:bg-slate-800/30">
                        <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                            Detalle de Recursos
                        </span>
                        <span className="text-[10px] text-slate-500">
                            Modo: {perDay ? 'Por dia' : 'Por hora'}
                        </span>
                    </div>
                    <table className="w-full table-fixed border-b border-slate-300 bg-slate-100 text-[10px] font-medium tracking-wider text-slate-500 uppercase dark:border-slate-700 dark:bg-slate-800/30">
                        <thead>
                            <tr>
                                <th className="w-28 px-3 py-1.5 text-left">
                                    Cod. Insumo
                                </th>
                                <th className="px-2 py-1.5 text-left">
                                    Descripción
                                </th>
                                <th className="w-12 px-2 py-1.5 text-center">
                                    Und.
                                </th>
                                <th className="w-16 px-2 py-1.5 text-right">
                                    Recur.
                                </th>
                                <th className="w-16 px-2 py-1.5 text-right">
                                    Cant.
                                </th>
                                <th className="w-14 px-2 py-1.5 text-right">
                                    %D.
                                </th>
                                <th className="w-20 px-2 py-1.5 text-right">
                                    Precio
                                </th>
                                <th className="w-20 px-2 py-1.5 pr-3 text-right">
                                    Total
                                </th>
                            </tr>
                        </thead>
                    </table>

                    <div className="scrollbar-thin flex-1 overflow-y-auto border-l border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                        <AcuSection
                            type="mano_de_obra"
                            items={localAcu.mano_de_obra || []}
                            subtotal={localAcu.costo_mano_obra || 0}
                            rendimiento={rendimiento}
                            perDay={perDay}
                            hoursPerDay={hoursPerDay}
                            manoObraTotal={localAcu.costo_mano_obra || 0}
                            onAddClick={handleAddResourceClick}
                            onUpdateItem={handleUpdateItem}
                            onDeleteItem={handleDeleteItem}
                        />
                        <AcuSection
                            type="materiales"
                            items={localAcu.materiales || []}
                            subtotal={localAcu.costo_materiales || 0}
                            rendimiento={rendimiento}
                            perDay={perDay}
                            hoursPerDay={hoursPerDay}
                            manoObraTotal={localAcu.costo_mano_obra || 0}
                            onAddClick={handleAddResourceClick}
                            onUpdateItem={handleUpdateItem}
                            onDeleteItem={handleDeleteItem}
                        />
                        <AcuSection
                            type="equipos"
                            items={localAcu.equipos || []}
                            subtotal={localAcu.costo_equipos || 0}
                            rendimiento={rendimiento}
                            perDay={perDay}
                            hoursPerDay={hoursPerDay}
                            manoObraTotal={localAcu.costo_mano_obra || 0}
                            onAddClick={handleAddResourceClick}
                            onUpdateItem={handleUpdateItem}
                            onDeleteItem={handleDeleteItem}
                        />
                        <AcuSection
                            type="subcontratos"
                            items={localAcu.subcontratos || []}
                            subtotal={localAcu.costo_subcontratos || 0}
                            rendimiento={rendimiento}
                            perDay={perDay}
                            hoursPerDay={hoursPerDay}
                            manoObraTotal={localAcu.costo_mano_obra || 0}
                            onAddClick={handleAddResourceClick}
                            onUpdateItem={handleUpdateItem}
                            onDeleteItem={handleDeleteItem}
                        />
                        <AcuSection
                            type="subpartidas"
                            items={localAcu.subpartidas || []}
                            subtotal={localAcu.costo_subpartidas || 0}
                            rendimiento={rendimiento}
                            perDay={perDay}
                            hoursPerDay={hoursPerDay}
                            manoObraTotal={localAcu.costo_mano_obra || 0}
                            onAddClick={handleAddResourceClick}
                            onUpdateItem={handleUpdateItem}
                            onDeleteItem={handleDeleteItem}
                        />
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 items-center justify-between border-t-2 border-sky-500/60 bg-white px-4 py-2.5 dark:border-sky-600/50 dark:bg-slate-800">
                <span className="text-sm font-bold tracking-wide text-slate-700 dark:text-slate-300">
                    TOTAL ACU.
                </span>
                <div className="flex items-center gap-3">
                    {isDirty && !onAcuChange && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                        >
                            {isSaving && <Loader2 size={11} className="animate-spin" />}
                            Guardar
                        </button>
                    )}
                    <span className="font-mono text-lg font-bold text-sky-400">
                        {fmt(grandTotal)}
                    </span>
                </div>
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
});
