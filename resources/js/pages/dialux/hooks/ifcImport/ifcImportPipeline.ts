import { closeIfcModel, createIfcApi, openIfcModel } from './ifcClient';
import { extractSpaceFootprint, type IfcSpaceFootprint } from './ifcSpaceFootprint';
import { extractSpatialStructure } from './ifcSpatialStructure';

/**
 * Fase 19 del plan maestro ("BIM/IFC", primer ciclo). Punto de entrada
 * único del pipeline de importación: dado el contenido crudo de un `.ifc`,
 * devuelve una vista previa completa (jerarquía + huella de planta de cada
 * espacio) SIN tocar el store del editor — función pura, testable sin
 * React. La UI (`IfcImportDialog.tsx`) consume este resultado para mostrar
 * qué se detectó y decide qué aplicar.
 */
export interface IfcImportSpacePreview {
    expressId: number;
    globalId: string | null;
    name: string | null;
    /** `null` si el espacio no tiene geometría teselable o resultó degenerada — se muestra así en la UI, nunca se omite en silencio. */
    footprint: IfcSpaceFootprint | null;
}

export interface IfcImportStoreyPreview {
    expressId: number;
    globalId: string | null;
    name: string | null;
    elevationM: number | null;
    spaces: IfcImportSpacePreview[];
}

export interface IfcImportPreview {
    storeys: IfcImportStoreyPreview[];
}

export async function parseIfcFileForImport(data: Uint8Array): Promise<IfcImportPreview> {
    const api = await createIfcApi();
    const modelId = openIfcModel(api, data);
    try {
        const structure = await extractSpatialStructure(api, modelId);
        return {
            storeys: structure.storeys.map((storey) => ({
                expressId: storey.expressId,
                globalId: storey.globalId,
                name: storey.name,
                elevationM: storey.elevationM,
                spaces: storey.spaces.map((space) => ({
                    expressId: space.expressId,
                    globalId: space.globalId,
                    name: space.name,
                    footprint: extractSpaceFootprint(api, modelId, space.expressId),
                })),
            })),
        };
    } finally {
        closeIfcModel(api, modelId);
    }
}
