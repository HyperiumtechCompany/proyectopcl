import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

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
        <div ref={rootRef} className="relative flex w-full min-w-0 items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
            <span className="max-w-[38%] shrink-0 truncate text-[10px] text-gray-500">{label}</span>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex min-w-0 flex-1 items-center justify-between gap-1 overflow-hidden rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right text-[11px] text-gray-200 hover:bg-gray-800 focus:border-blue-600/50 focus:outline-none"
            >
                <span className={`truncate ${selected ? '' : 'text-gray-500'}`}>{selected?.label ?? placeholder}</span>
                <ChevronDown size={12} className="shrink-0 text-gray-500" />
            </button>
            {open && (
                <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-56 min-w-0 overflow-x-hidden overflow-y-auto rounded border border-gray-700/50 bg-[#1a1d27] py-1 shadow-lg shadow-black/40">
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                                onChange(o.value);
                                setOpen(false);
                            }}
                            className={`flex w-full min-w-0 items-start gap-2 px-2 py-1 text-left text-[11px] leading-snug break-words whitespace-normal hover:bg-blue-600/20 ${
                                o.value === value ? 'text-gray-100' : 'text-gray-300'
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
