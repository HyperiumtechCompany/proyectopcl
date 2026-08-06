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
import type { ProjectSiteSettings } from '@/pages/dialux/hooks/types';
import {
    useEditorStore,
    type AngleSnapMode,
    type DrawTool,
    type ElectricalDeviceType,
    type IsoluxMode,
    type ScaleConfig,
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

const fieldInputClass =
    'w-full rounded border border-gray-700/60 bg-gray-900/70 px-2 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 transition-colors outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30';
const fieldLabelClass = 'mb-1 block text-[9px] tracking-wider text-gray-600 uppercase';

/** `''` en el `<select>` (sin elegir) se guarda como `undefined`, no como cadena vacía. */
function parseOptionalNumberInput(raw: string): number | undefined {
    if (raw.trim() === '') return undefined;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : undefined;
}

/**
 * Sección "Terreno" (Fase de comparación DIALux evo): agrupa Mantenimiento,
 * Orientación de terreno y Luz molesta, igual que el panel "Terreno" de
 * DIALux evo. Dos niveles bien distintos — ver `ProjectSiteSettings` en
 * `hooks/types.ts`:
 * - Mantenimiento (MF) SÍ afecta el cálculo real de todos los ambientes del
 *   proyecto.
 * - Orientación y Luz molesta son metadata documentada SIN consumidor de
 *   cálculo hoy — el motor de luz natural (`daylightFactorEngine.ts`) usa
 *   cielo cubierto CIE sin fecha/hora/orientación, y el sistema no evalúa
 *   deslumbramiento de luminarias exteriores. Cada sección lo aclara en su
 *   propio texto para que nadie los confunda con algo ya cableado.
 */
function TerrenoSections() {
    const project = useEditorStore((s) => s.project);
    const setProjectSiteSettings = useEditorStore((s) => s.setProjectSiteSettings);
    const site = project?.siteSettings;

    const update = (partial: Partial<ProjectSiteSettings>) => setProjectSiteSettings(partial);

    return (
        <>
            <PanelCard title="Terreno · Mantenimiento" tone="accent">
                <label className={fieldLabelClass}>Factor de mantenimiento (MF)</label>
                <input
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={site?.maintenanceFactor ?? 0.8}
                    onChange={(e) => update({ maintenanceFactor: parseOptionalNumberInput(e.target.value) })}
                    className={fieldInputClass}
                />
                <p className="mt-1.5 text-[9.5px] leading-snug text-gray-500">
                    Afecta el cálculo real de todos los ambientes de este proyecto (E ∝ MF). Default 0.80.
                </p>
                <label className={`mt-2 ${fieldLabelClass}`}>Método (referencia)</label>
                <select
                    value={site?.maintenanceMethod ?? ''}
                    onChange={(e) =>
                        update({ maintenanceMethod: (e.target.value || undefined) as ProjectSiteSettings['maintenanceMethod'] })
                    }
                    className={fieldInputClass}
                >
                    <option value="">— sin especificar —</option>
                    <option value="din_5035">global (DIN 5035)</option>
                    <option value="cie_97_2005">CIE 97:2005</option>
                    <option value="iesna">IESNA</option>
                    <option value="jieg_001">JIEG-001 (simplificado)</option>
                </select>
                <p className="mt-1.5 text-[9.5px] leading-snug text-gray-600">
                    Solo documental — no cambia cómo se calcula el MF de arriba.
                </p>
            </PanelCard>

            <PanelCard title="Terreno · Orientación">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={fieldLabelClass}>Latitud</label>
                        <input
                            type="number"
                            step="0.01"
                            value={site?.latitude ?? ''}
                            onChange={(e) => update({ latitude: parseOptionalNumberInput(e.target.value) })}
                            className={fieldInputClass}
                        />
                    </div>
                    <div>
                        <label className={fieldLabelClass}>Longitud</label>
                        <input
                            type="number"
                            step="0.01"
                            value={site?.longitude ?? ''}
                            onChange={(e) => update({ longitude: parseOptionalNumberInput(e.target.value) })}
                            className={fieldInputClass}
                        />
                    </div>
                    <div>
                        <label className={fieldLabelClass}>Orientación norte (°)</label>
                        <input
                            type="number"
                            step="1"
                            value={site?.northOrientationDeg ?? ''}
                            onChange={(e) => update({ northOrientationDeg: parseOptionalNumberInput(e.target.value) })}
                            className={fieldInputClass}
                        />
                    </div>
                    <div>
                        <label className={fieldLabelClass}>Huso horario</label>
                        <input
                            type="text"
                            placeholder="Ej. America/Lima"
                            value={site?.timezone ?? ''}
                            onChange={(e) => update({ timezone: e.target.value || undefined })}
                            className={fieldInputClass}
                        />
                    </div>
                </div>
                <p className="mt-1.5 text-[9.5px] leading-snug text-amber-500/80">
                    No afecta cálculos actuales — el motor de luz natural usa cielo cubierto CIE, sin
                    dependencia de fecha/hora/orientación. Queda listo para cuando se agregue cálculo CBDM.
                </p>
            </PanelCard>

            <PanelCard title="Terreno · Luz molesta">
                <label className={fieldLabelClass}>Norma</label>
                <select
                    value={site?.obtrusiveLightStandard ?? ''}
                    onChange={(e) => update({ obtrusiveLightStandard: e.target.value || undefined })}
                    className={fieldInputClass}
                >
                    <option value="">— sin especificar —</option>
                    <option value="en_12464_2_2014">EN 12464-2:2014</option>
                </select>
                <label className={`mt-2 ${fieldLabelClass}`}>Zona ambiental</label>
                <select
                    value={site?.environmentalZone ?? ''}
                    onChange={(e) =>
                        update({ environmentalZone: (e.target.value || undefined) as ProjectSiteSettings['environmentalZone'] })
                    }
                    className={fieldInputClass}
                >
                    <option value="">— sin especificar —</option>
                    <option value="E0">E0 — protegida (parques naturales)</option>
                    <option value="E1">E1 — oscura (rural)</option>
                    <option value="E2">E2 — baja luminosidad (suburbana)</option>
                    <option value="E3">E3 — media luminosidad (urbana)</option>
                    <option value="E4">E4 — alta luminosidad (centro urbano)</option>
                </select>
                <p className="mt-1.5 text-[9.5px] leading-snug text-amber-500/80">
                    Documental por ahora — el sistema no evalúa deslumbramiento de luminarias exteriores
                    todavía.
                </p>
            </PanelCard>
        </>
    );
}

export const ProyectoPanel: React.FC<{
    projectName: string;
    onProjectNameChange: (v: string) => void;
}> = ({ projectName, onProjectNameChange }) => (
    <div className="flex flex-col gap-2.5">
        <PanelCard title="Identificación del proyecto" tone="accent">
            <label className={fieldLabelClass}>Nombre del proyecto</label>
            <input
                type="text"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                placeholder="Ej. Edificio Comercial Los Pinos"
                className={fieldInputClass}
            />
        </PanelCard>
        <PanelCard title="Uso del nombre">
            <p className="text-[9.5px] leading-snug text-gray-500">
                El nombre aparece en el encabezado del reporte PDF y como título
                del proyecto.
            </p>
        </PanelCard>

        <TerrenoSections />

        <PanelCard title="Módulo eléctrico" tone="accent">
            <p className="mb-1.5 text-[9.5px] leading-snug text-gray-500">
                Cálculo de luminarias, tomacorrientes, circuitos, tableros por
                piso, alimentadores y metrados con exportación a Excel.
            </p>
            <a
                href={`${window.location.pathname.replace(/\/+$/, '')}/electrico`}
                className="inline-flex items-center gap-1.5 rounded border border-amber-600/40 bg-amber-600/15 px-2.5 py-1.5 text-[10px] font-semibold text-amber-300 transition-colors hover:bg-amber-600/25">
                ⚡ Abrir módulo eléctrico
            </a>
        </PanelCard>
    </div>
);
