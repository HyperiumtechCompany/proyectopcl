import type { ElectricalDevice } from '@/pages/dialux/hooks/types';
import {
    ALLOWED_SCALE_DENOMINATORS, DEFAULT_HEADER_PADDING_M, DEFAULT_PAPER_FORMAT, DEFAULT_PAPER_ORIENTATION,
    DEFAULT_RESERVED_ZONES_MM, DEFAULT_SHEET_SEPARATION_M, DISCIPLINE_LABELS, MULTISHEET_LAYER_DEFS,
    resolvePaperSizeMm,
} from '../domain/constants';
import type {
    DxfBounds, DxfDrawingPackage, DxfExportWarning, DxfLegendRow, DxfLevelPackage,
    DxfPaperFormat, DxfPaperOrientation, DxfPaperSize, DxfSheetGeometry, DxfSheetMetadata, DxfSheetReservedZonesMm,
} from '../domain/types';
import { dxfText, p, type DxfLines } from '../emitters/primitives';
import { renderSheetFrame } from '../emitters/frame';
import { renderTitleBlock } from '../emitters/titleBlock';
import { renderLegendTable } from '../emitters/legend';
import { renderLevelArchitectureBlock } from '../emitters/architecture';
import { renderConductorEntities, renderFixtureEntities, renderLightSwitchEntities } from '../emitters/lighting';
import { renderElectricalDeviceEntities, renderJunctionBoxEntities } from '../emitters/outlets';
import { buildLevelBlockName, emitLevelBlockDefinition, emitLevelBlockInsert } from '../emitters/levelBlock';
import { computeSheetGeometry, computeSheetGeometryAtScale, translateSheetGeometry } from '../geometry/sheetScale';
import { layoutDxfSheets, type DxfSheetLayoutRowInput } from '../geometry/sheetLayout';
import { classifyDxfLevelEntities } from './classifyDxfLevelEntities';
import { buildLightingEntities, buildOutletEntities } from './buildDisciplineEntities';
import { buildLightingLegendRows } from './buildLightingLegendRows';
import { buildOutletLegendRows } from './buildOutletLegendRows';
import { translateElectricalEntities } from './translateElectricalEntities';
import { LIGHTING_LEGEND_COLUMNS, OUTLET_LEGEND_COLUMNS } from './legendColumns';

/**
 * Composición multinivel (Fase 8): recibe el `DxfDrawingPackage` de la
 * Fase 1 y produce el texto DXF completo con dos láminas por nivel
 * (alumbrado y tomacorrientes), cada una en su propio marco, sin
 * solaparse — reutilizando TODO lo construido en las Fases 2 a 7.
 *
 * Fase 9 le agregó selección de niveles/especialidad, papel/escala y un
 * preview liviano (`buildDxfExportPreview`) que comparte la misma
 * preparación por nivel (`prepareDxfLevels`) sin generar el texto DXF
 * completo — para que el panel de opciones pueda recalcularlo en cada
 * cambio sin costo alto.
 */

const PANEL_DEVICE_TYPES = new Set<ElectricalDevice['type']>(['main_panel', 'sub_panel', 'meter', 'transfer_switch', 'arrival_panel']);
/** Umbral simple para advertir de una leyenda larga (sección 8.3/9/10). */
const LEGEND_OVERFLOW_ROW_THRESHOLD = 24;

export interface DxfExportDisciplineSelection {
    lighting: boolean;
    outlets: boolean;
}

/** Opciones compartidas por la preparación (preview) y la generación completa del documento. */
export interface DxfMultiSheetPrepareOptions {
    package: DxfDrawingPackage;
    /** IDs de escena a incluir. Omitido = todos los niveles del paquete. */
    levelSceneIds?: string[];
    /** Qué especialidades generar. Default: ambas. */
    disciplines?: DxfExportDisciplineSelection;
    paperFormat?: DxfPaperFormat;
    paperOrientation?: DxfPaperOrientation;
    reserved?: DxfSheetReservedZonesMm;
    allowedScaleDenominators?: readonly number[];
    scaleMode?: 'auto' | 'manual';
    manualScaleDenominator?: number;
    /** Incluir el fondo CAD importado en el bloque de cada nivel. Default true. */
    includeCadBase?: boolean;
    /** Sección 14.3: por defecto, una lámina sin elementos de su especialidad no se genera. */
    includeEmptySheets?: boolean;
}

