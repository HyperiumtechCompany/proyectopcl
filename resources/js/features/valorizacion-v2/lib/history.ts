/**
 * Historial deshacer/rehacer genérico. Funciona porque el estado de entrada es
 * inmutable: cada cambio guarda la referencia al estado anterior (sin copias
 * profundas), así 100 pasos cuestan casi nada.
 */

export interface HistoryEntry<T> {
    state: T;
    /** Descripción de la acción que produjo el cambio ("Eliminar 01.02.03"). */
    label: string;
}

export interface History<T> {
    past: HistoryEntry<T>[];
    future: HistoryEntry<T>[];
}

export const HISTORY_LIMIT = 100;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

/** Registra el estado previo a un cambio; un cambio nuevo invalida lo rehecho. */
export function record<T>(history: History<T>, previous: T, label: string): History<T> {
    const past = [...history.past, { state: previous, label }];

    return { past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, future: [] };
}

export function undo<T>(history: History<T>, current: T): { history: History<T>; state: T; label: string } | null {
    const last = history.past.at(-1);
    if (!last) {
        return null;
    }

    return {
        state: last.state,
        label: last.label,
        history: { past: history.past.slice(0, -1), future: [{ state: current, label: last.label }, ...history.future] },
    };
}

export function redo<T>(history: History<T>, current: T): { history: History<T>; state: T; label: string } | null {
    const next = history.future[0];
    if (!next) {
        return null;
    }

    return {
        state: next.state,
        label: next.label,
        history: { past: [...history.past, { state: current, label: next.label }], future: history.future.slice(1) },
    };
}
