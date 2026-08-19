import React, { useState } from 'react';
import { Grid, Search, Trash2, X, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { FixtureArrangement, Fixture } from '@/pages/dialux/hooks/types';
import { CatalogPanel } from '../CatalogPanel';
import { EditField, SectionWrapper } from './PropertyFields';

const SimpleAccordion = ({ title, children, defaultOpen = true }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-200 dark:border-gray-800 last:border-0">
            <button 
                type="button" 
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between py-2 text-[10px] font-semibold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100"
            >
                {title}
                <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="pb-3 pt-1">{children}</div>}
        </div>
    );
};

export const ArrangementProps: React.FC<{
    arrangement: FixtureArrangement;
}> = ({ arrangement }) => {
    const store = useEditorStore();
    const scene = store.activeScene();
    
    // Obtenemos la luminaria base desde los hijos vivos para siempre tener el modelo más reciente (por si se cambió por catálogo)
    const firstFixture = scene?.fixtures.find((f) => f.arrangementId === arrangement.id);
    
    const config = arrangement.config;
    const [rows, setRows] = useState(config.rows);
    const [cols, setCols] = useState(config.columns);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const handleApply = () => {
        if (!firstFixture) return;
        
        // Extraemos las propiedades base del foco actual para el nuevo template
        const { id, x, y, z, arrangementId, gridGroupId, gridRows, gridColumns, ...templateProps } = firstFixture as any;
        
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

    if (!firstFixture) return null;

    return (
        <SectionWrapper
            icon={<Grid size={12} className="text-cyan-400" />}
            label="Proyección de luminarias"
        >
            <div className="w-full">
                <SimpleAccordion title={`Distribución (${cols} × ${rows})`}>
                    <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                            <EditField
                                label="Columnas"
                                value={cols}
                                onChange={setCols}
                                min={1}
                                step={1}
                            />
                            <EditField
                                label="Filas"
                                value={rows}
                                onChange={setRows}
                                min={1}
                                step={1}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="w-full rounded bg-cyan-600 py-1.5 text-[10px] text-white hover:bg-cyan-700 dark:bg-cyan-700 dark:hover:bg-cyan-600"
                        >
                            Aplicar Cambios
                        </button>
                    </div>
                </SimpleAccordion>

                <SimpleAccordion title="Luminaria Activa">
                    <div className="space-y-2 pt-1">
                        <div className="text-[10px] text-slate-600 dark:text-gray-400 break-words">
                            {firstFixture.name}
                        </div>
                        <button
                            onClick={() => setShowModelPicker(true)}
                            className="w-full rounded border border-cyan-500/50 bg-cyan-50 dark:bg-cyan-900/20 py-1.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-300 transition-colors hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                        >
                            Cambiar de luminaria
                        </button>
                    </div>
                </SimpleAccordion>
            </div>

            <button
                onClick={handleDelete}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded border border-red-200 bg-red-50 py-1.5 text-[10px] text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/40"
            >
                <Trash2 size={12} /> Eliminar proyección
            </button>

            {showModelPicker && (
                <Dialog open={showModelPicker} onOpenChange={setShowModelPicker}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Cambiar modelo de luminaria</DialogTitle>
                            <DialogDescription>
                                Reemplazará todas las luminarias de esta proyección.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mb-2 relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                <Search size={12} className="text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar luminarias..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded border border-gray-300 bg-white py-1.5 pl-6 pr-2 text-[10px] text-slate-700 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
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
                            onSelect={() => {
                                setShowModelPicker(false);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </SectionWrapper>
    );
};
