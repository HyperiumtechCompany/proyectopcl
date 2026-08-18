import { FileUp, Globe, Pencil, Share2, Trash2, Upload, Wrench } from 'lucide-react';
import { useState } from 'react';
import { isFixtureMatch, type FixtureCatalogItem } from '@/pages/dialux/components/catalogData';
import type { ImportedLuminaireProduct } from './catalogApi';
import { EditImportedLuminaireModal } from './EditImportedLuminaireModal';
import { isImportedProductActive } from './fixtureMappers';
import { ImportPhotometryForm } from './ImportPhotometryForm';
import { ManualLuminaireForm } from './ManualLuminaireForm';
import { useLuminaireCatalog, type UseLuminaireCatalogOptions } from './useLuminaireCatalog';

/**
 * Sección de catálogo de luminarias (importadas + catálogo estático),
 * extraída de `components/CatalogPanel.tsx` (Fase 2) sin cambiar
 * comportamiento visual ni de red — mismo JSX, mismas clases, misma lógica
 * de paginación/grid compacto, ahora repartida en `useLuminaireCatalog`
 * (caso de uso) + `ImportPhotometryForm`/`ManualLuminaireForm` (formularios).
 */

export interface LuminaireCatalogSectionProps extends UseLuminaireCatalogOptions {
    isCompactFixtureGrid: boolean;
}

