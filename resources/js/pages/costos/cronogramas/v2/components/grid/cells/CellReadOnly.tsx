import React from 'react';

interface Props {
    value: string | number | null | undefined;
    align?: 'left' | 'center' | 'right';
    className?: string;
    decimals?: number;
}

function fmtNum(n: number, decimals: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function CellReadOnly({ value, align = 'left', className = '', decimals }: Props) {
    const alignClass =
        align === 'center' ? 'justify-center' :
        align === 'right'  ? 'justify-end'    : 'justify-start';

    const display =
        decimals !== undefined && typeof value === 'number'
            ? (value === 0 ? <span className="text-slate-400 dark:text-slate-600">–</span> : fmtNum(value, decimals))
            : (value ?? '');

    return (
        <div
            className={`flex h-full items-center px-2 font-mono text-xs text-slate-700 select-none dark:text-slate-300 ${alignClass} ${className}`}
            title={String(value ?? '')}
        >
            {display}
        </div>
    );
}
