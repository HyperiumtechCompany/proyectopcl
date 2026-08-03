import React, { useEffect, useRef, useState } from 'react';

interface Props {
    value: string;
    isEditing: boolean;
    onCommit: (value: string) => void;
    onCancel: () => void;
    align?: 'left' | 'center' | 'right';
    indent?: number;
    placeholder?: string;
    /** Prefijo WBS mostrado antes del texto */
    prefix?: string;
    /** Cuando true, el prefijo se puede editar con doble clic */
    prefixEditable?: boolean;
    /** Llamado al confirmar edición del prefijo */
    onPrefixCommit?: (value: string) => void;
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
    prefixEditable = false,
    onPrefixCommit,
    wrap = false,
    textColorClass,
    onClick,
    onDoubleClick,
}: Props) {
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    const [isEditingPrefix, setIsEditingPrefix] = useState(false);
    const [prefixDraft, setPrefixDraft] = useState('');
    const prefixInputRef = useRef<HTMLInputElement>(null);

    const startPrefixEdit = () => {
        if (!prefixEditable || !prefix) return;
        setPrefixDraft(prefix);
        setIsEditingPrefix(true);
        requestAnimationFrame(() => {
            prefixInputRef.current?.focus();
            prefixInputRef.current?.select();
        });
    };

    const commitPrefixEdit = () => {
        setIsEditingPrefix(false);
        const val = prefixDraft.trim();
        if (val && val !== prefix) onPrefixCommit?.(val);
    };

    const cancelPrefixEdit = () => setIsEditingPrefix(false);

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
                className="flex h-full w-full items-center bg-blue-50 ring-2 ring-inset ring-blue-400 dark:bg-blue-950/60"
                style={padStyle}
            >
                {prefix && (
                    isEditingPrefix ? (
                        <input
                            ref={prefixInputRef}
                            className="w-14 shrink-0 rounded border-0 bg-blue-100 pr-1 pl-2 text-xs text-amber-700 outline-none ring-1 ring-amber-400/60 dark:bg-blue-900/60 dark:text-amber-300"
                            value={prefixDraft}
                            onChange={e => setPrefixDraft(e.target.value)}
                            onBlur={commitPrefixEdit}
                            onKeyDown={e => {
                                e.stopPropagation();
                                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitPrefixEdit(); }
                                if (e.key === 'Escape') { cancelPrefixEdit(); }
                            }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className={`shrink-0 pl-2 pr-1 text-xs select-none ${prefixEditable ? 'cursor-text text-amber-700 hover:text-amber-800 underline decoration-dotted dark:text-amber-300/80 dark:hover:text-amber-300' : 'text-slate-500 dark:text-slate-400/70'}`}
                            title={prefixEditable ? 'Doble clic para editar numeración' : undefined}
                            onClick={prefixEditable ? e => e.stopPropagation() : undefined}
                            onDoubleClick={e => { e.stopPropagation(); startPrefixEdit(); }}
                        >
                            {prefix}
                        </span>
                    )
                )}
                <input
                    ref={inputRef}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-xs text-slate-900 outline-none dark:text-white"
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
            className={`flex h-full cursor-pointer overflow-hidden px-2 text-xs ${textColorClass ?? 'text-slate-700 dark:text-slate-200'} hover:bg-slate-100 dark:hover:bg-slate-700/40
                ${wrap ? 'items-start py-1.5' : 'items-center'}`}
            style={padStyle}
            title={prefix ? `${prefix} ${value}` : value}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
        >
            {prefix && (
                isEditingPrefix ? (
                    <input
                        ref={prefixInputRef}
                        className="mr-1.5 w-14 shrink-0 rounded border-0 bg-white px-1 text-xs text-amber-700 outline-none ring-1 ring-amber-400/60 dark:bg-slate-700 dark:text-amber-300"
                        value={prefixDraft}
                        onChange={e => setPrefixDraft(e.target.value)}
                        onBlur={commitPrefixEdit}
                        onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitPrefixEdit(); }
                            if (e.key === 'Escape') { cancelPrefixEdit(); }
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span
                        className={`mr-1.5 shrink-0 text-slate-500 dark:text-slate-400/70 ${prefixEditable ? 'cursor-text hover:text-amber-700 hover:underline hover:decoration-dotted dark:hover:text-amber-300' : ''}`}
                        title={prefixEditable ? 'Doble clic para editar numeración' : undefined}
                        onClick={prefixEditable ? e => e.stopPropagation() : undefined}
                        onDoubleClick={e => { e.stopPropagation(); startPrefixEdit(); }}
                    >
                        {prefix}
                    </span>
                )
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
                    {value || <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>}
                </span>
            ) : (
                <span className="truncate">
                    {value || <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>}
                </span>
            )}
        </div>
    );
}
