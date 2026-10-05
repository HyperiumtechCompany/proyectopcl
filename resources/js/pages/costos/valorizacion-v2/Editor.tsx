import { Head } from '@inertiajs/react';
import { useState } from 'react';
import type { ProyectoRef, ValorizacionRef } from '@/features/valorizacion-v2/components/ProyectoNav';
import type { CorteResumen, DocumentoGuardado } from '@/features/valorizacion-v2/data/api/valorizacionApi';
import { normalizarInput } from '@/features/valorizacion-v2/data/schema';
import type { ProyectoBase } from '@/features/valorizacion-v2/data/schema';
import { ValorizacionShell } from '@/features/valorizacion-v2/layouts/ValorizacionShell';
import { PersistenciaProvider } from '@/features/valorizacion-v2/store/PersistenciaProvider';
import { ValorizacionStoreProvider } from '@/features/valorizacion-v2/store/ValorizacionStoreProvider';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Props {
    project: ProyectoBase & { id: number };
    documento: DocumentoGuardado;
    cortes: CorteResumen[];
    documentos: ValorizacionRef[];
    proyectos: ProyectoRef[];
}

/**
 * Editor de UNA valorización v2 (un proyecto puede tener varias). Carga el
 * documento guardado y monta store + autoguardado + shell.
 */
export default function ValorizacionV2Editor({ project, documento, cortes, documentos, proyectos }: Props) {
    const [inicial] = useState(() => normalizarInput(documento.datos, project));
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        { title: 'Valorizaciones v2', href: `/costos/${project.id}/valorizacion-v2` },
        { title: documento.nombre, href: `/costos/${project.id}/valorizacion-v2/${documento.public_id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${documento.nombre} · ${project.nombre}`} />
            <ValorizacionStoreProvider key={documento.public_id} initial={inicial}>
                <PersistenciaProvider
                    key={documento.public_id}
                    projectId={project.id}
                    documentoId={documento.public_id}
                    proyecto={project}
                    revisionInicial={documento.revision}
                    guardadoInicial={documento.updated_at}
                    cortesIniciales={cortes}
                >
                    <ValorizacionShell
                        proyecto={{ id: project.id, nombre: project.nombre }}
                        proyectos={proyectos}
                        valorizacion={{ public_id: documento.public_id, nombre: documento.nombre }}
                        valorizaciones={documentos}
                    />
                </PersistenciaProvider>
            </ValorizacionStoreProvider>
        </AppLayout>
    );
}
