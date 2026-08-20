import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export const SectionWrapper: React.FC<{
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}> = ({ icon, label, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section className="relative rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="flex min-h-9 w-full items-center gap-2 bg-slate-50 px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:bg-slate-900/70 dark:hover:bg-slate-800/80"
            >
                <span className="shrink-0">{icon}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-300">
                    {label}
                </span>
                <ChevronDown
                    size={13}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div className="space-y-2.5 border-t border-slate-200 p-2.5 dark:border-slate-800">
                    {children}
                </div>
            )}
        </section>
    );
};

export const PropField: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 dark:border-gray-800/40">
        <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`text-right text-[11px] text-slate-800 dark:text-gray-200 ${mono ? 'font-mono' : 'font-medium'}`}>
            {value}
        </span>
    </div>
);

export const EditField: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void;}> = ({ label, value, min, max, step = 0.1, onChange }) => (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,auto)] items-center gap-2 border-b border-slate-200 pb-1.5 dark:border-gray-800/40">
        <span className="min-w-0 break-words text-[11px] leading-snug text-slate-500 dark:text-slate-400">{label}</span>
        <input type="number" value={value} min={min} max={max} step={step}
            onChange={(event) => {
                const nextValue = parseFloat(event.target.value);
                if (!Number.isNaN(nextValue)) onChange(nextValue);
            }}
            className="min-h-7 w-20 max-w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-right font-mono text-[11px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
    </div>
);

export const TextField: React.FC<{ label: string; value: string; onChange: (value: string) => void;}> = ({ label, value, onChange }) => (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(8rem,1.35fr)] items-center gap-2 border-b border-slate-200 pb-1.5 dark:border-gray-800/40">
        <span className="min-w-0 break-words text-[11px] leading-snug text-slate-500 dark:text-slate-400">{label}</span>
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-7 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-[11px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"/>
    </div>
);

/**
 * Dropdown propio y liviano (sin Radix): un `<select>` nativo se veía "en
 * blanco" al cerrarse (el navegador no deja estilizar el valor mostrado) y
 * Radix Select trae Portal + focus-trap + `aria-hidden` sobre el resto del
 * documento, que es trabajo de más justo al lado de un canvas CAD que ya
 * redibuja en vivo (mismo tipo de costo que el backdrop-blur que se quitó
 * de los modales). Esta versión es solo un botón + una lista absolute
 * posicionada localmente: nada de portal, nada de medición de layout global.
 */
export const SelectField: React.FC<{
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    onChange: (value: string) => void;
}> = ({ label, value, options, placeholder = 'Selecciona', onChange }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = options.find((o) => o.value === value);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative flex w-full min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-1.5 dark:border-gray-800/40">
            <span className="max-w-[38%] shrink-0 truncate text-[10px] text-slate-500 dark:text-gray-500">{label}</span>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex min-w-0 flex-1 items-center justify-between gap-1 overflow-hidden rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right text-[11px] text-slate-900 hover:bg-slate-100 focus:border-blue-500 focus:outline-none dark:border-gray-700/50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:border-blue-600/50"
            >
                <span className={`truncate ${selected ? '' : 'text-gray-500 dark:text-gray-500'}`}>{selected?.label ?? placeholder}</span>
                <ChevronDown size={12} className="shrink-0 text-gray-500 dark:text-gray-500" />
            </button>
            {open && (
                <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-56 min-w-0 overflow-x-hidden overflow-y-auto rounded border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/15 dark:border-gray-700/50 dark:bg-[#1a1d27] dark:shadow-black/40">
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                                onChange(o.value);
                                setOpen(false);
                            }}
                            className={`flex w-full min-w-0 items-start gap-2 px-2 py-1 text-left text-[11px] leading-snug break-words whitespace-normal hover:bg-blue-50 dark:hover:bg-blue-600/20 ${
                                o.value === value ? 'text-slate-950 dark:text-gray-100' : 'text-slate-700 dark:text-gray-300'
                            }`}
                        >
                            <Check size={11} className={`mt-0.5 shrink-0 ${o.value === value ? 'text-blue-400' : 'invisible'}`} />
                            <span className="min-w-0 flex-1">{o.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
