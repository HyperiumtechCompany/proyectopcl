// ── Geolocalización ──────────────────────────────
export interface GeoLocation {
    lat: number;
    lon: number;
    displayName: string;
    boundingBox?: [number, number, number, number];
    zoneType?: string;
}

// ── Elementos del emplazamiento ──────────────────
export type SiteElementType =
    | 'terrain' // Polígono del terreno/lote completo
    | 'building_block' // Bloque de edificación → referencia DialuxModule
    | 'street' // Calle, vereda, pasaje
    | 'green_area' // Grass, jardín, parque
    | 'fence' // Cerco perimetral, muro
    | 'pool' // Piscina
    | 'ramp' // Rampa con inclinación (cota origen → destino)
    | 'stair' // Escalera exterior (cota origen → destino)
    | 'court' // Cancha deportiva
    | 'parking' // Estacionamiento
    | 'tg_location' // Tablero General (posicionado por el cliente)
    | 'sub_panel' // Sub tablero de distribución (TD) — mismos tipos que v1: autosoportado/adosado/caja moldeada/riel DIN
    | 'ats' // Tablero de transferencia automática
    | 'earth_pit' // Pozo de puesta a tierra (PAT)
    | 'mt_cell_arrival' // Celda de llegada (CMP-V + CMR remonte), cámara MT
    | 'mt_cell_protection' // Celda de protección (CMP-F + CMR remonte), cámara MT
    | 'mt_cell_transformation' // Celda de transformación, cámara MT
    | 'cable_vault' // Buzón de C.A. de registro y derivación del alimentador (650x650x950mm)
    | 'pull_box' // Caja de pase (100x100x50mm)
    | 'generator' // Grupo electrógeno (GE)
    | 'transformer' // Subestación / transformador
    | 'pole' // Poste de alumbrado exterior
    | 'outlet' // Tomacorriente exterior (IP65)
    | 'gate' // Puerta / portón de acceso
    | 'contour' // Curva de nivel (polilínea con cota) — modela el terreno
    | 'spot_elevation' // Punto acotado (cota puntual de un levantamiento)
    | 'terrace_platform' // Plataforma/plantío a una cota absoluta, unida a su entorno por un talud
    | 'canopy' // Techado / entrada techada / cobertizo (cubierta sobre columnas)
    | 'sidewalk' // Vereda peatonal (losa elevada con borde)
    | 'tree' // Árbol / palmera (paisajismo)
    | 'custom_zone'; // Zona personalizada

export interface Point2D {
    x: number;
    y: number;
}

export interface SiteElementStyle {
    fillColor: string;
    strokeColor: string;
    strokeWidth?: number;
    opacity?: number;
    pattern?: 'solid' | 'hatch' | 'dots' | 'grass' | 'water';
}

// ── Configuración por tipo de objeto ─────────────
// Unión discriminada por `kind`. Todos los campos numéricos en METROS reales
// (misma unidad que `baseElevationM`). El `kind` debe coincidir con el `type`
// del elemento; si falta `config`, el 2D/3D usan valores por defecto.

export type GateVariant =
    | 'open' // paso libre, sin hoja (ingreso techado, vano)
    | 'swing' // batiente de una hoja
    | 'double-swing' // batiente de dos hojas
    | 'sliding' // corrediza
    | 'barrier' // pluma / barrera vehicular
    | 'pedestrian'; // puerta peatonal
export type GateState = 'closed' | 'ajar' | 'open';

/** Cubierta sobre el ingreso (techo de teja, losa, calamina o policarbonato), hacia el interior del predio. */
export interface GateCanopy {
    enabled: boolean;
    /** Fondo hacia el interior (m). */
    depthM: number;
    /** Altura del alero (m). */
    heightM: number;
    roof: 'flat' | 'mono' | 'gable';
    /** Elevación de la cumbrera / lado alto sobre el alero (m). */
    riseM: number;
    material: 'tile' | 'concrete' | 'metal' | 'polycarbonate';
    /** Vuelo lateral a cada lado del vano (m). */
    overhangM: number;
}

