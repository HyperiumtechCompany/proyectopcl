import { Link, router, usePage } from '@inertiajs/react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Project {
    id: number;
    nombre: string;
    uei: string | null;
    unidad_ejecutora: string | null;
    codigo_cui: string | null;
    status: 'active' | 'archived';
    modules_count: number;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    projects: Project[];
    [key: string]: unknown;
}

export default function Index() {
    const { projects } = usePage<PageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="w-full rounded-lg bg-white px-12 py-6 shadow dark:bg-gray-900">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Proyectos de Costos</h1>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Cada proyecto tiene su base de datos aislada</p>
                    </div>
                    <Link href="/costos/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm rounded-md transition-colors">
                        + Nuevo Proyecto
                    </Link>
                </div>

                {projects.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">No tienes proyectos de costos todavía.</p>
                        <Link href="/costos/create" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                            Crear primer proyecto →
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.map((p) => (
                            <div
                                key={p.id}
                                className="group cursor-pointer rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                                onClick={() => router.get(`/costos/${p.id}`)}
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between">
                                        <h3 className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                                            {p.nombre}
                                        </h3>
                                        <span className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${p.status === 'active'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                            }`}>
                                            {p.status === 'active' ? 'Activo' : 'Archivado'}
                                        </span>
                                    </div>
                                    {p.codigo_cui && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">CUI: {p.codigo_cui}</p>}
                                    {p.unidad_ejecutora && <p className="text-xs text-gray-500 dark:text-gray-400">{p.unidad_ejecutora}</p>}
                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>{p.modules_count} módulos</span>
                                        <span>{p.updated_at}</span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('¿Eliminar este proyecto y toda su base de datos?')) {
                                                router.delete(`/costos/${p.id}`);
                                            }
                                        }}
                                        className="mt-2 text-xs text-red-500 hover:text-red-600 dark:text-red-400"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
