# Plan: desacoplar Presupuesto ↔ Cronograma y estabilizar predecesoras

**Estado:** Nivel A **cerrado** en `Emes` (sin desplegar). A1–A6 + UI de snapshots + surface del 422. Pendiente: correr Pest en servidor, `tenant:migrate`, desplegar, diagnóstico SSH del cliente, Nivel B.
**Origen:** incidente en producción (cliente) — "moví precios en el presupuesto y se destruyó el cronograma general en Delphin; las predecesoras quedaron cruzadas / apuntando a padres e hijos en vez de a las hojas".
**Rama de trabajo:** `Emes`. Todo lo de este plan es corrección del sistema y va aislado al repo. El refactor local de Gastos Generales vive en la rama `wip/gastos-generales-adicionales` — **no** se mezcla con `Emes` ni llega al cliente.

---

## 1. Resumen ejecutivo

`presupuesto_general` y `cronograma_general` modelan la **misma lista de partidas (WBS)**, pero:

- La guardan **dos veces** (código, descripción y jerarquía duplicados).
- Ambos guardados son **borrar-todo-por-`presupuesto_id` + reinsertar el payload completo**. Si el payload viene incompleto o renumerado, la diferencia se pierde para siempre.
- Se enlazan entre sí por **igualdad de string de `partida`** (frágil: padding de ceros, renumeración).
- Dentro del cronograma, las predecesoras se guardan por **`item_order` (número de fila)**, que es un contador posicional que se **reasigna 1..N en cada recálculo del árbol**.
- En Delphin, guardar el presupuesto **dispara también** el guardado del cronograma (y viceversa).

Resultado: cualquier cambio que reordene o renumere la lista de partidas —agregar, quitar, mover, re-importar, o incluso editar en el módulo Presupuesto aparte— **reinterpreta silenciosamente todas las predecesoras** y, al guardar, lo deja fijo en BD.

La solución tiene dos niveles:

- **Nivel A (desplegable e iterable ya):** cada guardado escribe solo la "cara" que editaste; las predecesoras se anclan a un **id estable** con un **snapshot de código+descripción** interno. Sin cambio de esquema salvo un índice único y una tabla de snapshots.
- **Nivel B (después):** converger el modelo para que una partida sea **una sola fila** con dos caras opcionales.

---

## 2. El incidente (qué reportó el cliente)

1. El cliente editó montos/cantidades y **agregó/movió partidas** en el módulo Presupuesto (pantalla separada de Delphin).
2. Abrió Delphin (vista Presupuesto + CPM fusionada).
3. El cronograma apareció con las **predecesoras cruzadas**: vínculos que apuntaban a la partida equivocada, y en varios casos a filas **padre/resumen** en vez de a las **hojas** ("nietos").
4. Guardó. La corrupción quedó persistida.
5. **No hay backup.** El backup automático del sistema no funciona.

---

## 3. Cadena causal exacta

| Paso | Qué ocurre | Archivo / evidencia |
|---|---|---|
| 1 | El cliente agrega partidas en el módulo Presupuesto → escribe **solo** `presupuesto_general`. `cronograma_general` queda igual. | `PresupuestoController::update('general')` |
| 2 | Abre Delphin. `useDelphinData` detecta partidas de `presupuesto_general` que **no están** en `cronograma_general` y **sintetiza tareas nuevas** que agrega al árbol. | `useDelphinData.ts` → `synthesizeMissingBudgetTasks` |
| 3 | `recomputeHierarchy` recorre el árbol y **reasigna `item_order` = 1..N** en orden depth-first. Las filas después de las nuevas se corren. | `useGanttTasks.ts` → `recomputeOrder` (`item_order: ++counter`) |
| 4 | Las predecesoras guardadas (`{taskId: 10}` = número de fila) ahora, con la nueva numeración, resuelven a **otra partida**. `applySchedule` construye `itemOrderToId` fresco en cada llamada. | `useGanttScheduler.ts` (`itemOrderToId`) |
| 5 | El cliente edita precios y da **Guardar**. `handleSaveBudget` corre `Promise.all([saveTasks, saveBudget, flushPendingAcus])` — **siempre** ambos. | `DelphinView.tsx` `handleSaveBudget` |
| 6 | El backend hace `DELETE FROM cronograma_general WHERE presupuesto_id=X` + `INSERT` del payload. Queda: `item_order` nuevo + números `source` viejos → **desalineados para siempre**. | `CronogramaV2Controller::store` |

