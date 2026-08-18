import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import { GF19140_SUBSTITUTE_PHOTOMETRIC_WEB, TEG18046_PHOTOMETRIC_WEB } from './realPhotometry';

/**
 * Fixtures de benchmark de paridad contra DIALux evo real —
 * `planes/plan_cierre_brecha_paridad_dialux_evo.md` §5.1.
 *
 * Reconstrucción a partir de dos informes PDF reales:
 *   - `MODULO I_Informe.pdf` — DIALux evo real, "Edificación 2 · Planta
 *     (nivel) 1", ambientes "Caseta de control" y "SS.HH".
 *   - `pozuzo-reporte-formal.pdf` — motor propio (PCL, `direct-preview-v1`),
 *     proyecto "Pozuzo", ambientes "Guarderías" y "Baño" — MISMO plano
 *     arquitectónico (idénticas anotaciones "V-1/V-2/V-3", "SP-1/SP-2",
 *     "PROYECCIÓN DE TECHO", cota "2.21" en ambos planos), reagrupado en
 *     ambientes distintos.
 *
 * ACTUALIZACIÓN (2026-08-09): se consiguió el archivo .ldt REAL de fábrica
 * para TEG18046 (descargado del DIALux Luminaire Finder público, misma
 * referencia de artículo — ver procedencia completa en `realPhotometry.ts`)
 * y `sshh-vs-bano` ya lo usa.
 *
 * ACTUALIZACIÓN (2026-08-18): `caseta-vs-guarderias` ya NO usa la
 * aproximación Lambertiana. El usuario entregó su catálogo real de
 * luminarias usadas en proyectos reales ("según plano") — entre ellas, un
 * archivo `.ldt` real de mismo flujo/potencia que GF19140 (26 W/2580 lm),
 * de un fabricante distinto (LTS, no Thorlux) que el usuario confirmó como
 * la luminaria REALMENTE especificada para este tipo de ambiente. No es la
 * referencia Thorlux GF19140 exacta (que sigue sin conseguirse — ver
 * `realPhotometry.ts`), así que sigue habiendo una divergencia de fabricante
 * frente al PDF de referencia — pero es fotometría real de fábrica, no una
 * aproximación matemática, y es la que corresponde a los proyectos reales
 * del usuario. Ver `GF19140_SUBSTITUTE_PHOTOMETRIC_WEB` en
 * `realPhotometry.ts` para la procedencia completa.
 */

export interface DialuxEvoParityFixture {
    id: string;
    label: string;
    /** Página(s) del PDF de origen de donde se leyeron room/fixture/reference. */
    referenceSource: string;
    room: Room;
    fixtures: Fixture[];
    /** Valores reportados por DIALux evo real para este ambiente exacto. */
    reference: {
        avgLux: number;
        minLux: number;
        maxLux: number;
        uniformity: number;
    };
    /** Reflectancia DECLARADA por DIALux evo (Techo/Pared/Piso, 0-1) — la que el ambiente real usó. */
    reflectance: { ceiling: number; wall: number; floor: number };
    /** Notas sobre divergencias de configuración conocidas y NO resueltas todavía (ver plan §2.5). */
    caveats: string[];
    /**
     * `true` cuando TODAS las luminarias del fixture tienen `photometricWeb`
     * real de fabricante (no la aproximación Lambertiana) — solo con esto en
     * `true` tiene sentido comparar `first-bounce` vs. `iterative` para
     * investigar la Causa B (`dialuxEvoParity.test.ts`): con fotometría
     * aproximada, cualquier diferencia entre esos dos modos queda
     * confundida con el error de fotometría, no aísla nada.
     */
    hasRealPhotometry: boolean;
}

/**
 * "SS.HH" (MODULO I_Informe.pdf, DIALux evo real, p.40-41, 47) vs. "Baño"
 * (pozuzo-reporte-formal.pdf, motor propio, p.20, 24) — misma área (2.07 m²),
 * misma luminaria (TEG18046, 14.0 W, 1508 lm), misma altura de montaje
 * (3.500 m). Rectángulo tomado de la nota de UGR de DIALux evo p.41: "Basado
 * en un espacio rectangular de 2.209 m x 0.950 m".
 */
