# Plan maestro para replicar la estructura del informe luminotécnico «MÓDULO I»

## 1. Propósito y regla de uso

Este documento guía la construcción de un generador de informes luminotécnicos en PDF con React, TypeScript y Laravel. La referencia analizada es `MODULO I_Informe.pdf`, un informe DIALux de 242 páginas, formato A4 vertical.

El objetivo no es copiar 242 páginas de manera rígida. El objetivo es reproducir su estructura mediante plantillas reutilizables, datos normalizados, cálculos trazables y un compositor que arme automáticamente portada, índice, tablas, planos, resultados y glosario.

Este plan debe ejecutarse por fases. No se debe iniciar una fase si los criterios de cierre de la anterior no están satisfechos.

### Resultado esperado

- El usuario configura un proyecto, sus edificios, niveles, ambientes, luminarias y escenas.
- El sistema reutiliza los datos ya existentes en el editor DIALux del proyecto.
- React permite previsualizar y configurar el contenido del informe.
- TypeScript crea un modelo documental estable e independiente de la interfaz.
- Laravel valida el documento y genera el PDF binario A4.
- El índice y la numeración se calculan desde las páginas realmente generadas.
- Los planos y mapas fotométricos mantienen escala visual, leyenda, coordenadas y legibilidad.
- Los valores mostrados en resúmenes, listas y planos provienen de una sola fuente de verdad.

## 2. Diagnóstico del PDF de referencia

### 2.1. Datos técnicos observados

| Dato | Valor observado |
|---|---:|
| Archivo | `MODULO I_Informe.pdf` |
| Total de páginas | 242 |
| Tamaño de página | A4 vertical, aproximadamente 595 × 842 pt |
| Generador del archivo | Stimulsoft Reports / DIALux |
| Fecha visible en portada | 20/02/2025 |
| Proyecto visible | MÓDULO I |
| Edificaciones | 1 |
| Niveles | 3 |
| Ambientes identificados | 24 |
| Modelos de luminaria | 3 |
| Escenas visibles | 1 por bloque: «Escena de luz 1» |
| Glosario | 8 páginas, páginas 235–242 |

### 2.2. Conclusión estructural

El documento se compone de cuatro capas:

1. **Elementos maestros:** encabezado, pie, número de página, nombre del proyecto, tipografía, márgenes y reglas de tabla.
2. **Secciones globales:** portada, contenido, lista consolidada de luminarias y fichas de producto.
3. **Secciones jerárquicas repetibles:** edificio → nivel → ambiente → escena → objeto de cálculo.
4. **Anexos:** glosario técnico.

La mayor parte del PDF se obtiene repitiendo entre 8 y 10 plantillas por ambiente. Por ello, la implementación debe ser dirigida por datos y no por páginas escritas manualmente.

### 2.3. Inventario real por rango de páginas

| Rango | Contenido | Naturaleza |
|---|---|---|
| 1 | Portada | Única por informe |
| 2–8 | Contenido/índice | Variable según el número final de entradas |
| 9 | Lista global de luminarias | Consolidada por producto |
| 10–12 | Fichas de producto | Una por modelo de luminaria |
| 13 | Lista de luminarias de Edificación 1 | Consolidada por edificio |
| 14–20 | Apertura del 1.er nivel y objetos de cálculo del nivel | Una vez por nivel; 7 páginas en este caso |
| 21–88 | Ocho expedientes de ambientes del 1.er nivel | Bloques repetibles |
| 89–95 | Apertura del 2.º nivel y objetos de cálculo del nivel | Una vez por nivel; 7 páginas en este caso |
| 96–163 | Ocho expedientes de ambientes del 2.º nivel | Bloques repetibles |
| 164–166 | Apertura del 3.er nivel y objetos de cálculo del nivel | Variante reducida de 3 páginas |
| 167–234 | Ocho expedientes de ambientes del 3.er nivel | Bloques repetibles |
| 235–242 | Glosario | Anexo paginado |

### 2.4. Ambientes y repetición detectada

Cada nivel contiene el mismo grupo funcional:

- Dos aulas: 1.º/2.º, 3.º/4.º y 5.º/6.º de primaria según nivel.
- Circulación.
- Hall de escalera.
- Hall de servicios higiénicos.
- SS.HH. acceso universal niños.
- SS.HH. mujeres.
- SS.HH. varones.

Esto produce 24 expedientes de ambiente. Los nombres cambian; las plantillas no.

### 2.5. Longitud de cada tipo de expediente

| Tipo de ambiente | Páginas típicas | Motivo de la variación |
|---|---:|---|
| Aula | 9 | Plano con dos arreglos/grupos de luminarias y tabla de posiciones más extensa |
| Circulación | 10 | Geometría alargada, varios grupos y tabla de distribución en más páginas |
| Hall de escalera | 8 | Menor cantidad de luminarias y posiciones |
| Hall SS.HH. | 8 | Un producto y una distribución simple |
| SS.HH. acceso universal | 8 | Un producto y una distribución simple |
| SS.HH. mujeres | 8 | Un producto y una distribución simple |
| SS.HH. varones | 8 | Un producto y una distribución simple |

No se debe codificar que un ambiente siempre ocupa ocho páginas. La cantidad debe surgir del contenido y de reglas explícitas de división.

## 3. Índice objetivo del informe generado

