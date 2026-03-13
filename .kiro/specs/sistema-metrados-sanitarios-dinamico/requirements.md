# Requirements Document

## Introduction

Este documento especifica los requisitos para el Sistema de Metrados Sanitarios Dinámico, una funcionalidad que permite gestionar hojas de cálculo de metrados sanitarios con estructura jerárquica de árbol, numeración automática, resúmenes dinámicos y sincronización con base de datos. El sistema se integra en una aplicación Laravel con Inertia.js existente que ya maneja cálculos de agua y desagüe.

## Glossary

- **Sistema_Metrados**: El sistema completo de gestión de metrados sanitarios dinámicos
- **Hoja_Calculo**: La interfaz de usuario que muestra la estructura de árbol de metrados
- **Nodo_Arbol**: Un elemento individual en la estructura jerárquica (puede ser Título, Subtítulo o Partida)
- **Titulo**: Tipo de nodo con numeración que agrupa subtítulos y partidas
- **Subtitulo**: Tipo de nodo con numeración que agrupa partidas y hereda unidad a sus hijos
- **Partida**: Tipo de nodo sin numeración que representa un ítem de trabajo específico
- **Modulo**: Una división arquitectónica del proyecto (ej: Módulo 1, Módulo 2, etc.)
- **Resumen_Dinamico**: Tabla consolidada que muestra totales por módulo, exterior, cisterna y total general
- **Numeracion_Jerarquica**: Sistema de numeración descendente compartido que inicia en 04 para sanitarias
- **Sincronizador_BD**: Componente que mantiene la coherencia entre la interfaz y la base de datos
- **Unidad_Heredada**: La unidad de medida del último subtítulo que se aplica a todos sus nodos hijos
- **Nivel_Jerarquico**: La profundidad de un nodo en el árbol (Título > Subtítulo > Partida)

## Requirements

### Requirement 1: Sincronización de Datos con Base de Datos

**User Story:** Como usuario del sistema, quiero que cada cambio en la hoja de cálculo se guarde automáticamente en la base de datos, para que mis datos persistan y estén disponibles en futuras sesiones.

#### Acceptance Criteria

1. WHEN un Nodo_Arbol es creado en la Hoja_Calculo, THE Sincronizador_BD SHALL persistir el nodo en la tabla correspondiente con su Nivel_Jerarquico
2. WHEN un Nodo_Arbol es modificado en la Hoja_Calculo, THE Sincronizador_BD SHALL actualizar el registro correspondiente en la base de datos dentro de 500ms
3. WHEN un Nodo_Arbol es eliminado de la Hoja_Calculo, THE Sincronizador_BD SHALL eliminar el registro y todos sus nodos hijos en cascada
4. WHEN la Hoja_Calculo es cargada, THE Sistema_Metrados SHALL recuperar todos los nodos desde la base de datos y reconstruir la estructura de árbol
5. IF la sincronización falla, THEN THE Sistema_Metrados SHALL mostrar un mensaje de error descriptivo y mantener los datos en memoria

### Requirement 2: Gestión de Estructura de Árbol Jerárquica

**User Story:** Como usuario, quiero organizar los metrados en una estructura de árbol con títulos, subtítulos y partidas, para que pueda representar la jerarquía del proyecto de forma clara.

#### Acceptance Criteria

1. THE Sistema_Metrados SHALL soportar tres tipos de Nodo_Arbol: Titulo, Subtitulo y Partida
2. WHEN un Titulo es creado, THE Sistema_Metrados SHALL permitir agregar Subtitulo y Partida como hijos
3. WHEN un Subtitulo es creado, THE Sistema_Metrados SHALL permitir agregar Subtitulo y Partida como hijos
4. WHEN una Partida es creada, THE Sistema_Metrados SHALL prohibir agregar nodos hijos
5. THE Sistema_Metrados SHALL permitir mover nodos dentro del árbol manteniendo sus relaciones padre-hijo
6. WHEN un nodo es movido, THE Sistema_Metrados SHALL recalcular la Numeracion_Jerarquica de todos los nodos afectados

### Requirement 3: Sistema de Numeración Jerárquica Automática

**User Story:** Como usuario, quiero que el sistema numere automáticamente los títulos y subtítulos de forma descendente, para que mantenga una estructura organizada sin intervención manual.

#### Acceptance Criteria

