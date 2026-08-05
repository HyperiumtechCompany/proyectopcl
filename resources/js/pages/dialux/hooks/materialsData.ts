/**
 * Catalogo de presets de reflectancia superficial (Fase 16 del plan
 * maestro, "Biblioteca de materiales"). Alimenta directamente
 * `room.ceilingReflectance`/`wallReflectance`/`floorReflectance`
 * (`hooks/types.ts`), que `resolveMaterialId()`
 * (`domain/calculation/buildCalculationSnapshot.ts`) ya consume para el
 * calculo de interreflexion de primer rebote.
 *
 * Trazabilidad (revisado con `chief-electrical-engineer-reviewer`,
 * 2026-08-05): solo el trio 0.70/0.50/0.20 tiene respaldo normativo
 * verificable con certeza -- es la sala de referencia estandar de
 * CIE 117-1995 para tablas UGR (reutilizada por CIE 190:2010). Los
 * acabados especificos (blanco, pintura clara, concreto, madera, etc.)
 * NO provienen textualmente de una tabla normativa que se pueda citar
 * con certeza -- EN 12464-1/ISO 8995 mencionan rangos de reflectancia
 * recomendada en fuentes secundarias, pero sin edicion/clausula/tabla
 * verificada, por lo que se marcan explicitamente como
 * "estimacion no normativa" en vez de inventar una cita. Nunca
 * presentar estos valores como "el" valor correcto de un acabado real:
 * dependen de color, textura, suciedad y envejecimiento -- son
 * orientativos, no sustituyen una medicion con reflectometro.
 */
export interface SurfaceMaterialPreset {
    id: string;
    label: string;
    /** Reflectancia 0-1. */
    reflectance: number;
    source: string;
}

export const SURFACE_MATERIAL_PRESETS: SurfaceMaterialPreset[] = [
    {
        id: 'reference-ceiling',
        label: 'Referencia CIE (techo, 0.70)',
        reflectance: 0.7,
        source: 'CIE 117-1995 -- sala de referencia UGR (techo/pared/piso 70/50/20)',
    },
    {
        id: 'white-plaster',
        label: 'Blanco / yeso nuevo',
        reflectance: 0.82,
        source: 'estimacion no normativa (rango tipico industria 0.75-0.90)',
    },
    {
        id: 'light-paint',
        label: 'Pintura clara',
        reflectance: 0.67,
        source: 'estimacion no normativa (rango tipico industria 0.60-0.75)',
    },
    {
        id: 'reference-wall',
        label: 'Referencia CIE (pared, 0.50)',
        reflectance: 0.5,
        source: 'CIE 117-1995 -- sala de referencia UGR (techo/pared/piso 70/50/20)',
    },
    {
        id: 'medium-tone',
        label: 'Tono medio',
        reflectance: 0.5,
        source: 'estimacion no normativa (rango tipico industria 0.40-0.60)',
    },
    {
        id: 'light-wood',
        label: 'Madera clara',
        reflectance: 0.45,
        source: 'estimacion no normativa (rango tipico industria 0.35-0.55)',
    },
    {
        id: 'exposed-concrete',
        label: 'Concreto visto',
        reflectance: 0.4,
        source: 'estimacion no normativa (rango tipico industria 0.30-0.50)',
    },
    {
        id: 'face-brick',
        label: 'Ladrillo caravista',
        reflectance: 0.28,
        source: 'estimacion no normativa (rango tipico industria 0.20-0.35)',
    },
    {
        id: 'reference-floor',
        label: 'Referencia CIE (piso, 0.20)',
        reflectance: 0.2,
        source: 'CIE 117-1995 -- sala de referencia UGR (techo/pared/piso 70/50/20)',
    },
    {
        id: 'dark-tone',
        label: 'Tono oscuro',
        reflectance: 0.18,
        source: 'estimacion no normativa (rango tipico industria 0.10-0.25)',
    },
];

export function getSurfaceMaterialPreset(id: string): SurfaceMaterialPreset | null {
    return SURFACE_MATERIAL_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** Encuentra el preset cuyo valor coincide exactamente con `reflectance`, si existe (para reflejar la seleccion vigente en la UI). */
export function findSurfaceMaterialPresetByValue(reflectance: number | null | undefined): SurfaceMaterialPreset | null {
    if (reflectance === null || reflectance === undefined) {
        return null;
    }
    return SURFACE_MATERIAL_PRESETS.find((preset) => preset.reflectance === reflectance) ?? null;
}
