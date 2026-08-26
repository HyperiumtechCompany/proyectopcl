# Fase 15 — Progreso: Corrección de fichas fotométricas (CDL polar y UGR)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 15.

## Contexto y decisión de alcance

El usuario pidió abordar **ambas partes completas** de la fase en un solo
ciclo (CDL polar + tabla UGR de producto), sin auditoría previa del agente
`chief-electrical-engineer-reviewer` (a diferencia de la Fase 14). Antes de
tocar código se verificó el diagnóstico del plan contra el estado real del
código (podía estar desactualizado) y se investigó por web el método CIE
tabulado de UGR para no fabricar valores presentados como estándar.

## Hallazgos de la exploración

- **CDL polar**: `enrichProducts.ts` volvía a pedir el producto por HTTP en
  cada export; si la petición fallaba, solo hacía `console.warn` y
  `fixture.polarDiagramAssetId` quedaba sin asignar aunque
  `fixture.reportAssets.polar_svg` ya existiera localmente (persistido en
  el proyecto). Confirmado con file:line antes de tocar nada.
- **UGR de producto**: `enrichProducts.ts` leía
  `product.photometric_summary.ugr_table`, pero **ningún código del
  backend escribe esa clave** (recorrido completo de
  `ProductImportService.php`) — la ficha de producto siempre mostraba
  "Información UGR no disponible". La sección de UGR calculado por
  ambiente (`formal-pdf.blade.php`, tabla de resultados) ya vive en una
  página separada, sin mezclarse con la ficha de producto — esa parte del
  diagnóstico original del plan no aplicaba tal cual.
- El motor de UGR con observadores reales y posición de Guth
  (`hooks/glareCalculation.ts::evaluateUGR`, Fase 9, ya validado) es
  reutilizable para construir una tabla de referencia sin reinventar la
  fórmula física — solo hacía falta armar salas normalizadas y observadores
  en la posición correcta.
- El método CIE 117 tabulado real (grilla oficial completa de
  fabricantes) está detrás de texto pagado. Verificado por búsqueda web
  cruzada (soporte DIALux evo + fuentes independientes): sala de
  referencia con H=2m, SHR=0.25 → espaciado 0.5m, observador a 1.2m en la
  mitad de la pared (mismo valor ya validado en
  `glareObserver.ts::DEFAULT_UGR_EYE_HEIGHT` desde la Fase 9), dos
  direcciones de vista, salas en múltiplos de H desde (2H,2H) hasta
  (12H,8H). **No se pudo verificar letra por letra la grilla completa de
  19 salas/5 reflectancias publicada por CIE** — por eso el generador de
  esta fase es un cálculo propio acotado, nunca una reproducción
  certificada.

## Parte A — CDL polar sin dependencia de red

- `export/derived/data/buildPolarSvgFromMatrix.ts` (NUEVO): puerto TS puro
  (sin red, sin DOM) de `ProductImportService.php::buildPolarSvg()` —
  misma construcción geométrica, mismo formato de salida. Devuelve `null`
  sin matriz válida.
