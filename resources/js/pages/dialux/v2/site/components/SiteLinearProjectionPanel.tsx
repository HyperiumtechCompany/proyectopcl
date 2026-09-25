import { Minus, Plus, Target, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { findActivity } from '../domain/siteLightingNorms';
import type {
    LinearArrangement,
    LinearPreviewMetrics,
} from '../domain/siteLinearProjection';
import {
    DEFAULT_LINEAR_SPACING_TO_HEIGHT,
    MIN_AXIS_FILL,
    evaluateLinearPoles,
    linearPolePositions,
    suggestLinearPoles,
} from '../domain/siteLinearProjection';
import type { PoleConfig, SiteElement } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import {
    loadSitePhotometry,
    siteLightProductIds,
    useSiteLightingCalculation,
    useSiteLightingStore,
} from '../hooks/useSiteLightingCalculation';
import { defaultConfigFor } from '../lib/siteDefaults';
import { LinearPoleSettings } from './LinearPoleSettings';
import { activeRegions, useNormCatalogs } from './SiteNormPanels';
import { fmt, NumField } from './SiteProjectionPanel';

const ARRANGEMENT_LABEL: Record<LinearArrangement, string> = {
    single: 'Unilateral',
    staggered: 'Tresbolillo',
    opposite: 'Pareada',
};

const TYPE_LABEL: Record<string, string> = {
    street: 'Calle / pasaje',
    sidewalk: 'Vereda / pasadizo',
    ramp: 'Rampa',
    stair: 'Escalera',
};

const PEDESTRIAN = new Set(['sidewalk', 'ramp', 'stair']);

/**
 * Proyección de POSTES a lo largo de calles, pasadizos, rampas y escaleras
 * (`siteLinearProjection.ts`): la propuesta sale sola al elegir el espacio —
 * disposición por W/h, cantidad = la mayor entre separación k·h y método de
 * lúmenes V1 —, se ve "fantasma" en el plano, [−]/[+] ajusta con Ēm/U0 en vivo
 * (motor V1) y "Colocar" inserta los postes con el brazo hacia la vía.
 */
export function SiteLinearProjectionPanel({
    element,
    editor,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
}) {
    const setStore = useSiteLightingStore((s) => s.set);
    const lighting = useSiteLightingCalculation(editor.siteData);
    const regions = activeRegions(editor.siteData);
    useNormCatalogs(regions);
    const normLux = regions
        .map(
            (region) =>
                findActivity(region, element.normReq?.activities[region])
                    ?.illuminanceLux,
        )
        .find((lux): lux is number => typeof lux === 'number' && lux > 0);
    const pedestrian = PEDESTRIAN.has(element.type);

    const [targetLux, setTargetLux] = useState<number | null>(null);
    const target = targetLux ?? normLux ?? (pedestrian ? 10 : 15);
    const [pole, setPole] = useState<PoleConfig>(() => ({
        ...(defaultConfigFor('pole') as PoleConfig),
        heightM: pedestrian ? 4 : 8,
        armLengthM: pedestrian ? 0 : 1.5,
    }));
    const [spacingToHeight, setSpacingToHeight] = useState(
        DEFAULT_LINEAR_SPACING_TO_HEIGHT,
    );
    const [arrangement, setArrangement] = useState<LinearArrangement | 'auto'>('auto');
    const [side, setSide] = useState<0 | 1>(0);
    const [placement, setPlacement] = useState<'outside' | 'inside'>('outside');
    const [manualCount, setManualCount] = useState<number | null>(null);
    const [metrics, setMetrics] = useState<LinearPreviewMetrics | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const site = editor.siteData;
    const scaleM = site?.terrainScaleM || 1;
    const suggestion = site
        ? suggestLinearPoles({
              site,
              areaId: element.id,
              targetLux: target,
              lumensEach: (pole.lumens ?? 3000) * Math.max(1, pole.fixtures),
              maintenanceFactor: pole.maintenanceFactor ?? 0.8,
              mountingHeightM: pole.heightM,
              spacingToHeight,
              arrangement: arrangement === 'auto' ? undefined : arrangement,
          })
        : null;
    const chosenArrangement = suggestion?.arrangement ?? 'single';
    const step = chosenArrangement === 'opposite' ? 2 : 1;
    const count = manualCount ?? suggestion?.count ?? 1;
    const layout = suggestion
        ? linearPolePositions({
              axis: suggestion.axis,
              arrangement: chosenArrangement,
              count,
              scaleM,
              side,
              placement,
          })
        : null;
    const configs = (layout?.armDirectionsDeg ?? []).map((deg) => ({
        ...pole,
        armDirectionDeg: deg,
    }));

    useEffect(() => {
        setStore({
            projectionPreview: layout
                ? { areaId: element.id, positions: layout.positions }
                : null,
        });
        // `layout` se recalcula en cada render; basta con sus entradas.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [site, element.id, count, chosenArrangement, side, placement, pole.heightM, spacingToHeight, setStore]);
    useEffect(() => () => setStore({ projectionPreview: null }), [setStore]);

    useEffect(() => {
        if (!site || !layout) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            void loadSitePhotometry([
                ...siteLightProductIds(site),
                ...(pole.productId !== undefined ? [pole.productId] : []),
            ]).then((photometry) => {
                if (cancelled) return;
                setMetrics(
                    evaluateLinearPoles({ site, areaId: element.id, layout, pole, photometry }),
                );
            });
        }, 200);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [site, element.id, count, chosenArrangement, side, placement, pole, spacingToHeight]);

    /** Menor cantidad (desde la regla de separación) que alcanza el Ēm objetivo. */
    const fitToTarget = () => {
        if (!site || !suggestion) return;
        setBusy(true);
        void loadSitePhotometry([
            ...siteLightProductIds(site),
            ...(pole.productId !== undefined ? [pole.productId] : []),
        ])
            .then((photometry) => {
                for (let n = suggestion.bySpacing; n <= 200; n += step) {
                    const trial = linearPolePositions({
                        axis: suggestion.axis,
                        arrangement: chosenArrangement,
                        count: n,
                        scaleM,
                        side,
                        placement,
                    });
                    const result = evaluateLinearPoles({ site, areaId: element.id, layout: trial, pole, photometry });
                    if (result && result.avgLux >= target) {
                        setManualCount(n);
                        return;
                    }
                }
                setMessage(
                    'Ni con 200 postes se alcanza el objetivo. Revisa los avisos del cálculo (postes bajo la superficie, sin fotometría) antes de subir el flujo o la altura.',
                );
            })
            .finally(() => setBusy(false));
    };

    const place = () => {
        if (!layout) return;
        editor.placeProjectedLuminaires(element.id, layout.positions, pole, configs);
        setMessage(`Colocados ${layout.positions.length} postes; recalculando…`);
        window.setTimeout(() => lighting.run(), 60);
    };

    const reached = metrics ? metrics.avgLux >= target : false;
    const button =
        'flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10';

    if (!suggestion || !layout) {
        return (
            <p className="text-[10px] text-slate-400">
                No se pudo leer el eje de este espacio (dibújalo con al menos 3 vértices).
            </p>
        );
    }
    return (
        <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-500/20 dark:bg-amber-500/5">
            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <NumField
                        label={`Ēm objetivo (lx)${normLux && targetLux === null ? ' · norma' : ''}`}
                        value={target}
                        min={1}
                        onChange={(value) => setTargetLux(Math.max(1, value))}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setManualCount(null);
                        setArrangement('auto');
                    }}
                    title="Volver a la propuesta automática"
                    className="flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300"
                >
                    <Wand2 className="h-3 w-3" />
                    Auto
                </button>
            </div>
            {normLux && targetLux === null && (
                <p className="text-[9px] leading-snug text-amber-700 dark:text-amber-300">
                    Ēm tomado de la actividad elegida en un catálogo de
                    iluminación de interiores / lugares de trabajo (EN 12464-1,
                    IES, RNE EM.010). El sistema aún no tiene un catálogo de
                    alumbrado vial/exterior (EN 13201, EN 12464-2): verifica su
                    aplicabilidad a este espacio.
                </p>
            )}

            <div className="rounded-md bg-slate-900 px-2 py-1.5 text-center text-white dark:bg-white dark:text-slate-900">
                <span className="text-lg font-bold">{layout.positions.length} postes</span>
                <span className="block text-[10px] opacity-80">
                    {TYPE_LABEL[element.type] ?? element.label} ·{' '}
                    {ARRANGEMENT_LABEL[chosenArrangement]} · cada {fmt(layout.spacingM)} m ·{' '}
                    {fmt(pole.heightM)} m de altura
                </span>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 dark:bg-slate-900">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        A lo largo ({fmt(suggestion.axis.lengthM)} m × {fmt(suggestion.axis.widthM)} m)
                    </p>
                    <p className="text-[10px] text-slate-500">
                        {fmt(layout.spacingM)} m entre postes · {fmt(layout.spacingM / 2)} m a
                        cada extremo
                    </p>
                </div>
                <button
                    type="button"
                    className={button}
                    disabled={count <= step}
                    onClick={() => setManualCount(Math.max(step, count - step))}
                    title="Un poste menos"
                >
                    <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-base font-bold">{count}</span>
                <button
                    type="button"
                    className={button}
                    onClick={() => setManualCount(count + step)}
                    title="Un poste más"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-1">
                {(['single', 'staggered', 'opposite'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => {
                                setArrangement(option);
                                setManualCount(null);
                            }}
                            className={`rounded-md border px-1 py-1 text-[10px] font-semibold ${
                                chosenArrangement === option
                                    ? 'border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                                    : 'border-slate-300 bg-white text-slate-600 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300'
                            }`}
                        >
                            {ARRANGEMENT_LABEL[option]}
                        </button>
                    ))}
            </div>

            <div
                className={`rounded-md px-2 py-1.5 text-[10px] ${
                    metrics === null
                        ? 'bg-slate-100 text-slate-500 dark:bg-white/5'
                        : reached
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
            >
                {metrics === null ? (
                    'Calculando con el motor V1…'
                ) : (
                    <p className="font-semibold">
                        Ēm {fmt(metrics.avgLux)} lx {reached ? '≥' : '<'} {target} · Emín{' '}
                        {fmt(metrics.minLux)} · U0 {fmt(metrics.uniformity, 2)}
                    </p>
                )}
                {metrics?.warnings.map((warning) => (
                    <p key={warning} className="mt-0.5 opacity-80">
                        {warning}
                    </p>
                ))}
            </div>

            {suggestion.axisFill < MIN_AXIS_FILL && (
                <p className="rounded-md bg-amber-100 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Este espacio no es recto (en L, en U o curvo: ocupa el{' '}
                    {fmt(suggestion.axisFill * 100, 0)} % de su rectángulo): el eje
                    recto es aproximado y algunos postes pueden quedar lejos del
                    recorrido. Dibuja cada tramo por separado y proyecta cada uno.
                </p>
            )}
            {manualCount === null && (
                <p className="text-[9px] leading-snug text-slate-400">
                    Propuesta: W/h = {fmt(suggestion.ruleWidthM)} / {fmt(pole.heightM)} ={' '}
                    {fmt(suggestion.widthToHeight, 2)} →{' '}
                    {ARRANGEMENT_LABEL[suggestion.arrangement].toLowerCase()}; separación
                    máx. {spacingToHeight} × {fmt(pole.heightM)} m ={' '}
                    {fmt(suggestion.maxSpacingM)} m → {suggestion.bySpacing} postes;
                    método de lúmenes V1 → {suggestion.byLumens}. Se toma la mayor.
                </p>
            )}

            <div className="grid grid-cols-2 gap-1.5">
                <button
                    type="button"
                    onClick={fitToTarget}
                    disabled={busy}
                    className="flex items-center justify-center gap-1 rounded-md border border-amber-400 bg-white px-2 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:bg-slate-900 dark:text-amber-300"
                    title="Menor cantidad que alcanza el Ēm objetivo (motor V1)"
                >
                    <Target className="h-3.5 w-3.5" />
                    {busy ? 'Ajustando…' : 'Ajustar al objetivo'}
                </button>
                <button
                    type="button"
                    onClick={place}
                    className="rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                    Colocar {layout.positions.length}
                </button>
            </div>
            {message && (
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300">{message}</p>
            )}

            <LinearPoleSettings
                pole={pole}
                setPole={setPole}
                spacingToHeight={spacingToHeight}
                setSpacingToHeight={setSpacingToHeight}
                placement={placement}
                setPlacement={setPlacement}
                side={side}
                setSide={setSide}
                chosenArrangement={chosenArrangement}
            />
        </section>
    );
}
