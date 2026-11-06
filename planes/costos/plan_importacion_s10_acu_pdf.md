# Análisis y plan: presupuesto S10 en Excel + ACU en PDF

Fecha: 5 de noviembre de 2026.
Estado actual: carga completa de los 3.100 ACU de Veterinaria, con valores originales del PDF y precios del Excel conservados. Funciona en el entorno Laravel local también con assets compilados; la sección 16 prevalece sobre las restricciones de las fases anteriores. No se agregaron dependencias ni migraciones.

**Actualización con los archivos originales:** la sección 12 contiene los resultados de la revisión real del PDF y Excel de Veterinaria y prevalece sobre los supuestos y la estimación preliminar de las secciones 1–11. Para este par de archivos, la estimación revisada es **48–72 horas (6–9 días laborables)**, sujeta a las decisiones de compatibilidad allí descritas.

## 1. Dictamen

**Sí es técnicamente viable importar el presupuesto S10 en Excel y sus ACU en PDF**, aprovechando el flujo existente de importación, vinculación y guardado. Actualmente esa combinación no está implementada: ambos pasos de S10 leen Excel.

La primera versión recomendada debe aceptar **PDF con texto extraíble**, como los generados por exportación o impresión digital cuando conservan la capa de texto. El aspecto del documento o que provenga de S10 no garantiza que esa capa exista ni que sea utilizable.

Para PDF escaneados o formados por imágenes hace falta OCR. También es viable, pero requiere más trabajo, validación y revisión de errores numéricos; conviene tratarlo como segunda fase.

**Estimación preliminar:** 32–48 horas, aproximadamente **4–6 días laborables** de una persona, para la versión de PDF con texto, incluyendo pruebas. Depende de disponer de muestras reales y de autorizar un lector PDF. No es una garantía de compatibilidad con cualquier reporte S10.

## 2. Alcance y límites de esta revisión

Se revisaron los parsers S10/Delphin, el modal compartido, el vinculador, la aplicación local de ACU, el cálculo local, el flujo de guardado y los manifiestos de dependencias. También se consultó documentación oficial sobre extracción de texto y OCR.

La evidencia aportada es una **captura**, no el PDF original. No se ejecutó extracción del documento mostrado, no se midió rendimiento y no se reprodujo una importación real. La viabilidad de la arquitectura está sustentada por el código; la compatibilidad de ese archivo concreto sigue pendiente.

No se identificaron muestras locales de ACU S10 en PDF en la búsqueda de archivos fuente, que excluyó carpetas generadas. No se inspeccionaron datos de producción. Laravel Boost no está expuesto entre las herramientas disponibles en esta sesión; no se cambiaron patrones de Laravel/Inertia ni se consultó la base de datos.

## 3. Qué existe y se puede reutilizar

Rutas relativas a la raíz del repositorio:

| Archivo | Hallazgo relevante |
|---|---|
| `resources/js/pages/costos/delphin/components/ImportDelphinModal.tsx` | Separa presupuesto y ACU en dos pasos; configura parsers por origen (`delphin` / `s10`). Admite varios archivos de ACU, muestra advertencias y vínculos. Los selectores actuales aceptan `.xls,.xlsx`. |
| `resources/js/pages/costos/delphin/helpers/parseS10Excel.ts` | Tiene parsers independientes para presupuesto y ACU S10; devuelve los mismos contratos internos que Delphin. Depende de celdas de un workbook, no de posiciones PDF. |
| `resources/js/pages/costos/delphin/helpers/parseAcuExcel.ts` | Define `ParsedAcu`, `ParsedAcuComponente` y `ParseAcuResult`, reutilizables como salida del futuro lector PDF. Incluye las cinco categorías de componentes. |
| `resources/js/pages/costos/delphin/helpers/matchAcuToPartida.ts` | Vincula por código normalizado y compatibilidad de descripción; tiene alternativa por descripción normalizada. Normaliza ceros iniciales por segmento. |
| `resources/js/pages/costos/delphin/DelphinView.tsx` | `handleAcusImported` aplica localmente los ACU y actualiza el precio de la partida con el costo calculado. El guardado global persiste los cambios. |
| `resources/js/pages/costos/presupuesto/hooks/usePresupuestoAcu.ts` | Calcula costos, mantiene ACU pendientes y los persiste mediante el flujo existente. El vaciado de ACU es secuencial; el código documenta antecedentes de conflictos al guardar concurrentemente. |
| `resources/js/pages/costos/delphin/helpers/parseS10Excel.test.ts` | Tiene pruebas con workbooks sintéticos para presupuesto y ACU S10. No prueban lectura de PDF. |
| `package.json`, `package-lock.json`, `composer.json`, `composer.lock` | No se encontró un lector de texto PDF u OCR de los candidatos investigados. Existen herramientas de generación PDF y FPDI, que no resuelven por sí mismas la extracción tabular requerida. |

No se necesita convertir el PDF a Excel como paso intermedio. Tampoco se prevé cambiar la API pública ni el esquema de base de datos para la primera versión: el nuevo lector puede producir el mismo payload de componentes.

El módulo de presupuesto tiene además otra entrada de importación Excel (`ImportAcusExcelModal.tsx` y una ruta backend `import-excel`). Esta propuesta se limita al asistente S10 del módulo Delphin; extender esa otra entrada sería alcance adicional.

## 4. Lectura de la captura aportada

El formato visible contiene los datos necesarios: código y descripción de partida, rendimiento, unidad del costo, código/descripcion/unidad del recurso, recursos, cantidad, precio y parcial. Se distinguen mano de obra, materiales, equipo y subpartidas.

Observaciones que deben convertirse en casos de validación:

- `Rendimiento: 25 m²/Día` aparece en una misma línea. No debe depender de que número y unidad estén separados como celdas Excel.
- La columna **Recursos** corresponde al campo interno `recursos`; hay que admitir ese encabezado y la variante **Cuadrilla**.
- Los títulos de sección tienen un subtotal en la misma fila: `MANO DE OBRA 33.61`, por ejemplo. No son recursos. El parser Excel actual detecta secciones cuando tienen una sola celda no vacía; trasladar esa condición literalmente al PDF sería incorrecto.
- Los códigos de partidas usan segmentos con puntos. Los códigos de insumos/subpartidas pueden ser alfanuméricos, como `CU0010012`; se deben conservar como texto.
- `m²`, `m2`, `%mo`, guiones y descripciones con comillas o saltos necesitan normalización controlada. Un guion en recursos no autoriza convertir cualquier importe ilegible en cero.
- El primer bloque tiene costo declarado **101.08** y subtotales visibles **33.61 + 26.88 + 1.01 + 39.58 = 101.08**. Es una referencia manual útil, todavía no una prueba de extracción.
- Herramientas manuales usa **3 % de 33.61**, con parcial mostrado **1.01**. Interpretar ese 3 como cantidad ordinaria multiplicaría el costo incorrectamente.
- La imagen termina dentro de otra partida. El lector deberá manejar bloques que continúan entre páginas y encabezados repetidos.

