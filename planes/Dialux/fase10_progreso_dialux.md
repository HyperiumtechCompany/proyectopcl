# Fase 10 — Progreso: escenas luminosas y controles

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 10 ("Escenas luminosas y controles").

## Decisión de alcance

Esta fase activa contratos que existían desde la Fase 1 pero nunca se leían:
`LightingSceneState`/`LuminaireState.on`/`dimmingFactor` (`domain/calculation/types.ts`)
y `buildCalculationSnapshot.ts` siempre generaba una única "Escena por
defecto" (todo encendido), documentado explícitamente en el código como
pendiente de esta fase. A diferencia de las Fases 7-9 (fórmulas físicas
nuevas), Fase 10 es principalmente wiring/filtrado de qué luminarias
participan en el cálculo y con qué flujo — no introduce ninguna fórmula
nueva de por sí.

**Los "grupos de control" del plan ya existían** como
`LightSwitch.connectedFixtureIds` (entidad física del plano eléctrico) — no
se inventó un concepto nuevo de agrupación, solo se reutilizó ese existente
para resolver el estado de cada escena.

## 1. Modelo de datos — `hooks/types.ts`

- `SceneTrigger` (unión discriminada: `manual`/`schedule`/`sensor`) —
  "sensores y horarios como modelo inicial" (plan): **solo estructura de
  datos**, sin motor de evaluación. Nada activa una escena automáticamente;
  la selección sigue siendo explícita.
- `LightingScenePreset {id, name, switchStates: Record<switchId, {on, dimmingFactor}>, trigger?}` —
  una escena es un "diff" desde todo encendido: un interruptor NO listado en
  `switchStates` se asume encendido al 100%.
- `Scene` (NIVEL/piso — cuidado con el nombre, no es una escena lumínica)
  gana `lightingScenes?: LightingScenePreset[]`, opcional, no disruptivo.

## 2. Snapshot — `domain/calculation/buildCalculationSnapshot.ts`

Sin `lightingScenes` definido (`undefined`/`[]`, todo proyecto anterior a
esta fase): genera exactamente la misma "Escena por defecto" de siempre —
verificado con los tests existentes, sin ninguna variación. Con presets
definidos: una `LightingSceneState` POR preset (id = `${levelId}::${presetId}`),
misma geometría, sin duplicar nivel/objetos/luminarias (puerta de salida del
plan, verificada con test dedicado).

`resolveLuminaireStates` resuelve el estado de cada luminaria vía sus
interruptores controladores. Una luminaria con VARIOS interruptores
(conmutación multi-punto) usa reglas deliberadamente conservadoras: apagada
si CUALQUIERA de sus interruptores está apagado (AND), atenuación = la más
baja entre ellos (MIN) — no modela conmutación de 3 vías real (XOR).

## 3. Motor — `domain/calculation/runDirectPreviewEngine.ts`

Nuevo 3er parámetro `sceneSelectionByLevel?: Record<levelId, sceneStateId> | null`.
`resolveSceneForLevel`: selección explícita que coincide → la usa; id
inválido → advierte (`scene-not-found`) y cae a la primera escena del nivel;
sin selección → primera escena directamente (idéntico a antes de esta fase).
El flujo se escala (`lumens *= dimmingFactor`) ANTES de convertir a
`Fixture` — no como un factor posterior sobre el resultado final, para que
la regulación afecte correctamente interreflexión/UGR (que dependen de
cuánta luz entra al recinto, no solo del resultado punto a punto).

**Resultados independientes por escena / comparación de escenas**: llamar
`runDirectPreviewEngine` dos veces con distinta `sceneSelectionByLevel`,
sobre el MISMO snapshot, da dos `CalculationRun` independientes sin
recalcular geometría — es literalmente la puerta de salida del plan. Nuevo
`domain/calculation/compareLightingScenes.ts`: función pura que resta dos
`CalculationRun` ya calculados (avg/min/max/uniformity/ugr por objeto) sin
recalcular nada.

## Auditoría `dialux-calc-reviewer` y correcciones

1. **Mayor — `duplicateFloor` no remapeaba `lightingScenes.switchStates`**.
   `lightSwitches` SÍ recibe IDs nuevos al duplicar un piso (fix de una fase
   anterior, ya cubierto por su propia suite de regresión), pero
   `lightingScenes` llegaba sin tocar vía el spread `...source` — las claves
   de `switchStates` seguían apuntando a los IDs VIEJOS de interruptor, que
   ya no existen en el piso clonado. `resolveLuminaireStates` no encontraba
   la clave y trataba esos interruptores como "no listados" (encendidos al
   100% por defecto) — un preset como "Modo nocturno" se calculaba
   silenciosamente como si todo estuviera encendido en el piso duplicado.
   Corregido: `duplicateFloor` (`hooks/store/floorSlice.ts`) ahora remapea
   las claves de `switchStates` con el mismo `idMap` que usa para todo lo
   demás. Test de regresión en `floorSlice.test.ts`, verificado fallando sin
   el fix y pasando con él.
