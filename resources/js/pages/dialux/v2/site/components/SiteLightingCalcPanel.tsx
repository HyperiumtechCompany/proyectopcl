import { Calculator, ChevronDown, ChevronUp, Eye, EyeOff, Waves } from 'lucide-react';
import { useState } from 'react';
import {
    effectiveNormChecks,
    SITE_NORM_REGIONS,
    type EffectiveNormCheck,
} from '../domain/siteLightingNorms';
import { siteQuantityCheck } from '../domain/siteQuantityCheck';
import type { SiteData } from '../domain/types';
import {
    useSiteLightingStore,
    type SiteLightingCalculationState,
} from '../hooks/useSiteLightingCalculation';
import { activeRegions, useNormCatalogs } from './SiteNormPanels';

const TYPE_LABEL: Record<string, string> = {
    court: 'Cancha',
    parking: 'Estacionamiento',
    street: 'Calle',
    sidewalk: 'Vereda',
    green_area: 'Área verde',
    terrace_platform: 'Plataforma',
    custom_zone: 'Zona',
    canopy: 'Techado',
    terrain: 'Terreno',
    ramp: 'Rampa (cota media)',
    stair: 'Escalera (cota media)',
};

const VERDICT_CLASS = {
    meets: 'font-semibold text-emerald-700 dark:text-emerald-300',
    below: 'font-semibold text-red-600 dark:text-red-400',
    'no-data': 'text-slate-400',
} as const;

const VERDICT_TEXT = { meets: '≥', below: '<', 'no-data': '?' } as const;

/**
 * Una fila de comparación (como la tabla de verificación de la V1):
 * requerido vs. calculado para Ē (y Emín en clases P) y U0, con la norma y
 * si la actividad fue elegida o es la SUGERIDA del catálogo exterior.
 */
function NormComparison({ check }: { check: EffectiveNormCheck }) {
    const activity = check.activity;
    const region = SITE_NORM_REGIONS.find((item) => item.id === check.region)?.label;
    return (
        <span className="block leading-snug">
            <span className="text-slate-500">
                {region}
                {check.suggested && (
                    <span className="ml-1 rounded bg-sky-100 px-1 text-[9px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                        sugerida
                    </span>
                )}{' '}
                {activity?.title ?? ''}
            </span>
            <span className="block">
                Ē {activity?.illuminanceLux ?? '—'} lx
                {activity?.minLux ? ` · Emín ${activity.minLux} lx` : ''}{' '}
                <span className={VERDICT_CLASS[check.emVerdict]}>
                    {check.emVerdict === 'no-data'
                        ? 'sin datos'
                        : `${VERDICT_TEXT[check.emVerdict]} norma`}
                </span>
                {activity?.uniformity ? (
                    <>
                        {' · '}U0 {activity.uniformity}{' '}
                        <span className={VERDICT_CLASS[check.uoVerdict]}>
                            {VERDICT_TEXT[check.uoVerdict]}
                        </span>
                    </>
                ) : null}
            </span>
        </span>
    );
}

const COVERAGE = {
    optimal: { label: 'Óptimo', className: 'text-emerald-700 dark:text-emerald-300' },
    insufficient: { label: 'Insuficiente', className: 'text-red-600 dark:text-red-400' },
    excessive: { label: 'Excesivo', className: 'text-amber-700 dark:text-amber-300' },
} as const;

const fmt = (value: number, digits = 1) =>
    Number.isFinite(value)
        ? value.toLocaleString('es-PE', {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits,
          })
        : '—';

/**
 * Botón "Calcular alumbrado" + resultados por superficie de cálculo, como el
 * "Calcular" de los recintos en la V1 pero para exteriores (DIALux evo:
 * superficies de cálculo exteriores). El cálculo lo hace el motor
 * luminotécnico de la V1 (`siteLightingCalculation.ts`). La comparación con la
 * norma elegida por el cliente es numérica ("≥ norma / < norma"), nunca una
 * declaración de cumplimiento (catálogos exteriores sin confirmar).
 */
