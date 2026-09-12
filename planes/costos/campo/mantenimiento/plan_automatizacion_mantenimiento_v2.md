# Plan v2 — Automatización del Mantenimiento como modelo de dominio (no como Excel genérico)

> **Reemplaza a** `plan_automatizacion_mantenimiento.md` en todo lo relativo a estructura, importación y hojas.
> **Motivo del replanteo:** la implementación v1 (Fases 1–6, 10/09/2026) construyó un motor de hoja de cálculo genérico
> (hojas / columnas / filas / celdas / fórmulas libres) + un importador que vuelca cada tabla de la BD en una hoja plana
> (`Presupuesto`, `ACU`, `MO`, `MAT`, `EQ`, `SC`, `SP`). Eso **no es** el archivo `1.0 PG COLEGIOS HUAMALIES 2026`.
> El Excel real es un **tablero de ejecución presupuestal** de un Programa de Mantenimiento sobre ~8 Instituciones Educativas,
> con series de columnas dinámicas (cotizaciones, compras, parciales de pago), bloques colapsables y una hoja RESUMEN que consolida todo.
> **Stack:** Laravel 12, PHP 8.3, Inertia v2, React 19, TypeScript, Tailwind v4, MySQL. Sin librerías nuevas. Sin tocar API pública de Costos.

---

## 0. Decisiones tomadas (2026-09-10)

| # | Decisión | Consecuencia de diseño |
|---|---|---|
| D1 | `MO` / `MO 1.`, `GG` / `Copia de GG`, `MAT (2)` / `Copia de MAT (2)` son **versiones/escenarios** de la misma hoja canónica. | Se modela **una hoja canónica por tipo** (`mat`, `mo`, `gg`) y encima **escenarios** que scopean la ejecución (compras, parciales, pagos). El WBS y el ACU son compartidos por todos los escenarios. Duplicar hoja = clonar el conjunto de series+valores de ese tipo en un escenario nuevo. |
| D2 | `RESUMEN` es **auto-generado de solo lectura**. | El usuario nunca edita celdas de RESUMEN. Se calcula desde MAT/MO/EQ/SC/GG + presupuesto importado + cronograma. Los pocos **inputs reales** (Presupuesto Aprobado Ideal, aportes de socios, descuento por adjudicación, IGV%) viven en un panel **"Parámetros del Programa"** a nivel documento, no en la hoja. |
| D3 | Un documento de Mantenimiento = **un Programa completo** (todas las I.E.). | La **Institución Educativa** es un nivel de agrupación dentro de cada hoja (como en el Excel). Un solo RESUMEN consolida el Programa. |
| D4 | Modelo **híbrido**: dominio bloqueado + anotaciones libres. | Columnas y filas de dominio con esquema fijo y cálculo automático (no se tipean PT, parcial, subtotal, saldo, %). El usuario solo puede añadir unas **pocas columnas de nota/observación** por hoja. No hay grilla libre expuesta. |

---

## 1. Qué es realmente el artefacto

Libro de **seguimiento de ejecución** de un Programa de Mantenimiento. Cada hoja es un **proceso**, no una tabla:

### 1.1 `MAT` — ejecución de materiales
Filas agrupadas: **I.E. → bloque de partida (título) → líneas de material**. Por línea de material:

| Sección | Columnas | Origen |
|---|---|---|
| Expediente Técnico | `metrado`, `P.U`, `P.T` (= metrado·PU) | importado de ACU (`acu_materiales`, parcial>0) |
| Cotizaciones (**≥3**) | por cotización: `proveedor`, `cantidad`, `P.U`, `P.T` (= cant·PU) | capturado en Mantenimiento |
| Compras (**N, dinámicas**) | encabezado `COMPRA k — dd/mm/aaaa`; por compra: `cantidad`, `precio`, `subtotal` (= cant·precio) | capturado en Mantenimiento |
| Cálculo | `subtotal por compra`, `total pagado`, `saldo vs E.T.`, estado (color) | motor |

Al pie: bloque de conciliación **TOTAL EXP. TÉC. vs TOTAL CORREGIDO vs DIFERENCIA → DÉFICIT/SUPERÁVIT**. Sección aparte **FLETE DE MATERIALES** (cant. corregida vs cant. E.T., precio E.T. vs precio pagado, diferencia).

