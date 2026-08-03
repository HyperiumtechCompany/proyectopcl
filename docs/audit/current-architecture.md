# Auditoría — Arquitectura actual del editor DIAlux

Fecha: 2026-07-21. Alcance: `resources/js/pages/dialux/`.

## Stack

- `@mlightcad/cad-simple-viewer` `^1.5.8` (motor CAD, singleton a nivel de módulo en `hooks/useMlightcadEngine.ts`).
- Estado global: Zustand `^5.0.11` con middleware `subscribeWithSelector`. Mutaciones inmutables por spread (nunca in-place) — esta propiedad es la que hace viable el historial por snapshots de la Fase 3.
- Tests: Vitest 4 (`npm test` → `vitest run`).

## Estructura relevante

```
dialux/
  geometry/                     ← NUEVO (Fase 1): fuente única de verdad geométrica
    polygonGeometry.ts          área/perímetro/centroide/point-in-polygon/validación
    coordinateTransform.ts      screenToScene / sceneToScreen únicos
    calibration.ts              matemática de calibración por distancia conocida
  selection/                    ← NUEVO (Fase 2)
    hitTest.ts                  ranking determinista de candidatos bajo el puntero
    deletionPolicy.ts           análisis de eliminación protegida de contenedores
  hooks/
    useEditorStore.ts           store raíz (tipos + composición de slices)
    store/
      sceneObjectsSlice.ts      add/update/removeObject (sin cambios de contrato)
      scaleDxfSlice.ts          escala/calibración (Fase 5: invalida resultados)
      historySlice.ts           ← NUEVO (Fase 3): undo/redo por snapshots de `project`
      deletionSlice.ts          ← NUEVO (Fase 2): requestDelete/pendingDeletion
    useCanvasInteraction.ts     mouse handlers — ahora delega hit-testing a selection/hitTest.ts
    useMlightcadEngine.ts       singleton del motor (fix: dpr ya no se aplica dos veces)
  components/canvas/
    MlightcadCanvas2D.tsx       compositor SVG — usa geometry/coordinateTransform
```

## Modelo de entidades (sin cambios de Fase 0)

Cada objeto (`Room`, `Wall`, `Fixture`, `LightSwitch`, `ElectricalDevice`, `Conductor`, `Window`, `Door`, `Canopy`, `Partition`) tiene `id: string` único (uuid) e independiente. Las relaciones padre-hijo son por referencia de id (`wallId`, `roomId`, `sourceId`/`targetId`), no por anidamiento estructural — por lo que `removeObject(id)` ya filtraba por igualdad exacta y nunca podía borrar un contenedor al borrar un hijo (confirmado con tests en `selection/deletionPolicy.test.ts`).

Lo que SÍ faltaba (y ahora se corrige):
1. El **hit-testing** (qué objeto gana el clic) no consideraba todos los candidatos — usaba una cadena de `if` con prioridad fija hardcodeada y `findNearestRoom` solo miraba vértices, no el área. → resuelto por `selection/hitTest.ts`.
2. La **eliminación** no distinguía "objeto suelto" de "contenedor con hijos" — no había protección ni confirmación. → resuelto por `selection/deletionPolicy.ts` + `deletionSlice.ts`.
3. No existía **undo/redo**. → resuelto por `historySlice.ts`.
4. La fórmula de área (shoelace) estaba **duplicada en 4 archivos** distintos, con riesgo de divergencia futura. → unificada en `geometry/polygonGeometry.ts`.
