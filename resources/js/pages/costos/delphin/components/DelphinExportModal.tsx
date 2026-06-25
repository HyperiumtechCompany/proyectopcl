import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    BarChart2, Calculator, CalendarDays, FileSpreadsheet, FileText,
    Layers, Milestone, X, ChevronLeft,
} from 'lucide-react';
import type { DelphinRow } from '../types';
import {
    exportDelphin,
    type DelphinExportContent,
    type DelphinExportFormat,
} from '../helpers/exportDelphin';

const CONTENT_OPTIONS: {
    key: DelphinExportContent;
    icon: React.ReactNode;
    title: string;
    desc: string;
    sheets: string[];
}[] = [
        {
            key: 'budget_only',
            icon: <BarChart2 size={20} />,
            title: 'Solo Presupuesto',
            desc: 'Partidas, unidades, metrados y precios unitarios.',
            sheets: ['Presupuesto General'],
        },
        {
            key: 'formula_polinomica' as DelphinExportContent,
            icon: <Calculator size={20} />,
            title: 'F. Polinómica',
            desc: 'Fórmula K con coeficientes de incidencia por especialidad.',
            sheets: ['Fórmula Polinómica'],
        },
        {
            key: 'budget_gantt',
            icon: <Layers size={20} />,
            title: 'Presupuesto + Cronograma',
            desc: 'Ambas vistas en un único archivo.',
            sheets: ['Presupuesto General', 'Cronograma General'],
        },
        {
            key: 'gantt_only',
            icon: <CalendarDays size={20} />,
            title: 'Solo Cronograma',
            desc: 'Duración, fechas, predecesoras y costo por partida.',
            sheets: ['Cronograma General'],
        },
    ];

const FORMAT_OPTIONS: {
    key: DelphinExportFormat;
    label: string;
    ext: string;
    icon: React.ReactNode;
    onlyGantt?: boolean;
    disabledWhenFormula?: boolean;
}[] = [
        { key: 'excel', label: 'Excel', ext: '.xlsx', icon: <FileSpreadsheet size={14} /> },
        { key: 'pdf', label: 'PDF', ext: '.pdf', icon: <FileText size={14} /> },
        { key: 'msp', label: 'MS Project', ext: '.xml', icon: <Milestone size={14} />, onlyGantt: true, disabledWhenFormula: true, },
    ];

interface MonomioExport {
    nomenclatura: string;
    indices: {
        code: string;
        descripcion: string;
        coefCalculado: number;
        coefDefinido: number;
    }[];
}

interface Props {
    open: boolean;
    rows: DelphinRow[];
    projectName: string;
    project?: any;

    projectData?: {
        id: number;
        nombre: string;
        codigo_cui: string;
        codigo_local: string;
        unidad_ejecutora: string;
        propietario: string;
        codigos_modulares: string;
        plantilla_logo_izq_url: string | null;
        plantilla_logo_der_url: string | null;
    };
    formulaMonomios?: MonomioExport[];
    availableSpecialties?: { id: string; label: string; icon?: string }[];
    onClose: () => void;
}