El compositor debe generar las secciones en este orden:

1. Portada.
2. Contenido.
3. Lista global de luminarias.
4. Fichas de producto.
5. Por cada edificio:
   1. Lista de luminarias del edificio.
   2. Por cada nivel:
      1. Lista de luminarias del nivel.
      2. Objetos de cálculo del nivel.
      3. Superficies u objetos especiales del nivel: escaleras, descansos u otros.
      4. Por cada ambiente:
         1. Resumen de geometría y escena.
         2. Resultados y verificación normativa.
         3. Plano de situación de luminarias.
         4. Datos y posiciones de luminarias.
         5. Lista de luminarias del ambiente.
         6. Objetos de cálculo del ambiente.
         7. Tabla de resultados del plano útil.
         8. Mapa de iluminancia/isolineas del plano útil.
6. Glosario.

### Regla del índice

El índice no se escribe antes de conocer las páginas. El proceso será:

1. Construir la lista lógica de páginas.
2. Expandir tablas y fichas que ocupen más de una página.
3. Asignar `pageNumber` correlativo.
4. Generar entradas jerárquicas del índice.
5. Calcular cuántas páginas ocupa el propio índice.
6. Recalcular desplazamientos hasta que el número de páginas del índice sea estable.

## 4. Catálogo de plantillas reutilizables

### 4.1. Maestros presentes en todas las páginas

#### `ReportPage`

Responsabilidad:

- Definir A4 vertical.
- Reservar márgenes y áreas seguras.
- Evitar desbordamientos fuera de página.
- Recibir encabezado, cuerpo y pie.
- Aplicar saltos de página deterministas.

#### `ReportHeader`

Contenido observado:

- Nombre corto del proyecto a la izquierda.
- Marca del generador a la derecha.
- En páginas técnicas puede incluir la ruta jerárquica: edificio, nivel, ambiente y escena.

#### `ReportFooter`

Contenido mínimo:

- Número de página.
- Fecha o metadato de generación si se configura.
- Marca propia del sistema, sin presentar el resultado como generado por DIALux si no lo fue.

#### `BreadcrumbTitle`

Formato lógico:

`Edificación → Nivel → Ambiente → Escena`

Debe poder mostrar solo los niveles existentes. No concatenar texto manual en cada plantilla.

### 4.2. Plantillas globales

#### `CoverPage`

Campos:

- Fecha.
- Nombre del proyecto.
- Imagen general 3D o vista del modelo.
- Título del informe.
- Opcionalmente cliente, ubicación, autor, revisión y código de proyecto.

La referencia usa una composición muy limpia: metadatos arriba, imagen dominante en el tercio superior/medio y título debajo.

#### `TableOfContentsPage`

Campos por entrada:

- Profundidad jerárquica.
- Título.
- Número de página.
- Identificador estable de sección.

Comportamiento:

- Sangría por nivel.
- Puntos guía.
- Continuación automática en varias páginas.
- No mostrar entradas de detalle que el usuario haya desactivado.

#### `LuminaireListPage`

Se reutiliza a escala de proyecto, edificio, nivel y ambiente.

Totales superiores observados:

- Flujo luminoso total, `Φtotal` en lm.
- Potencia total, `Ptotal` en W.
- Rendimiento lumínico global en lm/W.

Columnas observadas:

- Unidad/cantidad.
- Fabricante.
- Número de artículo.
- Nombre del artículo.
- Potencia unitaria.
- Flujo luminoso unitario.
- Rendimiento lumínico.

#### `ProductSheetPage`

Una ficha por producto único, no una ficha por instancia colocada.

Campos observados:

- Fabricante, modelo y número de artículo.
- Potencia `P`.
- Flujo luminoso de luminaria `ΦLuminaria`.
- Rendimiento en lm/W.
- Temperatura de color correlacionada, CCT.
- Índice de reproducción cromática, CRI.
- Imagen o logotipo.
- Diagrama polar de intensidad luminosa.
- Tabla/diagrama fotométrico adicional cuando exista.

Debe aceptar datos parciales y mostrar «No disponible» sin romper el diseño.

#### `GlossaryPage`

Modelo:

- Letra de agrupación.
- Término.
- Definición.
- Símbolo o abreviatura opcional.

El glosario debe dividirse por altura disponible, mantener juntos el término y su definición y repetir el título en páginas de continuación.

### 4.3. Plantillas por nivel

#### `LevelCalculationOverviewPage`

- Plano completo del nivel.
- Luminarias superpuestas.
- Objetos de cálculo resaltados.
- Flecha norte y referencia de escala si los datos existen.

#### `LevelCalculationObjectsTablePage`

Filas por plano útil u objeto de cálculo.

Columnas observadas:

- Propiedades/nombre.
- Iluminancia media calculada `Ē`.
- Valor nominal.
- Iluminancia mínima `Emin`.
- Iluminancia máxima `Emax`.
- Uniformidad `Uo` o `g1`.
- Uniformidad secundaria `g2`.
- Índice/verificación.

#### `SpecialCalculationSurfacePage`

Para escaleras, descansos, rampas u objetos que no corresponden a un ambiente convencional. Reutiliza la misma tabla fotométrica, pero permite un plano o recorte específico.

### 4.4. Plantillas por ambiente

#### `AmbientSummaryPlanPage`

