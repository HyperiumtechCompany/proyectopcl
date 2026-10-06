import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, BookOpen, ChevronDown, Plug } from 'lucide-react';
import { useEffect } from 'react';
import { show as projectShow } from '@/actions/App/Http/Controllers/CostoProjectController';
import { show } from '@/actions/App/Http/Controllers/Cuaderno/CuadernoVinculoController';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import AppLayout from '@/layouts/app-layout';
import { start as startRunner } from '@/routes/costos/cuaderno/runner';
import type { BreadcrumbItem } from '@/types';
import AsientosPanel, {
    type AsientosPage,
    type Filters,
} from './AsientosPanel';
import ConnectionPanel, {
    type Connection,
    type DetectedNotebook,
    type SyncProgress,
} from './ConnectionPanel';
import { type IndexEntry } from './DownloadCenter';
import ManualLinkForm, { type LinkData } from './ManualLinkForm';

type Vinculo = Connection &
    LinkData & {
        revoked_at: string | null;
    };

interface Props {
    project: { id: number; nombre: string; codigo_cui: string | null };
    vinculo: Vinculo | null;
    historial: Vinculo[];
    roles: string[];
    flash?: { success?: string; error?: string };
    asientos: AsientosPage | null;
    filters: Filters;
    tipos: { valor: string; total: number }[];
    estados: string[];
    indiceOficial: IndexEntry[];
    cuadernoDetectado: DetectedNotebook | null;
    sincronizacion: SyncProgress | null;
    conector?: { online: boolean; autostart: boolean };
}

function ConnectorBanner({
    projectId,
    conector,
}: {
    projectId: number;
    conector: Props['conector'];
}) {
    const start = useForm({});
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    // While offline, check again every few seconds (e.g. after npm run cuaderno:runner).
    useEffect(() => {
        if (conector?.online !== false) return;
        const timer = setInterval(
            () => router.reload({ only: ['conector'], showProgress: false }),
            5000,
        );
        return () => clearInterval(timer);
    }, [conector?.online]);

    if (!conector) {
        return (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Comprobando el conector…
            </p>
        );
    }
    if (conector.online) {
        return (
            <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <span className="size-2 rounded-full bg-green-600" /> Conector
                activo en este equipo
            </p>
        );
    }
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex gap-3">
                <Plug className="mt-0.5 shrink-0 text-amber-600" size={20} />
                <div className="text-sm">
                    <p className="font-medium">El conector está apagado</p>
                    <p className="text-muted-foreground">
                        {conector.autostart
                            ? 'Inícialo para que Costos pueda abrir el portal de OECE.'
                            : 'Ejecuta npm run cuaderno:runner en este equipo; la página lo detectará sola.'}
                    </p>
                    {errors.conector && (
                        <p role="alert" className="mt-1 text-red-600">
                            {errors.conector}
                        </p>
                    )}
                </div>
            </div>
            {conector.autostart && (
                <Button
                    disabled={start.processing}
                    onClick={() =>
                        start.post(startRunner.url(projectId), {
                            preserveScroll: true,
                        })
                    }
                >
                    {start.processing && <Spinner />} Iniciar conector
                </Button>
            )}
        </div>
    );
}

export default function Show({
    project,
    vinculo,
    historial,
    roles,
    flash,
    asientos,
    filters,
    tipos,
    estados,
    indiceOficial,
    cuadernoDetectado,
    sincronizacion,
    conector,
}: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: projectShow.url(project.id) },
        { title: 'Cuaderno de incidencias', href: show.url(project.id) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Cuaderno · ${project.nombre}`} />
            <div className="flex w-full flex-col gap-5 p-4 sm:p-6 xl:px-8">
                <Link
                    href={projectShow(project.id)}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                >
                    <ArrowLeft size={16} /> Volver al proyecto
                </Link>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <BookOpen
                            className="mt-1 text-blue-600 dark:text-blue-400"
                            size={24}
                        />
                        <div>
                            <h1 className="text-xl font-semibold">
                                Cuaderno de incidencias
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {project.nombre}
                            </p>
                        </div>
                    </div>
                    {conector?.online !== false && (
                        <ConnectorBanner
                            projectId={project.id}
                            conector={conector}
                        />
                    )}
                </div>
                {conector?.online === false && (
                    <ConnectorBanner
                        projectId={project.id}
                        conector={conector}
                    />
                )}
                {flash?.error && (
                    <p
                        role="alert"
                        className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                    >
                        {flash.error}
                    </p>
                )}
                {flash?.success && (
                    <p
                        role="status"
                        className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200"
                    >
                        {flash.success}
                    </p>
                )}

                <ConnectionPanel
                    key={vinculo?.id ?? 'new'}
                    projectId={project.id}
                    projectCui={project.codigo_cui}
                    vinculo={vinculo}
                    detected={cuadernoDetectado}
                    progress={sincronizacion}
                    connectorOnline={conector?.online}
                />

                {vinculo && (
                    <AsientosPanel
                        projectId={project.id}
                        asientos={asientos}
                        filters={filters}
                        tipos={tipos}
                        estados={estados}
                        indice={indiceOficial}
                        canFetch={
                            vinculo.tiene_sesion &&
                            vinculo.estado === 'verificada' &&
                            vinculo.conexion_estado === 'conectada' &&
                            conector?.online !== false
                        }
                    />
                )}

                <Collapsible className="rounded-xl border bg-card">
                    <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-sm font-medium">
                        Opciones avanzadas: datos manuales, archivo e historial
                        <ChevronDown
                            size={16}
                            className="transition group-data-[state=open]:rotate-180"
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-6 border-t p-5">
                        <ManualLinkForm
                            projectId={project.id}
                            projectCui={project.codigo_cui}
                            vinculo={vinculo}
                            roles={roles}
                        />
                        {historial.length > 0 && (
                            <div className="border-t pt-5">
                                <h2 className="mb-3 text-sm font-semibold">
                                    Vinculaciones archivadas
                                </h2>
                                <ul className="divide-y">
                                    {historial.map((item) => (
                                        <li
                                            key={item.id}
                                            className="space-y-1 py-3 text-sm"
                                        >
                                            <p className="font-medium">
                                                {item.entidad ??
                                                    'Sin entidad confirmada'}
                                            </p>
                                            <p>{item.obra}</p>
                                            <p className="text-muted-foreground">
                                                {item.rol ?? 'Rol no indicado'}{' '}
                                                · Archivada
                                                {item.revoked_at
                                                    ? ` · ${new Date(item.revoked_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
                                                    : ''}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </AppLayout>
    );
}
