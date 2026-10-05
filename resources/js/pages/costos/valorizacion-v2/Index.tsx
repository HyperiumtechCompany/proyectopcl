import { Head, Link, router } from '@inertiajs/react';
import { Copy, FilePlus2, FileSpreadsheet, FolderOpen, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { store } from '@/actions/App/Http/Controllers/ValorizacionV2/ValorizacionV2Controller';
import type { ProyectoRef } from '@/features/valorizacion-v2/components/ProyectoNav';
import { valorizacion02Jul2026 } from '@/features/valorizacion-v2/data/fixtures/valorizacion02Jul2026';
import { crearInputVacio, SCHEMA_VERSION } from '@/features/valorizacion-v2/data/schema';
import type { ProyectoBase } from '@/features/valorizacion-v2/data/schema';
import { formatMonthYear } from '@/features/valorizacion-v2/lib/dates';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface ValorizacionResumen {
    public_id: string;
    nombre: string;
    obra: string | null;
    contrato: string | null;
    periodo: { numero: number; mes: string } | null;
    partidas: number;
    aprobadas: number;
    updated_at: string | null;
}

interface Props {
    project: ProyectoBase & { id: number };
    documentos: ValorizacionResumen[];
    proyectos: ProyectoRef[];
}

type Plantilla = 'vacia' | 'ejemplo';

const fechaHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Valorizaciones v2 de un proyecto (como los documentos de mantenimiento): cada
 * una es independiente (contrato principal, adicionales, pruebas…). Entorno de
 * pruebas aislado del Cronograma Valorizado en producción.
 */
export default function ValorizacionV2Index({ project, documentos, proyectos }: Props) {
    const [nombre, setNombre] = useState(documentos.length === 0 ? 'Valorización del contrato principal' : `Valorización ${documentos.length + 1}`);
    const [plantilla, setPlantilla] = useState<Plantilla>('vacia');
    const [procesando, setProcesando] = useState(false);
    const base = `/costos/${project.id}/valorizacion-v2`;
    const otras = proyectos.filter((p) => p.id !== project.id);
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        { title: 'Valorizaciones v2', href: base },
    ];

    const crear = (event: FormEvent) => {
        event.preventDefault();
        const datos = plantilla === 'ejemplo' ? valorizacion02Jul2026 : crearInputVacio(project);
        setProcesando(true);
        router.post(store(project.id).url, { nombre, schema_version: SCHEMA_VERSION, datos: JSON.parse(JSON.stringify(datos)) }, { onFinish: () => setProcesando(false) });
    };

    const opcion = (valor: Plantilla, titulo: string, detalle: string, Icon: typeof FilePlus2) => (
        <label className={cn('flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 transition', plantilla === valor ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-stone-200 hover:border-orange-300 dark:border-stone-700')}>
            <input type="radio" name="plantilla" value={valor} checked={plantilla === valor} onChange={() => setPlantilla(valor)} className="mt-1 accent-orange-600" />
            <Icon className="mt-0.5 size-5 shrink-0 text-orange-600" />
            <span>
                <span className="block text-sm font-semibold text-stone-900 dark:text-stone-100">{titulo}</span>
                <span className="block text-xs text-stone-500">{detalle}</span>
            </span>
        </label>
    );

    const botonSecundario = 'inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 font-semibold text-stone-700 hover:border-orange-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Valorizaciones v2 · ${project.nombre}`} />
            <main className="min-h-[calc(100vh-4rem)] bg-stone-100 px-4 py-6 sm:px-6 lg:px-8 dark:bg-stone-950">
                <div className="mx-auto max-w-6xl space-y-6">
                    <header className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold tracking-widest text-orange-600 uppercase">Valorización v2 · entorno de pruebas</p>
                            <h1 className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-50">Valorizaciones de la obra</h1>
                            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{project.nombre}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <Link href={`/costos/${project.id}`} className={botonSecundario}>
                                <FolderOpen className="size-3.5" /> Volver al proyecto
                            </Link>
                            <Link href="/costos/create" className={botonSecundario}>
                                <FolderPlus className="size-3.5" /> Crear proyecto nuevo
                            </Link>
                        </div>
                    </header>

                    <form onSubmit={crear} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Nueva valorización</p>
                        <input
                            value={nombre}
                            onChange={(event) => setNombre(event.target.value)}
                            required
                            maxLength={255}
                            aria-label="Nombre de la valorización"
                            placeholder="Ej.: Contrato principal, Adicional N°01, Prueba…"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-stone-700 dark:bg-stone-950 dark:text-white"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {opcion('vacia', 'Empezar desde cero', 'Ficha con los datos del proyecto; importa presupuesto, calendario y metrados desde tu Excel.', FilePlus2)}
                            {opcion('ejemplo', 'Con el ejemplo', 'Valorización N°02 – julio 2026 del Excel de referencia, para probar todas las hojas.', FileSpreadsheet)}
                        </div>
                        <button type="submit" disabled={procesando} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                            <Plus className="size-4" /> {procesando ? 'Creando…' : 'Crear valorización'}
                        </button>
                    </form>

                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {documentos.map((documento) => (
                            <div key={documento.public_id} className="group relative flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-orange-400 hover:shadow-md dark:border-stone-800 dark:bg-stone-900">
                                <Link href={`${base}/${documento.public_id}`} className="block flex-1">
                                    <FileSpreadsheet className="mb-3 text-orange-600" />
                                    <h2 className="pr-20 font-semibold text-stone-900 dark:text-white">{documento.nombre}</h2>
                                    {documento.obra && <p className="mt-1 line-clamp-2 text-xs text-stone-500">{documento.obra}</p>}
                                    <dl className="mt-3 space-y-0.5 text-xs text-stone-600 dark:text-stone-400">
                                        {documento.periodo && (
                                            <div>
                                                Valorización activa:{' '}
                                                <strong className="text-stone-900 dark:text-stone-100">
                                                    N°{String(documento.periodo.numero).padStart(2, '0')} · {formatMonthYear(documento.periodo.mes)}
                                                </strong>
                                            </div>
                                        )}
                                        <div>
                                            {documento.partidas} filas de presupuesto · {documento.aprobadas} aprobada{documento.aprobadas === 1 ? '' : 's'}
                                        </div>
                                        <div className="text-stone-400">Guardado {fechaHora(documento.updated_at)}</div>
                                    </dl>
                                </Link>
                                <div className="absolute top-3 right-3 flex gap-1 opacity-60 transition group-hover:opacity-100">
                                    <button
                                        type="button"
                                        title="Renombrar"
                                        aria-label={`Renombrar ${documento.nombre}`}
                                        onClick={() => {
                                            const nuevo = window.prompt('Nuevo nombre de la valorización', documento.nombre)?.trim();
                                            if (nuevo && nuevo !== documento.nombre) {
                                                router.patch(`${base}/${documento.public_id}/nombre`, { nombre: nuevo }, { preserveScroll: true });
                                            }
                                        }}
                                        className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800"
                                    >
                                        <Pencil size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        title="Duplicar"
                                        aria-label={`Duplicar ${documento.nombre}`}
                                        onClick={() => router.post(`${base}/${documento.public_id}/duplicar`)}
                                        className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800"
                                    >
                                        <Copy size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        title="Eliminar"
                                        aria-label={`Eliminar ${documento.nombre}`}
                                        onClick={() => window.confirm(`¿Eliminar "${documento.nombre}" y sus aprobaciones? No se puede deshacer.`) && router.delete(`${base}/${documento.public_id}`)}
                                        className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {documentos.length === 0 && <p className="text-sm text-stone-500 dark:text-stone-400">Todavía no hay valorizaciones en esta obra. Crea la primera arriba.</p>}
                    </section>

                    {otras.length > 0 && (
                        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                            <p className="text-xs font-semibold tracking-widest text-stone-500 uppercase">Valorizaciones de otras obras</p>
                            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                                {otras.map((p) => (
                                    <li key={p.id}>
                                        <Link href={`/costos/${p.id}/valorizacion-v2`} className="text-sm text-orange-700 hover:underline dark:text-orange-300">
                                            {p.nombre}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </main>
        </AppLayout>
    );
}
