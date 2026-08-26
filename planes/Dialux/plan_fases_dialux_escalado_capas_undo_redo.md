# Plan por fases para corregir el escalado, la selección por capas y el historial de cambios del editor DIALux

## 1. Propósito del documento

Este documento transforma el requerimiento inicial en un plan técnico de implementación para Claude Code y Codex.

El trabajo se realizará de manera progresiva y por capas. No se debe avanzar a una fase posterior hasta que la fase anterior tenga pruebas automatizadas y criterios de aceptación cumplidos.

Las tres prioridades son:

1. Corregir el escalado y garantizar que cualquier geometría dibujada conserve las mismas dimensiones y áreas del plano CAD importado.
2. Organizar y seleccionar los objetos por capas y jerarquías, evitando que al borrar un elemento pequeño se elimine accidentalmente el recinto o el ambiente que lo contiene.
3. Implementar un historial confiable de cambios mediante `Ctrl + Z` para deshacer y `Ctrl + Y` o `Ctrl + Shift + Z` para rehacer.

---

# 2. Redacción técnica mejorada del requerimiento

## Prompt general

```text
Vamos a desarrollar y corregir el editor del sistema DIALux de forma progresiva, trabajando por capas y separando claramente la geometría, la representación visual, la interacción del usuario y el historial de cambios.

La primera prioridad es corregir el sistema de escalado. El plano importado mediante la librería @mlightcad/cad-simple-viewer conserva correctamente sus dimensiones y permite obtener un área equivalente a la del archivo CAD. Sin embargo, cuando el usuario dibuja un recinto o ambiente sobre el plano, el área calculada por el sistema no coincide con el área real.

Ejemplo:
- Área en el plano CAD: 40.096 m².
- Área calculada para el recinto dibujado en el sistema: 44.540 m².
- Diferencia: 4.444 m².
- Error aproximado: 11.08 %.

Esta diferencia afecta todos los cálculos posteriores: cantidad de luminarias, longitud de cables, cantidad de dispositivos, metrados y costos. Por ello, toda la aplicación debe utilizar una única escala real y un único sistema de coordenadas. Los decimales necesarios deben conservarse internamente sin redondeos prematuros.

La segunda prioridad es organizar el dibujo por capas, tipos de objetos y relaciones jerárquicas. Actualmente se dibuja primero un recinto, dentro de este un ambiente y, posteriormente, luminarias, tomacorrientes, interruptores, cables y otros dispositivos. Cuando varios objetos están superpuestos o muy próximos, al seleccionar o eliminar un dispositivo pequeño puede terminar seleccionándose o eliminándose el recinto o el ambiente contenedor.

Cada objeto debe tener una identidad independiente. La selección debe realizarse sobre el objeto exacto y la eliminación debe afectar únicamente a la entidad seleccionada. Los objetos contenedores, como recintos y ambientes, deben contar con mecanismos adicionales de protección. La eliminación en cascada de un contenedor y sus elementos internos nunca debe ocurrir de manera implícita.

La tercera prioridad es implementar un historial de acciones. Todas las operaciones que modifiquen el proyecto deben poder deshacerse y rehacerse con Ctrl + Z, Ctrl + Y y Ctrl + Shift + Z. El historial debe registrar acciones completas, no cada movimiento intermedio del puntero.

Claude Code debe comenzar inspeccionando el repositorio, la versión instalada de @mlightcad/cad-simple-viewer, el sistema de coordenadas actual, las transformaciones aplicadas al canvas, la estructura de entidades y la forma en que actualmente se seleccionan y eliminan objetos. No debe modificar el código hasta producir un diagnóstico técnico verificable.

Codex debe apoyar creando algoritmos independientes, tipos de datos, pruebas unitarias, pruebas de integración, casos límite y propuestas de refactorización. Los cálculos geométricos no deben depender directamente de componentes visuales ni de coordenadas en píxeles.
```

---

# 3. Principios obligatorios de la solución

## 3.1. Una sola fuente de verdad geométrica

Toda la geometría persistida debe almacenarse en coordenadas del mundo real.

No se deben guardar como geometría definitiva:

- Coordenadas de pantalla.
- Píxeles del canvas.
- Coordenadas afectadas por zoom.
- Coordenadas afectadas por desplazamiento visual.
- Dimensiones redondeadas para mostrar en la interfaz.

La cámara, el zoom y el desplazamiento solo deben afectar la visualización.

---

## 3.2. Separación de responsabilidades

La solución debe separar como mínimo:

```text
CAD importado
    ↓
Sistema de unidades
    ↓
Geometría del mundo
    ↓
Modelo semántico de objetos
    ↓
Índice espacial y selección
    ↓
Renderizado
    ↓
Interfaz de usuario
    ↓
Historial de comandos
```