### 1.2 `MO` / `MO 1.` — ejecución de mano de obra
Filas por partida. Por línea:

| Sección | Columnas |
|---|---|
| MO Expediente Técnico | `cantidad`, `P.U.`, `PARCIAL` (= cant·PU) |
| MO Cotizado | `cantidad`, `P.U.`, `PARCIAL` |
| Parciales de pago (**N, dinámicas**) | `P.M.O 1 … P.M.O k`: por parcial un importe |
| Cierre | `POR PAGAR`, ajustes `ADELANTO` / `EQUIPOS` / `HERRAMIENTA` |

### 1.3 `GG` — gastos generales
Dos grupos: **FIJOS** (fianzas, seguros, impuestos Sencico/ITF/Sunat) y **VARIABLES** (administración en obra, personal profesional clave, vehículos, alquileres, ensayos…). Por línea: `unidad`, `cant`, `costo unitario`, `GASTO E.T`, `GASTO PROYECTADO`, `GASTO REAL`, luego **N columnas de pago fechadas** (`GASTO REALIZADO — dd/mm/aaaa`, cols L…AA) → `Σ` (AB). Sub-tablas de **viáticos / caja chica** (movimientos con fecha y monto).

### 1.4 `CRONOGRAMA` / `PORCENTAJE` — plazo y avance
Traen `ítem` + `descripción` de las partidas. Añaden hitos: `FIRMA DE CONTRATO`, `DÍAS PERDIDOS N°1`, `INICIO PROGRAMADO`, `DÍAS PERDIDOS N°2`, `INICIO FÍSICO`, `PLAZO DE EJECUCIÓN REPROGRAMADO`, `PLAZO PARA CULMINO PROGRAMADO`, `FIN DE CONTRATO` (calculado), `% AVANCE DE OBRA`.

### 1.5 `RESUMEN` — consolidado (auto)
- **RESUMEN GENERAL**: por componente (`MATERIALES`, `MANO DE OBRA`, `EQUIPOS Y HERRAMIENTAS`, `COSTO DIRECTO`, `GASTOS GENERALES`, `UTILIDAD`, `TOTAL`, `IGV`, `DESCUENTO POR ADJ PRO`, `TOTAL ADJUDICADO`) × (`Presupuesto Expediente`, `Presupuesto Aprobado Ideal`).
- **RESUMEN DESAGREGADO**: por componente y subcomponente (Materiales/Transporte/Movilidad; Mano de obra/Subcontrato; Equipos; cada sub-línea de GG; Utilidad; Descuento) × (`Aprobado Ideal`, `Gasto Proyectado Real`, `Gasto Actual`, `Deuda`, `Déficit`, `% Gasto Actual`, `% Avance de Obra`).
- **MONTO A INVERTIR**: aportes de `SOCIO 1` / `SOCIO 2` por armada (`1er`, `2do`, `Liquidación`) → sub-total.
- **GASTO REAL**: desglose `EJECUTADO` / `POR PAGAR` por M.O., MAT., G.G., Apoyo Téc. → `GASTO TOTAL` y `UTILIDAD` final.

### 1.6 Defectos del Excel que NO se replican
21 `#REF!`, constantes mágicas (`30813.81`, `8600`, `1404.2`, `1200`, `296.34`, `100000`…), parches de centavos `+0.01` / `-0.28`, copias con filas desplazadas, referencias por coordenada `G77`. La automatización conserva el **resultado válido**, no la estructura frágil.

---

## 2. Modelo de dominio

> Todas las tablas viven en `costos_tenant`, prefijo `mantenimiento_`. Sin FK hacia Presupuesto/ACU: solo procedencia escalar (`source_table`, `source_id`, `source_hash`, `source_updated_at`).

### 2.1 Raíz

| Tabla | Responsabilidad |
|---|---|
| `mantenimiento_documentos` | Un Programa. `nombre`, `moneda` (PEN), `revision`, `estado`, `engine_version`, `parametros` (JSON: aprobado ideal por componente, IGV%, aportes socios, descuento adj, apoyo técnico). |
| `mantenimiento_fuentes_presupuesto` | Presupuesto origen, `source_hash`, fecha de lectura, última comparación. No es fuente de cálculo tras importar. |
| `mantenimiento_instituciones` | I.E. detectadas en el WBS importado. `nombre`, `orden`, procedencia. Nivel de agrupación. |

