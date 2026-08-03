import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { Organization } from '@/types/user';

type Props = {
    organizations: Organization[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: '/dashboard' },
    { title: 'Organizaciones', href: '/organizations' },
];

const planLabel: Record<Organization['plan'], string> = {
    negocios: 'Negocios',
    empresarial: 'Empresarial',
};

export default function OrganizationsIndex({ organizations }: Props) {
    const handleDelete = (organization: Organization) => {
        if (!window.confirm(`¿Eliminar la organización "${organization.nombre}"?`)) {
            return;
        }
        router.delete(`/organizations/${organization.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Organizaciones" />

            <div className="flex h-full flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Organizaciones</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Cuentas de equipo con cupo de proyectos compartido entre sus
                            miembros.
                        </p>
                    </div>
                    <Link
                        href="/organizations/create"
                        className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Nueva Organización
                    </Link>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <th className="px-4 py-3">Nombre</th>
                                <th className="px-4 py-3">Plan</th>
                                <th className="px-4 py-3">Miembros</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {organizations.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                        Todavía no hay organizaciones creadas.
                                    </td>
                                </tr>
                            )}
                            {organizations.map((org) => (
                                <tr key={org.id} className="border-b border-border last:border-0">
                                    <td className="px-4 py-3 font-medium text-foreground">
                                        {org.nombre}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {planLabel[org.plan]}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {org.users_count ?? 0}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/organizations/${org.id}/edit`}
                                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(org)}
                                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
