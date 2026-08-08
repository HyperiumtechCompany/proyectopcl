import axios from 'axios';
import { Globe, Plus, Share2, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    DrawTool,
    ElectricalDeviceProperties,
    ElectricalDeviceType,
} from '@/pages/dialux/hooks/types';
import { DEFAULT_OUTLET_POWER_W } from '@/pages/dialux/hooks/types';
import * as outletProductRoutes from '@/routes/dialux/outlet-products';
import { OUTLET_DEVICE_ITEMS } from './electricalDeviceCatalog';
import { ChipFilter } from './panelControls';
import { PanelCard } from './primitives';

interface OutletProductDto {
    id: number;
    name: string;
    manufacturer: string | null;
    catalog_number: string | null;
    device_type: ElectricalDeviceType;
    rated_power_w: number;
    ip_rating: string | null;
    product_image_path: string | null;
    product_image_url: string | null;
    is_global: boolean;
    is_owner: boolean;
    created_at: string;
}

export interface OutletCatalogSelection {
    tool: DrawTool;
    type: ElectricalDeviceType;
    label: string;
    properties: Partial<ElectricalDeviceProperties>;
}

const getCsrfToken = (): string =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

const getXsrfToken = (): string => {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
};

const getCsrfHeaders = (): Record<string, string> => {
    const xsrfToken = getXsrfToken();
    if (xsrfToken) {
        return { 'X-XSRF-TOKEN': xsrfToken, 'X-Requested-With': 'XMLHttpRequest' };
    }
    return { 'X-CSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' };
};

const DEVICE_TYPE_ITEM_BY_TYPE = new Map(
    OUTLET_DEVICE_ITEMS.filter((item) => item.type.startsWith('outlet_')).map((item) => [item.type, item]),
);

const DEVICE_TYPE_OPTIONS = [...DEVICE_TYPE_ITEM_BY_TYPE.values()];

const emptyForm = {
    name: '',
    manufacturer: '',
    catalog_number: '',
    device_type: DEVICE_TYPE_OPTIONS[0]?.type ?? 'outlet_floor',
    rated_power_w: String(DEFAULT_OUTLET_POWER_W),
    ip_rating: '',
    is_global: false,
};

