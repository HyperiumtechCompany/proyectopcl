import type Decimal from 'decimal.js';
import { AlertTriangle, CheckCircle2, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useFichaTecnica } from '../../hooks/useFichaTecnica';
import { formatDate, formatMonthYear } from '../../lib/dates';
import type { IsoDate } from '../../lib/dates';
import { D, parseDecimal, safeDiv } from '../../lib/money';
import { newPartidaId } from '../../lib/presupuestoOps';
import { Chip } from '../../shared/Chip';
import { DataRow } from '../../shared/DataRow';
import { EditableCell } from '../../shared/EditableCell';
import { Panel } from '../../shared/Panel';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import type { FichaTecnica, ModificacionContrato, ModificacionPlazo } from '../../types';
import { fmtMoney, fmtPct } from '../../utils/format';
import { ImportValorizacionPanel } from './ImportValorizacionPanel';

const PENDIENTE_CONTROL = 'Se obtiene del Control general';

const parsePorcentaje = (raw: string): string | false => {
    const pct = parseDecimal(raw.replace('%', ''));

    return pct === null || pct.lt(0) || pct.gte(100) ? false : pct.div(100).toString();
};

const auto = (regla: string) => (
    <Chip tone="neutral" title={`Automático: ${regla}. Se calcula solo y no se edita.`}>
        Automático
    </Chip>
);

/**
 * Hoja FT — fuente maestra de la valorización. Como en el Excel, cada dato se
 * edita con un clic y todas las hojas se recalculan; los campos "Calculado" y
 * "Automático" se derivan de otros datos (presupuesto, plazos, control).
 */
