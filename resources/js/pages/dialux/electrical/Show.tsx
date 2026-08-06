/**
 * Módulo Eléctrico DIALux: cálculo de luminarias, tomacorrientes, circuitos,
 * tableros jerárquicos, alimentadores y metrados con export a Excel.
 * Implementa el plan de resolución (planes/plan_resolucion_dialux_claude_codex.md).
 */

import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Check, CloudOff, FileSpreadsheet, Loader2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import CatalogTab from './components/CatalogTab';
import CircuitsTab from './components/CircuitsTab';
import LuminairesTab from './components/LuminairesTab';
import OutletsTab from './components/OutletsTab';
import PanelsTab from './components/PanelsTab';
import RoomsTab from './components/RoomsTab';
import TakeoffTab from './components/TakeoffTab';
import { NumCell, SelectCell, fmt } from './components/primitives';
import type { ElectricalCatalogs, ElectricalDocument, NormativeRequirementRow } from './engine/types';
import { exportElectricalExcel } from './export/electricalExcelExport';
import { useElectricalDocument, type CadProjectData } from './useElectricalDocument';

interface ElectricalRecord {
    id: number;
    dialux_project_id: string;
    data: ElectricalDocument | null;
}

interface PageProps {
    project: { id: string; name: string; data: CadProjectData | null };
    electrical: ElectricalRecord | null;
    catalogs: ElectricalCatalogs;
    normativeRequirements: NormativeRequirementRow[];
}

type TabKey = 'rooms' | 'luminaires' | 'outlets' | 'circuits' | 'panels' | 'takeoff' | 'catalog';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'rooms', label: 'Ambientes' },
    { key: 'luminaires', label: 'Luminarias' },
    { key: 'outlets', label: 'Tomacorrientes' },
    { key: 'circuits', label: 'Circuitos' },
    { key: 'panels', label: 'Tableros y Alimentadores' },
    { key: 'takeoff', label: 'Metrados' },
    { key: 'catalog', label: 'Catálogos' },
];