export interface BuildDxfMultiSheetDocumentOptions extends DxfMultiSheetPrepareOptions {
    separationM?: number;
    exportedAtLabel: string;
    drawnBy?: string | null;
    reviewedBy?: string | null;
    revision?: string | null;
}

export interface DxfMultiSheetDocumentResult {
    dxfText: string;
    warnings: DxfExportWarning[];
    sheetCount: number;
}

interface PreparedLevel {
    level: DxfLevelPackage;
    geometry: DxfSheetGeometry;
    lightingEntities: ReturnType<typeof buildLightingEntities>;
    outletEntities: ReturnType<typeof buildOutletEntities>;
    lightingLegendRows: DxfLegendRow[];
    outletLegendRows: DxfLegendRow[];
    includeLighting: boolean;
    includeOutlets: boolean;
}

function disciplineHasContent(entities: { fixtures: unknown[]; lightSwitches: unknown[]; electricalDevices: unknown[]; conductors: unknown[]; junctionBoxes: unknown[] }): boolean {
    return entities.fixtures.length > 0 || entities.lightSwitches.length > 0
        || entities.electricalDevices.length > 0 || entities.conductors.length > 0
        || entities.junctionBoxes.length > 0;
}

function padNumber(n: number, width: number): string {
    return String(n).padStart(width, '0');
}

/**
 * Clasifica, geometriza y arma las filas de leyenda de cada nivel
 * seleccionado — el trabajo pesado compartido por el preview y la
 * generación completa. No emite texto DXF (eso es responsabilidad exclusiva
 * de `buildDxfMultiSheetDocument`).
 */
export function prepareDxfLevels(options: DxfMultiSheetPrepareOptions): { prepared: PreparedLevel[]; warnings: DxfExportWarning[] } {
    const paper = options.paperFormat
        ? resolvePaperSizeMm(options.paperFormat, options.paperOrientation ?? DEFAULT_PAPER_ORIENTATION)
        : resolvePaperSizeMm(DEFAULT_PAPER_FORMAT, DEFAULT_PAPER_ORIENTATION);
    const reserved = options.reserved ?? DEFAULT_RESERVED_ZONES_MM;
    const allowedScales = options.allowedScaleDenominators ?? ALLOWED_SCALE_DENOMINATORS;
    const includeEmptySheets = options.includeEmptySheets ?? false;
    const includeCadBase = options.includeCadBase ?? true;
    const wantsLighting = options.disciplines?.lighting ?? true;
    const wantsOutlets = options.disciplines?.outlets ?? true;

    const selectedLevels = options.levelSceneIds
        ? options.package.levels.filter((level) => options.levelSceneIds!.includes(level.sceneId))
        : options.package.levels;

    const warnings: DxfExportWarning[] = [...options.package.warnings];
    const prepared: PreparedLevel[] = [];

    for (const rawLevel of selectedLevels) {
        const level: DxfLevelPackage = includeCadBase
            ? rawLevel
            : { ...rawLevel, basePlan: { ...rawLevel.basePlan, entities: [] } };

        const classification = classifyDxfLevelEntities(level);
        warnings.push(...classification.warnings);

        const lightingEntities = buildLightingEntities(level, classification);
        const outletEntities = buildOutletEntities(level, classification);

        const geometry = options.scaleMode === 'manual' && options.manualScaleDenominator
            ? computeSheetGeometryAtScale(level.bounds, paper, reserved, options.manualScaleDenominator)
            : computeSheetGeometry(level.bounds, paper, reserved, allowedScales);

        if (!geometry.scaleFits) {
            warnings.push({
                code: 'sheet-scale-does-not-fit',
                message: `El nivel "${level.name}" no cabe ni con la escala más chica permitida; se usó igual, el plano puede quedar recortado.`,
                sceneId: level.sceneId, levelName: level.name,
            });
        }

        const hasLighting = disciplineHasContent(lightingEntities);
        const hasOutlets = disciplineHasContent(outletEntities);
        const includeLighting = wantsLighting && (hasLighting || includeEmptySheets);
        const includeOutlets = wantsOutlets && (hasOutlets || includeEmptySheets);

        if (wantsLighting && !includeLighting) {
            warnings.push({
                code: 'empty-sheet-skipped',
                message: `El nivel "${level.name}" no tiene elementos de alumbrado; no se generó esa lámina.`,
                sceneId: level.sceneId, levelName: level.name,
            });
        }
        if (wantsOutlets && !includeOutlets) {
            warnings.push({
                code: 'empty-sheet-skipped',
                message: `El nivel "${level.name}" no tiene elementos de tomacorrientes; no se generó esa lámina.`,
                sceneId: level.sceneId, levelName: level.name,
            });
        }

        const lightingLegendRows = buildLightingLegendRows(lightingEntities);
        const outletLegendRows = buildOutletLegendRows(outletEntities);
        for (const [rows, sceneLabel] of [[lightingLegendRows, 'alumbrado'], [outletLegendRows, 'tomacorrientes']] as const) {
            if (rows.length > LEGEND_OVERFLOW_ROW_THRESHOLD) {
                warnings.push({
                    code: 'legend-overflow',
                    message: `La leyenda de ${sceneLabel} del nivel "${level.name}" tiene muchas filas; revisar que quepa en la lámina.`,
                    sceneId: level.sceneId, levelName: level.name,
                });
            }
        }

        prepared.push({
            level, geometry, lightingEntities, outletEntities,
            lightingLegendRows, outletLegendRows, includeLighting, includeOutlets,
        });
    }

    return { prepared, warnings };
}

