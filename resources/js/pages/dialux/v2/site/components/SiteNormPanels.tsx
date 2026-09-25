import { useReducer, useEffect } from 'react';
import { ensureStandardDataLoaded } from '@/pages/dialux/hooks/normativeRemoteData';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { LightingSummary } from '../domain/exteriorLighting';
import {
    ALL_SITE_NORM_REGIONS,
    checkAgainstNorm,
    findActivity,
    listActivities,
    regionSource,
    regionStandard,
    SITE_NORM_REGIONS,
    suggestActivity,
    type SiteNormVerdict,
} from '../domain/siteLightingNorms';
import type {
    SiteData,
    SiteElement,
    SiteElementType,
    SiteNormRegion,
} from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';

/** Tipos de espacio a los que el cliente puede asignar una exigencia de iluminancia. */
export const NORM_AREA_TYPES = new Set<SiteElementType>([
    'parking',
    'street',
    'sidewalk',
    'court',
    'canopy',
    'terrace_platform',
    'green_area',
    'custom_zone',
]);

const selectClass =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

export function activeRegions(site: SiteData | undefined): SiteNormRegion[] {
    return site?.normRegions && site.normRegions.length > 0
        ? site.normRegions
        : ALL_SITE_NORM_REGIONS;
}

/** Carga los catálogos servidos desde BD (los mismos overrides que usa v1) y re-renderiza al llegar. */
export function useNormCatalogs(regions: SiteNormRegion[]) {
    const [, bump] = useReducer((n: number) => n + 1, 0);
    const key = regions.join(',');
    useEffect(() => {
        let alive = true;
        for (const region of key.split(',') as SiteNormRegion[]) {
            void ensureStandardDataLoaded(regionStandard(region)).then(() => {
                if (alive) bump();
            });
        }
        return () => {
            alive = false;
        };
    }, [key]);
}

/** Bloque "Normativa" de un espacio: el cliente elige regiones del proyecto y la actividad de cada una. */
export function SiteNormRequirementFields({
    element,
    editor,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
}) {
    const setRegions = useEditorStore((s) => s.setSiteNormRegions);
    const updateSiteElement = useEditorStore((s) => s.updateSiteElement);
    const regions = activeRegions(editor.siteData);
    useNormCatalogs(regions);
    const activities = element.normReq?.activities ?? {};

    const toggleRegion = (id: SiteNormRegion) => {
        const next = regions.includes(id)
            ? regions.filter((r) => r !== id)
            : [...regions, id];
        // Nunca vacío: sin región no habría nada que verificar.
        if (next.length > 0) setRegions(next);
    };
    const setActivity = (region: SiteNormRegion, key: string) => {
        const next = { ...activities };
        if (key) next[region] = key;
        else delete next[region];
        updateSiteElement(element.id, { normReq: { activities: next } });
    };

    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
            <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Normativa de iluminación
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {SITE_NORM_REGIONS.map((r) => (
                    <label
                        key={r.id}
                        className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300"
                    >
                        <input
                            type="checkbox"
                            checked={regions.includes(r.id)}
                            onChange={() => toggleRegion(r.id)}
                        />
                        {r.label}
                    </label>
                ))}
                <button
                    type="button"
                    onClick={() => setRegions([...ALL_SITE_NORM_REGIONS])}
                    className="text-[10px] font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                >
                    Las 3
                </button>
            </div>
            {regions.map((region) => {
                const all = listActivities(region);
                const chosen = findActivity(region, activities[region]);
                const suggestion = suggestActivity(region, element.type);
                const categories = [...new Set(all.map((a) => a.category))];
                return (
                    <div key={region} className="grid gap-1">
                        <label className="text-[11px] text-slate-500">
                            {SITE_NORM_REGIONS.find((r) => r.id === region)?.label}{' '}
                            · {regionSource(region)}
                            <select
                                className={selectClass}
                                value={activities[region] ?? ''}
                                onChange={(e) =>
                                    setActivity(region, e.target.value)
                                }
                            >
                                <option value="">— Sin exigencia —</option>
                                {categories.map((category) => (
                                    <optgroup key={category} label={category}>
                                        {all
                                            .filter(
                                                (a) => a.category === category,
                                            )
                                            .map((a) => (
                                                <option key={a.key} value={a.key}>
                                                    {a.title} · {a.illuminanceLux} lx
                                                </option>
                                            ))}
                                    </optgroup>
                                ))}
                            </select>
                        </label>
                        {chosen ? (
                            <p className="text-[10px] text-slate-500">
                                Requiere Em {chosen.illuminanceLux} lx
                                {chosen.uniformity !== null &&
                                    ` · Uo ${chosen.uniformity}`}
                                {chosen.ugr !== null && ` · UGR ≤ ${chosen.ugr}`}
                                {chosen.specificRequirements &&
                                    chosen.specificRequirements !== 'Ninguno' &&
                                    ` · ${chosen.specificRequirements}`}
                            </p>
                        ) : suggestion ? (
                            <button
                                type="button"
                                onClick={() => setActivity(region, suggestion.key)}
                                className="text-left text-[10px] font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                            >
                                Sugerido: {suggestion.title} (
                                {suggestion.illuminanceLux} lx) — usar
                            </button>
                        ) : (
                            <p className="text-[10px] text-slate-400">
                                Sin una actividad afín en este catálogo: elígela
                                a mano.
                            </p>
                        )}
                    </div>
                );
            })}
            <p className="text-[10px] text-slate-400">
                Los valores salen de los catálogos de normativa de la v1
                (EN 12464-1, IES HB-10, RNE EM.010); los de espacios exteriores
                están citados en código pero sin confirmar contra el texto
                oficial. EN 12464-2, EN 12193 y EN 13201 aún no tienen catálogo
                cargado. El resultado se compara en la vista 3D y no declara
                cumplimiento.
            </p>
        </div>
    );
}