export function LuminaireCatalogSection({ isCompactFixtureGrid, ...hookOptions }: LuminaireCatalogSectionProps) {
    const [importMode, setImportMode] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ImportedLuminaireProduct | null>(null);
    // Luminarias con archivo real (source_format !== 'manual') se editan con
    // el modal rico (CDL polar/UGR/tipo de lámpara) — `EditImportedLuminaireModal`,
    // no con `ManualLuminaireForm` (que sigue siendo el editor correcto para
    // las manuales/sintéticas, que no tienen esos diagramas que mostrar).
    const [editingImportedProductId, setEditingImportedProductId] = useState<number | null>(null);
    // Ronda 21e (request C): las luminarias del catálogo estático (`fixtureCatalog`)
    // no tienen LDT/IES real — usan una curva sintética genérica, y el cliente
    // que las usa para su cálculo final termina con resultados que no cuadran.
    // "Subir archivo real" abre el mismo flujo de importación, precargado con
    // el nombre/marca del ítem estático, y el resultado es un producto real,
    // editable/eliminable/compartible — nunca modifica el ítem estático en sí.
    const [upgradingFixture, setUpgradingFixture] = useState<FixtureCatalogItem | null>(null);

    const catalog = useLuminaireCatalog({ ...hookOptions, showAllInSinglePage: isCompactFixtureGrid });
    const {
        fixtureTemplate,
        isLoadingProducts,
        sharingProductId,
        deletingProductId,
        filteredFixtures,
        filteredImportedProducts,
        visibleFixtures,
        visibleImportedProducts,
        paginatedFixtures,
        paginatedImportedProducts,
        totalFixtures,
        fixturePage,
        fixturePageCount,
        fixturePageSize,
        setFixturePage,
        setFixture,
        setImportedFixture,
        toggleShare,
        deleteProduct,
        addImportedProduct,
    } = catalog;

    return (
        <div className="space-y-1.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-xs font-semibold tracking-[0.12em] text-amber-700 uppercase dark:text-amber-500">
                    Luminarias ({filteredImportedProducts.length + filteredFixtures.length})
                </p>
                <button
                    type="button"
                    onClick={() => setImportMode((v) => !v)}
                    title="Importar catálogo IES / LDT (próximamente)"
                    className="hidden"
                >
                    <Upload size={9} />
                    IES/LDT
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setImportMode((v) => !v);
                        setManualMode(false);
                        setEditingProduct(null);
                        setUpgradingFixture(null);
                    }}
                    title="Importar catalogo IES / LDT"
                    className={`${isCompactFixtureGrid ? 'hidden' : 'flex'} items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-amber-700 dark:hover:text-amber-300`}
                >
                    <Upload size={9} />
                    IES/LDT
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setManualMode((v) => !v);
                        setImportMode(false);
                        setEditingProduct(null);
                    }}
                    title="Crear luminaria propia con datos manuales"
                    className={`${isCompactFixtureGrid ? 'hidden' : 'flex'} items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-amber-700 dark:hover:text-amber-300`}
                >
                    <Wrench size={9} />
                    Manual
                </button>
            </div>

            {importMode && (
                <div className="hidden">
                    <p className="text-[9px] text-amber-300/80">Importación IES/LDT</p>
                    <p className="mt-0.5 text-[8px] text-gray-600 dark:text-gray-600">Disponible próximamente</p>
                    <button
                        type="button"
                        className="mt-1.5 flex w-full cursor-not-allowed items-center justify-center gap-1 rounded bg-amber-800/40 py-1 text-[9px] text-amber-200 opacity-50"
                        disabled
                    >
                        <Upload size={9} />
                        Seleccionar archivo .ies / .ldt
                    </button>
                </div>
            )}

            {importMode && (
                <ImportPhotometryForm
                    key={upgradingFixture?.label ?? 'blank'}
                    isLoadingProducts={isLoadingProducts}
                    initialName={upgradingFixture?.label}
                    initialManufacturer={upgradingFixture && upgradingFixture.brand !== 'Catálogo' ? upgradingFixture.brand : undefined}
                    onImported={(product) => {
                        addImportedProduct(product);
                        setUpgradingFixture(null);
                    }}
                />
            )}

            {manualMode && <ManualLuminaireForm onCreated={addImportedProduct} />}
            {editingProduct && (
                <ManualLuminaireForm
                    key={editingProduct.id}
                    product={editingProduct}
                    onCancel={() => setEditingProduct(null)}
                    onCreated={(product) => {
                        addImportedProduct(product);
                        setEditingProduct(null);
                    }}
                />
            )}
            {editingImportedProductId !== null && (
                <EditImportedLuminaireModal
                    key={editingImportedProductId}
                    productId={editingImportedProductId}
                    onCancel={() => setEditingImportedProductId(null)}
                    onSaved={(product) => {
                        addImportedProduct(product);
                        setEditingImportedProductId(null);
                    }}
                />
            )}

            {isCompactFixtureGrid && (
                <div className="grid min-h-[17.5rem] grid-cols-3 grid-rows-5 gap-1">
                    {visibleImportedProducts.map((product) => {
                        const isActive = isImportedProductActive(product, fixtureTemplate);

                        return (
                            <button
                                key={`imported-${product.id}`}
                                type="button"
                                onClick={() => setImportedFixture(product)}
                                className={`group flex min-h-13 flex-col items-center justify-center gap-1 rounded border px-1 py-1 text-center transition-colors ${
                                    isActive
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-900/30 dark:text-emerald-200'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                                }`}
                                title={product.name}
                            >
                                {product.product_image_url ? (
                                    <img src={product.product_image_url} alt="" className="h-5 w-5 rounded object-cover" />
                                ) : (
                                    <Upload size={14} className="text-emerald-500 dark:text-emerald-400" />
                                )}
                                <span className="line-clamp-2 max-w-full text-[9px] leading-tight" title={product.manufacturer ? `${product.manufacturer} - ${product.name}` : product.name}>
                                    {product.manufacturer && <span className="block text-[7px] font-bold text-emerald-600/80 dark:text-emerald-400/80">{product.manufacturer.toUpperCase()}</span>}
                                    {product.name}
                                </span>
                                <span className="text-[8px] leading-none text-slate-400 dark:text-gray-500">
                                    {product.total_lumens ?? '-'}lm
                                    {product.power_watts ? ` · ${product.power_watts}W` : ''}
                                </span>
                            </button>
                        );
                    })}

                    {visibleFixtures.map((item, i) => {
                        const isActive = isFixtureMatch(item.template, fixtureTemplate);

                        return (
                            <button
                                key={`${item.brand}-${item.label}-${i}`}
                                type="button"
                                onClick={() => setFixture(item)}
                                className={`group flex min-h-13 flex-col items-center justify-center gap-1 rounded border px-1 py-1 text-center transition-colors ${
                                    isActive
                                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-600/50 dark:bg-amber-900/30 dark:text-amber-200'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                                }`}
                                title={item.label}
                            >
                                <span className={`shrink-0 ${isActive ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-600 dark:group-hover:text-gray-400'}`}>
                                    {item.icon}
                                </span>
                                <span className="line-clamp-2 max-w-full text-[9px] leading-tight" title={`${item.brand} - ${item.label}`}>
                                    <span className="block text-[7px] font-bold text-amber-600/80 dark:text-amber-400/80">{item.brand.toUpperCase()}</span>
                                    {item.label}
                                </span>
                                <span className="text-[8px] leading-none text-slate-400 dark:text-gray-500">
                                    {item.lumens}lm
                                    {item.power ? ` · ${item.power}W` : ''}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {!isCompactFixtureGrid && paginatedImportedProducts.length > 0 && (
                <div className="mb-1 space-y-0.5">
                    <p className="px-1 text-[8px] font-semibold tracking-widest text-emerald-500/80 uppercase">
                        Importadas ({filteredImportedProducts.length})
                    </p>
                    {paginatedImportedProducts.map((product) => {
                        const isActive = isImportedProductActive(product, fixtureTemplate);
                        const effLmW =
                            product.power_watts && product.total_lumens
                                ? (product.total_lumens / product.power_watts).toFixed(0)
                                : null;

                        return (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => setImportedFixture(product)}
                                className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span className={`shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-600 dark:text-gray-600 dark:text-gray-400'}`}>
                                    {product.product_image_url ? (
                                        <img
                                            src={product.product_image_url}
                                            alt=""
                                            className="h-10 w-10 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                                        />
                                    ) : (
                                        <Upload size={13} />
                                    )}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase">{product.manufacturer ?? 'Importado'}</p>
                                    <p className="truncate text-xs leading-snug font-semibold">{product.name}</p>
                                    <p className="mt-1 truncate text-xs leading-snug text-slate-500 dark:text-slate-400">
                                        {product.total_lumens ?? '-'}lm
                                        {effLmW ? ` · ${effLmW}lm/W` : ''}
                                        {product.cct ? ` · ${product.cct}` : ''}
                                        {product.source_format ? ` · ${product.source_format.toUpperCase()}` : ''}
                                    </p>
                                </div>
                                {product.is_owner ? (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => toggleShare(product, event)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                toggleShare(product, event as unknown as React.MouseEvent);
                                            }
                                        }}
                                        title={
                                            product.is_global
                                                ? 'Compartida con todos los usuarios (clic para dejar de compartir)'
                                                : 'Compartir con todos los usuarios'
                                        }
                                        className={`shrink-0 rounded p-1 transition-colors ${
                                            product.is_global
                                                ? 'text-sky-400 hover:bg-sky-900/40'
                                                : 'text-gray-600 dark:text-gray-600 hover:bg-gray-300 dark:bg-gray-700/60 hover:text-gray-700 dark:text-gray-700 dark:text-gray-300'
                                        } ${sharingProductId === product.id ? 'opacity-50' : ''}`}
                                    >
                                        {product.is_global ? <Globe size={12} /> : <Share2 size={12} />}
                                    </span>
                                ) : (
                                    product.is_global && (
                                        <span
                                            className="shrink-0 rounded bg-sky-900/40 p-1 text-sky-400"
                                            title="Compartida por otro usuario"
                                        >
                                            <Globe size={12} />
                                        </span>
                                    )
                                )}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setManualMode(false);
                                        setImportMode(false);
                                        if (product.source_format === 'manual') {
                                            setEditingImportedProductId(null);
                                            setEditingProduct(product);
                                        } else {
                                            setEditingProduct(null);
                                            setEditingImportedProductId(product.id);
                                        }
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            if (product.source_format === 'manual') {
                                                setEditingImportedProductId(null);
                                                setEditingProduct(product);
                                            } else {
                                                setEditingProduct(null);
                                                setEditingImportedProductId(product.id);
                                            }
                                        }
                                    }}
                                    title="Editar esta luminaria"
                                    className="shrink-0 rounded p-1 text-gray-500 dark:text-gray-500 transition-colors hover:bg-amber-900/40 hover:text-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400"
                                >
                                    <Pencil size={12} />
                                </span>
                                {product.is_owner && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => deleteProduct(product, event)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                deleteProduct(product, event as unknown as React.MouseEvent);
                                            }
                                        }}
                                        title="Eliminar esta luminaria"
                                        className={`shrink-0 rounded p-1 text-gray-600 dark:text-gray-600 transition-colors hover:bg-red-900/40 hover:text-red-400 ${deletingProductId === product.id ? 'opacity-50' : ''}`}
                                    >
                                        <Trash2 size={12} />
                                    </span>
                                )}
                                {isActive && (
                                    <span className="shrink-0 rounded bg-emerald-900/50 px-1 py-0.5 text-[8px] text-emerald-400">●</span>
                                )}
                            </button>
                        );
                    })}
                    {paginatedFixtures.length > 0 && <div className="my-1 border-t border-gray-300 dark:border-gray-700/40" />}
                </div>
            )}

            {!isCompactFixtureGrid &&
                paginatedFixtures.map((item, i) => {
                    const isActive = isFixtureMatch(item.template, fixtureTemplate);
                    const effLmW = item.power ? (item.lumens / item.power).toFixed(0) : null;
                    return (
                        <div
                            key={`${item.brand}-${item.label}-${i}`}
                            className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${
                                isActive
                                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                            }`}
                        >
                            <button type="button" onClick={() => setFixture(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                <span className={`shrink-0 ${isActive ? 'text-amber-400' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-600 dark:text-gray-600 dark:text-gray-400'}`}>
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[9px] font-bold text-amber-600/80 dark:text-amber-400/80 uppercase">{item.brand}</p>
                                    <p className="truncate text-xs leading-snug font-semibold">{item.label}</p>
                                    <p className="mt-1 truncate text-xs leading-snug text-slate-500 dark:text-slate-400">
                                        {item.lumens}lm
                                        {effLmW ? ` · ${effLmW}lm/W` : ''}
                                        {item.cct ? ` · ${item.cct}` : ''}
                                    </p>
                                </div>
                            </button>
                            {isActive && <span className="shrink-0 rounded bg-amber-900/50 px-1 py-0.5 text-[8px] text-amber-400">●</span>}
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setManualMode(false);
                                    setEditingProduct(null);
                                    setEditingImportedProductId(null);
                                    setUpgradingFixture(item);
                                    setImportMode(true);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setManualMode(false);
                                        setEditingProduct(null);
                                        setEditingImportedProductId(null);
                                        setUpgradingFixture(item);
                                        setImportMode(true);
                                    }
                                }}
                                title="Esta luminaria es genérica (curva sintética, no LDT/IES real). Sube el archivo del fabricante para reemplazarla por un producto real y preciso en tu catálogo."
                                className="shrink-0 rounded p-1 text-gray-500 dark:text-gray-500 transition-colors hover:bg-amber-900/40 hover:text-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400"
                            >
                                <FileUp size={12} />
                            </span>
                        </div>
                    );
                })}

            {!isCompactFixtureGrid && totalFixtures > fixturePageSize && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setFixturePage((page) => Math.max(1, page - 1))}
                        disabled={fixturePage === 1}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    >
                        Anterior
                    </button>
                    <span className="text-xs text-slate-500">
                        Pagina {fixturePage} de {fixturePageCount}
                    </span>
                    <button
                        type="button"
                        onClick={() => setFixturePage((page) => Math.min(fixturePageCount, page + 1))}
                        disabled={fixturePage === fixturePageCount}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-200 dark:bg-slate-800 dark:hover:text-slate-900 dark:text-slate-100"
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    );
}