1. THE Sistema_Metrados SHALL iniciar la Numeracion_Jerarquica en 04 para el primer Titulo de sanitarias
2. WHEN un Titulo es agregado, THE Sistema_Metrados SHALL asignar el siguiente número disponible en secuencia descendente
3. WHEN un Subtitulo es agregado bajo un Titulo, THE Sistema_Metrados SHALL asignar numeración en formato "04.01", "04.02", etc.
4. THE Sistema_Metrados SHALL compartir la Numeracion_Jerarquica entre todos los Modulo
5. WHEN un Nodo_Arbol es movido o eliminado, THE Sistema_Metrados SHALL recalcular automáticamente toda la Numeracion_Jerarquica
6. THE Sistema_Metrados SHALL excluir las Partida de la Numeracion_Jerarquica
7. WHEN la numeración es recalculada, THE Sistema_Metrados SHALL actualizar todos los nodos afectados en la base de datos

### Requirement 4: Herencia de Unidades de Medida

**User Story:** Como usuario, quiero que las partidas hereden automáticamente la unidad del último subtítulo padre, para que no tenga que especificar la unidad repetidamente.

#### Acceptance Criteria

1. WHEN un Subtitulo tiene una unidad definida, THE Sistema_Metrados SHALL aplicar esa Unidad_Heredada a todos sus nodos hijos
2. WHEN la unidad de un Subtitulo es modificada, THE Sistema_Metrados SHALL actualizar la Unidad_Heredada de todos sus descendientes
3. IF un Subtitulo no tiene unidad definida, THEN THE Sistema_Metrados SHALL buscar la unidad en el Subtitulo padre más cercano
4. THE Sistema_Metrados SHALL mostrar visualmente la Unidad_Heredada en cada Partida
5. WHEN una Partida es movida a otro Subtitulo, THE Sistema_Metrados SHALL actualizar su Unidad_Heredada según el nuevo padre

### Requirement 5: Gestión Dinámica de Módulos

**User Story:** Como usuario, quiero que el sistema cree automáticamente columnas según la cantidad de módulos del proyecto, para que pueda ingresar datos específicos de cada módulo sin configuración manual.

#### Acceptance Criteria

1. WHEN el número de Modulo es definido, THE Sistema_Metrados SHALL crear dinámicamente una columna por cada Modulo
2. THE Sistema_Metrados SHALL crear columnas adicionales para "Exterior", "Cisterna" y "Total"
3. WHEN un Modulo es agregado, THE Sistema_Metrados SHALL agregar una nueva columna y actualizar el Resumen_Dinamico
4. WHEN un Modulo es eliminado, THE Sistema_Metrados SHALL remover la columna correspondiente y recalcular totales
5. THE Sistema_Metrados SHALL permitir ingresar valores numéricos en cada celda de Modulo para cada Partida
6. WHEN un valor es ingresado en una celda, THE Sistema_Metrados SHALL recalcular automáticamente la columna "Total"

### Requirement 6: Sistema de Resumen Dinámico Consolidado

**User Story:** Como usuario, quiero ver un resumen consolidado que totalice automáticamente los valores de todos los módulos, para que pueda visualizar el metrado total del proyecto.

#### Acceptance Criteria

1. THE Sistema_Metrados SHALL generar un Resumen_Dinamico que consolide todos los valores de las Partida
2. WHEN un valor en una Partida es modificado, THE Sistema_Metrados SHALL actualizar el Resumen_Dinamico dentro de 200ms
3. THE Resumen_Dinamico SHALL mostrar una fila por cada Titulo y Subtitulo con sus totales acumulados
4. THE Resumen_Dinamico SHALL incluir columnas para cada Modulo, Exterior, Cisterna y Total
5. WHEN un Nodo_Arbol es agregado o eliminado, THE Sistema_Metrados SHALL recalcular completamente el Resumen_Dinamico
6. THE Sistema_Metrados SHALL calcular el Total como la suma de todos los Modulo más Exterior más Cisterna
7. THE Resumen_Dinamico SHALL mostrar las unidades correspondientes para cada fila según la Unidad_Heredada

### Requirement 7: Persistencia por Nivel Jerárquico

**User Story:** Como desarrollador, quiero que los datos se guarden respetando su nivel jerárquico, para que la integridad referencial se mantenga en la base de datos.

#### Acceptance Criteria

1. WHEN un Nodo_Arbol es guardado, THE Sincronizador_BD SHALL incluir el Nivel_Jerarquico en el registro
2. THE Sincronizador_BD SHALL almacenar la referencia al nodo padre para cada nodo hijo
3. WHEN un nodo padre es eliminado, THE Sincronizador_BD SHALL eliminar todos sus descendientes en cascada
4. THE Sincronizador_BD SHALL mantener el orden de los nodos hermanos dentro del mismo nivel
5. WHEN la estructura es recuperada, THE Sistema_Metrados SHALL reconstruir el árbol respetando las relaciones padre-hijo y el orden original

### Requirement 8: Validación de Datos de Entrada

**User Story:** Como usuario, quiero que el sistema valide los datos que ingreso, para que evite errores y mantenga la consistencia de la información.