No se deben mezclar cálculos de área con eventos del mouse, componentes visuales o estilos del canvas.

---

## 3.3. Precisión interna

Los valores deben conservar toda la precisión disponible durante los cálculos.

Reglas:

- No utilizar `toFixed()` antes de terminar un cálculo.
- No convertir valores geométricos a enteros.
- No redondear vértices al guardarlos.
- Redondear únicamente para la presentación visual o la exportación final.
- Definir explícitamente la cantidad de decimales que se mostrarán.
- Registrar unidades en cada dato geométrico.

---

## 3.4. Identidad independiente de cada objeto

Cada entidad debe tener un identificador único e inmutable.

Ejemplos:

- Recinto.
- Ambiente.
- Luminaria.
- Tomacorriente.
- Interruptor.
- Cable.
- Tablero.
- Etiqueta.
- Punto de conexión.

La relación entre un objeto hijo y su contenedor no debe convertirlos en una sola entidad seleccionable o eliminable.

---

## 3.5. Toda modificación debe ser reversible

Las operaciones de creación, edición, movimiento y eliminación deben ejecutarse mediante comandos reversibles.

No se debe modificar el estado directamente desde los componentes visuales.

---

# 4. Fase 0 — Auditoría técnica del sistema actual

## Objetivo

Comprender exactamente dónde se produce la diferencia de escala, cómo se almacenan los objetos y cómo se ejecutan actualmente la selección y la eliminación.

## Actividades

### 4.1. Revisar el repositorio

Claude Code debe identificar:

- Framework y lenguaje.
- Versión de `@mlightcad/cad-simple-viewer`.
- Versión de Three.js, canvas o motor gráfico relacionado.
- Componentes del editor.
- Servicios de importación CAD.
- Clases geométricas.
- Estado global.
- Persistencia del proyecto.
- Funciones de área y distancia.
- Transformaciones de coordenadas.
- Eventos de selección.
- Eventos de eliminación.
- Sistema actual de capas.
- Existencia de un sistema de comandos o historial.

### 4.2. Trazar el flujo de coordenadas

Documentar el recorrido completo:

```text
Punto del archivo CAD
→ punto importado
→ punto del modelo
→ punto transformado
→ punto mostrado
→ clic del usuario
→ punto convertido nuevamente al modelo
→ punto guardado en el recinto dibujado
```

### 4.3. Registrar todas las transformaciones

Buscar:

- Factores de escala.
- Conversión milímetros–metros.
- Conversión pulgadas–milímetros.
- Matrices de transformación.
- Transformaciones CSS.
- `devicePixelRatio`.
- Zoom de la cámara.
- Escala del objeto Three.js.
- Escala del grupo o escena.
- Traslación del origen.
- Inversión del eje Y.
- Redondeos.
- Conversión entre coordenadas locales y globales.

### 4.4. Crear una prueba de reproducción

Caso obligatorio:

```text
Área CAD de referencia: 40.096 m²
Área dibujada actualmente: 44.540 m²
Diferencia: 4.444 m²
Error relativo aproximado: 11.08 %
```

Registrar:

- Coordenadas exactas de los vértices.
- Unidad del CAD.
- Escala visual.
- Escala del modelo.
- Área antes y después de cada transformación.
- Fórmula usada para el área.

## Entregables

- `docs/audit/current-architecture.md`
- `docs/audit/coordinate-flow.md`
- `docs/audit/scale-bug-reproduction.md`
- `docs/audit/selection-delete-flow.md`
- `docs/audit/history-status.md`

## Criterio de aceptación

La causa de la diferencia debe estar localizada y demostrada con valores reproducibles. No se acepta una corrección basada únicamente en un factor fijo aplicado al ejemplo.

---

# 5. Fase 1 — Sistema canónico de unidades y escalado

## Objetivo

Garantizar que el plano importado y todos los objetos creados por el usuario utilicen la misma escala física.

## 5.1. Definir la unidad canónica

Elegir una sola unidad interna para todo el proyecto.

Recomendación inicial:

```text
Unidad interna: metro
```

Cada archivo importado debe convertirse una sola vez a la unidad canónica.

Ejemplos:

```text
1 mm = 0.001 m
1 cm = 0.01 m
1 m = 1 m
1 pulgada = 0.0254 m
1 pie = 0.3048 m
```

La unidad original debe conservarse como metadato.

## 5.2. Detectar la unidad del archivo

Implementar este orden:

1. Leer la unidad declarada en el archivo CAD, cuando esté disponible.
2. Utilizar metadatos del proyecto.
3. Solicitar una unidad al importar si no existe información confiable.
4. Permitir calibración manual como mecanismo de respaldo.

No se debe asumir automáticamente que una unidad CAD equivale a un metro.

## 5.3. Implementar calibración manual

Cuando la unidad no sea confiable:

