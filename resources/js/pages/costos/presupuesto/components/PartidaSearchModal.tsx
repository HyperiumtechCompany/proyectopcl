import { Search, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ACU, PresupuestoRow } from '@/types/presupuestos';

// Un mock simple para emular el catálogo central con plantillas de ACU
const MOCK_CATALOGO: any[] = [
    {
        descripcion: 'Excavación manual de zanjas',
        unidad: 'm3',
        precio_unitario: 45.50,
        acu: {
            rendimiento: 4.0,
            mano_de_obra: [
                { descripcion: 'Peón', unidad: 'hh', cantidad: 1.0, precio_unitario: 18.20 }
            ]
        }
    },
    {
        descripcion: 'Concreto f\'c=210 kg/cm2 para zapatas',
        unidad: 'm3',
        precio_unitario: 320.00,
        acu: {
            rendimiento: 25.0,
            mano_de_obra: [
                { descripcion: 'Operario', unidad: 'hh', cantidad: 0.2, precio_unitario: 24.50 },
                { descripcion: 'Oficial', unidad: 'hh', cantidad: 0.2, precio_unitario: 21.00 },
                { descripcion: 'Peón', unidad: 'hh', cantidad: 1.0, precio_unitario: 18.20 }
            ],
            materiales: [
                { descripcion: 'Cemento Portland Tipo I', unidad: 'bls', cantidad: 8.5, precio_unitario: 26.50, factor_desperdicio: 1.05 },
                { descripcion: 'Arena gruesa', unidad: 'm3', cantidad: 0.5, precio_unitario: 45.00, factor_desperdicio: 1.05 },
                { descripcion: 'Piedra chancada 1/2"', unidad: 'm3', cantidad: 0.6, precio_unitario: 55.00, factor_desperdicio: 1.05 }
            ],
            equipos: [
                { descripcion: 'Mezcladora de concreto', unidad: 'hm', cantidad: 0.2, precio_hora: 15.00 }
            ]
        }
    },
    { descripcion: 'Acero de refuerzo fy=4200 kg/cm2', unidad: 'kg', precio_unitario: 5.20 },
    { descripcion: 'Encofrado y desencofrado normal', unidad: 'm2', precio_unitario: 35.00 },
    { descripcion: 'Muro de ladrillo KK soga (mortero 1:4)', unidad: 'm2', precio_unitario: 75.80 },
];

interface PartidaSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (partidaData: any) => void;
}


export const PartidaSearchModal: React.FC<PartidaSearchModalProps> = ({
    isOpen,
    onClose,
    onSelect,
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Partial<PresupuestoRow>[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults([]);
        } else {
            // Inicializar con todos por defecto en este mock
            setResults(MOCK_CATALOGO);
        }
    }, [isOpen]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearching(true);
        // Simular llamada a API de Catálogo Maestro
        setTimeout(() => {
            const filtered = MOCK_CATALOGO.filter(p =>
                p.descripcion?.toLowerCase().includes(query.toLowerCase())
            );
            setResults(filtered);
            setSearching(false);
        }, 400);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Catálogo Maestro de Partidas (S10 Style)</DialogTitle>
                    <DialogDescription className="sr-only">Busca y selecciona una partida del catálogo</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSearch} className="flex gap-2 my-2">
                    <Input
                        placeholder="Buscar por descripción (ej. Concreto, Acero...)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1"
                    />
                    <Button type="submit" disabled={searching}>
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span className="ml-2">Buscar</span>
                    </Button>
                </form>

                <div className="border rounded-md max-h-[400px] overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#f8fafc] sticky top-0 border-b">
                            <tr>
                                <th className="px-4 py-2 font-medium">Descripción</th>
                                <th className="px-4 py-2 font-medium w-24">Und.</th>
                                <th className="px-4 py-2 font-medium w-32 text-right">Precio Unit. (S/)</th>
                                <th className="px-4 py-2 w-24"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        No se encontraron partidas en el catálogo.
                                    </td>
                                </tr>
                            ) : (
                                results.map((item, idx) => (
                                    <tr key={idx} className="border-b hover:bg-slate-50">
                                        <td className="px-4 py-2">{item.descripcion}</td>
                                        <td className="px-4 py-2 text-gray-600">{item.unidad}</td>
                                        <td className="px-4 py-2 text-right font-medium">
                                            {item.precio_unitario?.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onSelect(item)}>
                                                Seleccionar
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
};