- Plano del ambiente o recorte CAD.
- Curvas/valores fotométricos superpuestos.
- Área.
- Altura interior.
- Altura de montaje.
- Altura del plano útil.
- Grados de reflexión de techo, paredes y suelo.
- Factor de degradación/mantenimiento.
- Zona marginal.

#### `AmbientResultsPage`

Tabla comparativa con:

- Magnitud.
- Valor calculado.
- Valor nominal.
- Verificación.
- Índice.

Magnitudes que deben estar disponibles según el cálculo:

- Iluminancia media.
- Uniformidad.
- Potencia específica de conexión.
- Consumo o indicador energético si el sistema lo calcula.
- Cantidad y potencia total de luminarias.

La verificación no debe ser siempre un check verde. Debe derivarse de `calculatedValue`, `operator` y `requiredValue`, y admitir conforme, no conforme y no evaluado.

#### `LuminairePlacementPlanPage`

Capas del plano:

1. Fondo CAD.
2. Contorno del ambiente.
3. Mobiliario opcional.
4. Luminarias con símbolo y código de grupo.
5. Cotas y escala.
6. Flecha norte si corresponde.
7. Marco y referencias.

#### `LuminairePlacementDetailsPage`

Datos por producto/grupo:

- Fabricante.
- Número de artículo.
- Nombre.
- Cantidad.
- Posición X, Y y altura de montaje Z.
- Organización de arreglo.
- Dirección X: cantidad, separación y alineación.
- Dirección Y: cantidad, separación y alineación.
- Código del grupo, por ejemplo A1/A2.

La tabla debe continuar en páginas adicionales sin duplicar datos ni cortar una fila.

#### `AmbientLuminaireListPage`

Es la variante filtrada de `LuminaireListPage`, usando solo luminarias del ambiente actual.

#### `AmbientCalculationOverviewPage`

- Plano del ambiente.
- Plano útil resaltado.
- Identificador del objeto de cálculo.
- Luminarias visibles como contexto.

#### `AmbientCalculationTablePage`

- Propiedades del plano útil.
- `Ē`, nominal, `Emin`, `Emax`, uniformidades e índice.
- Estado de cumplimiento calculado.

#### `AmbientIlluminanceMapPage`

- Geometría del ambiente.
- Isolíneas o mapa de valores.
- Unidad `lx`.
- Leyenda de escala cromática si se usa color.
- Propiedades y resultados resumidos debajo.
- Resolución/malla de cálculo documentada.

## 5. Componentes y datos que deben reutilizarse

### 5.1. Reutilización por composición

| Pieza | Consumidores |
|---|---|
| Encabezado y pie | Todas las páginas |
| Totales de luminarias | Proyecto, edificio, nivel y ambiente |
| Tabla de luminarias | Proyecto, edificio, nivel y ambiente |
| Render del plano | Portada, nivel, resumen, ubicación, objeto de cálculo y mapa |
| Ruta jerárquica | Títulos, índice y metadatos |
| Tabla de resultados | Nivel, ambiente y superficie especial |
| Evaluador normativo | Resumen, tablas e indicadores de cumplimiento |
| Datos de producto | Lista, ficha, posiciones y cálculos de potencia/flujo |
| Paginador | Índice, productos, posiciones, tablas y glosario |

### 5.2. Reutilización del código existente del proyecto

El repositorio ya contiene una canalización de exportación que debe evolucionarse, no duplicarse:

- `resources/js/pages/dialux/export/snapshot/buildDialuxExportSnapshot.ts`: captura del estado canónico.
- `resources/js/pages/dialux/export/domain/types.ts`: contrato tipado del informe.
- `resources/js/pages/dialux/export/derived/buildDialuxExportAssets.ts`: generación de assets.
- `resources/js/pages/dialux/export/derived/svg/buildAmbientSvg.ts`: plano e isolíneas de ambiente.
- `resources/js/pages/dialux/export/document/buildDialuxFormalDocument.ts`: composición y TOC.
- `resources/js/pages/dialux/export/useDialuxPdfExport.ts`: orquestación y descarga.
- `app/Http/Controllers/Dialux/Editor2DController.php`: validación y respuesta PDF.
- `resources/views/dialux/export/formal-pdf.blade.php`: plantilla Dompdf.
- `tests/Feature/Dialux/FormalExportTest.php` y pruebas TypeScript de `resources/js/pages/dialux/export/`.

Antes de crear cualquier archivo nuevo, se debe comprobar si su responsabilidad ya existe en esta canalización.

### 5.3. Decisión de renderizado

Mantener el enfoque híbrido existente:

- **React/TypeScript:** obtiene el estado del editor, normaliza datos, calcula derivados gráficos y construye el modelo documental.
- **Canvas/SVG en navegador:** produce planos, capturas 3D, diagramas y mapas; para Dompdf se convierten a bitmap de alta resolución cuando SVG no sea fiable.
- **Laravel:** autoriza, valida tamaño/forma del payload y genera el PDF con Dompdf.
- **Blade/CSS de impresión:** controla A4, tablas, encabezados, pies y saltos.

No agregar librerías: el proyecto ya incluye Dompdf, jsPDF, html2pdf.js y herramientas gráficas. Para este informe formal se debe conservar Dompdf como salida oficial para asegurar un PDF binario reproducible y testeable en servidor.

## 6. Modelo de datos documental propuesto

