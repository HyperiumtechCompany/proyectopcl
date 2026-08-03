# Fase 2 — Progreso de refactor de UI (plan maestro DIALux)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 2 ("Reducir monolitos sin modificar todavía el algoritmo fotométrico").
> Orden de extracción del plan: 1. CatalogPanel.tsx, 2. MlightcadCanvas2D.tsx,
> 3. RoomProps.tsx, 4. House3DBuilder.ts, 5. Exportadores PDF/DXF, 6. Normativa.

## 1. `CatalogPanel.tsx` — hecho (2026-08-02)

**1855 → 441 líneas** (−76%). Extraído a
`resources/js/pages/dialux/features/luminaires/catalog/` (sigue la estructura
destino del plan §7.3):

| Archivo | Líneas | Responsabilidad |
|---|---:|---|
| `catalogApi.ts` | 128 | Red/CSRF hacia `productRoutes` (Wayfinder) — sin cambiar ningún endpoint |
| `fixtureMappers.ts` | 53 | `toFixtureType`/`toFixtureShape`/mapeo producto→Fixture |
| `PhotometricCurveEditor.tsx` | 78 | Editor de curva gamma/candela (sub-form) |
| `ImportPhotometryForm.tsx` | 132 | Formulario de importación IES/LDT/GLDF |
| `ManualLuminaireForm.tsx` | 218 | Formulario de creación manual de luminaria |
| `useLuminaireCatalog.ts` | 229 | Caso de uso: productos importados, compartir/eliminar, paginación, aplicar modelo al store |
| `LuminaireCatalogSection.tsx` | 329 | Composición: grid compacto/lista completa + paginación + ambos formularios |

`CatalogPanel.tsx` (441 líneas restantes) ahora solo orquesta: tabs de
arquitectura, `<LuminaireCatalogSection />`, y las listas de interruptores,
cajas de paso, ventanas y puertas (cada una ~20-40 líneas de render, sin
estado propio más allá de filtros ya calculados). Su interfaz pública
(`CatalogPanelProps`) no cambió — los 17 consumidores existentes no
requirieron ningún cambio.

### Deuda que queda deliberadamente sin resolver en este paso

