import { Head } from '@inertiajs/react';
import axios from 'axios';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs from '../components/CronogramaNavTabs';

interface Persona {
    id: string;
    cargo: string;
    nombre: string;
    dias: number[];
}

interface Props {
    project: string;
    projectName: string;
    mes: string;
    diasDelMes: number;
    personal: Persona[];
}

const diaSemana = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export default function RhEm(props: Props) {
    const [personal, setPersonal] = useState<Persona[]>(props.personal);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const editVersion = useRef(0);
    const [year, month] = props.mes.split('-').map(Number);

    const dias = useMemo(
        () =>
            Array.from({ length: props.diasDelMes }, (_, index) => {
                const numero = index + 1;
                return {
                    numero,
                    semana: diaSemana[
                        new Date(year, month - 1, numero).getDay()
                    ],
                };
            }),
        [props.diasDelMes, year, month],
    );

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const change = (next: Persona[]) => {
        editVersion.current += 1;
        setPersonal(next);
        setDirty(true);
        setMessage('');
        setError('');
    };

    const add = () =>
        change([
            ...personal,
            {
                id:
                    globalThis.crypto?.randomUUID?.() ??
                    `rh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                cargo: '',
                nombre: '',
                dias: [],
            },
        ]);

    const update = (id: string, field: 'cargo' | 'nombre', value: string) => {
        change(
            personal.map((persona) =>
                persona.id === id ? { ...persona, [field]: value } : persona,
            ),
        );
    };

    const toggle = (id: string, day: number) => {
        change(
            personal.map((persona) => {
                if (persona.id !== id) return persona;
                const diasActualizados = persona.dias.includes(day)
                    ? persona.dias.filter((numero) => numero !== day)
                    : [...persona.dias, day].sort((a, b) => a - b);
                return { ...persona, dias: diasActualizados };
            }),
        );
    };

    const save = async () => {
        const savedVersion = editVersion.current;
        setSaving(true);
        setMessage('');
        setError('');
        try {
            await axios.post('/module/rh_em/save', {
                project_id: props.project,
                mes: props.mes,
                personal,
            });
            if (editVersion.current === savedVersion) {
                setDirty(false);
                setMessage('Cronograma guardado.');
            } else {
                setMessage(
                    'Se guardó la versión anterior. Hay cambios nuevos pendientes.',
                );
            }
        } catch (exception) {
            if (
                axios.isAxiosError(exception) &&
                exception.response?.status === 422
            ) {
                const errors = exception.response.data?.errors as
                    Record<string, string[]> | undefined;
                setError(
                    errors
                        ? Object.values(errors).flat().join(' ')
                        : 'Revisa los datos del personal.',
                );
            } else {
                setError('No se pudo guardar el cronograma.');
            }
        } finally {
            setSaving(false);
        }
    };

    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        {
            title: props.projectName || `Proyecto ${props.project}`,
            href: `/costos/${props.project}`,
        },
        { title: 'RH-EM', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`RH-EM — ${props.projectName}`} />
            <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
                <CronogramaNavTabs
                    project={props.project}
                    modoCalculo="calendario"
                    active="rhEm"
                />
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-sm font-black tracking-wide text-slate-700 uppercase">
                                RH-EM · Cronograma de participación de personal
                                clave
                            </h1>
                            <p className="mt-1 text-xs text-slate-500">
                                Registro mensual independiente. Marca los días
                                de participación de cada persona; los domingos
                                se identifican con D.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label
                                htmlFor="mes-rh-em"
                                className="text-xs font-bold text-slate-600"
                            >
                                Mes
                            </label>
                            <input
                                id="mes-rh-em"
                                type="month"
                                value={props.mes}
                                onChange={(event) => {
                                    window.location.href = `/module/rh_em?project=${props.project}&mes=${event.target.value}`;
                                }}
                                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            />
                            <button
                                type="button"
                                onClick={add}
                                className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                            >
                                Agregar personal
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                disabled={!dirty || saving}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                                {saving ? 'Guardando…' : 'Guardar hoja'}
                            </button>
                        </div>
                    </div>
                    {error && (
                        <p role="alert" className="mt-3 text-xs text-red-700">
                            {error}
                        </p>
                    )}
                    {message && (
                        <p
                            role="status"
                            className="mt-3 text-xs text-emerald-700"
                        >
                            {message}
                        </p>
                    )}
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-max border-collapse text-xs">
                        <thead className="bg-blue-100 text-slate-700">
                            <tr>
                                <th className="w-44 min-w-44 border-r border-slate-200 bg-blue-100 px-3 py-2 text-left lg:sticky lg:left-0 lg:z-20">
                                    Cargo
                                </th>
                                <th className="w-52 min-w-52 border-r border-slate-200 bg-blue-100 px-3 py-2 text-left lg:sticky lg:left-44 lg:z-20">
                                    Personal clave
                                </th>
                                {dias.map((day) => (
                                    <th
                                        key={day.numero}
                                        className={`w-9 min-w-9 border-r border-blue-200 px-1 py-2 text-center ${day.semana === 'D' ? 'bg-red-100 text-red-700' : ''}`}
                                    >
                                        <span className="block">
                                            {day.numero}
                                        </span>
                                        <span className="block font-normal">
                                            {day.semana}
                                        </span>
                                    </th>
                                ))}
                                <th className="min-w-20 px-2 py-2 text-center">
                                    Días
                                </th>
                                <th className="min-w-20 px-2 py-2 text-center">
                                    Acción
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {personal.map((persona) => (
                                <tr
                                    key={persona.id}
                                    className="border-t border-slate-200"
                                >
                                    <td className="border-r border-slate-200 bg-white p-1 lg:sticky lg:left-0 lg:z-10">
                                        <input
                                            aria-label="Cargo"
                                            value={persona.cargo}
                                            onChange={(event) =>
                                                update(
                                                    persona.id,
                                                    'cargo',
                                                    event.target.value,
                                                )
                                            }
                                            className="w-40 rounded border border-slate-300 px-2 py-1.5"
                                            placeholder="Ej. Residente"
                                        />
                                    </td>
                                    <td className="border-r border-slate-200 bg-white p-1 lg:sticky lg:left-44 lg:z-10">
                                        <input
                                            aria-label="Nombre del personal"
                                            value={persona.nombre}
                                            onChange={(event) =>
                                                update(
                                                    persona.id,
                                                    'nombre',
                                                    event.target.value,
                                                )
                                            }
                                            className="w-48 rounded border border-slate-300 px-2 py-1.5"
                                            placeholder="Nombre y apellidos"
                                        />
                                    </td>
                                    {dias.map((day) => (
                                        <td
                                            key={day.numero}
                                            className={`border-r border-slate-100 p-0.5 text-center ${day.semana === 'D' ? 'bg-red-50' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                aria-label={`Participación de ${persona.nombre || persona.cargo || 'personal'} el día ${day.numero}`}
                                                aria-pressed={persona.dias.includes(
                                                    day.numero,
                                                )}
                                                onClick={() =>
                                                    toggle(
                                                        persona.id,
                                                        day.numero,
                                                    )
                                                }
                                                className={`size-8 rounded ${persona.dias.includes(day.numero) ? 'bg-blue-600 font-black text-white' : 'hover:bg-slate-100'}`}
                                            >
                                                {persona.dias.includes(
                                                    day.numero,
                                                )
                                                    ? '●'
                                                    : ''}
                                            </button>
                                        </td>
                                    ))}
                                    <td className="px-2 text-center font-mono font-bold">
                                        {persona.dias.length}
                                    </td>
                                    <td className="px-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                change(
                                                    personal.filter(
                                                        (row) =>
                                                            row.id !==
                                                            persona.id,
                                                    ),
                                                )
                                            }
                                            className="text-red-700 hover:underline"
                                        >
                                            Quitar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {personal.length === 0 && (
                        <p className="p-4 text-xs text-slate-500">
                            Agrega una persona para comenzar este mes.
                        </p>
                    )}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                    Desplaza la tabla horizontalmente para ver todos los días
                    del mes.
                </p>
            </div>
        </AppLayout>
    );
}
