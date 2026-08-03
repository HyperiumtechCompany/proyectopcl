/**
 * Pestaña Metrados: cantidades de materiales derivadas del documento
 * (RN-07: se recalculan automáticamente ante cualquier cambio).
 */

import type { ElectricalDocumentApi } from '../useElectricalDocument';
import { EmptyRow, NumCell, Section, TableShell, fmt } from './primitives';

interface Props {
    api: ElectricalDocumentApi;
}

export default function TakeoffTab({ api }: Props) {
    const { doc, derived, update } = api;
    const { takeoff, totals } = derived;

    const categories = [...new Set(takeoff.map((t) => t.category))];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                    { label: 'Ambientes', value: String(totals.rooms) },
                    { label: 'Luminarias', value: String(totals.luminaires) },
                    { label: 'Tomacorrientes', value: String(totals.outlets) },
                    { label: 'Tableros', value: String(totals.panels) },
                    { label: 'P. instalada', value: `${fmt(totals.installedPowerW / 1000, 2)} kW` },
                    { label: 'Cable total', value: `${fmt(totals.cableTotalM, 1)} m` },
                ].map((card) => (
                    <div key={card.label} className="rounded-xl border border-white/10 bg-[#101218] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">{card.label}</p>
                        <p className="mt-1 text-lg font-bold text-zinc-100 tabular-nums">{card.value}</p>
                    </div>
                ))}
            </div>

            <Section
                title="Metrado de materiales"
                subtitle={`Cable calculado como recorrido × N° conductores × factor de reserva (${fmt(doc.settings.cableReserveFactor, 2)}).`}
                actions={
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                        Factor de reserva
                        <NumCell
                            value={doc.settings.cableReserveFactor}
                            onChange={(v) =>
                                update((d) => ({ ...d, settings: { ...d.settings, cableReserveFactor: v ?? 1.1 } }))
                            }
                            step={0.05}
                            width={60}
                        />
                    </label>
                }>
                <TableShell minWidth={760} headers={['Categoría', 'Descripción', 'Unidad', 'Cantidad', 'Precio unit. (S/)', 'Subtotal (S/)']}>
                    {takeoff.length === 0 && <EmptyRow colSpan={6} message="El metrado se genera automáticamente al registrar luminarias, tomacorrientes, circuitos y tableros." />}
                    {categories.map((cat) => {
                        const items = takeoff.filter((t) => t.category === cat);
                        return [
                            <tr key={`cat-${cat}`} className="bg-white/[0.03]">
                                <td colSpan={6} className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-400">
                                    {cat}
                                </td>
                            </tr>,
                            ...items.map((item, i) => (
                                <tr key={`${cat}-${i}`} className="hover:bg-white/[0.02]">
                                    <td className="px-2.5 py-1.5 text-zinc-500">{cat}</td>
                                    <td className="px-2.5 py-1.5">{item.description}</td>
                                    <td className="px-2.5 py-1.5 text-zinc-400">{item.unit}</td>
                                    <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{fmt(item.quantity, 2)}</td>
                                    <td className="px-2.5 py-1.5 text-right tabular-nums">{item.unitPrice != null ? fmt(item.unitPrice, 2) : '—'}</td>
                                    <td className="px-2.5 py-1.5 text-right tabular-nums">{item.subtotal != null ? fmt(item.subtotal, 2) : '—'}</td>
                                </tr>
                            )),
                        ];
                    })}
                    {takeoff.length > 0 && (
                        <tr className="border-t border-white/20 bg-white/[0.04] font-bold">
                            <td colSpan={5} className="px-2.5 py-2 text-right text-zinc-200">
                                Total presupuesto referencial
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums text-amber-400">
                                {totals.takeoffTotal != null ? `S/ ${fmt(totals.takeoffTotal, 2)}` : 'Sin precios registrados'}
                            </td>
                        </tr>
                    )}
                </TableShell>
            </Section>
        </div>
    );
}
