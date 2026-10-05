import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { ValorizacionInput } from '../types';
import { createValorizacionStore } from './valorizacionStore';
import type { ValorizacionState, ValorizacionStore } from './valorizacionStore';

const ValorizacionStoreContext = createContext<ValorizacionStore | null>(null);

/** Montar con `key` = id de proyecto/valorización para que otro proyecto reciba un store nuevo. */
export function ValorizacionStoreProvider({ initial, children }: { initial: ValorizacionInput; children: ReactNode }) {
    const [store] = useState(() => createValorizacionStore(initial));

    return <ValorizacionStoreContext.Provider value={store}>{children}</ValorizacionStoreContext.Provider>;
}

/** La instancia del store (para suscribirse sin re-renderizar, p. ej. el autoguardado). */
export function useValorizacionStoreApi(): ValorizacionStore {
    const store = useContext(ValorizacionStoreContext);
    if (!store) {
        throw new Error('useValorizacionStore debe usarse dentro de <ValorizacionStoreProvider>.');
    }

    return store;
}

export function useValorizacionStore<T>(selector: (state: ValorizacionState) => T): T {
    return useStore(useValorizacionStoreApi(), selector);
}
