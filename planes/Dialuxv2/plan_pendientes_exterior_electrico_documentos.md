# Plan: levantar los pendientes (exterior, eléctrico, documentos)

> 2026-09-25. Continúa `plan_red_ct_dimensionamiento_multimodulo.md` y `estrategia_tesis_innovacion_dialux_web.md`.
> Reglas: agregar sin destruir (V1 intacta), fórmula con fuente + caso a mano en test, nunca "cumple" sin fuente confirmada, el usuario prueba en el navegador.

| Fase | Qué | Por qué | Estado |
|---|---|---|---|
| **X1** | Catálogo de alumbrado exterior: EN 12464-2 (circulación, estacionamientos) y EN 13201-2 (clases P y C), como región "Exterior" del emplazamiento; verificación Ē **y** Emín; sugerencia por tipo de espacio | Hoy el Ēm "· norma" exterior sale de catálogos de interiores | Hecho (2026-09-25) — falta prueba del usuario |
| X2 | Rampas y escaleras como superficie inclinada real (plano por tramo) | Hoy: plano horizontal a cota media | Pendiente |
| X3 | Cálculo exterior en Web Worker (no congela la pantalla con terrenos grandes) | Rendimiento | Pendiente |
| E1 | Auto-circuitado de la planta (postes/tomas → circuitos por reglas, fases balanceadas, sección por ΔU) | Tarea más larga del flujo manual (P1 de la tesis) | Hecho (2026-09-25) — `siteAutoCircuit.ts` + `SiteAutoCircuitPanel.tsx`; falta prueba del usuario |
| E2 | Unifilar de la red exportable (DXF/PDF) | Plano que se entrega | Hecho (2026-09-25) — botón "Unifilar" en Red y CT; falta prueba del usuario (abrir el DXF en AutoCAD) |
| E3 | Catálogo N2XOH en BD (hoy solo THW-90) | Ampacidad no verificable para el cable por defecto | Hecho (2026-09-25) — migración `2026_09_25_000001` + seeder; aplicada en local, **falta en producción** |
| D1 | DXF de la planta general (pipeline DXF de la V1) | T6 exterior (P5) | Hecho (2026-09-25) — botón "DXF" en la barra de la planta; falta prueba en AutoCAD |
| D2 | Reporte único planta general + módulos | T8 (P4) | Parcial (2026-09-25) — informe PDF de la PLANTA GENERAL (botón "PDF"); falta unirlo con los informes de cada módulo |
| D3 | Cronómetro de tareas (telemetría local exportable) | Evidencia H1 de la tesis (P7) | Pendiente |
| V1 | Caso exterior validado contra Radiance | Evidencia H2 de la tesis | Pendiente |

## X1 — Catálogo exterior (detalle)
- Archivo propio `v2/site/domain/exteriorNormCatalog.ts` (no toca `normativeEngine` de la V1).
- Fuentes: EN 12464-2:2014 Tabla 5.1 (circulación en lugares de trabajo exteriores) y Tabla 5.9 (estacionamientos); EN 13201-2:2015 Tabla 3 (clases P) y Tabla 2 (clases C). **Valores de conocimiento general, pendientes de confirmar contra el texto oficial**: la interfaz lo dice y la comparación es numérica ("≥ norma"), nunca "cumple".
- Clases M (luminancia) NO se incluyen: el sistema no calcula luminancia de calzada con tablas r (se agregarían con esa fase).
- Clases P: el requisito es Ē **y** Emín.

## E1 — Auto-circuitado (detalle)
- Botón "Auto-circuitar este tablero" en Propiedades de un TG / sub tablero de la planta: Proponer → cables punteados por fase en el 2D + tabla (puntos, W, fase, mm², ΔU) → Aplicar (un solo Ctrl+Z).
- Solo cargas sin cablear y más cercanas a ese tablero; alumbrado y tomas separados; barrido angular (Gillett & Miller 1974) con máx. W / puntos editables (criterio de proyecto: 2000 W / 12 puntos alumbrado, 1800 W / 8 tomas); cadena por vecino más cercano; fases LPT partiendo de las salidas existentes (nuevo campo opcional `SiteCircuit.phase`, respetado por `siteOutputs`); sección = la menor de 2,5…25 mm² con ΔU y capacidad OK en el motor CT de la V1 (con la caída real de la red hasta el tablero).
- Agrega salidas al TG si faltan libres (máx. 24).
- Limitación: cables en línea recta (no esquivan edificios); el usuario ajusta el recorrido.

