import { Head } from '@inertiajs/react';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

type Vista = 'mensual' | 'acumulados' | 'control';

interface Cascada {
    costoDirecto: number;
    montoGG: number;
    montoUtilidad: number;
    subTotal: number;
    montoIGV: number;
    montoTotal: number;
}

interface Fila {
    numero: number;
    periodo: string;
    key: string;
    cascada: Cascada;
    reajuste: number | null;
    penalidades: number | null;
    montoPagado: number | null;
    fechaPago: string | null;
    acumuladoValorizado: number;
    acumuladoPagado: number | null;
}

interface Componente {
    item: string;
    descripcion: string;
    contratado: number;
    actual: number;
    acumulado: number;
}

interface Props {
    project: string;
    projectName: string;
    modoCalculo: 'calendario';
    vista: Vista;
    periodoSeleccionado: string | null;
    filas: Fila[];
    componentes: Componente[];
    totalValorizado: number;
    totalPagado: number | null;
    sinProgramado: boolean;
    sinEjecutado: boolean;
    estado?: CronogramaEstado;
}

interface FormValues {
    reajuste: string;
    penalidades: string;
    monto_pagado: string;
    fecha_pago: string;
}

const path: Record<Vista, string> = {
    mensual: '/module/r_pago_mensual',
    acumulados: '/module/pagos_acumulados',
    control: '/module/control_pagos',
};

const title: Record<Vista, string> = {
    mensual: 'Resumen de pago mensual',
    acumulados: 'Pagos acumulados',
    control: 'Control de pagos',
};

const fmt = (value: number) => value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value: number | null) => value === null ? '—' : `S/ ${fmt(value)}`;
const inputValue = (value: number | null) => value === null ? '' : String(value);

function formFrom(fila: Fila | undefined): FormValues {
    return {
        reajuste: inputValue(fila?.reajuste ?? null),
        penalidades: inputValue(fila?.penalidades ?? null),
        monto_pagado: inputValue(fila?.montoPagado ?? null),
        fecha_pago: fila?.fechaPago ?? '',
    };
}

