import { UserForm } from '@/components/users/UserForm';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type Role, type UserExtended } from '@/types/user';
import { Head } from '@inertiajs/react';

type Props = {
    user: UserExtended;
    roles: Role[];
};

const breadcrumbs = (userId: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gestión de Personal', href: '/users' },
    { title: 'Editar Usuario', href: `/users/${userId}/edit` },
];

export default function UsersEdit({ user, roles }: Props) {
    return (
        <AppLayout breadcrumbs={breadcrumbs(user.id)}>
            <Head title={`Editar — ${user.name}`} />

            <div className="mx-auto max-w-3xl p-6">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-linear-to-br from-indigo-400 to-purple-500 shadow-md">
                        {user.avatar ? (
                            <img
                                src={`/storage/${user.avatar}`}
                                alt={user.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
                                {user.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            Editar Usuario
                        </h1>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                </div>

                {/* Form Card */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <UserForm user={user} roles={roles} isEdit />
                </div>
            </div>
        </AppLayout>
    );
}