## E2 — Unifilar (detalle)
- `electrical-network/domain/singleLineDiagram.ts` (modelo puro en mm: árbol ordenado, un nivel por fila, padre centrado sobre hijos) y `singleLineRender.ts` (SVG + DXF R12 con las primitivas DXF de la V1; capas UNIF-EQUIPOS / CONDUCTORES / TEXTO / ALERTAS / MARCO).
- Contenido: suministro (kVA), medidor, TG, sub tableros, tableros de módulo (sistema, n.º de circuitos), salidas de la planta (motor CT V1). Por tramo: conductor, sección, L, ITM, ΔU propia y acumulada. Por tablero: Pd (con fs), I″k. En rojo: fuera del límite configurado, Icu < I″k o sección que no soporta la falla.
- `SingleLineDiagramDialog.tsx`: vista previa + DXF + SVG + Imprimir/PDF (diálogo del navegador).
- No incluye todavía los circuitos internos de cada módulo (van en el cuadro de cargas del módulo) ni cajetín normalizado por lámina.

## E3 — Catálogo N2XOH (detalle)
- 17 secciones (2,5–500 mm²) = columna N2X0H de la Tabla A del Excel (`planes/Dialux/plan_caida_tension.md` §1.4), la MISMA que ya usa el motor CT de la V1 (`wireLengthCalculations.ts`). Test Pest que lee esa tabla del código TS y exige que la BD coincida.
- Efecto: Red y CT, el optimizador R5 y el auto-circuitado ya verifican ampacidad del N2XOH (antes: aviso "no hay conductores" y sin verificación).
- **Hallazgo abierto (no tocado):** el THW-90 del catálogo BD (20/25/35… A) NO coincide con la columna THW de la Tabla A que usa el motor V1 (27/34/44… A). Hay que decidir cuál rige.
- Producción: correr `php artisan migrate` en el deploy.

## D1 — DXF de la planta general (detalle)
- `v2/site/domain/siteDxfExport.ts` (`buildSiteDxf`, `summarizeSiteForDxf`): metros reales (vértices × `terrainScaleM`, Y hacia arriba), DXF R12 con las primitivas de la V1 y el envoltorio común `export/dxf/emitters/document.ts` (archivo nuevo; el unifilar E2 ahora también lo usa).
- Capas: EMP-TERRENO / EDIFICACION / VIAS / ESPACIOS / CERCOS / ALUMBRADO / TOMAS / TABLEROS / CAJAS / CABLEADO / ALIMENTADORES / TEXTO / MARCO. Postes = círculo + brazo + cabeza(s) de luminaria (misma geometría que el cálculo); cables con rótulo de sección; cuadro resumen (postes, kW de alumbrado, tomas, tableros, metrado de cable por tipo y sección con el MISMO largo que Red y CT); marco y título.
- Respeta objetos ocultos y capas apagadas del editor.
- Pendiente: láminas con cajetín y escala normalizada (el pipeline multi-lámina de la V1 es por nivel de módulo), símbolos formales de leyenda.

## D2 — Informe PDF de la planta general (detalle)
- Reutiliza el generador PDF del servidor de la V1 (documento formal → `formal-pdf.blade.php`, Dompdf + FPDI) vía `formalExportModule` con el Módulo General. Único cambio de servidor: tipo de página genérico `site-section` (notas + gráficos + tablas/resúmenes estructurados), apaisado, y reglas `data.columns/rows` en `FormalExportRequest` (sin ellas `validated()` descartaría las filas).
- Documento (`v2/site/export/buildSiteFormalDocument.ts`): portada con plano, índice, resumen y método, plano general (SVG en metros, `siteSvgPlan.ts`), falsos colores por parche con leyenda y escala gráfica, superficies de cálculo (Ēm/Emín/Emáx/U0, luminarias propias/exactas y cobertura de la V1, norma elegida "≥/< norma" con fuente), luminarias agrupadas, salidas de tableros (motor CT V1), metrado de cable.
- Botón "PDF" en la barra de la planta (`useSitePdfExport.ts`). Avisa si el cálculo está desactualizado o no se ejecutó.
- Pendiente: un solo PDF que una planta general + módulos; nombre de producto en la lista de luminarias (hoy "catálogo #id"); si los falsos colores de terrenos enormes hacen lento el PDF, pasar a bitmap.

