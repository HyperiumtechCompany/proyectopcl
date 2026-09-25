/**
 * Catálogo de alumbrado EXTERIOR del emplazamiento (fase X1 de
 * `plan_pendientes_exterior_electrico_documentos.md`). Propio del Módulo
 * General: no modifica el motor normativo de la V1.
 *
 * Fuentes (valores de conocimiento general — PENDIENTES DE CONFIRMAR contra
 * el texto oficial; la interfaz lo declara y compara numéricamente, nunca
 * "cumple"):
 *  - EN 12464-2:2014 — Iluminación de lugares de trabajo exteriores.
 *    Tabla 5.1 (zonas de circulación general) y Tabla 5.9 (estacionamientos):
 *    Ēm mantenida y Uo = Emín/Ē.
 *  - EN 13201-2:2015 — Alumbrado de vías públicas, requisitos de prestación.
 *    Clases P (peatones y baja velocidad): Ē mantenida Y Emín mantenida.
 *    Clases C (zonas de conflicto): Ē mantenida y Uo 0,40.
 * Las clases M (luminancia de calzada) no se incluyen: requieren el cálculo de
 * luminancia con tablas r, que el sistema todavía no hace.
 */

export interface ExteriorNormEntry {
    key: string;
    category: string;
    title: string;
    /** Ē mantenida mínima (lx). */
    illuminanceLux: number;
    /** Uo = Emín/Ē mínima (null si la norma fija Emín en vez de Uo). */
    uniformity: number | null;
    /** Emín mantenida (lx) — clases P de EN 13201-2. */
    minLux: number | null;
    ra: number | null;
    source: string;
}

const EN_12464_2 = 'EN 12464-2:2014';
const EN_13201_2 = 'EN 13201-2:2015';

const entry = (
    category: string,
    title: string,
    illuminanceLux: number,
    uniformity: number | null,
    minLux: number | null,
    ra: number | null,
    source: string,
): ExteriorNormEntry => ({
    key: `${category} › ${title}`,
    category,
    title,
    illuminanceLux,
    uniformity,
    minLux,
    ra,
    source,
});

export const EXTERIOR_NORM_CATALOG: ExteriorNormEntry[] = [
    // EN 12464-2:2014 Tabla 5.1 — circulación general en lugares de trabajo exteriores.
    entry('EN 12464-2 · Circulación', 'Vías exclusivamente peatonales', 5, 0.25, null, 20, `${EN_12464_2}, Tabla 5.1`),
    entry('EN 12464-2 · Circulación', 'Tránsito de vehículos lentos (máx. 10 km/h)', 10, 0.4, null, 20, `${EN_12464_2}, Tabla 5.1`),
    entry('EN 12464-2 · Circulación', 'Tránsito vehicular regular (máx. 40 km/h)', 20, 0.4, null, 20, `${EN_12464_2}, Tabla 5.1`),
    entry('EN 12464-2 · Circulación', 'Pasos peatonales, giro de vehículos, carga y descarga', 50, 0.4, null, 20, `${EN_12464_2}, Tabla 5.1`),
    // EN 12464-2:2014 Tabla 5.9 — estacionamientos.
    entry('EN 12464-2 · Estacionamientos', 'Tránsito ligero (viviendas, comercios pequeños, bicicletas)', 5, 0.25, null, 20, `${EN_12464_2}, Tabla 5.9`),
    entry('EN 12464-2 · Estacionamientos', 'Tránsito medio (oficinas, colegios, complejos deportivos)', 10, 0.25, null, 20, `${EN_12464_2}, Tabla 5.9`),
    entry('EN 12464-2 · Estacionamientos', 'Tránsito intenso (grandes centros comerciales y deportivos)', 20, 0.25, null, 20, `${EN_12464_2}, Tabla 5.9`),
    // EN 13201-2:2015 — clases P (Ē y Emín mantenidas).
    entry('EN 13201-2 · Clases P (peatonal / baja velocidad)', 'P1', 15, null, 3, null, EN_13201_2),
    entry('EN 13201-2 · Clases P (peatonal / baja velocidad)', 'P2', 10, null, 2, null, EN_13201_2),
    entry('EN 13201-2 · Clases P (peatonal / baja velocidad)', 'P3', 7.5, null, 1.5, null, EN_13201_2),
    entry('EN 13201-2 · Clases P (peatonal / baja velocidad)', 'P4', 5, null, 1, null, EN_13201_2),
    entry('EN 13201-2 · Clases P (peatonal / baja velocidad)', 'P5', 3, null, 0.6, null, EN_13201_2),
    entry('EN 13201-2 · Clases P (peatonal / baja velocidad)', 'P6', 2, null, 0.4, null, EN_13201_2),
    // EN 13201-2:2015 — clases C (zonas de conflicto), Uo 0,40.
    entry('EN 13201-2 · Clases C (zonas de conflicto)', 'C0', 50, 0.4, null, null, EN_13201_2),
    entry('EN 13201-2 · Clases C (zonas de conflicto)', 'C1', 30, 0.4, null, null, EN_13201_2),
    entry('EN 13201-2 · Clases C (zonas de conflicto)', 'C2', 20, 0.4, null, null, EN_13201_2),
    entry('EN 13201-2 · Clases C (zonas de conflicto)', 'C3', 15, 0.4, null, null, EN_13201_2),
    entry('EN 13201-2 · Clases C (zonas de conflicto)', 'C4', 10, 0.4, null, null, EN_13201_2),
    entry('EN 13201-2 · Clases C (zonas de conflicto)', 'C5', 7.5, 0.4, null, null, EN_13201_2),
];

export const EXTERIOR_NORM_SOURCE =
    'EN 12464-2:2014 / EN 13201-2:2015 (valores pendientes de confirmar contra el texto oficial)';
