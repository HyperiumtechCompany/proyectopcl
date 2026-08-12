/**
 * types.ts Ã¢â‚¬â€ Tipos de dominio del editor DIAlux
 *
 * Separados del store para permitir:
 *   1. Importarlos sin arrastrar la lÃƒÂ³gica del store.
 *   2. Reutilizarlos en Rust/WASM bridge y en tests.
 *   3. CompilaciÃƒÂ³n mÃƒÂ¡s rÃƒÂ¡pida (menos interdependencias).
 */

import type { NormativeStandard } from './roomLighting';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Herramientas y UI Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export type DrawTool =
    | 'select'
    | 'room'
    | 'wall'
    | 'education-wall'
    | 'window'
    | 'door'
    | 'canopy'
    | 'corridor'
    | 'stair'
    | 'evacuation-route'
    | 'antipanic-area'
    | 'partition'
    | 'structural-obstacle'
    | 'fixture'
    | 'fixture-grid'
    | 'switch'
    | 'wire'
    | 'measure'
    | 'measure-area'
    | 'pan'
    | 'calibrate'
    | 'elec-meter'
    | 'elec-main-panel'
    | 'elec-sub-panel'
    | 'elec-transfer'
    | 'elec-arrival'
    | 'elec-junction-box'
    | 'elec-earth-pit'
    | 'elec-facp'
    | 'elec-outlet-floor'
    | 'elec-outlet-initial'
    | 'elec-outlet-high-180'
    | 'elec-outlet-floor-box'
    | 'elec-outlet-waterproof'
    | 'elec-outlet-ceiling'
    | 'elec-outlet-rack'
    | 'elec-water-heater';

export type SidebarTab =
    'catalog' | 'objects' | 'properties' | 'results' | 'legend';
export type ElectricalLayerGroup =
    'cad' | 'fixtures' | 'wires' | 'switches' | 'outlets' | 'panels';
export type IsoluxMode = 'functional' | 'waves' | 'temperature';
export type AngleSnapMode =
    'smart' | 'free' | 'orthogonal' | 'diagonal' | 'fine';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ GeometrÃƒÂ­a 2D Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface ScaleConfig {
    unit: 'mm' | 'cm' | 'm';
    factor: number; // Multiply DXF units by this to get meters. (e.g. if unit is mm, factor is 0.001)
    displayUnit: string;
    calibrationFactor: number;
    isCalibrated: boolean;
}

export interface Vertex {
    x: number;
    y: number;
}

export interface AmbientConfig {
    name?: string;
    normativeStandard?: NormativeStandard;
    normativeCategory?: string;
    normativeSection?: string;
    activity?: string;
    illuminanceLux?: number;
    /**
     * Límite de UGR de ESTE sub-ambiente — mismo mecanismo que
     * `illuminanceLux` arriba: sin esto, `ugrLimit` SIEMPRE se re-deriva de
     * la actividad normativa elegida (`ambientSpaces.ts`), nunca se puede
     * fijar a mano por ambiente — a diferencia de `illuminanceLux`, que sí
     * podía sobreescribirse. Detectado 2026-08-07: un ambiente con
     * iluminancia forzada a mano (200 lx en vez de los 300 lx de su propia
     * actividad) quedaba con el límite UGR de esa MISMA actividad (22),
     * sin forma de alinear ambos de forma consistente.
     */
    ugrLimit?: number | null;
    /** Mismo mecanismo que `ugrLimit` arriba, para el objetivo de uniformidad (Uo). */
    uniformityTarget?: number | null;
    /**
     * Altura del plano útil / zona marginal de ESTE sub-ambiente — mismo
     * motivo que `outletUse` abajo: un recinto físico subdividido por
     * paredes internas (ej. "Caseta de Control" + "SS.HH" dentro de un
     * mismo `Room`) necesita que cada sub-ambiente tenga su propia altura
     * (DIALux evo, para el mismo tipo de proyecto, usa 0.6 m para un
     * vestíbulo y 1.8 m para un lavabo dentro del mismo recinto) — sin
     * esto, ambos sub-ambientes comparten `Room.usefulPlaneHeight`/
     * `marginalZone` y no hay forma de diferenciarlos.
     */
    usefulPlaneHeight?: number;
    marginalZone?: number;
    /**
     * UGR ingresado a mano para ESTE sub-ambiente — ver `Room.manualUgr`
     * para el porqué (método analítico fuera de su rango de validez
     * documentado, H/R>2). `undefined`/`null` = usar el UGR calculado.
     */
    manualUgr?: number | null;
    /**
     * Regla de tomacorrientes de ESTE sub-ambiente (delimitado por una
     * pared interna) — antes vivían como `Room.outletUse`/`outletDeviceType`/
     * `outletStartOffset`, campos únicos del recinto físico compartidos por
     * TODOS sus sub-ambientes (ej. "Baño" y "Guarderías" leían/escribían el
     * mismo valor), así que cambiar la regla de uno pisaba silenciosamente
     * la del otro aunque los tomacorrientes GENERADOS ya estuvieran
     * separados por ambiente.
     */
    outletUse?: 'aula' | 'comedor' | 'exterior' | 'none';
    outletDeviceType?: ElectricalDeviceType;
    outletStartOffset?: number;
    /**
     * Id de la pared que delimita ESTE sub-ambiente — ancla la clave
     * `ambientConfigs['ambient-N']` a una pared concreta en vez de a un
     * orden por área. Sin esto, `buildWallDefinedAmbientSpaces` asigna
     * `ambient-N` por tamaño de región (mayor a menor); si la geometría
     * cambia de forma que el orden de tamaño entre dos sub-ambientes se
     * invierte, la configuración de un ambiente nombrado por el usuario
     * (altura de plano útil, normativa) queda aplicada a la pared
     * equivocada, en silencio. Se escribe la primera vez que se guarda algo
     * de este sub-ambiente (`WallProps.tsx`) — auto-sana configs viejas sin
     * este campo la próxima vez que se editen, sin script de migración.
     */
    wallId?: string;
}

export type CorridorType =
    | 'roof_only'
    | 'normal'
    | 'roof_floor'
    | 'concrete_railings'
    | 'metal_railings'
    /** Bereda / rampa inclinada (pendiente configurable) */
    | 'ramp'
    /** Vereda plana (sin techo, sin barandas) */
    | 'sidewalk';

