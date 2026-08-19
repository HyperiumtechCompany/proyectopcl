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
 * ## Historia de `interreflection` en este archivo (para no repetir el
 * experimento a ciegas — Ronda 21i, 2026-08-18)
 *
 * Durante mucho tiempo el default fue `'first-bounce'` a secas: con
 * radiosidad iterativa convergida, "SS.HH" (real, 2.15 m², proyecto
 * "Módulo 22") daba Ē≈294 lx vs los 206 lx de DIALux evo (+43%, mientras
 * `first-bounce` solo tenía +9.6%). Pero rondas posteriores (con fotometría
 * REAL en vez de la aproximación Lambertiana original) invirtieron ese
 * resultado en otros casos, y el oráculo Radiance (`plan_cierre_brecha_paridad_dialux_evo.md`)
 * terminó mostrando un patrón consistente: **ambientes elongados
 * (aspecto bounding-box ≥ ~2.3:1) favorecen `first-bounce`; ambientes
 * compactos/casi cuadrados (≤ ~1.5:1) favorecen `iterative`** — no hay un
 * modo ganador universal. El plan lo documentó como "hipótesis, no regla
 * — pocos casos" y nunca cambió este default por eso.
 *
 * El usuario, informado explícitamente de ese riesgo (incluyendo el caso
 * +43% de arriba), pidió automatizar la selección por forma de todos modos:
 * con la variedad real de tipos de ambiente/proyecto del sistema, pedirle
 * que configure el modo ambiente por ambiente no es viable. `'auto-by-shape'`
 * (`interreflectionModeHeuristic.ts`) implementa exactamente ese patrón, con
 * el umbral (2.0:1) elegido a propósito en el medio del hueco documentado —
 * verificado contra el proyecto real "Módulo 22": "SS.HH" (aspecto 2.40:1,
 * el caso +43% de arriba) cae del lado correcto (`first-bounce`), "Caseta de
 * Control" (aspecto 1.12:1) cae en `iterative`. Sigue siendo una heurística
 * sobre evidencia limitada, no una garantía — cada ambiente que la use
 * declara un warning (`interreflection-mode-auto-selected`) con su relación
 * de aspecto exacta, visible en el PDF/panel, para que nunca sea un cambio
 * de método silencioso.
 *
 * `maxBounces: 100`/`convergenceTolerance: 1e-5`: `iterativeRadiosity.ts`
 * documenta que 60-150 iteraciones alcanzan incluso reflectancias 0.9-0.95 a
 * tolerancia 1e-6, con costo trivial hasta el techo `MAX_SAFE_BOUNCES = 300`
 * — la subdivisión de parches de pared (`wallVerticalSegments`) que en su
 * momento bloqueaba subir estos valores ya está implementada y activa.
 *
 * `occlusion` — historia completa antes de reactivarlo (Ronda 21l→23,
 * 2026-08-19), para no repetir el ciclo:
 *
 *   1. (21l) Se activó pensando que el pipeline ya estaba listo (Fase 6
 *      completa, con test dedicado) — pero esos tests solo cubrían paredes
 *      simples de 2 vértices. Contra un proyecto real ("Vinchos"),
 *      `buildLinearOcclusionBoxes()` trataba el CONTORNO CERRADO que el
 *      editor guarda para un muro con jamba (24+ vértices, grosor ya
 *      incluido) como si fuera una polilínea de centro simple, duplicando
 *      el grosor — el promedio caía ~19%. Revertido a `false`.
 *   2. (22) Primer intento de fix (reducir el contorno a sus 2 vértices más
 *      distantes) funcionaba en un caso sintético de un tramo recto, pero
 *      colapsaba un muro real con giros a una diagonal sin sentido físico
 *      — puntos en 0 lx. Revertido.
 *   3. (23) Descomposición geométrica exacta por barrido
 *      (`decomposeClosedRing`, `domain/geometry/occlusionBoxes.ts`) — válida
 *      para cualquier forma ortogonal (recta, L, T, U), verificada contra
 *      5 formas sintéticas Y la geometría exacta de los 2 muros reales de
 *      Vinchos. Con salvaguarda: si el contorno no es ortogonal dentro de
 *      tolerancia (`isRectilinearInFrame`), no arriesga la descomposición
 *      nueva — cae al comportamiento de segmento-por-segmento anterior
 *      (conocido, conservador) en vez de producir geometría sin sentido.
 *      Los 2 muros reales de Vinchos, que resultaron tener datos anómalos
 *      (su área de polígono no representa un muro delgado, ver hallazgo de
 *      la Ronda 23), activan justamente esa salvaguarda — no la
 *      descomposición nueva — así que no reproducen el fallo de 0 lx de
 *      la Ronda 22 aunque sigan siendo datos de mala calidad pendientes de
 *      corregir a mano en el editor.
 *
 *   4. (24, mismo día) Verificado contra un SEGUNDO proyecto real
 *      ("Módulo 22"): la descomposición de la Ronda 23 SÍ se activaba ahí
 *      (contorno ortogonal, pasa `isRectilinearInFrame`) y reconstruía el
 *      área EXACTA del polígono — pero ese polígono real describía un área
 *      ~7 veces mayor que un muro delgado de 0.13 m para su longitud (el
 *      promedio caía de 203 a 72 lx, -64.5%). El algoritmo de descomposición
 *      no tenía bug — el dato de entrada (el contorno guardado) sí, y no es
 *      exclusivo de Vinchos. Corrección: cada caja usa SIEMPRE el espesor
 *      declarado del muro (`wall.thickness`), nunca el medido del contorno
 *      — el contorno solo decide longitudes/posiciones de cada tramo
 *      (giros, muescas), nunca el espesor. Re-verificado tras el fix:
 *      Módulo 22 pasó de -64.5% a -2.2% en el ambiente más afectado (mejora
 *      real, no solo "ya no truena”); Vinchos no cambió (sus 2 muros ya
 *      caían en la salvaguarda no-ortogonal de la Ronda 23, nunca llegaban
 *      a este código).
 *
 * Reactivado a `true` con esta base. Sigue siendo una funcionalidad joven
 * — si un proyecto real muestra un resultado peor que con oclusión
 * desactivada, es evidencia real de un caso no cubierto, no una razón para
 * revertir en silencio: documentar la ronda nueva aquí primero.
 */
export function buildProductionCalculationConfig(project: Project): CalculationConfig {
    return {
        ...DEFAULT_DIRECT_PREVIEW_CONFIG,
        maintenanceFactor: project.siteSettings?.maintenanceFactor ?? DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor,
        occlusion: true,
        interreflection: 'auto-by-shape',
        maxBounces: 100,
        convergenceTolerance: 1e-5,
        meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: true },
        excludeMarginalZoneFromStats: true,
    };
}