export interface DxfSheetPreviewRow {
    sceneId: string;
    levelName: string;
    discipline: 'lighting' | 'outlets';
    scaleDenominator: number;
    elementCount: number;
    legendRowCount: number;
}

export interface DxfExportPreview {
    sheets: DxfSheetPreviewRow[];
    warnings: DxfExportWarning[];
}

function countElements(entities: { fixtures: unknown[]; lightSwitches: unknown[]; electricalDevices: unknown[]; conductors: unknown[]; junctionBoxes: unknown[] }): number {
    return entities.fixtures.length + entities.lightSwitches.length + entities.electricalDevices.length
        + entities.conductors.length + entities.junctionBoxes.length;
}

/**
 * Vista previa textual (sección 15, "Vista previa mínima"): qué láminas se
 * generarían, en qué orden, a qué escala y con cuántos elementos/filas de
 * leyenda — sin construir el texto DXF completo. Pensada para recalcularse
 * en cada cambio del panel de opciones sin costo alto.
 */
export function buildDxfExportPreview(options: DxfMultiSheetPrepareOptions): DxfExportPreview {
    const { prepared, warnings } = prepareDxfLevels(options);
    const sheets: DxfSheetPreviewRow[] = [];

    for (const entry of prepared) {
        if (entry.includeLighting) {
            sheets.push({
                sceneId: entry.level.sceneId, levelName: entry.level.name, discipline: 'lighting',
                scaleDenominator: entry.geometry.scaleDenominator,
                elementCount: countElements(entry.lightingEntities),
                legendRowCount: entry.lightingLegendRows.length,
            });
        }
        if (entry.includeOutlets) {
            sheets.push({
                sceneId: entry.level.sceneId, levelName: entry.level.name, discipline: 'outlets',
                scaleDenominator: entry.geometry.scaleDenominator,
                elementCount: countElements(entry.outletEntities),
                legendRowCount: entry.outletLegendRows.length,
            });
        }
    }

    return { sheets, warnings };
}

function emitHeader(out: DxfLines, bounds: DxfBounds): void {
    p(out, 0, 'SECTION'); p(out, 2, 'HEADER');
    p(out, 9, '$ACADVER'); p(out, 1, 'AC1009');
    p(out, 9, '$EXTMIN');
    p(out, 10, bounds.minX.toFixed(6)); p(out, 20, bounds.minY.toFixed(6));
    p(out, 9, '$EXTMAX');
    p(out, 10, bounds.maxX.toFixed(6)); p(out, 20, bounds.maxY.toFixed(6));
    p(out, 0, 'ENDSEC');
}

