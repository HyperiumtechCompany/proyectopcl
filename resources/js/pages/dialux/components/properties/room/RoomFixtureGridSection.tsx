import { Layers, Move, Zap } from 'lucide-react';
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CatalogPanel } from '@/pages/dialux/components/CatalogPanel';
import { estimatePhotometricFixtureQuantity, polygonBBox, suggestFixtureGridSize } from '@/pages/dialux/hooks/fixtureGrid';
import { calculateExactQuantity, calculateRoundedQuantity } from '@/pages/dialux/hooks/lightingCalculations';
import type { Fixture, Room, Vertex } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { EditField } from '../PropertyFields';

/**
 * Sección "Generar Grilla de Focos" de `RoomProps.tsx` (Fase 2, extracción
 * sin cambiar comportamiento) — solo se renderiza para ambientes/pasadizos.
 * Mantiene su propio estado local (filas/columnas/picker), que en el
 * componente original era independiente del ajuste global de la
 * herramienta "fixture-grid" del canvas.
 */
export function RoomFixtureGridSection({
    room,
    calculationVertices,
    lumensRequired,
    fixtureLumensFallback,
    fixturesInRoom,
    calculationRoomId,
    targetLux,
}: {
    room: Room;
    calculationVertices: Vertex[];
    /** Total de lúmenes que exige la normativa para todo el ambiente (`inputs.lumensRequired`). */
    lumensRequired: number;
    /** Lúmenes por luminaria a usar si no hay ninguna elegida en el picker (`inputs.fixtureLumens`). */
    fixtureLumensFallback: number;
    fixturesInRoom: Fixture[];
    calculationRoomId: string;
    targetLux: number;
}) {
    const store = useEditorStore();
    const [gridRows, setGridRows] = React.useState(store.ui.fixtureGridRows);
    const [gridCols, setGridCols] = React.useState(store.ui.fixtureGridCols);
    const [showGridFixturePicker, setShowGridFixturePicker] = React.useState(false);
    // Elegir un modelo en el picker de esta sección solo debe leer sus lúmenes
    // para el cálculo de la grilla — no debe dejar la herramienta activa en
    // "fixture" (eso es lo que hace CatalogPanel.setFixture normalmente, para
    // el flujo de "colocar una luminaria" del panel Luz de la barra). Sin
    // restaurar la herramienta previa, tras elegir un modelo aquí el usuario
    // ya no podía seleccionar luminarias existentes en el canvas (el
    // hit-testing de selección solo actúa con activeTool === 'select').
    const toolBeforeGridPickerRef = React.useRef(store.ui.activeTool);

    const gridFixture = store.ui.fixtureTemplate;
    const gridFixtureLumens = gridFixture.lumens ?? fixtureLumensFallback;
    const gridExactQuantity = calculateExactQuantity(lumensRequired, gridFixtureLumens);
    const lastResult = store.resultsByRoom[calculationRoomId];
    const gridRoundedQuantity = lastResult
        ? estimatePhotometricFixtureQuantity(
              fixturesInRoom.length,
              lastResult.avg_lux,
              targetLux,
              gridExactQuantity,
          ).rounded
        : calculateRoundedQuantity(gridExactQuantity);

    // Sugerencia de grilla: cuántas filas/columnas hacen falta para llegar a
    // la cantidad exigida (con la luminaria elegida) sin cambiar de forma la
    // grilla actual más de lo necesario.
    const gridBBox = polygonBBox(calculationVertices);
    const gridAspectRatio = gridBBox.height > 0 ? gridBBox.width / gridBBox.height : 1;
    const suggestedGrid = suggestFixtureGridSize(gridRows, gridCols, gridRoundedQuantity, gridAspectRatio);
    const gridCountMismatch = gridRows * gridCols !== gridRoundedQuantity;
    // Se usa SIEMPRE la cantidad ingresada por el usuario. La sugerencia es solo visual.
    const generationGrid = { rows: gridRows, columns: gridCols };

    // Editor de líneas guía: borrador de UI (ver uiSlice.ts), no persiste
    // nada hasta que se confirma con "Generar". Se re-sincroniza solo cuando
    // cambia la cantidad de filas/columnas MIENTRAS está abierto, para que la
    // cantidad de líneas siempre calce con `generationGrid`.
    const guideEditor = store.ui.fixtureGridGuideEditor;
    const isGuideEditorOpenHere = guideEditor?.roomId === room.id;
    React.useEffect(() => {
        if (!isGuideEditorOpenHere) return;
        if (guideEditor!.rows === generationGrid.rows && guideEditor!.columns === generationGrid.columns) return;
        store.openFixtureGridGuideEditor(room.id, generationGrid.rows, generationGrid.columns, calculationVertices);
        // Solo debe reaccionar a cambios de la cantidad objetivo, no reabrir
        // en cada render por una nueva identidad de `calculationVertices`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGuideEditorOpenHere, generationGrid.rows, generationGrid.columns]);

    // Cierra el editor si el usuario cambia de selección (deja de ver este room).
    React.useEffect(() => {
        return () => {
            if (store.ui.fixtureGridGuideEditor?.roomId === room.id) {
                store.closeFixtureGridGuideEditor();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.id]);

    return (
        <div className="mt-4 border-t border-gray-300 dark:border-gray-800/80 pt-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
                <Zap size={12} />
                <p className="text-[10px] font-semibold uppercase">Generar Grilla de Focos</p>
            </div>
            <button
                type="button"
                onClick={() => {
                    toolBeforeGridPickerRef.current = store.ui.activeTool;
                    setShowGridFixturePicker(true);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded border border-purple-300 bg-purple-50 px-2 py-1.5 text-left transition-colors hover:bg-purple-100 dark:border-purple-700/30 dark:bg-purple-950/30 dark:hover:bg-purple-900/30"
                title="Elegir el tipo de foco a instalar en esta grilla"
            >
                <Layers size={12} className="shrink-0 text-purple-600 dark:text-purple-300" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-purple-900 dark:text-purple-200">{gridFixture.name ?? 'Foco genérico'}</span>
                    <span className="block text-[9px] leading-none text-slate-500 dark:text-gray-500">{gridFixtureLumens.toLocaleString()} lm</span>
                </span>
                <span className="shrink-0 text-[9px] text-purple-600 dark:text-purple-400">Cambiar</span>
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <EditField label="Filas" value={gridRows} min={1} max={20} step={1} onChange={setGridRows} />
                <EditField label="Columnas" value={gridCols} min={1} max={20} step={1} onChange={setGridCols} />
            </div>
            {gridCountMismatch && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5">
                    <span className="text-[9px] leading-snug text-amber-700 dark:text-amber-400">
                        {gridRows}×{gridCols} = {gridRows * gridCols}; el cálculo recomienda {gridRoundedQuantity} con "
                        {gridFixture.name ?? 'este foco'}" ({gridFixtureLumens.toLocaleString()} lm)
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setGridRows(suggestedGrid.rows);
                            setGridCols(suggestedGrid.columns);
                        }}
                        className="shrink-0 rounded bg-amber-100 dark:bg-amber-600/30 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-600/50"
                    >
                        Usar {suggestedGrid.rows}×{suggestedGrid.columns}
                    </button>
                </div>
            )}
            <button
                type="button"
                onClick={() => {
                    if (isGuideEditorOpenHere) {
                        store.closeFixtureGridGuideEditor();
                    } else {
                        store.openFixtureGridGuideEditor(
                            room.id,
                            generationGrid.rows,
                            generationGrid.columns,
                            calculationVertices,
                        );
                    }
                }}
                className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded border py-1.5 text-[10px] font-medium transition-colors ${
                    isGuideEditorOpenHere
                        ? 'border-cyan-400 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:border-cyan-500 dark:bg-cyan-600/20 dark:text-cyan-300 dark:hover:bg-cyan-600/30'
                        : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-gray-700/50 dark:bg-gray-800/60 dark:text-gray-400 dark:hover:bg-gray-700/60'
                }`}
                title="Arrastra las líneas en el plano para alinear cada celda con una viga u otra división real, en vez de repartir la grilla pareja"
            >
                <Move size={12} />
                {isGuideEditorOpenHere ? 'Cerrar líneas guía' : 'Editar líneas guía'}
            </button>
            {isGuideEditorOpenHere && (
                <p className="mt-1.5 text-[9px] leading-snug text-cyan-700 dark:text-cyan-500">
                    Arrastra las líneas cian en el plano para alinearlas con la viga real. Al generar, cada celda recibe una luminaria centrada en su propio espacio.
                </p>
            )}
            {showGridFixturePicker && (
                <Dialog open={showGridFixturePicker} onOpenChange={setShowGridFixturePicker}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Elegir tipo de foco para la grilla</DialogTitle>
                            <DialogDescription>
                                Se usará para calcular cuántas luminarias exige la normativa y para generar la grilla.
                            </DialogDescription>
                        </DialogHeader>
                        <CatalogPanel
                            filterCategory="luminaires"
                            variant="compact-grid"
                            fixtureItemsPerPage={15}
                            onSelect={() => {
                                store.setTool(toolBeforeGridPickerRef.current);
                                setShowGridFixturePicker(false);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
            <button
                type="button"
                onClick={() => {
                    // Reemplaza TODAS las luminarias que ya están físicamente en
                    // este ambiente (no solo las que el usuario haya seleccionado
                    // a mano) para que regenerar la grilla nunca deje duplicados
                    // superpuestos. Todo el reemplazo es una sola transacción de
                    // historial (un solo Ctrl+Z deshace el cambio completo).
                    store.beginHistoryGesture();
                    fixturesInRoom.forEach((f) => store.removeObject(f.id));

                    const newIds = store.addFixtureGrid({
                        roomId: room.id,
                        rows: generationGrid.rows,
                        columns: generationGrid.columns,
                        fixtureTemplate: store.ui.fixtureTemplate,
                        ambientVertices: calculationVertices,
                        // Solo se aplican si el editor de líneas guía está
                        // abierto para ESTE room con la misma cantidad de
                        // filas/columnas (el efecto de arriba ya garantiza
                        // que calcen); si no, undefined = reparto uniforme.
                        rowGuides:
                            isGuideEditorOpenHere && guideEditor!.rows === generationGrid.rows
                                ? guideEditor!.rowGuides
                                : undefined,
                        columnGuides:
                            isGuideEditorOpenHere && guideEditor!.columns === generationGrid.columns
                                ? guideEditor!.columnGuides
                                : undefined,
                    });
                    store.endHistoryGesture();
                    if (isGuideEditorOpenHere) store.closeFixtureGridGuideEditor();
                    if (newIds.length > 0) {
                        store.setSelectedId(null);
                        store.setSelectedFixtureIds(newIds);
                    } else {
                        alert('No se pudo generar la grilla. El área puede ser muy pequeña.');
                    }
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-100 dark:bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-600/30 transition-colors"
            >
                Generar en Techo {generationGrid.rows}x{generationGrid.columns}
            </button>
        </div>
    );
}
