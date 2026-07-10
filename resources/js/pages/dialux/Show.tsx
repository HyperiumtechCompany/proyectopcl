import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { EditorLayout } from '@/pages/dialux/components/EditorLayout';
import { useDialuxProjectSync } from '@/pages/dialux/hooks/useDialuxProjectSync';
import {
    createScaleConfig,
    useEditorStore,
    type Project,
} from '@/pages/dialux/hooks/useEditorStore';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Props {
    project: {
        id: string;
        name: string;
        data: Project | null;
    };
}

function buildBlankProject(id: string, name: string): Project {
    const now = new Date().toISOString();

    return {
        id,
        name,
        created_at: now,
        updated_at: now,
        scenes: [
            {
                id: 'scene-default',
                name: 'Planta Baja',
                floorIndex: 0,
                floorElevation: 0,
                floorHeight: 3.0,
                scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
                rooms: [],
                walls: [],
                windows: [],
                doors: [],
                canopies: [],
                fixtures: [],
                lightSwitches: [],
                conductors: [],
                junctionBoxes: [],
                partitions: [],
                visible: true,
            },
        ],
    };
}

/**
 * pages/dialux/Show.tsx — Editor DIAlux de un proyecto concreto
 *
 * Siembra el store Zustand con el proyecto cargado desde BD (o una
 * plantilla en blanco si aún no tiene dibujo) antes de montar EditorLayout,
 * y mantiene el autosave activo mientras el usuario dibuja.
 */
export default function DialuxShow({ project }: Props) {
    const setProject = useEditorStore((s) => s.setProject);
    const setActiveScene = useEditorStore((s) => s.setActiveScene);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const initial = project.data ?? buildBlankProject(project.id, project.name);
        setProject(initial);
        const firstSceneId = initial.scenes[0]?.id;
        if (firstSceneId) {
            setActiveScene(firstSceneId);
        }
        setReady(true);
        // Solo debe re-sembrar si cambia el proyecto que se está viendo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id]);

    useDialuxProjectSync(project.id, ready);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'DIAlux', href: '/dialux' },
        { title: project.name, href: `/dialux/${project.id}` },
    ];

    if (!ready) {
        return null;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`DIAlux — ${project.name}`} />
            <div className="h-[calc(100vh-4rem)] w-full overflow-hidden">
                <EditorLayout />
            </div>
        </AppLayout>
    );
}
