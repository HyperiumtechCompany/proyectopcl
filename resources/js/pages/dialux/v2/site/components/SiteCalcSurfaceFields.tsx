import { Calculator } from 'lucide-react';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { areaGridFor,
    effectiveWidthM, siteSpaceCover, siteSpaceReflectances } from '../domain/siteLightingCalculation';
import type { SiteCalcSurface, SiteElement } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { useSiteLightingCalculation } from '../hooks/useSiteLightingCalculation';

const field =
    'mt-0.5 h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';

const fmt = (value: number, digits = 2) =>
    value.toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Objeto de cálculo del ESPACIO (como en DIALux evo): cada espacio exterior
 * (vereda, cancha, techado, rampa…) tiene su malla — automática EN 12464,
 * fina o propia — y su altura de plano, y se puede calcular SOLO él para
 * probarlo sin recalcular toda la planta.
 */
export function SiteCalcSurfaceFields({
    element,
    editor,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
}) {
    const updateSiteElement = useEditorStore((state) => state.updateSiteElement);
    const lighting = useSiteLightingCalculation(editor.siteData);
    const surface = element.calcSurface ?? {};
    const scaleM = editor.terrainScaleM || 1;
    const xs = element.vertices.map((v) => v.x * scaleM);
    const ys = element.vertices.map((v) => v.y * scaleM);
    const widthM = Math.max(...xs) - Math.min(...xs);
    const lengthM = Math.max(...ys) - Math.min(...ys);
    const grid = areaGridFor(surface, widthM, lengthM, effectiveWidthM(element, scaleM));
    const points = Math.max(1, Math.round(widthM / grid.spacingM)) * Math.max(1, Math.round(lengthM / grid.spacingM));
    const result = lighting.calculation?.areas.find((area) => area.elementId === element.id);
    const update = (patch: Partial<SiteCalcSurface>) =>
        updateSiteElement(element.id, { calcSurface: { ...surface, ...patch } });
    const reflectances = siteSpaceReflectances(element);
    const covered = siteSpaceCover(element) !== null;
    const percent = (value: string) => Math.min(95, Math.max(0, Number(value) || 0)) / 100;

    return (
        <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-[11px] dark:border-amber-500/20 dark:bg-amber-500/5">
            <p className="font-bold text-slate-700 dark:text-slate-200">Superficie de cálculo</p>
            <div className="grid grid-cols-2 gap-1.5">
                <label className="text-[10px] text-slate-500">
                    Malla
                    <select
                        className={field}
                        value={surface.grid ?? 'standard'}
                        onChange={(event) => update({ grid: event.target.value as SiteCalcSurface['grid'] })}
                    >
                        <option value="standard">Automática EN 12464 (DIALux evo)</option>
                        <option value="fine">Fina</option>
                        <option value="custom">Paso propio</option>
                    </select>
                </label>
                {surface.grid === 'custom' ? (
                    <label className="text-[10px] text-slate-500">
                        Paso (m)
                        <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            className={field}
                            value={surface.spacingM ?? 1}
                            onChange={(event) => update({ spacingM: Math.max(0.1, Number(event.target.value) || 1) })}
                        />
                    </label>
                ) : (
                    <span />
                )}
                <label className="col-span-2 text-[10px] text-slate-500">
                    Luminarias del cálculo
                    <select
                        className={field}
                        value={surface.luminaires ?? 'own'}
                        onChange={(event) => update({ luminaires: event.target.value as SiteCalcSurface['luminaires'] })}
                    >
                        <option value="own">Solo las de este espacio (como un local de la V1)</option>
                        <option value="all">Toda la escena (también la luz de espacios vecinos)</option>
                    </select>
                </label>
                <label className="text-[10px] text-slate-500">
                    ρ suelo (%)
                    <input
                        type="number"
                        min={0}
                        max={95}
                        step={1}
                        className={field}
                        value={Math.round(reflectances.floor * 100)}
                        onChange={(event) => update({ floorReflectance: percent(event.target.value) })}
                    />
                </label>
                {covered ? (
                    <label className="text-[10px] text-slate-500">
                        ρ techo (%)
                        <input
                            type="number"
                            min={0}
                            max={95}
                            step={1}
                            className={field}
                            value={Math.round((reflectances.ceiling ?? 0) * 100)}
                            onChange={(event) => update({ ceilingReflectance: percent(event.target.value) })}
                        />
                    </label>
                ) : (
                    <p className="self-end text-[9px] leading-tight text-slate-400">
                        Cielo abierto: sin techo ni paredes que reflejen.
                    </p>
                )}
                <label className="text-[10px] text-slate-500">
                    Altura del plano (m)
                    <input
                        type="number"
                        min={0}
                        step={0.1}
                        className={field}
                        value={surface.heightM ?? 0}
                        onChange={(event) => update({ heightM: Math.max(0, Number(event.target.value) || 0) })}
                    />
                </label>
            </div>
            <p className="text-[10px] text-slate-500">
                {grid.basis} → paso {fmt(grid.spacingM)} m · ≈ {points} puntos
                {grid.capped ? ' (ampliada por rendimiento)' : ''}
            </p>
            <button
                type="button"
                onClick={() => lighting.runArea(element.id)}
                disabled={lighting.running}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
                <Calculator className={`h-3.5 w-3.5 ${lighting.running ? 'animate-spin' : ''}`} />
                {lighting.running ? 'Calculando…' : 'Calcular solo este espacio'}
            </button>
            {result && (
                <p className="rounded bg-white px-2 py-1 text-[10px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    Ēm <strong>{fmt(result.result.avg_lux, 1)} lx</strong> · Emín {fmt(result.result.min_lux, 1)} · Emáx{' '}
                    {fmt(result.result.max_lux, 1)} · U0 {fmt(result.result.uniformity)} · {result.gridPoints} puntos a{' '}
                    {fmt(result.planeHeightM)} m
                </p>
            )}
        </section>
    );
}