export function OutletCatalogPanel({
    activeTool,
    onSelect,
}: {
    activeTool: DrawTool;
    onSelect: (selection: OutletCatalogSelection) => void;
}) {
    const [products, setProducts] = useState<OutletProductDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [brand, setBrand] = useState('Todas');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [busyProductId, setBusyProductId] = useState<number | null>(null);

    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get<{ products: OutletProductDto[] }>(
                outletProductRoutes.index.url(),
            );
            setProducts(response.data.products ?? []);
        } catch (error) {
            console.error('[DIAlux] No se pudo cargar el catálogo de tomacorrientes', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadProducts();
    }, [loadProducts]);

    const brands = useMemo(() => {
        const unique = new Set<string>();
        products.forEach((p) => {
            if (p.manufacturer) unique.add(p.manufacturer);
        });
        return ['Todas', ...[...unique].sort()];
    }, [products]);

    const filteredProducts = useMemo(
        () => products.filter((p) => brand === 'Todas' || p.manufacturer === brand),
        [products, brand],
    );

    const pick = (product: OutletProductDto) => {
        const item = DEVICE_TYPE_ITEM_BY_TYPE.get(product.device_type);
        if (!item) return;
        onSelect({
            tool: item.tool,
            type: product.device_type,
            label: product.name,
            properties: {
                ratedPowerW: product.rated_power_w,
                outletProductId: product.id,
                manufacturer: product.manufacturer ?? undefined,
                catalogNumber: product.catalog_number ?? undefined,
            },
        });
    };

    const submitForm = async (event: React.FormEvent) => {
        event.preventDefault();
        const ratedPowerW = Number.parseFloat(form.rated_power_w.replace(',', '.'));
        if (!form.name.trim() || !Number.isFinite(ratedPowerW) || ratedPowerW <= 0) return;

        setSaving(true);
        try {
            const response = await axios.post<{ product: OutletProductDto }>(
                outletProductRoutes.store.url(),
                {
                    name: form.name.trim(),
                    manufacturer: form.manufacturer.trim() || null,
                    catalog_number: form.catalog_number.trim() || null,
                    device_type: form.device_type,
                    rated_power_w: ratedPowerW,
                    ip_rating: form.ip_rating.trim() || null,
                    is_global: form.is_global,
                },
                { headers: { Accept: 'application/json', ...getCsrfHeaders() }, withCredentials: true },
            );
            setProducts((current) => [response.data.product, ...current]);
            setForm(emptyForm);
            setShowForm(false);
        } catch (error) {
            console.error('[DIAlux] No se pudo crear el tomacorriente', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleShare = async (product: OutletProductDto, event: React.MouseEvent) => {
        event.stopPropagation();
        if (busyProductId !== null) return;
        setBusyProductId(product.id);
        try {
            const response = await axios.patch<{ product: OutletProductDto }>(
                outletProductRoutes.share(product.id).url,
                { is_global: !product.is_global },
                { headers: { Accept: 'application/json', ...getCsrfHeaders() }, withCredentials: true },
            );
            setProducts((current) =>
                current.map((p) => (p.id === product.id ? { ...p, ...response.data.product } : p)),
            );
        } catch (error) {
            console.error('[DIAlux] No se pudo cambiar el estado de compartido', error);
        } finally {
            setBusyProductId(null);
        }
    };

    const deleteProduct = async (product: OutletProductDto, event: React.MouseEvent) => {
        event.stopPropagation();
        if (busyProductId !== null) return;
        if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;
        setBusyProductId(product.id);
        try {
            await axios.delete(outletProductRoutes.destroy(product.id).url, {
                headers: { Accept: 'application/json', ...getCsrfHeaders() },
                withCredentials: true,
            });
            setProducts((current) => current.filter((p) => p.id !== product.id));
        } catch (error) {
            console.error('[DIAlux] No se pudo eliminar el tomacorriente', error);
        } finally {
            setBusyProductId(null);
        }
    };

    return (
        <PanelCard title="Catálogo de tomacorrientes">
            <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-amber-700/50 bg-amber-950/20 py-1.5 text-[10px] font-medium text-amber-300 transition-colors hover:bg-amber-900/30"
            >
                {showForm ? <X size={12} /> : <Plus size={12} />}
                {showForm ? 'Cancelar' : 'Crear tomacorriente'}
            </button>

            {showForm && (
                <form
                    onSubmit={submitForm}
                    className="mb-2 flex flex-col gap-1.5 rounded border border-gray-300 dark:border-gray-700/40 bg-gray-200 dark:bg-gray-900/40 p-2"
                >
                    <input
                        type="text"
                        required
                        placeholder="Nombre *"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                        <input
                            type="text"
                            placeholder="Marca"
                            value={form.manufacturer}
                            onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                            className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                        />
                        <input
                            type="text"
                            placeholder="Modelo / código"
                            value={form.catalog_number}
                            onChange={(e) => setForm((f) => ({ ...f, catalog_number: e.target.value }))}
                            className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                        />
                    </div>
                    <select
                        value={form.device_type}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, device_type: e.target.value as ElectricalDeviceType }))
                        }
                        className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                    >
                        {DEVICE_TYPE_OPTIONS.map((item) => (
                            <option key={item.type} value={item.type}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    <div className="grid grid-cols-2 gap-1.5">
                        <input
                            type="number"
                            required
                            min={1}
                            step={10}
                            placeholder="Potencia (W) *"
                            value={form.rated_power_w}
                            onChange={(e) => setForm((f) => ({ ...f, rated_power_w: e.target.value }))}
                            className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                        />
                        <input
                            type="text"
                            placeholder="IP (ej. IP65)"
                            value={form.ip_rating}
                            onChange={(e) => setForm((f) => ({ ...f, ip_rating: e.target.value }))}
                            className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                        />
                    </div>
                    <label className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-600 dark:text-gray-400">
                        <input
                            type="checkbox"
                            checked={form.is_global}
                            onChange={(e) => setForm((f) => ({ ...f, is_global: e.target.checked }))}
                        />
                        Compartir con otros usuarios
                    </label>
                    <button
                        type="submit"
                        disabled={saving}
                        className="h-7 rounded bg-cyan-700/60 text-[11px] font-medium text-cyan-100 transition-colors hover:bg-cyan-600/60 disabled:opacity-50"
                    >
                        {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                </form>
            )}

            {brands.length > 2 && (
                <ChipFilter options={brands} active={brand} onChange={setBrand} />
            )}

            {loading && <p className="py-2 text-center text-[10px] text-gray-600 dark:text-gray-600">Cargando…</p>}

            {!loading && filteredProducts.length === 0 && (
                <p className="py-2 text-center text-[10px] text-gray-600 dark:text-gray-600">
                    No hay tomacorrientes en el catálogo todavía.
                </p>
            )}

            <div className="grid grid-cols-2 gap-1.5">
                {filteredProducts.map((product) => {
                    const item = DEVICE_TYPE_ITEM_BY_TYPE.get(product.device_type);
                    const isActive = activeTool === item?.tool;
                    return (
                        <button
                            key={product.id}
                            type="button"
                            onClick={() => pick(product)}
                            title={product.name}
                            className={`flex flex-col gap-1 rounded border p-1.5 text-left transition-colors ${
                                isActive
                                    ? (item?.activeClass ?? 'border-cyan-500 bg-cyan-900/40 text-cyan-200')
                                    : 'border-gray-300 dark:border-gray-700/50 bg-gray-200 dark:bg-gray-800/40 text-gray-700 dark:text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:bg-gray-700/60'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className={`text-[11px] font-bold ${item?.symbolClass ?? 'text-gray-600 dark:text-gray-600 dark:text-gray-400'}`}>
                                    {item?.symbol ?? '?'}
                                </span>
                                <div className="flex items-center gap-1">
                                    {product.is_owner && (
                                        <>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => toggleShare(product, e)}
                                                title={product.is_global ? 'Compartido' : 'Compartir'}
                                                className={product.is_global ? 'text-emerald-400' : 'text-gray-600 dark:text-gray-600 hover:text-gray-700 dark:text-gray-700 dark:text-gray-300'}
                                            >
                                                {product.is_global ? <Globe size={11} /> : <Share2 size={11} />}
                                            </span>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => deleteProduct(product, e)}
                                                title="Eliminar"
                                                className="text-gray-600 dark:text-gray-600 hover:text-red-400"
                                            >
                                                <Trash2 size={11} />
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <span className="truncate text-[10px] font-medium">{product.name}</span>
                            <span className="truncate text-[9px] text-gray-500 dark:text-gray-500">
                                {product.manufacturer ?? 'Genérico'} · {product.rated_power_w} W
                            </span>
                        </button>
                    );
                })}
            </div>
        </PanelCard>
    );
}
