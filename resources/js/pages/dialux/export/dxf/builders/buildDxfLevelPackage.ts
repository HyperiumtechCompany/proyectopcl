import type { Scene } from '@/pages/dialux/hooks/types';
import { computeLevelBounds } from '../geometry/bounds';
import type {
    DxfArchitectureEntities,
    DxfElectricalEntities,
    DxfLevelBasePlan,
    DxfLevelPackage,
} from '../domain/types';

/**
 * Convierte una `Scene` en un `DxfLevelPackage`, tomando cada arreglo
 * directamente de la escena (no de listas agregadas de varias escenas) para
 * que ningún elemento pierda su pertenencia a nivel (plan maestro, sección 6.1).
 */
export function buildDxfLevelPackage(scene: Scene, basePlan: DxfLevelBasePlan): DxfLevelPackage {
    const architecture: DxfArchitectureEntities = {
        rooms: scene.rooms,
        walls: scene.walls,
        windows: scene.windows,
        doors: scene.doors,
        canopies: scene.canopies,
    };

    const electrical: DxfElectricalEntities = {
        fixtures: scene.fixtures,
        lightSwitches: scene.lightSwitches,
        electricalDevices: scene.electricalDevices ?? [],
        conductors: scene.conductors ?? [],
        junctionBoxes: scene.junctionBoxes ?? [],
    };

    return {
        sceneId: scene.id,
        floorIndex: scene.floorIndex ?? 0,
        floorElevation: scene.floorElevation ?? 0,
        floorHeight: scene.floorHeight ?? 0,
        name: scene.name,
        visible: scene.visible ?? true,
        basePlan,
        architecture,
        electrical,
        bounds: computeLevelBounds(scene.rooms, scene.walls, scene.fixtures, basePlan),
    };
}
