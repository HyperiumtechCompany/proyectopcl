# Plan Técnico: Proyección y Reposicionamiento Automático de Luminarias (Estilo DIALux)

Este documento detalla la arquitectura técnica y los algoritmos necesarios para implementar el posicionamiento automático de luminarias en un recinto, respetando su geometría y evadiendo obstáculos estructurales (columnas, vigas, etc.), basándonos en el sistema 2D actual del editor.

> [!NOTE]
> **Contexto Actual**
> Tras investigar la base de código (`polygonGeometry.ts`, `types.ts`), el sistema actual maneja polígonos simples en 2D (metros) y utiliza algoritmos como ray-casting (`pointInPolygon`) y el centroide de área (`polygonCentroid`). No existen actualmente operaciones booleanas de polígonos (CSG) ni entidades de "obstáculos de techo" o "columnas" en el modelo de datos `Room`.

## 1. Evolución del Modelo de Datos

Para que el sistema entienda qué áreas están bloqueadas, debemos extender el modelo de dominio en `resources/js/pages/dialux/hooks/types.ts`.

### [MODIFY] `resources/js/pages/dialux/hooks/types.ts`
Necesitamos introducir el concepto de obstáculo arquitectónico/estructural y vincularlo al recinto.

```typescript
/** Nuevo tipo para elementos estructurales u obstáculos */
export interface StructuralObstacle {
    id: string;
    name: string; // Ej: "Columna A", "Viga Central", "Zona Restringida"
    obstacleType: 'column' | 'beam' | 'restricted_area';
    vertices: Vertex[]; // Polígono 2D (footprint) proyectado en planta
    height: number; // Altura desde el suelo (m)
    elevation: number; // Elevación desde el suelo (m) - para vigas suspendidas
}

// Extender la interfaz Room actual
export interface Room {
    // ... campos existentes ...
    /** Obstáculos que restringen la colocación de luminarias en el techo */
    obstacles?: StructuralObstacle[];
}
```

## 2. Nueva Dependencia: Operaciones Booleanas de Polígonos

El cálculo geométrico requiere restar las áreas de los obstáculos al polígono base del techo. El código actual carece de esta capacidad.

> [!IMPORTANT]
> Se requiere instalar una librería de CSG (Constructive Solid Geometry) 2D. 
> **Recomendación:** `polygon-clipping` (algoritmo de Martinez-Rueda) por su robustez, o `polybooljs`. Esto permitirá restar polígonos de forma exacta.

**Comando previsto:**
```bash
npm install polygon-clipping
npm install -D @types/polygon-clipping
```

## 3. Algoritmo de Proyección y Cálculo de Zonas Válidas

Se creará un nuevo módulo matemático para procesar la geometría antes de distribuir luminarias.

### [NEW] `resources/js/pages/dialux/geometry/ceilingProjection.ts`

El flujo del algoritmo será:
1. **Proyección Inicial:** Tomar el polígono 2D del `Room` (techo base).
2. **Filtrado de Obstáculos:** Identificar qué `StructuralObstacle` del `Room` interfieren con el plano de montaje de las luminarias (evaluando `elevation` y `height` vs la altura de montaje deseada).
3. **Substracción Booleana (Diferencia):** Usar la librería CSG para restar los polígonos de los obstáculos filtrados del polígono del techo.
   * *Resultado:* Esto puede devolver un **MultiPolígono** (si un obstáculo divide el techo en dos o más áreas separadas, como un pasillo atravesado por una viga gigante) o un Polígono complejo con "agujeros" (holes).
4. **Descomposición:** Si el resultado es un MultiPolígono, tratar cada polígono resultante como una "Zona Válida de Instalación" independiente.

## 4. Lógica de Distribución de Luminarias

La lógica actual en `fixtureGrid.ts` (`buildFixtureGridObjects`) asume un único polígono y distribuye en base a `polygonCentroid`. Esto debe cambiar para soportar geometrías con huecos y áreas divididas.

### [MODIFY] `resources/js/pages/dialux/hooks/fixtureGrid.ts`

**Algoritmo propuesto de Repartición Inteligente:**
1. **Cálculo de Demanda:** Determinar cuántas luminarias se necesitan en total para el `Room` (según cálculo lumínico o solicitud manual).
2. **Reparto por Área:** Si la substracción generó múltiples Zonas Válidas (MultiPolígono), repartir la cantidad total de luminarias proporcionalmente al área de cada Zona Válida.
3. **Generación de Grilla por Zona:** Para cada Zona Válida:
   * En lugar del simple `polygonCentroid`, utilizar el algoritmo **"Pole of Inaccessibility"** (recomendación: agregar la librería `polylabel`) para encontrar el verdadero centro visual/geométrico seguro de zonas irregulares (con forma de U, C, o polígonos con agujeros).
   * Generar la grilla (filas x columnas) expandiéndose desde este polo.
4. **Corrección de Colisiones (Snap-to-Valid):** Durante la iteración de creación de la grilla (paso `clampInsidePolygon` actual):
   * Probar cada coordenada proyectada contra el polígono de la Zona Válida.
   * Si la coordenada cae en un hueco (ej. justo donde hay una columna), desplazar la luminaria a la coordenada más cercana válida (borde del obstáculo + margen de seguridad) usando un algoritmo de proyección de distancia mínima.

## 5. Reposicionamiento Automático (Reacción en Vivo)

El sistema debe recalcular esto dinámicamente cuando el usuario edita la escena.

### [MODIFY] `resources/js/pages/dialux/hooks/store/useEditorStore.ts` o Actions

* **Intercepción de Modificaciones:** Cuando se detecte una acción tipo `addObstacle`, `moveObstacle`, `updateRoomVertices`, o `resizeObstacle`.
* **Disparador:** 
  1. Identificar si el `Room` afectado tiene grillas de luminarias dinámicas vinculadas.
  2. Ejecutar la función de recálculo (pasos 3 y 4).
  3. Actualizar silenciosamente las posiciones `(x, y)` de las entidades `Fixture` asociadas a la grilla, manteniendo sus UUIDs para no perder configuraciones eléctricas.

## Open Questions

> [!WARNING]
> Necesitamos definir el comportamiento exacto para ciertos casos límite antes de programar:

1. **Margen de Seguridad:** Cuando una luminaria cae exactamente sobre un obstáculo, ¿debe el sistema desplazarla hacia el espacio vacío más cercano o simplemente omitir (eliminar) esa luminaria específica de la grilla para mantener la simetría perfecta de las demás? DIALux a veces omite luminarias si el choque es severo.
2. **Librerías Permitidas:** ¿Tienen alguna restricción con añadir `polygon-clipping` y `polylabel` al `package.json`? Son estándares de la industria GIS en JS, pero aumentan el bundle.
3. **UX de Obstáculos:** ¿Los usuarios dibujarán las columnas/vigas usando herramientas 2D en planta (como si dibujaran paredes) o serán objetos 3D predefinidos arrastrados desde un catálogo?

## Verification Plan

* **Pruebas Unitarias (`polygonGeometry.test.ts`):** 
  * Mockear un polígono rectangular de 10x10.
  * Añadir un obstáculo central de 2x2.
  * Verificar que la substracción resulta en un polígono con 1 hueco.
  * Verificar que el algoritmo de distribución coloca luminarias alrededor del hueco sin intersecarlo.
* **Pruebas Visuales:** Dibujar una sala en forma de L, colocar un bloque restrictivo en la esquina, pedir una grilla de 4x4 y observar que ninguna luminaria quede dentro del bloque.
