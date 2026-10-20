import { AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ggApi } from '../mantenimiento/gg/ggApi';
import GgSheet from '../mantenimiento/gg/GgSheet';
import type { GgPayload } from '../mantenimiento/gg/types';
import ResumenSheet from '../mantenimiento/resumen/ResumenSheet';
import type { ResumenPayload } from '../mantenimiento/resumen/types';
import { errorMessage, gastFinApi } from './gastFinApi';
import GastFinMatSheet from './mat/GastFinMatSheet';
import GastFinMoSheet from './mo/GastFinMoSheet';
import { TIPO_LABEL } from './styles';
import type { GastFinGrupo, GastFinResumenPayload, GastFinShowResponse, MatPayload, MoPayload } from './types';

export interface GastFinProjectData {
    id: number;
    nombre: string;
    codigo_cui: string;
    codigo_local: string;
    unidad_ejecutora: string;
    codigos_modulares: string;
    plantilla_logo_izq_url: string | null;
    plantilla_logo_der_url: string | null;
}

interface Props {
    projectId: number;
    projectData?: GastFinProjectData;
    /** Hay cambios de Presupuesto/ACU sin guardar: Gast. Fin. lee lo guardado en BD. */
    budgetDirty: boolean;
}

type Tab = 'resumen' | 'mo' | 'gg' | `mat:${string}`;
type Payloads = { resumen: GastFinResumenPayload; mo: MoPayload; gg: GgPayload; mat: MatPayload };
interface CacheEntry<T> {
    payload: T;
    atRevision: number;
}

const tabKey = (projectId: number) => `pcl:gastfin:${projectId}:tab`;

/**
 * Gast. Fin. (Gastos Financieros) dentro de Delphin. Igual que el Editor de Mantenimiento: cada
 * pestaña se carga al abrirla y se cachea con la revisión del documento; al volver a una pestaña
 * se recarga solo si otra pestaña cambió algo desde entonces.
 */
