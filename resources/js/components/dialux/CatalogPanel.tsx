import axios from 'axios';
import {
    Circle,
    Square,
    Maximize2,
    Minimize2,
    Columns,
    ArrowRight,
    RectangleHorizontal,
    Zap,
    Lightbulb,
    Disc,
    Frame,
    Sun,
    Upload,
    LayoutGrid,
    Lamp,
    Flame,
    Shield,
    Layers,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { Fixture, Window, Door } from '@/hooks/dialux/useEditorStore';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';
import type { CorridorConfig } from '@/hooks/dialux/types';
import * as productRoutes from '@/routes/dialux/products';

interface CatalogPanelProps {
    filterCategory?:
        | 'luminaires'
        | 'windows'
        | 'doors'
        | 'corridors'
        | 'architecture';
    filterBrand?: string;
    filterMaterial?: string;
    search?: string;
    onSelect?: () => void;
}

const ITEMS_PER_PAGE = 10;

/* ─── Catálogo de luminarias ─────────────────────────────────────────────── */

interface FixtureCatalogItem {
    label: string;
    brand: string;
    icon: React.ReactNode;
    lumens: number;
    power?: number;
    cct?: string;
    template: Partial<Fixture>;
}

interface CorridorCatalogItem {
    label: string;
    description: string;
    icon: React.ReactNode;
    template: CorridorConfig;
}

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
    report_data?: {
        technical_table?: Array<{ label: string; value: string }>;
        warnings?: string[];
    } | null;
    report_assets?: {
        polar_svg?: string | null;
    } | null;
}

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

