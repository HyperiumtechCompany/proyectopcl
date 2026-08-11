/**
 * Pestaña Circuitos: circuitos de alumbrado y tomacorrientes con corriente,
 * conductor sugerido (ampacidad + caída de tensión), protección y estado.
 */

import { useState } from 'react';
import type { ElectricalDocumentApi } from '../useElectricalDocument';
import { newId } from '../useElectricalDocument';
import type { Circuit, CircuitType } from '../engine/types';
import { AddButton, DeleteButton, EmptyRow, NumCell, Section, SelectCell, StatusBadge, TableShell, TextCell, fmt } from './primitives';

interface Props {
    api: ElectricalDocumentApi;
}

const CIRCUIT_TYPE_OPTIONS: { value: CircuitType; label: string }[] = [
    { value: 'lighting', label: 'Alumbrado' },
    { value: 'outlets', label: 'Tomacorrientes' },
    { value: 'special', label: 'Especial' },
];

export default function CircuitsTab({ api }: Props) {
    const { doc, derived, update, materializeOutlets } = api;
    const [materializeStatus, setMaterializeStatus] = useState<
        Record<string, { pending: boolean; ok?: boolean; message?: string }>
    >({});

    const panelOptions = doc.panels.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
    const resultsById = new Map(derived.circuits.map((c) => [c.circuitId, c]));

    const circuitOptions = (type: CircuitType) => [
        { value: '', label: '— sin circuito —' },
        ...doc.circuits.filter((c) => c.type === type || c.type === 'special').map((c) => ({ value: c.id, label: c.code })),
    ];

    const addCircuit = (type: CircuitType) => {
        if (doc.panels.length === 0) {
            return;
        }
        const prefix = type === 'lighting' ? 'C' : type === 'outlets' ? 'CT' : 'CE';
        const count = doc.circuits.filter((c) => c.type === type).length + 1;
        const circuit: Circuit = {
            id: newId(),
            panelId: doc.panels[0].id,
            code: `${prefix}-${count}`,
            type,
            lengthM: 20,
        };
        update((d) => ({ ...d, circuits: [...d.circuits, circuit] }));
    };

    const updateCircuit = (id: string, patch: Partial<Circuit>) => {
        update((d) => ({
            ...d,
            circuits: d.circuits.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
    };

    const removeCircuit = (id: string) => {
        update((d) => ({
            ...d,
            circuits: d.circuits.filter((c) => c.id !== id),
            roomLuminaires: d.roomLuminaires.map((rl) => (rl.circuitId === id ? { ...rl, circuitId: null } : rl)),
            roomOutlets: d.roomOutlets.map((ro) => (ro.circuitId === id ? { ...ro, circuitId: null } : ro)),
        }));
    };

    const roomName = (roomId: string) => doc.rooms.find((r) => r.id === roomId)?.name ?? '¿?';
    const typeName = (typeId: string) => doc.luminaireTypes.find((t) => t.id === typeId)?.code ?? '¿?';

    /**
     * Puente TD/TG (Fase D): dibuja en el plano CAD los tomacorrientes que
     * este grupo ya tiene calculados, vía el endpoint backend (esta página y
     * el editor de plano no comparten estado en vivo). Requiere que el
     * ambiente venga del plano (`sourceRoomId`, importado desde "Ambientes")
     * y que el grupo ya esté asignado a un circuito.
     */
    const handleMaterialize = async (roomOutletId: string) => {
        const ro = doc.roomOutlets.find((x) => x.id === roomOutletId);
        const res = derived.roomOutlets.find((r) => r.roomOutletId === roomOutletId);
        const room = ro ? doc.rooms.find((r) => r.id === ro.roomId) : undefined;
        if (!ro || !ro.circuitId || !room?.sourceRoomId || !res || res.finalQty <= 0) return;

        const circuit = doc.circuits.find((c) => c.id === ro.circuitId);

        setMaterializeStatus((prev) => ({ ...prev, [roomOutletId]: { pending: true } }));
        const result = await materializeOutlets({
            circuitId: ro.circuitId,
            sourceRoomId: room.sourceRoomId,
            quantity: res.finalQty,
            outletTypeCode: ro.outletTypeCode,
            panelId: circuit?.panelId ?? null,
        });
        setMaterializeStatus((prev) => ({
            ...prev,
            [roomOutletId]: { pending: false, ok: result.ok, message: result.message },
        }));
    };

    return (
        <div className="space-y-4">
            {doc.panels.length === 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Primero crea al menos un tablero en la pestaña «Tableros» para poder registrar circuitos.
                </p>
            )}

            <Section
                title="Circuitos"
                subtitle="Alumbrado parte de 2.5 mm² y tomacorrientes de 4 mm² (RN-05); la sección sube automáticamente si la corriente o la caída de tensión lo exigen."
                actions={
                    <>
                        <AddButton label="Circuito alumbrado" onClick={() => addCircuit('lighting')} />
                        <AddButton label="Circuito tomacorrientes" onClick={() => addCircuit('outlets')} />
                        <AddButton label="Circuito especial" onClick={() => addCircuit('special')} />
                    </>
                }>
                <TableShell
                    minWidth={1250}
                    headers={[
                        'Código',
                        'Tipo',
                        'Tablero',
                        'Long. (m)',
                        'Cargas',
                        'Potencia (W)',
                        'F.D.',
                        'Corriente (A)',
                        'I diseño (A)',
                        'Conductor',
                        'Secc. manual',
                        'ITM (A)',
                        'ΔV %',
                        'ΔV acum. %',
                        'Estado',
                        '',
                    ]}>
                    {doc.circuits.length === 0 && <EmptyRow colSpan={16} message="Sin circuitos. Crea circuitos y asigna cargas más abajo." />}
                    {doc.circuits.map((c) => {
                        const res = resultsById.get(c.id);
                        return (
                            <tr key={c.id} className="hover:bg-white/[0.02]">
                                <td className="px-2 py-1" style={{ minWidth: 76 }}>
                                    <TextCell value={c.code} onChange={(v) => updateCircuit(c.id, { code: v })} />
                                </td>
                                <td className="px-2 py-1">
                                    <SelectCell
                                        value={c.type}
                                        onChange={(v) => updateCircuit(c.id, { type: v as CircuitType })}
                                        options={CIRCUIT_TYPE_OPTIONS}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <SelectCell value={c.panelId} onChange={(v) => updateCircuit(c.id, { panelId: v })} options={panelOptions} />
                                </td>
                                <td className="px-2 py-1">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1">
                                            <NumCell value={c.manualLengthM ?? res?.lengthM ?? c.lengthM} onChange={(v) => updateCircuit(c.id, { manualLengthM: v })} step={1} width={60} />
                                            {c.manualLengthM != null && <span className="text-[10px] text-amber-500" title="Sobrescrito manualmente">M</span>}
                                        </div>
                                        {res && (
                                            <div className="text-[9px] text-zinc-500 whitespace-nowrap" title="H: Horizontal, V: Subida y bajada">
                                                H: {res.calculatedHorizontalLengthM.toFixed(1)}m · V: {res.calculatedVerticalLengthM.toFixed(1)}m
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-2 py-1 text-center text-[10px] text-zinc-400 whitespace-nowrap">
                                    {res ? `${res.connectedLuminaires} lum · ${res.connectedOutlets} tom` : '—'}
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.totalPowerW, 0) : '—'}</td>
                                <td className="px-2 py-1">
                                    <NumCell
                                        value={c.demandFactorOverride}
                                        onChange={(v) => updateCircuit(c.id, { demandFactorOverride: v })}
                                        step={0.05}
                                        width={52}
                                        placeholder={res ? fmt(res.demandFactor, 2) : ''}
                                    />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.currentA, 2) : '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums text-zinc-400">{res ? fmt(res.designCurrentA, 2) : '—'}</td>
                                <td className="px-2 py-1 text-[11px] whitespace-nowrap">
                                    {res ? (
                                        <span className={res.sectionSource === 'manual' ? 'text-sky-400' : 'text-emerald-400'}>{res.conductorLabel}</span>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="px-2 py-1">
                                    <NumCell
                                        value={c.manualSectionMm2}
                                        onChange={(v) => updateCircuit(c.id, { manualSectionMm2: v })}
                                        step={0.5}
                                        width={60}
                                        placeholder="auto"
                                    />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                    {res ? `${res.breakerA}${res.breakerSource === 'manual' ? '*' : ''}` : '—'}
                                    <NumCell
                                        value={c.manualBreakerA}
                                        onChange={(v) => updateCircuit(c.id, { manualBreakerA: v })}
                                        step={1}
                                        width={52}
                                        placeholder="auto"
                                    />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                    {res ? (
                                        <span className={res.voltageDropPct > res.maxVoltageDropPct ? 'text-rose-400' : 'text-zinc-200'}>
                                            {fmt(res.voltageDropPct, 2)}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                    {res ? (
                                        <span
                                            className={
                                                doc.settings.maxTotalVoltageDropPct != null && res.cumulativeVoltageDropPct > doc.settings.maxTotalVoltageDropPct
                                                    ? 'text-rose-400'
                                                    : 'text-zinc-400'
                                            }
                                            title="Caída de tensión acumulada desde el tablero raíz (TG→TP→TD→circuito), no solo este tramo.">
                                            {fmt(res.cumulativeVoltageDropPct, 2)}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="px-2 py-1">{res && <StatusBadge status={res.status} title={res.warnings.join(' • ') || undefined} />}</td>
                                <td className="px-2 py-1 text-right">
                                    <DeleteButton onClick={() => removeCircuit(c.id)} />
                                </td>
                            </tr>
                        );
                    })}
                </TableShell>
            </Section>

            <Section
                title="Asignación de cargas a circuitos"
                subtitle="Conecta cada grupo de luminarias y tomacorrientes a su circuito. Alumbrado y tomacorrientes usan circuitos independientes.">
                <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                        <h3 className="mb-2 text-xs font-semibold text-zinc-300">Luminarias</h3>
                        <TableShell minWidth={380} headers={['Ambiente', 'Luminaria', 'Cant.', 'Circuito']}>
                            {doc.roomLuminaires.length === 0 && <EmptyRow colSpan={4} message="Sin luminarias asignadas." />}
                            {doc.roomLuminaires.map((rl) => {
                                const res = derived.roomLuminaires.find((r) => r.roomLuminaireId === rl.id);
                                return (
                                    <tr key={rl.id} className="hover:bg-white/[0.02]">
                                        <td className="px-2.5 py-1.5">{roomName(rl.roomId)}</td>
                                        <td className="px-2.5 py-1.5 text-zinc-400">{typeName(rl.luminaireTypeId)}</td>
                                        <td className="px-2.5 py-1.5 text-right tabular-nums">{res?.selectedQty ?? '—'}</td>
                                        <td className="px-2.5 py-1.5">
                                            <SelectCell
                                                value={rl.circuitId ?? ''}
                                                onChange={(v) =>
                                                    update((d) => ({
                                                        ...d,
                                                        roomLuminaires: d.roomLuminaires.map((x) =>
                                                            x.id === rl.id ? { ...x, circuitId: v || null } : x,
                                                        ),
                                                    }))
                                                }
                                                options={circuitOptions('lighting')}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </TableShell>
                    </div>
                    <div>
                        <h3 className="mb-2 text-xs font-semibold text-zinc-300">Tomacorrientes</h3>
                        <TableShell minWidth={460} headers={['Ambiente', 'Tipo', 'Cant.', 'Circuito', 'Plano']}>
                            {doc.roomOutlets.length === 0 && <EmptyRow colSpan={5} message="Sin grupos de tomacorrientes." />}
                            {doc.roomOutlets.map((ro) => {
                                const res = derived.roomOutlets.find((r) => r.roomOutletId === ro.id);
                                const room = doc.rooms.find((r) => r.id === ro.roomId);
                                const status = materializeStatus[ro.id];
                                const canMaterialize = Boolean(ro.circuitId) && Boolean(room?.sourceRoomId) && (res?.finalQty ?? 0) > 0;
                                return (
                                    <tr key={ro.id} className="hover:bg-white/[0.02]">
                                        <td className="px-2.5 py-1.5">{roomName(ro.roomId)}</td>
                                        <td className="px-2.5 py-1.5 text-zinc-400">{ro.outletTypeCode}</td>
                                        <td className="px-2.5 py-1.5 text-right tabular-nums">{res?.finalQty ?? '—'}</td>
                                        <td className="px-2.5 py-1.5">
                                            <SelectCell
                                                value={ro.circuitId ?? ''}
                                                onChange={(v) =>
                                                    update((d) => ({
                                                        ...d,
                                                        roomOutlets: d.roomOutlets.map((x) => (x.id === ro.id ? { ...x, circuitId: v || null } : x)),
                                                    }))
                                                }
                                                options={circuitOptions('outlets')}
                                            />
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            <button
                                                type="button"
                                                disabled={!canMaterialize || status?.pending}
                                                onClick={() => void handleMaterialize(ro.id)}
                                                title={
                                                    !room?.sourceRoomId
                                                        ? 'El ambiente debe venir del plano CAD (pestaña Ambientes → Importar)'
                                                        : !ro.circuitId
                                                          ? 'Asigna primero un circuito'
                                                          : 'Genera los tomacorrientes en el plano CAD'
                                                }
                                                className="w-full rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {status?.pending ? 'Generando…' : 'Generar en el plano'}
                                            </button>
                                            {status && !status.pending && (
                                                <p className={`mt-1 text-[10px] ${status.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {status.message}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </TableShell>
                    </div>
                </div>
            </Section>
        </div>
    );
}
