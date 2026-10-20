# Plan — Gast. Fin. (Gastos Financieros) dentro de Delphin

> Módulo hermano de **Mantenimiento** (RESUMEN · MO · MAT · GG), con tres diferencias:
> 1. **Se abre desde Delphin**: un botón de modo `Gast. Fin.`, junto a Presupuesto y CPM.
> 2. **Las filas no son partidas.** Son **insumos de los ACU consolidados por grupo de nivel 1** del presupuesto. Se suman todas las especialidades que cuelgan de ese grupo.
> 3. **Lectura en vivo**: el Expediente Técnico (cantidad, P.U., parcial) se recalcula del presupuesto + ACU en cada carga. Gast. Fin. solo guarda lo que se registra en él.
>
> Stack: Laravel 12, PHP 8.3, Inertia v2, React 19, TS, Tailwind v4, MySQL. **Sin librerías nuevas.**
> Presupuesto, ACU, Cronograma y Mantenimiento solo se **leen**.
>
> Referencia visual: las 3 capturas del Excel real (MO por nivel, MAT "INSUMOS 4° NIVEL", RESUMEN) enviadas el 2026-10-19.

---

## 0. Decisiones tomadas

| # | Decisión (2026-10-19) | Consecuencia |
|---|---|---|
| G1 | **Gast. Fin. = Gastos Financieros.** | Prefijo técnico `gastfin`. |
| G2 | **Grupo = cada padre de nivel 1** del presupuesto (PRIMER NIVEL, SEGUNDO NIVEL, AZOTEA…). Solo el nivel 1 se clasifica (Módulo / Institución / Piso, etiqueta editable). | El grupo se identifica por `presupuesto_general.id` del nodo raíz, que es estable aunque cambie su código. |
| G3 | **Lo de adentro se suma.** Todas las especialidades y partidas bajo un grupo aportan sus insumos ACU a ese grupo. | E.T. del insumo en el grupo = Σ (metrado partida × cantidad ACU [× desperdicio]), con la misma regla que `flattenInsumos` del modal *Insumos consolidados*. |
| G4 | **MO = una sola hoja**, con un bloque por grupo (como la captura 1). | Filas: insumos de mano de obra (OFICIAL, OPERARIO, PEÓN…) del grupo. |
| G5 | **MAT = una pestaña por grupo** (como la captura 2, "INSUMOS 4° NIVEL"). | Filas: materiales consolidados del grupo más filas manuales. |
| G6 | GG y RESUMEN: misma estructura que Mantenimiento, pero RESUMEN desagrega por grupo (captura 3). | Se reutilizan `GgCalculator` y las tablas `mantenimiento_gg_*`. |

### Decisiones pendientes (resueltas 2026-10-19: P4 pagos de MO solo por nivel; P5 colores uniformes en títulos y resultados)

| # | Pregunta | Por qué importa |
|---|---|---|
| P4 | En RESUMEN, MANO DE OBRA se divide en **ESTRUCTURA / ACABADOS** × nivel. ¿Las valorizaciones y adelantos de MO se registran por grupo, o por grupo × especialidad (nivel 2)? | Define la clave de los pagos de MO. |
| P5 | Los colores de celda del Excel (amarillo, celeste, naranja, magenta) ¿significan algo (pagado, pendiente, adelanto…), o son libres? | Si significan algo, el sistema los pone solo; si no, es un marcador manual. |

---

## 1. Las hojas

### 1.1 MO (una hoja, bloque por grupo)
- **Izquierda (en vivo, solo lectura):** Descripción · Und · Cantidad · P.U. · Parcial, de `acu_mano_de_obra` consolidado del grupo.
- **Derecha (registrado):** columnas de pago compartidas por toda la hoja, con nombre libre y fecha (ADELANTO 1, VAL 01 - S1, 19/02/2025…). En cada grupo hay dos franjas, **VALORIZACIONES** y **ADELANTOS**. Cada celda lleva una **etiqueta** opcional ("1.00", "VAL 7") y un **monto**.
- **Totales por grupo:** Parcial E.T., Total valorizado, Total adelantos, Total pagado, Saldo = Presupuesto aprobado del grupo − Total pagado.
- Columnas de pago colapsables; resultado sticky a la derecha.

### 1.2 MAT (una pestaña por grupo)
- **Expediente técnico (en vivo):** Cantidad · P.U. · Parcial.
- **Cotizado (registrado):** Cantidad (arranca = E.T.) · P.U. · Parcial.
- **Compras N (registrado, dinámicas):** encabezado "COMPRA k: fecha"; por compra Cantidad · P.U. · Subtotal · Proveedor.
- **Filas manuales:** insumos comprados que no están en el E.T. (p. ej. variantes de acero por diámetro, "CEMENTO CEMEX HE"). Quedan con E.T. en blanco.
- Totales: Total comprado, Saldo vs E.T. y conciliación déficit/superávit, como en Mantenimiento.

### 1.3 GG
Igual que Mantenimiento: fijo/variable, rubros, N pagos fechados, plantilla estándar.

### 1.4 RESUMEN (captura 3)
- **Resumen general:** Materiales, Mano de obra y Equipos y herramientas salen en vivo del E.T. Costo Directo, GG, Utilidad, Total, IGV, Descuento y Total adjudicado se calculan como en Mantenimiento.
- **Monto a invertir:** igual que Mantenimiento.
- **Resumen desagregado:**
  - Materiales: una línea por grupo.
  - Mano de obra: una línea por grupo, más el desglose ESTRUCTURA/ACABADOS según P4.
  - GG: una línea por rubro.
  - Columnas: Aprobado ideal (manual por línea) · Proyectado real · Actual · Deuda · Déficit · % gasto · % avance.

