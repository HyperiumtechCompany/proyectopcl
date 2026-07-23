/**
 * DxfExportDialog.tsx
 *
 * Panel de opciones de exportación DXF multinivel (plan maestro, Fase 9,
 * sección 15). Deja elegir niveles, especialidades, papel/escala y política
 * de fondo CAD compartido; muestra una vista previa textual de las láminas
 * que se generarían junto con cualquier advertencia, ANTES de descargar.
 */

import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { DxfBasePlanPolicyMode } from '@/pages/dialux/export/dxf/builders/buildDxfDrawingPackage';
import { ALLOWED_SCALE_DENOMINATORS } from '@/pages/dialux/export/dxf/domain/constants';
import { createDefaultDxfExportOptions, type DxfExportUiOptions } from '@/pages/dialux/export/dxf/domain/exportOptions';
import type { DxfPaperFormat, DxfPaperOrientation } from '@/pages/dialux/export/dxf/domain/types';
import { useDialuxDxfExport } from '@/pages/dialux/export';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';

interface DxfExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PAPER_FORMATS: DxfPaperFormat[] = ['A0', 'A1', 'A2', 'A3', 'A4'];

const DISCIPLINE_LABEL_ES: Record<'lighting' | 'outlets', string> = {
    lighting: 'Alumbrado',
    outlets: 'Tomacorrientes',
};

function floorLabel(scene: { floorIndex: number; name: string }): string {
    if (scene.floorIndex === 0) return `PB · ${scene.name}`;
    if (scene.floorIndex > 0) return `P${scene.floorIndex} · ${scene.name}`;
    return `S${Math.abs(scene.floorIndex)} · ${scene.name}`;
}