/** Muros a ambos lados del paso (jambas largas), hacia el interior. */
export interface GateSideWalls {
    enabled: boolean;
    thicknessM: number;
    heightM: number;
    depthM: number;
}

/** Luminarias del ingreso, repartidas a lo ancho bajo la cubierta (o sobre los muros). */
export interface GateLights {
    enabled: boolean;
    count: number;
    heightM: number;
    lumens: number;
    wattage: number;
    /** Producto del catálogo compartido con la V1 (fotometría IES/LDT real en el cálculo). */
    productId?: number;
}

/**
 * Luminarias bajo la cubierta de un techado: `count` luminarias repartidas en
 * una grilla dentro del contorno, colgadas a `mountHeightM` (ausente = 15 cm
 * bajo el alero). Mismo modelo que las luces del portón.
 */
export interface CanopyLights {
    enabled: boolean;
    /** Total (legado). Con `rows`/`columns` definidos manda la grilla. */
    count: number;
    /** Luminarias en VERTICAL de la planta (eje Y). Regla ½-1-1-½ (grilla de la V1). */
    rows?: number;
    /** Luminarias en HORIZONTAL de la planta (eje X). */
    columns?: number;
    lumens: number;
    wattage: number;
    mountHeightM?: number;
    /** Producto del catálogo compartido con la V1 (fotometría IES/LDT real en el cálculo). */
    productId?: number;
}

/** Puesto de ingreso (caseta de control) junto al vano de un portón. */
export interface GateBooth {
    enabled: boolean;
    /** Largo a lo largo del cerco (m). */
    widthM: number;
    /** Fondo hacia el interior (m). */
    depthM: number;
    heightM: number;
    /** Extremo del vano (a = primer punto, b = segundo) junto al que va. */
    end: 'a' | 'b';
    /** Separación entre el vano y el puesto (m). */
    gapM: number;
    /** Retranqueo hacia adentro desde la línea del cerco (m). */
    setbackM: number;
}

export interface GateConfig {
    kind: 'gate';
    variant: GateVariant;
    state: GateState;
    openAngleDeg: number; // 0 = cerrado, 90 = abierto (batientes/barrera)
    widthM: number;
    /** `SiteElement.id` de un cerco (`type:'fence'`) al que este portón queda
     * pegado en 3D: mismo punto sobre la línea del cerco, misma cota y misma
     * altura, en vez de la posición/altura propias del portón. El polígono
     * dibujado en 2D no cambia — este ajuste es solo para el render 3D. */
    fenceId?: string;
    /** Fondo (m) de la zona de acceso pavimentada hacia el interior del predio. 0/ausente = sin zona. */
    accessDepthM?: number;
    /** Lado del interior respecto al sentido del vano (a→b); en un cerco cerrado se decide solo al dibujar. */
    inwardSide?: 'left' | 'right';
    /** Puesto de ingreso junto al vano. */
    booth?: GateBooth;
    /** Cubierta, muros laterales y luminarias del ingreso (solo portones trazados como tramo). */
    canopy?: GateCanopy;
    sideWalls?: GateSideWalls;
    lights?: GateLights;
    /** Altura del portón (m). Ausente = la del cerco al que está pegado (o 2.2 m). */
    heightM?: number;
}