El detonante **no** es editar el precio: es que **el árbol se reestructuró antes** (paso 2–3) y el guardado del presupuesto **arrastra** el cronograma (paso 5).

---

## 4. Causas raíz

1. **`item_order` como identificador de vínculo.** Es un contador posicional, no una identidad. Se reasigna en cada recompute. Las predecesoras (`{taskId, tipo, lag}` con `taskId = item_order`) apuntan a él.
2. **Guardado destructivo (clear + reinsert)** en ambas tablas. Exige que el payload sea una imagen completa y fiel; si no, borra.
3. **Guardados acoplados.** Delphin dispara `saveTasks()` + `saveBudget()` juntos. Editar una cara persiste la otra.
4. **Enlace por string de `partida`.** `cg.partida = pg.partida`. Sensible a padding y a renumeración; obliga a la síntesis + renumeración del paso 2–3.
5. **Modelo duplicado.** `partida`, `descripcion` y jerarquía viven en las dos tablas y pueden divergir. La vista Cronograma standalone además **regenera los códigos de partida** por posición (`useGanttTasks` sin `preservePartidaCodes`), rompiendo el JOIN al guardar.

---

## 5. Predecesoras — análisis a fondo

### 5.1 Por qué el **número de fila** no sirve como ancla

Escenarios del cliente:

**A — Borrar una fila que corre la numeración.**
Tarea en fila 15 con predecesora = fila 10. Se borra la fila 10 real. Todo lo de abajo sube una posición: la vieja fila 11 pasa a ser la 10. La predecesora guardada "10" **ahora apunta a la vieja fila 11**. El vínculo se movió solo, sin aviso.

**B — Agregar una fila.**
Se inserta una fila arriba de la posición 10. Todo se corre hacia abajo. La predecesora "10", que apuntaba a CAPACITACIÓN, ahora apunta a CONSTRUCCIÓN.

**C — Vínculos que caen en padres/hijos en vez de nietos.**
Al correrse la numeración, un vínculo pensado para una **hoja** (nivel 3–4) termina resolviendo a una fila **grupo/resumen** (nivel 1–2), porque en la posición N ahora hay otra cosa.

En los tres casos el dato guardado (`10`) no cambió; cambió **qué fila es la número 10**. El número de fila es una coordenada, no una identidad.

### 5.2 Por qué la **descripción sola** tampoco sirve

- **No es única.** En este mismo proyecto: "SUMINISTRO E INSTALACION DE…" aparece en las filas 11 y 12; "CERCO DE PROTECCIÓN…" en 9 y 10. Los presupuestos de obra repiten "CONCRETO f'c=210 kg/cm²", "ACERO DE REFUERZO fy=4200", "ENCOFRADO Y DESENCOFRADO" decenas de veces bajo distintas sub-partidas.
- **Se edita.** El cliente cambia textos. Renombrar una partida rompería el vínculo.
- **Descripción + número, ambos obligatorios** → editar cualquiera de los dos rompe. **Cualquiera de los dos** → ambiguo.

### 5.3 Solución propuesta: **id estable + snapshot denormalizado**

Cada predecesora se guarda así:

```json
{
  "refId": 4821,
  "tipo": "CC",
  "lag": 0,
  "_ref": { "codigo": "1.1.1.4", "desc": "TOPICO DE PRIMEROS AUXILIOS" }
}
```

- **`refId`** = enlace **autoritativo**. Es el `id` de `cronograma_general` (clave primaria), asignado una vez y **nunca reutilizado**. Toda la resolución —programador (`useGanttScheduler`), ruta crítica (`useGanttCriticalPath`), diagrama de red (`DiagramaRed`)— usa **solo `refId`**.
- **`_ref`** = **snapshot** de código + descripción **al momento de crear el vínculo**. No participa en ningún cálculo. Sirve para:
  - Legibilidad en exportaciones y auditoría ("Depende de: 1.1.1.4 TOPICO DE PRIMEROS AUXILIOS").
  - **Mensaje de vínculo roto**: si `refId` deja de resolver (la fila destino fue borrada de verdad), el sistema muestra *"la predecesora apuntaba a '1.1.1.4 TOPICO DE PRIMEROS AUXILIOS' que ya no existe — reasignar o quitar"* en vez de agarrar en silencio lo que ahora esté en esa posición.
  - **Herramienta de recuperación/migración**: re-mapear los vínculos viejos (basados en `item_order`) buscando por `_ref.codigo` + `_ref.desc`.
