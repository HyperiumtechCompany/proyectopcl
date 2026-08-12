import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { ProjectSummaryView } from './components/ProjectSummaryView';
import type { DialuxV2Project, DialuxV2ProjectSummary } from './types';

interface Props {
    project: DialuxV2Project;
    summary: DialuxV2ProjectSummary;
}

export default function DialuxV2Summary({ project, summary }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'DIALux v2', href: '/dialux-v2' },
        { title: project.name, href: `/dialux-v2/projects/${project.id}` },
        {
            title: 'Resumen consolidado',
            href: `/dialux-v2/projects/${project.id}/summary`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Resumen — ${project.name}`} />
            <main className="min-h-[calc(100vh-4rem)] overflow-y-auto bg-slate-100 dark:bg-slate-950">
                <ProjectSummaryView project={project} summary={summary} />
            </main>
        </AppLayout>
    );
}
