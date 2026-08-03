# Fase 3 — Progreso: fotometría normalizada y orientación 3D

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 3 ("Garantizar que el dato de fabricante llega correctamente al solver").

## Alcance de este ciclo (acordado con el usuario, 2026-08-02)

La Fase 3 completa es grande (parsers PHP + contrato TS + solver). Se acotó
a 3 piezas de alto valor / riesgo acotado, dejando el resto documentado como
pendiente explícito (ver §"Pendientes" abajo):

1. **Procedencia fotométrica** (real/manual/sintética) — exigido literalmente
   por la puerta de salida del plan: "ninguna fotometría sintética se
   reporta como fabricante".
2. **Validaciones de integridad**: monotonicidad de ángulos, dimensiones de
   la matriz de candela, y consistencia flujo declarado vs. flujo integrado.
3. **Fix de un bug real**: `TILT=INCLUDE` en IES estaba mal parseado.

## 1. Investigación previa (sin cambios de código)

Inventario completo de `app/Services/ProductImportService.php` (977→~1080
líneas), el contrato `Fixture.photometricWeb` en `hooks/types.ts`, y cómo
`lightingEngineCore.ts::candela()` consume la matriz. Hallazgos clave:

- **GLDF nunca extrae fotometría** (mayor brecha de los 3 formatos) — fuera
  de alcance de este ciclo.
- **`TILT=INCLUDE` mal parseado**: leía la línea de geometría lámpara-
  luminaria como si fuera directamente `N` (cantidad de pares), y saltaba
  una cantidad de líneas físicas en vez de tokens — corrompía el offset de
  todo lo que viene después cuando un archivo real declaraba tilt.
- **Sin validación** de monotonicidad de ángulos, dimensiones de matriz, ni
  cruce flujo declarado/integrado, en ningún parser.
- **Simetría LDT (código EULUMDAT 0-4) se registra pero nunca se aplica**
  (no expande la matriz a los cuadrantes simétricos) — fuera de alcance.
- **Rotación yaw ya está conectada al solver** (`fixture.rotation` se resta
  del azimut antes de consultar la matriz); pitch/roll no existen — bloquea
  proyectores inclinados y wall-washers, fuera de alcance.
- **Sin concepto de múltiples superficies emisoras** por luminaria — bloquea
  luminarias lineales reales, fuera de alcance.
- **Cero archivos de fabricante reales** en el repo; tests existentes (TS y
  PHP) usan contenido sintético mínimo construido a mano.

## 2. Procedencia fotométrica — implementado

Nuevo campo `photometric_web.provenance` (backend) / `photometricWeb.provenance`
(frontend, `hooks/types.ts`), con 3 valores posibles:

| Valor | Cuándo se asigna |
|---|---|
| `manufacturer` | `parseIes`, `parseLdt`, y la salida del binario Rust (mismos archivos, misma procedencia) |
| `manual-curve` | Curva punto a punto ingresada a mano por el usuario (`buildManualPhotometricWebFromTable`) |
| `synthetic` | Modelo coseno^n derivado solo del ángulo de apertura declarado (`buildManualPhotometricWeb`) |

`withReportPayload` ahora agrega una fila **"Origen fotometría"** al final
de `technical_table` (al final para no correr los índices de las filas
existentes — dos tests ya asertaban por índice fijo) con un texto explícito
por procedencia (p. ej. "Modelo sintético aproximado (no es dato de
fabricante)"). GLDF (que no produce `photometric_web`) muestra "Sin matriz
fotométrica (aprox. Lambertiana en el cálculo)" y ahora agrega un `warning`
explícito de que la extracción GLDF no está implementada, en vez de omitir
el dato en silencio.

**Nota de alcance**: `domain/calculation/types.ts::CalculationLuminaire.photometricWeb`
(Fase 1) NO se extendió con `provenance` — hoy no tiene ningún consumidor
que lo necesite (el motor de cálculo no usa procedencia para nada), así que
agregarlo ahora sería diseño especulativo. Extenderlo cuando exista un
consumidor real (p. ej. un warning en `CalculationRun` por fotometría no
verificada).

## 3. Validaciones de integridad — implementado

Tres helpers nuevos en `ProductImportService.php`, usados por `parseIes` y
`parseLdt`:

