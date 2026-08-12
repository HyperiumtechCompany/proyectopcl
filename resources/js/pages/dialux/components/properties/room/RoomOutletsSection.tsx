import { PlugZap, Trash2 } from 'lucide-react';
import {
    distributeOutletsOnPerimeter,
    OUTLET_RULES,
    requiredOutletCount,
    type OutletUse,
} from '@/pages/dialux/hooks/outletPlacement';
import { ELECTRICAL_DEVICE_DEFAULTS, type ElectricalDeviceType, type Room, type Vertex } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { PropField, SectionWrapper, SelectField, EditField } from '../PropertyFields';

/**
 * Sección "Tomacorrientes por ambiente" de `RoomProps.tsx` (Fase 2,
 * extracción sin cambiar comportamiento) — solo se renderiza para
 * ambientes/pasadizos.
 */
export function RoomOutletsSection({
    room,
    onUpdate,
    calculationVertices,
    calculationHeight,
    area,
    perimeter,
    generatedOutletsCount,
}: {
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
    calculationVertices: Vertex[];
    calculationHeight: number;
    area: number;
    perimeter: number;
    generatedOutletsCount: number;
}) {
    const store = useEditorStore();
    const outletUse: OutletUse = room.outletUse && room.outletUse !== 'none'
        ? room.outletUse
        : 'aula';
    const outletRule = OUTLET_RULES[outletUse];
    const requiredOutlets = requiredOutletCount(calculationVertices, outletUse);
    const outletDeviceType = room.outletDeviceType ?? (outletUse === 'exterior' ? 'outlet_waterproof' : 'outlet_floor');

    const regenerateOutlets = () => {
        const defaults = ELECTRICAL_DEVICE_DEFAULTS[outletDeviceType];
        const devices = distributeOutletsOnPerimeter(calculationVertices, requiredOutlets, room.outletStartOffset).map(
            (point, index) => ({
                type: outletDeviceType,
                x: point.x,
                y: point.y,
                label: `${defaults.label}-${String(index + 1).padStart(2, '0')}`,
                mountingHeight: outletDeviceType === 'outlet_ceiling' ? calculationHeight : defaults.mountingHeight,
                roomId: room.id,
                generatedBy: 'outlet-rule' as const,
                connectedDeviceIds: [],
                properties: { ...defaults.properties },
            }),
        );
        store.replaceGeneratedOutletsForRoom(room.id, devices);
    };

    return (
        <SectionWrapper icon={<PlugZap size={12} className="text-emerald-600 dark:text-emerald-400" />} label="Tomacorrientes por ambiente">
            <SelectField
                label="Uso"
                value={outletUse}
                options={Object.entries(OUTLET_RULES).map(([value, rule]) => ({ value, label: rule.label }))}
                onChange={(value) => {
                    const nextUse = value as OutletUse;
                    onUpdate({
                        outletUse: nextUse,
                        outletDeviceType: nextUse === 'exterior' ? 'outlet_waterproof' : room.outletDeviceType ?? 'outlet_floor',
                    });
                }}
            />
            <SelectField
                label="Tipo / altura"
                value={outletDeviceType}
                options={[
                    { value: 'outlet_floor', label: 'Bajo · 0.40 m' },
                    { value: 'outlet_initial', label: 'Inicial · 1.50 m' },
                    { value: 'outlet_waterproof', label: 'Exterior · 1.20 m' },
                    { value: 'outlet_high_180', label: 'Alto · 1.80 m' },
                    { value: 'outlet_rack', label: 'Comunicaciones · 2.00 m' },
                    { value: 'outlet_floor_box', label: 'Piso · NPT' },
                    { value: 'outlet_ceiling', label: 'Techo' },
                ]}
                onChange={(value) => {
                    const type = value as ElectricalDeviceType;
                    const defaults = ELECTRICAL_DEVICE_DEFAULTS[type];
                    onUpdate({ outletDeviceType: type });
                    store.updateGeneratedOutletsForRoom(room.id, {
                        type,
                        mountingHeight: type === 'outlet_ceiling' ? calculationHeight : defaults.mountingHeight,
                        properties: { ...defaults.properties },
                    });
                }}
            />
            <EditField
                label="Inicio en perímetro (m)"
                value={room.outletStartOffset ?? 0}
                min={0}
                max={Math.max(perimeter, 0)}
                step={0.1}
                onChange={(value) => onUpdate({ outletStartOffset: value })}
            />
            <PropField label="Medición" value={outletRule.method === 'area' ? `${area.toFixed(2)} m²` : `${perimeter.toFixed(2)} m`} />
            <PropField label="Regla" value={outletRule.description} mono={false} />
            <PropField label="Cantidad requerida" value={`${requiredOutlets}`} />
            <PropField label="Generados" value={`${generatedOutletsCount}`} />
            <PropField label="Cable" value="4 mm² · AWG 12" mono={false} />
            <button
                type="button"
                onClick={regenerateOutlets}
                disabled={requiredOutlets === 0}
                className="w-full rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {generatedOutletsCount > 0 ? 'Regenerar tomacorrientes' : 'Generar tomacorrientes'}
            </button>
            {generatedOutletsCount > 0 && (
                <button
                    type="button"
                    onClick={() => store.removeGeneratedOutletsForRoom(room.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] font-medium text-red-700 dark:text-red-300 hover:bg-red-500/20"
                >
                    <Trash2 size={11} /> Eliminar tomacorrientes del ambiente
                </button>
            )}
        </SectionWrapper>
    );
}