- **Número visible (columna PRED.)** = se calcula **en vivo**: `taskById.get(refId).item_order`. Nunca se guarda. Hoy `formatPredecessoras` imprime el número guardado tal cual — por eso hasta el display está desactualizado.
- **Entrada del usuario:** escribe "15" → se resuelve `tasks.find(t => t.item_order === 15).id` **en ese instante** → se guarda `refId` + snapshot de su `codigo`/`desc`.

Esto es la intuición del cliente ("vincular a descripción y a la numeración, el de descripción interno"), corregida: **el id estable es el enlace real; la descripción/código es un snapshot interno para humanos y para recuperación**, no la llave.

### 5.4 Regla hoja ↔ hoja

Al crear/validar un vínculo, **advertir** si el destino (o el origen) es una fila **grupo** (tiene hijos). En CPM las filas resumen son rollups; normalmente no deberían ser predecesoras. No bloquear (hay casos válidos), pero marcarlo en el picker y en el panel de "predecesoras circulares / inconsistentes".

### 5.5 Qué pasa al **borrar el destino** de un vínculo

- Hoy: `isUsedAsPredecessorElsewhere` + `Swal` de advertencia en `DelphinView` (la vista Cronograma standalone **no** tiene esa guarda — agregarla).
- Con `refId`: al confirmar el borrado, para cada predecesora que apuntaba a la fila borrada:
  - Opción por defecto: **marcar el vínculo como roto** (`{ refId: 4821, broken: true, _ref: {...} }`) y mostrarlo en rojo en la celda + en el panel de inconsistencias, para que el usuario lo reasigne.
  - Alternativa (config): quitarlo automáticamente.
- Nunca dejar un `refId` colgante que resuelva a otra fila.

### 5.6 Casos de prueba (deben pasar)

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Vínculo 15→10. Borro otra fila (la 7). | El vínculo sigue 15→(misma partida), aunque los números mostrados cambien. |
| 2 | Vínculo 15→10. Agrego una fila arriba de la 10. | Igual: mismo par de partidas, números re-renderizados. |
| 3 | Vínculo 15→10. Borro **la fila 10** (el destino). | Vínculo marcado "roto: apuntaba a '…'", visible, no re-apunta a nada. |
| 4 | Renombro la descripción de la partida destino. | Vínculo intacto; `_ref.desc` puede refrescarse o quedar como estaba (decidir). |
| 5 | Muevo la partida destino con indent/outdent. | Vínculo intacto. |
| 6 | Re-importo el presupuesto desde Excel. | Vínculos de partidas que siguen existiendo: intactos. |
| 7 | Edito precio en módulo Presupuesto, luego abro Delphin. | Cronograma sin cambios de fechas ni predecesoras. |

---

## 6. Solución Nivel A — desplegable e iterable ya

**Principio:** un guardado escribe **solo la cara que editaste**. Nunca toca la otra. Cambio de estructura = operación explícita aparte.

### A1. Predecesoras ancladas a `refId` (sección 5.3)

Archivos:
- `resources/js/pages/costos/cronogramas/v2/types/task.ts` — `Predecessor` gana `refId` + `_ref` opcionales; `formatPredecessoras` recibe un resolver `id → item_order`.
- `resources/js/pages/costos/cronogramas/v2/components/grid/cells/PredecessorPicker.tsx` y `CellPredecesoras.tsx` — al elegir/escribir, resolver a `refId` + snapshot; al mostrar, número en vivo.
- `resources/js/pages/costos/cronogramas/v2/composables/useGanttScheduler.ts` — resolver por `refId`; fallback a `item_order` solo si no hay `refId` (dato legado).
- `resources/js/pages/costos/cronogramas/v2/composables/useGanttCriticalPath.ts` — idem `resolveTaskId`.
- `resources/js/pages/costos/cronogramas/v2/components/network/DiagramaRed.tsx` — idem.
- `app/Http/Controllers/CronogramaV2Controller.php` — `store()` y `rowToV2()` persisten/leen `refId` y `_ref` en el JSON de `predecesoras` (la columna ya es `json`, no requiere migración).
- `resources/js/pages/costos/cronogramas/v2/utils/importMSProject.ts` y `resources/js/pages/costos/delphin/helpers/exportDelphinMSP.ts` — mapear `refId` ↔ UID de MS Project.

