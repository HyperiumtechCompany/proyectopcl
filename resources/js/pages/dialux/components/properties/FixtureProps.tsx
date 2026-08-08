import { Grid, Layers, Move, Target, Trash2, Ungroup, Zap } from 'lucide-react';
import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { Fixture } from '@/pages/dialux/hooks/useEditorStore';
import { CatalogPanel } from '../CatalogPanel';
import { EditField, PropField, SectionWrapper, SelectField, TextField } from './PropertyFields';

export const FixtureProps: React.FC<{
    fixture: Fixture;
    onUpdate: (patch: Partial<Omit<Fixture, 'id'>>) => void;
    multiple?: boolean;
    count?: number;
}> = ({ fixture, onUpdate, multiple, count }) => {
    const store = useEditorStore();
    const [showModelPicker, setShowModelPicker] = useState(false);
    const targetIds = multiple ? store.ui.selectedFixtureIds : [fixture.id];
    return (
        <SectionWrapper
            icon={<Zap size={12} className="text-amber-400" />}
            label={multiple ? `Luminarias múltiples (${count})` : "Luminaria"}
        >
            <div className="mb-2 flex items-start gap-2 rounded border border-amber-700/50 bg-amber-900/20 p-2">
                <Move
                    size={14}
                    className="mt-0.5 flex-shrink-0 text-amber-400"
                />
                <p className="text-[9px] text-amber-300">
                    {multiple
                        ? "Estás editando múltiples luminarias. Los cambios de posición afectarán a todas por igual."
                        : "Selecciona esta luminaria en el canvas y arrastrala para moverla dentro del recinto."}
                </p>
            </div>

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
                    className="flex flex-1 items-center justify-center gap-2 rounded border border-amber-700/50 bg-amber-950/40 py-1.5 text-[10px] text-amber-200 transition-colors hover:bg-amber-800/40"
                    title={multiple ? "Centrar todas en sus recintos" : "Centrar esta luminaria en el recinto"}
                >
                    <Target size={13} />
                    Centrar
                </button>

                {!multiple && fixture.roomId && (
                    <button
                        type="button"
                        onClick={() => store.setTool('fixture-grid')}
                        className="flex flex-1 items-center justify-center gap-2 rounded border border-emerald-700/30 bg-emerald-950/40 py-1.5 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-900/40"
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
                className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-purple-700/30 bg-purple-950/40 py-1.5 text-[10px] text-purple-200 transition-colors hover:bg-purple-900/40"
                title={multiple ? "Cambiar el modelo de todas las luminarias seleccionadas" : "Cambiar el modelo de esta luminaria"}
            >
                <Layers size={13} />
                {multiple ? `Cambiar modelo (${count})` : 'Cambiar modelo'}
            </button>

            {!multiple && fixture.gridGroupId && (
                <button
                    type="button"
                    onClick={() => onUpdate({ gridGroupId: undefined })}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-sky-700/30 bg-sky-950/40 py-1.5 text-[10px] text-sky-200 transition-colors hover:bg-sky-900/40"
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
                        <CatalogPanel
                            filterCategory="luminaires"
                            variant="compact-grid"
                            fixtureItemsPerPage={15}
                            applyToFixtureIds={targetIds}
                            onSelect={() => setShowModelPicker(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </SectionWrapper>
    );
};
