import { IFCPROJECT, IFCSIUNIT, type IfcAPI } from 'web-ifc';

/**
 * Fase 19 del plan maestro ("BIM/IFC", primer ciclo). Factor de conversión
 * a metros para valores numéricos de longitud LEÍDOS DIRECTAMENTE de
 * atributos IFC (ej. `IfcBuildingStorey.Elevation`) — NO para geometría
 * tesselada: `IfcAPI.GetFlatMesh`/`StreamMeshes` ya devuelve la malla en
 * metros, con la conversión de unidades incluida en `flatTransformation`
 * (verificado por spike, 2026-08-05: un archivo en milímetros produce una
 * escala 0.001 en la matriz sin ninguna acción de este módulo). Este
 * módulo cubre el resto de los casos: cualquier atributo numérico plano
 * que no pase por el motor de geometría.
 *
 * Alcance de este ciclo: solo unidades SI con prefijo estándar
 * (`IfcSIUnit`, ej. METRE/MILLIMETRE/CENTIMETRE). Un proyecto en unidades
 * imperiales (`IfcConversionBasedUnit`, ej. pies/pulgadas) NO está
 * soportado — se devuelve `null` en vez de asumir 1 en silencio (mismo
 * criterio "nunca fabricar un valor" del resto del proyecto).
 */

const SI_PREFIX_SCALE: Record<string, number> = {
    EXA: 1e18,
    PETA: 1e15,
    TERA: 1e12,
    GIGA: 1e9,
    MEGA: 1e6,
    KILO: 1e3,
    HECTO: 1e2,
    DECA: 1e1,
    DECI: 1e-1,
    CENTI: 1e-2,
    MILLI: 1e-3,
    MICRO: 1e-6,
    NANO: 1e-9,
    PICO: 1e-12,
    FEMTO: 1e-15,
    ATTO: 1e-18,
};

/** Lee `.value` (STRING/ENUM/REF) tolerando `null`/`undefined`. */
function readEnumValue(attr: unknown): string | null {
    if (attr && typeof attr === 'object' && 'value' in attr) {
        const value = (attr as { value: unknown }).value;
        return typeof value === 'string' ? value : null;
    }
    return null;
}

/**
 * Factor multiplicativo para convertir un valor numérico de longitud del
 * archivo IFC a metros. `null` si el proyecto no usa una `IfcSIUnit` de
 * longitud (ej. unidades imperiales) — no soportado en este ciclo.
 */
export function getLengthUnitScaleToMeters(api: IfcAPI, modelId: number): number | null {
    const projectIds = api.GetLineIDsWithType(modelId, IFCPROJECT);
    if (projectIds.size() === 0) {
        return null;
    }
    const project = api.GetLine(modelId, projectIds.get(0));
    const unitsInContextRef = project.UnitsInContext?.value;
    if (typeof unitsInContextRef !== 'number') {
        return null;
    }

    const unitAssignment = api.GetLine(modelId, unitsInContextRef);
    const units: Array<{ value: number }> = unitAssignment.Units ?? [];

    for (const unitRef of units) {
        const unit = api.GetLine(modelId, unitRef.value);
        if (unit.type !== IFCSIUNIT) {
            continue;
        }
        if (readEnumValue(unit.UnitType) !== 'LENGTHUNIT') {
            continue;
        }
        const prefix = readEnumValue(unit.Prefix);
        return prefix ? (SI_PREFIX_SCALE[prefix] ?? null) : 1;
    }

    return null;
}

/** Lee un atributo numérico IFC (tipo REAL, ej. `IfcLengthMeasure`) tolerando las dos formas observadas por spike (`_representationValue` y `value`). */
export function readRealValue(attr: unknown): number | null {
    if (!attr || typeof attr !== 'object') {
        return null;
    }
    const withRepr = attr as { _representationValue?: unknown; value?: unknown };
    const candidate = withRepr._representationValue ?? withRepr.value;
    return typeof candidate === 'number' ? candidate : null;
}
