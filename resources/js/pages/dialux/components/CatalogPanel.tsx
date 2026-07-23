import axios from 'axios';
import { Globe, Share2, Trash2, Upload, Wrench } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CorridorConfig } from '@/pages/dialux/hooks/types';
import type { Fixture, Window, Door, LightSwitch, JunctionBox } from '@/pages/dialux/hooks/useEditorStore';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import * as productRoutes from '@/routes/dialux/products';
import {
    corridorCatalog,
    doorCatalog,
    fixtureCatalog,
    isCorridorMatch,
    isDoorMatch,
    isFixtureMatch,
    isWindowMatch,
    junctionBoxCatalog,
    switchCatalog,
    windowCatalog,
} from './catalogData';
import type {
    FixtureCatalogItem,
    JunctionBoxCatalogItem,
    SwitchCatalogItem,
} from './catalogData';

interface CatalogPanelProps {
    filterCategory?:
        | 'luminaires'
        | 'windows'
        | 'doors'
        | 'corridors'
        | 'architecture'
        | 'switches'
        | 'junctionboxes';
    filterBrand?: string;
    filterMaterial?: string;
    search?: string;
    onSelect?: () => void;
    variant?: 'default' | 'compact-grid';
    fixtureItemsPerPage?: number;
    /**
     * Cuando se pasa, seleccionar una luminaria del catálogo NO entra en modo
     * "colocar nueva luminaria": en su lugar aplica el modelo (lúmenes,
     * potencia, tipo, forma, catalogSymbol, etc.) a estas luminarias ya
     * existentes, sin tocar su posición. Usado por el selector de "Cambiar
     * modelo" en Propiedades (una luminaria o un grupo completo).
     */
    applyToFixtureIds?: string[];
}

const ITEMS_PER_PAGE = 10;

/* ─── Catálogo de luminarias ─────────────────────────────────────────────── */


interface ImportedLuminaireProduct {
    id: number;
    name: string;
    manufacturer: string | null;
    catalog_number: string | null;
    source_format: 'ies' | 'ldt' | 'gldf' | 'manual';
    total_lumens: number | null;
    power_watts: number | null;
    cct: string | null;
    fixture_type: string | null;
    fixture_shape: string | null;
    efficiency: number | null;
    product_image_url?: string | null;
    brand_logo_url?: string | null;
    /** true si el propio usuario la compartió (is_global en backend) — visible para todos */
    is_global?: boolean;
    /** true si el producto pertenece al usuario autenticado (puede compartirla/eliminarla) */
    is_owner?: boolean;
    report_data?: {
        technical_table?: Array<{ label: string; value: string }>;
        warnings?: string[];
    } | null;
    report_assets?: {
        polar_svg?: string | null;
    } | null;
    dimensions?: { length: number; width: number; height: number } | null;
}

type PhotometricWeb = NonNullable<Fixture['photometricWeb']>;

const getCsrfToken = (): string =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.content ?? '';

const getXsrfToken = (): string => {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));

    return cookie
        ? decodeURIComponent(cookie.split('=').slice(1).join('='))
        : '';
};

const getCsrfHeaders = (): Record<string, string> => {
    const xsrfToken = getXsrfToken();
    if (xsrfToken) {
        return {
            'X-XSRF-TOKEN': xsrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        };
    }

    return {
        'X-CSRF-TOKEN': getCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
    };
};

const toFixtureType = (
    value: string | null | undefined,
): Fixture['fixtureType'] => {
    const allowed: Fixture['fixtureType'][] = [
        'recessed',
        'pendant',
        'surface',
        'spot',
        'strip',
        'panel',
        'tube',
    ];

    return allowed.includes(value as Fixture['fixtureType'])
        ? (value as Fixture['fixtureType'])
        : 'panel';
};

const toFixtureShape = (
    value: string | null | undefined,
): Fixture['fixtureShape'] => {
    const allowed: NonNullable<Fixture['fixtureShape']>[] = [
        'round',
        'square',
        'rectangular',
        'cylindrical',
    ];

    return allowed.includes(value as NonNullable<Fixture['fixtureShape']>)
        ? (value as Fixture['fixtureShape'])
        : 'rectangular';
};

