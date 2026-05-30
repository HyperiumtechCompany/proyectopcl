import { Search, Tag, X } from 'lucide-react';
import React from 'react';
import type { AngleSnapMode, IsoluxMode } from '@/hooks/dialux/useEditorStore';
import { ANGLE_SNAP_OPTIONS, ISOLUX_MODES } from './types';

export const SearchInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder = 'Buscar…' }) => (
    <div className="relative mb-1.5">
        <Search
            size={11}
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-600"
        />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-7.5 w-full rounded border border-gray-700/60 bg-gray-900/70 pr-7 pl-6 text-[11px] text-gray-200 placeholder-gray-600 transition-colors outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
        />
        {value && (
            <button
                type="button"
                onClick={() => onChange('')}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
                <X size={10} />
            </button>
        )}
    </div>
);

export function ChipFilter<T extends string>({
    options,
    active,
    onChange,
}: {
    options: readonly T[];
    active: T;
    onChange: (v: T) => void;
}) {
    return (
        <div className="mb-1.5 flex flex-wrap gap-1">
            {options.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        active === opt
                            ? 'bg-cyan-700/60 text-cyan-100 ring-1 ring-cyan-500/40'
                            : 'bg-gray-800/60 text-gray-500 hover:bg-gray-700/60 hover:text-gray-300'
                    }`}
                >
                    <Tag size={8} />
                    {opt}
                </button>
            ))}
        </div>
    );
}

export const AngleSnapBlock: React.FC<{
    mode: AngleSnapMode;
    onChange: (v: AngleSnapMode) => void;
}> = ({ mode, onChange }) => (
    <div className="rounded-md border border-gray-700/40 bg-gray-900/40 p-2">
        <p className="px-1 pb-1.5 text-[9px] font-bold tracking-[0.15em] text-gray-600 uppercase">
            Modo angular
        </p>
        {ANGLE_SNAP_OPTIONS.map((opt) => (
            <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`mt-0.5 flex w-full items-center rounded px-2 py-1.5 text-left transition-colors ${
                    mode === opt.value
                        ? 'bg-cyan-900/30 text-cyan-300'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                }`}
            >
                <span className="text-[11px]">{opt.label}</span>
                <span className="ml-auto font-mono text-[9.5px] text-gray-500">
                    {opt.hint}
                </span>
            </button>
        ))}
        <p className="mt-1.5 px-1 text-[9.5px] leading-snug text-gray-600">
            Mayús fuerza ortogonal temporal en cualquier modo.
        </p>
    </div>
);

export const IsoluxBlock: React.FC<{
    mode: IsoluxMode;
    onChange: (v: IsoluxMode) => void;
}> = ({ mode, onChange }) => (
    <div className="rounded-md border border-gray-700/40 bg-gray-900/40 p-2">
        <p className="px-1 pb-1.5 text-[9px] font-bold tracking-[0.15em] text-gray-600 uppercase">
            Modo Isolux
        </p>
        {ISOLUX_MODES.map((m) => (
            <button
                key={m.value}
                type="button"
                onClick={() => onChange(m.value)}
                className={`mt-0.5 flex h-8 w-full items-center rounded px-2 text-left text-[11px] transition-colors ${
                    mode === m.value
                        ? 'bg-cyan-900/30 text-cyan-300'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                }`}
            >
                {m.label}
                {mode === m.value && (
                    <span className="ml-auto rounded bg-cyan-950/70 px-1.5 py-0.5 text-[9px] text-cyan-300">
                        Activo
                    </span>
                )}
            </button>
        ))}
    </div>
);
