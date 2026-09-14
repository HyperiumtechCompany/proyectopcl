import { Head } from '@inertiajs/react';
import { Loader2, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import GgSheet from '@/features/mantenimiento/gg/GgSheet';
import { ggApi } from '@/features/mantenimiento/gg/ggApi';
import type { GgPayload } from '@/features/mantenimiento/gg/types';
import MatSheet from '@/features/mantenimiento/mat/MatSheet';
import { matApi } from '@/features/mantenimiento/mat/matApi';
import type { MatPayload } from '@/features/mantenimiento/mat/types';
import MoSheet from '@/features/mantenimiento/mo/MoSheet';
import { moApi } from '@/features/mantenimiento/mo/moApi';
import type { MoPayload } from '@/features/mantenimiento/mo/types';
import ResumenSheet from '@/features/mantenimiento/resumen/ResumenSheet';
import { resumenApi } from '@/features/mantenimiento/resumen/resumenApi';
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

interface Cached<T> {
    payload: T;
    atRevision: number;
}

export default function Editor({ project, document, imported, presupuesto_disponible, mo, mat, gg, resumen }: Props) {
    const [tab, setTab] = useState<SheetTab>('RESUMEN');
    const [revision, setRevision] = useState(document.revision);
    const [switching, setSwitching] = useState(false);
    const { appearance, updateAppearance } = useAppearance();

    // MO/MAT comparten el mismo árbol de partidas y las 4 pestañas comparten un mismo
    // `document.revision` (cualquier guardado en cualquier pestaña lo incrementa). Cada hoja
    // guarda su propio payload localmente y solo lo "suelta" hacia Editor cuando algo cambia (vía
    // onRevision), así que sin este cache por pestaña + refetch al entrar, editar en MO no se
    // reflejaba en MAT/GG/RESUMEN hasta un F5 manual — cada Sheet solo veía el prop `initial` que
    // tenía al montarse la primera vez.
    const [moState, setMoState] = useState<Cached<MoPayload>>({ payload: mo, atRevision: document.revision });
    const [matState, setMatState] = useState<Cached<MatPayload>>({ payload: mat, atRevision: document.revision });
    const [ggState, setGgState] = useState<Cached<GgPayload>>({ payload: gg, atRevision: document.revision });
    const [resumenState, setResumenState] = useState<Cached<ResumenPayload>>({ payload: resumen, atRevision: document.revision });

    const selectTab = async (next: SheetTab) => {
        if (next === tab) return;

        const staleness: Record<SheetTab, Cached<unknown>> = { RESUMEN: resumenState, MO: moState, MAT: matState, GG: ggState };
        if (staleness[next].atRevision >= revision) {
            setTab(next);
            return;
        }

        setSwitching(true);
        try {
            if (next === 'MO') {
                const res = await moApi.refresh(project.id, document.id);
                setMoState({ payload: res.mo, atRevision: res.revision });
                setRevision(res.revision);
            } else if (next === 'MAT') {
                const res = await matApi.refresh(project.id, document.id);
                setMatState({ payload: res.mat, atRevision: res.revision });
                setRevision(res.revision);
            } else if (next === 'GG') {
                const res = await ggApi.refresh(project.id, document.id);
                setGgState({ payload: res.gg, atRevision: res.revision });
                setRevision(res.revision);
            } else {
                const res = await resumenApi.refresh(project.id, document.id);
                setResumenState({ payload: res.resumen, atRevision: res.revision });
                setRevision(res.revision);
            }
            setTab(next);
        } finally {
            setSwitching(false);
        }
    };

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
                            onClick={() => void selectTab(sheet)}
                            className={`border-b-2 px-3 py-2 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 ${
                                tab === sheet ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-400'
                            }`}
                        >
                            {sheet}
                        </button>
                    ))}
                    {switching && <Loader2 size={14} className="animate-spin text-blue-500" />}
                </nav>

                {tab === 'RESUMEN' ? (
                    <ResumenSheet
                        projectId={project.id}
                        documentId={document.id}
                        initial={resumenState.payload}
                        onRevision={(rev, payload) => {
                            setRevision(rev);
                            setResumenState({ payload, atRevision: rev });
                        }}
                    />
                ) : tab === 'MAT' ? (
                    <MatSheet
                        projectId={project.id}
                        documentId={document.id}
                        initial={matState.payload}
                        onRevision={(rev, payload) => {
                            setRevision(rev);
                            setMatState({ payload, atRevision: rev });
                        }}
                    />
                ) : tab === 'GG' ? (
                    <GgSheet
                        projectId={project.id}
                        documentId={document.id}
                        initial={ggState.payload}
                        onRevision={(rev, payload) => {
                            setRevision(rev);
                            setGgState({ payload, atRevision: rev });
                        }}
                    />
                ) : (
                    <MoSheet
                        projectId={project.id}
                        documentId={document.id}
                        initial={moState.payload}
                        imported={imported}
                        presupuestoDisponible={presupuesto_disponible}
                        onRevision={(rev, payload) => {
                            setRevision(rev);
                            setMoState({ payload, atRevision: rev });
                        }}
                    />
                )}
            </main>
        </AppLayout>
    );
}
