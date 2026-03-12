import { Link, router, usePage } from '@inertiajs/react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface ProjectDetail {
    id: number; nombre: string; uei: string | null; unidad_ejecutora: string | null;
    codigo_snip: string | null; codigo_cui: string | null; codigo_local: string | null;
    fecha_inicio: string | null; fecha_fin: string | null;
    codigos_modulares: Record<string, string> | null;
    departamento_id: string | null; provincia_id: string | null; distrito_id: string | null;
    centro_poblado: string | null; status: string; modules: string[]; created_at: string;
}

interface PageProps { project: ProjectDetail;[key: string]: unknown; }

const MODULE_LABELS: Record<string, string> = {
    metrado_arquitectura: 'Arquitectura', metrado_estructura: 'Estructura',
    metrado_sanitarias: 'Sanitarias', metrado_electricas: 'Eléctricas',
    metrado_comunicaciones: 'Comunicaciones', metrado_gas: 'Gas',
    crono_general: 'Cronograma General', crono_valorizado: 'Cronograma Valorizado',
    crono_materiales: 'Cronograma Materiales',
    presupuesto: 'Presupuesto',
    // Legacy modules (for compatibility)
    presupuesto_gg: 'Gastos Generales', presupuesto_insumos: 'Insumos',
    presupuesto_remuneraciones: 'Remuneraciones', presupuesto_acus: 'ACUs',
    presupuesto_indice: 'Índice', 
    etts: 'ETTs',
};

const MODULE_ICONS: Record<string, string> = {
    metrado_: '📐', crono_: '📅', presupuesto_: '💰', etts: '📋',
};

function getIcon(m: string) {
    for (const [prefix, icon] of Object.entries(MODULE_ICONS)) {
        if (m.startsWith(prefix)) return icon;
    }
    return '📄';
}

export default function Show() {
    const { project } = usePage<PageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
    ];

    const infoItems = [
        { label: 'UEI', value: project.uei },
        { label: 'Unidad Ejecutora', value: project.unidad_ejecutora },
        { label: 'Código SNIP', value: project.codigo_snip },
        { label: 'Código CUI', value: project.codigo_cui },
        { label: 'Código Local', value: project.codigo_local },
        { label: 'Fecha Inicio', value: project.fecha_inicio },
        { label: 'Fecha Fin', value: project.fecha_fin },
        { label: 'Departamento', value: project.fecha_fin },
        { label: 'Centro Poblado', value: project.centro_poblado },
    ].filter(i => i.value);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="mx-auto w-full max-w-12xl space-y-6 py-6 px-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{project.nombre}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Creado: {project.created_at}</p>
                    </div>
                    <Link href="/costos" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Volver</Link>
                </div>

                {/* Info */}
                {infoItems.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Información General</h2>
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            {infoItems.map(i => (
                                <div key={i.label}><dt className="text-xs text-gray-500 dark:text-gray-400">{i.label}</dt><dd className="font-medium text-gray-800 dark:text-gray-100">{i.value}</dd></div>
                            ))}
                        </dl>
                        {project.codigos_modulares && Object.keys(project.codigos_modulares).length > 0 && (
                            <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-1">Códigos Modulares</dt>
                                <div className="flex gap-3">
                                    {Object.entries(project.codigos_modulares).map(([k, v]) => (
                                        <span key={k} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                            {k}: <strong>{v}</strong>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Modules */}
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Módulos Habilitados</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {project.modules.map(m => {
                            // Special handling for unified presupuesto module
                            const href = m === 'presupuesto' 
                                ? `/costos/proyectos/${project.id}/presupuesto`
                                : `/costos/${project.id}/module/${m}`;
                            
                            return (
                                <Link key={m} href={href} className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 cursor-pointer">
                                    <span className="text-lg">{getIcon(m)}</span>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{MODULE_LABELS[m] || m}</span>
                                </Link>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Los módulos se activarán conforme se implementen en fases posteriores.</p>
                </div>

                {/* Danger zone */}
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Zona de Peligro</h3>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400/80">Eliminar este proyecto borrará permanentemente su base de datos aislada y todos los datos.</p>
                    <button onClick={() => { if (confirm('¿Estás seguro? Esta acción es irreversible.')) router.delete(`/costos/${project.id}`); }}
                        className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700">
                        Eliminar Proyecto
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}