1. El usuario selecciona dos puntos conocidos.
2. El sistema calcula la distancia actual.
3. El usuario introduce la distancia real.
4. Se calcula el factor de escala.

Fórmula:

```text
factorEscala = distanciaReal / distanciaMedida
```

Aplicación:

```text
xCorregido = origenX + (x - origenX) × factorEscala
yCorregido = origenY + (y - origenY) × factorEscala
```

El área debe cambiar con el cuadrado del factor lineal:

```text
areaCorregida = areaMedida × factorEscala²
```

### Referencia del caso actual

Si el error fuera completamente uniforme y solo se utilizara el área como diagnóstico, el factor lineal aproximado sería:

```text
sqrt(40.096 / 44.540) ≈ 0.9488016217
```

Este valor no debe incorporarse como constante. Solo sirve para demostrar que el error de área puede proceder de una diferencia de escala lineal.

## 5.4. Crear funciones únicas de transformación

Implementar y reutilizar:

```ts
screenToWorld(point: ScreenPoint): WorldPoint
worldToScreen(point: WorldPoint): ScreenPoint
cadToWorld(point: CadPoint, unit: CadUnit): WorldPoint
worldToCad(point: WorldPoint, unit: CadUnit): CadPoint
```

Condiciones:

- `screenToWorld` debe retirar zoom, desplazamiento, transformación de cámara y relación de píxeles.
- `worldToScreen` debe usarse solo para renderizar.
- El modelo nunca debe persistir un `ScreenPoint`.
- Las operaciones geométricas deben recibir `WorldPoint`.

## 5.5. Centralizar el contexto geométrico

Crear una estructura equivalente a:

```ts
interface GeometryContext {
  canonicalUnit: 'm';
  sourceUnit: CadUnit;
  sourceToWorldScale: number;
  origin: WorldPoint;
  precision: number;
  coordinateSystemVersion: number;
}
```

Este contexto debe pertenecer al proyecto y no a cada componente visual.

## 5.6. Corregir el cálculo de áreas

Utilizar los vértices en coordenadas del mundo.

Para un polígono simple:

```text
Área = 1/2 × |Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)|
```

Validaciones:

- Polígono cerrado.
- Mínimo tres vértices diferentes.
- Sin valores `NaN` o infinitos.
- Sin vértices duplicados consecutivos.
- Identificación de autointersecciones.
- Manejo definido de huecos interiores.
- Orientación consistente de anillos.
- Unidad de salida en m².

## 5.7. Aplicar precisión sin redondeo prematuro

Ejemplo:

```ts
// Incorrecto para persistencia
const x = Number(rawX.toFixed(2));

// Correcto
const x = rawX;

// Solo para mostrar
const displayedX = formatNumber(x, 3);
```

## 5.8. Pruebas obligatorias

### Prueba A — Distancia

Una línea CAD de 10.000 m debe medir 10.000 m en el editor, independientemente del zoom.

### Prueba B — Rectángulo

Un rectángulo de 8.000 m × 5.012 m debe producir:

```text
40.096 m²
```

### Prueba C — Zoom

El área debe ser idéntica con:

- Zoom 25 %.
- Zoom 100 %.
- Zoom 400 %.

### Prueba D — Desplazamiento

Mover la cámara no debe cambiar coordenadas ni área.

### Prueba E — Pantallas

El resultado debe ser el mismo con diferentes valores de `devicePixelRatio`.

### Prueba F — Importación

El área obtenida de una polilínea CAD y el área de una copia dibujada sobre sus mismos vértices deben coincidir dentro de la tolerancia.

## Tolerancia inicial propuesta

```text
Error absoluto máximo: 0.005 m²
Error relativo máximo: 0.05 %
```

La tolerancia definitiva debe configurarse según la precisión requerida por el proyecto.

## Entregables

- `src/geometry/units.ts`
- `src/geometry/coordinate-transform.ts`
- `src/geometry/polygon-area.ts`
- `src/geometry/calibration.ts`
- `src/geometry/geometry-context.ts`
- Pruebas unitarias e integración.
- Herramienta visual de calibración.
- Indicador visible de unidad y escala.

## Criterio de aceptación

El recinto de prueba debe calcular aproximadamente `40.096 m²`, no `44.540 m²`, y el resultado no debe cambiar con zoom, desplazamiento o resolución de pantalla.

---

# 6. Fase 2 — Modelo de objetos, capas y jerarquías

## Objetivo

Separar visualmente y lógicamente los recintos, ambientes y dispositivos, garantizando que cada objeto pueda seleccionarse y eliminarse de manera independiente.

## 6.1. Diferenciar capa CAD y capa semántica

No confundir:

- La capa original del archivo CAD.
- La capa funcional del editor.
- La relación padre–hijo entre objetos.
- El orden visual.
- El grupo de renderizado.

