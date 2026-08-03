import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import { useCallback, useState } from 'react';
import { parseDxfTextFallback } from '@/pages/dialux/hooks/dxfFallbackParser';
import type { DxfEntity } from '@/pages/dialux/hooks/types';
import { normalizeScaleConfig, useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { ScaleConfig } from '@/pages/dialux/hooks/useEditorStore';
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

/**
 * Scale DXF entity coordinates from CAD units to metres.
 * Mirrors the private scaleDxfEntities in useWasmEngine.ts.
 */
function scaleDxfEntities(entities: DxfEntity[], factor: number): DxfEntity[] {
    if (factor === 1) return entities;
    return entities.map((ent) => {
        const s = { ...ent } as Record<string, unknown>;
        const scl = (k: string) => {
            if (k in s && typeof s[k] === 'number') s[k] = (s[k] as number) * factor;
        };
        const sclArr = (k: string) => {
            if (k in s && Array.isArray(s[k])) {
                s[k] = (s[k] as [number, number][]).map(
                    ([a, b]: [number, number]) => [a * factor, b * factor],
                );
            }
        };
        ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r',
            'width', 'height', 'major_x', 'major_y'].forEach(scl);
        ['vertices', 'control_points'].forEach(sclArr);
        if ('boundary_paths' in s && Array.isArray(s['boundary_paths'])) {
            s['boundary_paths'] = (s['boundary_paths'] as [number, number][][]).map(
                (path) => path.map(([a, b]) => [a * factor, b * factor]),
            );
        }
        return s as unknown as DxfEntity;
    });
}

/**
 * Try to extract DXF entities from the mlightcad engine document.
 * Used as a fallback when state.dxfEntities is empty (e.g. DWG files or when
 * the WASM parser was not run).
 *
 * Returns entities already scaled to metres using the provided scaleConfig.
 */
function fetchEngineEntities(scaleConfig: ScaleConfig): DxfEntity[] {
    try {
        const db = AcApDocManager.instance?.curDocument
            ?.database as unknown as (Record<string, unknown> | undefined);

        if (!db || typeof db['dxfOut'] !== 'function') return [];

        const dxfText = (db['dxfOut'] as () => unknown)() as string;
        if (typeof dxfText !== 'string' || dxfText.length < 20) return [];

        const parsed = parseDxfTextFallback(dxfText);
        const entities: DxfEntity[] = Array.isArray(parsed.entities) ? parsed.entities : [];
        if (entities.length === 0) return [];

        const effectiveScale =
            (scaleConfig.factor ?? 1) * (scaleConfig.calibrationFactor ?? 1);
        return scaleDxfEntities(entities, effectiveScale);
    } catch (e) {
        console.warn('[DXF Export] No se pudo leer el plano base del engine:', e);
        return [];
    }
}

/**
 * Arma el `DxfDrawingPackage` (Fase 1) desde el estado actual del editor:
 * todas las escenas del proyecto, con el ÚNICO fondo CAD disponible hoy
 * (`state.dxfEntities`, con fallback al engine mlightcad si está vacío) y la
 * política de reparto que el usuario eligió en el panel.
 */
function buildCurrentDrawingPackage(basePlanPolicy: DxfExportUiOptions['basePlanPolicy']): DxfDrawingPackage | null {
    const state = useEditorStore.getState();
    if (!state.project || !state.activeSceneId) return null;

    const activeScene = state.project.scenes.find((scene) => scene.id === state.activeSceneId);
    const scaleConfig = activeScene ? normalizeScaleConfig(activeScene.scaleConfig) : null;

    const rawEntities = state.dxfEntities && state.dxfEntities.length > 0
        ? state.dxfEntities
        : (scaleConfig ? fetchEngineEntities(scaleConfig) : []);

    const globalBasePlan: DxfGlobalBasePlan | null =
        rawEntities.length > 0 || state.dxfExtents
            ? { entities: rawEntities, extents: state.dxfExtents }
            : null;

    return buildDxfDrawingPackage({
        project: state.project,
        activeSceneId: state.activeSceneId,
        globalBasePlan,
        basePlanPolicy,
    });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDialuxDxfExport(): UseDialuxDxfExportResult {
    const [isExporting, setIsExporting] = useState(false);
    const [exportStep, setExportStep] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<DxfExportWarning[]>([]);
    const [lastError, setLastError] = useState<string | null>(null);

    const buildPreview = useCallback((options: DxfExportUiOptions): DxfExportPreview | null => {
        const pkg = buildCurrentDrawingPackage(options.basePlanPolicy);
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
            const pkg = buildCurrentDrawingPackage(options.basePlanPolicy);
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