function emitTables(out: DxfLines): void {
    p(out, 0, 'SECTION'); p(out, 2, 'TABLES');

    p(out, 0, 'TABLE'); p(out, 2, 'LTYPE'); p(out, 70, 1);
    p(out, 0, 'LTYPE'); p(out, 2, 'CONTINUOUS'); p(out, 70, 0);
    p(out, 3, 'Solid line'); p(out, 72, 65); p(out, 73, 0); p(out, 40, '0.0');
    p(out, 0, 'ENDTAB');

    p(out, 0, 'TABLE'); p(out, 2, 'LAYER'); p(out, 70, MULTISHEET_LAYER_DEFS.length);
    for (const layerDef of MULTISHEET_LAYER_DEFS) {
        p(out, 0, 'LAYER'); p(out, 2, layerDef.name); p(out, 70, 0); p(out, 62, layerDef.color); p(out, 6, 'CONTINUOUS');
    }
    p(out, 0, 'ENDTAB');

    p(out, 0, 'TABLE'); p(out, 2, 'STYLE'); p(out, 70, 1);
    p(out, 0, 'STYLE'); p(out, 2, 'STANDARD'); p(out, 70, 0);
    p(out, 40, '0.0'); p(out, 41, '1.0'); p(out, 50, '0.0'); p(out, 71, 0);
    p(out, 42, '0.2'); p(out, 3, 'txt'); p(out, 4, '');
    p(out, 0, 'ENDTAB');

    p(out, 0, 'ENDSEC');
}

/** Placeholder de la sección 14.3 cuando `includeEmptySheets` mantiene una lámina sin elementos. */
function renderEmptySheetPlaceholder(out: DxfLines, layer: string, planArea: DxfBounds): void {
    const cx = (planArea.minX + planArea.maxX) / 2;
    const cy = (planArea.minY + planArea.maxY) / 2;
    dxfText(out, layer, cx - 1, cy, 0.3, 'SIN ELEMENTOS REGISTRADOS');
}