Modelo propuesto:

```ts
type EntityType =
  | 'site'
  | 'building'
  | 'floor'
  | 'enclosure'
  | 'room'
  | 'luminaire'
  | 'outlet'
  | 'switch'
  | 'cable'
  | 'panel'
  | 'annotation';

interface EditorEntity {
  id: string;
  type: EntityType;
  layerId: string;
  parentId: string | null;
  geometry: EntityGeometry;
  visible: boolean;
  locked: boolean;
  selectable: boolean;
  deletable: boolean;
  zIndex: number;
  metadata: Record<string, unknown>;
}
```

## 6.2. Capas funcionales iniciales

```text
00_CAD_REFERENCE
10_ENCLOSURES
20_ROOMS
30_LUMINAIRES
40_OUTLETS
50_SWITCHES
60_CABLES
70_PANELS
80_ANNOTATIONS
90_HELPERS
```

Propiedades por capa:

- Visible.
- Bloqueada.
- Seleccionable.
- Editable.
- Imprimible.
- Opacidad.
- Color de resaltado.
- Prioridad de selección.

## 6.3. Bloquear el plano CAD de referencia

Por defecto, el plano importado debe:

- Ser visible.
- No ser editable.
- No ser eliminable desde una selección normal.
- Poder ocultarse.
- Poder bloquearse o desbloquearse expresamente.
- Funcionar como referencia para ajuste y dibujo.

## 6.4. Jerarquía semántica

Ejemplo:

```text
Edificio
└── Piso 1
    └── Recinto R-001
        └── Ambiente A-001
            ├── Luminaria L-001
            ├── Luminaria L-002
            ├── Tomacorriente T-001
            ├── Interruptor I-001
            └── Cable C-001
```

Reglas:

- Un hijo conoce su `parentId`.
- El padre no absorbe los eventos de selección del hijo.
- El hijo puede eliminarse sin afectar al padre.
- La geometría del hijo permanece independiente.
- El movimiento del padre puede trasladar a sus hijos mediante un comando grupal explícito.
- La eliminación del padre debe tratarse como una operación protegida.

## 6.5. Política de eliminación

### Eliminar un dispositivo

Al eliminar una luminaria, tomacorriente o interruptor:

- Se elimina exclusivamente el ID seleccionado.
- Se actualizan cálculos relacionados.
- No se elimina el ambiente.
- No se elimina el recinto.
- No se eliminan objetos vecinos.

### Eliminar un ambiente con hijos

Comportamiento recomendado:

1. Bloquear la eliminación inmediata.
2. Mostrar la cantidad y tipos de hijos.
3. Ofrecer operaciones explícitas:
   - Cancelar.
   - Eliminar solo el ambiente y reasignar hijos.
   - Eliminar toda la jerarquía.
4. Registrar toda la operación como una única transacción reversible.

### Eliminar un recinto

Debe requerir una operación protegida, porque puede contener ambientes y dispositivos.

No debe ejecutarse únicamente porque el recinto se encuentre detrás de otro objeto seleccionado.

## 6.6. Índice espacial

Implementar un índice espacial para consultar los objetos cercanos al puntero.

Opciones:

- R-tree.
- Quadtree.
- BVH.
- Índice espacial disponible en la librería, si cumple los requisitos.

El índice debe devolver candidatos, pero no decidir por sí solo cuál se selecciona.

## 6.7. Hit testing por tipo de geometría

No usar únicamente cajas envolventes.

Ejemplos:

- Punto o símbolo: distancia al centro o a la geometría.
- Línea o cable: distancia mínima al segmento.
- Polígono: punto dentro del polígono y distancia al borde.
- Luminaria: contorno real o símbolo.
- Texto: caja de interacción.
- Grupo: selección solo mediante modo específico.

## 6.8. Prioridad de selección

Cuando existan objetos superpuestos, ordenar candidatos de forma determinista.

Orden inicial propuesto:

1. Objeto ya preseleccionado mediante hover.
2. Tipo de objeto correspondiente a la herramienta activa.
3. Objeto en la capa activa.
4. Objeto más pequeño.
5. Objeto visualmente superior.
6. Objeto más cercano al puntero.
7. ID estable como criterio final.

Prioridad semántica inicial:

```text
Interruptores y tomacorrientes
→ luminarias
→ cables
→ anotaciones
→ ambientes
→ recintos
→ plano CAD
```

Esta prioridad debe ser configurable.

## 6.9. Preselección visual

Antes del clic:

- Resaltar el objeto que se seleccionará.
- Mostrar su nombre o tipo.
- Mostrar su capa.
- Cambiar el cursor cuando sea seleccionable.
- No resaltar objetos bloqueados como si fueran editables.

## 6.10. Selección cíclica

Cuando varios objetos coincidan bajo el puntero:

