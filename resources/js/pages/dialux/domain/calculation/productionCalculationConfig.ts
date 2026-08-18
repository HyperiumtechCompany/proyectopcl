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
 * `occlusion` — REVERTIDO a `false` (Ronda 21l, mismo día que se activó).
 * Se activó primero pensando que el pipeline ya estaba listo (Fase 6
 * completa, con test unitario dedicado), pero esos tests SOLO cubren
 * paredes simples de 2 vértices (`fullWallAt()` en
 * `lightingEngineCore.occlusion.test.ts`). Al probar contra un proyecto
 * real ("Vinchos", aulas con muros interiores reales dibujados en el
 * editor), el promedio cayó ~19% y el mínimo empeoró en vez de mejorar —
 * `buildLinearOcclusionBoxes()` (`domain/geometry/occlusionBoxes.ts`) trata
 * `wall.vertices` como una POLILÍNEA de centro (extruye cada segmento
 * consecutivo por `thickness`), pero un muro real dibujado con jambas/
 * recesos de puerta guarda su CONTORNO CERRADO completo (24+ vértices, ya
 * con el grosor incluido) — extruir ese contorno otra vez por `thickness`
 * genera una obstrucción mucho más grande y con forma incorrecta que la
 * pared real de 0.13 m. No es un caso raro: es como el editor genera
 * cualquier muro con una puerta empotrada. Hasta corregir
 * `buildLinearOcclusionBoxes()` para distinguir polilínea-centro de
 * contorno-cerrado (o normalizar `wall.vertices` a un formato único antes
 * de llegar aquí), `occlusion` debe quedar en `false` — activarlo hoy
 * produce resultados PEORES que no modelar oclusión en absoluto para
 * cualquier proyecto con muros interiores reales.
 */
export function buildProductionCalculationConfig(project: Project): CalculationConfig {
    return {
        ...DEFAULT_DIRECT_PREVIEW_CONFIG,
        maintenanceFactor: project.siteSettings?.maintenanceFactor ?? DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor,
        occlusion: false,
        interreflection: 'auto-by-shape',
        maxBounces: 100,
        convergenceTolerance: 1e-5,
        meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: true },
        excludeMarginalZoneFromStats: true,
    };
}
