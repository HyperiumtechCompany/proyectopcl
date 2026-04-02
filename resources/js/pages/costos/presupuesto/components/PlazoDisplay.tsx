// components/PlazoDisplay.tsx
// Componente reutilizable que muestra visualmente el plazo del proyecto
// en diferentes unidades: días, semanas, meses, año.
import { Calendar, Clock, CalendarDays, CalendarRange } from 'lucide-react';
import React from 'react';
import { useProjectParamsStore } from '../stores/projectParamsStore';

interface PlazoDisplayProps {
    /** Compacto (una sola línea) vs expandido (tarjetas). Default: 'compact' */
    variant?: 'compact' | 'cards';
    /** Color temático. Default: 'sky' */
    color?: 'sky' | 'amber' | 'emerald' | 'purple';
}

const COLOR_MAP = {
    sky: {
        bg: 'bg-sky-500/10',
        border: 'border-sky-500/30',
        text: 'text-sky-400',
        label: 'text-sky-300',
        iconBg: 'bg-sky-500/15',
        activeDot: 'bg-sky-500',
        glow: 'shadow-sky-500/20',
    },
    amber: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        label: 'text-amber-300',
        iconBg: 'bg-amber-500/15',
        activeDot: 'bg-amber-500',
        glow: 'shadow-amber-500/20',
    },
    emerald: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        label: 'text-emerald-300',
        iconBg: 'bg-emerald-500/15',
        activeDot: 'bg-emerald-500',
        glow: 'shadow-emerald-500/20',
    },
    purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        label: 'text-purple-300',
        iconBg: 'bg-purple-500/15',
        activeDot: 'bg-purple-500',
        glow: 'shadow-purple-500/20',
    },
};

export function PlazoDisplay({ variant = 'compact', color = 'sky' }: PlazoDisplayProps) {
    const params = useProjectParamsStore((s) => s.params);
    const duracionDias = useProjectParamsStore((s) => s.getDuracionDias());
    const duracionMeses = useProjectParamsStore((s) => s.getDuracionMeses());

    // Cálculos derivados
    const semanas = duracionDias > 0 ? +(duracionDias / 7).toFixed(1) : 0;
    const anios = duracionDias > 0 ? +(duracionDias / 365).toFixed(2) : 0;

    const fechaInicio = params?.fecha_inicio
        ? new Date(params.fecha_inicio).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;
    const fechaFin = params?.fecha_fin
        ? new Date(params.fecha_fin).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;

    const c = COLOR_MAP[color];

    if (variant === 'cards') {
        return (
            <div className="flex items-stretch gap-3">
                {/* Días */}
                <div className={`flex items-center gap-2.5 rounded-lg border ${c.border} ${c.bg} px-3 py-2 transition-all hover:scale-[1.02]`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg}`}>
                        <CalendarDays className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <div>
                        <p className="text-[8px] font-bold tracking-widest text-slate-500 uppercase">Días</p>
                        <p className={`font-mono text-base font-black ${c.text}`}>{duracionDias}</p>
                    </div>
                </div>

                {/* Semanas */}
                <div className={`flex items-center gap-2.5 rounded-lg border ${c.border} ${c.bg} px-3 py-2 transition-all hover:scale-[1.02]`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg}`}>
                        <CalendarRange className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <div>
                        <p className="text-[8px] font-bold tracking-widest text-slate-500 uppercase">Semanas</p>
                        <p className={`font-mono text-base font-black ${c.text}`}>{semanas}</p>
                    </div>
                </div>

                {/* Meses */}
                <div className={`flex items-center gap-2.5 rounded-lg border ${c.border} ${c.bg} px-3 py-2 transition-all hover:scale-[1.02]`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg}`}>
                        <Calendar className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <div>
                        <p className="text-[8px] font-bold tracking-widest text-slate-500 uppercase">Meses</p>
                        <p className={`font-mono text-base font-black ${c.text}`}>{duracionMeses}</p>
                    </div>
                </div>

                {/* Años */}
                <div className={`flex items-center gap-2.5 rounded-lg border ${c.border} ${c.bg} px-3 py-2 transition-all hover:scale-[1.02]`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg}`}>
                        <Clock className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <div>
                        <p className="text-[8px] font-bold tracking-widest text-slate-500 uppercase">Años</p>
                        <p className={`font-mono text-base font-black ${c.text}`}>{anios}</p>
                    </div>
                </div>

                {/* Fechas (si están disponibles) */}
                {(fechaInicio || fechaFin) && (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                            {fechaInicio && (
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[9px] font-semibold text-slate-500">Inicio:</span>
                                    <span className="text-[10px] font-bold text-slate-300">{fechaInicio}</span>
                                </div>
                            )}
                            {fechaFin && (
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                    <span className="text-[9px] font-semibold text-slate-500">Fin:</span>
                                    <span className="text-[10px] font-bold text-slate-300">{fechaFin}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Compact variant ──
    return (
        <div className={`flex items-center gap-3 rounded-lg border ${c.border} ${c.bg} px-3 py-1.5`}>
            <div className="flex items-center gap-1.5">
                <Calendar className={`h-3.5 w-3.5 ${c.text}`} />
                <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Plazo</span>
            </div>

            <div className="h-4 w-px bg-slate-700" />

            {/* Días */}
            <div className="flex items-center gap-1">
                <span className={`font-mono text-xs font-black ${c.text}`}>{duracionDias}</span>
                <span className="text-[9px] text-slate-500">días</span>
            </div>

            <span className="text-slate-700">·</span>

            {/* Semanas */}
            <div className="flex items-center gap-1">
                <span className={`font-mono text-xs font-black ${c.text}`}>{semanas}</span>
                <span className="text-[9px] text-slate-500">sem.</span>
            </div>

            <span className="text-slate-700">·</span>

            {/* Meses */}
            <div className="flex items-center gap-1">
                <span className={`font-mono text-xs font-black ${c.text}`}>{duracionMeses}</span>
                <span className="text-[9px] text-slate-500">meses</span>
            </div>

            <span className="text-slate-700">·</span>

            {/* Años */}
            <div className="flex items-center gap-1">
                <span className={`font-mono text-xs font-black ${c.text}`}>{anios}</span>
                <span className="text-[9px] text-slate-500">año(s)</span>
            </div>

            {/* Fechas inline */}
            {(fechaInicio || fechaFin) && (
                <>
                    <div className="h-4 w-px bg-slate-700" />
                    <div className="flex items-center gap-2">
                        {fechaInicio && (
                            <span className="flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                <span className="text-[9px] text-slate-400">{fechaInicio}</span>
                            </span>
                        )}
                        {fechaFin && (
                            <span className="flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-red-500" />
                                <span className="text-[9px] text-slate-400">{fechaFin}</span>
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
