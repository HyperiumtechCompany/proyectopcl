import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
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
        reference_lumens?: number;
        provenance?: 'manufacturer' | 'manual-curve' | 'synthetic';
    } | null;
    /**
     * Fase 14 ("Emergencia"). `'none'` nunca participa en `config.emergencyMode`
     * (en un corte real, los circuitos normales pierden alimentación — el
     * estado de escena/interruptor es irrelevante). `emergencyFlux` es dato
     * de fabricante, nunca inventado; sin él, la luminaria queda excluida
     * del cálculo de emergencia con advertencia explícita — ver
     * `runDirectPreviewEngine.ts`.
     */
    emergencyType: 'none' | 'emergency' | 'permanent';
    emergencyFlux: number | null;
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

/**
 * Caja opaca para el solver de oclusión (Fase 6, §11). Igual forma que
 * `OcclusionBox` (`domain/geometry/occlusionBoxes.ts`) más `levelId` — el
 * snapshot agrega obstáculos de todos los niveles en una sola lista plana
 * (mismo patrón que `luminaires`), así que `runDirectPreviewEngine` filtra
 * por `levelId` antes de pasarlos al motor, para no ocluir un ambiente con
 * muros de otro nivel.
 */
export interface CalculationObstacle extends OcclusionBox {
    levelId: string;
}

export interface LuminaireState {
    luminaireId: string;
    on: boolean;
    dimmingFactor: number;
}

/**
 * Modelo INICIAL de disparador de escena (Fase 10, §11: "sensores y
 * horarios como modelo inicial") — solo datos, sin motor de evaluación real
 * (`runDirectPreviewEngine` nunca lo lee para decidir qué escena aplicar;
 * la selección sigue siendo explícita vía `sceneSelectionByLevel`).
 * Duplicado deliberadamente de `hooks/types.ts` (mismo criterio que el resto
 * de este archivo, ver comentario de cabecera: el dominio no reutiliza los
 * tipos de UI/store).
 */
export type SceneTrigger =
    | { type: 'manual' }
    | { type: 'schedule'; startTime: string; endTime: string }
    | { type: 'sensor'; sensorType: 'occupancy' | 'daylight' };

/**
 * Estado de encendido/regulación de un nivel — separado de `CalculationLevel`
 * (§6.1). Desde la Fase 10, un nivel puede tener MÁS DE UNA
 * `LightingSceneState` (una por `LightingScenePreset` definido en el store);
 * `buildCalculationSnapshot` sigue generando exactamente una "Escena por
 * defecto" (todo encendido) cuando el nivel no define ningún preset — mismo
 * comportamiento que antes de esta fase, no disruptivo.
 */
export interface LightingSceneState {
    id: string;
    levelId: string;
    name: string;
    luminaireStates: LuminaireState[];
    trigger?: SceneTrigger;
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
    /** Cajas opacas para oclusión (Fase 6). Vacío para proyectos sin muros/particiones derivables o para snapshots de fases anteriores a Fase 6. */
    obstacles: CalculationObstacle[];
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
    /** Depreciación por mantenimiento, aplicada al resultado fotométrico final. */
    maintenanceFactor?: number;
    /**
     * Fase 14 ("Emergencia"). Default `undefined`/`false` — comportamiento
     * idéntico al de siempre (flujo normal, filtro de escena/interruptor
     * habitual) para todo llamador que no lo pase explícitamente. `true`
     * cambia de raíz qué luminarias participan y con qué flujo — ver
     * `runDirectPreviewEngine.ts`. No es una "escena guardada" (Fase 10):
     * es un modo de cálculo reproducible y verificable, tal como pide la
     * puerta de salida del plan maestro para esta fase.
     */
    emergencyMode?: boolean;
    glare: {
        enabled: boolean;
        /**
         * `'legacy'` (default): el `calculateUGR` heredado (observador único
         * implícito en el centro del recinto, sin índice de posición) — sin
         * cambios desde la Fase 0. `'guth-observers'` (Fase 9: "UGR y
         * luminancia profesional"): observadores reales con posición/altura/
         * dirección e índice de posición de Guth (`pending-confirmation`, ver
         * `hooks/glareCalculation.ts`).
         */
        observerModel: 'legacy' | 'guth-observers';
    };
}

