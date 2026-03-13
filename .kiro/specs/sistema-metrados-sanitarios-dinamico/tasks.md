# Plan de Implementación: Sistema de Metrados Sanitarios Dinámico

## Descripción General

Este plan implementa un sistema completo de gestión de metrados sanitarios con estructura jerárquica de árbol, numeración automática descendente desde 04, herencia de unidades, resúmenes dinámicos y sincronización en tiempo real. El sistema se integra en la aplicación Laravel 11 + Inertia.js + React existente.

## Arquitectura

- **Backend**: Laravel 11 con 5 servicios (TreeService, NumberingService, UnitInheritanceService, SummaryService, Sincronizador)
- **Frontend**: React con 4 componentes principales (MetradosTreeView, TreeNode, ModuleColumns, DynamicSummary)
- **Base de Datos**: PostgreSQL con 3 tablas (metrado_sanitarias_nodes, metrado_sanitarias_values, metrado_sanitarias_user_state)
- **Testing**: Property-based testing con Eris (PHP) y fast-check (TypeScript), 28 propiedades de correctness

## Tareas de Implementación

- [x] 1. Configurar estructura de base de datos y migraciones
  - Crear migración para tabla metrado_sanitarias_nodes con campos: id (UUID), project_id, parent_id, node_type, name, numbering, unit, level, position
  - Crear migración para tabla metrado_sanitarias_values con campos: id, node_id, module_id, value (decimal)
  - Crear migración para tabla metrado_sanitarias_user_state con campos: id, user_id, project_id, expanded_nodes (JSONB)
  - Configurar índices y constraints de integridad referencial con cascada
  - _Requisitos: 1.1, 1.3, 7.1, 7.2, 7.3_

- [x] 2. Implementar modelos Eloquent y relaciones
  - [x] 2.1 Crear modelo MetradoSanitariasNode con relaciones y métodos helper
    - Definir fillable, casts, y configuración de UUID
    - Implementar relaciones: parent(), children(), values(), project()
    - Implementar scopes: rootNodes(), byLevel(), ordered()
    - Implementar métodos: isTitle(), isSubtitle(), isPartida(), canHaveChildren(), getDescendants()
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 7.4_

  - [x] 2.2 Escribir property test para modelo MetradoSanitariasNode
    - **Property 6: Reglas de jerarquía de tipos de nodos**
    - **Valida: Requisitos 2.2, 2.3, 2.4**

  - [x] 2.3 Crear modelo MetradoSanitariasValue con relaciones
    - Definir fillable, casts para decimal
    - Implementar relaciones: node(), module()
    - _Requisitos: 5.5, 6.1_

  - [x] 2.4 Crear factories para testing de ambos modelos
    - Factory para MetradoSanitariasNode con estados para cada tipo
    - Factory para MetradoSanitariasValue con valores aleatorios
    - _Requisitos: Testing_


- [-] 3. Implementar TreeService para operaciones CRUD del árbol
  - [x] 3.1 Crear TreeService con métodos básicos CRUD
    - Implementar getTree() para recuperar árbol completo de un proyecto
    - Implementar createNode() para crear nodos con validación de tipo
    - Implementar updateNode() para actualizar atributos de nodos
    - Implementar deleteNode() con eliminación en cascada
    - _Requisitos: 1.1, 1.2, 1.3, 2.1_

  - [~] 3.2 Escribir property tests para TreeService
    - **Property 1: Persistencia de nodos con nivel jerárquico**
    - **Valida: Requisitos 1.1, 7.1, 7.2**
    - **Property 2: Actualización de nodos persiste cambios**
    - **Valida: Requisitos 1.2**
    - **Property 3: Eliminación en cascada**
    - **Valida: Requisitos 1.3, 7.3**

  - [~] 3.3 Implementar moveNode() para reordenar y cambiar jerarquía
    - Validar que el movimiento no cree ciclos
    - Actualizar position de nodos afectados
    - Mantener relaciones padre-hijo de descendientes
    - _Requisitos: 2.5, 10.5, 10.6_

  - [~] 3.4 Escribir property test para moveNode
    - **Property 7: Preservación de relaciones al mover nodos**
    - **Valida: Requisitos 2.5**
    - **Property 24: Integridad jerárquica al reordenar**
    - **Valida: Requisitos 10.6**

  - [~] 3.5 Implementar duplicateNode() para copiar nodos con descendientes
    - Copiar nodo y todos sus hijos recursivamente
    - Generar nuevos UUIDs para todos los nodos copiados
    - Preservar estructura jerárquica relativa
    - _Requisitos: 10.3, 10.4_

  - [~] 3.6 Escribir property test para duplicateNode
    - **Property 23: Duplicación completa de nodos**
    - **Valida: Requisitos 10.3, 10.4**

