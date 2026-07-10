import {
    AlertCircle,
    AppWindow,
    Building2,
    CheckCircle2,
    Circle,
    DoorOpen,
    Eye,
    FileInput,
    FilePlus,
    Focus,
    Gauge,
    Grid,
    Info,
    Layers,
    Lightbulb,
    Minus,
    MinusCircle,
    Move,
    PenTool,
    RotateCcw,
    RotateCw,
    Ruler,
    Scale,
    Square,
    Spline,
    Tag,
    ToggleLeft,
    Trash2,
    Triangle,
    Type,
    Umbrella,
    Upload,
    Wrench,
    X,
    Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { NormativeStandard } from '@/pages/dialux/hooks/roomLighting';
import type {
    AngleSnapMode,
    DrawTool,
    ElectricalDeviceType,
    IsoluxMode,
    ScaleConfig,
} from '@/pages/dialux/hooks/useEditorStore';
import { CatalogPanel } from '../../CatalogPanel';
import {
    LUMINAIRE_BRANDS,
    WINDOW_MATERIALS,
    type LuminaireBrand,
    type WindowMaterial,
} from '../../constants';
import {
    ALL_STANDARDS,
    getBackground,
    getSurround,
    type NormKey,
    type NormProfile,
} from '../normativeData';
import {
    AngleSnapBlock,
    ChipFilter,
    IsoluxBlock,
    SearchInput,
} from '../panelControls';
import {
    MetricRow,
    PanelCadBtn,
    PanelCard,
    PanelSep,
    PanelTabs,
    PanelToolBtn,
    SectionBand,
} from '../primitives';

const NORM_KEY_TO_STANDARD: Record<NormKey, NormativeStandard> = {
    EN_12464_1: 'en_12464',
    EN_12464_2: 'en_12464',
    IESNA: 'ies_na',
    NTP_370: 'rne_peru',
};

interface NormativaPanelProps {
    onDefaultNormativeStandardChange: (v: NormativeStandard) => void;
    onApplyProfile: (opts: {
        standard: NormativeStandard;
        normaLux: number;
        ugrLimit?: number;
        uniformityTarget?: number;
        colorRenderingRa?: number;
    }) => void;
}

export const NormativaPanel: React.FC<NormativaPanelProps> = ({
    onDefaultNormativeStandardChange,
    onApplyProfile,
}) => {
    const [selectedKey, setSelectedKey] = useState<NormKey>('EN_12464_2');
    const [selectedSectionId, setSelectedSectionId] = useState<string>('5');
    const [selectedSubId, setSelectedSubId] = useState<string>('5.3');
    const [selectedProfileId, setSelectedProfileId] = useState<string>('5.3.1');
    const [applied, setApplied] = useState(false);

    const std = ALL_STANDARDS.find((s) => s.key === selectedKey)!;
    const section = std.sections.find((s) => s.id === selectedSectionId);
    const subsection = section?.subsections?.find(
        (s) => s.id === selectedSubId,
    );
    const profiles: NormProfile[] =
        subsection?.profiles ?? section?.profiles ?? [];
    const profile =
        profiles.find((p) => p.id === selectedProfileId) ?? profiles[0];

    // Reset selections when standard changes
    const handleStdChange = (key: NormKey) => {
        const newStd = ALL_STANDARDS.find((s) => s.key === key)!;
        const sec = newStd.sections[0];
        setSelectedKey(key);
        setSelectedSectionId(sec.id);
        const sub = sec.subsections?.[0];
        setSelectedSubId(sub?.id ?? '');
        const prof = sub?.profiles[0] ?? sec.profiles?.[0];
        setSelectedProfileId(prof?.id ?? '');
        setApplied(false);
    };

    const handleSectionChange = (id: string) => {
        setSelectedSectionId(id);
        const sec = std.sections.find((s) => s.id === id);
        const sub = sec?.subsections?.[0];
        setSelectedSubId(sub?.id ?? '');
        const prof = sub?.profiles[0] ?? sec?.profiles?.[0];
        setSelectedProfileId(prof?.id ?? '');
        setApplied(false);
    };

    const handleApply = () => {
        if (!profile) return;
        const standard = NORM_KEY_TO_STANDARD[selectedKey];
        onApplyProfile({
            standard,
            normaLux: profile.Em_work,
            ugrLimit: profile.UGR ?? undefined,
            uniformityTarget: profile.uniformity ?? undefined,
            colorRenderingRa: profile.Ra,
        });
        onDefaultNormativeStandardChange(standard);
        setApplied(true);
        setTimeout(() => setApplied(false), 2500);
    };

    return (
        <div className="flex flex-col gap-2.5">
            {/* Standard selector */}
            <PanelCard title="Estándar normativo" tone="normativa">
                <div className="flex flex-col gap-1.5">
                    {ALL_STANDARDS.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => handleStdChange(s.key)}
                            className={`flex items-start gap-2 rounded px-2.5 py-2 text-left transition-colors ${
                                selectedKey === s.key
                                    ? 'bg-emerald-900/25 ring-1 ring-emerald-700/40'
                                    : 'hover:bg-gray-700/40'
                            }`}
                        >
                            <div
                                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                                    selectedKey === s.key
                                        ? 'bg-emerald-400'
                                        : 'bg-gray-600'
                                }`}
                            />
                            <div>
                                <p
                                    className={`text-[11px] font-semibold ${
                                        selectedKey === s.key
                                            ? 'text-emerald-300'
                                            : 'text-gray-300'
                                    }`}
                                >
                                    {s.label}
                                </p>
                                <p className="text-[9.5px] leading-snug text-gray-500">
                                    {s.region}
                                </p>
                            </div>
                            {selectedKey === s.key && (
                                <CheckCircle2
                                    size={12}
                                    className="mt-0.5 ml-auto shrink-0 text-emerald-400"
                                />
                            )}
                        </button>
                    ))}
                </div>
                <p className="mt-2 px-1 text-[9.5px] leading-snug text-gray-600">
                    {std.fullName}
                </p>
            </PanelCard>

            {/* Section → Subsection → Profile selectors */}
            {/* <PanelCard title="Selección de perfil">
                <label className="mb-1 block text-[9px] tracking-wider text-gray-600 uppercase">
                    Sección / área
                </label>
                <select
                    value={selectedSectionId}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    className="mb-2 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                    {std.sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                            {sec.label}
                        </option>
                    ))}
                </select>

                {section?.subsections && section.subsections.length > 0 && (
                    <>
                        <label className="mb-1 block text-[9px] tracking-wider text-gray-600 uppercase">
                            Subsección
                        </label>
                        <select
                            value={selectedSubId}
                            onChange={(e) => {
                                setSelectedSubId(e.target.value);
                                const sub = section.subsections!.find(
                                    (s) => s.id === e.target.value,
                                );
                                setSelectedProfileId(
                                    sub?.profiles[0]?.id ?? '',
                                );
                                setApplied(false);
                            }}
                            className="mb-2 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500/40"
                        >
                            {section.subsections.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.label}
                                </option>
                            ))}
                        </select>
                    </>
                )}

                <label className="mb-1 block text-[9px] tracking-wider text-gray-600 uppercase">
                    Aplicación
                </label>
                <select
                    value={selectedProfileId}
                    onChange={(e) => {
                        setSelectedProfileId(e.target.value);
                        setApplied(false);
                    }}
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500/40"
                >
                    {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.application}
                        </option>
                    ))}
                </select>
            </PanelCard> */}

            {/* Active profile details — DIALux-style metrics card */}
            {/* {profile && (
                <div className="rounded-md border border-emerald-800/40 bg-emerald-950/15">
                    <SectionBand
                        label="Perfil activo"
                        icon={<Gauge size={11} />}
                    />

                    <div className="flex flex-col gap-0.5 px-2 pb-2">
                        <SectionBand label="Intensidad lumínica" />
                        <MetricRow
                            label="Área de trabajo (Em)"
                            value={profile.Em_work}
                            unit="lx"
                            highlight
                        />
                        <MetricRow
                            label="Área circundante (Em)"
                            value={getSurround(profile)}
                            unit="lx"
                        />
                        <MetricRow
                            label="Área de fondo (Em)"
                            value={getBackground(profile)}
                            unit="lx"
                        />
                        {profile.uniformity !== undefined && (
                            <MetricRow
                                label="Uniformidad (Emin/Em)"
                                value={profile.uniformity.toFixed(2)}
                            />
                        )}

                        {profile.UGR !== undefined && (
                            <>
                                <SectionBand label="Deslumbramiento" />
                                <MetricRow
                                    label={
                                        selectedKey.startsWith('EN') &&
                                        selectedKey === 'EN_12464_2'
                                            ? 'Al aire libre (RG)'
                                            : 'UGR límite'
                                    }
                                    value={`≤ ${profile.UGR}`}
                                />
                            </>
                        )}

                        <SectionBand label="Calidad de color" />
                        <MetricRow
                            label="Índice reproducción (Ra)"
                            value={`≥ ${profile.Ra}`}
                        />

                        {profile.notes && (
                            <div className="mt-1.5 flex gap-1.5 rounded bg-amber-950/20 px-2 py-1.5 text-[9.5px] text-amber-300/80">
                                <Info size={11} className="mt-0.5 shrink-0" />
                                <span>{profile.notes}</span>
                            </div>
                        )}
                    </div>
                </div>
            )} */}

            <button
                type="button"
                onClick={handleApply}
                className={`flex w-full items-center justify-center gap-2 rounded py-2 text-[11px] font-semibold transition-all duration-200 ${
                    applied
                        ? 'bg-emerald-700/40 text-emerald-300 ring-1 ring-emerald-600/40'
                        : 'bg-emerald-800/30 text-emerald-200 ring-1 ring-emerald-800/40 hover:bg-emerald-700/40'
                }`}
            >
                {applied ? (
                    <>
                        <CheckCircle2 size={13} /> Aplicado — dibujo y
                        exportación
                    </>
                ) : (
                    <>
                        <Scale size={13} /> Aplicar a todos los ambientes
                    </>
                )}
            </button>
            <p className="mt-1 px-1 text-center text-[9px] leading-snug text-gray-600">
                Afecta importación DXF, exportación PDF y cálculos de
                cumplimiento.
            </p>
        </div>
    );
};

/* ── Herramientas CAD Panel ───────────────────────────────────────────────── */
