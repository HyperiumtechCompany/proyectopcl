import {
    X,
    Plus,
    Trash2,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Loader2,
    Save,
} from 'lucide-react';
import React, { useEffect, useRef, useCallback } from 'react';
import type { SupervisionGGDetalleRow } from '../stores/supervisionGGDetalleStore';
import { useSupervisionGGDetalleStore } from '../stores/supervisionGGDetalleStore';

const fmt = (n: number) => new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n);

// ─── Row Component ─────────────────────────────────────────────────────────────

interface DetailRowProps {
    row: SupervisionGGDetalleRow;
    sectionIdx: number;
    rowIdx: number;
    onRemove: () => void;
}

const DetailRow: React.FC<DetailRowProps> = ({ row, sectionIdx, rowIdx, onRemove }) => {
    const updateCell = useSupervisionGGDetalleStore((s) => s.updateCell);

    const handleChange = (field: keyof SupervisionGGDetalleRow, raw: string) => {
        const num = parseFloat(raw);
        updateCell(sectionIdx, rowIdx, field, isNaN(num) ? 0 : num);
    };

    return (
        <tr className="group border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors">
            <td className="py-1 px-4 pl-10">
                <input
                    type="text"
                    value={row.concepto ?? ''}
                    onChange={(e) => updateCell(sectionIdx, rowIdx, 'concepto', e.target.value)}
                    className="w-full bg-transparent border-none text-[11px] text-slate-200 focus:ring-1 focus:ring-sky-500 rounded px-1 py-0.5"
                    placeholder="Concepto..."
                />
            </td>
            <td className="py-1 px-2 text-center">
                <input
                    type="text"
                    value={row.unidad ?? ''}
                    onChange={(e) => updateCell(sectionIdx, rowIdx, 'unidad', e.target.value)}
                    className="w-14 bg-transparent border-none text-[10px] text-center text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1"
                    placeholder="und"
                />
            </td>
            <td className="py-1 px-2 text-center">
                <input
                    type="number"
                    value={row.cantidad ?? ''}
                    onChange={(e) => handleChange('cantidad', e.target.value)}
                    className="w-16 bg-transparent border border-slate-700/50 text-[10px] text-center text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1 focus:bg-slate-800"
                />
            </td>
            <td className="py-1 px-2 text-center">
                <input
                    type="number"
                    value={row.meses ?? ''}
                    onChange={(e) => handleChange('meses', e.target.value)}
                    className="w-16 bg-transparent border border-slate-700/50 text-[10px] text-center text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1 focus:bg-slate-800"
                />
            </td>
            <td className="py-1 px-3 text-right">
                <input
                    type="number"
                    value={row.importe ?? ''}
                    onChange={(e) => handleChange('importe', e.target.value)}
                    className="w-28 bg-transparent border border-slate-700/50 text-[10px] text-right text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1 focus:bg-slate-800"
                />
            </td>
            <td className="py-1 px-3 text-right">
                <span className="text-[10px] font-mono text-slate-400">{fmt(row.subtotal)}</span>
            </td>
            <td className="py-1 px-3 text-center">
                <button
                    onClick={onRemove}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all"
                >
                    <Trash2 size={12} />
                </button>
            </td>
        </tr>
    );
};

// ─── Section Component ─────────────────────────────────────────────────────────

interface SectionProps {
    section: SupervisionGGDetalleRow;
    sectionIdx: number;
    onRemove: () => void;
}

const SectionComponent: React.FC<SectionProps> = ({ section, sectionIdx, onRemove }) => {
    const [expanded, setExpanded] = React.useState(true);
    const addRow = useSupervisionGGDetalleStore((s) => s.addRow);
    const removeRow = useSupervisionGGDetalleStore((s) => s.removeRow);
    const updateCell = useSupervisionGGDetalleStore((s) => s.updateCell);

    return (
        <>
            {/* Section Header row */}
            <tr className="bg-sky-900/30 border-b border-sky-500/20 group/sec">
                <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="p-0.5 rounded hover:bg-white/10 text-slate-500"
                        >
                            {expanded
                                ? <ChevronDown size={13} />
                                : <ChevronRight size={13} />}
                        </button>
                        <input
                            type="text"
                            value={section.concepto ?? ''}
                            onChange={(e) => updateCell(sectionIdx, -1, 'concepto', e.target.value)}
                            className="flex-1 bg-transparent border-none text-[11px] font-bold text-sky-300 uppercase tracking-wide focus:ring-1 focus:ring-sky-500 rounded px-1"
                        />
                    </div>
                </td>
                <td colSpan={4} />
                <td className="py-2 px-3 text-right">
                    <span className="text-[11px] font-black font-mono text-sky-300">
                        {fmt(section.total_seccion)}
                    </span>
                </td>
                <td className="py-2 px-3 text-center">
                    <button
                        onClick={onRemove}
                        className="opacity-0 group-hover/sec:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all"
                        title="Eliminar Sección"
                    >
                        <Trash2 size={13} />
                    </button>
                </td>
            </tr>

            {/* Detail rows */}
            {expanded && (section.hijos || []).map((row, rowIdx) => (
                <DetailRow
                    key={rowIdx}
                    row={row}
                    sectionIdx={sectionIdx}
                    rowIdx={rowIdx}
                    onRemove={() => removeRow(sectionIdx, rowIdx)}
                />
            ))}

            {/* Add row button */}
            {expanded && (
                <tr>
                    <td colSpan={7} className="py-1 px-10 border-b border-slate-800/30">
                        <button
                            onClick={() => addRow(sectionIdx)}
                            className="flex items-center gap-1 text-[10px] text-sky-500 hover:text-sky-300 transition-colors py-0.5"
                        >
                            <Plus size={11} />
                            Agregar partida
                        </button>
                    </td>
                </tr>
            )}
        </>
    );
};

