# Fase 13 — Progreso: documentación respaldada por cálculo (PDF/UI)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 13 ("Documentación y DXF respaldados por cálculo").

## Decisión de alcance

Se consultó al usuario: la fase mezcla trabajo de riesgo muy distinto —
extender PDF/UI (código nuevo, no toca nada verificado) vs. conectar el
pipeline DXF (`export/dxf/**`) al cálculo lumínico. El DXF hoy es puramente
geométrico/eléctrico y ya fue completado y verificado por el usuario en
AutoCAD real (plan aparte, "Plan DXF por nivel: COMPLETO") — tocarlo para
inyectar datos de cálculo era el cambio de mayor riesgo de regresión del
ciclo. **Se eligió limitar esta fase a PDF/UI**, dejando el DXF
explícitamente fuera de alcance.

## Hallazgos de la exploración previa

- **`domain/calculation/staleness.ts` ya existía, con tests, y CERO
  consumidores** (`isCalculationRunStale`) — pieza central para "evitar
  recálculos" + "invalidar si stale", construida en una fase anterior pero
  nunca conectada.
- **`useDialuxPdfExport.ts` siempre recalculaba sin condición** (Fase 11,
  con un comentario explícito "el PDF nunca debe mostrar resultados
  viejos") — correcto pero no aprovechaba `isCalculationRunStale`.
- **`useEditorStore` no tenía ningún campo `CalculationRun`** — solo
  `resultsByRoom`/`result` (valores planos). `EditorLayout.tsx` calculaba
  un `CalculationRun` real (vía el worker de la Fase 12) pero lo
  descartaba después de extraer `surfaces`/`status`.
- **`engineVersion`/`warnings` no se renderizaban en ningún lado** — ni en
  la UI del editor, ni en el PDF (cero menciones de
  `provenance`/`warnings`/`engineVersion` en `formal-pdf.blade.php`).
- **Hallazgo adicional durante la implementación**: `FormalExportRequest.php`
  nunca validó `document.ambientDetails.*.provenance.snapshotHash`/
  `.configSummary` ni `document.ambientDetails.*.warnings` (ambos
  agregados en la Fase 11) — sin regla, esos campos probablemente se
  perdían en el request real antes de llegar al Blade, sin que ningún test
  lo hubiera notado. Se corrigió como parte de este ciclo.
- **`compareLightingScenes.ts`/`compareResultGrids.ts`/`findResultExtremum.ts`
  seguían sin consumidor** (Fase 10/11). Se decidió con el usuario construir
  la plomería del anexo comparativo de escenas (`compareLightingScenes`)
  ahora, condicionada a `lightingScenes.length >= 2` por nivel — hoy nunca
  se cumple (ninguna UI crea más de una escena), así que el anexo queda
  dormido sin costo para proyectos reales.
- La tabla comparativa "obvia" (todos los ambientes lado a lado) **ya
  existía** — página `ambient-list` del PDF. No se reinventó.

## 1. Store y UI del editor

- `hooks/useEditorStore.ts`: nuevo campo `lastCalculationRun: CalculationRun | null`
  + `setLastCalculationRun`.
- `components/EditorLayout.tsx` → `runCalc`: ahora guarda el
  `CalculationRun` completo (antes solo extraía `surfaces`/`status` a un
  tipo ad-hoc). La rama de respaldo (worker falla) construye un
  `CalculationRun` genuino con `buildCalculationSnapshot` +
  `hashCalculationSnapshot` + `LIGHTING_ENGINE_VERSION`, no un objeto
  parcial — así `isCalculationRunStale` funciona igual sin importar qué
  camino calculó el resultado. Nuevo `useEffect` que recalcula
  `isCalculationRunStale(lastCalculationRun, project)` cuando cambian
  `project`/`lastCalculationRun`; badge "Resultados desactualizados" junto
  al botón "Calcular" cuando el proyecto cambió desde el último cálculo.
- `components/ResultsPanel.tsx`: nueva prop opcional `calculationRun` —
  muestra motor + fecha + cantidad de advertencias en el header de la
  tabla de resultados. Sin la prop, el panel se ve exactamente igual que
  antes (patrón no disruptivo).

## 2. Evitar recálculos en el exportador de PDF

Nuevo `export/resolveCalculationRunForExport.ts` (extraído de
`useDialuxPdfExport.ts` para poder probarlo sin Swal/axios/capturas de
canvas): con un `lastCalculationRun` guardado y `!isCalculationRunStale`,
lo reusa sin recalcular; si no hay uno o quedó obsoleto, recalcula como
antes (garantía de Fase 11 intacta — la diferencia es que ahora se
VERIFICA en vez de asumir). `useDialuxPdfExport.ts` usa este helper y
actualiza `lastCalculationRun` en el store tras cada recálculo real.

## 3. Trazabilidad visible

- `export/document/frontMatter.ts::buildPreliminaryNotes`: nuevas notas de
  motor/config (`snapshot.ambients[0]?.metrics.provenance`) y de
  advertencias globales (`snapshot.globalWarnings`) — renderizadas gratis
  vía el `<p>{{ $note }}</p>` que ya existía para "Observaciones
  preliminares", sin tocar Blade para esta parte.
- `formal-pdf.blade.php::$renderAmbientResultsTable` (compartida por
  `ambient-summary` y `ambient-results`): nuevo bloque con motor/fecha de
  cálculo y lista de advertencias por ambiente, mas las clases CSS
  `.ambient-provenance`/`.ambient-warnings` en
  `style-exportado-dialux.css`.
- `app/Http/Requests/Dialux/FormalExportRequest.php`: se agregaron las
  reglas faltantes de la Fase 11 (`provenance.snapshotHash`,
  `.configSummary`, `ambientDetails.*.warnings.*`).

## 4. Anexo comparativo de escenas (plomería, dormido hoy)

- `export/domain/types.ts`: `DialuxSceneComparisonSummary` (envuelve
  `SceneComparisonEntry` de `compareLightingScenes.ts` con los nombres de
  las dos escenas), `DialuxExportSnapshot.sceneComparisons` (default
  `[]`), nuevo `DialuxFormalPageKind: 'lighting-scene-comparison'`
  (reusa el `sectionId: 'technical-appendix'` que ya existía sin uso).
  `PageSeed`/`DialuxDocumentPage` ganan `sceneComparison?` — el builder TS
  ya arma el objeto completo, sin join en el backend.
- `export/resolveSceneComparisonsForExport.ts`: para cada nivel con 2+
  `lightingScenes`, corre `runDirectPreviewEngine` una vez por escena
  adicional (mismo `CalculationSnapshot`, sin duplicar geometría) y arma
  las entradas con `compareLightingScenes`. Bucle vacío (0 llamadas al
  motor) en cualquier proyecto real hoy.
- `export/document/lightingSceneComparisonPages.ts` (mismo patrón que
  `glossaryPages.ts`): una página por comparación; `buildDialuxFormalDocument.ts`
  la agrega a `buildTechnicalPageSeeds`.
- `formal-pdf.blade.php`: nueva sección `lighting-scene-comparison` (tabla
  ΔE avg/ΔE min/ΔUo/ΔUGR por objeto).
- `FormalExportRequest.php`: `'lighting-scene-comparison'` agregado al
  enum de `document.pages.*.kind` + reglas para `document.pages.*.sceneComparison`
  y sus campos anidados.

## Verificación

- `npx vitest run resources/js/pages/dialux`: 653 tests, 651 pasan. Las 2
  fallas (`fileSizeBudget.test.ts` sobre `hooks/lightingEngineCore.ts`, y
  `runProjectLightingCalculation.test.ts` con una discrepancia de
  `avg_lux`) son **preexistentes de una sesión concurrente** — confirmado
  vía `git diff`: agregaron un parámetro `maintenanceFactor` con default
  `0.8` en `runDirectPreviewEngine.ts` (rompe el patrón "default no
  disruptivo" de cada fase de este plan), sin relación con este ciclo. No
  se tocó ese trabajo en progreso.
- `resources/js/pages/dialux/__architecture__/fileSizeBudget.test.ts`:
  `export/snapshot/buildDialuxExportSnapshot.ts` pasó a superar el
  presupuesto por mis cambios (401→400 líneas) — corregido comprimiendo
  comentarios existentes a una línea, sin cambiar comportamiento.
- `tsc --noEmit`/ESLint: limpios en todos los archivos tocados/creados de
  esta fase (confirmado filtrando la salida por archivo; el resto de
  errores en el árbol son preexistentes de la sesión concurrente).
- `npm run build`: OK.
- `php artisan test tests/Feature/Dialux/FormalExportTest.php`: 29/29
  (10 tests nuevos: trazabilidad de motor/warnings en Blade, default no
  disruptivo, aceptación de los campos de validación corregidos, render y
  validación del anexo comparativo).
- `vendor/bin/pint --dirty`: sin cambios necesarios.
- Verificación adicional del árbol Dialux completo detectó 2 archivos de
  test con fallas **totalmente ajenas a este ciclo**, ambas preexistentes
  y sin relación con ningún archivo tocado aquí: `ProductImportTest.php`
  (12 fallas — `app/Services/ProductImportService.php` ya aparecía
  modificado en el `git status` desde ANTES de empezar esta sesión, trabajo
  de IES/GLDF en progreso de otra sesión) y `PlanFilePersistenceTest.php`
  (6 fallas, todas HTTP 419 por CSRF — problema de entorno/configuración
  de test, no de código; ese archivo no tiene ninguna modificación
  pendiente). Ninguno de los dos se tocó.

## Pendientes (fuera de alcance de este ciclo)

- **Pipeline DXF (`export/dxf/**`)** — decisión explícita del usuario, sin
  tocar en este ciclo.
- **`compareResultGrids.ts`/`findResultExtremum.ts`** — siguen sin
  consumidor; no formaron parte de este ciclo.
- **El anexo comparativo de escenas sigue dormido** — la plomería completa
  (tipos, cálculo, página, Blade, validación) está lista y probada, pero
  ninguna UI permite crear 2+ `lightingScenes` por nivel todavía (gap ya
  documentado desde la Fase 10). Se activa solo cuando esa UI exista, sin
  tocar el exportador de nuevo.
- **`useDialuxPdfExport.ts` sigue en el hilo principal** (no usa el worker
  de la Fase 12) — la Fase 12 ya documentó esto como menor urgencia
  (modal bloqueante propio desde la Fase 11).
- **Badge de "resultados desactualizados" es informativo, no bloquea** —
  el usuario puede exportar/seguir viendo resultados viejos en la UI en
  vivo sin forzar un recálculo; el PDF sí se protege solo (Sección 2).