- [~] 4. Implementar NumberingService para numeración automática
  - [~] 4.1 Crear NumberingService con lógica de numeración jerárquica
    - Implementar calculateNumbering() que inicia en 04 para sanitarias
    - Implementar lógica de formato "04.01", "04.02" para subtítulos
    - Excluir partidas de la numeración
    - Manejar numeración compartida entre módulos
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [~] 4.2 Escribir property test para NumberingService
    - **Property 8: Consistencia de numeración jerárquica**
    - **Valida: Requisitos 2.6, 3.2, 3.3, 3.5, 3.6**
    - **Property 9: Formato de numeración de subtítulos**
    - **Valida: Requisitos 3.3**

  - [~] 4.3 Implementar recalculateAfterMove() y recalculateAfterDelete()
    - Recalcular numeración de nodos afectados después de mover
    - Recalcular numeración de hermanos después de eliminar
    - Actualizar base de datos con nueva numeración
    - _Requisitos: 2.6, 3.5, 3.7_

  - [~] 4.4 Escribir unit tests para casos edge de numeración
    - Test con árbol vacío
    - Test con múltiples niveles de profundidad
    - Test con eliminación de nodo intermedio
    - _Requisitos: 3.5_

- [~] 5. Implementar UnitInheritanceService para herencia de unidades
  - [~] 5.1 Crear UnitInheritanceService con lógica de propagación
    - Implementar propagateUnit() para aplicar unidad a descendientes
    - Implementar resolveInheritedUnit() para buscar unidad en ancestros
    - Implementar updateInheritanceAfterMove() para actualizar al cambiar jerarquía
    - _Requisitos: 4.1, 4.2, 4.3, 4.5_

  - [~] 5.2 Escribir property tests para UnitInheritanceService
    - **Property 10: Herencia y propagación de unidades**
    - **Valida: Requisitos 4.1, 4.2, 4.3**
    - **Property 11: Actualización de unidad heredada al mover**
    - **Valida: Requisitos 4.5**

  - [~] 5.3 Escribir unit tests para casos específicos de herencia
    - Test con subtítulo sin unidad busca en padre
    - Test con múltiples niveles de subtítulos
    - Test con cambio de unidad en subtítulo intermedio
    - _Requisitos: 4.3_


- [~] 6. Implementar SummaryService para cálculo de resúmenes dinámicos
  - [~] 6.1 Crear SummaryService con lógica de agregación
    - Implementar calculateSummary() que genera estructura de resumen
    - Implementar aggregateByHierarchy() para sumar valores por nivel
    - Implementar calculateTotals() para calcular Total = Módulos + Exterior + Cisterna
    - Incluir unidades heredadas en cada fila del resumen
    - _Requisitos: 6.1, 6.3, 6.4, 6.6, 6.7_

  - [ ]* 6.2 Escribir property tests para SummaryService
    - **Property 12: Recálculo de totales al cambiar valores**
    - **Valida: Requisitos 5.6, 6.6**
    - **Property 14: Resumen refleja cambios en partidas**
    - **Valida: Requisitos 6.2**
    - **Property 15: Resumen contiene todos los títulos y subtítulos**
    - **Valida: Requisitos 6.3**
    - **Property 17: Unidades en resumen coinciden con herencia**
    - **Valida: Requisitos 6.7**

  - [ ]* 6.3 Escribir unit tests para casos específicos de resumen
    - Test con árbol sin valores (todos ceros)
    - Test con valores decimales
    - Test con eliminación de módulo
    - _Requisitos: 5.4, 6.5_

- [~] 7. Checkpoint - Verificar servicios backend
  - Ejecutar todos los tests de servicios
  - Verificar que las 28 propiedades de correctness pasen
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [~] 8. Implementar serialización y deserialización de árbol
  - [~] 8.1 Agregar métodos serialize() y deserialize() a TreeService
    - Implementar serialize() que convierte Collection de nodos a array JSON
    - Implementar deserialize() que reconstruye árbol desde array JSON
    - Incluir todos los campos: id, tipo, nombre, numeración, unidad, valores, nivel, relaciones
    - _Requisitos: 11.1, 11.2, 11.3_

  - [ ]* 8.2 Escribir property test para serialización
    - **Property 26: Serialización completa de nodos**
    - **Valida: Requisitos 11.2**
    - **Property 27: Round-trip de serialización**
    - **Valida: Requisitos 11.5**

  - [~] 8.3 Implementar manejo de errores en deserialización
    - Validar schema JSON antes de deserializar
    - Detectar referencias inválidas o ciclos
    - Registrar errores descriptivos con detalles
    - _Requisitos: 11.6_

  - [ ]* 8.4 Escribir property test para manejo de errores
    - **Property 28: Manejo de errores de deserialización**
    - **Valida: Requisitos 11.6**

