# plan_compatibilidad_mejorado_lector_dwg.md

# Plan de compatibilidad mejorado para lector DWG/DXF Web CAD

## 1. Objetivo general

Mejorar el sistema actual de visualización CAD para soportar archivos DWG/DXF de gran tamaño sin pérdida de entidades, con renderizado fluido, zoom ilimitado, navegación eficiente y capacidad de dibujar sobre el plano.

El sistema debe evolucionar desde un visor CAD tradicional hacia una arquitectura CAD Web profesional basada en:

- Procesamiento CAD optimizado.
- Renderizado WebGL.
- Carga parcial por zonas.
- Índices espaciales.
- Compatibilidad progresiva con DWG/DXF.
- Edición y anotación sobre planos.

---

# 2. Estado actual del proyecto

Stack actual:

Frontend:

- React
- Vite
- Babylon.js
- CAD Viewer

Backend:

- Laravel

Procesamiento adicional:

- Rust
- Posible implementación WebAssembly

Problemas actuales:

## Problema 1: pérdida de objetos

Al cargar planos DWG/DXF:

- desaparecen bloques.
- faltan entidades.
- algunos objetos no son renderizados.
- problemas con planos complejos.

Posibles causas:

- entidades DWG no soportadas.
- proxy objects.
- blocks anidados.
- hatch complejos.
- XREF.
- splines.
- textos avanzados.
- objetos propietarios de AutoCAD.

---

## Problema 2: lentitud

Actualmente:

```
DWG/DXF
    |
CAD Viewer
    |
Miles de entidades
    |
Render completo
    |
Bloqueo navegador
```

Debe cambiarse a:

```
DWG/DXF
      |
Procesador CAD
      |
Índice espacial
      |
Carga parcial
      |
WebGL Renderer
      |
React UI
```

---

# 3. Arquitectura objetivo

## Arquitectura general propuesta

```
                 DWG / DXF
                     |
                     |
             CAD Processing Layer
                     |
        ----------------------------
        |                          |
   Conversión CAD              Metadata
        |
        |
 Geometría optimizada
        |
 Spatial Index (R-Tree)
        |
        |
 -------------------------------
 |                             |
2D Renderer                3D Renderer
PixiJS/WebGL              Babylon.js
 |
React Interface
```

---

# 4. Componentes recomendados

## 4.1 Procesador CAD

Responsabilidad:

- leer DWG/DXF.
- extraer entidades.
- normalizar geometría.
- conservar capas.
- conservar bloques.
- generar representación optimizada.

Tecnologías posibles:

### Opción principal

OpenCascade:

Funciones:

- kernel geométrico.
- conversión CAD.
- triangulación.
- manejo de geometría compleja.

---

### DXF

Usar:

ezdxf

Responsabilidades:

- lectura DXF.
- extracción de entidades.
- análisis de layers.
- bloques.
- atributos.

---

### DWG

Implementar una capa de conversión:

```
DWG
 |
LibreDWG / ODA Converter
 |
DXF normalizado
 |
Parser interno
```

---

# 5. Nuevo formato interno CAD

No trabajar directamente sobre DWG/DXF durante el render.

Crear formato interno:

Ejemplo:

```json
{
 "drawing":{
   "units":"mm",
   "width":10000,
   "height":8000
 },

 "layers":[
   {
    "name":"MUROS",
    "visible":true,
    "entities":[]
   }
 ],

 "blocks":[],
 "texts":[],
 "dimensions":[]
}
```

Ventajas:

- carga rápida.
- cache.
- edición.
- sincronización.
- colaboración futura.

---

# 6. Sistema de carga inteligente

Implementar carga por regiones.

Ejemplo:

Plano:

```
+-------+-------+-------+
|  A1   |  A2   |  A3   |
+-------+-------+-------+
|  B1   |  B2   |  B3   |
+-------+-------+-------+
```

Solo cargar:

- zona visible.
- capas activas.
- nivel de detalle requerido.

---

Implementar:

- R-tree spatial index.
- QuadTree.
- Bounding boxes.

Cada entidad debe tener:

```json
{
"type":"LINE",
"bounds":{
"x1":0,
"y1":0,
"x2":100,
"y2":100
}
}
```

