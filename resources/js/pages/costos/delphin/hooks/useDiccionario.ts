import axios from 'axios';
import { useEffect, useState } from 'react';

export interface DicEntry {
    id:          number;
    codigo:      string;  // INEI code (e.g. "02")
    descripcion: string;  // clean category name (e.g. "Clavos")
}

export function useDiccionario(project: string) {
    const [items, setItems]   = useState<DicEntry[]>([]);
    const [ready, setReady]   = useState(false);

    useEffect(() => {
        axios
            .get(`/costos/proyectos/${project}/presupuesto/insumos/diccionarios`)
            .then((res) => {
                if (res.data?.success) setItems(res.data.diccionarios ?? []);
            })
            .catch(() => {})
            .finally(() => setReady(true));
    }, [project]);

    return { items, ready };
}