export function DelphinExportModal({
    open, rows, projectName, project, projectData,
    formulaMonomios,
    availableSpecialties = [], onClose,
}: Props) {
    const [content, setContent] = useState<DelphinExportContent>('budget_gantt');
    const [format, setFormat] = useState<DelphinExportFormat>('excel');
    const [isExporting, setExporting] = useState(false);
    const [showSpecialties, setShowSpecialties] = useState(false);
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

    if (!open) return null;

    const resolvedFormat: DelphinExportFormat =
        format === 'msp' && content === 'budget_only' ? 'excel' : format;

    const isBudget = content !== 'gantt_only';
    const isFormula = content === 'formula_polinomica';
    const hasSpecialties = availableSpecialties.length > 0;
    const shouldShowSpecialties = !isFormula && (resolvedFormat === 'excel' || resolvedFormat === 'pdf') && isBudget && hasSpecialties;


    const totalPres = rows
        .filter((r) => (r.nivel ?? 1) === 1)
        .reduce((s, r) => s + (r.parcial || r.metrado * r.precio_unitario || 0), 0);

    const doExport = async () => {
        setExporting(true);
        try {
            await exportDelphin(
                content,
                resolvedFormat,
                rows,
                projectName,
                projectData,
                selectedSpecialties,
                formulaMonomios,   // ← nuevo
            );
        } finally {
            setExporting(false);
            onClose();
        }
    };
    const handleExport = () => {
        
        if (content === 'formula_polinomica') {
            doExport();
            return;
        }

        if (shouldShowSpecialties) {
            setShowSpecialties(true);
        } else {
            doExport();
        }
    };

    const toggleAll = () => {
        setSelectedSpecialties(
            selectedSpecialties.length === availableSpecialties.length
                ? []
                : availableSpecialties.map(s => s.id)
        );
    };

    // ── Vista 1: Selector de especialidades ──
    const SpecialtiesView = (
        <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3.5">
                <div className="flex items-center gap-2 text-white">
                    <button
                        onClick={() => { setShowSpecialties(false); setSelectedSpecialties([]); }}
                        className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <FileSpreadsheet size={16} className="text-emerald-400" />
                    <span className="text-sm font-semibold">Seleccionar Especialidades</span>
                </div>
                <button
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                    onClick={onClose}
                >
                    <X size={15} />
                </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                        {selectedSpecialties.length === 0
                            ? 'Sin selección → exporta todo'
                            : `${selectedSpecialties.length} seleccionada${selectedSpecialties.length !== 1 ? 's' : ''}`}
                    </span>
                    <button
                        onClick={toggleAll}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition"
                    >
                        {selectedSpecialties.length === availableSpecialties.length
                            ? 'Deseleccionar todas'
                            : 'Seleccionar todas'}
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {availableSpecialties.map((esp) => {
                        const active = selectedSpecialties.includes(esp.id);
                        return (
                            <button
                                key={esp.id}
                                onClick={() =>
                                    setSelectedSpecialties(prev =>
                                        prev.includes(esp.id)
                                            ? prev.filter(x => x !== esp.id)
                                            : [...prev, esp.id]
                                    )
                                }
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all text-left
                                    ${active
                                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-1 ring-emerald-500/40'
                                        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-white'
                                    }`}
                            >
                                <span className="text-base shrink-0">{esp.icon || '📄'}</span>
                                <span className="leading-tight">{esp.label}</span>
                                {active && <span className="ml-auto text-emerald-400 shrink-0">✓</span>}
                            </button>
                        );
                    })}
                </div>

                <p className="text-[10px] text-slate-500 text-center mt-1">
                    Deja todo sin marcar para exportar todas las especialidades
                </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-700 px-5 py-3.5">
                <button
                    onClick={() => { setShowSpecialties(false); setSelectedSpecialties([]); }}
                    className="rounded px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                >
                    Volver
                </button>
                <button
                    disabled={isExporting}
                    onClick={doExport}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <FileSpreadsheet size={12} />
                    {isExporting ? 'Generando…' : 'Exportar'}
                </button>
            </div>
        </>
    );

    // ── Vista 2: Principal ──
    const MainView = (
        <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3.5">
                <div className="flex items-center gap-2 text-white">
                    <FileSpreadsheet size={16} className="text-emerald-400" />
                    <span className="text-sm font-semibold">Exportar Delphin</span>
                </div>
                <button
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                    onClick={onClose}
                >
                    <X size={15} />
                </button>
            </div>

            {/* Body con scroll */}
            <div className="overflow-y-auto max-h-[70vh] space-y-4 p-5">

                {/* Contenido */}
                <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Contenido
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                        {CONTENT_OPTIONS.map((opt) => {
                            const active = content === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    onClick={() => setContent(opt.key)}
                                    className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-all ${active
                                        ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500/40'
                                        : 'border-slate-700 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800'
                                        }`}
                                >
                                    <span className={`mt-0.5 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {opt.icon}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-semibold leading-tight ${active ? 'text-white' : 'text-slate-200'}`}>
                                            {opt.title}
                                        </p>
                                        <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                                            {opt.desc}
                                        </p>
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {opt.sheets.map((s) => (
                                                <span
                                                    key={s}
                                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${active
                                                        ? 'bg-emerald-900/60 text-emerald-300'
                                                        : 'bg-slate-700 text-slate-300'
                                                        }`}
                                                >
                                                    <FileSpreadsheet size={9} />
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-all ${active ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
                                        }`} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Formato */}
                <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Formato de exportación
                    </p>
                    <div className="flex gap-2">
                        {FORMAT_OPTIONS.map((opt) => {
                            const isFormula = content === 'formula_polinomica';
                            const disabled = (opt.onlyGantt && content === 'budget_only') || (opt.disabledWhenFormula && isFormula);
                            const active = format === opt.key && !disabled;

                            return (
                                <button
                                    key={opt.key}
                                    disabled={disabled}
                                    onClick={() => !disabled && setFormat(opt.key)}
                                    title={disabled
                                        ? (isFormula ? 'No disponible para Fórmula Polinómica' : 'No disponible para Solo Presupuesto')
                                        : opt.label}
                                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition-all 
                ${disabled ? 'cursor-not-allowed opacity-35' : ''}
                ${active
                                            ? 'border-sky-500 bg-sky-950/50 text-sky-300 ring-1 ring-sky-500/40'
                                            : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                        }`}
                                >
                                    <span className={active ? 'text-sky-400' : ''}>{opt.icon}</span>
                                    <span>{opt.label}</span>
                                    <span className={`text-[10px] ${active ? 'text-sky-500' : 'text-slate-500'}`}>
                                        {opt.ext}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5">
                    <div className="text-center">
                        <p className="text-base font-bold leading-tight text-white">{rows.length}</p>
                        <p className="text-[10px] text-slate-400">Partidas</p>
                    </div>
                    <div className="mx-1 w-px bg-slate-700" />
                    <div className="text-center">
                        <p className="text-base font-bold leading-tight text-emerald-400">
                            {rows.filter((r) => (r.nivel ?? 1) === 1).length}
                        </p>
                        <p className="text-[10px] text-slate-400">Capítulos</p>
                    </div>
                    <div className="mx-1 w-px bg-slate-700" />
                    <div className="flex-1 text-right">
                        <p className="text-base font-bold leading-tight text-sky-300">
                            S/ {totalPres.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-400">Total presupuesto</p>
                    </div>
                </div>
            </div>

            {/* Footer siempre visible */}
            <div className="flex items-center justify-between border-t border-slate-700 px-5 py-3.5">
                <span className="text-[11px] text-slate-500">
                    {resolvedFormat === 'excel' ? 'Excel (.xlsx)' : resolvedFormat === 'pdf' ? 'PDF (.pdf)' : 'MS Project XML (.xml)'}
                </span>
                <div className="flex gap-2">
                    <button
                        className="rounded px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={isExporting}
                        onClick={handleExport}
                        className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <FileSpreadsheet size={12} />
                        {isExporting ? 'Generando…' : 'Exportar'}
                    </button>
                </div>
            </div>
        </>
    );

    return createPortal(
        <div
            className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-[480px] max-w-[94vw] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-black/50">
                {showSpecialties ? SpecialtiesView : MainView}
            </div>
        </div>,
        document.body,
    );
}