El contrato debe representar el dominio, no detalles de HTML.

```ts
interface LightingReportDocument {
    schemaVersion: number;
    metadata: ReportMetadata;
    options: ReportOptions;
    project: ReportProject;
    products: LuminaireProduct[];
    buildings: ReportBuilding[];
    glossary: GlossaryEntry[];
    assets: ReportAsset[];
    pages: ReportPageDescriptor[];
    toc: TocEntry[];
}
```

### 6.1. Jerarquía base

```text
ReportProject
└── ReportBuilding[]
    └── ReportLevel[]
        ├── SpecialCalculationObject[]
        └── ReportAmbient[]
            ├── LightScene[]
            ├── LuminairePlacement[]
            └── CalculationSurface[]
```

### 6.2. Entidades mínimas

#### `ReportMetadata`

- Título, subtítulo y código.
- Fecha del proyecto y fecha de generación.
- Autor, cliente, ubicación y revisión.
- Versión del esquema.
- Sistema de unidades.
- Zona horaria.

#### `LuminaireProduct`

- `id`, fabricante, código y nombre.
- Potencia, flujo y rendimiento.
- CCT, CRI, montaje y protección IP.
- Archivo fotométrico de origen y hash opcional.
- Imagen, logotipo, polar y tabla fotométrica como referencias de asset.

#### `LuminairePlacement`

- Identificador de instancia y producto.
- Edificio, nivel, ambiente y escena.
- Posición canónica X/Y/Z en metros.
- Rotación.
- Código de grupo.
- Arreglo y separación.
- Factor de regulación.

#### `CalculationSurface`

- Identificador, nombre y tipo.
- Polígono/contorno.
- Altura.
- Malla o resolución.
- `averageLux`, `minimumLux`, `maximumLux`.
- Uniformidades.
- Requisitos normativos aplicados.
- Datos suficientes para reproducir mapa/isolineas.

#### `ReportAsset`

- `id`, propósito y formato.
- Ancho, alto y densidad.
- Datos o referencia segura.
- Hash para deduplicación.
- Texto alternativo/estado de disponibilidad.

#### `ReportPageDescriptor`

- `id` estable.
- `kind` de plantilla.
- Sección y ruta jerárquica.
- Referencias a datos/assets, no copias.
- Número físico y número visible.
- Orientación.
- Indicador de continuación.

### 6.3. Unidades y precisión

- Geometría interna: metros, sin redondeo prematuro.
- Iluminancia: lux.
- Potencia: watts.
- Flujo: lúmenes.
- Rendimiento: lm/W.
- Posiciones: conservar precisión interna; mostrar normalmente tres decimales en metros.
- Porcentajes: almacenar como decimal o porcentaje según el contrato actual, pero nunca mezclarlos silenciosamente.
- Todo valor mostrado debe pasar por un formateador central con configuración regional española.

## 7. Cálculos y reglas de consistencia

### 7.1. Agregados de luminarias

Por cada alcance —ambiente, nivel, edificio y proyecto— agrupar por producto y calcular:

```text
cantidad = número de instancias del producto
Ptotal = Σ(cantidad × potencia unitaria × factor de regulación)
Φtotal = Σ(cantidad × flujo unitario × factor de regulación)
rendimiento global = Φtotal / Ptotal, si Ptotal > 0
```

La misma función debe alimentar todas las listas y resúmenes.

### 7.2. Fotometría

No presentar una simulación aproximada como equivalente a DIALux. El informe debe registrar el origen de los resultados:

- `engine`: motor que calculó.
- `engineVersion`.
- Fecha/hora de cálculo.
- Parámetros: malla, plano útil, factor de mantenimiento, reflectancias y escena.
- Estado: calculado, desactualizado, importado o no calculado.

Si el sistema aún no posee un motor fotométrico validado, puede importar/mostrar resultados externos o resultados del motor actual, pero debe etiquetarlos correctamente.

### 7.3. Verificación normativa

Modelo sugerido:

```ts
interface RequirementEvaluation {
    metric: string;
    calculatedValue: number | null;
    operator: '>=' | '<=' | '>' | '<' | '=';
    requiredValue: number | null;
    unit: string;
    status: 'pass' | 'fail' | 'not-evaluated' | 'stale';
    source?: string;
}
```

La fuente normativa y los umbrales deben provenir de la configuración normativa existente, no de valores incrustados en la plantilla PDF.

### 7.4. Coordenadas y planos

- Mantener una transformación única mundo → plano → asset → página.
- Encajar por `boundingBox` conservando relación de aspecto.
- Incluir un margen uniforme alrededor del contenido.
- No recalcular posiciones desde píxeles capturados.
- Aplicar la misma transformación a contornos, luminarias, textos, isolíneas y cotas.
- El zoom o paneo actual de la interfaz no debe alterar la extensión exportada.
- El fondo CAD debe exportarse en tema claro y alta resolución.

## 8. Estrategia de paginación

### 8.1. Regla general

Cada descriptor representa una página o una familia expandible. Las tablas se dividen antes de renderizar en Laravel para que el índice conozca el total exacto.

### 8.2. Elementos indivisibles

- Fila de tabla.
- Título con al menos la primera fila siguiente.
- Tarjeta de producto.
- Leyenda con su gráfico.
- Término de glosario con su definición.

### 8.3. Continuaciones

