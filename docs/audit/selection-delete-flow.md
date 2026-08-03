# Auditoría — Selección, eliminación y capas

## Estado antes de la Fase 2

- Hit-testing en `useCanvasInteraction.ts` (`onMouseDown`, rama `select`): cadena de
  `if (findNearestFixture) return; if (findNearestLightSwitch) return; ...` con
  prioridad fija y retorno temprano. El primer tipo que acertaba ganaba, aunque
  otro objeto estuviera físicamente más cerca del cursor.
- `findNearestRoom` (`useInteractionHelpers.ts`) medía distancia solo a los
  **vértices** del polígono, no al área — no se podía seleccionar un recinto
  clicando en su interior, solo cerca de una esquina.
- `removeObject(id)` (`sceneObjectsSlice.ts`) filtraba cada array por
  **igualdad exacta de id** — nunca eliminaba un contenedor al borrar un hijo
  (los ids son uuid únicos, no hay anidamiento estructural). El riesgo real
  no estaba en el borrado sino en que la **selección** podía apuntar a un
  objeto distinto del que el usuario creía tener resaltado.
- No existía ningún mecanismo de protección/confirmación para contenedores.
- Los objetos DIAlux nativos (`Room`, `Wall`, `Fixture`, ...) no tienen
  concepto de "capa" (`layer`) — solo las entidades DXF importadas lo tienen.
  Las relaciones son por id de referencia (`wallId`, `roomId`), no por capas
  funcionales bloqueables como propone la Fase 2 del plan en su totalidad.

## Qué se implementó (Fase 2)

### `selection/hitTest.ts` — ranking determinista

Reemplaza la cadena de `if` por evaluación de **todos** los candidatos bajo el
puntero, con prioridad estable:

```
0: interruptores, dispositivos eléctricos, luminarias (objetos puntuales)
1: ventanas y puertas
2: cables/conductores
3: marquesinas
4: muros y tabiques
5: ambientes/pasadizos/escaleras
6: recintos (envolvente)
```

Dentro de la misma prioridad gana el candidato más cercano al puntero; entre
contenedores superpuestos (ambiente dentro de recinto) gana el de **menor
área**; el empate final se resuelve por id (determinismo total). Los recintos
ahora se evalúan con **punto-en-polígono** (`geometry::pointInPolygon`), no
solo distancia a vértices.

`cycleCandidate` implementa selección cíclica: Alt+clic recorre los
candidatos superpuestos en orden estable sin repetir hasta completar el ciclo
(Prueba E del plan).

### `selection/deletionPolicy.ts` + `hooks/store/deletionSlice.ts` — eliminación protegida

`analyzeDeletion(scene, id)` determina si el objetivo es un contenedor
(recinto/ambiente/muro) y calcula sus hijos reales (luminarias/interruptores/
dispositivos dentro del polígono, o ventanas/puertas ancladas al muro).
Reglas:

- Un recinto (envolvente, `roomType` `undefined`/`'room'`) **siempre** requiere
  confirmación, tenga o no hijos — delimita el proyecto.
- Un ambiente/muro solo requiere confirmación si tiene hijos.
- Cualquier dispositivo suelto (luminaria, interruptor, cable, ventana,
  puerta, marquesina, tabique) se elimina directo, sin confirmación.

`requestDelete(id)` en el store es el **único punto de entrada** usado por
todos los flujos de UI (tecla Delete, botón de la barra de herramientas,
panel de objetos): si `requiresConfirmation`, abre `pendingDeletion` (leído
por `DeleteConfirmDialog`); si no, borra directo. `confirmPendingDeletion()`
elimina hijos + contenedor como una única transacción de historial (ver
`historySlice`), nunca como cascada implícita.

## Pruebas (todas verdes)

`selection/hitTest.test.ts` (Prueba A: interruptor sobre el borde gana al
ambiente; contenedores anidados: el más pequeño gana; Prueba E: selección
cíclica entre 3 objetos superpuestos; muros por distancia a segmento).

`selection/deletionPolicy.test.ts` (Prueba B: borrar el switch no requiere
confirmación y no toca el room; recinto vacío siempre protegido; ambiente con
hijos lista exactamente los hijos afectados — Prueba F).

## Limitación consciente (fuera de alcance de esta iteración)

El sistema completo de "capas funcionales bloqueables" (`00_CAD_REFERENCE`,
`10_ENCLOSURES`, ... de la sección 6.2 del plan) con propiedades por capa
(visible/bloqueada/seleccionable/opacidad/prioridad) **no se implementó** —
habría requerido migrar el modelo de datos de todas las entidades existentes
(cambio de esquema con impacto en persistencia, exportación e importación).
En su lugar se resolvió el problema real identificado en la auditoría (Fase
0, hallazgos #5 y #6): hit-testing no determinista y ausencia de protección
de contenedores. Esto cumple los criterios de aceptación AC-005 a AC-008 sin
la sobre-ingeniería de un sistema de capas que ningún flujo actual del editor
necesita todavía.
