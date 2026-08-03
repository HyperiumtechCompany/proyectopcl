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

## 3-6. Pendientes

`RoomProps.tsx`, `House3DBuilder.ts`, exportadores PDF/DXF y normativa — no
iniciados. Antes de retomar el resto de `MlightcadCanvas2D.tsx` (más allá de
esta extracción conservadora), se recomienda escribir el test caracterizador
descrito arriba.