En una página continuada:

- Repetir título corto y encabezados de tabla.
- Mostrar «continuación».
- Conservar la ruta jerárquica.
- No repetir totales salvo que se marque como resumen.
- Mantener numeración correlativa.

### 8.4. Estabilidad

La paginación no debe depender de medidas del navegador del usuario. Definir en servidor:

- Alto útil por tipo de página.
- Alto de encabezado, título, pie y fila.
- Máximo de filas por variante.
- Reglas específicas para fichas y glosario.

Los límites deben probarse con 0, 1, límite exacto y límite + 1 elementos.

## 9. Experiencia de usuario en React

### 9.1. Pantalla de configuración del informe

Agregar al flujo actual de exportación:

- Selección de edificios, niveles, ambientes y escenas.
- Inclusión/exclusión de fichas de producto.
- Inclusión/exclusión de glosario.
- Calidad de imágenes: borrador o final.
- Metadatos editables: título, fecha, cliente, ubicación y revisión.
- Indicador de datos faltantes.
- Resumen estimado de secciones/páginas.
- Botón «Generar PDF» con progreso por etapa.

### 9.2. Validaciones antes de exportar

Bloqueantes:

- Proyecto inexistente.
- Payload que excede el máximo permitido.
- Asset inválido o formato no permitido.
- Geometría no finita.
- Referencia a producto/ambiente inexistente.

Advertencias confirmables:

- Ambiente sin cálculo.
- Resultado desactualizado.
- Producto sin ficha o diagrama polar.
- Plano sin fondo CAD.
- Requisito normativo no configurado.

### 9.3. Progreso observable

Etapas sugeridas:

1. Preparando datos.
2. Capturando vista general.
3. Generando planos por nivel.
4. Generando planos por ambiente.
5. Generando mapas fotométricos.
6. Componiendo índice y páginas.
7. Generando PDF en servidor.
8. Descargando.

## 10. Arquitectura de implementación

### 10.1. Frontend

Mantener capas claras:

```text
snapshot/   estado editable → snapshot inmutable
derived/    cálculos agregados y assets
document/   snapshot + assets → documento/páginas/TOC
export/     orquestación, validación y envío
ui/         configuración y progreso
```

Reglas:

- Los componentes React no calculan totales fotométricos durante el render.
- Los builders deben ser funciones puras siempre que sea posible.
- No leer directamente múltiples stores desde cada builder; crear primero un snapshot.
- Los assets se identifican por ID y propósito.
- Evitar duplicar base64 cuando varias páginas usan la misma imagen.

### 10.2. Laravel

Responsabilidades:

- Autenticación y autorización del proyecto.
- Validación del payload con `FormRequest` dedicado.
- Límites de tamaño, cantidad de páginas/assets y formatos.
- Normalización defensiva de texto y números.
- Render Blade/Dompdf.
- Nombre seguro del archivo.
- Registro de errores sin guardar datos sensibles completos.

No trasladar a Blade cálculos de negocio. Blade debe formatear y presentar un documento ya compuesto.

### 10.3. Plantillas Blade

El archivo actual es grande y ya contiene varias plantillas. La evolución debe ser progresiva:

- Extraer parciales solo cuando exista un límite funcional claro.
- Mantener estilos PDF encapsulados.
- Crear una tabla de despacho `page.kind → partial` o equivalente legible.
- Centralizar encabezado/pie.
- Centralizar helpers de formato y assets.
- No duplicar variantes enteras por ambiente.

### 10.4. Contrato y versionado

- Incluir `schemaVersion` en el payload.
- Laravel rechaza versiones futuras desconocidas con un mensaje explícito.
- Cambios compatibles agregan campos opcionales.
- Migraciones de contrato se prueban con fixtures de versiones anteriores.

## 11. Plan de construcción por fases

## Fase 0 — Línea base y comparación visual

### Objetivo

Congelar el comportamiento actual y crear una referencia verificable antes de cambiar plantillas.

### Actividades

- Ejecutar las pruebas actuales de exportación TypeScript y Pest.
- Generar un PDF de fixture con el exportador existente.
- Registrar cantidad de páginas, títulos y secciones actuales.
- Conservar capturas de páginas representativas: portada, índice, lista, ficha, resumen, ubicación, tabla y mapa.
- Definir tolerancias visuales y de datos.

### Entregables

- Fixture estable de un proyecto de tres niveles.
- PDF de línea base generado por la aplicación.
- Matriz referencia vs. salida actual.

### Criterio de cierre

Las pruebas actuales pasan y existe una salida reproducible para comparar cambios posteriores.

## Fase 1 — Auditoría y contrato canónico

### Objetivo

Asegurar que todos los datos necesarios existen y tienen una sola definición.

### Actividades

- Comparar `domain/types.ts` con las entidades de la sección 6.
- Identificar campos existentes, derivados, ausentes y obsoletos.
- Añadir `schemaVersion`, procedencia de cálculo y estados de verificación.
- Formalizar unidades y nulos.
- Documentar IDs y referencias entre proyecto, nivel, ambiente, producto y asset.
- Añadir validación Laravel equivalente.

### Entregables

- Contrato TypeScript.
- `FormRequest` de exportación.
- Fixture JSON mínimo y fixture completo.

### Pruebas

