import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { findSheet } from '../config/sheets';
import { useValidaciones } from '../hooks/useValidaciones';
import type { Hallazgo } from '../validation/validarValorizacion';

/** Lista de hallazgos con enlace a la hoja donde se corrige cada uno. */
export function HallazgosList({ hallazgos, onNavigate }: { hallazgos: Hallazgo[]; onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
    return (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {hallazgos.map((h) => (
                <li key={`${h.regla}-${h.mensaje}`} className="flex gap-2 py-2">
                    {h.nivel === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />}
                    <div className="min-w-0 text-xs leading-relaxed">
                        <p className="text-stone-800 dark:text-stone-200">{h.mensaje}</p>
                        <a href={`#${h.hoja}`} onClick={onNavigate} className="font-semibold text-orange-700 hover:underline dark:text-orange-300">
                            Ir a {findSheet(h.hoja)?.label ?? h.hoja} →
                        </a>
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** Chip de la cabecera: errores (bloquean aprobar) y avisos de negocio de la valorización activa. */
export function ValidacionesMenu() {
    const { hallazgos, errores, avisos } = useValidaciones();

    if (hallazgos.length === 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded border border-stone-700 bg-stone-800 px-1.5 py-px text-[10px] font-semibold tracking-wide text-stone-200 uppercase" title="Sin observaciones de negocio">
                <CircleCheck className="size-3 text-orange-400" /> Validación OK
            </span>
        );
    }

    return (
        <details className="group relative">
            <summary
                className={cn(
                    'inline-flex cursor-pointer list-none items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase',
                    errores.length > 0 ? 'border-red-400/50 bg-red-500/15 text-red-200' : 'border-amber-400/50 bg-amber-500/15 text-amber-200',
                )}
            >
                {errores.length > 0 ? <CircleAlert className="size-3" /> : <TriangleAlert className="size-3" />}
                {[errores.length > 0 && `${errores.length} error${errores.length === 1 ? '' : 'es'}`, avisos.length > 0 && `${avisos.length} aviso${avisos.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
            </summary>
            <div className="absolute left-0 z-40 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-3 text-stone-900 shadow-xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
                <p className="text-[11px] font-semibold tracking-[0.04em] text-stone-500 uppercase">Validaciones de negocio</p>
                {errores.length > 0 && <p className="mt-1 text-xs text-red-700 dark:text-red-300">Los errores impiden aprobar la valorización; los avisos solo se revisan.</p>}
                <HallazgosList hallazgos={hallazgos} onNavigate={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} />
            </div>
        </details>
    );
}