### 2.2 Esqueleto WBS (importado de `presupuesto_general`)

**`mantenimiento_partidas`** — árbol por documento:
- `id` ULID, `documento_id`, `parent_id` (nullable), `institucion_id`
- `tipo`: `bloque` | `detalle`
  - **`bloque`** = partida con ítem entero (`1`, `2`, `01`…) **o** título sin metrado/precio → se pinta **naranja**, colapsable, **sin celdas de ejecución**.
  - **`detalle`** = partida hoja con ACU y ejecución.
- `item` (string: `"1"`, `"1.01"`, `"01.01.01.01"`), `item_entero` (bool), `nivel`
- `descripcion`, `unidad`, `metrado_et`, `pu_et`, `parcial_et`
- `sort_order` (espaciado), procedencia (`source_id`, `source_hash`, `source_updated_at`)

### 2.3 Descomposición ACU (importada, `parcial > 0`)

**`mantenimiento_recursos`** — líneas ACU por partida `detalle`:
- `id` ULID, `documento_id`, `partida_id`, `tipo`: `mo` | `mat` | `eq` | `sc` | `sp`
- `codigo`, `descripcion`, `unidad`, `cantidad_et`, `pu_et`, `parcial_et`, `sort_order`
- procedencia (`source_table`, `source_id`, `source_hash`)
- Regla de importación: se compara `parcial` como **decimal en backend, sin redondear**; `0`, `0.0000000000`, nulo, negativo **no** se importan. El filtro es por **detalle**, no por cabecera ACU.

### 2.4 Series de columnas dinámicas (el corazón del replanteo)

**`mantenimiento_series`** — instancias de grupo de columnas, **a nivel de (documento, escenario, tipo)**:
- `id` ULID, `documento_id`, `escenario_id`, `tipo`: `cotizacion` | `compra` | `pago_mo` | `pago_gg`
- `indice` (1..N, estable; no se renumera al insertar), `fecha` (nullable para cotización), `proveedor` (nullable), `etiqueta`, `nota`, `sort_order`

**`mantenimiento_serie_valores`** — celda de una serie para una línea:
- `id`, `serie_id`, `objetivo_tipo` (`recurso` | `gg_linea`), `objetivo_id`
- `campos` JSON tipado según `tipo` de la serie:
  - `cotizacion`: `{ proveedor, cantidad, pu }` → `pt` calculado
  - `compra`: `{ cantidad, precio }` → `subtotal` calculado
  - `pago_mo`: `{ parcial }`
  - `pago_gg`: `{ monto }`
- Celdas **dispersas**: ausencia = vacío. Solo se crean con contenido.

Todo cálculo derivado (`pt`, `subtotal`, `total pagado`, `saldo`, `por pagar`, `% avance`, `déficit`) lo produce el **motor**, nunca se persiste como input.

### 2.5 Escenarios / versiones (D1)

**`mantenimiento_escenarios`**:
- `id` ULID, `documento_id`, `tipo_hoja`: `mat` | `mo` | `gg`
- `nombre` (`"MO"`, `"MO 1."`), `es_activo`, `base_escenario_id` (para duplicar), `sort_order`
- Un documento tiene ≥1 escenario por `tipo_hoja`. El escenario activo es el que se muestra por defecto. Duplicar clona `series` + `serie_valores` de ese `tipo_hoja`.

### 2.6 Gastos Generales

**`mantenimiento_gg_lineas`**:
- `id` ULID, `documento_id`, `grupo`: `fijo` | `variable`, `rubro`, `subrubro`, `descripcion`, `unidad`, `cantidad`, `costo_unitario`, `gasto_et`, `gasto_proyectado`
- procedencia opcional (si en algún momento se importa de `gg_*`; hoy **no** — se captura manual o plantilla)
- Ejecución vía series `pago_gg`.

**`mantenimiento_gg_movimientos`** (viáticos / caja chica) — Fase R3+:
- `id`, `gg_linea_id` (nullable), `concepto`, `fecha`, `monto`, `nota`.