**Backfill (por proyecto, con verificación):** al abrir un proyecto con vínculos legado (sin `refId`), resolver **una vez** `item_order → id` con el árbol actual y reescribir como `refId` + snapshot. Para el cliente afectado esto **congelaría el estado ya cruzado** → para ese proyecto: primero re-verificar visualmente / re-ingresar, después bloquear.

### A2. Delphin: separar el "dirty" en tres

- `budgetFacetDirty` — unidad, metrado, precio_unitario.
- `cronogramaFacetDirty` — duración, fechas, avance, predecesoras.
- `structureDirty` — alta/baja/mover/reordenar partidas, cambio de código.

Cambios:
- `useDelphinData.ts` — `batchUpdatePresupuestos` (espejo monto→`task.presupuesto`) **deja de marcar dirty** el cronograma (ver A4, se elimina).
- `DelphinView.tsx` `handleSaveBudget` — solo llama `saveTasks()` si `cronogramaFacetDirty || structureDirty`. `handleSaveGantt` — solo llama `saveBudget()` si `budgetFacetDirty || structureDirty`.
- `useGanttTasks.ts` — el `useEffect([calendarSettings])` que hace `setDirtyIds(new Set(todas))` no debe marcar todo dirty; solo las filas cuyas fechas realmente cambiaron.

### A3. Guardado por-clave (UPDATE), no clear + reinsert

- **Migración pequeña:** índice único `(presupuesto_id, partida)` en ambas tablas; y **dejar de regenerar ids** — `PresupuestoController::update('general')` debe usar `updateOrInsert` por `id` en vez de `DELETE` + `insertGetId`.
- `CronogramaV2Controller::store` y `PresupuestoController::update('general')`:
  - `UPDATE … SET <solo columnas de la cara> WHERE presupuesto_id=X AND id=<id>` para filas existentes.
  - `INSERT` solo filas con `id` nulo/negativo.
  - `DELETE` **solo** los `id` que el frontend mande en una lista explícita `deletedIds`. Nunca por ausencia en el payload.
- Endpoint nuevo de **estructura** (`POST /cronograma/v2/{project}/structure` o extender el save con un modo) que recibe `{ upserts: [...], deletedIds: [...], reorder: [...] }` y es el único que puede alta/baja/mover.

### A4. Eliminar la columna redundante `cronograma_general.presupuesto`

El controlador ya la deriva al leer con `LEFT JOIN presupuesto_general … COALESCE(pg.parcial, 0)`. El efecto `batchUpdatePresupuestos` + esa escritura son pura duplicación que acopla las tablas. Dejar de escribirla; derivar siempre.

### A5. Vista Cronograma standalone

`CronogramaGeneralV2.tsx` — pasar `preservePartidaCodes: true` a `useGanttTasks` (línea ~118). Es la misma tabla compartida; regenerar códigos por posición rompe el JOIN con el presupuesto. Agregar también la guarda `isUsedAsPredecessorElsewhere` en su `deleteTask`.

### A6. Red de seguridad (no hay backups)

- **Snapshot antes de escribir.** Antes de cualquier UPDATE/DELETE masivo de `cronograma_general` / `presupuesto_general`, copiar las filas actuales a `wbs_snapshots (presupuesto_id, tabla, payload_json, usuario, created_at)`. Guardar los últimos ~20. Da un botón "revertir al guardado anterior".
- **Guardia de cordura en el servidor.** Rechazar (`422`, pide `force:true`) un guardado que:
  - trae < 50 % de las filas actuales, o
  - elimina **todas** las fechas o **todas** las predecesoras existentes.
- **Log con conteos** antes/después en cada guardado (el de cronograma ya loguea errores desde `1e2bad0`; agregar el resumen de conteos).

### Qué pasa con cada edición, después de Nivel A