const VERDICT_TEXT: Record<SiteNormVerdict, { text: string; cls: string }> = {
    meets: {
        text: '≥ norma',
        cls: 'text-emerald-700 dark:text-emerald-300',
    },
    below: { text: '< norma', cls: 'text-rose-700 dark:text-rose-300' },
    'no-data': { text: 'sin dato', cls: 'text-slate-400' },
};

/** Resultado calculado por espacio vs. exigencia elegida, por región (vista 3D). */
export function SiteNormVerificationPanel({
    site,
    areaSummaries,
    sourceLabel,
}: {
    site: SiteData | undefined;
    areaSummaries: Record<string, LightingSummary | null>;
    /** De qué motor salen los valores (motor V1 o estimación rápida del 3D). */
    sourceLabel?: string;
}) {
    const regions = activeRegions(site);
    useNormCatalogs(regions);
    const rows = (site?.elements ?? []).filter(
        (el) =>
            el.normReq &&
            Object.values(el.normReq.activities).some(Boolean) &&
            el.visible !== false,
    );
    if (rows.length === 0) return null;
    return (
        <div className="absolute bottom-3 left-[21rem] max-h-64 max-w-md overflow-auto rounded-lg border border-slate-200 bg-white/92 p-2 text-[10px] text-slate-700 shadow dark:border-white/10 dark:bg-slate-900/92 dark:text-slate-200">
            <p className="mb-1 font-bold tracking-wide uppercase">
                Espacios vs. normativa elegida
            </p>
            {sourceLabel && (
                <p className="mb-1 text-[9px] text-slate-400">
                    Valores: {sourceLabel}
                </p>
            )}
            {rows.map((el) => {
                const s = areaSummaries[el.id] ?? null;
                return (
                    <div key={el.id} className="mb-1.5">
                        <p className="font-semibold">
                            {el.label}
                            {s
                                ? ` — Em ${s.avgLux.toFixed(1)} lx · Uo ${s.uniformity.toFixed(2)}`
                                : ' — sin luminarias sobre el espacio'}
                        </p>
                        {regions
                            .filter((r) => el.normReq?.activities[r])
                            .map((r) => {
                                const c = checkAgainstNorm(
                                    r,
                                    el.normReq?.activities[r],
                                    s,
                                );
                                const em = VERDICT_TEXT[c.emVerdict];
                                const uo = VERDICT_TEXT[c.uoVerdict];
                                return (
                                    <p key={r} className="pl-2 text-slate-500 dark:text-slate-400">
                                        {SITE_NORM_REGIONS.find((x) => x.id === r)?.label}
                                        : {c.activity?.title ?? '—'} (
                                        {c.activity?.illuminanceLux} lx) · Em{' '}
                                        <span className={em.cls}>{em.text}</span>
                                        {c.activity?.uniformity != null && (
                                            <>
                                                {' '}
                                                · Uo{' '}
                                                <span className={uo.cls}>
                                                    {uo.text}
                                                </span>
                                            </>
                                        )}
                                    </p>
                                );
                            })}
                    </div>
                );
            })}
            <p className="mt-1 text-[9px] text-slate-400">
                Comparación numérica contra el catálogo de la v1, con modelo
                simplificado; no es una declaración de cumplimiento.
            </p>
        </div>
    );
}
