import { Head, router } from '@inertiajs/react';
import { Boxes, Building2, MapPin, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    show,
    store,
} from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { DialuxV2ProjectListItem } from './types';

interface Props {
    projects: DialuxV2ProjectListItem[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'DIALux v2', href: '/dialux-v2' },
];

export default function DialuxV2Index({ projects }: Props) {
    const createProject = async () => {
        const result = await Swal.fire({
            title: 'Nuevo proyecto DIALux v2',
            input: 'text',
            inputPlaceholder: 'Ej. Complejo empresarial',
            showCancelButton: true,
            confirmButtonText: 'Crear proyecto',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d97706',
            background: '#101218',
            color: '#e4e4e7',
            inputValidator: (value) =>
                value.trim() ? undefined : 'El nombre es obligatorio.',
        });

        if (result.value)
            router.post(store(), { name: String(result.value).trim() });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="DIALux v2" />
            <main className="flex h-full flex-1 flex-col overflow-y-auto bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 dark:bg-slate-950 dark:text-white">
                <div className="mx-auto w-full max-w-7xl">
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-amber-600">
                                <Boxes className="h-5 w-5" />
                                <span className="text-xs font-bold tracking-widest uppercase">
                                    Arquitectura modular
                                </span>
                            </div>
                            <h1 className="mt-1 text-2xl font-bold">
                                DIALux v2
                            </h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                                Proyectos con hasta 25 edificios, pisos o zonas
                                independientes.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={createProject}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-900/20 transition hover:bg-amber-500"
                        >
                            <Plus className="h-4 w-4" /> Nuevo proyecto v2
                        </button>
                    </header>

                    {projects.length === 0 ? (
                        <section className="mt-8 grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center dark:border-white/10 dark:bg-[#101218]">
                            <Building2 className="h-11 w-11 text-slate-400" />
                            <h2 className="mt-4 font-semibold">
                                Aún no tienes proyectos v2
                            </h2>
                            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-zinc-400">
                                Los proyectos v1 permanecen en su apartado
                                actual. Crea aquí uno nuevo para trabajar con
                                módulos.
                            </p>
                        </section>
                    ) : (
                        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={() =>
                                        router.visit(show(project.id))
                                    }
                                    className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-lg dark:border-white/10 dark:bg-[#101218]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                                            {project.modules_count} módulos
                                        </span>
                                    </div>
                                    <h2 className="mt-4 font-semibold">
                                        {project.name}
                                    </h2>
                                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
                                        <MapPin className="h-3 w-3" />
                                        {project.location ??
                                            'Ubicación pendiente'}
                                    </p>
                                    <p className="mt-4 text-xs text-slate-400">
                                        Actualizado {project.updated_at}
                                    </p>
                                </button>
                            ))}
                        </section>
                    )}
                </div>
            </main>
        </AppLayout>
    );
}
