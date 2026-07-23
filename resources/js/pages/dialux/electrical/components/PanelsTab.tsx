/**
 * Pestaña Tableros y Alimentadores: jerarquía de tableros por piso (árbol),
 * consolidación de cargas y alimentadores entre tableros (RN-06).
 */

import { Network, WandSparkles } from 'lucide-react';
import type { ElectricalDocumentApi } from '../useElectricalDocument';
import { newId } from '../useElectricalDocument';
import type { Feeder, Panel, PanelResult } from '../engine/types';
import { ensureFloorPanelHierarchy } from '../engine/panelHierarchy';
import { AddButton, DeleteButton, EmptyRow, NumCell, Section, SelectCell, StatusBadge, TableShell, TextCell, fmt } from './primitives';

interface Props {
    api: ElectricalDocumentApi;
}

export default function PanelsTab({ api }: Props) {
    const { doc, derived, update } = api;

    const resultsById = new Map(derived.panels.map((p) => [p.panelId, p]));
    const feederResults = new Map(derived.feeders.map((f) => [f.feederId, f]));

    const floorOptions = [{ value: '', label: '— sin piso —' }, ...doc.floors.map((f) => ({ value: f.id, label: f.name }))];
    const parentOptions = (selfId: string) => [
        { value: '', label: '— raíz (tablero general) —' },
        ...doc.panels.filter((p) => p.id !== selfId).map((p) => ({ value: p.id, label: p.code })),
    ];
    const panelOptions = doc.panels.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));

    const addPanel = () => {
        const isFirst = doc.panels.length === 0;
        const panel: Panel = {
            id: newId(),
            floorId: doc.floors[0]?.id ?? null,
            parentPanelId: isFirst ? null : doc.panels[0].id,
            code: isFirst ? 'TG-01' : `TP-0${doc.panels.length}`,
            name: isFirst ? 'Tablero General' : `Tablero Piso ${doc.panels.length}`,
            reservePct: 25,
        };
        update((d) => ({ ...d, panels: [...d.panels, panel] }));
    };

    const updatePanel = (id: string, patch: Partial<Panel>) => {
        update((d) => ({ ...d, panels: d.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    };

    const removePanel = (id: string) => {
        update((d) => ({
            ...d,
            panels: d.panels
                .filter((p) => p.id !== id)
                .map((p) => (p.parentPanelId === id ? { ...p, parentPanelId: null } : p)),
            circuits: d.circuits.filter((c) => c.panelId !== id),
            feeders: d.feeders.filter((f) => f.fromPanelId !== id && f.toPanelId !== id),
        }));
    };

    const addFeeder = () => {
        if (doc.panels.length < 2) {
            return;
        }
        const feeder: Feeder = {
            id: newId(),
            fromPanelId: doc.panels[0].id,
            toPanelId: doc.panels[1].id,
            lengthM: 15,
        };
        update((d) => ({ ...d, feeders: [...d.feeders, feeder] }));
    };

    const updateFeeder = (id: string, patch: Partial<Feeder>) => {
        update((d) => ({ ...d, feeders: d.feeders.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
    };

    const removeFeeder = (id: string) => {
        update((d) => ({ ...d, feeders: d.feeders.filter((f) => f.id !== id) }));
    };

    const generateFloorHierarchy = () => {
        update((document) => ensureFloorPanelHierarchy(document, newId));
    };

    // Árbol de tableros para la vista jerárquica.
    const renderTree = (parentId: string | null, depth: number): React.ReactNode[] => {
        if (depth > 10) {
            return [];
        }
        return doc.panels
            .filter((p) => (p.parentPanelId ?? null) === parentId)
            .flatMap((p) => {
                const res = resultsById.get(p.id);
                return [
                    <div key={p.id} className="flex items-center gap-2 py-1 text-xs" style={{ paddingLeft: depth * 20 }}>
                        <span className="text-zinc-600">{depth > 0 ? '├──' : '●'}</span>
                        <span className="font-semibold text-zinc-100">{p.code}</span>
                        <span className="text-zinc-400">{p.name}</span>
                        {res && (
                            <span className="text-[10px] text-zinc-500">
                                {res.circuitCount} circ. · {fmt(res.installedPowerW / 1000, 2)} kW inst. · {fmt(res.demandPowerW / 1000, 2)} kW dem. ·{' '}
                                {fmt(res.currentA, 1)} A · ITM {res.mainBreakerA} A
                            </span>
                        )}
                        {res && res.warnings.length > 0 && <StatusBadge status="advertencia" title={res.warnings.join(' • ')} />}
                    </div>,
                    ...renderTree(p.id, depth + 1),
                ];
            });
    };

    return (
        <div className="space-y-4">
            <Section
                title="Tableros eléctricos"
                subtitle="Un tablero puede alimentar circuitos propios y otros tableros. El primero sin origen es el Tablero General."
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={generateFloorHierarchy}
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20"
                        >
                            <WandSparkles className="h-3.5 w-3.5" />
                            Generar por pisos
                        </button>
                        <AddButton label="Agregar tablero" onClick={addPanel} />
                    </div>
                }>
                <TableShell
                    minWidth={1150}
                    headers={[
                        'Código',
                        'Nombre',
                        'Piso',
                        'Alimentado por',
                        'Circuitos',
                        'P. instalada (kW)',
                        'P. demandada (kW)',
                        'Corriente (A)',
                        'Reserva %',
                        'ITM principal (A)',
                        'Ubicación',
                        '',
                    ]}>
                    {doc.panels.length === 0 && <EmptyRow colSpan={12} message="Sin tableros. Crea el Tablero General y luego los tableros por piso." />}
                    {doc.panels.map((p) => {
                        const res: PanelResult | undefined = resultsById.get(p.id);
                        return (
                            <tr key={p.id} className="hover:bg-white/[0.02]">
                                <td className="px-2 py-1" style={{ minWidth: 76 }}>
                                    <TextCell value={p.code} onChange={(v) => updatePanel(p.id, { code: v })} />
                                </td>
                                <td className="px-2 py-1" style={{ minWidth: 130 }}>
                                    <TextCell value={p.name} onChange={(v) => updatePanel(p.id, { name: v })} />
                                </td>
                                <td className="px-2 py-1">
                                    <SelectCell value={p.floorId ?? ''} onChange={(v) => updatePanel(p.id, { floorId: v || null })} options={floorOptions} />
                                </td>
                                <td className="px-2 py-1">
                                    <SelectCell
                                        value={p.parentPanelId ?? ''}
                                        onChange={(v) => updatePanel(p.id, { parentPanelId: v || null })}
                                        options={parentOptions(p.id)}
                                    />
                                </td>
                                <td className="px-2 py-1 text-center tabular-nums">{res?.circuitCount ?? 0}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.installedPowerW / 1000, 2) : '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.demandPowerW / 1000, 2) : '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.currentA, 1) : '—'}</td>
                                <td className="px-2 py-1">
                                    <NumCell value={p.reservePct} onChange={(v) => updatePanel(p.id, { reservePct: v ?? 0 })} step={5} width={52} />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                    {res?.mainBreakerA ?? '—'}
                                    <NumCell
                                        value={p.manualMainBreakerA}
                                        onChange={(v) => updatePanel(p.id, { manualMainBreakerA: v })}
                                        step={1}
                                        width={52}
                                        placeholder="auto"
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <TextCell value={p.location ?? ''} onChange={(v) => updatePanel(p.id, { location: v })} placeholder="Hall piso 1…" />
                                </td>
                                <td className="px-2 py-1 text-right">
                                    <DeleteButton onClick={() => removePanel(p.id)} />
                                </td>
                            </tr>
                        );
                    })}
                </TableShell>
            </Section>

            {doc.panels.length > 0 && (
                <Section title="Jerarquía de tableros" subtitle="Estructura tipo árbol con cargas consolidadas (los tableros hijos suman al padre).">
                    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                        <Network className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1 overflow-x-auto font-mono">{renderTree(null, 0)}</div>
                    </div>
                </Section>
            )}

            <Section
                title="Alimentadores"
                subtitle="Conductores entre tableros. La sección parte de 6 mm² y se dimensiona por corriente y caída de tensión del tablero destino."
                actions={<AddButton label="Agregar alimentador" onClick={addFeeder} />}>
                <TableShell
                    minWidth={1000}
                    headers={[
                        'Desde',
                        'Hacia',
                        'Long. (m)',
                        'P. demandada (kW)',
                        'Corriente (A)',
                        'I diseño (A)',
                        'Conductor',
                        'Secc. manual',
                        'ITM (A)',
                        'ΔV %',
                        'Estado',
                        '',
                    ]}>
                    {doc.feeders.length === 0 && (
                        <EmptyRow colSpan={12} message={doc.panels.length < 2 ? 'Necesitas al menos dos tableros para crear un alimentador.' : 'Sin alimentadores registrados.'} />
                    )}
                    {doc.feeders.map((f) => {
                        const res = feederResults.get(f.id);
                        return (
                            <tr key={f.id} className="hover:bg-white/[0.02]">
                                <td className="px-2 py-1">
                                    <SelectCell value={f.fromPanelId} onChange={(v) => updateFeeder(f.id, { fromPanelId: v })} options={panelOptions} />
                                </td>
                                <td className="px-2 py-1">
                                    <SelectCell value={f.toPanelId} onChange={(v) => updateFeeder(f.id, { toPanelId: v })} options={panelOptions} />
                                </td>
                                <td className="px-2 py-1">
                                    <NumCell value={f.lengthM} onChange={(v) => updateFeeder(f.id, { lengthM: v ?? 0 })} step={1} width={60} />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.demandPowerW / 1000, 2) : '—'}</td>
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
                                        value={f.manualSectionMm2}
                                        onChange={(v) => updateFeeder(f.id, { manualSectionMm2: v })}
                                        step={0.5}
                                        width={60}
                                        placeholder="auto"
                                    />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{res?.breakerA ?? '—'}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{res ? fmt(res.voltageDropPct, 2) : '—'}</td>
                                <td className="px-2 py-1">{res && <StatusBadge status={res.status} title={res.warnings.join(' • ') || undefined} />}</td>
                                <td className="px-2 py-1 text-right">
                                    <DeleteButton onClick={() => removeFeeder(f.id)} />
                                </td>
                            </tr>
                        );
                    })}
                </TableShell>
            </Section>
        </div>
    );
}
