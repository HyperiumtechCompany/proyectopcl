# Plan de automatización del mantenimiento — ecosistema propio con importación desde Presupuesto

> **Estado:** Fase 0 parcialmente completada; Fases 1 a 6 implementadas (10/09/2026). La Fase 0 queda abierta hasta validar el `.xlsx` original y aprobar sus decisiones funcionales.
> **Artefacto analizado:** `1.0 PG COLEGIOS HUAMALIES 2026- Mantenimiento_reporte.md`.
> **Stack:** Laravel 12, PHP 8.3, Inertia v2, React 19, TypeScript, Tailwind CSS v4 y MySQL.
> **Decisión vigente:** Mantenimiento vivirá dentro de cada proyecto de Costos, pero tendrá datos, reglas y operación propios. Presupuesto será únicamente una fuente de importación unidireccional.

## 1. Alcance revisado

Construir, por cada `CostoProject`, un ecosistema autónomo de mantenimiento que conserve la flexibilidad útil de Excel, pero con cálculo confiable, guardado continuo y una estructura de software mantenible. Al crearlo o actualizar su línea base podrá traer una copia controlada del presupuesto del proyecto y de los detalles de sus ACU.

El usuario podrá:

- crear uno o más documentos de mantenimiento dentro de un proyecto;
- importar una línea base desde el presupuesto y sus ACU mediante una acción explícita;
- crear, renombrar, duplicar, ordenar y eliminar hojas;
- agregar, insertar, mover, duplicar y eliminar filas sin reconstruir la hoja;
- agregar, configurar, mover, ocultar y eliminar columnas;
- trabajar con columnas de texto, número, moneda, porcentaje, fecha, selección y fórmula;
- calcular de forma inmediata solo las celdas afectadas por un cambio;
- continuar editando mientras se guarda en segundo plano;
- cerrar, refrescar o perder temporalmente la conexión sin perder cambios confirmados ni borradores locales;
- revisar historial, recuperar versiones y deshacer operaciones;
- usar la aplicación en escritorio, tablet o móvil, en modo claro u oscuro;
- importar el Excel inicial y exportar vistas sin depender del Excel para operar.

### 1.1 Límite de la integración

- `CostoProject` será el contexto propietario y permitirá seleccionar su base tenant.
- Mantenimiento podrá **leer** `presupuesto_general`, `presupuesto_acus` y las cinco tablas relacionales `acu_*` al ejecutar una importación.
- Mantenimiento nunca escribirá, corregirá ni eliminará datos de Presupuesto/ACU.
- No habrá sincronización automática, consultas vivas durante el cálculo ni fórmulas que dependan directamente de tablas de Presupuesto.
- Después de importar, las hojas trabajan exclusivamente con el snapshot propio de Mantenimiento.
- Una actualización desde Presupuesto siempre mostrará diferencias y requerirá confirmación; nunca pisará silenciosamente datos editados en Mantenimiento.
- Por ahora no se leerán `insumo_productos`, tablas `gg_*` ni cronogramas de Costos como fuentes operativas.
- No se cambiará ninguna API pública existente de Costos.
- No se incorporarán librerías nuevas.

La integración será un adaptador de entrada separado del núcleo. Presupuesto entrega una fotografía; Mantenimiento conserva la procedencia, crea sus propios IDs y evoluciona sin afectar la fuente.

## 2. Diagnóstico del artefacto

El reporte describe 10 hojas, 1,812 celdas con fórmula y 5,096 celdas literales clasificadas como posibles entradas. El problema no es únicamente trasladar fórmulas: el archivo mezcla estructura, datos, presentación, cálculo y versiones manuales.

### 2.1 Familias detectadas

| Familia | Hojas | Tratamiento inicial |
|---|---|---|
| Materiales | `MAT`, `MAT (2)`, `Copia de MAT (2)` | Recibirán las partidas importadas y los detalles positivos de `acu_materiales`; las variantes seguirán siendo hojas/versiones independientes. |
| Mano de obra | `MO`, `MO 1.` | Recibirán detalles positivos de `acu_mano_de_obra`; no se asumirá que una hoja reemplaza a la otra. |
| Gastos generales | `GG`, `Copia de GG` | Hojas o versiones. La copia no se sumará automáticamente. |
| Plazo y avance | `CRONOGRAMA`, `PORCENTAJE` | Hojas relacionadas mediante referencias estables, sin depender de posiciones. |
| Consolidado | `RESUMEN` | Hoja calculada desde otras hojas del documento autónomo. |

### 2.2 Riesgos que no se deben reproducir

- Hay **21 referencias rotas `#REF!`**.
- Existen constantes incrustadas sin nombre ni explicación, como `30813.81`, `8600`, `1404.2`, `1200`, `296.34`, `100000`, `1000`, `1534`, `324.5` y `11000`.
- Hay correcciones manuales de centavos como `+0.01` y `-0.28`.
- Los colores parecen tener significado funcional, pero no constituyen una regla verificable.
- Las copias tienen filas desplazadas, fórmulas diferentes y datos adicionales.
- Las referencias usan coordenadas como `G77` o nombres de hoja; insertar filas puede cambiar o romper su significado.

La automatización debe conservar el resultado válido del Excel, no sus defectos estructurales.

## 3. Principios de producto y arquitectura

### 3.1 Documento autónomo

