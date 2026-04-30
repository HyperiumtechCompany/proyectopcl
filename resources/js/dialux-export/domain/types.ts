import type {
    Canopy,
    Door,
    DxfEntity,
    DxfExtents,
    Fixture,
    IsoluxMode,
    LightingResult,
    Project,
    Room,
    ScaleConfig,
    Scene,
    Wall,
    Window as SceneWindow,
} from '@/hooks/dialux/useEditorStore';

export interface DialuxAmbientMetrics {
    area: number;
    illuminanceLux: number;
    fixtureCount: number;
    fixtureLumens: number;
    fixtureLumensSource: 'detected' | 'fallback';
    lumensRequired: number;
    exactQuantity: number;
    roundedQuantity: number;
    estimatedUniformity: number;
    coverage: 'optimal' | 'insufficient' | 'excessive';
    avgLux: number | null;
    minLux: number | null;
    maxLux: number | null;
    uniformity: number | null;
    g2: number | null;
    ugr: number | null;
    usefulPlaneHeight: number;
    marginalZone: number;
    uniformityTarget: number | null;
    ugrLimit: number | null;
    complies: boolean;
}

export interface DialuxAmbientExport {
    id: string;
    roomId: string;
    roomName: string;
    index: number;
    configKey: string;
    name: string;
    activity: string | null;
    sourceRoom: Room;
    room: Room;
    fixtures: Fixture[];
    result: LightingResult | null;
    metrics: DialuxAmbientMetrics;
}

export interface DialuxExportVisualConfig {
    showGrid: boolean;
    showIsolux: boolean;
    show3DView: boolean;
    isoluxMode: IsoluxMode;
    zoom: number;
    panX: number;
    panY: number;
    selectedId: string | null;
}

export interface DialuxExportSummary {
    roomCount: number;
    ambientCount: number;
    fixtureCount: number;
    wallCount: number;
    windowCount: number;
    doorCount: number;
    canopyCount: number;
    calculatedAmbientCount: number;
    compliantAmbientCount: number;
    averageLux: number;
    averageUniformity: number;
}

export interface DialuxExportSnapshot {
    formatVersion: '1.0.0';
    exportedAt: string;
    project: Project;
    scene: Scene;
    scaleConfig: ScaleConfig;
    dxfEntities: DxfEntity[];
    dxfExtents: DxfExtents | null;
    rooms: Room[];
    walls: Wall[];
    windows: SceneWindow[];
    doors: Door[];
    canopies: Canopy[];
    fixtures: Fixture[];
    ambients: DialuxAmbientExport[];
    resultsByRoom: Record<string, LightingResult>;
    visualConfig: DialuxExportVisualConfig;
    summary: DialuxExportSummary;
}

export type DialuxAssetPurpose =
    | 'formal-cover'
    | 'cad-overview'
    | 'cad-base'
    | 'drawn-terrain'
    | 'viewer-capture'
    | 'ambient-plan'
    | 'ambient-catalog'
    | 'lighting-results'
    | 'isolux'
    | 'chart'
    | 'technical-appendix'
    | 'project-summary'
    | 'luminaire-list';

export interface DialuxStructuredColumn {
    key: string;
    label: string;
}

export interface DialuxStructuredTableData {
    type: 'table';
    columns: DialuxStructuredColumn[];
    rows: Array<Record<string, string | number | null>>;
}

export interface DialuxStructuredSummaryData {
    type: 'summary';
    items: Array<{ label: string; value: string }>;
}

export interface DialuxStructuredJsonData {
    type: 'json';
    data: unknown;
}

export type DialuxStructuredAssetData =
    | DialuxStructuredTableData
    | DialuxStructuredSummaryData
    | DialuxStructuredJsonData;

interface DialuxExportAssetBase {
    id: string;
    title: string;
    purpose: DialuxAssetPurpose;
}

export interface DialuxBitmapAsset extends DialuxExportAssetBase {
    kind: 'bitmap';
    mimeType: 'image/png' | 'image/jpeg';
    dataUrl: string;
    width: number;
    height: number;
}

export interface DialuxVectorAsset extends DialuxExportAssetBase {
    kind: 'vector';
    mimeType: 'image/svg+xml';
    svg: string;
    width: number;
    height: number;
}

export interface DialuxStructuredAsset extends DialuxExportAssetBase {
    kind: 'structured';
    mimeType: 'application/json';
    data: DialuxStructuredAssetData;
}

export type DialuxExportAsset =
    | DialuxBitmapAsset
    | DialuxVectorAsset
    | DialuxStructuredAsset;

export type DialuxExportSectionKind =
    | 'project-summary'
    | 'cad-overview'
    | 'ambient-catalog'
    | 'lighting-results-table'
    | 'isolux'
    | 'charts'
    | 'technical-appendix';

export interface DialuxExportSection {
    id: string;
    kind: DialuxExportSectionKind;
    title: string;
    description?: string;
    visualAssetIds: string[];
    structuredAssetIds: string[];
}

export interface DialuxExportDocument {
    title: string;
    subtitle: string;
    fileBaseName: string;
    generatedAt: string;
    header: {
        title: string;
        subtitle: string;
    };
    footer: {
        left: string;
        right: string;
    };
    metadata: Array<{ label: string; value: string }>;
    summary: DialuxExportSummary;
    sections: DialuxExportSection[];
    assets: DialuxExportAsset[];
}

