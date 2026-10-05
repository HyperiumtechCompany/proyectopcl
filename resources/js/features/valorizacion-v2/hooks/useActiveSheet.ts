import { useEffect, useState } from 'react';
import { DEFAULT_SHEET_ID, findSheet } from '../config/sheets';
import type { SheetDefinition } from '../config/sheets';

const readHash = (): string => (typeof window === 'undefined' ? '' : window.location.hash.replace('#', ''));

/** Hoja activa sincronizada con el hash de la URL (#ficha-tecnica). Un hash desconocido cae a la hoja por defecto. */
export function useActiveSheet(): [SheetDefinition, (id: string) => void] {
    const [activeId, setActiveId] = useState<string>(() => findSheet(readHash())?.id ?? DEFAULT_SHEET_ID);

    useEffect(() => {
        const onHashChange = () => {
            const sheet = findSheet(readHash());
            if (sheet) {
                setActiveId(sheet.id);
            }
        };
        window.addEventListener('hashchange', onHashChange);

        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const select = (id: string) => {
        if (!findSheet(id)) {
            return;
        }
        setActiveId(id);
        window.history.replaceState(window.history.state, '', `#${id}`);
    };

    return [findSheet(activeId) ?? findSheet(DEFAULT_SHEET_ID)!, select];
}
