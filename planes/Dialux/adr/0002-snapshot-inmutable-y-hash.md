# ADR 0002 — `CalculationSnapshot` inmutable y hash determinista

- Estado: aceptado (decisión de diseño para la Fase 1, aún no implementada).
- Fecha: 2026-08-02.
- Contexto: Fase 0/1 de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md` §4.2-4.3, §8.1.

## Contexto

El plan maestro ya fija la forma pública de `CalculationSnapshot` (§8.1) y el
principio "un cálculo nunca debe leer el store mientras está ejecutándose"
(§4.2). Lo que falta decidir antes de implementar la Fase 1 es: cómo se
normaliza el `ProjectDocument` (mutable, Zustand) hacia ese snapshot, y cómo
se calcula un hash estable que no dependa de detalles irrelevantes (orden de
inserción, referencias por identidad de objeto, etc.).

## Decisión

1. **Construcción del snapshot es una función pura**:
   `buildCalculationSnapshot(project: Project): CalculationSnapshot`, sin
   efectos secundarios, sin leer Zustand directamente — recibe el `Project`
   ya extraído del store por el llamador (`get().project`), nunca el store
   completo. Esto es lo que permite la garantía de "el snapshot no cambia al
   editar el store después de crearlo" (criterio de test de la Fase 1).
2. **Normalización antes de hashear**: todo array cuyo orden no sea
   semánticamente significativo (niveles, luminarias, ambientes, materiales)
   se ordena por `id` (orden lexicográfico ASCII) antes de serializar para el
   hash. El orden que el usuario ve en la UI (p. ej. `floorIndex` de
   niveles) se conserva en el snapshot para consumo normal — la normalización
   por `id` ocurre solo dentro de la función de hash, no en el snapshot en sí.
3. **Algoritmo de hash**: SHA-256 (Web Crypto `crypto.subtle.digest`, ya
   disponible en browser y Node ≥ 19) sobre un `JSON.stringify` determinista
   (claves ordenadas alfabéticamente, ver punto 2 para arrays). No se adopta
   una librería de hashing nueva — el plan maestro (§20) prohíbe agregar
   dependencias sin aprobación, y Web Crypto ya cubre el caso de uso sin
   costo adicional.
4. **Qué entra al hash y qué no**: entran geometría, materiales, luminarias
   (incluyendo su fotometría), escenas/objetos de cálculo y la versión de
   esquema (`schemaVersion`). NO entran: metadatos de UI (posición de cámara,
   panel abierto), timestamps (`created_at`/`updated_at`), ni el propio
   resultado de un cálculo anterior. Cambiar solo metadatos de UI no debe
   invalidar un `CalculationRun`.
5. **`geometryHash` vs. hash completo del snapshot**: se exponen ambos por
   separado. `geometryHash` cubre únicamente vértices/alturas/aberturas
   (permite invalidar overlays 3D sin recalcular fotometría). El hash del
   snapshot completo (`CalculationRun.snapshotHash`) cubre todo lo del punto 4
   y es lo que determina si un resultado pasa a `stale`.
6. **Invalidación (`stale`) es un cálculo derivado, no un evento empujado**:
   un `CalculationRun` no se marca `stale` activamente cuando cambia algo;
   en su lugar, cualquier consumidor que muestre un `CalculationRun` compara
   `run.snapshotHash` contra `buildCalculationSnapshot(currentProject)` hasheado
   al momento de mostrarlo. Esto evita mantener listeners de invalidación
   dispersos por todo el store (riesgo de olvidar uno) a cambio de recalcular
   el hash del snapshot actual cada vez que se muestra un resultado — barato
   dado el benchmark de Fase 0 (`planes/fase0_benchmark_dialux.md`, <5ms para
   MÓDULO I).

## Consecuencias

- El test "hash estable con orden irrelevante" (criterio de salida de Fase 1)
  se satisface por construcción gracias al punto 2, no por casualidad.
- El test "snapshot no cambia al editar el store después de crearlo" requiere
  que `buildCalculationSnapshot` haga una copia estructural (no solo
  referencias) de cualquier array/objeto que el store pueda seguir mutando.
- Cambiar la política de qué entra al hash (punto 4) es una decisión que
  requiere actualizar este ADR, no un cambio silencioso dentro de la función.

## Alternativas consideradas

- **Hash incremental por diff de comandos** (en vez de recomputar sobre el
  snapshot completo): más eficiente en teoría, pero acopla el hash al
  historial de comandos (`historySlice`) y complica la Fase 1 sin necesidad
  — el benchmark de Fase 0 muestra que recomputar es barato incluso a escala
  MÓDULO I. Se descarta por ahora; reconsiderar solo si un proyecto real
  supera un umbral de rendimiento medido, no de forma especulativa.
- **Librería externa de hashing (`object-hash`, etc.)**: descartada por la
  regla del plan maestro de no añadir dependencias sin necesidad probada;
  Web Crypto ya resuelve el caso de uso.