export default function GastFinView({ projectId, projectData, budgetDirty }: Props) {
    const [info, setInfo] = useState<GastFinShowResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [tab, setTab] = useState<Tab>(() => {
        try {
            return (localStorage.getItem(tabKey(projectId)) as Tab | null) ?? 'resumen';
        } catch {
            return 'resumen';
        }
    });
    const [cache, setCache] = useState<Partial<Record<string, CacheEntry<Payloads[keyof Payloads]>>>>({});
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        gastFinApi
            .show(projectId)
            .then((res) => {
                setInfo(res);
                setRevision(res.document.revision);
            })
            .catch((err) => setError(errorMessage(err)));
    }, [projectId]);

    const documentId = info?.document.id ?? null;
    const grupos = info?.grupos ?? [];
    const matGrupos = grupos.filter((grupo) => grupo.materiales > 0 || grupo.ref !== '_');
    const validTab: Tab = tab.startsWith('mat:') && !matGrupos.some((g) => `mat:${g.ref}` === tab) ? 'resumen' : tab;

    const remember = (key: string, payload: Payloads[keyof Payloads], rev: number) => {
        setRevision((current) => Math.max(current, rev));
        setCache((prev) => ({ ...prev, [key]: { payload, atRevision: rev } }));
    };

    // Carga perezosa de la pestaña activa (o recarga si otra pestaña avanzó la revisión).
    const entry = cache[validTab];
    const stale = !entry || entry.atRevision < revision;
    useEffect(() => {
        if (!documentId || !stale) return;
        let cancelled = false;
        const load = async (): Promise<[Payloads[keyof Payloads], number]> => {
            if (validTab === 'resumen') {
                const res = await gastFinApi.resumen(projectId);
                return [res.resumen, res.revision];
            }
            if (validTab === 'mo') {
                const res = await gastFinApi.mo(projectId);
                return [res.mo, res.revision];
            }
            if (validTab === 'gg') {
                const res = await ggApi.refresh(projectId, documentId);
                return [res.gg, res.revision];
            }
            const res = await gastFinApi.mat(projectId, validTab.slice(4));
            return [res.mat, res.revision];
        };
        load()
            .then(([payload, rev]) => {
                if (!cancelled) remember(validTab, payload, rev);
            })
            .catch((err) => !cancelled && window.alert(errorMessage(err)));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentId, validTab, stale]);

    const selectTab = (next: Tab) => {
        setTab(next);
        try {
            localStorage.setItem(tabKey(projectId), next);
        } catch {
            // sin almacenamiento: solo no se recuerda la pestaña
        }
    };

    // La clasificación del nivel puede cambiar desde MO o RESUMEN: refrescar nombres de pestañas.
    const refreshGrupos = () => void gastFinApi.show(projectId).then(setInfo).catch(() => undefined);

    const exportExcel = async () => {
        if (!documentId) return;
        setExporting(true);
        try {
            const { exportGastFinExcel } = await import('./export/exportGastFinExcel');
            await exportGastFinExcel({ projectId, documentId, grupos: matGrupos, projectData });
        } catch (err) {
            window.alert(errorMessage(err, 'No se pudo exportar a Excel.'));
        } finally {
            setExporting(false);
        }
    };

    if (error) {
        return <div className="flex flex-1 items-center justify-center p-6 text-sm text-red-600">{error}</div>;
    }
    if (!info || !documentId) {
        return (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" /> Consolidando insumos del presupuesto…
            </div>
        );
    }

    const tabButton = (key: Tab, label: string, title?: string) => (
        <button
            key={key}
            type="button"
            title={title}
            onClick={() => selectTab(key)}
            className={`shrink-0 border-b-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap transition-colors ${
                validTab === key
                    ? 'border-amber-600 text-amber-700 dark:text-amber-300'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
        >
            {label}
        </button>
    );

    const grupoTitle = (grupo: GastFinGrupo) =>
        `${grupo.tipo ? `${TIPO_LABEL[grupo.tipo]} · ` : ''}${grupo.partida ? `${grupo.partida} ` : ''}${grupo.descripcion} — ${grupo.materiales} materiales`;

    const current = cache[validTab];
    const onRevision = (key: string) => (rev: number, payload: Payloads[keyof Payloads]) => {
        remember(key, payload, rev);
        if (key === 'mo' || key === 'resumen') refreshGrupos();
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-950">
            <div className="flex shrink-0 items-center border-b border-slate-200 dark:border-slate-800">
                <div className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:thin]">
                    {tabButton('resumen', 'Resumen')}
                    {tabButton('mo', 'MO', 'Mano de obra por nivel')}
                    {matGrupos.map((grupo) => tabButton(`mat:${grupo.ref}`, `MAT · ${grupo.descripcion}`, grupoTitle(grupo)))}
                    {tabButton('gg', 'GG', 'Gastos generales')}
                </div>
                <button
                    type="button"
                    onClick={() => void exportExcel()}
                    disabled={exporting}
                    className="mx-2 flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                >
                    {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                    Exportar a Excel
                </button>
            </div>

            {budgetDirty && (
                <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle size={12} />
                    Hay cambios de Presupuesto o ACU sin guardar. Gast. Fin. usa lo último guardado: guarda en el modo Presupuesto para verlos aquí.
                </div>
            )}

            {!current || stale ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 size={14} className="animate-spin" /> Cargando…
                </div>
            ) : validTab === 'resumen' ? (
                <>
                
                <ResumenSheet
                    key="resumen"
                    projectId={projectId}
                    documentId={documentId}
                    initial={current.payload as ResumenPayload}
                    onRevision={(rev, payload) => onRevision('resumen')(rev, payload as GastFinResumenPayload)}
                    saveParametros={(partial) => gastFinApi.updateParametros(projectId, partial)}
                    saveGrupoIdeal={async (grupoRef, campo, value) => {
                        await gastFinApi.updateGrupo(projectId, grupoRef, campo === 'mo_aprobado' ? { mo_aprobado: value } : { mat_aprobado: value });
                        return gastFinApi.resumen(projectId);
                    }}
                />
                </>
            ) : validTab === 'mo' ? (
                <GastFinMoSheet key="mo" projectId={projectId} initial={current.payload as MoPayload} onRevision={onRevision('mo')} />
            ) : validTab === 'gg' ? (
                <GgSheet key="gg" projectId={projectId} documentId={documentId} initial={current.payload as GgPayload} onRevision={onRevision('gg')} />
            ) : (
                (() => {
                    const grupo = matGrupos.find((g) => `mat:${g.ref}` === validTab);
                    return grupo ? (
                        <GastFinMatSheet key={validTab} projectId={projectId} grupo={grupo} initial={current.payload as MatPayload} onRevision={onRevision(validTab)} />
                    ) : null;
                })()
            )}
        </div>
    );
}
