import { Gauge, Lightbulb, Zap } from 'lucide-react';
import type {
    NormativeLeafOption,
    NormativeStandard,
} from '@/pages/dialux/hooks/roomLighting';
import {
    getRoomManualUgr,
    getRoomMarginalZone,
    getRoomUsefulPlaneHeight,
    NORMATIVE_LABELS,
    type RoomLightingInputs,
} from '@/pages/dialux/hooks/roomLighting';
import type { Fixture, FixtureArrangement, Room } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    EditField,
    PropField,
    SectionWrapper,
    SelectField,
} from '../PropertyFields';
import { NormativeValuesSummary } from '../NormativeValuesSummary';

/**
 * Sección "Iluminación" de `RoomProps.tsx` (Fase 2, extracción sin cambiar
 * comportamiento) — solo se renderiza para ambientes/pasadizos.
 */
export function RoomLightingSection({
    room,
    onUpdate,
    standard,
    normCategories,
    normSections,
    normActivities,
    inputs,
    fixturesInRoom,
    arrangementsList = [],
}: {
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
    standard: NormativeStandard;
    normCategories: string[];
    normSections: string[];
    normActivities: NormativeLeafOption[];
    inputs: RoomLightingInputs;
    fixturesInRoom: Fixture[];
    arrangementsList?: FixtureArrangement[];
}) {
    const store = useEditorStore();
    const manualUgr = getRoomManualUgr(room);
    const selectedRequirement =
        normActivities.find((activity) => activity.activity === room.normativeActivity) ?? null;

    return (
        <>
        <SectionWrapper
            icon={<Zap size={12} className="text-yellow-400" />}
            label="Normativa y verificación"
            defaultOpen={false}
        >
            <PropField
                label="Estándar"
                value={NORMATIVE_LABELS[standard]}
                mono={false}
            />
            <SelectField
                label="Sección / Área"
                value={room.normativeCategory ?? ''}
                options={[
                    ...(room.normativeCategory &&
                    !normCategories.includes(room.normativeCategory)
                        ? [
                              {
                                  value: room.normativeCategory,
                                  label: room.normativeCategory,
                              },
                          ]
                        : []),
                    ...normCategories.map((c) => ({ value: c, label: c })),
                ]}
                onChange={(val) =>
                    onUpdate({
                        normativeCategory: val,
                        normativeSection: undefined,
                        normativeActivity: undefined,
                    })
                }
            />
            {room.normativeCategory && (
                <SelectField
                    label="Subsección"
                    value={room.normativeSection ?? ''}
                    options={[
                        ...(room.normativeSection &&
                        !normSections.includes(room.normativeSection)
                            ? [
                                  {
                                      value: room.normativeSection,
                                      label: room.normativeSection,
                                  },
                              ]
                            : []),
                        ...normSections.map((s) => ({ value: s, label: s })),
                    ]}
                    onChange={(val) =>
                        onUpdate({
                            normativeSection: val,
                            normativeActivity: undefined,
                        })
                    }
                />
            )}
            {room.normativeCategory && (
                <SelectField
                    label="Aplicación"
                    value={room.normativeActivity ?? ''}
                    options={[
                        ...(room.normativeActivity &&
                        !normActivities.some(
                            (a) => a.activity === room.normativeActivity,
                        )
                            ? [
                                  {
                                      value: room.normativeActivity,
                                      label: room.normativeActivity,
                                  },
                              ]
                            : []),
                        ...normActivities.map((a) => ({
                            value: a.activity,
                            label: a.activity,
                        })),
                    ]}
                    onChange={(val) => {
                        const act = normActivities.find(
                            (a) => a.activity === val,
                        );
                        // Antes solo se aplicaba `illuminanceLux` — el
                        // límite de UGR, la uniformidad y el Ra objetivo de
                        // la norma quedaban descartados en TODO proyecto,
                        // cayendo siempre a valores genéricos por defecto
                        // (`room.ugrLimit ?? 22`, etc.) sin importar qué
                        // actividad se hubiera elegido realmente. `null` en
                        // el catálogo significa "esta actividad no regula
                        // este parámetro" (ej. UGR en estacionamientos) — se
                        // aplica tal cual, nunca se interpreta como "sin
                        // dato" para caer al valor previo del recinto.
                        onUpdate({
                            normativeActivity: val,
                            normativeLabel: act?.label ?? room.normativeLabel,
                            illuminanceLux:
                                act?.illuminanceLux ?? inputs.illuminanceLux,
                            uniformityTarget: act
                                ? act.uniformity
                                : room.uniformityTarget,
                            ugrLimit: act ? act.ugr : room.ugrLimit,
                            // NO se copia `act.ra` aquí: `colorRenderingRa`
                            // representa el Ra REAL de las luminarias
                            // instaladas (ver `normativeEngine.ts`), no el
                            // requisito de la norma — compararía el requisito
                            // contra sí mismo y "Conforme" saldría siempre,
                            // sin importar qué luminaria se instale de
                            // verdad. El requisito ya vive en `act.ra` /
                            // `normative.ra`, se lee directo de ahí.
                            specificRequirements: act
                                ? act.specificRequirements
                                : room.specificRequirements,
                            // `act.workPlaneHeight` solo viene poblado para
                            // actividades verificadas contra DIALux real (ver
                            // `RawNormativeLeaf.workPlaneHeight`) — cuando no
                            // está verificada (`null`), se conserva el valor
                            // previo del ambiente en vez de pisarlo con una
                            // altura sin fuente confirmada.
                            usefulPlaneHeight:
                                act && act.workPlaneHeight !== null
                                    ? act.workPlaneHeight
                                    : room.usefulPlaneHeight,
                        });
                    }}
                />
            )}
            <NormativeValuesSummary
                requirement={selectedRequirement}
                manualValues={{
                    ugr: room.ugrLimit,
                    uniformity: room.uniformityTarget,
                    ra: room.raRequiredOverride,
                }}
            />
            {selectedRequirement?.ugr === null && (
                <EditField
                    label="UGRL manual requerido"
                    value={room.ugrLimit ?? 22}
                    min={10}
                    max={40}
                    step={1}
                    onChange={(value) => onUpdate({ ugrLimit: value })}
                />
            )}
            {selectedRequirement?.uniformity === null && (
                <EditField
                    label="Uo manual requerido"
                    value={room.uniformityTarget ?? 0.4}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(value) => onUpdate({ uniformityTarget: value })}
                />
            )}
            {selectedRequirement?.ra === null && (
                <EditField
                    label="Ra manual requerido"
                    value={room.raRequiredOverride ?? 80}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) => onUpdate({ raRequiredOverride: value })}
                />
            )}
            <EditField
                label="Iluminancia (lux)"
                value={inputs.illuminanceLux}
                min={10}
                max={2000}
                step={10}
                onChange={(value) =>
                    onUpdate({ illuminanceLux: value, norma: value })
                }
            />
        </SectionWrapper>

        <SectionWrapper
            icon={<Gauge size={12} className="text-cyan-500" />}
            label="Consumo y operación"
            defaultOpen={false}
        >
            <EditField
                label="Uso diario (h/día) — para Consumo (kWh/a)"
                value={room.dailyOperatingHours ?? 8}
                min={0}
                max={24}
                step={0.5}
                onChange={(value) => onUpdate({ dailyOperatingHours: value })}
            />
            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                Este valor se usa para estimar el consumo anual del ambiente y su exportación.
            </p>
        </SectionWrapper>

        <SectionWrapper
            icon={<Lightbulb size={12} className="text-amber-500" />}
            label="Instalación de luminarias"
            defaultOpen={false}
        >
            <PropField
                label="Cable luminarias"
                value="2.5 mm² · AWG 14"
                mono={false}
            />
            <EditField
                label="Altura plano útil (m)"
                value={getRoomUsefulPlaneHeight(room)}
                min={0}
                max={3}
                step={0.05}
                onChange={(value) => onUpdate({ usefulPlaneHeight: value })}
            />
            <EditField
                label="Zona marginal (m)"
                value={getRoomMarginalZone(room)}
                min={0}
                max={2}
                step={0.005}
                onChange={(value) => onUpdate({ marginalZone: value })}
            />
            <div className="border-b border-gray-300 dark:border-gray-800/40 pb-1.5">
                <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={manualUgr !== null}
                        onChange={(event) =>
                            onUpdate({
                                manualUgr: event.target.checked
                                    ? (manualUgr ?? room.ugrLimit ?? 19)
                                    : null,
                            })
                        }
                    />
                    <span className="text-[10px] text-gray-500 dark:text-gray-500">
                        UGR manual (reemplaza al calculado)
                    </span>
                </label>
                {manualUgr !== null && (
                    <div className="mt-1.5">
                        <EditField
                            label="UGR"
                            value={manualUgr}
                            min={0}
                            max={40}
                            step={0.1}
                            onChange={(value) => onUpdate({ manualUgr: value })}
                        />
                    </div>
                )}
                <p className="mt-1 text-[9px] text-gray-600 dark:text-gray-600">
                    Solo cuando el motor no puede evaluar (todas las
                    luminarias fuera del rango H/R≤2, "No evaluado") —
                    declara aquí el valor de referencia (ej. de un informe
                    DIALux evo) en vez de dejarlo sin evaluar.
                </p>
            </div>
            <div className="flex items-center justify-between">
                <PropField
                    label="Luminarias"
                    value={`${fixturesInRoom.length}`}
                />
            </div>
            {/* Proyecciones del ambiente */}
            {arrangementsList.length > 0 && (
                <div className="mt-1 space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                        Proyecciones ({arrangementsList.length})
                    </p>
                    {arrangementsList.map((arr, i) => {
                        const firstFix = fixturesInRoom.find(f => (f as any).arrangementId === arr.id);
                        const fixName = firstFix?.name ?? `Proyección ${i + 1}`;
                        const count = arr.fixtureIds.length;
                        return (
                            <button
                                key={arr.id}
                                type="button"
                                onClick={() => {
                                    store.setSelectedId(arr.id);
                                }}
                                className="flex w-full items-center justify-between rounded border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-1.5 text-left hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors"
                            >
                                <span className="truncate text-[10px] font-medium text-cyan-700 dark:text-cyan-300">
                                    {arr.config.columns}×{arr.config.rows} — {fixName}
                                </span>
                                <span className="ml-2 shrink-0 text-[9px] text-cyan-500">
                                    {count} lum.
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
            <PropField
                label="Lm detectados"
                value={
                    inputs.detectedFixtureLumens
                        ? `${inputs.detectedFixtureLumens.toLocaleString()} lm`
                        : '—'
                }
            />
            <PropField
                label="Lm requeridos"
                value={`${inputs.lumensRequired.toFixed(0).toLocaleString()} lm`}
            />
            <PropField
                label="Cant. óptima"
                value={`${inputs.exactQuantity.toFixed(2)}`}
            />
            <PropField
                label="Cant. simetría"
                value={`${inputs.roundedQuantity}`}
            />
            <div className="flex items-center justify-between border-b border-gray-300 dark:border-gray-800/40 pb-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">
                    Cumple normativa
                </span>
                {fixturesInRoom.length >= inputs.roundedQuantity ? (
                    <span className="text-[11px] font-medium text-emerald-400">
                        ✓ Sí ({fixturesInRoom.length}/{inputs.roundedQuantity})
                    </span>
                ) : (
                    <span className="text-[11px] font-medium text-red-400">
                        ✗ Faltan{' '}
                        {inputs.roundedQuantity - fixturesInRoom.length}
                    </span>
                )}
            </div>
            <p className="pt-1 text-[9px] text-gray-600 dark:text-gray-600">
                Botón "Cálculo CT" disponible en la barra superior (junto a
                Calcular) cuando este ambiente está seleccionado.
            </p>
        </SectionWrapper>
        </>
    );
}