- Referencias válidas e inválidas.
- `NaN`, infinito, valores negativos no permitidos y campos nulos.
- Versión soportada/no soportada.
- Payload vacío y payload completo.

### Criterio de cierre

El mismo payload válido es aceptado por TypeScript y Laravel y no requiere que Blade invente datos.

## Fase 2 — Agregados y verificación

### Objetivo

Unificar totales y estados mostrados en todas las secciones.

### Actividades

- Crear funciones puras para agrupar luminarias por producto.
- Calcular totales por ambiente, nivel, edificio y proyecto.
- Implementar el evaluador normativo triestado/cuatro estados.
- Conectar requisitos con la configuración normativa existente.
- Reemplazar checks decorativos por estados calculados.

### Pruebas

- Un producto repetido en varios ambientes.
- Productos distintos con igual nombre y diferente código.
- Regulación al 0 %, parcial y 100 %.
- Potencia cero.
- Requisito faltante.
- Valor justo en el límite normativo.

### Criterio de cierre

Los totales de páginas globales y locales cuadran exactamente, y ningún estado de cumplimiento se muestra sin evaluación.

## Fase 3 — Motor gráfico común

### Objetivo

Producir planos consistentes para todas las plantillas.

### Actividades

- Consolidar transformaciones geométricas existentes.
- Separar capas CAD, ambiente, mobiliario, luminarias, cálculo, cotas y etiquetas.
- Generar variantes mediante opciones, no funciones duplicadas.
- Garantizar tema claro para impresión.
- Añadir leyenda y escala.
- Comprobar la captura 3D de portada.
- Definir calidad borrador/final y límites de resolución.

### Pruebas

- Geometría muy ancha, muy alta, pequeña y rotada.
- Coordenadas negativas.
- Ambiente sin CAD.
- Solapamiento de símbolos.
- Zoom/pan arbitrario antes de exportar.
- Alineación exacta entre luminaria, plano útil e isolíneas.

### Criterio de cierre

El mismo punto geométrico aparece en la misma posición relativa en todas las variantes del plano.

## Fase 4 — Plantillas globales

### Objetivo

Completar portada, listas consolidadas y fichas de producto.

### Actividades

- Ajustar portada A4 a la jerarquía de la referencia.
- Implementar lista reutilizable por alcance.
- Deduplicar fichas por ID/código de producto.
- Implementar ficha con fallbacks.
- Verificar símbolos, unidades y tipografía embebida/compatible.

### Pruebas

- Sin productos.
- Un producto.
- Tres productos como la referencia.
- Nombre de artículo muy largo.
- Producto sin imagen, polar o tabla.
- Lista que requiere continuación.

### Criterio de cierre

Las secciones globales se generan solo a partir del catálogo real y se mantienen legibles con datos extremos.

## Fase 5 — Plantillas de nivel

### Objetivo

Construir la apertura dinámica de cada nivel.

### Actividades

- Lista de luminarias filtrada por nivel.
- Plano completo con objetos de cálculo.
- Tabla paginada de objetos.
- Páginas para escaleras, descansos y superficies especiales.
- Variante reducida cuando no hay superficies especiales, como en el 3.er nivel de la referencia.

### Pruebas

- Nivel vacío.
- Nivel solo con ambientes.
- Nivel con escaleras y descansos.
- Más objetos que una página.

### Criterio de cierre

Cada nivel produce exactamente las páginas justificadas por sus datos, sin páginas vacías.

## Fase 6 — Expediente reutilizable de ambiente

### Objetivo

Implementar una única factoría de páginas capaz de representar cualquier ambiente.

### Actividades

- Resumen con plano y propiedades.
- Resultados normativos.
- Plano de ubicación.
- Tabla de productos, grupos, arreglos y posiciones.
- Lista local de luminarias.
- Plano de objetos de cálculo.
- Tabla del plano útil.
- Mapa de iluminancia.
- Continuaciones automáticas para tablas extensas.

### Pruebas

- Aula con dos arreglos.
- Circulación con geometría irregular y varios grupos.
- Hall con una luminaria.
- Ambiente sin luminarias.
- Ambiente con varias superficies de cálculo.
- Ambiente con nombre largo y caracteres especiales.

### Criterio de cierre

Los siete tipos de ambiente observados se generan con la misma factoría y solo difieren por sus datos y número de continuaciones.

## Fase 7 — Paginador e índice estable

### Objetivo

Obtener números de página correctos aun cuando el contenido varíe.

### Actividades

- Convertir familias expandibles en páginas concretas.
- Implementar división determinista de tablas y glosario.
- Calcular el índice iterativamente.
- Asignar IDs estables para pruebas.
- Incluir entradas jerárquicas configurables.
- Verificar continuidad sin duplicados ni huecos.

### Pruebas

- Índice de una, dos y siete páginas.
- Cambio de una fila que agrega una página intermedia.
- Sección desactivada.
- Informe sin glosario.
- Informe de más de 242 páginas.

### Criterio de cierre

Cada entrada del índice apunta al número físico correcto y la regeneración con los mismos datos produce la misma paginación.

## Fase 8 — Glosario y anexos

### Objetivo

Completar el cierre documental sin acoplarlo a términos fijos de DIALux.

### Actividades

- Definir un catálogo propio de términos autorizados.
- Seleccionar términos utilizados por el informe o permitir glosario completo.
- Ordenar con reglas de idioma español.
- Paginar por altura.
- Permitir anexos futuros sin alterar las plantillas principales.

