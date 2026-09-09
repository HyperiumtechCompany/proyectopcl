# Nivel B — Converger el modelo Presupuesto ↔ Cronograma

**Estado:** **Fase 1 implementada** (`Emes`, sin desplegar) — aditiva y reversible.
Fases 2-3 en diseño. La migración de Fase 1 solo AGREGA una columna nullable + backfill;
igual conviene tener el backup del día corriendo antes de desplegarla.

### Fase 1 — hecho
- Migración tenant `2026_09_10_000010_add_presupuesto_general_id_to_cronograma_general`:
  columna `cronograma_general.presupuesto_general_id` nullable + índice + backfill por
  partida (exacta → normalizada por padding), loguea las filas sin match. `down()` la quita.
- `CronogramaV2Controller::fetchTasks` — JOIN por FK cuando existe, **fallback por partida
  acotado por `presupuesto_id`** (el JOIN viejo no lo acotaba). `rowToV2` expone
  `presupuesto_general_id`.
- `CronogramaV2Controller::store` — setea la FK (por partida→id) en toda fila que guarde.
- `cronograma:diagnose` — sección Nivel B: filas sin FK + **"FK vs partida: parcial
  distinto"** (debe ser 0 durante el soak antes de retirar el fallback).
- Test Pest: la columna existe, fallback por partida da el mismo parcial, `store` setea la FK.

**Soak (1-2 semanas tras desplegar Fase 1):** `php artisan cronograma:diagnose {id}` en los
proyectos activos — `FK vs partida: parcial distinto` debe quedar en **0 / ✓**. Recién
entonces Fase 2.

**Contexto:** Nivel A ya resolvió el incidente (predecesoras cruzadas → `refId`) y
el riesgo de destrucción (upsert + snapshots + guardia). Nivel B ataca la **causa
raíz estructural**: `presupuesto_general` y `cronograma_general` son la misma WBS
duplicada, enlazada por *string de partida*. Eso obliga a la lógica de "sintetizar
filas faltantes + renumerar" (`useDelphinData`) que fue el detonante del incidente,
y deja abierta la puerta a que las dos caras diverjan.

---

## 1. Objetivo

Que una partida sea **imposible de desincronizar** porque su identidad y estructura
viven en **un solo lugar**, y el cronograma es solo una *cara* (schedule) colgada de
ella por **FK real**, no por coincidencia de texto.

Opción elegida: **B2** (menos invasiva que fusionar en una sola tabla).

---

## 2. Modelo destino (B2)

| Dato | Dónde vive | Cómo |
|---|---|---|
| Identidad de la partida | `presupuesto_general.id` | PK autoincrement, estable |
| Estructura: código, jerarquía, orden | `presupuesto_general` | `partida` (notación con puntos) + `item_order`. **Única fuente.** |
| Descripción | `presupuesto_general.descripcion` | única fuente; el cronograma la muestra vía JOIN |
| Cara Presupuesto | `presupuesto_general` | unidad, metrado, precio_unitario, parcial (generado) |
| Cara Cronograma | `cronograma_general` | duración, fecha_inicio/fin, avance, predecesoras |
| **Vínculo** | `cronograma_general.presupuesto_general_id` | **FK a `presupuesto_general.id`**, `ON DELETE CASCADE` |

`cronograma_general` deja de ser autoritativa para: `partida`, `descripcion`,
`parent_id`, `nivel`, `item_order` (pasan a ser **cache derivada** o se eliminan).
`predecesoras.refId` sigue apuntando a `cronograma_general.id` (Nivel A) — sin cambio.

### Regla de vida

- Agregar una partida (en Presupuesto **o** en Delphin) → inserta en
  `presupuesto_general`. La fila de `cronograma_general` se crea **lazy** (al abrir
  el cronograma) o en el mismo request, con `presupuesto_general_id` seteado y
  schedule vacío.
- Borrar una partida → borra `presupuesto_general` → `CASCADE` borra su
  `cronograma_general`.
- Renombrar código/descripción → solo `presupuesto_general`. El cronograma lo
  refleja al leer. **Adiós a `renameRootPartida` / `batchUpdatePartidas` sobre el
  cronograma y al tracking de renombres.**
- Re-importar Excel de presupuesto → diff sobre `presupuesto_general` por `id`
  (cuando el import puede mapear) o por código. El cronograma se realinea solo.

---

## 3. Migración de datos (la parte peligrosa)

Migración tenant nueva: `add_presupuesto_general_id_to_cronograma_general`.