// ─── Main Modal ────────────────────────────────────────────────────────────────

interface SupervisionGGDetalleModalProps {
    open: boolean;
    onClose: () => void;
    projectId: number;
    /** Called when the detail total changes so the parent panel can update Section IV */
    onTotalChange: (total: number) => void;
}

const DEBOUNCE_MS = 1200;

export function SupervisionGGDetalleModal({
    open,
    onClose,
    projectId,
    onTotalChange,
}: SupervisionGGDetalleModalProps) {
    const sections    = useSupervisionGGDetalleStore((s) => s.sections);
    const totalGlobal = useSupervisionGGDetalleStore((s) => s.totalGlobal);
    const loading     = useSupervisionGGDetalleStore((s) => s.loading);
    const isSaving    = useSupervisionGGDetalleStore((s) => s.isSaving);
    const setProjectId    = useSupervisionGGDetalleStore((s) => s.setProjectId);
    const loadFromDatabase = useSupervisionGGDetalleStore((s) => s.loadFromDatabase);
    const saveToDatabase   = useSupervisionGGDetalleStore((s) => s.saveToDatabase);
    const addSection       = useSupervisionGGDetalleStore((s) => s.addSection);
    const removeSection    = useSupervisionGGDetalleStore((s) => s.removeSection);

    // ── Load on open ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (open && projectId) {
            setProjectId(projectId);
            loadFromDatabase(projectId);
        }
    }, [open, projectId]);

    // ── Auto-save on debounce ─────────────────────────────────────────────────
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const total = await saveToDatabase();
            onTotalChange(total);
        }, DEBOUNCE_MS);
    }, [saveToDatabase, onTotalChange]);

    // Watch totalGlobal changes to trigger auto-save
    const prevTotalRef = useRef<number>(totalGlobal);
    useEffect(() => {
        if (!open) return;
        if (loading) return;
        if (prevTotalRef.current !== totalGlobal) {
            prevTotalRef.current = totalGlobal;
            scheduleSave();
        }
    }, [totalGlobal, open, loading, scheduleSave]);

    // Also watch sections change (for text fields that don't affect total)
    const sectionsKey = JSON.stringify(sections.map(s => [s.concepto, (s.hijos || []).map(h => h.concepto)]));
    const prevSectionsKeyRef = useRef(sectionsKey);
    useEffect(() => {
        if (!open || loading) return;
        if (prevSectionsKeyRef.current !== sectionsKey) {
            prevSectionsKeyRef.current = sectionsKey;
            scheduleSave();
        }
    }, [sectionsKey, open, loading, scheduleSave]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950 border border-slate-700 shadow-2xl overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <ClipboardList className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-wide">
                                Detalle de Gastos Generales de Supervisión
                            </h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                Sección IV — Resumen de Costos
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isSaving && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
                                <Loader2 size={12} className="animate-spin" />
                                Guardando...
                            </div>
                        )}
                        {!isSaving && !loading && (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                                <Save size={12} />
                                Auto-guardado
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-48 gap-3 text-slate-500">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-sm">Cargando datos...</span>
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md shadow border-b border-slate-700">
                                <tr>
                                    <th className="py-2.5 px-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-[340px]">Concepto</th>
                                    <th className="py-2.5 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[70px]">Unidad</th>
                                    <th className="py-2.5 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[70px]">Cantidad</th>
                                    <th className="py-2.5 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px]">T. Meses</th>
                                    <th className="py-2.5 px-3 text-right  text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">Importe S/.</th>
                                    <th className="py-2.5 px-3 text-right  text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">Subtotal S/.</th>
                                    <th className="py-2.5 px-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[50px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {/* Section I — Detalle de Gastos Generales title row */}
                                <tr className="bg-slate-800/40 border-b border-slate-700/50">
                                    <td colSpan={5} className="py-2 px-4">
                                        <span className="text-[11px] font-black text-slate-200 uppercase tracking-wider">
                                            I. DETALLE DE GASTOS GENERALES
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <span className="text-[11px] font-black font-mono text-amber-400">
                                            {fmt(totalGlobal)}
                                        </span>
                                    </td>
                                    <td />
                                </tr>

                                {/* Sections A, B, C... */}
                                {sections.map((section, sectionIdx) => (
                                    <SectionComponent
                                        key={sectionIdx}
                                        section={section}
                                        sectionIdx={sectionIdx}
                                        onRemove={() => removeSection(sectionIdx)}
                                    />
                                ))}

                                {/* Add Section Row */}
                                <tr>
                                    <td colSpan={7} className="py-4 px-6 bg-slate-900/40">
                                        <button
                                            onClick={addSection}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 transition-all text-xs font-bold uppercase tracking-wider"
                                        >
                                            <Plus size={14} />
                                            Agregar Nueva Sección (A, B, C...)
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Footer total ── */}
                <div className="flex-shrink-0 border-t border-amber-500/30 bg-amber-900/20 px-6 py-3 flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
                        VIII. TOTAL GASTOS GENERALES
                    </span>
                    <span className="text-xl font-black text-amber-400 font-mono tracking-tighter">
                        S/. {fmt(totalGlobal)}
                    </span>
                </div>
            </div>
        </div>
    );
}
