/**
 * NormativeWizardPanel.tsx
 *
 * Panel lateral del mÃ³dulo "Normativas del Proyecto" â€” Flujo guiado en 4 pasos:
 *  1. UbicaciÃ³n (paÃ­s)
 *  2. Tipo de instalaciÃ³n
 *  3. Norma recomendada y aplicable
 *  4. Resumen por ambiente
 *
 * Sincroniza la configuraciÃ³n con el backend via useNormativeConfig hook.
 */

import {
    AlertTriangle,
    BookOpen,
    Building2,
    CheckCircle2,
    ChevronRight,
    Globe,
    Info,
    Layers3,
    ScrollText,
    XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    type ComplianceStatus,
    evaluateCompliance,
    getInstallationTypes,
    getNormDisclaimer,
    NORMATIVE_REGIONS,
    NORMATIVE_STANDARDS_META,
    resolvePrimaryStandard,
    resolveApplicableNorms,
    findBestMatchActivity,
    computeOverallStatus,
} from '@/pages/dialux/hooks/normativeEngine';
import type { NormativeStandard } from '@/pages/dialux/hooks/roomLighting';
import { ensureRneDataLoaded } from '@/pages/dialux/hooks/normativeRemoteData';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { useNormativeConfig } from '@/pages/dialux/hooks/useNormativeConfig';
import type { ProjectNormativeConfig } from '@/pages/dialux/hooks/types';
import { NormativeCompliancePanel } from './NormativeCompliancePanel';

// â”€â”€â”€ Tipos locales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type WizardStep = 1 | 2 | 3 | 4;

// â”€â”€â”€ Helpers de estilo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function statusColor(status: ComplianceStatus): string {
    switch (status) {
        case 'compliant':    return 'text-emerald-400';
        case 'warning':      return 'text-amber-400';
        case 'non_compliant': return 'text-red-400';
        case 'needs_review': return 'text-slate-600 dark:text-slate-400';
    }
}

function statusIcon(status: ComplianceStatus) {
    switch (status) {
        case 'compliant':    return <CheckCircle2 size={13} className="text-emerald-400" />;
        case 'warning':      return <AlertTriangle size={13} className="text-amber-400" />;
        case 'non_compliant': return <XCircle size={13} className="text-red-400" />;
        case 'needs_review': return <Info size={13} className="text-slate-600 dark:text-slate-400" />;
    }
}