```
1. ALTER cronograma_general ADD COLUMN presupuesto_general_id BIGINT UNSIGNED NULL
   AFTER presupuesto_id, ADD INDEX.
2. Backfill por (presupuesto_id, partida normalizada):
     UPDATE cronograma_general cg
     JOIN presupuesto_general pg
       ON pg.presupuesto_id = cg.presupuesto_id
      AND pg.partida = cg.partida            -- + normalización de padding si aplica
     SET cg.presupuesto_general_id = pg.id;
3. Filas de cronograma sin match (presupuesto_general_id IS NULL):
     - si su `partida` no existe en presupuesto_general → CREAR la fila de
       presupuesto_general (metrado 0, descripcion = cg.descripcion) y enlazar.
       (Son filas de grupo/título que solo estaban en el cronograma.)
     - loguear cada una.
4. Filas de presupuesto_general sin fila de cronograma → CREAR cronograma_general
   (schedule vacío, presupuesto_general_id seteado, item_order/partida copiados).
5. Duplicados (misma partida ×N en una tabla) → NO adivinar: abortar la migración
   de ESE tenant y listar los duplicados para resolución manual.
6. Verificación post-migración (parte de la misma migración, en transacción):
     - toda cronograma_general.presupuesto_general_id NOT NULL
     - COUNT(cronograma_general) == COUNT(presupuesto_general) por presupuesto
     - `cronograma:diagnose` sin `JOIN roto`
   Si algo falla → ROLLBACK y abortar.
7. (Fase 2, después de soak) FK real + `ON DELETE CASCADE` + DROP de columnas
   redundantes de cronograma_general (partida/descripcion/parent_id/nivel).
```

**Pre-requisitos absolutos antes de correr en prod:**
- `scripts/backup-db.sh` con 2+ corridas OK y un restore probado.
- Correr primero en una copia `_staging` de cada tenant y verificar la app.
- `git tag` del commit + plan de rollback escrito (restore del backup).

---

## 4. Cambios de código

### Backend
- **Migración** (§3).
- `CronogramaV2Controller::fetchTasks` — `JOIN … ON cg.presupuesto_general_id = pg.id`
  (era `ON cg.partida = pg.partida`). `rowToV2` sirve `partida`/`descripcion`/`nivel`
  desde `pg`.
- `CronogramaV2Controller::store` — al insertar fila nueva de cronograma, exigir/
  resolver `presupuesto_general_id`. La creación/borrado/reorden de partidas pasa a
  un endpoint de estructura que escribe `presupuesto_general` y crea la fila espejo
  de cronograma. `deleted_ids` puede desaparecer (lo maneja el CASCADE desde el
  endpoint de estructura).
- `CronoValorizadoController` — `resolveCronoPorPartida` y los cruces pasan a FK.
- `PresupuestoController::update('general')` — pasa a upsert por `id`
  (**esto cierra el "A3 para presupuesto_general" pendiente de Nivel A**), y al
  insertar/borrar sincroniza las filas espejo de `cronograma_general`.
- `DelphinController` — sin cambio de fondo (ya usa `costoDirectoOficial()`).

### Frontend (`useDelphinData` — reescritura del núcleo)
- `effectiveTasks` deja de ser una *unión con síntesis*. El backend entrega el árbol
  ya completo y consistente (una fila por partida, con sus dos caras).
- Se eliminan: `synthesizeMissingBudgetTasks`, `synthesizeTasksFromRows`,
  `resolveParentsWithSyntheticFill`, el remapeo de ids en `importDelphinRows`,
  `renameRootPartida`, la mitad de `importCronogramaTasks`.
- Alta/baja/mover/renombrar → llaman al endpoint de **estructura**; el estado local
  se refresca del backend (o se aplica optimista con el `id` real ya asignado).
- `useGanttTasks` — `recomputeOrder` deja de reasignar `partida`; `item_order` pasa a
  venir del backend o a ser puramente visual.

### Tests
- Pest: la migración de datos (con fixtures que cubran los 5 casos del §3),
  fetchTasks por FK, el endpoint de estructura, `PresupuestoController::update`
  upsert.
- Vitest: `useDelphinData` sin síntesis; alta/baja/reorden vía endpoint.

---

## 5. Orden de ejecución

1. **Backups probados** (bloqueante).
2. Rama `feature/nivel-b` desde `Emes`.
3. Migración + backend reads por FK (con la columna NULLABLE, sin FK todavía,
   sin borrar columnas) → deploy → **soak 1-2 semanas** con `cronograma:diagnose`.
   En esta fase el JOIN por FK y el JOIN por partida deben dar lo mismo.
4. Endpoint de estructura + reescritura de `useDelphinData` + `PresupuestoController`
   upsert → staging → prod.
5. Fase 2: FK real `ON DELETE CASCADE` + DROP de columnas redundantes.
6. Retirar `deleted_ids`, la guardia `suspicious_shrink` puede relajarse.

---

## 6. Qué NO cambia

- `predecesoras` por `refId` (Nivel A) — se mantiene tal cual.
- `wbs_snapshots` + `cronograma:diagnose` + snapshot-antes-de-escribir — se mantienen
  (siguen siendo la red de seguridad durante y después de la migración).
- El módulo Valorizado y `costoDirectoOficial()` — sin cambio.