La raíz del módulo será un `DocumentoMantenimiento`. Tendrá identidad, proyecto propietario, título, estado, moneda, revisión y hojas propias. `CostoProject` se usará únicamente para navegación, autorización y resolución de su base tenant. Las tablas `mantenimiento_*` vivirán en el ecosistema tenant del proyecto y todo lo necesario para abrir, calcular y editar el documento quedará dentro de ellas.

```text
Documento de mantenimiento
├── Hojas
│   ├── Columnas configurables
│   ├── Filas con identidad estable
│   └── Celdas de entrada o fórmula
├── Dependencias de cálculo
├── Operaciones pendientes/confirmadas
├── Historial y snapshots
└── Importaciones y exportaciones
```

### 3.2 Identidades estables

- Documento, hoja, fila y columna tendrán UUID/ULID estable.
- Una fórmula referenciará claves estables, no letras de columna ni números de fila.
- La posición visual se guardará separada de la identidad.
- Reordenar o insertar no cambiará IDs ni reconstruirá celdas existentes.
- Las referencias rotas se mostrarán como error explícito; nunca se convertirán silenciosamente en cero.

### 3.3 Cambios incrementales, nunca “borrar y reinsertar todo”

Cada acción producirá una operación pequeña:

- `row.insert`, `row.move`, `row.update`, `row.delete`;
- `column.insert`, `column.move`, `column.update`, `column.delete`;
- `cell.set`, `cell.clear`, `cell.set_formula`;
- `sheet.insert`, `sheet.move`, `sheet.rename`, `sheet.delete`.

El backend aplicará lotes de operaciones dentro de una transacción. Guardar una celda no reemplazará la hoja, no reseteará la selección, no perderá el scroll y no invalidará filas ajenas.

### 3.4 Cálculo reactivo e incremental

- El editor mantendrá un grafo de dependencias por IDs estables.
- Al editar una celda se recalcularán únicamente sus dependientes.
- Las fórmulas se procesarán en orden topológico.
- Los ciclos se detectarán y marcarán sin bloquear el resto de la hoja.
- El resultado aparecerá inmediatamente en React.
- El backend repetirá el cálculo al guardar y devolverá el valor autoritativo.
- Frontend y backend compartirán fixtures JSON de conformidad para evitar resultados distintos.

### 3.5 Persistencia orientada a no perder información

- Actualización optimista: la edición aparece al instante.
- Autosave por lotes después de un debounce corto, inicialmente entre 500 y 800 ms.
- Cada operación tendrá `operation_id` único y será idempotente.
- Cada documento tendrá `revision`; el servidor rechazará escrituras sobre una revisión incompatible.
- Las operaciones no confirmadas se conservarán en IndexedDB usando APIs nativas del navegador.
- Al recuperar conexión, la cola se reenviará en orden y sin duplicados.
- La interfaz mostrará estados `Guardando`, `Guardado`, `Sin conexión`, `Conflicto` y `Error`.
- Antes de abandonar con operaciones no persistidas se mostrará advertencia.
- Habrá snapshots periódicos y antes de importaciones o cambios estructurales grandes.
- El ACK del servidor actualizará solo IDs/revisiones afectados; nunca reemplazará todo el estado del editor.

### 3.6 Integración unidireccional con Presupuesto

```text
CostoProject
    └── base tenant del proyecto
          ├── presupuesto_general ──┐
          ├── presupuesto_acus ─────┤ lectura puntual
          └── acu_* (parcial > 0) ──┘
                                      ↓
                         snapshot de importación
                                      ↓
                      ecosistema de Mantenimiento
                         (edición y cálculo propios)
```

Reglas:

1. El usuario inicia `Importar desde Presupuesto` dentro del proyecto.
2. El backend resuelve la conexión tenant y el presupuesto seleccionado del proyecto.
3. Lee la estructura de `presupuesto_general` ordenada por `item_order`.
4. Lee sus cabeceras de `presupuesto_acus` y conserva partida, descripción, unidad, rendimiento, costos por categoría y `costo_unitario_total`.
5. Para cada ACU consulta `acu_mano_de_obra`, `acu_materiales`, `acu_equipos`, `acu_subcontratos` y `acu_subpartidas`.
6. **Solo importa un detalle de recurso cuando su columna `parcial` sea estrictamente mayor que cero en la base de datos.** Valores `0`, `0.0000000000`, nulos o negativos no se importan.
7. La comparación se hace como decimal en backend, antes de serializar y sin redondear a dos decimales. Un parcial pequeño pero positivo sí se importa.
8. No basta con que la cabecera ACU tenga `costo_unitario_total > 0`: el filtro se aplica individualmente a cada detalle.
9. El importador informará cuántos detalles incluyó y cuántos excluyó por cada tipo de recurso.
10. Si el `parcial` almacenado contradice cantidad × precio, se registra una advertencia; el importador no inventa ni corrige silenciosamente el valor fuente.

La importación crea IDs propios. Los IDs de presupuesto y ACU se guardan únicamente como procedencia para auditoría y comparación futura, sin `cascade delete` hacia Mantenimiento.

### 3.7 Contenido y destino del snapshot

