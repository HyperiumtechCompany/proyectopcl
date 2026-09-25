import { DEFAULT_LINEAR_SPACING_TO_HEIGHT, EDGE_OFFSET_M } from '../domain/siteLinearProjection';
import type { LinearArrangement } from '../domain/siteLinearProjection';
import type { PoleConfig } from '../domain/types';
import { LightProductSelect } from './LightProductSelect';
import { input, NumField } from './SiteProjectionPanel';

/** Poste y regla de colocación de la proyección lineal (`SiteLinearProjectionPanel`). */
export function LinearPoleSettings({
    pole,
    setPole,
    spacingToHeight,
    setSpacingToHeight,
    placement,
    setPlacement,
    side,
    setSide,
    chosenArrangement,
}: {
    pole: PoleConfig;
    setPole: (pole: PoleConfig) => void;
    spacingToHeight: number;
    setSpacingToHeight: (value: number) => void;
    placement: 'outside' | 'inside';
    setPlacement: (value: 'outside' | 'inside') => void;
    side: 0 | 1;
    setSide: (value: 0 | 1) => void;
    chosenArrangement: LinearArrangement;
}) {
    return (
        <details className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-slate-900">
            <summary className="cursor-pointer text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                Poste y regla de colocación
            </summary>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 pb-1">
                <NumField
                    label="Altura montaje (m)"
                    value={pole.heightM}
                    step={0.5}
                    min={1}
                    onChange={(heightM) => setPole({ ...pole, heightM: Math.max(1, heightM) })}
                />
                <NumField
                    label="Separación máx. (× altura)"
                    value={spacingToHeight}
                    step={0.5}
                    min={1}
                    onChange={(value) => setSpacingToHeight(Math.max(1, value))}
                />
                <NumField
                    label="Brazo (m)"
                    value={pole.armLengthM}
                    step={0.5}
                    onChange={(armLengthM) => setPole({ ...pole, armLengthM: Math.max(0, armLengthM) })}
                />
                <NumField
                    label="Flujo c/u (lm)"
                    value={pole.lumens ?? 3000}
                    step={100}
                    min={50}
                    onChange={(lumens) => setPole({ ...pole, lumens: Math.max(50, lumens) })}
                />
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
                <label className="text-[10px] text-slate-500">
                    Ubicación
                    <select
                        className={input}
                        value={placement}
                        onChange={(event) => setPlacement(event.target.value as 'outside' | 'inside')}
                    >
                        <option value="outside">Fuera del borde ({EDGE_OFFSET_M} m)</option>
                        <option value="inside">Dentro del borde</option>
                    </select>
                </label>
                {chosenArrangement === 'single' && (
                    <label className="text-[10px] text-slate-500">
                        Lado
                        <select
                            className={input}
                            value={side}
                            onChange={(event) => setSide(Number(event.target.value) as 0 | 1)}
                        >
                            <option value={0}>Lado A</option>
                            <option value={1}>Lado B</option>
                        </select>
                    </label>
                )}
                <LightProductSelect
                    productId={pole.productId}
                    onChange={(patch) =>
                        setPole({
                            ...pole,
                            productId: patch.productId,
                            ...(patch.lumens ? { lumens: patch.lumens } : {}),
                            ...(patch.wattage ? { wattage: patch.wattage } : {}),
                        })
                    }
                />
            </div>
            <p className="pb-1 text-[9px] leading-snug text-slate-400">
                Disposición por W/h (≤ 1 unilateral, ≤ 1,5 tresbolillo, &gt; 1,5
                pareada; peatonales unilateral): regla de diseño usual de
                alumbrado vial, referencial. Separación máx. = k × altura (k ={' '}
                {DEFAULT_LINEAR_SPACING_TO_HEIGHT} de referencia). Rampas y
                escaleras: mínimo 2 postes (arranque y llegada). El brazo de
                cada poste apunta al eje de la vía.
            </p>
        </details>
    );
}
