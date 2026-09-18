import { useEffect, useRef } from 'react';
import { update } from '@/actions/App/Http/Controllers/Dialux/V2/ModuleController';
import { setDialuxSaveStatus } from '@/pages/dialux/hooks/useDialuxSaveStatus';
import {
    useEditorStore,
    type Project,
} from '@/pages/dialux/hooks/useEditorStore';

const AUTOSAVE_DEBOUNCE_MS = 2500;

function readXsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function persistModule(
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