| Fuente | Datos copiados | Destino inicial en Mantenimiento |
|---|---|---|
| `presupuesto_general` | ID fuente, partida, descripción, unidad, metrado, precio unitario, parcial, jerarquía/orden y fecha de actualización. | Hoja técnica de presupuesto base y estructura inicial de las hojas que necesiten partidas. |
| `presupuesto_acus` | ID fuente, partida, descripción, unidad, rendimiento, totales por categoría y costo unitario total. | Cabecera ACU asociada a la partida importada. |
| `acu_materiales` | Identidad del insumo, códigos disponibles, descripción, unidad, cantidad, precio, desperdicio, proveedor, parcial y orden. | Hoja `MAT` o plantilla de materiales. |
| `acu_mano_de_obra` | Identidad, códigos disponibles, descripción, unidad, cantidad, recursos/cuadrilla, precio, parcial y orden. | Hojas `MO`/`MO 1.` según el mapeo confirmado. |
| `acu_equipos` | Identidad, descripción, unidad, cantidad, recursos, precio por hora, parcial y orden. | Fuente/hoja de equipos y secciones que la plantilla determine. |
| `acu_subcontratos` | Identidad, descripción, unidad, cantidad, precio, parcial y orden. | Fuente/hoja de subcontratos. |
| `acu_subpartidas` | Identidad, descripción, unidad, cantidad, precio, parcial y orden. | Fuente/hoja de subpartidas. |

Todos los tipos se guardan primero en un snapshot normalizado, aunque el Excel original no tenga una hoja visible para cada uno. Así no se descarta información positiva y el mapeo hacia `MAT`, `MO`, `GG` u otra hoja puede evolucionar sin volver a consultar Presupuesto.

La unión inicial entre partida y ACU usará una clave de negocio normalizada y validará unicidad. Si existen dos ACU posibles para la misma partida o una partida sin ACU, la previsualización lo mostrará como ambigüedad; nunca elegirá el último registro por orden accidental.

### 3.8 Actualizar desde Presupuesto sin perder trabajo

Una segunda importación será una comparación de tres estados: snapshot anterior, Presupuesto actual y datos actuales de Mantenimiento.

- `nuevo`: existe en Presupuesto y no en el snapshot anterior;
- `sin_cambios`: hash fuente idéntico;
- `modificado_en_origen`: cambió en Presupuesto y no fue editado localmente;
- `conflicto`: cambiaron origen y Mantenimiento;
- `retirado_del_origen`: ya no existe o su detalle ACU dejó de cumplir `parcial > 0`;
- `solo_mantenimiento`: fila creada dentro del ecosistema propio.

Nada se elimina ni sobrescribe automáticamente. El usuario confirma por lote o por fila. Un recurso que pasa de positivo a cero queda marcado como retirado del origen, conserva su historia y deja al usuario decidir si se desactiva en la hoja.

## 4. Modelo de datos flexible

Los nombres son propuestos. Las tablas operativas no dependen de las tablas de Presupuesto; solo las tablas de procedencia conocen los IDs de origen.

| Tabla | Responsabilidad |
|---|---|
| `mantenimiento_documentos` | Título, moneda, estado, revisión, configuración y versión del motor dentro del tenant del proyecto. La pertenencia se obtiene del límite físico de esa base. |
| `mantenimiento_fuentes_presupuesto` | Presupuesto de origen, conexión/proyecto, revisión o fecha leída, hash y última comparación. No es fuente de cálculo después de importar. |
| `mantenimiento_partidas_importadas` | Snapshot de código, descripción, unidad, metrado, precio unitario, parcial, orden y procedencia de `presupuesto_general`. |
| `mantenimiento_acus_importados` | Snapshot de la cabecera ACU asociada a una partida importada. |
| `mantenimiento_recursos_importados` | Snapshot normalizado de los cinco tipos de detalle ACU aceptados por `parcial > 0`. |
| `mantenimiento_hojas` | Nombre, orden, visibilidad y configuración de cada hoja. |
| `mantenimiento_columnas` | Clave estable, etiqueta, tipo, orden, ancho, formato, validación y fórmula por defecto. |
| `mantenimiento_filas` | ID estable, hoja, padre opcional, orden, nivel, estado y metadatos. |
| `mantenimiento_celdas` | Valor tipado, fórmula opcional, resultado calculado, error y versión. Solo se crean celdas con contenido. |
| `mantenimiento_operaciones` | Operaciones idempotentes, revisión base, autor, resultado y fecha. |
| `mantenimiento_snapshots` | Estado comprimido/versionado para recuperación y auditoría. |
| `mantenimiento_importaciones` | Archivo, hash, mapeo, advertencias, estado y resultado de importación. |

Los campos de procedencia incluirán `source_table`, `source_id`, `source_updated_at` y `source_hash`. No tendrán borrado en cascada desde Presupuesto: si la fuente cambia o desaparece, el snapshot histórico de Mantenimiento debe conservarse.

Las migraciones `mantenimiento_*` se ejecutarán en `costos_tenant`, igual que el resto de datos aislados por proyecto, pero formarán un conjunto independiente. No se crearán claves foráneas desde filas/celdas operativas hacia Presupuesto; solo se almacenará procedencia escalar en el snapshot.

### 4.1 Columnas

Tipos iniciales:

- `text`;
- `long_text`;
- `decimal`;
- `money`;
- `percentage`;
- `date`;
- `boolean`;
- `select`;
- `formula`.

Cada columna tendrá:

- `id` estable y `key` legible e inmutable después de ser usada en fórmulas;
- etiqueta editable;
- tipo y escala;
- ancho y alineación;
- visibilidad por breakpoint;
- validaciones declarativas;
- formato claro/oscuro mediante tokens semánticos;
- fórmula por defecto opcional;
- reglas de edición y bloqueo.

Agregar una columna no ejecutará una inserción física en todas las filas. Las celdas serán dispersas: una ausencia equivale a vacío o valor por defecto.

