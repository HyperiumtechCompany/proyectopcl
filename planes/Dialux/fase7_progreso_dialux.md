# Fase 7 — Progreso: materiales e interreflexión inicial

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 7 ("Materiales e interreflexión inicial").

## Decisión de alcance

El plan reserva el refinamiento adaptativo de superficies y la convergencia
iterativa para la **Fase 8** ("Interreflexión iterativa" — "Refinar
superficies adaptativamente"). Esta fase implementa deliberadamente un solver
de **un único rebote** (parche → punto, nunca parche → parche): cada parche
de la envolvente recibe SOLO luz directa de las luminarias (nunca lo que
reflejan otros parches), y esa luz reflejada llega a los puntos de la malla
una sola vez. Con reflectancia 0 el resultado es idéntico, bit a bit, al
cálculo directo — no una aproximación cercana.

`CalculationMaterial`/`CalculationSnapshot.materials` ya existían desde la
Fase 1 (contrato) pero `runDirectPreviewEngine.ts` nunca los leía — esta fase
los conecta por primera vez.

## 1. Discretización de la envolvente — `hooks/roomPatches.ts`

`buildRoomEnclosurePatches(room, reflectances)` genera un `EnclosurePatch`
por piso, uno por techo y uno por CADA ARISTA del polígono del recinto (no
una malla más fina por superficie — eso es explícitamente trabajo de Fase 8).
Cada parche lleva posición, normal (piso arriba, techo abajo, paredes hacia
el centroide — nunca hacia afuera), área real y su reflectancia ya recortada
a `[0,1]` (`clampReflectance`: NaN/Infinity → 0, fuera de rango → recortado).
Devuelve `[]` para un recinto sin polígono válido o de altura no positiva.

## 2. Solver de primera reflexión — `hooks/firstBounceReflection.ts`

- `computePatchDirectIlluminance(patches, fixtures, obstacles)`: iluminancia
  DIRECTA de las luminarias sobre cada parche (reutiliza
  `illuminanceFromFixture`, ver punto 3), respetando la misma oclusión que el
  cálculo directo.
- `firstBounceIlluminance(point, patches, patchIlluminance, obstacles)`: cada
  parche actúa como emisor Lambertiano de radiancia `L = E_directa · ρ / π`;
  la contribución a `point` es `L · área · cosθ_parche · cosθ_punto / dist²`
  (forma estándar de transferencia de flujo entre una superficie difusa y un
  punto receptor). Se descarta si el parche no "mira" al punto, si el punto
  no "mira" al parche, o si `isSegmentOccluded` bloquea la línea punto↔parche
  — la oclusión de Fase 6 se reutiliza sin duplicar lógica.

## 3. Extracción de `illuminanceFromFixture` — `hooks/directIlluminance.ts`

Antes vivía privada dentro de `lightingEngineCore.ts`. Se extrajo (sin
cambiar su fórmula) porque ahora la necesitan DOS consumidores puros
(`lightingEngineCore.ts` para puntos de malla, `firstBounceReflection.ts`
para parches) — evita duplicar la física de inverso-cuadrado + coseno de
Lambert + interpolación fotométrica. Efecto colateral: mantuvo
`lightingEngineCore.ts` bajo el presupuesto de 400 líneas de `§4.5`
(sin esta extracción habría quedado en 410).

## 4. Wiring en el motor — `hooks/lightingEngineCore.ts`

`calculateLightingResult(room, fixtures, spacingM, obstacles, surfaceReflectances = null)`
— quinto parámetro opcional, mismo patrón no disruptivo que `obstacles` en
Fase 6: con `surfaceReflectances = null` (default) el resultado es idéntico
al de antes de esta fase para todo llamador existente. Pasar
`{ ceiling: 0, wall: 0, floor: 0 }` en vez de `null` también reproduce el
cálculo directo EXACTO (verificado con test, no solo argumentado) — es
precisamente la puerta de salida del plan.

## 5. Wiring de configuración — `domain/calculation/runDirectPreviewEngine.ts`

- `config.interreflection === 'first-bounce'`: resuelve el material del
  objeto por `CalculationObject.materialId` → `CalculationSnapshot.materials`
  y pasa sus reflectancias a `calculateLightingResult`. Si el objeto no tiene
  material asignado, agrega el warning `object-without-material-reflectance`
  y calcula sin reflexión (rho=0 implícito) — nunca inventa un 70/50/20 típico
  en su lugar (plan §20: "no ocultar fallbacks sintéticos").
- `config.interreflection === 'iterative'`: **NO** cae a `'first-bounce'`.
  Agrega el warning `interreflection-iterative-not-implemented` y calcula
  solo luz directa — fingir un resultado "iterativo" con un solo rebote
  sería peor que advertir que no existe todavía (Fase 8).
- `config.interreflection === 'none'` (default): comportamiento idéntico a
  antes de esta fase, ningún costo adicional.

## Auditoría (`dialux-calc-reviewer`) y correcciones

Antes de cerrar el ciclo se ejecutó el agente `dialux-calc-reviewer` sobre
todo el diff. Encontró dos defectos reales (confirmados con ejecución, no
hipotéticos) y los corrigió este mismo ciclo:

1. **Violación de conservación de energía en campo cercano** (bloqueante).
   Un parche representa una superficie COMPLETA tratada como fuente puntual
   en su centroide — válido en campo lejano, pero un punto de malla cercano
   a un parche grande (recinto angosto, luminaria cerca del techo) caía en
   su campo cercano y el término `área·cosθ_parche·cosθ_punto/dist²` crecía
   sin cota, llegando a que un solo parche reflejara más luz de la que
   recibió (reproducido: recinto 1×6 m, componente reflejada de un solo
   parche = 586 lux contra una cota física de ~337 lux). Corregido acotando
   ese término a `π` en `hooks/firstBounceReflection.ts` — es la integral
   hemisférica completa de un emisor Lambertiano de radiancia uniforme
   (ningún parche, sin importar tamaño o cercanía, puede "verse" desde un
   punto en más de un hemisferio completo), así que la contribución de un
   parche queda acotada exactamente por `E_directa_parche · reflectancia`,
   nunca más. Test de regresión:
   `lightingEngineCore.firstBounce.test.ts` ("conservación de energía en
   campo cercano"), verificado fallando sin el clamp y pasando con él.
2. **Normal de pared invertida en recintos cóncavos** (mayor). `roomPatches.ts`
   determinaba la normal "hacia dentro" comparando contra el CENTROIDE
   GLOBAL del polígono — en un recinto en L/U/T el centroide puede caer
   fuera del polígono o del lado equivocado de una arista específica,
   invirtiendo esa normal en silencio (subestima la iluminancia y la
   reflexión de esa pared sin ningún aviso). Corregido: la normal ahora se
   deriva del sentido de recorrido del anillo (`polygonSignedArea`), una
   propiedad puramente local a cada arista, válida para cualquier polígono
   simple sea convexo o no. Test de regresión: `roomPatches.test.ts`
   ("recintos cóncavos"), verifica con `pointInPolygon` (no con el
   centroide) que cada normal apunta al interior real.

La investigación de (1) destapó un tercer defecto, independiente de esta
fase pero nunca antes ejercitado: el modelo Lambertiano de respaldo de
`candela()` (`hooks/photometricInterpolation.ts`, usado cuando una luminaria
no tiene `photometricWeb`) devolvía intensidad **negativa** para `gamma >
90°` (`intensity · cos(gamma)` sin recortar) — antes de esta fase,
`illuminanceFromFixture` solo se evaluaba con puntos de malla por
debajo/alrededor de la luminaria (`gamma` típicamente ≤ 90°); los parches de
techo de esta fase sí pueden quedar detrás de una luminaria orientada hacia
abajo. Corregido recortando a `Math.max(0, …)`. Test nuevo (antes no existía
ningún test para `candela`): `hooks/photometricInterpolation.test.ts`.

## Verificación

- `vitest run`: 562/562 (540 previos + 22 nuevos: 9 `roomPatches.test.ts` +
  7 `lightingEngineCore.firstBounce.test.ts` + 4 en
  `runDirectPreviewEngine.test.ts` + 2 `photometricInterpolation.test.ts`),
  sin ninguna variación en los goldens/suite analítica de Fases 0/5/6.
- `tsc --noEmit`: mismo conteo de errores preexistentes (123, no relacionados
  con DIALux ni con esta fase — verificado con `git stash` de los archivos
  tocados) antes y después del cambio.
- ESLint: limpio en todos los archivos tocados/creados, incluida la regla de
  pureza de dominio (`hooks/roomPatches.ts`, `hooks/directIlluminance.ts` y
  `hooks/firstBounceReflection.ts` se agregaron al alcance de
  `no-restricted-imports`/`no-restricted-globals` en `eslint.config.js`).
- `npm run build`: OK.
- `fileSizeBudget.test.ts`: pasa. `lightingEngineCore.ts` se mantuvo en 295
  líneas (habría llegado a 410 sin la extracción del punto 3); los 3 archivos
  nuevos quedan muy por debajo del presupuesto de 400 líneas para servicios
  de dominio.

## Pendientes (fuera de alcance de este ciclo)

- **Ninguna UI expone `ceilingReflectance`/`wallReflectance`/`floorReflectance`
  como campos editables todavía** — hoy solo se LEEN (con defaults 0.7/0.5/0.2
  que nunca se persisten) dentro de `WallProps.tsx` para el método de factor
  de utilización (lumen method), pero nada los escribe en el store. Efecto
  práctico: en un proyecto real de hoy, `buildCalculationSnapshot` casi
  siempre resuelve `materialId: null` para cada `CalculationObject`, así que
  activar `interreflection: 'first-bounce'` solo produce el warning
  `object-without-material-reflectance` hasta que exista un formulario que
  persista estos tres campos por recinto. Mismo patrón de pendiente que
  `config.occlusion` en la Fase 6 (motor listo, UI no cableada — decisión de
  producto, no de este ciclo de motor).
- **`config.interreflection` no está expuesto en ninguna UI todavía** —
  activar este modo requiere pasar `{ ...DEFAULT_DIRECT_PREVIEW_CONFIG,
  interreflection: 'first-bounce' }` explícitamente a `runDirectPreviewEngine`.
- **Sin rebotes entre parches** (parche→parche): cada parche solo recibe luz
  DIRECTA de las luminarias, nunca lo que reflejan otros parches — es
  exactamente el alcance de "primera reflexión" que pide el plan; los rebotes
  sucesivos y la convergencia son la Fase 8.
- **Discretización de un solo parche por superficie completa** (no una malla
  más fina por pared/techo/piso) — suficiente para un primer rebote
  aproximado; el plan reserva "refinar superficies adaptativamente" para la
  Fase 8.
- **Sin factor de mantenimiento en el solver punto a punto**: el plan pide
  "incorporar factor de mantenimiento en el lugar correcto" — hoy el único
  factor de mantenimiento del proyecto vive en `lightingCalculations.ts`
  (método de lumen/factor de utilización para estimar cantidad de
  luminarias), no en `calculateLightingResult`. Aplicarlo al solver punto a
  punto es una decisión de producto (¿multiplica el flujo de cada luminaria
  antes del cálculo? ¿se muestra como un resultado "mantenido" separado del
  "nuevo"?) que no se tomó en este ciclo — documentado para que el equipo la
  resuelva explícitamente, no una omisión silenciosa.
