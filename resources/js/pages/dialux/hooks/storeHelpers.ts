/**
 * storeHelpers.ts — Funciones puras usadas por useEditorStore.ts
 *
 * Sin dependencia de React/Zustand: solo transforman los objetos de dominio
 * que reciben como parámetro. Extraídas para reducir el tamaño del store.
 */

import type { DxfEntity, DxfExtents, Project, Scene, ScaleConfig, Wall } from './types';
import { getPeruWallPreset } from './wallNorms';

export function createScaleConfig(
    unit: ScaleConfig['unit'],
    factor: number,
    displayUnit: string,
): ScaleConfig {
    return {
        unit,
        factor,
        displayUnit,
        calibrationFactor: 1,
        isCalibrated: false,
    };
}

/**
 * Heurística de respaldo cuando el DXF no declara `$INSUNITS` (o el formato es
 * DWG/DXF sin cabecera legible): infiere la unidad real a partir del tamaño de
 * los extents. Una casa típica en metros mide decenas de unidades; en
 * centímetros, cientos; en milímetros, miles.
 */
export function detectScaleFromExtents(extents: DxfExtents): ScaleConfig {
    const w = extents.max_x - extents.min_x;
    const h = extents.max_y - extents.min_y;
    const maxDim = Math.max(w, h);

    if (maxDim > 1000) {
        // Probablemente milímetros
        return createScaleConfig('mm', 0.001, 'Milímetros (1000 = 1m)');
    } else if (maxDim > 100) {
        // Probablemente centímetros
        return createScaleConfig('cm', 0.01, 'Centímetros (100 = 1m)');
    }
    // Probablemente metros
    return createScaleConfig('m', 1, 'Metros (1 = 1m)');
}

export function normalizeScaleConfig(
    scaleConfig?: Partial<ScaleConfig> | null,
): ScaleConfig {
    return {
        unit: scaleConfig?.unit ?? 'm',
        factor: scaleConfig?.factor ?? 1,
        displayUnit: scaleConfig?.displayUnit ?? 'Metros (1 = 1m)',
        calibrationFactor: scaleConfig?.calibrationFactor ?? 1,
        isCalibrated: scaleConfig?.isCalibrated ?? false,
    };
}

export function mutateScene(
    state: { project: Project | null; activeSceneId: string | null },
    mutator: (scene: Scene) => Scene,
): { project: Project } | typeof state {
    if (!state.project || !state.activeSceneId) return state as typeof state;
    return {
        project: {
            ...state.project,
            scenes: state.project.scenes.map((s) =>
                s.id === state.activeSceneId ? mutator(s) : s,
            ),
        },
    };
}

export function rescaleSceneEntities(scene: Scene, ratio: number): Scene {
    return {
        ...scene,
        rooms: (scene.rooms || []).map((r) => ({
            ...r,
            vertices: (r.vertices || []).map((v) => ({
                x: v.x * ratio,
                y: v.y * ratio,
            })),
        })),
        walls: (scene.walls || []).map((w) => ({
            ...w,
            vertices: (w.vertices || []).map((v) => ({
                x: v.x * ratio,
                y: v.y * ratio,
            })),
        })),
        fixtures: (scene.fixtures || []).map((f) => ({
            ...f,
            x: f.x * ratio,
            y: f.y * ratio,
        })),
        canopies: (scene.canopies || []).map((c) => ({
            ...c,
            x1: c.x1 * ratio,
            y1: c.y1 * ratio,
            x2: c.x2 * ratio,
            y2: c.y2 * ratio,
            // width is explicitly in meters, do not scale
        })),
        // Windows/Doors are relative to walls (offsetAlongWall), so rescale offset.
        // width/height/sillHeight are explicitly in meters, do not scale them.
        windows: (scene.windows || []).map((w) => ({
            ...w,
            offsetAlongWall: w.offsetAlongWall * ratio,
        })),
        doors: (scene.doors || []).map((d) => ({
            ...d,
            offsetAlongWall: d.offsetAlongWall * ratio,
        })),
        partitions: (scene.partitions ?? []).map((p) => ({
            ...p,
            vertices: p.vertices.map((v) => ({ x: v.x * ratio, y: v.y * ratio })),
            // thickness is explicitly in meters, do not scale
        })),
        structuralObstacles: (scene.structuralObstacles ?? []).map((o) => ({
            ...o,
            vertices: o.vertices.map((v) => ({ x: v.x * ratio, y: v.y * ratio })),
            // height/elevation son verticales, ya en metros reales: no se reescalan con la calibracion 2D
        })),
    };
}