#### Acceptance Criteria

1. WHEN un valor numérico es ingresado en una celda de Modulo, THE Sistema_Metrados SHALL validar que sea un número válido
2. IF un valor no numérico es ingresado, THEN THE Sistema_Metrados SHALL mostrar un mensaje de error y rechazar el valor
3. THE Sistema_Metrados SHALL permitir valores decimales con hasta 2 dígitos de precisión
4. WHEN un nombre de Nodo_Arbol es ingresado, THE Sistema_Metrados SHALL validar que no esté vacío
5. THE Sistema_Metrados SHALL limitar la longitud del nombre de un Nodo_Arbol a 255 caracteres
6. WHEN una unidad es asignada a un Subtitulo, THE Sistema_Metrados SHALL validar que sea una unidad reconocida del sistema

### Requirement 9: Interfaz de Usuario Reactiva

**User Story:** Como usuario, quiero que la interfaz responda inmediatamente a mis acciones, para que pueda trabajar de forma fluida sin esperas.

#### Acceptance Criteria

1. WHEN un usuario interactúa con la Hoja_Calculo, THE Sistema_Metrados SHALL actualizar la interfaz dentro de 100ms
2. THE Sistema_Metrados SHALL mostrar indicadores visuales durante operaciones de guardado
3. WHEN múltiples usuarios editan simultáneamente, THE Sistema_Metrados SHALL sincronizar cambios mediante broadcasting
4. THE Sistema_Metrados SHALL implementar actualización optimista para mejorar la percepción de velocidad
5. IF una operación tarda más de 2 segundos, THEN THE Sistema_Metrados SHALL mostrar un indicador de progreso

### Requirement 10: Operaciones de Árbol Avanzadas

**User Story:** Como usuario, quiero realizar operaciones avanzadas como expandir/colapsar, duplicar y reordenar nodos, para que pueda gestionar estructuras complejas eficientemente.

#### Acceptance Criteria

1. THE Sistema_Metrados SHALL permitir expandir y colapsar cualquier Titulo o Subtitulo
2. WHEN un nodo es colapsado, THE Sistema_Metrados SHALL ocultar todos sus descendientes
3. THE Sistema_Metrados SHALL permitir duplicar un Nodo_Arbol con todos sus descendientes
4. WHEN un nodo es duplicado, THE Sistema_Metrados SHALL asignar nueva Numeracion_Jerarquica automáticamente
5. THE Sistema_Metrados SHALL permitir reordenar nodos mediante drag-and-drop
6. WHEN un nodo es reordenado, THE Sistema_Metrados SHALL mantener la integridad de la estructura jerárquica
7. THE Sistema_Metrados SHALL persistir el estado expandido/colapsado por usuario

### Requirement 11: Parser y Serialización de Estructura de Árbol

**User Story:** Como desarrollador, quiero serializar y deserializar la estructura de árbol correctamente, para que los datos se transmitan sin pérdida de información entre frontend y backend.

#### Acceptance Criteria

1. WHEN la estructura de árbol es enviada al backend, THE Sistema_Metrados SHALL serializar todos los nodos con sus relaciones jerárquicas
2. THE Sistema_Metrados SHALL incluir en la serialización: tipo de nodo, numeración, unidad, valores por módulo y nivel jerárquico
3. WHEN el backend envía datos al frontend, THE Sistema_Metrados SHALL deserializar la estructura y reconstruir el árbol completo
4. THE Sistema_Metrados SHALL implementar un Pretty_Printer que formatee la estructura de árbol en JSON legible
5. FOR ALL estructuras de árbol válidas, serializar, deserializar y volver a serializar SHALL producir el mismo resultado (round-trip property)
6. IF la deserialización falla, THEN THE Sistema_Metrados SHALL registrar el error con detalles del formato inválido

### Requirement 12: Integración con Sistema Existente

**User Story:** Como desarrollador, quiero que el nuevo sistema se integre con los modelos y controladores existentes, para que aproveche la infraestructura actual sin duplicar código.

#### Acceptance Criteria

1. THE Sistema_Metrados SHALL utilizar el MetradoSanitariasController existente como base
2. THE Sistema_Metrados SHALL seguir los patrones de AguaCalculation y DesagueCalculation para consistencia
3. THE Sistema_Metrados SHALL reutilizar el sistema de colaboradores existente
4. THE Sistema_Metrados SHALL implementar eventos de broadcasting similares a AguaCalculationUpdated y DesagueCalculationUpdated
5. THE Sistema_Metrados SHALL mantener compatibilidad con la arquitectura Laravel + Inertia.js existente
6. THE Sistema_Metrados SHALL utilizar las mismas convenciones de nombres y estructura de base de datos del proyecto
