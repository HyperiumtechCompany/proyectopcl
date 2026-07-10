import React, { useEffect, useRef, useState } from 'react';

interface Props {
    value: number;
    isEditing: boolean;
    onCommit: (value: number) => void;
    onCancel: () => void;
    align?: 'left' | 'center' | 'right';
    decimals?: number;
    min?: number;
    onClick?: () => void;
    onDoubleClick?: () => void;
}

const fmt = (n: number, decimals: number) =>
    n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

export function CellNumber({
    value,
    isEditing,
    onCommit,
    onCancel,
    align = 'right',
    decimals = 0,
    min,
    onClick,
    onDoubleClick,
}: Props) {
    const [draft, setDraft] = useState(String(value ?? ''));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            setDraft(String(value ?? ''));
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
        }
    }, [isEditing, value]);

    const commit = () => {
        const num = parseFloat(draft.replace(',', '.'));
        if (isNaN(num)) { onCancel(); return; }
        onCommit(min !== undefined ? Math.max(min, num) : num);
    };

    const alignClass =
        align === 'center' ? 'text-center' :
        align === 'right'  ? 'text-right'  : 'text-left';

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                className={`h-full w-full border-0 bg-blue-50 px-2 font-mono text-xs text-slate-900 outline-none ring-2 ring-inset ring-blue-400 dark:bg-blue-950/60 dark:text-white ${alignClass}`}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        commit();
                    }
                }}
                onClick={e => e.stopPropagation()}
            />
        );
    }

    return (
        <div
            className={`flex h-full cursor-pointer items-center px-2 font-mono text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/40 ${
                align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
            }`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
        >
            {value ? fmt(value, decimals) : <span className="text-slate-400 dark:text-slate-600">–</span>}
        </div>
    );
}