export function rescaleDxfExtents(extents: DxfExtents, ratio: number): DxfExtents {
    return {
        min_x: extents.min_x * ratio,
        min_y: extents.min_y * ratio,
        max_x: extents.max_x * ratio,
        max_y: extents.max_y * ratio,
    };
}

export function rescaleDxfEntities(entities: DxfEntity[], ratio: number): DxfEntity[] {
    return entities.map((ent) => {
        switch (ent.type) {
            case 'line':
                return { ...ent, x1: ent.x1 * ratio, y1: ent.y1 * ratio, x2: ent.x2 * ratio, y2: ent.y2 * ratio };
            case 'polyline':
            case 'polygon':
            case 'solid':
                return { ...ent, vertices: ent.vertices.map(([x, y]) => [x * ratio, y * ratio] as [number, number]) };
            case 'circle':
            case 'arc':
                return { ...ent, cx: ent.cx * ratio, cy: ent.cy * ratio, r: ent.r * ratio };
            case 'ellipse':
                return { ...ent, cx: ent.cx * ratio, cy: ent.cy * ratio, major_x: ent.major_x * ratio, major_y: ent.major_y * ratio };
            case 'text':
                return { ...ent, x: ent.x * ratio, y: ent.y * ratio, height: ent.height * ratio };
            case 'point':
                return { ...ent, x: ent.x * ratio, y: ent.y * ratio };
            case 'rectangle':
                return { ...ent, x: ent.x * ratio, y: ent.y * ratio, width: ent.width * ratio, height: ent.height * ratio };
            case 'spline':
                return { ...ent, control_points: ent.control_points.map(([x, y]) => [x * ratio, y * ratio] as [number, number]) };
            case 'hatch':
                return { ...ent, boundary_paths: ent.boundary_paths.map(path => path.map(([x, y]) => [x * ratio, y * ratio] as [number, number])) };
            default:
                return ent;
        }
    });
}

export function normalizeFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

export function normalizePositiveNumber(
    value: unknown,
    fallback: number,
    min = 0,
): number {
    const numeric = normalizeFiniteNumber(value, fallback);
    return Math.max(min, numeric);
}

export function normalizeWallState(wall: Wall): Wall {
    const material = wall.material ?? 'brick';
    const normativeUse = wall.normativeUse ?? 'housing';
    const preset = getPeruWallPreset(material, normativeUse);

    return {
        ...wall,
        material,
        normativeUse,
        thickness: normalizePositiveNumber(
            wall.thickness,
            preset.recommendedThickness,
            0.01,
        ),
        height: normalizePositiveNumber(
            wall.height,
            preset.recommendedHeight,
            0.5,
        ),
        mortarJointMin: normalizePositiveNumber(
            wall.mortarJointMin,
            preset.mortarJointMin,
            0,
        ),
        mortarJointMax: normalizePositiveNumber(
            wall.mortarJointMax,
            preset.mortarJointMax,
            0,
        ),
    };
}

export function normalizeWallPatch(
    currentWall: Wall,
    patch: Partial<Omit<Wall, 'id'>>,
): Wall {
    const nextMaterial = patch.material ?? currentWall.material ?? 'brick';
    const nextUse = patch.normativeUse ?? currentWall.normativeUse ?? 'housing';
    const preset = getPeruWallPreset(nextMaterial, nextUse);
    const isPresetSwitch =
        patch.material !== undefined || patch.normativeUse !== undefined;

    return normalizeWallState({
        ...currentWall,
        ...patch,
        material: nextMaterial,
        normativeUse: nextUse,
        thickness:
            patch.thickness ??
            (isPresetSwitch
                ? preset.recommendedThickness
                : currentWall.thickness),
        height:
            patch.height ??
            (isPresetSwitch ? preset.recommendedHeight : currentWall.height),
        mortarJointMin:
            patch.mortarJointMin ??
            (isPresetSwitch
                ? preset.mortarJointMin
                : currentWall.mortarJointMin),
        mortarJointMax:
            patch.mortarJointMax ??
            (isPresetSwitch
                ? preset.mortarJointMax
                : currentWall.mortarJointMax),
    });
}
