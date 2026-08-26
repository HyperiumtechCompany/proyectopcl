# ADR 0001 — Unidades y ejes canónicos del dominio DIALux

- Estado: aceptado (formaliza una convención ya vigente en el código).
- Fecha: 2026-08-02.
- Contexto: Fase 0 de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`.

## Contexto

El plan maestro (§4.1) exige que el dominio geométrico y fotométrico sea la
única fuente de verdad para coordenadas y unidades. Antes de escribir
`CalculationSnapshot` (Fase 1) hace falta fijar por escrito qué convención ya
existe hoy, para no reinterpretarla accidentalmente al normalizar.

## Decisión

1. **Unidad canónica de longitud: el metro.** Toda geometría persistida en
   `Project`/`Scene`/`Room`/`Wall`/`Fixture` está en metros. Las unidades CAD
   nativas (de un DXF importado) se convierten a metros mediante
   `effectiveScale = scaleConfig.factor × scaleConfig.calibrationFactor`
   (`geometry/coordinateTransform.ts::getEffectiveScale`). Ningún módulo aguas
   abajo del import (cálculo, export DXF/PDF) debe volver a aplicar `factor`
   o `calibrationFactor` — ya están en metros.
2. **Plano XY = planta, convenio "Y hacia arriba" (CAD estándar), no "Y hacia
   abajo" (pantalla).** `x`/`y` de un `Vertex` son coordenadas de planta en
   metros. La inversión a coordenadas de pantalla (Y invertido, origen
   arriba-izquierda) ocurre únicamente en la frontera de renderizado
   (`createCanvasTransforms` en `coordinateTransform.ts`), nunca en el
   dominio.
3. **Eje Z = altura vertical en metros, relativa al piso del propio nivel
   (`Scene`), no absoluta al edificio.** `Fixture.z`, `Room.height`, alturas de
   muro, etc. se miden desde el nivel de piso terminado del `Scene` al que
   pertenecen. La posición absoluta de un nivel dentro del edificio es
   responsabilidad de `Scene.floorElevation` (acumulada desde `floorIndex` y
   `floorHeight` de los niveles anteriores) — el dominio geométrico interno de
   un nivel nunca sabe ni necesita saber su elevación absoluta.
4. **Ángulos**: grados sexagesimales en las APIs orientadas a datos de
   fabricante/UI (`fixture.rotation`, matrices fotométricas C-γ), radianes
   solo dentro de cálculos trigonométricos internos que se convierten en la
   misma función (ver `lightingEngineCore.ts`, conversión expĺicita
   `× 180 / MATH_PI`). No exponer radianes en ningún contrato público nuevo.
5. **Screen-space (píxeles CSS) vs. world-space (metros) es una frontera
   dura**: `view.screenToWorld`/`worldToScreen` de `@mlightcad/cad-simple-viewer`
   operan en píxeles CSS locales al canvas, sin `devicePixelRatio`. Ningún
   código de dominio o motor de cálculo debe recibir ni producir píxeles.

## Consecuencias

- `CalculationSnapshot.levels[].objects[].position` (Fase 1) se define
  directamente en metros, sin campo de unidad — no hace falta portar
  `scaleConfig` al snapshot, la conversión ya ocurrió antes.
- Cualquier solver futuro (oclusión Fase 6, interreflexión Fase 8) puede
  asumir metros y "Y arriba" sin normalizar de nuevo.
- Si en el futuro se soporta un proyecto con unidades imperiales de entrada,
  la conversión sigue ocurriendo en la frontera de importación DXF/DWG, nunca
  en el dominio ni en el solver.

## Referencia de código

`resources/js/pages/dialux/geometry/coordinateTransform.ts` (cabecera del
archivo) es la fuente primaria de este contrato; este ADR solo lo formaliza
como decisión de arquitectura y lo extiende al eje Z / elevación de niveles,
que aquel archivo no cubre.
