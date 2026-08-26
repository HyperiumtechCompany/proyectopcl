# Fase 11 — Progreso: resultados profesionales (procedencia real)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 11 ("Resultados profesionales").

## Decisión de alcance

El motor (`runDirectPreviewEngine`) ya producía `CalculationRun` con
`snapshotHash`/`engineVersion`/`config`/`warnings` desde fases anteriores,
pero esa procedencia nunca llegaba al informe real: el PDF de exportación
(`useDialuxPdfExport.ts`) recalculaba resultados con
`deriveAmbientSpaces` + `calculateLightingResult` **directos**, sin pasar
por `buildCalculationSnapshot`/`runDirectPreviewEngine`. Esto significa que
todas las mejoras de las Fases 6-10 (oclusión, interreflexión, UGR con
observadores, escenas luminosas) estaban activas en los tests del motor
pero **nunca en el PDF que recibe el cliente**.

Se preguntó explícitamente al usuario si limitar esta fase a utilidades
nuevas aisladas (`findResultExtremum`, `compareResultGrids`, bajo riesgo) o
además conectar `buildDialuxExportSnapshot.ts`/`useDialuxPdfExport.ts` al
pipeline real (mayor riesgo, toca código de producción). Se eligió la
opción completa.

## 1. Utilidades nuevas — `domain/calculation/`

- `runProjectLightingCalculation.ts`: envuelve
  `buildCalculationSnapshot` + `runDirectPreviewEngine` en una sola llamada,
  devuelve `{ resultsByRoom, run }` indexado por `objectId` (== `ambient.id`).
  Es el único punto de entrada que ahora usa el export de PDF.
- `findResultExtremum.ts`: localiza el punto de grilla min/max de un
  `LightingResult` y traduce el índice a coordenadas de mundo (misma
  convención que `buildGrid` de `lightingEngineCore.ts`). `null` si falta
  metadata de malla o no hay puntos activos.
- `compareResultGrids.ts`: diff punto a punto entre dos `LightingResult`.
  Exige forma de malla idéntica (rows/cols/origin/cellsize); `null` en caso
  contrario — no interpola entre mallas distintas.

## 2. Conexión a producción — `export/`

- `useDialuxPdfExport.ts`: se eliminó `recalculateAllResults` (recálculo
  directo, sin motor) y se reemplazó por
  `runProjectLightingCalculation(project)`; el `CalculationRun` resultante
  se pasa a `buildDialuxExportSnapshot`.
- `buildDialuxExportSnapshot.ts` (`DialuxExportSnapshotInput.calculationRun?`):
  - `provenance.snapshotHash`/`configSummary` (nuevo, `CalculationProvenance`)
    se llenan desde el `CalculationRun` real cuando está disponible.
  - `buildConfigSummary(config)`: resume oclusión/interreflexión/modelo UGR
    en una línea legible.
  - Nuevo campo `warnings: CalculationWarning[]` en `DialuxAmbientMetrics`
    (advertencias del `CalculationRun` filtradas por `objectId === ambient.id`).
  - Nuevo campo `globalWarnings: CalculationWarning[]` en
    `DialuxExportSnapshot` (advertencias con `objectId: null`, ej.
    `scene-not-found`, `interreflection-maxBounces-too-low`).
- `ambientDossier.ts`/`DialuxAmbientDetail`: se propaga
  `warnings: ambient.metrics.warnings` junto a `provenance` — sin esto, toda
  la trazabilidad nueva de esta fase quedaba calculada pero invisible para
  el documento final.

Sin `calculationRun` (llamadas existentes, tests previos a esta fase): el
comportamiento es idéntico al anterior — `provenance.snapshotHash`/`configSummary`
quedan `undefined`, `warnings` queda `[]`. Verificado explícitamente por
test dedicado.

## Auditoría `dialux-calc-reviewer` y correcciones

1. **Mayor — fuga de procedencia en la ruta de respaldo**. Cuando un
   ambiente derivado (`deriveSceneAmbientSpaces`) no tenía resultado en
   `resultsByRoom` (por ejemplo, un ambiente agregado/editado después de
   correr el cálculo), el código caía a `calculateLightingResult` directo
   —bypaseando por completo el motor/config— pero seguía estampando ese
   ambiente con la procedencia COMPLETA del `calculationRun`, como si
   realmente hubiera pasado por esa ejecución. Corregido: se calcula
   `objectIdsInRun` (los `objectId` que sí aparecen en
   `calculationRun.surfaces`) y solo se pasa `calculationRun` a
   `buildAmbientMetrics` cuando el ambiente está en ese conjunto; el resto
   recibe procedencia `undefined`/`not-calculated`, honesta sobre su origen.
   Test de regresión nuevo (`buildDialuxExportSnapshot.test.ts`): dos
   ambientes, uno cubierto por el run y otro no, verificando que solo el
   primero hereda `snapshotHash`/`configSummary`.