const fixtureCatalog: FixtureCatalogItem[] = [
    {
        label: 'Downlight LED 10W',
        brand: 'Philips',
        icon: <Circle size={13} />,
        lumens: 800,
        power: 10,
        cct: '4000K',
        template: {
            fixtureType: 'recessed',
            fixtureShape: 'round',
            lumens: 800,
            efficiency: 0.85,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Downlight LED 18W',
        brand: 'Philips',
        icon: <Circle size={13} />,
        lumens: 1600,
        power: 18,
        cct: '4000K',
        template: {
            fixtureType: 'recessed',
            fixtureShape: 'round',
            lumens: 1600,
            efficiency: 0.88,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Empotrado Cuadrado 15W',
        brand: 'Osram',
        icon: <Square size={13} />,
        lumens: 1350,
        power: 15,
        cct: '3000K',
        template: {
            fixtureType: 'recessed',
            fixtureShape: 'square',
            lumens: 1350,
            efficiency: 0.85,
            lightColor: '#fffaeb',
        },
    },
    {
        label: 'Ojo de Buey Slim 6W',
        brand: 'Ledvance',
        icon: <Circle size={13} />,
        lumens: 600,
        power: 6,
        cct: '4000K',
        template: {
            fixtureType: 'recessed',
            fixtureShape: 'round',
            lumens: 600,
            efficiency: 0.85,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Panel LED 60×60 36W',
        brand: 'Philips',
        icon: <LayoutGrid size={13} />,
        lumens: 3600,
        power: 36,
        cct: '4000K',
        template: {
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lumens: 3600,
            efficiency: 0.9,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Panel LED 120×30 40W',
        brand: 'Osram',
        icon: <RectangleHorizontal size={13} />,
        lumens: 4000,
        power: 40,
        cct: '4000K',
        template: {
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lumens: 4000,
            efficiency: 0.92,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Panel LED 120×60 72W',
        brand: 'GE',
        icon: <RectangleHorizontal size={13} />,
        lumens: 7200,
        power: 72,
        cct: '4000K',
        template: {
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lumens: 7200,
            efficiency: 0.9,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Regleta LED T8 18W',
        brand: 'Ledvance',
        icon: <Minimize2 size={13} />,
        lumens: 1600,
        power: 18,
        cct: '6500K',
        template: {
            fixtureType: 'tube',
            fixtureShape: 'cylindrical',
            lumens: 1600,
            efficiency: 0.85,
            lightColor: '#f0f0ff',
        },
    },
    {
        label: 'Regleta LED T8 36W',
        brand: 'Ledvance',
        icon: <Minimize2 size={13} />,
        lumens: 3350,
        power: 36,
        cct: '6500K',
        template: {
            fixtureType: 'tube',
            fixtureShape: 'cylindrical',
            lumens: 3350,
            efficiency: 0.85,
            lightColor: '#f0f0ff',
        },
    },
    {
        label: 'Tubo LED T5 16W',
        brand: 'Osram',
        icon: <Minimize2 size={13} />,
        lumens: 2400,
        power: 16,
        cct: '4000K',
        template: {
            fixtureType: 'tube',
            fixtureShape: 'cylindrical',
            lumens: 2400,
            efficiency: 0.88,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Foco MR16 7W',
        brand: 'GE',
        icon: <Zap size={13} />,
        lumens: 500,
        power: 7,
        cct: '3000K',
        template: {
            fixtureType: 'spot',
            fixtureShape: 'round',
            lumens: 500,
            efficiency: 0.85,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Foco GU10 5W',
        brand: 'Philips',
        icon: <Zap size={13} />,
        lumens: 450,
        power: 5,
        cct: '3000K',
        template: {
            fixtureType: 'spot',
            fixtureShape: 'round',
            lumens: 450,
            efficiency: 0.82,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Foco PAR30 12W',
        brand: 'Cree',
        icon: <Zap size={13} />,
        lumens: 900,
        power: 12,
        cct: '3000K',
        template: {
            fixtureType: 'spot',
            fixtureShape: 'round',
            lumens: 900,
            efficiency: 0.87,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Plafón Circular 24W',
        brand: 'Ledvance',
        icon: <Sun size={13} />,
        lumens: 2400,
        power: 24,
        cct: '4000K',
        template: {
            fixtureType: 'surface',
            fixtureShape: 'round',
            lumens: 2400,
            efficiency: 0.85,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Aplique de Pared 15W',
        brand: 'Zumtobel',
        icon: <Lamp size={13} />,
        lumens: 1200,
        power: 15,
        cct: '3000K',
        template: {
            fixtureType: 'surface',
            fixtureShape: 'rectangular',
            lumens: 1200,
            efficiency: 0.8,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Lum. Hermética IP65 36W',
        brand: 'Osram',
        icon: <Shield size={13} />,
        lumens: 3600,
        power: 36,
        cct: '6500K',
        template: {
            fixtureType: 'surface',
            fixtureShape: 'rectangular',
            lumens: 3600,
            efficiency: 0.85,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Colgante Catenario 40W',
        brand: 'Zumtobel',
        icon: <Lightbulb size={13} />,
        lumens: 5500,
        power: 40,
        cct: '3000K',
        template: {
            fixtureType: 'pendant',
            fixtureShape: 'round',
            lumens: 5500,
            efficiency: 0.85,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Campana LED 100W',
        brand: 'Cree',
        icon: <Flame size={13} />,
        lumens: 13000,
        power: 100,
        cct: '5000K',
        template: {
            fixtureType: 'pendant',
            fixtureShape: 'round',
            lumens: 13000,
            efficiency: 0.9,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Campana LED 200W',
        brand: 'GE',
        icon: <Flame size={13} />,
        lumens: 26000,
        power: 200,
        cct: '5000K',
        template: {
            fixtureType: 'pendant',
            fixtureShape: 'round',
            lumens: 26000,
            efficiency: 0.92,
            lightColor: '#f0f8ff',
        },
    },
    {
        label: 'Tira LED 14.4W/m',
        brand: 'Philips',
        icon: <Disc size={13} />,
        lumens: 1100,
        power: 14.4,
        cct: '4000K',
        template: {
            fixtureType: 'strip',
            fixtureShape: 'rectangular',
            lumens: 1100,
            efficiency: 0.9,
            lightColor: '#fff5e1',
        },
    },
    {
        label: 'Lineal Pasillo IP65 24W',
        brand: 'Ledvance',
        icon: <Minimize2 size={13} />,
        lumens: 2400,
        power: 24,
        cct: '4000K',
        template: {
            name: 'Lineal Pasillo IP65 24W',
            fixtureType: 'strip',
            fixtureShape: 'rectangular',
            lumens: 2400,
            power: 24,
            efficiency: 0.88,
            lightColor: '#f0f8ff',
            dimensions: { length: 1.2, width: 0.08, height: 0.04 },
        },
    },
];

/* ─── Catálogo de ventanas ───────────────────────────────────────────────── */

const windowCatalog: {
    label: string;
    material: string;
    icon: React.ReactNode;
    template: Partial<Window>;
}[] = [
    {
        label: 'Ventana Fija Rectangular',
        material: 'Aluminio',
        icon: <Maximize2 size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'rectangular',
            width: 1.2,
            height: 1.1,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Batiente',
        material: 'Aluminio',
        icon: <ArrowRight size={13} />,
        template: {
            windowType: 'casement',
            windowShape: 'rectangular',
            width: 1.0,
            height: 1.5,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Corrediza',
        material: 'Aluminio',
        icon: <Columns size={13} />,
        template: {
            windowType: 'sliding',
            windowShape: 'rectangular',
            width: 2.0,
            height: 1.2,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Corrediza c/Persiana',
        material: 'PVC',
        icon: <Columns size={13} />,
        template: {
            windowType: 'sliding',
            windowShape: 'rectangular',
            width: 1.5,
            height: 1.2,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana Fija Cuadrada',
        material: 'Aluminio',
        icon: <Square size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'rectangular',
            width: 1.0,
            height: 1.0,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana de Baño',
        material: 'PVC',
        icon: <Maximize2 size={13} className="text-violet-400" />,
        template: {
            windowType: 'bathroom',
            windowShape: 'rectangular',
            width: 0.6,
            height: 0.4,
            sillHeight: 1.5,
        },
    },
    {
        label: 'Ojo de Buey',
        material: 'Aluminio',
        icon: <Circle size={13} />,
        template: {
            windowType: 'awning',
            windowShape: 'circular',
            width: 0.8,
            height: 0.8,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventana de Arco',
        material: 'Madera',
        icon: <Frame size={13} />,
        template: {
            windowType: 'casement',
            windowShape: 'arched',
            width: 1.0,
            height: 1.5,
            sillHeight: 0.9,
        },
    },
    {
        label: 'Ventanal Panorámico',
        material: 'Vidrio',
        icon: <Maximize2 size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'rectangular',
            width: 3.0,
            height: 2.5,
            sillHeight: 0.1,
        },
    },
    {
        label: 'Ventana Oscilante',
        material: 'PVC',
        icon: <ArrowRight size={13} />,
        template: {
            windowType: 'awning',
            windowShape: 'rectangular',
            width: 0.8,
            height: 0.5,
            sillHeight: 1.4,
        },
    },
    {
        label: 'Tragaluz / Claraboya',
        material: 'Vidrio',
        icon: <Circle size={13} />,
        template: {
            windowType: 'fixed',
            windowShape: 'circular',
            width: 1.0,
            height: 1.0,
            sillHeight: 0.5,
        },
    },
];

/* ─── Catálogo de puertas ────────────────────────────────────────────────── */

const doorCatalog: {
    label: string;
    icon: React.ReactNode;
    template: Partial<Door>;
}[] = [
    {
        label: 'Puerta Principal',
        icon: <ArrowRight size={13} />,
        template: {
            doorType: 'single',
            width: 0.9,
            height: 2.1,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta Doble',
        icon: <Columns size={13} />,
        template: {
            doorType: 'double',
            width: 1.8,
            height: 2.1,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta de Baño',
        icon: <ArrowRight size={13} />,
        template: {
            doorType: 'single',
            width: 0.7,
            height: 2.0,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta Corredera',
        icon: <Columns size={13} />,
        template: {
            doorType: 'sliding',
            width: 0.9,
            height: 2.1,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta Plegable',
        icon: <Minimize2 size={13} />,
        template: {
            doorType: 'folding',
            width: 0.8,
            height: 2.0,
            openingDirection: 'inward',
        },
    },
    {
        label: 'Puerta de Garaje',
        icon: <Columns size={13} />,
        template: {
            doorType: 'double',
            width: 2.5,
            height: 2.4,
            openingDirection: 'outward',
        },
    },
    {
        label: 'Puerta Contra Incendios',
        icon: <Shield size={13} />,
        template: {
            doorType: 'single',
            width: 0.9,
            height: 2.1,
            openingDirection: 'outward',
        },
    },
];

const corridorCatalog: CorridorCatalogItem[] = [
    {
        label: 'Pasadizo solo techo',
        description: 'Losa superior / techo reflejado',
        icon: <Layers size={13} />,
        template: {
            type: 'roof_only',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
    {
        label: 'Pasadizo normal',
        description: 'Techo y piso transitable',
        icon: <Layers size={13} />,
        template: { type: 'normal', slabThickness: 0.2, railingHeight: 1.05 },
    },
    {
        label: 'Pasadizo techo y piso',
        description: 'Losa completa entre niveles',
        icon: <LayoutGrid size={13} />,
        template: {
            type: 'roof_floor',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
    {
        label: 'Pasadizo con baranda cemento',
        description: 'Piso, techo y parapeto sólido',
        icon: <Shield size={13} />,
        template: {
            type: 'concrete_railings',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
    {
        label: 'Pasadizo con baranda metal',
        description: 'Piso, techo y barandas metálicas',
        icon: <Minimize2 size={13} />,
        template: {
            type: 'metal_railings',
            slabThickness: 0.2,
            railingHeight: 1.05,
        },
    },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const isFixtureMatch = (a: Partial<Fixture>, b: Partial<Fixture>) =>
    a.fixtureType === b.fixtureType &&
    a.fixtureShape === b.fixtureShape &&
    a.lumens === b.lumens;

const isWindowMatch = (a: Partial<Window>, b: Partial<Window>) =>
    a.windowType === b.windowType &&
    a.windowShape === b.windowShape &&
    a.width === b.width;

const isDoorMatch = (a: Partial<Door>, b: Partial<Door>) =>
    a.doorType === b.doorType && a.width === b.width;

const isCorridorMatch = (a: CorridorConfig, b: CorridorConfig) =>
    (a.type ?? 'roof_only') === (b.type ?? 'roof_only');

/* ─── Componente principal ───────────────────────────────────────────────── */

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
    filterCategory,
    filterBrand,
    filterMaterial,
    search = '',
    onSelect,
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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [productName, setProductName] = useState('');
    const [manufacturerName, setManufacturerName] = useState('');
    const [productImage, setProductImage] = useState<File | null>(null);
    const [brandLogo, setBrandLogo] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [fixturePage, setFixturePage] = useState(1);

    const showFixtures = filterCategory === 'luminaires' || !filterCategory;
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
        Math.ceil(totalFixtures / ITEMS_PER_PAGE),
    );
    const fixturePageStart = (fixturePage - 1) * ITEMS_PER_PAGE;
    const fixturePageEnd = fixturePageStart + ITEMS_PER_PAGE;
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

    useEffect(() => {
        setFixturePage(1);
    }, [filterBrand, search]);

    useEffect(() => {
        if (fixturePage > fixturePageCount) {
            setFixturePage(fixturePageCount);
        }
    }, [fixturePage, fixturePageCount]);

    const setFixture = (item: FixtureCatalogItem) => {
        store.setFixtureTemplate({
            ...item.template,
            name: item.template.name ?? item.label,
            brand: item.template.brand ?? item.brand,
            power: item.template.power ?? item.power,
        });
        store.setTool('fixture');
        onSelect?.();
    };

    const setImportedFixture = (product: ImportedLuminaireProduct) => {
        const lumens = product.total_lumens ?? 1000;
        const power = product.power_watts ?? undefined;

        store.setFixtureTemplate({
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
            name: product.name,
        });
        store.setTool('fixture');
        onSelect?.();
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
                            onClick={() => setImportMode((v) => !v)}
                            title="Importar catalogo IES / LDT"
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-gray-500 transition-colors hover:bg-gray-700/40 hover:text-gray-300"
                        >
                            <Upload size={9} />
                            IES/LDT
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

                    {paginatedImportedProducts.length > 0 && (
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

                    {paginatedFixtures.map((item, i) => {
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

                    {totalFixtures > ITEMS_PER_PAGE && (
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

            {/* ── Ventanas ── */}
            {showFixtures && shouldShowWindows && (
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
