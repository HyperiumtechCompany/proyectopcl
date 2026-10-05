import { AlertTriangle, Check, CloudUpload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersistencia } from '../store/PersistenciaProvider';

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '');

/** Estado del autoguardado (Guardado · Guardando · Sin guardar · Error · Conflicto). */
export function SaveStatus() {
    const { estado, guardadoEn, error, guardarAhora } = usePersistencia();
    const base = 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium';

    if (estado === 'guardando') {
        return <span className={cn(base, 'text-stone-300')}><Loader2 className="size-3.5 animate-spin" /> Guardando…</span>;
    }
    if (estado === 'pendiente') {
        return <span className={cn(base, 'text-amber-300')}><CloudUpload className="size-3.5" /> Cambios sin guardar</span>;
    }
    if (estado === 'error') {
        return (
            <button type="button" onClick={() => void guardarAhora()} title={error ?? undefined} className={cn(base, 'bg-red-500/15 text-red-300 hover:bg-red-500/25')}>
                <AlertTriangle className="size-3.5" /> No se guardó · reintentar
            </button>
        );
    }
    if (estado === 'conflicto') {
        return <span className={cn(base, 'bg-red-500/15 text-red-300')}><AlertTriangle className="size-3.5" /> Conflicto de versiones</span>;
    }

    return <span className={cn(base, 'text-stone-400')}><Check className="size-3.5 text-orange-400" /> Guardado {hora(guardadoEn)}</span>;
}
