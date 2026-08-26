# Fase 6 — Progreso: visibilidad, oclusión y sombras

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 6 ("Visibilidad, oclusión y sombras").

## Decisión de alcance

No existe en el proyecto ningún raycasting/BVH reutilizable (verificado:
cero usos de `scene.pickWithRay`/`BABYLON.Ray`/`PickingInfo` en todo
`resources/js/pages/dialux/`) — construir esto significa empezar de cero de
todos modos, así que se optó por un solver de oclusión **puro** en
`domain/geometry/`, sin tocar `engine/House3DBuilder.ts` (sigue congelado
desde la Fase 2: sin tests, acoplamiento legacy con `Conductor`) ni depender
de Babylon en ningún punto — cumple la regla de pureza del dominio (§4.1)
que ya rige `hooks/lightingEngineCore.ts` y `domain/calculation/**`.

Cubierto en este ciclo, de los 6 casos nombrados por el plan:

1. **Bloqueo total por muro** — cubierto.
2. **Media apertura (puerta)** — cubierto.
3. **Ventana transparente** — cubierto (el vidrio nunca genera caja opaca).
4. **Punto cercano a superficie** — cubierto (sesgo paramétrico anti-acné).
5. **Objeto delgado** — cubierto (particiones de cualquier espesor).
6. **Dos niveles superpuestos** — cubierto solo en el sentido de que los
   obstáculos SE FILTRAN por nivel (`levelId`) antes de pasarlos al motor,
   así que un muro de un piso nunca ocluye el cálculo de otro piso. **No**
   se implementó oclusión de un nivel POR el nivel de arriba (la losa/techo
   de un piso bloqueando la luz que se filtraría a un pasadizo/hueco de
   escalera hacia el piso de abajo) — eso requeriría modelar la losa como
   obstáculo también, y hoy `getRoomStairHoles`/`resolveRoomCeilingHeight`
   solo existen dentro de `House3DBuilder.ts` (lógica de render, no
   portada). Documentado como pendiente más abajo.

## 1. Módulo de geometría de obstáculos — `domain/geometry/occlusionBoxes.ts`

Reimplementa (no comparte código con) la descomposición muro→cajas de
`House3DBuilder.ts` (sólido + antepecho + vidrio + dintel, sin CSG) de forma
pura: `buildWallOcclusionBoxes(walls, windows, doors)` y
`buildPartitionOcclusionBoxes(partitions, doors)` devuelven listas planas de
`OcclusionBox` (prisma en marco local: origen + ángulo + longitud + espesor +
rango Z). El vano de una ventana/puerta simplemente NO genera caja en su
franja — es la manera más directa de modelar "esto es transparente/está
abierto" sin necesitar un factor de transmitancia.

Detalles de fidelidad al modelo de datos real:
- `Door.bottomGap` (gap bajo puertas de baño, típico 0.15m) se respeta como
  altura mínima de la caja de antepecho de la puerta — no se asumió 0 fijo.
- Particiones de vidrio (`partitionType === 'glass'`) no generan ninguna
  caja — se tratan como completamente transparentes, igual que el vidrio de
  una ventana.
- `Partition.bottomGap` aplica a TODA la partición (no solo a sus puertas) —
  confirmado leyendo el comentario de `hooks/types.ts`.
- Puertas se asignan a muro o partición exclusivamente por `wallId`/
  `partitionId` (`!d.partitionId` al filtrar por muro), respetando la
  exclusión mutua documentada en el tipo.

## 2. Test de visibilidad — `domain/geometry/segmentOcclusion.ts`

`isSegmentOccluded(p0, p1, obstacles)` — método de slabs (Kay–Kajiya) contra
el segmento transformado al marco local de cada caja, funciona para
cualquier orientación de muro en XY. Sesgo paramétrico (`1e-6`, fracción del
segmento, no metros) recortado en ambos extremos evita que el propio punto
de cálculo o la propia luminaria se autoocluyan por redondeo cuando están
exactamente sobre la cara de una caja (caso nombrado por el plan, verificado
con un test explícito de tangencia en t=0).

## 3. Wiring en el motor — `hooks/lightingEngineCore.ts`

`calculateLightingResult(room, fixtures, spacingM, obstacles = [])` — cuarto
parámetro opcional, mismo patrón no disruptivo que `spacingM` en Fase 5:
con `obstacles=[]` (default) el resultado es idéntico al de antes de esta
fase para todo llamador existente (verificado: los 512 tests previos a esta
fase siguen pasando sin ninguna variación). La oclusión se aplica tanto a
`illuminanceFromFixture` (contribución directa) como a `calculateUGR` (una
luminaria oculta al observador tampoco puede deslumbrarlo) — mismo criterio
físico en ambos.

