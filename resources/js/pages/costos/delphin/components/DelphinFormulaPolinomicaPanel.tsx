import type { ACURowSummary } from '@/types/presupuestos';
import { Calculator, GitMerge, Globe } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { FormulaPolinomica } from '../../presupuesto/components/formula_polinomica';
import type { DelphinRow } from '../types';

interface Props {
    projectId: number;
    projectName: string;
    rows: DelphinRow[];
    acuRows: ACURowSummary[];
}

function getSubtree(rows: DelphinRow[], rootId: number): DelphinRow[] {
    const byParent = new Map<number, DelphinRow[]>();
    for (const r of rows) {
        const pid = r.parent_id;
        if (pid !== null && pid !== undefined) {
            const k = Number(pid);
            if (!byParent.has(k)) byParent.set(k, []);
            byParent.get(k)!.push(r);
        }
    }
    const result: DelphinRow[] = [];
    const queue = [rootId];
    while (queue.length) {
        const id = queue.shift()!;
        for (const child of byParent.get(id) ?? []) {
            result.push(child);
            queue.push(child.id);
        }
    }
    return result;
}

type TabMode = 'global' | 'fusion' | number;

function Tab({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                active
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
        >
            {children}
        </button>
    );
}

function SubTab({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex shrink-0 items-center whitespace-nowrap rounded px-2 py-0.5 text-[9px] font-medium transition-colors ${
                active
                    ? 'bg-sky-700 text-white'
                    : 'bg-slate-800/60 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
            }`}
        >
            {children}
        </button>
    );
}

export function DelphinFormulaPolinomicaPanel({
    projectId,
    projectName,
    rows,
    acuRows,
}: Props) {
    // Top-level parents (specialties)
    const specialties = useMemo(
        () => rows.filter((r) => r.parent_id == null),
        [rows],
    );

    // Set of all IDs that are parents (have at least one child)
    const parentIdSet = useMemo(() => {
        const ids = new Set<number>();
        for (const r of rows) {
            if (r.parent_id != null) ids.add(Number(r.parent_id));
        }
        return ids;
    }, [rows]);

    const [activeTab, setActiveTab] = useState<TabMode>('global');
    const [fusionIds, setFusionIds] = useState<number[]>([]);
    const [activeSubParent, setActiveSubParent] = useState<number | 'all'>('all');

    // Reset sub-parent whenever the specialty tab changes
    useEffect(() => { setActiveSubParent('all'); }, [activeTab]);

    // Direct children of the selected specialty that are themselves parents
    const subParents = useMemo(() => {
        if (typeof activeTab !== 'number') return [];
        return rows.filter(
            (r) => r.parent_id === activeTab && parentIdSet.has(r.id),
        );
    }, [activeTab, rows, parentIdSet]);

    const toggleFusion = (id: number) =>
        setFusionIds((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : prev.length < 2
                ? [...prev, id]
                : prev,
        );

    const filteredRows = useMemo<DelphinRow[]>(() => {
        if (activeTab === 'global') return rows;
        if (activeTab === 'fusion') {
            const out: DelphinRow[] = [];
            for (const id of fusionIds) {
                const root = rows.find((r) => r.id === id);
                if (root) out.push(root, ...getSubtree(rows, id));
            }
            return out;
        }
        const root = rows.find((r) => r.id === (activeTab as number));
        if (!root) return [];
        const specialtyRows = [root, ...getSubtree(rows, activeTab as number)];
        if (activeSubParent === 'all') return specialtyRows;
        const subRoot = rows.find((r) => r.id === activeSubParent);
        if (!subRoot) return specialtyRows;
        return [subRoot, ...getSubtree(rows, activeSubParent)];
    }, [activeTab, activeSubParent, rows, fusionIds]);

    const totalPresupuesto = useMemo(
        () => rows.reduce((s, r) => s + Number(r.parcial ?? 0), 0),
        [rows],
    );

    const activeLabel =
        activeTab === 'global'
            ? null
            : activeTab === 'fusion'
            ? 'Fusión de especialidades'
            : specialties.find((s) => s.id === activeTab)?.descripcion ?? null;

    const subLabel =
        typeof activeTab === 'number' && activeSubParent !== 'all'
            ? rows.find((r) => r.id === activeSubParent)?.descripcion ?? null
            : null;

    const formulaKey =
        activeTab === 'fusion'
            ? `fusion-${[...fusionIds].sort().join(',')}`
            : activeSubParent !== 'all'
            ? `${activeTab}-sub-${activeSubParent}`
            : String(activeTab);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-900">
            {/* Header */}
            <div className="shrink-0 border-b border-slate-700 px-4 py-2.5">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-100">
                        <Calculator size={15} className="shrink-0 text-emerald-400" />
                        Fórmula Polinómica
                        {activeLabel && (
                            <span className="min-w-0 truncate text-xs font-normal text-slate-400">
                                — {activeLabel}
                            </span>
                        )}
                        {subLabel && (
                            <span className="min-w-0 truncate text-xs font-normal text-sky-400">
                                › {subLabel}
                            </span>
                        )}
                    </h2>
                    <div className="shrink-0 rounded border border-slate-800 bg-slate-950 px-3 py-1 text-right">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">
                            Total proyecto
                        </p>
                        <p className="font-mono text-xs font-semibold text-emerald-300">
                            S/{' '}
                            {totalPresupuesto.toLocaleString('es-PE', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Especialidad tabs */}
            <div className="shrink-0 border-b border-slate-700 bg-slate-900/60">
                <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <Tab
                        active={activeTab === 'global'}
                        onClick={() => setActiveTab('global')}
                    >
                        <Globe size={10} /> Global
                    </Tab>
                    <Tab
                        active={activeTab === 'fusion'}
                        onClick={() => {
                            setActiveTab('fusion');
                            setFusionIds([]);
                        }}
                    >
                        <GitMerge size={10} /> Fusión
                    </Tab>
                    {specialties.length > 0 && (
                        <div className="mx-1.5 h-4 w-px shrink-0 bg-slate-700" />
                    )}
                    {specialties.map((sp, i) => (
                        <Tab
                            key={sp.id}
                            active={activeTab === sp.id}
                            onClick={() => setActiveTab(sp.id)}
                        >
                            {i + 1}.{' '}
                            {sp.descripcion.length > 22
                                ? sp.descripcion.slice(0, 22) + '…'
                                : sp.descripcion}
                        </Tab>
                    ))}
                </div>
            </div>

            {/* Sub-parent selector — only when a specialty is selected and has intermediate parents */}
            {typeof activeTab === 'number' && subParents.length > 0 && (
                <div className="shrink-0 border-b border-slate-700 bg-slate-950/50 px-3 py-1.5">
                    <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <span className="mr-1.5 shrink-0 text-[9px] uppercase tracking-wider text-slate-600">
                            Partida
                        </span>
                        <SubTab
                            active={activeSubParent === 'all'}
                            onClick={() => setActiveSubParent('all')}
                        >
                            Todos
                        </SubTab>
                        {subParents.map((sp) => (
                            <SubTab
                                key={sp.id}
                                active={activeSubParent === sp.id}
                                onClick={() => setActiveSubParent(sp.id)}
                            >
                                {sp.partida
                                    ? `${sp.partida} `
                                    : ''}
                                {sp.descripcion.length > 28
                                    ? sp.descripcion.slice(0, 28) + '…'
                                    : sp.descripcion}
                            </SubTab>
                        ))}
                    </div>
                </div>
            )}

            {/* Fusion picker */}
            {activeTab === 'fusion' && (
                <div className="shrink-0 border-b border-slate-700 bg-slate-950/40 px-4 py-2">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Especialidades a fusionar{' '}
                        <span className="font-normal normal-case text-slate-600">
                            (máx. 2)
                        </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {specialties.map((sp, i) => {
                            const idx = fusionIds.indexOf(sp.id);
                            const selected = idx >= 0;
                            const disabled = !selected && fusionIds.length >= 2;
                            return (
                                <button
                                    key={sp.id}
                                    disabled={disabled}
                                    onClick={() => toggleFusion(sp.id)}
                                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        idx === 0
                                            ? 'bg-sky-600 text-white'
                                            : idx === 1
                                            ? 'bg-amber-600 text-white'
                                            : disabled
                                            ? 'cursor-not-allowed bg-slate-800 text-slate-600 opacity-40'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {selected ? `[${idx + 1}] ` : ''}
                                    {i + 1}.{' '}
                                    {sp.descripcion.length > 30
                                        ? sp.descripcion.slice(0, 30) + '…'
                                        : sp.descripcion}
                                </button>
                            );
                        })}
                    </div>
                    {fusionIds.length === 0 && (
                        <p className="mt-1.5 text-[10px] text-slate-600">
                            Selecciona especialidades arriba para ver su fórmula
                            fusionada.
                        </p>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-auto p-4">
                {activeTab === 'fusion' && fusionIds.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center rounded border border-dashed border-slate-700 p-8 text-center">
                        <GitMerge size={28} className="mb-2 text-slate-600" />
                        <p className="text-sm font-medium text-slate-300">
                            Selecciona especialidades para fusionar
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                            Elige 1 ó 2 especialidades en el panel de arriba.
                        </p>
                    </div>
                ) : (
                    <div className="rounded border border-slate-800 bg-slate-950 p-4">
                        <FormulaPolinomica
                            key={formulaKey}
                            rows={filteredRows}
                            acuRows={acuRows}
                            projectName={projectName}
                        />
                    </div>
                )}
            </div>

            <div className="shrink-0 border-t border-slate-800 px-4 py-1.5 text-[10px] text-slate-600">
                Proyecto #{projectId} · DS 011-79-VC: máx. 8 monomios · Σ coef. = 1 · coef. mín. 0.05
            </div>
        </div>
    );
}