---

# 7. Motor gráfico

## Render 2D

Evaluar:

PixiJS + WebGL

Uso:

- planos arquitectónicos.
- líneas.
- textos.
- capas.
- selección.
- snapping.

Ventajas:

- GPU.
- miles/millones de primitivas.
- zoom fluido.

---

## Render 3D

Mantener:

Babylon.js

Uso:

- extrusión.
- modelos 3D.
- visualización BIM.
- recorridos.

---

# 8. Integración Rust + WebAssembly

Usar Rust para:

- geometría.
- snapping.
- cálculos.
- detección de intersecciones.
- mediciones.

Arquitectura:

```
React
 |
WASM Module
 |
Rust Geometry Engine
 |
CAD Data
```

---

Funciones iniciales:

## Snap

- endpoint.
- midpoint.
- intersection.
- nearest point.

## Geometría

- distancia.
- área.
- perímetro.
- offset.
- unión.

---

# 9. Herramientas CAD requeridas

El sistema debe soportar:

## Visualización

- zoom.
- pan.
- selección.
- ocultar capas.
- cambiar colores.
- transparencia.
- búsqueda de objetos.

## Edición

Primera etapa:

- dibujar línea.
- dibujar polilínea.
- dibujar círculo.
- texto.
- cotas.

Segunda etapa:

- mover.
- copiar.
- borrar.
- modificar propiedades.

---

# 10. Estrategia de implementación

## Fase 1 - Diagnóstico

Objetivo:

Identificar pérdida de objetos.

Crear herramienta:

```
DWG/DXF Analyzer
```

Debe reportar:

- cantidad de entidades.
- tipos encontrados.
- entidades no soportadas.
- capas.
- bloques.

---

## Fase 2 - Nuevo pipeline DXF

Implementar:

```
DXF
 |
ezdxf
 |
JSON CAD interno
 |
Render WebGL
```

Validar:

- 100% entidades visibles.
- comparación contra AutoCAD.

---

## Fase 3 - DWG

Implementar:

```
DWG
 |
Conversor
 |
DXF
 |
Pipeline interno
```

---

## Fase 4 - Optimización

Agregar:

- spatial index.
- streaming.
- workers.
- cache.
- compresión.

---

## Fase 5 - Edición CAD

Agregar:

- herramientas dibujo.
- snapping.
- historial.
- undo/redo.

---

# 11. Requisitos de rendimiento

Objetivos:

## Archivo pequeño

< 20 MB

Carga:

< 3 segundos

---

## Archivo medio

20 MB - 200 MB

Carga inicial:

< 10 segundos

Render:

60 FPS

---

## Archivo grande

> 200 MB

Debe funcionar mediante:

- carga parcial.
- streaming.
- tiles.

Nunca cargar todo en memoria.

---

# 12. Pruebas necesarias

Crear batería de planos:

## Arquitectura

- viviendas.
- edificios.
- instalaciones.

## Casos extremos

- muchos bloques.
- muchos hatch.
- muchas capas.
- referencias externas.
- textos.
- cotas.

Comparar:

AutoCAD/DraftSight/DIALux

contra:

Nuevo visor Web CAD.

---

# 13. Resultado esperado

El sistema final debe:

✅ Leer DWG/DXF sin pérdida significativa.  
✅ Renderizar planos grandes.  
✅ Mantener fluidez con zoom/pan.  
✅ Permitir dibujo sobre plano.  
✅ Mantener capas y propiedades.  
✅ Preparar base para BIM.  
✅ Aprovechar GPU WebGL.  
✅ Integrarse con React/Laravel/Rust existente.

---

# Prioridad recomendada

Orden de desarrollo:

1. Crear analizador DWG/DXF.
2. Crear formato CAD interno.
3. Implementar renderer WebGL 2D.
4. Implementar carga por tiles.
5. Integrar Rust WASM.
6. Añadir edición CAD.
7. Añadir soporte 3D/BIM.

```
Objetivo final:

Un motor CAD Web propio,
similar en concepto a DIALux/AutoCAD Web,
pero optimizado para navegador.
```