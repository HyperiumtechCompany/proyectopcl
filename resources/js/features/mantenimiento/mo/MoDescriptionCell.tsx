import { useEffect, useRef, useState } from 'react';

interface Props {
    value: string;
    editable: boolean;
    className?: string;
    onCommit: (value: string) => void;
}

const DEBOUNCE_MS = 800;

// Como MoTextCell pero con <textarea> en vez de <input>: permite que una descripción larga
// salte de línea dentro del ancho de la columna en lugar de desbordarse.
export default function MoDescriptionCell({ value, editable, className = '', onCommit }: Props) {
    const [draft, setDraft] = useState(value);
    const [focused, setFocused] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!focused) setDraft(value);
    }, [value, focused]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    });

    const flush = (raw: string) => {
        if (timer.current) clearTimeout(timer.current);
        if (raw !== value) onCommit(raw);
    };

    if (!editable) {
        return <span className={`block px-2 py-1 break-words whitespace-normal ${className}`}>{value}</span>;
    }

    return (
        <textarea
            ref={ref}
            rows={1}
            value={draft}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
                setFocused(false);
                flush(event.target.value);
            }}
            onChange={(event) => {
                setDraft(event.target.value);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => flush(event.target.value), DEBOUNCE_MS);
            }}
            className={`block w-full resize-none overflow-hidden bg-transparent px-2 py-1 break-words whitespace-normal outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 dark:focus:bg-blue-950/40 ${className}`}
        />
    );
}