### 2.7 Cronograma

**`mantenimiento_cronograma`**:
- `id`, `partida_id` (`detalle`), `firma_contrato`, `dias_perdidos_1`, `inicio_programado`, `dias_perdidos_2`, `inicio_fisico`,
  `plazo_ejecucion_reprogramado`, `plazo_culmino_programado`, `fin_contrato` (calc), `avance_pct`
- Calculados: `fin_contrato = inicio + plazo - 1` (regla observada `=K6+40-1`), `inicio_programado = firma + dias_perdidos_1`, etc.

### 2.8 Anotaciones libres (D4)

**`mantenimiento_columnas_anotacion`**:
- `id` ULID, `documento_id`, `tipo_hoja`, `etiqueta`, `tipo_dato` (`text` | `decimal` | `date`), `sort_order`, límite duro (p. ej. máx. 6 por hoja).

**`mantenimiento_anotacion_valores`**: `id`, `columna_id`, `objetivo_tipo`, `objetivo_id`, `valor`.

### 2.9 Infra reutilizada de v1

Se **conserva**: `mantenimiento_operaciones` (idempotencia + revisión), `mantenimiento_snapshots`, la cola IndexedDB + autosave con debounce, el ACK incremental, el motor decimal / política monetaria (`DecimalMath`, `MoneyAllocator`), el parser de fórmulas (para celdas calculadas y cronograma).

Se **retira / reemplaza**: `mantenimiento_hojas`, `mantenimiento_columnas`, `mantenimiento_filas`, `mantenimiento_celdas`, `mantenimiento_formula_dependencies` genéricas, `MaintenanceBudgetImportService::TEMPLATES` (hojas planas), `MaintenanceAdvancedStructureService` (papelera/duplicar de grilla libre), la grilla `MaintenanceGrid.tsx` genérica y sus stores.

---

## 3. Contrato de importación desde Presupuesto (reescrito)

1. Usuario inicia **"Importar desde Presupuesto"** en el documento.
2. Backend resuelve conexión tenant + presupuesto principal del proyecto.
3. Lee `presupuesto_general` ordenado por `item_order`. Construye el **árbol de partidas**:
   - clasifica cada fila en `bloque` (ítem entero o sin metrado/precio) o `detalle`;
   - deriva `parent_id` por prefijo de `item` (`01.01.01.01` → padre `01.01.01`);
   - detecta **I.E.** por las filas de encabezado (color/patrón "INSTITUCIÓN EDUCATIVA …") o por el primer nivel del árbol → `mantenimiento_instituciones`.
4. Lee cabeceras `presupuesto_acus`; asocia a la partida `detalle` por **clave de negocio normalizada** (unicidad validada; ambigüedad → se muestra, nunca se elige "el último").
5. Por cada ACU consulta `acu_mano_de_obra`, `acu_materiales`, `acu_equipos`, `acu_subcontratos`, `acu_subpartidas`.
6. **Importa un detalle solo si `parcial > 0`** (decimal, sin redondear). Reporta incluidos / excluidos / faltantes / ambiguos por tipo.
7. Siembra `mantenimiento_recursos` (columnas base E.T. de MAT/MO/EQ/SC/SP). **No crea** cotizaciones, compras ni pagos.
8. Crea un escenario inicial por `tipo_hoja` (`mat`, `mo`, `gg`), y **≥3 series `cotizacion` vacías** en el escenario MAT (mínimo del Excel).
9. Snapshot `before_budget_import` / `after_budget_import`.

**Reimportar** = diff de 3 estados (snapshot anterior, Presupuesto actual, datos Mantenimiento). Estados: `nuevo`, `sin_cambios`, `modificado_en_origen`, `conflicto`, `retirado_del_origen` (incl. detalle que pasó a `parcial ≤ 0`), `solo_mantenimiento`. Nada se borra ni pisa automáticamente; confirmación por lote o fila.

---

## 4. Motor de cálculo

Reglas mínimas (gramática segura, sin `eval`), derivadas del artefacto:

