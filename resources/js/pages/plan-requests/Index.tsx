import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { PaginatedData, PlanRequest, PlanRequestStatus } from '@/types/user';

type Props = {
    planRequests: PaginatedData<PlanRequest>;
    filters: { status?: PlanRequestStatus | '' };
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: '/dashboard' },
    { title: 'Solicitudes', href: '/solicitudes' },
];

const statusLabel: Record<PlanRequestStatus, string> = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
};

const statusClass: Record<PlanRequestStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    rejected: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export default function PlanRequestsIndex({ planRequests, filters }: Props) {
    const applyFilter = (status: string) => {
        router.get('/solicitudes', status ? { status } : {}, { preserveState: true, replace: true });
    };

    const isBusiness = (request: PlanRequest) => request.plan === 'negocios' || request.plan === 'empresarial';

    const handleApprove = (request: PlanRequest) => {
        const confirmMessage = isBusiness(request)
            ? `¿Marcar como atendida la solicitud de "${request.nombre}"? Esto no crea nada automáticamente — deberás crear la organización y el usuario desde los paneles correspondientes.`
            : `¿Aprobar la solicitud de "${request.nombre}"? Se creará su cuenta y se le enviará la contraseña por correo.`;

        if (!window.confirm(confirmMessage)) {
            return;
        }
        router.post(`/solicitudes/${request.id}/approve`);
    };

    const handleReject = (request: PlanRequest) => {
        if (!window.confirm(`¿Rechazar la solicitud de "${request.nombre}"?`)) {
            return;
        }
        router.post(`/solicitudes/${request.id}/reject`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Solicitudes de plan" />

            <div className="flex h-full flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Solicitudes de plan</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {planRequests.total} solicitud{planRequests.total !== 1 ? 'es' : ''} de
                            clientes que quieren activar un plan.
                        </p>
                    </div>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => applyFilter(e.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-blue-400 focus:outline-none"
                    >
                        <option value="">Todos los estados</option>
                        <option value="pending">Pendientes</option>
                        <option value="approved">Aprobadas</option>
                        <option value="rejected">Rechazadas</option>
                    </select>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <th className="px-4 py-3">Nombre</th>
                                <th className="px-4 py-3">Correo</th>
                                <th className="px-4 py-3">Plan</th>
                                <th className="px-4 py-3">Comprobante</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {planRequests.data.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                        No hay solicitudes que mostrar.
                                    </td>
                                </tr>
                            )}
                            {planRequests.data.map((req) => (
                                <tr key={req.id} className="border-b border-border last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-foreground">{req.nombre}</div>
                                        {req.empresa && (
                                            <div className="text-xs text-muted-foreground">{req.empresa}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{req.email}</td>
                                    <td className="px-4 py-3 text-muted-foreground capitalize">{req.plan}</td>
                                    <td className="px-4 py-3">
                                        {req.comprobante_path ? (
                                            <a
                                                href={`/storage/${req.comprobante_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                                            >
                                                <FileText className="h-4 w-4" />
                                                Ver
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[req.status]}`}>
                                            {statusLabel[req.status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {req.status === 'pending' ? (
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleApprove(req)}
                                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                                                >
                                                    {isBusiness(req) ? 'Marcar atendida' : 'Aprobar'}
                                                </button>
                                                <button
                                                    onClick={() => handleReject(req)}
                                                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="block text-right text-xs text-muted-foreground">
                                                Ya procesada
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {planRequests.last_page > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Mostrando {planRequests.from}–{planRequests.to} de {planRequests.total}
                        </p>
                        <div className="flex items-center gap-1">
                            {planRequests.links.map((link, i) => {
                                if (link.label.includes('Previous')) {
                                    return (
                                        <Link
                                            key={i}
                                            href={link.url ?? '#'}
                                            className={`rounded-lg p-2 text-muted-foreground transition-colors ${link.url ? 'hover:bg-muted' : 'cursor-not-allowed opacity-40'}`}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Link>
                                    );
                                }
                                if (link.label.includes('Next')) {
                                    return (
                                        <Link
                                            key={i}
                                            href={link.url ?? '#'}
                                            className={`rounded-lg p-2 text-muted-foreground transition-colors ${link.url ? 'hover:bg-muted' : 'cursor-not-allowed opacity-40'}`}
                                        >
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
        </AppLayout>
    );
}