export interface PoleConfig {
    kind: 'pole';
    heightM: number;
    armLengthM: number; // 0 = sin brazo (proyector sobre el fuste)
    armDirectionDeg: number; // hacia dónde apunta el brazo
    fixtures: number; // nº de luminarias en la cabeza
    /** Flujo luminoso de CADA luminaria (lm). 7000 por defecto. */
    lumens?: number;
    /** Ángulo (°) al que la intensidad cae al 50 % del máximo (distribución cos^n). 60 por defecto. */
    beamAngleDeg?: number;
    /** Factor de mantenimiento (0-1) que multiplica el aporte. 0.8 por defecto. */
    maintenanceFactor?: number;
    /** Potencia de cada luminaria (W) — informativo (eficacia = lm/W). */
    wattage?: number;
    /** Potencia (W) de la ficha del producto elegido, guardada al elegirlo — alimenta la carga del tablero "Alumbrado exterior". */
    resolvedWatts?: number;
    /**
     * Producto del catálogo de luminarias COMPARTIDO con el editor de
     * interiores (v1): su fotometría IES/LDT entra al cálculo. Si falta, se
     * usa el modelo genérico (lm + ángulo de haz). Con producto, `lumens` y
     * `wattage` ausentes toman los de su ficha.
     */
    productId?: number;
}

export interface TransformerConfig {
    kind: 'transformer';
    /**
     * 'pad'/'pole' = comportamiento previo (caja única). 'cells' = subestación
     * compacta de 3 celdas en línea (llegada, protección, transformación) —
     * la disposición habitual de una cámara de transformación MT/BT.
     */
    mount: 'pad' | 'pole' | 'cells';
    kva?: number;
    widthM: number;
    depthM: number;
    heightM: number;
}

export interface TgConfig {
    kind: 'tg';
    mount: 'floor' | 'pedestal' | 'wall';
    widthM: number;
    depthM: number;
    heightM: number;
    /** Salidas visibles y editables del tablero en el esquema 2D. */
    outputs?: TgOutput[];
}

export interface TgOutput {
    id: string;
    label: string;
    color: string;
}

/**
 * Sub tablero de distribución (TD). Variantes de montaje: las 4 que ya
 * distingue v1 (`components/canvas/OverlayElectricalDevices.tsx` / leyenda
 * CAD estándar) más 2 de la leyenda real del cliente (estabilizado, control
 * de bombas) — cada una tiene su propio color de leyenda en
 * `lib/siteDefaults.ts::SUB_PANEL_MOUNT_STYLE`, no todas comparten el mismo.
 */
export type SubPanelMount =
    | 'freestanding' // Autosoportado
    | 'surface' // Adosado
    | 'molded_case' // Caja moldeada — "Tablero de distribución" en la leyenda del cliente
    | 'din_rail' // Riel DIN — "Sub tablero de distribución" en la leyenda del cliente
    | 'stabilized' // Sub tablero estabilizado (con estabilizador de tensión)
    | 'pump_control'; // Sub tablero de control de bombas

export interface SubPanelConfig {
    kind: 'sub_panel';
    mount: SubPanelMount;
    widthM: number;
    depthM: number;
    heightM: number;
}

export interface AtsConfig {
    kind: 'ats';
    widthM: number;
    depthM: number;
    heightM: number;
}

/** Grupo electrógeno (GE): motor-generador en cabina/contenedor insonorizado. */
export interface GeneratorConfig {
    kind: 'generator';
    widthM: number;
    depthM: number;
    heightM: number;
    kva?: number;
}

/** Pozo de puesta a tierra (PAT). Profundidad y resistencia son datos de obra, no del modelo 3D. */
export interface EarthPitConfig {
    kind: 'earth_pit';
    /** Etiqueta del pozo (ej. "PAT-17"), como en el plano de referencia. */
    label?: string;
}

/**
 * Celda de un tablero/cámara de media tensión, según el legend CAD real del
 * cliente (bloques "Celda de llegada" CMP-V+CMR, "Celda de protección"
 * CMP-F+CMR, "Celda de transformación"). Tres tipos separados (no una sola
 * "celda genérica") porque el cliente las dibuja como bloques independientes
 * que se colocan en fila con su propio ancho/fondo real — a diferencia del
 * preset rápido `TransformerConfig.mount === 'cells'` (una sola caja
 * compacta), esto permite calcar el plano exacto.
 */
