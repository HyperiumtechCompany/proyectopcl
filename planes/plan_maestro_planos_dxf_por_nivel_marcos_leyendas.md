# Plan maestro para planos DXF por nivel, con marcos y leyendas por especialidad

## 1. Propósito

Este documento guía la evolución del exportador DXF del módulo DIALux para generar planos eléctricos ordenados como láminas técnicas.

El resultado debe organizar cada nivel del proyecto en dos planos independientes:

1. Plano de alumbrado.
2. Plano de tomacorrientes.

Cada plano debe quedar dentro de su propio marco, identificado por nivel, con una leyenda específica que contenga únicamente los símbolos realmente utilizados en ese plano.

El plan está diseñado para el stack existente: React 19, TypeScript, Laravel 12 e Inertia v2. La generación geométrica continuará en TypeScript y la descarga seguirá siendo local mientras no exista una necesidad comprobada de persistencia o generación en servidor.

## 2. Resultado funcional esperado

Para un proyecto de tres pisos, la exportación predeterminada debe producir seis láminas dentro del DXF:

```text
Nivel 1 — Alumbrado
Nivel 1 — Tomacorrientes
Nivel 2 — Alumbrado
Nivel 2 — Tomacorrientes
Nivel 3 — Alumbrado
Nivel 3 — Tomacorrientes
```

Cada lámina debe incluir:

- Marco exterior e interior.
- Área útil claramente delimitada.
- Plano arquitectónico correspondiente al nivel.
- Entidades eléctricas de una sola especialidad.
- Leyenda filtrada por elementos usados.
- Nombre del proyecto.
- Nombre y número del nivel.
- Nombre de la especialidad.
- Escala de impresión.
- Unidades.
- Fecha de exportación.
- Número de lámina.
- Revisión opcional.

No se debe duplicar manualmente la lógica por piso ni por especialidad. Una misma factoría de láminas debe recibir el nivel y la disciplina como datos.

## 3. Diagnóstico del exportador actual

### 3.1. Capacidades que ya existen

El archivo `resources/js/pages/dialux/export/dxf/buildDialuxDxfExport.ts` ya genera DXF AC1009/AutoCAD R12 con:

- Secciones `HEADER`, `TABLES`, `BLOCKS`, `ENTITIES` y `EOF`.
- Entidades `LINE`, `CIRCLE`, `ARC`, `SOLID`, `TEXT`, `BLOCK` e `INSERT`.
- Plano arquitectónico agrupado en un bloque llamado `PLANO_BASE`.
- Geometría de recintos, muros, ventanas, puertas y coberturas.
- Luminarias.
- Interruptores.
- Tomacorrientes y otros dispositivos eléctricos.
- Conductores curvos o rectos.
- Cajas de paso.
- Capas por tipo de elemento.
- Una leyenda eléctrica básica.
- Descarga local mediante `useDialuxDxfExport.ts`.

También existe una fuente común de símbolos en `resources/js/pages/dialux/electrical/electricalLegend.ts` y una prueba específica de leyenda.

### 3.2. Limitaciones actuales

#### Un único plano base

El exportador define un solo bloque:

```text
PLANO_BASE
```

Esto permite exportar correctamente una planta, pero no distinguir varios niveles dentro del mismo archivo.

#### El DXF usa principalmente la escena activa

El snapshot conserva `scene` como escena activa. Aunque el builder documental puede recopilar ambientes de todas las escenas, el constructor DXF toma conductores, interruptores, dispositivos y cajas desde `snapshot.scene`.

Consecuencia: activar `includeAllScenes` por sí solo no produciría planos completos por nivel.

#### El plano CAD importado es global

Actualmente `dxfEntities` y `dxfExtents` están en el estado global del editor, no dentro de cada `Scene`.

Antes de exportar varios niveles se debe definir cuál de estos casos representa el proyecto:

- Un único DXF contiene todos los niveles en zonas diferentes.
- El mismo fondo arquitectónico se reutiliza en todos los niveles.
- Cada nivel posee su propio DXF/DWG.
- Algunos niveles se dibujaron dentro del editor y no tienen DXF importado.

Sin esta definición, el sistema podría repetir el fondo del nivel activo en todos los pisos.

#### Una sola leyenda mezclada

La función actual `usedElectricalLegendItems` combina:

- Luminarias.
- Alumbrado de emergencia.
- Interruptores.
- Tomacorrientes.
- Tableros.
- Conductores.

La salida es una sola `LEYENDA ELECTRICA`, ubicada a la derecha de la extensión del plano.

#### Sin marco ni cajetín

El plano se exporta en coordenadas reales, con la leyenda al costado, pero sin:

- Tamaño de lámina.
- Escala de impresión.
- Área útil.
- Marco.
- Cajetín.
- Numeración de láminas.
- Distribución de varios pisos.

#### Extensión global incompleta

El `HEADER` calcula `EXTMIN`/`EXTMAX` con plano y leyenda actuales. Al incorporar múltiples láminas debe calcular la unión de todos los marcos, cajetines y entidades trasladadas.

### 3.3. Conclusión técnica

El problema no se resuelve agregando dos rectángulos alrededor de la salida actual. Se requiere introducir un modelo intermedio de láminas, separar los datos por nivel y disciplina, calcular la escala, trasladar cada composición a una zona sin superposición y recién después emitir el DXF.

## 4. Decisión de alcance

### 4.1. Salida predeterminada

Un solo archivo DXF contendrá todas las láminas ordenadas en Model Space.

Motivos:

