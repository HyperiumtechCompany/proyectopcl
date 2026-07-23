import { ALLOWED_SCALE_DENOMINATORS } from '../domain/constants';
import type {
    DxfBounds,
    DxfPaperSize,
    DxfSheetGeometry,
    DxfSheetReservedZonesMm,
} from '../domain/types';

/** mm de papel → metros de Model Space, a escala 1:`scaleDenominator` (sección 7.2). */
export function paperMmToModelM(mm: number, scaleDenominator: number): number {
    return (mm * scaleDenominator) / 1000;
}

/** metros de Model Space → mm de papel, a escala 1:`scaleDenominator`. */
export function modelMToPaperMm(m: number, scaleDenominator: number): number {
    return (m * 1000) / scaleDenominator;
}

export interface DxfAutoScaleResult {
    scaleDenominator: number;
    /** false cuando ni la escala más chica de la lista permitida (denominador más grande) hace caber el plano. */
    fits: boolean;
    requiredMinimumDenominator: number;
}

/**
 * Escala automática normalizada (sección 7.3): calcula el denominador mínimo
 * que hace caber ancho y alto disponibles y redondea hacia ARRIBA a la
 * siguiente escala permitida — nunca hacia abajo, porque eso dejaría el
 * plano sin caber. El mismo denominador se aplica a X e Y (nunca se deforma).
 */
export function computeAutoScale(
    modelWidthM: number,
    modelHeightM: number,
    availableWidthMm: number,
    availableHeightMm: number,
    allowedScaleDenominators: readonly number[] = ALLOWED_SCALE_DENOMINATORS,
): DxfAutoScaleResult {
    const safeWidth = Math.max(modelWidthM, 0);
    const safeHeight = Math.max(modelHeightM, 0);
    const requiredForWidth = availableWidthMm > 0 ? (safeWidth * 1000) / availableWidthMm : Infinity;
    const requiredForHeight = availableHeightMm > 0 ? (safeHeight * 1000) / availableHeightMm : Infinity;
    const requiredMinimumDenominator = Math.max(requiredForWidth, requiredForHeight);

    const sorted = [...allowedScaleDenominators].sort((a, b) => a - b);
    const fitting = sorted.find((denominator) => denominator >= requiredMinimumDenominator);

    if (fitting !== undefined) {
        return { scaleDenominator: fitting, fits: true, requiredMinimumDenominator };
    }
    return {
        scaleDenominator: sorted[sorted.length - 1]!,
        fits: false,
        requiredMinimumDenominator,
    };
}

/** Construye los rectángulos de marco/plano/leyenda/cajetín y el offset de centrado para una escala ya decidida. */
function buildSheetGeometryForScale(
    modelBounds: DxfBounds,
    paper: DxfPaperSize,
    reserved: DxfSheetReservedZonesMm,
    scaleDenominator: number,
    scaleFits: boolean,
): DxfSheetGeometry {
    const modelWidthM = Math.max(modelBounds.maxX - modelBounds.minX, 0);
    const modelHeightM = Math.max(modelBounds.maxY - modelBounds.minY, 0);
    const toM = (mm: number) => paperMmToModelM(mm, scaleDenominator);

    const frameOuter: DxfBounds = { minX: 0, minY: 0, maxX: toM(paper.widthMm), maxY: toM(paper.heightMm) };
    const frameInner: DxfBounds = {
        minX: toM(reserved.marginMm),
        minY: toM(reserved.marginMm),
        maxX: toM(paper.widthMm - reserved.marginMm),
        maxY: toM(paper.heightMm - reserved.marginMm),
    };

    const planAreaWidthMm = paper.widthMm - 2 * reserved.marginMm - reserved.legendColumnWidthMm;
    const planArea: DxfBounds = {
        minX: frameInner.minX,
        minY: frameInner.minY,
        maxX: frameInner.minX + toM(planAreaWidthMm),
        maxY: frameInner.maxY,
    };
    const legendColumn: DxfBounds = {
        minX: planArea.maxX,
        minY: frameInner.minY,
        maxX: frameInner.maxX,
        maxY: frameInner.maxY,
    };
    // Cajetín abajo, leyenda arriba (sección 8: mismo orden que el diagrama de anatomía del marco).
    const titleBlockArea: DxfBounds = {
        minX: legendColumn.minX,
        minY: legendColumn.minY,
        maxX: legendColumn.maxX,
        maxY: legendColumn.minY + toM(reserved.titleBlockHeightMm),
    };
    const legendArea: DxfBounds = {
        minX: legendColumn.minX,
        minY: titleBlockArea.maxY,
        maxX: legendColumn.maxX,
        maxY: legendColumn.maxY,
    };

    const planAreaWidthM = planArea.maxX - planArea.minX;
    const planAreaHeightM = planArea.maxY - planArea.minY;
    const modelToPlanOffset = {
        x: planArea.minX + (planAreaWidthM - modelWidthM) / 2 - modelBounds.minX,
        y: planArea.minY + (planAreaHeightM - modelHeightM) / 2 - modelBounds.minY,
    };

    return {
        paper,
        scaleDenominator,
        scaleFits,
        frameOuter,
        frameInner,
        planArea,
        legendArea,
        titleBlockArea,
        modelToPlanOffset,
    };
}