export function buildSsHhVsBanoFixture(): DialuxEvoParityFixture {
    const width = 2.209;
    const depth = 0.95;
    const room: Room = {
        id: 'benchmark-sshh-bano',
        name: 'SS.HH (benchmark vs. DIALux evo)',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: depth },
            { x: 0, y: depth },
        ],
        height: 3.5,
        color: '#000000',
        illuminanceLux: 100,
        usefulPlaneHeight: 0,
        // Zona marginal DECLARADA por DIALux evo para ESTE ambiente
        // (`MODULO I_Informe.pdf` p.40) — Pozuzo/Baño reporta 0.197 m para
        // la misma área nominal, una divergencia de configuración propia,
        // no resuelta (plan §2.5). Se fija aquí la de la referencia para no
        // mezclar dos variables en un mismo fixture.
        marginalZone: 0.125,
    };

    const fixtures: Fixture[] = [
        {
            id: 'benchmark-sshh-bano-teg18046',
            name: 'TEGO IP65 FROSTED GLASS',
            x: width / 2,
            y: depth / 2,
            z: 3.5,
            lumens: 1508,
            power: 14,
            // Ficha de producto (`MODULO I_Informe.pdf` p.8): "η: 100.00%"
            // — todo el flujo de lámpara sale de la luminaria.
            efficiency: 1,
            fixtureType: 'surface',
            brand: 'Thorlux Lighting',
            articleNumber: 'TEG18046',
            lightColor: '#ffffff',
            roomId: 'benchmark-sshh-bano::ambient-1',
            // Fotometría REAL de fábrica (misma referencia de artículo,
            // ver `realPhotometry.ts`) — ya NO es la aproximación
            // Lambertiana genérica.
            photometricWeb: TEG18046_PHOTOMETRIC_WEB,
        },
    ];

    return {
        id: 'sshh-vs-bano',
        label: 'SS.HH (MÓDULO I / DIALux evo) vs. Baño (Pozuzo / motor propio)',
        referenceSource: 'MODULO I_Informe.pdf p.40-41,47 — Thorlux TEG18046',
        room,
        fixtures,
        reference: { avgLux: 144, minLux: 112, maxLux: 164, uniformity: 0.78 },
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
        caveats: [
            'Usa fotometría REAL de fábrica (`realPhotometry.ts::TEG18046_PHOTOMETRIC_WEB`), no la aproximación Lambertiana — ver procedencia completa en ese archivo, incluida la divergencia de flujo (1365 vs. 1508 lm) resuelta vía `reference_lumens`.',
            'Zona marginal fijada a la de DIALux evo (0.125 m); Pozuzo reporta 0.197 m para el mismo ambiente sin explicación conocida (plan §2.5).',
        ],
        hasRealPhotometry: true,
    };
}

/**
 * "Caseta de control" (MODULO I_Informe.pdf, DIALux evo real, p.16-17, 22-23)
 * vs. "Guarderías" (pozuzo-reporte-formal.pdf, motor propio, p.6, 14) —
 * mismo plano físico (cota "2.21" visible en ambos planos importados), área
 * casi idéntica (4.63 vs. 4.61 m²), misma luminaria (GF19140, 26.0 W,
 * 2580 lm), misma altura de montaje (3.500 m) y misma altura de plano útil
 * (0.850 m). Rectángulo y posición de luminaria tomados directamente del
 * "Plano de situación de luminarias" de DIALux evo (p.18-19): dimensiones
 * de arreglo 2.100 m x 2.210 m, luminaria en X=1.065 / Y=1.105 / Z=3.500.
 */
export function buildCasetaVsGuarderiasFixture(): DialuxEvoParityFixture {
    const width = 2.1;
    const depth = 2.21;
    const room: Room = {
        id: 'benchmark-caseta-guarderias',
        name: 'Caseta de control (benchmark vs. DIALux evo)',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: depth },
            { x: 0, y: depth },
        ],
        height: 3.5,
        color: '#000000',
        illuminanceLux: 200,
        usefulPlaneHeight: 0.85,
        // Zona marginal DECLARADA por DIALux evo para ESTE ambiente
        // (`MODULO I_Informe.pdf` p.16) — notablemente mayor que la que
        // Pozuzo/Guarderías reporta para la misma geometría (0.194 m),
        // divergencia de configuración NO resuelta (plan §2.5).
        marginalZone: 0.35,
    };

    const fixtures: Fixture[] = [
        {
            id: 'benchmark-caseta-guarderias-gf19140',
            name: 'G4 LED Plain - 22W - SMART - Corridor Lens - 4000K',
            x: 1.065,
            y: 1.105,
            z: 3.5,
            lumens: 2580,
            power: 26,
            // Ficha de producto (`MODULO I_Informe.pdf` p.7): "η: 100.00%".
            efficiency: 1,
            fixtureType: 'recessed',
            brand: 'Thorlux Lighting',
            articleNumber: 'GF19140',
            lightColor: '#ffffff',
            roomId: 'benchmark-caseta-guarderias::ambient-1',
            // Fotometría REAL de fábrica de un sustituto confirmado por el
            // usuario (LTS, mismo flujo/potencia) — ya NO es la aproximación
            // Lambertiana. Ver doc-comment del módulo y `realPhotometry.ts`.
            photometricWeb: GF19140_SUBSTITUTE_PHOTOMETRIC_WEB,
        },
    ];

    return {
        id: 'caseta-vs-guarderias',
        label: 'Caseta de control (MÓDULO I / DIALux evo) vs. Guarderías (Pozuzo / motor propio)',
        referenceSource: 'MODULO I_Informe.pdf p.16-19,22-23 — Thorlux GF19140',
        room,
        fixtures,
        reference: { avgLux: 203, minLux: 162, maxLux: 231, uniformity: 0.8 },
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
        caveats: [
            'Fotometría real de un SUSTITUTO (LTS, 26W/2580lm), no de la Thorlux GF19140 exacta del PDF de referencia — la Thorlux sigue sin conseguirse. El sustituto lo confirmó el usuario como la luminaria realmente usada en sus proyectos reales para este tipo de ambiente, no una elección arbitraria de esta sesión.',
            'Zona marginal fijada a la de DIALux evo (0.350 m); Pozuzo reporta 0.194 m para el mismo ambiente — confirmado en `plan_cierre_brecha_paridad_dialux_evo.md` §-21j que es un dato viejo del proyecto real, no un bug de fórmula (la fórmula fresca da 0.348 m, casi idéntico a evo).',
        ],
        hasRealPhotometry: true,
    };
}

export function buildAllDialuxEvoParityFixtures(): DialuxEvoParityFixture[] {
    return [buildSsHhVsBanoFixture(), buildCasetaVsGuarderiasFixture()];
}