- Permitir cambiar entre candidatos con una tecla o clic repetido.
- Mostrar una lista contextual opcional.
- Mantener el orden estable.
- No seleccionar automáticamente el contenedor más grande.

Ejemplos de control:

```text
Tab: siguiente candidato
Shift + Tab: candidato anterior
Alt + clic: abrir lista de objetos superpuestos
```

## 6.11. Evitar propagación accidental de eventos

La selección del dispositivo no debe activar simultáneamente la selección de su padre.

Revisar:

- Bubbling de eventos.
- Delegación de eventos.
- Eventos de Three.js.
- Grupos anidados.
- Objetos transparentes.
- Eventos duplicados de `pointerdown` y `click`.
- Selección basada en DOM y selección basada en escena.

La eliminación debe utilizar el ID presente en `SelectionState`, no el último grupo interceptado por el evento.

## Entregables

- `src/entities/entity-types.ts`
- `src/entities/entity-store.ts`
- `src/layers/layer-store.ts`
- `src/selection/spatial-index.ts`
- `src/selection/hit-test.ts`
- `src/selection/selection-ranking.ts`
- `src/selection/selection-state.ts`
- `src/selection/selection-cycle.ts`
- `src/deletion/deletion-policy.ts`
- Panel de capas.
- Inspector de objeto seleccionado.
- Pruebas automatizadas.

## Pruebas obligatorias

### Prueba A

Un interruptor colocado sobre el borde de un ambiente debe seleccionarse antes que el ambiente.

### Prueba B

Al eliminar el interruptor, el ambiente y el recinto deben permanecer.

### Prueba C

Una luminaria dentro de un ambiente debe eliminarse sin modificar la geometría del ambiente.

### Prueba D

Un recinto bloqueado no debe poder eliminarse mediante `Delete`.

### Prueba E

Cuando tres objetos estén superpuestos, el ciclo de selección debe permitir acceder a los tres.

### Prueba F

Eliminar un ambiente con hijos debe activar la política protegida.

## Criterio de aceptación

No debe existir ninguna ruta de interacción normal en la que eliminar una luminaria, un interruptor o un tomacorriente elimine también su ambiente o recinto.

---

# 7. Fase 3 — Historial de comandos, deshacer y rehacer

## Objetivo

Implementar un sistema confiable para revertir y restaurar las modificaciones del proyecto.

## 7.1. Aplicar el patrón Command

Interfaz propuesta:

```ts
interface EditorCommand {
  id: string;
  name: string;
  timestamp: number;
  execute(context: EditorContext): void;
  undo(context: EditorContext): void;
  redo(context: EditorContext): void;
  serialize?(): SerializedCommand;
}
```

## 7.2. Comandos mínimos

- `CreateEntityCommand`
- `DeleteEntityCommand`
- `DeleteHierarchyCommand`
- `MoveEntityCommand`
- `MoveEntitiesCommand`
- `UpdateGeometryCommand`
- `UpdatePropertiesCommand`
- `ChangeLayerCommand`
- `ReparentEntityCommand`
- `CreateRoomCommand`
- `CreateEnclosureCommand`
- `CalibrateScaleCommand`
- `AddVertexCommand`
- `RemoveVertexCommand`
- `ReplaceGeometryCommand`

## 7.3. Historial con dos pilas

```ts
interface CommandHistory {
  undoStack: EditorCommand[];
  redoStack: EditorCommand[];
}
```

Reglas:

1. Al ejecutar un comando nuevo, se agrega a `undoStack`.
2. Al ejecutar un comando nuevo, se limpia `redoStack`.
3. `undo()` mueve el comando de `undoStack` a `redoStack`.
4. `redo()` mueve el comando de `redoStack` a `undoStack`.
5. Las operaciones fallidas no ingresan al historial.
6. El historial debe tener un límite configurable.
7. Los comandos deben ser deterministas.

## 7.4. Transacciones

Una acción del usuario puede modificar varios objetos, pero debe aparecer como un único paso.

Ejemplos:

- Crear un ambiente con etiqueta.
- Eliminar un ambiente y reasignar sus hijos.
- Mover un recinto con todos sus elementos.
- Calibrar todo el proyecto.
- Pegar varios elementos.
- Modificar un circuito y recalcular sus datos.

Interfaz propuesta:

```ts
history.beginTransaction('Mover ambiente');
history.execute(commandA);
history.execute(commandB);
history.execute(commandC);
history.commitTransaction();
```

Al presionar `Ctrl + Z`, se revierte la transacción completa.

## 7.5. Gestos continuos

Durante el arrastre:

- No crear un comando por cada `pointermove`.
- Guardar el estado inicial al comenzar.
- Mostrar cambios temporales durante el movimiento.
- Crear un único comando al finalizar.
- Cancelar el gesto con `Escape`.

## 7.6. Atajos

