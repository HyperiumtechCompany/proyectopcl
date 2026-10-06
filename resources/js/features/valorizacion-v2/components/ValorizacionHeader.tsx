import { useFichaTecnica } from '../hooks/useFichaTecnica';
import { formatDate, formatMonthYear } from '../lib/dates';
import { Chip } from '../shared/Chip';
import { usePersistencia } from '../store/PersistenciaProvider';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';
import { fmtMoney, fmtPct } from '../utils/format';
import { HistoryControls } from './HistoryControls';
import { PeriodoSelector } from './PeriodoSelector';
import { ProyectoNav } from './ProyectoNav';
import type { ProyectoRef, ValorizacionRef } from './ProyectoNav';
import { SaveStatus } from './SaveStatus';
import { ValidacionesMenu } from './ValidacionesMenu';

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="min-w-0 rounded-lg border border-stone-700 bg-stone-800/70 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed font-semibold tracking-[0.04em] text-stone-300 uppercase">{label}</p>
            <p className={value === '—' ? 'mt-1 text-sm text-stone-400' : 'mt-1 font-mono text-sm leading-relaxed font-semibold text-stone-50 tabular-nums wrap-break-word'}>{value}</p>
            {hint && <p className="mt-1 text-xs leading-relaxed text-stone-300">{hint}</p>}
        </div>
    );
}

/** Cabecera común a todas las hojas: identifica obra, valorización e indicadores clave (lee de FT). */
export function ValorizacionHeader(nav: { proyecto: ProyectoRef; proyectos: ProyectoRef[]; valorizacion: ValorizacionRef; valorizaciones: ValorizacionRef[] }) {
    const periodo = useValorizacionStore((state) => state.input.periodo);
    const { ficha, calculada, contrato, validacion } = useFichaTecnica();
    const pendientesFicha = validacion.faltantes.length + validacion.alertas.length;
    // Los mismos datos de la FT que el Excel repite en la cabecera de cada hoja.
    const expediente: Array<[string, string]> = [
        ['Entidad', ficha.datosGenerales.entidad],
        ['Ejecutor', ficha.contratista.ejecutor],
        ['Supervisor', ficha.supervision.contratista],
        ['Residente', ficha.contratista.residente],
        ['Ing. supervisor', ficha.supervision.supervisor],
        ['Valor referencial', fmtMoney(contrato.referencial)],
        ['Plazo', calculada.plazoContractualTexto],
    ];
    const numero = String(periodo.numero).padStart(2, '0');
    const aprobada = usePersistencia().cortes.some((corte) => corte.numero === periodo.numero);

    return (
        <header className="@container min-w-0 border-t-2 border-orange-500 bg-stone-900 text-stone-100">
            <div className="flex flex-col gap-3 px-3 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-bold tracking-wide text-white uppercase">
                                Valorización N°{numero} <span className="font-normal text-stone-400">·</span> <span className="text-orange-400">{formatMonthYear(periodo.mes)}</span>
                            </h1>
                            <Chip tone="amber">Entorno de pruebas</Chip>
                            {pendientesFicha > 0 && (
                                <a href="#ficha-tecnica" title={[...validacion.faltantes.map((f) => `Falta: ${f.campo}`), ...validacion.alertas].join(' · ')}>
                                    <Chip tone="danger">Ficha: {pendientesFicha} pendiente{pendientesFicha === 1 ? '' : 's'}</Chip>
                                </a>
                            )}
                            <ValidacionesMenu />
                            {aprobada && <Chip tone="orange" title="Existe una copia aprobada de esta valorización; los cambios no la alteran">Aprobada</Chip>}
                        </div>
                        <p className="mt-1 max-w-5xl text-sm leading-relaxed text-stone-300" title={ficha.datosGenerales.obra}>
                            {ficha.datosGenerales.obra || <span className="text-amber-300 italic">Sin nombre de obra · complétalo en la Ficha técnica</span>}
                        </p>
                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
                            {expediente.map(([label, valor]) => (
                                <div key={label} className="flex min-w-0 gap-1.5">
                                    <dt className="shrink-0 text-stone-400">{label}:</dt>
                                    <dd className="min-w-0 wrap-break-word">
                                        <a href="#ficha-tecnica" className={valor ? 'text-stone-200 hover:text-orange-300' : 'text-amber-300 italic hover:underline'} title="Se edita en la Ficha técnica">
                                            {valor || 'completar'}
                                        </a>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <div className="flex max-w-full flex-wrap items-start gap-3">
                        <div className="hidden max-w-56 text-right text-xs text-stone-400 md:block">
                            <p className="font-medium text-stone-200">{ficha.contratista.contrato || 'Contrato sin registrar'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <ProyectoNav {...nav} />
                            <div className="flex flex-wrap items-center justify-end gap-1">
                                <SaveStatus />
                                <HistoryControls />
                            </div>
                            <PeriodoSelector />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 @min-[24rem]:grid-cols-2 @min-[44rem]:grid-cols-3 @min-[80rem]:grid-cols-6">
                    <Kpi label="Contrato vigente" value={fmtMoney(contrato.vigente)} hint={contrato.auto.vigente ? 'Incluye IGV · automático' : 'Incluye IGV'} />
                    <Kpi label="Plazo" value={`${calculada.plazoVigenteDias} d.c.`} hint={calculada.ampliacionesDias > 0 ? `+${calculada.ampliacionesDias} por ampliaciones` : 'Sin ampliaciones'} />
                    <Kpi label="Inicio · Término" value={formatDate(ficha.plazos.fechaInicioObra)} hint={`Término ${formatDate(calculada.fechaTerminoVigente)}`} />
                    <Kpi label="Avance programado" value={fmtPct(calculada.avance?.programado)} hint={`Acumulado a ${formatMonthYear(periodo.mes)}`} />
                    <Kpi label="Avance ejecutado" value={fmtPct(calculada.avance?.ejecutado)} hint={`Acumulado a ${formatMonthYear(periodo.mes)}`} />
                    <Kpi label="Situación" value={calculada.avance?.texto ?? '—'} hint={ficha.estado.situacionObra} />
                </div>
            </div>
        </header>
    );
}
