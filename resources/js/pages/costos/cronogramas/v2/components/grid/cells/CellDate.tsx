import React, { useEffect, useRef, useState } from 'react';
import { normalizeGanttDate } from '../../../utils/date';

interface Props {
    value: string | null;
    isEditing: boolean;
    onCommit: (value: string | null) => void;
    onCancel: () => void;
    onClick?: () => void;
    onDoubleClick?: () => void;
}

function formatDisplay(date: string | null): string {
    if (!date) return '';
    // "YYYY-MM-DD" → "DD/MM/YY"
    const normalized = normalizeGanttDate(date);
    if (!normalized) return date;
    const [y, m, d] = normalized.split('-');
    if (!y || !m || !d) return date;
    return `${d}/${m}/${y}`;
}

export function CellDate({
    value,
    isEditing,
    onCommit,
    onCancel,
    onClick,
    onDoubleClick,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const isCancellingRef = useRef(false);
    const [draft, setDraft] = useState(value ?? '');

    useEffect(() => {
        if (isEditing) {
            isCancellingRef.current = false;
            setDraft(value ?? '');
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.showPicker?.();
            });
        }
    }, [isEditing, value]);

    const commitDraft = () => {
        if (isCancellingRef.current) return;
        onCommit(normalizeGanttDate(draft) ?? null);
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="date"
                className="h-full w-full border-0 bg-blue-50 px-1 text-center text-xs text-slate-900 ring-2 ring-blue-400 outline-none ring-inset dark:bg-blue-950/60 dark:text-white"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                        isCancellingRef.current = true;
                        onCancel();
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commitDraft();
                    }
                }}
                onClick={(e) => e.stopPropagation()}
            />
        );
    }

    return (
        <div
            className="flex h-full cursor-pointer items-center justify-center px-1 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/40"
            onClick={onClick}
            onDoubleClick={onDoubleClick}
        >
            {value ? (
                <span className="font-mono">{formatDisplay(value)}</span>
            ) : (
                <span className="text-slate-400 dark:text-slate-600">–</span>
            )}
        </div>
    );
}