### Windows y Linux

```text
Ctrl + Z: deshacer
Ctrl + Y: rehacer
Ctrl + Shift + Z: rehacer
```

### macOS

```text
Cmd + Z: deshacer
Cmd + Shift + Z: rehacer
```

Los atajos no deben interferir cuando el foco esté en un campo de texto que maneje su propio historial.

## 7.7. Estado de selección después de deshacer

Definir comportamientos consistentes:

- Al deshacer una creación, retirar la entidad de la selección.
- Al deshacer una eliminación, restaurar la entidad y seleccionarla opcionalmente.
- Al deshacer un movimiento, conservar el mismo ID seleccionado.
- Al rehacer una eliminación, limpiar la selección si el objeto deja de existir.

## 7.8. Persistencia del historial

Primera versión recomendada:

- Historial solo durante la sesión.
- Proyecto persistido sin historial completo.
- Guardado automático del estado estable.

Versión posterior opcional:

- Registro serializable de comandos.
- Historial por versión del proyecto.
- Recuperación después de recargar.
- Auditoría de usuario y fecha.

## 7.9. Límite y memoria

Configurar inicialmente:

```text
Máximo: 100 o 200 acciones
```

Evitar guardar copias completas del proyecto en cada paso cuando pueda utilizarse un parche pequeño.

Usar snapshots únicamente:

- En hitos.
- Antes de migraciones.
- Para operaciones difíciles de invertir.
- Como mecanismo de recuperación.

## Entregables

- `src/history/editor-command.ts`
- `src/history/command-history.ts`
- `src/history/transaction-command.ts`
- `src/history/commands/*`
- Gestión de atajos.
- Indicadores de “Deshacer” y “Rehacer”.
- Pruebas unitarias.
- Pruebas de integración.
- Pruebas de memoria.

## Pruebas obligatorias

### Prueba A

Crear una luminaria, deshacer y rehacer.

### Prueba B

Eliminar un interruptor, deshacer y verificar que vuelva con el mismo ID y propiedades.

### Prueba C

Mover un ambiente con diez dispositivos como una sola acción.

### Prueba D

Cambiar la escala, deshacer y comprobar que todas las áreas regresen a sus valores anteriores.

### Prueba E

Después de deshacer y ejecutar un comando nuevo, la pila de rehacer debe quedar vacía.

### Prueba F

Cien operaciones consecutivas no deben corromper el árbol de entidades.

## Criterio de aceptación

Las operaciones principales del editor deben poder deshacerse y rehacerse sin perder objetos, romper relaciones padre–hijo ni alterar la escala.

---

# 8. Fase 4 — Integración de escalado, capas e historial

## Objetivo

Comprobar que los tres subsistemas funcionen conjuntamente.

## Escenario completo obligatorio

1. Importar un plano CAD.
2. Confirmar la unidad.
3. Calibrar si es necesario.
4. Dibujar un recinto de `40.096 m²`.
5. Dibujar un ambiente dentro del recinto.
6. Agregar luminarias.
7. Agregar tomacorrientes.
8. Agregar interruptores.
9. Agregar cables.
10. Seleccionar un interruptor superpuesto al borde.
11. Eliminar únicamente el interruptor.
12. Deshacer la eliminación.
13. Rehacer la eliminación.
14. Cambiar el zoom.
15. Confirmar que el área siga siendo `40.096 m²`.
16. Guardar.
17. Recargar el proyecto.
18. Confirmar que las coordenadas y áreas se mantengan.

## Validaciones

- La escala no cambia.
- Los IDs no cambian.
- Las capas se conservan.
- Las relaciones se conservan.
- El área no depende del zoom.
- El dispositivo seleccionado coincide con el resaltado.
- La eliminación afecta solo al objeto esperado.
- El historial no produce duplicados.
- Los cálculos eléctricos se actualizan una sola vez por transacción.

## Entregables

- Prueba end-to-end.
- Proyecto de demostración.
- Informe de resultados.
- Registro de errores corregidos.
- Comparación antes/después.

---

# 9. Fase 5 — Impacto sobre cálculos eléctricos y metrados

## Objetivo

Recalcular correctamente las cantidades dependientes de la geometría después de corregir la escala.

## Datos afectados

- Área de ambientes.
- Perímetros.
- Distancias entre puntos.
- Cantidad de luminarias.
- Longitud de cables.
- Longitud de canalizaciones.
- Cantidad de tomacorrientes por área.
- Cantidad de tomacorrientes exteriores por perímetro.
- Metrados.
- Costos.

## Reglas

1. Los cálculos deben consumir geometría del mundo, no geometría de pantalla.
2. El cambio de escala debe invalidar los resultados derivados.
3. El recálculo debe ejecutarse después de confirmar la transacción.
4. El recálculo no debe ejecutarse en cada movimiento temporal del puntero.
5. Cada resultado debe registrar la versión geométrica de la que procede.

