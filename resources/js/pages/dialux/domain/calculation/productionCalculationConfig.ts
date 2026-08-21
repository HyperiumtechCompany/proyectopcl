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
 *      y reconstruía el área EXACTA del polígono — pero el promedio caía de
 *      203 a 72 lx (-64.5%). Primer parche: espesor siempre el declarado
 *      (`wall.thickness`), nunca el medido del contorno. Mejoraba los
 *      números pero era CANCELACIÓN DE ERRORES, no física (ver Ronda 25).
 *   5. (25, mismo día — la interpretación correcta) El anillo cerrado que
 *      guarda el editor NO es la huella rellena de un muro grueso: es el
 *      RECORRIDO PERIMETRAL del muro alrededor del ambiente (verificado
 *      vértice a vértice contra el muro `31efa5ea` de Módulo 22: encierra
 *      2.18 m² = el interior de SS.HH, con muescas de jamba de ~0.13 m).
 *      Rellenarlo ponía cajas DENTRO del ambiente ocluyendo sus propias
 *      luminarias. Corrección real (`occlusionBoxes.ts`): una caja por
 *      arista del contorno, espesor declarado centrado en la arista — la
 *      rama especial de anillos desapareció, todo contorno pasa por el
 *      camino por-segmento. Dos correcciones acompañantes con causa física
 *      (`roomPatches.ts`): los parches de pared se muestrean en la CARA
 *      INTERIOR del muro (inset = espesor máx/2 + ε; en la línea central
 *      caían dentro de la caja opaca y la interreflexión entera colapsaba a
 *      0), y se subdividen también A LO LARGO de la arista con la misma
 *      cota de campo cercano que `wallVerticalSegments` (sin eso, la
 *      radiosidad iterativa en recintos angostos convergía al asíntota
 *      1/(1-ρ̄) de cavidad zonal, +38% sobre evo).
 *
 * Reactivado a `true` con esta base. Sigue siendo una funcionalidad joven
 * — si un proyecto real muestra un resultado peor que con oclusión
 * desactivada, es evidencia real de un caso no cubierto, no una razón para
 * revertir en silencio: documentar la ronda nueva aquí primero.
 *
 * ## `interreflection: 'iterative'` (Ronda 25, 2026-08-19 — reemplaza a
 * `'auto-by-shape'`)
 *
 * La heurística por forma (arriba) se calibró en rondas donde faltaban DOS
 * causas físicas: la oclusión (la luz se filtraba entre ambientes y el
 * subestimado de `first-bounce` lo compensaba por cancelación) y la
 * subdivisión horizontal de parches (el sobreestimado de `iterative` en
 * recintos angostos era un artefacto de campo cercano, no del método).
 * Con ambas corregidas, la matriz occl×interreflexión sobre Módulo 22
 * (2026-08-19) dio:
 *
 *   - `iterative`:    +12.9% / +10.5% / +8.6% vs DIALux evo (signo
 *     consistente, los 3 ambientes CONFORMES igual que en evo), y por
 *     DEBAJO del oráculo Radiance (-10.6% en el barrido de altura de
 *     sshh) — acotado por física por arriba y por evo por abajo.
 *   - `first-bounce`: -15.1% / -14.0% / -4.7% (subestimado sistemático —
 *     es una truncación del transporte, no un modelo físico completo; los
 *     ambientes quedaban "no conformes" que evo declara conformes).
 *
 * `'auto-by-shape'` mezclaba ambos signos en el mismo proyecto. Radiance
 * (física independiente, sin evo de por medio) también favorece `iterative`
 * en ambas alturas medidas (`heightSweepExperiment.test.ts`). La heurística
 * sigue disponible como valor de config, pero producción usa el modelo
 * convergido.
 *
 * ## Ronda 31 (2026-08-21) — tercer proyecto real ("Módulo VII"), sin cambio
 * de default
 *
 * El usuario reportó variación grande de Uo/Emin entre proyectos usando las
 * mismas luminarias. Verificado con datos reales de "Módulo VII" (2
 * ambientes de duchas, mismo patrón de muro-jamba que Vinchos/Módulo 22):
 *
 *   - `iterative` (producción): "Ducha A.A universal" avg +50% vs evo,
 *     "Ducha para mujeres" avg +20% — mismo sesgo POSITIVO consistente que
 *     documenta la Ronda 25 arriba, no un caso nuevo.
 *   - `auto-by-shape` habría mejorado "A.A universal" (aspecto 2.25:1 →
 *     first-bounce, +26% en vez de +50%) pero AL MISMO TIEMPO regresa
 *     "SS.HH" de Módulo 22 (aspecto 2.40:1 — el mismo umbral) de +4.8% a
 *     -13% vs evo, confirmado corriendo `modulo22GoldenCase` con
 *     `auto-by-shape` antes de descartar el cambio. Dos ambientes con
 *     aspecto casi idéntico (2.25 vs 2.40:1) prefieren modos OPUESTOS — la
 *     heurística por forma no tiene una frontera estable, sigue sin
 *     evidencia suficiente para reemplazar `iterative`. No se cambia el
 *     default con un solo proyecto nuevo — exactamente lo que esta sección
 *     pide no repetir.
 *
 * La causa real y dominante de la brecha de Uo/Emin en "Ducha para
 * mujeres" NO fue el modo de interreflexión: con oclusión desactivada,
 * Uo pasó de 0.11 a 0.61 y Emin de 33 a 224 lx (mismo ambiente, mismas
 * luminarias). El muro tiene una muesca de jamba (el hueco de una puerta
 * real) pero el proyecto no tiene ningún objeto `Door` registrado ahí —
 * `buildWallOcclusionBoxes` no tiene por dónde recortar el vano y trata la
 * muesca como pared 100% sólida piso-a-techo, oscureciendo la franja bajo
 * el dintel mucho más que la puerta real. Acción: no es un bug de cálculo,
 * es un dato de proyecto incompleto — colocar el objeto `Door` real en la
 * abertura (Vinchos y Módulo VII comparten el mismo patrón sin puertas
 * registradas) corrige la oclusión ahí sin tocar código.
 */
export function buildProductionCalculationConfig(project: Project): CalculationConfig {
    return {
        ...DEFAULT_DIRECT_PREVIEW_CONFIG,
        maintenanceFactor: project.siteSettings?.maintenanceFactor ?? DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor,
        occlusion: true,
        interreflection: 'iterative',
        maxBounces: 100,
        convergenceTolerance: 1e-5,
        meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: true },
        excludeMarginalZoneFromStats: true,
    };
}
