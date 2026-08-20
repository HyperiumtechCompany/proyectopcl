import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { EditorLayout } from '@/pages/dialux/components/EditorLayout';
import { ensureStandardDataLoaded } from '@/pages/dialux/hooks/normativeRemoteData';
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
 * pages/dialux/Show.tsx” Editor DIAlux de un proyecto concreto
 *
 * Siembra el store Zustand con el proyecto cargado desde BD (o una
 * plantilla en blanco si aun no tiene dibujo) antes de montar EditorLayout,
 * y mantiene el autosave activo mientras el usuario dibuja.
 */
export default function DialuxShow({ project }: Props) {
    const setProject = useEditorStore((s) => s.setProject);
    const setActiveScene = useEditorStore((s) => s.setActiveScene);
    const setDefaultRoomNormativeStandard = useEditorStore(
        (s) => s.setDefaultRoomNormativeStandard,
    );
    const resetHistory = useEditorStore((s) => s.resetHistory);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const initial =
            project.data ?? buildBlankProject(project.id, project.name);
        setProject(initial);
        const firstSceneId = initial.scenes[0]?.id;
        if (firstSceneId) {
            setActiveScene(firstSceneId);
        }

        // Los proyectos nuevos persisten `defaultRoomNormativeStandard`. Para
        // documentos antiguos inferimos la norma mas usada por sus ambientes.
        type RoomStandard = NonNullable<
            Project['scenes'][number]['rooms'][number]['normativeStandard']
        >;
        const standardCounts = new Map<RoomStandard, number>();
        for (const scene of initial.scenes) {
            for (const room of scene.rooms) {
                if (
                    (room.roomType === 'ambient' ||
                        room.roomType === 'corridor') &&
                    room.normativeStandard
                ) {
                    standardCounts.set(
                        room.normativeStandard,
                        (standardCounts.get(room.normativeStandard) ?? 0) + 1,
                    );
                }
            }
        }
        let mostUsedStandard: RoomStandard | null = null;
        let mostUsedCount = 0;
        for (const [standard, count] of standardCounts) {
            if (count > mostUsedCount) {
                mostUsedStandard = standard;
                mostUsedCount = count;
            }
        }
        setDefaultRoomNormativeStandard(
            initial.defaultRoomNormativeStandard ??
                mostUsedStandard ??
                'en_12464_1',
        );

        // La carga del proyecto desde BD no es una acción del usuario: el
        // historial de undo/redo debe empezar vacÃ­o, no permitir "deshacer"
        // de vuelta a un proyecto sin sembrar.
        resetHistory();

        // Arranca la carga del catalogo BD (fuente unica de verdad) apenas se
        // abre el proyecto, para que los paneles de propiedades (pared,
        // ambiente) no muestren la transcripcion estatica desactualizada
        // mientras el usuario ya esta¡ trabajando.
        void ensureStandardDataLoaded('rne_peru');
        void ensureStandardDataLoaded('en_1838');

        setReady(true);
        // Solo debe re-sembrar si cambia el proyecto que se esta¡ viendo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id]);

    useDialuxProjectSync(project.id, ready);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'HyperLux', href: '/dialux' },
        { title: project.name, href: `/dialux/${project.id}` },
    ];

    if (!ready) {
        return null;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`HyperLux ” ${project.name}`} />
            <div className="h-[calc(100vh-4rem)] w-full overflow-hidden">
                <EditorLayout />
            </div>
        </AppLayout>
    );
}

