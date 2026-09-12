# Fase 4 — Importación unidireccional desde Presupuesto

## Flujo implementado

1. El preview lee el presupuesto principal, partidas, ACU y las cinco tablas relacionales del tenant sin escribir datos.
2. Los recursos se incluyen si y solo si el `parcial` almacenado es no nulo y estrictamente mayor a cero antes de cualquier redondeo.
3. El servidor calcula un SHA-256 determinista y presenta conteos incluidos, excluidos, faltantes, ambiguos y el diff contra la última importación.
4. La confirmación recalcula el origen dentro de una transacción. Si el hash cambió, obliga a obtener un nuevo preview.
5. Se crean snapshots de recuperación antes y después, una cabecera de importación y sus ítems normalizados.
6. El contenido se materializa en hojas autónomas de Mantenimiento. No existen consultas vivas después de importar.

## Protección e idempotencia

- `source_hash` impide duplicar la misma versión del presupuesto.
- `idempotency_key` hace seguro reintentar la confirmación.
- Una actualización compara cada fila administrada con los últimos valores importados. Si el usuario la modificó, se registra como conflicto y no se sobrescribe.
- Los elementos retirados del origen se contabilizan, pero no se borran automáticamente de Mantenimiento.
- Las tablas de Presupuesto son de solo lectura para este flujo.

## Hojas de destino

| Origen | Hoja |
|---|---|
| `presupuesto_general` | Presupuesto |
| `presupuesto_acus` | ACU |
| `acu_mano_de_obra` | MO |
| `acu_materiales` | MAT |
| `acu_equipos` | EQ |
| `acu_subcontratos` | SC |
| `acu_subpartidas` | SP |

El snapshot conserva la precisión decimal original. Las columnas monetarias visibles aplican la política de Fase 3 (`HALF_UP` a céntimos), por lo que incluso un parcial positivo menor a un céntimo queda registrado en auditoría aunque se muestre como `0.00`.