### Criterio de cierre

Los términos no se cortan, el orden es estable y el glosario aparece correctamente en el índice.

## Fase 9 — Integración Laravel y robustez

### Objetivo

Generar el PDF formal de forma segura y estable.

### Actividades

- Validar autorización del proyecto.
- Validar tamaño y estructura del payload.
- Aplicar límites de imágenes y páginas.
- Evitar acceso remoto desde Dompdf salvo una lista explícita.
- Usar assets embebidos o rutas controladas.
- Definir tiempo máximo y manejo de memoria.
- Para informes grandes, evaluar job en cola usando las dependencias existentes; no introducirlo antes de medir.
- Mantener descarga síncrona para informes que entren en el límite seguro.

### Pruebas

- Usuario no autenticado/no autorizado.
- Base64 inválido.
- HTML/script en campos de texto.
- Payload excesivo.
- Generación de 242 páginas.
- Nombre de archivo con caracteres especiales.

### Criterio de cierre

Laravel entrega un PDF válido, no ejecuta contenido no confiable y responde con errores útiles ante entradas inválidas.

## Fase 10 — Validación final y regresión

### Objetivo

Demostrar que la réplica es estructuralmente correcta y no afecta otras funciones.

### Actividades

- Generar el fixture equivalente a MÓDULO I.
- Comparar página por página por categoría, no por texto pixel-perfect de marca ajena.
- Extraer texto del PDF resultante y comprobar títulos, cifras y numeración.
- Renderizar páginas seleccionadas a imagen para revisión visual.
- Comprobar tamaño de archivo y tiempo.
- Ejecutar tipos, tests frontend, tests Pest y build.

### Páginas de control visual obligatorias

- Portada.
- Primera y última página del índice.
- Lista global.
- Una ficha completa y una incompleta.
- Apertura de nivel.
- Resumen de aula.
- Resultados.
- Plano de aula.
- Tabla de posiciones de circulación.
- Mapa de iluminancia.
- Primera y última página del glosario.

### Criterio de cierre

La estructura completa se genera desde datos, el PDF abre correctamente, el índice coincide, los totales cuadran, las páginas de control son legibles y toda la suite relacionada pasa.

## 12. Matriz de trazabilidad del PDF a la aplicación

| Elemento de referencia | Fuente de datos | Builder TypeScript | Plantilla Laravel |
|---|---|---|---|
| Portada | Proyecto + captura 3D | Builder de portada/assets | Página portada |
| Contenido | Descriptores de página | Compositor/TOC | Página índice |
| Lista global | Todas las colocaciones + productos | Agregador global | Lista de luminarias |
| Ficha | Producto único + assets | Enriquecedor de producto | Ficha de producto |
| Lista edificio/nivel | Colocaciones filtradas | Agregador por alcance | Misma lista reutilizable |
| Plano nivel | CAD + niveles + colocaciones + objetos | Builder de plano | Página de plano |
| Resumen ambiente | Ambiente + escena + propiedades | Builder de detalle | Resumen |
| Resultados | Superficie + requisito | Evaluador normativo | Tabla de resultados |
| Plano ubicación | Geometría + colocaciones | Motor gráfico | Plano de luminarias |
| Posiciones | Colocaciones + arreglos | Normalizador de posiciones | Tabla paginada |
| Objetos de cálculo | Superficies | Builder de cálculo | Plano/tabla |
| Mapa de lux | Malla/isolíneas + geometría | Builder de isolíneas | Mapa de iluminancia |
| Glosario | Catálogo de términos | Selector/ordenador | Glosario paginado |

## 13. Estrategia de pruebas

### 13.1. TypeScript/Vitest

- Builders puros del snapshot.
- Agregación de productos y totales.
- Evaluación normativa.
- Transformaciones geométricas.
- Descriptores de página.
- Estabilización del índice.
- Serialización del payload.

### 13.2. Pest/Laravel

- Autenticación y autorización.
- Validación del contrato.
- Render de cada `page.kind`.
- Cabeceras HTTP y nombre de descarga.
- Presencia de textos/unidades en HTML antes de PDF.
- PDF binario válido (`%PDF`).
- Casos de compatibilidad con payload anterior.

### 13.3. Pruebas de documento

- Contar páginas con una herramienta de inspección en CI si ya está disponible; no agregar dependencia sin aprobación.
- Extraer texto y validar títulos/números cuando el entorno lo permita.
- Comparar capturas de páginas representativas con tolerancia.
- Revisar que no existan páginas totalmente vacías.
- Revisar que ninguna tabla se salga del área útil.

### 13.4. Comandos mínimos por iteración

```text
npm run types
npm test -- --run resources/js/pages/dialux/export
php artisan test --compact tests/Feature/Dialux/FormalExportTest.php
npm run build
vendor/bin/pint --dirty --format agent   # solo cuando se modifique PHP
```

## 14. Presupuesto de rendimiento

Objetivos iniciales que deben medirse y ajustarse con datos reales:

- No capturar dos veces el mismo asset.
- Limitar imágenes de página a la resolución necesaria para A4; evitar resoluciones de pantalla arbitrariamente grandes.
- Preferir JPEG de calidad alta para planos complejos y PNG para gráficos que necesiten transparencia/texto nítido.
- Liberar canvases y object URLs después de construir el payload.
- Mostrar progreso en informes con muchos ambientes.
- Probar explícitamente un documento de 242 páginas.
- Registrar tiempo por captura, composición, envío y render servidor.

