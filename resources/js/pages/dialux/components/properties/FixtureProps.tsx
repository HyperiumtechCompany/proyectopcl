import { Grid, Layers, Move, Target, Trash2, Ungroup, Zap, Search, X } from 'lucide-react';
import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { reorganizeFixtureGroupPositions, sortFixturesRowMajor } from '@/pages/dialux/hooks/fixtureGridObstacles';
import { suggestFixtureGridSize } from '@/pages/dialux/hooks/fixtureGrid';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { Fixture } from '@/pages/dialux/hooks/useEditorStore';
import { CatalogPanel } from '../CatalogPanel';
import { FixtureFactoryDataSection } from './FixtureFactoryDataSection';
import { EditField, PropField, SectionWrapper, SelectField, TextField } from './PropertyFields';

export const FixtureProps: React.FC<{
    fixture: Fixture;
    onUpdate: (patch: Partial<Omit<Fixture, 'id'>>) => void;
    multiple?: boolean;
    count?: number;
}> = ({ fixture, onUpdate, multiple, count }) => {
    const store = useEditorStore();
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const targetIds = multiple ? store.ui.selectedFixtureIds : [fixture.id];
    const selectionCount = count ?? targetIds.length;

    const initialGrid = suggestFixtureGridSize(1, 1, selectionCount, 1);
    const [orgColumns, setOrgColumns] = useState(initialGrid.columns);
    const [orgRows, setOrgRows] = useState(initialGrid.rows);

    /**
     * "Organización" (Fase X, paridad con DIALux evo): recalcula la posicion
     * de las luminarias YA SELECCIONADAS en una grilla ColumnasxFilas dentro
     * del area que hoy ocupan (su propio bounding box) -- no crea ni borra
     * luminarias, solo reubica las existentes preservando su id (por eso
     * conserva cableado/circuitos ya asignados). Respeta obstaculos
     * estructurales igual que la grilla inicial.
     */
    const handleReorganize = () => {
        const scene = store.activeScene();
        if (!scene) return;
        const selected = scene.fixtures.filter((f) => targetIds.includes(f.id));
        if (selected.length === 0) return;

        // Orden fila-por-fila (y luego x), mismo criterio con el que se
        // generan las posiciones -- asi cada luminaria conserva su lugar
        // relativo dentro de la grilla en vez de saltar a otra fila/columna.
        const sorted = sortFixturesRowMajor(selected);
        const positions = reorganizeFixtureGroupPositions(
            sorted,
            scene.structuralObstacles ?? [],
            orgRows,
            orgColumns,
        );
        if (!positions) {
            alert(
                `${orgColumns}×${orgRows} = ${orgColumns * orgRows} no calza con las ${sorted.length} luminarias seleccionadas.`,
            );
            return;
        }

        store.beginHistoryGesture();
        sorted.forEach((f, i) =>
            store.updateFixture(f.id, {
                x: positions[i].x,
                y: positions[i].y,
                gridRows: orgRows,
                gridColumns: orgColumns,
            }),
        );
        store.endHistoryGesture();
    };

    return (
        <SectionWrapper
            icon={<Zap size={12} className="text-amber-400" />}
            label={multiple ? `Luminarias múltiples (${count})` : "Luminaria"}
        >
            <div className="mb-2 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/20 p-2">
                <Move
                    size={14}
                    className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
                />
                <p className="text-[9px] text-amber-700 dark:text-amber-300">
                    {multiple
                        ? "Estás editando múltiples luminarias. Los cambios de posición afectarán a todas por igual."
                        : "Selecciona esta luminaria en el canvas y arrastrala para moverla dentro del recinto."}
                </p>
            </div>

            {multiple && (
                <div className="mb-3 rounded border border-cyan-300 bg-cyan-50 dark:border-cyan-700/40 dark:bg-cyan-950/20 p-2.5">
                    <div className="mb-2 flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                        <Grid size={12} />
                        <p className="text-[10px] font-semibold uppercase">Organización</p>
                    </div>
                    <PropField label="Posicionamiento según cantidad" value={`Σ ${selectionCount} luminarias`} mono={false} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <EditField label="Columnas (X)" value={orgColumns} min={1} max={20} step={1} onChange={setOrgColumns} />
                        <EditField label="Filas (Y)" value={orgRows} min={1} max={20} step={1} onChange={setOrgRows} />
                    </div>
                    {orgColumns * orgRows !== selectionCount && (
                        <p className="mt-1.5 text-[9px] leading-snug text-amber-400">
                            {orgColumns}×{orgRows} = {orgColumns * orgRows}; hay {selectionCount} luminarias seleccionadas.
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={handleReorganize}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-600/20 dark:text-cyan-300 dark:hover:bg-cyan-600/30 py-1.5 text-[10px] font-medium transition-colors"
                        title="Recalcula la posición de las luminarias seleccionadas en una grilla pareja, dentro del área que ya ocupan"
                    >
                        <Grid size={13} />
                        Reorganizar en grilla {orgColumns}×{orgRows}
                    </button>
                    <button
                        type="button"
                        onClick={() => store.setTool('fixture-grid')}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40 py-1.5 text-[10px] transition-colors"
                        title="Dibuja un área nueva en el plano para proyectar otra grilla de luminarias (no borra la selección actual)"
                    >
                        <Move size={13} />
                        Dibujar nueva área…
                    </button>
                </div>
            )}

            <TextField
                label="Nombre"
                value={fixture.name}
                onChange={(value) => onUpdate({ name: value })}
            />
            <EditField
                label="Lúmenes (lm)"
                value={fixture.lumens}
                min={1}
                max={1000000}
                step={50}
                onChange={(value) => onUpdate({ lumens: value })}
            />
            <EditField
                label="Eficiencia (%)"
                value={Number((fixture.efficiency * 100).toFixed(2))}
                min={0}
                max={100}
                step={1}
                onChange={(value) => onUpdate({ efficiency: value / 100 })}
            />
            <EditField
                label="Potencia (W)"
                value={fixture.power ?? 0}
                min={0}
                max={2000}
                step={1}
                onChange={(value) => onUpdate({ power: value })}
            />
            <EditField
                label="Temperatura (K)"
                value={fixture.cct ?? 0}
                min={0}
                max={20000}
                step={100}
                onChange={(value) => onUpdate({ cct: value || null })}
            />
            <EditField
                label="CRI / Ra"
                value={fixture.cri ?? 0}
                min={0}
                max={100}
                step={1}
                onChange={(value) => onUpdate({ cri: value || null })}
            />

            <EditField
                label="X (m)"
                value={fixture.x}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ x: value })}
            />
            <EditField
                label="Y (m)"
                value={fixture.y}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ y: value })}
            />
            <EditField
                label="Altura instalada S.N.P.T. (m)"
                value={fixture.z ?? fixture.mountingHeight ?? 0}
                min={0}
                max={10}
                step={0.05}
                onChange={(value) =>
                    onUpdate({ z: value, mountingHeight: value })
                }
            />
            <EditField
                label="Rotación (°)"
                value={fixture.rotation ?? 0}
                min={0}
                max={360}
                step={5}
                onChange={(value) => onUpdate({ rotation: ((value % 360) + 360) % 360 })}
            />
            {fixture.photometricWeb?.tilt?.lamp_to_luminaire_geometry === 3 && (
                <>
                    <EditField
                        label="Ángulo de instalación TILT (°)"
                        value={
                            fixture.installationTiltDeg ??
                            fixture.photometricWeb.tilt.angles[0] ??
                            0
                        }
                        min={fixture.photometricWeb.tilt.angles[0] ?? 0}
                        max={fixture.photometricWeb.tilt.angles[fixture.photometricWeb.tilt.angles.length - 1] ?? 90}
                        step={1}
                        onChange={(value) => onUpdate({ installationTiltDeg: value })}
                    />
                    <p className="-mt-1 text-[9px] leading-snug text-slate-400 dark:text-gray-500">
                        {fixture.installationTiltDeg === undefined || fixture.installationTiltDeg === null
                            ? 'Sin definir: no se aplica ningún multiplicador de tilt (factor 1). El valor mostrado es solo referencia.'
                            : 'Multiplicador de tilt aplicado al cálculo según la tabla del archivo IES.'}
                    </p>
                </>
            )}
            <SelectField
                label="Tipo"
                value={fixture.fixtureType ?? 'recessed'}
                options={[
                    { value: 'recessed', label: 'Empotrada' },
                    { value: 'surface', label: 'Superficie' },
                    { value: 'pendant', label: 'Colgante' },
                    { value: 'spot', label: 'Spot' },
                    { value: 'strip', label: 'Tira LED' },
                    { value: 'panel', label: 'Panel LED' },
                    { value: 'tube', label: 'Tubo' },
                ]}
                onChange={(value) =>
                    onUpdate({ fixtureType: value as Fixture['fixtureType'] })
                }
            />
            <SelectField
                label="Forma"
                value={fixture.fixtureShape ?? 'rectangular'}
                options={[
                    { value: 'round', label: 'Redonda' },
                    { value: 'square', label: 'Cuadrada' },
                    { value: 'rectangular', label: 'Rectangular' },
                    { value: 'cylindrical', label: 'Cilindrica' },
                ]}
                onChange={(value) =>
                    onUpdate({ fixtureShape: value as Fixture['fixtureShape'] })
                }
            />

            {/* Geometría de la luminaria (Dimensiones físicas reales) */}
            <div className="my-2 space-y-1.5 border-t border-gray-300 dark:border-gray-800/60 pt-2">
                <p className="text-[9px] font-semibold tracking-wider text-purple-600/80 dark:text-purple-400/80 uppercase">
                    Dimensiones reales
                </p>
                {(() => {
                    const shape = fixture.fixtureShape ?? 'rectangular';
                    const isRound = shape === 'round' || shape === 'cylindrical';
                    
                    // Valores por defecto si la luminaria no tiene dimensiones (usados en OverlayFixtures y 3D)
                    const defaults = {
                        round: { w: 0.2, l: 0.2, h: 0.05, r: 0.1 },
                        square: { w: 0.3, l: 0.3, h: 0.05, r: undefined },
                        rectangular: { w: 0.3, l: 0.6, h: 0.05, r: undefined },
                        cylindrical: { w: 1.2, l: 1.2, h: 0.06, r: 0.6 },
                    };
                    const def = defaults[shape] ?? defaults.rectangular;
                    
                    const updateDim = (key: keyof NonNullable<Fixture['dimensions']>, value: number) => {
                        const current = fixture.dimensions ?? { length: def.l, width: def.w, height: def.h, radius: def.r };
                        onUpdate({ dimensions: { ...current, [key]: value } });
                    };

                    if (isRound) {
                        return (
                            <>
                                <EditField
                                    label="Diámetro (m)"
                                    value={(fixture.dimensions?.radius ?? def.r ?? 0.1) * 2}
                                    min={0.05} max={5} step={0.05}
                                    onChange={(value) => updateDim('radius', value / 2)}
                                />
                                <EditField
                                    label="Alto (m)"
                                    value={fixture.dimensions?.height ?? def.h}
                                    min={0.01} max={5} step={0.01}
                                    onChange={(value) => updateDim('height', value)}
                                />
                            </>
                        );
                    }

                    return (
                        <>
                            <EditField
                                label="Largo (X) (m)"
                                value={fixture.dimensions?.length ?? def.l}
                                min={0.05} max={10} step={0.05}
                                onChange={(value) => updateDim('length', value)}
                            />
                            <EditField
                                label="Ancho (Y) (m)"
                                value={fixture.dimensions?.width ?? def.w}
                                min={0.05} max={10} step={0.05}
                                onChange={(value) => updateDim('width', value)}
                            />
                            <EditField
                                label="Alto (Z) (m)"
                                value={fixture.dimensions?.height ?? def.h}
                                min={0.01} max={5} step={0.01}
                                onChange={(value) => updateDim('height', value)}
                            />
                        </>
                    );
                })()}
            </div>
            {!multiple && <FixtureFactoryDataSection fixture={fixture} />}
            <div className="flex items-center justify-between border-b border-gray-300 dark:border-gray-800/40 pb-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">Color luz</span>
                <input
                    type="color"
                    value={fixture.lightColor ?? '#fff5e1'}
                    onChange={(event) =>
                        onUpdate({ lightColor: event.target.value })
                    }
                    className="h-5 w-8 cursor-pointer rounded border border-gray-300 dark:border-gray-700/50 bg-transparent"
                />
            </div>

            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={() => {
                        if (multiple) {
                            store.ui.selectedFixtureIds.forEach(id => store.centerFixtureInRoom(id));
                        } else {
                            store.centerFixtureInRoom(fixture.id);
                        }
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-800/40 py-1.5 text-[10px] transition-colors"
                    title={multiple ? "Centrar todas en sus recintos" : "Centrar esta luminaria en el recinto"}
                >
                    <Target size={13} />
                    Centrar
                </button>

                {!multiple && fixture.roomId && (
                    <button
                        type="button"
                        onClick={() => store.setTool('fixture-grid')}
                        className="flex flex-1 items-center justify-center gap-2 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40 py-1.5 text-[10px] transition-colors"
                        title="Abrir herramienta de grilla para este recinto"
                    >
                        <Grid size={13} />
                        Nueva Grilla
                    </button>
                )}
            </div>

            <button
                type="button"
                onClick={() => setShowModelPicker(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700/30 dark:bg-purple-950/40 dark:text-purple-200 dark:hover:bg-purple-900/40 py-1.5 text-[10px] transition-colors"
                title={multiple ? "Cambiar el modelo de todas las luminarias seleccionadas" : "Cambiar el modelo de esta luminaria"}
            >
                <Layers size={13} />
                {multiple ? `Cambiar modelo (${count})` : 'Cambiar modelo'}
            </button>

            {!multiple && fixture.gridGroupId && (
                <button
                    type="button"
                    onClick={() => onUpdate({ gridGroupId: undefined })}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-700/30 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/40 py-1.5 text-[10px] transition-colors"
                    title="Separar esta luminaria de su grupo de grilla para editarla de forma independiente"
                >
                    <Ungroup size={13} />
                    Desagrupar
                </button>
            )}

            {multiple && (
                <button
                    type="button"
                    onClick={() => {
                        const groupId = `group-${Date.now()}`;
                        store.updateFixtures(targetIds, { gridGroupId: groupId });
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-sky-700/30 bg-sky-950/40 py-1.5 text-[10px] text-sky-200 transition-colors hover:bg-sky-900/40"
                    title="Agrupar estas luminarias para moverlas/editarlas juntas"
                >
                    <Grid size={13} />
                    Agrupar ({count})
                </button>
            )}

            {!multiple && <PropField label="ID" value={fixture.id.slice(0, 12)} />}

            <button
                type="button"
                onClick={() => {
                    if (multiple) {
                        store.beginHistoryGesture();
                        targetIds.forEach((id) => store.requestDelete(id));
                        store.endHistoryGesture();
                    } else {
                        store.requestDelete(fixture.id);
                    }
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-red-800/40 bg-red-950/30 py-1.5 text-[10px] text-red-400 transition-colors hover:bg-red-900/40 hover:text-red-300"
                title={multiple ? `Eliminar las ${count} luminarias seleccionadas` : 'Eliminar esta luminaria'}
            >
                <Trash2 size={13} />
                {multiple ? `Eliminar (${count})` : 'Eliminar'}
            </button>

            {showModelPicker && (
                <Dialog open={showModelPicker} onOpenChange={setShowModelPicker}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                Cambiar modelo — {multiple ? `${count} luminarias` : fixture.name}
                            </DialogTitle>
                            <DialogDescription>
                                Elige un modelo del catálogo para aplicarlo a {multiple ? 'las luminarias seleccionadas' : 'esta luminaria'}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="relative mb-2">
                            <Search
                                size={14}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
                            />
                            <input
                                type="text"
                                value={modelSearch}
                                onChange={(e) => setModelSearch(e.target.value)}
                                placeholder="Buscar luminaria por nombre o fabricante..."
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-9 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                            />
                            {modelSearch && (
                                <button
                                    type="button"
                                    onClick={() => setModelSearch('')}
                                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <CatalogPanel
                            filterCategory="luminaires"
                            variant="compact-grid"
                            fixtureItemsPerPage={15}
                            applyToFixtureIds={targetIds}
                            search={modelSearch}
                            onSelect={() => setShowModelPicker(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </SectionWrapper>
    );
};
