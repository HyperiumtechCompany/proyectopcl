import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    BarChart2, CalendarDays, FileSpreadsheet, FileText,
    Layers, Milestone, X,
} from 'lucide-react';
import type { DelphinRow } from '../types';
import {
    exportDelphin,
    type DelphinExportContent,
    type DelphinExportFormat,
} from '../helpers/exportDelphin';

// ── Opciones de contenido ─────────────────────────────────────────────────────
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

// ── Opciones de formato ───────────────────────────────────────────────────────
const FORMAT_OPTIONS: {
    key: DelphinExportFormat;
    label: string;
    ext: string;
    icon: React.ReactNode;
    onlyGantt?: boolean; // si true → deshabilitado en budget_only
}[] = [
        {
            key: 'excel',
            label: 'Excel',
            ext: '.xlsx',
            icon: <FileSpreadsheet size={14} />,
        },
        {
            key: 'pdf',
            label: 'PDF',
            ext: '.pdf',
            icon: <FileText size={14} />,
        },
        {
            key: 'msp',
            label: 'MS Project',
            ext: '.xml',
            icon: <Milestone size={14} />,
            onlyGantt: true,
        },
    ];

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    open: boolean;
    rows: DelphinRow[];
    projectName: string;
    project?: any;
    projectData?: {  // 👈 AGREGAR ESTO
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
    onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
export function DelphinExportModal({ open, rows, projectName, project, projectData, onClose }: Props) {
    const [content, setContent] = useState<DelphinExportContent>('budget_gantt');
    const [format, setFormat] = useState<DelphinExportFormat>('excel');
    const [isExporting, setExporting] = useState(false);

    if (!open) return null;

    // MS Project no aplica a solo-presupuesto
    const resolvedFormat: DelphinExportFormat =
        format === 'msp' && content === 'budget_only' ? 'excel' : format;

    const handleExport = async () => {
        setExporting(true);
        try {
            await exportDelphin(content, resolvedFormat, rows, projectName, projectData);  // ✅ PASA projectData
        } finally {
            setExporting(false);
            onClose();
        }
    };

    const totalPres = rows
        .filter((r) => (r.nivel ?? 1) === 1)
        .reduce((s, r) => s + (r.parcial || r.metrado * r.precio_unitario || 0), 0);

    return createPortal(
        <div
            className="fixed inset-0 z-9000 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-120 max-w-[94vw] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-black/50">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3.5">
                    <div className="flex items-center gap-2 text-white">
                        <FileSpreadsheet size={16} className="text-emerald-400" />
                        <span className="text-sm font-semibold">Exportar Delphin</span>
                    </div>
                    <button
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        onClick={onClose}
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4 p-5">

                    {/* ── Contenido ── */}
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
                                        type="button"
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
                                        <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-all ${active
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-slate-600 bg-transparent'
                                            }`} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Formato ── */}
                    <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Formato de exportación
                        </p>
                        <div className="flex gap-2">
                            {FORMAT_OPTIONS.map((opt) => {
                                const disabled = opt.onlyGantt && content === 'budget_only';
                                const active = format === opt.key && !disabled;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => !disabled && setFormat(opt.key)}
                                        title={disabled ? 'No disponible para Solo Presupuesto' : opt.label}
                                        className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-35 ${active
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
                        {format === 'msp' && content !== 'budget_only' && (
                            <p className="mt-1.5 text-[10px] text-slate-500">
                                Genera un XML MSPDI importable en Microsoft Project / ProjectLibre.
                            </p>
                        )}
                    </div>

                    {/* ── Stats ── */}
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
                                S/ {totalPres.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-slate-400">Total presupuesto</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-700 px-5 py-3.5">
                    <span className="text-[11px] text-slate-500">
                        {resolvedFormat === 'excel' ? 'Excel (.xlsx)' : resolvedFormat === 'pdf' ? 'PDF (.pdf)' : 'MS Project XML (.xml)'}
                    </span>
                    <div className="flex gap-2">
                        <button
                            className="rounded px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                            onClick={onClose}
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={isExporting}
                            onClick={handleExport}
                            className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FileSpreadsheet size={12} />
                            {isExporting ? 'Generando…' : 'Exportar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
