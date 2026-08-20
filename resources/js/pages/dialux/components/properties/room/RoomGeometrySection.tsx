import { Square } from 'lucide-react';
import {
    polygonBounds,
    rectangleFromPolygonBounds,
    resizePolygonBounds,
} from '@/pages/dialux/geometry/polygonGeometry';
import type { CorridorType, Room } from '@/pages/dialux/hooks/types';
import {
    EditField,
    PropField,
    SectionWrapper,
    SelectField,
    TextField,
} from '../PropertyFields';
import { StairConfigPanel } from './StairConfigPanel';

const CORRIDOR_TYPE_OPTIONS: Array<{ value: CorridorType; label: string }> = [
    { value: 'roof_only', label: 'Solo techo' },
    { value: 'normal', label: 'Normal' },
    { value: 'roof_floor', label: 'Techo y piso' },
    { value: 'concrete_railings', label: 'Baranda cemento' },
    { value: 'metal_railings', label: 'Baranda metal' },
    { value: 'ramp', label: 'Rampa' },
    { value: 'sidewalk', label: 'Vereda (Piso sin barandas)' },
];

/**
 * Sección "Geometría" de `RoomProps.tsx` (Fase 2, extracción sin cambiar
 * comportamiento): nombre, área, perímetro, alto (o heredado del recinto
 * padre para un pasadizo), campos específicos de pasadizo, vértices, conteo
 * de ambientes, y la configuración de escalera cuando `roomType === 'stair'`.
 */
