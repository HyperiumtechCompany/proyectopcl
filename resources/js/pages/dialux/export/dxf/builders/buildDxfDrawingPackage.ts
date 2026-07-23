import type { DxfEntity, DxfExtents, Project, Scene } from '@/pages/dialux/hooks/types';
import { buildDxfLevelPackage } from './buildDxfLevelPackage';
import type { DxfDrawingPackage, DxfExportWarning, DxfLevelBasePlan } from '../domain/types';

/**
 * Cómo repartir el (único) fondo CAD global entre los niveles de un
 * proyecto multinivel (plan maestro, sección 6.2 / 23):
 *   - 'shared-all-levels' → el mismo fondo se inserta en todos los niveles.
 *   - 'active-scene-only' → el fondo se asigna solo al nivel activo al exportar.
 *   - 'drawn-only'        → se ignora el fondo importado; solo geometría dibujada.
 *   - 'none'               → ningún nivel lleva fondo CAD.
 */
export type DxfBasePlanPolicyMode = 'shared-all-levels' | 'active-scene-only' | 'drawn-only' | 'none';

export interface DxfGlobalBasePlan {
    entities: DxfEntity[];
    extents: DxfExtents | null;
}

export interface BuildDxfDrawingPackageInput {
    project: Project;
    activeSceneId: string;
    globalBasePlan: DxfGlobalBasePlan | null;
    /**
     * Omitir en un proyecto multinivel con fondo global disponible aplica el
     * default seguro ('active-scene-only') y dejar constancia en `warnings`
     * — nunca se repite el fondo activo en todos los pisos silenciosamente
     * (Riesgo 1 del plan maestro).
     */
    basePlanPolicy?: DxfBasePlanPolicyMode;
}

function sortScenesByFloor(scenes: Scene[]): Scene[] {
    return [...scenes].sort((left, right) => {
        const floorCompare = (left.floorIndex ?? 0) - (right.floorIndex ?? 0);
        if (floorCompare !== 0) return floorCompare;
        return left.name.localeCompare(right.name, 'es');
    });
}

function resolveBasePlan(
    isActiveScene: boolean,
    isMultiLevel: boolean,
    globalBasePlan: DxfGlobalBasePlan | null,
    policy: DxfBasePlanPolicyMode,
): DxfLevelBasePlan {
    const hasGlobalEntities = (globalBasePlan?.entities.length ?? 0) > 0;

    if (!isMultiLevel) {
        // Un solo nivel: mismo comportamiento que el exportador actual (Fase 0).
        return hasGlobalEntities
            ? { source: 'shared', entities: globalBasePlan!.entities, extents: globalBasePlan!.extents }
            : { source: 'none', entities: [], extents: null };
    }

    if (policy === 'drawn-only') {
        return { source: 'drawn-only', entities: [], extents: null };
    }

    if (policy === 'none' || !hasGlobalEntities) {
        return { source: 'none', entities: [], extents: null };
    }

    if (policy === 'shared-all-levels') {
        return { source: 'shared', entities: globalBasePlan!.entities, extents: globalBasePlan!.extents };
    }

    // 'active-scene-only', incluido el default cuando no se eligió política.
    return isActiveScene
        ? { source: 'scene', entities: globalBasePlan!.entities, extents: globalBasePlan!.extents }
        : { source: 'none', entities: [], extents: null };
}

/**
 * Construye el paquete multinivel completo: ordena las escenas por
 * `floorIndex`, resuelve la política de fondo CAD y produce un
 * `DxfLevelPackage` por cada nivel visible, con warnings explícitos para
 * cualquier caso ambiguo (nunca clasificación silenciosa — plan maestro §23).
 */
export function buildDxfDrawingPackage(input: BuildDxfDrawingPackageInput): DxfDrawingPackage {
    const orderedScenes = sortScenesByFloor(input.project.scenes);
    const isMultiLevel = orderedScenes.length > 1;
    const globalBasePlan = input.globalBasePlan ?? null;
    const hasGlobalEntities = (globalBasePlan?.entities.length ?? 0) > 0;
    const effectivePolicy: DxfBasePlanPolicyMode = input.basePlanPolicy ?? 'active-scene-only';

    const warnings: DxfExportWarning[] = [];

    if (isMultiLevel && hasGlobalEntities && input.basePlanPolicy === undefined) {
        warnings.push({
            code: 'shared-base-plan-not-configured',
            message:
                'Proyecto con varios niveles y un único fondo CAD global: se aplicó solo al nivel activo. ' +
                'Elige explícitamente cómo repartir el fondo (compartido, solo nivel activo o sin fondo) antes de exportar todos los niveles.',
            sceneId: null,
            levelName: null,
        });
    }

    const firstSceneIdByName = new Map<string, string>();
    const levels = orderedScenes
        .filter((scene) => scene.visible !== false)
        .map((scene) => {
            const isActiveScene = scene.id === input.activeSceneId;
            const basePlan = resolveBasePlan(isActiveScene, isMultiLevel, globalBasePlan, effectivePolicy);

            if (isMultiLevel && basePlan.source === 'none') {
                warnings.push({
                    code: 'level-without-base-plan',
                    message: `El nivel "${scene.name}" se exportará sin fondo CAD.`,
                    sceneId: scene.id,
                    levelName: scene.name,
                });
            }

            const previousSceneId = firstSceneIdByName.get(scene.name);
            if (previousSceneId) {
                warnings.push({
                    code: 'duplicate-level-name',
                    message: `Dos o más niveles comparten el nombre "${scene.name}" (${previousSceneId} y ${scene.id}).`,
                    sceneId: scene.id,
                    levelName: scene.name,
                });
            } else {
                firstSceneIdByName.set(scene.name, scene.id);
            }

            return buildDxfLevelPackage(scene, basePlan);
        });

    for (const scene of orderedScenes) {
        if (scene.visible === false) {
            warnings.push({
                code: 'level-hidden-excluded',
                message: `El nivel "${scene.name}" está oculto y se excluyó de la exportación.`,
                sceneId: scene.id,
                levelName: scene.name,
            });
        }
    }

    return {
        version: '2.0.0',
        projectId: input.project.id,
        projectName: input.project.name,
        units: 'm',
        levels,
        warnings,
    };
}
