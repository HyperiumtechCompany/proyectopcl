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

## 2-6. Pendientes

`MlightcadCanvas2D.tsx`, `RoomProps.tsx`, `House3DBuilder.ts`, exportadores
PDF/DXF y normativa — no iniciados.
