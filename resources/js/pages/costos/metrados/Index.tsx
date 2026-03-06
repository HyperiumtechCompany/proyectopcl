import { Link } from '@inertiajs/react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import metradoRoutes from '@/routes/metrados';

export default function Index() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Metrados', href: metradoRoutes.index.url() },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-6">
                <h1 className="text-xl font-bold mb-4">Módulos de Metrado</h1>
                <ul className="space-y-2">
                    <li>
                        <Link href={metradoRoutes.comunicacion.index.url()} className="text-blue-600 hover:underline">
                            Comunicaciones
                        </Link>
                    </li>
                    {/* añadir enlaces a otros módulos cuando estén listos */}
                </ul>
            </div>
        </AppLayout>
    );
}
