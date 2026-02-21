import { Link } from '@inertiajs/react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useInitials } from '@/hooks/use-initials';
import { resolveAvatarUrl } from '@/lib/avatar';
import { type UserExtended } from '@/types/user';
import { PlanBadge } from './PlanBadge';
import { RoleBadge } from './RoleBadge';
import { StatusBadge } from './StatusBadge';

type UserTableProps = {
    users: UserExtended[];
    onDelete: (user: UserExtended) => void;
};

export function UserTable({ users, onDelete }: UserTableProps) {
    const getInitials = useInitials();

    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <span className="text-3xl">👤</span>
                </div>
                <h3 className="text-base font-semibold text-foreground">
                    No hay usuarios
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    No se encontraron usuarios con los filtros aplicados.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border bg-muted/60">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Usuario
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Rol
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Plan
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Cargo
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                    {users.map((user) => (
                        <tr
                            key={user.id}
                            className="group transition-colors hover:bg-emerald-500/10"
                        >
                            {/* User Info */}
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-blue-300 to-blue-500 shadow-sm">
                                        {resolveAvatarUrl(user.avatar) ? (
                                            <img
                                                src={resolveAvatarUrl(user.avatar)}
                                                alt={user.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                                                {getInitials(user.name)}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {user.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                            </td>

                            {/* Role */}
                            <td className="px-4 py-3">
                                {user.roles_list.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles_list.map((r) => (
                                            <RoleBadge key={r} role={r} />
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground">Sin rol</span>
                                )}
                            </td>

                            {/* Plan */}
                            <td className="px-4 py-3">
                                <PlanBadge plan={user.plan} />
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                                <StatusBadge status={user.status} />
                            </td>

                            {/* Position */}
                            <td className="px-4 py-3">
                                <span className="text-muted-foreground">
                                    {user.position ?? (
                                        <span className="text-muted-foreground/50">—</span>
                                    )}
                                </span>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                    <Link
                                        href={`/users/${user.id}`}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-indigo-100 hover:text-indigo-600"
                                        title="Ver detalle"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                    <Link
                                        href={`/users/${user.id}/edit`}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-amber-100 hover:text-amber-600"
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Link>
                                    <button
                                        onClick={() => onDelete(user)}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
                                        title="Eliminar"
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
    );
}