### 4.2 Filas

- `parent_id` opcional permitirá títulos, grupos, subtotales y detalles.
- `sort_order` usará espacios entre posiciones para insertar y mover sin renumerar toda la hoja.
- Una normalización excepcional del orden será transaccional y no cambiará IDs.
- Eliminación normal mediante papelera/soft delete.
- Eliminación definitiva solo después del período de recuperación definido.
- Duplicar una fila generará IDs nuevos y actualizará referencias internas de forma controlada.

### 4.3 Celdas tipadas

Una celda no guardará todo como texto ni todo como `float`. Tendrá campos apropiados, por ejemplo:

- valor textual;
- valor decimal canónico;
- importe en céntimos;
- fecha;
- booleano;
- fórmula fuente;
- resultado canónico;
- código y detalle de error.

Una restricción garantizará que solo el campo correspondiente al tipo esté activo.

## 5. Motor de fórmulas

### 5.1 Alcance controlado

No se implementará Excel completo ni se ejecutará `eval`. Se construirá una gramática pequeña y segura que cubra las reglas observadas:

- suma, resta, multiplicación y división;
- porcentajes;
- `SUM`, `ROUND`, `MIN`, `MAX`, `IF`;
- referencia a columna de la misma fila por clave: `{cantidad} * {precio}`;
- referencia estable a otra celda mediante IDs;
- suma de hijos o de un grupo;
- suma filtrada de una columna;
- referencias entre hojas por identificador estable.

### 5.2 Componentes

1. Tokenizador y parser que convierten texto a AST.
2. Validador de tipos y referencias.
3. Constructor del grafo de dependencias.
4. Evaluador decimal puro y determinista.
5. Caché de resultados por `input_hash` y versión del motor.
6. Propagación incremental de celdas afectadas.
7. Detector de ciclos y referencias eliminadas.
8. Explicador de fórmula: entradas usadas, operación y resultado.

### 5.3 Edición estructural segura

Al insertar o mover filas/columnas, las fórmulas conservarán los IDs referenciados. Al borrar una dependencia, las fórmulas quedarán en estado `REFERENCE_ERROR` con la última referencia legible para poder repararlas. No se reasignarán a “la celda que ahora ocupa esa posición”.

## 6. Política monetaria

Aunque el módulo sea autónomo, manejará dinero con reglas estrictas.

### 6.1 Representación

- Moneda inicial configurable, con PEN como valor por defecto.
- Cantidades, factores y precios unitarios: hasta `DECIMAL(20,10)`.
- Importes oficiales: enteros en céntimos (`BIGINT`).
- API: decimales e importes como cadenas canónicas, nunca `float`.
- Frontend: `decimal.js`, ya instalado, para cálculo y visualización inmediata.
- Backend: aritmética decimal/fixed-point autoritativa, sin convertir a `float`.

### 6.2 Redondeo y residuos

- Política inicial propuesta: `HALF_UP`, pendiente de confirmación funcional.
- Redondeo oficial al cerrar cada línea calculada.
- Distribución de residuos por mayor resto y desempate estable por orden/ID.
- Todo ajuste será visible como regla o movimiento; no se admitirán parches ocultos como `+0.01`.
- Suma de filas, columnas, grupos, hojas y resumen: diferencia exacta `S/ 0.00` cuando deban conciliar.

## 7. Arquitectura frontend profesional

La página Inertia solo cargará el shell, permisos y metadatos iniciales. Las ediciones frecuentes usarán endpoints JSON incrementales para no navegar, recargar props ni resetear el editor.

### 7.1 Estructura propuesta

```text
resources/js/
├── pages/mantenimiento/
│   ├── Index.tsx
│   └── Editor.tsx
└── features/mantenimiento/
    ├── api/
    │   ├── maintenanceApi.ts
    │   ├── operationQueueApi.ts
    │   └── presupuestoImportApi.ts
    ├── components/
    │   ├── editor/
    │   ├── grid/
    │   │   ├── GridViewport.tsx
    │   │   ├── GridHeader.tsx
    │   │   ├── GridRow.tsx
    │   │   └── cells/
    │   ├── toolbar/
    │   ├── sheets/
    │   ├── presupuesto-import/
    │   ├── history/
    │   └── mobile/
    ├── composables/
    │   ├── buildOperationBatch.ts
    │   ├── composeDocumentView.ts
    │   └── projectFormulaChanges.ts
    ├── hooks/
    │   ├── useMaintenanceDocument.ts
    │   ├── useAutosave.ts
    │   ├── usePresupuestoImport.ts
    │   ├── useFormulaEngine.ts
    │   ├── useGridSelection.ts
    │   ├── useGridKeyboard.ts
    │   ├── useUndoRedo.ts
    │   ├── useWindowedRows.ts
    │   └── useResponsiveEditor.ts
    ├── stores/
    │   ├── editorStore.ts
    │   └── syncStore.ts
    ├── domain/
    │   ├── formulas/
    │   ├── money/
    │   ├── operations/
    │   └── validation/
    ├── types/
    │   ├── domain.ts
    │   ├── api.ts
    │   ├── formulas.ts
    │   └── grid.ts
    └── workers/
        └── formula.worker.ts
```

### 7.2 Responsabilidades

