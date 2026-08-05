/**
 * Catalogo de presets de transmitancia luminosa visible de vidrio (tv, 0-1)
 * -- Fase 17 del plan maestro ("Luz natural", Daylight Factor). Alimenta
 * `Window.glazingTransmittance` (`hooks/types.ts`), que `daylightFactorEngine.ts`
 * ya consume para la componente de cielo (SC) del calculo.
 *
 * Trazabilidad (revisado con `chief-electrical-engineer-reviewer`,
 * 2026-08-05): EN 410:2011 e ISO 9050:2003/1990 SOLO definen el METODO para
 * medir/calcular tv de un vidrio real ensayado -- no publican una tabla de
 * valores tipicos por categoria generica de vidrio de construccion. Por eso
 * ningun valor numerico de este catalogo se atribuye a esas normas: todos
 * son "estimacion no normativa" tomada de literatura tecnica de industria,
 * nunca "el" valor correcto de un vidrio real (depende del espesor,
 * fabricante y recubrimiento especifico -- son orientativos, no sustituyen
 * la ficha tecnica del vidrio real instalado).
 */
export interface GlazingPreset {
    id: string;
    label: string;
    /** Transmitancia luminosa visible 0-1. */
    transmittance: number;
    source: string;
}

export const GLAZING_PRESETS: GlazingPreset[] = [
    {
        id: 'single-clear',
        label: 'Vidrio simple claro (float)',
        transmittance: 0.89,
        source: 'estimacion no normativa (rango tipico industria 0.88-0.90; metodo de medicion: ISO 9050 / EN 410)',
    },
    {
        id: 'double-clear',
        label: 'Vidrio doble (DVH/IGU) claro',
        transmittance: 0.8,
        source: 'estimacion no normativa (rango tipico industria 0.78-0.82; metodo de medicion: ISO 9050 / EN 410)',
    },
    {
        id: 'laminated-clear',
        label: 'Vidrio laminado claro (2 capas + PVB)',
        transmittance: 0.865,
        source: 'estimacion no normativa (equivalente monolitico 0.85-0.88; segun espesor de PVB puede bajar a 0.60-0.75; metodo de medicion: ISO 9050 / EN 410)',
    },
    {
        id: 'solar-control-neutral',
        label: 'Control solar low-E / reflectivo (tono neutro)',
        transmittance: 0.5,
        source: 'estimacion no normativa (rango muy amplio 0.35-0.70, depende enteramente del recubrimiento del fabricante; metodo de medicion: ISO 9050 / EN 410)',
    },
    {
        id: 'tinted',
        label: 'Vidrio tintado (bronce/gris/verde)',
        transmittance: 0.35,
        source: 'estimacion no normativa (rango amplio 0.14-0.55 segun color y espesor; metodo de medicion: ISO 9050 / EN 410)',
    },
];

export function getGlazingPreset(id: string): GlazingPreset | null {
    return GLAZING_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** Encuentra el preset cuyo valor coincide exactamente con `transmittance`, si existe (para reflejar la seleccion vigente en la UI). */
export function findGlazingPresetByValue(transmittance: number | null | undefined): GlazingPreset | null {
    if (transmittance === null || transmittance === undefined) {
        return null;
    }
    return GLAZING_PRESETS.find((preset) => preset.transmittance === transmittance) ?? null;
}
