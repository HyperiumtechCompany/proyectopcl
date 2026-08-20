import React, { useState } from 'react';
import { ChevronDown, Grid, Search, Trash2, X, Zap, Move, AlignCenter } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { FixtureArrangement, Fixture } from '@/pages/dialux/hooks/types';
import { CatalogPanel } from '../CatalogPanel';
import { EditField, PropField } from './PropertyFields';

// ── Acordeón simple sin dependencia de shadcn/ui ──────────────────────────────
function Accordion({
    title,
    icon,
    defaultOpen = true,
    children,
}: {
    title: string;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-200 dark:border-gray-800 last:border-0">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-1.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
            >
                {icon}
                <span className="flex-1">{title}</span>
                <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && <div className="pb-3 pt-1 space-y-2">{children}</div>}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export const ArrangementProps: React.FC<{
    arrangement: FixtureArrangement;
}> = ({ arrangement }) => {
    const store = useEditorStore();
    const scene = store.activeScene();

    // Luminaria base: primer hijo vivo del arreglo
    const firstFixture = scene?.fixtures.find(
        (f) => f.arrangementId === arrangement.id,
    );

    const config = arrangement.config;
    const [cols, setCols] = useState(config.columns);
    const [rows, setRows] = useState(config.rows);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const totalFixtures = arrangement.fixtureIds.length;

    const handleApply = () => {
        if (!firstFixture) return;
        const {
            id,
            x,
            y,
            z,
            arrangementId,
            gridGroupId,
            gridRows,
            gridColumns,
            ...templateProps
        } = firstFixture as any;
        store.updateFixtureArrangement(arrangement.id, {
            ...config,
            rows,
            columns: cols,
            fixtureTemplate: templateProps as Partial<Fixture>,
        });
    };

    const handleDelete = () => {
        store.removeFixtureArrangement(arrangement.id);
        store.setSelectedId(null);
    };

    // Información de la luminaria activa
    const fixtureName = firstFixture?.name ?? '—';
    const fixtureLumens = firstFixture?.lumens ?? config.fixtureTemplate?.lumens ?? 0;
    const fixturePower = firstFixture?.power ?? config.fixtureTemplate?.power ?? null;

    return (
        <div className="space-y-0 divide-y divide-gray-200 dark:divide-gray-800">
            {/* ── Encabezado: Luminaria activa (como DIALux) ── */}
            <div className="pb-3 pt-1">
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                    Luminaria activa
                </p>
                <div className="rounded border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-2 space-y-1">
                    <p className="text-[10px] font-medium text-slate-800 dark:text-gray-200 leading-snug">
                        {fixtureName}
                    </p>
                    <div className="flex gap-3 text-[9px] text-slate-500 dark:text-gray-500">
                        {fixtureLumens > 0 && (
                            <span>{fixtureLumens.toLocaleString()} lm</span>
                        )}
                        {fixturePower && <span>{fixturePower} W</span>}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowModelPicker(true)}
                        className="mt-1 w-full rounded border border-amber-300/60 bg-white dark:bg-gray-900 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    >
                        Cambiar luminaria…
                    </button>
                </div>
            </div>

            {/* ── Acordeón: Organización (Distribución) ── */}
            <Accordion
                title="Organización"
                icon={<Grid size={11} className="text-cyan-400" />}
                defaultOpen={true}
            >
                <PropField
                    label="Posicionamiento según cantidad"
                    value={`Σ ${totalFixtures} luminarias`}
                    mono={false}
                />
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <p className="mb-0.5 text-[9px] text-slate-500 dark:text-gray-500">
                            Cantidad X
                        </p>
                        <EditField
                            label="Columnas"
                            value={cols}
                            min={1}
                            max={20}
                            step={1}
                            onChange={setCols}
                        />
                    </div>
                    <div>
                        <p className="mb-0.5 text-[9px] text-slate-500 dark:text-gray-500">
                            Cantidad Y
                        </p>
                        <EditField
                            label="Filas"
                            value={rows}
                            min={1}
                            max={20}
                            step={1}
                            onChange={setRows}
                        />
                    </div>
                </div>
                {cols * rows !== totalFixtures && (
                    <p className="text-[9px] text-amber-400">
                        {cols}×{rows} = {cols * rows} luminarias (actual: {totalFixtures})
                    </p>
                )}
                <button
                    type="button"
                    onClick={handleApply}
                    className="flex w-full items-center justify-center gap-1.5 rounded bg-cyan-600 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-cyan-700 dark:bg-cyan-700 dark:hover:bg-cyan-600"
                >
                    <Grid size={12} />
                    Reorganizar {cols}×{rows}
                </button>
            </Accordion>

            {/* ── Acordeón: Posición (altura de montaje) ── */}
            {firstFixture && (
                <Accordion
                    title="Posición"
                    icon={<Move size={11} className="text-purple-400" />}
                    defaultOpen={false}
                >
                    <EditField
                        label="Altura instalada S.N.P.T. (m)"
                        value={firstFixture.z ?? firstFixture.mountingHeight ?? 0}
                        min={0}
                        max={10}
                        step={0.05}
                        onChange={(value) => {
                            arrangement.fixtureIds.forEach((fid) => {
                                store.updateFixture(fid, { z: value, mountingHeight: value });
                            });
                        }}
                    />
                    <EditField
                        label="Rotación (°)"
                        value={firstFixture.rotation ?? 0}
                        min={0}
                        max={360}
                        step={5}
                        onChange={(value) => {
                            const normalized = ((value % 360) + 360) % 360;
                            arrangement.fixtureIds.forEach((fid) => {
                                store.updateFixture(fid, { rotation: normalized });
                            });
                        }}
                    />
                </Accordion>
            )}

            {/* ── Acordeón: Propiedades fotométricas ── */}
            {firstFixture && (
                <Accordion
                    title="Propiedades"
                    icon={<Zap size={11} className="text-yellow-400" />}
                    defaultOpen={false}
                >
                    <EditField
                        label="Lúmenes (lm)"
                        value={firstFixture.lumens}
                        min={1}
                        max={1000000}
                        step={50}
                        onChange={(value) => {
                            arrangement.fixtureIds.forEach((fid) => {
                                store.updateFixture(fid, { lumens: value });
                            });
                        }}
                    />
                    <EditField
                        label="Potencia (W)"
                        value={firstFixture.power ?? 0}
                        min={0}
                        max={2000}
                        step={1}
                        onChange={(value) => {
                            arrangement.fixtureIds.forEach((fid) => {
                                store.updateFixture(fid, { power: value });
                            });
                        }}
                    />
                    <EditField
                        label="Eficiencia (%)"
                        value={Number((firstFixture.efficiency * 100).toFixed(2))}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(value) => {
                            arrangement.fixtureIds.forEach((fid) => {
                                store.updateFixture(fid, { efficiency: value / 100 });
                            });
                        }}
                    />
                </Accordion>
            )}

            {/* ── Eliminar proyección ── */}
            <div className="pt-3">
                <button
                    type="button"
                    onClick={handleDelete}
                    className="flex w-full items-center justify-center gap-1.5 rounded border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 py-1.5 text-[10px] text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                    <Trash2 size={12} /> Eliminar proyección
                </button>
            </div>

            {/* ── Modal de selección de luminaria ── */}
            {showModelPicker && (
                <Dialog open={showModelPicker} onOpenChange={setShowModelPicker}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Cambiar modelo de luminaria</DialogTitle>
                            <DialogDescription>
                                Reemplazará todas las luminarias de esta proyección.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="relative mb-2">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                <Search size={12} className="text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar luminarias..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 pl-6 pr-2 text-[10px] text-slate-700 dark:text-gray-200 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                        <CatalogPanel
                            filterCategory="luminaires"
                            variant="compact-grid"
                            search={searchTerm}
                            fixtureItemsPerPage={15}
                            applyToFixtureIds={arrangement.fixtureIds}
                            onSelect={() => setShowModelPicker(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};
