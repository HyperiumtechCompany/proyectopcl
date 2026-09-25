import { Minus, Plus, Target, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    DEFAULT_SPACING_TO_HEIGHT,
    evaluateCanopyGrid,
    evaluatePoleGrid,
    projectAreaLuminaires,
    projectCanopyLights,
    projectionAreaSize,
    projectionGridPositions,
    suggestCanopyGrid,
    suggestProjectionGrid,
    type ProjectionPreviewMetrics,
} from '../domain/siteFixtureProjection';
import { findActivity } from '../domain/siteLightingNorms';
import {
    applyRoofRule,
    canopyRoofGeometry,
    DEFAULT_CANOPY_LIGHTS,
} from '../domain/siteLightPlacement';
import type { CanopyLights, PoleConfig, SiteElement } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import {
    loadSitePhotometry,
    siteLightProductIds,
    useSiteLightingCalculation,
    useSiteLightingStore,
} from '../hooks/useSiteLightingCalculation';
import { defaultConfigFor } from '../lib/siteDefaults';
import { LightProductSelect } from './LightProductSelect';
import { activeRegions, useNormCatalogs } from './SiteNormPanels';

export const input =
    'mt-0.5 h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';

export const fmt = (value: number, digits = 1) =>
    value.toLocaleString('es-PE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

export function NumField({
    label,
    value,
    step = 1,
    min = 0,
    onChange,
}: {
    label: string;
    value: number;
    step?: number;
    min?: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="text-[10px] text-slate-500">
            {label}
            <input
                type="number"
                className={input}
                value={Number.isFinite(value) ? value : ''}
                step={step}
                min={min}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </label>
    );
}

/**
 * Una dirección de la grilla: [−] N [+] y, debajo, cómo queda repartida con la
 * regla ½-1-1-½ (separación entre luminarias y distancia al borde).
 */
function AxisRow({
    title,
    value,
    lengthM,
    onChange,
    note,
}: {
    title: string;
    value: number;
    lengthM: number;
    onChange: (value: number) => void;
    note?: string;
}) {
    const spacing = lengthM / Math.max(1, value);
    const button =
        'flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10';
    return (
        <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 dark:bg-slate-900">
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {title}
                </p>
                <p className="text-[10px] text-slate-500">
                    {fmt(lengthM)} m ÷ {value} = {fmt(spacing)} m entre sí ·{' '}
                    {fmt(spacing / 2)} m al borde
                </p>
                {note && (
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        {note}
                    </p>
                )}
            </div>
            <button
                type="button"
                className={button}
                disabled={value <= 1}
                onClick={() => onChange(Math.max(1, value - 1))}
                title={`Una menos en ${title.toLowerCase()}`}
            >
                <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-base font-bold text-slate-800 dark:text-slate-100">
                {value}
            </span>
            <button
                type="button"
                className={button}
                onClick={() => onChange(value + 1)}
                title={`Una más en ${title.toLowerCase()}`}
            >
                <Plus className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

/**
 * Proyectar luminarias (postes en áreas, luminarias bajo la cubierta en
 * techados) en dos clics: al elegir la superficie aparece al instante la
 * propuesta en HORIZONTAL × VERTICAL — la mayor entre el método de lúmenes de
 * la V1 y la regla de separación máx. k·h —, repartida con la regla ½-1-1-½
 * de la V1 (borde = ½ separación) y, en techos a 2 caídas, sin luminarias en
 * la cumbrera. Las luminarias se ven "fantasma" en el plano; [−]/[+] ajustan
 * con Ēm/U0 en vivo (motor V1); "Colocar" inserta y recalcula todo.
 */
export function SiteProjectionPanel({
    element,
    editor,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
}) {
    const updateSiteElement = useEditorStore((s) => s.updateSiteElement);
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

    const isCanopy = element.type === 'canopy';
    const [targetLux, setTargetLux] = useState<number | null>(null);
    const target = targetLux ?? normLux ?? 20;
    const [pole, setPole] = useState<PoleConfig>(() => ({
        ...(defaultConfigFor('pole') as PoleConfig),
        armLengthM: 0,
    }));
    const [lights, setLights] = useState<CanopyLights>(() => ({
        ...DEFAULT_CANOPY_LIGHTS,
        ...(element.config?.kind === 'canopy'
            ? (element.config.lights ?? {})
            : {}),
        enabled: true,
    }));
    const [spacingToHeight, setSpacingToHeight] = useState(
        DEFAULT_SPACING_TO_HEIGHT,
    );
    // null = seguir la propuesta automática; al tocar [−]/[+] queda manual.
    const [manualGrid, setManualGrid] = useState<{
        rows: number;
        columns: number;
    } | null>(null);
    const [metrics, setMetrics] = useState<ProjectionPreviewMetrics | null>(
        null,
    );
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const site = editor.siteData;
    const scaleM = site?.terrainScaleM || 1;
    const size = site ? projectionAreaSize(site, element.id) : null;
    const suggestion = !site
        ? null
        : isCanopy
          ? suggestCanopyGrid({
                site,
                areaId: element.id,
                targetLux: target,
                lights,
                spacingToHeight,
            })
          : suggestProjectionGrid({
                site,
                areaId: element.id,
                targetLux: target,
                lumensEach: (pole.lumens ?? 3000) * Math.max(1, pole.fixtures),
                maintenanceFactor: pole.maintenanceFactor ?? 0.8,
                mountingHeightM: pole.heightM,
                spacingToHeight,
            });
    const requested = {
        rows: manualGrid?.rows ?? suggestion?.rows ?? 1,
        columns: manualGrid?.columns ?? suggestion?.columns ?? 1,
    };
    // Techo a 2 caídas: la cantidad a lo ancho siempre par (nada en la cumbrera).
    const roofRule = isCanopy
        ? applyRoofRule(element, scaleM, requested.rows, requested.columns)
        : { ...requested, adjusted: false };
    const { rows, columns } = roofRule;
    const count = rows * columns;
    const roof = isCanopy ? canopyRoofGeometry(element, scaleM) : null;
    const ridgeNote =
        roof?.roof === 'gable' ? 'Par: ninguna en la cumbrera (2 caídas)' : undefined;
    const mountingHeightM = isCanopy
        ? Math.max(1, (roof?.eaveM ?? 3) - 0.15)
        : pole.heightM;

    // Luminarias "fantasma" sobre el plano mientras se ajusta.
    useEffect(() => {
        setStore({
            projectionPreview: site
                ? {
                      areaId: element.id,
                      positions: projectionGridPositions(
                          site,
                          element.id,
                          rows,
                          columns,
                      ),
                  }
                : null,
        });
    }, [site, element.id, rows, columns, setStore]);
    useEffect(() => () => setStore({ projectionPreview: null }), [setStore]);

    // Ēm/Emín/U0 en vivo con el motor V1 (solo esta superficie).
    useEffect(() => {
        if (!site) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            const productId = isCanopy ? lights.productId : pole.productId;
            void loadSitePhotometry([
                ...siteLightProductIds(site),
                ...(productId !== undefined ? [productId] : []),
            ]).then((photometry) => {
                if (cancelled) return;
                setMetrics(
                    isCanopy
                        ? evaluateCanopyGrid({
                              site,
                              areaId: element.id,
                              rows,
                              columns,
                              lights,
                              photometry,
                          })
                        : (evaluatePoleGrid({
                              site,
                              areaId: element.id,
                              rows,
                              columns,
                              pole,
                              photometry,
                          })?.metrics ?? null),
                );
            });
        }, 200);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [site, element.id, rows, columns, pole, lights, isCanopy]);

    /** Itera con el motor V1 hasta el Ēm objetivo con la menor cantidad. */
    const fitToTarget = () => {
        if (!site) return;
        setBusy(true);
        const productId = isCanopy ? lights.productId : pole.productId;
        void loadSitePhotometry([
            ...siteLightProductIds(site),
            ...(productId !== undefined ? [productId] : []),
        ])
            .then((photometry) => {
                const result = isCanopy
                    ? projectCanopyLights({
                          site,
                          areaId: element.id,
                          targetLux: target,
                          lights,
                          photometry,
                      })
                    : projectAreaLuminaires({
                          site,
                          areaId: element.id,
                          targetLux: target,
                          pole,
                          photometry,
                      });
                if (result) {
                    setManualGrid({ rows: result.rows, columns: result.columns });
                }
            })
            .finally(() => setBusy(false));
    };

    const place = () => {
        if (!site) return;
        if (isCanopy && element.config?.kind === 'canopy') {
            updateSiteElement(element.id, {
                config: {
                    ...element.config,
                    lights: {
                        ...lights,
                        enabled: true,
                        rows,
                        columns,
                        count,
                    },
                },
            });
        } else {
            editor.placeProjectedLuminaires(
                element.id,
                projectionGridPositions(site, element.id, rows, columns),
                pole,
            );
        }
        setMessage(
            `Colocadas ${columns} × ${rows} = ${count} luminarias; recalculando…`,
        );
        window.setTimeout(() => lighting.run(), 60);
    };

    const reached = metrics ? metrics.avgLux >= target : false;
    const ridgeAlongX = roof?.ridgeAlongX ?? true;

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
                    onClick={() => setManualGrid(null)}
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

            {/* Resumen: horizontal × vertical */}
            <div className="rounded-md bg-slate-900 px-2 py-1.5 text-center text-white dark:bg-white dark:text-slate-900">
                <span className="text-lg font-bold">
                    {columns} × {rows} = {count}
                </span>
                <span className="block text-[10px] opacity-80">
                    horizontal × vertical · {isCanopy ? 'luminarias' : 'postes'} de{' '}
                    {fmt(mountingHeightM)} m
                </span>
            </div>

            {size && (
                <>
                    <AxisRow
                        title="Horizontal (columnas)"
                        value={columns}
                        lengthM={size.widthM}
                        onChange={(value) => setManualGrid({ rows, columns: value })}
                        note={!ridgeAlongX ? ridgeNote : undefined}
                    />
                    <AxisRow
                        title="Vertical (filas)"
                        value={rows}
                        lengthM={size.lengthM}
                        onChange={(value) => setManualGrid({ rows: value, columns })}
                        note={ridgeAlongX ? ridgeNote : undefined}
                    />
                </>
            )}

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
                        Ēm {fmt(metrics.avgLux)} lx {reached ? '≥' : '<'}{' '}
                        {target} · Emín {fmt(metrics.minLux)} · U0{' '}
                        {fmt(metrics.uniformity, 2)}
                    </p>
                )}
            </div>

            {suggestion && !manualGrid && (
                <p className="text-[9px] leading-snug text-slate-400">
                    Propuesta: método de lúmenes V1 = {suggestion.byLumens.count}{' '}
                    luminarias ({suggestion.byLumens.columns} ×{' '}
                    {suggestion.byLumens.rows}); separación máx. {spacingToHeight} ×{' '}
                    {fmt(mountingHeightM)} m = {fmt(suggestion.bySpacing.maxSpacingM)}{' '}
                    m → al menos {suggestion.bySpacing.columns} ×{' '}
                    {suggestion.bySpacing.rows}. Se toma la mayor.
                </p>
            )}

            <div className="grid grid-cols-2 gap-1.5">
                <button
                    type="button"
                    onClick={fitToTarget}
                    disabled={busy}
                    className="flex items-center justify-center gap-1 rounded-md border border-amber-400 bg-white px-2 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:bg-slate-900 dark:text-amber-300"
                    title="Itera con el motor V1 hasta el Ēm objetivo con la menor cantidad"
                >
                    <Target className="h-3.5 w-3.5" />
                    {busy ? 'Ajustando…' : 'Ajustar al objetivo'}
                </button>
                <button
                    type="button"
                    onClick={place}
                    className="rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                    Colocar {count}
                </button>
            </div>
            {message && (
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                    {message}
                </p>
            )}

            <details className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-slate-900">
                <summary className="cursor-pointer text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Luminaria y regla de colocación
                </summary>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 pb-1">
                    {!isCanopy && (
                        <NumField
                            label="Altura montaje (m)"
                            value={pole.heightM}
                            step={0.5}
                            min={2}
                            onChange={(heightM) =>
                                setPole({ ...pole, heightM: Math.max(2, heightM) })
                            }
                        />
                    )}
                    <NumField
                        label="Separación máx. (× altura)"
                        value={spacingToHeight}
                        step={0.5}
                        min={1}
                        onChange={(value) => setSpacingToHeight(Math.max(1, value))}
                    />
                    <NumField
                        label="Flujo c/u (lm)"
                        value={isCanopy ? lights.lumens : (pole.lumens ?? 3000)}
                        step={100}
                        min={50}
                        onChange={(lumens) =>
                            isCanopy
                                ? setLights({ ...lights, lumens: Math.max(50, lumens) })
                                : setPole({ ...pole, lumens: Math.max(50, lumens) })
                        }
                    />
                    <NumField
                        label="Potencia c/u (W)"
                        value={isCanopy ? lights.wattage : (pole.wattage ?? 60)}
                        min={1}
                        onChange={(wattage) =>
                            isCanopy
                                ? setLights({ ...lights, wattage: Math.max(1, wattage) })
                                : setPole({ ...pole, wattage: Math.max(1, wattage) })
                        }
                    />
                    {!isCanopy && (
                        <>
                            <NumField
                                label="Mantenimiento (Fm)"
                                value={pole.maintenanceFactor ?? 0.8}
                                step={0.05}
                                min={0.1}
                                onChange={(value) =>
                                    setPole({
                                        ...pole,
                                        maintenanceFactor: Math.min(1, Math.max(0.1, value)),
                                    })
                                }
                            />
                            <NumField
                                label="Brazo (m)"
                                value={pole.armLengthM}
                                step={0.5}
                                onChange={(armLengthM) =>
                                    setPole({ ...pole, armLengthM: Math.max(0, armLengthM) })
                                }
                            />
                        </>
                    )}
                    <LightProductSelect
                        productId={isCanopy ? lights.productId : pole.productId}
                        onChange={(patch) =>
                            isCanopy
                                ? setLights({ ...lights, ...patch })
                                : setPole({
                                      ...pole,
                                      productId: patch.productId,
                                      ...(patch.lumens ? { lumens: patch.lumens } : {}),
                                      ...(patch.wattage ? { wattage: patch.wattage } : {}),
                                  })
                        }
                    />
                </div>
                <p className="pb-1 text-[9px] leading-snug text-slate-400">
                    Reparto ½-1-1-½ (grilla de la V1): entre luminarias la
                    separación completa, al borde la mitad. Separación máxima =
                    k × altura (k = {DEFAULT_SPACING_TO_HEIGHT} de referencia,
                    no normativo). En techados la altura sigue la pendiente de
                    la cubierta; en 2 caídas la cantidad a lo ancho es par.
                </p>
            </details>
        </section>
    );
}