export function SiteLightingCalcPanel({
    site,
    lighting,
}: {
    site: SiteData | undefined;
    lighting: SiteLightingCalculationState;
}) {
    const [open, setOpen] = useState(true);
    const showIsolines = useSiteLightingStore((state) => state.showIsolines);
    const setStore = useSiteLightingStore((state) => state.set);
    const regions = activeRegions(site);
    useNormCatalogs(regions);
    const calc = lighting.calculation;
    const byId = new Map((site?.elements ?? []).map((el) => [el.id, el]));

    return (
        <div className="absolute bottom-3 left-3 z-10 w-[min(46rem,calc(100%-1.5rem))] rounded-lg border border-slate-200 bg-white/95 text-[11px] text-slate-700 shadow-lg dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
                <button
                    type="button"
                    onClick={lighting.run}
                    disabled={lighting.running || !site}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                    <Calculator
                        className={`h-3.5 w-3.5 ${lighting.running ? 'animate-spin' : ''}`}
                    />
                    {lighting.running ? 'Calculando…' : 'Calcular alumbrado'}
                </button>
                {calc && (
                    <button
                        type="button"
                        onClick={() => lighting.setShowIsolux(!lighting.showIsolux)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10"
                        title="Mostrar la iluminancia en falsos colores sobre la planta"
                    >
                        {lighting.showIsolux ? (
                            <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                            <Eye className="h-3.5 w-3.5" />
                        )}
                        Falsos colores
                    </button>
                )}
                {calc && lighting.showIsolux && (
                    <button
                        type="button"
                        onClick={() => setStore({ showIsolines: !showIsolines })}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-semibold ${
                            showIsolines
                                ? 'border-slate-700 bg-slate-800 text-white dark:border-white/30 dark:bg-white/15'
                                : 'border-slate-300 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10'
                        }`}
                        title="Curvas isolux: líneas de igual iluminancia con su valor en lx"
                    >
                        <Waves className="h-3.5 w-3.5" />
                        Curvas isolux
                    </button>
                )}
                {lighting.stale && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        Desactualizado — la planta cambió, recalcula
                    </span>
                )}
                <span className="ml-auto text-[10px] text-slate-400">
                    Motor luminotécnico V1
                </span>
                {calc && (
                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        className="rounded p-0.5 hover:bg-slate-100 dark:hover:bg-white/10"
                        title={open ? 'Contraer' : 'Expandir'}
                    >
                        {open ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronUp className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>
            {calc && open && (
                <div className="max-h-72 overflow-auto p-2">
                    {/* Espacios con el mismo nombre repiten el aviso: se agrupan con su cantidad. */}
                    {[...calc.warnings.reduce((counts, warning) => counts.set(warning, (counts.get(warning) ?? 0) + 1), new Map<string, number>())].map(
                        ([warning, times]) => (
                            <p
                                key={warning}
                                className="mb-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                            >
                                {warning}
                                {times > 1 ? ` (×${times})` : ''}
                            </p>
                        ),
                    )}
                    {calc.areas.length === 0 ? (
                        <p className="px-1 py-2 text-slate-500">
                            No hay superficies de cálculo: dibuja canchas,
                            estacionamientos, calles, veredas, jardines,
                            plataformas o zonas.
                        </p>
                    ) : (
                        <table className="w-full border-collapse text-left">
                            <thead className="text-[9px] tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th className="px-1 py-1">Superficie</th>
                                    <th className="px-1 py-1 text-right">Ēm lx</th>
                                    <th className="px-1 py-1 text-right">Emín</th>
                                    <th className="px-1 py-1 text-right">Emáx</th>
                                    <th className="px-1 py-1 text-right">U0</th>
                                    <th className="px-1 py-1 text-right" title="Luminancia media L = Ēm·ρ/π con la reflectancia estimada del suelo">
                                        L cd/m²
                                    </th>
                                    <th
                                        className="px-1 py-1 text-right"
                                        title="Luminarias propias / cantidad exacta por método de lúmenes (tabla de Resultados de la V1)"
                                    >
                                        Lum.
                                    </th>
                                    <th className="px-1 py-1">Cobertura</th>
                                    <th className="px-1 py-1">
                                        Comparación con la norma (requerido → calculado)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {calc.areas.map((area) => {
                                    const element = byId.get(area.elementId);
                                    const focused =
                                        lighting.focusedAreaId === area.elementId;
                                    // Elegida por el cliente o, si no, la sugerida del
                                    // catálogo exterior: la comparación nunca queda vacía.
                                    const checks = effectiveNormChecks(
                                        element,
                                        regions,
                                        area.summary,
                                    );
                                    const quantity = siteQuantityCheck(
                                        area,
                                        checks.find(
                                            (check) => check.activity?.illuminanceLux,
                                        )?.activity?.illuminanceLux,
                                    );
                                    return (
                                        <tr
                                            key={area.elementId}
                                            onClick={() =>
                                                lighting.setFocusedAreaId(
                                                    focused ? null : area.elementId,
                                                )
                                            }
                                            className={`cursor-pointer border-t border-slate-100 dark:border-white/5 ${
                                                focused
                                                    ? 'bg-amber-50 dark:bg-amber-500/10'
                                                    : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                            }`}
                                            title="Clic: ver solo esta superficie en falsos colores"
                                        >
                                            <td className="px-1 py-1">
                                                <span className="font-semibold">
                                                    {area.label}
                                                </span>
                                                <span className="block text-[9px] text-slate-400">
                                                    {TYPE_LABEL[area.type] ?? area.type} ·{' '}
                                                    {fmt(area.areaM2, 0)} m² ·{' '}
                                                    {area.luminairesUsed} lum. · malla{' '}
                                                    {fmt(area.spacingM, 2)} m (
                                                    {area.gridMode === 'standard'
                                                        ? 'EN 12464'
                                                        : area.gridMode === 'fine'
                                                          ? 'fina'
                                                          : 'propia'}
                                                    , {area.gridPoints} pts, h {fmt(area.planeHeightM, 2)} m) · ρ{' '}
                                                    {area.groundReflectance}
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            lighting.runArea(area.elementId);
                                                        }}
                                                        disabled={lighting.running}
                                                        className="ml-1 rounded border border-amber-400 px-1 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-300"
                                                        title="Recalcular solo este espacio"
                                                    >
                                                        ↻
                                                    </button>
                                                </span>
                                            </td>
                                            <td className="px-1 py-1 text-right font-semibold">
                                                {fmt(area.result.avg_lux)}
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                {fmt(area.result.min_lux)}
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                {fmt(area.result.max_lux)}
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                {fmt(area.result.uniformity, 2)}
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                {fmt(area.avgLuminanceCdM2, 2)}
                                            </td>
                                            <td
                                                className="px-1 py-1 text-right tabular-nums"
                                                title={
                                                    quantity
                                                        ? `Lm req. ${fmt(quantity.lumensRequired, 0)} ÷ ${fmt(quantity.lumensEach, 0)} lm c/u (mantenido)`
                                                        : 'Elige la actividad normativa del espacio para verificar la cantidad'
                                                }
                                            >
                                                {area.ownLuminaires}
                                                {quantity && Number.isFinite(quantity.exactQuantity)
                                                    ? ` / ${fmt(quantity.exactQuantity, 1)}`
                                                    : ''}
                                            </td>
                                            <td className="px-1 py-1 text-[10px] font-semibold">
                                                {quantity ? (
                                                    <span className={COVERAGE[quantity.coverage].className}>
                                                        {COVERAGE[quantity.coverage].label}
                                                    </span>
                                                ) : (
                                                    <span className="font-normal text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-1 py-1 text-[10px]">
                                                {checks.length === 0 ? (
                                                    <span className="text-slate-400">
                                                        Sin actividad aplicable (canchas: EN 12193 no cargada)
                                                    </span>
                                                ) : (
                                                    checks.map((check) => (
                                                        <NormComparison
                                                            key={check.region}
                                                            check={check}
                                                        />
                                                    ))
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    <p className="mt-1 px-1 text-[9px] text-slate-400">
                        Superficies a nivel del suelo, luz directa con la
                        fotometría IES/LDT de cada luminaria y sombra de los
                        edificios y de las cubiertas opacas (cubierta
                        aproximada por su rectángulo a la altura de la
                        cumbrera; cielo abierto: sin reflexiones). ρ del suelo
                        = estimación no normativa, solo para la luminancia. La
                        comparación con la norma es numérica, no una
                        declaración de cumplimiento; sin actividad elegida se
                        compara con la SUGERIDA del catálogo exterior
                        (EN 12464-2 / EN 13201-2, valores por confirmar). Varias cotas: la
                        superficie se calcula por parches, cada uno a su cota;
                        una plataforma o espacio dentro de otro se calcula
                        solo en el suyo. "Lum." y "Cobertura": método de
                        lúmenes de la V1 (propias / exactas; &lt; 90 %
                        insuficiente, &gt; 150 % excesivo), estimación previa al
                        punto a punto.
                    </p>
                </div>
            )}
        </div>
    );
}
