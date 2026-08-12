import {
    createScaleConfig,
    type Project,
} from '@/pages/dialux/hooks/useEditorStore';

export function createBlankModuleProject(
    projectId: number,
    moduleId: number,
    name: string,
): Project {
    const now = new Date().toISOString();

    return {
        id: String(projectId),
        moduleId: String(moduleId),
        name,
        created_at: now,
        updated_at: now,
        scenes: [
            {
                id: 'scene-default',
                name: 'Planta Baja',
                floorIndex: 0,
                floorElevation: 0,
                floorHeight: 3,
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
