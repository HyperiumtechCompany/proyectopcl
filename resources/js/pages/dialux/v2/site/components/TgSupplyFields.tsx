import { conductorResistivity } from '../../electrical-network/domain/feederVoltageDrop';
import type { ElectricalNetworkData } from '../../electrical-network/domain/types';
import type { TgSupplyConfig } from '../domain/types';

const field = 'grid gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400';
const input =
    'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

const SECTIONS_MM2 = [2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
const CONDUCTORS = ['N2XOH', 'NYY', 'THW-90', 'TW', 'LSOH-90'];

/** Número opcional: vacío = se usa el valor general de la red (placeholder). */
function OptionalNumber({
    label,
    value,
    placeholder,
    step = 0.1,
    min = 0,
    max,
    onChange,
}: {
    label: string;
    value: number | undefined;
    placeholder: string;
    step?: number;
    min?: number;
    max?: number;
    onChange: (value: number | undefined) => void;
}) {
    return (
        <label className={field}>
            {label}
            <input
                type="number"
                step={step}
                min={min}
                max={max}
                className={input}
                placeholder={placeholder}
                value={value ?? ''}
                onChange={(event) => {
                    const raw = event.target.value.trim();
                    const parsed = Number(raw);
                    onChange(raw === '' || !Number.isFinite(parsed) ? undefined : parsed);
                }}
            />
        </label>
    );
}

/**
 * Acometida y parámetros de cálculo del TG (el encabezado de la planilla CT
 * de la V1: tensión, conexión, voltaje, factor de diseño, temperatura de
 * trabajo, ρ). Red y CT los aplica a este TG y a todo lo que cuelga de él;
 * lo vacío usa el valor general de la red.
 */
export function TgSupplyFields({
    supply,
    settings,
    hasDrawnFeeder,
    onChange,
}: {
    supply: TgSupplyConfig | undefined;
    settings: ElectricalNetworkData['settings'] | undefined;
    /** Si un cable dibujado en la planta ya alimenta al TG, su longitud manda. */
    hasDrawnFeeder: boolean;
    onChange: (supply: TgSupplyConfig) => void;
}) {
    const value = supply ?? {};
    const patch = (next: Partial<TgSupplyConfig>) => onChange({ ...value, ...next });
    const phases = value.phases ?? settings?.phases ?? 3;
    const temperature = value.workingTemperatureC ?? settings?.workingTemperatureC ?? 20;
    const rho = conductorResistivity('cobre', temperature);
    const missingLength =
        !hasDrawnFeeder &&
        (value.feederHorizontalM ?? 0) + (value.feederVerticalM ?? 0) <= 0;

    return (
        <div className="grid gap-1.5 rounded-md border border-sky-200 bg-sky-50/60 p-2 dark:border-sky-900/60 dark:bg-sky-950/20">
            <p className="text-[10px] font-bold tracking-wide text-sky-800 uppercase dark:text-sky-300">
                Acometida y cálculo (Red y CT)
            </p>
            <p className="text-[9px] leading-4 text-slate-500 dark:text-slate-400">
                Como el encabezado de la planilla CT de la V1. Este TG y todo lo
                que cuelga de él se calculan con estos datos; vacío = valor
                general de la red.
            </p>
            <div className="grid grid-cols-2 gap-1">
                <label className={field}>
                    Tensión
                    <select
                        className={input}
                        value={value.phases ?? ''}
                        onChange={(event) =>
                            patch({
                                phases: event.target.value === '' ? undefined : (Number(event.target.value) as 1 | 3),
                            })
                        }
                    >
                        <option value="">General ({settings?.phases === 1 ? '1Ø' : '3Ø'})</option>
                        <option value="3">3Ø trifásico</option>
                        <option value="1">1Ø monofásico</option>
                    </select>
                </label>
                <label className={field}>
                    Conexión
                    <select
                        className={input}
                        value={value.connectionType ?? ''}
                        onChange={(event) =>
                            patch({
                                connectionType:
                                    event.target.value === ''
                                        ? undefined
                                        : (event.target.value as 'star' | 'delta'),
                            })
                        }
                    >
                        <option value="">
                            General ({settings?.connectionType === 'delta' ? 'Delta' : 'Estrella'})
                        </option>
                        <option value="star">Estrella</option>
                        <option value="delta">Delta</option>
                    </select>
                </label>
                <OptionalNumber
                    label="Voltaje (V)"
                    value={value.nominalVoltageV}
                    placeholder={String(settings?.nominalVoltageV ?? (phases === 1 ? 220 : 380))}
                    step={1}
                    min={1}
                    onChange={(nominalVoltageV) => patch({ nominalVoltageV })}
                />
                <OptionalNumber
                    label="Factor de diseño"
                    value={value.designFactor}
                    placeholder={String(settings?.designFactor ?? 1.25)}
                    step={0.05}
                    min={1}
                    onChange={(designFactor) => patch({ designFactor })}
                />
                <OptionalNumber
                    label="Temperatura de trabajo (°C)"
                    value={value.workingTemperatureC}
                    placeholder={String(settings?.workingTemperatureC ?? 20)}
                    step={1}
                    min={-10}
                    onChange={(workingTemperatureC) => patch({ workingTemperatureC })}
                />
                <OptionalNumber
                    label="Factor de simultaneidad"
                    value={value.simultaneityFactor}
                    placeholder="1"
                    step={0.05}
                    min={0.05}
                    max={1}
                    onChange={(simultaneityFactor) => patch({ simultaneityFactor })}
                />
            </div>
            <p className="text-[9px] text-slate-500 dark:text-slate-400">
                ρ Cu a {temperature} °C = {rho.toFixed(5)} Ω·mm²/m (IEC 60228,
                α = 0,00393 /°C).
            </p>

            <p className="mt-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                Alimentador que llega al TG (medidor → TG)
            </p>
            {hasDrawnFeeder ? (
                <p className="text-[9px] text-emerald-700 dark:text-emerald-400">
                    Lo alimenta un cable dibujado en la planta: su longitud
                    (horizontal y vertical) sale del recorrido.
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-1">
                        <OptionalNumber
                            label="Longitud horizontal (m)"
                            value={value.feederHorizontalM}
                            placeholder="0"
                            onChange={(feederHorizontalM) => patch({ feederHorizontalM })}
                        />
                        <OptionalNumber
                            label="Longitud vertical (m)"
                            value={value.feederVerticalM}
                            placeholder="0"
                            onChange={(feederVerticalM) => patch({ feederVerticalM })}
                        />
                        <label className={field}>
                            Conductor
                            <select
                                className={input}
                                value={value.feederConductorType ?? ''}
                                onChange={(event) =>
                                    patch({ feederConductorType: event.target.value || undefined })
                                }
                            >
                                <option value="">(el de la red)</option>
                                {CONDUCTORS.map((conductor) => (
                                    <option key={conductor} value={conductor}>
                                        {conductor}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={field}>
                            Sección (mm²)
                            <select
                                className={input}
                                value={value.feederSectionMm2 ?? ''}
                                onChange={(event) =>
                                    patch({
                                        feederSectionMm2:
                                            event.target.value === '' ? undefined : Number(event.target.value),
                                    })
                                }
                            >
                                <option value="">(la de la red)</option>
                                {SECTIONS_MM2.map((section) => (
                                    <option key={section} value={section}>
                                        {section}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {missingLength && (
                        <p className="text-[9px] font-semibold text-rose-600 dark:text-rose-400">
                            Sin longitud no se puede calcular la caída de tensión
                            del TG: indícala aquí o dibuja el cable desde el
                            medidor / transformador hasta el TG.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
