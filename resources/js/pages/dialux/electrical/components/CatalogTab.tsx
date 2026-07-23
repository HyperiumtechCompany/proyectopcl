/**
 * Pestaña Catálogos: reglas de tomacorrientes (RN-03), tipos por altura (RN-04),
 * conductores y parámetros por circuito (RN-05). Los valores del sistema se
 * pueden sobreescribir por usuario; el override se guarda en BD.
 */

import { Save } from 'lucide-react';
import { useState } from 'react';
import type { CircuitDefaults, ConductorCatalog, ElectricalCatalogs, OutletRule, OutletTypeCatalog } from '../engine/types';
import { AddButton, DeleteButton, NumCell, Section, SelectCell, TableShell, TextCell, fmt } from './primitives';

interface Props {
    catalogs: ElectricalCatalogs;
    setCatalogs: (updater: (prev: ElectricalCatalogs) => ElectricalCatalogs) => void;
}

function readXsrfTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function postCatalog<T>(url: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { data: T };
    return json.data;
}

export default function CatalogTab({ catalogs, setCatalogs }: Props) {
    const [message, setMessage] = useState<string | null>(null);

    const notify = (text: string) => {
        setMessage(text);
        setTimeout(() => setMessage(null), 3500);
    };

    // ─── Reglas de tomacorrientes ────────────────────────────────────────────

    const updateRule = (index: number, patch: Partial<OutletRule>) => {
        setCatalogs((prev) => ({
            ...prev,
            outletRules: prev.outletRules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        }));
    };

    const saveRule = async (rule: OutletRule) => {
        try {
            const saved = await postCatalog<OutletRule>('/dialux/electrical/catalog/outlet-rules', {
                room_type: rule.room_type,
                method: rule.method,
                value: rule.value,
                unit: rule.method === 'area' ? 'm2_per_point' : rule.method === 'perimeter' ? 'm_per_point' : 'points',
                power_per_outlet_va: rule.power_per_outlet_va,
                notes: rule.notes ?? null,
            });
            setCatalogs((prev) => ({
                ...prev,
                outletRules: prev.outletRules.map((r) => (r.room_type === saved.room_type ? saved : r)),
            }));
            notify(`Regla «${rule.room_type}» guardada.`);
        } catch {
            notify('Error al guardar la regla.');
        }
    };

    const addRule = () => {
        setCatalogs((prev) => ({
            ...prev,
            outletRules: [
                ...prev.outletRules,
                {
                    id: 0,
                    user_id: null,
                    room_type: `tipo_${prev.outletRules.length + 1}`,
                    method: 'area',
                    value: 10,
                    unit: 'm2_per_point',
                    power_per_outlet_va: 180,
                    notes: null,
                },
            ],
        }));
    };

    // ─── Tipos de tomacorriente ──────────────────────────────────────────────

    const updateType = (index: number, patch: Partial<OutletTypeCatalog>) => {
        setCatalogs((prev) => ({
            ...prev,
            outletTypes: prev.outletTypes.map((t, i) => (i === index ? { ...t, ...patch } : t)),
        }));
    };

    const saveType = async (type: OutletTypeCatalog) => {
        try {
            const saved = await postCatalog<OutletTypeCatalog>('/dialux/electrical/catalog/outlet-types', {
                code: type.code,
                name: type.name,
                height_m: type.height_m,
                height_label: type.height_label ?? null,
                use_description: type.use_description ?? null,
                ip_rating: type.ip_rating ?? null,
                box_type: type.box_type ?? null,
                notes: type.notes ?? null,
            });
            setCatalogs((prev) => ({
                ...prev,
                outletTypes: prev.outletTypes.map((t) => (t.code === saved.code ? saved : t)),
            }));
            notify(`Tipo «${type.name}» guardado.`);
        } catch {
            notify('Error al guardar el tipo.');
        }
    };

    const addType = () => {
        setCatalogs((prev) => ({
            ...prev,
            outletTypes: [
                ...prev.outletTypes,
                {
                    id: 0,
                    user_id: null,
                    code: `personalizado_${prev.outletTypes.length + 1}`,
                    name: 'Tomacorriente personalizado',
                    height_m: 0.4,
                    height_label: '0.40 m',
                    use_description: '',
                    ip_rating: null,
                    box_type: null,
                    notes: null,
                },
            ],
        }));
    };

    // ─── Conductores ─────────────────────────────────────────────────────────

    const updateConductor = (index: number, patch: Partial<ConductorCatalog>) => {
        setCatalogs((prev) => ({
            ...prev,
            conductors: prev.conductors.map((c, i) => (i === index ? { ...c, ...patch } : c)),
        }));
    };

    const saveConductor = async (conductor: ConductorCatalog) => {
        try {
            const saved = await postCatalog<ConductorCatalog>('/dialux/electrical/catalog/conductors', {
                material: conductor.material,
                section_mm2: conductor.section_mm2,
                awg_ref: conductor.awg_ref ?? null,
                insulation: conductor.insulation,
                ampacity_a: conductor.ampacity_a,
                price_per_meter: conductor.price_per_meter ?? null,
            });
            setCatalogs((prev) => ({
                ...prev,
                conductors: prev.conductors.map((c) =>
                    c.material === saved.material && c.section_mm2 === saved.section_mm2 && c.insulation === saved.insulation ? saved : c,
                ),
            }));
            notify(`Conductor ${conductor.section_mm2} mm² guardado.`);
        } catch {
            notify('Error al guardar el conductor.');
        }
    };

    const addConductor = () => {
        setCatalogs((prev) => ({
            ...prev,
            conductors: [
                ...prev.conductors,
                {
                    id: 0,
                    user_id: null,
                    material: 'cobre',
                    section_mm2: 150,
                    awg_ref: null,
                    insulation: 'THW-90',
                    ampacity_a: 250,
                    price_per_meter: null,
                },
            ],
        }));
    };

    // ─── Parámetros por circuito ─────────────────────────────────────────────

    const updateDefault = (row: CircuitDefaults, patch: Partial<CircuitDefaults>) => {
        setCatalogs((prev) => ({
            ...prev,
            circuitDefaults: prev.circuitDefaults.map((d) =>
                d.circuit_type === row.circuit_type && d.installation_category === row.installation_category ? { ...d, ...patch } : d,
            ),
        }));
    };

    const saveDefault = async (row: CircuitDefaults) => {
        try {
            const saved = await postCatalog<CircuitDefaults>('/dialux/electrical/catalog/circuit-defaults', {
                circuit_type: row.circuit_type,
                installation_category: row.installation_category,
                min_section_mm2: row.min_section_mm2,
                max_voltage_drop_pct: row.max_voltage_drop_pct,
                demand_factor: row.demand_factor,
                breaker_poles: row.breaker_poles,
            });
            setCatalogs((prev) => ({
                ...prev,
                circuitDefaults: prev.circuitDefaults.map((d) =>
                    d.circuit_type === saved.circuit_type && d.installation_category === saved.installation_category ? saved : d,
                ),
            }));
            notify(`Parámetros de «${row.circuit_type}» (${row.installation_category}) guardados.`);
        } catch {
            notify('Error al guardar los parámetros.');
        }
    };

    const SaveRowButton = ({ onClick }: { onClick: () => void }) => (
        <button
            onClick={onClick}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-white/10 hover:text-emerald-400"
            aria-label="Guardar en mi catálogo"
            title="Guardar en mi catálogo">
            <Save size={14} />
        </button>
    );

    const CIRCUIT_TYPE_LABELS: Record<string, string> = {
        lighting: 'Alumbrado',
        outlets: 'Tomacorrientes',
        feeder: 'Alimentadores',
        special: 'Especiales',
    };

    const INSTALLATION_CATEGORY_LABELS: Record<string, string> = {
        residencial: 'Residencial (casas)',
        educativa: 'Educativa (colegios)',
        industrial: 'Industrial',
    };

    const sortedCircuitDefaults = [...catalogs.circuitDefaults].sort((a, b) => {
        const category = a.installation_category.localeCompare(b.installation_category);
        return category !== 0 ? category : a.circuit_type.localeCompare(b.circuit_type);
    });

    return (
        <div className="space-y-4">
            {message && (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{message}</p>
            )}

            <Section
                title="Reglas de tomacorrientes por ambiente (RN-03)"
                subtitle="Método por área (m²/punto), perímetro (m/punto) o cantidad fija. Guardar crea tu override personal sin tocar los valores del sistema."
                actions={<AddButton label="Nueva regla" onClick={addRule} />}>
                <TableShell minWidth={800} headers={['Tipo de ambiente', 'Método', 'Valor', 'VA por punto', 'Notas', 'Origen', '']}>
                    {catalogs.outletRules.map((rule, i) => (
                        <tr key={`${rule.room_type}-${i}`} className="hover:bg-white/[0.02]">
                            <td className="px-2 py-1" style={{ minWidth: 130 }}>
                                <TextCell value={rule.room_type} onChange={(v) => updateRule(i, { room_type: v })} />
                            </td>
                            <td className="px-2 py-1">
                                <SelectCell
                                    value={rule.method}
                                    onChange={(v) => updateRule(i, { method: v as OutletRule['method'] })}
                                    options={[
                                        { value: 'area', label: 'Área (m²/punto)' },
                                        { value: 'perimeter', label: 'Perímetro (m/punto)' },
                                        { value: 'fixed', label: 'Cantidad fija' },
                                    ]}
                                />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={rule.value} onChange={(v) => updateRule(i, { value: v ?? 0 })} step={0.5} width={64} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={rule.power_per_outlet_va} onChange={(v) => updateRule(i, { power_per_outlet_va: v ?? 0 })} step={10} width={64} />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={rule.notes ?? ''} onChange={(v) => updateRule(i, { notes: v })} placeholder="—" />
                            </td>
                            <td className="px-2 py-1 text-[10px] text-zinc-500">{rule.user_id ? 'Personal' : 'Sistema'}</td>
                            <td className="px-2 py-1 text-right whitespace-nowrap">
                                <SaveRowButton onClick={() => void saveRule(rule)} />
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </Section>

            <Section
                title="Tipos de tomacorriente por altura y uso (RN-04)"
                subtitle="Las alturas son datos configurables, no textos fijos."
                actions={<AddButton label="Nuevo tipo" onClick={addType} />}>
                <TableShell minWidth={900} headers={['Código', 'Nombre', 'Altura (m)', 'Etiqueta altura', 'Uso', 'IP', 'Origen', '']}>
                    {catalogs.outletTypes.map((type, i) => (
                        <tr key={`${type.code}-${i}`} className="hover:bg-white/[0.02]">
                            <td className="px-2 py-1">
                                <TextCell value={type.code} onChange={(v) => updateType(i, { code: v })} width={110} />
                            </td>
                            <td className="px-2 py-1" style={{ minWidth: 150 }}>
                                <TextCell value={type.name} onChange={(v) => updateType(i, { name: v })} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={type.height_m} onChange={(v) => updateType(i, { height_m: v })} step={0.1} width={56} placeholder="—" />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={type.height_label ?? ''} onChange={(v) => updateType(i, { height_label: v })} placeholder="0.40 m / Techo…" />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={type.use_description ?? ''} onChange={(v) => updateType(i, { use_description: v })} placeholder="—" />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={type.ip_rating ?? ''} onChange={(v) => updateType(i, { ip_rating: v })} width={52} placeholder="—" />
                            </td>
                            <td className="px-2 py-1 text-[10px] text-zinc-500">{type.user_id ? 'Personal' : 'Sistema'}</td>
                            <td className="px-2 py-1 text-right whitespace-nowrap">
                                <SaveRowButton onClick={() => void saveType(type)} />
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </Section>

            <Section
                title="Catálogo de conductores"
                subtitle="La sección real se guarda en mm²; el AWG es solo referencia (Riesgo 1 del plan)."
                actions={<AddButton label="Nuevo conductor" onClick={addConductor} />}>
                <TableShell minWidth={760} headers={['Material', 'Sección (mm²)', 'Ref. AWG', 'Aislamiento', 'Ampacidad (A)', 'Precio (S//m)', 'Origen', '']}>
                    {catalogs.conductors.map((c, i) => (
                        <tr key={`${c.material}-${c.section_mm2}-${i}`} className="hover:bg-white/[0.02]">
                            <td className="px-2 py-1">
                                <SelectCell
                                    value={c.material}
                                    onChange={(v) => updateConductor(i, { material: v as ConductorCatalog['material'] })}
                                    options={[
                                        { value: 'cobre', label: 'Cobre' },
                                        { value: 'aluminio', label: 'Aluminio' },
                                    ]}
                                />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={c.section_mm2} onChange={(v) => updateConductor(i, { section_mm2: v ?? 0 })} step={0.5} width={70} />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={c.awg_ref ?? ''} onChange={(v) => updateConductor(i, { awg_ref: v })} width={52} placeholder="—" />
                            </td>
                            <td className="px-2 py-1">
                                <TextCell value={c.insulation} onChange={(v) => updateConductor(i, { insulation: v })} width={80} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={c.ampacity_a} onChange={(v) => updateConductor(i, { ampacity_a: v ?? 0 })} step={1} width={64} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={c.price_per_meter} onChange={(v) => updateConductor(i, { price_per_meter: v })} step={0.1} width={64} placeholder="—" />
                            </td>
                            <td className="px-2 py-1 text-[10px] text-zinc-500">{c.user_id ? 'Personal' : 'Sistema'}</td>
                            <td className="px-2 py-1 text-right whitespace-nowrap">
                                <SaveRowButton onClick={() => void saveConductor(c)} />
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </Section>

            <Section
                title="Parámetros por tipo de circuito e instalación (RN-05)"
                subtitle="Sección mínima, caída de tensión máxima y factor de demanda por tipo de circuito Y por tipo de instalación (residencial/educativa/industrial). El cálculo puede subir la sección, nunca bajar del mínimo. El proyecto elige su categoría en la cabecera («Instalación»).">
                <TableShell
                    minWidth={760}
                    headers={['Instalación', 'Tipo de circuito', 'Sección mínima (mm²)', 'ΔV máx (%)', 'Factor de demanda', 'Polos ITM', 'Origen', '']}>
                    {sortedCircuitDefaults.map((row) => (
                        <tr key={`${row.installation_category}-${row.circuit_type}`} className="hover:bg-white/[0.02]">
                            <td className="px-2.5 py-1.5 text-[10px] text-zinc-400 whitespace-nowrap">
                                {INSTALLATION_CATEGORY_LABELS[row.installation_category] ?? row.installation_category}
                            </td>
                            <td className="px-2.5 py-1.5 font-semibold">{CIRCUIT_TYPE_LABELS[row.circuit_type] ?? row.circuit_type}</td>
                            <td className="px-2 py-1">
                                <NumCell value={row.min_section_mm2} onChange={(v) => updateDefault(row, { min_section_mm2: v ?? 0 })} step={0.5} width={70} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={row.max_voltage_drop_pct} onChange={(v) => updateDefault(row, { max_voltage_drop_pct: v ?? 0 })} step={0.1} width={56} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={row.demand_factor} onChange={(v) => updateDefault(row, { demand_factor: v ?? 0 })} step={0.05} width={56} />
                            </td>
                            <td className="px-2 py-1">
                                <NumCell value={row.breaker_poles} onChange={(v) => updateDefault(row, { breaker_poles: v ?? 2 })} step={1} width={44} />
                            </td>
                            <td className="px-2 py-1 text-[10px] text-zinc-500">{row.user_id ? 'Personal' : 'Sistema'}</td>
                            <td className="px-2 py-1 text-right whitespace-nowrap">
                                <SaveRowButton onClick={() => void saveDefault(row)} />
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </Section>

            <p className="text-[10px] text-zinc-600">
                Nota: los valores iniciales (2.5 mm² alumbrado ≈ ref. N.° 14, 4 mm² tomacorrientes ≈ ref. N.° 12) son puntos de partida del plan; la
                selección final siempre valida corriente y caída de tensión (Riesgo 2). {fmt(catalogs.conductors.length, 0)} conductores en catálogo.
            </p>
        </div>
    );
}
