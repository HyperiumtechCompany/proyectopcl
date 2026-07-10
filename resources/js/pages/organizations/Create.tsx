import { Head } from '@inertiajs/react';
import { OrganizationForm } from '@/components/organizations/OrganizationForm';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Organizaciones', href: '/organizations' },
    { title: 'Nueva Organización', href: '/organizations/create' },
];

export default function OrganizationsCreate() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nueva Organización" />

            <div className="mx-auto max-w-3xl p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground">Nueva Organización</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Crea una cuenta de equipo y asigna después qué usuarios pertenecen a ella
                        desde Gestión de Personal.
                    </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <OrganizationForm />
                </div>
            </div>
        </AppLayout>
    );
}
