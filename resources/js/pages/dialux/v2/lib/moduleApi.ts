import {
    destroy,
    duplicate,
    reorder,
    store,
    update,
} from '@/actions/App/Http/Controllers/Dialux/V2/ModuleController';
import type { DialuxV2Module } from '../types';

interface ModuleResponse {
    module: DialuxV2Module;
}

interface ModulesResponse {
    modules: DialuxV2Module[];
}

function readXsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function request<T>(
    url: string,
    method: string,
    body?: unknown,
): Promise<T> {
    const response = await fetch(url, {
        method,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': readXsrfToken(),
        },
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
            message?: string;
            errors?: Record<string, string[]>;
        } | null;
        const firstError = payload?.errors
            ? Object.values(payload.errors).flat()[0]
            : undefined;
        throw new Error(
            firstError ?? payload?.message ?? `HTTP ${response.status}`,
        );
    }

    return response.status === 204
        ? (undefined as T)
        : ((await response.json()) as T);
}

export const moduleApi = {
    create: (projectId: number, name: string) =>
        request<ModuleResponse>(store.url(projectId), 'POST', { name }),
    rename: (projectId: number, moduleId: number, name: string) =>
        request<ModuleResponse>(update.url([projectId, moduleId]), 'PATCH', {
            name,
        }),
    duplicate: (projectId: number, moduleId: number) =>
        request<ModuleResponse>(duplicate.url([projectId, moduleId]), 'POST'),
    destroy: (projectId: number, moduleId: number) =>
        request<void>(destroy.url([projectId, moduleId]), 'DELETE'),
    reorder: (
        projectId: number,
        modules: Array<{ id: number; sort_order: number }>,
    ) => request<ModulesResponse>(reorder.url(projectId), 'PATCH', { modules }),
};