function legalBadge(status: 'mandatory' | 'recommended' | 'reference') {
    const cfg = {
        mandatory:   { label: 'Obligatoria', cls: 'bg-red-950/60 text-red-300 border-red-800/50' },
        recommended: { label: 'Recomendada', cls: 'bg-blue-950/60 text-blue-300 border-blue-800/50' },
        reference:   { label: 'Referencia',  cls: 'bg-slate-200 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700/50' },
    }[status];
    return (
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

// â”€â”€â”€ Componente Stepper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Stepper({ current, total }: { current: WizardStep; total: number }) {
    return (
        <div className="flex items-center gap-1.5 pb-3">
            {Array.from({ length: total }, (_, i) => {
                const step = (i + 1) as WizardStep;
                const done = current > step;
                const active = current === step;
                return (
                    <React.Fragment key={step}>
                        <div
                            className={[
                                'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition-all',
                                active  ? 'bg-blue-500 text-white shadow shadow-blue-500/40'  : '',
                                done    ? 'bg-emerald-600 text-white'  : '',
                                !active && !done ? 'bg-slate-200 dark:bg-slate-800 text-slate-500' : '',
                            ].join(' ')}
                        >
                            {done ? 'âœ“' : step}
                        </div>
                        {i < total - 1 && (
                            <div className={`h-px flex-1 transition-colors ${done ? 'bg-emerald-700' : 'bg-slate-200 dark:bg-slate-800'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// â”€â”€â”€ Paso 1: UbicaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepLocation({
    selectedCountry,
    onSelect,
}: {
    selectedCountry: string;
    onSelect: (code: string) => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Globe size={13} className="text-blue-400" />
                Selecciona el paÃ­s del proyecto
            </div>
            <p className="text-[10px] text-slate-500">
                El sistema seleccionarÃ¡ automÃ¡ticamente la norma obligatoria segÃºn la ubicaciÃ³n.
            </p>
            {NORMATIVE_REGIONS.map((region) => (
                <div key={region.id} className="space-y-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                        {region.name}
                    </p>
                    {region.countries.map((country) => {
                        const isSelected = selectedCountry === country.code;
                        return (
                            <button
                                key={country.code}
                                onClick={() => onSelect(country.code)}
                                className={[
                                    'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all',
                                    isSelected
                                        ? 'border-blue-600/60 bg-blue-950/50 text-blue-200'
                                        : 'border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:border-slate-700 hover:text-slate-700 dark:text-slate-300',
                                ].join(' ')}
                            >
                                <span className="text-base">{country.flag}</span>
                                <span className="flex-1 text-xs font-medium">{country.name}</span>
                                <span className="text-[9px] font-mono text-slate-600">{country.code}</span>
                                {isSelected && <CheckCircle2 size={13} className="text-blue-400" />}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// â”€â”€â”€ Paso 2: Tipo de instalaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepInstallationType({
    selected,
    onSelect,
}: {
    selected: string | null;
    onSelect: (id: string) => void;
}) {
    const types = getInstallationTypes();
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Building2 size={13} className="text-blue-400" />
                Tipo de instalaciÃ³n
            </div>
            <p className="text-[10px] text-slate-500">
                Define el uso del edificio para orientar la selecciÃ³n de categorÃ­as normativas.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
                {types.map((t) => {
                    const isSelected = selected === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => onSelect(t.id)}
                            title={t.description}
                            className={[
                                'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all',
                                isSelected
                                    ? 'border-blue-600/60 bg-blue-950/50 text-blue-200'
                                    : 'border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900/40 text-slate-500 hover:border-slate-300 dark:border-slate-700 hover:text-slate-600 dark:text-slate-400',
                            ].join(' ')}
                        >
                            <span className="text-lg leading-none">{t.icon}</span>
                            <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// â”€â”€â”€ Paso 3: Norma recomendada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepNormativeRecommendation({
    countryCode,
    onSelectStandard,
    selectedStandard,
}: {
    countryCode: string;
    onSelectStandard: (s: NormativeStandard) => void;
    selectedStandard: NormativeStandard;
}) {
    const applicableStandards = useMemo(() => resolveApplicableNorms(countryCode), [countryCode]);
    const primaryStandard = useMemo(() => resolvePrimaryStandard(countryCode), [countryCode]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <BookOpen size={13} className="text-blue-400" />
                Normas aplicables
            </div>
            <p className="text-[10px] text-slate-500">
                La norma local obligatoria se aplicarÃ¡ a todos los recintos. Puedes agregar normas de referencia adicionales.
            </p>
            <div className="space-y-2">
                {applicableStandards.map((std) => {
                    const meta = NORMATIVE_STANDARDS_META[std];
                    if (!meta) return null;
                    const isPrimary = std === primaryStandard;
                    const isSelected = std === selectedStandard;
                    return (
                        <button
                            key={std}
                            onClick={() => onSelectStandard(std)}
                            className={[
                                'w-full rounded-lg border p-3 text-left transition-all',
                                isSelected
                                    ? 'border-blue-600/60 bg-blue-950/40'
                                    : 'border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900/40 hover:border-slate-300 dark:border-slate-700',
                            ].join(' ')}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-white">{meta.name}</span>
                                        {legalBadge(meta.legalStatus)}
                                        {isPrimary && (
                                            <span className="rounded-full bg-emerald-900/60 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                                                AutomÃ¡tica
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-[10px] text-slate-500">{meta.fullName}</p>
                                    <div className="mt-1 flex flex-wrap gap-2 text-[9px] text-slate-600">
                                        <span>{meta.source}</span>
                                        <span>Â·</span>
                                        <span>{meta.authority}</span>
                                    </div>
                                </div>
                                {isSelected && <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-blue-400" />}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Disclaimer */}
            {selectedStandard && (
                <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-2.5">
                    <p className="text-[9px] leading-relaxed text-amber-700/80">
                        <span className="font-semibold text-amber-600">Fuente: </span>
                        {getNormDisclaimer(selectedStandard)}
                    </p>
                </div>
            )}
        </div>
    );
}

// â”€â”€â”€ Paso 4: Resumen por ambiente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepAmbientSummary({
    onSwitchToCompliance,
    onSummary,
}: {
    onSwitchToCompliance: () => void;
    onSummary?: (summary: ProjectNormativeConfig['complianceSummary']) => void;
}) {
    const scene = useEditorStore((s) => s.activeScene());
    const resultsByRoom = useEditorStore((s) => s.resultsByRoom);
    const rooms = scene?.rooms ?? [];

    // Estados por ambiente (misma lÃ³gica que el render, memoizada para poder
    // reportar el resumen al padre y persistirlo en el backend).
    const statuses = useMemo(() => {
        return rooms.map((room) => {
            const result = resultsByRoom[room.id];
            const normActivity = room.normativeActivity ?? room.normativeSection ?? null;
            const normLeaf = normActivity && room.normativeStandard
                ? findBestMatchActivity(room.normativeStandard, normActivity, room.normativeCategory)
                : null;

            if (result && normLeaf) {
                const standard = room.normativeStandard ?? 'en_12464_1';
                const meta = NORMATIVE_STANDARDS_META[standard] ?? undefined;
                const roomFixtures = (scene?.fixtures ?? []).filter(
                    (fixture) => fixture.roomId === room.id,
                );
                return computeOverallStatus(
                    evaluateCompliance(room, result, normLeaf, meta, roomFixtures),
                );
            }
            return 'needs_review' as ComplianceStatus;
        });
    }, [rooms, resultsByRoom, scene]);

    const summaryKey = statuses.join(',');

    useEffect(() => {
        if (!onSummary || rooms.length === 0) {
            return;
        }
        onSummary({
            totalRooms: statuses.length,
            compliantRooms: statuses.filter((s) => s === 'compliant').length,
            nonCompliantRooms: statuses.filter((s) => s === 'non_compliant').length,
            warningRooms: statuses.filter((s) => s === 'warning').length,
            needsReviewRooms: statuses.filter((s) => s === 'needs_review').length,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [summaryKey]);

    if (rooms.length === 0) {
        return (
            <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900/40 p-4 text-center">
                <Layers3 size={24} className="mx-auto mb-2 text-slate-700" />
                <p className="text-xs text-slate-500">
                    No hay recintos en el proyecto.<br />
                    Dibuja recintos en el plano 2D para ver el resumen normativo.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Layers3 size={13} className="text-blue-400" />
                    Resumen por ambiente
                </div>
                <button
                    onClick={onSwitchToCompliance}
                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                >
                    Ver detalle <ChevronRight size={11} />
                </button>
            </div>
            <div className="space-y-1.5">
                {rooms.map((room, index) => {
                    const normActivity = room.normativeActivity ?? room.normativeSection ?? null;
                    const overallStatus: ComplianceStatus = statuses[index] ?? 'needs_review';

                    return (
                        <div
                            key={room.id}
                            className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-800/70 bg-slate-200 dark:bg-slate-900/40 px-3 py-2"
                        >
                            {statusIcon(overallStatus)}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                    {room.name}
                                </p>
                                <p className="text-[9px] text-slate-600">
                                    {normActivity ?? 'Sin actividad asignada'}
                                    {room.normativeStandard && (
                                        <> Â· {NORMATIVE_STANDARDS_META[room.normativeStandard]?.name}</>
                                    )}
                                </p>
                            </div>
                            <span className={`text-[9px] font-semibold ${statusColor(overallStatus)}`}>
                                {overallStatus === 'compliant'    ? 'Cumple'   :
                                 overallStatus === 'warning'      ? 'Aviso'    :
                                 overallStatus === 'non_compliant' ? 'No cumple' :
                                 'Revisar'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// â”€â”€â”€ Panel principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const NormativeWizardPanel: React.FC = () => {
    const [step, setStep] = useState<WizardStep>(1);
    const [showComplianceDetail, setShowComplianceDetail] = useState(false);

    const { config, isSaving, error, saveConfig, loadConfig, saveComplianceSummary } = useNormativeConfig();

    const project = useEditorStore((s) => s.project);
    const setDefaultRoomNormativeStandard = useEditorStore((s) => s.setDefaultRoomNormativeStandard);
    const applyDefaultNormativeStandardToRooms = useEditorStore((s) => s.applyDefaultNormativeStandardToRooms);

    // Al abrir el panel: rehidratar la config guardada en el backend (antes
    // nunca se invocaba y el wizard siempre partÃ­a de defaults) y cargar el
    // catÃ¡logo EM.010 completo desde la BD como fuente Ãºnica de verdad.
    const loadedProjectRef = React.useRef<string | null>(null);
    useEffect(() => {
        void ensureRneDataLoaded();

        if (project && loadedProjectRef.current !== project.id) {
            loadedProjectRef.current = project.id;
            void loadConfig(project.id);
        }
    }, [project, loadConfig]);

    // Persistencia (debounced) del resumen de cumplimiento calculado en el paso 4.
    const summaryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSummary = useCallback(
        (summary: ProjectNormativeConfig['complianceSummary']) => {
            if (!project || !config) {
                return;
            }
            if (summaryTimerRef.current) {
                clearTimeout(summaryTimerRef.current);
            }
            summaryTimerRef.current = setTimeout(() => {
                void saveComplianceSummary(project.id, summary);
            }, 1500);
        },
        [project, config, saveComplianceSummary],
    );

    // Estado local del wizard (se sincroniza al guardar)
    const [selectedCountry, setSelectedCountry] = useState(config?.countryCode ?? 'PE');
    const [selectedInstallationType, setSelectedInstallationType] = useState<string | null>(
        config?.installationType ?? null,
    );
    const [selectedStandard, setSelectedStandard] = useState<NormativeStandard>(
        config?.primaryStandard ?? 'rne_peru',
    );

    // Sincronizar desde config backend cuando carga
    useEffect(() => {
        if (config) {
            setSelectedCountry(config.countryCode);
            setSelectedInstallationType(config.installationType);
            setSelectedStandard(config.primaryStandard);
        }
    }, [config]);

    // Auto-select norma cuando cambia el paÃ­s
    useEffect(() => {
        const primary = resolvePrimaryStandard(selectedCountry);
        setSelectedStandard(primary);
    }, [selectedCountry]);

    const handleApplyNorm = useCallback(async () => {
        if (!project) return;

        setDefaultRoomNormativeStandard(selectedStandard);
        applyDefaultNormativeStandardToRooms();

        await saveConfig({
            dialuxProjectId: project.id,
            countryCode: selectedCountry,
            region: NORMATIVE_REGIONS.find((r) =>
                r.countries.some((c) => c.code === selectedCountry),
            )?.id ?? 'americas_peru',
            installationType: selectedInstallationType,
            primaryStandard: selectedStandard,
            referenceStandards: resolveApplicableNorms(selectedCountry).filter((s) => s !== selectedStandard),
            priorityOrder: resolveApplicableNorms(selectedCountry),
            normativeVersion: NORMATIVE_STANDARDS_META[selectedStandard]?.source ?? null,
            normsConsultedAt: new Date().toISOString().slice(0, 10),
            disclaimer: getNormDisclaimer(selectedStandard),
        });

        setStep(4);
    }, [
        project, selectedStandard, selectedCountry, selectedInstallationType,
        saveConfig, setDefaultRoomNormativeStandard, applyDefaultNormativeStandardToRooms,
    ]);

    if (showComplianceDetail) {
        return (
            <div className="space-y-3">
                <button
                    onClick={() => setShowComplianceDetail(false)}
                    className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-300"
                >
                    â† Volver al wizard
                </button>
                <NormativeCompliancePanel />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-300 dark:border-slate-800 pb-3">
                <ScrollText size={14} className="text-blue-400" />
                <div>
                    <h3 className="text-xs font-semibold text-white">Normativas del Proyecto</h3>
                    <p className="text-[9px] text-slate-500">ConfiguraciÃ³n normativa guiada</p>
                </div>
            </div>

            {/* Stepper */}
            <Stepper current={step} total={4} />

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-400">
                    {error}
                </div>
            )}

            {/* Pasos */}
            <div className="min-h-0">
                {step === 1 && (
                    <StepLocation
                        selectedCountry={selectedCountry}
                        onSelect={(code) => setSelectedCountry(code)}
                    />
                )}
                {step === 2 && (
                    <StepInstallationType
                        selected={selectedInstallationType}
                        onSelect={(id) => setSelectedInstallationType(id)}
                    />
                )}
                {step === 3 && (
                    <StepNormativeRecommendation
                        countryCode={selectedCountry}
                        selectedStandard={selectedStandard}
                        onSelectStandard={(s) => setSelectedStandard(s)}
                    />
                )}
                {step === 4 && (
                    <StepAmbientSummary
                        onSwitchToCompliance={() => setShowComplianceDetail(true)}
                        onSummary={handleSummary}
                    />
                )}
            </div>

            {/* NavegaciÃ³n */}
            <div className="flex items-center justify-between border-t border-slate-300 dark:border-slate-800 pt-3">
                <button
                    onClick={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
                    disabled={step === 1}
                    className="text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-300 disabled:opacity-30"
                >
                    â† AtrÃ¡s
                </button>

                {step < 3 ? (
                    <button
                        onClick={() => setStep((s) => (s + 1) as WizardStep)}
                        className="flex items-center gap-1 rounded-lg bg-blue-700/80 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-600/80"
                    >
                        Siguiente <ChevronRight size={11} />
                    </button>
                ) : step === 3 ? (
                    <button
                        onClick={handleApplyNorm}
                        disabled={isSaving}
                        className="flex items-center gap-1 rounded-lg bg-emerald-700/80 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-600/80 disabled:opacity-50"
                    >
                        {isSaving ? 'Guardando...' : 'Aplicar norma âœ“'}
                    </button>
                ) : (
                    <button
                        onClick={() => setStep(1)}
                        className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200"
                    >
                        Reconfigurar
                    </button>
                )}
            </div>
        </div>
    );
};