- `checkAngleMonotonic(angles, label, warnings)`: agrega un warning (no
  bloquea el import) si los ángulos no son monotónicamente crecientes —
  señal casi segura de un offset de parseo equivocado.
- `checkMatrixDimensions(candela, expectedPlanes, expectedPerPlane, label, warnings)`:
  agrega un warning si la matriz no tiene la forma declarada por el
  archivo.
- `checkFluxConsistency(declaredLumens, candela, vAngles, hAngles, label, warnings)`:
  compara el flujo declarado contra `estimateLumens()` (integración de la
  propia matriz); tolerancia deliberadamente amplia (ratio 0.75-1.33) para
  no disparar por el error de integración normal de un muestreo angular
  coarse — solo atrapa discrepancias groseras (error de unidades/parseo).

Ninguna validación bloquea el import (mismo criterio que ya usaba el
parser para archivos truncados) — todas agregan un `warning` visible en
`report_data.warnings`, consistente con el resto del código.

## 4. Fix de `TILT=INCLUDE` (IES) — corregido

Antes: `$nPairs = (int) trim($lines[$idx])` leía la línea de **geometría
lámpara-luminaria** (un código 1/2/3) como si fuera la cantidad de pares
tilt, y saltaba `1 + $nPairs` **líneas físicas** — no correspondía a la
estructura real de LM-63 (geometría → N → N ángulos → N multiplicadores,
que pueden envolver cualquier cantidad de líneas físicas).

Ahora: se tokeniza todo el contenido restante en un solo flujo numérico
(igual que ya se hacía para el resto del archivo) y, si `TILT=INCLUDE`, se
consumen los tokens en orden correcto (geometría, N, N ángulos, N
multiplicadores) antes de los 10 campos de configuración estándar — robusto
a cualquier envoltura de línea. La tabla de tilt se registra en
`photometric_web.tilt` para trazabilidad, con un warning explícito de que
el multiplicador por ángulo de operación **todavía no se aplica** a la
matriz de candela (requeriría conocer el ángulo de operación real de la
lámpara, dato que el archivo no declara) — no fingir una corrección que no
ocurre.

## Verificación

- **PHP**: 21 tests en `tests/Feature/Dialux/ProductImportTest.php` (9
  nuevos + actualización de aserciones donde correspondía), cubriendo:
  procedencia IES/LDT/manual-curve/sintética, warning de monotonicidad,
  warning de dimensiones de matriz, warning de flujo inconsistente,
  `TILT=INCLUDE` parseado correctamente sin corromper la matriz, y warning
  de GLDF sin fotometría. Suite completa: **217 passed, 39 skipped, 0
  failed** (sin regresiones).
- **TS**: `vitest run` 506/506, `tsc --noEmit` sin cambios (123 errores
  preexistentes, ninguno nuevo), ESLint sin errores nuevos (16 preexistentes
  en `types.ts`, verificados contra el original), build de producción OK.
- `vendor/bin/pint --dirty --format agent`: pass.

## Pendientes (fuera de alcance de este ciclo, documentados para retomar)

- **GLDF**: no extrae fotometría en absoluto — la brecha más grande de los
  3 formatos. Requiere diseño propio (referencia a LDT/IES/LES embebido).
- **Simetría LDT**: el código EULUMDAT (0-4) se registra pero no expande la
  matriz a los cuadrantes simétricos que el archivo implica.
- **Pitch/roll de luminaria**: solo existe rotación yaw. Bloquea proyectores
  inclinados y wall-washers (dos de los 6 casos de prueba del plan).
- **Múltiples superficies emisoras**: no existe el concepto — bloquea
  luminarias lineales reales (otro de los 6 casos del plan).
- **Aplicación real del multiplicador de tilt** por ángulo de operación
  (la tabla ya se registra, pero no se usa en el cálculo).
- **Casos de prueba nombrados en el plan** que siguen sin cobertura: wall
  washer, proyector inclinado, luminaria lineal (bloqueados por los 3 puntos
  anteriores).
- **Archivos de fabricante reales**: todos los tests (TS y PHP) siguen
  usando contenido sintético mínimo construido a mano, no archivos IES/LDT
  reales de catálogo.
