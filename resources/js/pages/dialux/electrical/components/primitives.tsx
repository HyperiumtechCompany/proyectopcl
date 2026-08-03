/**
 * Primitivas UI compartidas del módulo eléctrico (tablas editables oscuras).
 */

import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function Section({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-white/10 bg-[#101218] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
                    {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {children}
        </section>
    );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500">
            <Plus className="h-3.5 w-3.5" />
            {label}
        </button>
    );
}

export function DeleteButton({ onClick, label = 'Eliminar' }: { onClick: () => void; label?: string }) {
    return (
        <button onClick={onClick} className="rounded-md p-1 text-zinc-500 transition hover:bg-white/10 hover:text-rose-400" aria-label={label} title={label}>
            <Trash2 size={14} />
        </button>
    );
}

export function TableShell({ headers, children, minWidth = 640 }: { headers: (string | ReactNode)[]; children: ReactNode; minWidth?: number }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs" style={{ minWidth }}>
                <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wide text-zinc-500">
                        {headers.map((h, i) => (
                            <th key={i} className="px-2.5 py-2 font-medium whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-200">{children}</tbody>
            </table>
        </div>
    );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-3 py-6 text-center text-xs text-zinc-500">
                {message}
            </td>
        </tr>
    );
}

const cellInputClass =
    'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-zinc-100 transition hover:border-white/10 focus:border-amber-500/60 focus:bg-black/30 focus:outline-none';

export function TextCell({ value, onChange, placeholder, width }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
    return (
        <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cellInputClass}
            style={width ? { width } : undefined}
        />
    );
}

export function NumCell({
    value,
    onChange,
    step = 0.01,
    min = 0,
    width = 72,
    placeholder,
}: {
    value: number | null | undefined;
    onChange: (v: number | null) => void;
    step?: number;
    min?: number;
    width?: number;
    placeholder?: string;
}) {
    return (
        <input
            type="number"
            value={value ?? ''}
            step={step}
            min={min}
            placeholder={placeholder}
            onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                    onChange(null);
                    return;
                }
                const parsed = Number(raw);
                onChange(Number.isFinite(parsed) ? parsed : null);
            }}
            className={`${cellInputClass} text-right tabular-nums`}
            style={{ width }}
        />
    );
}

export function SelectCell({
    value,
    onChange,
    options,
    width,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    width?: number;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded border border-transparent bg-transparent px-1 py-1 text-xs text-zinc-100 transition hover:border-white/10 focus:border-amber-500/60 focus:outline-none [&>option]:bg-[#15171f]"
            style={width ? { width } : undefined}>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

const STATUS_STYLES: Record<string, string> = {
    cumple: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    ok: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    advertencia: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    exceso: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    no_cumple: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    error: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

const STATUS_LABELS: Record<string, string> = {
    cumple: 'Cumple',
    ok: 'OK',
    advertencia: 'Advertencia',
    exceso: 'Exceso',
    no_cumple: 'No cumple',
    error: 'Error',
};

export function StatusBadge({ status, title }: { status: string; title?: string }) {
    return (
        <span
            title={title}
            className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLES[status] ?? 'bg-white/10 text-zinc-300 border-white/10'}`}>
            {STATUS_LABELS[status] ?? status}
        </span>
    );
}

export function fmt(value: number, decimals = 2): string {
    return value.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