export interface MtCellArrivalConfig {
    kind: 'mt_cell_arrival';
    /** 1.05 m en el bloque de referencia (CMP-V 0.48 + CMR remonte 0.37). */
    widthM: number;
    depthM: number;
    heightM: number;
}

export interface MtCellProtectionConfig {
    kind: 'mt_cell_protection';
    /** 1.05 m en el bloque de referencia (CMP-F 0.48 + CMR remonte 0.37). */
    widthM: number;
    depthM: number;
    heightM: number;
}

export interface MtCellTransformationConfig {
    kind: 'mt_cell_transformation';
    /** 1.5 x 1.05 m en el bloque de referencia. */
    widthM: number;
    depthM: number;
    heightM: number;
}

/**
 * Buzón de C.A. de registro y derivación del alimentador (650x650x950 mm
 * real, según leyenda del cliente) — objeto colocable aparte, distinto de
 * las cajas de paso pequeñas que `SiteFeederRoutePanel`/`buildJunctionBoxes`
 * ya autogeneran a mitad de tramo en un cableado subterráneo.
 */
export interface CableVaultConfig {
    kind: 'cable_vault';
    widthM: number;
    depthM: number;
    heightM: number;
    /** Etiqueta (ej. "BZ-01"), como en el plano de referencia. */
    label?: string;
}

/** Caja de pase pequeña (100x100x50 mm real) para cambios de dirección en zanja. */
export interface PullBoxConfig {
    kind: 'pull_box';
    widthM: number;
    depthM: number;
    heightM: number;
}

export type FenceKind = 'wall' | 'grille';
export type FenceConform = 'stepped' | 'sloped' | 'flat';

export interface FenceConfig {
    kind: 'fence';
    /** Campos previos (perfil lineal), ya sin efecto en 3D — se conservan por compatibilidad con proyectos guardados. */
    slope: 'flat' | 'ramp';
    endElevationM: number;
    /** 'wall' = muro ciego; 'grille' = reja (zócalo + postes + barandas). Por defecto 'wall'. */
    fenceKind?: FenceKind;
    /**
     * Cómo se adapta al terreno/plataformas (por defecto 'stepped'):
     * 'stepped' = paneles horizontales que escalonan; 'sloped' = cada panel
     * sigue la pendiente entre sus extremos; 'flat' = comportamiento previo
     * (bloque a cota fija, sin seguir el terreno).
     */
    conform?: FenceConform;
    /** Espesor del muro en metros (0.2 por defecto). */
    thicknessM?: number;
    /** Plataforma en la que se apoya el cerco (id). Ausente = automático: dentro de una plataforma, su cota; justo en el borde que comparten dos niveles, el de abajo. */
    groundPlatformId?: string;
    /** Pilastras (columnas) en cada junta de panel y en las esquinas — por defecto sí. */
    pilasters?: boolean;
    /** Viga de coronación sobre el paño — por defecto sí. */
    cap?: boolean;
    /** Largo de cada panel entre postes, en metros (2.5 por defecto) — los escalones ocurren entre paneles. */
    panelLengthM?: number;
    /** `true` = perímetro cerrado (el último vértice vuelve al primero). Ausente en cercos previos = cerrado, como se dibujaban. Los nuevos nacen abiertos. */
    closed?: boolean;
}