| Editas | Corre | Toca en BD | Cronograma | Presupuesto |
|---|---|---|---|---|
| Precio / cantidad / unidad | `UPDATE presupuesto_general` por `id` | solo esas columnas | intacto | ok |
| Descripción | `UPDATE` en la cara editada; opción de propagar | solo texto | intacto salvo texto | ok |
| Duración / fechas / avance / predecesoras | `UPDATE cronograma_general` por `id` | solo esas columnas | ok | intacto |
| Agregar / borrar / mover partida | endpoint estructura con `deletedIds` explícito | inserta/borra en ambas caras, ids preservados | ok | ok |
| Re-importar Excel presupuesto | endpoint estructura (diff) | solo lo que cambió | predecesoras por `refId` intactas | ok |

---

## 7. Solución Nivel B — converger el modelo (después)

Objetivo: que una partida sea **imposible de desincronizar** porque es **una sola fila**.

- **B1 (ideal):** una tabla `wbs_items (presupuesto_id, id, codigo, descripcion, parent_id, nivel, orden, unidad, metrado, precio_unitario, duracion_dias, fecha_inicio, fecha_fin, avance, predecesoras)`. Presupuesto y Cronograma son dos proyecciones de columnas de la misma tabla.
- **B2 (menos invasivo):** mantener dos tablas, pero:
  - La **estructura** (código, jerarquía, orden) vive **solo** en `presupuesto_general`.
  - `cronograma_general` guarda **solo** la cara cronograma + `presupuesto_general_id` como **FK real** (no JOIN por string).
  - Agregar una partida en cualquier módulo crea la fila de `presupuesto_general`; la de cronograma se crea sola (lazy) con schedule vacío.
  - Elimina el JOIN frágil por `partida` y la ruta de "sintetizar + renumerar".

Recomendado empezar por **B2**; migra a **B1** si conviene más adelante.

---

## 8. Diagnóstico en producción (solo lectura)

Comando dedicado (ya en el repo desde el cierre de Nivel A):

```bash
cd /var/www/ingenieros.tech
php artisan cronograma:diagnose {projectId}          # tabla legible
php artisan cronograma:diagnose {projectId} --json   # para pegar / archivar
```

Para saber el `projectId`:
```bash
php artisan tinker --execute="\App\Models\CostoProject::orderBy('id')->get(['id','nombre'])->each(fn(\$p)=>print(\"{\$p->id}\t{\$p->nombre}\n\"));"
```

El reporte muestra: nº de filas, `item_order` distintos, con/sin predecesoras, fechas
nulas, duración cero, **`item_order`/`partida` duplicados**, **partidas del cronograma
sin contraparte en el presupuesto** (JOIN roto), y por cada predecesora si usa `refId`
estable o número de fila legado, cuántos `refId` quedaron rotos y cuántos vínculos legado
**apuntan a una partida distinta a la que dice su snapshot** (= cruzados por el bug viejo).

**Lectura:**
- `item_order cruzados vs snapshot` > 0 → hay vínculos que apuntan mal por el incidente.
  El `--json` lista cada uno con "source N ahora es X pero el snapshot decía Y" → esa lista
  es la guía para re-ingresarlos.
- `refId rotos` > 0 → el destino fue borrado; reasignar o quitar el vínculo.
- `item_order`/`partida` duplicados → árbol corrupto por una síntesis vieja.

Logs y respaldos:
```bash
grep -n "cronograma_general\|wbs_snapshots" storage/logs/laravel*.log | tail -40
crontab -l 2>/dev/null | grep -iE 'mysqldump|backup'
```

---

## 9. Recuperación del cliente afectado

Sin backup:

1. **Mitigación inmediata (antes de que guarde otra vez):**
   - Exportar el cronograma actual a **MS Project XML** desde Delphin → respaldo manual.
   - No guardar desde Delphin hasta parchear.
   - Mover el cronograma solo desde la vista **Cronograma** standalone, verificando que los códigos de partida se vean bien antes de guardar.
2. **Si el volcado de predecesoras (sección 8) muestra `source` coherentes:** script de re-derivación que, con el árbol actual, re-mapea cada `source` viejo a `refId` usando la descripción/código esperado.
3. **Si ya no cuadran:** re-ingreso manual de las dependencias por parte del cliente. No hay de dónde restaurarlas.
4. Arreglar aparte el **backup del sistema que no funciona** (fuera del alcance de este plan; abrir tarea separada).

---

## 10. Despliegue y pruebas

