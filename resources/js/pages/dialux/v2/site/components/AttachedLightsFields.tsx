import { Lightbulb } from 'lucide-react';
import { DEFAULT_SIDE_LIGHTS, poolLightPoints, rampSideLightPoints } from '../domain/rampFootprint';
import type { PoolConfig, SideLights, SiteElement } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { LightProductSelect } from './LightProductSelect';

const field = 'text-[10px] text-slate-500';
const input =
    'mt-0.5 h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';

function Num({ label, value, step = 1, min = 0, onChange }: { label: string; value: number; step?: number; min?: number; onChange: (value: number) => void }) {
    return (
        <label className={field}>
            {label}
            <input
                type="number"
                step={step}
                min={min}
                className={input}
                value={value}
                onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))}
            />
        </label>
    );
}

/**
 * Luminarias propias de rampas, escaleras y piscinas: balizas de
 * circulación (muro a 0,30 m o bolardo) repartidas por tramo y costado, y
 * luces subacuáticas de piscina. Las balizas entran al cálculo (a la cota
 * real de cada tramo), al 3D y a la carga del circuito que las alimenta.
 */
export function AttachedLightsFields({ element, editor }: { element: SiteElement; editor: UseSiteEditorReturn }) {
    const scaleM = editor.terrainScaleM || 1;
    const config = element.config;

    if ((element.type === 'ramp' || element.type === 'stair') && (config?.kind === 'ramp' || config?.kind === 'stair')) {
        const lights: SideLights = { ...DEFAULT_SIDE_LIGHTS, ...(config.lights ?? {}) };
        const update = (patch: Partial<SideLights>) =>
            editor.updateSiteElement(element.id, { config: { ...config, lights: { ...lights, ...patch } } });
        const count = lights.enabled ? rampSideLightPoints(element, scaleM).length : 0;
        return (
            <section className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-2 text-[11px] dark:border-amber-500/20 dark:bg-amber-500/5">
                <label className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                    <input type="checkbox" checked={lights.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    Balizas de {element.type === 'ramp' ? 'la rampa' : 'la escalera'}
                </label>
                {lights.enabled && (
                    <>
                        <div className="grid grid-cols-2 gap-1.5">
                            <label className={field}>
                                Tipo
                                <select className={input} value={lights.mode} onChange={(event) => update({ mode: event.target.value as SideLights['mode'], heightM: undefined })}>
                                    <option value="wall">Empotrada en muro/sardinel (0,30 m)</option>
                                    <option value="bollard">Bolardo al costado (1 m)</option>
                                </select>
                            </label>
                            <label className={field}>
                                Costados
                                <select className={input} value={lights.sides} onChange={(event) => update({ sides: event.target.value as SideLights['sides'] })}>
                                    <option value="both">Ambos</option>
                                    <option value="left">Solo izquierdo</option>
                                    <option value="right">Solo derecho</option>
                                </select>
                            </label>
                            <Num label="Separación (m)" value={lights.spacingM} step={0.25} min={0.5} onChange={(spacingM) => update({ spacingM })} />
                            <Num
                                label="Altura sobre el piso (m)"
                                value={lights.heightM ?? (lights.mode === 'bollard' ? 1 : 0.3)}
                                step={0.05}
                                min={0.1}
                                onChange={(heightM) => update({ heightM })}
                            />
                            <Num label="Flujo por baliza (lm)" value={lights.lumens} step={10} onChange={(lumens) => update({ lumens })} />
                            <Num label="Potencia por baliza (W)" value={lights.wattage} step={0.5} onChange={(wattage) => update({ wattage })} />
                            <LightProductSelect
                                productId={lights.productId}
                                onChange={(patch) =>
                                    update({
                                        productId: patch.productId,
                                        ...(patch.lumens ? { lumens: patch.lumens } : {}),
                                        ...(patch.wattage ? { wattage: patch.wattage } : {}),
                                    })
                                }
                            />
                        </div>
                        <p className="text-[10px] text-slate-500">
                            {count} balizas · {(count * lights.wattage).toLocaleString('es-PE')} W. Se colocan en cada tramo y descanso, a la
                            altura indicada sobre el piso real de ese punto; entran al cálculo del espacio y como carga al cablearlas desde un
                            tablero.
                        </p>
                    </>
                )}
            </section>
        );
    }

    if (element.type === 'pool') {
        const pool: PoolConfig = config?.kind === 'pool' ? config : { kind: 'pool', depthM: element.heightM ?? 1.4 };
        const lights = { enabled: false, count: 4, lumens: 1500, wattage: 18, ...(pool.lights ?? {}) };
        const update = (patch: Partial<PoolConfig>) => editor.updateSiteElement(element.id, { config: { ...pool, ...patch } });
        const count = lights.enabled ? poolLightPoints({ ...element, config: { ...pool, lights } }, scaleM).length : 0;
        return (
            <section className="grid gap-2 rounded-lg border border-sky-200 bg-sky-50/40 p-2 text-[11px] dark:border-sky-500/20 dark:bg-sky-500/5">
                <p className="font-bold text-slate-700 dark:text-slate-200">Piscina</p>
                <Num label="Profundidad del vaso (m)" value={pool.depthM ?? element.heightM ?? 1.4} step={0.1} min={0.3} onChange={(depthM) => update({ depthM })} />
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                    <input type="checkbox" checked={lights.enabled} onChange={(event) => update({ lights: { ...lights, enabled: event.target.checked } })} />
                    <Lightbulb className="h-3.5 w-3.5 text-sky-500" />
                    Luces subacuáticas
                </label>
                {lights.enabled && (
                    <div className="grid grid-cols-2 gap-1.5">
                        <Num label="Cantidad" value={lights.count} step={1} min={1} onChange={(value) => update({ lights: { ...lights, count: Math.round(value) } })} />
                        <Num label="Potencia c/u (W)" value={lights.wattage} step={1} onChange={(wattage) => update({ lights: { ...lights, wattage } })} />
                        <Num label="Flujo c/u (lm)" value={lights.lumens} step={50} onChange={(lumens) => update({ lights: { ...lights, lumens } })} />
                    </div>
                )}
                <p className="text-[10px] text-slate-500">
                    {lights.enabled ? `${count} luces · ${(count * lights.wattage).toLocaleString('es-PE')} W (carga del circuito). ` : ''}
                    Las subacuáticas iluminan el agua: van al 3D y a la carga eléctrica, no al cálculo de iluminancia de la lámina ni de la
                    playa, que se iluminan con postes o balizas.
                </p>
            </section>
        );
    }
    return null;
}
