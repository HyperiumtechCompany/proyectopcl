import { Head, Link } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import {
    BookOpen,
    CalendarClock,
    CloudCog,
    Droplet,
    ExternalLink,
    LayoutGrid,
    UserCheck,
    Waves,
    Zap,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import type { Auth, BreadcrumbItem } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Stats = {
    agua: number;
    desague: number;
    ac: number;
    caida: number;
    spatt: number;
};

type RecentProject = {
    id: number;
    name: string;
    type: string;
    route: string;
    owner: string;
    updated_at: string;
    is_owner: boolean;
    collab_role: 'owner' | 'editor' | 'viewer';
};

type PageProps = {
    auth: Auth & {
        user: {
            name: string;
            email: string;
            avatar?: string;
            dni?: string;
            position?: string;
            plan?: string;
            plan_expires_at?: string;
            status?: string;
        };
    };
    stats: Stats;
    recentProjects: RecentProject[];
    isAdmin: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
    free: 'Prueba gratuita',
    mensual: 'Plan Mensual',
    anual: 'Plan Anual',
    lifetime: 'Plan Vitalicio',
};

const PLAN_COLORS: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    mensual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    anual: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    lifetime: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const ROLE_LABELS: Record<string, string> = {
    owner: 'Propietario',
    editor: 'Editor',
    viewer: 'Visualizador',
};

const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    editor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    blocked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    blocked: 'Bloqueado',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
    icon: Icon,
    label,
    value,
    href,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: number;
    href: string;
    color: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-400/50"
        >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="truncate text-sm text-muted-foreground">{label}</p>
            </div>
        </Link>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
];

export default function Dashboard() {
    const { auth, stats, recentProjects, isAdmin } = usePage<PageProps>().props;
    const user = auth.user;
    const plan = user.plan ?? 'free';
    const status = user.status ?? 'active';

    const statsLabel = isAdmin
        ? 'en toda la plataforma'
        : 'accesibles para ti';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex flex-col gap-6 p-6">

                {/* ── Row 1: Perfil + Plan ── */}
                <div className="grid gap-4 md:grid-cols-2">

                    {/* Perfil */}
                    <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
                        {user.avatar ? (
                            <img
                                src={`/storage/${user.avatar}`}
                                alt={user.name}
                                className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
                            />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-2xl font-bold text-white ring-2 ring-border">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
                                {status && (
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.inactive}`}>
                                        {STATUS_LABELS[status] ?? status}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.position && (
                                <p className="mt-1 text-xs font-medium text-muted-foreground/80">
                                    {user.position}
                                </p>
                            )}
                            {user.dni && (
                                <p className="mt-0.5 text-xs text-muted-foreground/60">
                                    DNI: {user.dni}
                                </p>
                            )}
                            {auth.roles.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {auth.roles.map((role) => (
                                        <span
                                            key={role}
                                            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                        >
                                            {role.charAt(0).toUpperCase() + role.slice(1)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Plan */}
                    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Tipo de cuenta
                            </p>
                            <div className="mt-2 flex items-center gap-3">
                                <span className={`rounded-xl px-4 py-1.5 text-sm font-semibold ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`}>
                                    {PLAN_LABELS[plan] ?? plan}
                                </span>
                            </div>
                        </div>
                        {user.plan_expires_at && plan !== 'lifetime' && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarClock className="h-4 w-4 shrink-0" />
                                <span>
                                    {plan === 'free' ? 'Prueba hasta' : 'Válido hasta'}{' '}
                                    <span className="font-medium text-foreground">
                                        {new Date(user.plan_expires_at).toLocaleDateString('es-PE', {
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </span>
                                </span>
                            </div>
                        )}
                        {plan === 'lifetime' && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                <UserCheck className="h-4 w-4" />
                                <span className="font-medium">Acceso vitalicio activo</span>
                            </div>
                        )}
                        {isAdmin && (
                            <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                                📊 Visualizando estadísticas globales de toda la plataforma
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Row 2: Estadísticas de cálculos ── */}
                <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Resumen de cálculos {statsLabel}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <StatCard
                            icon={Droplet}
                            label="Cálculo de Agua"
                            value={stats.agua}
                            href="/agua-calculation"
                            color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
                        />
                        <StatCard
                            icon={Waves}
                            label="Cálculo de Desagüe"
                            value={stats.desague}
                            href="/desague-calculation"
                            color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300"
                        />
                        <StatCard
                            icon={CloudCog}
                            label="Aire Acondicionado"
                            value={stats.ac}
                            href="/ac-calculation"
                            color="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
                        />
                        <StatCard
                            icon={Zap}
                            label="Caída de Tensión"
                            value={stats.caida}
                            href="/caida-tension"
                            color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
                        />
                        <StatCard
                            icon={BookOpen}
                            label="SPAT y Pararrayos"
                            value={stats.spatt}
                            href="/spatt-pararrayos"
                            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                        />
                    </div>
                </div>

                {/* ── Row 3: Proyectos recientes ── */}
                {recentProjects.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Proyectos recientes
                        </h3>
                        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/40">
                                            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                                                Nombre
                                            </th>
                                            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                                                Módulo
                                            </th>
                                            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                                                Propietario
                                            </th>
                                            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                                                Mi rol
                                            </th>
                                            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                                                Última modificación
                                            </th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {recentProjects.map((project) => (
                                            <tr
                                                key={`${project.type}-${project.id}`}
                                                className="transition-colors hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    {project.name}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {project.type}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {project.is_owner ? (
                                                        <span className="font-medium text-foreground">Tú</span>
                                                    ) : (
                                                        project.owner
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[project.collab_role] ?? ROLE_COLORS.viewer
                                                            }`}
                                                    >
                                                        {ROLE_LABELS[project.collab_role] ?? project.collab_role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {project.updated_at}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link
                                                        href={project.route}
                                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    >
                                                        Abrir
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {recentProjects.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
                        <LayoutGrid className="mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-base font-medium text-muted-foreground">
                            Aún no tienes proyectos
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground/60">
                            Crea o únete a un cálculo para verlo aquí
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