---

## 2. Modelo de datos (tenant `costos_tenant`)

Cabecera: **reutilizar `mantenimiento_documentos`**, con `origen = 'delphin'` y `presupuesto_id` (un documento por presupuesto, creado al abrir el modo por primera vez). Hereda `parametros`, revisión/lock y snapshots. GG cuelga de ese documento con sus tablas actuales.

**Claves estables** (`acu_materiales`/`acu_mano_de_obra` se borran y reinsertan en cada guardado del ACU; sus ids no sirven):
- `grupo_id` = `presupuesto_general.id` del nodo de nivel 1.
- `insumo_key` = `tipo | descripción normalizada | unidad normalizada`, la misma clave de `consolidateInsumos`. Si alguien renombra un insumo en el ACU, sus compras no se pierden: quedan como fila con E.T. en blanco, igual que una fila manual.

Migraciones nuevas, **aditivas e idempotentes**:

| Tabla | Contenido |
|---|---|
| `mantenimiento_documentos` + `origen`, `presupuesto_id` | índice único (`presupuesto_id`, `origen`) |
| `gastfin_grupos` | `grupo_id`, `tipo` (modulo/institucion/piso), `presupuesto_aprobado_minor`, orden |
| `gastfin_insumos` | (`grupo_id`, `tipo` mo/mat, `insumo_key`) + snapshot de descripción/unidad, `manual` bool, cotizado cant/P.U. |
| `gastfin_mo_pagos` | columna de pago: nombre, fecha, orden |
| `gastfin_mo_pago_valor` | (`pago_id`, `grupo_id`, franja valorizacion/adelanto) → etiqueta, monto (más especialidad si P4 lo pide) |
| `gastfin_mat_compras` | (`grupo_id`, n, fecha) |
| `gastfin_mat_compra_valor` | (`compra_id`, `insumo_id`) → cantidad, P.U., proveedor |

---

## 3. Rendimiento

El cálculo pesado es la consolidación: miles de partidas × decenas de miles de líneas de ACU.

**Backend**
- **Consolidador en PHP** (`GastFinConsolidator`), port fiel de `flattenInsumos` + `consolidateInsumos`. Lee 1 consulta por tabla (`presupuesto_general`, `presupuesto_acus`, `acu_*` por `presupuesto_id`) y ensambla en O(n) con mapas. Un test de paridad con casos fijos garantiza que da lo mismo que el modal.
- **Caché del E.T.** por documento, con clave = huella de la fuente (`max(updated_at)` + `count` de presupuesto_general y presupuesto_acus). Editar una celda de compra no reconsolida nada.
- Montos en céntimos enteros (`toCents`/`fromCents`, gotcha de `DecimalMath::round`).
- **La edición devuelve un delta** (fila + totales del grupo + total general), no la hoja completa.
- Endpoints por hoja; MAT por grupo (`GET gastfin/mat/{grupoId}`). Solo se carga la pestaña abierta.

**Frontend**
- Grilla virtualizada con `useVirtualizer`, como `DelphinGrid`/`BudgetTree`: alto de fila fijo, `div` + CSS grid (sin `<table>` ni rowSpan).
- Estado normalizado por id; reutiliza `MoNumberCell`/`MoTextCell`/`MoDescriptionCell`. Sin `useMemo` manual (React Compiler).
- Chunk lazy: Delphin no descarga Gast. Fin. hasta pulsar el modo.

---

## 4. Fases

| Fase | Entrega | Verificación |
|---|---|---|
| **F0** | Confirmar P4–P5. Medir el presupuesto real más grande (partidas, líneas de ACU, grupos). | Números anotados aquí. |
| **F1** | Migraciones + `GastFinConsolidator` + caché + `GET gastfin/grupos` y E.T. por grupo. | Pest: paridad con `flattenInsumos`, suma de especialidades por grupo, clave estable tras re-guardar ACU, carga con 5 000 partidas. |
| **F2** | Modo `Gast. Fin.` en `DelphinToolbar`, vista con pestañas (RESUMEN, MO, MAT·grupo…, GG), chunk lazy, creación del documento al abrir. | `npm run types`, `npm run build`. |
| **F3** | **MO**: bloques por grupo, columnas de pago, franjas valorización/adelanto, saldo por grupo. | Pest de totales y saldo. |
| **F4** | **MAT** por grupo: cotizado, compras N con proveedor, filas manuales, conciliación. | Pest de compras, filas huérfanas y manuales. |
| **F5** | **GG** (reutilizado) + **RESUMEN** desagregado + exportar Excel (valores = pantalla, sin fórmulas propias). | Pest RESUMEN, cuadre al céntimo. |
| **F6** | Ajuste de rendimiento contra lo medido en F0. | Medición repetida. |

Después de cada migración: `php artisan tenant:migrate-all` y `DESCRIBE` en el tenant real.

---

## Estado (2026-10-20)

F0–F5 implementadas (sin commit). F6 pendiente de la prueba del usuario.
- Medición: presupuesto real (221 partidas): consolidar 87 ms, desde caché 5 ms; MO+MAT 36 ms. Sintético 5 000 partidas / 60 000 líneas: 0,37 s.
- Paridad: Σ de todos los insumos = Costo Directo del presupuesto real, exacto a 10 decimales.
- RESUMEN avisa los subcontratos/subpartidas del ACU (no entran en MAT/MO/EQ).
- GG reutiliza las rutas de Mantenimiento: `MaintenanceDocument::allowedFor()` deja pasar documentos `origen = delphin` aunque el proyecto no tenga el módulo Mantenimiento.
- Tests: tests/Unit/GastFinTest.php (7).
