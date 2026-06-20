import React, { useEffect, useRef, useState } from 'react';

interface Props {
    value: string;
    isEditing: boolean;
    onCommit: (value: string) => void;
    onCancel: () => void;
    align?: 'left' | 'center' | 'right';
    indent?: number;
    placeholder?: string;
    /** Prefijo estático no editable (WBS partida) mostrado antes del texto */
    prefix?: string;
    /** Mostrar hasta 2 líneas en lugar de truncar en una */
    wrap?: boolean;
    /** Overrides the default text-slate-200 color (for hierarchy level coloring) */
    textColorClass?: string;
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export function CellText({
    value,
    isEditing,
    onCommit,
    onCancel,
    align = 'left',
    indent = 0,
    placeholder = '',
    prefix,
    wrap = false,
    textColorClass,
    onClick,
    onDoubleClick,
}: Props) {
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            setDraft(value);
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
        }
    }, [isEditing, value]);

    const padStyle: React.CSSProperties = indent > 0 ? { paddingLeft: `${indent + 8}px` } : {};

    if (isEditing) {
        return (
            <div
                className="flex h-full w-full items-center bg-blue-950/60 ring-2 ring-inset ring-blue-400"
                style={padStyle}
            >
                {prefix && (
                    <span className="shrink-0 pl-2 pr-1 text-xs text-slate-400/70 select-none">
                        {prefix}
                    </span>
                )}
                <input
                    ref={inputRef}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-xs text-white outline-none"
                    style={prefix ? undefined : { paddingLeft: '8px' }}
                    value={draft}
                    placeholder={placeholder}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => onCommit(draft)}
                    onKeyDown={e => {
                        if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            onCommit(draft);
                        }
                    }}
                    onClick={e => e.stopPropagation()}
                />
            </div>
        );
    }

    return (
        <div
            className={`flex h-full cursor-pointer overflow-hidden px-2 text-xs ${textColorClass ?? 'text-slate-200'} hover:bg-slate-700/40
                ${wrap ? 'items-start py-1.5' : 'items-center'}`}
            style={padStyle}
            title={prefix ? `${prefix} ${value}` : value}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
        >
            {prefix && (
                <span className="mr-1.5 shrink-0 text-slate-400/70">
                    {prefix}
                </span>
            )}
            {wrap ? (
                <span
                    className="leading-snug wrap-break-word"
                    style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                    }}
                >
                    {value || <span className="text-slate-500">{placeholder}</span>}
                </span>
            ) : (
                <span className="truncate">
                    {value || <span className="text-slate-500">{placeholder}</span>}
                </span>
            )}
        </div>
    );
}