export function RoomGeometrySection({
    room,
    onUpdate,
    isCorridorAmbient,
    isRecinto,
    parentRoom,
    inheritedHeight,
    area,
    perimeter,
    ambientCount,
}: {
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
    isCorridorAmbient: boolean;
    isRecinto: boolean;
    parentRoom: Room | null;
    inheritedHeight: number | null;
    area: number;
    perimeter: number;
    ambientCount: number;
}) {
    const bounds = polygonBounds(room.vertices);
    const handleCorridorTypeChange = (value: string) => {
        const corridorType = CORRIDOR_TYPE_OPTIONS.find(
            (option) => option.value === value,
        )?.value;
        if (!corridorType) return;
        onUpdate({
            corridorConfig: {
                ...(room.corridorConfig ?? {}),
                type: corridorType,
            },
        });
    };

    return (
        <SectionWrapper
            icon={<Square size={12} className="text-blue-400" />}
            label={
                isCorridorAmbient
                    ? 'Propiedades · Pasadizo'
                    : room.roomType === 'ambient'
                      ? 'Propiedades · Ambiente'
                      : 'Propiedades · Recinto'
            }
        >
            <TextField
                label="Nombre"
                value={room.name}
                onChange={(value) => onUpdate({ name: value })}
            />
            {/* Orden solicitado: área → longitud (perímetro) → alto,
                lo primero que se necesita al revisar un ambiente. */}
            <PropField label="Área" value={`${area.toFixed(4)} m²`} />
            <PropField label="Perímetro" value={`${perimeter.toFixed(4)} m`} />
            <EditField
                label="Ancho (m)"
                value={Number(bounds.width.toFixed(3))}
                min={0.1}
                max={1000}
                step={0.1}
                onChange={(width) =>
                    onUpdate({
                        vertices: resizePolygonBounds(
                            room.vertices,
                            width,
                            bounds.height,
                        ),
                    })
                }
            />
            <EditField
                label="Largo (m)"
                value={Number(bounds.height.toFixed(3))}
                min={0.1}
                max={1000}
                step={0.1}
                onChange={(height) =>
                    onUpdate({
                        vertices: resizePolygonBounds(
                            room.vertices,
                            bounds.width,
                            height,
                        ),
                    })
                }
            />
            <p className="rounded bg-cyan-50 px-2 py-1.5 text-[10px] leading-relaxed text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300">
                Para formas libres, selecciona el ambiente y arrastra los puntos
                verdes. Usa los cuadrados celestes para agregar vértices.
            </p>
            <button
                type="button"
                onClick={() =>
                    onUpdate({
                        vertices: rectangleFromPolygonBounds(room.vertices),
                    })
                }
                className="w-full rounded border border-amber-400/50 bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
                Convertir a rectángulo editable
            </button>
            {inheritedHeight !== null ? (
                <PropField
                    label="Alto techo (m) — heredado del recinto"
                    value={`${inheritedHeight.toFixed(2)} m`}
                    mono={false}
                />
            ) : (
                <EditField
                    label={isCorridorAmbient ? 'Alto techo (m)' : 'Alto (m)'}
                    value={room.height}
                    min={1}
                    max={20}
                    step={0.1}
                    onChange={(value) => onUpdate({ height: value })}
                />
            )}
            {isCorridorAmbient && parentRoom && parentRoom.id !== room.id && (
                <PropField
                    label="Recinto"
                    value={parentRoom.name}
                    mono={false}
                />
            )}
            {isCorridorAmbient && (
                <>
                    <SelectField
                        label="Tipo"
                        value={room.corridorConfig?.type ?? 'roof_only'}
                        options={CORRIDOR_TYPE_OPTIONS}
                        onChange={handleCorridorTypeChange}
                    />
                    {(room.corridorConfig?.type === 'concrete_railings' ||
                        room.corridorConfig?.type === 'metal_railings') && (
                        <EditField
                            label="Alto baranda (m)"
                            value={room.corridorConfig?.railingHeight ?? 1.05}
                            min={0.6}
                            max={1.5}
                            step={0.05}
                            onChange={(value) =>
                                onUpdate({
                                    corridorConfig: {
                                        ...(room.corridorConfig ?? {}),
                                        railingHeight: value,
                                    },
                                })
                            }
                        />
                    )}
                    {room.corridorConfig?.type === 'ramp' && (
                        <EditField
                            label="Pendiente (%)"
                            value={room.corridorConfig?.rampSlope ?? 8}
                            min={1}
                            max={20}
                            step={0.5}
                            onChange={(value) =>
                                onUpdate({
                                    corridorConfig: {
                                        ...(room.corridorConfig ?? {}),
                                        rampSlope: value,
                                    },
                                })
                            }
                        />
                    )}
                    {(room.corridorConfig?.type === 'ramp' ||
                        room.corridorConfig?.type === 'roof_floor') && (
                        <SelectField
                            label={
                                room.corridorConfig?.type === 'ramp'
                                    ? 'Dirección sube'
                                    : 'Dirección flujo'
                            }
                            value={room.corridorConfig?.direction ?? 'north'}
                            options={[
                                { value: 'north', label: 'Norte ↑' },
                                { value: 'south', label: 'Sur ↓' },
                                { value: 'east', label: 'Este →' },
                                { value: 'west', label: 'Oeste ←' },
                            ]}
                            onChange={(value) =>
                                onUpdate({
                                    corridorConfig: {
                                        ...(room.corridorConfig ?? {}),
                                        direction: value as
                                            'north' | 'south' | 'east' | 'west',
                                    },
                                })
                            }
                        />
                    )}
                    {room.corridorConfig?.type === 'ramp' && (
                        <EditField
                            label="Alto baranda (m)"
                            value={room.corridorConfig?.railingHeight ?? 1.0}
                            min={0.6}
                            max={1.5}
                            step={0.05}
                            onChange={(value) =>
                                onUpdate({
                                    corridorConfig: {
                                        ...(room.corridorConfig ?? {}),
                                        railingHeight: value,
                                    },
                                })
                            }
                        />
                    )}
                </>
            )}
            <PropField label="Vértices" value={`${room.vertices.length}`} />
            {isRecinto && (
                <PropField label="Ambientes" value={`${ambientCount}`} />
            )}

            {room.roomType === 'stair' && (
                <StairConfigPanel room={room} onUpdate={onUpdate} />
            )}
        </SectionWrapper>
    );
}
