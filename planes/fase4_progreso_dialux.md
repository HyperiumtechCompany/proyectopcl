# Fase 4 — Progreso: objetos de cálculo y mallas

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 4 ("Dejar de limitar el cálculo a un único plano horizontal implícito por recinto").

## Alcance de este ciclo (acordado con el usuario, 2026-08-02)

La Fase 4 completa (superficies verticales/inclinadas/libres, huecos,
puntos/líneas de cálculo, malla adaptativa/normativa, múltiples superficies
por ambiente) es grande. Se acotó a dos piezas de riesgo bajo/moderado:

1. Generalizar el cálculo de incidencia (`illuminanceFromFixture`) para usar
   un vector normal explícito en vez de asumir horizontal en la fórmula —
   la base arquitectónica que exige la puerta de salida del plan ("el mismo
   solver calcula cualquier superficie mediante punto, normal y contexto").
2. Deduplicar el `pointInPolygon` que el motor tenía copiado localmente,
   distinto del de `geometry/polygonGeometry.ts` (que se autodenomina
   "fuente única de verdad" sin serlo en la práctica).

Un tercer hallazgo (zona marginal no aplicada por el solver) se dejó
explícitamente **sin tocar** — ver §"Pendiente crítico" abajo — porque
aplicarlo cambiaría los valores calculados de proyectos reales y requiere
validación de un ingeniero antes de aplicarse.

## 1. Investigación previa (sin cambios de código)

- **Cóncavos ya funcionan** hoy (ray-casting genérico, correcto para
  cualquier polígono simple) — no hacía falta tocar nada ahí.
- **Huecos (anillo interior) no existen** ni en el tipo de dato
  (`Room.vertices`/`CalculationObject.vertices` son siempre un solo anillo)
  ni en el algoritmo — fuera de alcance de este ciclo.
- **Ningún cálculo de superficie vertical/inclinada existe en ningún lado**
  del código — `illuminanceFromFixture` calculaba el coseno de incidencia
  como `-dz/dist`, matemáticamente solo válido si la normal receptora es
  `(0,0,1)`.
- **`CalculationObject` (Fase 1)** confirmado sin `normal`, sin soporte de
  múltiples superficies por objeto, sin tipo de superficie — solo un
  polígono horizontal con una altura.
- **Sin puntos/líneas de cálculo** independientes de la malla de área.
- **Sin malla adaptativa**: `CalculationConfig.meshPolicy.gridSpacingM`
  (Fase 1) es un campo vestigial — `runDirectPreviewEngine` ni siquiera lo
  pasa a `calculateLightingResult`, que sigue usando `GRID_SPACING`
  hardcodeado. Mismo patrón que `occlusion`/`interreflection`, ya
  documentado en Fase 1.

## 2. Normal generalizada en el cálculo de incidencia — implementado

`GridPoint` ahora incluye `normal: Vector3` (antes solo `{x,y,z,active}`).
`illuminanceFromFixture` calcula el coseno de incidencia (ley de Lambert)
como el producto punto entre la dirección unitaria punto→luminaria y
`point.normal`, en vez de la fórmula hardcodeada `-dz/dist`.

`buildGrid` sigue poblando **siempre** `HORIZONTAL_UP_NORMAL = (0,0,1)` —
el grid sigue siendo 100% horizontal, no se agregó ningún tipo de
superficie nueva todavía. Con esa normal, el producto punto se reduce
exactamente a la fórmula anterior — **verificado que los goldens de Fase 0
(pequeña/mediana/MÓDULO I) dan resultados idénticos, sin variar ni un solo
dígito decimal**.

Esto dispone la base arquitectónica (punto + normal + contexto) que la
puerta de salida de esta fase exige, sin todavía construir superficies
verticales/inclinadas reales — ese trabajo requiere, además, extender
`CalculationObject` con tipo de superficie y poblar `buildGrid` (o su
sucesor) con normales no triviales; ninguna de esas dos cosas se hizo en
este ciclo.

## 3. Deduplicación de `pointInPolygon` — implementado

`lightingEngineCore.ts` importa ahora `pointInPolygon` de
`geometry/polygonGeometry.ts` en vez de mantener su propia copia (algo más
simple, sin el chequeo de tolerancia de borde que sí tiene la versión
compartida). Verificado que el cambio no altera ningún resultado: los
puntos de malla se colocan en el centro de cada celda
(`px = minX + (col+0.5)*cellW`), por lo que caer exactamente sobre un borde
del polígono (el único caso donde ambas implementaciones podrían discrepar)
es una coincidencia de punto flotante que no ocurre en ninguna de las
fixtures/goldens existentes — confirmado por los mismos goldens de Fase 0
pasando sin cambios.

## Verificación

- `vitest run`: 506/506, incluyendo los goldens de Fase 0/1 sin ninguna
  variación numérica.
- `tsc --noEmit`: sin cambio (123 preexistentes).
- ESLint: limpio en `lightingEngineCore.ts`.
- `npm run build`: OK.
- Test dedicado de la normal generalizada: **no se agregó uno nuevo** — hoy
  no hay forma de ejercitar una normal distinta a `(0,0,1)` a través de la
  API pública (`buildGrid` siempre usa horizontal), así que un test
  "distinto" sería artificial (exportar algo solo para probarlo). La
  verificación real es que el comportamiento actual no cambió un bit — eso
  ya lo cubren los goldens existentes. Cuando exista un tipo de superficie
  vertical/inclinada real, ESE trabajo debe traer su propio test que
  ejercite `illuminanceFromFixture` con una normal no trivial.

## Pendiente crítico (no es "fuera de alcance", es una decisión de negocio pendiente)

**La zona marginal se calcula y se reporta (`LightingResult.marginal_zone`)
pero el solver NO excluye esos puntos del cálculo de avg/min/max/uniformidad/UGR**
— solo el informe PDF usa "área útil" para ese fin. Aplicar esto en el
solver cambiaría los valores calculados de proyectos reales existentes.
**Decisión explícita del usuario**: no tocar esto en este ciclo; requiere
que un ingeniero responsable confirme si excluir la zona marginal del
cálculo punto-a-punto (no solo del reporte) es lo correcto antes de
implementarlo.

## Pendientes (fuera de alcance de este ciclo)

- Superficies verticales/inclinadas/libres reales (requiere extender
  `CalculationObject` con tipo de superficie + normal por objeto, y que
  algo aguas arriba de `buildGrid` las pueble).
- Huecos/máscaras para polígonos con anillo interior.
- Puntos y líneas de cálculo independientes de la malla de área.
- Malla adaptativa/normativa (hoy 100% fija; `meshPolicy.gridSpacingM` es
  vestigial).
- Múltiples superficies de cálculo por ambiente (hoy 1 `CalculationObject`
  = 1 superficie).
- Casos de prueba del plan que siguen sin cobertura: pared vertical,
  superficie inclinada, polígono con hueco, refinamiento estable (todos
  bloqueados por los puntos anteriores).