## Versionado propuesto

```ts
interface DerivedCalculation {
  geometryVersion: number;
  calculationVersion: number;
  calculatedAt: string;
}
```

Si `geometryVersion` cambia, los resultados anteriores deben marcarse como desactualizados.

## Criterio de aceptación

Al corregir un área de `44.540 m²` a `40.096 m²`, todos los cálculos dependientes deben actualizarse con la nueva geometría y no conservar resultados de la escala anterior.

---

# 10. Distribución de responsabilidades

## Claude Code

Claude Code debe encargarse principalmente de:

- Auditar el repositorio.
- Localizar las transformaciones.
- Implementar cambios que atraviesen varios módulos.
- Integrar el motor geométrico con el editor.
- Integrar capas, selección y eliminación.
- Implementar el sistema de comandos.
- Ejecutar pruebas.
- Corregir incompatibilidades.
- Actualizar documentación.
- Mantener el estilo y arquitectura existentes.

### Instrucción para Claude Code

```text
Antes de modificar el proyecto, inspecciona el repositorio completo y documenta el flujo de coordenadas, la versión de @mlightcad/cad-simple-viewer, el modelo de entidades, la selección, la eliminación y cualquier sistema de comandos existente.

No apliques un factor fijo para corregir el ejemplo de 40.096 m² frente a 44.540 m². Localiza la transformación incorrecta y establece una unidad canónica. Toda geometría persistida debe usar coordenadas del mundo y conservar precisión completa.

Después implementa entidades independientes, capas funcionales, hit testing determinista, prioridad de objetos pequeños, selección cíclica y políticas protegidas para eliminar contenedores.

Finalmente implementa un historial basado en comandos y transacciones para Ctrl + Z, Ctrl + Y y Ctrl + Shift + Z. Agrega pruebas unitarias, de integración y end-to-end para cada fase.
```

---

## Codex

Codex debe encargarse principalmente de:

- Proponer tipos e interfaces.
- Crear funciones geométricas puras.
- Crear conversiones de unidades.
- Crear algoritmos de área.
- Crear pruebas numéricas.
- Crear el ranking de selección.
- Crear comandos reversibles.
- Revisar casos límite.
- Refactorizar código duplicado.
- Analizar precisión y rendimiento.

### Instrucción para Codex

```text
Desarrolla las soluciones como módulos independientes y tipados. Los cálculos geométricos deben ser funciones puras y no depender del canvas, DOM, cámara o componentes visuales.

Incluye pruebas para unidades, zoom, desplazamiento, devicePixelRatio, polígonos, objetos superpuestos, eliminación independiente, jerarquías y comandos undo/redo.

No redondees coordenadas durante el cálculo. Todo cambio persistente debe implementarse mediante un comando reversible. La selección debe devolver el ID exacto del objeto y nunca inferir una eliminación desde el grupo visual padre.
```

---

# 11. Prompts ejecutables por fase

## Prompt de la Fase 0

```text
Audita el repositorio sin realizar modificaciones. Identifica el flujo completo de coordenadas desde el archivo CAD hasta el almacenamiento de un recinto dibujado. Localiza conversiones de unidades, escalas, matrices, zoom, devicePixelRatio, redondeos y funciones de área. Reproduce el caso 40.096 m² frente a 44.540 m² y entrega un diagnóstico con la causa comprobada.
```

## Prompt de la Fase 1

```text
Implementa un sistema canónico de coordenadas en metros. Convierte la geometría importada una sola vez y almacena toda la geometría creada por el usuario en coordenadas del mundo. Separa screenToWorld y worldToScreen. Corrige el cálculo de área y agrega calibración manual por distancia conocida. El área no debe cambiar con zoom, pan o devicePixelRatio.
```

## Prompt de la Fase 2

```text
Refactoriza el editor para que recintos, ambientes, luminarias, tomacorrientes, interruptores y cables sean entidades independientes con ID, tipo, layerId y parentId. Implementa capas bloqueables, índice espacial, hit testing por geometría, preselección, ranking determinista y selección cíclica. Eliminar un hijo nunca debe eliminar al padre.
```

## Prompt de la Fase 3

```text
Implementa un historial de comandos reversibles. Agrega Ctrl+Z para deshacer, Ctrl+Y y Ctrl+Shift+Z para rehacer. Agrupa gestos continuos y operaciones múltiples en transacciones. Incluye comandos para crear, eliminar, mover, editar geometría, cambiar propiedades, cambiar de capa, reasignar padres y calibrar la escala.
```

## Prompt de la Fase 4

```text
Crea una prueba end-to-end que importe un plano, dibuje un recinto de 40.096 m², agregue un ambiente y dispositivos superpuestos, elimine únicamente un interruptor, deshaga y rehaga la eliminación, cambie el zoom, guarde y recargue. Verifica escala, IDs, capas, jerarquía y áreas.
```