Incremental a `origin/Emes` → `deploy.sh` → probar en prod. Orden sugerido (menor riesgo primero):

1. ✅ **Commit `93184e8` — A1 + A5 + guardia:** `refId` + snapshot `ref` en predecesoras
   (`types/task.ts`, `useGanttScheduler`, `useGanttCriticalPath`, `predecessorCycles`,
   `DiagramaRed`, `GanttDependencyLines`, `PredecessorPicker`, `CellPredecesoras`,
   `useGanttTasks` serialize/parse, `CronogramaV2Controller::store`/`rowToV2` con re-mapeo
   de id de filas nuevas + `exportDelphinMSP`). Standalone `preservePartidaCodes: true`.
   Guardia `store()` 422 `suspicious_shrink`.
2. ✅ **Commit `c32dce3` — A2 + A4:** `handleSaveBudget` solo llama `saveTasks()` si
   `ganttDirty`. `batchUpdatePresupuestos` (espejo de solo lectura, `cronograma_general` no
   tiene columna `presupuesto`) deja de marcar dirty. `addTaskAfter`/`addChildTask` ahora sí
   marcan dirty (alta = cambio estructural).
3. ✅ **Commit `5ec58b0` — A3 + A6:** `store()` pasa de clear+reinsert a **upsert por id**:
   `UPDATE` filas existentes, `INSERT` las nuevas (client_id negativo), `DELETE` **solo** los
   ids en `deleted_ids` (nuevo campo del payload). Una fila en BD ausente del payload y sin
   marcar → **sobrevive**. `useGanttTasks` acumula `deletedRealIds` (en `deleteTask` y en
   `importTasks` para el caso de reemplazo). `wbs_snapshots` (migración tenant) +
   `snapshotTable()` antes de cada reescritura (últimos 20) + endpoints
   `GET /cronograma/v2/{p}/snapshots` y `POST .../snapshots/restore`.
4. ✅ **Commit `<A2b+A6b+UI>`:** A2 completo — `handleSaveGantt` solo llama `saveBudget()` si
   `budgetDirty || acuDirty`; los mutadores estructurales de `useDelphinData`
   (`addTaskAfter`, `indentTask`, `moveTaskUp`, `duplicateTask`, …) ahora marcan `budgetDirty`
   (un cambio estructural ensucia AMBAS caras). A6 — `snapshotWbs()` movido a
   `CostoDatabaseService` (compartido); `PresupuestoController::update('general')` snapshotea
   `presupuesto_general` antes de su clear+reinsert. **UI de snapshots** — `GanttSnapshotsModal`
   en Delphin (Config → "Historial de guardados…"), lista + revertir. A5 completo — guarda de
   borrado en la vista standalone + `isUsedAsPredecessorElsewhere` corregida (comparaba
   `item_order` contra ids) y extraída a `utils/predecessorUsage.ts`. `importMSProject.ts`
   pone `refId`/`ref` en las predecesoras importadas. `useGanttTasks` `useEffect([calendarSettings])`
   solo ensucia las filas cuyas fechas realmente cambiaron.
5. ✅ **Commit `<422+standalone-UI>`:** el 422 `suspicious_shrink` se surfacea —
   `useGanttTasks` expone `pendingShrinkWarning` + `saveTasks(project, force)`; Delphin y la
   vista standalone muestran un Swal "Guardar de todos modos" que reintenta con `force=true`.
   La `GanttSnapshotsModal` también está en la vista Cronograma standalone (botón "Historial"
   en la `GanttToolbar`).
6. **Nivel B** — épica aparte una vez A esté estable en producción.

**Follow-ups conocidos:**
- Backfill de `refId` para vínculos legado, por proyecto y tras verificación visual (no
  automático — congelaría el estado cruzado del cliente afectado). Con la nueva UI: el usuario
  abre cada predecesora en el picker y da Aplicar → se le adjunta `refId` desde el árbol
  actual. Solo hacer esto **después** de verificar con `cronograma:diagnose` que no hay
  cruzados, o de re-ingresar los cruzados.
