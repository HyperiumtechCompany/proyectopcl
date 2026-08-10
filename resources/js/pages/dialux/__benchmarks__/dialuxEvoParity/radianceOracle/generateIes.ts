import { candela } from '@/pages/dialux/hooks/photometricInterpolation';
import type { Fixture } from '@/pages/dialux/hooks/types';

/**
 * Genera un archivo IES (LM-63-2002, tipo C, simetría rotacional completa)
 * a partir de un `Fixture` de este proyecto — real (`photometricWeb`
 * presente, `provenance: 'manufacturer'`) o aproximado (sin
 * `photometricWeb`, cae al modelo Lambertiano de
 * `hooks/photometricInterpolation.ts::candela()`).
 *
 * DECISIÓN DE DISEÑO: los valores de candela se obtienen llamando
 * `candela(fixture, gamma, 0)` — la MISMA función que usa el motor de
 * cálculo real — en vez de copiar manualmente una tabla de candelas. Así el
 * oráculo de Radiance siempre compara contra lo que el motor REALMENTE
 * calcula hoy, incluso si `candela()`/el modelo Lambertiano cambian en el
 * futuro. Es también más simple que la primera versión manual de esto
 * (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-6): `candela()` ya
 * devuelve el valor final reescalado a `fixture.lumens`, así que no hace
 * falta ningún multiplicador adicional al insertarlo en la escena Radiance.
 *
 * LIMITACIÓN DECLARADA: solo soporta luminarias rotacionalmente simétricas
 * (`c_angles` de un solo valor, o el fallback Lambertiano, que también lo
 * es) — suficiente para los dos fixtures de `dialuxEvoParity` hoy. Una
 * óptica asimétrica real (ej. GF19140 "Corridor Lens", si se consigue su
 * IES/LDT real) necesitaría muestrear varios planos C, no solo uno — ver
 * `GAMMA_STEPS_DEG`/extender `horizontalAngles` cuando llegue ese caso.
 */

const GAMMA_STEPS_DEG = [
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130,
    135, 140, 145, 150, 155, 160, 165, 170, 175, 180,
];

export interface GenerateIesOptions {
    /** Nombre para las cabeceras [LUMCAT]/[LUMINAIRE] del IES — solo metadata, no afecta el cálculo. */
    label: string;
    manufacturer: string;
    articleNumber: string;
    /** Nota de procedencia — se escribe como comentario `[_PCLNOTE]` en el IES, para trazabilidad. */
    provenanceNote: string;
}

export function generateIesFromFixture(fixture: Fixture, options: GenerateIesOptions): string {
    const candelaValues = GAMMA_STEPS_DEG.map((gamma) => candela(fixture, gamma, 0));
    const wattage = fixture.power ?? 0;

    const header = [
        'IESNA:LM-63-2002',
        `[TEST] ${options.provenanceNote}`,
        `[MANUFAC] ${options.manufacturer}`,
        `[LUMCAT] ${options.articleNumber}`,
        `[LUMINAIRE] ${options.label}`,
        'TILT=NONE',
    ];

    // <num lamps> <lumens/lamp> <candela multiplier> <num vert angles>
    // <num horiz angles> <photometric type=1 (C)> <units=2 (m)> <w> <l> <h>
    const line1 = `1 ${fixture.lumens} 1 ${GAMMA_STEPS_DEG.length} 1 1 2 0 0 0`;
    // <ballast factor> <future use=1> <input watts>
    const line2 = `1 1 ${wattage}`;
    const verticalAngles = GAMMA_STEPS_DEG.join(' ');
    const horizontalAngles = '0';
    const candelaLine = candelaValues.map((value) => value.toFixed(4)).join(' ');

    return [...header, line1, line2, verticalAngles, horizontalAngles, candelaLine, ''].join('\n');
}