export interface StairConfig {
    kind: 'stair';
    fromElevationM: number;
    toElevationM: number;
    widthM: number;
    /**
     * Forma de la escalera: 'straight' = recta (los tramos en línea, con
     * descanso plano entre ellos si pasan del máximo de peldaños); 'L' =
     * giro de 90° en el descanso; 'U' = vuelta de 180° (tramos paralelos).
     */
    run: 'straight' | 'L' | 'U';
    /**
     * 'auto' (por defecto) = con descansos: los peldaños se reparten en tramos de a
     * lo sumo `maxStepsPerFlight`, con un descanso plano entre ellos.
     * 'none' = escalera RECTA CONTINUA: un solo tramo con todos los peldaños, sin descanso
     * intermedio (siempre en línea; ignora `run` y `maxStepsPerFlight`).
     */
    landings?: 'auto' | 'none';
    /** Sentido del recorrido: 'east' = horizontal en el plano (el ancho crece en vertical), 'south' = vertical (el ancho crece en horizontal). Ausente = el del lado mayor del polígono (comportamiento previo). */
    direction?: 'east' | 'south';
    /** Fondo del descanso intermedio (m). Ausente = el mayor entre el ancho de la escalera y 1.20 m. */
    landingDepthM?: number;
    /** Altura de la baranda (m). Ausente = la de referencia (0.90 m). */
    handrailHeightM?: number;
    /** Fondo (m) del descanso plano que conecta con la plataforma siguiente (1.20 por defecto; 0 lo quita). */
    arrivalLandingM?: number;
    /** Máximo de peldaños seguidos antes de un descanso (18 por defecto). */
    maxStepsPerFlight?: number;
    /** Recorrido al revés en planta (INICIO ↔ FIN), sin cambiar las cotas. */
    reversed?: boolean;
    /** Ajusta el layout al espacio dibujado (por defecto sí). `false` = respetar las medidas de los tramos aunque sobresalgan. */
    fitToPolygon?: boolean;
}

/** Un tramo recto de una rampa multi-nivel: dirección inicial + giro opcional al final. */
export interface RampFlight {
    id: string;
    direction: 'north' | 'south' | 'east' | 'west';
    lengthM: number;
    riseM: number; // cuánto sube (+) o baja (-) este tramo, en metros
    landingLengthM?: number; // descanso plano al final del tramo (0 = sin descanso)
    turnAfterDeg?: number; // giro (°) antes de iniciar el siguiente tramo (ej. 180 = vuelta en U)
}

export type RampShape = 'straight' | 'spiral';

export interface RampConfig {
    kind: 'ramp';
    /** Altura de la baranda (m). Ausente = la de referencia (0.90 m). */
    handrailHeightM?: number;
    fromElevationM: number;
    toElevationM: number;
    widthM: number;
    /** 'straight' (default) = un solo tramo (comportamiento clásico) o varios
     * tramos rectos con giros (`flights`); 'spiral' = rampa helicoidal. */
    shape?: RampShape;
    /** Tramos rectos con giros — solo si `shape` es 'straight'. Vacío/ausente
     * conserva el comportamiento clásico: una losa inclinada sobre el
     * polígono dibujado. */
    flights?: RampFlight[];
    /** Vueltas completas — solo si `shape` es 'spiral'. */
    turns?: number;
    /** Sentido de giro visto en planta — solo si `shape` es 'spiral'. */
    clockwise?: boolean;
    /** Ángulo inicial (°) del primer tramo de la espiral. */
    startAngleDeg?: number;
    /**
     * Recorre el mismo trazado en planta al revés: el INICIO (cota origen)
     * pasa al extremo donde antes estaba el FIN, y el FIN al del INICIO. Las
     * cotas no cambian — sirve para que la rampa suba desde la plataforma
     * baja hacia la pared de la alta sin redibujar los tramos.
     */
    reversed?: boolean;
    /** Ajusta el layout al espacio dibujado (por defecto sí). `false` = respetar las medidas de los tramos aunque sobresalgan. */
    fitToPolygon?: boolean;
    /**
     * Fondo (m) del descanso plano que cierra la rampa y la conecta con la
     * plataforma/piso siguiente (A.120 Art. 6 d: mín. 1.50 m). 1.50 por
     * defecto; 0 lo quita. Solo aplica cuando la rampa tiene `flights`.
     */
    arrivalLandingM?: number;
}