## 4. Contrato de dominio — `CalculationSnapshot.obstacles`

- `domain/calculation/types.ts`: nuevo `CalculationObstacle extends
  OcclusionBox { levelId }`, nuevo campo `CalculationSnapshot.obstacles`.
- `buildCalculationSnapshot.ts`: deriva obstáculos de
  `scene.walls`/`windows`/`doors`/`partitions` para cada escena/nivel.
- `hashSnapshot.ts`: `obstacles` entra tanto al hash completo del snapshot
  como al `geometryHash` (mover un muro invalida overlays 3D igual que mover
  un recinto).
- `runDirectPreviewEngine.ts`: **`config.occlusion` (Fase 0: existía en el
  contrato desde la Fase 1 pero `direct-preview-v1` lo ignoraba por
  completo) ahora tiene efecto real.** Con `occlusion: false` (default en
  `DEFAULT_DIRECT_PREVIEW_CONFIG`) el comportamiento es exactamente el de
  antes. Con `occlusion: true`, los obstáculos se agrupan por `levelId`
  (`groupObstaclesByLevel`) y solo se pasan al motor los del MISMO nivel que
  cada `CalculationObject` — un muro de un piso nunca ocluye el cálculo de
  otro piso.

## Verificación

- `vitest run`: 540/540 (527 previos + 27 nuevos: 9 `occlusionBoxes.test.ts`
  + 10 `segmentOcclusion.test.ts` + 8 `lightingEngineCore.occlusion.test.ts`),
  sin ninguna variación en los goldens/suite analítica de Fases 0/5.
- `tsc --noEmit`: sin errores nuevos en ningún archivo tocado (verificado
  con grep dirigido a los archivos de esta fase).
- ESLint: limpio en todos los archivos tocados/creados, incluida la regla
  de pureza de dominio (`domain/geometry/**/*.ts` se agregó al alcance de
  `no-restricted-imports`/`no-restricted-globals` en `eslint.config.js`).
- `npm run build`: OK.
- `fileSizeBudget.test.ts`: pasa; los 2 archivos nuevos (`occlusionBoxes.ts`
  ~165 líneas, `segmentOcclusion.ts` ~80 líneas) quedan muy por debajo del
  presupuesto de 400 líneas para servicios de dominio.

## Pendientes (fuera de alcance de este ciclo)

- **Mobiliario/objetos genéricos**: no existe ninguna entidad de este tipo
  en `hooks/types.ts` (confirmado en la investigación) — el solver de
  oclusión solo puede ocluir contra muros/particiones. Introducir un tipo
  `SceneObject`/`Furniture` es trabajo de modelo de datos, no de esta fase.
- **Canopies (voladizos) como obstáculos**: no se generan cajas para
  `Canopy` — son relevantes sobre todo para sombra exterior/luz solar
  (Fase 16/17), no para el caso de uso interior de esta fase.
- **Losas/techos como obstáculo entre niveles**: la variante real del caso
  "dos niveles superpuestos" (luz de un piso filtrándose a través de un
  hueco de escalera hacia el piso de abajo) no está modelada — requiere
  portar `getRoomStairHoles`/`resolveRoomCeilingHeight` de
  `House3DBuilder.ts` a una función geométrica pura compartida, sin tocar
  ese archivo todavía (sigue sin tests).
- **Transmitancia parcial de vidrio**: ventanas y particiones de vidrio se
  tratan como 100% transparentes (no reducen nada) o 100% opacas (nunca el
  caso de una ventana) — no hay factor de transmitancia intermedio. Es una
  simplificación razonable para un motor de vista previa, documentada para
  que el equipo decida si vale la pena modelarlo en una fase futura.
- **`config.occlusion` no está expuesto en ninguna UI todavía** — activar
  este modo requiere pasar `{ ...DEFAULT_DIRECT_PREVIEW_CONFIG, occlusion:
  true }` explícitamente a `runDirectPreviewEngine`; no hay ningún toggle de
  usuario. Es consistente con el patrón de Fase 5 (mesh policy) — cablear la
  UI real es una decisión de producto, no de este ciclo de motor.
- **Orden de canonicalización de `obstacles` en el hash**: a diferencia de
  `luminaires`/`materials` (que se ordenan por `id` en
  `canonicalStringify.ts` para que el hash sea independiente del orden de
  inserción), los obstáculos no tienen `id` propio, así que se serializan en
  el orden en que se generan (determinista dado el mismo `Project`, pero
  técnicamente sensible a reordenar muros en el store). Impacto: en el peor
  caso, invalidación de caché de más (nunca de menos) — no es un bug de
  corrección, solo una posible recomputación innecesaria. No se justificó
  agregarles `id` sintético para este ciclo.
