import type { Project } from '@/pages/dialux/hooks/types';
import { DEFAULT_DIRECT_PREVIEW_CONFIG, type CalculationConfig } from './types';

/**
 * Configuración de cálculo "de producción" — la que debe usar CUALQUIER
 * camino que produzca un resultado que un usuario vaya a leer como
 * definitivo (botón "Calcular" de `EditorLayout.tsx` y el recálculo de
 * respaldo de `resolveCalculationRunForExport.ts` cuando no hay una
 * ejecución cacheada vigente). Antes de esta función esos dos sitios
 * construían el `CalculationConfig` por separado y habían divergido: el
 * botón "Calcular" ya activaba `meshPolicy.adaptive` y
 * `excludeMarginalZoneFromStats`, pero el recálculo de respaldo del export
 * llamaba `runProjectLightingCalculation(project)` sin config — es decir,
 * con el `DEFAULT_DIRECT_PREVIEW_CONFIG` "crudo" — así que un PDF exportado
 * sin haber pulsado antes "Calcular" (o tras una edición que invalida el
 * caché) podía mostrar números distintos a los del panel de resultados
 * para el MISMO proyecto. Este helper es la única fuente de verdad para
 * ambos casos.
 *
 * `interreflection: 'first-bounce'` (NO `'iterative'` — decisión evaluada
 * y descartada DOS VECES, dejar registro para no repetir el experimento a
 * ciegas): con radiosidad iterativa convergida, SS.HH (real, 2.15 m²,
 * 4.67 m de alto) da Ē≈294 lx vs los 206 lx que reporta DIALux evo para el
 * MISMO recinto/reflectancias/luminarias — un +43% que `first-bounce` no
 * tiene (+9.6%). Primera hipótesis (parche de pared sin subdividir en
 * `roomPatches.ts` colapsando el campo cercano, área de pared ≈28 m² en un
 * solo parche): implementada la subdivisión vertical
 * (`wallVerticalSegments`, activa cuando una pared sería más alta que la
 * dimensión horizontal más corta del recinto) — el resultado SOLO bajó a
 * ≈282 lx, sigue +37% sobre DIALux evo. Es decir: la subdivisión de parches
 * SÍ ayuda (y queda activa porque no tiene contra, no cambia nada en
 * recintos de proporción normal — ver tests de `roomPatches.test.ts`), pero
 * NO es la causa completa. La relación total/directo empírica del solver
 * (≈1.9-2.0) coincide con el límite asintótico teórico del método de
 * cavidad zonal 1/(1-ρ̄) para ρ̄≈0.49 — el solver converge correctamente a
 * lo que la física de ESTE modelo predice; lo que sigue sin explicarse es
 * por qué DIALux evo, con las mismas reflectancias declaradas, reporta un
 * ratio total/directo mucho menor (~1.37) específicamente en este recinto
 * angosto — probablemente un tratamiento interno de cavidad/geometría que
 * esta plataforma no reproduce todavía. Queda como investigación abierta,
 * no como tarea de una línea; hasta resolverla, `'iterative'` se queda
 * apagado en producción porque el error que evita (+9.6% con first-bounce)
 * es menor y más predecible que el que introduce (+37-43%).
 *
 * `maxBounces`/`convergenceTolerance` se dejan en los defaults (0/0,
 * ignorados en modo `first-bounce`) — quedan documentados aquí para quien
 * reactive `'iterative'` más adelante: `maxBounces: 100`,
 * `convergenceTolerance: 1e-5` son razonables (`iterativeRadiosity.ts`
 * documenta que 60-150 iteraciones alcanzan incluso reflectancias 0.9-0.95
 * a tolerancia 1e-6, y que el costo computacional es trivial hasta el techo
 * `MAX_SAFE_BOUNCES = 300`) UNA VEZ resuelta la subdivisión de parches.
 *
 * CONTRAEVIDENCIA (2026-08-09, `planes/plan_cierre_brecha_paridad_dialux_evo.md`
 * §-3, `__benchmarks__/dialuxEvoParity/dialuxEvoParity.test.ts` caso
 * `sshh-vs-bano`): el experimento de arriba se hizo SIEMPRE con fotometría
 * aproximada (Lambertiana) para la luminaria, porque no había archivo
 * IES/LDT real disponible. Al conseguir el .ldt real de fábrica de una
 * luminaria (Thorlux TEG18046, misma referencia de artículo que un ambiente
 * real de `MODULO I_Informe.pdf`) y repetir la comparación con esa variable
 * corregida, el resultado se INVIRTIÓ: `first-bounce` da 87.9 lx (error
 * 38.9%) contra la referencia de 144 lx, e `iterative` (maxBounces=30) da
 * 111.0 lx (error 22.9%) — `iterative` quedó MÁS cerca de DIALux evo, no
 * más lejos. Esto es un solo caso nuevo (no reemplaza el anterior, lo
 * contradice) y NO es evidencia suficiente para cambiar el default de esta
 * función — el propio plan (§7) prohíbe ajustar sobre un solo caso. Pero sí
 * es evidencia de que la conclusión "`iterative` empeora frente a DIALux
 * evo" pudo haber sido, en parte o del todo, un artefacto de comparar con
 * fotometría Lambertiana en AMBOS experimentos originales (SS.HH 2.15 m²
 * arriba), no una propiedad real del solver de radiosidad. Antes de tocar
 * este default: repetir el experimento con fotometría real en 3-4 casos
 * más (idealmente incluyendo una reproducción del caso SS.HH 2.15 m²/4.67 m
 * original con su luminaria real, si se puede identificar) y solo entonces
 * decidir con una muestra, no con un caso aislado en cualquiera de las dos
 * direcciones.
 */
export function buildProductionCalculationConfig(project: Project): CalculationConfig {
    return {
        ...DEFAULT_DIRECT_PREVIEW_CONFIG,
        maintenanceFactor: project.siteSettings?.maintenanceFactor ?? DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor,
        interreflection: 'first-bounce',
        meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: true },
        excludeMarginalZoneFromStats: true,
    };
}
