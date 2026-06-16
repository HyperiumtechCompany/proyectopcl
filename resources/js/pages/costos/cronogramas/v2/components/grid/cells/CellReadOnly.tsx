import React from 'react';

interface Props {
    value: string | number | null | undefined;
    align?: 'left' | 'center' | 'right';
    className?: string;
}

export function CellReadOnly({ value, align = 'left', className = '' }: Props) {
    const alignClass =
        align === 'center' ? 'justify-center' :
        align === 'right'  ? 'justify-end'    : 'justify-start';

    return (
        <div
            className={`flex h-full items-center px-2 text-xs text-slate-400 select-none ${alignClass} ${className}`}
            title={String(value ?? '')}
        >
            {value ?? ''}
        </div>
    );
}
