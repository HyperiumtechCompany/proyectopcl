# Fase 0 — Primer benchmark del módulo DIALux

> Entregable "Primer benchmark" de la Fase 0 de
> `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md` (§11, §17).
> Generado: 2026-08-02. Reproducible con:
> `npx vitest run resources/js/pages/dialux/__benchmarks__/fase0Benchmark.test.ts --reporter=verbose`

## Metodología

- Medido con `performance.now()` alrededor de cada operación, una sola corrida
  (no percentiles ni promedio de N repeticiones — suficiente para una línea
  base, no para detectar regresiones de un dígito de milisegundo).
- Máquina: la que ejecuta este repo en el momento de escribir este documento
  (no se fijó hardware de referencia — si el equipo quiere comparabilidad
  estricta entre corridas, definir una máquina/CI runner de referencia antes
  de usar estos números como gate).
- Las aserciones del test (`fase0Benchmark.test.ts`) usan techos generosos
  (10-1000x el valor observado) para detectar solo regresiones catastróficas,
  no variación normal entre corridas.

## Resultados (motor `direct-preview-v1`, malla fija 0.5 m)

| Operación | Fixture | Tiempo observado |
|---|---|---:|
| Cálculo lumínico (`calculateLightingResult`) | Pequeña (1 recinto, 4 luminarias) | 1.15 ms |
| Cálculo lumínico (`calculateLightingResult` × 20) | Mediana (20 recintos, 200 luminarias) | 2.71 ms |
| Cálculo lumínico (`calculateLightingResult` × 24) | MÓDULO I (3 niveles, 24 ambientes) | 1.34 ms |
| Construcción DXF (`buildDxfDrawingPackage` + `buildDxfMultiSheetDocument`) | MÓDULO I (3 niveles) | 4.93 ms (documento de 27 335 caracteres) |
| Exportación PDF formal (`Editor2DController::formalExport`, Dompdf+Fpdi) | — | **No medido** — ver hueco abajo |

## Lectura de estos números

El motor actual (luz directa, sin oclusión ni interreflexión, malla de 0.5 m)
es órdenes de magnitud más rápido que cualquier presupuesto de UI razonable
incluso en el proyecto más grande medido (MÓDULO I). Esto es esperable: el
costo real llegará en fases posteriores del plan (oclusión con BVH — Fase 6,
interreflexión iterativa — Fase 8), no en el cálculo directo actual. Este
benchmark existe para tener un punto de comparación **antes** de que esas
fases añadan costo, no porque el rendimiento actual sea un problema.

## Hueco documentado: benchmark de PDF

El informe PDF formal se genera 100% server-side (Dompdf + Fpdi vía
`Editor2DController::formalExport`), consumiendo plantillas Blade
(`resources/views/dialux/export/formal-pdf.blade.php`, 1455 líneas). No corre
en el entorno Node/vitest usado para el resto de este benchmark. Medirlo
requiere un harness Pest/PHP separado (`php artisan test` con medición de
tiempo alrededor de la llamada a `Pdf::loadView(...)->save(...)`), fuera del
alcance de este primer ciclo de Fase 0. Queda como tarea pendiente explícita,
no como número inventado.

## Cómo regenerar

```
npx vitest run resources/js/pages/dialux/__benchmarks__/fase0Benchmark.test.ts --reporter=verbose
```

Los tiempos se imprimen por `console.log` con el prefijo `[fase0-benchmark]`.
Si al regenerar los números cambian de orden de magnitud, es señal de
regresión real — investigar antes de actualizar esta tabla.
