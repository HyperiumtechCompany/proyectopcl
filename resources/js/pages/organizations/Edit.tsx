import { Head } from '@inertiajs/react';
import { OrganizationForm } from '@/components/organizations/OrganizationForm';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type Organization } from '@/types/user';

type Props = {
    organization: Organization;
};

const breadcrumbs = (id: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Organizaciones', href: '/organizations' },
    { title: 'Editar Organización', href: `/organizations/${id}/edit` },
];

export default function OrganizationsEdit({ organization }: Props) {
    return (
        <AppLayout breadcrumbs={breadcrumbs(organization.id)}>
            <Head title={`Editar — ${organization.nombre}`} />

            <div className="mx-auto max-w-3xl p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground">Editar Organización</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {organization.users_count ?? 0} miembro
                        {organization.users_count === 1 ? '' : 's'} asignado
                        {organization.users_count === 1 ? '' : 's'}.
                    </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <OrganizationForm organization={organization} isEdit />
                </div>
            </div>
        </AppLayout>
    );
}