export interface DialuxLuminaireListItem {
    id: string;
    name: string;
    model: string;
    brand: string | null;
    articleNumber: string | null;
    fixtureShape: string | null;
    shape: string | null;
    lumens: number | null;
    powerWatts: number | null;
    efficiency: number | null;
    roomName: string | null;
    ambientName: string | null;
    quantity: number;
    cct?: number | null;
    cri?: number | null;
    description?: string | null;
    applications?: string | null;
    reportData?: {
        technical_table?: Array<{ label: string; value: string }>;
        warnings?: string[];
    } | null;
    reportAssets?: {
        polar_svg?: string | null;
        product_photo_url?: string | null;
        brand_logo_url?: string | null;
    } | null;
    ugrTable?: number[][] | null;
    ugrDiagramValue?: string | null;
    polarDiagramAssetId?: string | null;
    productPhotoAssetId?: string | null;
    brandLogoAssetId?: string | null;
    lineDrawingAssetId?: string | null;
}

export interface DialuxLuminaireTotals {
    totalLumens: number;
    totalPowerWatts: number;
    overallEfficiency: number;
}

export type DialuxAmbientLuminaireItem = DialuxLuminaireListItem;

export interface DialuxAmbientDetail {
    ambientId: string;
    roomId: string;
    roomName: string;
    ambientName: string;
    activity: string | null;
    area: number;
    targetLux: number;
    avgLux: number | null;
    minLux: number | null;
    maxLux: number | null;
    uniformity: number | null;
    g2: number | null;
    uniformityTarget: number | null;
    ugr: number | null;
    ugrLimit: number | null;
    usefulPlaneHeight: number;
    marginalZone: number;
    calculationIndex: string;
    fixtureCount: number;
    totalPowerWatts: number | null;
    lumensRequired: number;
    fixtureLumens: number;
    exactQuantity: number;
    roundedQuantity: number;
    coverage: string;
    complianceLabel: string;
    planAssetId: string | null;
    isoluxAssetId: string | null;
    luminaires: DialuxAmbientLuminaireItem[];
    fixturePositions: Array<{
        id: string;
        name: string;
        productName: string;
        x: number;
        y: number;
        mountingHeight: number | null;
        brand: string | null;
        articleNumber: string | null;
        lumens: number | null;
        powerWatts: number | null;
    }>;
}

export type DialuxFormalPageKind =
    | 'cover'
    | 'preliminary-observations'
    | 'toc'
    | 'luminaire-list'
    | 'product-sheet'
    | 'terrain-cad'
    | 'terrain-drawn'
    | 'ambient-list'
    | 'calculation-object-list'
    | 'ambient-summary'
    | 'ambient-results'
    | 'ambient-plan'
    | 'ambient-luminaires'
    | 'ambient-products'
    | 'ambient-calculation-object'
    | 'ambient-useful-plane'
    | 'room-ambient-list'
    | 'room-luminaires'
    | 'room-calculation-object'
    | 'glossary'
    | 'placeholder';

export type DialuxFormalSectionId =
    | 'cover'
    | 'content'
    | 'preliminary-observations'
    | 'luminaire-list'
    | 'terrain'
    | 'cad-overview'
    | 'ambient-catalog'
    | 'lighting-results'
    | 'isolux'
    | 'charts'
    | 'technical-appendix'
    | 'glossary'
    | `product-sheet:${string}`
    | 'product-sheets-header'
    | 'terrain-header'
    | 'edification-header'
    | `room-group-label-${string}`
    | `room-group-heading-${string}`
    | `ambient-group-label-${string}`
    | `ambient-group-heading-${string}`
    | 'ambient-list'
    | 'calculation-object-list'
    | `ambient-detail:${string}`
    | `ambient-summary:${string}`
    | `ambient-results:${string}`
    | `ambient-plan:${string}`
    | `ambient-luminaires:${string}`
    | `ambient-products:${string}`
    | `ambient-calculation-object:${string}`
    | `ambient-useful-plane:${string}`
    | `room-ambient-list:${string}`
    | `room-luminaires:${string}`
    | `room-calculation-object:${string}`
    | 'cad-overview-luminaires';

export interface DialuxTocEntry {
    sectionId: DialuxFormalSectionId;
    title: string;
    subtitle: string | null;
    level: number;
    pageNumber: number;
    kind?: 'item' | 'section-label' | 'section-heading';
    size?: 'small' | 'large';
}

export interface DialuxDocumentPage {
    id: string;
    kind: DialuxFormalPageKind;
    sectionId: DialuxFormalSectionId;
    pageNumber: number;
    title: string;
    subtitle: string | null;
    assetIds: string[];
    notes: string[];
    ambientId?: string | null;
    roomId?: string | null;
}

export interface DialuxFormalDocument {
    formatVersion: '1.0.0';
    title: string;
    subtitle: string;
    fileBaseName: string;
    generatedAt: string;
    paper: {
        format: 'A4';
        orientation: 'portrait';
    };
    header: {
        title: string;
        subtitle: string;
    };
    footer: {
        left: string;
        right: string;
    };
    metadata: Array<{ label: string; value: string }>;
    pages: DialuxDocumentPage[];
    toc: DialuxTocEntry[];
    luminaires: DialuxLuminaireListItem[];
    luminaireTotals: DialuxLuminaireTotals;
    ambientDetails: DialuxAmbientDetail[];
    assets: DialuxExportAsset[];
}

export interface DialuxFormalPdfPayload {
    document: DialuxFormalDocument;
}

export interface DialuxPdfRenderOptions {
    autoPrint?: boolean;
    targetWindow?: Window | null;
}

export interface DialuxPdfRenderResult {
    html: string;
    mode: 'print-dialog';
}

export interface DialuxPdfRenderer {
    render(
        document: DialuxExportDocument,
        options?: DialuxPdfRenderOptions,
    ): Promise<DialuxPdfRenderResult>;
}
