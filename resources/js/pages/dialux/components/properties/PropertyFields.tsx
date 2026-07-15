import React from 'react';

export const SectionWrapper: React.FC<{
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}> = ({ icon, label, children }) => (
    <div className="space-y-2.5">
        <div className="mb-1 flex items-center gap-2">
            {icon}
            <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
                {label}
            </p>
        </div>
        {children}
    </div>
);

export const PropField: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className={`text-right text-[11px] text-gray-200 ${mono ? 'font-mono' : 'font-medium'}`}>
            {value}
        </span>
    </div>
);

export const EditField: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void;}> = ({ label, value, min, max, step = 0.1, onChange }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 text-[10px] text-gray-500">{label}</span>
        <input type="number" value={value} min={min} max={max} step={step}
            onChange={(event) => {
                const nextValue = parseFloat(event.target.value);
                if (!Number.isNaN(nextValue)) onChange(nextValue);
            }}
            className="w-20 rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right font-mono text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none"
        />
    </div>
);

export const TextField: React.FC<{ label: string; value: string; onChange: (value: string) => void;}> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 text-[10px] text-gray-500">{label}</span>
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} className="w-32 rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none"/>
    </div>
);

export const SelectField: React.FC<{
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    onChange: (value: string) => void;
}> = ({ label, value, options, placeholder = 'Selecciona', onChange }) => (
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 truncate text-[10px] text-gray-500">
            {label}
        </span>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[120px] min-w-0 flex-1 truncate rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none">
            <option value="">{placeholder}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    </div>
);
