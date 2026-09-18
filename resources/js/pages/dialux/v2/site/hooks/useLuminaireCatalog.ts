import { useEffect, useState } from 'react';
import {
    loadLuminaireCatalog,
    loadLuminairePhotometry,
    type LuminaireCatalogItem,
    type LuminairePhotometry,
} from '../lib/luminaireCatalog';

/** Catálogo compartido con v1 (globales + propias). `reload()` lo vuelve a pedir (p. ej. tras importar un LDT). */
export function useLuminaireCatalog() {
    const [items, setItems] = useState<LuminaireCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let cancelled = false;
        loadLuminaireCatalog(version > 0)
            .then((list) => {
                if (cancelled) return;
                setItems(list);
                setError(null);
                setLoading(false);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Error');
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [version]);

    return {
        items,
        loading,
        error,
        reload: () => {
            setLoading(true);
            setVersion((v) => v + 1);
        },
    };
}

/**
 * Fotometría (matriz IES/LDT) de los productos usados por los postes del
 * emplazamiento. Se pide una vez por producto (caché de módulo) y el mapa se
 * actualiza al llegar cada una — mientras tanto el cálculo usa el modelo
 * simplificado de esa luminaria.
 */
export function useLuminairePhotometry(
    ids: number[],
): Map<number, LuminairePhotometry> {
    const [loaded, setLoaded] = useState<Map<number, LuminairePhotometry>>(
        () => new Map(),
    );
    const key = [...new Set(ids)].sort((a, b) => a - b).join(',');

    useEffect(() => {
        const wanted = key ? key.split(',').map(Number) : [];
        let cancelled = false;
        for (const id of wanted) {
            void loadLuminairePhotometry(id).then((photometry) => {
                if (cancelled || !photometry) return;
                setLoaded((current) =>
                    current.has(id)
                        ? current
                        : new Map(current).set(id, photometry),
                );
            });
        }
        return () => {
            cancelled = true;
        };
    }, [key]);

    return loaded;
}
