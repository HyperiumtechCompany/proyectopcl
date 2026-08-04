# Fase 12 — Progreso: rendimiento (Worker y WASM)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 12 ("Rendimiento: Worker y WASM").

## Decisión de alcance

A diferencia de las Fases 6-11 (fórmulas físicas/trazabilidad), esta fase es
de infraestructura de rendimiento y toca dos cosas de riesgo muy distinto:
mover el solver a un Web Worker, y migrar un kernel a Rust/WASM (lo segundo
requiere un toolchain — cargo/wasm-pack — ajeno al resto del repo). Se
consultó al usuario y se optó por el alcance completo ("Worker + WASM
completo"), no solo el Worker.

Durante la exploración previa a implementar apareció un hallazgo que
cambiaba el plan: **ya existía un crate `dialux-core`** (Rust +
wasm-bindgen, con `lighting.rs` implementando un motor de cálculo
punto-a-punto + UGR completo), pero es un scaffold viejo y desconectado —
su propio README describe un frontend Konva/Babylon.js que no existe en
este repo, sin tests, y sin ninguna de las físicas de las Fases 6-11
(oclusión, interreflexión, UGR con observadores, escenas). Verificado por
grep: **cero callers** de `calculate_lighting`/`get_ies_candela`/etc. en
`resources/js/` — solo `parse_dxf_web` (DXF) se usa realmente, desde
`useWasmEngine.ts`. Se preguntó al usuario cómo tratarlo; se eligió
**ignorar `lighting.rs` y agregar el kernel nuevo aparte**, en el mismo
crate (reutiliza el toolchain/build ya configurado, sin tocar código
ajeno ni fusionar dos motores de iluminación).

También se detectó (y no era un bug de configuración) que
`npm run wasm:build` nunca se había corrido en este checkout:
`dialux-core/pkg/` existía por un build manual antiguo, pero
`public/dialux-core/pkg/` (lo que `useWasmEngine.ts` realmente carga) no
existía — la carga WASM de DXF estaba cayendo siempre al parser TS de
respaldo, en silencio. Se corrigió simplemente corriendo el build (el
script ya apuntaba al lugar correcto); esto beneficia incidentalmente al
DXF, aunque no era el objetivo de este ciclo.

## 1. Kernel identificado y portado a Rust/WASM

De `iterativeRadiosity.ts`/`directIlluminance.ts`/`fase0_benchmark_dialux.md`:
el término que más escala con el tamaño real de un proyecto es
`illuminanceFromFixture` (`hooks/directIlluminance.ts`, llamada `puntos ×
luminarias` veces por ambiente) — no la radiosidad, que opera sobre ~6-15
parches fijos por recinto y hoy tampoco está activa en ningún camino de
producción.

Nuevo `dialux-core/src/direct_illuminance.rs`: puerto fiel de
`interpolate1D`/`foldAzimuthToCRange`/`candelaFromPhotometricWeb`/`candela`
(`photometricInterpolation.ts`) + `illuminanceFromFixture` (incluida la
oclusión por segmento, método de slabs, `segmentOcclusion.ts`). Expone
**una función por lotes** (`compute_direct_illuminance_grid`, JSON-in/JSON-out,
mismo patrón que el resto del crate) — cruzar la frontera JS↔WASM por cada
punto×luminaria habría anulado cualquier ganancia. 7 tests de Rust, varios
espejo EXACTO de casos de `photometricInterpolation.test.ts` (mismos
fixtures, mismo valor esperado) — verificación independiente del puerto,
no "confiar en la traducción". `lighting.rs` y el resto de módulos viejos:
sin tocar.

## 2. Inyección no disruptiva en el motor TS

`hooks/directIlluminance.ts`: nuevo tipo `DirectIlluminanceBatchKernel`.

`hooks/lightingEngineCore.ts`: `calculatePointByPoint`/`calculateLightingResult`
ganan **un parámetro opcional más** (`directIlluminanceBatch`), default
`undefined` → el bucle `fixtures.reduce(...)` de siempre, sin cambios, para
todo llamador existente (mismo patrón "default no disruptivo" de cada fase
anterior). Este archivo sigue sin saber nada de WASM/Worker (domain-purity,
`eslint.config.js` §4.1).

`domain/calculation/runDirectPreviewEngine.ts`: el `.map()` de
`calculationObjects` pasa a un `for...of` con `await new Promise(resolve =>
setTimeout(resolve, 0))` entre objetos — cede el hilo de verdad (un yield
de microtarea, `Promise.resolve()`, NO habría bastado: los mensajes
`postMessage` del worker se procesan como macrotareas). Nuevo parámetro
`runOptions?: { onProgress?, isCancelled?, directIlluminanceBatch? }`;
`isCancelled` cortando el bucle produce `status:'cancelled'` con las
`surfaces` ya calculadas hasta ese punto (`CalculationRunStatus` ya incluía
`'cancelled'` desde la Fase 1 — sin cambio de contrato). Ninguno de estos
cambios altera un solo valor calculado — solo scheduling y un punto de
salida anticipada opcional.

## 3. Web Worker + hook

Nuevo `hooks/wasmDirectIlluminanceKernel.ts`: carga perezosa del módulo
WASM, mismo patrón exacto que `useWasmEngine.ts` (truco
`new Function('u','return import(u)')` para esquivar el análisis estático
de Vite sobre una URL de runtime en `public/`) — si falla, devuelve `null`
sin lanzar.

Nuevo `workers/dialuxCalculationWorkerProtocol.ts` (tipos compartidos) +
`workers/dialuxCalculationWorker.ts` (worker de módulo nativo de Vite):
protocolo start/progress/cancel/result/error. Al iniciar, intenta cargar el
kernel WASM una sola vez (cacheado dentro del worker, reutilizado entre
cálculos sucesivos); si no está disponible, sigue con el motor TS puro sin
bloquear. `cancel` marca una bandera que `runDirectPreviewEngine` consulta
entre ambientes — cancelación **cooperativa**, no puede interrumpir un
ambiente a mitad de cálculo.

Nuevo `hooks/useDialuxCalculationWorker.ts`: una sola instancia de `Worker`
por montaje de `EditorLayout` (reutilizada entre clicks de "Calcular",
terminada al desmontar — cumple "sin crecimiento de memoria entre
ejecuciones repetidas" sin código extra de presupuesto de memoria).

## 4. Conexión a la UI real

`components/EditorLayout.tsx` → `runCalc`: antes llamaba a
`engine.calculate()` (síncrono, con un `setTimeout(fn,0)` que NO liberaba
el hilo durante el cálculo real) una vez por ambiente. Ahora construye UN
`CalculationSnapshot` del proyecto (`buildCalculationSnapshot`) y lo envía
al worker; los ambientes locales (`room`/`fixtures` para `ResultsPanel`) se
derivan con `deriveSceneAmbientSpaces` — la MISMA función que usa
`buildCalculationSnapshot` internamente, para que `ambient.room.id`
coincida exactamente con `objectId` en `CalculationRun.surfaces` (antes el
archivo usaba la primitiva por-room `deriveAmbientSpaces`, que no garantiza
el mismo esquema de ids). Si el worker falla al crearse (caso extremo, sin
soporte), cae al camino síncrono anterior con `console.warn` — nunca deja
la app sin poder calcular. Nuevo botón "Cancelar" (visible mientras
`isCalculating`) llama a `calcWorker.cancel()`; un cálculo cancelado
actualiza los resultados parciales sin abrir el modal de resultados
automáticamente.

## Verificación

- `cargo test` (`dialux-core/`): 7/7 (+1 benchmark `#[ignore]`).
- `npm run wasm:build`: genera `public/dialux-core/pkg/` con
  `compute_direct_illuminance_grid` exportado (confirmado por grep en el
  `.js`/`.d.ts` generados).
- `npx vitest run resources/js/pages/dialux`: 640/640, sin ninguna
  variación en los goldens de fases anteriores. Nuevos: 4 en
  `lightingEngineCore.directIlluminanceBatch.test.ts`, 2 en
  `wasmDirectIlluminanceKernel.test.ts` (fallback seguro — ver nota abajo),
  4 en `runDirectPreviewEngine.runOptions.test.ts` (progreso/cancelación/kernel),
  2 en `__benchmarks__/fase12WasmKernelBenchmark.test.ts`.
- `tsc --noEmit`/ESLint: limpios en todos los archivos tocados/creados de
  esta fase (los ~87 errores de tsc restantes en el árbol son preexistentes,
  de la sesión concurrente no relacionada — confirmado filtrando por
  archivo).
- `npm run build`: OK. Confirmado que Vite bundló el worker como chunk
  separado (`dialuxCalculationWorker-*.js` en `public/build/assets/`).
- **No se hizo prueba manual en navegador real** (esta sesión no tiene
  acceso a un navegador/herramienta de automatización) — la integración
  Worker↔WASM↔UI está verificada por construcción y por tests unitarios de
  cada pieza por separado, pero el flujo end-to-end completo (click
  "Calcular" → worker → WASM real → modal de resultados) no se ejecutó
  visualmente. Recomendado antes de dar la fase por cerrada en producción.

### Nota sobre `wasmDirectIlluminanceKernel.test.ts`

`ensureWasmDirectIlluminanceKernel` carga el módulo vía una URL absoluta de
runtime (`/dialux-core/pkg/dialux_core.js`, servida por Vite desde
`public/` en el navegador). En vitest/Node esa ruta nunca resuelve, así que
el test NO verifica el cálculo WASM en sí — verifica que el fallback es
seguro (nunca lanza, siempre cae al motor TS). La paridad numérica del
puerto Rust se verifica con los 7 tests de `cargo test` (mismos fixtures
que `photometricInterpolation.test.ts`), no con un test JS que ejecute el
`.wasm` real.

### Nota sobre el benchmark

No existe job de rendimiento en `.github/workflows/` (solo `lint.yml`/
`tests.yml`) — no se agregó un gate de CI, solo un test de benchmark local
(mismo estilo que `fase0Benchmark.test.ts`). Números de referencia (esta
máquina, no rigurosos entre procesos distintos):

| Escala | TS puro (Node/vitest) | Rust release (nativo, `cargo test --release --ignored`) |
|---|---|---|
| Pequeña (96 pts × 4 luminarias) | 0.485 ms | 0.033 ms |
| Mediana (20 ambientes × 96 pts × ~10 luminarias) | 4.418 ms | 1.004 ms |

Estos dos números NO se midieron en el mismo proceso/runtime (Node vs.
binario nativo) — son direccionales, no un benchmark WASM-en-navegador
riguroso (eso requeriría el `.wasm` real corriendo en un navegador, que
esta sesión no puede automatizar). Confirman que el kernel Rust es
sustancialmente más rápido en cómputo puro; el beneficio real en el
navegador dependerá también del costo de serialización JSON al cruzar la
frontera JS↔WASM, no medido aquí.

## Pendientes (fuera de alcance de este ciclo)

- **Prueba manual en navegador real** del flujo completo (ver arriba) —
  recomendado antes de considerar la fase 100% cerrada.
- **`solveRadiosity`/`computePatchFormFactorMatrix` sin portar a WASM** —
  segundo candidato identificado, sin urgencia (radiosidad aún no está
  activa en ningún camino de producción).
- **`lighting.rs`/`ies_parser.rs`/`ldt_parser.rs`/`gldf_reader.rs`/
  `building.rs` siguen sin tocar** — código muerto del scaffold viejo,
  decisión explícita del usuario de no tocarlo en este ciclo.
- **`useDialuxPdfExport.ts` sigue sin usar el worker** — mantiene
  `runProjectLightingCalculation` síncrono de la Fase 11 (ya muestra un
  modal bloqueante propio; menor urgencia que la edición en vivo).
- **Cancelación cooperativa, no preventiva** — un ambiente
  excepcionalmente grande podría tardar más de 500ms en responder a
  "Cancelar" (documentado en el propio código); cancelación dura
  requeriría `SharedArrayBuffer`/`Atomics` con headers COOP/COEP en
  Laravel, fuera de alcance.
- **Sin gate de rendimiento en CI** — solo test de benchmark local,
  documentado arriba.
