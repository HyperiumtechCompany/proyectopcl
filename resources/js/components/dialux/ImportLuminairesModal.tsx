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
import type { LuminaireBrand } from './Toolbar';
import { LUMINAIRE_BRANDS } from './Toolbar';

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
            <DialogContent className="flex max-h-[min(90vh,720px)] min-h-0 flex-col overflow-hidden border-gray-800 bg-[#161820] p-0 text-gray-100 sm:max-w-2xl">
                <DialogHeader className="shrink-0 px-6 pt-6">
                    <DialogTitle className="text-lg font-bold text-cyan-400">
                        Importar Luminarias
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Selecciona una luminaria del catálogo para insertarla en tu proyecto.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6">
                    {/* Filtros */}
                    <div className="shrink-0 space-y-2">
                        {/* Búsqueda */}
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-600"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar luminaria, código…"
                                className="h-9 w-full rounded border border-gray-700/60 bg-gray-900/70 pr-3 pl-9 text-sm text-gray-200 placeholder-gray-600 transition-colors outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Filtro de marca */}
                        <div className="flex flex-wrap gap-1">
                            {LUMINAIRE_BRANDS.map((b) => (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => setBrand(b)}
                                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        brand === b
                                            ? 'bg-cyan-700/60 text-cyan-100 ring-1 ring-cyan-500/40'
                                            : 'bg-gray-800/60 text-gray-500 hover:bg-gray-700/60 hover:text-gray-300'
                                    }`}
                                >
                                    {b}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Catálogo */}
                    <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-700/50 bg-gray-900/30 p-2">
                        <div className="h-full overflow-y-auto pr-1">
                            <CatalogPanel
                                filterCategory="luminaires"
                                filterBrand={brand !== 'Todas' ? brand : undefined}
                                search={search}
                                onSelect={() => onOpenChange(false)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 justify-end gap-2 px-6 pb-6">
                    <Button
                        variant="outline"
                        className="border-gray-700 text-gray-200 hover:bg-gray-800"
                        onClick={() => onOpenChange(false)}
                    >
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