/* ─── Componente principal ───────────────────────────────────────────────── */

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
    filterCategory,
    filterBrand,
    filterMaterial,
    search = '',
    onSelect,
    variant = 'default',
    fixtureItemsPerPage,
    applyToFixtureIds,
}) => {
    const store = useEditorStore();
    const { fixtureTemplate, windowTemplate, doorTemplate, corridorTemplate } =
        store.ui;
    const [architectureTab, setArchitectureTab] = useState<
        'corridors' | 'windows' | 'doors'
    >('corridors');
    const [importMode, setImportMode] = useState(false);
    const [importedProducts, setImportedProducts] = useState<
        ImportedLuminaireProduct[]
    >([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [sharingProductId, setSharingProductId] = useState<number | null>(
        null,
    );
    const [deletingProductId, setDeletingProductId] = useState<
        number | null
    >(null);
    const photometricWebCache = useRef<Map<number, PhotometricWeb | null>>(
        new Map(),
    );
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [productName, setProductName] = useState('');
    const [manufacturerName, setManufacturerName] = useState('');
    const [productImage, setProductImage] = useState<File | null>(null);
    const [brandLogo, setBrandLogo] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [manualMode, setManualMode] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualManufacturer, setManualManufacturer] = useState('');
    const [manualCatalogNumber, setManualCatalogNumber] = useState('');
    const [manualTotalLumens, setManualTotalLumens] = useState('');
    const [manualPowerWatts, setManualPowerWatts] = useState('');
    const [manualCct, setManualCct] = useState('');
    const [manualCriRa, setManualCriRa] = useState('');
    const [manualBeamAngle50, setManualBeamAngle50] = useState('');
    const [manualUseCustomCurve, setManualUseCustomCurve] = useState(false);
    const [manualCurvePoints, setManualCurvePoints] = useState<
        Array<{ gamma: string; candela: string }>
    >([
        { gamma: '0', candela: '' },
        { gamma: '30', candela: '' },
        { gamma: '60', candela: '' },
        { gamma: '90', candela: '' },
    ]);
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);
    const [manualError, setManualError] = useState<string | null>(null);
    const [manualMessage, setManualMessage] = useState<string | null>(null);
    const [fixturePage, setFixturePage] = useState(1);

    const showFixtures = filterCategory === 'luminaires' || !filterCategory;
    const showSwitches = filterCategory === 'switches' || !filterCategory;
    const showJunctionBoxes = filterCategory === 'junctionboxes' || !filterCategory;
    const showCorridors =
        filterCategory === 'corridors' ||
        filterCategory === 'architecture' ||
        !filterCategory;
    const showWindows =
        filterCategory === 'windows' ||
        filterCategory === 'architecture' ||
        !filterCategory;
    const showDoors =
        filterCategory === 'doors' ||
        filterCategory === 'architecture' ||
        !filterCategory;
    const isCompactFixtureGrid =
        variant === 'compact-grid' && filterCategory === 'luminaires';
    const fixturePageSize = fixtureItemsPerPage ?? ITEMS_PER_PAGE;

    const filteredFixtures = fixtureCatalog.filter((item) => {
        if (
            filterBrand &&
            filterBrand !== 'Todas' &&
            item.brand !== filterBrand
        )
            return false;
        if (
            search &&
            !item.label.toLowerCase().includes(search.toLowerCase()) &&
            !item.brand.toLowerCase().includes(search.toLowerCase())
        )
            return false;
        return true;
    });

    const filteredWindows = windowCatalog.filter((item) => {
        if (
            filterMaterial &&
            filterMaterial !== 'Todos' &&
            item.material !== filterMaterial
        )
            return false;
        if (search && !item.label.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });

    const filteredDoors = doorCatalog.filter((item) => {
        if (search && !item.label.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });

    const filteredCorridors = corridorCatalog.filter((item) => {
        if (
            search &&
            !item.label.toLowerCase().includes(search.toLowerCase()) &&
            !item.description.toLowerCase().includes(search.toLowerCase())
        ) {
            return false;
        }

        return true;
    });

    const filteredSwitches = switchCatalog.filter((item) =>
        !search || item.label.toLowerCase().includes(search.toLowerCase()),
    );

    const filteredJunctionBoxes = junctionBoxCatalog.filter((item) =>
        !search || item.label.toLowerCase().includes(search.toLowerCase()),
    );

    const loadProducts = useCallback(async () => {
        setIsLoadingProducts(true);

        try {
            const response = await axios.get<{
                products: ImportedLuminaireProduct[];
            }>(productRoutes.index.url());

            setImportedProducts(response.data.products ?? []);
        } catch (error) {
            console.error(
                '[DIAlux] No se pudo cargar el catalogo importado',
                error,
            );
        } finally {
            setIsLoadingProducts(false);
        }
    }, []);

    const toggleShare = async (
        product: ImportedLuminaireProduct,
        event: React.MouseEvent,
    ) => {
        event.stopPropagation();
        if (sharingProductId !== null) return;

        const nextIsGlobal = !product.is_global;
        setSharingProductId(product.id);

        try {
            const response = await axios.patch<{
                product: ImportedLuminaireProduct;
            }>(
                productRoutes.share(product.id).url,
                { is_global: nextIsGlobal },
                {
                    headers: {
                        Accept: 'application/json',
                        ...getCsrfHeaders(),
                    },
                    withCredentials: true,
                },
            );

            setImportedProducts((products) =>
                products.map((p) =>
                    p.id === product.id ? { ...p, ...response.data.product } : p,
                ),
            );
        } catch (error) {
            console.error(
                '[DIAlux] No se pudo cambiar el estado de compartido',
                error,
            );
        } finally {
            setSharingProductId(null);
        }
    };

    const deleteProduct = async (
        product: ImportedLuminaireProduct,
        event: React.MouseEvent,
    ) => {
        event.stopPropagation();
        if (deletingProductId !== null) return;
        if (
            !window.confirm(
                `¿Eliminar "${product.name}" del catálogo? Esta acción no se puede deshacer.`,
            )
        ) {
            return;
        }

        setDeletingProductId(product.id);

        try {
            await axios.delete(productRoutes.destroy(product.id).url, {
                headers: {
                    Accept: 'application/json',
                    ...getCsrfHeaders(),
                },
                withCredentials: true,
            });

            setImportedProducts((products) =>
                products.filter((p) => p.id !== product.id),
            );
        } catch (error) {
            console.error('[DIAlux] No se pudo eliminar la luminaria', error);
        } finally {
            setDeletingProductId(null);
        }
    };

    useEffect(() => {
        if (showFixtures) {
            void loadProducts();
        }
    }, [loadProducts, showFixtures]);

    const filteredImportedProducts = importedProducts.filter((product) => {
        const brand = product.manufacturer ?? 'Importado';
        if (filterBrand && filterBrand !== 'Todas' && brand !== filterBrand)
            return false;
        if (
            search &&
            !product.name.toLowerCase().includes(search.toLowerCase()) &&
            !brand.toLowerCase().includes(search.toLowerCase()) &&
            !(product.catalog_number ?? '')
                .toLowerCase()
                .includes(search.toLowerCase())
        ) {
            return false;
        }

        return true;
    });

    const totalFixtures =
        filteredImportedProducts.length + filteredFixtures.length;
    const fixturePageCount = Math.max(
        1,
        Math.ceil(totalFixtures / fixturePageSize),
    );
    const fixturePageStart = (fixturePage - 1) * fixturePageSize;
    const fixturePageEnd = fixturePageStart + fixturePageSize;
    const paginatedImportedProducts = filteredImportedProducts.slice(
        fixturePageStart,
        fixturePageEnd,
    );
    const paginatedFixtureStart = Math.max(
        0,
        fixturePageStart - filteredImportedProducts.length,
    );
    const paginatedFixtureEnd = Math.max(
        0,
        fixturePageEnd - filteredImportedProducts.length,
    );
    const paginatedFixtures = filteredFixtures.slice(
        paginatedFixtureStart,
        paginatedFixtureEnd,
    );
    const visibleImportedProducts = isCompactFixtureGrid
        ? filteredImportedProducts
        : paginatedImportedProducts;
    const visibleFixtures = isCompactFixtureGrid
        ? filteredFixtures
        : paginatedFixtures;

    useEffect(() => {
        setFixturePage(1);
    }, [filterBrand, search]);

    useEffect(() => {
        if (fixturePage > fixturePageCount) {
            setFixturePage(fixturePageCount);
        }
    }, [fixturePage, fixturePageCount]);

    const setFixture = (item: FixtureCatalogItem) => {
        const modelFields: Partial<Fixture> = {
            ...item.template,
            name: item.template.name ?? item.label,
            brand: item.template.brand ?? item.brand,
            power: item.template.power ?? item.power,
        };
        if (applyToFixtureIds?.length) {
            store.updateFixtures(applyToFixtureIds, modelFields);
        } else {
            store.setFixtureTemplate(modelFields);
            store.setTool('fixture');
        }
        onSelect?.();
    };

    const setSwitch = (item: SwitchCatalogItem) => {
        store.setSwitchTemplate({ type: item.type, mountingHeight: 1.4, label: item.switchLabel });
        store.setTool('switch');
        onSelect?.();
    };

    const setJunctionBox = (item: JunctionBoxCatalogItem) => {
        store.setJunctionBoxTemplate({ size: item.size });
        store.setTool('wire');
        onSelect?.();
    };

    const fetchPhotometricWeb = async (
        productId: number,
    ): Promise<PhotometricWeb | null> => {
        if (photometricWebCache.current.has(productId)) {
            return photometricWebCache.current.get(productId) ?? null;
        }

        try {
            const response = await axios.get<{
                product: ImportedLuminaireProduct & {
                    photometric_web?: PhotometricWeb | null;
                };
            }>(productRoutes.show({ productId }).url);
            const web = response.data.product.photometric_web ?? null;
            photometricWebCache.current.set(productId, web);
            return web;
        } catch (error) {
            console.error(
                '[DIAlux] No se pudo cargar la matriz fotométrica del producto',
                error,
            );
            photometricWebCache.current.set(productId, null);
            return null;
        }
    };

    const setImportedFixture = (product: ImportedLuminaireProduct) => {
        const lumens = product.total_lumens ?? 1000;
        const power = product.power_watts ?? undefined;

        const modelFields: Partial<Fixture> = {
            fixtureType: toFixtureType(product.fixture_type),
            fixtureShape: toFixtureShape(product.fixture_shape),
            lumens,
            power,
            efficiency:
                product.efficiency && product.efficiency > 0
                    ? Math.min(1, product.efficiency / 100)
                    : 0.85,
            lightColor: product.cct?.startsWith('3') ? '#fff5e1' : '#f0f8ff',
            brand: product.manufacturer ?? undefined,
            articleNumber: product.catalog_number ?? undefined,
            productId: product.id,
            productSourceFormat: product.source_format,
            reportData: product.report_data ?? null,
            reportAssets: {
                ...(product.report_assets ?? {}),
                product_photo_url: product.product_image_url ?? null,
                brand_logo_url: product.brand_logo_url ?? null,
            },
            dimensions: product.dimensions ?? undefined,
            name: product.name,
        };

        // Aplica de inmediato con los datos que ya tenemos (lúmenes, tipo,
        // forma, etc.) en vez de esperar la red: `photometricWeb` solo hace
        // falta para el render de distribución fotométrica detallada, no
        // para elegir el modelo ni para el cálculo de lúmenes de la grilla.
        // Antes este `await` bloqueaba TODA la actualización visible detrás
        // de un round-trip HTTP — cualquier lentitud del backend (arranque
        // en frío de PHP, antivirus, etc.) se sentía como "elegí la
        // luminaria y no pasó nada" durante ese tiempo entero.
        const targetIds = applyToFixtureIds?.length ? [...applyToFixtureIds] : null;
        if (targetIds) {
            store.updateFixtures(targetIds, modelFields);
        } else {
            store.setFixtureTemplate(modelFields);
            store.setTool('fixture');
        }
        onSelect?.();

        void fetchPhotometricWeb(product.id).then((photometricWeb) => {
            if (!photometricWeb) return;
            // Se lee el estado ACTUAL (no el `store` cerrado sobre el render
            // de este clic) porque para cuando esta promesa resuelve puede
            // haber pasado un buen rato — usar el snapshot viejo aquí
            // aplicaría la web fotométrica sobre una plantilla ya obsoleta.
            const liveUi = useEditorStore.getState().ui;
            if (targetIds) {
                store.updateFixtures(targetIds, { photometricWeb });
            } else if (liveUi.fixtureTemplate.productId === product.id) {
                // Solo si el usuario no eligió otro producto mientras tanto.
                store.setFixtureTemplate({
                    ...liveUi.fixtureTemplate,
                    photometricWeb,
                });
            }
        });
    };

    const submitProductImport = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        setImportError(null);
        setImportMessage(null);

        if (!selectedFile) {
            setImportError('Selecciona un archivo .ies, .ldt o .gldf.');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('normative_standard', 'universal');
        if (productName.trim()) formData.append('name', productName.trim());
        if (manufacturerName.trim())
            formData.append('manufacturer', manufacturerName.trim());
        if (productImage) formData.append('product_image', productImage);
        if (brandLogo) formData.append('brand_logo', brandLogo);

        setIsUploading(true);

        try {
            const response = await axios.post<{
                product: ImportedLuminaireProduct;
                message?: string;
            }>(productRoutes.importMethod.url(), formData, {
                headers: {
                    Accept: 'application/json',
                    ...getCsrfHeaders(),
                },
                withCredentials: true,
            });

            setImportedProducts((products) => [
                response.data.product,
                ...products.filter(
                    (product) => product.id !== response.data.product.id,
                ),
            ]);
            setSelectedFile(null);
            setProductName('');
            setManufacturerName('');
            setProductImage(null);
            setBrandLogo(null);
            setImportMessage(
                response.data.message ?? 'Producto importado correctamente.',
            );
        } catch (error) {
            const axiosError = error as {
                response?: {
                    data?: {
                        message?: string;
                        errors?: Record<string, string[]>;
                    };
                };
            };
            const firstValidationMessage = axiosError.response?.data?.errors
                ? Object.values(axiosError.response.data.errors).flat()[0]
                : null;

            setImportError(
                firstValidationMessage ??
                    axiosError.response?.data?.message ??
                    'No se pudo importar el producto.',
            );
        } finally {
            setIsUploading(false);
        }
    };

    const submitManualProduct = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        setManualError(null);
        setManualMessage(null);

        const totalLumens = Number.parseFloat(manualTotalLumens);
        const beamAngle50 = Number.parseFloat(manualBeamAngle50);

        if (!manualName.trim()) {
            setManualError('El nombre de la luminaria es obligatorio.');
            return;
        }
        if (!Number.isFinite(totalLumens) || totalLumens <= 0) {
            setManualError('Ingresa el flujo luminoso total (lm).');
            return;
        }

        let photometricTable: Array<{ gamma: number; candela: number }> | undefined;

        if (manualUseCustomCurve) {
            const parsedPoints = manualCurvePoints
                .map((point) => ({
                    gamma: Number.parseFloat(point.gamma),
                    candela: Number.parseFloat(point.candela),
                }))
                .filter(
                    (point) =>
                        Number.isFinite(point.gamma) &&
                        Number.isFinite(point.candela),
                );

            if (parsedPoints.length < 3) {
                setManualError(
                    'Ingresa al menos 3 puntos válidos (gamma, candela) de la curva fotométrica.',
                );
                return;
            }
            if (
                parsedPoints.some(
                    (point) =>
                        point.gamma < 0 ||
                        point.gamma > 180 ||
                        point.candela < 0,
                )
            ) {
                setManualError(
                    'Los ángulos gamma deben estar entre 0-180° y las candelas no pueden ser negativas.',
                );
                return;
            }
            photometricTable = parsedPoints;
        } else if (
            !Number.isFinite(beamAngle50) ||
            beamAngle50 <= 0 ||
            beamAngle50 >= 180
        ) {
            setManualError(
                'Ingresa el ángulo de apertura (beam angle 50%) en grados, entre 1 y 179.',
            );
            return;
        }

        setIsSubmittingManual(true);

        try {
            const response = await axios.post<{
                product: ImportedLuminaireProduct;
                message?: string;
            }>(
                productRoutes.storeManual.url(),
                {
                    name: manualName.trim(),
                    manufacturer: manualManufacturer.trim() || undefined,
                    catalog_number: manualCatalogNumber.trim() || undefined,
                    total_lumens: totalLumens,
                    power_watts: manualPowerWatts
                        ? Number.parseFloat(manualPowerWatts)
                        : undefined,
                    cct: manualCct.trim() || undefined,
                    cri_ra: manualCriRa
                        ? Number.parseFloat(manualCriRa)
                        : undefined,
                    beam_angle_50: photometricTable ? undefined : beamAngle50,
                    photometric_table: photometricTable,
                },
                {
                    headers: {
                        Accept: 'application/json',
                        ...getCsrfHeaders(),
                    },
                    withCredentials: true,
                },
            );

            setImportedProducts((products) => [
                response.data.product,
                ...products.filter(
                    (product) => product.id !== response.data.product.id,
                ),
            ]);
            setManualName('');
            setManualManufacturer('');
            setManualCatalogNumber('');
            setManualTotalLumens('');
            setManualPowerWatts('');
            setManualCct('');
            setManualCriRa('');
            setManualBeamAngle50('');
            setManualUseCustomCurve(false);
            setManualCurvePoints([
                { gamma: '0', candela: '' },
                { gamma: '30', candela: '' },
                { gamma: '60', candela: '' },
                { gamma: '90', candela: '' },
            ]);
            setManualMessage(
                response.data.message ?? 'Luminaria creada correctamente.',
            );
        } catch (error) {
            const axiosError = error as {
                response?: {
                    data?: {
                        message?: string;
                        errors?: Record<string, string[]>;
                    };
                };
            };
            const firstValidationMessage = axiosError.response?.data?.errors
                ? Object.values(axiosError.response.data.errors).flat()[0]
                : null;

            setManualError(
                firstValidationMessage ??
                    axiosError.response?.data?.message ??
                    'No se pudo crear la luminaria.',
            );
        } finally {
            setIsSubmittingManual(false);
        }
    };

    const setWindow = (template: Partial<Window>) => {
        store.setWindowTemplate(template);
        store.setTool('window');
        onSelect?.();
    };

    const setDoor = (template: Partial<Door>) => {
        store.setDoorTemplate(template);
        store.setTool('door');
        onSelect?.();
    };

    const setCorridor = (template: CorridorConfig) => {
        store.setCorridorTemplate(template);
        store.setTool('corridor');
        onSelect?.();
    };

    const renderArchitectureTabs = filterCategory === 'architecture';
    const shouldShowCorridors =
        showCorridors &&
        (!renderArchitectureTabs || architectureTab === 'corridors');
    const shouldShowWindows =
        showWindows &&
        (!renderArchitectureTabs || architectureTab === 'windows');
    const shouldShowDoors =
        showDoors && (!renderArchitectureTabs || architectureTab === 'doors');

    return (
        <div className="flex flex-col gap-1">
            {renderArchitectureTabs && (
                <div className="mb-1 grid grid-cols-3 gap-1 rounded border border-gray-800 bg-gray-950/30 p-1">
                    {[
                        {
                            id: 'corridors' as const,
                            label: 'Pasadizos',
                            count: filteredCorridors.length,
                        },
                        {
                            id: 'windows' as const,
                            label: 'Ventanas',
                            count: filteredWindows.length,
                        },
                        {
                            id: 'doors' as const,
                            label: 'Puertas',
                            count: filteredDoors.length,
                        },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setArchitectureTab(tab.id)}
                            className={`min-w-0 rounded px-1.5 py-1 text-[9px] transition-colors ${
                                architectureTab === tab.id
                                    ? 'bg-cyan-900/40 text-cyan-200 ring-1 ring-cyan-600/30'
                                    : 'text-gray-500 hover:bg-gray-800/70 hover:text-gray-200'
                            }`}
                        >
                            <span className="block truncate">{tab.label}</span>
                            <span className="font-mono text-[8px] opacity-70">
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {shouldShowCorridors && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-cyan-500/80 uppercase">
                        Pasadizos ({filteredCorridors.length})
                    </p>
                    {filteredCorridors.map((item, i) => {
                        const isActive = isCorridorMatch(
                            item.template,
                            corridorTemplate,
                        );

                        return (
                            <button
                                key={`${item.label}-${i}`}
                                type="button"
                                onClick={() => setCorridor(item.template)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-cyan-900/30 text-cyan-300 ring-1 ring-cyan-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span
                                    className={`shrink-0 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}
                                >
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">
                                        {item.label}
                                    </p>
                                    <p className="truncate text-[9px] leading-none text-gray-600">
                                        {item.description}
                                    </p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-cyan-900/50 px-1 py-0.5 text-[8px] text-cyan-400">
                                        ●
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {shouldShowCorridors && (shouldShowWindows || shouldShowDoors) && (
                <div className="my-1 border-t border-gray-700/40" />
            )}
            {/* ── Luminarias ── */}
            {showFixtures && (
                <div className="space-y-0.5">
                    <div className="mb-1 flex items-center justify-between px-1">
                        <p className="text-[8px] font-semibold tracking-widest text-amber-500/80 uppercase">
                            Luminarias (
                            {filteredImportedProducts.length +
                                filteredFixtures.length}
                            )
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
                            }}
                            title="Importar catalogo IES / LDT"
                            className={`${isCompactFixtureGrid ? 'hidden' : 'flex'} items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-gray-500 transition-colors hover:bg-gray-700/40 hover:text-gray-300`}
                        >
                            <Upload size={9} />
                            IES/LDT
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setManualMode((v) => !v);
                                setImportMode(false);
                            }}
                            title="Crear luminaria propia con datos manuales"
                            className={`${isCompactFixtureGrid ? 'hidden' : 'flex'} items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-gray-500 transition-colors hover:bg-gray-700/40 hover:text-gray-300`}
                        >
                            <Wrench size={9} />
                            Manual
                        </button>
                    </div>

                    {importMode && (
                        <div className="hidden">
                            <p className="text-[9px] text-amber-300/80">
                                Importación IES/LDT
                            </p>
                            <p className="mt-0.5 text-[8px] text-gray-600">
                                Disponible próximamente
                            </p>
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
                        <form
                            onSubmit={submitProductImport}
                            className="mb-1 rounded border border-dashed border-amber-700/40 bg-amber-950/20 p-2"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[9px] text-amber-300/80">
                                    Importacion IES/LDT/GLDF
                                </p>
                                {isLoadingProducts && (
                                    <span className="text-[8px] text-gray-500">
                                        Cargando...
                                    </span>
                                )}
                            </div>
                            <label className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-amber-700/30 bg-gray-950/30 px-2 py-1 text-[9px] text-amber-100 hover:bg-amber-900/20">
                                <Upload size={9} />
                                <span className="truncate">
                                    {selectedFile
                                        ? selectedFile.name
                                        : 'Seleccionar archivo .ies / .ldt / .gldf'}
                                </span>
                                <input
                                    type="file"
                                    accept=".ies,.ldt,.gldf,.txt,.xml"
                                    className="hidden"
                                    onChange={(event) => {
                                        setSelectedFile(
                                            event.target.files?.[0] ?? null,
                                        );
                                        setImportError(null);
                                        setImportMessage(null);
                                    }}
                                />
                            </label>
                            <div className="mt-1.5 grid grid-cols-1 gap-1">
                                <input
                                    type="text"
                                    value={productName}
                                    onChange={(event) =>
                                        setProductName(event.target.value)
                                    }
                                    placeholder="Nombre del producto (opcional)"
                                    className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                />
                                <input
                                    type="text"
                                    value={manufacturerName}
                                    onChange={(event) =>
                                        setManufacturerName(event.target.value)
                                    }
                                    placeholder="Marca / fabricante (opcional)"
                                    className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                />
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-1">
                                <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[8px] text-gray-400 hover:border-amber-700/50 hover:text-amber-100">
                                    <span className="truncate">
                                        {productImage
                                            ? productImage.name
                                            : 'Imagen producto'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) =>
                                            setProductImage(
                                                event.target.files?.[0] ?? null,
                                            )
                                        }
                                    />
                                </label>
                                <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[8px] text-gray-400 hover:border-amber-700/50 hover:text-amber-100">
                                    <span className="truncate">
                                        {brandLogo
                                            ? brandLogo.name
                                            : 'Logo marca'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) =>
                                            setBrandLogo(
                                                event.target.files?.[0] ?? null,
                                            )
                                        }
                                    />
                                </label>
                            </div>
                            <button
                                type="submit"
                                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-amber-700/70 py-1 text-[9px] text-amber-50 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!selectedFile || isUploading}
                            >
                                <Upload size={9} />
                                {isUploading
                                    ? 'Importando...'
                                    : 'Subir y registrar producto'}
                            </button>
                            {importError && (
                                <p className="mt-1 text-[8px] leading-tight text-red-300">
                                    {importError}
                                </p>
                            )}
                            {importMessage && (
                                <p className="mt-1 text-[8px] leading-tight text-emerald-300">
                                    {importMessage}
                                </p>
                            )}
                        </form>
                    )}

                    {manualMode && (
                        <form
                            onSubmit={submitManualProduct}
                            className="mb-1 rounded border border-dashed border-amber-700/40 bg-amber-950/20 p-2"
                        >
                            <p className="text-[9px] text-amber-300/80">
                                Crear luminaria propia (sin archivo IES/LDT)
                            </p>
                            <p className="mt-0.5 text-[8px] leading-tight text-gray-500">
                                Con el flujo luminoso y el ángulo de apertura
                                (beam angle 50%) del datasheet se calcula una
                                distribución fotométrica real para el cálculo
                                punto-por-punto.
                            </p>
                            <label className="mt-1.5 flex items-center gap-1.5 text-[8px] text-amber-200/90">
                                <input
                                    type="checkbox"
                                    checked={manualUseCustomCurve}
                                    onChange={(event) =>
                                        setManualUseCustomCurve(
                                            event.target.checked,
                                        )
                                    }
                                    className="accent-amber-500"
                                />
                                Tengo la curva fotométrica real del fabricante
                                (avanzado)
                            </label>
                            <div className="mt-1.5 grid grid-cols-1 gap-1">
                                <input
                                    type="text"
                                    value={manualName}
                                    onChange={(event) =>
                                        setManualName(event.target.value)
                                    }
                                    placeholder="Nombre de la luminaria *"
                                    className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                />
                                <div className="grid grid-cols-2 gap-1">
                                    <input
                                        type="text"
                                        value={manualManufacturer}
                                        onChange={(event) =>
                                            setManualManufacturer(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Marca"
                                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={manualCatalogNumber}
                                        onChange={(event) =>
                                            setManualCatalogNumber(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Código catálogo"
                                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    <input
                                        type="number"
                                        min="1"
                                        value={manualTotalLumens}
                                        onChange={(event) =>
                                            setManualTotalLumens(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Flujo luminoso (lm) *"
                                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                    />
                                    {!manualUseCustomCurve && (
                                        <input
                                            type="number"
                                            min="1"
                                            max="179"
                                            value={manualBeamAngle50}
                                            onChange={(event) =>
                                                setManualBeamAngle50(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Ángulo apertura 50% (°) *"
                                            className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                        />
                                    )}
                                </div>

                                {manualUseCustomCurve && (
                                    <div className="rounded border border-amber-800/40 bg-gray-950/30 p-1.5">
                                        <p className="mb-1 text-[8px] leading-tight text-gray-500">
                                            Curva de candelas por ángulo gamma
                                            (0°=nadir, hacia abajo). Se asume
                                            simetría rotacional (un solo plano
                                            C). El ángulo de haz se calcula
                                            solo — no lo declares arriba.
                                        </p>
                                        <div className="flex flex-col gap-1">
                                            {manualCurvePoints.map(
                                                (point, index) => (
                                                    <div
                                                        key={index}
                                                        className="grid grid-cols-[1fr_1fr_auto] gap-1"
                                                    >
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="180"
                                                            value={point.gamma}
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setManualCurvePoints(
                                                                    (
                                                                        points,
                                                                    ) =>
                                                                        points.map(
                                                                            (
                                                                                p,
                                                                                i,
                                                                            ) =>
                                                                                i ===
                                                                                index
                                                                                    ? {
                                                                                          ...p,
                                                                                          gamma: event
                                                                                              .target
                                                                                              .value,
                                                                                      }
                                                                                    : p,
                                                                        ),
                                                                )
                                                            }
                                                            placeholder="Gamma (°)"
                                                            className="rounded border border-gray-700/70 bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                                        />
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={
                                                                point.candela
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setManualCurvePoints(
                                                                    (
                                                                        points,
                                                                    ) =>
                                                                        points.map(
                                                                            (
                                                                                p,
                                                                                i,
                                                                            ) =>
                                                                                i ===
                                                                                index
                                                                                    ? {
                                                                                          ...p,
                                                                                          candela:
                                                                                              event
                                                                                                  .target
                                                                                                  .value,
                                                                                      }
                                                                                    : p,
                                                                        ),
                                                                )
                                                            }
                                                            placeholder="Candela (cd)"
                                                            className="rounded border border-gray-700/70 bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setManualCurvePoints(
                                                                    (
                                                                        points,
                                                                    ) =>
                                                                        points.filter(
                                                                            (
                                                                                _,
                                                                                i,
                                                                            ) =>
                                                                                i !==
                                                                                index,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                manualCurvePoints.length <=
                                                                3
                                                            }
                                                            title="Quitar punto"
                                                            className="rounded border border-gray-700/70 px-1.5 text-[9px] text-gray-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setManualCurvePoints(
                                                    (points) => [
                                                        ...points,
                                                        {
                                                            gamma: '',
                                                            candela: '',
                                                        },
                                                    ],
                                                )
                                            }
                                            className="mt-1 w-full rounded border border-dashed border-gray-700/70 py-0.5 text-[8px] text-gray-400 hover:bg-gray-800"
                                        >
                                            + Agregar punto
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-1">
                                    <input
                                        type="number"
                                        min="0.1"
                                        value={manualPowerWatts}
                                        onChange={(event) =>
                                            setManualPowerWatts(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Potencia (W)"
                                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={manualCct}
                                        onChange={(event) =>
                                            setManualCct(event.target.value)
                                        }
                                        placeholder="CCT (ej. 4000K)"
                                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={manualCriRa}
                                        onChange={(event) =>
                                            setManualCriRa(event.target.value)
                                        }
                                        placeholder="CRI (Ra)"
                                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-amber-700/70 py-1 text-[9px] text-amber-50 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSubmittingManual}
                            >
                                <Wrench size={9} />
                                {isSubmittingManual
                                    ? 'Creando...'
                                    : 'Crear luminaria'}
                            </button>
                            {manualError && (
                                <p className="mt-1 text-[8px] leading-tight text-red-300">
                                    {manualError}
                                </p>
                            )}
                            {manualMessage && (
                                <p className="mt-1 text-[8px] leading-tight text-emerald-300">
                                    {manualMessage}
                                </p>
                            )}
                        </form>
                    )}

                    {isCompactFixtureGrid && (
                        <>
                            <div className="grid min-h-[17.5rem] grid-cols-3 grid-rows-5 gap-1">
                                {visibleImportedProducts.map((product) => {
                                    const isActive =
                                        fixtureTemplate.brand ===
                                            (product.manufacturer ??
                                                undefined) &&
                                        fixtureTemplate.lumens ===
                                            (product.total_lumens ?? 1000) &&
                                        fixtureTemplate.fixtureType ===
                                            toFixtureType(product.fixture_type);

                                    return (
                                        <button
                                            key={`imported-${product.id}`}
                                            type="button"
                                            onClick={() =>
                                                setImportedFixture(product)
                                            }
                                            className={`group flex min-h-13 flex-col items-center justify-center gap-1 rounded border px-1 py-1 text-center transition-colors ${
                                                isActive
                                                    ? 'border-emerald-600/50 bg-emerald-900/30 text-emerald-200'
                                                    : 'border-gray-700/50 bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                                            }`}
                                            title={product.name}
                                        >
                                            {product.product_image_url ? (
                                                <img
                                                    src={
                                                        product.product_image_url
                                                    }
                                                    alt=""
                                                    className="h-5 w-5 rounded object-cover"
                                                />
                                            ) : (
                                                <Upload
                                                    size={14}
                                                    className="text-emerald-400"
                                                />
                                            )}
                                            <span className="line-clamp-2 max-w-full text-[9px] leading-tight">
                                                {product.name}
                                            </span>
                                            <span className="text-[8px] leading-none text-gray-600">
                                                {product.total_lumens ?? '-'}lm
                                                {product.power_watts ? ` · ${product.power_watts}W` : ''}
                                            </span>
                                        </button>
                                    );
                                })}

                                {visibleFixtures.map((item, i) => {
                                    const isActive = isFixtureMatch(
                                        item.template,
                                        fixtureTemplate,
                                    );

                                    return (
                                        <button
                                            key={`${item.brand}-${item.label}-${i}`}
                                            type="button"
                                            onClick={() => setFixture(item)}
                                            className={`group flex min-h-13 flex-col items-center justify-center gap-1 rounded border px-1 py-1 text-center transition-colors ${
                                                isActive
                                                    ? 'border-amber-600/50 bg-amber-900/30 text-amber-200'
                                                    : 'border-gray-700/50 bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                                            }`}
                                            title={item.label}
                                        >
                                            <span
                                                className={`shrink-0 ${isActive ? 'text-amber-400' : 'text-gray-500 group-hover:text-gray-400'}`}
                                            >
                                                {item.icon}
                                            </span>
                                            <span className="line-clamp-2 max-w-full text-[9px] leading-tight">
                                                {item.label}
                                            </span>
                                            <span className="text-[8px] leading-none text-gray-600">
                                                {item.lumens}lm
                                                {item.power ? ` · ${item.power}W` : ''}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                        </>
                    )}

                    {!isCompactFixtureGrid && paginatedImportedProducts.length > 0 && (
                        <div className="mb-1 space-y-0.5">
                            <p className="px-1 text-[8px] font-semibold tracking-widest text-emerald-500/80 uppercase">
                                Importadas ({filteredImportedProducts.length})
                            </p>
                            {paginatedImportedProducts.map((product) => {
                                const isActive =
                                    fixtureTemplate.brand ===
                                        (product.manufacturer ?? undefined) &&
                                    fixtureTemplate.lumens ===
                                        (product.total_lumens ?? 1000) &&
                                    fixtureTemplate.fixtureType ===
                                        toFixtureType(product.fixture_type);
                                const effLmW =
                                    product.power_watts && product.total_lumens
                                        ? (
                                              product.total_lumens /
                                              product.power_watts
                                          ).toFixed(0)
                                        : null;

                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() =>
                                            setImportedFixture(product)
                                        }
                                        className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                            isActive
                                                ? 'bg-emerald-900/30 text-emerald-300 ring-1 ring-emerald-600/30'
                                                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                        }`}
                                    >
                                        <span
                                            className={`shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-400'}`}
                                        >
                                            {product.product_image_url ? (
                                                <img
                                                    src={
                                                        product.product_image_url
                                                    }
                                                    alt=""
                                                    className="h-5 w-5 rounded object-cover"
                                                />
                                            ) : (
                                                <Upload size={13} />
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[11px] leading-tight">
                                                {product.name}
                                            </p>
                                            <p className="text-[9px] leading-none text-gray-600">
                                                {product.manufacturer ??
                                                    'Importado'}{' '}
                                                Â· {product.total_lumens ?? '-'}
                                                lm
                                                {effLmW
                                                    ? ` Â· ${effLmW}lm/W`
                                                    : ''}
                                                {product.cct
                                                    ? ` Â· ${product.cct}`
                                                    : ''}
                                                {product.source_format
                                                    ? ` Â· ${product.source_format.toUpperCase()}`
                                                    : ''}
                                            </p>
                                        </div>
                                        {product.is_owner ? (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(event) =>
                                                    toggleShare(product, event)
                                                }
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
                                                        : 'text-gray-600 hover:bg-gray-700/60 hover:text-gray-300'
                                                } ${sharingProductId === product.id ? 'opacity-50' : ''}`}
                                            >
                                                {product.is_global ? (
                                                    <Globe size={12} />
                                                ) : (
                                                    <Share2 size={12} />
                                                )}
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
                                        {product.is_owner && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(event) =>
                                                    deleteProduct(
                                                        product,
                                                        event,
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key ===
                                                            'Enter' ||
                                                        event.key === ' '
                                                    ) {
                                                        event.preventDefault();
                                                        deleteProduct(
                                                            product,
                                                            event as unknown as React.MouseEvent,
                                                        );
                                                    }
                                                }}
                                                title="Eliminar esta luminaria"
                                                className={`shrink-0 rounded p-1 text-gray-600 transition-colors hover:bg-red-900/40 hover:text-red-400 ${deletingProductId === product.id ? 'opacity-50' : ''}`}
                                            >
                                                <Trash2 size={12} />
                                            </span>
                                        )}
                                        {isActive && (
                                            <span className="shrink-0 rounded bg-emerald-900/50 px-1 py-0.5 text-[8px] text-emerald-400">
                                                â—
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            {paginatedFixtures.length > 0 && (
                                <div className="my-1 border-t border-gray-700/40" />
                            )}
                        </div>
                    )}

                    {!isCompactFixtureGrid && paginatedFixtures.map((item, i) => {
                        const isActive = isFixtureMatch(
                            item.template,
                            fixtureTemplate,
                        );
                        const effLmW = item.power
                            ? (item.lumens / item.power).toFixed(0)
                            : null;
                        return (
                            <button
                                key={`${item.brand}-${item.label}-${i}`}
                                type="button"
                                onClick={() => setFixture(item)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-amber-900/30 text-amber-300 ring-1 ring-amber-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span
                                    className={`shrink-0 ${isActive ? 'text-amber-400' : 'text-gray-500 group-hover:text-gray-400'}`}
                                >
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">
                                        {item.label}
                                    </p>
                                    <p className="text-[9px] leading-none text-gray-600">
                                        {item.brand} · {item.lumens}lm
                                        {effLmW ? ` · ${effLmW}lm/W` : ''}
                                        {item.cct ? ` · ${item.cct}` : ''}
                                    </p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-amber-900/50 px-1 py-0.5 text-[8px] text-amber-400">
                                        ●
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {!isCompactFixtureGrid && totalFixtures > fixturePageSize && (
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-700/40 pt-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setFixturePage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                disabled={fixturePage === 1}
                                className="rounded border border-gray-700/60 px-2 py-1 text-[10px] text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <span className="text-[10px] text-gray-500">
                                Pagina {fixturePage} de {fixturePageCount}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setFixturePage((page) =>
                                        Math.min(fixturePageCount, page + 1),
                                    )
                                }
                                disabled={fixturePage === fixturePageCount}
                                className="rounded border border-gray-700/60 px-2 py-1 text-[10px] text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Interruptores ── */}
            {showFixtures && showSwitches && (
                <div className="my-1 border-t border-gray-700/40" />
            )}
            {showSwitches && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-violet-500/80 uppercase">
                        Interruptores ({filteredSwitches.length})
                    </p>
                    {filteredSwitches.map((item, i) => {
                        const isActive = store.ui.switchTemplate?.type === item.type;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setSwitch(item)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-violet-900/30 text-violet-300 ring-1 ring-violet-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span className={`shrink-0 font-bold text-[11px] w-8 text-center ${isActive ? 'text-violet-300' : 'text-gray-500'}`}>
                                    {item.switchLabel}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">{item.label}</p>
                                    <p className="text-[9px] leading-none text-gray-600">{item.description}</p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-violet-900/50 px-1 py-0.5 text-[8px] text-violet-400">●</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Cajas de pase ── */}
            {showSwitches && showJunctionBoxes && (
                <div className="my-1 border-t border-gray-700/40" />
            )}
            {showJunctionBoxes && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-orange-500/80 uppercase">
                        Cajas de pase ({filteredJunctionBoxes.length})
                    </p>
                    {filteredJunctionBoxes.map((item, i) => {
                        const isActive = store.ui.junctionBoxTemplate?.size === item.size;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setJunctionBox(item)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-orange-900/30 text-orange-300 ring-1 ring-orange-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span className={`shrink-0 ${isActive ? 'text-orange-400' : 'text-gray-500'}`}>
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">{item.label}</p>
                                    <p className="text-[9px] leading-none text-gray-600">{item.description}</p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-orange-900/50 px-1 py-0.5 text-[8px] text-orange-400">●</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Ventanas ── */}
            {(showFixtures || showSwitches || showJunctionBoxes) && shouldShowWindows && (
                <div className="my-1 border-t border-gray-700/40" />
            )}

            {shouldShowWindows && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-sky-500/80 uppercase">
                        Ventanas ({filteredWindows.length})
                    </p>
                    {filteredWindows.map((item, i) => {
                        const isActive = isWindowMatch(
                            item.template,
                            windowTemplate,
                        );
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setWindow(item.template)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-sky-900/30 text-sky-300 ring-1 ring-sky-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span
                                    className={`shrink-0 ${isActive ? 'text-sky-400' : 'text-gray-500'}`}
                                >
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">
                                        {item.label}
                                    </p>
                                    <p className="text-[9px] leading-none text-gray-600">
                                        {item.material} · {item.template.width}×
                                        {item.template.height}m
                                    </p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-sky-900/50 px-1 py-0.5 text-[8px] text-sky-400">
                                        ●
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Puertas ── */}
            {shouldShowWindows && shouldShowDoors && (
                <div className="my-1 border-t border-gray-700/40" />
            )}

            {shouldShowDoors && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-emerald-500/80 uppercase">
                        Puertas ({filteredDoors.length})
                    </p>
                    {filteredDoors.map((item, i) => {
                        const isActive = isDoorMatch(
                            item.template,
                            doorTemplate,
                        );
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setDoor(item.template)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-emerald-900/30 text-emerald-300 ring-1 ring-emerald-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span
                                    className={`shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`}
                                >
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">
                                        {item.label}
                                    </p>
                                    <p className="text-[9px] leading-none text-gray-600">
                                        {item.template.width}×
                                        {item.template.height}m ·{' '}
                                        {item.template.openingDirection ===
                                        'outward'
                                            ? 'Exterior'
                                            : 'Interior'}
                                    </p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-emerald-900/50 px-1 py-0.5 text-[8px] text-emerald-400">
                                        ●
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
