/**
 * Pestaña Ambientes: pisos + ambientes con geometría, lux requerido (normativa),
 * CU/FM y tipo de ambiente (regla de tomacorrientes).
 */

import { BookOpen, DownloadCloud } from 'lucide-react';
import { useState } from 'react';
import type { ElectricalDocumentApi } from '../useElectricalDocument';
import { importRoomsFromCad, newId, type CadProjectData } from '../useElectricalDocument';
import type { ElectricalRoom, NormativeRequirementRow, OutletRule } from '../engine/types';
import NormativePicker from './NormativePicker';
import { AddButton, DeleteButton, EmptyRow, NumCell, Section, SelectCell, StatusBadge, TableShell, TextCell, fmt } from './primitives';

interface Props {
    api: ElectricalDocumentApi;
    cadData: CadProjectData | null;
    outletRules: OutletRule[];
    normativeRequirements: NormativeRequirementRow[];
}

export default function RoomsTab({ api, cadData, outletRules, normativeRequirements }: Props) {
    const { doc, derived, update } = api;
    const [pickerRoomId, setPickerRoomId] = useState<string | null>(null);
    const [importMessage, setImportMessage] = useState<string | null>(null);

    const roomTypeOptions = outletRules.map((r) => ({ value: r.room_type, label: r.room_type.replace(/_/g, ' ') }));

    const addFloor = () => {
        update((d) => ({
            ...d,
            floors: [...d.floors, { id: newId(), name: `Piso ${d.floors.length + 1}`, level: d.floors.length + 1 }],
        }));
    };

    const addRoom = (floorId: string) => {
        const room: ElectricalRoom = {
            id: newId(),
            floorId,
            name: `Ambiente ${doc.rooms.length + 1}`,
            roomType: roomTypeOptions[0]?.value ?? 'personalizado',
            lengthM: 6,
            widthM: 4,
            heightM: 2.7,
            requiredLux: 300,
            utilizationFactor: 0.6,
            maintenanceFactor: 0.8,
        };
        update((d) => ({ ...d, rooms: [...d.rooms, room] }));
    };

    const updateRoom = (roomId: string, patch: Partial<ElectricalRoom>) => {
        update((d) => ({
            ...d,
            rooms: d.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)),
        }));
    };

    const removeRoom = (roomId: string) => {
        update((d) => ({
            ...d,
            rooms: d.rooms.filter((r) => r.id !== roomId),
            roomLuminaires: d.roomLuminaires.filter((rl) => rl.roomId !== roomId),
            roomOutlets: d.roomOutlets.filter((ro) => ro.roomId !== roomId),
        }));
    };

    const removeFloor = (floorId: string) => {
        const roomIds = new Set(doc.rooms.filter((r) => r.floorId === floorId).map((r) => r.id));
        update((d) => ({
            ...d,
            floors: d.floors.filter((f) => f.id !== floorId),
            rooms: d.rooms.filter((r) => r.floorId !== floorId),
            roomLuminaires: d.roomLuminaires.filter((rl) => !roomIds.has(rl.roomId)),
            roomOutlets: d.roomOutlets.filter((ro) => !roomIds.has(ro.roomId)),
        }));
    };

    const handleImport = () => {
        const { doc: next, imported } = importRoomsFromCad(doc, cadData);
        setImportMessage(
            imported > 0
                ? `${imported} ambiente(s) importados del plano CAD.`
                : 'No hay ambientes nuevos que importar (ya importados o el plano no tiene recintos cerrados).',
        );
        if (imported > 0) {
            update(() => next);
        }
    };

    const applyNormative = (room: ElectricalRoom, row: NormativeRequirementRow) => {
        updateRoom(room.id, {
            requiredLux: row.em_lux ?? room.requiredLux,
            normative: {
                standard: row.standard,
                categoryKey: row.category_key,
                category: row.category,
                areaName: row.area_name,
                emLux: row.em_lux,
                ugrl: row.ugrl,
                uo: row.uo,
                ra: row.ra,
            },
        });
        setPickerRoomId(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <AddButton label="Agregar piso" onClick={addFloor} />
                <button
                    onClick={handleImport}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/5">
                    <DownloadCloud className="h-3.5 w-3.5" />
                    Importar ambientes del plano CAD
                </button>
                {importMessage && <span className="text-xs text-zinc-400">{importMessage}</span>}
            </div>

            {doc.floors.map((floor) => {
                const floorRooms = doc.rooms.filter((r) => r.floorId === floor.id);

                return (
                    <Section
                        key={floor.id}
                        title={floor.name}
                        subtitle={`Nivel ${floor.level} · ${floorRooms.length} ambiente(s)`}
                        actions={
                            <>
                                <AddButton label="Agregar ambiente" onClick={() => addRoom(floor.id)} />
                                <DeleteButton onClick={() => removeFloor(floor.id)} label="Eliminar piso" />
                            </>
                        }>
                        <TableShell
                            minWidth={1050}
                            headers={[
                                'Ambiente',
                                'Tipo (regla tomac.)',
                                'Largo (m)',
                                'Ancho (m)',
                                'Alto (m)',
                                'Área (m²)',
                                'Perím. (m)',
                                'Lux req.',
                                'CU',
                                'FM',
                                'Normativa',
                                '',
                            ]}>
                            {floorRooms.length === 0 && <EmptyRow colSpan={12} message="Sin ambientes en este piso. Agrega uno o importa del plano." />}
                            {floorRooms.map((room) => {
                                const geo = derived.roomGeometry[room.id];
                                return (
                                    <tr key={room.id} className="hover:bg-white/[0.02]">
                                        <td className="px-2 py-1" style={{ minWidth: 140 }}>
                                            <TextCell value={room.name} onChange={(v) => updateRoom(room.id, { name: v })} />
                                            {room.sourceRoomId && <span className="pl-1.5 text-[9px] text-sky-500">del plano</span>}
                                        </td>
                                        <td className="px-2 py-1">
                                            <SelectCell
                                                value={room.roomType}
                                                onChange={(v) => updateRoom(room.id, { roomType: v })}
                                                options={roomTypeOptions}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <NumCell value={room.lengthM} onChange={(v) => updateRoom(room.id, { lengthM: v ?? 0 })} step={0.1} />
                                        </td>
                                        <td className="px-2 py-1">
                                            <NumCell value={room.widthM} onChange={(v) => updateRoom(room.id, { widthM: v ?? 0 })} step={0.1} />
                                        </td>
                                        <td className="px-2 py-1">
                                            <NumCell value={room.heightM} onChange={(v) => updateRoom(room.id, { heightM: v ?? 0 })} step={0.1} width={60} />
                                        </td>
                                        <td className="px-2 py-1 text-right tabular-nums text-zinc-300">{geo ? fmt(geo.areaM2) : '—'}</td>
                                        <td className="px-2 py-1 text-right tabular-nums text-zinc-300">{geo ? fmt(geo.perimeterM) : '—'}</td>
                                        <td className="px-2 py-1">
                                            <NumCell value={room.requiredLux} onChange={(v) => updateRoom(room.id, { requiredLux: v ?? 0 })} step={10} width={64} />
                                        </td>
                                        <td className="px-2 py-1">
                                            <NumCell
                                                value={room.utilizationFactor}
                                                onChange={(v) => updateRoom(room.id, { utilizationFactor: v ?? 0 })}
                                                step={0.05}
                                                width={54}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <NumCell
                                                value={room.maintenanceFactor}
                                                onChange={(v) => updateRoom(room.id, { maintenanceFactor: v ?? 0 })}
                                                step={0.05}
                                                width={54}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <button
                                                onClick={() => setPickerRoomId(room.id)}
                                                className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-1 text-[10px] text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-400"
                                                title={room.normative ? `${room.normative.category} · ${room.normative.areaName}` : 'Asignar normativa EM.010'}>
                                                <BookOpen className="h-3 w-3" />
                                                {room.normative ? (
                                                    <span className="max-w-32 truncate">{room.normative.areaName}</span>
                                                ) : (
                                                    'Asignar'
                                                )}
                                            </button>
                                            {room.normative?.emLux != null && room.requiredLux < room.normative.emLux && (
                                                <span className="pl-1">
                                                    <StatusBadge status="no_cumple" title="El lux requerido es menor al mínimo normativo" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <DeleteButton onClick={() => removeRoom(room.id)} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </TableShell>
                    </Section>
                );
            })}

            {pickerRoomId && (
                <NormativePicker
                    requirements={normativeRequirements}
                    onClose={() => setPickerRoomId(null)}
                    onSelect={(row) => {
                        const room = doc.rooms.find((r) => r.id === pickerRoomId);
                        if (room) {
                            applyNormative(room, row);
                        }
                    }}
                />
            )}
        </div>
    );
}