2. **Mayor — advertencias globales descartadas en silencio**. El filtro
   `warnings.filter(w => w.objectId === ambient.id)` no tenía a dónde ir
   para warnings con `objectId: null` (ej. `scene-not-found`,
   `interreflection-maxBounces-too-low`) — quedaban calculadas dentro del
   `CalculationRun` pero jamás llegaban a ningún lugar visible del export.
   Corregido con el nuevo campo `globalWarnings` en `DialuxExportSnapshot`.
   Test de regresión nuevo: fuerza `interreflection-maxBounces-too-low`
   (`maxBounces: 1` + `interreflection: 'iterative'`) y verifica que
   aparece en `globalWarnings` y en NINGÚN `ambient.metrics.warnings`.
3. **Menor — `provenance.calculatedAt` usaba la hora de build del PDF**, no
   la hora real de finalización del cálculo. Corregido: prioriza
   `calculationRun.completedAt` cuando existe.
4. **Menor — `provenance.status` no reflejaba `calculationRun.status`**
   (`'completed'` vs otros estados del run). Corregido: se deriva de
   `calculationRun.status` cuando el run está disponible.
5. **Menor — `warnings` de `DialuxAmbientMetrics` no llegaban a
   `DialuxAmbientDetail`** (solo `provenance` se copiaba en
   `ambientDossier.ts`); el tipo ni siquiera declaraba el campo. Corregido:
   `warnings: ambient.metrics.warnings` agregado al armado del detalle y a
   la interfaz `DialuxAmbientDetail`.

### Aceptado sin cambio (fuera de alcance de este ciclo)

- **Bloqueante, preexistente — `uniformityTarget ?? 0.4` / `ugrLimit ?? 22`
  son valores mágicos sin fuente normativa citada** cuando el ambiente no
  trae esos datos explícitos. No es una regresión de esta fase (el patrón
  ya existía antes de la Fase 11) y corregirlo requeriría decidir de dónde
  sale ese default por tipo de actividad/norma — trabajo de una fase de
  normativa, no de "conectar la procedencia del motor al PDF". Documentado
  aquí para que no se pierda de vista.

## Verificación

- `vitest run` (`resources/js/pages/dialux`): 628/628. Nuevos:
  4 en `runProjectLightingCalculation.test.ts`, 4 en
  `findResultExtremum.test.ts`, 4 en `compareResultGrids.test.ts`, 5 en
  `buildDialuxExportSnapshot.test.ts` (3 del wiring inicial + 2 de la
  auditoría: fuga de procedencia y `globalWarnings`).
- `tsc --noEmit`: sin errores nuevos en ningún archivo tocado/creado de
  esta fase (verificado filtrando la salida por esos archivos); los errores
  restantes en el árbol son preexistentes de un trabajo concurrente no
  relacionado (`outletGroups`, `LegendPanel`, `mlightcadDocument`,
  `House3DBuilder`, etc.).
- ESLint: limpio en todos los archivos tocados/creados de esta fase. El
  único error fuera de ese conjunto (`_targetWindow` sin usar en
  `useDialuxPdfExport.ts`) es preexistente — confirmado con `git diff` que
  esa línea no forma parte de los cambios de esta fase.
- `npm run build`: OK.

## Pendientes (fuera de alcance de este ciclo)

- **`findResultExtremum`/`compareResultGrids` no tienen consumidor en la UI
  todavía** — mismo patrón de pendiente que fases anteriores: la utilidad
  pura existe y está probada, ningún panel/export la usa aún para mostrar
  "punto más oscuro" o "diff entre escenas" al usuario.
- **`globalWarnings`/`ambient.metrics.warnings` no se renderizan todavía en
  el documento PDF** — se propagan correctamente hasta `DialuxAmbientDetail`
  y `DialuxExportSnapshot`, pero ningún layout de página del PDF las
  imprime aún. La trazabilidad ya es accesible por código; falta la
  presentación visual.
- **Valores mágicos de `uniformityTarget`/`ugrLimit` sin fuente normativa**
  — documentado arriba, señalado como bloqueante para una futura fase de
  normativa.