export default function PagosValorizacion(props: Props) {
    const firstKey = props.filas[0]?.key ?? '';
    const periodoKey = props.filas.some(f => f.key === props.periodoSeleccionado) ? props.periodoSeleccionado! : firstKey;
    const fila = props.filas.find(f => f.key === periodoKey);
    const [form, setForm] = useState<FormValues>(() => formFrom(fila));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setForm(formFrom(fila));
        setError('');
        setSaved(false);
    }, [fila]);

    const update = (field: keyof FormValues, value: string) => {
        setForm(previous => ({ ...previous, [field]: value }));
        setSaved(false);
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!fila) return;
        setSaving(true);
        setError('');
        try {
            await axios.post('/module/control_pagos/save', {
                project_id: props.project,
                periodo_key: fila.key,
                reajuste: form.reajuste === '' ? null : form.reajuste,
                penalidades: form.penalidades === '' ? null : form.penalidades,
                monto_pagado: form.monto_pagado === '' ? null : form.monto_pagado,
                fecha_pago: form.fecha_pago || null,
            });
            setSaved(true);
            window.location.reload();
        } catch (exception) {
            if (axios.isAxiosError(exception) && exception.response?.status === 422) {
                const errors = exception.response.data?.errors as Record<string, string[]> | undefined;
                setError(errors ? Object.values(errors).flat().join(' ') : 'Revisa los importes ingresados.');
            } else {
                setError('No se pudieron guardar los datos de pago.');
            }
        } finally {
            setSaving(false);
        }
    };

    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: title[props.vista], href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${title[props.vista]} — ${props.projectName}`} />
            <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
                <CronogramaNavTabs project={props.project} modoCalculo="calendario" active={props.vista === 'mensual' ? 'pagoMensual' : props.vista === 'acumulados' ? 'pagosAcumulados' : 'controlPagos'} estado={props.estado} />
                <div className="mx-auto max-w-[1700px]">
                    <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <h1 className="text-sm font-black uppercase tracking-wide text-slate-700">{title[props.vista]}</h1>
                        <p className="mt-1 text-xs text-slate-500">Valorización calculada desde presupuesto y avance real en periodos calendario. Reajuste, penalidades y pago efectivo se registran por el cliente.</p>
                    </div>

                    {(props.sinProgramado || props.sinEjecutado) && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                            Faltan datos de {props.sinProgramado ? 'Valorizado programado' : ''}{props.sinProgramado && props.sinEjecutado ? ' y ' : ''}{props.sinEjecutado ? 'Avance Real' : ''}. Los importes de referencia se completarán desde esas hojas.
                        </div>
                    )}

                    {props.vista === 'mensual' ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between bg-blue-100 px-4 py-3">
                                    <h2 className="text-xs font-black uppercase text-slate-700">Valorización del periodo</h2>
                                    <select className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" value={periodoKey} onChange={event => { window.location.href = `${path.mensual}?project=${props.project}&periodo=${encodeURIComponent(event.target.value)}`; }}>
                                        {props.filas.map(f => <option key={f.key} value={f.key}>{f.periodo}</option>)}
                                    </select>
                                </div>
                                {fila ? (
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {([
                                                ['Costo directo', fila.cascada.costoDirecto],
                                                ['Gastos generales', fila.cascada.montoGG],
                                                ['Utilidad', fila.cascada.montoUtilidad],
                                                ['Sub total', fila.cascada.subTotal],
                                                ['IGV', fila.cascada.montoIGV],
                                                ['Monto total valorizado', fila.cascada.montoTotal],
                                            ] as [string, number][]).map(([label, value]) => (
                                                <tr key={label} className="border-t border-slate-100 last:bg-lime-100 last:font-black">
                                                    <th className="px-4 py-2 text-left font-semibold">{label}</th>
                                                    <td className="px-4 py-2 text-right font-mono">S/ {fmt(value)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : <p className="p-4 text-xs text-slate-500">No hay periodos calendario.</p>}
                            </div>
                            <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h2 className="mb-1 text-xs font-black uppercase text-slate-700">Datos registrados por el cliente</h2>
                                <p className="mb-4 text-xs text-slate-500">Un campo vacío significa que aún no fue informado; cero es un importe confirmado en cero.</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {([['reajuste', 'Reajuste (S/)'], ['penalidades', 'Penalidades (S/)'], ['monto_pagado', 'Monto pagado (S/)']] as [keyof FormValues, string][]).map(([field, label]) => (
                                        <label key={field} className="text-xs font-semibold text-slate-600">{label}
                                            <input type="number" step="0.01" min={field === 'reajuste' ? undefined : '0'} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 font-mono" value={form[field]} onChange={event => update(field, event.target.value)} />
                                        </label>
                                    ))}
                                    <label className="text-xs font-semibold text-slate-600">Fecha de pago
                                        <input type="date" className="mt-1 w-full rounded border border-slate-300 px-2 py-2" value={form.fecha_pago} onChange={event => update('fecha_pago', event.target.value)} />
                                    </label>
                                </div>
                                {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
                                {saved && <p className="mt-3 text-xs text-emerald-700">Datos guardados.</p>}
                                <button disabled={!fila || saving} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar datos de pago'}</button>
                            </form>
                            {props.componentes.length > 0 && (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
                                    <div className="bg-blue-100 px-4 py-3 text-xs font-black uppercase text-slate-700">Componentes del presupuesto · {fila?.periodo}</div>
                                    <table className="min-w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr><th className="px-3 py-2 text-left">Ítem</th><th className="px-3 py-2 text-left">Descripción</th><th className="px-3 py-2 text-right">Costo directo contratado</th><th className="px-3 py-2 text-right">Costo directo actual</th><th className="px-3 py-2 text-right">Costo directo acumulado</th></tr>
                                        </thead>
                                        <tbody>
                                            {props.componentes.map(item => (
                                                <tr key={item.item} className="border-t border-slate-100">
                                                    <td className="px-3 py-2 font-mono">{item.item}</td>
                                                    <td className="px-3 py-2">{item.descripcion}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{money(item.contratado)}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{money(item.actual)}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{money(item.acumulado)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                            <table className="min-w-full text-xs">
                                <thead className="bg-blue-100 text-slate-700">
                                    <tr className="uppercase">
                                        <th className="px-3 py-3 text-left">N°</th>
                                        <th className="px-3 py-3 text-left">Periodo</th>
                                        <th className="px-3 py-3 text-right">Valorización</th>
                                        <th className="px-3 py-3 text-right">Reajuste</th>
                                        <th className="px-3 py-3 text-right">Penalidades</th>
                                        <th className="px-3 py-3 text-right">Pago informado</th>
                                        {props.vista === 'acumulados' ? <><th className="px-3 py-3 text-right">Valorizado acum.</th><th className="px-3 py-3 text-right">Pagado acum.</th></> : <th className="px-3 py-3 text-left">Fecha de pago</th>}
                                        <th className="px-3 py-3 text-center">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.filas.map(f => (
                                        <tr key={f.key} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-2">{String(f.numero).padStart(2, '0')}</td>
                                            <td className="px-3 py-2 font-semibold">{f.periodo}</td>
                                            <td className="px-3 py-2 text-right font-mono">{money(f.cascada.montoTotal)}</td>
                                            <td className="px-3 py-2 text-right font-mono">{money(f.reajuste)}</td>
                                            <td className="px-3 py-2 text-right font-mono">{money(f.penalidades)}</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold">{money(f.montoPagado)}</td>
                                            {props.vista === 'acumulados' ? <><td className="px-3 py-2 text-right font-mono">{money(f.acumuladoValorizado)}</td><td className="px-3 py-2 text-right font-mono">{money(f.acumuladoPagado)}</td></> : <td className="px-3 py-2">{f.fechaPago ?? '—'}</td>}
                                            <td className="px-3 py-2 text-center"><a className="font-semibold text-blue-700 hover:underline" href={`${path.mensual}?project=${props.project}&periodo=${encodeURIComponent(f.key)}`}>Ver / editar</a></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-slate-300 bg-lime-100 font-black">
                                    <tr>
                                        <td colSpan={2} className="px-3 py-3">TOTAL</td>
                                        <td className="px-3 py-3 text-right font-mono">{money(props.totalValorizado)}</td>
                                        <td colSpan={2} />
                                        <td className="px-3 py-3 text-right font-mono">{money(props.totalPagado)}</td>
                                        <td colSpan={props.vista === 'acumulados' ? 3 : 2} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    <p className="mt-3 text-xs text-slate-500">Los importes pagados son datos declarados por el cliente; no se infieren del avance ejecutado ni del estado devengado.</p>
                </div>
            </div>
        </AppLayout>
    );
}
