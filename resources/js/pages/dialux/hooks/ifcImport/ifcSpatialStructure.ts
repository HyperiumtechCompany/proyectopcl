import { Properties, type IfcAPI } from 'web-ifc';
import { getLengthUnitScaleToMeters, readRealValue } from './ifcLengthUnitScale';

/**
 * Fase 19 del plan maestro ("BIM/IFC", primer ciclo). Extrae la jerarquía
 * `IfcBuildingStorey → IfcSpace` de un modelo ya abierto — usa
 * `Properties.getSpatialStructure` (utilidad propia de `web-ifc`, ya
 * probada, en vez de recorrer a mano `IfcRelAggregates`/
 * `IfcRelContainedInSpatialStructure`). Conserva `globalId` (el
 * identificador STEP estable del `IfcSpace`/`IfcBuildingStorey` de origen)
 * — es el requisito explícito de "conservar IDs IFC" del plan maestro.
 *
 * Alcance de este ciclo: solo niveles y espacios — edificios/sitios se
 * atraviesan pero no se exponen (no hay concepto de "edificio" en este
 * editor, cada `Scene` ya ES un nivel). "Superficies" (paredes/ventanas IFC)
 * quedan fuera de este ciclo.
 */
export interface IfcSpaceInfo {
    expressId: number;
    globalId: string | null;
    name: string | null;
}

export interface IfcStoreyInfo {
    expressId: number;
    globalId: string | null;
    name: string | null;
    /** `null` si el proyecto no usa una unidad SI de longitud reconocida (ver `ifcLengthUnitScale.ts`) — nunca se asume un factor de escala. */
    elevationM: number | null;
    spaces: IfcSpaceInfo[];
}

export interface IfcSpatialStructure {
    storeys: IfcStoreyInfo[];
}

interface SpatialNode {
    expressID: number;
    type: string;
    children: SpatialNode[];
}

function readStringValue(attr: unknown): string | null {
    if (attr && typeof attr === 'object' && 'value' in attr) {
        const value = (attr as { value: unknown }).value;
        return typeof value === 'string' ? value : null;
    }
    return null;
}

function collectNodesByType(node: SpatialNode, typeUpper: string, out: SpatialNode[] = []): SpatialNode[] {
    if (node.type.toUpperCase() === typeUpper) {
        out.push(node);
    }
    for (const child of node.children) {
        collectNodesByType(child, typeUpper, out);
    }
    return out;
}

export async function extractSpatialStructure(api: IfcAPI, modelId: number): Promise<IfcSpatialStructure> {
    const properties = new Properties(api);
    const tree = (await properties.getSpatialStructure(modelId, false)) as unknown as SpatialNode;
    const lengthScale = getLengthUnitScaleToMeters(api, modelId);

    const storeyNodes = collectNodesByType(tree, 'IFCBUILDINGSTOREY');

    const storeys: IfcStoreyInfo[] = storeyNodes.map((storeyNode) => {
        const storeyLine = api.GetLine(modelId, storeyNode.expressID);
        const rawElevation = readRealValue(storeyLine.Elevation);
        const elevationM = rawElevation !== null && lengthScale !== null ? rawElevation * lengthScale : null;

        const spaces: IfcSpaceInfo[] = collectNodesByType(storeyNode, 'IFCSPACE').map((spaceNode) => {
            const spaceLine = api.GetLine(modelId, spaceNode.expressID);
            return {
                expressId: spaceNode.expressID,
                globalId: readStringValue(spaceLine.GlobalId),
                name: readStringValue(spaceLine.Name),
            };
        });

        return {
            expressId: storeyNode.expressID,
            globalId: readStringValue(storeyLine.GlobalId),
            name: readStringValue(storeyLine.Name),
            elevationM,
            spaces,
        };
    });

    return { storeys };
}
