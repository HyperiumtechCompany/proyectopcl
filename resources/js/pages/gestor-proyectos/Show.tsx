import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import ProjectAutoMap from '@/pages/gestor-proyectos/components/ProjectAutoMap';
import type { ApiNodo } from '@/pages/gestor-proyectos/components/types';
import type { BreadcrumbItem } from '@/types';

interface ShowProps {
    proyecto: { id: number; nombre: string; descripcion: string | null };
    nodos: ApiNodo[];
}

export default function GestorProyectoShow({ proyecto, nodos }: ShowProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Gestor de Proyectos', href: '/gestor-proyectos' },
        { title: proyecto.nombre, href: `/gestor-proyectos/${proyecto.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={proyecto.nombre} />

            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 px-4 py-4 text-slate-100 sm:px-6 sm:py-6">
                <ProjectAutoMap gestorProyectoId={proyecto.id} nombre={proyecto.nombre} initialNodos={nodos} />
            </div>
        </AppLayout>
    );
}