- `pages`: composición y layout; sin reglas de cálculo.
- `components`: renderizado y eventos de UI pequeños.
- `composables`: funciones puras que combinan casos de uso; no dependen del ciclo de vida de React.
- `hooks`: integración de estado, efectos, red, teclado y ciclo de vida React.
- `stores`: estado normalizado por IDs y suscripciones selectivas con Zustand, ya instalado.
- `domain`: reglas puras, comprobables y sin componentes.
- `types`: contratos separados de dominio, API y presentación.
- `workers`: cálculo pesado fuera del hilo principal cuando el benchmark lo justifique.

No se duplicará una regla entre componente, hook y store. Cada una tendrá un único dueño.

### 7.3 Rendimiento de React

- Estado normalizado: mapas de hojas, filas, columnas y celdas por ID.
- Suscripción por celda/fila; editar una celda no renderiza toda la grilla.
- `GridRow` y celdas memoizadas con props estables.
- Windowing de filas y columnas visibles sin agregar dependencias.
- Cálculo pesado transferible a Web Worker en una fase posterior.
- Parches locales y del servidor aplicados por ID.
- La selección, scroll, edición activa y paneles no se reinician con autosave.
- Inertia `useRemember` se reservará para preferencias ligeras de interfaz; la cola de datos vivirá en IndexedDB.

## 8. Arquitectura backend profesional

```text
app/
├── Domain/Mantenimiento/
│   ├── Actions/
│   ├── Contracts/
│   ├── Data/
│   ├── Enums/
│   ├── Exceptions/
│   ├── Formula/
│   ├── Money/
│   ├── Operations/
│   └── Services/
├── Infrastructure/Mantenimiento/Presupuesto/
├── Http/Controllers/Mantenimiento/
├── Http/Requests/Mantenimiento/
├── Http/Resources/Mantenimiento/
├── Models/Mantenimiento/
└── Policies/Mantenimiento/

database/migrations/costos_tenant/
└── *_create_mantenimiento_*_tables.php

tests/
├── Feature/Mantenimiento/
└── Unit/Mantenimiento/
```

Reglas:

- controladores delgados;
- validación en `FormRequest`;
- autorización en Policies;
- operaciones de escritura en Actions transaccionales;
- cálculo, dinero y dependencias en servicios puros;
- respuestas mediante Resources;
- modelos sin lógica de interfaz;
- eventos posteriores al commit para snapshots o trabajos secundarios;
- `Domain/Mantenimiento` depende de un contrato `PresupuestoSource`; el adaptador de infraestructura es el único que conoce `CostoProject`, la conexión `costos_tenant` y las tablas de Presupuesto/ACU;
- el adaptador solo expone DTOs/snapshots de lectura y nunca operaciones de escritura hacia Presupuesto.

## 9. Contrato de sincronización

### 9.1 Lectura

- `GET /costos/{costoProject}/mantenimiento/{documento}` carga el shell Inertia dentro del proyecto.
- `GET /costos/{costoProject}/mantenimiento/{documento}/bootstrap` entrega metadatos y primera ventana.
- `GET /costos/{costoProject}/mantenimiento/{documento}/sheets/{hoja}/rows?cursor=...` pagina filas.

### 9.2 Escritura incremental

- `PATCH /costos/{costoProject}/mantenimiento/{documento}/operations` recibe un lote ordenado.
- Payload mínimo: `document_id`, `base_revision`, `client_id`, lista de operaciones con `operation_id`.
- Respuesta: nueva revisión, operaciones aceptadas, conflictos y celdas recalculadas.
- Si se reenvía un `operation_id`, el servidor devuelve su resultado anterior sin aplicarlo dos veces.
- Un conflicto no borra el borrador local: se presenta comparación y opciones de reaplicar o descartar.

### 9.3 Operaciones masivas

Importar, pegar rangos grandes, duplicar una hoja o restaurar snapshot usarán comandos propios con progreso. Nunca se enviarán como miles de peticiones independientes.

### 9.4 Importación desde Presupuesto

- `GET .../presupuesto-import/preview` obtiene un preview sin escribir datos.
- `POST .../presupuesto-import` confirma un snapshot inicial o una actualización seleccionada.
- El servidor valida que documento, proyecto y conexión tenant correspondan al mismo contexto autorizado.
- El preview devuelve totales por fuente y por categoría ACU: encontrados, incluidos (`parcial > 0`), excluidos y ambiguos.
- La confirmación recibe el hash/revisión del preview; si Presupuesto cambió mientras el usuario revisaba, se invalida y debe generarse nuevamente.
- Las rutas nuevas usarán Wayfinder cuando se implemente el frontend, sin modificar rutas públicas existentes de Presupuesto.

## 10. Responsive, accesibilidad y temas

### 10.1 Escritorio

- Grilla completa con encabezados y primera columna fijos.
- Navegación por teclado, selección de rangos y barra de fórmulas.
- Panel lateral plegable para propiedades, errores e historial.

### 10.2 Tablet

- Toolbar compacta y acciones secundarias en menú.
- Panel lateral convertido en drawer.
- Columnas prioritarias fijas y desplazamiento horizontal controlado.

### 10.3 Móvil

- No intentar comprimir toda la hoja hasta volverla ilegible.
- Vista de filas como tarjetas editables y selector de columnas visibles.
- Edición de una celda en sheet/drawer de ancho completo.
- Acciones estructurales mediante menús táctiles y confirmaciones claras.
- El usuario puede alternar a una grilla horizontal si la necesita.

### 10.4 Claro/oscuro

