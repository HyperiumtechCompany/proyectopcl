import { useEffect, useRef, useState } from 'react';

interface Props {
    value: string;
    editable: boolean;
    muted?: boolean;
    align?: 'right' | 'left';
    /** Decimales fijos a mostrar cuando la celda no está enfocada (p. ej. 3 para precios unitarios). No trunca lo que se envía al backend, solo el formato en pantalla. */
    decimals?: number;
    onCommit: (value: string | null) => void;
}

const DEBOUNCE_MS = 700;

// El backend valida los decimales con una regex estricta (^-?\d+(\.\d+)?$); un valor a medio
// escribir ("10.", ".", "-", "1.2.3") que se envía por un blur prematuro dispara un 422.
// Se normaliza aquí para nunca emitir algo que esa regex rechace.
function normalizeDecimal(raw: string): string | null {
    const stripped = raw.trim().replace(/[^\d.-]/g, '');
    if (stripped === '' || stripped.replace(/[-.]/g, '') === '') return null; // sin dígitos ("", "-", ".", "-.")

    const negative = stripped.startsWith('-');
    const [intPart, ...rest] = stripped.replace(/-/g, '').split('.');
    const decimals = rest.join('');

    return (negative ? '-' : '') + (intPart || '0') + (decimals ? `.${decimals}` : '');
}

export default function MoNumberCell({ value, editable, muted, align = 'right', decimals, onCommit }: Props) {
    const [draft, setDraft] = useState(value);
    const [focused, setFocused] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!focused) setDraft(value);
    }, [value, focused]);

    const flush = (raw: string) => {
        if (timer.current) clearTimeout(timer.current);
        onCommit(normalizeDecimal(raw));
    };

    const schedule = (raw: string) => {
        setDraft(raw);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(raw), DEBOUNCE_MS);
    };

    const display = (raw: string): string => {
        if (decimals == null || raw.trim() === '') return raw;
        const n = Number(raw);
        return Number.isNaN(n) ? raw : n.toFixed(decimals);
    };

    if (!editable) {
        return (
            <span className={`block px-2 py-1 text-right tabular-nums ${muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                {display(value)}
            </span>
        );
    }

    return (
        <input
            inputMode="decimal"
            value={focused ? draft : display(draft)}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
                setFocused(false);
                flush(event.target.value);
            }}
            onChange={(event) => schedule(event.target.value)}
            className={`w-full bg-transparent px-2 py-1 tabular-nums outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 dark:focus:bg-blue-950/40 ${
                align === 'right' ? 'text-right' : 'text-left'
            } ${muted ? 'text-slate-400 placeholder:text-slate-300 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}
        />
    );
}
