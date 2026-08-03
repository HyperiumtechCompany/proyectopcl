/**
 * Pestaña Tomacorrientes: grupos por ambiente con cantidad automática según la
 * regla configurable del tipo de ambiente (RN-03) y tipos por altura (RN-04).
 */

import type { ElectricalDocumentApi } from '../useElectricalDocument';
import { newId } from '../useElectricalDocument';
import type { OutletRule, OutletTypeCatalog, RoomOutletGroup } from '../engine/types';
import { AddButton, DeleteButton, EmptyRow, NumCell, Section, SelectCell, TableShell, TextCell, fmt } from './primitives';

interface Props {
    api: ElectricalDocumentApi;
    outletRules: OutletRule[];
    outletTypes: OutletTypeCatalog[];
}

export default function OutletsTab({ api, outletRules, outletTypes }: Props) {
    const { doc, derived, update } = api;

    const roomOptions = doc.rooms.map((r) => ({ value: r.id, label: r.name }));
    const typeOptions = outletTypes.map((t) => ({ value: t.code, label: t.name }));
    const resultsById = new Map(derived.roomOutlets.map((r) => [r.roomOutletId, r]));

    const addGroup = () => {
        if (doc.rooms.length === 0) {
            return;
        }
        const group: RoomOutletGroup = {
            id: newId(),
            roomId: doc.rooms[0].id,
            outletTypeCode: typeOptions[0]?.value ?? 'bajo',
            manualQty: null,
            extraQty: 0,
        };
        update((d) => ({ ...d, roomOutlets: [...d.roomOutlets, group] }));
    };

    const updateGroup = (id: string, patch: Partial<RoomOutletGroup>) => {
        update((d) => ({
            ...d,
            roomOutlets: d.roomOutlets.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }));
    };

    const removeGroup = (id: string) => {
        update((d) => ({ ...d, roomOutlets: d.roomOutlets.filter((g) => g.id !== id) }));
    };

    return (
        <div className="space-y-4">
            <Section
                title="Tomacorrientes por ambiente"
                subtitle="La cantidad automática sale de la regla del tipo de ambiente (editable en Catálogos). Puedes fijar cantidad manual, sumar puntos extra y elegir el tipo por altura."
                actions={<AddButton label="Agregar grupo" onClick={addGroup} />}>
                <TableShell
                    minWidth={1250}
                    headers={[
                        'Ambiente',
                        'Tipo (altura)',
                        'Regla aplicada',
                        'Cant. auto',
                        'Cant. manual',
                        'Extra',
                        'Total',
                        'Altura (m)',
                        'Muro / zona',
                        'VA por punto',
                        'VA total',
                        'Especial',
                        'Cable',
                        '',
                    ]}>
                    {doc.roomOutlets.length === 0 && <EmptyRow colSpan={14} message="Sin grupos de tomacorrientes. Agrega uno por ambiente y tipo." />}
                    {doc.roomOutlets.map((g) => {
                        const res = resultsById.get(g.id);
                        return (
                            <tr key={g.id} className="hover:bg-white/[0.02]">
                                <td className="px-2 py-1">
                                    <SelectCell value={g.roomId} onChange={(v) => updateGroup(g.id, { roomId: v })} options={roomOptions} />
                                </td>
                                <td className="px-2 py-1">
                                    <SelectCell value={g.outletTypeCode} onChange={(v) => updateGroup(g.id, { outletTypeCode: v })} options={typeOptions} />
                                </td>
                                <td className="px-2 py-1 text-[10px] text-zinc-500 whitespace-nowrap">{res?.ruleApplied ?? '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums text-zinc-400">{res?.autoQty ?? '—'}</td>
                                <td className="px-2 py-1">
                                    <NumCell
                                        value={g.manualQty}
                                        onChange={(v) => updateGroup(g.id, { manualQty: v })}
                                        step={1}
                                        width={64}
                                        placeholder={res ? String(res.autoQty) : 'auto'}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <NumCell value={g.extraQty} onChange={(v) => updateGroup(g.id, { extraQty: v ?? 0 })} step={1} width={52} />
                                </td>
                                <td className="px-2 py-1 text-right font-semibold tabular-nums text-amber-400">{res?.finalQty ?? '—'}</td>
                                <td className="px-2 py-1">
                                    <NumCell
                                        value={g.heightM}
                                        onChange={(v) => updateGroup(g.id, { heightM: v })}
                                        step={0.1}
                                        width={56}
                                        placeholder={res?.heightM != null ? String(res.heightM) : '—'}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <TextCell value={g.wallOrZone ?? ''} onChange={(v) => updateGroup(g.id, { wallOrZone: v })} placeholder="Muro norte…" />
                                </td>
                                <td className="px-2 py-1">
                                    <NumCell value={g.powerVA} onChange={(v) => updateGroup(g.id, { powerVA: v })} step={10} width={64} placeholder="regla" />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.totalPowerVA, 0) : '—'}</td>
                                <td className="px-2 py-1 text-center">
                                    <input
                                        type="checkbox"
                                        checked={g.isSpecial ?? false}
                                        onChange={(e) => updateGroup(g.id, { isSpecial: e.target.checked })}
                                        className="accent-amber-500"
                                    />
                                </td>
                                <td className="px-2 py-1 text-[11px] whitespace-nowrap">
                                    <span className={res?.sectionSource === 'manual' ? 'text-sky-400' : res?.sectionSource === 'auto' ? 'text-emerald-400' : 'text-zinc-500'}>
                                        {res?.conductorLabel ?? '—'}
                                    </span>
                                    <NumCell
                                        value={g.conductorOverrideMm2}
                                        onChange={(v) => updateGroup(g.id, { conductorOverrideMm2: v })}
                                        step={0.5}
                                        width={56}
                                        placeholder="auto"
                                    />
                                </td>
                                <td className="px-2 py-1 text-right">
                                    <DeleteButton onClick={() => removeGroup(g.id)} />
                                </td>
                            </tr>
                        );
                    })}
                </TableShell>
            </Section>

            <Section title="Tipos de tomacorriente disponibles" subtitle="Alturas referenciales del catálogo (editables en la pestaña Catálogos).">
                <TableShell minWidth={640} headers={['Código', 'Nombre', 'Altura', 'Uso', 'IP']}>
                    {outletTypes.map((t) => (
                        <tr key={t.code} className="hover:bg-white/[0.02]">
                            <td className="px-2.5 py-1.5 font-mono text-[11px] text-zinc-400">{t.code}</td>
                            <td className="px-2.5 py-1.5">{t.name}</td>
                            <td className="px-2.5 py-1.5">{t.height_label ?? (t.height_m != null ? `${t.height_m} m` : '—')}</td>
                            <td className="px-2.5 py-1.5 text-zinc-400">{t.use_description ?? '—'}</td>
                            <td className="px-2.5 py-1.5 text-zinc-400">{t.ip_rating ?? '—'}</td>
                        </tr>
                    ))}
                </TableShell>
            </Section>
        </div>
    );
}
