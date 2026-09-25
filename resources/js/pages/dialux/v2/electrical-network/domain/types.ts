export type ElectricalNodeType =
    | 'service'
    | 'meter'
    | 'ats'
    | 'generator'
    | 'ups'
    | 'main_panel'
    | 'module_panel_port'
    /** Sub tablero dibujado en la Planta General (no pertenece a un módulo). */
    | 'site_panel';

export interface Point {
    x: number;
    y: number;
}

export interface ElectricalNode {
    id: string;
    type: ElectricalNodeType;
    label: string;
    moduleId?: number;
    moduleName?: string;
    sceneId?: string;
    sceneName?: string;
    deviceId?: string;
    panelRole?: 'distribution' | 'sub_distribution';
    position: Point;
    collapsed?: boolean;
    /** `'site'` = creado automáticamente desde la Planta General (`siteNetworkBridge`). */
    origin?: 'site';
    /** → `SiteElement.id` del tablero en la planta (o del TG dueño, en su suministro/medidor). */
    siteElementId?: string;
    /**
     * TG de la planta: `'own'` = el usuario eligió "Suministro propio" (su
     * propia cadena Suministro → Medidor). Ausente = cuelga del medidor
     * principal cuando no tiene un cable dibujado que lo alimente.
     */
    supplyMode?: 'own';
    /**
     * Sistema propio de un tablero SIN puerto de módulo (TG / sub tablero de
     * la planta, ATS): p.ej. un sub tablero 1Φ 220 V colgado de una red 3Φ
     * 380 V. Ausente = el sistema general de la red.
     */
    phases?: 1 | 3;
    nominalVoltageV?: number;
    /**
     * Factor de simultaneidad del tablero (0 < fs ≤ 1) aplicado a la suma de
     * las demandas de sus salidas (hijos + salidas de la planta). Ausente = 1
     * (suma simple, el comportamiento anterior). Ver
     * `plan_red_ct_dimensionamiento_multimodulo.md`, R1.
     */
    simultaneityFactor?: number;
    /**
     * Suministro (raíz): potencia del transformador / potencia contratada en
     * kVA. Ausente = se sugiere una potencia normalizada (R2).
     */
    transformerKva?: number;
    /** Suministro (raíz): reserva sobre la demanda, % (por defecto 25). */
    supplyReservePercent?: number;
    /** Suministro (raíz): tensión de cortocircuito del transformador uk, % (R3). */
    transformerUkPercent?: number;
    /** Suministro (raíz): potencia de cortocircuito de la red aguas arriba S''kQ, MVA (R3). */
    upstreamShortCircuitMva?: number;
    /** Tablero: poder de corte de su interruptor general Icu, kA (R3). */
    breakingCapacityKa?: number;
    /**
     * Tablero MONOFÁSICO colgado de uno trifásico: fase a la que se conecta
     * (R4). Ausente = la propone el balance de fases; fijada = nunca se cambia.
     */
    phase?: 'R' | 'S' | 'T';
}

export interface ElectricalEdge {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    label?: string;
    lengthMode: 'manual' | 'plan' | 'combined' | 'site';
    horizontalLengthM: number;
    verticalLengthM: number;
    conductorType: string;
    conductorMaterial: 'copper' | 'aluminium';
    sectionMm2: number;
    earthSectionMm2?: number;
    wireConfiguration: string;
    powerFactor?: number;
    demandFactor?: number;
    /** `'site'` = creado automáticamente desde la Planta General. */
    origin?: 'site';
    /** → `SiteCircuit.id`: cable de la planta que ES este alimentador. */
    siteCircuitId?: string;
}

export interface ElectricalNetworkData {
    schemaVersion: 1;
    rootNodeId?: string;
    settings: {
        nominalVoltageV: number;
        phases: 1 | 3;
        connectionType: 'star' | 'delta';
        frequencyHz: 50 | 60;
        conductorMaterial: 'copper' | 'aluminium';
        workingTemperatureC: number;
        defaultPowerFactor: number;
        designFactor?: number;
        feederDropLimitPercent: number;
        totalDropLimitPercent: number;
        /** Tiempo de despeje de falla para la verificación térmica del cable, s (R3; por defecto 0,1). */
        faultClearingTimeS?: number;
    };
    nodes: ElectricalNode[];
    edges: ElectricalEdge[];
}

export interface ElectricalNetworkSnapshot {
    version: number;
    data: ElectricalNetworkData;
}

export interface ModuleElectricalPort {
    key: string;
    moduleId: number;
    moduleName: string;
    sceneId: string;
    sceneName: string;
    panelId: string;
    panelLabel: string;
    parentPanelId?: string | null;
    feederLengthM?: number;
    panelRole: 'distribution' | 'sub_distribution';
    nominalVoltageV: number;
    phases: 1 | 3;
    installedPowerW: number;
    demandPowerW: number;
    ownInstalledPowerW?: number;
    ownDemandPowerW?: number;
    currentA: number;
    mainBreakerA: number;
    circuitsCount: number;
    circuits?: ModuleElectricalCircuit[];
    revision: string;
    isFallback?: boolean;
}

export interface ModuleElectricalCircuit {
    circuitId: string;
    panelId: string;
    floorId?: string | null;
    floorName?: string | null;
    code: string;
    type: 'lighting' | 'outlets' | 'special';
    description?: string | null;
    totalPowerW: number;
    demandPowerW: number;
    currentA: number;
    designCurrentA: number;
    lengthM: number;
    calculatedHorizontalLengthM: number;
    calculatedVerticalLengthM: number;
    sectionMm2: number;
    conductorLabel?: string | null;
    breakerA: number;
    voltageDropPct: number;
    cumulativeVoltageDropPct: number;
    status: 'ok' | 'advertencia' | 'error';
    warnings: string[];
}

export interface GraphIssue {
    code:
        | 'missing-root'
        | 'missing-node'
        | 'self-link'
        | 'multiple-parents'
        | 'cycle'
        | 'disconnected';
    message: string;
    nodeId?: string;
    edgeId?: string;
}
