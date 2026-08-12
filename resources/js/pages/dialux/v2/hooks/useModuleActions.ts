import { router } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import Swal from 'sweetalert2';
import { show as showProject } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import { moduleApi } from '../lib/moduleApi';
import type { DialuxV2Module } from '../types';

const swalTheme = { background: '#101218', color: '#e4e4e7' };

interface Options {
    projectId: number;
    modules: DialuxV2Module[];
    activeModuleId?: number;
}

export function useModuleActions({
    projectId,
    modules,
    activeModuleId,
}: Options) {
    const [busy, setBusy] = useState(false);

    const run = useCallback(async (operation: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await operation();
            router.reload({ only: ['modules'] });
        } catch (error) {
            await Swal.fire({
                title: 'No se pudo completar la acción',
                text:
                    error instanceof Error
                        ? error.message
                        : 'Ocurrió un error inesperado.',
                icon: 'error',
                ...swalTheme,
            });
        } finally {
            setBusy(false);
        }
    }, []);

    const promptName = useCallback(async (title: string, initial = '') => {
        const result = await Swal.fire({
            title,
            input: 'text',
            inputValue: initial,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d97706',
            inputValidator: (value) =>
                value.trim() ? undefined : 'El nombre es obligatorio.',
            ...swalTheme,
        });

        return result.value ? String(result.value).trim() : null;
    }, []);

    const create = useCallback(async () => {
        const name = await promptName(
            'Nuevo módulo',
            `Módulo ${modules.length + 1}`,
        );
        if (name) await run(() => moduleApi.create(projectId, name));
    }, [modules.length, projectId, promptName, run]);

    const rename = useCallback(
        async (module: DialuxV2Module) => {
            const name = await promptName('Renombrar módulo', module.name);
            if (name)
                await run(() => moduleApi.rename(projectId, module.id, name));
        },
        [projectId, promptName, run],
    );

    const duplicate = useCallback(
        (module: DialuxV2Module) =>
            run(() => moduleApi.duplicate(projectId, module.id)),
        [projectId, run],
    );

    const remove = useCallback(
        async (module: DialuxV2Module) => {
            if (modules.length === 1) {
                await Swal.fire({
                    title: 'El proyecto necesita un módulo',
                    text: 'Crea otro módulo antes de eliminar este.',
                    icon: 'info',
                    ...swalTheme,
                });
                return;
            }

            const result = await Swal.fire({
                title: '¿Eliminar módulo?',
                text: `Se eliminará “${module.name}” y toda su información.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626',
                ...swalTheme,
            });
            if (!result.isConfirmed) return;

            setBusy(true);
            try {
                await moduleApi.destroy(projectId, module.id);
                if (module.id === activeModuleId) {
                    router.visit(showProject(projectId));
                } else {
                    router.reload({ only: ['modules'] });
                }
            } catch (error) {
                await Swal.fire({
                    title: 'No se pudo eliminar el módulo',
                    text:
                        error instanceof Error
                            ? error.message
                            : 'Ocurrió un error inesperado.',
                    icon: 'error',
                    ...swalTheme,
                });
            } finally {
                setBusy(false);
            }
        },
        [activeModuleId, modules.length, projectId],
    );

    const move = useCallback(
        async (module: DialuxV2Module, direction: -1 | 1) => {
            const index = modules.findIndex((item) => item.id === module.id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= modules.length) return;

            const reordered = [...modules];
            [reordered[index], reordered[target]] = [
                reordered[target],
                reordered[index],
            ];
            await run(() =>
                moduleApi.reorder(
                    projectId,
                    reordered.map((item, position) => ({
                        id: item.id,
                        sort_order: position,
                    })),
                ),
            );
        },
        [modules, projectId, run],
    );

    return { busy, create, rename, duplicate, remove, move };
}