export default function ElectricalShow({ project, electrical, catalogs: initialCatalogs, normativeRequirements }: PageProps) {
    const [tab, setTab] = useState<TabKey>('rooms');
    const [catalogs, setCatalogsState] = useState<ElectricalCatalogs>(initialCatalogs);
    const [exporting, setExporting] = useState(false);

    const api = useElectricalDocument({
        dialuxProjectId: project.id,
        initialDocument: electrical?.data ?? null,
        catalogs,
    });

    const { doc, derived, saveStatus, update } = api;

    const breadcrumbs: BreadcrumbItem[] = useMemo(
        () => [
            { title: 'DIAlux', href: '/dialux' },
            { title: project.name, href: `/dialux/${project.id}` },
            { title: 'Módulo Eléctrico', href: `/dialux/${project.id}/electrico` },
        ],
        [project.id, project.name],
    );

    const handleExport = async () => {
        setExporting(true);
        try {
            await exportElectricalExcel({ projectName: project.name, doc, derived, catalogs });
        } finally {
            setExporting(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Eléctrico — ${project.name}`} />

            <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-slate-950 px-4 py-5 text-slate-100 sm:px-6">
                <div className="mx-auto w-full max-w-8xl">
                    {/* Header */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Link
                                href={`/dialux/${project.id}`}
                                className="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                                aria-label="Volver al editor">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 shadow-lg shadow-amber-950/40">
                                <Zap className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">Módulo Eléctrico</h1>
                                <p className="text-xs text-zinc-400">{project.name} · {doc.settings.referenceStandard}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Parámetros generales */}
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#101218] px-3 py-1.5 text-xs text-zinc-400">
                                <label className="flex items-center gap-1">
                                    Tensión
                                    <NumCell
                                        value={doc.settings.voltageV}
                                        onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, voltageV: v ?? 220 } }))}
                                        step={10}
                                        width={56}
                                    />
                                    V
                                </label>
                                <span className="text-zinc-700">|</span>
                                <SelectCell
                                    value={String(doc.settings.phases)}
                                    onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, phases: (Number(v) === 3 ? 3 : 1) as 1 | 3 } }))}
                                    options={[
                                        { value: '1', label: 'Monofásico' },
                                        { value: '3', label: 'Trifásico' },
                                    ]}
                                />
                                <span className="text-zinc-700">|</span>
                                <label className="flex items-center gap-1">
                                    cos φ
                                    <NumCell
                                        value={doc.settings.powerFactor}
                                        onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, powerFactor: v ?? 0.9 } }))}
                                        step={0.05}
                                        width={50}
                                    />
                                </label>
                                <span className="text-zinc-700">|</span>
                                <label className="flex items-center gap-1" title="Determina las secciones mínimas y caída de tensión admisible (RN-05, pestaña Catálogos).">
                                    Instalación
                                    <SelectCell
                                        value={doc.settings.installationCategory}
                                        onChange={(v) =>
                                            update((d) => ({
                                                ...d,
                                                settings: { ...d.settings, installationCategory: v as ElectricalDocument['settings']['installationCategory'] },
                                            }))
                                        }
                                        options={[
                                            { value: 'residencial', label: 'Residencial (casas)' },
                                            { value: 'educativa', label: 'Educativa (colegios)' },
                                            { value: 'industrial', label: 'Industrial' },
                                        ]}
                                    />
                                </label>
                                <span className="text-zinc-700">|</span>
                                <label
                                    className="flex items-center gap-1"
                                    title="Límite de caída de tensión ACUMULADA desde el tablero raíz hasta el punto de uso final (TG→TP→TD→circuito) — distinto del límite por tramo individual, que cada circuito/alimentador ya valida por separado. El motor ya calcula el acumulado siempre; sin este límite configurado, nunca se marca como error aunque la cascada sea excesiva. Vacío = sin verificar (pending-confirmation del umbral normativo)."
                                >
                                    ΔV acum. máx.
                                    <NumCell
                                        value={doc.settings.maxTotalVoltageDropPct}
                                        onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, maxTotalVoltageDropPct: v } }))}
                                        step={0.5}
                                        width={50}
                                        placeholder="—"
                                    />
                                    %
                                </label>
                            </div>

                            {/* Estado de guardado */}
                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                                {saveStatus === 'saving' && (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" /> Guardando…
                                    </>
                                )}
                                {saveStatus === 'saved' && (
                                    <>
                                        <Check className="h-3.5 w-3.5 text-emerald-400" /> Guardado
                                    </>
                                )}
                                {saveStatus === 'error' && (
                                    <>
                                        <CloudOff className="h-3.5 w-3.5 text-rose-400" /> Error al guardar
                                    </>
                                )}
                            </span>

                            <button
                                onClick={() => void handleExport()}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-50">
                                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                                Exportar Excel
                            </button>
                        </div>
                    </div>

                    {/* Resumen rápido */}
                    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-500">
                        <span>{derived.totals.rooms} ambientes</span>
                        <span>{derived.totals.luminaires} luminarias</span>
                        <span>{derived.totals.outlets} tomacorrientes</span>
                        <span>{doc.circuits.length} circuitos</span>
                        <span>{derived.totals.panels} tableros</span>
                        <span className="text-amber-500">{fmt(derived.totals.installedPowerW / 1000, 2)} kW instalados</span>
                        <span>{fmt(derived.totals.demandPowerW / 1000, 2)} kW demanda</span>
                    </div>

                    {/* Tabs */}
                    <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#101218] p-1">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    tab === t.key ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                                }`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'rooms' && (
                        <RoomsTab api={api} cadData={project.data} outletRules={catalogs.outletRules} normativeRequirements={normativeRequirements} />
                    )}
                    {tab === 'luminaires' && <LuminairesTab api={api} />}
                    {tab === 'outlets' && <OutletsTab api={api} outletRules={catalogs.outletRules} outletTypes={catalogs.outletTypes} />}
                    {tab === 'circuits' && <CircuitsTab api={api} />}
                    {tab === 'panels' && <PanelsTab api={api} />}
                    {tab === 'takeoff' && <TakeoffTab api={api} />}
                    {tab === 'catalog' && <CatalogTab catalogs={catalogs} setCatalogs={setCatalogsState} />}
                </div>
            </div>
        </AppLayout>
    );
}
