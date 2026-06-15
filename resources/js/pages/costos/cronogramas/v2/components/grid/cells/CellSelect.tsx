import React from 'react';

const DEFAULT_UNITS = [
    '', 'und', 'm', 'm2', 'm3', 'kg', 'tn', 'glb', 'est', 'jg',
    'ml', 'día', 'sem', 'mes', 'vje', 'pt', 'bls', 'gal', 'lt', 'rll',
];

interface Props {
    value: string;
    options?: string[];
    onCommit: (value: string) => void;
    onClick?: () => void;
}

export function CellSelect({ value, options = DEFAULT_UNITS, onCommit, onClick }: Props) {
    const allOptions =
        value && !options.includes(value) ? [value, ...options] : options;

    return (
        <div className="flex h-full w-full items-center px-1" onClick={onClick}>
            <select
                className="h-6 w-full cursor-pointer rounded border border-slate-700 bg-slate-800 text-center text-[11px] text-slate-200 outline-none hover:border-slate-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                value={value}
                onChange={(e) => onCommit(e.target.value)}
            >
                {allOptions.map((opt) => (
                    <option key={opt || '__empty__'} value={opt}>
                        {opt || '—'}
                    </option>
                ))}
            </select>
        </div>
    );
}
