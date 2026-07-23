import type { DxfBasePlanPolicyMode } from '../builders/buildDxfDrawingPackage';
import type { DxfExportDisciplineSelection } from '../builders/buildDxfMultiSheetDocument';
import { DEFAULT_PAPER_FORMAT, DEFAULT_PAPER_ORIENTATION } from './constants';
import type { DxfPaperFormat, DxfPaperOrientation } from './types';

/**
 * Opciones de exportación controladas por el usuario desde el panel de la
 * Fase 9 (sección 15). Siempre explícitas (nunca `undefined`) para que el
 * formulario tenga un valor que mostrar en cada campo.
 */
export interface DxfExportUiOptions {
    /** IDs de escena incluidos. Vacío = ninguno seleccionado (no exportar nada), no "todos". */
    levelSceneIds: string[];
    disciplines: DxfExportDisciplineSelection;
    paperFormat: DxfPaperFormat;
    paperOrientation: DxfPaperOrientation;
    scaleMode: 'auto' | 'manual';
    manualScaleDenominator: number;
    includeCadBase: boolean;
    includeEmptySheets: boolean;
    /** Cómo repartir el fondo CAD único entre niveles cuando el proyecto es multinivel (sección 6.2/23). */
    basePlanPolicy: DxfBasePlanPolicyMode;
    drawnBy: string;
    reviewedBy: string;
    revision: string;
}

export function createDefaultDxfExportOptions(allSceneIds: string[]): DxfExportUiOptions {
    return {
        levelSceneIds: allSceneIds,
        disciplines: { lighting: true, outlets: true },
        paperFormat: DEFAULT_PAPER_FORMAT,
        paperOrientation: DEFAULT_PAPER_ORIENTATION,
        scaleMode: 'auto',
        manualScaleDenominator: 50,
        includeCadBase: true,
        includeEmptySheets: false,
        basePlanPolicy: 'active-scene-only',
        drawnBy: '',
        reviewedBy: '',
        revision: '',
    };
}
