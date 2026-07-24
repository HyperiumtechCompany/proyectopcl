/**
 * ImportLuminairesModal.tsx
 * Modal dedicado para importar/seleccionar luminarias del catálogo
 */

import { Search, X } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { CatalogPanel } from './CatalogPanel';
import type { LuminaireBrand } from './constants';
import { LUMINAIRE_BRANDS } from './constants';

interface ImportLuminairesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ImportLuminairesModal: React.FC<ImportLuminairesModalProps> = ({
    open,
    onOpenChange,
}) => {
    const [search, setSearch] = useState('');
    const [brand, setBrand] = useState<LuminaireBrand>('Todas');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[96dvh] w-[calc(100vw-1rem)] max-w-5xl min-h-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 text-slate-900 dark:border-slate-800 dark:bg-[#11131a] dark:text-slate-100 sm:h-[92dvh] sm:w-[94vw] sm:max-w-5xl">
                <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-4 pr-12 text-left dark:border-slate-800 sm:px-6 sm:py-5">
                    <DialogTitle className="text-base font-semibold tracking-tight text-slate-950 dark:text-white sm:text-lg">
                        Catálogo y creación de luminarias
                    </DialogTitle>
                    <DialogDescription className="max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
                        Busca un modelo, importa fotometría IES/LDT o crea una
                        luminaria propia para insertarla en el proyecto.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 sm:p-5">
                    {/* Filtros */}
                    <div className="shrink-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                        {/* Búsqueda */}
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar luminaria, código…"
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Filtro de marca */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                            {LUMINAIRE_BRANDS.map((b) => (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => setBrand(b)}
                                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        brand === b
                                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-200'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {b}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Catálogo */}
                    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/30 sm:p-3">
                        <div className="h-full overflow-y-auto pr-1 sm:pr-2">
                            <CatalogPanel
                                filterCategory="luminaires"
                                filterBrand={brand !== 'Todas' ? brand : undefined}
                                search={search}
                                onSelect={() => onOpenChange(false)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-6">
                    <Button
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => onOpenChange(false)}
                    >
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
