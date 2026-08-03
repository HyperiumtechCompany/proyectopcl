# Auditoría — Historial de cambios (undo/redo)

## Estado antes de la Fase 3

Búsqueda exhaustiva (`\bundo\b|\bredo\b`, case-insensitive) en todo
`resources/js/pages/dialux/`: **0 coincidencias** reales de un sistema de
historial (las únicas coincidencias de "historial"/"temporal" eran el
historial de comandos de la consola CAD de mlightcad, no del editor). No
existía pila de deshacer/rehacer, ni atajos Ctrl+Z/Ctrl+Y mapeados.

Consecuencia: cualquier `removeObject`, arrastre, o `applyCalibration`
(reescala TODAS las entidades in-place) era irreversible desde la UI.

## Diseño implementado (Fase 3)

En vez de reescribir cada una de las ~40 mutaciones del store como una clase
`Command` explícita (`CreateEntityCommand`, `DeleteEntityCommand`, etc., como
sugiere la sección 7.2 del plan), se aprovechó una propiedad ya existente en
todo el store: **`project` siempre se reemplaza de forma inmutable** (spread,
nunca mutación in-place — ver `mutateScene` en `storeHelpers.ts`, usado por
todas las slices). Eso hace que conservar referencias anteriores de `project`
en una pila sea:

- **Correcto**: reconstruye el estado exacto de cualquier paso anterior, sin
  reimplementar cada mutación al revés (`undo()`/`redo()` de cada comando).
- **Barato**: no clona nada — solo retiene el objeto anterior (structural
  sharing: los `Scene` no tocados por una mutación siguen siendo la misma
  referencia).
- **Imposible de desincronizar**: no hay dos fuentes de verdad (el comando y
  el estado) que puedan divergir.

`hooks/store/historySlice.ts` instala un observador (`useEditorStore.subscribe`,
middleware `subscribeWithSelector` ya usado en el store) sobre `project`: cada
vez que cambia, empuja la referencia **anterior** a `undoStack` y vacía
`redoStack` — exactamente las reglas 7.3.1-7.3.4 del plan. `undo()`/`redo()`
mueven referencias entre las dos pilas sin reclonar nada.

### Transacciones y gestos (sección 7.4/7.5 del plan)

`beginHistoryGesture()`/`endHistoryGesture()` agrupan una ráfaga de
mutaciones (arrastre continuo con el mouse, o una eliminación en cascada de
contenedor + hijos) en un **único** paso de undo: capturan el snapshot antes
de la primera mutación del grupo y solo lo empujan a la pila si el estado
realmente cambió al cerrar el grupo. Usado en:
- `MlightcadCanvas2D.tsx` (`onDragGesture` conectado a `useCanvasInteraction`
  en `mousedown`/`mouseup` de objetos seleccionables).
- `deletionSlice.ts::confirmPendingDeletion` (borrar hijos + contenedor).
- Borrado múltiple de luminarias seleccionadas (`EditorLayout.tsx`,
  `Toolbar.tsx`).

### Atajos (sección 7.6)

`EditorLayout.tsx`: `Ctrl+Z` → undo, `Ctrl+Shift+Z` / `Ctrl+Y` → redo (y
equivalentes con `metaKey` para macOS). Se ignoran si el foco está en un
`<input>`/`<textarea>`, y cualquier otra combinación Ctrl/Cmd (copiar, pegar)
ya no dispara accidentalmente los atajos de una sola tecla (bug lateral
corregido: antes `Ctrl+C` cambiaba a la herramienta "canopy").

### Estado de selección tras deshacer (sección 7.7)

`undo()`/`redo()` limpian `selectedId`/`selectedFixtureIds` si el objeto
referenciado ya no existe en el snapshot restaurado (`entityExistsInProject`).

### Persistencia (sección 7.8)

Historial **solo de sesión** (variables de módulo, no persistidas). Cada
carga inicial del proyecto (`Show.tsx`, `EditorLayout.tsx` demo) llama a
`resetHistory()` explícitamente — confirmado con test: tras recargar,
`historyCanUndo === false`.

### Límite (sección 7.9)

`HISTORY_LIMIT = 100` — el `undoStack` descarta el snapshot más antiguo al
superarlo (`Array.shift`).

## Simplificación consciente respecto al plan

El plan (7.1-7.2) pedía una interfaz `EditorCommand` con
`execute/undo/redo/serialize` por cada tipo de operación. Se optó por el
snapshot inmutable (arriba) porque:
1. Es **funcionalmente equivalente** para el requisito real (deshacer/rehacer
   cualquier mutación del proyecto, agrupar gestos, límite de memoria).
2. Evita duplicar lógica de reversión para las ~40 mutaciones existentes
   (`add*`, `update*`, `remove*`, `rescale*`, `applyCalibration`, ...), que ya
   están probadas y en uso — reescribirlas como comandos habría sido una
   refactorización de alto riesgo sin beneficio adicional medible.
3. Sigue cumpliendo TODOS los criterios de aceptación de la Fase 3 (AC-009 a
   AC-012), verificados con tests en `hooks/store/historySlice.test.ts`.

Si en el futuro se necesita persistir el historial entre sesiones o
auditoría de usuario/fecha por operación (sección 7.8, "versión posterior
opcional"), ahí sí se justificaría migrar a comandos serializables — no antes.