/**
 * Defaults no disruptivos: `occlusion: false` e `interreflection: 'none'`
 * mantienen el comportamiento del motor `direct-preview-v1` original. Desde
 * la Fase 6, `occlusion: true` activa oclusión real. Desde la Fase 7,
 * `interreflection: 'first-bounce'` activa la primera reflexión difusa
 * usando `CalculationSnapshot.materials` (`runDirectPreviewEngine` resuelve
 * el material por `CalculationObject.materialId`). Desde la Fase 8,
 * `interreflection: 'iterative'` activa radiosidad iterativa real (múltiples
 * rebotes entre los mismos parches, hasta convergencia o `maxBounces`) —
 * `maxBounces`/`convergenceTolerance` ahora tienen efecto en ese modo
 * (`maxBounces <= 1` produce un warning: equivale a `first-bounce`, no a
 * iteración real). Si un objeto no converge dentro de `maxBounces`,
 * `runDirectPreviewEngine` advierte y usa el valor truncado, nunca lo
 * presenta como convergido. Desde la Fase 9, `glare.observerModel:
 * 'guth-observers'` activa UGR con observadores reales (posición/altura/
 * dirección + índice de posición de Guth). `glare.enabled` SIGUE sin
 * efecto (existe en el contrato desde antes de la Fase 9, pero
 * `runDirectPreviewEngine` nunca lo lee — UGR siempre se calcula sin
 * importar su valor; corrección de un comentario de la Fase 9 que
 * afirmaba, por error, que ya estaba cableado).
 */
/**
 * `observerModel: 'guth-observers'` (Fase 16, a pedido explícito del
 * usuario, con visto bueno de `chief-electrical-engineer-reviewer`):
 * verificado contra un proyecto real — el modelo `legacy` (un observador
 * fijo en el centroide, sin índice de posición) sobreestimaba UGR de forma
 * insensible a la cantidad de luminarias (≈33-34 sin importar si había 2 o
 * 3 focos), mientras DIALux evo (con método de posición real) daba valores
 * coherentes con la geometría. El agente no encontró ningún tipo de
 * recinto donde `legacy` sea preferible.
 *
 * CAVEAT que debe seguir documentado (no ocultar): `guthPositionIndex()`
 * en `glareCalculation.ts` es una forma cerrada ampliamente reproducida en
 * software de iluminación, pero sus coeficientes NO están verificados
 * letra por letra contra el texto primario de CIE 117-1995 — DIALux evo
 * documenta usar interpolación de tabla (R,T,H), no esta ecuación. Sigue
 * siendo la mejor aproximación disponible en este sistema y notablemente
 * más precisa que `legacy`, pero no se debe declarar "UGR validado
 * certificado" mientras este punto siga en `pending-confirmation`.
 */
/**
 * `interreflection: 'first-bounce'` (Fase 16, "Biblioteca de materiales"):
 * cambio de default no disruptivo. `resolveMaterialId()`
 * (`buildCalculationSnapshot.ts`) solo produce un `materialId` cuando el
 * recinto tiene `ceilingReflectance`/`wallReflectance`/`floorReflectance`
 * asignados explícitamente en la UI (`RoomSurfaceMaterialsSection.tsx`,
 * nueva en esta fase); sin esos tres campos, `materialId` es `null`,
 * `resolveSurfaceReflectances()` (`runDirectPreviewEngine.ts`) devuelve
 * `null` y no se construye ningún parche de radiosidad — resultado
 * bit-a-bit idéntico a `interreflection: 'none'`. Es decir: para todo
 * proyecto existente (ninguno tiene estos campos asignados) este cambio
 * no altera ningún resultado calculado; solo activa el solver ya
 * construido desde la Fase 7 en cuanto un usuario asigna un material.
 */
export const DEFAULT_DIRECT_PREVIEW_CONFIG: CalculationConfig = {
    mode: 'preview',
    directLight: true,
    occlusion: false,
    interreflection: 'first-bounce',
    maxBounces: 0,
    convergenceTolerance: 0,
    meshPolicy: { gridSpacingM: GRID_SPACING },
    maintenanceFactor: 0.8,
    glare: { enabled: true, observerModel: 'guth-observers' },
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
