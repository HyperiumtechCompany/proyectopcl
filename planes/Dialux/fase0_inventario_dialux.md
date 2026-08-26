# Fase 0 — Inventario y línea base del módulo DIALux

> Entregable de la Fase 0 de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> ("Línea base reproducible" + primer borrador de "Matriz de capacidades").
> Generado: 2026-08-02. Runner de tests: `vitest run` (script `test` en `package.json`).

## 1. Alcance

Snapshot objetivo, no interpretativo, de `resources/js/pages/dialux/` al iniciar el refactor.
Sirve para: (a) saber qué archivos son candidatos de descomposición según el §4.5 del plan
maestro, (b) tener un punto de comparación cuando se re-audite tamaño/estructura en fases
posteriores, y (c) fijar qué archivo exacto es hoy el motor `direct-preview-v1`.

Total: **271 archivos .ts/.tsx, 68 715 líneas** bajo `resources/js/pages/dialux/`.

## 2. Archivos que superan el presupuesto de tamaño (§4.5 del plan)

Ordenados descendente. Código de producción únicamente (se excluyen `.test.ts` y fixtures de test).

| # | Archivo | Líneas | Umbral aplicable (§4.5) |
|---:|---|---:|---|
| 1 | `engine/House3DBuilder.ts` | 3469 | builder/emitter (400) |
| 2 | `components/toolbar/normativeData.ts` | 2832 | datos estáticos — dividir por norma/sección |
| 3 | `components/CatalogPanel.tsx` | 1855 | componente React (250) |
| 4 | `components/canvas/MlightcadCanvas2D.tsx` | 1565 | componente React (250) |
| 5 | `export/document/buildDialuxFormalDocument.ts` | 1324 | builder/emitter (400) |
| 6 | `hooks/ambientSpaces.ts` | 1057 | servicio de dominio (400) |
| 7 | `hooks/normativaData.ts` | 1149 | datos estáticos — duplica #2, ver hallazgo §5 |
| 8 | `hooks/wireLengthCalculations.ts` | 1049 | servicio de dominio (400) |
| 9 | `components/EditorLayout.tsx` | 1038 | componente React (250) |
| 10 | `hooks/useCanvasInteraction.ts` | 1033 | hook/orquestador (300) |
| 11 | `components/properties/RoomProps.tsx` | 1015 | componente React (250) |
| 12 | `hooks/useMlightcadEngine.ts` | 981 | hook/orquestador (300) |
| 13 | `hooks/types.ts` | 860 | tipos — evaluar si justifica excepción |
| 14 | `electrical/engine/compute.ts` | 823 | servicio de dominio (400) |
| 15 | `components/properties/WallProps.tsx` | 818 | componente React (250) |
| 16 | `hooks/normativeEngine.ts` | 740 | servicio de dominio (400) |
| 17 | `hooks/store/sceneObjectsSlice.ts` | 661 | hook/orquestador (300) |
| 18 | `components/catalogData.tsx` | 646 | datos estáticos |
| 19 | `components/Toolbar.tsx` | 603 | componente React (250) |
| 20 | `components/CtPanelOutputsDialog.tsx` | 630 | componente React (250) |
| 21 | `export/dxf/buildDialuxDxfExport.ts` | 614 | legacy, no activo (ver §5) |
| 22 | `components/NormativeWizardPanel.tsx` | 585 | componente React (250) |
| 23 | `export/useDialuxPdfExport.ts` | 497 | hook/orquestador (300) |
| 24 | `export/renderers/BrowserPrintPdfRenderer.ts` | 490 | builder/emitter (400) |
| 25 | `components/toolbar/panels/NormativaPanel.tsx` | 429 | componente React (250) |
| 26 | `hooks/useSnap.ts` | 439 | hook/orquestador (300) |
| 27 | `electrical/components/CatalogTab.tsx` | 419 | componente React (250) |
| 28 | `components/canvas/OverlayElectricalDevices.tsx` | 416 | componente React (250) |
| 29 | `components/ResultsPanel.tsx` | 412 | componente React (250) |
| 30 | `components/ObjectsPanel.tsx` | 410 | componente React (250) |

