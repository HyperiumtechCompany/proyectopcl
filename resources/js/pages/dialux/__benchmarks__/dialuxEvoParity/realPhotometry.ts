import type { Fixture } from '@/pages/dialux/hooks/types';

/**
 * Fotometría REAL de fabricante (Eulumdat/.ldt), no la aproximación
 * Lambertiana usada en `fixtures.ts` — `planes/plan_cierre_brecha_paridad_dialux_evo.md`
 * §-1 identificó la falta de esta fotometría como la causa dominante del
 * error medido en el benchmark.
 *
 * PROCEDENCIA (declarar siempre antes de confiar en este archivo):
 *
 * `TEG18046_PHOTOMETRIC_WEB` — descargado el 2026-08-09 desde el DIALux
 * Luminaire Finder público (`https://luminaires.dialux.com/en/article/IBEb4OUjTx-Fw1Fth7BYVg`,
 * "Tego IP65 Frosted Glass LED - 14W - 4000K"), archivo
 * `47988.ldt` dentro del ZIP publicado por Thorlux Lighting. El artículo,
 * nombre y fabricante dentro del propio archivo (líneas 8-11 del .ldt:
 * "TEG18046" / "TEGO IP65 FROSTED GLASS") coinciden EXACTAMENTE con la
 * luminaria de `MODULO I_Informe.pdf` (Thorlux TEG18046) — es la fotometría
 * real de la MISMA referencia de artículo, no una aproximación de familia.
 *
 * Única divergencia conocida: el .ldt (fechado 24/08/2017 en su propio
 * encabezado) declara un flujo de lámpara de 1365 lm, mientras que
 * `MODULO I_Informe.pdf` declara 1508 lm para esta luminaria (una revisión
 * de flujo posterior, no reflejada en este archivo de 2017 públicamente
 * disponible). Se resuelve declarando `reference_lumens: 1365` — el propio
 * campo existe exactamente para esto (`hooks/types.ts::Fixture.photometricWeb`)
 * — y fijando `fixture.lumens: 1508` en el fixture que lo use: el motor
 * reescala la curva real (`candela() en hooks/photometricInterpolation.ts`)
 * sin alterar su FORMA angular, que es el dato que antes faltaba por
 * completo (Lambertiano no reproduce en absoluto).
 *
 * CORRECCIÓN (2026-08-09, ronda posterior): los valores de `candela` de
 * abajo estaban MAL calculados en la versión original de este archivo — se
 * habían copiado tal cual del archivo .ldt sin aplicar la conversión
 * "cd/klm → cd" que exige el propio formato Eulumdat. Las tablas de
 * candela de un .ldt están expresadas en candela POR KILOLUMEN, no en
 * candela absoluta al flujo declarado — hay que multiplicar cada valor por
 * `lumens/1000` (aquí, ×1.365) antes de tratarlas como candela real. Esto
 * se descubrió al importar el MISMO archivo `47988.ldt` al catálogo real
 * de la aplicación (`ProductImportService::parseLdt()`, que sí aplica
 * `$scale = $lumens / 1000.0; // cd/klm → cd` — ver esa función para la
 * fuente de verdad) y comparar el resultado contra este archivo: los
 * valores no coincidían por un factor exacto de 1.365. Los valores de
 * abajo ya están corregidos (verificados byte a byte contra
 * `LuminaireProduct::find(<id del producto TEG18046 importado>)->photometric_web`
 * en la base de datos real). Cualquier cálculo de las rondas anteriores a
 * esta corrección que haya usado la fotometría "real" de TEG18046
 * subestimó el resultado en ~36.5% — hay que volver a correr los
 * benchmarks después de este cambio, no asumir que los números viejos
 * siguen vigentes.
 *
 * `GF19140_PHOTOMETRIC_WEB` (Thorlux, exacto): sigue sin conseguirse — se
 * intentó descargar desde el DIALux Luminaire Finder (404 repetido) y desde
 * thorlux.com/thorlux.co.uk directamente (404 en todas las rutas probadas,
 * el sitio renderiza esas páginas con JS del lado del cliente). Ver
 * `GF19140_SUBSTITUTE_PHOTOMETRIC_WEB` abajo para lo que SÍ se consiguió.
 *
 * `GF19140_SUBSTITUTE_PHOTOMETRIC_WEB` — NO es la luminaria Thorlux GF19140
 * exacta: es un SUSTITUTO real, mismo flujo/potencia declarados (26 W /
 * 2580 lm), que el usuario confirmó como la luminaria REALMENTE especificada
 * en sus proyectos reales ("según plano") para este caso, entregado como
 * archivo `.ldt` (`60739.ldt`, fabricante "LTS Licht & Leuchten", nombre
 * interno "FLIQ 400.3040.01_FLIQZ 400.24") — carpeta
 * `Catalogo_Luminarias/LUMINARIAS PARA DIALUX/3. 26w - 2580 lm - SEGUN PLANO/`,
 * 2026-08-18. Importado al catálogo real de la aplicación vía
 * `ProductImportService::import()` (no un parser paralelo) como
 * `LuminaireProduct` id=60, `photometric_web.provenance: 'manufacturer'` —
 * los valores de abajo son una copia byte a byte de ese registro real en
 * base de datos (mismo método de verificación que exige el comentario de
 * `TEG18046_PHOTOMETRIC_WEB` arriba), ya en candela absoluta (no cd/klm).
 * Pico real 1639.5 cd → 635.5 cd/klm, dentro del rango 600-800 cd/klm que
 * `fixtures.ts` ya estimaba para el pico real de una óptica "Corridor Lens"
 * antes de conseguir este archivo — consistente con la caracterización
 * previa, no una coincidencia sospechosa.
 *
 * Nota separada, sin resolver: el catálogo real de la aplicación YA tenía
 * un producto con el mismo nombre interno "FLIQ 400.3040.01_FLIQZ 400.24"
 * (id=9, `source_file_name: 108192.ldt`, 3411.1 lm) importado el
 * 2026-08-06 — un archivo `.ldt` DISTINTO al `60739.ldt` de esta ronda,
 * mismo nombre de familia pero variante de flujo distinta. No se tocó ni
 * se reemplazó ese registro — quedan ambos en el catálogo (id=9 y id=60)
 * hasta que el usuario confirme cuál corresponde a qué proyecto real.
 */
