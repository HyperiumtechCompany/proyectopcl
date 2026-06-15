import { useCallback, useState } from 'react';
import { COLUMNS } from '../types/cell';
import type { ColumnDef } from '../types/cell';

const STORAGE_KEY = 'pcl:gantt:v2:columns';
const MIN_W = 36;
const MAX_W = 600;

interface Stored {
    widths: Record<string, number>;
    hidden: string[];
}

function load(): Stored | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
        return null;
    }
}

function save(s: Stored) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function useGanttColumns() {
    const stored = load();

    const [widths, setWidths] = useState<Record<string, number>>(() =>
        Object.fromEntries(
            COLUMNS.map((c) => [c.key, stored?.widths?.[c.key] ?? c.width]),
        ),
    );

    const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
        () => new Set<string>(stored?.hidden ?? []),
    );

    const persist = useCallback((w: Record<string, number>, h: Set<string>) => {
        save({ widths: w, hidden: Array.from(h) });
    }, []);

    const resizeCol = useCallback(
        (key: string, newWidth: number) => {
            setWidths((prev) => {
                const next = {
                    ...prev,
                    [key]: Math.max(MIN_W, Math.min(MAX_W, newWidth)),
                };
                persist(next, hiddenKeys);
                return next;
            });
        },
        [hiddenKeys, persist],
    );

    const toggleHidden = useCallback(
        (key: string) => {
            if (key === 'item_order') return; // N° is always visible
            setHiddenKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                persist(widths, next);
                return next;
            });
        },
        [widths, persist],
    );

    const visibleColumns: ColumnDef[] = COLUMNS.filter(
        (c) => !hiddenKeys.has(c.key),
    ).map((c) => ({ ...c, width: widths[c.key] ?? c.width }));

    return { widths, hiddenKeys, visibleColumns, resizeCol, toggleHidden };
}