export interface TerracePlatformConfig {
    kind: 'terrace_platform';
    /**
     * Ángulo del talud respecto a la horizontal (°), entre el borde de la
     * plataforma y el terreno/plataforma vecina. 75° por defecto (corte firme
     * típico); editable — un talud en tierra suelta puede necesitar 30-45°.
     */
    taludAngleDeg: number;
}

/** Tomacorriente exterior IP65 (norma de tipo/altura sin fuente cargada — solo modelado). */
export interface OutletConfig {
    kind: 'outlet';
    /** Altura de montaje (m). 0.4 por defecto (zócalo exterior). */
    heightM: number;
    /** Etiqueta de circuito, informativa (ej. "TC-01"). */
    circuitLabel?: string;
    /** Potencia (W) para la Tabla CT. Ausente = 180 W de referencia (`OUTLET_REFERENCE_W`). */
    powerW?: number;
}

export type SidewalkMaterial = 'paving' | 'concrete' | 'stone';

export interface SidewalkConfig {
    kind: 'sidewalk';
    /** Altura de la vereda sobre el suelo (m). 0.14 por defecto. */
    heightM: number;
    material: SidewalkMaterial;
}

/** Forma de la cubierta de un techado o de una cancha techada. */
export type RoofKind = 'flat' | 'gable' | 'arched';

export interface CanopyConfig {
    kind: 'canopy';
    /** Altura del borde de la cubierta sobre el suelo (m). */
    heightM: number;
    roof: RoofKind;
    /** Cubierta translúcida (policarbonato) en vez de opaca. */
    translucent: boolean;
    /** Separación de columnas a lo largo del perímetro (m). */
    columnSpacingM: number;
    columnDiameterM: number;
    /** Luminarias bajo la cubierta (ausente = sin luminarias). */
    lights?: CanopyLights;
}

export type CourtSport =
    'none' | 'multi' | 'futsal' | 'basketball' | 'volleyball';

export interface CourtConfig {
    kind: 'court';
    /** Marcas y equipamiento (aros, arcos, red). 'none' = solo la losa. */
    sport: CourtSport;
    /** Cancha techada: cubierta con columnas. */
    covered: boolean;
    roof: RoofKind;
    /** Altura libre bajo el borde de la cubierta (m). */
    roofHeightM: number;
}

export interface GreenAreaConfig {
    kind: 'green_area';
    /** 'terraced' = jardín en gradas (terrazas de césped con muro de contención). */
    form: 'flat' | 'terraced';
    terraces: number;
    /** Desnivel de cada terraza (m). */
    terraceRiseM: number;
}

export type TreeSpecies = 'broadleaf' | 'palm' | 'conifer';

export interface TreeConfig {
    kind: 'tree';
    species: TreeSpecies;
    heightM: number;
    /** Diámetro de la copa (m). */
    crownM: number;
}

export type SiteElementConfig =
    | SidewalkConfig
    | CanopyConfig
    | CourtConfig
    | GreenAreaConfig
    | TreeConfig
    | GateConfig
    | PoleConfig
    | OutletConfig
    | SubPanelConfig
    | AtsConfig
    | EarthPitConfig
    | MtCellArrivalConfig
    | MtCellProtectionConfig
    | MtCellTransformationConfig
    | CableVaultConfig
    | PullBoxConfig
    | GeneratorConfig
    | TransformerConfig
    | TgConfig
    | FenceConfig
    | StairConfig
    | RampConfig
    | TerracePlatformConfig;

/** Región normativa que el cliente elige para verificar la iluminación de sus espacios (v1: EN 12464-1, IES HB-10, RNE EM.010). */
export type SiteNormRegion = 'europe' | 'usa' | 'peru';

/** Actividad elegida por el cliente para un espacio, por región: clave `categoría › título` del catálogo normativo de v1. */
export interface SiteNormRequirement {
    activities: Partial<Record<SiteNormRegion, string>>;
}