- Reutilizar `useAppearance` y la preferencia `light/dark/system` existente.
- Tailwind CSS v4 con tokens semánticos y variantes `dark:` siguiendo el proyecto.
- No fijar colores de Excel como colores de UI; mapearlos a roles como entrada, cálculo, advertencia, total o error.
- Contraste WCAG AA, foco visible, estados que no dependan solo del color y objetivos táctiles adecuados.
- Probar temas en todos los estados: selección, hover, edición, error, celda calculada, bloqueo y conflicto.

## 11. Importación del Excel

La importación será posterior al editor base para no diseñar el sistema alrededor de coordenadas heredadas.

1. Cargar `.xlsx` en borrador.
2. Calcular SHA-256 y detectar reimportaciones.
3. Reconocer hojas por nombre y encabezados.
4. Crear columnas y filas con IDs nuevos y guardar el mapeo de coordenadas.
5. Traducir solo fórmulas soportadas a la gramática segura.
6. Marcar `#REF!`, números mágicos y fórmulas no soportadas para revisión.
7. Comparar copias; no consolidarlas automáticamente.
8. Mostrar previsualización y conciliación antes de confirmar.
9. Confirmar todo dentro de una transacción y crear snapshot previo/posterior.
10. Conservar `hoja/celda original -> entidad/id` para auditoría.

El reporte Markdown permite diseñar el importador, pero para certificar valores y fórmulas será necesario el `.xlsx` original o una exportación completa con resultados evaluados.

## 12. Implementación por fases

Cada fase entrega una parte utilizable y tiene puerta de salida propia.

### Fase 0 — Especificación y benchmarks

**Avance:** inventario, contrato de entrada, casos límite y objetivos documentados en `fase_0_especificacion_y_benchmarks.md`; fixture `presupuesto_acu_parciales.json` creado. Pendiente el libro original, la validación funcional y la medición real.

- Obtener el `.xlsx` original.
- Documentar el presupuesto y las cinco tablas de detalle ACU como contrato de entrada.
- Confirmar el mapeo de cada tipo de recurso hacia las hojas correspondientes.
- Preparar casos con parciales positivos, cero, nulos, negativos y positivos menores de un céntimo.
- Clasificar entradas, fórmulas, copias, jerarquías y formatos.
- Definir tamaños reales y máximos esperados de hojas.
- Resolver el significado de constantes y referencias rotas.
- Crear casos dorados monetarios y de estructura.
- Medir presupuesto de rendimiento objetivo por dispositivo.

**Termina cuando:** existe una matriz verificable de reglas y un conjunto de fixtures aprobados.

### Fase 1 — Núcleo autónomo y editor vertical mínimo

**Estado:** implementada. Incluye tablas tenant, ULID estables, orden espaciado, papelera, documentos/hojas/filas/columnas/celdas, endpoints incrementales, store normalizado y grilla React para `text`, `decimal`, `money` y `date`.

- Crear documentos de mantenimiento dentro de un `CostoProject`, con hojas, columnas, filas y celdas propias.
- Implementar IDs estables, orden con espacios y soft delete.
- Construir página Inertia, store normalizado y grilla básica.
- Agregar/editar/mover filas y columnas sin recarga.
- Implementar tipos `text`, `decimal`, `money` y `date`.

**Termina cuando:** se puede editar una hoja y cada operación persiste sin reemplazar el documento.

### Fase 2 — Autosave, recuperación y concurrencia

**Estado:** implementada. Las ediciones de celdas se agrupan con debounce de 650 ms, se conservan en IndexedDB y se envían como operaciones UUID idempotentes. El servidor aplica cada lote bajo bloqueo de revisión, devuelve ACK incrementales y responde `409` ante una versión obsoleta. La interfaz recupera pendientes al abrir, reintenta con espera exponencial, reanuda al volver la conexión, advierte antes de salir, permite resolver conflictos explícitamente y crea snapshots manuales y automáticos cada 50 operaciones. Los cambios estructurales continúan siendo peticiones inmediatas, pero primero vacían la cola y actualizan la revisión común.

- Cola de operaciones, debounce y ACK incremental.
- Idempotencia, revisión y bloqueo optimista.
- IndexedDB, reintentos, reconexión y advertencia de salida.
- Estados visuales de guardado y resolución de conflictos.
- Snapshots manuales y automáticos.

**Termina cuando:** refrescar, perder conexión o repetir una petición no pierde ni duplica cambios.

### Fase 3 — Motor de fórmulas y dinero

**Estado:** implementada. Incluye columnas de fórmula, evaluación reactiva local y confirmación autoritativa del backend; parser y AST propios sin `eval`; grafo persistido por IDs estables y recálculo incremental; errores de ciclo, referencia, tipo y división por cero; y política monetaria v1 con escala interna 10, cierre `HALF_UP` a dos decimales, céntimos enteros y reparto por mayor resto. PHP y TypeScript comparten casos de conformidad. El Worker queda condicionado al benchmark con libros reales, porque el recorrido incremental actual no bloquea el uso normal.

- Parser, AST, validación y evaluador seguro.
- Grafo de dependencias y recálculo incremental.
- Detección de ciclos y referencias rotas.
- Política de moneda, redondeo y residuos.
- Paridad frontend/backend con fixtures compartidos.
- Web Worker si los benchmarks muestran bloqueo del hilo principal.

**Termina cuando:** editar una entrada actualiza sus dependientes sin reset y el backend confirma exactamente el mismo resultado.

### Fase 4 — Importación unidireccional desde Presupuesto

