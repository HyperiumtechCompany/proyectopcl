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
 * `GF19140_PHOTOMETRIC_WEB`: NO se pudo obtener. Se intentó descargar desde
 * el DIALux Luminaire Finder (la página de artículo específica devolvió 404
 * en repetidos intentos, con y sin variar el locale de la URL) y desde
 * thorlux.com/thorlux.co.uk directamente (todas las rutas probadas —
 * `/products/g4/downloads`, `/products/g4`, `/v4/en/products/g4` —
 * devolvieron 404 vía fetch simple; el sitio probablemente renderiza estas
 * páginas con JavaScript del lado del cliente, no accesible con una
 * petición HTTP simple). GF19140 sigue usando la aproximación Lambertiana
 * en `fixtures.ts` hasta que alguien con acceso a DIALux evo/el sitio de
 * Thorlux (o una cuenta que permita exportar el .ldt/.ies desde el propio
 * software) lo consiga y lo agregue aquí con la misma trazabilidad.
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