export interface CorridorConfig {
    type?: CorridorType;
    slabThickness?: number;
    railingHeight?: number;
    /**
     * Pendiente de la rampa en porcentaje (solo para type === 'ramp').
     * RNE permite mÃƒÂ¡ximo 12% para discapacitados. Default 8%.
     */
    rampSlope?: number;
    /**
     * DirecciÃƒÂ³n de flujo principal (ingreso/salida).
     * Determina en quÃƒÂ© bordes se hacen los huecos virtuales.
     * Default: 'north' (hacia -Y en el plano).
     */
    direction?: 'north' | 'south' | 'east' | 'west';
    /**
     * Alias usado en algunos componentes y renderers para rampas.
     * Se mantiene por compatibilidad con plantillas existentes.
     */
    rampDirection?: 'north' | 'south' | 'east' | 'west';
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Escaleras Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * Tramo de escalera dentro de una caja de escalera.
 * Un tramo es la secuencia de escalones entre dos descansos (o entre el
 * arranque y el primer descanso / entre el ÃƒÂºltimo descanso y el destino).
 */
export interface StairFlight {
    id: string;
    /** Cantidad de escalones en este tramo */
    stepCount: number;
    /**
     * DirecciÃƒÂ³n de ascenso de este tramo vista desde arriba:
     *   'north' = hacia Y negativo, 'south' = hacia Y positivo
     *   'east'  = hacia X positivo, 'west'  = hacia X negativo
     */
    direction: 'north' | 'south' | 'east' | 'west';
    /** Si hay descanso (plataforma de giro) despuÃƒÂ©s de este tramo */
    hasLanding: boolean;
    /** Profundidad del descanso en metros (default 1.20 Ã¢â‚¬â€ RNE mÃƒÂ­nimo) */
    landingDepth: number;
}

/**
 * ConfiguraciÃƒÂ³n completa de una escalera (solo cuando roomType === 'stair').
 * Sigue la normativa RNE del PerÃƒÂº (A.010 vivienda / A.040 educaciÃƒÂ³n).
 */
export interface StairConfig {
    /**
     * Uso normativo que define los rangos permitidos:
     *   'education' Ã¢â€ â€™ RNE A.040: contrah. Ã¢â€°Â¤0.17m, huella Ã¢â€°Â¥0.30m, ancho Ã¢â€°Â¥1.20m
     *   'housing'   Ã¢â€ â€™ RNE A.010: contrah. Ã¢â€°Â¤0.175m, huella Ã¢â€°Â¥0.28m, ancho Ã¢â€°Â¥0.90m
     *   'generic'   Ã¢â€ â€™ Sin restricciones normativas especÃƒÂ­ficas
     */
    normativeUse: 'education' | 'housing' | 'generic';
    /** DirecciÃƒÂ³n principal de ascenso (primer tramo) */
    orientation: 'north' | 'south' | 'east' | 'west';
    /** Altura de contrahuella en metros (cada escalÃƒÂ³n) */
    riserHeight: number;
    /** Profundidad de huella en metros (cada escalÃƒÂ³n) */
    treadDepth: number;
    /** Ancho ÃƒÂºtil de paso en metros */
    stairWidth: number;
    /** SeparaciÃƒÂ³n libre entre tramos paralelos en metros. 0 = tramos pegados. */
    flightGap?: number;
    /** Muestra barandas/pasamanos en el render 3D. Default false por ahora. */
    showRailings?: boolean;
    /**
     * Cantidad total de escalones (suma de todos los tramos).
     * En escaleras simples (1 tramo, sin flights), este campo gobierna.
     * En escaleras con flights, se calcula sumando flight.stepCount.
     */
    stepCount: number;
    /**
     * Tramos de escalera. Una escalera directa = 1 tramo sin landing.
     * Escalera con descanso = [tramo1 (hasLanding=true), tramo2 (hasLanding=false)].
     * Escalera multi-piso puede tener N tramos.
     */
    flights: StairFlight[];
    /**
     * ID opcional de un Room existente que actÃƒÂºa como Hall/Descanso
     * cuando el descanso es un espacio arquitectÃƒÂ³nico completo con
     * puertas, ventanas u otra geometrÃƒÂ­a (caso C del plan).
     */
    linkedHallId?: string;
    /**
     * ElevaciÃƒÂ³n de arranque en metros (default 0).
     * ÃƒÅ¡salo cuando esta escalera es la segunda mitad de una escalera en U:
     * la Escalera 2 debe arrancar desde la altura del descanso
     * (ej. 1.75 m si la Escalera 1 tiene 10 escalones Ã— 0.175 m).
     */
    startElevation?: number;
    /**
     * Si true (default), la escalera tiene una losa/base sÃƒÂ³lida bajo los escalones.
     * Usar true para escaleras entre pisos (la losa del siguiente piso cubre la cima).
     * Usar false para escaleras simples dentro de un mismo nivel (sin losa superior).
     */
    hasBaseSlab?: boolean;
    /**
     * Si true, esta escalera conecta con el piso superior del proyecto.
     * Afecta cÃƒÂ³mo se calcula la altura mÃƒÂ¡xima en resolveSceneStackHeight:
     * no contribuye a la elevaciÃƒÂ³n del siguiente piso (la escalera es un objeto
     * dentro del piso, no define su altura).
     */
    isInterFloor?: boolean;
}

/** Recinto (espacio cerrado con polÃƒÂ­gono arbitrario) */
/**
 * Elemento estructural u obstaculo que restringe la instalacion de luminarias
 * en el plano de montaje del techo (columna, viga, ducto suspendido, zona
 * restringida). Vive a nivel de Scene (piso), no de Room: una columna puede
 * atravesar mas de un ambiente en el mismo plano DXF, igual que en DIALux evo.
 *
 * `fixtureGrid.ts` / `geometry/ceilingProjection.ts` restan estos poligonos
 * del area de cada Room antes de repartir la grilla de luminarias.
 */
export interface StructuralObstacle {
    id: string;
    name: string;
    obstacleType: 'column' | 'beam' | 'restricted_area' | 'roof' | 'ceiling' | 'ramp';
    /** Poligono 2D (footprint) en metros, mismo sistema de coordenadas que Room.vertices */
    vertices: Vertex[];
    /** Altura del obstaculo en metros, medida desde `elevation` */
    height: number;
    /** Elevacion desde el piso del nivel en metros (0 = apoyado en el piso; >0 = viga/ducto suspendido) */
    elevation: number;
    /** Configuración geométrica de cubiertas y cielorrasos. */
    roofType?: 'flat' | 'shed' | 'gable' | 'mansard' | 'hip' | 'butterfly' | 'full' | 'custom' | 'cove' | 'stepped';
    eaveHeight?: number;
    ridgeHeight?: number;
    slopePercent?: number;
    orientationDeg?: number;
    thickness?: number;
    material?: string;
    interiorReflectance?: number;
    exteriorReflectance?: number;
    overhang?: number;
    centralOpening?: number;
    /** Configuración de una superficie inclinada transitable. */
    rampType?: 'pedestrian' | 'vehicular' | 'transition';
    startLevel?: number;
    endLevel?: number;
    width?: number;
    length?: number;
    hasLandings?: boolean;
    calculationSurfaceEnabled?: boolean;
    targetLux?: number;
    uniformityTarget?: number;
}

export interface Room {
    id: string;
    name: string;
    /**
     * `GlobalId` STEP del `IfcSpace` de origen (Fase 19: "BIM/IFC" — importar
     * y mapear estructura espacial). `undefined` para todo recinto creado a
     * mano en el editor o importado antes de esta fase — nunca se fabrica un
     * valor. Permite, en un ciclo posterior, reconciliar qué `Room` de este
     * editor corresponde a cuál `IfcSpace` del archivo original al reimportar.
     */
    ifcGlobalId?: string;
    /**
     * Categoría del espacio:
     *   'room'             → Recinto (envolvente exterior del edificio, sin iluminación propia)
     *   'ambient'          → Ambiente interior (espacio habitable con iluminación/normativa)
     *   'corridor'         → Pasadizo (ambiente con configuración propia)
     *   'stair'            → Escalera
     *   'evacuation-route' → Fase 14: medio de evacuación — se evalúa contra
     *                        RNE A.130 (10 lx, obligatoria) y, como referencia
     *                        complementaria opcional, EN 1838 (1 lx eje, 40:1,
     *                        curva de respuesta) — ver `hooks/emergencyCompliance.ts`.
     *                        Reutiliza el motor de grilla existente (Room
     *                        poligonal), no hay geometría de ruta/polilínea
     *                        propia todavía.
     *   'antipanic-area'   → Fase 14: área antipánico (EN 1838 únicamente,
     *                        0.5 lx — RNE A.130 no define esta categoría).
     */
    roomType?:
        | 'room'
        | 'ambient'
        | 'corridor'
        | 'stair'
        | 'evacuation-route'
        | 'antipanic-area';
    /** Polígono arbitrario en metros en el plano XY de la escena */
    vertices: Vertex[];
    height: number; // metros
    color: string;
    illuminanceLux?: number;
    fixtureLumens?: number;
    normativeStandard?: NormativeStandard;
    normativeCategory?: string;
    normativeSection?: string;
    normativeActivity?: string;
    normativeLabel?: string;
    ugrLimit?: number | null;
    uniformityTarget?: number | null;
    colorRenderingRa?: number | null;
    specificRequirements?: string | null;
    usefulPlaneHeight?: number | null;
    marginalZone?: number | null;
    /**
     * UGR cargado a mano, en vez del calculado por `glareCalculation.ts`.
     * El método analítico de posición de Guth solo es válido para H/R≤2
     * (documentado por el propio soporte de DIALux evo) — en recintos
     * chicos con montaje alto, TODAS las luminarias pueden caer fuera de
     * ese rango y el motor no tiene nada que evaluar (`ugr_not_evaluated`).
     * DIALux evo resuelve ese mismo caso con su método tabular (tablas CIE
     * 117 del fabricante), que esta plataforma no reproduce por falta de
     * esos datos — este campo es la vía honesta para declarar el UGR de
     * referencia sin fingir que se calculó por este motor. `null`/`undefined`
     * = usar el valor calculado tal cual (comportamiento por defecto).
     */
    manualUgr?: number | null;
    norma?: number; // Nivel de lux requerido (EN 12464-1)
    fixtureFlux?: number; // LÃƒÂºmenes de la luminaria seleccionada (cÃƒÂ¡lculo teÃƒÂ³rico)
    /** Regla usada para calcular automáticamente los tomacorrientes. */
    outletUse?: 'aula' | 'comedor' | 'exterior' | 'none';
    /** Variante/altura aplicada a los tomacorrientes autogenerados. */
    outletDeviceType?: ElectricalDeviceType;
    /** Distancia en metros desde el primer vértice para iniciar la distribución. */
    outletStartOffset?: number;
    ambientConfigs?: Record<string, AmbientConfig>;
    corridorConfig?: CorridorConfig;
    /** ConfiguraciÃƒÂ³n de escalera (solo cuando roomType === 'stair') */
    stairConfig?: StairConfig;
    /** Material de construcciÃƒÂ³n de la envolvente del recinto (para cÃƒÂ¡lculo de muros) */
    material?: 'brick' | 'adobe';
    /** Uso normativo del recinto (vivienda / educaciÃƒÂ³n / genÃƒÂ©rico) */
    normativeUse?: 'housing' | 'education' | 'generic';
    /** Reflectancias de superficies (0-1) para el cálculo dinámico del factor de utilización. Defaults típicos: techo 0.7, pared 0.5, piso 0.2. */
    ceilingReflectance?: number | null;
    wallReflectance?: number | null;
    floorReflectance?: number | null;
}

/** ConfiguraciÃƒÂ³n normativa del proyecto (sincronizada con backend) */
export interface ProjectNormativeConfig {
    dialuxProjectId: string;
    countryCode: string; // ISO 3166-1 alpha-2
    region: 'europe' | 'americas_usa' | 'americas_peru';
    installationType: string | null;
    primaryStandard: NormativeStandard;
    referenceStandards: NormativeStandard[];
    priorityOrder: string[];
    autoDetectEnabled: boolean;
    crossNormComparisonEnabled: boolean;
    normativeVersion: string | null;
    normsConsultedAt: string | null;
    disclaimer: string | null;
    notes: string | null;
    /** Resumen del ÃƒÂºltimo cÃƒÂ¡lculo de cumplimiento */
    complianceSummary: {
        totalRooms: number;
        compliantRooms: number;
        nonCompliantRooms: number;
        warningRooms: number;
        needsReviewRooms: number;
    };
}

/** Pared: polilÃƒÂ­nea en planta */
export interface Wall {
    id: string;
    vertices: Vertex[]; // Ã¢â€°Â¥ 2 puntos, en metros
    thickness: number; // metros (default 0.20)
    height: number; // metros (default 2.80)
    material?: 'brick' | 'adobe';
    normativeUse?: 'housing' | 'education' | 'generic';
    mortarJointMin?: number;
    mortarJointMax?: number;
    /**
     * Tipo de muro:
     *   'interior' Ã¢â€ â€™ tabique interior (default)
     *   'exterior' Ã¢â€ â€™ muro perimetral del edificio
     *   'cerco'    Ã¢â€ â€™ cerco perimÃƒÂ©trico exterior (columnas + panel)
     */
    wallType?: 'interior' | 'exterior' | 'cerco';
    /**
     * Espaciado entre columnas/postes del cerco en metros (solo para wallType === 'cerco').
     * Default 3.0 m (tÃƒÂ­pico RNE para cerco de ladrillo con columnas).
     */
    postSpacing?: number;
    /** Configuración de iluminación para paredes interiores */
    illuminanceLux?: number;
    normativeStandard?: NormativeStandard;
    normativeCategory?: string;
    normativeSection?: string;
    normativeActivity?: string;
    fixtureLumens?: number;
    fixtureType?:
        | 'recessed'
        | 'surface'
        | 'pendant'
        | 'spot'
        | 'strip'
        | 'panel'
        | 'tube';
    fixtureShape?: 'round' | 'square' | 'rectangular' | 'cylindrical';
}

/** Ventana colocada sobre una pared */
export interface Window {
    id: string;
    wallId: string;
    offsetAlongWall: number; // metros desde el inicio de la pared
    width: number; // metros
    height: number; // metros
    sillHeight: number; // altura del antepecho en metros (default 0.90)
    windowType?: 'fixed' | 'sliding' | 'casement' | 'awning' | 'bathroom';
    windowShape?: 'rectangular' | 'arched' | 'circular';
    /** Si true, el offset se recalcula automÃƒÂ¡ticamente al centro de la pared */
    centered?: boolean;
    /**
     * Transmitancia luminosa del vidrio (0-1, Fase 17: "Luz natural" —
     * Daylight Factor). `null`/`undefined` (default) significa "sin vidrio
     * asignado" — `daylightFactorEngine.ts` NUNCA inventa un valor típico en
     * su lugar, la ventana simplemente no aporta luz natural hasta que se
     * asigne uno (mismo criterio que `Room.ceilingReflectance` en la Fase 16).
     */
    glazingTransmittance?: number | null;
}

/** Puerta colocada sobre una pared o particiÃƒÂ³n */
export interface Door {
    id: string;
    wallId: string;
    offsetAlongWall: number; // metros desde el inicio de la pared
    width: number; // metros (default 0.90)
    height: number; // metros (default 2.10)
    /**
     * Tipo de puerta:
     *   'single'   Ã¢â€ â€™ puerta sencilla batiente (default)
     *   'double'   Ã¢â€ â€™ doble hoja
     *   'sliding'  Ã¢â€ â€™ corredera
     *   'folding'  Ã¢â€ â€™ plegable
     *   'bathroom' Ã¢â€ â€™ puerta de cubÃƒÂ­culo SS.HH (ancho 0.60-0.70m, gap inferior 0.15m)
     *   'opening'  Ã¢â€ â€™ solo vano (hueco sin panel ni marco)
     */
    doorType?:
        'single' | 'double' | 'sliding' | 'folding' | 'bathroom' | 'opening';
    openingDirection?: 'inward' | 'outward';
    /** Lado donde estÃƒÂ¡ la bisagra: 'left' = inicio de la pared, 'right' = fin */
    hingeDirection?: 'left' | 'right';
    openingAngle?: number; // grados (default 90)
    /** Si true, el offset se recalcula automÃƒÂ¡ticamente al centro de la pared */
    centered?: boolean;
    /**
     * ID de la particiÃƒÂ³n donde estÃƒÂ¡ colocada la puerta.
     * Mutuamente excluyente con wallId (se usa uno u otro).
     */
    partitionId?: string;
    /**
     * Espacio libre en la parte inferior (metros).
     * Para 'bathroom': 0.15m. Para el resto: 0.
     */
    bottomGap?: number;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Particiones (Separadores SS.HH, Drywall, etc.) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * ParticiÃƒÂ³n ligera: tabique que no es una pared estructural.
 * Casos de uso:
 *   - CubÃƒÂ­culos de SS.HH (melamina/plÃƒÂ¡stico, altura parcial)
 *   - Tabiques de drywall (piso-techo)
 *   - Mamparas de vidrio
 */
export interface Partition {
    id: string;
    /** PolilÃƒÂ­nea que define la lÃƒÂ­nea central de la particiÃƒÂ³n (Ã¢â€°Â¥2 puntos, metros) */
    vertices: Vertex[];
    /** Grosor del tabique en metros */
    thickness: number;
    /** Altura total del tabique en metros */
    height: number;
    /**
     * Material / tipo constructivo:
     *   'melamine' Ã¢â€ â€™ melamina o PVC, grosor tÃƒÂ­pico 0.018-0.025m
     *   'drywall'  Ã¢â€ â€™ yeso-cartÃƒÂ³n, grosor tÃƒÂ­pico 0.10-0.15m
     *   'glass'    Ã¢â€ â€™ mampara de vidrio
     *   'masonry'  Ã¢â€ â€™ tabique de ladrillo ligero
     */
    partitionType: 'melamine' | 'drywall' | 'glass' | 'masonry';
    /**
     * Si true, la particiÃƒÂ³n NO llega al techo (ej: cubÃƒÂ­culo de baÃƒÂ±o).
     * La altura efectiva estÃƒÂ¡ dada por `height`.
     */
    isPartialHeight: boolean;
    /**
     * Espacio libre desde el suelo hasta el inicio del tabique (metros).
     * 0 en la mayorÃƒÂ­a de casos; 0.10-0.15 en cubÃƒÂ­culos de baÃƒÂ±o con soporte.
     */
    bottomGap: number;
}

/** Voladizo / alero */
export interface Canopy {
    id: string;
    x1: number;
    y1: number; // punto de anclaje al muro (metros)
    x2: number;
    y2: number; // extremo libre (metros)
    width: number; // anchura a lo largo del muro (metros)
    slabThickness: number; // grosor de losa (metros, default 0.15)
    height: number; // altura de montaje desde el suelo (metros)
}

/** Luminaria */
export interface Fixture {
    id: string;
    name: string;
    x: number;
    y: number;
    z: number; // posiciÃƒÂ³n en metros en la escena
    lumens: number;
    power?: number;
    efficiency: number; // 0-1, factor de aprovechamiento
    fixtureType:
        | 'recessed'
        | 'pendant'
        | 'surface'
        | 'spot'
        | 'strip'
        | 'panel'
        | 'tube';
    fixtureShape?: 'round' | 'square' | 'rectangular' | 'cylindrical';
    /** radius: solo para fixtureShape 'round'/'cylindrical' — diámetro real
     * del producto. Cuando está presente tiene prioridad sobre length/width
     * al dibujar el símbolo en 2D (ver OverlayFixtures.getScreenHalfDims). */
    dimensions?: {
        length: number;
        width: number;
        height: number;
        radius?: number;
    }; // En metros
    brand?: string;
    articleNumber?: string;
    productId?: number;
    productSourceFormat?: string;
    lightColor: string; // hex, e.g. '#fff5e1' blanco cÃƒÂ¡lido
    wallId?: string; // opcional: ID de la pared donde estÃƒÂ¡ colocada (para drag/drop)
    roomId?: string; // opcional: ID del recinto al que pertenece
    gridGroupId?: string; // opcional: ID de grupo de grilla para conectar visualmente
    /**
     * Filas/columnas con las que se genero (o reorganizo por ultima vez) el
     * grupo de grilla al que pertenece esta luminaria -- redundante por
     * fixture (igual que gridGroupId), usado por el asesor de simetria entre
     * modulos (ver hooks/fixtureGridSymmetry.ts) para saber la forma de cada
     * grupo sin tener que inferirla de las posiciones.
     */
    gridRows?: number;
    gridColumns?: number;
    cct?: number | null;
    cri?: number | null;
    description?: string | null;
    applications?: string | null;
    reportData?: {
        technical_table?: Array<{ label: string; value: string }>;
        warnings?: string[];
        /**
         * Tabla de referencia UGR calculada por el motor propio (Fase 15,
         * Parte B) sobre un subconjunto acotado de salas normalizadas —
         * NUNCA una reproducción certificada de la tabla CIE 117 publicada.
         * Ver `export/derived/data/computeEngineUgrTable.ts`.
         */
        ugrTableComputed?: {
            provenance: 'manufacturer' | 'engine-calculated';
            method: string;
            disclaimer: string;
            shr: number;
            reflectances: { ceiling: number; wall: number; floor: number };
            entries: Array<{
                roomLabel: string;
                ugrCrosswise: number | null;
                ugrEndwise: number | null;
            }>;
        } | null;
    } | null;
    reportAssets?: {
        polar_svg?: string | null;
        product_photo_url?: string | null;
        brand_logo_url?: string | null;
    } | null;
    ugrTable?: number[][] | null;
    ugrDiagramValue?: string | null;
    /** Matriz fotométrica real (IES/LDT) para cálculo punto-por-punto. Si falta, se usa un modelo Lambertiano aproximado. */
    photometricWeb?: {
        c_angles: number[];
        gamma_angles: number[];
        candela: number[][];
        /** Flujo original con el que se expresaron las candelas; permite escalar la curva al editar lúmenes. */
        reference_lumens?: number;
        /**
         * Origen del dato (Fase 3 del plan maestro — nunca debe poder
         * confundirse una aproximación con fotometría real de fabricante):
         *   'manufacturer' → archivo IES/LDT del fabricante.
         *   'manual-curve' → curva punto a punto ingresada a mano por el usuario.
         *   'synthetic'    → modelo coseno^n derivado solo del ángulo de apertura.
         * Ausente = dato legacy anterior a esta fase, tratar como desconocido,
         * nunca asumir 'manufacturer' por defecto.
         */
        provenance?: 'manufacturer' | 'manual-curve' | 'synthetic';
        /** Código de simetría EULUMDAT (0-4) cuando el origen es un LDT. No se expande la matriz según este código todavía (Fase 3, fuera de alcance). */
        symmetry?: number;
        /** Tabla de tilt de un IES con TILT=INCLUDE. Registrada para trazabilidad; el multiplicador por ángulo aún no se aplica al cálculo. */
        tilt?: {
            lamp_to_luminaire_geometry: number;
            angles: number[];
            multipliers: number[];
        } | null;
    } | null;
    polarDiagramAssetId?: string | null;
    productPhotoAssetId?: string | null;
    brandLogoAssetId?: string | null;
    lineDrawingAssetId?: string | null;
    // Ã¢â€ â‚¬Ã¢â€ â‚¬ Campos del catÃƒÂ¡logo real Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬
    mountingHeight?: number; // Altura de montaje S.N.P.T. en metros (ej: 3.50)
    ip?: string; // Grado de protecciÃƒÂ³n (ej: "IP20", "IP65")
    ik?: string; // Resistencia a impacto (ej: "IK02", "IK07")
    /** SÃƒÂ­mbolo CAD asociado: 'rect_red'|'rect_green'|'rect_white'|'circle_black'|'circle_magenta'|'spot_yellow'|'spot_orange'|'emergency'|'emergency_perm' */
    catalogSymbol?: string;
    emergencyType?: 'none' | 'emergency' | 'permanent';
    /**
     * Flujo luminoso (lúmenes) que emite ESTA luminaria en modo emergencia —
     * Fase 14 del plan maestro ("Emergencia"). Dato de fabricante (kit de
     * batería autónomo o alimentación centralizada), NUNCA un porcentaje
     * inventado del flujo normal: no existe una fórmula normativa (ni EN
     * 1838 ni RNE A.130) que defina esa relación — verificado por
     * `chief-electrical-engineer-reviewer`. Solo tiene efecto cuando
     * `emergencyType !== 'none'`; sin este dato, la luminaria queda
     * excluida del cálculo de emergencia con una advertencia explícita
     * (`domain/calculation/runDirectPreviewEngine.ts`), nunca sustituida
     * por el flujo normal.
     */
    emergencyFlux?: number | null;
    /** Rotación en planta, grados sentido horario (0-360). Default 0. */
    rotation?: number;
}

/** Interruptor de luz */
export interface LightSwitch {
    id: string;
    x: number;
    y: number;
    mountingHeight: number; // Altura de montaje en metros (default 1.40m)
    type: 'single' | 'double' | 'triple' | 'two-way'; // Simple, Doble, Triple, Conmutado
    wallId?: string; // Pared donde estÃƒÂ¡ colocado
    connectedFixtureIds: string[]; // Luminarias controladas
    label?: string; // Etiqueta visible: "S(a)", "Sc(a)", "2S(a)", etc.
    /** Rotación en planta, grados sentido horario (0-360). Default 0. */
    rotation?: number;
    /** Factor visual del símbolo 2D. 1 = tamaño CAD base calibrado. */
    symbolScale?: number;
}

/** Conductor eléctrico punto a punto */
export interface Conductor {
    id: string;
    sourceId: string; // ID origen (Interruptor, Tablero o Luminaria)
    targetId: string; // ID destino (Luminaria o Interruptor)
    circuitGroupId?: string; // ID para agrupar cables de una misma tirada
    wireCount: number; // Número de conductores (2, 3, 4)
    wireLabel?: string; // Etiqueta visible: F+N+T, 2F+T, 3F, etc.
    routeType: 'floor' | 'wall_ceiling'; // Empotrado en piso o pared/techo
    /** Altura de la ruta horizontal S.N.P.T. en m. Ausente = techo real del recinto. */
      routeHeightM?: number;
      /** Punto editable situado sobre el centro visual del arco en planta. */
      curveMidpoint?: { x: number; y: number };
    tubeSize: number; // Diámetro de tubería en mm (20mm default)
    conductorType: string; // Tipo: "Cu LSOH", "N2XOH", etc.
    /** Sección real del cable en mm² (calibre/diámetro del conductor, no del tubo). 2.5mm² default. */
    sectionMm2: number;
    /** Parámetros editables del cálculo CT para la salida raíz del circuito. */
    ct?: {
        outletPowerW?: number;
        forcePowerW?: number;
        powerFactor?: number;
        demandFactor?: number;
        system?: 1 | 3;
        phaseBalance?: 'R' | 'S' | 'T' | 'RST' | 'RS' | 'ST' | 'TR';
        nominalCableCurrentA?: number;
        ambientTemperatureC?: number;
        copperResistivity?: number;
        groupedCircuitCount?: number;
        groupingFactor?: number;
        temperatureFactor?: number;
        itm?: string;
        dif?: string;
        voltageDropLimitPct?: number;
        earthSectionMm2?: number;
    };
    waypoints: Array<{ x: number; y: number }>; // Puntos de ruta opcionales
}

/**
 * Secciones de cable estándar (cobre, referencia AWG) para casas, colegios y
 * zona industrial. La sección real se guarda en mm²; el AWG es solo referencia.
 */
export const CONDUCTOR_SECTION_OPTIONS = [
    { value: 2.5, label: '2.5 mm² (AWG 14)' },
    { value: 4, label: '4 mm² (AWG 12)' },
    { value: 6, label: '6 mm² (AWG 10)' },
    { value: 10, label: '10 mm² (AWG 8)' },
    { value: 16, label: '16 mm² (AWG 6)' },
    { value: 25, label: '25 mm² (AWG 4)' },
    { value: 35, label: '35 mm² (AWG 2)' },
    { value: 50, label: '50 mm² (AWG 1/0)' },
    { value: 70, label: '70 mm² (AWG 2/0)' },
    { value: 95, label: '95 mm² (AWG 3/0)' },
    { value: 120, label: '120 mm² (AWG 4/0)' },
    { value: 150, label: '150 mm²' },
    { value: 185, label: '185 mm²' },
    { value: 240, label: '240 mm²' },
    { value: 300, label: '300 mm²' },
] as const;

export const CONDUCTOR_WIRE_OPTIONS = [
    { value: 'F+N+T', label: 'F+N+T', count: 3 },
    { value: '2F+N+T', label: '2F+N+T', count: 4 },
    { value: '2F+2N+T', label: '2F+2N+T', count: 5 },
    { value: '3F+N+T', label: '3F+N+T', count: 5 },
    { value: '4F+N+T', label: '4F+N+T', count: 6 },
    { value: '5F+N+T', label: '5F+N+T', count: 7 },
    { value: '6F+N+T', label: '6F+N+T', count: 8 },
    { value: 'F+T', label: 'F+T', count: 2 },
    { value: '2F+T', label: '2F+T', count: 3 },
    { value: '3F+T', label: '3F+T', count: 4 },
    { value: '4F+T', label: '4F+T', count: 5 },
    { value: '5F+T', label: '5F+T', count: 6 },
    { value: '6F+T', label: '6F+T', count: 7 },
    { value: '2F', label: '2F', count: 2 },
    { value: '3F', label: '3F', count: 3 },
    { value: '4F', label: '4F', count: 4 },
    { value: '6F', label: '6F', count: 6 },
] as const;

// Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬ Dispositivos ElÃƒÂ©ctricos Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬

/**
 * Tipo de dispositivo elÃƒÂ©ctrico insertable en plano.
 * Cada tipo tiene su propia simbologÃƒÂ­a CAD y defaults de montaje.
 */
export type ElectricalDeviceType =
    | 'meter'
    | 'main_panel'
    | 'sub_panel'
    | 'transfer_switch'
    | 'arrival_panel'
    | 'junction_box'
    | 'earth_pit'
    | 'facp'
    | 'outlet_floor'
    | 'outlet_initial'
    | 'outlet_high_180'
    | 'outlet_floor_box'
    | 'outlet_waterproof'
    | 'outlet_ceiling'
    | 'outlet_rack'
    | 'water_heater_30l';

/** Propiedades tecnicas especificas de cada dispositivo */
export interface ElectricalDeviceProperties {
    /** Tablero aguas arriba, incluso si está ubicado en otra escena/piso. */
    upstreamPanelId?: string;
    /** Función dentro del árbol eléctrico global. */
    panelRole?: 'service' | 'main' | 'distribution' | 'sub_distribution';
    /** Ámbito lógico; un tablero de proyecto no se duplica con un piso. */
    panelScope?: 'project' | 'module' | 'floor';
    /** Ubicación funcional, independiente de la escena usada para dibujarlo. */
    panelLocation?: 'external' | 'internal';
    voltage?: string;
    phases?: string;
    /** Longitud de referencia asignada al tablero, en metros. */
    lengthM?: number;
    /** Longitud horizontal (opcional) */
    horizontalLengthM?: number;
    /** Longitud vertical (opcional) */
    verticalLengthM?: number;
    designFactor?: number;
    connectionType?: 'delta' | 'star';
    workingTemperatureC?: number;
    /** Temperatura ambiente para K2; independiente de la temperatura de trabajo usada en ρCuT. */
    ambientTemperatureC?: number;
    copperResistivity?: number;
    upstreamVoltageDropV?: number;
    defaultPowerFactor?: number;
    defaultDemandFactor?: number;
    phaseBalance?: 'R' | 'S' | 'T' | 'RST' | 'RS' | 'ST' | 'TR';
    groupedCircuitCount?: number;
    groupingFactor?: number;
    temperatureFactor?: number;
    boxSize?: string;
    boxMaterial?: string;
    circuitCount?: number;
    current?: string;
    breakerType?: string;
    /** Sección del cable alimentador que llega a este tablero (usado si es un tablero raíz sin padre) */
    sectionMm2?: number;
    /** Sección del cable de tierra que llega a este tablero */
    earthSectionMm2?: number;
    /** Tipo de conductor del cable alimentador (ej. THW-90, N2X0H) */
    wireType?: string;
    /** Diámetro del tubo del alimentador en mm */
    tubeDiameterMm?: number;
    /** Interruptor termomagnético del alimentador, según lista del Excel. */
    itm?: string;
    /** Interruptor diferencial del alimentador, según lista del Excel. */
    dif?: string;
    /** Potencia asignada en vatios (solo dispositivos `outlet_*`), usada en Cálculo CT como PI tomas. */
    ratedPowerW?: number;
    /** ID del producto del catálogo de tomacorrientes (`outlet_products`) usado al colocar este dispositivo. */
    outletProductId?: number;
    /** Marca del producto de catálogo (tomacorrientes/equipos), informativo. */
    manufacturer?: string;
    /** Código/modelo del producto de catálogo, informativo. */
    catalogNumber?: string;
}

/** Carga por defecto (VA) de un punto de tomacorriente, igual al usado en el Módulo Eléctrico analítico. */
export const DEFAULT_OUTLET_POWER_W = 180;

/** true si el tipo de dispositivo es un punto de tomacorriente (cualquier variante de montaje). */
export function isOutletDeviceType(type: ElectricalDeviceType): boolean {
    return type.startsWith('outlet_');
}

/** Dispositivo electrico colocado en el plano 2D */
export interface ElectricalDevice {
    id: string;
    type: ElectricalDeviceType;
    x: number;
    y: number;
    label: string;
    mountingHeight: number;
    /** Pared física contra la que el dispositivo se ORIENTA/PEGA en 2D/3D (`House3DBuilder.buildElectricalDevice`) — NO usar para agrupar tomacorrientes por ambiente, ver `ambientId`. */
    wallId?: string;
    /** Ambiente propietario — el recinto que contenía el punto (x, y) al colocar el dispositivo (manual o generado por regla). */
    roomId?: string;
    /**
     * Sub-ambiente (delimitado por una pared interna) al que pertenece este
     * tomacorriente AUTO-GENERADO — distingue "Baño" de "Guarderías" cuando
     * ambos comparten el mismo `roomId` físico. Independiente de `wallId`:
     * los tomacorrientes se reparten por TODO el perímetro del ambiente
     * (`distributeOutletsOnPerimeter`), no solo contra la pared que lo
     * delimita, así que no puede reutilizarse `wallId` para esto sin romper
     * la orientación 3D contra la pared real más cercana.
     */
    ambientId?: string;
    generatedBy?: 'outlet-rule' | 'analytic-circuit';
    /**
     * ID del `Panel` del Módulo Eléctrico analítico (`electrical/engine/types.ts`)
     * que este tablero/dispositivo representa en el plano. Puente MANUAL y
     * puntual (el usuario ubica el símbolo con "Ubicar en plano" desde
     * `PanelsTab`) -- el módulo analítico no tiene geometría propia, así que
     * esto NO se auto-genera ni se sincroniza en vivo; ver
     * `dialux-two-electrical-systems` en memoria del proyecto.
     */
    linkedAnalyticPanelId?: string;
    /**
     * ID del `Circuit` analítico cuyo conteo de tomacorrientes generó este
     * dispositivo (junto con `generatedBy: 'analytic-circuit'`). Permite
     * regenerar/borrar el grupo de forma idempotente, igual que
     * `generatedBy: 'outlet-rule'` ya hace con `roomId`+`ambientId`.
     */
    linkedCircuitId?: string;
    connectedDeviceIds: string[];
    connectedFixtureIds?: string[];
    connectedSwitchIds?: string[];
    /** Rotación en planta, grados sentido horario (0-360). Default 0. */
    rotation?: number;
    properties: ElectricalDeviceProperties;
    wireProps?: Record<
        string,
        {
            wireCount: number;
            wireLabel?: string;
            routeType: 'floor' | 'wall_ceiling';
            tubeSize: number;
            conductorType: string;
            /** Sección real del cable en mm² (calibre/diámetro del conductor, no del tubo). 2.5mm² default. */
            sectionMm2: number;
        }
    >;
}

/** Defaults de montaje y label por tipo de dispositivo */
export const ELECTRICAL_DEVICE_DEFAULTS: Record<
    ElectricalDeviceType,
    {
        label: string;
        mountingHeight: number;
        properties: ElectricalDeviceProperties;
    }
> = {
    meter: {
        label: 'Medidor',
        mountingHeight: 1.2,
        properties: {
            voltage: '220V',
            phases: '1O',
            boxMaterial: 'F.G. Liviano',
        },
    },
    main_panel: {
        label: 'TG',
        mountingHeight: 1.8,
        properties: {
            voltage: '380V',
            phases: '3O',
            lengthM: 0,
            designFactor: 1.25,
            connectionType: 'star',
            workingTemperatureC: 20,
            copperResistivity: 0.0175,
            upstreamVoltageDropV: 0,
            defaultPowerFactor: 0.9,
            defaultDemandFactor: 1,
            boxMaterial: 'F.G. Liviano',
        },
    },
    sub_panel: {
        label: 'TD-01',
        mountingHeight: 1.8,
        properties: {
            voltage: '220V',
            phases: '1O',
            lengthM: 0,
            designFactor: 1.25,
            connectionType: 'star',
            workingTemperatureC: 20,
            copperResistivity: 0.0175,
            upstreamVoltageDropV: 6.22,
            defaultPowerFactor: 0.9,
            defaultDemandFactor: 1,
            boxMaterial: 'F.G. Liviano',
        },
    },
    transfer_switch: {
        label: 'ATS',
        mountingHeight: 1.8,
        properties: {
            voltage: '380V',
            phases: '3O',
            boxMaterial: 'F.G. Liviano',
        },
    },
    arrival_panel: {
        label: 'T.Llegada',
        mountingHeight: 1.8,
        properties: {
            voltage: '380V',
            phases: '3O',
            boxMaterial: 'F.G. Liviano',
        },
    },
    junction_box: {
        label: 'C-01',
        mountingHeight: 0.4,
        properties: { boxSize: '100x100x50', boxMaterial: 'RECTO' },
    },
    earth_pit: { label: 'PAT', mountingHeight: 0.0, properties: {} },
    facp: {
        label: 'FACP',
        mountingHeight: 1.4,
        properties: { voltage: '220V', phases: '1O' },
    },
    outlet_floor: {
        label: 'T',
        mountingHeight: 0.4,
        properties: {
            boxSize: '100x55x50',
            boxMaterial: 'RECTO',
            ratedPowerW: DEFAULT_OUTLET_POWER_W,
        },
    },
    outlet_initial: {
        label: 'TI',
        mountingHeight: 1.5,
        properties: {
            boxSize: '100x55x50',
            boxMaterial: 'RECTO',
            ratedPowerW: DEFAULT_OUTLET_POWER_W,
        },
    },
    outlet_high_180: {
        label: 'TA',
        mountingHeight: 1.8,
        properties: {
            boxSize: '100x55x50',
            boxMaterial: 'RECTO',
            ratedPowerW: DEFAULT_OUTLET_POWER_W,
        },
    },
    outlet_floor_box: {
        label: 'TP',
        mountingHeight: 0.0,
        properties: {
            boxSize: '100x100x55',
            boxMaterial: 'RECTO',
            ratedPowerW: DEFAULT_OUTLET_POWER_W,
        },
    },
    outlet_waterproof: {
        label: 'T',
        mountingHeight: 1.2,
        properties: {
            boxSize: '100x55x50',
            boxMaterial: 'RECTO',
            ratedPowerW: DEFAULT_OUTLET_POWER_W,
        },
    },
    outlet_ceiling: {
        label: 'T',
        mountingHeight: 0.0,
        properties: {
            boxSize: '100x55x50',
            boxMaterial: 'RECTO',
            ratedPowerW: DEFAULT_OUTLET_POWER_W,
        },
    },
    outlet_rack: {
        label: 'T',
        mountingHeight: 2.0,
        properties: {
            boxSize: '100x55x50',
            boxMaterial: 'RECTO',
            ratedPowerW: DEFAULT_OUTLET_POWER_W,
        },
    },
    water_heater_30l: {
        label: 'TE',
        mountingHeight: 1.8,
        properties: {
            voltage: '220V',
            phases: '1O',
            boxSize: '575x340x340',
            boxMaterial: 'TERMA 30L',
        },
    },
};

/** Caja de pase independiente (legacy Ã¢â‚¬â€ usar ElectricalDevice type=junction_box) */
export interface JunctionBox {
    id: string;
    x: number;
    y: number;
    size: '100x100x50' | '100x55x50';
    label?: string;
}

/** ConfiguraciÃƒÂ³n para inserciÃƒÂ³n de grilla de luminarias */
export interface FixtureGridConfig {
    rows: number; // filas de focos (Ã¢â€°Â¥1)
    columns: number; // columnas de focos (Ã¢â€°Â¥1)
    roomId?: string | null; // recinto donde se coloca la grilla (null = usar ambientVertices directamente)
    fixtureTemplate: Partial<Fixture>; // template para cada foco
    mountingHeight?: number; // altura de montaje (default 2.7m)
    ambientVertices?: Vertex[]; // vÃƒÂ©rtices del ambiente derivado (si se omite, usa room.vertices)
    /**
     * Posicion de las lineas guia internas que dividen el ancho del bbox en
     * `columns` celdas, como fracciones (0,1) ordenadas ascendente, longitud
     * `columns - 1`. `undefined` = division uniforme (comportamiento clasico).
     * Permite alinear las celdas con una viga/proyeccion real del DXF en vez
     * de forzar una division pareja -- ver editor interactivo en
     * `OverlayFixtureGridGuides.tsx`. Solo se aplica cuando NO hay
     * obstaculos relevantes (los StructuralObstacle tienen prioridad).
     */
    columnGuides?: number[];
    /** Igual que `columnGuides`, para el alto del bbox (longitud `rows - 1`). */
    rowGuides?: number[];
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ CÃƒÂ¡lculos de IluminaciÃƒÂ³n (Lighting Calculations) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/** CÃƒÂ¡lculo de iluminaciÃƒÂ³n para un recinto especÃƒÂ­fico */
export interface RoomLightingCalculation {
    id: string;
    roomId: string;
    name: string;