export interface SiteElement {
    id: string;
    type: SiteElementType;
    label: string;
    vertices: Point2D[]; // Polígono o polilínea
    heightM?: number; // Altura (cercos, edificios para 3D)
    rotation?: number; // Grados (giro del objeto alrededor de su centroide)
    baseElevationM?: number; // Cota base sobre el terreno (0 = a nivel). Metros reales.
    config?: SiteElementConfig; // Propiedades configurables según el tipo
    moduleId?: number; // → DialuxModule.id si es building_block
    moduleName?: string; // Nombre del módulo referenciado
    locked?: boolean; // No editable (para bloques importados)
    visible?: boolean; // Toggle visibilidad
    zIndex?: number; // Orden de apilamiento
    style: SiteElementStyle;
    metadata?: Record<string, unknown>;
    /** Exigencia de iluminancia elegida por el cliente (solo tiene sentido en espacios/áreas). */
    normReq?: SiteNormRequirement;
}

// ── Trazado de alimentadores ─────────────────────
/**
 * Cómo se tiende un alimentador exterior. Ausente = trazado plano (comportamiento anterior).
 * - `aerial`: cable colgado entre postes (los waypoints son los postes), catenaria.
 * - `underground`: en zanja a `depthM`, con cajas de paso opcionales (`junctionBoxes`).
 */
export interface FeederRoute {
    kind: 'aerial' | 'underground';
    /** Lado del arco visto desde el origen hacia el destino. `auto` conserva la convención del tendido. */
    curveSide?: 'auto' | 'left' | 'right' | 'straight';
    /** Separación lateral máxima del arco en metros. */
    curveOffsetM?: number;
    /** Flecha máxima del cable aéreo, % del vano (default 3). */
    sagPct?: number;
    /** Altura de amarre en el poste, m (default 6). */
    mountHeightM?: number;
    /** Profundidad de zanja, m (default 0.60). */
    depthM?: number;
    /** Material del conductor del alimentador; ausente = el que ya tenga la red. Se sincroniza al alimentador de la red. */
    conductorMaterial?: 'copper' | 'aluminium';
    /** Tipo de cable (ver `FEEDER_CABLE_PRESETS`); ausente = el que ya tenga la red. */
    cableType?: string;
    /** Cajas de paso intermedias (subterráneo), en coordenadas de plano. */
    junctionBoxes?: Point2D[];
}

export interface FeederPath {
    id: string;
    networkEdgeId: string; // → ElectricalEdge.id en la red
    waypoints: Point2D[]; // Puntos del recorrido sobre el terreno
    calculatedLengthM: number; // Longitud total del recorrido
    route?: FeederRoute; // Tendido aéreo/subterráneo (ausente = plano)
    /** Modo de CADA tramo (waypoint i-1 → i): clic = aéreo, clic derecho = por el suelo. Ausente = todo `route.kind`. */
    segmentModes?: Array<'aerial' | 'underground'>;
    label?: string;
    style?: {
        color: string; // verde/naranja/rojo según ΔU
        dashArray?: string;
    };
}

// ── Cableado de instalaciones (postes, tomacorrientes, tableros…) ─
/**
 * Circuito local entre dos artefactos del emplazamiento (poste, tomacorriente,
 * tablero, transformador, portón o techado con luces) — para empezar a
 * cablear instalaciones en el Módulo General. Es un tramo dibujado, con el
 * mismo modelo aéreo/subterráneo que `FeederPath`; a diferencia de un
 * alimentador, NO representa un tramo de la red troncal (`Red y CT`) y no
 * entra hoy al cálculo de caída de tensión — es informativo/constructivo,
 * como un primer paso de instalación.
 */
