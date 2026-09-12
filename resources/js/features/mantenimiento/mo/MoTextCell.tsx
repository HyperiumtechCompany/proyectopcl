import { useEffect, useRef, useState } from 'react';

interface Props {
    value: string;
    editable: boolean;
    placeholder?: string;
    className?: string;
    onCommit: (value: string) => void;
}

const DEBOUNCE_MS = 800;

export default function MoTextCell({ value, editable, placeholder, className = '', onCommit }: Props) {
    const [draft, setDraft] = useState(value);
    const [focused, setFocused] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!focused) setDraft(value);
    }, [value, focused]);

    const flush = (raw: string) => {
        if (timer.current) clearTimeout(timer.current);
        if (raw !== value) onCommit(raw);
    };

    if (!editable) {
        return <span className={`block px-2 py-1 ${className}`}>{value}</span>;
    }

    return (
        <input
            value={draft}
            placeholder={placeholder}
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
            className={`w-full bg-transparent px-2 py-1 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 dark:focus:bg-blue-950/40 ${className}`}
        />
    );
}