- Conserva la compatibilidad AC1009/AutoCAD R12 actual.
- No depende de `LAYOUT`, `PAPER_SPACE` ni `VIEWPORT`, que complicarían la compatibilidad con lectores antiguos.
- Permite abrir, editar, copiar e imprimir cada cuadro desde cualquier herramienta CAD compatible.
- Evita agregar librerías.

### 4.2. Organización predeterminada

Por cada nivel:

```text
┌────────────────────────┐  ┌────────────────────────┐
│ NIVEL N — ALUMBRADO    │  │ NIVEL N — TOMACORRIENTES│
│ plano + leyenda        │  │ plano + leyenda         │
└────────────────────────┘  └────────────────────────┘
```

Los pares se colocan por filas y los niveles avanzan verticalmente. El orden debe ser estable:

- Sótanos, del más bajo al más próximo a cero.
- Planta baja.
- Pisos superiores.
- En un mismo nivel: alumbrado primero, tomacorrientes después.

### 4.3. Salidas futuras opcionales

El diseño interno debe permitir, sin implementarlo en la primera entrega:

- Un DXF por nivel.
- Un DXF por especialidad.
- Un DXF por lámina.
- Layouts/Paper Space en una versión DXF más moderna.

La primera fase no debe cambiar de AC1009 ni ampliar formatos sin necesidad.

## 5. Definición de especialidades

## 5.1. Plano de alumbrado

Debe contener:

- Fondo arquitectónico del nivel.
- Recintos y textos arquitectónicos configurados como visibles.
- Luminarias normales.
- Luminarias de emergencia.
- Interruptores simples, dobles, triples y conmutados.
- Cajas de paso asociadas a alumbrado, cuando pueda determinarse.
- Conductores que pertenezcan a circuitos de alumbrado.
- Etiquetas de luminarias, interruptores y circuitos de alumbrado.
- Opcionalmente tableros que alimentan esos circuitos.

No debe contener tomacorrientes ni sus rutas, salvo que una opción explícita de coordinación los habilite.

## 5.2. Plano de tomacorrientes

Debe contener:

- Fondo arquitectónico del nivel.
- Recintos y textos arquitectónicos configurados como visibles.
- Tomacorrientes bajos.
- Tomacorrientes altos.
- Tomacorrientes iniciales.
- Tomacorrientes de techo.
- Tomacorrientes de piso.
- Tomacorrientes waterproof.
- Tomas para rack/comunicaciones cuando se incluyan en esta especialidad.
- Equipos de conexión especial, como terma, cuando correspondan al circuito.
- Cajas de paso asociadas.
- Conductores que pertenezcan a circuitos de tomacorrientes.
- Tableros y medidores relevantes.
- Etiquetas de dispositivos y circuitos.

No debe contener luminarias ni interruptores de iluminación.

## 5.3. Clasificación de conductores

Hoy un `Conductor` conecta IDs, pero la clasificación de especialidad no debe inferirse por color o por el texto de la etiqueta.

Orden de resolución recomendado:

1. Tipo de circuito persistido: `lighting`, `outlets` u otro.
2. Dispositivo de origen/destino perteneciente inequívocamente a una especialidad.
3. Grupo/circuito eléctrico asociado.
4. Estado `unclassified` si no puede determinarse.

Los conductores `unclassified` deben producir una advertencia y quedar fuera por defecto o incluirse en una capa de revisión, según configuración.

## 6. Modelo intermedio de láminas

El builder no debe trabajar directamente desde un snapshot plano. Debe convertir el proyecto en un manifiesto de exportación.

```ts
type DxfDiscipline = 'lighting' | 'outlets';

interface DxfDrawingPackage {
    version: '2.0.0';
    projectId: string;
    projectName: string;
    units: 'm';
    sheetConfig: DxfSheetConfig;
    levels: DxfLevelPackage[];
    sheets: DxfSheet[];
    warnings: DxfExportWarning[];
}

interface DxfLevelPackage {
    sceneId: string;
    floorIndex: number;
    floorElevation: number;
    floorHeight: number;
    name: string;
    basePlan: DxfLevelBasePlan;
    architecture: DxfArchitectureEntities;
    electrical: DxfElectricalEntities;
    bounds: DxfBounds;
}

interface DxfSheet {
    id: string;
    number: string;
    levelId: string;
    discipline: DxfDiscipline;
    title: string;
    scale: number;
    paper: DxfPaperSize;
    frameBounds: DxfBounds;
    planViewportBounds: DxfBounds;
    legendBounds: DxfBounds;
    titleBlockBounds: DxfBounds;
    insertion: DxfPoint;
    legendItems: DxfLegendRow[];
}
```

### 6.1. Fuente por nivel

Cada `DxfLevelPackage` debe tomar sus elementos desde su propia `Scene`:

- `rooms`.
- `walls`.
- `windows`.
- `doors`.
- `canopies`.
- `fixtures`.
- `lightSwitches`.
- `electricalDevices`.
- `conductors`.
- `junctionBoxes`.
- `scaleConfig`.

No usar los arreglos agregados del informe PDF para emitir DXF, porque al aplanarlos se pierde la pertenencia a nivel.

### 6.2. Fondo CAD por nivel

Introducir una referencia explícita:

```ts
interface DxfLevelBasePlan {
    source: 'shared' | 'scene' | 'drawn-only' | 'none';
    entities: DxfEntity[];
    extents: DxfExtents | null;
    scaleConfig: ScaleConfig;
}
```

Política inicial:

- Si el proyecto solo tiene un nivel, usar el comportamiento actual.
- Si tiene varios niveles y solo existe un fondo global, pedir o aplicar una opción explícita: compartir fondo, usar solo en nivel activo o exportar geometría dibujada sin fondo.
- No asumir silenciosamente que el mismo DXF sirve para todos los pisos.
- A futuro, persistir `dxfEntities`/referencia del archivo y `dxfExtents` por escena.