/** Geometría de lámina con escala AUTOMÁTICA (sección 7.3). */
export function computeSheetGeometry(
    modelBounds: DxfBounds,
    paper: DxfPaperSize,
    reserved: DxfSheetReservedZonesMm,
    allowedScaleDenominators: readonly number[] = ALLOWED_SCALE_DENOMINATORS,
): DxfSheetGeometry {
    const planAreaWidthMm = paper.widthMm - 2 * reserved.marginMm - reserved.legendColumnWidthMm;
    const planAreaHeightMm = paper.heightMm - 2 * reserved.marginMm;
    const modelWidthM = Math.max(modelBounds.maxX - modelBounds.minX, 0);
    const modelHeightM = Math.max(modelBounds.maxY - modelBounds.minY, 0);

    const auto = computeAutoScale(modelWidthM, modelHeightM, planAreaWidthMm, planAreaHeightMm, allowedScaleDenominators);
    return buildSheetGeometryForScale(modelBounds, paper, reserved, auto.scaleDenominator, auto.fits);
}

/** Geometría de lámina a una escala MANUAL explícita (sección 15: "Escala manual"). */
export function computeSheetGeometryAtScale(
    modelBounds: DxfBounds,
    paper: DxfPaperSize,
    reserved: DxfSheetReservedZonesMm,
    scaleDenominator: number,
): DxfSheetGeometry {
    return buildSheetGeometryForScale(modelBounds, paper, reserved, scaleDenominator, true);
}

/**
 * Traslada una `DxfSheetGeometry` completa por (dx, dy) — Fase 8, al ubicar
 * una lámina (calculada en coordenadas LOCALES, marco en (0,0)) en su
 * posición final dentro del dibujo con varias láminas. `modelToPlanOffset`
 * también se desplaza: sigue siendo, tras la traslación, el offset total que
 * hay que sumarle a las coordenadas reales del nivel para que caigan
 * centradas en la nueva posición de `planArea`.
 */
export function translateSheetGeometry(geometry: DxfSheetGeometry, dx: number, dy: number): DxfSheetGeometry {
    const shift = (b: DxfBounds): DxfBounds => (
        { minX: b.minX + dx, minY: b.minY + dy, maxX: b.maxX + dx, maxY: b.maxY + dy }
    );
    return {
        ...geometry,
        frameOuter: shift(geometry.frameOuter),
        frameInner: shift(geometry.frameInner),
        planArea: shift(geometry.planArea),
        legendArea: shift(geometry.legendArea),
        titleBlockArea: shift(geometry.titleBlockArea),
        modelToPlanOffset: { x: geometry.modelToPlanOffset.x + dx, y: geometry.modelToPlanOffset.y + dy },
    };
}