export const DxfExportDialog: React.FC<DxfExportDialogProps> = ({ open, onOpenChange }) => {
    const project = useEditorStore((s) => s.project);
    const { exportDxf, buildPreview, isExporting, exportStep, lastError } = useDialuxDxfExport();

    const sceneIds = useMemo(() => project?.scenes.map((scene) => scene.id) ?? [], [project]);
    const [options, setOptions] = useState<DxfExportUiOptions>(() => createDefaultDxfExportOptions(sceneIds));

    // Reabrir el panel siempre parte de las opciones por defecto con los
    // niveles ACTUALES del proyecto — evita arrastrar una selección de
    // niveles que ya no existen tras editar el proyecto.
    useEffect(() => {
        if (open) setOptions(createDefaultDxfExportOptions(sceneIds));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const preview = useMemo(() => (open ? buildPreview(options) : null), [open, options, buildPreview]);

    const scenesByFloor = useMemo(
        () => [...(project?.scenes ?? [])].sort((a, b) => a.floorIndex - b.floorIndex),
        [project],
    );
    const isMultiLevel = scenesByFloor.length > 1;

    const toggleLevel = (sceneId: string) => {
        setOptions((prev) => ({
            ...prev,
            levelSceneIds: prev.levelSceneIds.includes(sceneId)
                ? prev.levelSceneIds.filter((id) => id !== sceneId)
                : [...prev.levelSceneIds, sceneId],
        }));
    };

    const canExport = options.levelSceneIds.length > 0
        && (options.disciplines.lighting || options.disciplines.outlets)
        && !isExporting;

    const handleExport = async () => {
        await exportDxf(options);
        // Si terminó sin error, cerramos; si hubo error, el mensaje se
        // muestra dentro del panel para que el usuario pueda corregir y reintentar.
        if (!lastError) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-[#090b10] text-slate-100 sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-white">
                        Exportar planos DXF por nivel
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Elige qué niveles y especialidades exportar. Cada nivel genera hasta dos láminas
                        (alumbrado y tomacorrientes), cada una en su propio marco con cajetín y leyenda.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    {/* ── Niveles ─────────────────────────────────────────────── */}
                    <section>
                        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                            Niveles
                        </h3>
                        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/60 p-2">
                            {scenesByFloor.length === 0 && (
                                <p className="px-1 py-1 text-xs text-slate-500">Sin niveles en el proyecto.</p>
                            )}
                            {scenesByFloor.map((scene) => (
                                <label
                                    key={scene.id}
                                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-200 hover:bg-slate-800/60"
                                >
                                    <input
                                        type="checkbox"
                                        checked={options.levelSceneIds.includes(scene.id)}
                                        onChange={() => toggleLevel(scene.id)}
                                        className="accent-emerald-500"
                                    />
                                    {floorLabel(scene)}
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* ── Especialidades ──────────────────────────────────────── */}
                    <section>
                        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                            Especialidades
                        </h3>
                        <div className="space-y-1 rounded-lg border border-slate-700 bg-slate-950/60 p-2">
                            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-200 hover:bg-slate-800/60">
                                <input
                                    type="checkbox"
                                    checked={options.disciplines.lighting}
                                    onChange={() => setOptions((prev) => ({
                                        ...prev, disciplines: { ...prev.disciplines, lighting: !prev.disciplines.lighting },
                                    }))}
                                    className="accent-amber-500"
                                />
                                Alumbrado
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-200 hover:bg-slate-800/60">
                                <input
                                    type="checkbox"
                                    checked={options.disciplines.outlets}
                                    onChange={() => setOptions((prev) => ({
                                        ...prev, disciplines: { ...prev.disciplines, outlets: !prev.disciplines.outlets },
                                    }))}
                                    className="accent-cyan-500"
                                />
                                Tomacorrientes
                            </label>
                        </div>

                        {isMultiLevel && (
                            <div className="mt-2">
                                <label htmlFor="dxf-base-plan-policy" className="mb-1 block text-[11px] text-slate-400">
                                    Fondo CAD compartido entre niveles
                                </label>
                                <select
                                    id="dxf-base-plan-policy"
                                    value={options.basePlanPolicy}
                                    onChange={(e) => setOptions((prev) => ({
                                        ...prev, basePlanPolicy: e.target.value as DxfBasePlanPolicyMode,
                                    }))}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                                >
                                    <option value="active-scene-only">Solo en el nivel activo</option>
                                    <option value="shared-all-levels">Repetir en todos los niveles</option>
                                    <option value="drawn-only">Sin fondo CAD (solo lo dibujado)</option>
                                    <option value="none">Ningún nivel lleva fondo</option>
                                </select>
                            </div>
                        )}
                    </section>

                    {/* ── Papel y escala ──────────────────────────────────────── */}
                    <section>
                        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                            Papel y escala
                        </h3>
                        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2">
                            <div className="flex gap-2">
                                <select
                                    aria-label="Formato de papel"
                                    value={options.paperFormat}
                                    onChange={(e) => setOptions((prev) => ({ ...prev, paperFormat: e.target.value as DxfPaperFormat }))}
                                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                                >
                                    {PAPER_FORMATS.map((format) => (
                                        <option key={format} value={format}>{format}</option>
                                    ))}
                                </select>
                                <select
                                    aria-label="Orientación de papel"
                                    value={options.paperOrientation}
                                    onChange={(e) => setOptions((prev) => ({ ...prev, paperOrientation: e.target.value as DxfPaperOrientation }))}
                                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                                >
                                    <option value="landscape">Horizontal</option>
                                    <option value="portrait">Vertical</option>
                                </select>
                            </div>

                            <div className="flex rounded-lg border border-slate-700 bg-slate-950/40 p-0.5 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setOptions((prev) => ({ ...prev, scaleMode: 'auto' }))}
                                    className={`flex-1 rounded-md px-2 py-1.5 font-medium transition-colors ${
                                        options.scaleMode === 'auto' ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Escala automática
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOptions((prev) => ({ ...prev, scaleMode: 'manual' }))}
                                    className={`flex-1 rounded-md px-2 py-1.5 font-medium transition-colors ${
                                        options.scaleMode === 'manual' ? 'bg-amber-600 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Escala manual
                                </button>
                            </div>

                            {options.scaleMode === 'manual' && (
                                <select
                                    aria-label="Escala manual"
                                    value={options.manualScaleDenominator}
                                    onChange={(e) => setOptions((prev) => ({ ...prev, manualScaleDenominator: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500"
                                >
                                    {ALLOWED_SCALE_DENOMINATORS.map((denominator) => (
                                        <option key={denominator} value={denominator}>1:{denominator}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </section>

                    {/* ── Otras opciones ──────────────────────────────────────── */}
                    <section>
                        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                            Otras opciones
                        </h3>
                        <div className="space-y-1 rounded-lg border border-slate-700 bg-slate-950/60 p-2">
                            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-200 hover:bg-slate-800/60">
                                <input
                                    type="checkbox"
                                    checked={options.includeCadBase}
                                    onChange={() => setOptions((prev) => ({ ...prev, includeCadBase: !prev.includeCadBase }))}
                                    className="accent-slate-400"
                                />
                                Incluir fondo CAD importado
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-200 hover:bg-slate-800/60">
                                <input
                                    type="checkbox"
                                    checked={options.includeEmptySheets}
                                    onChange={() => setOptions((prev) => ({ ...prev, includeEmptySheets: !prev.includeEmptySheets }))}
                                    className="accent-slate-400"
                                />
                                Incluir láminas sin elementos
                            </label>
                        </div>
                    </section>
                </div>

                {/* ── Cajetín ──────────────────────────────────────────────────── */}
                <section>
                    <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                        Cajetín
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            type="text"
                            placeholder="Dibujado por"
                            value={options.drawnBy}
                            onChange={(e) => setOptions((prev) => ({ ...prev, drawnBy: e.target.value }))}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                        />
                        <input
                            type="text"
                            placeholder="Revisado por"
                            value={options.reviewedBy}
                            onChange={(e) => setOptions((prev) => ({ ...prev, reviewedBy: e.target.value }))}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                        />
                        <input
                            type="text"
                            placeholder="Revisión (ej. A)"
                            value={options.revision}
                            onChange={(e) => setOptions((prev) => ({ ...prev, revision: e.target.value }))}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                        />
                    </div>
                </section>

                {/* ── Vista previa ─────────────────────────────────────────────── */}
                <section>
                    <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                        Vista previa ({preview?.sheets.length ?? 0} lámina{preview?.sheets.length === 1 ? '' : 's'})
                    </h3>
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/60 p-2">
                        {(!preview || preview.sheets.length === 0) && (
                            <p className="px-1 py-1 text-xs text-slate-500">
                                Ninguna lámina se generaría con esta selección.
                            </p>
                        )}
                        {preview?.sheets.map((sheet) => (
                            <div
                                key={`${sheet.sceneId}-${sheet.discipline}`}
                                className="flex items-center justify-between rounded px-1.5 py-1 text-xs text-slate-300"
                            >
                                <span className="font-mono text-slate-200">
                                    {sheet.levelName} — {DISCIPLINE_LABEL_ES[sheet.discipline]}
                                </span>
                                <span className="text-slate-500">
                                    1:{sheet.scaleDenominator} · {sheet.elementCount} elem. · {sheet.legendRowCount} filas
                                </span>
                            </div>
                        ))}
                    </div>

                    {!!preview?.warnings.length && (
                        <div className="mt-2 space-y-1 rounded-lg border border-amber-700/40 bg-amber-950/20 p-2">
                            {preview.warnings.map((warning, index) => (
                                <p key={index} className="flex items-start gap-1.5 text-[11px] text-amber-200">
                                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                    {warning.message}
                                </p>
                            ))}
                        </div>
                    )}

                    {lastError && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-800/40 bg-red-950/30 p-2 text-[11px] text-red-300">
                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                            {lastError}
                        </p>
                    )}
                </section>

                {/* ── Acciones ─────────────────────────────────────────────────── */}
                <div className="mt-2 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={isExporting}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={!canExport}
                        onClick={() => void handleExport()}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isExporting
                            ? <><Loader2 size={13} className="animate-spin" /> {exportStep || 'Exportando...'}</>
                            : <><Download size={13} /> Descargar DXF</>}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
