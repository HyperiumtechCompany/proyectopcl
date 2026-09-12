# Fase 3 — Motor de fórmulas y dinero

## Contrato implementado

- Operadores: `+`, `-`, `*`, `/`, `%` y comparaciones.
- Funciones: `SUM`, `MIN`, `MAX`, `ROUND`, `IF`, `CELL`, `SUM_CHILDREN` y `SUM_COLUMN`.
- Referencia de la misma fila: `{clave_columna}`.
- Referencia estable: `CELL("ULID_CELDA")`.
- Agregados estructurales: `SUM_CHILDREN({clave})` y `SUM_COLUMN("ULID_HOJA", {clave})`.
- Toda fórmula se normaliza con `=` inicial y se analiza mediante tokens y AST; no se ejecuta código dinámico.

Ejemplo: `={cantidad}*{importe}`.

## Exactitud monetaria v1

- Los importes ingresados se conservan en céntimos enteros.
- El motor calcula con 10 decimales internos.
- El resultado de una columna `formula` cierra a dos decimales con redondeo `HALF_UP`.
- Los repartos de céntimos usan mayor resto; los empates respetan el orden estable de entrada.
- La API intercambia valores decimales como texto, nunca como `float`.

## Recálculo y errores

El backend guarda coordenadas de dependencia por IDs internos y recorre el grafo inverso desde la celda editada. Ordena las fórmulas afectadas topológicamente y devuelve en el mismo ACK tanto la entrada confirmada como cada resultado dependiente. Los cambios de filas o columnas reconstruyen las dependencias de agregados estructurales.

Errores visibles por celda: `PARSE_ERROR`, `REFERENCE_ERROR`, `DEPENDENCY_ERROR`, `TYPE_ERROR`, `ARGUMENT_ERROR`, `NAME_ERROR`, `DIV_ZERO` y `CYCLE_ERROR`. El valor calculado, explicación y error quedan persistidos para que una recarga no borre el estado.

## Puerta de salida

La conformidad PHP/TypeScript se verifica con `tests/Fixtures/Mantenimiento/formula_conformance.json`. El Worker queda condicionado al benchmark con libros reales: el flujo normal ya recalcula incrementalmente y evita reinicializar el documento.