export const TEG18046_PHOTOMETRIC_WEB: NonNullable<Fixture['photometricWeb']> = {
    // Isym=1 en el .ldt original (simetría rotacional completa) — un solo
    // plano C alcanza para describir toda la distribución.
    c_angles: [0],
    gamma_angles: [
        0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125,
        130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180,
    ],
    candela: [
        [
            1681.06575, 1627.47585, 1478.85465, 1264.05825, 1020.46035, 775.60665, 564.018, 388.1514, 258.6129,
            168.1134, 110.565, 74.29695, 51.74715, 36.02235, 24.47445, 15.6429, 8.9544, 4.6683, 0.45045, 0.09555,
            0.09555, 0.09555, 0.1092, 0.1365, 0.1638, 0.20475, 0.273, 0.3822, 0.5187, 0.72345, 0.96915, 1.18755,
            1.4742, 1.7199, 1.95195, 2.0475, 1.95195,
        ],
    ],
    reference_lumens: 1365,
    provenance: 'manufacturer',
    symmetry: 1,
};

/** Ver doc-comment del módulo — sustituto real de GF19140, no la referencia Thorlux exacta. */
export const GF19140_SUBSTITUTE_PHOTOMETRIC_WEB: NonNullable<Fixture['photometricWeb']> = {
    c_angles: [0],
    gamma_angles: [
        0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5, 55,
        57.5, 60, 62.5, 65, 67.5, 70, 72.5, 75, 77.5, 80, 82.5, 85, 87.5, 90, 92.5, 95, 97.5, 100, 102.5, 105, 107.5,
        110, 112.5, 115, 117.5, 120, 122.5, 125, 127.5, 130, 132.5, 135, 137.5, 140, 142.5, 145, 147.5, 150, 152.5,
        155, 157.5, 160, 162.5, 165, 167.5, 170, 172.5, 175, 177.5, 180,
    ],
    candela: [
        [
            1639.513, 1632.753, 1618.099, 1598, 1569.853, 1532.881, 1488.067, 1433.5, 1370.522, 1299.623, 1221.037,
            1136.593, 1047.97, 956.638, 864.842, 774.181, 686.848, 603.952, 526.449, 455.963, 392.366, 335.761,
            286.612, 243.681, 206.477, 174.847, 147.576, 124.046, 103.922, 86.12, 70.176, 55.831, 42.57, 30.212,
            18.731, 8.204, 0.593, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
        ],
    ],
    reference_lumens: 2580,
    provenance: 'manufacturer',
    symmetry: 1,
};