Comparación con la tabla §3.2 del plan maestro (redactada antes, con conteos ya desactualizados):

| Archivo | Líneas en el plan | Líneas actuales | Δ |
|---|---:|---:|---:|
| `engine/House3DBuilder.ts` | 3142 | 3469 | +327 |
| `components/toolbar/normativeData.ts` | 2819 | 2832 | +13 |
| `components/CatalogPanel.tsx` | 1759 | 1855 | +96 |
| `components/canvas/MlightcadCanvas2D.tsx` | 1377 | 1565 | +188 |
| `views/dialux/export/formal-pdf.blade.php` | 1322 | 1455 | +133 |
| `export/document/buildDialuxFormalDocument.ts` | 1217 | 1324 | +107 |
| `hooks/normativaData.ts` | 1144 | 1149 | +5 |
| `components/properties/RoomProps.tsx` | 942 | 1015 | +73 |
| `hooks/useMlightcadEngine.ts` | 889 | 981 | +92 |
| `hooks/useCanvasInteraction.ts` | 874 | 1033 | +159 |
| `hooks/ambientSpaces.ts` | 856 | 1057 | +201 |
| `Services/ProductImportService.php` | 835 | 977 | +142 |
| `export/dxf/buildDialuxDxfExport.ts` | 826 | 614 | **−212** (ya descompuesto parcialmente en `export/dxf/{builders,emitters,symbols,geometry}/`) |

Todos crecieron salvo `buildDialuxDxfExport.ts`, que decreció porque su pipeline real ya fue
extraído (ver §5). El plan maestro §3.2 debe tratarse como fotografía histórica, no como
inventario vigente; este documento la reemplaza como referencia de línea base.

## 3. Rutas backend (`routes/web.php`, prefijo `dialux`)

8 controladores en `app/Http/Controllers/Dialux/`: `ProjectController`, `Editor2DController`,
`ProductController`, `OutletProductController`, `NormativeConfigController`,
`ElectricalProjectController`, `ElectricalCatalogController`, `PlanFileController`.

Puntos relevantes para Fase 0/13:

- **No existe ruta backend de exportación DXF.** El DXF se construye 100% client-side
  (`export/dxf/` + `export/downloadDxfDocument.ts`) y se descarga vía Blob/objectURL.
- El único export server-side es el PDF formal: `POST /dialux/formal-export` →
  `Editor2DController::formalExport` → Dompdf (`dialux.export.formal-pdf`) + Fpdi para mezclar
  páginas portrait/landscape.
- `POST /dialux/import-dwg` → `Editor2DController::importDWG` es un **stub no funcional**:
  guarda el archivo y devuelve un SVG placeholder fijo ("DWG — Conversión pendiente"), con
  `// TODO: integrar conversor DWG→SVG o DWG→JSON`. Corrige la capacidad "Importación y
  calibración DXF/DWG" del plan §3.1 — DWG no tiene conversión real, solo DXF.

## 4. Modelos y migraciones backend

Modelos en `app/Models/Dialux/`: `DialuxProject`, `DialuxPlan`, `DialuxPlanFile`,
`DialuxNormativeConfig`, `DialuxNormativeRequirement`, `DialuxElectricalProject`,
`DialuxOutletRule`, `DialuxOutletType`, `DialuxConductor`, `DialuxCircuitDefault`; más
`LuminaireProduct` y `OutletProduct` fuera de `Dialux/`. 13 migraciones relacionadas entre
2026-04-24 y 2026-07-24 (ver detalle en el reporte de inventario original, no repetido aquí).

## 5. Motor de cálculo actual — candidato a `direct-preview-v1`

