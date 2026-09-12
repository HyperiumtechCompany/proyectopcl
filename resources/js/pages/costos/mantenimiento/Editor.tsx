import { Head } from '@inertiajs/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import GgSheet from '@/features/mantenimiento/gg/GgSheet';
import type { GgPayload } from '@/features/mantenimiento/gg/types';
import MatSheet from '@/features/mantenimiento/mat/MatSheet';
import type { MatPayload } from '@/features/mantenimiento/mat/types';
import MoSheet from '@/features/mantenimiento/mo/MoSheet';
import type { MoPayload } from '@/features/mantenimiento/mo/types';
import ResumenSheet from '@/features/mantenimiento/resumen/ResumenSheet';
import type { ResumenPayload } from '@/features/mantenimiento/resumen/types';
import { useAppearance } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Props {
    project: { id: number; nombre: string };
    document: { id: string; nombre: string; moneda: string; revision: number };
    imported: boolean;
    presupuesto_disponible: boolean;
    mo: MoPayload;
    mat: MatPayload;
    gg: GgPayload;
    resumen: ResumenPayload;
}

const SHEETS = ['RESUMEN', 'MO', 'MAT', 'GG'] as const;
type SheetTab = (typeof SHEETS)[number];

export default function Editor({ project, document, imported, presupuesto_disponible, mo, mat, gg, resumen }: Props) {
    const [tab, setTab] = useState<SheetTab>('RESUMEN');
    const [revision, setRevision] = useState(document.revision);
    const { appearance, updateAppearance } = useAppearance();

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        { title: 'Mantenimiento', href: `/costos/${project.id}/mantenimiento` },
        { title: document.nombre, href: `/costos/${project.id}/mantenimiento/${document.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${document.nombre} · Mantenimiento`} />
            <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-bold">{document.nombre}</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{document.moneda} · revisión {revision}</p>
                    </div>
                    <div className="inline-flex rounded border border-slate-300 p-0.5 dark:border-slate-700">
                        {([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([mode, Icon]) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => updateAppearance(mode)}
                                className={`rounded p-1 ${appearance === mode ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Icon size={13} />
                            </button>
                        ))}
                    </div>
                </header>

                <nav className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-900">
                    {SHEETS.map((sheet) => (
                        <button
                            key={sheet}
                            type="button"
                            onClick={() => setTab(sheet)}
                            className={`border-b-2 px-3 py-2 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 ${
                                tab === sheet ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-400'
                            }`}
                        >
                            {sheet}
                        </button>
                    ))}
                </nav>

                {tab === 'RESUMEN' ? (
                    <ResumenSheet projectId={project.id} documentId={document.id} initial={resumen} onRevision={setRevision} />
                ) : tab === 'MAT' ? (
                    <MatSheet projectId={project.id} documentId={document.id} initial={mat} onRevision={setRevision} />
                ) : tab === 'GG' ? (
                    <GgSheet projectId={project.id} documentId={document.id} initial={gg} onRevision={setRevision} />
                ) : (
                    <MoSheet
                        projectId={project.id}
                        documentId={document.id}
                        initial={mo}
                        imported={imported}
                        presupuestoDisponible={presupuesto_disponible}
                        onRevision={setRevision}
                    />
                )}
            </main>
        </AppLayout>
    );
}