### D2 — Fichas por zona (2026-09-25)
- Cada superficie de cálculo exterior lleva las MISMAS 5 páginas por ambiente del informe de la V1 (`ambient-summary`, `ambient-plan`, `ambient-luminaires`, `ambient-calculation-object`, `ambient-useful-plane`), alimentadas con un `DialuxAmbientDetail` por zona (`v2/site/export/siteZoneReport.ts`): plano de la zona con luminarias numeradas y la malla donde se calcula, falsos colores con el valor en lx de los puntos, tabla de posiciones (x, y, altura de montaje), lista de luminarias agrupadas, objeto de cálculo (Ē/Emín/Emáx/U0/g2/índice de malla, parches).
- Exterior declarado en la ficha: sin techo/paredes ni UGR, plano útil a 0 m sin zona marginal, 12 h/día de uso. Verificación normativa en "No evaluado" (catálogo exterior sin confirmar); la comparación "≥/< norma" va en la etiqueta de la zona.
- `SiteLightingAreaResult.usedLuminaireIds`: qué luminarias entraron al cálculo de cada zona.
- **Gotcha resuelto:** Dompdf no dibuja SVG incrustado (solo sus textos) — el PDF de la planta de la primera versión salía sin planos. Ahora `rasterizeAssets.ts` convierte los planos a JPEG en el navegador antes de enviarlos, igual que la V1. Colores de lux como `rgb()` + `fill-opacity` (no `rgba()`).
- Verificado de punta a punta: documento real → servidor → PDF de 23 páginas (3 zonas × 5).

### D2 — Espacios y proyecciones, proyección movible (2026-09-25)
- **Proyección movible antes de colocar:** `projectionAdjust` en `useSiteLightingStore` (desplazamiento del conjunto + postes movidos a mano por índice). Postes fantasma arrastrables en el 2D (`ProjectionPreviewLayer`, Mayús = todos; escuchas en window, sin pointer capture), flechas y "Restablecer" (`ProjectionNudge.tsx`). Ēm en vivo y "Colocar" usan las posiciones ajustadas. En proyección lineal cada brazo se reorienta hacia la vía desde su posición final (`armTowardAxisDeg`). Techados no se mueven (regla de cumbrera). Después de colocar, cada poste es un objeto normal (se mueve como cualquiera).
- **Informe por ESPACIO, no por recinto:** al colocar se guarda `metadata.projection` en el espacio (modo, cantidad, disposición, separación, altura, Ēm objetivo, ajuste manual). La ficha de cada zona muestra "Información principal del espacio exterior": tipo de espacio, proyección de luminarias (texto), superficie de cálculo (cota, malla, parches), reflexiones "cielo abierto", mantenimiento por luminaria; el objeto de cálculo dice "Espacio:" en vez de "Recinto:". Campo opcional `DialuxAmbientDetail.exterior` (+ reglas en `FormalExportRequest`); los ambientes de la V1 no cambian.

### Proyección lineal que sigue los bordes reales (2026-09-25)
- Bug del usuario: en una vereda en L los postes seguían el eje recto del rectángulo mínimo (diagonal), quedando dentro de la vereda o lejos del borde.
- `linearSidesOf`: detecta los dos EXTREMOS (lados cortos ≤ 1,6 × ancho efectivo 2A/P, puntos medios más alejados) y devuelve los dos BORDES LARGOS como polilíneas. Los postes se reparten ½-1-1-½ sobre la longitud de cada borde, a 0,5 m fuera (o dentro) del tramo donde caen, brazo hacia el espacio. Unilateral/tresbolillo/pareada sobre esos bordes. Largo para la separación = media de los dos bordes; ancho W/h = 2A/P.
- En rectángulos el resultado es idéntico al anterior (pruebas previas intactas). Sin extremos reconocibles → eje recto como antes (con su aviso).
- Poste movido a mano: brazo hacia el borde más cercano del espacio (`armTowardSpaceDeg`).

### Curvas isolux y comparación siempre visible (2026-09-26)
- Curvas isolux ("ondas"): `v2/site/domain/isoluxContours.ts` (marching squares sobre la malla del motor V1 + unión en polilíneas, niveles 1…500 lx que cruzan la malla). En el 2D (`SiteIsoluxLayer`, botón "Curvas isolux", caché por resultado) y en los planos del PDF (`export/isoluxSvg.ts`: falsos colores general y por zona).
- Comparación con la norma nunca vacía: `effectiveNormChecks` usa la actividad elegida o, si no hay, la SUGERIDA del catálogo exterior (marcada "sugerida"). La tabla muestra Ē (y Emín) requerido y U0 requerido con ≥/<; la cobertura (tabla de cantidad de la V1) aparece también con la sugerida. Canchas sin sugerencia (EN 12193 no cargada).
- Curvas POR ESPACIO (2026-09-26, pedido del usuario "medir por espacio"): `areaIsoluxLevels` (serie 1-2-5 dentro del rango del espacio; si es angosto, pasos 1-2-2,5-5 lineales; máx. 8) + `areaIsolines` (curva roja discontinua del Ē exigido por la norma efectiva del espacio, `requiredLuxFor`). Mismos niveles para todos los parches del espacio. Leyenda del espacio enfocado (clic en la tabla) con sus niveles y la norma. En el PDF: plano general (por espacio) y plano útil de cada zona.

