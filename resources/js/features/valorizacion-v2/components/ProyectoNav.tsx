import { Link } from '@inertiajs/react';
import { ChevronDown, FileSpreadsheet, FolderOpen, FolderPlus, List, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ProyectoRef {
    id: number;
    nombre: string;
}

export interface ValorizacionRef {
    public_id: string;
    nombre: string;
}

interface Props {
    proyecto: ProyectoRef;
    proyectos: ProyectoRef[];
    valorizacion: ValorizacionRef;
    valorizaciones: ValorizacionRef[];
}

/**
 * Navegación de la cabecera: otras valorizaciones de esta obra, ver todas /
 * crear nueva, valorizaciones de otras obras y volver al proyecto.
 */
export function ProyectoNav({ proyecto, proyectos, valorizacion, valorizaciones }: Props) {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const base = `/costos/${proyecto.id}/valorizacion-v2`;
    const otrasObras = proyectos.filter((p) => p.id !== proyecto.id);

    useEffect(() => {
        if (!abierto) {
            return;
        }
        const cerrar = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setAbierto(false);
            }
        };
        const esc = (event: KeyboardEvent) => event.key === 'Escape' && setAbierto(false);
        document.addEventListener('pointerdown', cerrar);
        document.addEventListener('keydown', esc);

        return () => {
            document.removeEventListener('pointerdown', cerrar);
            document.removeEventListener('keydown', esc);
        };
    }, [abierto]);

    const item = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-stone-700 hover:bg-orange-50 dark:text-stone-200 dark:hover:bg-orange-500/10';
    const titulo = 'px-3 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-stone-400 uppercase';

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setAbierto((value) => !value)}
                aria-expanded={abierto}
                aria-haspopup="menu"
                className="inline-flex min-h-9 max-w-[min(20rem,calc(100vw-3rem))] items-center gap-1.5 rounded-md border border-stone-700 bg-stone-800 px-2 py-1.5 text-xs font-semibold text-white hover:border-orange-500"
                title="Cambiar de valorización u obra"
            >
                <FileSpreadsheet className="size-3.5 shrink-0 text-orange-400" />
                <span className="truncate">{valorizacion.nombre}</span>
                <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', abierto && 'rotate-180')} />
            </button>
            {abierto && (
                <div role="menu" className="absolute right-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-xl dark:border-stone-700 dark:bg-stone-900">
                    <p className={titulo}>Valorizaciones de esta obra</p>
                    <div className="max-h-48 overflow-y-auto">
                        {valorizaciones.map((v) => (
                            <Link key={v.public_id} href={`${base}/${v.public_id}`} role="menuitem" className={cn(item, v.public_id === valorizacion.public_id && 'bg-orange-50 font-semibold dark:bg-orange-500/10')}>
                                <FileSpreadsheet className="size-4 shrink-0 text-stone-400" />
                                <span className="truncate">{v.nombre}</span>
                                {v.public_id === valorizacion.public_id && <span className="ml-auto text-[10px] text-orange-600">actual</span>}
                            </Link>
                        ))}
                    </div>
                    <Link href={base} role="menuitem" className={item}>
                        <List className="size-4 text-stone-400" /> Ver todas las valorizaciones
                    </Link>
                    <Link href={base} role="menuitem" className={cn(item, 'font-semibold text-orange-700 dark:text-orange-300')}>
                        <Plus className="size-4" /> Nueva valorización
                    </Link>

                    {otrasObras.length > 0 && (
                        <>
                            <div className="my-1 border-t border-stone-100 dark:border-stone-800" />
                            <p className={titulo}>Otras obras</p>
                            <div className="max-h-40 overflow-y-auto">
                                {otrasObras.map((p) => (
                                    <Link key={p.id} href={`/costos/${p.id}/valorizacion-v2`} role="menuitem" className={item}>
                                        <FolderOpen className="size-4 shrink-0 text-stone-400" />
                                        <span className="truncate">{p.nombre}</span>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="my-1 border-t border-stone-100 dark:border-stone-800" />
                    <Link href={`/costos/${proyecto.id}`} role="menuitem" className={item}>
                        <FolderOpen className="size-4 text-stone-400" /> Volver al proyecto ({proyecto.nombre})
                    </Link>
                    <Link href="/costos/create" role="menuitem" className={item}>
                        <FolderPlus className="size-4 text-stone-400" /> Crear un proyecto nuevo
                    </Link>
                </div>
            )}
        </div>
    );
}
