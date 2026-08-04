import { useCallback, useEffect, useRef, useState } from 'react';
import { fixtureCatalog, type FixtureCatalogItem } from '@/pages/dialux/components/catalogData';
import { useEditorStore, type Fixture } from '@/pages/dialux/hooks/useEditorStore';
import {
    deleteProduct as deleteProductRequest,
    fetchImportedProducts,
    fetchPhotometricWeb as fetchPhotometricWebRequest,
    shareProduct as shareProductRequest,
    type ImportedLuminaireProduct,
    type PhotometricWeb,
} from './catalogApi';
import { productToFixtureFields } from './fixtureMappers';

const ITEMS_PER_PAGE = 10;

export interface UseLuminaireCatalogOptions {
    filterBrand?: string;
    search?: string;
    fixtureItemsPerPage?: number;
    showAllInSinglePage?: boolean;
    /** Ver `CatalogPanelProps.applyToFixtureIds` — aplica el modelo elegido a luminarias existentes en vez de entrar en modo "colocar nueva". */
    applyToFixtureIds?: string[];
    onSelect?: () => void;
}

/**
 * Hook de caso de uso del catálogo de luminarias (Fase 2 del plan maestro,
 * extraído de `components/CatalogPanel.tsx` sin cambiar comportamiento):
 * carga de productos importados, compartir/eliminar, caché de fotometría,
 * paginación y aplicación de un modelo elegido al store del editor.
 */
