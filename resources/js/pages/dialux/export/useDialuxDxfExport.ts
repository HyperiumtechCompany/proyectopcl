import { useCallback, useEffect, useState } from 'react';
import { extractDxfEntitiesFromEngineDocument } from '@/pages/dialux/hooks/engineDxfExtraction';
import type { DxfEntity } from '@/pages/dialux/hooks/types';
import { normalizeScaleConfig, useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { loadWasmModule, peekWasmModule, type DialuxWasmModule } from '@/pages/dialux/hooks/useWasmEngine';
import { buildDxfDrawingPackage, type DxfGlobalBasePlan } from './dxf/builders/buildDxfDrawingPackage';
import {
    buildDxfExportPreview, buildDxfMultiSheetDocument, type DxfExportPreview,
} from './dxf/builders/buildDxfMultiSheetDocument';
import type { DxfExportUiOptions } from './dxf/domain/exportOptions';
import type { DxfDrawingPackage, DxfExportWarning } from './dxf/domain/types';
import { buildSafeDxfFilename, downloadDxfDocument } from './downloadDxfDocument';

export interface UseDialuxDxfExportResult {
    /** Genera las láminas con las opciones dadas y dispara la descarga. */
    exportDxf: (options: DxfExportUiOptions) => Promise<void>;
    /**
     * Vista previa textual (sección 15) sin generar el texto DXF completo —
     * pensada para recalcularse en cada cambio del panel de opciones.
     * `null` cuando no hay proyecto/escena activa.
     */
    buildPreview: (options: DxfExportUiOptions) => DxfExportPreview | null;
    isExporting: boolean;
    exportStep: string | null;
    warnings: DxfExportWarning[];
    lastError: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "DIMENSION (bloque no encontrado)×5, Leader×1" -- para el mensaje del warning. */
export function formatSkippedEntityTypes(skipped: Record<string, number>): string {
    return Object.entries(skipped)
        .map(([type, count]) => `${type}×${count}`)
        .join(', ');
}

/**
 * Arma el `DxfDrawingPackage` (Fase 1) desde el estado actual del editor:
 * todas las escenas del proyecto, con el ÚNICO fondo CAD disponible hoy
 * (`state.dxfEntities`, con fallback al engine mlightcad si está vacío) y la
 * política de reparto que el usuario eligió en el panel.
 */
function buildCurrentDrawingPackage(
    basePlanPolicy: DxfExportUiOptions['basePlanPolicy'],
    wasmModule: DialuxWasmModule | null,
): DxfDrawingPackage | null {
    const state = useEditorStore.getState();
    if (!state.project || !state.activeSceneId) return null;

    const activeScene = state.project.scenes.find((scene) => scene.id === state.activeSceneId);
    const scaleConfig = activeScene ? normalizeScaleConfig(activeScene.scaleConfig) : null;

    let rawEntities: DxfEntity[];
    let skippedEntityTypes: Record<string, number> | null;
    if (state.dxfEntities && state.dxfEntities.length > 0) {
        rawEntities = state.dxfEntities;
        skippedEntityTypes = state.dxfSkippedEntityTypes;
    } else if (scaleConfig) {
        const engineResult = extractDxfEntitiesFromEngineDocument(scaleConfig, wasmModule);
        rawEntities = engineResult.entities;
        skippedEntityTypes = engineResult.skippedEntityTypes;
    } else {
        rawEntities = [];
        skippedEntityTypes = null;
    }

    const globalBasePlan: DxfGlobalBasePlan | null =
        rawEntities.length > 0 || state.dxfExtents
            ? { entities: rawEntities, extents: state.dxfExtents }
            : null;

    const pkg = buildDxfDrawingPackage({
        project: state.project,
        activeSceneId: state.activeSceneId,
        globalBasePlan,
        basePlanPolicy,
    });

    if (skippedEntityTypes) {
        pkg.warnings.push({
            code: 'base-plan-entity-unsupported',
            message: `El plano base importado trae entidades que el exportador aún no soporta y NO se incluyeron: ${formatSkippedEntityTypes(skippedEntityTypes)}.`,
            sceneId: null,
            levelName: null,
        });
    }

    return pkg;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDialuxDxfExport(): UseDialuxDxfExportResult {
    const [isExporting, setIsExporting] = useState(false);
    const [exportStep, setExportStep] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<DxfExportWarning[]>([]);
    const [lastError, setLastError] = useState<string | null>(null);

    // Precarga en segundo plano (sin bloquear) el parser WASM rico apenas se
    // usa el hook, para maximizar la chance de que `buildPreview` (síncrono,
    // no puede esperar la carga) ya lo encuentre cacheado via `peekWasmModule`.
    useEffect(() => {
        void loadWasmModule();
    }, []);

    const buildPreview = useCallback((options: DxfExportUiOptions): DxfExportPreview | null => {
        const pkg = buildCurrentDrawingPackage(options.basePlanPolicy, peekWasmModule());
        if (!pkg) return null;

        return buildDxfExportPreview({
            package: pkg,
            levelSceneIds: options.levelSceneIds,
            disciplines: options.disciplines,
            paperFormat: options.paperFormat,
            paperOrientation: options.paperOrientation,
            scaleMode: options.scaleMode,
            manualScaleDenominator: options.manualScaleDenominator,
            includeCadBase: options.includeCadBase,
            includeEmptySheets: options.includeEmptySheets,
        });
    }, []);

    const exportDxf = useCallback(async (options: DxfExportUiOptions): Promise<void> => {
        const state = useEditorStore.getState();
        if (!state.project || !state.activeSceneId) return;

        setIsExporting(true);
        setExportStep('Preparando niveles...');
        setLastError(null);
        setWarnings([]);

        try {
            // Export final: sí vale la pena esperar la carga del WASM (si aún
            // no estaba cacheada) para garantizar el parser rico del plano
            // base en vez del fallback TS limitado.
            const wasmModule = await loadWasmModule();
            const pkg = buildCurrentDrawingPackage(options.basePlanPolicy, wasmModule);
            if (!pkg) throw new Error('No hay un proyecto activo para exportar.');

            setExportStep('Generando láminas...');
            const exportedAtLabel = new Date().toLocaleDateString('es-PE', {
                year: 'numeric', month: '2-digit', day: '2-digit',
            });
            const result = buildDxfMultiSheetDocument({
                package: pkg,
                levelSceneIds: options.levelSceneIds,
                disciplines: options.disciplines,
                paperFormat: options.paperFormat,
                paperOrientation: options.paperOrientation,
                scaleMode: options.scaleMode,
                manualScaleDenominator: options.manualScaleDenominator,
                includeCadBase: options.includeCadBase,
                includeEmptySheets: options.includeEmptySheets,
                exportedAtLabel,
                drawnBy: options.drawnBy || null,
                reviewedBy: options.reviewedBy || null,
                revision: options.revision || null,
            });

            setWarnings(result.warnings);

            if (result.sheetCount === 0) {
                throw new Error('No se generó ninguna lámina con las opciones seleccionadas — revisa los niveles y especialidades marcadas.');
            }

            setExportStep('Descargando...');
            downloadDxfDocument(result.dxfText, buildSafeDxfFilename(state.project.name));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'No se pudo exportar el DXF.';
            setLastError(msg);
            console.error('[DXF Export]', err);
        } finally {
            setIsExporting(false);
            setExportStep(null);
        }
    }, []);

    return { exportDxf, buildPreview, isExporting, exportStep, warnings, lastError };
}
