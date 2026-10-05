import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { isIsoDate } from '../lib/dates';
import { parseDecimal, roundMoney } from '../lib/money';
import { fmtNumber } from '../utils/format';

/**
 * - text: texto libre.
 * - number: decimal exacto (metrados, P.U.…).
 * - money: monto con 2 decimales; se edita con separador de miles y "S/".
 * - date: selector de fecha del navegador; `value` en ISO (aaaa-mm-dd).
 * - integer: entero ≥ 0 (días, cantidades).
 */
export type EditableKind = 'text' | 'number' | 'money' | 'date' | 'integer';

interface EditableCellProps {
    value: string | null;
    onCommit: (value: string | null) => void;
    kind?: EditableKind;
    align?: 'left' | 'right' | 'center';
    placeholder?: string;
    label: string;
    className?: string;
    /** Conversión propia del texto (p. ej. "25%" → monto). `false` = inválido (se revierte). */
    parse?: (raw: string) => string | null | false;
    title?: string;
    /**
     * Modo "como Excel": se muestra este valor formateado y al hacer clic (o
     * Enter) se edita. Sin `display`, la celda es siempre un input (tablas en
     * modo edición).
     */
    display?: ReactNode;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/** Valor que se muestra dentro del input al empezar a editar. */
function valorInicial(kind: EditableKind, value: string | null): string {
    if (value === null) {
        return '';
    }
    if (kind === 'money') {
        return fmtNumber(value, 2);
    }

    return value;
}

/** Normaliza lo escrito según el tipo. `false` = inválido. */
export function normalizar(kind: EditableKind, raw: string, parse?: EditableCellProps['parse']): string | null | false {
    const texto = raw.trim();
    if (texto === '') {
        return null;
    }
    if (parse) {
        return parse(texto);
    }
    switch (kind) {
        case 'money': {
            const monto = parseDecimal(texto.replace(/^S\/\s*/i, ''));

            return monto === null ? false : roundMoney(monto).toFixed(2);
        }
        case 'number': {
            const numero = parseDecimal(texto);

            return numero === null ? false : numero.toString();
        }
        case 'integer':
            return /^\d+$/.test(texto) ? String(Number(texto)) : false;
        case 'date':
            return isIsoDate(texto) ? texto : false;
        default:
            return texto;
    }
}

/**
 * Celda editable (amarillo suave = dato de entrada). Confirma al salir o con
 * Enter, Escape descarta; lo inválido se revierte.
 */
export function EditableCell({ value, onCommit, kind = 'text', align, placeholder, label, className, parse, title, display }: EditableCellProps) {
    const [editando, setEditando] = useState(false);
    const numerico = kind === 'number' || kind === 'money' || kind === 'integer';
    const alignClass = ALIGN[align ?? (numerico ? 'right' : 'left')];

    const commit = (input: HTMLInputElement) => {
        const next = normalizar(kind, input.value, parse);
        if (next === false) {
            input.value = valorInicial(kind, value);

            return;
        }
        if (next !== value) {
            onCommit(next);
        }
    };

    const onBlur = (event: FocusEvent<HTMLInputElement>) => {
        setEditando(false);
        commit(event.currentTarget);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        } else if (event.key === 'Escape') {
            event.currentTarget.value = valorInicial(kind, value);
            event.currentTarget.blur();
        }
    };

    if (display !== undefined && !editando) {
        const vacio = display === '' || display === null;

        return (
            <button
                type="button"
                onClick={() => setEditando(true)}
                aria-label={`Editar ${label}`}
                title={title ?? 'Clic para editar'}
                className={cn(
                    'group/cell inline-flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md border border-stone-200/70 bg-stone-50/70 px-2.5 py-1.5 text-[13px] leading-relaxed text-stone-900 hover:border-amber-300 hover:bg-amber-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none dark:border-stone-700/70 dark:bg-stone-800/40 dark:text-stone-100 dark:hover:border-amber-500/60 dark:hover:bg-amber-500/10',
                    numerico && 'font-mono tabular-nums',
                    className,
                )}
            >
                <span className={cn('min-w-0 flex-1 wrap-break-word', alignClass)}>{vacio ? <span className="font-sans text-stone-500 dark:text-stone-400">{placeholder ?? 'Sin dato · clic para completar'}</span> : display}</span>
                <Pencil className="size-3.5 shrink-0 text-stone-400 group-hover/cell:text-orange-600 dark:text-stone-500 dark:group-hover/cell:text-orange-300" />
            </button>
        );
    }

    const input = (
        <input
            key={value ?? ''}
            type={kind === 'date' ? 'date' : 'text'}
            defaultValue={valorInicial(kind, value)}
            aria-label={label}
            title={title}
            placeholder={placeholder}
            autoFocus={display !== undefined}
            inputMode={kind === 'money' || kind === 'number' ? 'decimal' : kind === 'integer' ? 'numeric' : undefined}
            onFocus={(event) => kind !== 'date' && event.currentTarget.select()}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className={cn(
                'min-h-9 w-full min-w-0 rounded-md border border-amber-300 bg-amber-50/80 px-2.5 py-1.5 text-base text-stone-900 placeholder:text-stone-500 focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none sm:text-[13px] dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-stone-100 dark:scheme-dark dark:placeholder:text-stone-400 dark:focus:bg-stone-950',
                numerico && 'font-mono tabular-nums',
                kind === 'money' && 'pl-7',
                alignClass,
                className,
            )}
        />
    );

    if (kind === 'money') {
        return (
            <span className={cn('relative inline-flex w-full min-w-0', className)}>
                <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400">S/</span>
                {input}
            </span>
        );
    }

    return input;
}