export interface SiteCircuit {
    id: string;
    sourceId: string; // → SiteElement.id (extremo inicial)
    targetId: string; // → SiteElement.id (extremo final)
    waypoints: Point2D[]; // Recorrido sobre el terreno, extremos incluidos
    calculatedLengthM: number;
    wireCount: number; // 2, 3, 4…
    wireLabel?: string; // "F+N+T", "2F+T", etc.
    conductorType?: string; // Ej. "THW-90" — informativo, no ligado a un catálogo todavía
    sectionMm2?: number;
    /** Reserva por tendido, terminaciones y desperdicio aplicada al metrado calculado. */
    wastePct?: number;
    /** Salida del TG asociada cuando uno de los extremos es un tablero general. */
    tgOutputId?: string;
    /**
     * Cuando un extremo es un bloque de módulo (`building_block`): tablero del
     * módulo que este cable alimenta (`ModuleElectricalPort.panelId`). Ausente
     * = el único tablero raíz del módulo.
     */
    modulePanelId?: string;
    route?: FeederRoute; // Tendido aéreo/subterráneo (ausente = plano)
    segmentModes?: Array<'aerial' | 'underground'>;
    label?: string;
    style?: {
        color?: string;
        dashArray?: string;
    };
}

export interface SiteLayer {
    id: string;
    label: string;
    types: SiteElementType[]; // qué tipos pertenecen a esta capa
    visible: boolean;
    locked: boolean;
}

// ── Plano importado (DXF/DWG) ────────────────────
/**
 * Referencia de fondo del emplazamiento generada a partir de un DXF/DWG
 * subido por el usuario (Fase 5, fuera del plan original). NO es geometría
 * CAD editable — es una captura estática (PNG) del plano ya renderizado por
 * el motor CAD (`useMlightcadEngine`), igual que la capa satelital: se
 * calibra una vez (2 clics + distancia real) y queda fija.
 *
 * La imagen en sí NO se guarda aquí — vive en el mismo backend de planos
 * que ya usa el editor de interiores (`dialux_plans`, vía
 * `PlanFileController`), reusando el `dialuxModule.id` del Módulo General
 * con un `sceneId` reservado (`SITE_PLAN_SCENE_ID`). Aquí solo se persiste
 * la transformación (posición/tamaño/opacidad) — la URL se deriva.
 */
export interface ImportedSitePlan {
    originalName: string;
    x: number; // esquina superior-izquierda, unidades de canvas
    y: number;
    widthUnits: number;
    heightUnits: number;
    opacity: number;
    visible: boolean;
    /** `Date.now()` de la última (re)importación — invalida la caché del navegador en la URL de la imagen, que vive en una ruta fija. */
    updatedAt: number;
}

// ── Documento principal ──────────────────────────
export interface SiteData {
    schemaVersion: 1;
    location?: GeoLocation;
    terrainScaleM: number; // metros por unidad de coordenada
    gridSizeM: number; // tamaño de cuadrícula visible
    canvasWidth: number; // ancho del canvas en unidades
    canvasHeight: number; // alto del canvas en unidades
    elements: SiteElement[];
    feederPaths: FeederPath[];
    /** Cableado de instalaciones entre artefactos (postes, tomacorrientes, tableros…). */
    circuits: SiteCircuit[];
    layers: SiteLayer[];
    importedPlan?: ImportedSitePlan;
    /** Regiones normativas activas para el proyecto (ausente = las tres). */
    normRegions?: SiteNormRegion[];
    /** Bloqueo de la base (terreno, cerco, plataformas, topografía). Ausente = automático: se activa al existir algún objeto que no es base. */
    baseLocked?: boolean;
}

// ── Herramientas del editor ──────────────────────
export type SiteTool =
    | 'select'
    | 'pan'
    | 'draw_polygon'
    | 'draw_polyline'
    | 'draw_rect'
    | 'draw_contour'
    | 'place_block'
    | 'place_tg'
    | 'place_spot'
    | 'draw_feeder'
    | 'draw_circuit'
    | 'calibrate_plan'
    | 'measure';
