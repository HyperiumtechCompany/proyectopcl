import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import { TEG18046_PHOTOMETRIC_WEB } from './realPhotometry';

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
 * y `sshh-vs-bano` ya lo usa. **GF19140 sigue sin fotometría real** — se
 * intentó descargarla y no se consiguió (ver el "NO se pudo obtener" en
 * `realPhotometry.ts`), así que `caseta-vs-guarderias` sigue cayendo al
 * modelo Lambertiano `I(γ) = (lumens·efficiency/π)·cos(γ)` en
 * `hooks/photometricInterpolation.ts::candela()`.
 *
 * LIMITACIÓN DECLARADA que sigue vigente para `caseta-vs-guarderias`: la
 * aproximación Lambertiana es MALA para GF19140 ("Corridor Lens", una
 * óptica marcadamente asimétrica entre los planos C0-C180 y C90-C270, con
 * pico real ~600-800 cd/klm contra ~318 cd/klm de un Lambertiano ideal a
 * igual flujo — leído de `MODULO I_Informe.pdf` p.7, eje "cd/klm"). El
 * motor subestima el directo sistemáticamente para esa luminaria mientras
 * no se importe su .ldt/.ies real — no una curva "a ojo" digitalizada del
 * gráfico (que introduciría una precisión falsa sin ser realmente más
 * confiable). Este fixture en particular NO se usa para afirmar un
 * porcentaje de error objetivo — se usa para (a) bloquear una regresión de
 * la Causa A (reflectancia no asignada → cero interreflexión) y (b) dejar
 * un número de referencia trazable de cuánto se acerca/aleja el resultado
 * con la aproximación actual, para detectar una regresión grande (ej. un
 * error de unidades) — ver el test correspondiente para el detalle de qué
 * SÍ se afirma con confianza y qué no.
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
            'Sin archivo IES/LDT real de GF19140 — su óptica "Corridor Lens" es marcadamente asimétrica (ver CDL polar, ficha p.7) y su pico real (~600-800 cd/klm) es 2-2.5x más concentrado que un Lambertiano ideal; la aproximación usada aquí no reproduce esa asimetría ni ese pico.',
            'Zona marginal fijada a la de DIALux evo (0.350 m); Pozuzo reporta 0.194 m para el mismo ambiente sin explicación conocida (plan §2.5).',
            'Medido empíricamente (ver `dialuxEvoParity.test.ts`): el error con esta luminaria resultó MENOR que en "sshh-vs-bano" (~47% vs. ~72%) cuando ambos usaban Lambertiano, pese a que su concentración relativa es menor (2-2.5x vs. 2.8x) — no asumir una relación lineal simple entre "cuán Lambertiano no es" un pico y el error final; otros factores (geometría del recinto, posición relativa) también pesan.',
        ],
        hasRealPhotometry: false,
    };
}

export function buildAllDialuxEvoParityFixtures(): DialuxEvoParityFixture[] {
    return [buildSsHhVsBanoFixture(), buildCasetaVsGuarderiasFixture()];
}
