# Implementación de Disposiciones de Luminarias (Fixture Arrangements)

Este plan detalla la arquitectura para transformar la actual "Grilla de Focos" estática (que simplemente suelta luminarias independientes) en una entidad interactiva, agrupada y completamente paramétrica, similar al comportamiento nativo de DIALux evo ("Posicionamiento según cantidad").

## User Review Required

> [!WARNING]
> **Cambio Arquitectónico:** Actualmente, al generar focos, estos se guardan como elementos individuales y desconectados. Se propone agruparlos bajo una nueva entidad `FixtureArrangement` que mantendrá la memoria de la cuadrícula (filas, columnas, modelo de luminaria). Al hacer clic en un foco que pertenezca a un grupo, **se seleccionará todo el grupo por defecto** (como en DIALux evo), permitiendo cambiar cantidad, orientación o modelo en vivo sin tener que borrar todo y regenerar. ¿Estás de acuerdo con que al hacer clic en un foco del grupo se seleccione el grupo completo?

> [!IMPORTANT]
> **Pestañas Visuales (Accordions):** Para mejorar la UI de las propiedades, se empaquetarán las secciones ("Ambiente", "Disposición", "Normativa") en menús colapsables (Pestañas/Acordeones).

## Proposed Changes

---

### Entidades y Dominio (`types.ts`)

#### [MODIFY] `resources/js/pages/dialux/hooks/types.ts`
- **Añadir `FixtureArrangement`**: Nueva interfaz para guardar la configuración (id, x, y, ancho, alto, rotación, filas, columnas, productId).
- **Modificar `Fixture`**: Añadir la propiedad opcional `arrangementId?: string` para vincular cada foco hijo a su disposición padre.
- **Modificar `Scene`**: Añadir el array opcional `arrangements?: FixtureArrangement[]`.

---

### Gestor de Estado (`useEditorStore.ts`)

#### [MODIFY] `resources/js/pages/dialux/hooks/useEditorStore.ts`
- Añadir la colección `arrangements` al estado local.
- **`addFixtureArrangement`**: Función que calcula matemáticamente los puntos XYZ y genera automáticamente el padre (`FixtureArrangement`) y sus hijos (`Fixture[]`) al mismo tiempo.
- **`updateFixtureArrangement`**: Al cambiar las filas, columnas o el producto, elimina los focos hijos actuales y los vuelve a dibujar con la nueva distribución, conservando el ID del grupo.
- **`deleteFixtureArrangement`**: Borra el grupo y hace una limpieza en cascada de todos los focos vinculados a él.

---

### Interfaz y UX (Panel Lateral)

#### [MODIFY] `resources/js/pages/dialux/components/properties/RoomProps.tsx`
- **Eliminar** la sub-sección rígida de "Generar Grilla de Focos" y "Tomacorrientes del Ambiente". 
- Agrupar todo el panel en componentes visuales expandibles/colapsables (Accordion).

#### [NEW] `resources/js/pages/dialux/components/properties/ArrangementProps.tsx`
- Panel equivalente a "Organización" en DIALux evo.
- Mostrará el `Nombre del grupo`, Controles numéricos para `Cantidad X` y `Cantidad Y`, y un selector para `Cambiar Luminaria`.

---

### Canvas 2D (Selección y Dibujo)

#### [MODIFY] `resources/js/pages/dialux/components/OverlayFixtures.tsx`
- Implementar un cuadro delimitador (bounding box) azul tenue con líneas punteadas para envolver visualmente los focos del grupo (idéntico al cuadro naranja/azul de tu captura).
- Al hacer click sobre cualquier luminaria con `arrangementId`, el sistema debe establecer el `selectionType` en `arrangement` en vez de `fixture`.

## Verification Plan

### Manual Verification
1. Generar un cuarto.
2. Seleccionar la herramienta de proyectar cuadrícula de focos (o generarla por el cuarto).
3. Seleccionar la cuadrícula y verificar que se abra el panel "Organización".
4. Cambiar el número de filas de 2 a 4. Las luminarias deben recolocarse solas.
5. Cambiar el modelo de la luminaria base del grupo y observar que se propaga a todas las hijas automáticamente.
6. Verificar que visualmente el panel de propiedades ahora tenga pestañas expandibles.