## Prompt de la Fase 5

```text
Conecta la geometría corregida con los cálculos eléctricos y metrados. Cuando cambien áreas, perímetros o longitudes, invalida y recalcula luminarias, tomacorrientes, cables y costos. Registra una versión geométrica para impedir que se utilicen resultados calculados con una escala anterior.
```

---

# 12. Matriz de criterios de aceptación

| Código | Fase | Requisito | Resultado esperado |
|---|---|---|---|
| AC-001 | Escala | Área CAD 40.096 m² | Editor dentro de tolerancia |
| AC-002 | Escala | Cambiar zoom | El área no cambia |
| AC-003 | Escala | Mover cámara | Las coordenadas no cambian |
| AC-004 | Escala | Cambiar pantalla | El área no cambia |
| AC-005 | Capas | Seleccionar interruptor superpuesto | Se selecciona el interruptor |
| AC-006 | Capas | Eliminar interruptor | Recinto y ambiente permanecen |
| AC-007 | Capas | Eliminar contenedor con hijos | Operación protegida |
| AC-008 | Capas | Capa bloqueada | No admite edición normal |
| AC-009 | Historial | Crear y deshacer | La entidad desaparece |
| AC-010 | Historial | Rehacer creación | La entidad reaparece |
| AC-011 | Historial | Deshacer eliminación | Se restaura el mismo ID |
| AC-012 | Historial | Arrastrar objeto | Un solo paso de historial |
| AC-013 | Integración | Guardar y recargar | Escala y geometría idénticas |
| AC-014 | Cálculos | Corregir área | Se recalculan resultados |
| AC-015 | Cálculos | Historial de escala | Se restauran cálculos coherentes |

---

# 13. Riesgos y medidas de control

## Riesgo 1 — Aplicar un parche multiplicador

Un factor fijo podría corregir un plano y dañar otros.

### Control

Detectar unidades y corregir la transformación de origen.

---

## Riesgo 2 — Calcular con píxeles

Las áreas cambiarían con zoom, canvas o dispositivo.

### Control

Usar exclusivamente coordenadas del mundo.

---

## Riesgo 3 — Redondear vértices

Los pequeños errores acumulados modificarían áreas y perímetros.

### Control

Conservar precisión completa internamente.

---

## Riesgo 4 — Selección basada en el grupo padre

Los objetos pequeños seguirían eliminando contenedores.

### Control

Hit testing por entidad e ID; separación del grafo visual y el modelo semántico.

---

## Riesgo 5 — Eliminación en cascada implícita

Podría destruirse una parte completa del proyecto.

### Control

Política protegida y transacción explícita.

---

## Riesgo 6 — Historial mediante snapshots completos

Podría consumir demasiada memoria.

### Control

Comandos con diferencias pequeñas y snapshots solo en hitos.

---

## Riesgo 7 — Historial incompatible con recálculos

Un `undo` podría restaurar geometría, pero mantener metrados nuevos.

### Control

Agrupar geometría y actualización de dependencias en una transacción coherente.

---

# 14. Definición de terminado

El trabajo se considerará terminado cuando:

1. El plano importado y los objetos dibujados utilicen la misma unidad y escala.
2. El área de referencia de `40.096 m²` se reproduzca dentro de la tolerancia definida.
3. El zoom, desplazamiento y resolución no afecten la geometría.
4. Cada objeto tenga un ID independiente.
5. Las capas puedan bloquearse, ocultarse y configurarse.
6. La preselección muestre el objeto que recibirá el clic.
7. Los objetos superpuestos puedan recorrerse mediante selección cíclica.
8. Eliminar un dispositivo no elimine su ambiente ni su recinto.
9. Los contenedores con hijos tengan eliminación protegida.
10. Las operaciones principales admitan deshacer y rehacer.
11. Los gestos continuos creen un solo paso de historial.
12. El estado se conserve al guardar y recargar.
13. Los cálculos eléctricos se actualicen después de cambios geométricos.
14. Existan pruebas unitarias, de integración y end-to-end.
15. La documentación describa el sistema de coordenadas, capas, selección e historial.

---

# 15. Orden obligatorio de ejecución

```text
Fase 0: auditoría y reproducción
        ↓
Fase 1: unidad, coordenadas y escala
        ↓
Fase 2: entidades, capas y selección
        ↓
Fase 3: comandos, deshacer y rehacer
        ↓
Fase 4: integración end-to-end
        ↓
Fase 5: cálculos eléctricos y metrados
```

No se debe comenzar la implementación de `undo/redo` sobre un modelo de entidades inestable. Tampoco se debe desarrollar la selección por capas antes de corregir y unificar las coordenadas.
