# Fase 5 — Estructura avanzada de hojas

## Resultado

La estructura dejó de depender de coordenadas de Excel. Hojas, filas, columnas y celdas conservan referencias mediante ULID; las relaciones padre/hijo usan esos identificadores en el contrato del editor y claves semánticas en las fórmulas.

## Capacidades implementadas

- Jerarquía persistente de filas, sangría, grupos contraíbles y protección contra ciclos.
- Filas de subtotal con `SUM_CHILDREN({clave})` en las columnas calculadas.
- Duplicación de filas y hojas con nuevos ULID y remapeo de referencias `CELL(...)` internas.
- Pegado de matrices TSV en una transacción, hasta 10 000 celdas y sin extender silenciosamente los límites de la hoja.
- Plantillas iniciales `MAT`, `MO`, `GG`, `CRONOGRAMA`, `PORCENTAJE` y `RESUMEN`.
- Comparación de hojas por claves semánticas, estructura y valores, limitada a 500 diferencias por respuesta.
- Actualización localizada del store después de una operación estructural, sin recargar ni resetear el editor.

## Reglas de integridad

- Un padre debe pertenecer a la misma hoja.
- Una fila no puede ser padre de sí misma ni depender de uno de sus descendientes.
- El pegado completo se confirma o revierte; un valor inválido no deja cambios parciales.
- Los importes continúan almacenándose en céntimos enteros.
- Una copia no conserva metadatos que la hagan pasar por una fila u hoja administrada por la importación de Presupuesto.
- Las referencias externas a otras hojas permanecen apuntando al origen; solo se remapean referencias internas de la copia.

## Verificación de cierre

- Pruebas de jerarquía, ciclos y subtotal.
- Prueba de duplicación y remapeo de referencias estables.
- Prueba de pegado atómico y conservación de céntimos.
- Prueba de plantillas y comparación semántica.
- Compilación TypeScript, pruebas del módulo y build de producción.

La selección avanzada, atajos completos, undo/redo y virtualización pertenecen a la fase 6.