- Aviso hoja↔hoja cuando una predecesora apunta a una fila grupo/resumen.
- Correr `php artisan test --filter=CronogramaControllerTest` en el servidor/CI (no se corrió local por el riesgo de config cache).
- **A3 para `presupuesto_general` — DIFERIDO a Nivel B, no se hará en Nivel A.**
  `PresupuestoController::update('general')` sigue con clear+reinsert **+ snapshot + guarda
  anti-vacío** (seguro). Razón de no hacer el upsert por `partida` ahora: el modelo fusionado
  (`useDelphinData.effectiveTasks`) SIEMPRE sintetiza las partidas de presupuesto que falten
  y manda el set completo, así que el clear+reinsert nunca pierde filas; el id de
  `presupuesto_general` no lo referencia nada externo (los ACUs enlazan por `partida`), así
  que el churn de ids es inocuo; y el upsert por `partida` obliga a trackear renombres de
  código (`renameRootPartida`, `batchUpdatePartidas`, matched-by-description del import) —
  complejidad que se resuelve sola en Nivel B al converger el modelo (FK por id, estructura
  en una sola tabla). El incidente era del cronograma; esa cara ya está en upsert.
- **Guardia "borra todas las fechas/predecesoras"** — descartada: una heurística así
  bloquearía el caso legítimo de "limpiar todas las fechas". La guarda por conteo + el
  snapshot ya cubren el caso de payload roto.

Verificación por PR:
- `npm run types`, `npm run build`, `npx vitest run resources/js/pages/costos`.
- Backend: `php artisan test --filter=CronogramaControllerTest` **en el servidor** (config cache local).
- Manual en staging: los 7 casos de 5.6 + "guardar presupuesto no toca cronograma" y viceversa.

---

## 11. Checklist de despliegue (Nivel A → prod)

`origin/Emes` @ `6b95ec9`+. Prod está en `af1c07d`.

1. `git pull` en `/var/www/ingenieros.tech` (rama `Emes`) o `./deploy.sh`.
2. **Migración tenant `wbs_snapshots`** (deploy.sh solo migra la BD central):
   ```
   php artisan tenant:migrate-all --migration=2026_09_09_000010_create_wbs_snapshots_table.php
   ```
   (`tenant:migrate-all` sin `--migration` corre TODAS las pendientes en TODAS las BD tenant;
   con `--pretend` muestra sin ejecutar). Sin esto los snapshots se saltan en silencio
   (código defensivo con `Schema::hasTable`), y "Historial de guardados" sale vacío.
3. `php artisan test --filter=CronogramaControllerTest` en el servidor.
4. **Diagnóstico del proyecto del cliente**, ANTES de que lo use en serio:
   ```
   php artisan cronograma:diagnose {projectId}
   ```
   Si `item_order cruzados vs snapshot` > 0 → hay vínculos apuntando mal por el incidente
   viejo; el `--json` lista cuáles. El cliente los re-ingresa (o se re-derivan con un script).
   El código nuevo **no repara** el daño previo, solo evita que se repita.
5. Verificar en Delphin del proyecto real:
   - editar un precio y Guardar → el cronograma (fechas, predecesoras) NO cambia.
   - agregar/borrar una partida → se persiste; al recargar no "resucita" ni desaparece de más.
   - agregar una fila arriba de otra → las predecesoras existentes siguen apuntando a la
     misma partida (número mostrado se recalcula).
   - Config → "Historial de guardados" muestra copias; revertir funciona.
6. `route:cache` / `config:cache` los corre `deploy.sh`.

**Cambio de comportamiento a vigilar:** `store()` ya no borra por ausencia — una fila que el
frontend no manda **sobrevive**. Los flujos conocidos (`saveTasks` manda el árbol completo;
`importTasks` calcula `deletedRealIds`) ya están cubiertos.

**Limitación conocida (no regresión):** no hay bloqueo de edición concurrente en Delphin
(dos usuarios en el mismo proyecto pueden pisarse). Era así antes; Reverb/Echo no está
cableado a Delphin.

---

## 12. Aislamiento

- Este plan y su código: **corrección del sistema**, en `Emes` (`f3dfa9c` FIN, `93184e8` A1/A5,
  `c32dce3` A2/A4, `5ec58b0` A3/A6, `3d9ad59` A2/A5/A6 completos, `6b95ec9` surface 422).
- El refactor local de Gastos Generales vive en la rama **`wip/gastos-generales-adicionales`**
  (`origin/`), aislada. No se mezcla con `Emes` ni llega al cliente. Para retomarlo:
  `git checkout wip/gastos-generales-adicionales`.
