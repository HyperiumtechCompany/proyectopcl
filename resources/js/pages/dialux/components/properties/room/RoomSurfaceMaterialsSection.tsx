import { Palette } from 'lucide-react';
import type { Room } from '@/pages/dialux/hooks/types';
import { findSurfaceMaterialPresetByValue, SURFACE_MATERIAL_PRESETS } from '@/pages/dialux/hooks/materialsData';
import { EditField, SectionWrapper, SelectField } from '../PropertyFields';

const UNSET_OPTION = 'unset';
const CUSTOM_OPTION = 'custom';

const SELECT_OPTIONS = [
    { value: UNSET_OPTION, label: 'Sin asignar' },
    ...SURFACE_MATERIAL_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
    { value: CUSTOM_OPTION, label: 'Personalizado' },
];

function SurfaceReflectanceField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number | null | undefined;
    onChange: (value: number | null) => void;
}) {
    const reflectance = value ?? null;
    const matchedPreset = findSurfaceMaterialPresetByValue(reflectance);
    const selectValue = reflectance === null ? UNSET_OPTION : (matchedPreset?.id ?? CUSTOM_OPTION);

    return (
        <>
            <SelectField
                label={label}
                value={selectValue}
                options={SELECT_OPTIONS}
                onChange={(next) => {
                    if (next === UNSET_OPTION) {
                        onChange(null);
                    } else if (next === CUSTOM_OPTION) {
                        onChange(reflectance ?? 0.5);
                    } else {
                        const preset = SURFACE_MATERIAL_PRESETS.find((p) => p.id === next);
                        onChange(preset?.reflectance ?? null);
                    }
                }}
            />
            {selectValue === CUSTOM_OPTION && (
                <EditField
                    label={`${label} (%)`}
                    value={Math.round((reflectance ?? 0) * 100)}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(percent) => onChange(Math.min(1, Math.max(0, percent / 100)))}
                />
            )}
        </>
    );
}

/**
 * Sección "Materiales fotométricos" de `RoomProps.tsx` (Fase 16 del plan
 * maestro) — reflectancia de techo/pared/piso del recinto, consumida por
 * `resolveMaterialId()` (`domain/calculation/buildCalculationSnapshot.ts`)
 * para el cálculo de interreflexión. Se renderiza tanto para el recinto
 * exterior como para cada ambiente/pasadizo — cada uno guarda su propia
 * reflectancia (`room.ceilingReflectance`/etc en ESE `Room`, no heredada del
 * recinto padre: `buildRoomLightingInputs` lee siempre del `calculationRoom`
 * exacto que se le pasa). Antes solo se mostraba en el recinto, así que un
 * ambiente sin reflectancia propia asignada no tenía forma de editarla desde
 * la UI aunque sí influía en su cálculo real. Valores de referencia
 * documentados en `hooks/materialsData.ts` — no confundir con
 * `room.material` (`'brick'|'adobe'`), que es el material ESTRUCTURAL del
 * muro (RNE), un concepto distinto.
 */
export function RoomSurfaceMaterialsSection({
    room,
    onUpdate,
}: {
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
}) {
    return (
        <SectionWrapper icon={<Palette size={12} className="text-orange-400" />} label="Materiales fotométricos">
            <SurfaceReflectanceField
                label="Reflectancia techo"
                value={room.ceilingReflectance}
                onChange={(ceilingReflectance) => onUpdate({ ceilingReflectance })}
            />
            <SurfaceReflectanceField
                label="Reflectancia pared"
                value={room.wallReflectance}
                onChange={(wallReflectance) => onUpdate({ wallReflectance })}
            />
            <SurfaceReflectanceField
                label="Reflectancia piso"
                value={room.floorReflectance}
                onChange={(floorReflectance) => onUpdate({ floorReflectance })}
            />
        </SectionWrapper>
    );
}