export function useLuminaireCatalog(options: UseLuminaireCatalogOptions) {
    const { filterBrand, search = '', fixtureItemsPerPage, showAllInSinglePage = false, applyToFixtureIds, onSelect } = options;

    const store = useEditorStore();
    const { fixtureTemplate } = store.ui;

    const [importedProducts, setImportedProducts] = useState<ImportedLuminaireProduct[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [sharingProductId, setSharingProductId] = useState<number | null>(null);
    const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
    const [fixturePage, setFixturePage] = useState(1);
    const photometricWebCache = useRef<Map<number, PhotometricWeb | null>>(new Map());
    /** Fase 16: descarta el resultado de una selección vieja si el usuario ya eligió otro producto mientras se esperaba la fotometría (ver `setImportedFixture`). */
    const latestFixtureSelectionRef = useRef(0);

    const loadProducts = useCallback(async () => {
        setIsLoadingProducts(true);
        try {
            setImportedProducts(await fetchImportedProducts());
        } catch (error) {
            console.error('[DIAlux] No se pudo cargar el catalogo importado', error);
        } finally {
            setIsLoadingProducts(false);
        }
    }, []);

    useEffect(() => {
        void loadProducts();
    }, [loadProducts]);

    const fixturePageSize = fixtureItemsPerPage ?? ITEMS_PER_PAGE;

    const filteredFixtures = fixtureCatalog.filter((item) => {
        if (filterBrand && filterBrand !== 'Todas' && item.brand !== filterBrand) return false;
        if (search && !item.label.toLowerCase().includes(search.toLowerCase()) && !item.brand.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });

    const filteredImportedProducts = importedProducts.filter((product) => {
        const brand = product.manufacturer ?? 'Importado';
        if (filterBrand && filterBrand !== 'Todas' && brand !== filterBrand) return false;
        if (
            search &&
            !product.name.toLowerCase().includes(search.toLowerCase()) &&
            !brand.toLowerCase().includes(search.toLowerCase()) &&
            !(product.catalog_number ?? '').toLowerCase().includes(search.toLowerCase())
        ) {
            return false;
        }
        return true;
    });

    const totalFixtures = filteredImportedProducts.length + filteredFixtures.length;
    const fixturePageCount = Math.max(1, Math.ceil(totalFixtures / fixturePageSize));
    const fixturePageStart = (fixturePage - 1) * fixturePageSize;
    const fixturePageEnd = fixturePageStart + fixturePageSize;
    const paginatedImportedProducts = filteredImportedProducts.slice(fixturePageStart, fixturePageEnd);
    const paginatedFixtureStart = Math.max(0, fixturePageStart - filteredImportedProducts.length);
    const paginatedFixtureEnd = Math.max(0, fixturePageEnd - filteredImportedProducts.length);
    const paginatedFixtures = filteredFixtures.slice(paginatedFixtureStart, paginatedFixtureEnd);

    const visibleImportedProducts = showAllInSinglePage ? filteredImportedProducts : paginatedImportedProducts;
    const visibleFixtures = showAllInSinglePage ? filteredFixtures : paginatedFixtures;

    useEffect(() => {
        setFixturePage(1);
    }, [filterBrand, search]);

    useEffect(() => {
        if (fixturePage > fixturePageCount) {
            setFixturePage(fixturePageCount);
        }
    }, [fixturePage, fixturePageCount]);

    const applyFixtureFields = (modelFields: Partial<Fixture>) => {
        if (applyToFixtureIds?.length) {
            store.updateFixtures(applyToFixtureIds, modelFields);
        } else {
            store.setFixtureTemplate(modelFields);
            store.setTool('fixture');
        }
        onSelect?.();
    };

    const setFixture = (item: FixtureCatalogItem) => {
        applyFixtureFields({
            ...item.template,
            name: item.template.name ?? item.label,
            brand: item.template.brand ?? item.brand,
            power: item.template.power ?? item.power,
        });
    };

    const fetchPhotometricWeb = async (productId: number): Promise<PhotometricWeb | null> => {
        if (photometricWebCache.current.has(productId)) {
            return photometricWebCache.current.get(productId) ?? null;
        }
        try {
            const web = await fetchPhotometricWebRequest(productId);
            photometricWebCache.current.set(productId, web);
            return web;
        } catch (error) {
            console.error('[DIAlux] No se pudo cargar la matriz fotométrica del producto', error);
            photometricWebCache.current.set(productId, null);
            return null;
        }
    };

    const setImportedFixture = async (product: ImportedLuminaireProduct) => {
        // Fase 16: la fotometría real ("photometricWeb") se espera ANTES de
        // aplicar el modelo — nunca se coloca una luminaria (individual o en
        // grilla) sin ella cuando el producto sí la tiene. Antes, el modelo
        // se aplicaba de inmediato y `photometricWeb` llegaba después por
        // una promesa en segundo plano; si el usuario dibujaba una grilla
        // (o colocaba una luminaria) ANTES de que esa promesa resolviera —
        // un flujo de UI perfectamente normal y rápido — la(s) luminaria(s)
        // se creaban con `photometricWeb` ausente PARA SIEMPRE, sin ningún
        // error visible: el motor de cálculo caía en la aproximación
        // Lambertiana genérica en vez de la curva real del fabricante,
        // subestimando lux de forma silenciosa. Confirmado contra un
        // proyecto real del usuario (`dialux:repair-photometry`).
        const requestId = ++latestFixtureSelectionRef.current;
        const modelFields = productToFixtureFields(product);
        const photometricWeb = await fetchPhotometricWeb(product.id);
        if (latestFixtureSelectionRef.current !== requestId) {
            // El usuario ya eligió otro producto mientras se esperaba esta
            // fotometría — descartar, para no aplicar datos de un modelo
            // que ya no es la selección vigente.
            return;
        }
        applyFixtureFields(photometricWeb ? { ...modelFields, photometricWeb } : modelFields);
    };

    const toggleShare = async (product: ImportedLuminaireProduct, event: React.MouseEvent) => {
        event.stopPropagation();
        if (sharingProductId !== null) return;

        const nextIsGlobal = !product.is_global;
        setSharingProductId(product.id);
        try {
            const updated = await shareProductRequest(product.id, nextIsGlobal);
            setImportedProducts((products) => products.map((p) => (p.id === product.id ? { ...p, ...updated } : p)));
        } catch (error) {
            console.error('[DIAlux] No se pudo cambiar el estado de compartido', error);
        } finally {
            setSharingProductId(null);
        }
    };

    const deleteProduct = async (product: ImportedLuminaireProduct, event: React.MouseEvent) => {
        event.stopPropagation();
        if (deletingProductId !== null) return;
        if (!window.confirm(`¿Eliminar "${product.name}" del catálogo? Esta acción no se puede deshacer.`)) {
            return;
        }

        setDeletingProductId(product.id);
        try {
            await deleteProductRequest(product.id);
            setImportedProducts((products) => products.filter((p) => p.id !== product.id));
        } catch (error) {
            console.error('[DIAlux] No se pudo eliminar la luminaria', error);
        } finally {
            setDeletingProductId(null);
        }
    };

    const addImportedProduct = (product: ImportedLuminaireProduct) => {
        setImportedProducts((products) => [product, ...products.filter((p) => p.id !== product.id)]);
    };

    return {
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
    };
}
