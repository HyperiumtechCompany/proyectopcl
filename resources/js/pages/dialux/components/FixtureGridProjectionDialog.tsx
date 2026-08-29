import { Search, Upload, X } from 'lucide-react';
import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { CatalogPanel } from './CatalogPanel';

interface Props {
    onConfirm: () => void;
    onCancel: () => void;
    /** El modal "Importar o crear luminaria" lo comparte con `LuzPanel`, así que su estado vive en `Toolbar`. */
    onOpenImportModal: () => void;
}

/**
 * Modal "Configurar proyección de luminarias" — extraído de `Toolbar.tsx`
 * (Ronda 3 de optimización). Antes vivía inline en el render de `Toolbar`
 * (1400+ líneas, suscrito a TODO el store): abrirlo/cerrarlo y cada tecla en
 * el buscador re-renderizaban toda la toolbar y los 6 diálogos. Ahora es un
 * componente aislado con selectores granulares del store y su propio estado
 * local (`gridSearch`, modal de importación) — solo se re-renderiza él.
 */
export const FixtureGridProjectionDialog = memo(
    function FixtureGridProjectionDialog({
        onConfirm,
        onCancel,
        onOpenImportModal,
    }: Props) {
        const pendingArea = useEditorStore((s) => s.ui.pendingFixtureGridArea);
        const rows = useEditorStore((s) => s.ui.fixtureGridRows);
        const cols = useEditorStore((s) => s.ui.fixtureGridCols);
        const templateName = useEditorStore((s) => s.ui.fixtureTemplate.name);
        const setFixtureGridRows = useEditorStore((s) => s.setFixtureGridRows);
        const setFixtureGridCols = useEditorStore((s) => s.setFixtureGridCols);
        const setTool = useEditorStore((s) => s.setTool);

        const [gridSearch, setGridSearch] = useState('');

        const open = Boolean(pendingArea);
        const total = rows * cols;

        return (
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!next) onCancel();
                }}
            >
                <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Configurar proyección de luminarias
                        </DialogTitle>
                        <DialogDescription>
                            El área dibujada tiene {pendingArea?.length ?? 0}{' '}
                            vértices. Elige la luminaria y define la
                            distribución antes de insertarla.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                Distribución
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                                    <span>Filas</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={rows}
                                        onChange={(event) =>
                                            setFixtureGridRows(
                                                Number(event.target.value),
                                            )
                                        }
                                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    />
                                </label>
                                <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                                    <span>Columnas</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={cols}
                                        onChange={(event) =>
                                            setFixtureGridCols(
                                                Number(event.target.value),
                                            )
                                        }
                                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    />
                                </label>
                            </div>
                            <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-center dark:border-cyan-900 dark:bg-cyan-950/30">
                                <span className="block text-lg font-bold text-cyan-700 dark:text-cyan-300">
                                    {rows}×{cols}
                                </span>
                                <span className="text-[10px] text-cyan-700/80 dark:text-cyan-400">
                                    {total} luminarias
                                </span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                Modelo seleccionado:{' '}
                                <strong className="text-slate-700 dark:text-slate-200">
                                    {templateName ?? 'Luminaria'}
                                </strong>
                            </p>
                        </div>

                        <div className="min-h-0 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                            <div className="relative mb-3">
                                <Search
                                    size={14}
                                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
                                />
                                <input
                                    type="text"
                                    value={gridSearch}
                                    onChange={(e) =>
                                        setGridSearch(e.target.value)
                                    }
                                    placeholder="Buscar luminaria por nombre o fabricante..."
                                    className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-9 text-sm text-slate-900 transition outline-none placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                                />
                                {gridSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setGridSearch('')}
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
                                search={gridSearch}
                                onSelect={() => setTool('fixture-grid')}
                            />
                            <button
                                type="button"
                                onClick={onOpenImportModal}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                            >
                                <Upload size={13} />
                                Importar o crear luminaria
                            </button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={onCancel}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-cyan-600 text-white hover:bg-cyan-500"
                            onClick={onConfirm}
                        >
                            Insertar {total} luminarias
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    },
);
