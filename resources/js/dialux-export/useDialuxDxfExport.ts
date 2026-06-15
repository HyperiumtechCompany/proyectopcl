import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import { useCallback, useState } from 'react';
import { parseDxfTextFallback } from '@/hooks/dialux/dxfFallbackParser';
import type { DxfEntity } from '@/hooks/dialux/types';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';
import type { ScaleConfig } from '@/hooks/dialux/useEditorStore';
import { buildDialuxExportSnapshot } from './snapshot/buildDialuxExportSnapshot';
import { buildDialuxDxfExport } from './dxf/buildDialuxDxfExport';

export interface UseDialuxDxfExportResult {
    exportDxf: () => void;
    isExporting: boolean;
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDialuxDxfExport(): UseDialuxDxfExportResult {
    const [isExporting, setIsExporting] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const exportDxf = useCallback(() => {
        const state = useEditorStore.getState();
        if (!state.project || !state.activeSceneId) return;

        setIsExporting(true);
        setLastError(null);

        try {
            const snapshot = buildDialuxExportSnapshot({
                project: state.project,
                activeSceneId: state.activeSceneId,
                resultsByRoom: state.resultsByRoom,
                dxfEntities: state.dxfEntities,
                dxfExtents: state.dxfExtents,
                visualConfig: {
                    showGrid: state.ui.showGrid,
                    showIsolux: state.ui.showIsolux,
                    show3DView: state.ui.show3DView,
                    isoluxMode: state.ui.isoluxMode,
                    zoom: state.ui.zoom,
                    panX: state.ui.panX,
                    panY: state.ui.panY,
                    selectedId: state.ui.selectedId,
                },
            });

            // If the state has no DXF entities (common for DWG files where the
            // WASM parser is not invoked), fall back to reading directly from the
            // mlightcad engine document via database.dxfOut().
            const basePlanEntities =
                snapshot.dxfEntities.length > 0
                    ? snapshot.dxfEntities
                    : fetchEngineEntities(snapshot.scaleConfig);

            const finalSnapshot =
                basePlanEntities !== snapshot.dxfEntities
                    ? { ...snapshot, dxfEntities: basePlanEntities }
                    : snapshot;

            const dxfContent = buildDialuxDxfExport(finalSnapshot);
            const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const projectName = (state.project.name ?? 'plano').replace(
                /[^a-zA-Z0-9_\-]/g, '_',
            );
            a.href = url;
            a.download = `${projectName}_plano2d.dxf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : 'No se pudo exportar el DXF.';
            setLastError(msg);
            console.error('[DXF Export]', err);
        } finally {
            setIsExporting(false);
        }
    }, []);

    return { exportDxf, isExporting, lastError };
}