## 7. Tamaño de lámina, escala y unidades

### 7.1. Configuración inicial recomendada

- Formato predeterminado: A1 horizontal.
- Escalas permitidas inicialmente: 1:25, 1:50, 1:75, 1:100, 1:125, 1:150 y 1:200.
- Escala predeterminada: automática, eligiendo la mayor escala normalizada que permita encajar el plano.
- Unidades de geometría: metros.
- Separación entre láminas: configurable, basada en el tamaño del marco en Model Space.

No fijar A1 ni 1:50 dentro de funciones geométricas; deben ser opciones.

### 7.2. Conversión papel → Model Space

Como el contenido está en metros y el marco se dibuja en Model Space:

```text
longitud_modelo_m = longitud_papel_mm × denominador_escala / 1000
```

Ejemplo A1 horizontal a 1:50:

```text
ancho del marco = 841 mm × 50 / 1000 = 42.05 m
alto del marco  = 594 mm × 50 / 1000 = 29.70 m
```

Los textos deben conservar altura de papel:

```text
altura_texto_modelo_m = altura_texto_papel_mm × escala / 1000
```

Ejemplo: texto de 2.5 mm en 1:50 → 0.125 m en Model Space.

### 7.3. Algoritmo de escala automática

1. Calcular límites reales del nivel.
2. Reservar áreas de marco, cajetín, leyenda y márgenes.
3. Obtener ancho y alto disponibles para el plano.
4. Calcular el denominador mínimo que permite encajar ancho y alto.
5. Redondear hacia arriba a la siguiente escala normalizada.
6. Centrar el plano sin deformarlo.
7. Si ninguna escala permitida encaja, usar una lámina mayor o emitir advertencia.

Nunca escalar X e Y con factores distintos.

## 8. Anatomía del marco

Cada `DxfSheet` se compone de zonas calculadas:

```text
┌──────────────────────────────────────────────────────────┐
│ Marco interior                                           │
│ ┌───────────────────────────────┬───────────────────────┐ │
│ │                               │ LEYENDA               │ │
│ │                               │ símbolo | descripción │ │
│ │       PLANO DEL NIVEL         │ datos técnicos       │ │
│ │                               ├───────────────────────┤ │
│ │                               │ CAJETÍN               │ │
│ │                               │ proyecto/nivel/escala │ │
│ └───────────────────────────────┴───────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 8.1. Marco exterior

- Línea exterior.
- Línea interior con margen.
- Marcas o cuadrícula perimetral opcionales para una fase posterior.
- Capa propia y color imprimible.

### 8.2. Área del plano

- No puede invadir leyenda ni cajetín.
- Debe respetar margen de seguridad.
- Debe centrar la extensión real del nivel.
- Debe mostrar el nombre del plano debajo o dentro del cajetín, no superpuesto a la arquitectura.

### 8.3. Leyenda

- Preferentemente en columna derecha, como la referencia.
- Altura variable según filas.
- Puede dividirse en dos columnas si excede el alto disponible.
- Encabezado de tabla repetible.
- Símbolo renderizado con la misma primitiva o bloque que se usa en el plano.

### 8.4. Cajetín mínimo

Campos:

- Proyecto.
- Título del plano.
- Nivel.
- Especialidad.
- Escala.
- Unidades.
- Fecha.
- Dibujado por.
- Revisado por.
- Revisión.
- Código/número de lámina.

El primer incremento puede usar un cajetín institucional simple. Logos, firmas y datos contractuales deben quedar como configuración, no codificados.

## 9. Leyenda de alumbrado

### 9.1. Fuente de verdad

La leyenda debe derivarse de las entidades presentes en la lámina, no de todo el catálogo.

### 9.2. Filas mínimas

#### Luminarias

Agrupar por identidad técnica, no solo por símbolo:

- `productId` si existe.
- En su defecto: fabricante + número de artículo.
- En último caso: nombre + potencia + flujo + forma.

Columnas recomendadas:

| Columna | Contenido |
|---|---|
| Símbolo | Mismo símbolo CAD de la planta |
| Código | Código corto de tipo/grupo |
| Descripción | Fabricante, modelo o descripción |
| Potencia | W |
| Flujo | lm |
| Montaje | Tipo/altura |
| Cantidad | Cantidad usada en el nivel |

#### Interruptores

- Simple.
- Doble.
- Triple.
- Conmutado.
- Altura de montaje.

#### Alumbrado de emergencia

- Emergencia no permanente.
- Emergencia permanente.
- Altura o tipo de montaje.

#### Cableado de alumbrado

- Tipo de conductor.
- Sección en mm².
- Referencia AWG cuando corresponda.
- Tipo de canalización.
- Número de conductores si es una característica de la ruta o circuito.

### 9.3. Regla de símbolo

No dibujar en la leyenda una letra aproximada cuando el plano utiliza un rectángulo, círculo, cruz o bloque específico. Extraer cada símbolo a una función/bloque reutilizable y usarla tanto en:

- Entidad colocada en planta.
- Celda de símbolo de la leyenda.

Así se evita que la leyenda contradiga el plano.

## 10. Leyenda de tomacorrientes

### 10.1. Filas mínimas

- Tomacorriente bajo.
- Tomacorriente inicial.
- Tomacorriente alto.
- Tomacorriente waterproof.
- Tomacorriente de techo.
- Tomacorriente para rack/comunicaciones.
- Caja de piso/tomacorriente de piso.
- Salida para equipo especial.
- Caja de pase.
- Medidor.
- Tablero general.
- Tablero de distribución.
- Conductores y canalizaciones usados.

### 10.2. Columnas recomendadas

| Columna | Contenido |
|---|---|
| Símbolo | Geometría real del símbolo |
| Código | T, TI, TA, TC, TR, TP, etc. |
| Descripción | Uso del dispositivo |
| Caja/canalización | Dimensión o tipo disponible |
| Altura | Altura de montaje sobre NPT |
| Cantidad | Cantidad usada en el nivel |

### 10.3. Datos existentes reutilizables

Los defaults de `ElectricalDevice` ya contienen para varios tipos:

- Etiqueta.
- Altura de montaje.
- Tamaño de caja.
- Material/forma de caja.
- Voltaje o fases en equipos aplicables.

La leyenda debe leer estos datos de las instancias/configuración vigente, no volver a escribir valores fijos.

## 11. Capas DXF propuestas

Conservar las capas actuales para no romper flujos, agregando capas de documentación:

| Capa | Responsabilidad |
|---|---|
| `DXF_BASE` | Fondo CAD importado |
| `RECINTOS` | Polígonos de ambiente |
| `PAREDES` | Muros |
| `VENTANAS` | Ventanas |
| `PUERTAS` | Puertas |
| `CANOPIES` | Coberturas |
| `LUMINARIAS` | Símbolos de luminarias |
| `INTERRUPTORES` | Símbolos de interruptores |
| `TOMACORRIENTES` | Nueva capa específica para tomas |
| `TABLEROS` | Nueva capa para tableros/medidores |
| `CABLEADO_LUZ` | Conductores de alumbrado |
| `CABLEADO_TOMAS` | Conductores de tomacorrientes |
| `CAJAS_PASE` | Cajas de paso |
| `TEXTO_RECINTOS` | Nombres arquitectónicos |
| `TEXTO_LUZ` | Etiquetas de alumbrado |
| `TEXTO_TOMAS` | Etiquetas de tomacorrientes |
| `MARCO` | Marco exterior/interior |
| `CAJETIN` | Líneas del cajetín |
| `LEYENDA_LUZ` | Tabla de leyenda de alumbrado |
| `LEYENDA_TOMAS` | Tabla de leyenda de tomacorrientes |
| `TEXTO_LAMINA` | Títulos, escala y metadatos |
| `REVISION_DXF` | Elementos no clasificados o advertencias |

No renombrar o eliminar capas existentes sin una estrategia de compatibilidad.

## 12. Estrategia de bloques

## 12.1. Bloques de nivel

Reemplazar el bloque único por nombres deterministas y ASCII:

```text
BASE_NIVEL_M01
BASE_NIVEL_000
BASE_NIVEL_001
```

Para cada nivel:

- Fondo CAD correspondiente.
- Recintos.
- Muros.
- Ventanas.
- Puertas.
- Coberturas.

El nombre no debe depender del nombre libre del usuario para evitar caracteres inválidos o colisiones.

## 12.2. Inserciones por lámina

El mismo bloque arquitectónico del nivel se inserta dos veces:

- Una dentro de la lámina de alumbrado.
- Una dentro de la lámina de tomacorrientes.

Ambas inserciones usan:

- Escala uniforme 1 en coordenadas reales de Model Space.
- Traslación calculada para el marco destino.
- Rotación 0 inicialmente.

La geometría eléctrica debe recibir la misma transformación de traslación.

## 12.3. Editabilidad

Mantener las entidades eléctricas como entidades sueltas dentro de su lámina siempre que sea viable. El fondo arquitectónico permanece como `INSERT` seleccionable.

Los símbolos repetidos pueden convertirse en bloques individuales para:

- Reducir tamaño del archivo.
- Garantizar que planta y leyenda usen el mismo símbolo.
- Facilitar reemplazos.

Si se introducen bloques de símbolos, conservar atributos/etiquetas como `TEXT` separado en la primera fase para máxima compatibilidad R12.

## 13. Transformaciones geométricas

### 13.1. Transformación única por lámina

```ts
interface DxfSheetTransform {
    sourceOrigin: DxfPoint;
    targetOrigin: DxfPoint;
    scale: 1;
    rotationDeg: 0;
}
```

Para una coordenada de nivel:

```text
x_lámina = x_nivel - minX_nivel + origenX_áreaPlano + centradoX
y_lámina = y_nivel - minY_nivel + origenY_áreaPlano + centradoY
```

Aplicar exactamente la misma función a:

- Fondo insertado.
- Muros/recintos dibujados.
- Luminarias.
- Interruptores.
- Tomacorrientes.
- Conductores.
- Cajas.
- Etiquetas.

### 13.2. Prohibiciones

- No mover solo el plano base dejando dispositivos en coordenadas originales.
- No usar el zoom/pan de la interfaz para la exportación.
- No deformar el plano para llenar el marco.
- No redondear coordenadas antes de aplicar la traslación.
- No usar `floorElevation` como desplazamiento X/Y del plano.

## 14. Distribución de múltiples láminas

### 14.1. Algoritmo

1. Ordenar niveles por `floorIndex` y nombre.
2. Crear dos `DxfSheet` por nivel.
3. Calcular tamaño físico de cada marco en Model Space según papel y escala.
4. Para cada nivel, ubicar alumbrado en columna 0 y tomacorrientes en columna 1.
5. Avanzar una fila por nivel.
6. Usar la mayor altura de la fila más separación.
7. Calcular la unión de todos los `frameBounds`.
8. Usar esa unión para `$EXTMIN` y `$EXTMAX`.

### 14.2. Escalas diferentes

Si los niveles tienen dimensiones distintas, cada par de láminas puede usar su propia escala automática. Alumbrado y tomacorrientes del mismo nivel deben compartir escala para facilitar comparación.

### 14.3. Láminas sin elementos

Política recomendada:

- Fondo + cero elementos de especialidad: no generar la lámina por defecto y mostrar advertencia.
- Opción `includeEmptySheets`: generar el marco con texto «SIN ELEMENTOS REGISTRADOS».
- Nunca generar un marco completamente vacío sin explicación.

## 15. Configuración de exportación en React

Agregar un diálogo o panel previo a la descarga. No es necesario crear una nueva página Inertia si el flujo actual funciona desde el editor.

### Campos

- Niveles incluidos.
- Especialidades: alumbrado, tomacorrientes o ambas.
- Formato: A0, A1, A2, A3 o A4.
- Orientación horizontal/vertical.
- Escala automática o manual.
- Escala manual.
- Incluir fondo CAD.
- Incluir nombres de ambientes.
- Incluir conductores.
- Incluir cuadros sin elementos.
- Incluir cajetín.
- Datos del cajetín.
- Estrategia para fondo global en proyectos multinivel.

### Vista previa mínima

Antes de generar:

- Lista de láminas previstas.
- Nivel y especialidad.
- Escala elegida.
- Número de elementos.
- Número de filas de leyenda.
- Advertencias de fondo CAD o conductores sin clasificar.

No es obligatorio renderizar una previsualización CAD completa en el primer incremento.

### Estado del hook

Evolucionar el contrato a:

```ts
interface UseDialuxDxfExportResult {
    exportDxf: (options: DxfExportOptions) => Promise<void>;
    isExporting: boolean;
    exportStep: string | null;
    warnings: DxfExportWarning[];
    lastError: string | null;
}
```

Aunque la generación sea síncrona internamente, la API `Promise<void>` permite incorporar validaciones, previsualización o persistencia sin romper de nuevo el consumidor.

## 16. Responsabilidad de Laravel

La primera versión puede continuar completamente en frontend:

- El proyecto ya está cargado en el editor.
- El DXF se construye como texto.
- La descarga usa `Blob` y `URL.createObjectURL`.
- No hay necesidad actual de una ruta nueva.

Laravel solo será necesario si se decide:

- Guardar plantillas institucionales de cajetín.
- Persistir configuración de exportación por proyecto/organización.
- Generar o archivar DXF en servidor.
- Controlar versiones y aprobaciones.
- Compartir descargas entre usuarios.

Si se añade una ruta, debe usarse el patrón Wayfinder ya configurado y validarse autorización del proyecto. No agregar endpoints como requisito de la primera entrega.

## 17. Refactor propuesto del exportador

Estructura recomendada:

```text
resources/js/pages/dialux/export/dxf/
├── buildDialuxDxfExport.ts          # fachada pública
├── domain/
│   ├── types.ts                     # paquete, nivel, lámina y opciones
│   └── constants.ts                 # papel, escalas y capas
├── builders/
│   ├── buildDxfDrawingPackage.ts    # proyecto → niveles/láminas
│   ├── buildDxfLevelPackage.ts      # escena → paquete de nivel
│   ├── buildDxfSheets.ts            # niveles + opciones → láminas
│   └── buildDxfLegends.ts           # entidades → leyendas
├── geometry/
│   ├── bounds.ts                    # límites y uniones
│   ├── sheetScale.ts                # escala automática
│   ├── sheetLayout.ts               # distribución sin solape
│   └── transforms.ts                # nivel → lámina
├── emitters/
│   ├── primitives.ts                # LINE/CIRCLE/ARC/TEXT/etc.
│   ├── sections.ts                  # HEADER/TABLES/BLOCKS/ENTITIES
│   ├── architecture.ts
│   ├── lighting.ts
│   ├── outlets.ts
│   ├── frame.ts
│   ├── titleBlock.ts
│   └── legend.ts
└── symbols/
    ├── lightingSymbols.ts
    └── outletSymbols.ts
