import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Calendar, Mail, MapPin, Pencil, Phone, Shield } from 'lucide-react';
import { PlanBadge } from '@/components/users/PlanBadge';
import { RoleBadge } from '@/components/users/RoleBadge';
import { StatusBadge } from '@/components/users/StatusBadge';
import { useInitials } from '@/hooks/use-initials';
import AppLayout from '@/layouts/app-layout';
import { resolveAvatarUrl } from '@/lib/avatar';
import { type BreadcrumbItem } from '@/types';
import { type UserExtended } from '@/types/user';

type Props = {
    user: UserExtended;
};

export default function UsersShow({ user }: Props) {
    const getInitials = useInitials();
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Gestión de Personal', href: '/users' },
        { title: user.name, href: `/users/${user.id}` },
    ];

    const InfoRow = ({
        icon: Icon,
        label,
        value,
    }: {
        icon: React.ElementType;
        label: string;
        value?: string | null;
    }) => (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                <Icon className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                </p>
                <p className="text-sm text-foreground">{value ?? '—'}</p>
            </div>
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={user.name} />

            <div className="mx-auto max-w-3xl p-6">
                {/* Back link */}
                <Link
                    href="/users"
                    className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-indigo-500"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al listado
                </Link>

                {/* Profile card */}
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    {/* Cover */}
                    <div className="h-24 bg-linear-to-r from-indigo-500 via-purple-500 to-pink-400" />

                    {/* Avatar & actions */}
                    <div className="-mt-10 flex items-end justify-between px-6 pb-4">
                        <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-linear-to-br from-indigo-400 to-purple-500 shadow-md">
                            {resolveAvatarUrl(user.avatar) ? (
                                <img
                                    src={resolveAvatarUrl(user.avatar)}
                                    alt={user.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                                    {getInitials(user.name)}
                                </span>
                            )}
                        </div>
                        <Link
                            href={`/users/${user.id}/edit`}
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                        </Link>
                    </div>

                    {/* Name & badges */}
                    <div className="border-b border-border px-6 pb-5">
                        <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
                        <p className="text-sm text-muted-foreground">{user.position ?? 'Sin cargo asignado'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {user.roles_list.map((r) => (
                                <RoleBadge key={r} role={r} />
                            ))}
                            <PlanBadge plan={user.plan} />
                            <StatusBadge status={user.status} />
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
                        <InfoRow icon={Mail} label="Correo electrónico" value={user.email} />
                        <InfoRow icon={Phone} label="Teléfono" value={user.phone} />
                        <InfoRow icon={MapPin} label="DNI" value={user.dni} />
                        <InfoRow
                            icon={Calendar}
                            label="Expira plan"
                            value={
                                user.plan === 'lifetime'
                                    ? 'De por vida'
                                    : user.plan_expires_at
                                        ? new Date(user.plan_expires_at).toLocaleDateString('es-PE')
                                        : '—'
                            }
                        />
                        <InfoRow
                            icon={Calendar}
                            label="Registrado"
                            value={new Date(user.created_at).toLocaleDateString('es-PE')}
                        />
                    </div>

                    {/* Permissions */}
                    {user.permissions && user.permissions.length > 0 && (
                        <div className="border-t border-border p-6">
                            <div className="mb-3 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-indigo-500" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    Permisos directos
                                </h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {user.permissions.map((p) => (
                                    <span
                                        key={p.id}
                                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                                    >
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

