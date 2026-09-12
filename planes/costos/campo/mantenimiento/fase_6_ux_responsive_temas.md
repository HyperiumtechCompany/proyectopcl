# Fase 6 — UX profesional, responsive y temas

## Resultado

El editor funciona como una grilla operativa sin sacrificar el modelo persistente de las fases anteriores. La interacción visual vive en hooks y utilidades independientes; los cambios de datos continúan pasando por el store y la cola de autoguardado.

## Capacidades implementadas

- Virtualización vertical con medición de filas y overscan para libros extensos.
- Selección de una celda o rango rectangular con `Shift`.
- Navegación con flechas, `Tab`, `Shift+Tab` y `Enter`.
- Copia de rangos en TSV con `Ctrl/Cmd+C`, conservando fórmulas como fórmulas.
- Pegado de matrices mediante la operación transaccional del backend.
- Undo/redo de ediciones y pegados con `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y` y botones visibles.
- Agrupación de escritura continua en una misma celda para evitar un historial por carácter.
- Historial limitado a 100 acciones para controlar el uso de memoria.
- Cabecera y columna estructural fijas, controles adaptativos y desplazamiento táctil contenido.
- Indicador accesible de número de celdas seleccionadas y suma numérica del rango.
- Tema claro, oscuro y sistema persistido en `localStorage` y cookie.

## Alcance de undo/redo

El historial inmediato cubre valores, fórmulas y pegados masivos. Los cambios estructurales —eliminar, mover, duplicar o jerarquizar— permanecen protegidos por confirmaciones, autoguardado y snapshots; su restauración granular se abordará junto con la auditoría de la fase 8.

## Responsive

- Escritorio: controles estructurales completos y ayudas de teclado.
- Tablet: grilla desplazable con jerarquía fija y controles esenciales.
- Móvil: barra superior compacta, acciones envueltas, columna estructural reducida y controles secundarios ocultos sin bloquear edición, guardado o eliminación.

## Verificación de cierre

- Pruebas unitarias de rango, navegación, copiado TSV y reversión de pegado.
- Validación TypeScript y ESLint focalizada.
- Pruebas frontend del módulo.
- Build de producción.

La restauración estructural auditada y las pruebas de carga con el `.xlsx` definitivo siguen condicionadas por las fases 0 y 8.