```

No hacer esta extracción completa en un solo cambio. Crear archivos al extraer una responsabilidad probada, manteniendo la fachada pública.

## 18. Plan de construcción por fases

## Fase 0 — Línea base del DXF actual

### Objetivo

Congelar el comportamiento actual antes del refactor.

### Actividades

- Ejecutar pruebas actuales del DXF y exportación.
- Crear fixture de un nivel con luminarias, interruptores, tomas, tableros y conductores.
- Generar un DXF base.
- Registrar capas, bloques, entidades y extensión.
- Abrirlo en al menos un visor CAD disponible y verificar geometría.

### Entregables

- Fixture estable de un nivel.
- Pruebas del encabezado, secciones, bloque base y leyenda actual.
- Archivo de referencia generado para inspección manual, sin versionarlo si el repositorio no guarda binarios de prueba.

### Criterio de cierre

El DXF actual se reproduce mediante una prueba automatizada y la geometría visible no depende de observación manual solamente.

## Fase 1 — Modelo multinivel

### Objetivo

Evitar que los datos eléctricos de varios pisos se mezclen.

### Actividades

- Crear `DxfDrawingPackage` y `DxfLevelPackage`.
- Ordenar escenas por `floorIndex`.
- Conservar todos los elementos dentro de su nivel.
- Añadir pertenencia a nivel en warnings y leyendas.
- Resolver política de fondo CAD global vs. fondo por escena.
- Mantener compatibilidad con proyectos de una escena.

### Pruebas

- Un nivel.
- Tres niveles.
- Sótano, planta baja y piso superior.
- Dos niveles con nombres iguales.
- Nivel invisible.
- Nivel sin fondo CAD.

### Criterio de cierre

Cada entidad exportable pertenece a exactamente un nivel y ningún elemento de un piso aparece en otro.

## Fase 2 — Clasificación por especialidad

### Objetivo

Separar alumbrado y tomacorrientes sin perder circuitos o equipos relevantes.

### Actividades

- Crear filtros `buildLightingEntities` y `buildOutletEntities`.
- Clasificar conductores por circuito o endpoints.
- Clasificar cajas de paso y tableros.
- Registrar elementos ambiguos como warnings.
- Separar capas de cableado y texto.

### Pruebas

- Luminaria + interruptor + cable de alumbrado.
- Toma + tablero + cable de tomacorrientes.
- Conductor entre elementos de especialidades distintas.
- Conductor con endpoint inexistente.
- Caja compartida.
- Dispositivo desconocido.

### Criterio de cierre

Cada lámina contiene únicamente su especialidad, y los elementos sin clasificación no se ocultan silenciosamente.

## Fase 3 — Geometría de papel y escala

### Objetivo

Calcular marcos y área útil usando tamaños y escalas técnicas.

### Actividades

- Definir catálogo de formatos ISO.
- Implementar conversión papel/modelo.
- Implementar márgenes, leyenda y cajetín.
- Implementar escala automática normalizada.
- Centrar plano manteniendo relación de aspecto.
- Compartir escala dentro del par de un mismo nivel.

### Pruebas

- A1 1:50 con dimensiones conocidas.
- A3 1:100.
- Plano ancho, alto, pequeño e irregular.
- Coordenadas negativas.
- Límite exacto y exceso mínimo.

### Criterio de cierre

Las dimensiones del marco en Model Space corresponden matemáticamente al formato y escala declarados.

## Fase 4 — Marco y cajetín

### Objetivo

Encerrar cada plano en una lámina técnica identificable.

### Actividades

- Añadir capas `MARCO`, `CAJETIN` y `TEXTO_LAMINA`.
- Dibujar marco exterior e interior.
- Reservar área de plano, leyenda y cajetín.
- Renderizar metadatos.
- Numerar láminas en orden estable.
- Generar nombres ASCII seguros.

### Pruebas

- Texto largo de proyecto.
- Nivel con caracteres especiales.
- Sin autor/revisor.
- Fecha y revisión.
- Seis láminas numeradas sin duplicados.

### Criterio de cierre

Toda lámina tiene límites cerrados, título, nivel, especialidad, escala y número legibles.

## Fase 5 — Símbolos reutilizables

### Objetivo

Garantizar que los símbolos del plano y la leyenda sean idénticos.

### Actividades

- Extraer renderers de símbolos de luminaria.
- Extraer renderers de interruptores.
- Extraer renderers de tomacorrientes y tableros.
- Permitir origen y tamaño del símbolo como parámetros.
- Evaluar bloques de símbolo para reducir duplicación.
- Mantener compatibilidad AC1009.

### Pruebas

- Cada `catalogSymbol` conocido.
- Rotación de luminarias.
- Emergencia normal/permanente.
- Tomas bajas, altas, techo y piso.
- Fallback para símbolo desconocido.

### Criterio de cierre

Cada fila de leyenda invoca el mismo renderer/bloque que su entidad en planta.

## Fase 6 — Leyenda de alumbrado

### Objetivo

Crear una tabla técnica específica y filtrada.

### Actividades

- Agrupar luminarias por identidad de producto.
- Contar unidades por nivel.
- Agregar potencia, flujo y montaje.
- Agregar interruptores usados.
- Agregar emergencia y cableado de alumbrado.
- Dividir en columnas o emitir advertencia si excede el área.

### Pruebas

- Una luminaria repetida.
- Dos productos con igual símbolo.
- Producto sin fabricante/código.
- Interruptor triple.
- Cableado con varias secciones.
- Leyenda vacía.

### Criterio de cierre

La leyenda contiene todos y solo los elementos visibles del plano de alumbrado, con cantidades correctas.

## Fase 7 — Leyenda de tomacorrientes

### Objetivo

Crear una tabla específica con tipo, caja, altura y cantidad.

### Actividades

- Agrupar dispositivos por tipo y propiedades efectivas.
- Mostrar código, descripción, caja/canalización, altura y cantidad.
- Incorporar tableros y cableado relevantes.
- Diferenciar tomas con el mismo código pero distinta altura/propiedad.
- Resolver overflow de filas.

### Pruebas

- Toma baja y waterproof con código visual parecido.
- Mismo tipo con dos alturas.
- Caja sin dimensiones.
- Tablero general y de piso.
- Cableado de varias secciones.

### Criterio de cierre

La leyenda describe fielmente las tomas visibles y no mezcla símbolos de iluminación.

## Fase 8 — Composición multinivel

### Objetivo

Ubicar todas las láminas sin solapamiento.

### Actividades

- Crear dos láminas por nivel seleccionado.
- Insertar dos veces el bloque arquitectónico correspondiente.
- Trasladar entidades de especialidad con la transformación común.
- Colocar marcos por filas/columnas.
- Calcular extensión global.
- Evitar láminas vacías según opciones.

### Pruebas

- Uno, dos, tres y diez niveles.
- Escalas distintas por nivel.
- Nivel vacío entre niveles con contenido.
- Lámina con leyenda larga.
- Coordenadas negativas.
- Ninguna intersección entre `frameBounds`.
### Criterio de cierre

Todos los marcos son disjuntos, cada par corresponde al mismo nivel y `$EXTMIN/$EXTMAX` cubre el paquete completo.

## Fase 9 — Configuración React y descarga

### Objetivo

Permitir al usuario controlar la composición antes de descargar.

### Actividades

- Crear modal/panel de opciones siguiendo los componentes actuales.
- Mostrar niveles y especialidades.
- Permitir papel y escala.
- Mostrar preview textual de láminas y warnings.
- Actualizar `useDialuxDxfExport` para aceptar opciones y progreso.
- Mantener el botón actual como entrada al flujo.
- Conservar nombre de archivo seguro.

### Pruebas

- Valores predeterminados.
- Selección parcial de niveles.
- Solo alumbrado.
- Solo tomacorrientes.
- Cancelación.
- Error de fondo multinivel.
- Descarga y liberación del object URL.

### Criterio de cierre

El usuario sabe qué láminas se generarán y puede corregir advertencias antes de descargar.

## Fase 10 — Validación CAD integral

### Objetivo

Demostrar que el DXF es válido, editable e imprimible.

### Actividades

- Generar fixture de tres niveles y seis láminas.
- Parsear el DXF resultante con el parser existente cuando sea compatible.
- Verificar secciones obligatorias.
- Contar bloques, inserciones, marcos, textos y capas.
- Abrir manualmente en AutoCAD/QCAD/LibreCAD o visor disponible.
- Imprimir una lámina a la escala indicada.
- Comparar distancia conocida del plano.
- Ejecutar tipos, pruebas y build.

### Criterio de cierre

El archivo abre sin reparación, las seis láminas son visibles, las capas pueden activarse/desactivarse, una distancia real conserva su medida y la impresión coincide con la escala declarada.

## 19. Pruebas automatizadas mínimas

## 19.1. Geometría

- Unión de límites.
- Conversión mm/escala a metros.
- Elección de escala automática.
- Centrado del plano.
- Transformación de puntos.
- Marcos no superpuestos.

## 19.2. Modelo

- Orden de niveles.
- Dos láminas por nivel.
- Numeración estable.
- Filtrado por especialidad.
- Fondo CAD asignado correctamente.
- Warnings deterministas.

## 19.3. Leyendas

- Solo símbolos usados.
- Agrupación correcta.
- Cantidades.
- Datos de producto.
- Caja y altura.
- Conductores por sección.
- Ausencia de mezcla entre disciplinas.

## 19.4. Sintaxis DXF

- `AC1009`.
- Secciones obligatorias.
- Tabla de capas coherente con el total declarado.
- Nombres de bloque únicos.
- Cada `INSERT` referencia un bloque existente.
- Coordenadas finitas.
- `EXTMIN` menor que `EXTMAX`.
- Terminación con `EOF`.
- Texto ASCII compatible.

## 19.5. Regresión

- Proyecto de una escena continúa exportando.
- Arcos de conductores siguen siendo `ARC`.
- Fondo sigue seleccionándose mediante `INSERT`.
- Elementos eléctricos continúan editables.
- La descarga no afecta el editor ni el PDF documental.

## 20. Fixtures obligatorios

### Fixture A — Un nivel mínimo

- Un recinto.
- Una luminaria.
- Un interruptor.
- Un tomacorriente.
- Dos conductores clasificados.

Resultado: dos láminas.

### Fixture B — Nivel completo

- Varias luminarias de dos productos.
- Emergencia.
- Interruptores de varios tipos.
- Tomas de varias alturas.
- Tablero y cajas.
- Conductores con dos secciones.

Resultado: dos leyendas extensas pero legibles.

### Fixture C — Tres niveles

- Geometría distinta por nivel.
- Elementos eléctricos distintos.
- Un nivel sin tomacorrientes.
- Fondo CAD compartido/configurado explícitamente.

Resultado: cinco láminas por defecto o seis con `includeEmptySheets`.

### Fixture D — Caso de error

- Varios niveles.
- Un fondo global sin política seleccionada.
- Conductor sin clasificación.
- Símbolo desconocido.

Resultado: warnings explícitos, sin mezcla silenciosa.

## 21. Matriz de aceptación

| Requisito | Verificación |
|---|---|
| Planos por nivel | Cada escena seleccionada produce su par de láminas |
| Marco por plano | Cada `DxfSheet` contiene marco exterior/interior cerrado |
| Leyenda de alumbrado | Solo contiene luminarias, interruptores, emergencia y cableado aplicable |
| Leyenda de tomas | Solo contiene tomas, equipos, tableros y cableado aplicable |
| Símbolos coherentes | Plano y leyenda usan el mismo renderer/bloque |
| Escala | Una distancia conocida conserva medida y plotea correctamente |
| Sin solapes | Los límites de marcos no se intersectan |
| Fondo correcto | Cada nivel usa el fondo configurado para ese nivel |
| Capas | Las disciplinas se pueden ocultar independientemente |
| Compatibilidad | El archivo declara AC1009 y abre sin reparación |
| Regresión | El proyecto de un nivel continúa exportando |

## 22. Riesgos y controles

### Riesgo 1 — Repetir el fondo activo en todos los pisos

**Control:** modelar `DxfLevelBasePlan` y exigir política explícita cuando solo exista un fondo global.

### Riesgo 2 — Aplanar escenas y mezclar niveles

**Control:** construir un paquete por `Scene`; nunca exportar desde listas globales sin `sceneId`.

### Riesgo 3 — Marco visual sin escala real

**Control:** derivar dimensiones del marco desde milímetros de papel y denominador de escala.

### Riesgo 4 — Símbolo distinto en plano y leyenda

**Control:** renderer/bloque único reutilizado en ambas ubicaciones.

### Riesgo 5 — Cableado en especialidad equivocada

**Control:** clasificación por circuito/endpoints y estado `unclassified` visible.

### Riesgo 6 — Leyenda que no cabe

**Control:** medir filas antes de emitir; dividir columnas, ajustar papel/escala o advertir. No reducir texto hasta volverlo ilegible.

### Riesgo 7 — Archivo excesivamente grande

**Control:** bloques de fondo y símbolos, sin duplicar definiciones geométricas.

### Riesgo 8 — Romper compatibilidad R12

**Control:** mantener primitivas actuales y no introducir entidades modernas antes de pruebas cruzadas.

### Riesgo 9 — Duplicar cálculos de layout en UI y builder

**Control:** una función pura genera el manifiesto; React solo muestra su preview.

### Riesgo 10 — Texto técnico ilegible

**Control:** definir alturas en milímetros de papel y convertirlas según escala.

## 23. Decisiones pendientes antes de implementar

Estas decisiones deben confirmarse en Fase 1; el plan incluye defaults para avanzar:

| Decisión | Default recomendado |
|---|---|
| Formato | A1 horizontal |
| Organización | Dos láminas por fila, una fila por nivel |
| Escala | Automática y normalizada |
| Fondo único multinivel | Requerir elección explícita |
| Lámina sin elementos | Omitir y advertir |
| Cajetín | Institucional simple y configurable |
| Salida | Un DXF con todas las láminas en Model Space |
| Versión DXF | AC1009/R12 |
| Leyenda | Solo símbolos usados en nivel/especialidad |
| Conductores ambiguos | Capa de revisión + warning, no clasificación silenciosa |

## 24. Archivos existentes que probablemente cambiarán

- `resources/js/pages/dialux/export/dxf/buildDialuxDxfExport.ts`
- `resources/js/pages/dialux/export/useDialuxDxfExport.ts`
- `resources/js/pages/dialux/export/domain/types.ts` o nuevos tipos DXF dedicados.
- `resources/js/pages/dialux/electrical/electricalLegend.ts`
- `resources/js/pages/dialux/components/toolbar/panels/ExportacionPanel.tsx`
- `resources/js/pages/dialux/components/EditorLayout.tsx`
- `resources/js/pages/dialux/hooks/types.ts` si se persiste fondo CAD por nivel.
- Store/slices de importación DXF si el fondo pasa de global a por escena.
- Pruebas de `resources/js/pages/dialux/export/dxf/`.

No modificar Laravel ni rutas en la primera entrega salvo que se decida persistir configuración.

## 25. Comandos de verificación

```text
npm run types
npm test -- --run resources/js/pages/dialux/export/dxf
npm test -- --run resources/js/pages/dialux/export/dialux-export.test.ts
npm run build
```

Si se modifica PHP:

```text
php artisan test --compact <archivo-o-filtro-relacionado>
vendor/bin/pint --dirty --format agent
```

Además de los comandos, el DXF debe abrirse en un visor CAD porque una cadena sintácticamente válida puede seguir teniendo problemas visuales o de impresión.

## 26. Orden obligatorio

```text
Fase 0: línea base
   ↓