    // Entrada: Datos del recinto
    area: number; // mÃ‚Â², calculada del polÃƒÂ­gono
    scaledUnit: 'mm' | 'cm' | 'm'; // unidad de medida escalada
    normaLux: number; // 200, 300, o 500 lux (EN 12464-1)

    // Paso 1: CÃƒÂ¡lculo de lÃƒÂºmenes requeridos
    lumensRequired: number; // ((area * normaLux) / 0.8) / 0.99

    // Entrada: Tipo de luminaria seleccionada
    fixtureType: string; // nombre o modelo de la luminaria
    fixtureLumens: number; // lumenes del foco seleccionado

    // Paso 2: Cantidad de luminarias
    exactQuantity: number; // lumensRequired / fixtureLumens
    roundedQuantity: number; // CEIL(exactQuantity)

    // Paso 3: RecomendaciÃƒÂ³n final del usuario
    recommendedQuantity: number; // cantidad que el usuario finalmente considera

    // Resultado: Resumen
    uniformityEstimate?: number; // estimaciÃƒÂ³n de uniformidad (0-1)
    coverage?: 'optimal' | 'insufficient' | 'excessive';

    // Metadata
    createdAt: string;
    updatedAt: string;
}

/** ColecciÃƒÂ³n de cÃƒÂ¡lculos por mÃƒÂ³dulo (cada mÃƒÂ³dulo tiene al menos un recinto) */
export interface ModuleLightingCalculations {
    id: string;
    moduleName: string;
    calculations: RoomLightingCalculation[];
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Escena Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * Modelo INICIAL de disparador de escena (Fase 10 del plan maestro,
 * §11: "sensores y horarios como modelo inicial") — solo estructura de
 * datos, sin motor de evaluación real todavía (nada activa una escena
 * automáticamente según sensor/horario; la selección de escena sigue siendo
 * manual/explícita, ver `runDirectPreviewEngine.ts`).
 */
export type SceneTrigger =
    | { type: 'manual' }
    | { type: 'schedule'; startTime: string; endTime: string }
    | { type: 'sensor'; sensorType: 'occupancy' | 'daylight' };

/**
 * Escena lumínica (Fase 10: "Varias escenas por proyecto/nivel" — estado de
 * encendido/regulación, distinto de `Scene`, que es un NIVEL/piso). Los
 * "grupos de control" del plan ya existen como `LightSwitch.connectedFixtureIds`
 * — una escena no repite esa agrupación, solo referencia el `id` del
 * interruptor. Un interruptor NO listado en `switchStates` se asume
 * encendido al 100%: una escena es un "diff" desde todo encendido, no una
 * lista exhaustiva.
 */
export interface LightingScenePreset {
    id: string;
    name: string;
    switchStates: Record<string, { on: boolean; dimmingFactor: number }>;
    trigger?: SceneTrigger;
}

export interface Scene {
    id: string;
    name: string;
    /** `GlobalId` STEP del `IfcBuildingStorey` de origen (Fase 19: "BIM/IFC") — mismo criterio que `Room.ifcGlobalId`, nunca fabricado. */
    ifcGlobalId?: string;
    /**
     * ÃƒÂndice del piso: 0 = planta baja, 1 = piso 1, -1 = sÃƒÂ³tano 1, etc.
     * Determina el orden vertical y el cÃƒÂ¡lculo de elevaciÃƒÂ³n.
     */
    floorIndex: number;
    /**
     * ElevaciÃƒÂ³n del suelo de este piso en metros (respecto al nivel 0).
     * Se recalcula automÃƒÂ¡ticamente al reordenar pisos.
     */
    floorElevation: number;
    /**
     * Altura libre piso-a-techo en metros. Default 3.0m.
     * Afecta el offset vertical del siguiente piso en 3D.
     */
    floorHeight: number;
    scaleConfig: ScaleConfig;
    rooms: Room[];
    walls: Wall[];
    windows: Window[];
    doors: Door[];
    canopies: Canopy[];
    fixtures: Fixture[];
    lightSwitches: LightSwitch[];
    conductors?: Conductor[];
    junctionBoxes?: JunctionBox[];
    /** Dispositivos elÃƒÂ©ctricos: medidor, tableros, ATS, cajas de pase */
    electricalDevices?: ElectricalDevice[];
    partitions: Partition[];
    /** Columnas/vigas que restringen la instalacion de luminarias (ver StructuralObstacle) */
    structuralObstacles?: StructuralObstacle[];
    /**
     * Visibilidad del piso en el canvas 2D y en el modelo 3D.
     * Default: true. Cuando false, la geometrÃƒÂ­a se oculta sin eliminarla.
     */
    visible?: boolean;
    /**
     * Escenas lumínicas de este nivel (Fase 10: "varias escenas por
     * proyecto/nivel"). `undefined`/`[]` — comportamiento idéntico al de
     * antes de esta fase (una única escena implícita, todo encendido al
     * 100%); ninguna UI las crea todavía (ver pendientes en
     * `planes/fase10_progreso_dialux.md`).
     */
    lightingScenes?: LightingScenePreset[];
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Proyecto Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * Configuración de sitio ("Terreno" en DIALux evo), a nivel de proyecto.
 * Dos niveles distintos, no confundir uno por otro:
 * - `maintenanceFactor` SÍ afecta el cálculo real (viaja hasta
 *   `CalculationConfig.maintenanceFactor` en cada disparador de cálculo).
 * - El resto (orientación de terreno, luz molesta) es metadata documentada
 *   SIN consumidor todavía: el motor de luz natural (`daylightFactorEngine.ts`,
 *   modelo CIE Overcast Sky) no depende de fecha/hora/orientación, y el
 *   sistema no evalúa deslumbramiento de luminarias exteriores. Se guardan
 *   para no perder el dato y para cuando exista el motor que los consuma
 *   (CBDM / iluminación exterior), nunca deben presentarse como que ya
 *   cambian algún resultado calculado.
 */
export interface ProjectSiteSettings {
    /** Factor de mantenimiento (MF). Afecta el cálculo real. Default 0.80. */
    maintenanceFactor?: number;
    /** Solo documental — no cambia cómo se calcula `maintenanceFactor`. */
    maintenanceMethod?: 'din_5035' | 'cie_97_2005' | 'iesna' | 'jieg_001';
    /**
     * Horas de operación diarias asumidas para "Consumo (kWh/a)" en el PDF
     * (`Consumo = Ptotal × horas × 365 / 1000`). Afecta el cálculo real de
     * ese campo. Default 8 (mismo valor que estaba fijo antes de este
     * campo). NO reemplaza la evaluación energética horaria de DIALux evo
     * (considera autonomía de luz diurna, orientación real, atenuación por
     * escena) — sigue siendo un promedio simple, solo que ahora ajustable
     * en vez de hardcodeado, para poder alinear el supuesto con el de un
     * informe de referencia al comparar.
     */
    dailyOperatingHours?: number;
    /** Metadata sin consumidor de cálculo hoy (ver comentario de la interfaz). */
    latitude?: number;
    longitude?: number;
    northOrientationDeg?: number;
    timezone?: string;
    obtrusiveLightStandard?: string;
    environmentalZone?: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
}

export interface Project {
    id: string;
    /** Identificador del módulo contenedor cuando el documento pertenece a DIALux v2. */
    moduleId?: string;
    name: string;
    created_at: string;
    updated_at: string;
    /** Última norma aplicada; se persiste con el documento para rehidratar el panel. */
    defaultRoomNormativeStandard?: NonNullable<Room['normativeStandard']>;
    siteSettings?: ProjectSiteSettings;
    scenes: Scene[];
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Resultados lumÃƒÂ­nicos Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface LightingResult {
    avg_lux: number;
    min_lux: number;
    max_lux: number;
    uniformity: number;
    ugr: number;
    grid_rows: number;
    grid_cols: number;
    grid_values: Array<number | null>;
    grid_active?: boolean[];
    grid_origin_x?: number;
    grid_origin_y?: number;
    grid_cell_width?: number;
    grid_cell_height?: number;
    room_vertices?: Vertex[];
    useful_plane_height?: number;
    marginal_zone?: number;
    /** Presentes solo cuando se calculó con radiosidad iterativa (Fase 8: "Interreflexión iterativa"). Ausentes con luz directa o primera reflexión (Fase 7). */
    interreflection_iterations?: number;
    interreflection_converged?: boolean;
    interreflection_residual?: number;
    /**
     * Presentes solo cuando `ugr` se calculó con el camino de observadores de
     * Guth (Fase 9: "UGR y luminancia profesional") — identifican el
     * observador/dirección que produjo el peor caso (plan §11: "reportar
     * máximo y ubicación"). Ausentes con el `calculateUGR` heredado (sin
     * `glareConfig`).
     */
    ugr_observer_x?: number;
    ugr_observer_y?: number;
    ugr_observer_eye_height?: number;
    ugr_observer_view_direction_deg?: number;
    /** Luminarias excluidas del cálculo de UGR (campo visual inferior o fuera del rango de validez H/R>2 — ver `glareCalculation.ts`). Solo presente junto a los campos `ugr_observer_*`. */
    ugr_excluded_fixture_count?: number;
    /** `true` cuando TODAS las luminarias quedaron excluidas del cálculo de UGR — `ugr: 0` en ese caso no es un resultado físico real, es "no evaluado" (ver `UgrResult.fullyExcluded` en `glareCalculation.ts`). Solo presente junto a los campos `ugr_observer_*`. */
    ugr_not_evaluated?: boolean;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Entidades DXF Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface DxfLineEntity {
    id: string;
    type: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    layer: string;
}

export interface DxfPolylineEntity {
    id: string;
    type: 'polyline';
    vertices: [number, number][];
    closed: boolean;
    layer: string;
}

export interface DxfCircleEntity {
    id: string;
    type: 'circle';
    cx: number;
    cy: number;
    r: number;
    layer: string;
}

export interface DxfArcEntity {
    id: string;
    type: 'arc';
    cx: number;
    cy: number;
    r: number;
    start_angle: number;
    end_angle: number;
    layer: string;
}

export interface DxfEllipseEntity {
    id: string;
    type: 'ellipse';
    cx: number;
    cy: number;
    major_x: number;
    major_y: number;
    minor_ratio: number;
    start_param: number;
    end_param: number;
    layer: string;
}

export interface DxfTextEntity {
    id: string;
    type: 'text';
    x: number;
    y: number;
    text: string;
    height: number;
    rotation: number;
    layer: string;
}

export interface DxfPointEntity {
    id: string;
    type: 'point';
    x: number;
    y: number;
    layer: string;
}

export interface DxfRectangleEntity {
    id: string;
    type: 'rectangle';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    layer: string;
}

export interface DxfPolygonEntity {
    id: string;
    type: 'polygon';
    vertices: [number, number][];
    closed: boolean;
    layer: string;
}

export interface DxfHatchEntity {
    id: string;
    type: 'hatch';
    pattern_name: string;
    solid: boolean;
    boundary_paths: [number, number][][];
    layer: string;
}

export interface DxfSplineEntity {
    id: string;
    type: 'spline';
    control_points: [number, number][];
    closed: boolean;
    degree: number;
    layer: string;
}

export interface DxfSolidEntity {
    id: string;
    type: 'solid';
    vertices: [number, number][];
    layer: string;
}

export type DxfEntity =
    | DxfLineEntity
    | DxfPolylineEntity
    | DxfCircleEntity
    | DxfArcEntity
    | DxfEllipseEntity
    | DxfTextEntity
    | DxfPointEntity
    | DxfRectangleEntity
    | DxfPolygonEntity
    | DxfHatchEntity
    | DxfSplineEntity
    | DxfSolidEntity;

export interface DxfExtents {
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
}