| Cálculo | Fórmula |
|---|---|
| `pt` cotización | `cantidad · pu` |
| `subtotal` compra | `cantidad · precio` |
| `total pagado` (MAT línea) | `Σ subtotales de todas las compras` |
| `saldo E.T.` | `parcial_et − total pagado` |
| `parcial` MO E.T. / cotizado | `cantidad · pu` |
| `por pagar` MO | `parcial_cotizado − Σ P.M.O k − ajustes` |
| `GG Σ` (AB) | `Σ pagos fechados` |
| `bloque` (naranja) | `Σ de descendientes` por columna homóloga; sin inputs |
| Cronograma `fin_contrato` | `inicio_fisico + plazo_reprogramado − 1` |
| RESUMEN `Gasto Actual` | `Σ ejecutado (compras + P.M.O + pagos GG)` |
| RESUMEN `Deuda` | `Σ por pagar` |
| RESUMEN `Déficit` | `Aprobado Ideal − Gasto Proyectado Real` |
| RESUMEN `% Avance de Obra` | de `mantenimiento_cronograma.avance_pct` ponderado por `parcial_et` |

Política monetaria: escala interna 10 decimales, importes oficiales en céntimos (`BIGINT`), cierre `HALF_UP` a 2 decimales, reparto de residuo por mayor resto con desempate estable por `sort_order`/`id`. **Toda suma conciliable cierra en `S/ 0.00`.** Sin parches ocultos: el ajuste de céntimos es una regla visible que sube a la partida mayor (igual criterio que `valorizado-presupuesto-reconciliation`).

Paridad PHP ⇄ TypeScript con fixtures JSON compartidos.

---

## 5. Frontend

```
resources/js/
├── pages/costos/mantenimiento/
│   ├── Index.tsx            (lista de documentos del proyecto)
│   └── Editor.tsx           (shell: tabs de hoja + panel Parámetros)
└── features/mantenimiento/
    ├── api/                 maintenanceApi, seriesApi, importApi, resumenApi
    ├── sheets/
    │   ├── MatSheet.tsx     E.T. + cotizaciones + compras dinámicas
    │   ├── MoSheet.tsx      E.T. + cotizado + P.M.O dinámicos
    │   ├── GgSheet.tsx      fijo/variable + pagos fechados
    │   ├── CronogramaSheet.tsx
    │   └── ResumenSheet.tsx (read-only, render de vista calculada)
    ├── grid/                GridViewport, BlockRow (naranja/colapsable), DynamicColumnGroup, CalculatedCell
    ├── series/              AddSeriesButton (nueva compra/cotización/parcial con fecha), SeriesHeader
    ├── scenarios/           ScenarioTabs (MO / MO 1.), DuplicateSheetDialog
    ├── params/              ProgramParamsPanel (aprobado ideal, IGV%, aportes socios, descuento adj)
    ├── hooks/               useDocument, useAutosave (reusa cola v1), useCalculatedGrid
    └── domain/              money/, calc/, wbs/ (árbol + bloques), validation/
```

- Estado normalizado por ID (Zustand). Suscripción por celda/serie; editar una celda no re-renderiza la hoja.
- Bloques naranjas: fila `BlockRow`, colapsable, con subtotales calculados; sin edición.
- Series dinámicas: cada `DynamicColumnGroup` se dibuja a partir de `mantenimiento_series`; botón **"+ Compra"** / **"+ Cotización"** / **"+ Parcial"** pide fecha (y proveedor si aplica) y crea la serie vía operación.
- Autosave / IndexedDB / conflictos: se reutiliza tal cual de v1.
- Claro/oscuro con `useAppearance`; colores del Excel → roles semánticos (`bloque`, `entrada`, `calculo`, `pagado`, `pendiente`, `deficit`).

---

## 6. Backend

```
app/Domain/Mantenimiento/
├── Wbs/            (constructor de árbol, clasificador bloque/detalle, detección I.E.)
├── Series/         (definición de tipos de serie + su sub-esquema)
├── Calc/           (motor de columnas calculadas + rollup de bloques)
├── Resumen/        (agregador RESUMEN — servicio puro)
├── Money/          (reusa v1)
└── Formula/        (reusa v1, para cronograma y calculadas)
app/Infrastructure/Mantenimiento/Presupuesto/  (TenantPresupuestoSource — extender: árbol + I.E.)
app/Http/Controllers/Mantenimiento/  (Document, Import, Series, Scenario, GgLine, Cronograma, Resumen, Annotation)
app/Http/Requests/Mantenimiento/     (FormRequests)
app/Models/Mantenimiento/            (nuevos modelos de dominio)
```