- `enrichProducts.ts`: la resolución de CDL por fixture ahora sigue un
  fallback explícito evaluado siempre, exista o no éxito de red:
  1. `fixture.reportAssets.polar_svg` ya persistido localmente.
  2. `product.report_assets.polar_svg` del catálogo remoto (si la petición
     tuvo éxito).
  3. Generación determinista desde `fixture.photometricWeb` vía
     `buildPolarSvgFromMatrix`.
  4. Sin ninguna fuente → el Blade ya maneja el caso ("Gráfico no
     disponible.").
- El `catch` de la petición por producto dejó de limitarse a
  `console.warn`: ahora se registra la causa por `productId` y, si
  ninguna de las 3 fuentes locales pudo resolver la CDL de un fixture de
  catálogo, se agrega una advertencia trazable.
- `enrichProducts()` cambió su retorno de `Promise<DialuxExportAsset[]>` a
  `Promise<{ assets, warnings }>`. Las nuevas advertencias se anexan a
  `snapshot.globalWarnings` en `buildDialuxExportAssets.ts` (mismo array
  que ya renderiza `frontMatter.ts` desde la Fase 13 — sin tocar Blade).

## Parte B — Tabla de referencia UGR de producto

- Contrato nuevo en `export/domain/types.ts`: `ProductUgrTable`/
  `ProductUgrTableEntry` (`provenance: 'manufacturer' | 'engine-calculated'`,
  `method`, `disclaimer`, `shr`, `reflectances`, `entries`). Espejado en
  `hooks/types.ts` (`Fixture.reportData.ugrTableComputed`), siguiendo el
  mismo patrón de duplicación ya existente entre ambos archivos para
  `reportData`/`reportAssets`.
- `export/derived/data/computeEngineUgrTable.ts` (NUEVO): genera la tabla
  reutilizando `calculateLightingResult`/`evaluateUGR` (motor de Fase 9,
  sin reimplementar la fórmula). Reglas:
  - Nunca corre sobre `photometricWeb.provenance !== 'manufacturer'`
    (curvas `synthetic`/`manual-curve` → no disponible, con motivo).
  - Sin matriz de candelas/ángulos válida → no disponible, con motivo.
  - 6 salas de referencia fijas en múltiplos de H=2m — (2H,2H) hasta
    (12H,8H) — pobladas con instancias de la misma luminaria espaciadas
    0.5m (SHR=0.25), reflectancias 70/50/20 aplicadas realmente a la
    simulación (no solo declaradas en la salida).
  - Por sala: `calculateLightingResult` (malla deliberadamente gruesa,
    1m, solo para `avg_lux`) → `Lb = avg/π`; luego `evaluateUGR` una vez
    por dirección (transversal/longitudinal) con un observador en la
    mitad de cada pared — nunca `buildDefaultObservers` (centroide), que
    no corresponde a la convención del método tabulado.
  - Salida siempre `provenance: 'engine-calculated'` con `disclaimer`
    explícito ("NO es una reproducción certificada de la tabla CIE 117").
    `'manufacturer'` queda reservado para cuando algún importador real
    provea una tabla del fabricante (hoy ninguno lo hace).
  - Memoizado por `productId` — varios fixtures del mismo producto no
    recalculan la tabla.
- `formal-pdf.blade.php`: la ficha de producto reemplaza el bloque muerto
  `ugrDiagramValue`/`ugrTable` por una tabla (sala, UGR transversal, UGR
  longitudinal) + el disclaimer de procedencia siempre visible. Sin datos,
  se mantiene "Información UGR no disponible".
- `FormalExportRequest.php`: reglas nuevas para
  `document.luminaires.*.reportData.ugrTableComputed` y sus campos
  anidados.

## Verificación

- **Bug propio detectado y corregido durante la verificación**: el
  generador calculaba `avg_lux`/`Lb` sin pasar las reflectancias 70/50/20
  a `calculateLightingResult` (parámetro omitido) — la simulación corría
  con 0% de interreflexión pese a que la tabla de salida declaraba
  70/50/20. Detectado por ESLint (`REFLECTANCES` declarado y nunca usado),
  no por un test — corregido pasando `REFLECTANCES` como
  `surfaceReflectances`; los 6 tests de
  `computeEngineUgrTable.test.ts` siguen pasando tras el fix.
- `npx vitest run resources/js/pages/dialux`: 690 tests, 688 pasan. Las 2
  fallas (`fileSizeBudget.test.ts` sobre `hooks/lightingEngineCore.ts`, y
  `runProjectLightingCalculation.test.ts`) son las mismas **preexistentes
  de la sesión concurrente** (`maintenanceFactor`) documentadas en fases
  anteriores — confirmado de nuevo vía `git diff`.
- 19 tests nuevos: `buildPolarSvgFromMatrix.test.ts` (8),
  `enrichProducts.test.ts` (5), `computeEngineUgrTable.test.ts` (6).
- `tsc --noEmit -p .` / ESLint: limpios en todos los archivos
  tocados/creados de esta fase (confirmado filtrando por archivo); los
  errores de `hooks/types.ts` (mojibake preexistente) y
  `buildDialuxExportAssets.ts` (import/order y `any` preexistentes) se
  verificaron vía `git diff` como ajenos a este ciclo.
- `npm run build`: OK.
- `php artisan test tests/Feature/Dialux/FormalExportTest.php`: 33/33 (146
  assertions) — incluye 2 tests nuevos (render Blade de la tabla UGR con
  disclaimer, validación POST de `ugrTableComputed`).
- `php artisan test tests/Feature/Dialux`: 77 pasan, 6 fallan, todas en
  `ProductImportTest.php` (parsing IES/GLDF) — **preexistentes**, mismo
  archivo sin ninguna modificación en este ciclo, ya documentado en la
  Fase 14.
- `vendor/bin/pint --dirty --format agent`: `{"result":"pass"}`.
- Config cache verificado y limpiado (`php artisan config:clear`) antes de
  cada corrida de Pest.

## Pendientes (fuera de alcance, documentado explícitamente)

- **Grilla oficial completa CIE 117** (19 salas × 5 combinaciones de
  reflectancia) — requiere el texto primario pagado; sin eso, ampliar más
  allá del subconjunto acotado de esta fase seguiría siendo "cálculo
  propio", nunca una reproducción certificada. La tabla actual ya lo
  etiqueta así en cada export.
- **`SHR` nominal variable** — solo se implementó `SHR=0.25` fijo.
- **Diagrama visual (SVG) de la tabla UGR** — esta fase entrega solo la
  tabla numérica; el diagrama gráfico queda para una iteración futura si
  se necesita.
- **`provenance: 'manufacturer'`** para la tabla UGR sigue sin ningún
  productor real (ningún importador IES/LDT/GLDF genera una tabla UGR de
  fabricante) — el contrato ya lo admite, listo para cuando exista esa
  fuente.