**`resources/js/pages/dialux/hooks/lightingEngineCore.ts`** (388 líneas) es el único motor que
calcula `Eavg/Emin/Emax/uniformidad/UGR` punto a punto para un ambiente
(`calculateLightingResult(room, fixtures)`). Grilla fija `GRID_SPACING = 0.5`, sin oclusión ni
interreflexión (confirma brecha §3.3 del plan). Consumido por:

- `hooks/useLightingEngine.ts` → `components/EditorLayout.tsx` (vista en vivo del editor).
- `export/snapshot/buildDialuxExportSnapshot.ts` (snapshot de export).
- `export/useDialuxPdfExport.ts` (informe PDF).

Es decir, el mismo cálculo alimenta editor, snapshot y PDF — no hay tres motores divergentes,
hay un único punto de verdad ya. Esto simplifica la Fase 1 (envolver este archivo en el wrapper
`CalculationSnapshot`/`CalculationRun` sin duplicar lógica).

Archivos que NO deben confundirse con el motor lumínico:

- `hooks/lightingCalculations.ts` — método del índice de local / factor de utilización para
  dimensionamiento ("cuántas luminarias necesito"), flujo paralelo, no competidor.
  Su hook `useLightingCalculations.ts` (368 líneas) **no tiene consumidores actuales** —
  candidato a código muerto, verificar antes de incluirlo en cualquier refactor.
- `hooks/roomLighting.ts` — utilidades de dominio/normativa por ambiente (matching de
  norma/actividad, filtrado de luminarias dentro de un ambiente), alimenta tanto al motor como
  a UI y a `normativeEngine.ts`.
- `hooks/useWasmEngine.ts` — no es un motor de iluminación; carga el WASM que parsea **DXF**
  (`parse_dxf_web`), con fallback en `hooks/dxfFallbackParser.ts`.

Acción tomada en esta fase: ver `hooks/lightingEngineCore.ts` (comentario de cabecera y
constante `ENGINE_VERSION`) para el etiquetado formal.

## 6. Duplicidad normativa confirmada (brecha §3.3 del plan)

Existen dos catálogos normativos paralelos, ambos activos:

- `hooks/normativaData.ts` (1149 líneas).
- `components/toolbar/normativeData.ts` (2832 líneas).

Confirma el riesgo de "fuentes duplicadas" señalado en la tabla §3.2 del plan. Unificarlos es
trabajo de Fase 7.4 (`domain/evaluation/` + `infrastructure/normative/`), no de Fase 0 — aquí
solo se deja registrado para no perder la referencia.

## 7. Tests existentes

66 archivos de test bajo `resources/js/pages/dialux/`. Cobertura por área (ver corrida completa
en `npm run test` / `vitest run`):

- **Geometría**: `geometry/coordinateTransform.test.ts`, `geometry/polygonGeometry.test.ts`.
- **Selección/eliminación**: `selection/deletionPolicy.test.ts`, `selection/hitTest.test.ts`.
- **Store (Zustand)**: `hooks/store/{floorSlice,historySlice,outletGroups}.test.ts`,
  `hooks/useEditorStore.test.ts`.
- **Motor lumínico**: `hooks/lightingEngineCore.test.ts`, `hooks/lightingCalculations.test.ts`,
  `hooks/roomLighting.test.ts`, `hooks/ambientSpaces.test.ts`.
- **Normativa**: `hooks/normativeEngine.test.ts`.
- **Eléctrico**: `electrical/engine/{compute,formulas,panelHierarchy}.test.ts` +
  `compute.cumulativeVoltageDrop.test.ts` + `compute.installationCategoryProfiles.test.ts`,
  `hooks/{wireLengthCalculations,wireLegacySync,conductorCircuitGroups,outletPlacement}.test.ts`,
  `hooks/panelCircuitCalculations.test.ts`.
- **Export DXF**: 22 archivos bajo `export/dxf/**` (builders, emitters, symbols, geometry) +
  2 legacy (`buildDialuxDxfExport.baseline.test.ts`, `.legend.test.ts`).
