# Fase 19 — Progreso: BIM/IFC — importar y mapear estructura espacial (primer ciclo)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 19.

## Contexto y decisión de alcance

Tras diferir la Fase 18 (`planes/fase18_progreso_dialux.md`), el usuario
pidió continuar con la Fase 19 ("BIM/IFC"). De sus 6 líneas de trabajo, se
acotó el primer ciclo a **"Importar + mapear estructura"**: leer un IFC
real, extraer su jerarquía espacial conservando IDs IFC, y mapear cada
`IfcSpace` a un `Room`/`Scene` real — sin exportación ni reimportación/
diffing todavía. El usuario aprobó explícitamente agregar **`web-ifc`**
(WASM, That Open Company/ex-IFC.js) como dependencia nueva.

## Spike previo (obligatorio antes de diseñar el resto)

Sin ningún `.ifc` de muestra en el repo ni evidencia de uso previo de
`web-ifc` en este proyecto, se creó a mano un fixture STEP mínimo válido
(`hooks/ifcImport/__fixtures__/two-rooms.ifc`: 1 `IfcBuildingStorey` con 2
`IfcSpace` de dimensiones conocidas, archivo en milímetros) y se verificó
en 3 pasos progresivos:

1. `web-ifc` inicializa y parsea vía `require` (CJS) en Node plano.
2. Lo mismo vía `import` ESM en Node plano — riesgo real: el
   `package.json` de `web-ifc` mapea la condición `"import"` al build de
   NAVEGADOR (`web-ifc-api.js`), no al de Node — confirmado que funciona
   igual.
3. Lo mismo bajo **Vitest** (la resolución de módulos de Vite podía diferir
   de Node puro) — confirmado con un test real.

Este spike también **determinó empíricamente una convención no
documentada** de `web-ifc`: la geometría teselada (`StreamMeshes`/
`GetGeometry`/`GetVertexArray` + `flatTransformation`) se entrega en
**metros** (conversión de unidades del archivo ya aplicada — un archivo en
mm produce un factor 0.001 en la matriz, sin que este proyecto tenga que
hacer nada) y en un sistema **Y-arriba** (vertical = eje Y de salida),
aunque IFC es nativamente Z-arriba. Verificado con dos salas de dimensiones
conocidas (4×3×2.8 m y 3×3×2.8 m, la segunda desplazada 5 m) ANTES de
construir el resto del pipeline sobre ese supuesto — mismo criterio de
"verificar contra el binario/librería real antes de confiar un diseño" ya
aplicado en la Fase 14 con el parser LDT.

## Arquitectura

### `hooks/ifcImport/` (nuevo)

- **`ifcClient.ts`**: wrapper delgado de `IfcAPI` (`createIfcApi`,
  `openIfcModel`, `closeIfcModel`). En navegador, `SetWasmPath('/wasm/',
  true)` + `Init(undefined, true)` (single-thread forzado, evita depender
  de `web-ifc-mt.wasm`/cabeceras COOP-COEP no configuradas en este
  proyecto) — guardado tras `typeof window !== 'undefined'`, porque en Node
  (tests) el paquete ya resuelve `web-ifc-node.wasm` solo.
- **`ifcLengthUnitScale.ts`**: factor a metros para ATRIBUTOS numéricos
  planos (ej. `IfcBuildingStorey.Elevation`) — la geometría NO lo necesita
  (ver spike). Solo `IfcSIUnit` con prefijo estándar; unidades imperiales
  (`IfcConversionBasedUnit`) devuelven `null`, nunca se asume 1 en
  silencio.
- **`convexHull2D.ts`**: casco convexo 2D (algoritmo monótono de Andrew),
  sin dependencias.
- **`ifcSpatialStructure.ts`**: usa `Properties.getSpatialStructure`
  (utilidad propia de `web-ifc`, ya probada) en vez de recorrer a mano
  `IfcRelAggregates`/`IfcRelContainedInSpatialStructure`. Conserva
  `globalId` de cada storey/espacio — el requisito explícito de "conservar
  IDs IFC".
- **`ifcSpaceFootprint.ts`**: extrae el polígono de planta + altura de
  CUALQUIER `IfcSpace` a partir de su malla YA teselada por `web-ifc` — no
  se interpreta a mano `IfcExtrudedAreaSolid` ni ningún tipo de
  representación IFC. **Limitación documentada explícitamente**: el
  polígono se aproxima con el casco convexo de los vértices del corte
  inferior de la malla — un espacio cóncavo (L/U/T) se "rellena" a su
  casco convexo (mismo criterio de simplificación documentada que
  `windowSkyAperture.ts::resolveInwardNormal` en la Fase 17).