**Estado:** implementada. Mantenimiento lee el presupuesto principal del tenant mediante el contrato `PresupuestoSource`, genera un preview con hash y diferencias, y confirma una copia transaccional e idempotente. Se copian presupuesto, ACU y únicamente recursos relacionales con `parcial > 0` antes de redondear. Cada importación conserva un snapshot normalizado auditable y alimenta hojas propias `Presupuesto`, `ACU`, `MO`, `MAT`, `EQ`, `SC` y `SP`. Las actualizaciones protegen filas editadas localmente y conservan elementos retirados; nunca escriben hacia las tablas de Presupuesto.

- Implementar `PresupuestoSource` y su adaptador de lectura tenant.
- Traer `presupuesto_general` y cabeceras `presupuesto_acus` del proyecto seleccionado.
- Consultar las cinco tablas relacionales ACU filtrando cada detalle con `parcial > 0`.
- Guardar partidas, ACU y recursos como snapshots propios de Mantenimiento.
- Generar preview con incluidos, excluidos, faltantes, duplicados y ambigüedades.
- Aplicar importación inicial de forma transaccional e idempotente.
- Implementar comparación de actualización sin sobrescribir trabajo local.
- Poblar las hojas correspondientes mediante reglas de plantilla, conservando el snapshot normalizado.

**Termina cuando:** un proyecto puede importar su presupuesto y únicamente los detalles ACU positivos, seguir operando sin consultas vivas y actualizar mediante un diff confirmado.

### Fase 5 — Estructura avanzada de hojas

**Estado:** implementada. Las filas admiten jerarquía padre/hijo persistida, grupos contraíbles y subtotales por claves semánticas; se pueden duplicar filas y hojas conservando nuevos ULID y remapeando referencias internas. El pegado tabular se procesa como una única transacción con validación de rango y precisión monetaria. Se incorporaron plantillas `MAT`, `MO`, `GG`, `CRONOGRAMA`, `PORCENTAJE` y `RESUMEN`, además de un comparador por claves de columna y posición lógica. Las operaciones estructurales devuelven la hoja actualizada al store sin recargar el documento.

- Jerarquía padre/hijo, grupos y subtotales.
- Duplicar hoja/fila, pegar rangos y operaciones masivas.
- Fórmulas entre hojas por IDs estables.
- Plantillas iniciales inspiradas en `MAT`, `MO`, `GG`, `CRONOGRAMA`, `PORCENTAJE` y `RESUMEN`.
- Comparador de hojas/copias.

**Termina cuando:** las estructuras del artefacto pueden modelarse sin coordenadas frágiles.

### Fase 6 — UX profesional, responsive y temas

**Estado:** implementada. La grilla virtualiza filas con overscan, mantiene selección rectangular y navegación mediante flechas, `Tab`, `Enter` y `Shift`; copia rangos como TSV y reutiliza el pegado transaccional de la fase 5. Las ediciones de celdas y los pegados masivos disponen de undo/redo agrupado, integrado con la cola de autoguardado. El layout conserva columna y cabecera fijas, reduce controles secundarios en pantallas pequeñas y ofrece estado accesible de selección y guardado. El selector claro/oscuro/sistema ahora respeta y persiste la preferencia real del usuario.

- Windowing y optimización de renderizado.
- Teclado, selección, copiar/pegar y undo/redo.
- Layouts de escritorio, tablet y móvil.
- Modo claro/oscuro/system integrado con el tema existente.
- Accesibilidad, contraste y lector de estados.

**Termina cuando:** el flujo principal es usable y fluido en los tres tamaños y ambos temas.

### Fase 7 — Importación y exportación del Excel

- Importador con preview, mapeo y errores accionables.
- Traducción de fórmulas compatibles.
- Tratamiento explícito de copias y `#REF!`.
- Exportación Excel/PDF desde datos canónicos.
- Conciliación a céntimos contra casos dorados.

**Termina cuando:** el archivo real puede migrarse y exportarse sin pérdida silenciosa.

### Fase 8 — Auditoría, permisos y endurecimiento

- Roles para ver, editar estructura, editar valores, aprobar y restaurar.
- Historial legible y restauración segura.
- Límites, cuotas, observabilidad y alertas de fallos.
- Seguridad del lenguaje de fórmulas.
- Pruebas de carga y recuperación ante fallos.

**Termina cuando:** el módulo soporta datos reales con trazabilidad y operación segura.

### Fase 9 — Piloto y reemplazo operativo

- Ejecutar el Excel y el sistema en paralelo durante cortes reales.
- Analizar cada diferencia; no ocultarla con ajustes manuales.
- Capacitar a usuarios y validar móvil/tablet.
- Congelar el Excel como evidencia histórica cuando se apruebe la equivalencia.

**Termina cuando:** el sistema es la fuente de trabajo y el Excel queda como importación/exportación.

## 13. Estrategia de pruebas

### 13.1 Unitarias

- parser y evaluación de cada operador/función;
- grafo, propagación, ciclos y referencias borradas;
- filtro decimal `parcial > 0` para los cinco tipos de recurso ACU;
- normalización y asociación inequívoca partida ↔ ACU;
- comparación entre snapshot anterior, nueva fuente y edición local;
- inserción y movimiento sin cambiar identidad;
- dinero, redondeo y reparto de residuos;
- composición e inversión de operaciones para undo/redo;
- serialización decimal sin `float`.

### 13.2 Feature/Pest