export function buildDxfMultiSheetDocument(options: BuildDxfMultiSheetDocumentOptions): DxfMultiSheetDocumentResult {
    const separationM = options.separationM ?? DEFAULT_SHEET_SEPARATION_M;
    const includeEmptySheets = options.includeEmptySheets ?? false;
    const { prepared, warnings } = prepareDxfLevels(options);

    const layoutRows: DxfSheetLayoutRowInput[] = prepared.map((entry) => ({
        sceneId: entry.level.sceneId,
        sheets: [
            ...(entry.includeLighting ? [{ discipline: 'lighting' as const, frame: entry.geometry.frameOuter }] : []),
            ...(entry.includeOutlets ? [{ discipline: 'outlets' as const, frame: entry.geometry.frameOuter }] : []),
        ],
    }));
    const layout = layoutDxfSheets(layoutRows, separationM);

    const sheetCount = layout.placements.length;
    const numberWidth = Math.max(2, String(sheetCount).length);

    const out: DxfLines = [];
    const globalBounds: DxfBounds = layout.globalBounds
        ? {
            minX: layout.globalBounds.minX - DEFAULT_HEADER_PADDING_M,
            minY: layout.globalBounds.minY - DEFAULT_HEADER_PADDING_M,
            maxX: layout.globalBounds.maxX + DEFAULT_HEADER_PADDING_M,
            maxY: layout.globalBounds.maxY + DEFAULT_HEADER_PADDING_M,
        }
        : { minX: 0, minY: 0, maxX: 100, maxY: 100 };

    emitHeader(out, globalBounds);
    emitTables(out);

    // BLOCKS: un bloque arquitectónico por nivel que efectivamente tenga alguna lámina.
    p(out, 0, 'SECTION'); p(out, 2, 'BLOCKS');
    const levelsWithSheets = prepared.filter((entry) => entry.includeLighting || entry.includeOutlets);
    for (const entry of levelsWithSheets) {
        const architecture = entry.level.architecture;
        const wallMap = new Map(architecture.walls.map((wall) => [wall.id, wall]));
        emitLevelBlockDefinition(out, buildLevelBlockName(entry.level.floorIndex), () => {
            renderLevelArchitectureBlock(
                out, entry.level.basePlan.entities,
                architecture.rooms, architecture.walls, architecture.windows, architecture.doors, architecture.canopies,
                wallMap,
            );
        });
    }
    p(out, 0, 'ENDSEC');

    // ENTITIES: una lámina por cada colocación calculada.
    p(out, 0, 'SECTION'); p(out, 2, 'ENTITIES');

    for (const placement of layout.placements) {
        const entry = prepared.find((candidate) => candidate.level.sceneId === placement.sceneId)!;
        const sheetGeometry = translateSheetGeometry(entry.geometry, placement.placementOffset.x, placement.placementOffset.y);
        const totalOffset = sheetGeometry.modelToPlanOffset;

        emitLevelBlockInsert(out, 'DXF_BASE', buildLevelBlockName(entry.level.floorIndex), totalOffset.x, totalOffset.y);

        const disciplineEntities = placement.discipline === 'lighting' ? entry.lightingEntities : entry.outletEntities;
        const translated = translateElectricalEntities(disciplineEntities, totalOffset.x, totalOffset.y);

        if (placement.discipline === 'lighting') {
            renderFixtureEntities(out, 'LUMINARIAS', 'TEXTO_LUZ', translated.fixtures);
            renderLightSwitchEntities(out, 'INTERRUPTORES', 'TEXTO_LUZ', translated.lightSwitches);
            renderConductorEntities(
                out, 'CABLEADO_LUZ', translated.conductors,
                translated.fixtures, translated.lightSwitches, translated.electricalDevices, translated.junctionBoxes,
            );
        } else {
            const outlets = translated.electricalDevices.filter((device) => !PANEL_DEVICE_TYPES.has(device.type));
            const panels = translated.electricalDevices.filter((device) => PANEL_DEVICE_TYPES.has(device.type));
            renderElectricalDeviceEntities(out, 'TOMACORRIENTES', outlets);
            renderElectricalDeviceEntities(out, 'TABLEROS', panels);
            renderJunctionBoxEntities(out, 'CAJAS_PASE', translated.junctionBoxes);
            renderConductorEntities(
                out, 'CABLEADO_TOMAS', translated.conductors,
                translated.fixtures, translated.lightSwitches, translated.electricalDevices, translated.junctionBoxes,
            );
        }

        const sheetIndex = layout.placements.indexOf(placement) + 1;
        const metadata: DxfSheetMetadata = {
            sceneId: entry.level.sceneId,
            levelName: entry.level.name,
            discipline: placement.discipline,
            sheetIndex,
            sheetCount,
            sheetNumber: `${padNumber(sheetIndex, numberWidth)}/${padNumber(sheetCount, numberWidth)}`,
            projectName: options.package.projectName,
            disciplineLabel: DISCIPLINE_LABELS[placement.discipline],
            scaleDenominator: sheetGeometry.scaleDenominator,
            units: options.package.units,
            exportedAtLabel: options.exportedAtLabel,
            drawnBy: options.drawnBy,
            reviewedBy: options.reviewedBy,
            revision: options.revision,
        };

        renderSheetFrame(out, sheetGeometry);
        renderTitleBlock(out, sheetGeometry, metadata);

        const legendLayer = placement.discipline === 'lighting' ? 'LEYENDA_LUZ' : 'LEYENDA_TOMAS';
        const legendRows = placement.discipline === 'lighting' ? entry.lightingLegendRows : entry.outletLegendRows;
        const legendColumns = placement.discipline === 'lighting' ? LIGHTING_LEGEND_COLUMNS : OUTLET_LEGEND_COLUMNS;
        const legendTitle = `LEYENDA - ${DISCIPLINE_LABELS[placement.discipline]}`;
        renderLegendTable(out, legendLayer, sheetGeometry.legendArea, sheetGeometry.scaleDenominator, legendTitle, legendRows, legendColumns);

        if (legendRows.length === 0 && includeEmptySheets) {
            renderEmptySheetPlaceholder(out, 'REVISION_DXF', sheetGeometry.planArea);
        }
    }

    p(out, 0, 'ENDSEC');
    p(out, 0, 'EOF');

    return { dxfText: out.join('\n') + '\n', warnings, sheetCount };
}