- **`ifcImportPipeline.ts`**: `parseIfcFileForImport(data)` — punto de
  entrada único, función pura (sin React/store), abre+extrae todo+cierra
  el modelo.

### Datos nuevos

- **`hooks/types.ts::Room.ifcGlobalId?`** y **`Scene.ifcGlobalId?`** — el
  `GlobalId` STEP del `IfcSpace`/`IfcBuildingStorey` de origen, nunca
  fabricado, para que un ciclo futuro ("manejar cambios/reimportación")
  pueda reconciliar qué entidad del editor corresponde a cuál del archivo.
- `floorSlice.ts`/`useEditorStore.ts::updateFloor` ampliado para aceptar
  `ifcGlobalId` en su patch (existía como dos declaraciones de tipo
  duplicadas del mismo slice — se actualizaron ambas).

### UI

- Botón **"Importar IFC"** en el panel "Documento y exportación"
  (`ExportacionPanel.tsx`, junto al de DXF/DWG) → input `.ifc` oculto en
  `Toolbar.tsx` → `parseIfcFileForImport`.
- **`IfcImportDialog.tsx`** (nuevo, mismo patrón visual que
  `CalibrationDialog.tsx`): árbol nivel→espacios con checkboxes (todo
  seleccionado por defecto), área/altura de cada espacio, espacios sin
  geometría reconocible se muestran tachados y deshabilitados — nunca se
  importa a ciegas.
- Al confirmar: por cada nivel con al menos un espacio seleccionado,
  `store.addFloor(...)` (con `floorHeight` = altura máxima entre sus
  espacios importados) + `store.updateFloor(..., {ifcGlobalId})` +
  `store.setActiveScene(...)`; por cada espacio, `store.addRoom({vertices,
  height, ifcGlobalId, roomType:'room', ...})`.

### Empaquetado (bug de producción encontrado y corregido en este mismo ciclo)

`web-ifc` resuelve su `.wasm` vía `fetch` en runtime, no vía el bundler de
Vite — sin copiarlo a un path público servible, `IfcAPI.Init()` habría
fallado en producción con un 404 silencioso (mismo problema ya documentado
para los workers de `@mlightcad`). Agregado a `vite.config.ts`
(`viteStaticCopy`, con `rename: { stripBase: true }` para aplanar la ruta
— sin eso, el archivo queda anidado bajo `node_modules/web-ifc/...`,
detectado y corregido en este mismo ciclo). Verificado tras `npm run
build`: `public/wasm/web-ifc.wasm` existe con la ruta plana esperada por
`SetWasmPath('/wasm/', true)`.

## Fuera de alcance (explícito, diferido)

Exportar luminarias a IFC, reimportación/diffing de cambios, geometría de
`IfcSpace` con planta cóncava (casco convexo la aproxima, no la
reconstruye exacta), "superficies" IFC (paredes/ventanas → `Wall`/`Window`
de este editor), unidades imperiales para atributos no-geométricos,
multi-threading (`web-ifc-mt.wasm`, requiere cabeceras COOP/COEP no
configuradas).

## Verificación

- 15 tests nuevos (`ifcClient`, `ifcLengthUnitScale`, `convexHull2D`,
  `ifcSpatialStructure`, `ifcSpaceFootprint`, `ifcImportPipeline`), todos
  contra el fixture IFC real (no mocks del parser) — incluye verificación
  cruzada de área/altura/posición contra las dimensiones con las que se
  autoró el fixture.
- `npx vitest run resources/js/pages/dialux`: 753/753 (738 previos + 15
  nuevos).
- `tsc --noEmit -p .`: sin errores en ningún archivo nuevo/tocado.
- `npm run build`: OK — incluye verificación manual del asset `.wasm`
  copiado y aplanado correctamente.
- `fileSizeBudget.test.ts`: sin nuevas violaciones.
- **No verificado en navegador** (UI end-to-end: importar un `.ifc` real
  en el editor corriendo) — recomendado antes de dar el flujo por
  completamente probado, dado que la Fase 17 mostró que un bug de
  integración UI puede pasar desapercibido para la suite de tests.
- Nota de tamaño de bundle: `Toolbar.tsx` ahora incluye el wrapper
  JS de `web-ifc` (chunk de ~3.5 MB sin comprimir / ~406 KB gzip) —
  funciona, pero no se optimizó con `import()` dinámico en este ciclo
  (el resto de las herramientas de importación tampoco lo hacen hoy).
