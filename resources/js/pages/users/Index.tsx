import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { DeleteUserModal } from '@/components/users/DeleteUserModal';
import { PlanBadge } from '@/components/users/PlanBadge';
import { RoleBadge } from '@/components/users/RoleBadge';
import { StatusBadge } from '@/components/users/StatusBadge';
import { UserTable } from '@/components/users/UserTable';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { PaginatedData, Role, UserExtended, UserFilters } from '@/types/user';

type Props = {
    users: PaginatedData<UserExtended>;
    roles: Role[];
    filters: UserFilters;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: '/dashboard' },
    { title: 'Gestión de Personal', href: '/users' },
];

export default function UsersIndex({ users, roles, filters }: Props) {
    const [deleteTarget, setDeleteTarget] = useState<UserExtended | null>(null);
    const [localSearch, setLocalSearch] = useState(filters.search ?? '');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const applyFilter = useCallback(
        (key: string, value: string) => {
            router.get(
                '/users',
                { ...filters, [key]: value || undefined },
                { preserveState: true, replace: true },
            );
        },
        [filters],
    );

    const handleSearchChange = (val: string) => {
        setLocalSearch(val);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => applyFilter('search', val), 400);
    };

    const clearFilters = () => {
        setLocalSearch('');
        router.get('/users', {}, { preserveState: false });
    };

    const hasActiveFilters = !!(
        filters.search ||
        filters.role ||
        filters.plan ||
        filters.status
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de Personal" />

            <div className="flex h-full flex-col gap-6 p-6">
                {/* ── Header ── */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            Gestión de Personal
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {users.total} usuario{users.total !== 1 ? 's' : ''} registrado
                            {users.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Link href="/users/create" className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
                        <Plus className="h-4 w-4" />
                        Nuevo Usuario
                    </Link>
                </div>

                {/* ── Filters ── */}
                <div className="flex flex-wrap gap-3">
                    {/* Search */}
                    <div className="relative min-w-[220px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email…"
                            value={localSearch}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm text-foreground focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    {/* Role filter */}
                    <select
                        value={filters.role ?? ''}
                        onChange={(e) => applyFilter('role', e.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-blue-400 focus:outline-none">
                        <option value="">Todos los roles</option>
                        {roles.map((r) => (
                            <option key={r.id} value={r.name}>
                                {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                            </option>
                        ))}
                    </select>

                    {/* Plan filter */}
                    <select
                        value={filters.plan ?? ''}
                        onChange={(e) => applyFilter('plan', e.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-blue-400 focus:outline-none">
                        <option value="">Todos los planes</option>
                        <option value="free">Free</option>
                        <option value="mensual">Mensual</option>
                        <option value="anual">Anual</option>
                        <option value="lifetime">Lifetime</option>
                    </select>

                    {/* Status filter */}
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => applyFilter('status', e.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-blue-400 focus:outline-none">
                        <option value="">Todos los estados</option>
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                        <option value="blocked">Bloqueado</option>
                    </select>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
                            <X className="h-3.5 w-3.5" />
                            Limpiar
                        </button>
                    )}
                </div>

                {/* ── Table card ── */}
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <UserTable users={users.data} onDelete={setDeleteTarget} />
                </div>

                {/* ── Pagination ── */}
                {users.last_page > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Mostrando {users.from}–{users.to} de {users.total}
                        </p>
                        <div className="flex items-center gap-1">
                            {users.links.map((link, i) => {
                                if (link.label.includes('Previous')) {
                                    return (
                                        <Link
                                            key={i}
                                            href={link.url ?? '#'}
                                            className={`rounded-lg p-2 text-muted-foreground transition-colors ${link.url ? 'hover:bg-muted' : 'cursor-not-allowed opacity-40'}`}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Link>
                                    );
                                }
                                if (link.label.includes('Next')) {
                                    return (
                                        <Link
                                            key={i}
                                            href={link.url ?? '#'}
                                            className={`rounded-lg p-2 text-muted-foreground transition-colors ${link.url ? 'hover:bg-muted' : 'cursor-not-allowed opacity-40'}`}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Link>
                                    );
                                }
                                return (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        className={`min-w-[36px] rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors ${link.active
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : link.url
                                                ? 'text-muted-foreground hover:bg-muted'
                                                : 'cursor-not-allowed text-muted-foreground/50'
                                            }`}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Delete confirmation modal ── */}
            {deleteTarget && (
                <DeleteUserModal
                    user={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </AppLayout>
    );
}