- `CatalogPanel.tsx` (441) y `LuminaireCatalogSection.tsx` (329) siguen por
  encima del presupuesto de componente React (§4.5, objetivo <250). Ambos
  están en `__architecture__/fileSizeBudget.allowlist.json` como deuda
  conocida. Camino de reducción futuro, no ejecutado ahora para no forzar
  fragmentación sin necesidad real (§4.5 "no fragmentar funciones cohesionadas
  solo para cumplir una cifra"):
  - `LuminaireCatalogSection.tsx`: separar el render de grid compacto del
    render de lista completa en dos componentes (son variantes casi
    mutuamente excluyentes, `isCompactFixtureGrid` decide cuál se monta).
  - `CatalogPanel.tsx`: las 4 listas restantes (interruptores, cajas de paso,
    ventanas, puertas) comparten casi exactamente el mismo patrón visual
    (icono + label + descripción + indicador activo) — un componente
    presentacional compartido (`CatalogListItem`) las reduciría a listas de
    datos, quitando ~150 líneas de JSX duplicado.
- 3 errores preexistentes de `react-hooks/set-state-in-effect` (ya estaban en
  el `CatalogPanel.tsx` original, ahora viven en `useLuminaireCatalog.ts`) no
  se corrigieron — corregirlos cambia el patrón de sincronización de estado,
  lo cual es un cambio de comportamiento, no de estructura, y este paso
  (§4.6 "refactor seguro") solo debía extraer sin cambiar comportamiento.

### Verificación de este paso

- `vitest run`: 506/506 (sin test dedicado de `CatalogPanel.tsx` — es un
  componente de UI sin suite propia; no se creó ninguno nuevo en este paso
  porque el criterio de la Fase 2 es "no cambia el resultado visual
  esperado", verificable por inspección/browser, no por golden numérico).
- `tsc --noEmit`: sin errores nuevos atribuibles a los archivos tocados
  (125 errores preexistentes sin relación, documentados en
  `fase0_inventario_dialux.md` §9.1).
- `npm run build`: OK.
- **Verificación en navegador: NO realizada.** El entorno de esta sesión no
  tiene disponible ningún driver de navegador headless (`chromium-cli`,
  Playwright, Puppeteer) ni un usuario/proyecto DIAlux sembrado para iniciar
  sesión — `curl` contra `/dialux` devolvió 500 antes de llegar a ninguna
  lógica de catálogo (problema de entorno/autenticación, no verificado si
  está relacionado con este cambio). **Pendiente**: el equipo debe abrir el
  editor de un proyecto real y confirmar visualmente que el catálogo de
  luminarias (grid compacto y lista completa), la importación IES/LDT/GLDF y
  la creación manual siguen funcionando igual antes de dar este paso por
  cerrado.

## 2. `MlightcadCanvas2D.tsx` — extracción conservadora (2026-08-02)

**1565 → 1397 líneas** (−11%, deliberadamente modesto). Este archivo es
cualitativamente distinto a `CatalogPanel.tsx`: es el traductor de
clics/arrastre del mouse a mutaciones de geometría real (recintos, muros,
luminarias, cableado), sincronizado con el motor CAD nativo vía un loop RAF
único, con ~30 callbacks de mutación entrelazados con estado de UI
(previews, calibración, medición de área) y con advertencias explícitas en
el propio código sobre orden de declaración sensible a TDZ. No tiene test
caracterizador, y esta sesión no tiene navegador headless disponible para
verificar en vivo (ver Fase 2 §1 más arriba).

**Decisión (confirmada con el usuario)**: extracción conservadora únicamente
— solo piezas sin estado ni efectos propios. Se decidió NO tocar la lógica
de interacción/RAF/efectos hasta que exista forma de verificarla en vivo o
un test caracterizador previo (§4.6 del plan maestro).

Extraído a `resources/js/pages/dialux/components/canvas/`:

| Archivo | Líneas | Contenido |
|---|---:|---|
| `canvasToolConstants.ts` | 95 | `CURSOR_MAP`, `DRAWING_TOOLS`, `INTERACTIVE_TOOLS`, `CAD_OSNAP_TOOLS` — datos estáticos, cero lógica |
| `CanvasSvgDefs.tsx` | 21 | `<defs>` del overlay SVG (patrón de achurado + filtro de glow) — sin props |
| `CadStatusOverlays.tsx` | 97 | Loading/error/badge de documento/badge de calibración/label del motor — puramente presentacional |

Verificado bit a bit que cada bloque movido es exactamente el mismo JSX/dato
(diff visual contra el original), sin tocar ninguna línea de estado, efecto,
o de los ~30 callbacks de `useCanvasInteraction`.

### Lo que queda deliberadamente sin tocar (alto riesgo, fuera de este paso)

Toda la lógica de estado/efectos/interacción sigue en un único componente:
el loop RAF (sincronización de vista + cursor de arrastre), los 5 `useEffect`
(inicialización del motor, restauración de plano, reactivación de vista 2D,
ResizeObserver con debounce, wheel/zoom), el objeto gigante de callbacks de
`useCanvasInteraction`, y todo el árbol de overlays SVG con sus ~20 props
cada uno. Descomponer esto en los hooks que propone el plan
(`useCadLifecycle`, `useViewportTransform`, `useToolController`,
`useCanvasKeyboard`, `useOverlayModel` — §7.2) requiere, antes de tocarlo:
1. Un test caracterizador (§4.6) que cubra al menos: colocar un recinto,
   colocar una luminaria, arrastrar un objeto, hacer zoom, y calibrar.
2. Verificación visual real en navegador (bloqueada en este entorno).

### Verificación de este paso

- `vitest run`: 506/506 (sin test dedicado, igual que en el paso 1).
- `tsc --noEmit`: sin errores nuevos (125 preexistentes, sin cambio).
- ESLint: 5 errores en el archivo, los 5 preexistentes (verificado contra
  el original vía `git show HEAD:...`) — ninguno introducido por esta
  extracción.
- `npm run build`: OK.
- Verificación en navegador: no realizada (mismo motivo que el paso 1).

## 3. `RoomProps.tsx` — hecho (2026-08-02)

**1015 → 150 líneas** (−85%). A diferencia de `MlightcadCanvas2D.tsx`, este
es un panel de formulario/propiedades sin RAF ni motor CAD — mismo perfil de
riesgo que `CatalogPanel.tsx` (paso 1), así que se hizo extracción completa,
no conservadora.

Extraído a `resources/js/pages/dialux/components/properties/room/`:

| Archivo | Líneas | Contenido |
|---|---:|---|
| `RoomGeometrySection.tsx` | 146 | Nombre, área, perímetro, alto (o heredado), campos de pasadizo, conteo de ambientes |
| `StairConfigPanel.tsx` | 276 | Configuración de escalera (ya era un sub-componente separado; solo se movió a su propio archivo) |
| `RoomConstructionSection.tsx` | 47 | Material/tipo de edificación — solo recinto exterior |
| `RoomLightingSection.tsx` | 123 | Sección/subsección/aplicación normativa, iluminancia, cumplimiento |
| `RoomFixtureGridSection.tsx` | 156 | Grilla de luminarias — con su propio estado local (filas/columnas/picker), antes vivía en el padre |
| `RoomOutletsSection.tsx` | 127 | Tomacorrientes por ambiente |

`RoomProps.tsx` (150 líneas) ahora solo calcula los datos compartidos entre
secciones (`calculationRoom`, `area`, `perimeter`, `inputs`, listas
normativas) y compone las 5 secciones condicionalmente según
`isRecinto`/`isAmbiente`.

### Hallazgo: bloque de código muerto eliminado

El original tenía DOS bloques casi idénticos de "Tomacorrientes por
ambiente" — uno activo y uno envuelto en `{false && isAmbiente && (...)}`
(nunca se renderizaba, guardia literalmente `false`). Se eliminó el bloque
muerto al extraer `RoomOutletsSection.tsx` — cero riesgo comportamental
(la condición `false` garantiza que nunca produjo output), y de paso
elimina 2 de los errores de tipo preexistentes que arrastraba ese bloque
sin usar (`updateGeneratedOutletsForRoom`/`removeGeneratedOutletsForRoom`
sobre `EditorState`). Ver §9.1 de `fase0_inventario_dialux.md` para el
conteo original de esta deuda de tipos.

`RoomProps.tsx` se retiró de `fileSizeBudget.allowlist.json` (ya no supera
el umbral de 400 líneas).

### Verificación de este paso

- `vitest run`: 506/506.
- `tsc --noEmit`: **123 errores preexistentes (2 menos que el baseline de
  125)** — la reducción es el efecto esperado de eliminar el bloque muerto,
  no una corrección deliberada de tipos.
- ESLint: limpio tras un fix trivial de `import/order`.
- `npm run build`: OK.
- Verificación en navegador: no realizada (mismo motivo que los pasos 1-2 —
  sin chromium-cli/Playwright en este entorno). Este panel es de menor
  riesgo que el canvas (sin RAF/efectos de sincronización), pero de todos
  modos requiere confirmación visual antes de un merge.

## 4. `House3DBuilder.ts` — revisado, NO descompuesto; 3 fugas de memoria corregidas (2026-08-02)

**Decisión (confirmada con el usuario)**: se revisó el archivo a fondo antes
de decidir. El plan maestro ya advertía en su §24 no empezar por este
archivo "mientras el contrato de escena 3D no esté estabilizado" — la
revisión confirmó que esa condición sigue vigente:

- El archivo **creció** un 10% (3142→3469 líneas) desde que se escribió esa
  advertencia, mientras el resto del módulo se congelaba para el refactor.
- `hooks/wireLegacySync.ts` documenta en comentario que este builder
  "todavía no lee `Conductor` directamente" — depende de arrays legacy
  (`connectedFixtureIds`/`connectedSwitchIds`) como parche pendiente de
  resolver.
- `syncScene` mantiene dos modos de invocación coexistiendo (multi-piso vía
  `syncAllFloors` vs. modo "compatibilidad" standalone).
- `buildRoom` (908 líneas, el método más grande del archivo) mezcla recinto,
  rampa, pasadizo y **dos caminos de construcción de escalera** coexistiendo.
- **Cero tests** cubren esta clase.

Dado ese cuadro, **no se hizo ninguna extracción/reestructuración** de la
clase. Nota positiva encontrada: los tipos ya están correctamente
centralizados (una sola interfaz local, `FixtureBodyOptions`; todo lo demás
viene de `hooks/types.ts`) — cuando llegue el momento de descomponer, no
hace falta trabajo previo de migración de tipos.

### Hallazgo real corregido: 3 fugas de memoria de Babylon.js

La revisión encontró que `buildIsolux`, `buildLightSwitch` y `buildConductors`
(vía su helper `makeTube`) crean un `StandardMaterial` por instancia
(interruptor/conducto/isolux) en **cada resync** (cada edición del usuario
mientras el visor 3D está abierto), y sobrescriben su entrada en `meshMap`
sin disponer el material anterior — cada resync dejaba huérfanos esos
materiales (y, en el caso de isolux, también un `DynamicTexture`) en la
GPU, indefinidamente, en una sesión de edición larga. Esto es distinto a
`matFixtureCache`/`matElecDeviceCache`/`matStairMarkerCache`, que sí cachean
por color/tipo y se reutilizan correctamente entre resyncs.

Corrección aplicada (aditiva, sin cambiar la forma en que se construye la
escena):
- Nuevo método privado `disposeOwnedMeshes(meshes)`: dispone un grupo de
  meshes junto con su material (y texturas). Documentado explícitamente que
  SOLO es seguro para meshes con material exclusivo de esa instancia —
  nunca para meshes que usan un material cacheado a nivel de clase (eso
  rompería a todos los demás meshes que aún lo usan).
- Llamado al inicio de `buildIsolux` (`meshMap.get('isolux')`),
  `buildLightSwitch` (`meshMap.get(ls.id)`) y dentro de `makeTube` en
  `buildConductors` (`meshMap.get(name)`), antes de crear el nuevo mesh/material.
- `dispose()` (limpieza al desmontar el visor 3D) ahora también vacía
  `matElecDeviceCache` y `matStairMarkerCache` — antes solo se limpiaba
  `matFixtureCache`, dejando esos dos cachés sin disponer al cerrar el visor.

### Verificación de este paso

- `vitest run`: 506/506 (sigue sin existir ningún test dedicado a esta clase).
- `tsc --noEmit`: sin cambio (123, los mismos preexistentes; ninguno cerca
  de las líneas tocadas).
- ESLint: los 13 errores en el archivo son exactamente los mismos 13
  preexistentes (verificado contra el original vía `git show HEAD:...`),
  solo desplazados de línea.
- `npm run build`: OK.
- Verificación en navegador: no realizada (sin chromium-cli/Playwright en
  este entorno) — para este cambio en particular es aditivo (solo agrega
  disposición de recursos, no cambia geometría/materiales visibles), pero
  la confirmación real de que no aparecen errores de consola en runtime
  queda pendiente para el equipo.

## 5. Exportador PDF (`buildDialuxFormalDocument.ts`) — hecho (2026-08-02)

**1324 → 203 líneas** (−85%). A diferencia del canvas 2D y House3DBuilder,
este archivo es solo funciones puras de transformación de datos (sin
DOM/Babylon/React) y **ya tenía cobertura de tests real** sobre su única
función pública (`buildDialuxFormalDocument`): `fase5LevelPages.test.ts`,
`fase6AmbientDossier.test.ts`, `fase7StablePagination.test.ts`,
`fase8Glossary.test.ts`, `luminaireListPagination.test.ts`,
`dialux-export.test.ts`, `moduloIFixture.test.ts`,
`fase10FinalValidation.test.ts` (40 tests) — ninguno de ellos importa las
funciones internas, todos pasan por la función pública. Esto permitió una
extracción completa con alta confianza: los mismos 40 tests, sin modificar,
verifican que el resultado no cambió byte a byte.

Extraído a `resources/js/pages/dialux/export/document/`:

| Archivo | Líneas | Contenido |
|---|---:|---|
| `pageSeed.ts` | 26 | Interfaz `PageSeed` (representación intermedia de página antes de numerar) |
| `pagination.ts` | 247 | Constantes de filas/página, `chunkIndices`, generación de la tabla de contenidos |
| `productPages.ts` | 293 | Agregación de luminarias/productos (proyecto/nivel/ambiente) + páginas de lista/ficha de producto |
| `levelPages.ts` | 59 | Agregados por nivel (Scene) |
| `ambientDossier.ts` | 222 | Métricas por ambiente (`buildAmbientDetails`) |
| `roomAmbientPages.ts` | 216 | Páginas Recinto→Nivel→Ambiente (separado de `ambientDossier.ts`: datos vs. páginas, juntos superaban 400 líneas) |
| `frontMatter.ts` | 89 | Portada + observaciones preliminares |
| `terrainPages.ts` | 75 | Páginas de plano de terreno (CAD → dibujo → isolux) |
| `glossaryPages.ts` | 26 | Páginas de glosario |

`buildDialuxFormalDocument.ts` (203 líneas) ahora solo orquesta: llama a
cada builder en el orden correcto, arma la lista de páginas con su
numeración final (que depende de cuántas páginas de TOC hagan falta) y
construye el objeto `DialuxFormalDocument` final. Se retiró de
`fileSizeBudget.allowlist.json`.

### Corrección durante la extracción

Al transcribir `toFileBaseName` cometí un error propio: el regex
`/[̀-ͯ]/g` (quita marcas diacríticas tras `normalize('NFD')`) se
corrompió en caracteres Unicode literales en vez de la secuencia de escape
de texto. Detectado por inspección antes de dar el paso por terminado (no
por los tests, que no cubren ese caso límite específico) y corregido para
que el archivo sea byte-idéntico al original en esa línea.

### Verificación de este paso

- `vitest run`: 506/506, incluyendo los mismos 40 tests de exportación PDF
  sin ninguna modificación.
- `tsc --noEmit`: sin cambio (123).
- ESLint: sin errores nuevos (los pocos preexistentes — 3 escapes
  innecesarios en una regex, import/order en tests no tocados — verificados
  contra el original).
- `npm run build`: OK.
- No requiere verificación en navegador: es generación de datos/documento,
  no UI — la cobertura de tests existente es la verificación real.

## 6. Pendiente

Normativa — no iniciada.
