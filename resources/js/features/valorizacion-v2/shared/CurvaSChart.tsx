import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LabelProps } from 'recharts';
import type { ControlMes } from '../sheets/control/computeControl';

interface Punto {
    label: string;
    programado: number;
    ejecutado: number | null;
    curva80: number;
}

/** % para dibujar (solo visualización; los cálculos siguen en Decimal). */
const pct100 = (value: { mul: (n: number) => { toNumber: () => number } }): number => Number(value.mul(100).toNumber().toFixed(2));

function puntos(meses: ControlMes[]): Punto[] {
    return [
        { label: 'Inicio', programado: 0, ejecutado: 0, curva80: 0 },
        ...meses.map((mes) => ({
            label: mes.periodo.label,
            programado: pct100(mes.programado.pctAcumulado),
            ejecutado: mes.ejecutado ? pct100(mes.ejecutado.pctAcumulado) : null,
            curva80: pct100(mes.curva80),
        })),
    ];
}

const SERIES = [
    { key: 'programado', label: 'Programado', color: 'var(--serie-prog)' },
    { key: 'ejecutado', label: 'Ejecutado', color: 'var(--serie-ejec)' },
] as const;

function TooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number | null }>; label?: string }) {
    if (!active || !payload?.length) {
        return null;
    }
    const value = (key: string) => payload.find((item) => item.dataKey === key)?.value;

    return (
        <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-stone-700 dark:bg-stone-900">
            <p className="mb-1 font-semibold text-stone-900 dark:text-stone-100">{label}</p>
            {SERIES.map((serie) => (
                <p key={serie.key} className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                    <span className="h-0.5 w-3 rounded" style={{ background: serie.color }} />
                    <span className="flex-1">{serie.label}</span>
                    <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">{value(serie.key) === null || value(serie.key) === undefined ? '—' : `${value(serie.key)?.toFixed(2)}%`}</span>
                </p>
            ))}
            <p className="flex items-center gap-2 text-stone-500">
                <span className="w-3 border-t border-dashed border-stone-400" />
                <span className="flex-1">Curva del 80 %</span>
                <span className="font-mono">{value('curva80')?.toFixed(2)}%</span>
            </p>
        </div>
    );
}

/**
 * Curva S: % acumulado programado vs ejecutado (+ curva del 80 % como línea de
 * referencia). Paleta validada (azul/naranja pasa CVD y contraste en claro y
 * oscuro); identidad también por leyenda y etiqueta directa al final de cada línea.
 */
export function CurvaSChart({ meses, height = 320 }: { meses: ControlMes[]; height?: number }) {
    const data = puntos(meses);
    const ultimoEjecutado = data.reduce((last, punto, index) => (punto.ejecutado !== null ? index : last), 0);
    const directLabel = (key: 'programado' | 'ejecutado', lastIndex: number) =>
        function Label(props: LabelProps) {
            const { index } = props as LabelProps & { index?: number };
            if (index !== lastIndex || props.value === null || props.value === undefined) {
                return null;
            }

            return (
                <text x={Number(props.x)} y={Number(props.y) - 10} textAnchor="middle" className="fill-stone-800 text-[11px] font-semibold dark:fill-stone-100">
                    {`${Number(props.value).toFixed(2)}%`}
                    <title>{key}</title>
                </text>
            );
        };

    return (
        <div className="[--serie-ejec:#ea580c] [--serie-prog:#1d4ed8] dark:[--serie-prog:#3b82f6]">
            <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-stone-600 dark:text-stone-300">
                {SERIES.map((serie) => (
                    <span key={serie.key} className="inline-flex items-center gap-1.5">
                        <span className="h-0.5 w-4 rounded" style={{ background: serie.color }} />
                        {serie.label}
                    </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 border-t-2 border-dashed border-stone-400" />
                    Curva del 80 % del programado
                </span>
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data} margin={{ top: 24, right: 24, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="currentColor" className="text-stone-200 dark:text-stone-800" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} className="text-stone-500" />
                    <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(value: number) => `${value}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip content={<TooltipContent />} cursor={{ stroke: '#a8a29e', strokeDasharray: '3 3' }} />
                    <Line type="monotone" dataKey="curva80" stroke="#a8a29e" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="programado" stroke="var(--serie-prog)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--serie-prog)', stroke: '#fff' }} isAnimationActive={false}>
                        <LabelList dataKey="programado" content={directLabel('programado', data.length - 1)} />
                    </Line>
                    <Line type="monotone" dataKey="ejecutado" stroke="var(--serie-ejec)" strokeWidth={2} connectNulls={false} dot={{ r: 4, strokeWidth: 2, fill: 'var(--serie-ejec)', stroke: '#fff' }} isAnimationActive={false}>
                        <LabelList dataKey="ejecutado" content={directLabel('ejecutado', ultimoEjecutado)} />
                    </Line>
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