Fase 1: modelo por nivel y política de fondo
   ↓
Fase 2: separación de especialidades
   ↓
Fase 3: papel y escala
   ↓
Fase 4: marco y cajetín
   ↓
Fase 5: símbolos comunes
   ↓
Fase 6: leyenda de alumbrado
   ↓
Fase 7: leyenda de tomacorrientes
   ↓
Fase 8: composición multinivel
   ↓
Fase 9: configuración React
   ↓
Fase 10: validación CAD integral
```

## 27. Definición global de terminado

El trabajo estará terminado cuando:

- El exportador recorre todos los niveles seleccionados.
- Cada nivel genera un plano de alumbrado y otro de tomacorrientes, salvo omisión explícita de láminas vacías.
- Cada plano está contenido en un marco técnico.
- Cada marco tiene cajetín, nivel, especialidad, escala y número de lámina.
- La leyenda de alumbrado contiene solo símbolos visibles de alumbrado.
- La leyenda de tomacorrientes contiene solo símbolos visibles de tomacorrientes y equipos relacionados.
- Los símbolos de las leyendas coinciden con los símbolos de planta.
- Las cantidades y propiedades de leyenda se derivan de las entidades reales.
- Los planos de distintos pisos no se superponen ni mezclan entidades.
- El fondo arquitectónico de cada nivel está identificado explícitamente.
- La escala declarada corresponde a las dimensiones del marco y del modelo.
- Todas las láminas caben dentro de `$EXTMIN/$EXTMAX`.
- El DXF abre sin reparación en un visor CAD compatible con R12.
- La geometría y capas siguen siendo editables.
- Los tests de TypeScript/DXF pasan.
- `npm run types` y `npm run build` pasan.
- No se agregaron dependencias ni se cambió una API pública sin aprobación.
- La exportación PDF documental y la edición del proyecto no presentan regresiones.

## 28. Primer incremento recomendado

El primer cambio de código no debe intentar dibujar el cajetín completo. Debe demostrar primero la arquitectura correcta:

1. Crear un fixture de tres niveles.
2. Construir `DxfLevelPackage[]` sin aplanar escenas.
3. Separar entidades de alumbrado y tomacorrientes.
4. Resolver el fondo CAD por nivel.
5. Generar rectángulos de prueba para seis láminas sin solapamiento.
6. Verificar bloques, traslaciones y extensión global.
7. Después incorporar marco definitivo, cajetín y leyendas.

Si la separación por nivel falla, cualquier leyenda o marco construido encima también estará mal. Por eso este orden es obligatorio.
