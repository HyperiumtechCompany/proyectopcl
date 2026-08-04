import { Zap } from 'lucide-react';
import type {
    NormativeLeafOption,
    NormativeStandard,
} from '@/pages/dialux/hooks/roomLighting';
import {
    NORMATIVE_LABELS,
    type RoomLightingInputs,
} from '@/pages/dialux/hooks/roomLighting';
import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    EditField,
    PropField,
    SectionWrapper,
    SelectField,
} from '../PropertyFields';

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
}: {
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
    standard: NormativeStandard;
    normCategories: string[];
    normSections: string[];
    normActivities: NormativeLeafOption[];
    inputs: RoomLightingInputs;
    fixturesInRoom: Fixture[];
}) {
    const store = useEditorStore();

    return (
        <SectionWrapper
            icon={<Zap size={12} className="text-yellow-400" />}
            label="Iluminación"
        >
            <PropField
                label="Estándar"
                value={NORMATIVE_LABELS[standard]}
                mono={false}
            />
            <PropField
                label="Cable luminarias"
                value="2.5 mm² · AWG 14"
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
                            colorRenderingRa: act
                                ? act.ra
                                : room.colorRenderingRa,
                            specificRequirements: act
                                ? act.specificRequirements
                                : room.specificRequirements,
                        });
                    }}
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
            <div className="flex items-center justify-between">
                <PropField
                    label="Luminarias"
                    value={`${fixturesInRoom.length}`}
                />
                {fixturesInRoom.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            store.setSelectedId(null);
                            store.setSelectedFixtureIds(
                                fixturesInRoom.map((f) => f.id),
                            );
                        }}
                        className="ml-2 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-600/40"
                    >
                        Seleccionar Todas
                    </button>
                )}
            </div>
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
            <div className="flex items-center justify-between border-b border-gray-800/40 pb-1.5">
                <span className="text-[10px] text-gray-500">
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
            <p className="pt-1 text-[9px] text-gray-600">
                Botón "Cálculo CT" disponible en la barra superior (junto a
                Calcular) cuando este ambiente está seleccionado.
            </p>
        </SectionWrapper>
    );
}