export default function FichaTecnicaSheet() {
    const { ficha, calculada, contrato, validacion, tiempo, mesValorizacion } = useFichaTecnica();
    const parametros = useValorizacionStore((state) => state.input.parametros);
    const updateFicha = useValorizacionStore((state) => state.updateFicha);
    const setParametros = useValorizacionStore((state) => state.setParametros);
    const { datosGenerales: g, contratista: c, supervision: s, plazos: p, estado: e } = ficha;
    const pendiente = calculada.avance ? undefined : PENDIENTE_CONTROL;
    const pendientes = validacion.faltantes.length + validacion.alertas.length;

    /* ── Editores (un clic = editar, como una celda de Excel) ─────────────────── */

    const texto = <S extends keyof FichaTecnica>(seccion: S, valor: string, patch: (v: string) => Partial<FichaTecnica[S]>, label: string): ReactNode => (
        <EditableCell label={label} value={valor || null} display={valor} onCommit={(v) => updateFicha(seccion, patch(v ?? ''))} />
    );

    const fecha = <S extends keyof FichaTecnica>(seccion: S, valor: IsoDate | null, patch: (v: IsoDate | null) => Partial<FichaTecnica[S]>, label: string, requerida = false): ReactNode => (
        <EditableCell
            label={label}
            kind="date"
            placeholder="Sin fecha · clic para elegir"
            title="Clic para elegir la fecha"
            value={valor}
            display={valor ? formatDate(valor) : ''}
            onCommit={(v) => (v || !requerida) && updateFicha(seccion, patch(v))}
        />
    );

    const dinero = <S extends keyof FichaTecnica>(seccion: S, valor: string, patch: (v: string) => Partial<FichaTecnica[S]>, label: string): ReactNode => (
        <EditableCell label={label} kind="money" value={valor} display={fmtMoney(valor)} onCommit={(v) => updateFicha(seccion, patch(v ?? '0.00'))} />
    );

    const dias = <S extends keyof FichaTecnica>(seccion: S, valor: number, patch: (v: number) => Partial<FichaTecnica[S]>, label: string, display: string): ReactNode => (
        <EditableCell label={label} kind="integer" value={String(valor)} display={display} title="Días calendario" onCommit={(v) => v && updateFicha(seccion, patch(Number(v)))} />
    );

    const volverAuto = (onClick: () => void) => (
        <button type="button" onClick={onClick} className="text-[11px] font-semibold text-orange-700 hover:underline dark:text-orange-300" title="Descarta el valor escrito y vuelve a calcularlo">
            Usar automático
        </button>
    );

    const montoContrato = (campo: 'valorReferencial' | 'montoContratoPrincipal' | 'montoContratoVigente', resuelto: Decimal, esAuto: boolean, label: string, regla: string): ReactNode =>
        esAuto ? (
            <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] tabular-nums">{fmtMoney(resuelto)}</span>
                {auto(regla)}
            </span>
        ) : (
            <span className="inline-flex flex-wrap items-center gap-2">
                <EditableCell label={label} kind="money" value={c[campo]} display={fmtMoney(resuelto)} onCommit={(v) => updateFicha('contratista', { [campo]: v })} />
                <Chip tone="amber" title={`Valor escrito; el automático sería: ${regla}`}>Manual</Chip>
                {volverAuto(() => updateFicha('contratista', { [campo]: null }))}
            </span>
        );

    const adelanto = (campo: 'adelantoDirecto' | 'adelantoMateriales', label: string): ReactNode => {
        const monto = c[campo].monto;

        return (
            <span className="inline-flex flex-wrap items-center gap-2">
                <EditableCell
                    label={label}
                    kind="money"
                    placeholder="vacío = no se otorgó"
                    value={monto}
                    display={monto === null ? 'NO SE OTORGÓ ADELANTO' : fmtMoney(monto)}
                    onCommit={(v) => updateFicha('contratista', { [campo]: { ...c[campo], monto: v } })}
                />
                {monto !== null && <Chip tone="amber" title="Monto del adelanto / contrato principal">{fmtPct(safeDiv(monto, contrato.principal))} del contrato</Chip>}
            </span>
        );
    };

    const listaPlazo = (campo: 'ampliaciones' | 'suspensiones', total: number): ReactNode => {
        const lista = p[campo];
        const actualizar = (items: ModificacionPlazo[]) => updateFicha('plazos', { [campo]: items });

        return (
            <div className="w-full space-y-1">
                {lista.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center gap-2 @min-[32rem]:flex-nowrap">
                        <EditableCell label={`Documento de ${campo}`} placeholder="Resolución / documento" value={item.documento || null} onCommit={(v) => actualizar(lista.map((x) => (x.id === item.id ? { ...x, documento: v ?? '' } : x)))} />
                        <EditableCell label={`Días de ${campo}`} kind="integer" className="max-w-20" value={String(item.dias)} onCommit={(v) => v && actualizar(lista.map((x) => (x.id === item.id ? { ...x, dias: Number(v) } : x)))} />
                        <span className="text-[11px] text-stone-500">d.c.</span>
                        <button type="button" aria-label="Quitar" onClick={() => actualizar(lista.filter((x) => x.id !== item.id))} className="rounded p-1 text-stone-400 hover:text-red-600">
                            <Trash2 className="size-3.5" />
                        </button>
                    </div>
                ))}
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => actualizar([...lista, { id: newPartidaId(), documento: '', dias: 0 }])} className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline dark:text-orange-300">
                        <Plus className="size-3.5" /> Agregar {campo === 'ampliaciones' ? 'ampliación' : 'suspensión'}
                    </button>
                    {lista.length > 0 && <span className="text-xs text-stone-500">Total: {total} d.c.</span>}
                </div>
            </div>
        );
    };

    const listaContrato = (): ReactNode => {
        const lista = c.modificacionesContrato;
        const actualizar = (items: ModificacionContrato[]) => updateFicha('contratista', { modificacionesContrato: items });

        return (
            <div className="w-full space-y-1">
                {lista.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center gap-2 @min-[32rem]:flex-nowrap">
                        <select
                            value={item.tipo}
                            aria-label="Tipo de modificación"
                            onChange={(event) => actualizar(lista.map((x) => (x.id === item.id ? { ...x, tipo: event.target.value as ModificacionContrato['tipo'] } : x)))}
                            className="min-h-9 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-base text-stone-900 sm:text-[13px] dark:border-amber-500/50 dark:bg-stone-800 dark:text-stone-100 dark:scheme-dark"
                        >
                            <option value="adicional">Adicional</option>
                            <option value="deductivo">Deductivo</option>
                        </select>
                        <EditableCell label="Documento de la modificación" placeholder="Resolución" value={item.documento || null} onCommit={(v) => actualizar(lista.map((x) => (x.id === item.id ? { ...x, documento: v ?? '' } : x)))} />
                        <EditableCell label="Monto de la modificación" kind="money" className="max-w-36" value={item.monto} onCommit={(v) => actualizar(lista.map((x) => (x.id === item.id ? { ...x, monto: v ?? '0.00' } : x)))} />
                        <button type="button" aria-label="Quitar" onClick={() => actualizar(lista.filter((x) => x.id !== item.id))} className="rounded p-1 text-stone-400 hover:text-red-600">
                            <Trash2 className="size-3.5" />
                        </button>
                    </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => actualizar([...lista, { id: newPartidaId(), documento: '', tipo: 'adicional', monto: '0' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline dark:text-orange-300">
                        <Plus className="size-3.5" /> Agregar adicional o deductivo de obra
                    </button>
                    {lista.length > 0 && (
                        <span className="text-xs text-stone-500">
                            +{fmtMoney(contrato.adicionales)} · −{fmtMoney(contrato.deductivos)}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const porcentaje = (campo: keyof typeof parametros, label: string): ReactNode => (
        <EditableCell
            label={label}
            kind="number"
            title="Porcentaje, p. ej. 10 o 10%"
            value={parseDecimal(parametros[campo])?.mul(100).toString() ?? null}
            display={fmtPct(parametros[campo])}
            parse={parsePorcentaje}
            onCommit={(v) => v && setParametros({ [campo]: v })}
        />
    );

    return (
        <div className="space-y-4">
            <ImportValorizacionPanel />
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 dark:text-stone-50">Ficha técnica del proyecto</h2>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Datos maestros: cualquier cambio aquí se refleja en la cabecera y en todas las hojas.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="size-3.5" /> Clic en cualquier dato para editarlo · Enter guarda · Esc cancela
                    </span>
                    <span className="hidden items-center gap-1 md:inline-flex">
                        <Chip tone="amber">Calculado</Chip> <Chip tone="neutral">Automático</Chip> = se derivan
                    </span>
                </div>
            </div>

            <div className={cn('rounded-lg border px-4 py-3', pendientes === 0 ? 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900' : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10')}>
                <div className="flex flex-wrap items-center gap-3">
                    {pendientes === 0 ? <CheckCircle2 className="size-5 text-orange-600" /> : <AlertTriangle className="size-5 text-amber-600" />}
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Ficha {validacion.completos === validacion.total ? 'completa' : 'incompleta'} · {validacion.completos} de {validacion.total} datos obligatorios
                    </p>
                    <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                        <div className="h-full rounded-full bg-orange-500" style={{ width: `${(validacion.completos / validacion.total) * 100}%` }} />
                    </div>
                </div>
                {pendientes > 0 && (
                    <div className="mt-2 grid gap-3 text-xs text-stone-700 md:grid-cols-2 dark:text-stone-300">
                        {validacion.faltantes.length > 0 && (
                            <div>
                                <p className="font-semibold">Falta completar (clic en el dato para llenarlo)</p>
                                <ul className="mt-1 list-disc pl-5">
                                    {validacion.faltantes.map((f) => (
                                        <li key={f.seccion + f.campo}>
                                            {f.campo} <span className="text-stone-500">({f.seccion})</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {validacion.alertas.length > 0 && (
                            <div>
                                <p className="font-semibold">Revisar</p>
                                <ul className="mt-1 list-disc pl-5">
                                    {validacion.alertas.map((a) => (
                                        <li key={a}>{a}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 @min-[70rem]:grid-cols-2">
                <div className="min-w-0 space-y-4">
                    <Panel badge="A" title="Datos generales">
                        <dl>
                            <DataRow label="Entidad">{texto('datosGenerales', g.entidad, (v) => ({ entidad: v }), 'Entidad')}</DataRow>
                            <DataRow label="Obra">{texto('datosGenerales', g.obra, (v) => ({ obra: v }), 'Obra')}</DataRow>
                            <DataRow label="Código único de inversión" numeric>{texto('datosGenerales', g.cui, (v) => ({ cui: v }), 'CUI')}</DataRow>
                            <DataRow label="Aprobación del expediente técnico">{texto('datosGenerales', g.resolucionAprobacion, (v) => ({ resolucionAprobacion: v }), 'Aprobación del expediente')}</DataRow>
                            <DataRow label="Fecha de aprobación del expediente" numeric>{fecha('datosGenerales', g.fechaAprobacionExpediente, (v) => ({ fechaAprobacionExpediente: v }), 'Fecha de aprobación')}</DataRow>
                            <DataRow label="Fecha de presupuesto base" numeric>{fecha('datosGenerales', g.fechaPresupuestoBase, (v) => ({ fechaPresupuestoBase: v }), 'Fecha de presupuesto base')}</DataRow>
                            {(['departamento', 'provincia', 'distrito', 'localidad'] as const).map((campo) => (
                                <DataRow key={campo} label={campo.charAt(0).toUpperCase() + campo.slice(1)}>
                                    {texto('datosGenerales', g.ubicacion[campo], (v) => ({ ubicacion: { ...g.ubicacion, [campo]: v } }), campo)}
                                </DataRow>
                            ))}
                        </dl>
                    </Panel>

                    <Panel badge="B" title="Del contratista ejecutor">
                        <dl>
                            <DataRow label="Ejecutor" emphasis>{texto('contratista', c.ejecutor, (v) => ({ ejecutor: v }), 'Ejecutor')}</DataRow>
                            <DataRow label="Representante común legal">{texto('contratista', c.representanteLegal, (v) => ({ representanteLegal: v }), 'Representante legal')}</DataRow>
                            <DataRow label="Domicilio legal">{texto('contratista', c.domicilioLegal, (v) => ({ domicilioLegal: v }), 'Domicilio legal')}</DataRow>
                            <DataRow label="Proceso de selección">{texto('contratista', c.procesoSeleccion, (v) => ({ procesoSeleccion: v }), 'Proceso de selección')}</DataRow>
                            <DataRow label="Adjudicación de buena pro" numeric>{fecha('contratista', c.fechaBuenaPro, (v) => ({ fechaBuenaPro: v }), 'Buena pro')}</DataRow>
                            <DataRow label="Contrato">{texto('contratista', c.contrato, (v) => ({ contrato: v }), 'Contrato')}</DataRow>
                            <DataRow label="Fecha de firma del contrato" numeric>{fecha('contratista', c.fechaFirmaContrato, (v) => ({ fechaFirmaContrato: v }), 'Firma del contrato')}</DataRow>
                            <DataRow label="Modalidad de ejecución">{texto('contratista', c.modalidadEjecucion, (v) => ({ modalidadEjecucion: v }), 'Modalidad')}</DataRow>
                            <DataRow label="Sistema de contratación">{texto('contratista', c.sistemaContratacion, (v) => ({ sistemaContratacion: v }), 'Sistema de contratación')}</DataRow>
                            <DataRow label="Valor referencial (con IGV)" numeric>{montoContrato('valorReferencial', contrato.referencial, contrato.auto.referencial, 'Valor referencial', 'total del presupuesto')}</DataRow>
                            <DataRow label="Monto del contrato principal" numeric>{montoContrato('montoContratoPrincipal', contrato.principal, contrato.auto.principal, 'Contrato principal', 'igual al valor referencial')}</DataRow>
                            <DataRow label="Adicionales y deductivos de obra">{listaContrato()}</DataRow>
                            <DataRow label="Monto del contrato vigente" numeric emphasis>{montoContrato('montoContratoVigente', contrato.vigente, contrato.auto.vigente, 'Contrato vigente', 'principal + adicionales − deductivos')}</DataRow>
                            <DataRow label="Vigente respecto al original" numeric formula="Contrato vigente / contrato principal (CONTROL AVAN. FISICO)">
                                {fmtPct(safeDiv(contrato.vigente, contrato.principal))}
                            </DataRow>
                            <DataRow label="Adelanto directo">{adelanto('adelantoDirecto', 'Adelanto directo')}</DataRow>
                            <DataRow label="Fecha efectiva del adelanto directo" numeric>{fecha('contratista', c.adelantoDirecto.fechaEfectiva, (v) => ({ adelantoDirecto: { ...c.adelantoDirecto, fechaEfectiva: v } }), 'Fecha adelanto directo')}</DataRow>
                            <DataRow label="Adelanto de materiales">{adelanto('adelantoMateriales', 'Adelanto de materiales')}</DataRow>
                            <DataRow label="Fecha efectiva del adelanto de materiales" numeric>{fecha('contratista', c.adelantoMateriales.fechaEfectiva, (v) => ({ adelantoMateriales: { ...c.adelantoMateriales, fechaEfectiva: v } }), 'Fecha adelanto de materiales')}</DataRow>
                            <DataRow label="Plazo de ejecución contractual">
                                <span className="inline-flex flex-wrap items-center gap-2">
                                    {contrato.auto.plazoContractual ? (
                                        <>
                                            {calculada.plazoContractualTexto}
                                            {auto('igual al plazo de ejecución')}
                                        </>
                                    ) : (
                                        <>
                                            <EditableCell
                                                label="Plazo contractual (días)"
                                                kind="integer"
                                                value={String(c.plazoContractualDias)}
                                                display={calculada.plazoContractualTexto}
                                                onCommit={(v) => v && updateFicha('contratista', { plazoContractualDias: Number(v) })}
                                            />
                                            <Chip tone="amber">Manual</Chip>
                                            {volverAuto(() => updateFicha('contratista', { plazoContractualDias: null }))}
                                        </>
                                    )}
                                </span>
                            </DataRow>
                            <DataRow label="Residente de obra">{texto('contratista', c.residente, (v) => ({ residente: v }), 'Residente de obra')}</DataRow>
                        </dl>
                    </Panel>
                </div>

                <div className="min-w-0 space-y-4">
                    <Panel badge="C" title="De la supervisión">
                        <dl>
                            <DataRow label="Contratista" emphasis>{texto('supervision', s.contratista, (v) => ({ contratista: v }), 'Contratista supervisor')}</DataRow>
                            <DataRow label="RUC" numeric>{texto('supervision', s.ruc, (v) => ({ ruc: v }), 'RUC')}</DataRow>
                            <DataRow label="Representante legal">{texto('supervision', s.representanteLegal, (v) => ({ representanteLegal: v }), 'Representante legal supervisión')}</DataRow>
                            <DataRow label="Domicilio legal">{texto('supervision', s.domicilioLegal, (v) => ({ domicilioLegal: v }), 'Domicilio supervisión')}</DataRow>
                            <DataRow label="Proceso de selección">{texto('supervision', s.procesoSeleccion, (v) => ({ procesoSeleccion: v }), 'Proceso supervisión')}</DataRow>
                            <DataRow label="Fecha de cuantía de contratación" numeric>{fecha('supervision', s.fechaCuantia, (v) => ({ fechaCuantia: v }), 'Fecha de cuantía')}</DataRow>
                            <DataRow label="Contrato">{texto('supervision', s.contrato, (v) => ({ contrato: v }), 'Contrato supervisión')}</DataRow>
                            <DataRow label="Fecha de firma del contrato" numeric>{fecha('supervision', s.fechaFirmaContrato, (v) => ({ fechaFirmaContrato: v }), 'Firma contrato supervisión')}</DataRow>
                            <DataRow label="Valor referencial (con IGV)" numeric>{dinero('supervision', s.valorReferencial, (v) => ({ valorReferencial: v }), 'Valor referencial supervisión')}</DataRow>
                            <DataRow label="Monto del contrato original" numeric>{dinero('supervision', s.montoContratoOriginal, (v) => ({ montoContratoOriginal: v }), 'Contrato original supervisión')}</DataRow>
                            <DataRow label="Monto del contrato vigente" numeric>{dinero('supervision', s.montoContratoVigente, (v) => ({ montoContratoVigente: v }), 'Contrato vigente supervisión')}</DataRow>
                            <DataRow label="Plazo de prestación del servicio">{dias('supervision', s.plazoServicioDias, (v) => ({ plazoServicioDias: v }), 'Plazo del servicio (días)', calculada.plazoServicioTexto)}</DataRow>
                            <DataRow label="Supervisor de obra">{texto('supervision', s.supervisor, (v) => ({ supervisor: v }), 'Supervisor de obra')}</DataRow>
                        </dl>
                    </Panel>

                    <Panel badge="D" title="De los plazos de ejecución">
                        <dl>
                            <DataRow label="Fecha de entrega de terreno" numeric>{fecha('plazos', p.fechaEntregaTerreno, (v) => ({ fechaEntregaTerreno: v }), 'Entrega de terreno')}</DataRow>
                            <DataRow label="Fecha de inicio de ejecución" numeric emphasis>{fecha('plazos', p.fechaInicioObra, (v) => (v ? { fechaInicioObra: v } : {}), 'Inicio de ejecución', true)}</DataRow>
                            <DataRow label="Plazo de ejecución">{dias('plazos', p.plazoEjecucionDias, (v) => ({ plazoEjecucionDias: Math.max(1, v) }), 'Plazo de ejecución (días)', calculada.plazoEjecucionTexto)}</DataRow>
                            <DataRow label="Fecha de término programado" numeric emphasis formula="Inicio + plazo − 1  (Excel FT!E51)">
                                {formatDate(calculada.fechaTerminoProgramado)}
                            </DataRow>
                            <DataRow label="Ampliaciones de plazo">{listaPlazo('ampliaciones', calculada.ampliacionesDias)}</DataRow>
                            <DataRow label="Suspensiones de plazo">{listaPlazo('suspensiones', calculada.suspensionesDias)}</DataRow>
                            <DataRow label="Plazo vigente" numeric formula="Plazo de ejecución + ampliaciones">
                                {calculada.plazoVigenteDias} días calendario
                            </DataRow>
                            <DataRow label="Fecha de término vigente" numeric formula="Inicio + plazo + ampliaciones + suspensiones − 1">
                                {formatDate(calculada.fechaTerminoVigente)}
                            </DataRow>
                            <DataRow label={`Días transcurridos a ${formatMonthYear(`${mesValorizacion}-01`)}`} numeric formula="Desde el inicio hasta el cierre del mes valorizado (sin pasar el término)">
                                {tiempo.transcurridos} de {tiempo.plazo} ({fmtPct(tiempo.pct)}) · faltan {tiempo.restantes}
                            </DataRow>
                            <DataRow label="Fecha de término real" numeric>{fecha('plazos', p.fechaTerminoReal, (v) => ({ fechaTerminoReal: v }), 'Término real')}</DataRow>
                        </dl>
                    </Panel>

                    <Panel badge="E" title="Estado situacional de la obra">
                        <dl>
                            <DataRow label="Forma de valorización">
                                <span title="Las valorizaciones de obra pública son mensuales; todas las hojas se calculan por mes.">MENSUAL</span>
                            </DataRow>
                            <DataRow label="Situación de la obra">{texto('estado', e.situacionObra, (v) => ({ situacionObra: v }), 'Situación de la obra')}</DataRow>
                            <DataRow label="Avance físico acumulado programado" numeric pending={pendiente} formula="Control general: % programado acumulado al mes valorizado (Excel FT!E58)">
                                {fmtPct(calculada.avance?.programado)}
                            </DataRow>
                            <DataRow label="Avance físico acumulado ejecutado" numeric pending={pendiente} formula="Control general: % ejecutado acumulado al mes valorizado (Excel FT!E59)">
                                {fmtPct(calculada.avance?.ejecutado)}
                            </DataRow>
                            <DataRow label="Situación del avance físico" emphasis pending={pendiente} formula="Ejecutado acum. − programado acum.">
                                {calculada.avance?.texto}
                            </DataRow>
                            <DataRow label="Avance físico vs avance del plazo" numeric pending={pendiente} formula="% ejecutado acumulado − % del plazo transcurrido">
                                {calculada.avance ? fmtPct(calculada.avance.ejecutado.sub(D(tiempo.pct))) : ''}
                            </DataRow>
                        </dl>
                    </Panel>

                    <Panel badge="F" title="Parámetros del presupuesto">
                        <dl>
                            <DataRow label="Gastos generales" numeric>{porcentaje('gastosGenerales', 'Gastos generales %')}</DataRow>
                            <DataRow label="Utilidad" numeric>{porcentaje('utilidad', 'Utilidad %')}</DataRow>
                            <DataRow label="IGV" numeric>{porcentaje('igv', 'IGV %')}</DataRow>
                        </dl>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