- [~] 9. Implementar validación de datos
  - [~] 9.1 Crear Form Requests para validación de nodos
    - CreateNodeRequest con validación de nombre, tipo, parent_id
    - UpdateNodeRequest con validación de campos modificables
    - Validar longitud de nombre (1-255 caracteres)
    - Validar tipos de nodo permitidos
    - _Requisitos: 8.4, 8.5_

  - [ ]* 9.2 Escribir property tests para validación
    - **Property 18: Validación de valores numéricos**
    - **Valida: Requisitos 8.1, 8.2**
    - **Property 19: Precisión decimal de valores**
    - **Valida: Requisitos 8.3**
    - **Property 20: Validación de nombres no vacíos**
    - **Valida: Requisitos 8.4**
    - **Property 21: Límite de longitud de nombres**
    - **Valida: Requisitos 8.5**

  - [~] 9.3 Crear validación custom para unidades reconocidas
    - Definir lista de unidades válidas del sistema
    - Crear regla de validación custom ValidUnit
    - _Requisitos: 8.6_

  - [ ]* 9.4 Escribir property test para validación de unidades
    - **Property 22: Validación de unidades reconocidas**
    - **Valida: Requisitos 8.6**


- [~] 10. Implementar MetradoSanitariasController con endpoints API
  - [~] 10.1 Crear controlador con métodos para operaciones de árbol
    - Implementar index() para GET /tree que retorna árbol completo
    - Implementar store() para POST /nodes que crea nodo
    - Implementar update() para PUT /nodes/{node} que actualiza nodo
    - Implementar destroy() para DELETE /nodes/{node} que elimina nodo
    - Implementar move() para POST /nodes/{node}/move que mueve nodo
    - Implementar duplicate() para POST /nodes/{node}/duplicate que duplica nodo
    - _Requisitos: 1.1, 1.2, 1.3, 2.5, 10.3_

  - [~] 10.2 Implementar endpoint para resumen dinámico
    - Implementar summary() para GET /summary que retorna resumen consolidado
    - _Requisitos: 6.1, 6.2_

  - [~] 10.3 Agregar manejo de errores y transacciones
    - Envolver operaciones complejas en transacciones DB
    - Implementar try-catch con logging descriptivo
    - Retornar respuestas HTTP apropiadas (200, 201, 422, 500)
    - _Requisitos: 1.5_

  - [ ]* 10.4 Escribir property test para round-trip completo
    - **Property 4: Round-trip de estructura de árbol**
    - **Valida: Requisitos 1.4, 7.4, 7.5**
    - **Property 5: Manejo de errores de sincronización**
    - **Valida: Requisitos 1.5**

  - [ ]* 10.5 Escribir integration tests para endpoints
    - Test de creación de nodo con respuesta 201
    - Test de actualización con respuesta 200
    - Test de eliminación con cascada
    - Test de validación con respuesta 422
    - _Requisitos: API_

- [~] 11. Implementar broadcasting en tiempo real
  - [~] 11.1 Crear eventos de broadcasting para cambios en árbol
    - Crear evento MetradoSanitariasNodeCreated
    - Crear evento MetradoSanitariasNodeUpdated
    - Crear evento MetradoSanitariasNodeDeleted
    - Crear evento MetradoSanitariasNodeMoved
    - Configurar canales privados por proyecto
    - _Requisitos: 9.3, 12.4_

  - [~] 11.2 Disparar eventos desde TreeService
    - Emitir evento después de cada operación exitosa
    - Incluir datos del nodo afectado y nodos relacionados
    - _Requisitos: 9.3_

  - [ ]* 11.3 Escribir unit tests para eventos de broadcasting
    - Test que verifica que eventos se disparan
    - Test que verifica datos incluidos en eventos
    - _Requisitos: 12.4_

