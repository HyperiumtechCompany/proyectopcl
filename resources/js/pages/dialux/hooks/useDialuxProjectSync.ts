/**
 * useDialuxProjectSync.ts
 *
 * Autosave del proyecto DIAlux: cada cambio en el store Zustand agenda un
 * guardado (debounced) vía fetch JSON — no un visit de Inertia, para no
 * resetear pan/zoom/selección del canvas en cada guardado (mismo criterio
 * que useNormativeConfig.ts y el editor de nodos de Gestor de Proyectos).
 */

import { useEffect, useRef } from 'react';
import { setDialuxSaveStatus } from './useDialuxSaveStatus';
import { useEditorStore, type Project } from './useEditorStore';

const AUTOSAVE_DEBOUNCE_MS = 2500;

/**
 * El meta tag `csrf-token` se estampa una sola vez en la carga inicial de la
 * página y nunca se refresca durante una sesión Inertia (SPA) larga — en una
 * sesión de dibujo de varios minutos termina desincronizado y cada autosave
 * falla con 419. La cookie `XSRF-TOKEN` en cambio se renueva en cada
 * respuesta del servidor, así que siempre está vigente (es el mismo
 * mecanismo que usa Inertia/axios internamente).
 */
function readXsrfTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function persistProject(projectId: string, project: Project): Promise<void> {
    setDialuxSaveStatus('saving');

    try {
        const response = await fetch(`/dialux/${projectId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify({ name: project.name, data: project }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        setDialuxSaveStatus('saved');
    } catch {
        setDialuxSaveStatus('error');
    }
}

/**
 * @param projectId id del proyecto DIAlux (ruta backend).
 * @param ready true una vez que Show.tsx sembró el store con el proyecto
 *              cargado — evita autosave prematuro antes de la carga inicial.
 */
export function useDialuxProjectSync(projectId: string, ready: boolean): void {
    const project = useEditorStore((s) => s.project);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipNextSaveRef = useRef(true);
    const latestProjectRef = useRef<Project | null>(null);

    latestProjectRef.current = project;

    useEffect(() => {
        skipNextSaveRef.current = true;
    }, [projectId]);

    useEffect(() => {
        if (!ready || !project) {
            return;
        }

        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            return;
        }

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            void persistProject(projectId, project);
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [project, projectId, ready]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                if (latestProjectRef.current) {
                    void persistProject(projectId, latestProjectRef.current);
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);
}
