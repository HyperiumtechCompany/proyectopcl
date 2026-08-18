import {
    LENI_BUILDING_TYPES,
    LENI_DAYLIGHT_FACTORS,
    LENI_OCCUPANCY_FACTORS,
    type LeniDaylightControlType,
    type LeniOccupancyControlType,
} from '@/pages/dialux/hooks/leniData';
import type { ProjectSiteSettings } from '@/pages/dialux/hooks/types';
import { PanelCard } from '../primitives';

const fieldInputClass =
    'w-full rounded border border-slate-200 dark:border-gray-700/60 bg-white dark:bg-gray-900/70 px-2 py-1.5 text-[11px] text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-600 transition-colors outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30';
const fieldLabelClass = 'mb-1 block text-[9px] tracking-wider text-slate-500 dark:text-gray-500 uppercase';

/** `''` en el `<select>` (sin elegir) se guarda como `undefined`, no como cadena vacía. */
function parseOptionalNumberInput(raw: string): number | undefined {
    if (raw.trim() === '') return undefined;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : undefined;
}

/**
 * Sección "Consumo energético · LENI" del panel Proyecto — extraída de
 * `ProyectoPanel.tsx` (cierre de brechas `dialux-calc-reviewer`, motor
 * LENI/EN 15193) para no empujar ese archivo sobre el presupuesto de
 * tamaño de `__architecture__/fileSizeBudget.test.ts`.
 *
 * Sin `site.leni.buildingType` no hay causa para inventar un default — el
 * PDF sigue mostrando el consumo simple "No regulado" en ese caso.
 */
export function LeniSection({
    site,
    update,
}: {
    site: ProjectSiteSettings | undefined;
    update: (partial: Partial<ProjectSiteSettings>) => void;
}) {
    return (
        <PanelCard title="Consumo energético · LENI">
            <label className={fieldLabelClass}>Tipo de edificio</label>
            <select
                value={site?.leni?.buildingType ?? ''}
                onChange={(e) =>
                    update({
                        leni: { ...site?.leni, buildingType: e.target.value || undefined },
                    })
                }
                className={fieldInputClass}
            >
                <option value="">— sin especificar (usa el consumo simple "No regulado") —</option>
                {LENI_BUILDING_TYPES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                        {entry.label}
                    </option>
                ))}
            </select>
            {site?.leni?.buildingType && (
                <>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                            <label className={fieldLabelClass}>Horas anuales diurnas (t_D)</label>
                            <input
                                type="number"
                                min={0}
                                max={8760}
                                step={10}
                                value={
                                    site.leni.annualOperatingHoursDay ??
                                    LENI_BUILDING_TYPES.find((e) => e.id === site.leni?.buildingType)
                                        ?.annualHoursDay ??
                                    0
                                }
                                onChange={(e) =>
                                    update({
                                        leni: {
                                            ...site.leni,
                                            annualOperatingHoursDay: parseOptionalNumberInput(e.target.value),
                                        },
                                    })
                                }
                                className={fieldInputClass}
                            />
                        </div>
                        <div>
                            <label className={fieldLabelClass}>Horas anuales nocturnas (t_N)</label>
                            <input
                                type="number"
                                min={0}
                                max={8760}
                                step={10}
                                value={
                                    site.leni.annualOperatingHoursNight ??
                                    LENI_BUILDING_TYPES.find((e) => e.id === site.leni?.buildingType)
                                        ?.annualHoursNight ??
                                    0
                                }
                                onChange={(e) =>
                                    update({
                                        leni: {
                                            ...site.leni,
                                            annualOperatingHoursNight: parseOptionalNumberInput(e.target.value),
                                        },
                                    })
                                }
                                className={fieldInputClass}
                            />
                        </div>
                    </div>
                    <label className={`mt-2 ${fieldLabelClass}`}>Control de ocupación (F_O)</label>
                    <select
                        value={site.leni.occupancyControlType ?? 'manual'}
                        onChange={(e) =>
                            update({
                                leni: {
                                    ...site.leni,
                                    occupancyControlType: e.target.value as LeniOccupancyControlType,
                                },
                            })
                        }
                        className={fieldInputClass}
                    >
                        {Object.entries(LENI_OCCUPANCY_FACTORS).map(([key, entry]) => (
                            <option key={key} value={key}>
                                {entry.label}
                            </option>
                        ))}
                    </select>
                    <label className={`mt-2 ${fieldLabelClass}`}>Control de luz natural (F_D)</label>
                    <select
                        value={site.leni.daylightControlType ?? 'none'}
                        onChange={(e) =>
                            update({
                                leni: {
                                    ...site.leni,
                                    daylightControlType: e.target.value as LeniDaylightControlType,
                                },
                            })
                        }
                        className={fieldInputClass}
                    >
                        {Object.entries(LENI_DAYLIGHT_FACTORS).map(([key, entry]) => (
                            <option key={key} value={key}>
                                {entry.label}
                            </option>
                        ))}
                    </select>
                    <label className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={site.leni.constantIlluminanceControl ?? false}
                            onChange={(e) =>
                                update({
                                    leni: { ...site.leni, constantIlluminanceControl: e.target.checked },
                                })
                            }
                        />
                        Iluminación constante (F_C)
                    </label>
                    <p className="mt-2 text-[9.5px] leading-snug text-amber-500/80">
                        LENI = método simplificado EN 15193-1. Horas y factores son valores de referencia marcados{' '}
                        <em>pendientes de verificación normativa</em> (ver
                        `.claude/skills/normativa-dialux/references/normativa.md` §10) — nunca se presenta como
                        "conforme a EN 15193". Energía parásita (standby de controles) no está modelada; el LENI
                        mostrado puede subestimar el consumo real.
                    </p>
                </>
            )}
            {!site?.leni?.buildingType && (
                <p className="mt-1.5 text-[9.5px] leading-snug text-slate-500 dark:text-gray-500">
                    Sin tipo de edificio, el PDF sigue mostrando el consumo simple (P × horas/día × 365) etiquetado
                    "No regulado". Elija un tipo de edificio para calcular LENI real.
                </p>
            )}
        </PanelCard>
    );
}