2. **Mayor — sin clamp de `dimmingFactor`**. La ruta Lambertiana de
   respaldo de `candela()` no protege contra flujo negativo (a diferencia de
   la ruta de fotometría real IES/LDT, que sí lo hace) — un `dimmingFactor`
   fuera de `[0,1]` (dato malformado) llegaría sin filtro al motor. Riesgo
   latente hoy (ninguna UI escribe `lightingScenes` todavía), pero el
   contrato ya lo permite. Corregido: `resolveLuminaireStates` recorta a
   `[0,1]` en el punto de lectura — mismo criterio que `clampReflectance` de
   la Fase 7.
3. **Mayor — `on:true, dimmingFactor:0` no se detectaba como "apagada"**.
   Una luminaria "encendida" pero con flujo cero pasaba el filtro de
   exclusión y quedaba en el array de luminarias del cálculo (aportando 0
   lux), así que ni `object-without-luminaires` ni el nuevo
   `all-fixtures-off-in-scene` se disparaban — el informe quedaba sin
   ninguna advertencia que explicara un resultado en 0. Corregido: el
   predicado de "efectivamente encendida" ahora exige `on && dimmingFactor > 0`.
4. **Menor — `LuminaireState` no se reordenaba antes de hashear**.
   `canonicalStringify`'s `hasStableId` solo reconocía la clave `id` —
   `luminaireStates` (que usa `luminaireId`) nunca se reordenaba, a
   diferencia de `luminaires`/`scenes`/`calculationObjects`. El orden ya era
   estable en la práctica (viene de un `.filter()`, no de un `Map`/`Set`),
   pero era una excepción silenciosa a la convención documentada del propio
   archivo. Corregido generalizando a un conjunto de claves estables
   (`id`, `luminaireId`) — sin tocar el nombre del campo en ningún contrato
   existente. Nuevo `canonicalStringify.test.ts` (no existía ningún test
   directo de este archivo antes), verificado fallando sin el fix.

### Aceptado sin cambio (decisión documentada, no un defecto)

- **`sceneSelectionByLevel` sin una clave de nivel no advierte** — es el
  caso normal de "no elegí nada para este nivel, usa el default", no una
  equivocación; agregar un warning ahí produciría ruido falso-positivo para
  el uso legítimo de seleccionar escena solo en ALGUNOS niveles.
- **Borrar un interruptor no limpia las claves huérfanas en `lightingScenes.switchStates`**
  (a diferencia de duplicar piso, donde SÍ se corrigió): tras revisar el
  caso, no es un bug de cálculo — `resolveLuminaireStates` solo itera
  `lightSwitches` REALES para construir `switchesByFixture`; un interruptor
  borrado simplemente deja a sus luminarias "sin controlador" (encendidas al
  100%, comportamiento físicamente razonable: el interruptor ya no existe en
  el tablero). La clave huérfana en `switchStates` queda como dato muerto
  inofensivo, no como una fuente de cálculo incorrecto — limpieza cosmética
  pendiente, no urgente.

## Verificación

- `vitest run`: 640/640, sin ninguna variación en los goldens/suite
  analítica de Fases 0/5-9. Tests nuevos: 8 en `buildCalculationSnapshot.test.ts`
  + 7 en `runDirectPreviewEngine.test.ts` + 3 en `compareLightingScenes.test.ts`
  (nuevo) + 4 en `canonicalStringify.test.ts` (nuevo, no existía) + 1 en
  `floorSlice.test.ts`.
- `tsc --noEmit`: sin errores nuevos en ningún archivo de esta fase.
- ESLint: limpio en todos los archivos tocados/creados de esta fase.
- `npm run build`: OK.

## Pendientes (fuera de alcance de este ciclo)

- **Ninguna UI crea/edita `lightingScenes`, `switchStates` ni usa
  `sceneSelectionByLevel`/`compareLightingScenes` todavía** — mismo patrón
  de pendiente que cada fase desde la 6: el motor está listo, ningún
  export/panel en vivo lo activa aún.
- **`SceneTrigger` (sensores/horarios) sigue siendo solo datos** — tal como
  pide el plan ("modelo inicial"), sin motor de evaluación real. Activar
  una escena automáticamente según sensor/horario es trabajo de una fase de
  producto futura, no de este ciclo de motor.
- **Sin limpieza de `switchStates` huérfanos al borrar un interruptor** —
  documentado arriba como decisión aceptada (dato muerto inofensivo, no un
  bug de cálculo), pendiente de limpieza cosmética si se justifica más
  adelante.
- **Conmutación multi-punto simplificada (AND/MIN, no XOR real)** —
  documentado en el propio código; modelar conmutación de 3 vías real
  requeriría conocer la topología del circuito, no solo qué interruptores
  controlan qué luminarias.