- Controladores delgados, validación en FormRequest, autorización en Policy (`abort_unless($project->user_id === … , 403)` + `hasModule('mantenimiento')`).
- Escrituras en Actions transaccionales; una operación = un lote idempotente con `base_revision`.
- `Domain/Mantenimiento` depende del contrato `PresupuestoSource`; solo el adaptador de infraestructura conoce `CostoProject` y `costos_tenant`.
- RESUMEN se sirve por `GET .../resumen` (calculado en vivo, cacheado por `revision`), nunca se persiste como celdas.

---

## 7. Migración desde v1

| Componente v1 | Acción |
|---|---|
| `mantenimiento_operaciones`, `_snapshots` | **Conservar.** |
| Cola IndexedDB + autosave + ACK incremental + resolución de conflictos | **Conservar.** |
| `DecimalMath`, `MoneyAllocator`, parser/AST de fórmulas | **Conservar.** |
| `mantenimiento_hojas/columnas/filas/celdas` + `formula_dependencies` | **Retirar** (migración `down` + nuevas migraciones de dominio). |
| `MaintenanceBudgetImportService` (hojas planas) | **Reescribir** según §3. |
| `MaintenanceAdvancedStructureService` | **Retirar** (papelera/duplicar de grilla libre no aplica). |
| `MaintenanceGrid.tsx`, `editorStore.ts` genérico, `BudgetImportDialog.tsx` | **Reescribir** por hoja de dominio. |
| Rutas `costos.mantenimiento.*` (sheets/columns/rows/cells) | **Reemplazar** por rutas de dominio (`series`, `scenarios`, `gg-lines`, `cronograma`, `resumen`, `annotations`). |
| Migraciones `2026_09_10_000020..000050` | Aún **sin commit** (working tree). Se pueden **reescribir en sitio** antes del primer commit, sin `tenant:migrate-all` de rollback. |

> El módulo aún **no está desplegado ni commiteado** (git status: todo `M`/`??`). No hay datos de producción que preservar: el replanteo se hace sobre las migraciones actuales antes del primer commit.

---

## 8. Implementación por fases (v2)

Cada fase entrega algo usable y tiene puerta de salida.

### Fase R0 — Modelo de dominio y fixtures
- Migraciones nuevas `mantenimiento_*` (§2), retiro de las tablas genéricas.
- Modelos Eloquent + relaciones.
- Fixtures dorados: árbol WBS con bloques, ACU con parciales (0, nulo, negativo, positivo < 1 céntimo), 3 cotizaciones, 2 compras, N parciales MO, GG fijo/variable, cronograma.
- **Termina cuando:** existe el esquema y una matriz de reglas verificable contra el artefacto.

### Fase R1 — Importación estructurada
- `TenantPresupuestoSource` extendido: árbol + clasificación bloque/detalle + detección de I.E.
- Reescritura de `MaintenanceBudgetImportService` (§3): siembra `partidas`, `recursos`, escenarios iniciales, ≥3 cotizaciones vacías.
- Preview con incluidos/excluidos/faltantes/ambiguos por tipo; confirmación transaccional idempotente; diff de reimportación.
- Pest: exclusión comprobada de `parcial ≤ 0` en las 5 tablas; cero `INSERT/UPDATE/DELETE` sobre Presupuesto/ACU.
- **Termina cuando:** un proyecto importa su presupuesto y ve el árbol con bloques naranjas + recursos ACU positivos, sin cotizaciones/compras inventadas.