- CRUD de documentos de mantenimiento por proyecto, hojas, filas, columnas y celdas;
- aislamiento por propietario/organización;
- acceso correcto a la conexión tenant del `CostoProject` autorizado;
- preview no mutante y confirmación transaccional de Presupuesto/ACU;
- exclusión comprobada de detalles ACU con parcial cero, nulo o negativo en cada tabla;
- inclusión de parciales positivos sin redondearlos previamente;
- la importación nunca ejecuta `INSERT`, `UPDATE` o `DELETE` sobre tablas de Presupuesto/ACU;
- lote transaccional: todo o nada;
- reenvío idempotente;
- conflicto de revisión sin sobrescritura;
- snapshot, restauración e importación con rollback;
- permisos para operaciones estructurales y monetarias.

### 13.3 React/TypeScript

- editar una celda no vuelve a renderizar toda la hoja;
- el preview separa incluidos, excluidos, ambigüedades y conflictos de importación;
- autosave no pierde selección, scroll ni celda activa;
- recuperación de cola después de refrescar;
- modo desconectado y reintento;
- teclado, selección, copiar/pegar y undo/redo;
- responsive en breakpoints del proyecto;
- modo claro, oscuro y sistema;
- accesibilidad de grilla y editor móvil.

### 13.4 Rendimiento y resiliencia

Los umbrales definitivos se fijarán con el archivo original. Objetivos iniciales:

- respuesta visual a escritura en menos de 50 ms en equipo objetivo;
- ninguna navegación/recarga completa al editar o guardar;
- scroll estable con miles de filas mediante windowing;
- recálculo limitado al subgrafo afectado;
- lote de autosave sin bloquear la escritura;
- recuperación completa de operaciones locales tras desconexión simulada;
- cero operaciones duplicadas después de reintentos.

## 14. Criterios de aceptación globales

- Cada documento pertenece a un proyecto, pero después de importar puede abrirse, calcular y guardarse sin consultar nuevamente Presupuesto/ACU.
- La integración es de solo lectura hacia Presupuesto y nunca modifica su información.
- Se importa toda la estructura seleccionada de `presupuesto_general` y sus cabeceras ACU.
- De cada ACU solo se importan detalles de recurso cuyo `parcial` almacenado sea estrictamente mayor que cero.
- La regla anterior se aplica a mano de obra, materiales, equipos, subcontratos y subpartidas.
- Actualizar desde Presupuesto muestra un diff y no sobrescribe ni elimina trabajo local automáticamente.
- Se crean y editan filas/columnas de forma fluida y sin recargar.
- Agregar, mover o eliminar estructura no cambia IDs de elementos existentes.
- Guardar o recalcular no resetea estado, selección ni scroll.
- Solo se recalculan dependientes; los ciclos y referencias rotas son visibles.
- Un refresco o corte de red no elimina borradores pendientes.
- Peticiones repetidas no duplican operaciones.
- Los conflictos nunca sobrescriben silenciosamente trabajo de otra revisión.
- Todos los importes conciliables cierran con diferencia `S/ 0.00`.
- No se usa `float` en cálculos monetarios autoritativos.
- Claro/oscuro funcionan sin pérdida de contraste.
- Escritorio, tablet y móvil tienen una experiencia diseñada, no solo encogida.
- La estructura frontend y backend respeta las responsabilidades definidas.
- Compilan backend y frontend; pasan Pest, pruebas TypeScript y benchmarks relacionados.

## 15. Primer incremento recomendado

La primera entrega debe ser pequeña pero recorrer todo el sistema:

1. crear un documento de mantenimiento dentro de un proyecto;
2. crear una hoja;
3. previsualizar e importar una partida y un ACU con al menos un recurso positivo y otro en cero;
4. comprobar que el positivo llega a su hoja y el recurso en cero queda excluido en el reporte;
5. agregar una columna de texto, una decimal, una monetaria y una calculada;
6. agregar/mover filas;
7. editar una cantidad y un precio;
8. recalcular `cantidad × precio` sin resetear la grilla;
9. guardar, refrescar y recuperar exactamente el mismo estado;
10. repetir la importación/petición y demostrar que no duplica nada;
11. modificar la fuente y mostrar el diff sin pisar la edición local;
12. verificar la misma pantalla en móvil y en tema oscuro.

Este corte valida las decisiones más riesgosas —identidad, cálculo, persistencia, reactividad y UX— antes de construir todas las plantillas del Excel.

## 16. Decisiones pendientes para la Fase 0

1. Tamaño máximo esperado por documento: hojas, filas, columnas y fórmulas.
2. Si una fila puede pertenecer a una jerarquía o también a varias agrupaciones.
3. Fórmulas mínimas imprescindibles para la primera plantilla.
4. Regla oficial de redondeo y punto exacto donde se aplica.
5. Período de retención de papelera, operaciones y snapshots.
6. Nivel de trabajo desconectado: recuperación de borrador o edición offline completa.
7. Roles que pueden cambiar estructura, fórmulas y valores monetarios.
8. Si las hojas copiadas son versiones, escenarios o simples respaldos.
9. Qué experiencia móvil es prioritaria: consulta, captura rápida o edición estructural completa.
10. Frecuencia de snapshots y cantidad de versiones recuperables.
11. Si un proyecto puede tener varios presupuestos y cuál se ofrece por defecto al importar.
12. Mapeo definitivo de equipos, subcontratos y subpartidas hacia las hojas visibles del artefacto.
13. Si los detalles negativos deben quedar solo excluidos o además bloquear la importación por posible inconsistencia.
