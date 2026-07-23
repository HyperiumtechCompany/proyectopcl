/**
 * Pestaña Luminarias: catálogo de tipos del proyecto + asignación por ambiente
 * con cantidad calculada/manual, lux estimado y semáforo de cumplimiento.
 */

import { useMemo, useState } from 'react';
import type { ElectricalDocumentApi } from '../useElectricalDocument';
import { newId } from '../useElectricalDocument';
import type { LuminaireType, RoomLuminaire } from '../engine/types';
import { AddButton, DeleteButton, EmptyRow, NumCell, Section, SelectCell, StatusBadge, TableShell, TextCell, fmt } from './primitives';

interface Props {
    api: ElectricalDocumentApi;
}

export default function LuminairesTab({ api }: Props) {
    const { doc, derived, update } = api;
    const [compareRoomId, setCompareRoomId] = useState<string>('');

    const resultsByAssignment = useMemo(() => {
        const map = new Map(derived.roomLuminaires.map((r) => [r.roomLuminaireId, r]));
        return map;
    }, [derived.roomLuminaires]);

    const roomOptions = doc.rooms.map((r) => ({ value: r.id, label: r.name }));
    const typeOptions = doc.luminaireTypes.map((t) => ({ value: t.id, label: `${t.code} (${t.powerW} W / ${t.lumens} lm)` }));

    const addType = () => {
        const type: LuminaireType = {
            id: newId(),
            code: `LUM-${doc.luminaireTypes.length + 1}`,
            brand: '',
            model: '',
            powerW: 36,
            lumens: 3600,
            colorTempK: 4000,
            cri: 80,
            mountingHeightM: 2.7,
        };
        update((d) => ({ ...d, luminaireTypes: [...d.luminaireTypes, type] }));
    };

    const updateType = (id: string, patch: Partial<LuminaireType>) => {
        update((d) => ({
            ...d,
            luminaireTypes: d.luminaireTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
    };

    const removeType = (id: string) => {
        update((d) => ({
            ...d,
            luminaireTypes: d.luminaireTypes.filter((t) => t.id !== id),
            roomLuminaires: d.roomLuminaires.filter((rl) => rl.luminaireTypeId !== id),
        }));
    };

    const addAssignment = () => {
        if (doc.rooms.length === 0 || doc.luminaireTypes.length === 0) {
            return;
        }
        const assignment: RoomLuminaire = {
            id: newId(),
            roomId: doc.rooms[0].id,
            luminaireTypeId: doc.luminaireTypes[0].id,
            manualQty: null,
        };
        update((d) => ({ ...d, roomLuminaires: [...d.roomLuminaires, assignment] }));
    };

    const updateAssignment = (id: string, patch: Partial<RoomLuminaire>) => {
        update((d) => ({
            ...d,
            roomLuminaires: d.roomLuminaires.map((rl) => (rl.id === id ? { ...rl, ...patch } : rl)),
        }));
    };

    const removeAssignment = (id: string) => {
        update((d) => ({ ...d, roomLuminaires: d.roomLuminaires.filter((rl) => rl.id !== id) }));
    };

    // Comparador de alternativas: resultados de todas las luminarias del catálogo
    // aplicadas al ambiente seleccionado (Fase 2, Caso B del plan).
    const comparison = useMemo(() => {
        if (!compareRoomId) {
            return [];
        }
        const room = doc.rooms.find((r) => r.id === compareRoomId);
        const geo = derived.roomGeometry[compareRoomId];
        if (!room || !geo || geo.areaM2 <= 0) {
            return [];
        }
        return doc.luminaireTypes.map((t) => {
            const denom = t.lumens * room.utilizationFactor * room.maintenanceFactor;
            const minQty = denom > 0 ? Math.ceil((room.requiredLux * geo.areaM2) / denom) : 0;
            const estLux = geo.areaM2 > 0 ? (minQty * denom) / geo.areaM2 : 0;
            return { type: t, minQty, estLux, totalPowerW: minQty * t.powerW };
        });
    }, [compareRoomId, doc.rooms, doc.luminaireTypes, derived.roomGeometry]);

    return (
        <div className="space-y-4">
            <Section
                title="Catálogo de luminarias del proyecto"
                subtitle="Registra los tipos disponibles: potencia, flujo luminoso y datos técnicos."
                actions={<AddButton label="Agregar luminaria" onClick={addType} />}>
                <TableShell
                    minWidth={1000}
                    headers={['Código', 'Marca', 'Modelo', 'Potencia (W)', 'Flujo (lm)', 'T. color (K)', 'IRC', 'Montaje (m)', 'IP', 'Precio (S/)', '']}>
                    {doc.luminaireTypes.length === 0 && <EmptyRow colSpan={11} message="Registra al menos una luminaria para poder asignarla a los ambientes." />}
                    {doc.luminaireTypes.map((t) => (
                        <tr key={t.id} className="hover:bg-white/[0.02]">
                            <td className="px-2 py-1" style={{ minWidth: 90 }}>
                                <TextCell value={t.code} onChange={(v) => updateType(t.id, { code: v })} />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={t.brand ?? ''} onChange={(v) => updateType(t.id, { brand: v })} placeholder="Marca" />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={t.model ?? ''} onChange={(v) => updateType(t.id, { model: v })} placeholder="Modelo" />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={t.powerW} onChange={(v) => updateType(t.id, { powerW: v ?? 0 })} step={1} width={64} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={t.lumens} onChange={(v) => updateType(t.id, { lumens: v ?? 0 })} step={100} width={72} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={t.colorTempK} onChange={(v) => updateType(t.id, { colorTempK: v })} step={100} width={64} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={t.cri} onChange={(v) => updateType(t.id, { cri: v })} step={1} width={48} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={t.mountingHeightM} onChange={(v) => updateType(t.id, { mountingHeightM: v })} step={0.1} width={56} />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={t.ipRating ?? ''} onChange={(v) => updateType(t.id, { ipRating: v })} placeholder="IP20" width={52} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={t.unitPrice} onChange={(v) => updateType(t.id, { unitPrice: v })} step={1} width={70} />
                            </td>
                            <td className="px-2 py-1 text-right">
                                <DeleteButton onClick={() => removeType(t.id)} />
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </Section>

            <Section
                title="Asignación por ambiente"
                subtitle="N mínimo = ⌈E·A / (F·CU·FM)⌉. Cambia la cantidad y el lux estimado se recalcula al instante."
                actions={<AddButton label="Asignar luminaria" onClick={addAssignment} />}>
                <TableShell
                    minWidth={1250}
                    headers={[
                        'Ambiente',
                        'Luminaria',
                        'Cant. mínima',
                        'Cant. seleccionada',
                        'Filas',
                        'Columnas',
                        'Lux estimado',
                        'Lux req.',
                        '% cumplim.',
                        'Potencia (W)',
                        'Estado',
                        'Lux DIALux',
                        'Cable',
                        '',
                    ]}>
                    {doc.roomLuminaires.length === 0 && (
                        <EmptyRow colSpan={14} message="Sin asignaciones. Necesitas al menos un ambiente y una luminaria en el catálogo." />
                    )}
                    {doc.roomLuminaires.map((rl) => {
                        const res = resultsByAssignment.get(rl.id);
                        return (
                            <tr key={rl.id} className="hover:bg-white/[0.02]">
                                <td className="px-2 py-1">
                                    <SelectCell value={rl.roomId} onChange={(v) => updateAssignment(rl.id, { roomId: v })} options={roomOptions} />
                                </td>
                                <td className="px-2 py-1">
                                    <SelectCell
                                        value={rl.luminaireTypeId}
                                        onChange={(v) => updateAssignment(rl.id, { luminaireTypeId: v })}
                                        options={typeOptions}
                                    />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums text-zinc-400">{res?.minQty ?? '—'}</td>
                                <td className="px-2 py-1">
                                    <NumCell
                                        value={rl.manualQty}
                                        onChange={(v) => updateAssignment(rl.id, { manualQty: v })}
                                        step={1}
                                        width={70}
                                        placeholder={res ? String(res.minQty) : 'auto'}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <NumCell value={rl.rows} onChange={(v) => updateAssignment(rl.id, { rows: v })} step={1} width={50}
                                        placeholder={res ? String(res.suggestedRows) : ''} />
                                </td>
                                <td className="px-2 py-1">
                                    <NumCell value={rl.cols} onChange={(v) => updateAssignment(rl.id, { cols: v })} step={1} width={50}
                                        placeholder={res ? String(res.suggestedCols) : ''} />
                                </td>
                                <td className="px-2 py-1 text-right font-semibold tabular-nums text-amber-400">{res ? fmt(res.estimatedLux, 1) : '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums text-zinc-400">{res ? fmt(res.requiredLux, 0) : '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? `${fmt(res.compliancePct, 1)}%` : '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.totalPowerW, 0) : '—'}</td>
                                <td className="px-2 py-1">
                                    {res && <StatusBadge status={res.status} title={res.warnings.join(' • ') || undefined} />}
                                </td>
                                <td className="px-2 py-1">
                                    <NumCell
                                        value={rl.dialuxVerifiedLux}
                                        onChange={(v) => updateAssignment(rl.id, { dialuxVerifiedLux: v })}
                                        step={1}
                                        width={70}
                                        placeholder="—"
                                    />
                                    {rl.dialuxVerifiedLux != null && res && res.estimatedLux > 0 && (
                                        <span className="block pl-1 text-[9px] text-zinc-500">
                                            Δ {fmt(((rl.dialuxVerifiedLux - res.estimatedLux) / res.estimatedLux) * 100, 1)}%
                                        </span>
                                    )}
                                </td>
                                <td className="px-2 py-1 text-[11px] whitespace-nowrap">
                                    <span className={res?.sectionSource === 'manual' ? 'text-sky-400' : res?.sectionSource === 'auto' ? 'text-emerald-400' : 'text-zinc-500'}>
                                        {res?.conductorLabel ?? '—'}
                                    </span>
                                    <NumCell
                                        value={rl.conductorOverrideMm2}
                                        onChange={(v) => updateAssignment(rl.id, { conductorOverrideMm2: v })}
                                        step={0.5}
                                        width={56}
                                        placeholder="auto"
                                    />
                                </td>
                                <td className="px-2 py-1 text-right">
                                    <DeleteButton onClick={() => removeAssignment(rl.id)} />
                                </td>
                            </tr>
                        );
                    })}
                </TableShell>
            </Section>

            <Section
                title="Comparador de alternativas"
                subtitle="Compara cuántas unidades de cada luminaria del catálogo necesita un ambiente (p.ej. 4 grandes vs 8 medianas vs 12 pequeñas).">
                <div className="mb-3">
                    <select
                        value={compareRoomId}
                        onChange={(e) => setCompareRoomId(e.target.value)}
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none [&>option]:bg-[#15171f]">
                        <option value="">Selecciona un ambiente…</option>
                        {roomOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                {comparison.length > 0 && (
                    <TableShell minWidth={640} headers={['Luminaria', 'Potencia (W)', 'Flujo (lm)', 'Cantidad necesaria', 'Lux resultante', 'Potencia total (W)']}>
                        {comparison.map(({ type, minQty, estLux, totalPowerW }) => (
                            <tr key={type.id} className="hover:bg-white/[0.02]">
                                <td className="px-2.5 py-1.5">{type.code} {type.brand ? `· ${type.brand}` : ''}</td>
                                <td className="px-2.5 py-1.5 text-right tabular-nums">{fmt(type.powerW, 0)}</td>
                                <td className="px-2.5 py-1.5 text-right tabular-nums">{fmt(type.lumens, 0)}</td>
                                <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-amber-400">{minQty}</td>
                                <td className="px-2.5 py-1.5 text-right tabular-nums">{fmt(estLux, 1)}</td>
                                <td className="px-2.5 py-1.5 text-right tabular-nums">{fmt(totalPowerW, 0)}</td>
                            </tr>
                        ))}
                    </TableShell>
                )}
            </Section>
        </div>
    );
}
