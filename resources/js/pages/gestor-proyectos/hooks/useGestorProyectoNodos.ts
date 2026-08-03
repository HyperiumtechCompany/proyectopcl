import { useCallback, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { buildTree } from '@/pages/gestor-proyectos/components/layout';
import type { ApiNodo, ApiNodoContent, NodeColor, NodeShape, NodeStatus, NodeType } from '@/pages/gestor-proyectos/components/types';

export interface NodoFormValues {
    title: string;
    type: NodeType;
    shape: NodeShape;
    color: NodeColor;
    status: NodeStatus;
    content: ApiNodoContent;
    peso: number | null;
    dias: number | null;
}

interface UseGestorProyectoNodosReturn {
    tree: ReturnType<typeof buildTree>;
    isSaving: boolean;
    createNodo: (parentId: number, values: NodoFormValues) => Promise<ApiNodo | null>;
    updateNodo: (id: number, values: NodoFormValues) => Promise<ApiNodo | null>;
    deleteNodo: (id: number) => Promise<boolean>;
}

function csrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

function gestorProyectoNodoUrl(gestorProyectoId: number, nodoId?: number): string {
    const baseUrl = `/gestor-proyectos/${gestorProyectoId}/nodos`;

    return nodoId === undefined ? baseUrl : `${baseUrl}/${nodoId}`;
}

async function requestJson<T>(url: string, method: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error((errJson as { message?: string }).message ?? `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
}

function notifyError(message: string): void {
    (document.activeElement as HTMLElement | null)?.blur();
    void Swal.fire({ icon: 'error', title: 'Ocurrio un error', text: message, timer: 3200, showConfirmButton: false });
}

export function useGestorProyectoNodos(gestorProyectoId: number, initialNodos: ApiNodo[]): UseGestorProyectoNodosReturn {
    const [nodos, setNodos] = useState<ApiNodo[]>(initialNodos);
    const [isSaving, setIsSaving] = useState(false);

    const tree = useMemo(() => buildTree(nodos), [nodos]);

    const createNodo = useCallback(
        async (parentId: number, values: NodoFormValues): Promise<ApiNodo | null> => {
            setIsSaving(true);

            try {
                const url = gestorProyectoNodoUrl(gestorProyectoId);
                const { nodo } = await requestJson<{ nodo: ApiNodo }>(url, 'post', { parent_id: parentId, ...values });
                setNodos((current) => [...current, nodo]);
                return nodo;
            } catch (err) {
                notifyError((err as Error).message ?? 'No se pudo crear el nodo.');
                return null;
            } finally {
                setIsSaving(false);
            }
        },
        [gestorProyectoId],
    );

    const updateNodo = useCallback(
        async (id: number, values: NodoFormValues): Promise<ApiNodo | null> => {
            setIsSaving(true);
            const previous = nodos;

            setNodos((current) => current.map((n) => (n.id === id ? { ...n, ...values } : n)));

            try {
                const url = gestorProyectoNodoUrl(gestorProyectoId, id);
                const { nodo } = await requestJson<{ nodo: ApiNodo }>(url, 'patch', values);
                setNodos((current) => current.map((n) => (n.id === id ? nodo : n)));
                return nodo;
            } catch (err) {
                setNodos(previous);
                notifyError((err as Error).message ?? 'No se pudo editar el nodo.');
                return null;
            } finally {
                setIsSaving(false);
            }
        },
        [gestorProyectoId, nodos],
    );

    const deleteNodo = useCallback(
        async (id: number): Promise<boolean> => {
            setIsSaving(true);
            const previous = nodos;

            const idsToRemove = new Set<number>([id]);
            let grew = true;
            while (grew) {
                grew = false;
                for (const n of previous) {
                    if (n.parent_id !== null && idsToRemove.has(n.parent_id) && !idsToRemove.has(n.id)) {
                        idsToRemove.add(n.id);
                        grew = true;
                    }
                }
            }
            setNodos((current) => current.filter((n) => !idsToRemove.has(n.id)));

            try {
                const url = gestorProyectoNodoUrl(gestorProyectoId, id);
                await requestJson<{ deleted: boolean }>(url, 'delete');
                return true;
            } catch (err) {
                setNodos(previous);
                notifyError((err as Error).message ?? 'No se pudo eliminar el nodo.');
                return false;
            } finally {
                setIsSaving(false);
            }
        },
        [gestorProyectoId, nodos],
    );

    return { tree, isSaving, createNodo, updateNodo, deleteNodo };
}
