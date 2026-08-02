import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import type { LightingResult, Room, Vertex } from '@/pages/dialux/hooks/types';

/**
 * Contratos de dominio de la Fase 1 (planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md
 * §8, §11 Fase 1). Deliberadamente NO reutilizan `Room`/`Fixture` completos de
 * `hooks/types.ts` — esos tipos cargan campos de catálogo/UI (marca, assets de
 * reporte, símbolo CAD, etc.) que no son insumo del cálculo. Ver ADR 0001/0002
 * en planes/adr/ para las decisiones de unidades y de snapshot que este
 * archivo implementa.
 *
 * `Level` (geometría/elevación) y `LightingScene` (estado de encendido/regulación)
 * ya están separados aquí (§6.1), aunque el store todavía no modele más de una
 * escena lumínica por nivel — `buildCalculationSnapshot` construye una única
 * escena "por defecto" con todo encendido al 100%, que es el comportamiento
 * real actual, no una simplificación inventada.
 */

export const CALCULATION_SNAPSHOT_SCHEMA_VERSION = '1';

// ── Geometría y fotometría normalizadas ─────────────────────────────────────

export interface CalculationMaterial {
    id: string;
    ceilingReflectance: number | null;
    wallReflectance: number | null;
    floorReflectance: number | null;
}

export interface CalculationLuminaire {
    id: string;
    levelId: string;
    name: string;
    /** Posición en metros, convención de ejes de ADR 0001 (planta XY + Z vertical relativo al nivel). */
    x: number;
    y: number;
    z: number;
    /** Grados sexagesimales, sentido horario (ADR 0001). */
    rotation: number;
    lumens: number;
    efficiency: number;
    fixtureType: string;
    fixtureShape: string | null;
    dimensions: { length: number; width: number; height: number } | null;
    /** Matriz fotométrica real (IES/LDT). `null` = motor usa aproximación Lambertiana. */
    photometricWeb: {
        c_angles: number[];
        gamma_angles: number[];
        candela: number[][];
    } | null;
}

export interface CalculationRequirement {
    illuminanceLux: number | null;
    uniformityTarget: number | null;
    ugrLimit: number | null;
    normativeStandard: string | null;
    normativeLabel: string | null;
}

export interface CalculationObject {
    id: string;
    levelId: string;
    name: string;
    /** Polígono en metros, orden de vértices preservado (define la forma — nunca reordenar). */
    vertices: Vertex[];
    height: number;
    roomType: Room['roomType'];
    usefulPlaneHeight: number | null;
    marginalZone: number | null;
    materialId: string | null;
    requirement: CalculationRequirement;
    luminaireIds: string[];
}

export interface LuminaireState {
    luminaireId: string;
    on: boolean;
    dimmingFactor: number;
}

/** Estado de encendido/regulación de un nivel — separado de `CalculationLevel` (§6.1). */
export interface LightingSceneState {
    id: string;
    levelId: string;
    name: string;
    luminaireStates: LuminaireState[];
}

/** Geometría y elevación de un nivel — sin estado de encendido (eso es `LightingSceneState`). */
export interface CalculationLevel {
    id: string;
    name: string;
    floorIndex: number;
    floorElevation: number;
    floorHeight: number;
}

/**
 * Snapshot inmutable de cálculo (plan maestro §8.1). Se construye con
 * `buildCalculationSnapshot` (puro) y se hashea con `hashCalculationSnapshot`
 * (`domain/calculation/hashSnapshot.ts`) — ningún cálculo debe leer el store
 * mientras corre (§4.2).
 */
export interface CalculationSnapshot {
    schemaVersion: string;
    projectId: string;
    /** Hash SOLO de geometría (niveles + vértices/alturas de objetos), ver ADR 0002 punto 5. Vacío hasta que se llame a `withGeometryHash`. */
    geometryHash: string;
    levels: CalculationLevel[];
    materials: CalculationMaterial[];
    luminaires: CalculationLuminaire[];
    scenes: LightingSceneState[];
    calculationObjects: CalculationObject[];
}

// ── Configuración y ejecución ────────────────────────────────────────────────

export interface CalculationConfig {
    mode: 'preview' | 'standard' | 'high';
    directLight: boolean;
    occlusion: boolean;
    interreflection: 'none' | 'first-bounce' | 'iterative';
    maxBounces: number;
    convergenceTolerance: number;
    meshPolicy: { gridSpacingM: number };
    glare: { enabled: boolean };
}

/**
 * Única configuración real hoy: el motor `direct-preview-v1` no soporta
 * oclusión ni interreflexión (Fase 0, brecha §3.3 del plan). `occlusion`/
 * `interreflection`/`maxBounces`/`convergenceTolerance` existen en el
 * contrato porque el plan los define desde ya (§8.2), pero `runDirectPreviewEngine`
 * los ignora — cambiarlos no tiene efecto hasta las Fases 6/8.
 */
export const DEFAULT_DIRECT_PREVIEW_CONFIG: CalculationConfig = {
    mode: 'preview',
    directLight: true,
    occlusion: false,
    interreflection: 'none',
    maxBounces: 0,
    convergenceTolerance: 0,
    meshPolicy: { gridSpacingM: GRID_SPACING },
    glare: { enabled: true },
};

export interface CalculationWarning {
    code: string;
    message: string;
    objectId: string | null;
}

export interface SurfaceCalculationResult {
    objectId: string;
    objectName: string;
    levelId: string;
    result: LightingResult;
}

export type CalculationRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stale';

export interface CalculationRun {
    id: string;
    engineVersion: string;
    snapshotHash: string;
    status: CalculationRunStatus;
    config: CalculationConfig;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    warnings: CalculationWarning[];
    surfaces: SurfaceCalculationResult[];
}
