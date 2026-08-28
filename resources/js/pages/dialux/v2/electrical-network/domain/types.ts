export type ElectricalNodeType =
    | 'service'
    | 'meter'
    | 'ats'
    | 'generator'
    | 'ups'
    | 'main_panel'
    | 'module_panel_port';

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
