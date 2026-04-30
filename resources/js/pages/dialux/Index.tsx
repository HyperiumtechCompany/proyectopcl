import { Head } from '@inertiajs/react';
import React from 'react';
import { EditorLayout } from '@/components/dialux/EditorLayout';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Props {
    projectId?: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'DIAlux', href: '/dialux' },
];

/**
 * pages/dialux/Index.tsx — Página Inertia del editor DIAlux
 *
 * Envuelve EditorLayout dentro del AppLayout del sistema (con sidebar navegación).
 * El editor ocupa toda la altura disponible del área de contenido.
 */
export default function DialuxIndex({ projectId }: Props) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="DIAlux — Editor Lumínico" />
            {/*
             * -mx-4 -my-4 compensa el padding que SidebarInset agrega.
             * h-[calc(100vh-3.5rem)] = pantalla completa menos header del sidebar.
             */}
            <div className="h-[calc(100vh-4rem)] w-full overflow-hidden">
                <EditorLayout />
            </div>
        </AppLayout>
    );
}