import { useEffect, useRef } from 'react';
import { update } from '@/actions/App/Http/Controllers/Dialux/V2/ModuleController';
import { setDialuxSaveStatus } from '@/pages/dialux/hooks/useDialuxSaveStatus';
import {
    useEditorStore,
    type Project,
} from '@/pages/dialux/hooks/useEditorStore';

const AUTOSAVE_DEBOUNCE_MS = 2500;

/** Guardado en curso (el último PATCH lanzado), para poder esperarlo. */
let inFlightSave: Promise<void> | null = null;
/** Adelanta el guardado pendiente (debounce) del módulo montado, si lo hay. */
let flushPendingSave: (() => void) | null = null;

/**
 * Guarda YA lo pendiente del módulo abierto y espera a que el servidor lo
 * tenga. Se usa antes de navegar a otra página que lee el mismo documento
 * desde el servidor (p.ej. Red y CT lee la planta general): sin esto, un
 * cable recién dibujado podía no llegar porque la página nueva se pedía
 * antes de que terminara el autoguardado.
 */
export async function flushDialuxModuleSave(): Promise<void> {
    flushPendingSave?.();
    if (inFlightSave) await inFlightSave;
}

function readXsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function persistModule(
    projectId: number,
    moduleId: number,
    project: Project,
): Promise<void> {
    const request = sendModule(projectId, moduleId, project).finally(() => {
        if (inFlightSave === request) inFlightSave = null;
    });
    inFlightSave = request;
    return request;
}

async function sendModule(
    projectId: number,
    moduleId: number,
    project: Project,
): Promise<void> {
    setDialuxSaveStatus('saving');

    try {
        const response = await fetch(update.url([projectId, moduleId]), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': readXsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify({ name: project.name, data: project }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setDialuxSaveStatus('saved');
    } catch {
        setDialuxSaveStatus('error');
    }
}

export function useDialuxModuleSync(
    projectId: number,
    moduleId: number,
    ready: boolean,
): void {
    const project = useEditorStore((state) => state.project);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestProjectRef = useRef<Project | null>(null);

    useEffect(() => {
        latestProjectRef.current = project;
    }, [project]);

    // Proyecto tal como se cargó del servidor: no se re-guarda (era un PATCH
    // completo + JSON.stringify de todo el módulo en CADA cambio de módulo,
    // sin haber editado nada).
    const baselineRef = useRef<Project | null>(null);

    useEffect(() => {
        baselineRef.current = null;
    }, [moduleId]);

    useEffect(() => {
        if (!ready || !project) return;
        // Tras cambiar de módulo el store aún puede traer el proyecto del
        // anterior por un render — nunca guardarlo bajo el id del nuevo.
        if (project.moduleId !== String(moduleId)) return;
        if (baselineRef.current === null) {
            baselineRef.current = project;
            return;
        }
        if (project === baselineRef.current) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void persistModule(projectId, moduleId, project);
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [moduleId, project, projectId, ready]);

    // Permite a `flushDialuxModuleSave()` adelantar el guardado pendiente.
    useEffect(() => {
        const flush = () => {
            if (!timerRef.current || !latestProjectRef.current) return;
            clearTimeout(timerRef.current);
            timerRef.current = null;
            void persistModule(projectId, moduleId, latestProjectRef.current);
        };
        flushPendingSave = flush;
        return () => {
            if (flushPendingSave === flush) flushPendingSave = null;
        };
    }, [moduleId, projectId]);

    useEffect(
        () => () => {
            if (timerRef.current && latestProjectRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
                void persistModule(
                    projectId,
                    moduleId,
                    latestProjectRef.current,
                );
            }
        },
        [moduleId, projectId],
    );
}
