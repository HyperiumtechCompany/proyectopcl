import { Calculator, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import {
    checkAgainstNorm,
    SITE_NORM_REGIONS,
} from '../domain/siteLightingNorms';
import type { SiteData } from '../domain/types';
import type { SiteLightingCalculationState } from '../hooks/useSiteLightingCalculation';
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
    const regions = activeRegions(site);
    useNormCatalogs(regions);
    const calc = lighting.calculation;
    const byId = new Map((site?.elements ?? []).map((el) => [el.id, el]));

    return (
        <div className="absolute bottom-3 left-3 z-10 w-[min(38rem,calc(100%-1.5rem))] rounded-lg border border-slate-200 bg-white/95 text-[11px] text-slate-700 shadow-lg dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-200">
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
                    {calc.warnings.map((warning) => (
                        <p
                            key={warning}
                            className="mb-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                        >
                            {warning}
                        </p>
                    ))}
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
                                    <th className="px-1 py-1">Norma elegida</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calc.areas.map((area) => {
                                    const element = byId.get(area.elementId);
                                    const focused =
                                        lighting.focusedAreaId === area.elementId;
                                    const checks = regions
                                        .filter(
                                            (region) =>
                                                element?.normReq?.activities[region],
                                        )
                                        .map((region) =>
                                            checkAgainstNorm(
                                                region,
                                                element?.normReq?.activities[region],
                                                area.summary,
                                            ),
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
                                                    {fmt(area.spacingM, 2)} m · ρ{' '}
                                                    {area.groundReflectance}
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
                                            <td className="px-1 py-1 text-[10px]">
                                                {checks.length === 0 ? (
                                                    <span className="text-slate-400">
                                                        Sin actividad elegida
                                                    </span>
                                                ) : (
                                                    checks.map((check) => (
                                                        <span
                                                            key={check.region}
                                                            className="block"
                                                        >
                                                            {
                                                                SITE_NORM_REGIONS.find(
                                                                    (region) =>
                                                                        region.id ===
                                                                        check.region,
                                                                )?.label
                                                            }
                                                            :{' '}
                                                            {check.activity?.illuminanceLux ??
                                                                '—'}{' '}
                                                            lx →{' '}
                                                            <span
                                                                className={
                                                                    check.emVerdict ===
                                                                    'meets'
                                                                        ? 'font-semibold text-emerald-700 dark:text-emerald-300'
                                                                        : check.emVerdict ===
                                                                            'below'
                                                                          ? 'font-semibold text-red-600 dark:text-red-400'
                                                                          : 'text-slate-400'
                                                                }
                                                            >
                                                                {check.emVerdict ===
                                                                'meets'
                                                                    ? '≥ norma'
                                                                    : check.emVerdict ===
                                                                        'below'
                                                                      ? '< norma'
                                                                      : 'sin datos'}
                                                            </span>
                                                        </span>
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
                        declaración de cumplimiento.
                    </p>
                </div>
            )}
        </div>
    );
}