No prometer un tiempo máximo hasta ejecutar la línea base en el entorno de producción.

## 15. Accesibilidad, impresión y calidad visual

- Contraste suficiente en texto y líneas.
- No depender solo del color para indicar cumplimiento; usar símbolo y texto.
- Tamaño mínimo de texto legible al 100 %.
- Símbolos técnicos con fuente compatible con Dompdf.
- Tablas con encabezados claros y unidades.
- Fondo blanco real para evitar consumo de tinta innecesario.
- Márgenes consistentes y ningún contenido bajo encabezado/pie.
- Imagen con fallback textual cuando falte.
- Marca propia y procedencia técnica transparente.

## 16. Riesgos y controles

### Riesgo 1 — Copiar páginas en lugar de modelar plantillas

**Control:** todos los ambientes se generan con una factoría y descriptores de página.

### Riesgo 2 — Índice incorrecto por paginación CSS

**Control:** expandir y numerar páginas antes de Blade; probar límites + 1.

### Riesgo 3 — Totales diferentes entre secciones

**Control:** usar el mismo agregador por alcance y probar conservación de sumas.

### Riesgo 4 — Plano deformado o desplazado

**Control:** transformación canónica única, relación de aspecto fija y pruebas geométricas.

### Riesgo 5 — Checks verdes sin sustento

**Control:** evaluador normativo explícito con fuente, operador y estado.

### Riesgo 6 — Informe denominado DIALux sin cálculo DIALux

**Control:** identificar el motor real y su versión; no imitar marcas ni afirmar certificaciones inexistentes.

### Riesgo 7 — Payload enorme por imágenes base64 repetidas

**Control:** assets deduplicados por ID/hash, calidad configurable y límites en frontend/backend.

### Riesgo 8 — Dompdf no reproduce SVG/canvas fielmente

**Control:** rasterizar assets problemáticos en el navegador a resolución controlada y probar símbolos/unidades.

### Riesgo 9 — Romper el exportador existente

**Control:** versionar contrato, mantener fixtures legacy y entregar por plantillas/fases pequeñas.

### Riesgo 10 — Contenido técnico incompleto

**Control:** advertencias visibles para cálculo desactualizado, producto sin fotometría o requisito sin configurar.

## 17. Decisiones que deben validarse antes de producción

- Nombre y marca que aparecerán en lugar de DIALux.
- Fuente normativa oficial y versión aplicable en Perú.
- Motor fotométrico que respalda `E`, `Emin`, `Emax` e isolíneas.
- Si las fichas de fabricante pueden redistribuir imágenes y diagramas bajo sus licencias.
- Nivel de similitud visual deseado frente a identidad gráfica propia.
- Si el glosario será completo, configurable o limitado a términos usados.
- Límite síncrono de páginas/peso antes de usar una cola.
- Política de conservación de PDFs y assets generados.

Estas decisiones no impiden construir el esqueleto, pero sí impiden declarar validez técnica o publicar el informe como producto final.

## 18. Orden obligatorio de ejecución

```text
Fase 0: línea base
   ↓
Fase 1: contrato canónico
   ↓
Fase 2: agregados y normativa
   ↓
Fase 3: motor gráfico
   ↓
Fase 4: páginas globales
   ↓
Fase 5: páginas de nivel
   ↓
Fase 6: expediente de ambiente
   ↓
Fase 7: paginador e índice
   ↓
Fase 8: glosario/anexos
   ↓
Fase 9: robustez Laravel
   ↓
Fase 10: validación integral
```

## 19. Definición global de terminado

El trabajo estará terminado cuando:

- La portada, índice, listas, fichas, niveles, ambientes, planos, tablas, cálculos, ubicaciones y glosario se generan desde el modelo de datos.
- No existe código específico para «AULA 1.º» o cualquier ambiente concreto.
- La cantidad de páginas se adapta al contenido.
- El índice coincide con las páginas reales.
- Los productos se deduplican y sus totales cuadran en todos los alcances.
- Los planos conservan posición, escala relativa y alineación de capas.
- Cada resultado identifica su origen y estado.
- Los incumplimientos se muestran correctamente.
- El informe equivalente de 24 ambientes puede alcanzar una estructura comparable a las 242 páginas de referencia sin páginas manuales.
- El PDF binario abre y se imprime en A4.
- `npm run types`, las pruebas Vitest relacionadas, Pest de exportación y `npm run build` pasan.
- No se agregaron librerías ni se cambió una API pública sin aprobación.
- No se afectaron la edición del proyecto, los cálculos existentes ni otras exportaciones.

## 20. Primer bloque de trabajo recomendado

No comenzar rediseñando la portada. El primer incremento debe ser técnico y pequeño:

1. Ejecutar y guardar la línea base de tests/exportación.
2. Comparar el contrato actual con este inventario.
3. Corregir campos, procedencia, estados y agregados.
4. Crear un fixture de tres niveles y 24 ambientes.
5. Recién entonces ajustar las plantillas visuales una por una.

Así, cada página posterior se construirá sobre datos confiables y el plan no dependerá de valores simulados o duplicados.