> **Estado (2026-09-10):** R0, R1 y R2-MO **implementados y verdes** (14 tests). El v1 genérico (grilla libre + import plano) fue eliminado. Tablas: `mantenimiento_partidas` (árbol WBS compartido), `mantenimiento_instituciones`, `mantenimiento_escenarios`, `mantenimiento_mo_partida`, `mantenimiento_mo_serie`, `mantenimiento_mo_parcial`, `mantenimiento_importaciones`. Dominio: `Wbs\WbsBuilder` + `Mo\MoCalculator`. Frontend: `features/mantenimiento/mo/` + `Editor.tsx` con tabs de las 6 hojas (solo MO activa).
>
> **MO tal como quedó:** filas `ie` (barra oscura) → `bloque` (naranja, colapsable, rollup) → `partida`. Todas las celdas de identidad son editables inline (ítem, descripción, unidad, y para partida: metrado→E.T. cantidad, P.U. M.O.→E.T. precio). Cualquier fila se puede eliminar (con guardia de hijos). Columnas: E.T. (metrado × `costo_mano_obra`) · Cotizado (cantidad copia del E.T., P.U. editable) · PRESUPUESTO (precargado = parcial cotizado, editable) · **P.M.O 1…N** (serie dinámica; cada columna con etiqueta editable — "Adelanto", "Herramientas y equipos", etc. — y fecha; adelanto/herramientas ya NO son columnas fijas, son P.M.O etiquetados) · **FINAL = Σ de todos los P.M.O** · **SALDO = PRESUPUESTO − FINAL**. Si SALDO ≠ 0 → fila resaltada + banner ámbar "N partidas sin cuadrar" (FINAL debe igualar al Presupuesto). Autosave: debounce por celda.
>
> **Manual sin presupuesto:** si el proyecto no tiene Presupuesto (o el snapshot falla), el preview devuelve `{available:false, reason}` y la UI ofrece **"Agregar fila"** (I.E. / bloque / partida, con metrado y P.U. M.O. para derivar el E.T.). Se puede eliminar cualquier fila `origen: manual`.
>
> **Pendiente en MO:** undo/redo, cola IndexedDB offline, persistir colapsado, columnas de anotación libres, edición de fecha/etiqueta de cada P.M.O, reordenar filas manuales.

> **MAT (implementado, 2026-09-10):** filas `ie` → `bloque` → `partida` (UND + MET. del presupuesto) → **material** (de `acu_materiales`, parcial > 0). Por material: **E.T.** (unidad, cantidad, P.U., P.T = cant × P.U. — del ACU) · **3 cotizaciones fijas** (proveedor, cantidad que arranca = E.T., P.U. manual, P.T) → columna **P.U. mínimo** de las 3 + **P.T. ref** = cantidad_ET × P.U. mín · **N compras** con fecha editable (cantidad vacía, P.U. → subtotal, botón "+ Compra") · **TOTAL COMPRADO** = Σ subtotales · **SALDO = P.T. E.T. − TOTAL COMPRADO**, resaltado si ≠ 0. Barra de conciliación **EXP. TÉC. / CORREGIDO / DÉFICIT·SUPERÁVIT·CUADRA**. Scroll horizontal, ítem+descripción sticky. Escenarios MAT / MAT (2). Tablas `mantenimiento_mat_*` (`_000070`).

### Fase R2 — Hojas de recurso con series dinámicas
- `MatSheet`: E.T. + cotizaciones + **"+ Compra (fecha)"** → columnas `cantidad/precio/subtotal` + subtotal por compra + saldo E.T.
- `MoSheet`: E.T. + cotizado + **"+ Parcial P.M.O"** + POR PAGAR + ajustes.
- `EqSheet` / `ScSheet` / `SpSheet`: variante de MAT sin cotizaciones (o con, según se confirme en R0).
- `BlockRow` naranja colapsable con rollup.
- Autosave reutilizado; operaciones `series.create`, `serie_valor.set`, `serie.update`.
- **Termina cuando:** se registran N compras fechadas y N parciales y los cálculos cierran, sin resetear scroll/selección al guardar.

### Fase R3 — Gastos Generales conectados
- `GgSheet` fijo/variable + **"+ Pago (fecha)"** → `Σ`.
- `mantenimiento_gg_movimientos` (viáticos/caja chica) básico.
- **Termina cuando:** GG proyectado vs real vs pagado cuadra y alimenta el rollup.

### Fase R4 — Cronograma / Porcentaje
- `CronogramaSheet` por partida `detalle`: hitos + cálculos de fecha + `% avance`.
- **Termina cuando:** editar `inicio físico` / `plazo` recalcula `fin de contrato` y el `% avance` sube a RESUMEN.

