# Fase 0 — especificación y benchmarks de Mantenimiento

> **Estado:** parcialmente completada el 10/09/2026. La especificación basada en el reporte está cerrada; falta el `.xlsx` original para certificar fórmulas, valores evaluados, formatos y casos dorados.

## Inventario verificable disponible

| Concepto | Resultado del reporte |
|---|---:|
| Hojas | 10 |
| Celdas con fórmula | 1,812 |
| Celdas literales candidatas a entrada | 5,096 |
| Referencias rotas `#REF!` | 21 |
| Familias | Materiales, mano de obra, gastos generales, plazo/avance y resumen |

Las hojas inventariadas son `MAT`, `MAT (2)`, `Copia de MAT (2)`, `MO`, `MO 1.`, `GG`, `Copia de GG`, `CRONOGRAMA`, `PORCENTAJE` y `RESUMEN`. Las copias se tratarán como hojas independientes hasta validar con el archivo original si representan versiones, escenarios o respaldos.

## Contrato de entrada desde Presupuesto

La importación se implementará en la Fase 4 y será de solo lectura. La fuente será `presupuesto_general`, `presupuesto_acus` y las tablas `acu_mano_de_obra`, `acu_materiales`, `acu_equipos`, `acu_subcontratos` y `acu_subpartidas` de la misma base tenant del proyecto.

Regla invariable: un detalle ACU solo es elegible cuando el `parcial` almacenado es decimal, no nulo y estrictamente mayor que cero antes de cualquier redondeo. El fixture [presupuesto_acu_parciales.json](presupuesto_acu_parciales.json) fija los casos límite.

## Decisiones de arranque para el núcleo

- Límite inicial de diseño: 20 hojas, 10,000 filas por hoja y 100 columnas; se revisará con el `.xlsx` y telemetría real.
- Orden de filas y columnas con saltos de 1,024 e identidad ULID independiente de la posición.
- Papelera mediante soft delete; la retención y purga definitiva quedan para una fase posterior.
- Tipos del primer corte: `text`, `decimal`, `money` y `date`.
- Importes oficiales como céntimos enteros; cantidades y decimales como cadenas/`DECIMAL`, nunca `float`.
- Moneda inicial `PEN`. La regla oficial de redondeo continúa pendiente de validación funcional y no se anticipa en la Fase 1.
- La experiencia móvil prioriza consulta y captura de valores; la edición estructural se conserva mediante desplazamiento horizontal.

## Presupuesto de rendimiento objetivo

| Operación | Escritorio | Móvil/tablet |
|---|---:|---:|
| Respuesta visual al editar | ≤ 50 ms | ≤ 100 ms |
| Agregar o mover fila/columna | ≤ 150 ms | ≤ 250 ms |
| Persistencia API p95 en red local | ≤ 500 ms | ≤ 800 ms |
| Apertura de hoja inicial | ≤ 1.5 s | ≤ 2.5 s |

Estos objetivos son puertas de prueba, no mediciones logradas. La virtualización y paginación se decidirán al probar tamaños reales.

## Pendientes que bloquean el cierre total

1. Incorporar el `.xlsx` original o una exportación completa con resultados evaluados.
2. Confirmar el significado de las constantes y de las 21 referencias rotas.
3. Aprobar el mapeo de equipos, subcontratos y subpartidas a hojas visibles.
4. Confirmar política de redondeo, jerarquías, retención, roles y significado de las copias.
5. Ejecutar benchmarks con el tamaño real del libro y registrar resultados.

Hasta resolverlos no se declarará equivalencia con Excel. Esto no bloquea el editor autónomo de la Fase 1.
