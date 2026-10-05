import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useTablero } from '../../hooks/useTablero';
import { formatMonthYear } from '../../lib/dates';
import { CurvaSChart } from '../../shared/CurvaSChart';
import { SituacionBadge } from '../../shared/SituacionBadge';
import { fmtMoney, fmtPct } from '../../utils/format';

function Indicador({ label, value, detalle, children, destacado = false }: { label: string; value: string; detalle?: ReactNode; children?: ReactNode; destacado?: boolean }) {
    return (
        <div className={cn('min-w-0 rounded-lg border p-4', destacado ? 'border-orange-700 bg-orange-700 text-white dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-100' : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900')}>
            <p className={cn('text-xs leading-relaxed font-semibold tracking-wide uppercase', destacado ? 'text-orange-100' : 'text-stone-600 dark:text-stone-300')}>{label}</p>
            <p className={cn('mt-2 font-mono text-xl leading-relaxed font-bold tabular-nums wrap-break-word 2xl:text-2xl', !destacado && 'text-stone-900 dark:text-stone-50')}>{value}</p>
            {detalle && <div className={cn('mt-1 text-xs leading-relaxed', destacado ? 'text-orange-100' : 'text-stone-600 dark:text-stone-300')}>{detalle}</div>}
            {children}
        </div>
    );
}

/** Barra de avance con referencia (p. ej. ejecutado vs programado). */
function Barra({ valor, referencia, tono = 'bg-orange-500' }: { valor: number; referencia?: number; tono?: string }) {
    return (
        <div className="relative mt-3 h-2 rounded-full bg-stone-200 dark:bg-stone-700">
            <div className={cn('h-full rounded-full', tono)} style={{ width: `${Math.min(100, valor)}%` }} />
            {referencia !== undefined && <div className="absolute -top-1 h-4 w-0.5 rounded bg-blue-700 dark:bg-blue-500" style={{ left: `${Math.min(100, referencia)}%` }} title={`Programado ${referencia.toFixed(2)}%`} />}
        </div>
    );
}

const pct = (value: { mul: (n: number) => { toNumber: () => number } }) => value.mul(100).toNumber();

/** Tablero de indicadores (reconstrucción de la hoja "res %", rota en el Excel). */
export default function TableroSheet() {
    const { tablero, control, input } = useTablero();
    const { fisico, tiempo, financiero, garantia } = tablero;
    const situacion = control.ultima?.evaluacion?.situacion;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Tablero de indicadores</h2>
                    <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">
                        Valorización N°{String(input.periodo.numero).padStart(2, '0')} · {formatMonthYear(input.periodo.mes)} — resumen de todas las hojas (reconstruye la hoja “res %” del Excel, que estaba rota).
                    </p>
                </div>
                {situacion && <SituacionBadge situacion={situacion} prefix="Obra " />}
            </div>

            <div className="grid gap-3 @min-[32rem]:grid-cols-2 @min-[72rem]:grid-cols-4">
                <Indicador label="Avance físico ejecutado" value={fmtPct(fisico.ejecutado)} detalle={<>Programado {fmtPct(fisico.programado)} · {fisico.diferencia && (fisico.diferencia.isNegative() ? 'atraso' : 'adelanto')} {fmtPct(fisico.diferencia?.abs())}</>}>
                    <Barra valor={pct(fisico.ejecutado)} referencia={pct(fisico.programado)} />
                </Indicador>
                <Indicador label="Avance del plazo" value={fmtPct(tiempo.pct)} detalle={`${tiempo.transcurridos} de ${tiempo.plazo} días calendario al cierre del mes`}>
                    <Barra valor={pct(tiempo.pct)} tono="bg-stone-500" />
                </Indicador>
                <Indicador label="Valorización del mes" value={fmtMoney(tablero.valorizacionMes)} detalle="Incluye IGV · sin reajuste" />
                <Indicador label="Líquido a pagar" value={fmtMoney(tablero.liquidoMes)} detalle="Después de retenciones y detracción" destacado />
            </div>

            <div className="grid gap-3 @min-[32rem]:grid-cols-2 @min-[72rem]:grid-cols-4">
                <Indicador label="Avance financiero devengado" value={fmtPct(financiero.devengadoPct)} detalle={fmtMoney(financiero.devengado)}>
                    <Barra valor={pct(financiero.devengadoPct)} />
                </Indicador>
                <Indicador label="Pendiente por devengar" value={fmtMoney(financiero.pendiente)} detalle={<a href="#control-financiero" className="inline-flex items-center gap-1 text-orange-700 hover:underline dark:text-orange-300">Ver control financiero <ArrowRight className="size-3" /></a>} />
                <Indicador label="Garantía de fiel cumplimiento" value={fmtMoney(garantia.retenida)} detalle={`Retenida de ${fmtMoney(garantia.total)}`} />
                <Indicador label="Saldo de obra por valorizar" value={fmtMoney(financiero.saldoObra)} detalle="Contrato vigente − ejecutado acumulado" />
            </div>

            <div className="grid gap-3 @min-[64rem]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <figure className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                    <figcaption className="mb-2 text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">Curva S</figcaption>
                    <CurvaSChart meses={control.meses} height={240} />
                </figure>

                <figure className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                    <figcaption className="mb-1 text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">Cuadro de control de avance por componente</figcaption>
                    <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-stone-500">
                        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-orange-300" /> Anterior</span>
                        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-orange-600" /> Actual</span>
                        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-stone-300 dark:bg-stone-600" /> Saldo</span>
                    </div>
                    <ul className="space-y-1.5">
                        {tablero.componentes.map((comp) => (
                            <li key={comp.codigo} className="grid grid-cols-[3rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[11px]">
                                <span className="font-mono text-stone-500">{comp.codigo}</span>
                                <div className="min-w-0">
                                    <p className="truncate text-stone-700 dark:text-stone-300" title={comp.descripcion}>{comp.descripcion}</p>
                                    <div className="mt-0.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-stone-300 dark:bg-stone-600" title={`Anterior ${fmtPct(comp.anteriorPct)} · actual ${fmtPct(comp.actualPct)} · saldo ${fmtPct(comp.saldoPct)}`}>
                                        <div className="bg-orange-300" style={{ width: `${Math.max(0, pct(comp.anteriorPct))}%` }} />
                                        <div className="bg-orange-600" style={{ width: `${Math.max(0, pct(comp.actualPct))}%` }} />
                                    </div>
                                </div>
                                <span className="text-right font-mono font-semibold text-stone-900 tabular-nums dark:text-stone-100">{fmtPct(comp.acumuladoPct, 1)}</span>
                            </li>
                        ))}
                    </ul>
                </figure>
            </div>
        </div>
    );
}
