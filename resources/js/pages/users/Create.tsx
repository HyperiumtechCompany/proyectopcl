import { Head } from '@inertiajs/react';
import { UserForm } from '@/components/users/UserForm';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type Role } from '@/types/user';

type Props = {
    roles: Role[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gestión de Personal', href: '/users' },
    { title: 'Nuevo Usuario', href: '/users/create' },
];

export default function UsersCreate({ roles }: Props) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nuevo Usuario" />

            <div className="mx-auto max-w-3xl p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground">Nuevo Usuario</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Completa los datos para registrar un nuevo miembro del equipo.
                    </p>
                </div>

                {/* Form Card */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <UserForm roles={roles} />
                </div>
            </div>
        </AppLayout>
    );
}