- [~] 12. Checkpoint - Verificar backend completo
  - Ejecutar todos los tests backend (unit + property + integration)
  - Verificar que todos los endpoints respondan correctamente
  - Verificar que broadcasting funcione
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [~] 13. Implementar interfaces TypeScript para frontend
  - [~] 13.1 Crear tipos TypeScript para modelos de datos
    - Definir enum NodeType con valores titulo, subtitulo, partida
    - Definir interface TreeNode con todos los campos
    - Definir interface Module
    - Definir interface SummaryRow
    - Definir interface TreeOperationResult
    - _Requisitos: Frontend_

  - [~] 13.2 Crear tipos para props de componentes
    - Definir interfaces para props de cada componente React
    - Definir tipos para callbacks y handlers
    - _Requisitos: Frontend_


- [~] 14. Implementar componente TreeNode recursivo
  - [~] 14.1 Crear componente TreeNode con renderizado condicional
    - Renderizar icono y nombre según tipo de nodo
    - Mostrar numeración para títulos y subtítulos
    - Mostrar unidad heredada para partidas
    - Implementar botón de expandir/colapsar
    - Renderizar hijos recursivamente cuando está expandido
    - _Requisitos: 2.1, 3.6, 4.4, 10.1, 10.2_

  - [~] 14.2 Implementar interacciones de usuario en TreeNode
    - Implementar onClick para seleccionar nodo
    - Implementar onDoubleClick para editar nombre inline
    - Implementar botones para agregar hijo, eliminar, duplicar
    - Validar que partidas no puedan tener hijos
    - _Requisitos: 2.4, 10.3_

  - [ ]* 14.3 Escribir tests de componente para TreeNode
    - Test de renderizado de cada tipo de nodo
    - Test de interacciones (click, expand, edit)
    - Test de validación de hijos
    - _Requisitos: Frontend_

- [~] 15. Implementar componente ModuleColumns para valores dinámicos
  - [~] 15.1 Crear componente ModuleColumns con columnas dinámicas
    - Renderizar una columna input por cada módulo
    - Renderizar columnas para Exterior y Cisterna
    - Renderizar columna Total (calculada, readonly)
    - Aplicar estilos según tipo de nodo (readonly para títulos/subtítulos)
    - _Requisitos: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [~] 15.2 Implementar validación y cálculo de totales
    - Validar que inputs sean numéricos con máximo 2 decimales
    - Calcular Total = suma de módulos + Exterior + Cisterna
    - Mostrar mensajes de error para valores inválidos
    - Implementar debounce para actualización al backend
    - _Requisitos: 8.1, 8.2, 8.3_

  - [ ]* 15.3 Escribir property test para cálculo de totales
    - **Property 13: Eliminación de módulo actualiza totales**
    - **Valida: Requisitos 5.4**

  - [ ]* 15.4 Escribir tests de componente para ModuleColumns
    - Test de renderizado de columnas dinámicas
    - Test de validación de inputs
    - Test de cálculo de totales
    - _Requisitos: Frontend_

- [~] 16. Implementar componente MetradosTreeView principal
  - [~] 16.1 Crear componente MetradosTreeView con gestión de estado
    - Inicializar estado con árbol recibido de backend
    - Gestionar estado de nodos expandidos (Set de IDs)
    - Gestionar nodo seleccionado actualmente
    - Implementar flags de isDirty e isSaving
    - _Requisitos: 9.1, 10.7_

  - [~] 16.2 Implementar operaciones CRUD que llaman al backend
    - Implementar handleCreateNode() que llama POST /nodes
    - Implementar handleUpdateNode() que llama PUT /nodes/{node}
    - Implementar handleDeleteNode() que llama DELETE /nodes/{node}
    - Implementar handleMoveNode() que llama POST /nodes/{node}/move
    - Implementar handleDuplicateNode() que llama POST /nodes/{node}/duplicate
    - Usar actualización optimista para mejor UX
    - _Requisitos: 1.1, 1.2, 1.3, 9.4_

  - [~] 16.3 Implementar sincronización con WebSocket
    - Conectar a canal privado del proyecto
    - Escuchar eventos de broadcasting
    - Actualizar estado local cuando otros usuarios hacen cambios
    - Mostrar indicadores visuales de sincronización
    - _Requisitos: 9.3_

  - [~] 16.4 Implementar persistencia de estado de expansión
    - Guardar estado de nodos expandidos en backend al cambiar
    - Recuperar estado guardado al cargar componente
    - _Requisitos: 10.7_

  - [ ]* 16.5 Escribir property test para persistencia de estado
    - **Property 25: Persistencia de estado de expansión por usuario**
    - **Valida: Requisitos 10.7**

  - [ ]* 16.6 Escribir integration tests para MetradosTreeView
    - Test de flujo completo: crear, editar, eliminar nodo
    - Test de sincronización con múltiples clientes simulados
    - Test de manejo de errores de red
    - _Requisitos: Frontend_