No se debe asumir que el diseño de esta captura identifica todas las variantes de reportes S10.

## 5. Investigación técnica y decisión propuesta

### PDF con texto: extracción local en el navegador

La documentación de PDF.js permite cargar datos binarios, acceder a páginas y obtener su contenido textual. Los elementos de texto incluyen cadena, transformación y dimensiones; proporcionan la información necesaria para intentar reconstruir filas y columnas. **No entregan automáticamente un ACU ni una tabla validada.** Véanse [API de carga y elementos de texto](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) y [PDFPageProxy.getTextContent](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html).

Se propone evaluar `pdfjs-dist` como lector, con carga diferida y worker empaquetado por Vite. La compatibilidad de versión, navegador, worker y compilación se debe comprobar en la prueba inicial. Procesar el archivo localmente permite enviar al servidor solo los componentes estructurados mediante el flujo actual.

La reconstrucción debe agrupar elementos por coordenadas normalizadas y tolerancias, reconocer encabezados, identificar columnas y mantener el estado de partida/sección entre páginas. Usar solo texto concatenado o posiciones absolutas de una captura sería frágil ante fragmentos desordenados, cambios de escala y textos multilínea.

### PDF escaneado: OCR como ampliación

Un lector de texto no reconoce las letras que existen únicamente como píxeles. Tesseract.js reconoce imágenes, pero su documentación aclara que **no admite PDF directamente**; haría falta renderizar las páginas y después ejecutar OCR. Esa salida necesitaría reconstrucción tabular y conciliación numérica igualmente. Fuente: [alcance oficial de Tesseract.js](https://github.com/naptha/tesseract.js#project-scope).

Para la primera versión, páginas sin texto útil o documentos mixtos con bloques sin extraer deben generar un aviso y bloquear la aplicación de bloques incompletos. No conviene detectar unos pocos encabezados y considerar válido todo el documento.

### Dependencias y restricción del proyecto

FPDI, ya declarado en Composer, está orientado a importar páginas como plantillas para generar documentos, según su [documentación oficial](https://www.setasign.com/products/fpdi/). No sustituye el extractor de campos requerido aquí. Las librerías de exportación PDF tampoco equivalen a un lector de ACU.

**Esta propuesta requiere aprobar una dependencia de lectura PDF antes de implementarla.** No se ha instalado ninguna. Si se mantiene estrictamente la condición de no agregar librerías ni herramientas externas, no se recomienda prometer una importación PDF general y fiable con lo declarado actualmente. Implementar un lector PDF propio excedería ampliamente este alcance. Incorporar código desde un CDN también sería introducir una dependencia y no evita esa decisión.

## 6. Flujo propuesto

1. Importar el presupuesto S10 en Excel con el parser actual.
2. En el paso de ACU S10, permitir Excel o PDF con texto, conservando la alternativa Excel.
3. Leer cada PDF por páginas, detectar el formato y extraer partidas y componentes. Registrar archivo/página de origen para diagnóstico durante la revisión.
4. Validar estructura e importes antes de generar los payloads aplicables.
5. Vincular contra partidas elegibles del presupuesto, mostrando coincidencias, diferencias y casos pendientes.
6. Presentar un resumen previo: ACU detectados, válidos, sin vínculo, ambiguos, duplicados y con diferencias de costo; mostrar el precio Excel y el costo ACU que lo reemplazaría.
7. Aplicar únicamente los ACU seleccionados y válidos mediante el mecanismo local existente.
8. Persistir con **Guardar** y confirmar éxito solo tras la respuesta del guardado; recargar para comprobar persistencia.

Importar al estado local y guardar en base de datos son pasos diferentes en el código actual. La interfaz debe conservar esa distinción.

## 7. Riesgos y controles necesarios

| Riesgo detectado | Control propuesto |
|---|---|
| Vinculación equivocada por nombres/códigos repetidos | El vinculador actual usa mapas con un destino por clave; añadir comprobación de unicidad en el flujo PDF antes de reutilizarlo. Restringir a partidas elegibles y no aplicar asociaciones ambiguas. |
| Sobrescritura de un ACU existente o duplicado entre varios PDF | Detectar duplicados por destino antes de aplicar; mostrar los conflictos y requerir una selección explícita. |
| Cambio silencioso del precio importado del Excel | Comparar precio del presupuesto, costo declarado del PDF y costo calculado antes de llamar a `handleAcusImported`, porque ese callback actualiza precios. |
| Campos perdidos o inventados | No usar valores por defecto del flujo existente, como rendimiento 1 o unidad `und`, para ocultar fallos de lectura. Un campo crítico ausente debe quedar pendiente. |
| Diferencias de redondeo | Conservar precisión de origen para diagnóstico y validar con `decimal.js` y las reglas actuales. Una diferencia de S/ 0.01 sirve como umbral inicial de revisión, no como garantía universal; calibrarlo con muestras. |
| Porcentajes de equipos | El cálculo local actual reconoce herramientas por la descripción, no todos los porcentajes posibles por unidad. Validar el caso mostrado; marcar otras bases porcentuales como no compatibles hasta revisar su semántica. No ampliar globalmente el motor en esta fase. |
| ACU partido entre páginas o subtotales tomados como recursos | Mantener estado entre páginas, reconocer encabezados repetidos y comprobar subtotales/número de componentes. |
| Subpartidas sin desglose propio | Importar el componente con código, cantidad y precio visibles. El PDF no permite inventar un análisis interno que no contiene. |
| PDF grande o guardado lento | Procesar páginas de forma controlada, mostrar progreso y cancelación; medir extracción y persistencia por separado. Mantener el guardado secuencial existente. |
| Documento cifrado, dañado o no compatible | Informar la causa y no aplicar datos incompletos. Mantener Excel como alternativa. |

El contrato `ParsedAcu` no conserva actualmente costo declarado, subtotales ni página de origen. Esos datos pueden mantenerse en un diagnóstico interno separado para la revisión PDF, conservando el contrato de persistencia.

## 8. Plan de implementación y esfuerzo

Supuestos: una persona familiarizada con el proyecto; jornada de 8 horas; PDF con texto; un conjunto acotado de diseños representativos; dependencia aprobada; sin OCR, nueva API, migraciones ni cambios generales de cálculo. Los tiempos son de trabajo técnico, no incluyen esperas por muestras o aprobaciones.

| Fase | Entregable y criterio de salida | Horas |
|---|---|---:|
| 1. Validación con originales | Revisar 3–5 PDF y su Excel correspondiente; incluir varias partidas/páginas, porcentajes, subpartidas y un reporte extenso. Probar extracción/worker y confirmar diseños compatibles. | 4–6 |
| 2. Parser y validación numérica | Reconstrucción de filas, secciones, continuaciones, campos y conciliación con trazabilidad. Salida compatible con `ParseAcuResult`. | 10–14 |
| 3. Integración y revisión previa | Selección PDF solo en ACU S10, progreso, conflictos, diferencias de precio y bloqueo de bloques inválidos; reutilización de aplicación/guardado. | 6–10 |
| 4. Pruebas y regresión | Fixtures reales y sintéticos, vínculos ambiguos, cálculo, errores, cancelación, persistencia y regresión Excel S10/Delphin. | 6–10 |
| 5. Ajustes y entrega | Correcciones con muestras, medición de PDF extenso y verificación TypeScript/build. | 6–8 |
| **Total** | **Primera versión para PDF con texto** | **32–48** |

- **Primer dictamen sobre el PDF original:** fase 1, 4–6 horas, incluida en el total. Permite ajustar alcance y estimación antes de construir todo el lector.
- **Versión inicial completa recomendada:** 4–6 días laborables.
- **OCR opcional:** agregar aproximadamente 40–80 horas (5–10 días); total orientativo de ambas fases: 72–128 horas, 9–16 días. Esta ampliación depende especialmente de calidad de escaneo, diseños y nivel de revisión manual aceptable; no garantiza reconocimiento perfecto.

No se promete todavía una cantidad de páginas por segundo: se medirá con originales y un equipo de referencia. El tiempo de lectura PDF tampoco representa el tiempo total de guardado de cientos de ACU.

## 9. Archivos previstos para una futura implementación

- Nuevos helpers y pruebas junto a `resources/js/pages/costos/delphin/helpers/`: lector S10 PDF y reconstrucción/validación, separando lo específico del PDF del parser Excel.
- `ImportDelphinModal.tsx`: selección del lector, estados y revisión previa para el origen S10.
- Pruebas del vinculador y de la integración con `DelphinView.tsx`; modificar esos archivos solo si la validación previa no puede resolverse en la entrada PDF.
- `package.json` y `package-lock.json`: únicamente si se aprueba el lector propuesto.
- Configuración Vite/worker únicamente si la prueba de compatibilidad demuestra que hace falta.

No se prevén cambios backend para aceptar el PDF, porque la propuesta lo procesa en el navegador. La revisión del guardado puede revelar restricciones existentes; cualquier ampliación se delimitará antes de cambiar contratos.

## 10. Verificación prevista y aceptación

La futura entrega debe demostrar:

- Un presupuesto Excel y sus ACU PDF representativos se vinculan, guardan y conservan tras recargar.
- El bloque de referencia reproduce códigos, rendimiento 25, componentes y costo 101.08, o identifica explícitamente cualquier divergencia de cálculo/lectura.
- Se conservan códigos alfanuméricos, unidades, cantidades y categorías; las secciones/subtotales no se importan como insumos.
- Los errores críticos y asociaciones ambiguas no producen cambios silenciosos; los casos rechazados indican archivo/página y motivo.
- Los duplicados y reemplazos se revisan antes de aplicar.
- Los flujos Excel de S10 y Delphin conservan su comportamiento.
- Compilación y pruebas relacionadas pasan; se comprueba el flujo de guardado en un proyecto de prueba.

Comandos previstos para esa fase:

- `npm test -- resources/js/pages/costos/delphin/helpers/parseS10Excel.test.ts` para regresión S10 Excel, añadiendo los futuros tests de PDF/vinculación y los tests afectados de hooks.
- `npm run types`.
- `npm run build`.
- Si finalmente se modifica PHP: `php artisan test --compact` con archivo/filtro relacionado y `vendor/bin/pint --dirty --format agent`.

**En esta revisión no se ejecutaron tests, compilación, importaciones ni escrituras a base de datos.** Solo se realizaron lecturas/búsquedas del repositorio, consulta de documentación oficial y creación de este plan Markdown. El único archivo añadido por esta tarea es este documento.

## 11. Recomendación

Avanzar primero con **presupuesto Excel + ACU PDF con texto**, manteniendo Excel como alternativa y la API actual. Antes de implementar, confirmar la extracción con los originales y resolver la dependencia propuesta. Dejar OCR y soporte de diseños adicionales para ampliaciones basadas en evidencia.

La arquitectura existente permite reutilizar gran parte del flujo. El esfuerzo principal está en reconstruir correctamente los datos del PDF y comprobar que no se vinculen ni recalculen de forma incorrecta.

## 12. Validación de los originales de Veterinaria

### 12.1. Archivos y método

Archivos recibidos y leídos sin modificarlos:

- [ACU VETERINARIA OK.pdf](<ACU VETERINARIA OK.pdf>): 5.078.523 bytes.
- [1. PRESUPUESTO TOTAL VETERINARIA OK.xls](<1. PRESUPUESTO TOTAL VETERINARIA OK.xls>): 1.003.520 bytes; hoja `Sheet`, rango `A1:X4558`.

Se utilizó PyMuPDF (`fitz`), que ya estaba disponible en el entorno, para inspeccionar texto de todas las páginas. Se utilizó `xlsx`, ya instalado en el proyecto, para leer el presupuesto. Se ejecutaron en memoria las funciones originales `parseS10PresupuestoWorkbook`, `matchAcuToPartida` y `calculateAcuLocally`, transpiliadas con el TypeScript existente, sin editar sus archivos ni montar la aplicación.

Los fragmentos de análisis se ejecutaron mediante `python -` y `node`, sin guardar scripts nuevos. Esto es una comprobación exploratoria de datos y funciones puras; **no es una importación en la aplicación ni una validación del guardado en Laravel**. Que PyMuPDF esté disponible localmente no significa que sea parte del despliegue del sistema ni que sustituya la decisión sobre el lector de producción.

### 12.2. Resultados verificables

| Comprobación | Resultado observado |
|---|---|
| Extensión del PDF | **616 páginas**, sin cifrado detectado. |
| Texto extraíble | Todas las páginas contienen texto; la de menor contenido tiene 682 caracteres. No se detectaron caracteres Unicode de reemplazo en la extracción realizada. |
| ACU principales | **3.100**, con 3.100 códigos distintos; sin códigos principales duplicados. |
| Partidas del Excel reconocidas por el parser actual | **3.100 partidas**; 4.532 filas entre partidas y grupos. |
| Cobertura de códigos | Los 3.100 ACU principales corresponden a las 3.100 partidas del Excel; no se identificaron partidas principales faltantes en ninguno de los dos documentos. |
| Vinculador existente | **3.100 coincidencias por código**, aceptadas por su comprobación de descripción; ninguna sin vínculo en la prueba en memoria. |
| Precio declarado PDF frente a precio Excel | **0 diferencias** en los 3.100 ACU principales. Esto compara precios declarados, no el resultado de recalcular componentes. |
| Suma de parciales de partidas del Excel | **S/ 31.708.502,40**, conciliada al céntimo con el importe del grupo raíz. No se presenta como total con impuestos. |
| Análisis adicionales | **25 análisis auxiliares `CU…`**, en las páginas 613–616. Deben diferenciarse de las partidas del presupuesto. |
| Lectura exploratoria de recursos | **16.711 filas de componentes** entre los 3.125 bloques. El patrón exploratorio reconoció todas las líneas candidatas que empezaban por los códigos de recurso evaluados. No sustituye una validación completa de geometría, descripciones y continuidad. |
| Subtotales declarados | En los 3.125 bloques, la suma de subtotales de secciones coincide con el costo declarado. No demuestra por sí sola que cantidad × precio siga la misma regla del sistema. |

**Conclusión sobre el documento concreto:** es un candidato favorable para extracción directa de texto; **no necesita OCR para la lectura examinada**. La correspondencia entre archivos es completa a nivel de códigos principales y precios declarados.

### 12.3. Problema real del Excel: el grupo 1.10 pierde su identidad

El parser actual produce estas tres advertencias al leer este archivo:

1. `Ítem 1.1 repetido ... se omitió la segunda aparición.`
2. `Partida 1.10.1: padre "1.10" no encontrado, se adjunta como raíz.`
3. `Partida 1.10.2: padre "1.10" no encontrado, se adjunta como raíz.`

En `A4511`, el grupo **MITIGACION DE IMPACTO AMBIENTAL** está almacenado como número `1.1`, y el texto formateado que entrega `xlsx` también es `1.1`. Sus descendientes usan `1.10…`. Existe otro grupo legítimo `1.1` en la fila 10, **OBRAS PROVISIONALES…**.

Por tanto, no basta con conservar el texto formateado: la identidad `1.10` ya no está representada en esa celda numérica. La jerarquía permite proponerla, pero no se debe transformar automáticamente todo `1.1` en `1.10`.

Tratamiento propuesto: detectar la colisión y el padre ausente, mostrar una corrección contextual **solo para esa fila**, con vista previa y confirmación antes de aplicar. Otra opción es usar una copia del Excel con los códigos expresados como texto. En ambos casos se conserva intacto el archivo original. La corrección debe demostrar que `1.10.1` y `1.10.2` quedan bajo el grupo ambiental sin alterar el primer `1.1`.

### 12.4. Seis porcentajes %mt no son compatibles con el cálculo directo actual

La página **563** contiene seis componentes **INSTALACION - EQUIPOS**, código `390010001`, unidad `%mt`, dentro de **MANO DE OBRA**. Corresponden a:

- `1.6.2.1.1.1`.
- `1.6.2.1.2.1`, `1.6.2.1.2.2`, `1.6.2.1.2.3`, `1.6.2.1.2.4`.
- `1.6.2.1.3.1`.

Ejemplo comprobado: cantidad **3.0000**, precio/base **50.300,00**, parcial **1.509,00**. El documento aplica un porcentaje: 3 % de 50.300. El cálculo actual de mano de obra multiplica cantidad por precio, sin reconocer `%mt`: con esos datos obtiene 150.900 para ese componente.

Al evaluar los componentes extraídos de `1.6.2.1.1.1` con `calculateAcuLocally`, el total pasa de **51.854,27 declarado a 205.727 calculado**. Es una simulación en memoria del cálculo actual con valores de origen; no se guardó ese resultado en ningún proyecto.

Esto impide recomendar una integración que solo convierta el PDF al payload existente. Hay que definir una representación porcentual compatible y comprobarla en cálculo local, backend, edición y consolidación. **No se debe dividir silenciosamente la cantidad por 100 mientras se deja una representación engañosa en pantalla**, ni cambiar las reglas generales de todos los proyectos.

La alternativa de menor alcance es bloquear inicialmente esas seis partidas y mostrarlas como pendientes; esa entrega sería parcial y debe identificarse como tal. Para importar las 3.100 partidas correctamente, se requiere resolver y probar esta semántica. Si el contrato actual no permite representarla con fidelidad, hay que revisar el alcance antes de prometer que bastará con frontend.

### 12.5. Redondeos: el importe del reporte no equivale siempre al recalculado

El sistema conserva precisión interna de hasta diez decimales para mantener consistencia con sus consolidados. No debe cambiarse globalmente a dos decimales para adaptar este PDF.

Ejemplo real: el ACU `1.1.1.1.1`, cuyo PDF y Excel declaran **101,08**, resulta en **101,071403** al evaluar sus cantidades y precios con la función local existente; mostrado a dos decimales sería **101,07**. Se observaron más diferencias pequeñas en la exploración. No deben confundirse con los errores porcentuales de la sección anterior.

La futura implementación debe comparar tres valores separados: precio Excel, costo declarado PDF y costo calculado. Debe acordarse si se conserva el precio contractual de origen y cómo se presenta cualquier diferencia con el detalle/consolidado. La decisión tiene que persistir correctamente tras guardar y recargar; mantener el importe solo en la vista previa no resuelve el problema.

No se propone ajustar precios o cantidades artificialmente para hacer cuadrar los totales. El callback de importación actual actualiza el precio de presupuesto con el calculado, por lo que la revisión debe ocurrir antes de aplicarlo.

### 12.6. Otros casos presentes

- Se detectaron **146 encabezados de análisis sin rendimiento numérico**, por ejemplo `Rendimiento: mes` o `Rendimiento: gbl`. Deben tratarse como casos explícitos de origen, no como extracción fallida ni como un rendimiento 1 confirmado por el documento.
- Se detectaron **2.540 apariciones de `%mo`** y las seis de `%mt`. Herramientas manuales `%mo` ya tiene una regla específica en el cálculo actual; sigue necesitando conciliación de redondeos.
- Los 25 análisis auxiliares no deben crearse como partidas presupuestales adicionales. El modelo actual puede representar el componente subpartida con código y precio, pero reutilizar su desglose auxiliar como análisis editable requiere evaluar cómo se representará.
- Un documento con 3.100 ACU exige medir el guardado secuencial y las recalculaciones del backend. No se midió su duración ni se recomienda paralelizarlo sin pruebas.

### 12.7. Plan ajustado para estos archivos

1. **Fijar las decisiones de fidelidad:** corrección contextual del grupo ambiental, representación de `%mt`, tratamiento de rendimientos ausentes y política de diferencias entre precio contractual y cálculo interno.
2. **Construir el lector PDF aislado:** mantener los lectores Excel; separar principales y auxiliares; conservar diagnósticos por página y validar componentes/subtotales.
3. **Revisión antes de aplicar:** mostrar las 3.100 coincidencias, los conflictos reales y los importes que cambiarían. No autorizar aplicación masiva mientras existan incompatibilidades críticas pendientes.
4. **Resolver compatibilidad numérica con alcance explícito:** probar la representación elegida en las funciones locales y backend; evitar cambios globales de redondeo o porcentajes que afecten proyectos existentes.
5. **Validar en un proyecto de prueba independiente:** importar, guardar, recargar y comparar jerarquía, 3.100 códigos, componentes, costos y consolidados. Probar también Excel S10 y Delphin, cancelación y reintentos. Antes de usar un proyecto existente, disponer de un respaldo recuperable y una vista previa de los reemplazos.
6. **Comprobar carga real:** medir extracción de 616 páginas y persistencia de 3.100 ACU, con progreso y control de errores. No anunciar guardado completo si quedan ACU pendientes.

La revisión de originales revela trabajo adicional frente al presupuesto inicial de un lector PDF: jerarquía ambigua, porcentajes y política de redondeo. Para una importación **completa** de este par de archivos, reservar **48–72 horas, aproximadamente 6–9 días laborables** de una persona. Incluye una previsión adicional de 16–24 horas sobre las 32–48 iniciales para esos casos y sus regresiones. Se reestima si resolver la fidelidad exige ampliar el modelo de datos o si las mediciones del guardado requieren una optimización aparte. No incluye OCR, que no se necesita según esta revisión.

### 12.8. Qué cambió en el repositorio y qué no se ejecutó

Solo se actualizó este documento. Los archivos originales, código de aplicación, dependencias y base de datos no se modificaron. Se realizaron lecturas con `Get-Item`, `Get-Content`, búsquedas con `rg`, `git status --short` y comprobaciones exploratorias en memoria mediante Python/Node y funciones existentes.

No se ejecutaron importaciones en la aplicación, peticiones de guardado, migraciones, suites de tests, `npm run types` ni `npm run build`. Estas comprobaciones corresponden a la futura implementación; esta revisión no demuestra todavía ausencia de regresiones ni persistencia correcta.

**Dictamen actualizado:** sí se puede implementar el soporte de estos archivos con cambios controlados y validación previa. **No es seguro habilitar el PDF y aplicar sus componentes directamente al flujo actual** sin resolver los casos numéricos y la jerarquía identificados. Esta revisión no produjo cambios en ningún presupuesto del sistema.

## 13. Fase de prueba local implementada

### Solución de la numeración

`1.1` y `1.10` son códigos jerárquicos, no números decimales. Deben conservarse como texto. Para este Excel, el laboratorio detecta la celda numérica repetida `A4511` y comprueba sus hijos directos `1.10.1` y `1.10.2`. Propone cambiar **solo esa celda en una copia en memoria** a texto `1.10`.

La propuesta exige código numérico duplicado, ausencia de unidad de partida, un cero final perdido dentro del mismo padre, inexistencia del destino y al menos dos hijos directos distintos como evidencia. No transforma todos los `1.1`, no cambia códigos de texto y no elige entre propuestas que competirían por el mismo destino.

Resultado con el original: se conservan el grupo `1.1` y sus hijos; se recupera el grupo `1.10` y sus hijos; la vista previa pasa de 4.532 a **4.533 filas**, mantiene las **3.100 partidas** y no produce advertencias de jerarquía. Los bytes del Excel no se modifican.

### Uso local

En PowerShell, desde la raíz del proyecto:

```powershell
npm.cmd run s10:lab
npm.cmd run s10:lab:test
```

El primer comando lee por defecto los dos originales de Veterinaria. Genera:

- `planes/costos/s10-lab-local/informe.html`: abrir localmente; incluye la propuesta de jerarquía, tabla buscable de partidas y observaciones de extracción.
- `planes/costos/s10-lab-local/informe.json`: evidencia detallada, componentes, análisis auxiliares y huellas SHA-256 de los originales.

Para otros archivos del mismo formato de prueba:

```powershell
npm.cmd run s10:lab -- --pdf "ruta/acu.pdf" --budget "ruta/presupuesto.xls" --output "planes/costos/s10-lab-local"
```

También admite `--python "ruta/al/python.exe"`. Requiere Node, las dependencias npm del proyecto y el PyMuPDF que ya estaba disponible localmente. No instala paquetes, no levanta servidores y no necesita entrar a Laravel. No debe presentarse todavía como lector universal de reportes S10 ni como parte del despliegue web.

### Qué hace el lector

`scripts/s10_import_pdf.py` reconstruye columnas a partir de coordenadas y encabezados del PDF, une descripciones y dígitos envueltos, mantiene los valores ausentes como ausentes y separa los ACU principales de los auxiliares. Compara cantidad/precio con el parcial, componentes con subtotal y subtotales con costo declarado. Un dato ilegible o un formato no reconocido queda señalado, sin completar precios o unidades por suposición.

`scripts/s10-import-lab.mjs` ejecuta las funciones existentes del parser de presupuesto, vinculador y cálculo local mediante transpilación en memoria. No monta hooks React ni llama a endpoints. La propuesta de jerarquía y la comparación se realizan sobre copias; el informe tiene `canPersist: false` y no contiene una acción para guardar en proyectos.

Los SHA-256 de origen se verifican antes de publicar el informe. La prueba con los originales comprueba además igualdad de bytes antes y después.

### Resultados de la ejecución

- **616 páginas**, **3.100 ACU principales**, **25 auxiliares** y **16.711 componentes**.
- **3.100/3.100 vínculos**, sin destinos ambiguos y sin diferencias de precio declarado PDF/Excel.
- Parciales Excel: **S/ 31.708.502,40**.
- **882 partidas con diferencias al comparar el cálculo actual a dos decimales con el costo declarado**. Este dato no implica que todas tengan el mismo problema: incluye las incompatibilidades porcentuales y diferencias de precisión/representación.
- **6 componentes `%mt`** se conservan como porcentaje de origen y se identifican como incompatibles con el cálculo actual; no se convierten ni aplican silenciosamente.
- **146 ACU principales sin rendimiento numérico**: continúan sin un valor inventado.
- **51 observaciones de lectura/datos**: 50 componentes con unidad vacía y un componente cuyo precio extraído no concilia con su parcial. Este último es `390010079`, partida `1.5.9.11.1.3`, página 531: precio extraído `502156.4`, cantidad 1, parcial declarado `502156.49`. No se reconstruye un dígito ausente a partir del resultado.

### Archivos y verificaciones

Añadidos:

- `scripts/s10_import_pdf.py` y `scripts/s10_import_pdf_test.py`.
- `scripts/s10-import-lab.mjs` y `scripts/s10-import-lab.test.mjs`.

Modificados: scripts de ejecución en `package.json`, exclusiones de informes locales/caché Python en `.gitignore` y este documento. Los lectores y componentes actuales de la aplicación no se modifican.

Verificación realizada:

- `npm.cmd run s10:lab`: informe generado con los originales.
- `npm.cmd run s10:lab:test`: pruebas Node, pruebas Python y prueba de integración de lectura con ambos originales.
- `npm.cmd test -- resources/js/pages/costos/delphin/helpers/parseS10Excel.test.ts resources/js/pages/costos/delphin/hooks/useDelphinData.test.ts resources/js/pages/costos/presupuesto/components/AcuPanel.test.ts resources/js/pages/costos/delphin/components/InsumosConsolidadosModal.test.ts`: **21 pruebas existentes aprobadas**.
- `npm.cmd run types`: aprobado.
- `git diff --check`: sin problemas de espacios en los cambios versionados.

No se ejecutó `npm run build`: esta fase agrega herramientas locales independientes, sin modificar fuentes de la aplicación ni Vite. Tampoco se ejecutaron tests PHP, migraciones ni guardados, porque no se modificó backend ni se conectó el laboratorio a base de datos.

**Límite de esta entrega:** la corrección de jerarquía está probada en el laboratorio, no aplicada al importador de uso habitual. Los porcentajes, redondeos, rendimientos ausentes y unidades vacías se diagnostican; resolver cómo persistirlos con fidelidad corresponde a la siguiente fase. Activar el guardado sin resolverlos contradiría el aislamiento solicitado para esta prueba.

## 14. Prueba PDF desde el presupuesto

### Causa del selector bloqueado y solución

La fase 13 era una herramienta de consola: el modal seguía aceptando solo Excel. Se conectó el lector Python ya probado al servidor de desarrollo Vite mediante `scripts/s10-pdf-lab-plugin.ts`. La comunicación es un POST de bytes PDF al middleware local `/__s10-pdf-lab`; no se agregó una ruta ni un controlador Laravel.

El middleware se registra con `apply: 'serve'`, exige conexión de loopback y origen local conocido, valida formato/tamaño (20 MB), limita la concurrencia, usa un archivo temporal generado por el proceso y lo elimina al terminar. Tiene timeout y propaga la cancelación al proceso de lectura. El nombre del archivo recibido no se usa para construir comandos ni destinos.

La interfaz usa `import.meta.env.DEV`. En un build de producción el selector conserva Excel y no puede ejecutar este lector. Referencias del mecanismo: [configureServer de Vite](https://vite.dev/guide/api-plugin.html#configureserver) y [constantes de entorno de Vite](https://vite.dev/guide/env-and-mode.html).

### Cómo probarlo

1. Mantener `npm.cmd run dev` activo. Al terminar esta implementación se dejó iniciado el servidor local; no hace falta iniciar otro mientras siga activo.
2. Recargar el presupuesto en el navegador para tomar los módulos de desarrollo.
3. Abrir **Importar → Desde S10 (Excel / PDF local) → 2 ACUs**. Si el presupuesto ya está cargado, no hace falta reimportar el Excel.
4. Seleccionar `ACU VETERINARIA OK.pdf`. Ahora el selector admite `.xlsx,.xls,.pdf` en ese paso y origen.
5. Revisar vínculos, costos y observaciones en el mismo modal. El PDF inicia **sin seleccionar ACU para cargar**.
6. Opcionalmente marcar «Incluir únicamente los … ACU compatibles» y pulsar «Cargar … en vista». Esta acción utiliza la aplicación local existente; el guardado posterior sigue siendo una acción explícita del usuario.

La entrada de Delphin Excel y el paso del presupuesto mantienen sus lectores. Solo el paso de ACU del origen S10 ofrece PDF durante desarrollo. Si se usa la aplicación compilada, se muestra la instrucción de iniciar desarrollo y recargar.

### Condiciones de carga y resultado real

Leer 3.100 ACU no significa que los 3.100 puedan aplicarse fielmente al motor actual. El nuevo helper `previewS10Pdf.ts` compara el archivo con **las partidas del presupuesto que está abierto**, comprueba unicidad de destino, unidad, rendimiento, componentes, observaciones de lectura, porcentajes y costos.

Solo habilita la carga cuando el costo recalculado **coincide exactamente, incluida la precisión interna**, con el PDF y con el precio de la partida. Un importe que solo coincide visualmente a dos decimales no basta: evitar el cambio de precio es parte de esta fase de prueba. No se cambian cantidades/precios para hacerlos coincidir. Los casos restantes quedan visibles con motivos y página de origen.

Con el PDF y Excel originales de esta revisión:

- Lectura: **616 páginas, 3.100 ACU principales y 25 auxiliares**.
- Vínculos: **3.100** contra el presupuesto Excel de referencia.
- Carga habilitada bajo todas las condiciones conservadoras: **313 ACU**.
- Los demás **2.787** permanecen pendientes de revisión; no todos representan el mismo problema ni necesariamente un error del documento.

La cantidad compatible se calcula de nuevo para el presupuesto abierto: puede variar si sus precios, códigos o unidades ya fueron modificados. El criterio estricto es deliberado para esta prueba y no resuelve todavía la política de redondeo/porcentajes de una importación completa.

### Verificación y archivos

- **38 pruebas Vitest aprobadas**: incluyen el middleware, carga HTTP del PDF real, comparación con el presupuesto, restricciones de porcentajes/precisión/duplicados, respuesta incompleta, panel y las 21 regresiones existentes.
- `npm.cmd run types`: aprobado. Se repitió tras terminar la generación de rutas, porque ejecutarlo mientras Wayfinder regeneraba esos archivos produjo temporalmente referencias a archivos eliminados durante la regeneración.
- Prueba HTTP contra el servidor Vite activo: **200**, 616 páginas y 3.100 ACU principales; módulo del modal servido con selector PDF.
- `npm.cmd run s10:lab:ui-test`: **aprobado en navegador headless aislado**. Seleccionó el PDF desde un input real, confirmó que la carga estaba inicialmente desmarcada y entregó **313 payloads** únicamente a un callback de prueba del modal. No montó el presupuesto real ni ejecutó su guardado. El navegador requirió ejecución fuera del entorno restringido para mantenerse abierto.

La prueba de navegador reutiliza la utilidad Chrome/Edge existente, crea un perfil temporal propio y lo cierra al terminar. No accede a la sesión del usuario. Requiere que `npm.cmd run dev` siga activo y los originales de Veterinaria estén disponibles.

Archivos de esta fase:

- `scripts/s10-pdf-lab-plugin.ts`, `scripts/s10-pdf-ui-smoke.mjs` y registro del middleware en `vite.config.ts`.
- `resources/js/pages/costos/delphin/helpers/previewS10Pdf.ts` y sus pruebas; pruebas HTTP en `s10PdfLabServer.test.ts`.
- `resources/js/pages/costos/delphin/components/S10PdfPreviewPanel.tsx` y sus pruebas.
- Integración en `ImportDelphinModal.tsx`, etiqueta local en `DelphinToolbar.tsx`, comando `s10:lab:ui-test` en `package.json` y este plan.

No se ejecutó build de producción ni se modificó PHP, base de datos o archivos originales. La corrección de `1.10` sigue siendo una propuesta del laboratorio de jerarquía; esta fase no renumera automáticamente un presupuesto existente.

## 15. Corrección de archivo sin extensión que aparecía como 0 ACU

Se verificó el archivo concreto `C:\Users\admin\Downloads\ACU VETERINARIA OK`: no tiene extensión, contiene 5.078.523 bytes y su SHA-256 coincide con el PDF original del proyecto. No estaba vacío. El modal elegía el lector por el sufijo `.pdf`; al faltar, lo enviaba al lector Excel, cuya advertencia de cero ACU no se mostraba en esa tarjeta.

Se añadió `helpers/detectAcuFile.ts`: inspecciona los primeros 1.024 bytes y reconoce `%PDF-` sin depender del nombre ni del MIME. Conserva el soporte Excel y reconoce sus firmas binarias; rechaza archivos vacíos o desconocidos y un archivo que se presenta como PDF sin contener su encabezado.

El modal registra el formato detectado para elegir lector, icono y cancelación. En S10 local el selector permite todos los nombres para admitir archivos sin extensión; el contenido se valida antes de procesarlo. Una lectura sin ACU ahora termina en un error visible con explicación, tanto para Excel como para PDF, en lugar de una tarjeta de importación exitosa con cero registros.

`readLocalS10Pdf` usa la misma identificación de contenido y rechaza respuestas válidas en estructura pero sin ACU principales. La prueba de navegador genera una copia del PDF **sin extensión y con MIME no declarado**, como el archivo de Descargas; el original no se renombra ni se modifica.

Verificación posterior:

- **46 pruebas Vitest aprobadas**, incluyendo detección sin extensión, extensión incorrecta, formatos binarios Excel, archivo vacío, PDF falso, lectura sin registros, HTTP y regresiones.
- `npm.cmd run types`: aprobado.
- `npm.cmd run s10:lab:ui-test`: aprobado en navegador aislado con `ACU VETERINARIA OK` sin extensión; reconoce **3.100 ACU** y entrega **313 compatibles** exclusivamente al callback de prueba, sin escrituras en proyectos reales.

La opción continúa siendo una prueba de desarrollo local: requiere `npm.cmd run dev` activo. Ejecutar build no habilita el middleware local. La captura del fallo ya mostraba el panel de desarrollo; en ese caso la causa confirmada fue el nombre sin extensión, no un PDF vacío.

Para repetir en el presupuesto: recargar, volver a seleccionar el mismo archivo sin renombrarlo y revisar el panel PDF. No se requiere cambiar los originales ni repetir el build para esta prueba.

## 16. Importación completa y panel actualizado después de cargar

### Causas confirmadas de las capturas con 2.787 ACU ausentes

El filtro de la fase de prueba permitía cargar solo 313 de los 3.100 ACU. Los otros 2.787 se bloqueaban por exigir igualdad entre el recálculo de alta precisión y el importe del reporte, o por datos de origen ausentes. Esto no indicaba que el lector hubiera leído solo 100 partidas.

Se encontró además un fallo del panel: si la partida seleccionada era la misma antes y después de importar, podía conservar la plantilla vacía. Ahora se actualiza al recibir el ACU de esa misma partida cuando no existe una edición local pendiente. Los recursos PDF tampoco se rederivan automáticamente de cuadrilla/horas al abrirlos.

### Solución de fidelidad y persistencia

Cada componente importado conserva `source_pdf` dentro de las columnas JSON existentes: cantidad, precio, parcial, unidad, código, rendimiento y página de origen. Se preservan las ausencias originales de rendimiento/unidad; el valor técnico requerido por el formulario se muestra con una advertencia, sin inferir cuadrillas.

Frontend y backend reconocen los parciales originales únicamente mientras los recursos y el rendimiento no cambien. Si se edita un recurso, vuelve el cálculo habitual; los porcentajes `%mt` de origen mantienen su interpretación porcentual. Los ACU sin procedencia PDF conservan sus reglas anteriores.

La carga PDF no reemplaza los precios del presupuesto Excel. El guardado y la sincronización posterior respetan los parciales importados; para estas partidas se mantiene el redondeo contractual a dos decimales por partida. Los insumos consolidados utilizan los importes de origen y distribuyen el ajuste de redondeo de la partida, conservando cantidades y precios originales de los recursos. Las reglas de alta precisión de ACU existentes sin esta procedencia permanecen intactas.

Para la partida de oficinas se verifica: rendimiento **25**, dos filas de mano de obra, cinco materiales, equipo y subpartida; costo **101,08**, con primer parcial **18,82**. El total de las 3.100 partidas y sus insumos consolidados reconcilia al céntimo con **S/ 31.708.502,40**.

Se carga el conjunto mediante una actualización de estado por lote para evitar miles de recorridos de la lista. El guardado sigue mostrando su progreso y conserva el mecanismo secuencial existente. Las lecturas/sincronizaciones no sustituyen los precios de origen ni recalculan todo el presupuesto por cada ACU PDF guardado.

### Build local

El lector está disponible mediante una acción autenticada del proyecto en Laravel: `POST /costos/proyectos/{project}/presupuesto/acus/preview-pdf`. Un FormRequest restringe su uso al entorno `local` y valida los bytes del PDF; el controlador comprueba propietario y módulo habilitado. Python recibe los bytes por stdin, sin depender de extensión, nombre de archivo, Vite ni un nuevo servicio externo.

La página comunica si el lector local está habilitado. Por eso **la importación funciona con build en el entorno local**; ya no requiere `npm run dev` para un presupuesto real. La conexión Vite anterior solo se conserva para las pruebas aisladas con proyecto ficticio. El ejecutable Python puede configurarse con `S10_PDF_PYTHON` si el entorno lo requiere; en esta máquina se comprobó la lectura completa desde PHP.

No se ejecutó el build, por instrucción del usuario. Siguiente paso manual:

```powershell
npm.cmd run build
```

Después: recargar completamente el presupuesto, abrir S10 → ACU, volver a seleccionar el PDF, comprobar **3.100 seleccionables**, incluirlos, cargar en vista y usar Guardar. No hace falta volver a importar ni renumerar el presupuesto Excel para completar los ACU de las partidas existentes. La carga reemplaza los ACU coincidentes por partida y completa los ausentes, sin crear duplicados por diferencias de ceros iniciales.

El inspector tiene páginas de 100 filas con Anterior/Siguiente y aclara que la carga abarca todo el conjunto seleccionado, no solo la página visible. Las advertencias de origen, incluida la unidad truncada en una partida, permanecen revisables y ya no producen partidas vacías por una diferencia de formato o redondeo.

### Verificación realizada

- **48 pruebas frontend aprobadas** en ocho archivos, incluidas las regresiones Excel/Delphin y los casos PDF.
- Prueba con ambos originales: **3.100 vínculos y 3.100 payloads**, todos normalizados y serializados/recargados sin perder su costo de origen; total de presupuesto y consolidados **31.708.502,40** a dos decimales.
- Validación cruzada de los **3.100 payloads con el FormRequest y el cálculo PHP reales**, sin escrituras en proyectos: todos aceptados y reconocidos como datos PDF íntegros.
- **18 pruebas Pest aprobadas** (47 aserciones), incluidas persistencia y recarga en SQLite en memoria, conservación del precio, redondeo fuente frente a legado, edición y errores de lectura.
- PHP ejecutó el lector real por stdin: **616 páginas y 3.100 ACU**, primer costo 101,08 y rendimiento 25.
- Navegador aislado con el hook de ACU y `AcuPanel` reales: **3.100 registros en estado y pendientes de guardado**, primer panel con OPERARIO/OFICIAL, rendimiento 25, dos filas MO, cinco materiales y total 101,08. No escribió en un proyecto real.
- `npm.cmd run types` y `php vendor/bin/pint --dirty --format agent`: aprobados.
- `git diff --check`: sin errores de espacios.

Archivos principales: `S10PdfSnapshot.php`, `S10PdfReader.php`, los FormRequest de cálculo/lectura, `PresupuestoController.php`, `CostoDatabaseService.php`, `usePresupuestoAcu.ts`, `previewS10Pdf.ts`, modal/panel de revisión, `AcuPanel.tsx`, consolidado y sus pruebas. La procedencia se almacena en JSON existente; no hay tablas ni columnas nuevas.

No se ejecutó una importación ni un guardado sobre la base de datos del usuario. La validación masiva fue de datos y cálculo; la prueba de escritura usó exclusivamente SQLite en memoria. El usuario realizará el build y la importación final en su presupuesto.

## 17. Liberación del lector en producción

Se retira la condición `APP_ENV=local` del indicador de interfaz y de la solicitud de lectura. El endpoint Laravel existente funciona con assets compilados, conserva autenticación, acceso al proyecto y comprobación del módulo presupuesto. No se habilita acceso anónimo. Se mantienen revisión previa, selección explícita, límite de 20 MB y guardado existente. El laboratorio Vite continúa aislado y solo sirve para pruebas de desarrollo.

Requisitos del servidor: Python con PyMuPDF (ya utilizado por este lector), ejecución de procesos desde PHP y presencia de `scripts/s10_import_pdf.py` en el despliegue. Configurar `S10_PDF_PYTHON` con el ejecutable correcto, por ejemplo `/var/www/venvs/s10/bin/python` o `python3`. El Python indicado debe permitir ejecutar `-c "import fitz"`; no basta con que PyMuPDF esté instalado en el equipo del desarrollador. El despliegue comprueba este requisito antes del build, sin instalar paquetes automáticamente. Mantener el límite HTTP/PHP por encima del tamaño del PDF y un timeout compatible con la lectura (hasta 120 segundos).

Publicación: desplegar los archivos PHP, React y el script Python; configurar el ejecutable; compilar con `npm run build` y renovar la caché de configuración según el flujo habitual de despliegue. No requiere migraciones nuevas. El build y la publicación real quedan a cargo del usuario; no se ejecutaron en este cambio.

Verificación de liberación: 22 pruebas frontend y 21 pruebas backend aprobadas. Se comprueba lectura desde un build sin Vite y permisos del controlador en entorno `production`, incluidos rechazo de proyecto ajeno y módulo deshabilitado. Las pruebas no escriben en proyectos reales.