- **Export PDF/snapshot**: `export/document/fase{5,6,7,8}*.test.ts`,
  `export/snapshot/buildDialuxExportSnapshot.test.ts`, `export/dialux-export.test.ts`,
  `export/fase10FinalValidation.test.ts`, `export/moduloIFixture.test.ts`,
  `export/payload-smoke.test.ts`.

No hay huecos de cobertura evidentes en las áreas que la Fase 0/1 va a tocar (snapshot, hash,
motor). El motor lumínico (`lightingEngineCore.ts`) y el motor eléctrico (`electrical/engine/`)
ya tienen suite propia — condición necesaria para el "refactor seguro" del §4.6 del plan.

## 8. Fixtures existentes vs. requeridas (§17 del plan)

| Fixture requerida (§17) | Estado |
|---|---|
| Pequeño (1 recinto, 4 luminarias, 100 puntos) | **No existía** → creada en esta fase, ver `hooks/__fixtures__/fase0SmallFixture.ts` |
| Mediano (1 nivel, 20 recintos, 200 luminarias) | **No existía** → creada en esta fase, ver `hooks/__fixtures__/fase0MediumFixture.ts` |
| Grande — MÓDULO I (3 niveles, 24 ambientes) | Ya existe: `export/__fixtures__/moduloIFixture.ts`, usado por `export/moduloIFixture.test.ts`, `export/fase10FinalValidation.test.ts`, `export/dxf/builders/dxfFase10CadValidation.test.ts` |
| Estrés (límites acordados y cancelación) | No aplica todavía — depende de Worker/WASM (Fase 12), fuera de alcance de Fase 0 |

## 9. Reglas de dependencia y tamaño (§4.5/§4.1 del plan)

Ver `resources/js/pages/dialux/.dependency-cruiser.cjs` (o script equivalente) creado en esta
fase para: (a) el dominio no importa React/Zustand/Axios/Babylon/Inertia/DOM/Canvas/Laravel,
(b) alertar archivos nuevos que superen los umbrales de §4.5 sin whitelist explícita.

## 9.1. Puerta de salida — estado real de `npm run types`

`npx tsc --noEmit` sobre el repo completo reporta **126 líneas de error
preexistentes** (2026-08-02), ninguna introducida por el trabajo de esta
fase (verificado: ninguna referencia a los archivos nuevos/editados de Fase 0
—`lightingEngineCore.ts`, fixtures, golden, benchmark, test de arquitectura—
aparece en la salida). Los errores están concentrados en archivos no tocados
en este ciclo: `House3DBuilder.ts`, `WallProps.tsx`, `useMlightcadEngine.ts`,
`mlightcadDocument.ts`, `useSnap.ts`, `fixtureGrid.ts`, y varios `.test.ts`
desincronizados con tipos del store (`ambientSpaces.test.ts`,
`panelCircuitCalculations.test.ts`, `outletGroups.test.ts`,
`useEditorStore.test.ts` referencian propiedades de `EditorState`/`Scene` que
ya no existen o cambiaron de forma).

**Esto significa que la puerta de salida "Tipos, tests existentes y build
pasan" de la Fase 0 (§11) NO se cumple hoy de forma estricta para `npm run
types`** — sí se cumple para `vitest run` (487/487 tests pasan) y para
`npm run build` (compila correctamente). Corregir esta deuda de tipos es un
trabajo aparte, no incluido en el alcance que se acordó para este primer
ciclo (inventario + contratos, no saneamiento general); queda registrado
aquí para que no se pierda y el equipo decida cuándo priorizarlo.

## 10. Qué queda pendiente después de esta fase

- Fixtures pequeño/mediano con resultados numéricos capturados como golden (Fase 0, en curso).
- Benchmark de tiempos (carga/cálculo/PDF/DXF) sobre las tres fixtures (Fase 0, en curso).
- ADRs de unidades/ejes/snapshot/versiones (Fase 0, en curso).
- Unificación de catálogos normativos duplicados → Fase 7.4, no Fase 0.
- Verificar si `hooks/useLightingCalculations.ts` es código muerto antes de tocarlo en Fase 2.