### Fase R5 — RESUMEN auto + Parámetros del Programa
- `ProgramParamsPanel`: Aprobado Ideal por componente, IGV%, aportes socios por armada, descuento por adjudicación, apoyo técnico.
- `MaintenanceResumenService`: RESUMEN GENERAL + DESAGREGADO + MONTO A INVERTIR + GASTO REAL, todo calculado y read-only.
- **Termina cuando:** RESUMEN reproduce las cifras del Excel (dentro de tolerancia a céntimos) sin celdas editables.

### Fase R6 — Escenarios / versiones
- `ScenarioTabs` + `DuplicateSheetDialog` (clona series+valores del `tipo_hoja`).
- **Termina cuando:** existen `MO` y `MO 1.` como escenarios y el RESUMEN usa el escenario activo.

### Fase R7 — Conciliación monetaria exacta + anotaciones libres
- Bloque DÉFICIT/SUPERÁVIT en MAT; reparto de residuos visible; toda suma conciliable en `S/ 0.00`.
- `mantenimiento_columnas_anotacion` (máx. 6 por hoja).
- **Termina cuando:** ninguna suma difiere y no hay `float` en cálculos autoritativos.

### Fase R8 — Import/Export Excel real + piloto
- Importador `.xlsx` con preview/mapeo, traducción de fórmulas soportadas, tratamiento explícito de `#REF!` y copias.
- Export Excel/PDF desde datos canónicos, conciliado a céntimos contra casos dorados.
- Piloto en paralelo con el Excel real; congelar el Excel como evidencia al aprobar equivalencia.
- **Termina cuando:** el archivo real migra y exporta sin pérdida silenciosa.

---

## 9. Criterios de aceptación globales (v2)

- El documento cubre un Programa; tras importar se abre, calcula y guarda sin volver a consultar Presupuesto/ACU.
- Integración **solo lectura** hacia Presupuesto; nunca la modifica.
- Se importa toda la estructura WBS (bloques + detalle) y solo detalles ACU con `parcial > 0` (MO, MAT, EQ, SC, SP).
- Los padres con ítem entero se muestran como **bloque naranja** colapsable, sin celdas de dato.
- MAT: ≥3 cotizaciones + N compras fechadas (`cantidad · precio = subtotal`). MO: N parciales `P.M.O`. GG: N pagos fechados → `Σ`.
- RESUMEN es auto-generado, read-only, y reproduce el Excel a nivel de céntimos.
- Escenarios `MO` / `MO 1.` coexisten; el RESUMEN usa el activo.
- Guardar/recalcular no resetea estado, selección ni scroll. Refresco o corte de red no pierde borradores. Peticiones repetidas no duplican.
- Toda suma conciliable cierra en `S/ 0.00`. Sin `float` autoritativo.
- Claro/oscuro sin pérdida de contraste; escritorio/tablet/móvil con experiencia diseñada.
- Compilan backend y frontend; pasan Pest, pruebas TS y benchmarks.

---

## 10. Decisiones aún abiertas para R0

1. `EQ` / `SC` / `SP`: ¿llevan cotizaciones y compras como MAT, o solo un registro de ejecución simple (cantidad·precio pagado)?
2. Tamaños máximos reales: nº de I.E., partidas por I.E., compras y parciales esperados por línea.
3. ¿La I.E. se detecta por color/patrón de fila de encabezado o por el primer nivel del árbol WBS? (afecta al parser de importación)
4. `ADELANTO` / `EQUIPOS` / `HERRAMIENTA` en MO: ¿son filas de ajuste fijas por partida o series propias?
5. Viáticos / caja chica en GG: ¿alcance R3 o se difiere a R8?
6. Regla exacta de "Presupuesto Aprobado Ideal": ¿lo tipea el usuario por componente, o se deriva del presupuesto aprobado del proyecto en Costos?
7. `% Avance de Obra`: ¿lo ingresa el usuario por partida, o se deriva del avance de compras/pagos vs E.T.?
8. Retención de papelera / operaciones / snapshots y frecuencia de snapshots automáticos.