### Cálculo por espacio como DIALux evo + fix 422 del PDF (2026-09-26)
- **422 del PDF (reproducido con los datos reales del proyecto 9):** `requirementEvaluations.*.unit` vacía en la evaluación de uniformidad → ahora 'ratio' como la V1. El botón PDF muestra el primer campo rechazado si vuelve a ocurrir. Con los datos reales: 0 errores de validación y PDF de 79 páginas.
- **Objeto de cálculo por espacio** (`SiteElement.calcSurface`): malla 'standard' = EN 12464 p = 0,2·5^log10(d) (tope 10 m; lo que usa DIALux evo, por defecto), 'fine' (~2500 pts, el criterio anterior) o 'custom' (paso propio, tope 20000 puntos) + altura del plano. Resultado por espacio: `gridMode`, `gridBasis`, `gridPoints`, `planeHeightM`.
- **Calcular solo un espacio** (`runArea` en `useSiteLightingCalculation`): en Propiedades → "Superficie de cálculo" y botón ↻ por fila de la tabla; se integra al cálculo existente.
- PDF: la ficha de cada espacio dice su malla (norma y paso), puntos y altura del plano.

### Cableado por conexiones, rampa entre edificaciones y estacionamiento 3D (2026-09-26)
- **Cableado por conexiones** (`domain/circuitSplit.ts`): un recorrido dibujado por varios objetos se guarda como UNA conexión por objeto (TG→P1, P1→P2…), conservando salida, fase (solo el 1.er tramo), sección, tendido por tramo; antes era un solo cable y los objetos intermedios NO quedaban conectados en el cálculo. Continuaciones también se separan. Cables viejos: botón "Separar por objetos". Borrado: papelera = solo esa conexión; "desde aquí" = esa conexión y lo que cuelga aguas abajo (`downstreamCircuitIds`, sin cruzar tableros).
- **Rampa/escalera entre edificaciones** (`levelLink.ts`, `levelTargets`): inicio/fin se conectan a plataformas O edificaciones (cota del piso = superficie bajo el edificio + su elevación propia, `siteElementBaseElevation`); cotas sugeridas y "acercar el FIN" también.
- **Estacionamiento invisible en 3D**: estaba dibujado DENTRO de la vereda (losa elevada 0,14 m) y su asfalto (0,08 m) quedaba tapado. Ahora calle/estacionamiento dentro de una vereda más grande se apoyan sobre ella (`raisedPavementUnder`).


### PDF por espacios y recintos, como la V1 / DIALux evo (2026-09-26)
- **Recintos = categorías de espacio** (`SITE_SPACE_GROUPS` en `export/siteZoneReport.ts`): Calles y veredas, Rampas y escaleras, Estacionamientos, Canchas, Techados, Plataformas y zonas, Áreas verdes, Terreno. Cada ficha lleva `roomId/roomName` del grupo.
- **Orden del informe**: resumen → planta → falsos colores → **Lista de luminarias** (proyecto, por producto, con nombre/fabricante del catálogo) → **Lista de espacios** (compacta) → **Comparación con las normas** (una fila por espacio × norma) → **Objetos de cálculo** → por recinto: **Lista de locales**, **Lista de luminarias**, **Objetos de cálculo** y las 5 páginas de cada espacio → postes → salidas → metrado. Índice: recinto (nivel 1) y espacio (nivel 2). Nombres repetidos se numeran ("Escalera 1/2/3").
- **Luminarias propias**: la ficha/local lista y suma solo las luminarias del espacio (`ownLuminaireIds`); las vecinas entran al cálculo y al plano y se avisan (`exterior-neighbour-luminaires`). Antes cada local listaba todas las que le aportan luz (totales ×N).
- **Espacios sin calcular**: un espacio cubierto por completo por otro (p. ej. techados duplicados superpuestos en el proyecto 9) ya no se omite en silencio: `calculation.skipped` + aviso + nota en la lista de espacios.
- **Visto (✓) del objeto de cálculo**: la plantilla lo dibujaba SIEMPRE (también en la V1, incluso con 0 lx); ahora solo con evaluación `pass`, "< req." con `fail`, nada sin evaluación.
- Paginación medida en el PDF real (hoja apaisada): 9 filas por hoja en lista de espacios y objetos de cálculo. ⚠️ La V1 usa 18 filas de objetos de cálculo por hoja y probablemente recorta a partir de la 10.ª (no tocado).
