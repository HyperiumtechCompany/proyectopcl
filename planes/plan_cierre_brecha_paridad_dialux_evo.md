# Plan de cierre de brecha de paridad con DIALux evo (benchmark Pozuzo vs. MÓDULO I)

## -21l. Ronda 21l — se revirtió `occlusion: true` (activado en la Ronda anterior, el mismo día): bug real de geometría con muros de contorno cerrado, medido en un proyecto real

El usuario probó el sistema contra un proyecto real ("Vinchos", id=1 en `dialux_projects`) con 2 "Aulas" comparadas contra un PDF de DIALux evo real (capturas de pantalla): DIALux evo reporta Ē=544/567 lx, Emin=276/302 lx, Emax=711/741 lx, Uo=0.51/0.53; el sistema propio (con `occlusion: true`, activado en la Ronda 21k del mismo día) reportó Ē=478.7/482.7, Emin=149.9/133.0, Emax=694.9/717.3, Uo=0.313/0.275 — **peor** en Emin y Uo que antes de activar oclusión, no mejor.

### Diagnóstico (reproducido con los datos reales del proyecto, no una hipótesis)

Se exportó la escena real de "Vinchos" (`DialuxProject::find(1)->data['scenes'][0]`) y se corrió `runProjectLightingCalculation` directamente con `occlusion: true` vs. `false`:

| | Ē avg | Emin | Emax | Uo |
|---|---:|---:|---:|---:|
| `occlusion: false` (revertido a esto) | 590.5 / 604.2 | 183.9 / 181.4 | 787.5 / 816.4 | 0.311 / 0.300 |
| `occlusion: true` (lo que se había activado) | 478.7 / 482.7 | 149.9 / 133.0 | 694.9 / 717.3 | 0.313 / 0.275 |
| DIALux evo (referencia real) | 544 / 567 | 276 / 302 | 711 / 741 | 0.51 / 0.53 |

`occlusion: false` es más cercano a la referencia en las 4 métricas — `occlusion: true` empeora Ē, Emin y Uo. **Causa raíz encontrada, no solo síntoma**: el ambiente tiene 2 muros interiores reales, dibujados con jambas de puerta. El editor guarda `wall.vertices` para este tipo de muro como el CONTORNO CERRADO completo (24+ vértices, primer punto == último punto, ya con el grosor incluido) — no como una polilínea de centro de 2 puntos. `buildLinearOcclusionBoxes()` (`domain/geometry/occlusionBoxes.ts`) no distingue los dos casos: trata cada par consecutivo de vértices del contorno como un segmento de centro y lo extruye por `thickness` OTRA VEZ, generando muchas cajas de obstrucción superpuestas mucho más grandes que el muro real de 0.13 m. Reproducido con un caso mínimo en `occlusionBoxes.test.ts` (7 cajas para 1 muro rectangular con 1 jamba, en vez de 1).

No es una geometría rara — es como el editor genera cualquier muro con una puerta empotrada, así que este bug afecta potencialmente a la mayoría de proyectos reales con muros interiores, no solo a este caso.

### Acción tomada

`buildProductionCalculationConfig` volvió a `occlusion: false` (mismo día que se activó). `productionCalculationConfig.test.ts` y el nuevo test en `occlusionBoxes.test.ts` quedan como guardianes: si alguien reactiva el flag sin corregir `buildLinearOcclusionBoxes()` primero, el test de geometría documenta exactamente por qué no debe hacerse todavía.

### Pendiente (Fase 6 del plan maestro, no resuelto en esta ronda)

Corregir `buildLinearOcclusionBoxes()` para reconocer un contorno cerrado (primer vértice == último) y tratarlo como una única extrusión de piso a techo con la forma real del muro, en vez de una polilínea de centro — o normalizar `wall.vertices` a un formato único (polilínea de centro siempre) en el punto donde el editor genera muros con jambas, antes de que llegue a `buildCalculationSnapshot.ts`. Cualquiera de las dos correcciones requiere entender primero cómo y dónde el editor genera esos 24+ vértices para muros con receso de puerta — no investigado en esta ronda (fuera del alcance de "revertir el default inseguro hoy mismo").

## -21k. Ronda 21k — el usuario entregó su catálogo real de luminarias; con AMBOS fixtures en fotometría real, el error cae de 38.9%/46.7% a 16.7%/1.3%

A pedido explícito del usuario ("ya tengo los datos reales usados"), se recibieron 5 archivos `.ldt` reales (carpeta `Catalogo_Luminarias/LUMINARIAS PARA DIALUX/`, luminarias efectivamente especificadas en proyectos reales "según plano"). Verificado uno por uno contra el catálogo real de la aplicación (`luminaire_products`, MySQL, no un mock):

| Archivo | Producto | Ya en catálogo? |
|---|---|---|
| `1. LEDVANCE 36W-4320lm/9649.ldt` | LEDVANCE PL VAL 600 36W/4000K UGR19 | No — importado hoy, id=59 |
| `2. 54W-6000lm/GRDR 126L96 OPTPA C84.ldt` | Dextra GRADUATE RECESSED LED | Sí, id=57 (`provenance: manufacturer`) |
| `3. 26w-2580lm/60739.ldt` | LTS FLIQ 400.3040.01_FLIQZ 400.24 | Parcial — id=9 ya existía pero de un `.ldt` DISTINTO (`108192.ldt`, 3411.1 lm); este archivo (`60739.ldt`, 2580 lm) se importó como registro nuevo, id=60. **Discrepancia sin resolver, reportada al usuario**: dos variantes de la misma familia de producto en catálogo, no se tocó ninguna. |
| `4. 14w-1508lm/47988.ldt` | Thorlux TEG18046 | Sí, id=13 (ya era la fuente de `TEG18046_PHOTOMETRIC_WEB`) |
| `5. L. REIOLUX 21W-2014lm/18900.ldt` | Regiolux relo-RDES-O 190 LED | Sí, id=58 (`provenance: manufacturer`) |

Los 2 imports nuevos se hicieron con `ProductImportService::import()` real (vía tinker, no un parser paralelo) y se verificaron persistidos en BD: `provenance: 'manufacturer'`, matriz de candela no vacía (id=59: 7 planos C × 181 gamma; id=60: 1 plano × 73 gamma, pico 1639.5 cd → 635.5 cd/klm, coincide con el rango 600-800 cd/klm que `fixtures.ts` ya estimaba para GF19140 antes de tener el archivo real).

**El hallazgo importante**: id=60 (26 W/2580 lm) es el mismo flujo/potencia que GF19140, el fixture `caseta-vs-guarderias` que llevaba meses "sin fotometría real, etiquetado no comparable". Se copió su `photometric_web` (byte a byte desde la BD, mismo método que `TEG18046_PHOTOMETRIC_WEB`) a un nuevo `GF19140_SUBSTITUTE_PHOTOMETRIC_WEB` en `realPhotometry.ts`, y se conectó al fixture. **No es la Thorlux GF19140 exacta** (fabricante distinto, LTS) — sigue sin conseguirse esa referencia puntual — pero es fotometría real de fábrica, y es la luminaria que el usuario confirmó como la realmente usada en sus proyectos reales para este tipo de ambiente.

### Resultado — `dialuxEvoParity.test.ts`, config de producción real (`auto-by-shape`)

| Fixture | Antes (sin fotometría real / GF19140 Lambertiano) | Ahora (ambos con fotometría real) |
|---|---:|---:|
| sshh-vs-bano | 38.9% | **16.7%** (first-bounce, auto-elegido por aspecto 2.33:1) |
| caseta-vs-guarderias | 46.7% (no comparable) | **1.3%** (iterative, auto-elegido por aspecto 1.05:1) — dentro del objetivo ±5% del usuario |

Dato adicional registrado, sin cambiar el default de producción: para `sshh-vs-bano`, el modo `iterative` (no el que auto-by-shape elige para este aspecto) da **5.2%**, mejor que el first-bounce elegido (16.7%) — contrario a lo que predecía la investigación histórica de `productionCalculationConfig.ts`, basada en un SS.HH de OTRO proyecto ("Módulo 22") con datos LDT distintos. Un caso nuevo no es evidencia suficiente para tocar el umbral 2.0:1 ya elegido (misma regla de "no sobreajustar a un solo caso" de este plan) — pero es la segunda vez que aparece esta señal, vale la pena revisar el umbral cuando haya un tercer caso real.

**Verificado**: `npx vitest run` sobre `dialuxEvoParity.test.ts` (6/6), `npm run types` limpio. Ningún archivo de producción (motor de cálculo) se tocó — solo el catálogo de datos de benchmark (`fixtures.ts`, `realPhotometry.ts`) y el catálogo real de productos (2 filas nuevas en `luminaire_products`).

### Pendiente para el usuario

Confirmar cuál de los dos productos "FLIQ 400.3040.01" (id=9, 3411.1 lm, `108192.ldt` — importado 2026-08-06; id=60, 2580 lm, `60739.ldt` — importado hoy) corresponde a qué proyecto real. No se resolvió por criterio propio de esta sesión: podrían ser dos variantes de catálogo legítimas para proyectos distintos.

## -21j. Ronda 21j — investigación acotada de la Causa B / zona marginal (Fase C del cierre de brechas de `dialux-calc-reviewer`): un hallazgo real de datos, una hipótesis de código descartada, una divergencia de fórmula confirmada pero sin causa verificable

A pedido explícito del usuario ("investigar más a fondo la zona marginal / first-bounce vs DIALux evo", tras la auditoría de `dialux-calc-reviewer`/`dialux-normativa-auditor`), se retomó §2.2 y §2.5 de este plan con tres líneas de trabajo acotadas. Regla del plan respetada en las tres: **ningún ajuste de coeficiente para que un caso cuadre** — solo causas físicas/de implementación verificables o, en su ausencia, el hallazgo se registra como descartado.

### 1. Revisión línea por línea de `iterativeRadiosity.ts` — sin bug encontrado

Se revisó la matriz de factores de forma (`computePatchFormFactorMatrix`), la normalización por fila (`Σ_j F(i→j) ≤ 1`), el criterio de convergencia (residual relativo MÁXIMO, no un agregado) y el barrido Gauss-Seidel. Los tres ya tienen justificación física correcta y verificación de reciprocidad en test (`área_i·F(i→j) == área_j·F(j→i)`, `iterativeRadiosity.test.ts`). **No se encontró ningún bug de implementación en el solver en sí** — el solver converge exactamente a lo que predice la teoría de cavidad zonal clásica para el sistema que se le da (confirmado antes, §2.2: 293.8/150.1≈1.96 ≈ 1/(1-ρ̄) para ρ̄≈0.49).

### 2. Hipótesis "piso/techo también necesitan subdivisión, igual que las paredes" — probada, DESCARTADA con evidencia

`wallVerticalSegments` (§ ya documentado en `roomPatches.ts`) subdivide paredes cuando son más altas que la dimensión horizontal del recinto. Por simetría directa se probó la hipótesis análoga para piso/techo: subdividir en grilla cuando son más anchos que la ALTURA del recinto (`horizontalSurfaceGridSegments`, implementado y luego revertido en esta sesión).

**Resultado real, no el esperado**: la hipótesis es geométricamente al revés de lo que hace falta. Un recinto de proporciones enteramente normales (4×4 m, altura 3 m — el propio fixture de test de `roomPatches.test.ts`) tiene extensión horizontal (4 m) MAYOR que su altura (3 m), así que el umbral "ancho > altura" se dispara para casi CUALQUIER recinto típico (la mayoría de recintos son más anchos que altos), no solo para geometrías patológicas — a diferencia de "pared más alta que el recinto es ancho", que sí es un caso raro. Verificado ejecutando la suite existente: 4 de 9 tests de `roomPatches.test.ts` fallaron inmediatamente con geometría de recinto ordinaria. Peor aún: para el caso real que motivó la investigación (SS.HH, 2.209×0.950 m, altura 4.67 m) la extensión horizontal (0.95-2.2 m) es MENOR que la altura (4.67 m) — el umbral propuesto ni siquiera se activa para el caso que se quería corregir. **Hipótesis descartada, cambio revertido (`git checkout`), no llegó a producción.**

### 3. Zona marginal (§2.5) — la "anomalía" era un dato viejo del proyecto real, NO un bug de fórmula; pero aparece una divergencia real y distinta en recintos angostos

Se recalculó `getRoomMarginalZone` (`roomLighting.ts`, fórmula EN 12464-1:2021 `p = 0.2 × 5^log10(d)`) para las dimensiones reales de los dos casos, SIN el override `room.marginalZone` que ya trae el proyecto guardado:

| Caso | Fórmula aplicada fresca | DIALux evo declara | Diferencia |
|---|---:|---:|---:|
| Guarderías/Caseta de control (2.1×2.21 m, ratio 1.05 → usa dimensión mayor) | **0.348 m** | 0.350 m | 0.6% — prácticamente idéntico |
| Baño/SS.HH (2.209×0.950 m, ratio 2.33 → usa dimensión menor) | **0.193 m** | 0.125 m | 54% — divergencia real |

**Conclusión sobre Guarderías**: la "anomalía" que §2.5 dejó sin explicar (proyecto real declarando 0.194 m contra los 0.350 m de evo) **NO es un bug de la fórmula actual** — la fórmula, aplicada fresca, da 0.348 m, que coincide con evo casi exactamente. El 0.194 m que el proyecto Pozuzo real tiene guardado es un valor `room.marginalZone` viejo (guardado antes de que esta fórmula existiera, o de una corrida con datos distintos) que el código respeta como override explícito (`getRoomMarginalZone` primero mira `room.marginalZone`, luego calcula). Es exactamente la misma clase de problema que la Causa A (§2.1): un dato desactualizado del proyecto, no algo que un cambio de código deba resolver — acción para el usuario: reabrir el ambiente "Guarderías" y limpiar/recalcular su `marginalZone` si quiere que deje de usar el valor guardado.

**Conclusión sobre Baño/SS.HH**: aquí SÍ hay una divergencia real de 54% entre la fórmula EN 12464-1 tal como está implementada (rama "usa dimensión menor" para ratio≥2, dando 0.193 m) y lo que DIALux evo declaró (0.125 m) para la misma geometría. Se intentó (sin éxito, sin forzar) encontrar qué combinación de dimensión/fórmula produce 0.125 m exactamente a partir de los datos disponibles (área, dimensión mayor, dimensión menor, ninguna combinación simple de `p=0.2×5^log10(d)` con esas tres entradas da 0.125 m) — **sin acceso al texto completo de la tabla EN 12464-1:2021 (Anexo C) no se puede confirmar si DIALux evo usa una rama distinta de la misma fórmula, una tabla discreta en vez de la fórmula continua, u otro criterio para razones de aspecto ≥2**. Registrado como divergencia real, sin causa verificable todavía — no se ajustó ningún coeficiente para que 0.193 se convierta en 0.125.

### Qué NO cambió en esta ronda

Ningún archivo de producción quedó modificado por esta investigación (la única prueba de código, `roomPatches.ts`, fue revertida). El default `interreflection: 'auto-by-shape'` de la Ronda 21i sigue siendo el comportamiento de producción — no se encontró evidencia que justifique cambiarlo.

### Próximo paso, si se retoma

Conseguir el texto real del Anexo C de EN 12464-1:2021 (o un caso adicional con ratio de aspecto ≥2 y zona marginal declarada por DIALux evo) antes de tocar `getRoomMarginalZone` de nuevo — con un solo caso (SS.HH) no hay evidencia suficiente para distinguir "DIALux evo usa una fórmula distinta para ratio≥2" de "este caso puntual tiene alguna particularidad no capturada aquí".

## -21i. Cambio DELIBERADO del default de producción: `interreflection: 'auto-by-shape'` (a pedido explícito del usuario)

Reporte real del usuario: un ambiente de 43.8 m² con las mismas propiedades/luminaria en ambos sistemas daba Ē=502 lx en este motor vs. 544 lx en DIALux evo (+8.4% de diferencia, fuera de su tolerancia de ±5%), y por separado la fila "Valores de consumo" del PDF marcaba "946 kWh/a → No conforme" contra un "máx. 500 kWh/a" fabricado (ver hallazgo #2 abajo).

### Hallazgo #1 (bug real, corregido): el "límite" de consumo era el lux normativo relabeleado

`formal-pdf.blade.php::$renderAmbientResultsTable` calculaba `$consumptionLimit = (float) $detail['targetLux']` — copiaba literalmente el lux exigido del ambiente (ej. 500) y lo mostraba como si fuera un límite de consumo anual en kWh/a, con un "Conforme"/"No conforme" resultante sin ninguna base normativa (Perú/RNE EM.010 no tiene un límite de consumo anual por ambiente — es un concepto tipo LENI/EN 15193-1). Corregido: el renglón ahora es informativo, "No regulado", nunca un veredicto fabricado. 2 tests nuevos + 1 actualizado en `FormalExportTest.php`.

### Hallazgo #2 (no es un bug, es la aproximación `first-bounce` ya documentada en este plan)

El gap de 502→544 lx es del tamaño exacto que este mismo plan ya caracterizó como típico de `first-bounce` (~5-12%, ver §1/§3 y `productionCalculationConfig.ts`). Verificado numéricamente: para un ambiente ~44 m² con reflectancia 70/50/20, pasar de `first-bounce` a radiosidad convergida sube el promedio un 21.6% — de sobra para explicar el 8.4% observado.

**Decisión previa de este plan** (múltiples rondas, ver `productionCalculationConfig.ts`): no cambiar el default sin más evidencia, porque no hay un modo ganador universal — depende de la forma del ambiente (elongado favorece `first-bounce`, compacto/cuadrado favorece `iterative`; un caso real, "SS.HH" de Módulo 22, sobreestimó +43% con `iterative` forzado).

**El usuario, informado explícitamente de ese riesgo (incluyendo el caso +43%), pidió automatizar la selección por forma de todos modos**: con la variedad real de tipos de ambiente/proyecto del sistema, un override manual ambiente por ambiente no es viable ("no voy a saber todo como para agregar valores concisos"). Se implementó `interreflection: 'auto-by-shape'` (`interreflectionModeHeuristic.ts`): decide `first-bounce`/`iterative` POR AMBIENTE según la relación de aspecto de su bounding box, umbral 2.0:1 (elegido en el medio del hueco documentado: 1.5:1 favorece `iterative`, 2.3:1 favorece `first-bounce`).

**Validación contra el proyecto real "Módulo 22"** (`modulo22ProjectFixture.ts`, el mismo de `modulo22GoldenCase.test.ts`):

| Ambiente | Aspecto | Modo elegido | evo | first-bounce (antes) | auto-by-shape (ahora) |
|---|---|---|---|---|---|
| SS.HH | 2.40:1 | first-bounce (sin cambio) | 206 lx | 201.5 lx (−2.2%) | 201.5 lx (−2.2%) |
| Ventanilla de atención | 4.33:1 | first-bounce (sin cambio) | 100 lx | 86.4 lx (−13.6%) | 86.4 lx (−13.6%) |
| Caseta de Control | 1.12:1 | iterative (nuevo) | 203 lx | 173.2 lx (−14.7%) | 226.2 lx (+11.4%) |

El umbral evita exactamente el caso +43% documentado (SS.HH cae del lado correcto) y mejora el error absoluto del único ambiente compacto de la muestra (14.7%→11.4%). Sigue siendo una heurística sobre evidencia limitada (el propio plan lo marca como "hipótesis, no regla"), no una garantía universal — cada ambiente que la use ahora emite un warning (`interreflection-mode-auto-selected`) con su relación de aspecto exacta, visible en el PDF/panel, para que el modo elegido nunca sea un cambio de método silencioso.

**Efecto colateral esperado y corregido**: el UGR usa `Eind/π` como luminancia de fondo cuando hay interreflexión activa — los 4 ambientes compactos de `ugrBenchmark.test.ts` (large-square, l-shape, chamfered-pentagon, trapezoid) pasaron a `iterative` y su UGR bajó ~13-15%; los valores congelados de regresión se actualizaron con el comentario explicando el cambio deliberado (`long-corridor`, elongado, no cambió).

**Verificado**: `npx tsc --noEmit` limpio, suite completa de `domain/calculation` (16 archivos/90 tests) y `export`+`__benchmarks__` (57 archivos) sin regresiones tras actualizar `ugrBenchmark.test.ts`, `php artisan test tests/Feature/Dialux` con los mismos 5 fallos preexistentes de siempre (no relacionados). Los 25 fallos de `panelCircuitCalculations.test.ts`/`wireLengthCalculations.test.ts` (módulo eléctrico, archivos no tocados en esta ronda) y el de `fileSizeBudget.test.ts` son preexistentes, confirmados no relacionados por `git status` (archivos fuera del diff de esta ronda).

## -21d. Cierre de la segunda problemática: 2 luminarias reales nuevas + 2 bugs reales encontrados en el parser LDT

Continuando el cierre acotado de esta ronda ("buscar luminarias NUEVAS, no reintentar GF19140"), se descargaron 2 archivos LDT reales de `luminaires.dialux.com` (mismo origen legítimo que el resto del catálogo) para cubrir categorías que el catálogo real todavía no tenía:

- **EMOS ZU210-9** — "LED Industrial High Bay Light PROFI PLUS 100W" (16999.6 lm, 100 W, 4000K) — primer high bay industrial real del catálogo.
- **Thorlux Lighting WLX1746X "Lexi"** — señal de salida LED real (ISO 7010), 110 lm, 1.7 W — primera fotometría real orientada específicamente a señalización de emergencia (no un downlight reutilizado con `emergencyFlux` marcado a mano).

Ambos importados con `ProductImportService::import()` real (no a mano) y agregados a `RealPhotometryLuminaireSeeder.php` (ids 55/56).

### 2 bugs reales encontrados al importar (no en el motor de cálculo)

1. **BOM UTF-8 sin limpiar** — el archivo de EMOS empieza con el marcador de orden de bytes UTF-8 (`EF BB BF`); ni `trim()` (PHP) ni `str::trim()` (Rust) lo consideran espacio, así que quedaba pegado al campo `manufacturer` ("\u{FEFF}EMOS" en vez de "EMOS"). Corregido en AMBOS parsers (`app/Services/ProductImportService.php::parseLdt()` y `dialux-photometry/src/main.rs::parse_ldt()`, el binario Rust real que producción usa cuando está compilado) — 1 test de regresión por lenguaje.
2. **Dimensiones físicas de la luminaria mal parseadas en el fallback PHP** — EULUMDAT declara largo/ancho/alto en TRES líneas consecutivas (13/14/15, confirmado contra archivos reales de EMOS/LEDVANCE), pero `parseLdt()` usaba `parseTriplet()` (pensado para IES, una sola línea con varios campos separados por espacio) sobre una sola línea — capturaba el largo real y dejaba ancho/alto en **0 en silencio**. Solo afecta al parser PHP de respaldo (cuando el binario Rust no está compilado/disponible — Rust no parsea `dimensions` en absoluto todavía, cae al fallback ya documentado de `luminousArea()` de 0.1 m², un caso distinto y ya conocido). Corregido leyendo las 3 líneas por separado; 1 test de regresión (por reflexión, ya que el binario Rust real intercepta el import público antes de llegar a este parser en cualquier máquina donde esté compilado).

**Verificado**: 6/6 tests Rust (`cargo test`), suite PHP completa sin regresiones (258 pasan vs. 256 antes de esta ronda — la diferencia son los 2 tests nuevos; los mismos 30 fallos preexistentes y no relacionados —auth/sesión/plan-request/IES— persisten idénticos con y sin estos cambios, confirmado con `git stash` antes/después), `npx tsc --noEmit` limpio, Pint sin cambios pendientes. Catálogo real: 17 productos, 10 con fotometría real de fabricante (antes 8, sin contar GF19140 que sigue siendo la aproximación Lambertiana declarada).

## -21. Ronda 21 — causa real de la divergencia del oráculo en formas no rectangulares encontrada y corregida: la grilla del oráculo NUNCA coincidía con la del motor real

A pedido explícito del usuario ("vamos en resolver con oráculo Radiance, el punto 3... para empezar a testear y subir al 95%"), se retomó el hallazgo sin cerrar de la Ronda 19 (formas no rectangulares con 13-26% de error de "montaje" contra Radiance, peor que el 2-7% de los rectángulos, sin causa identificada).

### Causa raíz confirmada con lectura de código, no supuesta

`generatePolygonSensorGrid()` (`radianceOracle/generateSensorGrid.ts`) anclaba su grilla en la ESQUINA del bounding box (`columns = floor(bbox/spacing) + 1`, sensor en `min + col*spacing`) mientras el motor real (`hooks/lightingEngineCore.ts::buildGrid`) usa celdas `floor(bbox/spacing)` con el sensor en el CENTRO de cada celda (`min + (i+0.5)*cell`). Son dos esquemas de muestreo DISTINTOS aunque el valor nominal de `spacing` coincidiera (0.5 m en ambos) — exactamente por qué la Ronda 19 (que solo probó cambiar el NÚMERO de espaciado, 0.3→0.5) no solo no arregló el error sino que lo empeoró: alinear el espaciado nominal no alinea el punto de anclaje.

Con una sola luminaria concentrada por ambiente (el diseño deliberado de estos fixtures, para aislar geometría de fotometría), el punto exacto donde cae — o no — un sensor cerca del nadir de la luminaria pesa mucho en el promedio (ley del inverso del cuadrado). Confirmado con cálculo manual: para la L (fixture en x=1,y=1), el oráculo viejo tenía un sensor EXACTAMENTE en (1.0, 1.0) — casi debajo de la luminaria — mientras el motor real nunca muestrea ese punto (su grilla cae en 0.25/0.75/1.25/1.75/2.25/2.75).

**Segundo hallazgo, más severo, en el mismo archivo**: `generateSensorGrid()` (la versión rectangular, usada por los 2 fixtures ORIGINALES del plan — `sshh-vs-bano` y `caseta-vs-guarderias`, los que sustentan el número "83.3%/94.8% de similitud" citado en toda la investigación) no derivaba su grilla de ningún `spacing` en absoluto — recibía `columns`/`rows` fijos, elegidos a mano por quien escribió cada fixture ("densidad ~1 sensor cada 0.3-0.4 m"). Para `sshh-vs-bano` (2.209×0.950 m) esto significaba **21 sensores** (7×3, esquema "endpoint-inclusive" entre los bordes de zona marginal) contra los **4 sensores** que el motor real realmente promedia (`floor(2.209/0.5)=4` columnas × `floor(0.95/0.5)=1` fila — una sola fila central). El oráculo y el motor nunca midieron sobre el mismo conjunto de puntos en ninguno de los 5 fixtures rectangulares existentes.

**Importante — qué NO se ve afectado por este hallazgo**: los números "83.3%/94.8% de similitud vs. DIALux evo" (Ronda 8) comparan `engine.avg_lux` directamente contra el valor impreso en el PDF real de DIALux evo — no pasan por el oráculo Radiance en absoluto. Ese resultado sigue siendo válido. Lo que SÍ estaba comprometido es la comparación **motor vs. Radiance** (6.5%/18.0% de error, Ronda 6) y, con ella, toda la investigación de la Causa B (`first-bounce` vs. `iterative`, Rondas 6/13/14) — construida enteramente sobre esa comparación.

### Corrección aplicada

- `generatePolygonSensorGrid()`: reescrita para replicar el esquema EXACTO de `buildGrid()` (celdas centradas, no ancladas en la esquina).
- `generateSensorGrid()` (rectangular): ahora es un envoltorio delgado sobre `generatePolygonSensorGrid()` (un rectángulo es un polígono de 4 vértices) — ya no tiene su propio esquema de grilla independiente, elimina la posibilidad de que ambos vuelvan a divergir. Su firma cambió de `{columns, rows}` a `{spacing}`, igual convención que la versión poligonal.
- `runRadianceOracle()`/`RadianceOracleOptions`: `grid: {columns, rows}` → `spacing: number`.
- Actualizados los 5 fixtures rectangulares (`fixtures.ts` vía `radianceOracle.test.ts::fixtureConfigs()`, `shapeVariationFixtures.ts` ×3) para declarar `spacing: 0.5` (= `GRID_SPACING` de producción) en vez de un `{columns, rows}` elegido a mano.
- **Nuevo test de paridad que corre SIN Radiance** (`generatePolygonSensorGridParity.test.ts`): compara posición por posición la grilla del oráculo contra `buildGrid()` + el filtro de zona marginal real, para los 3 fixtures no rectangulares y un rectángulo de control — guardia permanente contra que esto vuelva a divergir en silencio.

### Resultado — formas no rectangulares, re-medidas con Radiance real tras el fix

| Ambiente | Montaje (directo motor vs. Radiance) — ANTES | Montaje — DESPUÉS del fix | first-bounce (error vs. Radiance) | iterative (error vs. Radiance) | Gana |
|---|---:|---:|---:|---:|---|
| l-shape (7.2 m², no convexa) | 13.8% / 23.2% (Ronda 19) | **2.4%** | 132.8 lx (20.9%) | 157.7 lx (**6.0%**) | iterative |
| chamfered-pentagon (8.7 m²) | 13.4% / 26.1% (Ronda 19) | **2.5%** | 122.3 lx (21.0%) | 145.6 lx (**6.0%**) | iterative |
| trapezoid (8.4 m²) | 15.5% / 15.4% (Ronda 19) | **3.9%** | 115.4 lx (29.1%) | 126.5 lx (**22.3%**) | iterative |

El montaje baja de 13-26% a **2.4-3.9%** — ahora en el mismo rango que las formas rectangulares (1.9-6.9%, Rondas 6/13). Confirma de forma concluyente que la causa real era el esquema de anclaje de la grilla, no la física ni la geometría poligonal (que ya estaba bien, verificada por separado en la Ronda 14). **Con este montaje ahora confiable, los 3 casos suman evidencia real** al patrón de la Ronda 13 ("formas compactas/no elongadas favorecen `iterative`") — las 3 formas de esta ronda son razonablemente compactas y las 3 favorecen `iterative` con más margen que antes.

**No se cambia el default de producción** (`first-bounce`) — sigue vigente la misma razón de siempre (§7 "qué no hacer": no ajustar con pocos casos, y `first-bounce` sigue siendo mejor para ambientes elongados, ver Ronda 6/13). Esto es evidencia que se SUMA al cuerpo de casos para la Causa B, no una resolución de esa investigación.

### Segundo hallazgo, más profundo: el oráculo tampoco replicaba el espaciado ADAPTATIVO real de producción

Al re-correr los 5 fixtures rectangulares con `spacing: 0.5` fijo (asumiendo que `GRID_SPACING` es lo que producción usa siempre), 2 de 5 fallaron la cota de montaje con errores grandes: `caseta-vs-guarderias` 17.0% (cota 10%) y `large-square` **52.6%** (cota 15%). Investigado antes de forzar los números: `buildProductionCalculationConfig()` (la función que TODOS los tests de este plan usan para calcular el lado "motor" de la comparación) activa `meshPolicy.adaptive: true` — bajo esa bandera, `resolveMeshSpacing()` (`hooks/adaptiveGridSpacing.ts`) **nunca usa un espaciado fijo ni la `marginalZone` declarada del recinto**: corre una pasada de sondeo barata, refina el espaciado según el coeficiente de variación de iluminancia del recinto (`finalSpacing = baseSpacing / (1 + CoV)`, piso 0.1 m), y sobrescribe la zona marginal a `spacingM / 2`.

Verificado con los 8 fixtures de este plan (sondeo directo de `resolveMeshSpacing`):

| Fixture | Espaciado FIJO asumido (Ronda 21a) | Espaciado ADAPTATIVO real | Zona marginal declarada | Zona marginal real (override) |
|---|---:|---:|---:|---:|
| sshh-vs-bano | 0.5 | 0.393 | 0.125 | 0.197 |
| caseta-vs-guarderias | 0.5 | 0.382 | 0.350 | 0.191 |
| long-corridor | 0.5 | 0.181 | 0.15 | 0.090 |
| large-square | 0.5 | **0.100 (piso)** | 0.3 | 0.05 |
| small-dark-square | 0.5 | 0.500 (coincide) | 0.15 | 0.25 |
| l-shape | 0.5 | 0.151 | 0.15 | 0.075 |
| chamfered-pentagon | 0.5 | 0.132 | 0.15 | 0.066 |
| trapezoid | 0.5 | 0.133 | 0.15 | 0.067 |

Ningún fixture usa realmente el espaciado ni la zona marginal que la Ronda 21a (primera mitad de esta misma ronda) le asignó al oráculo — la coincidencia aproximada en `sshh-vs-bano`/`long-corridor`/`small-dark-square`/los 3 polígonos fue suficiente para pasar las cotas de tolerancia (holgadas, 10-15%) pese al descalce, pero `caseta-vs-guarderias` y sobre todo `large-square` (un solo foco muy concentrado en un recinto grande → coeficiente de variación alto → espaciado colapsa al piso de 0.1 m) revelaron el descalce real.

**Corregido**: `radianceOracle.test.ts`, `radianceOracleShapeVariation.test.ts` y `radianceOraclePolygonShapes.test.ts` ahora llaman `resolveMeshSpacing()` (la MISMA función de producción, no una reimplementación) antes de armar la grilla del oráculo, para cada fixture — eliminando cualquier valor fijo asumido a mano. `shapeVariationFixtures.ts` perdió su campo `spacing` (ya no tiene sentido declararlo por fixture; se deriva en el test).

**Límite práctico aceptado, no un bug**: `large-square` a su espaciado adaptativo real (0.1 m sobre 4×4 m, zona marginal 0.05 m) requiere **~1521 sensores** — a la velocidad medida de Radiance con `-ab 8` (36 sensores ≈ 384 s en la Ronda 13), una corrida completa tomaría del orden de horas, no minutos. Se decidió NO forzar esa corrida (no es viable dentro de una sesión de trabajo normal) — queda sin re-validar contra Radiance a su resolución real. Esto no es una falla del fix: es información nueva y honesta sobre el propio diseño del fixture ("un solo downlight en 4×4 m no es una propuesta de diseño real", ya advertido en el doc-comment de `shapeVariationFixtures.ts`) empujando el espaciado adaptativo a su extremo. Si se necesita ese número en el futuro, correrlo aparte con un timeout de varias horas, fuera de una sesión interactiva.

### Resultado final — 4 de 5 fixtures rectangulares, re-medidos con espaciado/zona marginal REALES

| Fixture | Montaje ANTES (Ronda 6/21a) | Montaje DESPUÉS (espaciado/zona marginal real) | Full reflection Radiance | first-bounce (error) | iterative (error) | Gana |
|---|---:|---:|---:|---:|---:|---|
| sshh-vs-bano | 6.5% (Ronda 6) / 3.4% (21a) | **0.5%** | 164.0 lx | ~120.0 lx (26.8%) | ~151.5 lx (**7.6%**) | iterative |
| caseta-vs-guarderias | — / 17.0% (21a, FALLÓ) | **0.6%** | 163.9 lx | — | — | — |
| long-corridor | 4.4% (Ronda 13) | **0.4%** | 119.4 lx | 101.3 lx (**15.1%**) | 143.1 lx (19.8%) | first-bounce |
| small-dark-square | 3.8% (Ronda 13) | **0.6%** | 263.8 lx | 208.4 lx (21.0%) | 220.1 lx (**16.6%**) | iterative |
| large-square | 6.9% (Ronda 13) / 52.6% (21a, FALLÓ) | sin re-validar — inviable (~1521 sensores a spacing=0.1) | — | — | — | — |

El montaje baja a **0.4-0.6%** en los 4 casos re-medibles — un salto grande respecto al 3.8-6.9% ya considerado "bueno" en las Rondas 6/13, confirmando que usar `resolveMeshSpacing()` real (no una aproximación) es la forma correcta de comparar. Para `sshh-vs-bano`, con el valor físico de Radiance ya confiable (164.0 lx), `iterative` (7.6% de error) queda mucho más cerca que `first-bounce` (26.8%) — coherente con el hallazgo de la Ronda 4 (con fotometría real, `iterative` se acerca más a DIALux evo que `first-bounce`, lo opuesto de lo que sugería la investigación original solo-Lambertiana). `long-corridor` (aspecto 5:1) sigue favoreciendo `first-bounce`, reforzando el patrón de aspecto ya documentado.

**No se cambia el default de producción** (`first-bounce`) — sigue habiendo casos donde gana cada uno, y el criterio de §7 (no ajustar con pocos casos) sigue vigente. Lo que SÍ cambia es la CONFIANZA en estos números: antes de esta ronda, la infraestructura de comparación (oráculo vs. motor) tenía un descalce de grilla no detectado en el 100% de los fixtures — cualquier conclusión sacada de esos números heredaba ese error silencioso. Ahora los 7 de 8 fixtures medibles (todos menos `large-square`) comparan sobre EXACTAMENTE los mismos puntos que usa producción.

### Qué queda pendiente después de esta ronda

1. `large-square` sin re-validar contra Radiance a su resolución real (documentado como límite práctico, no bug).
2. Con el oráculo ahora confiable, el siguiente paso natural (ya sugerido en Rondas 6/13, ahora con base sólida) es sumar más casos variando aspecto de forma controlada para intentar convertir el patrón "aspecto → modo ganador" en una regla real, no solo una observación con 7 casos.
3. El resto de brechas ya identificadas en conversaciones previas (superficies verticales/malla normativa, formas no rectangulares en producción todavía sin exponer en la UI del cálculo) siguen sin tocar — esta ronda fue específicamente sobre la INFRAESTRUCTURA de validación, no sobre el motor de cálculo en sí.

## -21c. Cierre acotado de Fase 9 (UGR profesional) — el algoritmo ya estaba completo, faltaba el benchmark de integración

A pedido explícito del usuario ("cerramos ambas problemáticas... asegurarnos el 95%"), se investigó qué falta realmente para "cerrar" la Fase 9 del plan maestro (§11, "UGR y luminancia profesional") antes de comprometerse a un alcance grande.

**Hallazgo: la Fase 9 ya está implementada casi por completo**, desde la Fase 15 (2026-08-04). `glareCalculation.ts`/`glareObserver.ts` ya tienen: observadores con posición/altura/dirección reales (punto medio de cada pared, no el centroide — fix ya aplicado), luminancia de superficies emisoras, ángulo sólido aparente con escorzo (`A·cosγ/d²`), índice de posición de Guth (coeficientes confirmados contra fuente secundaria independiente), luminancia de fondo con fallback documentado (`Eind/π`, cae a `avg/π` solo sin datos de interreflexión — nunca ambiguo, siempre trazado en comentarios), evaluación multi-observador con reporte del peor caso, y exclusiones documentadas (campo visual inferior, H/R>2, fuera del hemisferio frontal, oclusión). El único ítem de `informe_brechas_evaluaciones_calculos_dialux.md` §5.6 genuinamente sin cerrar era **"benchmark con tolerancia acordada"**: existían tests unitarios de `glareCalculation.ts` en aislamiento, pero ningún benchmark de INTEGRACIÓN (motor de producción real, `runProjectLightingCalculation`) sobre los fixtures reales del plan de paridad.

### Investigación del caso "(manual)" — confirmado que NO es un bug nuevo, es un gap ya conocido y correctamente marcado `pending-confirmation`

Se verificó si el fix de observador (pared, no centroide) resuelve el "(manual)" que Ronda 11 documentó para Guarderías/Baño. **Resultado: sigue "no evaluado" para ambos fixtures núcleo** (`sshh-vs-bano`, `caseta-vs-guarderias`) — confirmado con el motor real, no una suposición. Investigando el motivo, se encontró que `glareCalculation.test.ts` YA documenta este gap exacto desde antes de esta ronda ("DOCUMENTA UN GAP CONOCIDO": para una caseta de control real de 2.1×2.32 m con techo 4.67 m, DIALux evo SÍ calculó RUG=22 mientras nuestro motor excluye TODOS los puntos posibles por H/R>2, sin importar dónde se ubique el observador).

Se buscó en la documentación pública de soporte de DIALux evo (Knowledge Base, `evo.support-en.dial.de`) para verificar si la definición de H/R difiere de la nuestra. La documentación confirma que R/T/H se determinan "con respecto al observador" (coincide con nuestro enfoque per-luminaria/per-observador), pero **no publica la fórmula geométrica exacta** — remite al texto primario de CIE 117 o a soporte directo de DIAL, ninguno de los dos accesible en esta sesión. **No se fuerza ningún cambio de umbral sin esa fuente** — sigue correctamente marcado `pending-confirmation`, consistente con el principio de todo este plan (§7: "no declarar cumplimiento sin fuente oficial").

### Corregido esta ronda

Nuevo benchmark de integración, `resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/ugrBenchmark.test.ts` (8 tests, motor de producción real vía `runProjectLightingCalculation`):

- **5 geometrías con H/R≤2** (`long-corridor`, `large-square`, `l-shape`, `chamfered-pentagon`, `trapezoid`): UGR se calcula (no "no evaluado"), finito, en rango físico sano (0-35), con observador/dirección reportados — valores regresión-fijados (11.58 / 13.24 / 15.58 / 14.71 / 15.28) para atrapar cualquier cambio futuro no deliberado del solver.
- **3 geometrías desproporcionadas** (`sshh-vs-bano`, `caseta-vs-guarderias`, `small-dark-square`): se fija como comportamiento ESPERADO (no bug) que UGR quede "no evaluado" — documenta y bloquea el gap conocido de H/R en vez de dejarlo como un hecho silencioso.

**Sin fabricar una tolerancia contra DIALux evo que no se puede verificar todavía**: no existe hoy un caso real donde tengamos la geometría exacta + fotometría real + un RUG NO-manual de DIALux evo confirmado para comparar numéricamente (el único caso conocido con RUG real de evo, la caseta de 2.1×2.32m, es precisamente el que nuestro motor excluye por el gap sin resolver). El benchmark, por eso, valida sanidad/consistencia interna y regresión — no similitud con DIALux evo — hasta que aparezca esa fuente.

**Verificado**: 65 tests (suite `dialuxEvoParity` + `glareCalculation.test.ts`) pasan, `npx tsc --noEmit` limpio. Se detectaron fallos preexistentes y no relacionados en `panelCircuitCalculations.test.ts`/`wireLengthCalculations.test.ts`/`fileSizeBudget.test.ts` (cálculos eléctricos y presupuesto de tamaño de archivo) — no tocados por esta ronda ni por el trabajo de normativa en curso (`database/data/EM010.json`/`transform.cjs`, cambios no commiteados y ajenos a esta sesión).

### Balance honesto hacia "95%"

No existe un único número que suba a 95% — el plan mismo rechaza esa forma de medir (§1: ni DIALux evo/Relux/AGi32 coinciden al 100% entre sí). Lo que SÍ se puede afirmar con esta ronda:

- La infraestructura de validación (oráculo Radiance) pasó de tener un descalce de grilla no detectado en el 100% de sus fixtures a comparar sobre exactamente los mismos puntos que produción en 7 de 8 casos — cualquier número que salga de ahí de ahora en más es confiable, no una coincidencia.
- Fase 9 (UGR) tiene su algoritmo maduro con benchmark de regresión — el gap que queda (H/R en salas desproporcionadas) está correctamente documentado y bloqueado en tests, no oculto.
- Lo que más movería la aguja real de similitud contra DIALux evo en proyectos concretos sigue siendo lo mismo de siempre: más fotometría real por luminaria (Causa dominante, §-1) — no una fórmula por ajustar.

## -20. Ronda 20 — "el mismo producto da lúmenes distintos": no es un bug, es catálogo duplicado sin aviso; agregada advertencia de duplicado en el import

A pregunta directa del usuario ("si es el mismo producto, ¿por qué uno da más lúmenes que otro?"), se verificó en producción (vía tinker) que existen DOS `LuminaireProduct` con `catalog_number = TEG18046`:

| | id=9 (usado por el fixture real de Baño en Pozuzo) | id=10 (creado hoy, 2026-08-10) |
|---|---|---|
| `total_lumens` / `power_watts` | 1508 lm / 14 W | 1365 lm / 17 W (valores crudos del fabricante) |
| `photometric_web.reference_lumens` | 1365 (el valor real queda preservado) | 1365 |
| `report_assets`/`report_data`/`source_file_path` | todos `null` | completos (SVG polar real, ficha técnica, LDT fuente) |
| Origen | creado a mano en una ronda anterior (no via `ProductImportService::import()` — le faltan todos los campos que ese pipeline genera) | import real vía el pipeline normal |

**No es un bug de cálculo**: la curva angular real (`photometric_web.candela`) es la MISMA en ambos registros — solo difiere la magnitud total declarada. El id=9 fue creado deliberadamente para igualar un valor histórico que el propio DIALux evo reportó para este producto en una exportación real y fechada (documentado en el nombre del producto), usando el mecanismo de `candelaScale` ya existente (`ProductImportService::withReportPayload()`, línea ~1183: `candelaScale = total_lumens / photometric_web.reference_lumens`) — el mismo mecanismo de las Rondas 3/8. El valor real (1365) nunca se perdió, quedó guardado en `reference_lumens`.

**El problema real**: el catálogo permitía crear un segundo producto con el mismo `catalog_number` sin ningún aviso — eso es lo que genera la confusión ("¿por qué el mismo código da datos distintos?"), no una falla de física.

**Corregido**: `ProductImportService::import()` ahora advierte (no bloquea) cuando el `catalog_number` del archivo importado ya existe en el catálogo, listando los productos en conflicto (id, nombre, lumens, watts) para que quede visible en `report_data.warnings` y en la respuesta JSON del import. 2 tests de regresión nuevos (`ProductImportTest.php`) — uno confirma el aviso ante duplicado real, otro confirma que un `catalog_number` sin precedente NO dispara aviso falso. 239 tests PHP pasan (4812 aserciones), sin regresiones.

**No se tocó** el fixture real de Baño (sigue usando id=9) ni se decidió cuál de los dos productos debería usarse en adelante — ese es un juicio de negocio (¿priorizar comparabilidad con el histórico de evo, o el dato crudo del fabricante?) que le corresponde al usuario, no algo para resolver bajo presión de un deploy de 10 minutos.

## -19. Ronda 19 — re-corrida del oráculo Radiance en formas no rectangulares: el fix de spacing NO resolvió el error; hallazgo real sin cerrar (no bloquea Pozuzo hoy)

Se instaló Radiance fresco (no se encontró la instalación previa en esta máquina; se reinstaló portable desde el release oficial de LBNL-ETA) y se re-corrió `radianceOraclePolygonShapes.test.ts` con el fix de `spacing: 0.3 → 0.5` de la Ronda 14 ya aplicado.

**Resultado: el error subió, no bajó.** Antes del fix (Ronda 14, con `spacing: 0.3`): 13.4-15.5%. Después del fix (`spacing: 0.5`, igual al de producción): **23.2% (L-shape), 26.1% (pentágono achaflanado), 15.4% (trapezoide)** — los 3 casos ahora fallan la aserción de montaje (`< 15%`). Esto descarta que el spacing fuera la causa real: si lo fuera, alinear el spacing del oráculo con el de producción debía ACERCAR los números, no alejarlos.

### Hipótesis investigada y DESCARTADA: fallback a bounding box en `ambientSpaces.ts`

Los logs mostraban `[ambientSpaces] buildRegionPolygon: open chain detected after 3 verts` en cada shape — inicialmente se sospechó que el motor de producción caía a un rectángulo delimitador (bounding box) en vez de usar la forma poligonal real al fallar la reconstrucción raster. **Se seleccionó código y se descartó**: en `deriveAmbientSpaces()` (`hooks/ambientSpaces.ts` línea ~870), cuando `regions.length <= 1` (el caso de un ambiente único sin muros internos que lo subdividan — exactamente el caso de los fixtures de este test), el camino usa `{...room}` — el room ORIGINAL con sus `vertices` reales, nunca el resultado de `buildRegionPolygon`. El área también cae a `polygonArea(room.vertices)` (polígono real), no a un bounding box. La detección raster (`buildRasterRegions`/`buildRegionPolygon`) solo importa cuando SÍ hay muros internos dividiendo el room en sub-ambientes (caso Guarderías+Baño) — para un ambiente único de forma arbitraria, el warning es ruido interno sin efecto en el resultado. **Conclusión: NO es la causa.**

### Estado real: causa sin identificar todavía

El error de validación directa (sin reflexión, solo visibilidad+inverso-cuadrado+coseno — la física más simple posible) no debería divergir 15-26% entre el oráculo y el motor si ambos modelan la MISMA geometría/sensor grid. Eso apunta a un desalineamiento real entre lo que arma `generatePolygonRoomScene.ts`/`generatePolygonSensorGrid.ts` (el oráculo, en `__benchmarks__`, código de investigación) y lo que arma `buildGrid`/`pointInPolygon`/`filterPointsOutsideMarginalZone` (el motor real, en `hooks/lightingEngineCore.ts` + `hooks/marginalZoneFilter.ts`) para formas de más de 4 vértices — sin identificar aún si el desalineamiento está del lado del oráculo (posible bug de winding/normales en el escenario Radiance para el corner cóncavo de la L, aunque el pentágono/trapezoide convexos también fallan) o del lado del motor real. **No se investigó más a fondo esta ronda por límite de tiempo** — queda como próximo paso explícito antes de confiar en el motor para cualquier ambiente no rectangular en producción.

### Por qué esto NO bloquea el deploy de hoy

Los dos ambientes reales del proyecto Pozuzo (Guarderías, Baño) son ambos rectángulos de 4 vértices (`room.vertices` con 4 puntos, confirmado vía tinker en producción) — el código de formas rectangulares (`generateRoomScene.ts`, ya validado en Rondas 6/13 con 1.9-6.9% de error) es el que efectivamente corre para ellos, no el código poligonal nuevo. Este hallazgo es un riesgo real pero FUTURO: aplica a cualquier proyecto con ambientes en L, pentagonales, trapezoidales, etc. — exactamente lo que se pidió empezar a testear. **No se debe presentar/vender el sistema como validado para formas no rectangulares hasta cerrar esta investigación.**

## -18. Ronda 18 — bug real encontrado y corregido: "Gráfico no disponible" en la sub-sección "Lista de luminarias" por ambiente

A pedido de revisar el "encuadre" (diseño general del PDF: títulos, tablas, espaciado), se investigó por qué las tarjetas de producto del PDF exportado muestran "Gráfico no disponible" (logo/foto/diagrama polar) en vez de los gráficos reales — mientras que el PDF de referencia (MODULO I, DIALux evo) sí los muestra.

### Causa raíz confirmada: `buildAmbientLuminaireList` nunca copiaba los IDs de asset

El pipeline completo se rastreó de punta a punta: `enrichProducts.ts` (fetch de `report_assets.polar_svg` del catálogo + fallback local `fixture.reportAssets` + fallback generado desde `photometricWeb`) → `buildDialuxFormalDocument.ts` → `formal-pdf.blade.php` (`$renderAsset`, que solo muestra el placeholder cuando el asset resuelto es `null`).

Hay DOS funciones que arman listas de luminarias con la misma forma (`DialuxLuminaireListItem` / `DialuxAmbientLuminaireItem`, alias del mismo tipo) pero un comportamiento distinto:

- `buildLuminaireList()` (proyecto completo, alimenta las páginas "Ficha de producto") — SÍ copia `polarDiagramAssetId`/`productPhotoAssetId`/`brandLogoAssetId`/`lineDrawingAssetId` desde el fixture.
- `buildAmbientLuminaireList()` (por ambiente, alimenta la sub-sección "Lista de luminarias" de cada local vía `$renderAmbientProductCards` en el blade) — **nunca copiaba esos 4 campos**, aunque el tipo los declara como opcionales (por eso TypeScript no lo marcó). Resultado: para CUALQUIER fixture, sin importar si tenía fotometría real enlazada, esa sub-sección mostraba 3 placeholders por producto (logo, foto, diagrama polar — exactamente los 3 `$renderAsset()` que llama `$renderAmbientProductCards`), de forma incondicional.

**Corregido** en `resources/js/pages/dialux/export/document/productPages.ts` — `buildAmbientLuminaireList` ahora copia los mismos 4 campos (y `cct`/`cri`/`description`/`applications`/`ugrTable`/`ugrDiagramValue`, que tampoco copiaba) que `buildLuminaireList`. 2 tests de regresión nuevos (`productPages.test.ts`), sin tests previos que cubrieran este objeto — por eso el bug no se había detectado. 242/242 tests de exportación DIALux siguen pasando.

### Hipótesis abierta, NO confirmada: página "Ficha de producto" (proyecto) específicamente

El pipeline de `buildLuminaireList` (el que sí alimenta "Ficha de producto") está correctamente cableado en el código para cualquier fixture con `productId` enlazado a un producto de catálogo con `report_assets.polar_svg` real (confirmado en BD para TEG18046/id=20). La causa de que el PDF de producción de Pozuzo aún muestre el placeholder ahí (si es que ese caso específico persiste tras este fix — no diferenciado con certeza del bug de arriba en la descripción original del usuario) sigue sin confirmarse en código: la hipótesis más probable es que el fixture colocado en el editor no tenga `productId` enlazado (p. ej. si se creó/editó vía el formulario de "Luminaria Manual", que no referencia un producto de catálogo) — en ese caso, ni el fallback local (`fixture.reportAssets`) ni el fetch en vivo al catálogo (`enrichProducts.ts`) tienen nada que resolver. **No verificable sin acceso a la BD/proyecto real del usuario** — pendiente de confirmación manual (ver en el panel de propiedades de la luminaria si trae un diagrama polar real, o confirmar en `tinker` si el `Fixture` de Baño/Guarderías tiene `product_id` no nulo).

## -17. Ronda 17 — comparación exhaustiva campo por campo (potencia, consumo, estructura del PDF); un campo configurable agregado, una anomalía de datos encontrada

A pedido explícito ("revisa potencias, cálculos mínimos... la comparación es con TODO"), se comparó cada fila de la tabla "Resultados" de ambos PDFs (no solo E/Emin/Emax/Uo/g2, ya cubiertos en la Ronda 16), con hallazgos concretos:

### Potencia específica de conexión — parecía divergir mucho, no es un bug

`Plano útil` (8.41 vs 12.41 W/m² en Guarderías; 14.29 vs 10.41 en Baño) diverge porque depende de la **zona marginal** declarada (que difiere entre proyectos, ver abajo) — el área útil sobre la que se divide la potencia cambia. La prueba de que el CÁLCULO de potencia en sí está bien: la potencia específica sobre **área total** (que no depende de zona marginal) da **casi idéntica** en los dos casos — 5.64 vs 5.62 W/m² (Guarderías) y 6.76 vs 6.76 W/m² EXACTO (Baño). Sin hallazgo que corregir en código.

### Consumo (kWh/a) — metodologías distintas, no comparables directo; se agregó un campo real

Verificado con matemática inversa: nuestro "Consumo" usa exactamente **8 h/día × 365 días** fijo (`P × 8 × 365 ÷ 1000`, confirmado exacto en ambos ambientes). El de DIALux evo implica 3.65 h/día y 5.28 h/día — no son números redondos porque usa una **evaluación energética horaria** (autonomía de luz diurna, orientación real, atenuación por escena — documentado en su propio glosario, desarrollado con el Fraunhofer Institute). Implementar ese modelo completo está fuera de alcance de esta ronda (requeriría datos de cielo/orientación/horario que hoy son solo metadata sin consumidor, ver `ProjectSiteSettings`).

**Se agregó, sí, una mejora real y acotada**: `ProjectSiteSettings.dailyOperatingHours` (antes: `8` fijo en el blade, sin forma de cambiarlo) — ahora es un campo editable en el panel "Terreno · Mantenimiento" del editor, con el mismo patrón que `maintenanceFactor` (override real → default 8h si no se declara). El pie de página del PDF ahora refleja el valor real usado ("Consumo estimado para una jornada referencial de N h/día") en vez de un texto fijo que podía mentir si el número cambiaba. No hace que el consumo sea comparable 1:1 contra DIALux evo (sigue siendo un promedio simple, no una simulación horaria), pero al menos dejó de estar oculto/hardcodeado — el usuario puede alinear el supuesto de horas si quiere acercar el número a un caso de referencia. 2 tests de regresión nuevos.

### Estructura del PDF por ambiente — es la misma, con una fila de MÁS de nuestro lado

Confirmado campo por campo: Plano útil (E, Uo, 2 potencias específicas), Evaluación del deslumbramiento, Valores de consumo, Área (potencia específica) — misma estructura en los dos sistemas. La única diferencia: nuestro PDF tiene una fila "Reproducción cromática (Ra)" que el reporte base de DIALux evo NO incluye en esta plantilla — es la fila agregada en la Ronda 12 de este mismo plan. No es una carencia, es un dato de más.

### Zona marginal — anomalía real encontrada en los datos del proyecto (no en el código)

Se verificó la fórmula EN 12464-1:2021 ya implementada (`getRoomMarginalZone`, `p = 0.2 × 5^log10(d)`) contra las dimensiones reales declaradas de cada ambiente:

| Ambiente | Fórmula aplicada a SUS dimensiones reales | Valor que el proyecto real declara | evo declara |
|---|---:|---:|---:|
| Guarderías (2.1×2.21 m) | **0.348 m** (usa dimensión mayor, ratio 1.05 ∈[0.5,2]) | 0.194 m ⚠️ | 0.350 m |
| Baño (2.209×0.950 m) | **0.193 m** (usa dimensión menor, ratio 2.33 fuera de [0.5,2]) | 0.197 m ✓ | 0.125 m |

**Hallazgo**: para Baño, el valor guardado (0.197) coincide con lo que la fórmula actual predice para SUS propias dimensiones (0.193) — consistente. Para Guarderías, el valor guardado (0.194) NO coincide con lo que la fórmula predice para sus dimensiones reales (0.348) — de hecho 0.194 es casi idéntico a lo que la fórmula daría para las dimensiones de Baño (0.193), sugiriendo que ese campo quedó con un valor "pegado" de un cálculo anterior (antes de que el recinto tuviera su tamaño final, o de una fase anterior del proyecto) en vez de recalcularse. Es un campo editable (`room.marginalZone`, panel de propiedades → "Zona marginal"), así que una vez fijado a mano queda desacoplado del auto-cálculo.

**No se corrigió en código** — no hay nada que arreglar en la fórmula (Baño la valida correctamente); es un dato específico de ESE recinto en el proyecto real del usuario. **Acción recomendada, no aplicada todavía**: en el editor, revisar/re-escribir el campo "Zona marginal" de Guarderías (probar `0.35`, el valor que declara DIALux evo, para comparación directa, o dejar que se recalcule solo si se limpia el campo). Esto además solo afecta Emin/Emax/Uo/g2 (qué puntos de la grilla entran al promedio), no E media — coherente con que Guarderías ya tiene 99% de similitud en E media pese a esta discrepancia.

### Sobre la meta de "99% en todo"

No se prometió ni se persigue como piso absoluto — sigue vigente el principio de §1 (ni DIALux evo/Relux/AGi32 coinciden al 100% entre sí). Lo que SÍ se hizo: cada campo con divergencia grande se investigó individualmente, y en cada caso se llegó a una explicación verificable (zona marginal, metodología de consumo) en vez de una similitud "por bulto". El residual real y no explicado que queda es el de E media en Baño (86.6%, Ronda 16) — coherente con el límite ya conocido de `first-bounce` en salas angostas, cuyo único camino de mejora genuino sigue siendo el de las Rondas 6/13/14 (más casos con el oráculo Radiance para caracterizar cuándo conviene cada modo de interreflexión), no un ajuste de un campo.

**Verificado**: 237 tests PHP + 850 tests Vitest pasan (+2 nuevos), sin regresiones.

## -16. Ronda 16 — con reflectancia asignada en el proyecto real, la similitud sube de ~73% a ~93% (verificado en producción)

Siguiente paso concreto que quedó pendiente desde la Ronda 11 ("asignar reflectancia 70/50/20 en el editor y volver a medir"). El usuario asignó la reflectancia en el proyecto real "Pozuzo" (confirmado en el PDF: `Grado de reflexión (Techo/Paredes/Suelo) 70%/50%/20%` en ambos ambientes) y volvió a exportar. Comparación campo por campo contra `MODULO I_Informe.pdf` (DIALux evo real), con la GF19140 original (no el sustituto RC18820 — ver decisión abajo):

| Campo | Guarderías (Pozuzo) | Caseta de control (evo) | Similitud | Baño (Pozuzo) | SS.HH (evo) | Similitud |
|---|---:|---:|---:|---:|---:|---:|
| Área | 4.61 m² | 4.63 m² | 99.6% | 2.07 m² | 2.07 m² | 100% |
| E media | 205.12 lx | 203 lx | **99.0%** | 124.67 lx | 144 lx | **86.6%** |
| Emin | 151.83 lx | 162 lx | 93.7% | 97.97 lx | 112 lx | 87.5% |
| Emax | 248.49 lx | 231 lx | 92.4% | 146.28 lx | 164 lx | 89.2% |
| Uo (g1) | 0.740 | 0.80 | 92.5% | 0.786 | 0.78 | 99.2% |
| g2 | 0.611 | 0.70 | 87.3% | 0.670 | 0.68 | 98.5% |
| UGR | 25.7 (manual) | 26 | — (manual) | 23 (manual) | 23 | — (manual) |

**Antes de esta ronda** (Ronda 11, sin reflectancia): Guarderías 73.6%, Baño 72.2% de similitud en E media. **Ahora**: 99.0% y 86.6%. Confirma con datos de producción reales (no un fixture de laboratorio) que la reflectancia era, en efecto, la causa dominante — exactamente el diagnóstico de la Ronda 11.

El residual de Baño (13.4% de error en E media) está por encima del rango típico de `first-bounce` (~5-12%, ver §1/§3) pero no es alarmante — sigue siendo consistente con la limitación ya documentada de la aproximación de un solo rebote frente a DIALux evo, sin evidencia de un bug nuevo.

### Decisión: se descarta RC18820 como sustituto, se mantiene GF19140 (Lambertiana)

El usuario probó el sustituto real RC18820 (Ronda 15) en el proyecto real y lo revirtió: es un artefacto lineal de ~1.2 m (óptica de pasillo genuina, no una aproximación) — físicamente demasiado grande para un ambiente de control pequeño, y en la práctica dio una E media más baja que la aproximación Lambertiana de GF19140. Coherente con lo ya anticipado en la Ronda 15 (RC18820 comparte la misma limitación de "óptica de pasillo en cuarto no-pasillo" que tenía GF19140 originalmente) y con la investigación numérica de esa misma ronda (89-127 lx según reflectancia, nunca cerca de 205 lx). **Decisión correcta, con base física, no solo preferencia**: la Lambertiana genérica de GF19140, con reflectancia real asignada, terminó rindiendo mejor (99.0% de similitud) que cualquiera de las alternativas reales probadas — un caso concreto de que "más real" no siempre es "más preciso para este caso" cuando la forma del haz no calza con la geometría del ambiente.

**Verificado**: comparación hecha directamente sobre el PDF exportado de producción (`pozuzo dialux sistema.pdf`, 2026-08-10), no un fixture de benchmark — esta es la medición más honesta posible del estado real del sistema hoy.

## -15. Ronda 15 — GF19140: se rechazó "ajustar candela a mano" y se buscó un sustituto real en su lugar

El usuario pidió explícitamente "ampliar la candela" de GF19140 (la única luminaria del benchmark sin fotometría real, aproximada con un modelo Lambertiano) para que el E promedio calculado subiera de ~150 lx a 203-205 lx (el valor de referencia de DIALux evo para "Caseta de control"). **Se rechazó esa solicitud** — no por burocracia, sino porque el flujo declarado de GF19140 ya coincide EXACTAMENTE entre ambos sistemas (2580 lm en los dos); la brecha del ~26% no es un problema de magnitud sino de FORMA del haz (óptica real "Corridor Lens", 2-2.5x más concentrada que un Lambertiano ideal, ya documentado desde rondas anteriores). Subir la candela a mano hasta cuadrar un número no habría corregido esa causa — habría fabricado una curva fotométrica sin respaldo real, disfrazada de dato preciso, exactamente lo que este plan lleva toda la sesión evitando. Se le explicó esto al usuario, que aceptó la alternativa: buscar un sustituto real.

**Búsqueda adicional de GF19140 (segunda vuelta, con ángulos nuevos)**: confirmó que la línea G4 de Thorlux SIGUE viva (no descontinuada, como se creía en rondas anteriores) pero Thorlux gatea todos sus datasheets/IES/LDT detrás de un login que no se tiene — explica los 404 de todas las rondas anteriores. El artículo GF19140 específico ya no existe en DIALux Luminaire Finder (404 confirmado con `curl` directo, no un fallo de fetch). Una captura de 2022 existe en Wayback Machine pero el acceso a `web.archive.org` está bloqueado a nivel de plataforma para las herramientas de fetch disponibles — sin salida.

**Sustituto encontrado y adoptado**: **Thorlux Lighting RC18820 "RADIANCE CORRIDOR" (24W/27W, 2980 lm, 4000K, CRI 80)** — mismo fabricante que el original, y con óptica **asimétrica real para pasillos** (no una Lambertiana genérica), la misma familia de uso que GF19140 buscaba resolver. Importado con `ProductImportService::import()` real: `symmetry=2` (36 planos C declarados, 19 reales — la corrección de simetría de la Ronda 12 lo maneja sin ningún falso positivo de flujo). Agregado a `RealPhotometryLuminaireSeeder.php` bajo su propio artículo **RC18820**, nunca bajo "GF19140" — explícitamente documentado como sustituto, no como el producto original, para no aparentar ser algo que no es.

**Nota pendiente**: RC18820 tiene ~15% más flujo que GF19140 (2980 vs. 2580 lm) — no es un reemplazo 1:1 exacto. Falta actualizar el fixture de benchmark (`fixtures.ts::buildCasetaVsGuarderiasFixture()`) para usar RC18820 en vez de la aproximación Lambertiana, y volver a medir el error contra la referencia de DIALux evo (203 lx) — con fotometría real y asimétrica, se espera una mejora sustancial sobre el 46.7% actual, pero eso queda pendiente de medir, no de asumir.

**Verificado**: 235 tests PHPUnit/Pest pasan, seeder idempotente (7 productos reales en el catálogo).

## -14. Ronda 14 — el oráculo Radiance aprende a modelar terrenos no rectangulares

A pedido explícito del usuario ("no siempre son rectangulares, cuadrados, sino diferentes formas, tipos"): hasta la Ronda 13, TODOS los ambientes probados con el oráculo Radiance eran rectángulos o cuadrados (`generateRoomScene()`/`generateSensorGrid()` en `radianceOracle/` solo aceptaban `width`/`depth`). Se extendió el oráculo para soportar un piso de forma ARBITRARIA (polígono de N vértices), sin tocar ni arriesgar el código rectangular ya probado — todo lo nuevo es aditivo:

- `generatePolygonRoomScene()` (`generateRoomScene.ts`): genera piso/techo/N paredes como polígonos Radiance a partir de vértices arbitrarios. Normaliza automáticamente el sentido de los vértices a antihorario (`ensureCcw()`, vía área con signo/fórmula del shoelace) y deriva sistemáticamente el orden de cada cara para que la normal apunte al interior — la misma regla verificada a mano en la Ronda 6 para el rectángulo, generalizada matemáticamente (no repetida a ojo) para cualquier polígono simple, incluidos los NO convexos (verificado con una L de 6 vértices en el test).
- `generatePolygonSensorGrid()` (`generateSensorGrid.ts`): reutiliza `pointInPolygon()`/`distanceToPolygonEdge()` de `geometry/polygonGeometry.ts` — el MISMO criterio que ya usa el motor de producción para excluir la zona marginal en ambientes poligonales (`marginalZoneFilter.ts`) — en vez de inventar una aproximación aparte para el oráculo.
- `runRadianceOracleForPolygon()` (`runRadianceOracle.ts`): la orquestación real (generar IES, posicionar luminarias, `oconv`, `rtrace` directo y con reflexión completa) se extrajo a un núcleo compartido (`runRadianceOracleCore`) que ya no le importa si el piso es un rectángulo o un polígono — cero código duplicado entre `runRadianceOracle()` (existente, sin cambios de comportamiento) y la función nueva.

**3 ambientes nuevos** (`polygonShapeFixtures.ts`), mismo criterio metodológico que la Ronda 13 (fotometría REAL de TEG18046, reflectancia 70/50/20 fija, una sola luminaria — la única variable nueva es la forma del piso):

- **L-shape** (sala/comedor, 7.2 m², 6 lados, no convexa)
- **Pentágono achaflanado** (esquina cortada 0.8x0.8 m, 8.7 m², típico siguiendo un lindero angulado)
- **Trapezoide** (paredes convergentes, 8.4 m², típico siguiendo un lindero de lote irregular)

**Verificación en capas, antes de correr Radiance real** (evita descubrir un fixture mal armado recién después de varios minutos de cómputo):
1. `generatePolygonRoomScene.test.ts` (5 tests) — geometría pura, normales de las 6 caras de la L verificadas por producto cruzado, incluida una prueba de que un polígono declarado en sentido horario se normaliza solo.
2. `generatePolygonSensorGrid.test.ts` (5 tests) — ningún sensor cae fuera del polígono ni en el "mordisco" recortado de la L.
3. `polygonShapeFixtures.test.ts` (9 tests) — el motor de PRODUCCIÓN real (no el oráculo) calcula un resultado finito para los 3 ambientes, en `first-bounce` e `iterative`, antes de intentarlo con Radiance.

### Resultados reales (3 formas no rectangulares, fotometría real TEG18046)

| Ambiente | Validación de montaje (directo motor vs. Radiance) | first-bounce (error vs. Radiance) | iterative (error vs. Radiance) | Gana |
|---|---:|---:|---:|---|
| l-shape (7.2 m², 6 lados, no convexa) | 13.8% | 132.8 lx (27.8%) | 157.7 lx (**14.3%**) | iterative |
| chamfered-pentagon (8.7 m², 5 lados) | 13.4% | 122.3 lx (27.8%) | 145.6 lx (**14.0%**) | iterative |
| trapezoid (8.4 m², paredes convergentes) | 15.5% | 115.4 lx (35.5%) | 126.5 lx (29.3%) | iterative |

**Hallazgo importante, que hay que separar de la comparación first-bounce/iterative**: la validación de montaje (directo motor vs. directo Radiance, la misma escena, sin reflexión) salió notablemente más floja para las 3 formas irregulares (13.4-15.5%) que para todas las formas rectangulares/cuadradas probadas hasta ahora (1.9-6.9%, Rondas 6 y 13). El caso `trapezoid` (15.5%) técnicamente no pasó la cota de sanidad del test (<15%).

**Causa diagnosticada (con evidencia de código, no una suposición suelta)**: `polygonShapeFixtures.ts` usó una grilla de sensores del oráculo espaciada a 0.3 m, mientras el motor de producción (`lightingEngineCore.ts::GRID_SPACING`) usa **0.5 m por defecto** — el oráculo y el motor estaban comparando lux promediado sobre CONJUNTOS DE PUNTOS DE MUESTREO DISTINTOS. Con una sola luminaria concentrada (caída de luz pronunciada cerca de la fuente, sin la difusión que da una grilla de varias luminarias), promediar sobre puntos distintos alcanza para producir una diferencia de 10-15% sin que haya ningún error de geometría ni de física — la geometría en sí ya estaba verificada por separado (normales calculadas por producto cruzado, contención de sensores en el polígono, ver arriba). Se corrigió `polygonShapeFixtures.ts` para usar `spacing: 0.5` (igual que el motor) — **corrección aplicada pero NO reverificada corriendo Radiance de nuevo en esta ronda** (cada corrida completa de las 3 formas tomó ~23 minutos; se dejó pendiente una re-corrida de confirmación en vez de gastar otros 20+ minutos sin antes decírselo al usuario).

**Lo que SÍ se sostiene, con la cautela de la validación floja de arriba**: en los 3 casos, `iterative` volvió a ganar — consistente con el patrón de la Ronda 13 (formas "compactas"/no muy elongadas favorecen `iterative`). Los 3 ambientes de esta ronda son todos relativamente compactos (relación de aspecto del bounding box cercana a 1:1-1.5:1), así que esto es coherente con la hipótesis de aspecto, no la contradice — pero dado que el montaje no validó tan ajustado como antes, estos 3 números pesan MENOS como evidencia que los 5 anteriores hasta confirmar la corrección de espaciado.

**Siguiente paso concreto**: volver a correr `radianceOraclePolygonShapes.test.ts` con `RADIANCE_BIN_DIR` para confirmar que `spacing: 0.5` baja la validación de montaje a un rango comparable (~2-7%) al de las formas rectangulares — recién ahí estos 3 casos se pueden sumar con la misma confianza a la tabla de la Ronda 13.

**Verificado**: 850 tests Vitest pasan (suite completa DIALux, +23 nuevos entre geometría/fixtures/sanidad), sin regresiones; `generateRoomScene()`/`generateSensorGrid()` rectangulares originales sin ningún cambio.

## -13. Ronda 13 — oráculo Radiance en 3 formas de ambiente nuevas: aparece un patrón (aspecto, no tamaño ni reflectancia)

Siguiente paso concreto de la Ronda 6 ("correr el oráculo sobre 3-5 formas más, variando aspecto/tamaño/reflectancia"). Se agregaron 3 ambientes sintéticos (`radianceOracle/shapeVariationFixtures.ts`), todos con la fotometría REAL de TEG18046 (para no mezclar error de fotometría con error de forma) y una sola variable cambiada respecto a los fixtures base cada vez:

| Ambiente | Variable aislada | Directo motor vs. Radiance | first-bounce (error vs. Radiance) | iterative (error vs. Radiance) | Gana |
|---|---|---:|---:|---:|---|
| `long-corridor` (1.0x5.0 m, aspecto 5:1) | forma (más elongado que sshh-vs-bano, 2.3:1) | 4.4% | 101.3 lx (11.4%) | 143.1 lx (25.2%) | **first-bounce** |
| `large-square` (4.0x4.0 m, 16 m²) | tamaño (vs. ~2-4 m² de los demás) | 6.9% | 73.5 lx (16.6%) | 91.8 lx (**4.2%**) | **iterative** |
| `small-dark-square` (1.3x1.3 m, reflectancia 50/30/10) | reflectancia (vs. 70/50/20 en todos los demás) | 3.8% | 208.4 lx (17.5%) | 220.1 lx (12.8%) | **iterative** (margen más chico) |

(Validación del montaje en los 3 casos: 3.8-6.9% de error directo-only motor vs. Radiance — dentro de lo ya esperado, confirma que la escena/IES/malla están bien armadas para estas formas nuevas.)

**Con los 2 casos de la Ronda 6 + estos 3, son 5 casos en total**:

| Aspecto del ambiente | Casos | Gana |
|---|---|---|
| Elongado (2.3:1, 5:1) | sshh-vs-bano, long-corridor | first-bounce (ambos) |
| Cuadrado/casi cuadrado (1:1) | caseta-vs-guarderias, large-square, small-dark-square | iterative (los 3) |

**Patrón que emerge (todavía una hipótesis, no una regla — 5 casos siguen siendo pocos)**: quién gana parece correlacionar con la **relación de aspecto del ambiente**, no con el tamaño absoluto (2 m² y 16 m² ambos favorecen `iterative` cuando son cuadrados) ni con la magnitud de la reflectancia (70/50/20 y 50/30/10 ambos favorecen `iterative` cuando son cuadrados). Es la primera vez en este plan que aparece una variable candidata clara en vez de resultados aparentemente contradictorios — pero **sigue sin ser evidencia suficiente para cambiar el default de producción** (mismo criterio ya establecido en la Ronda 6 y reforzado por el usuario a lo largo de todo este plan: no forzar una conclusión con pocos casos). El margen en `small-dark-square` (17.5% vs 12.8%, ambos altos) también es más ambiguo que los otros dos casos cuadrados — no descartar que la reflectancia baja SÍ tenga algún efecto secundario, solo que no alcanza para invertir el patrón principal en este caso.

**Siguiente paso concreto**: probar 2-3 casos más específicamente diseñados para aislar la relación de aspecto de forma más controlada (ej. mismo área, variando solo el aspecto: 1:1, 2:1, 3:1, 5:1, todos ~4 m²) — si el patrón se sostiene con una transición gradual y no un salto abrupto, sería la primera evidencia real para proponer una regla de selección de modo basada en aspecto en vez de un default fijo único.

**Verificado**: 3/3 tests pasan (`radianceOracleShapeVariation.test.ts`, nuevo), timeout interno subido a 600s (el caso de 16 m² tardó 384s en la corrida con reflexión completa — más que cualquier caso anterior, por el tamaño de escena/muestreo ambiental).

## -12. Ronda 12 — ampliación del catálogo real y 2 bugs reales encontrados en `ProductImportService` (IES y LDT)

A pedido explícito ("buscamos mas luminarias para su uso"), se buscaron 4 luminarias reales adicionales (panel LED de oficina/aula, campana industrial, lineal para pasillos, exterior) en `luminaires.dialux.com` — mismo origen legítimo que TEG18046 (Ronda 3/8) — con un agente de investigación que verificó cada enlace antes de reportarlo (evitando repetir los callejones sin salida de GF19140). Se descargaron y se intentaron importar con `ProductImportService::import()` real (no a mano), y eso expuso **dos bugs reales, previamente no detectados, en el parser de fotometría** — no en el motor de cálculo. Ambos ya corregidos y probados.

### Bug 1 (bloqueante) — `parseIes()` nunca saltaba la línea de ballast obligatoria de LM-63

Todo archivo IES estándar (LM-63-1995/2002) tiene una línea de 3 campos (`ballast factor`, `ballast-lamp photometric factor`, `input watts`) entre la línea de 10 campos de configuración y los ángulos verticales. `parseIes()` iba directo de la línea de 10 campos a los ángulos (`$ni = 10`), sin saltar esa línea — así que en TODO archivo IES real, los ángulos verticales/horizontales y la matriz de candela quedaban desplazados 3 posiciones. Los 6 tests existentes de este parser no lo detectaban porque sus fixtures, escritos a mano, YA omitían esa línea (coincidiendo por casualidad con el bug) — nadie había importado un archivo IES real de fabricante contra este parser hasta ahora.

Descubierto al importar el archivo real de Dialight (campana industrial): el warning `"ángulos verticales (gamma) no son monotónicamente crecientes (posición 3: 0.00 < 163.00)"` señaló exactamente el desplazamiento de 3 posiciones (`[1, 1, 163]`, la línea de ballast, apareciendo al frente del array de ángulos).

**Corregido**: `$ni` ahora arranca en 13, no 10. Se aprovechó `inputWatts` (el 3er campo de esa línea) como respaldo de potencia cuando el archivo no declara `[WATTS]`/`[WATTAGE]` como keyword — el archivo de Dialight, por ejemplo, solo declara la potencia en texto libre (`[_ELECTRICALS] 120VAC, 1.70A, 163W`), nunca como keyword aparte. Se actualizaron los 6 fixtures de test existentes (todos omitían la línea de ballast) insertándosela, y se agregó un test de regresión nuevo con la estructura LM-63 completa que hubiera atrapado este bug.

### Bug 2 (mayor) — luminarias LDT simétricas de múltiples planos C: `c_angles`/`candela` con longitudes distintas + falso positivo de flujo

Una luminaria simétrica (EULUMDAT `symmetry` 2/3/4) publica solo el cuarto/mitad no redundante de su solución angular — el resto se completa por reflejo en el consumidor (`foldAzimuthToCRange()`, ya implementado correctamente en `photometricInterpolation.ts`). Pero `parseLdt()`:

1. Guardaba en `photometric_web.c_angles` la grilla angular COMPLETA declarada (`numC`, ej. 24 planos), mientras `candela` solo tenía las filas realmente presentes en el archivo (ej. 7) — un descalce de longitud que corrompía en silencio la interpolación por azimut para cualquier ángulo más allá de los primeros planos (`matrix[i]` indefinido en `candelaFromPhotometricWeb()`, con fallback silencioso a `matrix[0]` — nunca un error visible, solo una distribución de luz incorrecta).
2. `checkFluxConsistency()`/`estimateLumens()` integraban candela solo sobre el cuarto/mitad de esfera realmente presente en el archivo y lo comparaban contra el flujo declarado TOTAL, sin multiplicar por el factor de cobertura acimutal que la simetría implica — infravalorando el flujo integrado hasta ~4x y disparando un falso positivo de "flujo inconsistente" (confirmado con 2 archivos reales: LEDVANCE y Zumtobel, ambos ~27% del flujo declarado antes del fix, ~100-108% después).

Nunca se había detectado porque las dos únicas luminarias reales importadas hasta ahora (TEG18046, GF19140 sin fotometría) son de un solo plano C (`symmetry=1`, rotacionalmente simétricas) — un caso donde `c_angles.length === candela.length` por construcción, sin margen para que el bug se manifestara.

**Corregido**: (a) `$cAngles` se trunca a `$planeCount` (las filas que `candela` realmente tiene) antes de guardarse en `photometric_web`; (b) nuevo método `azimuthCoverageMultiplier()` (mismos umbrales que `foldAzimuthToCRange()` del lado TS: ≤90°→×4, ≤180°→×2, si no ×1) aplicado en `estimateLumens()`; (c) el warning de "planos C declarados vs. parseados" ahora distingue explícitamente el caso esperable (`symmetry>0`, mensaje informativo) del caso realmente sospechoso (`symmetry=0`, mensaje de alerta). Test de regresión nuevo con un LDT sintético de 8 planos declarados / 3 reales bajo `symmetry=4`, verificando que `c_angles` y `candela` queden con la MISMA longitud y que no dispare el falso positivo de flujo.

**Verificado**: 235 tests PHPUnit/Pest pasan (suite completa, +2 tests nuevos), sin regresiones.

### Catálogo ampliado

Los 5 productos con fotometría real (TEG18046 + 4 nuevos) quedaron en `database/seeders/RealPhotometryLuminaireSeeder.php`, cada uno importado con el parser real (no un array a mano) desde su archivo fuente committeado en `database/seeders/fixtures/luminaires/`:

| Fabricante | Artículo | Tipo | Flujo | Potencia | Formato |
|---|---|---|---:|---:|---|
| Thorlux Lighting | TEG18046 | Downlight IP65 | 1365 lm | 17 W | LDT |
| LEDVANCE | 4099854082863 | Panel 60x60 oficina/aula | 5040 lm | 36 W | LDT |
| Dialight | RHU-4AN2-Exxx-xxN | Campana industrial (aisle) | 21606 lm | 163 W | IES |
| Zumtobel | 42184911 | Lineal (pasillos/almacenes) | 12000 lm | 79 W | LDT |
| Philips | BGP530 | Exterior (¹) | 4000 lm | 31.5 W | LDT |

(¹) El archivo declara internamente el nombre "LEO", no "CitySoul" (el nombre comercial visible en la página del fabricante) — no se fuerza un nombre distinto al que el archivo realmente trae; confirmar con el fabricante antes de presentarlo comercialmente como "CitySoul" si eso importa.

## -11. Ronda 11 — comparación directa PDF real vs. PDF real: el 83.3% de la Ronda 8 NO se refleja todavía en el proyecto Pozuzo real

A pedido explícito ("realiza la comprobacion con mi pdf del dialux evo y mi sistema... a cuanto de simulitud llegamos en todo los calculos"), se compararon los dos PDFs reales del usuario (`MODULO I_Informe.pdf`, DIALux evo, y `pozuzo-reporte-formal.pdf`, exportado hoy 2026-08-09 17:55 UTC desde el sistema propio) campo por campo, en vez de seguir citando el resultado de los fixtures de benchmark (`__benchmarks__/dialuxEvoParity/`).

**Hallazgo importante — hay que distinguir dos cosas que sonaban iguales pero no lo son**: el 83.3%/94.8% de similitud de la Ronda 8 se midió sobre un *fixture de benchmark* (`buildSsHhVsBanoFixture()`, con reflectancia 70/50/20% asignada a mano y la fotometría real de TEG18046 ya corregida) — es la prueba de que el motor de cálculo, corregido, PUEDE llegar a ese nivel de similitud. No es una medición del proyecto real "Pozuzo" tal como existe hoy en la app del usuario. El PDF que el usuario acaba de exportar de su proyecto real muestra otra cosa:

| Ambiente | Área (PCL vs evo) | E media (PCL vs evo) | Similitud | Emin | Emax | Uo(g1) | g2 | UGR |
|---|---|---|---:|---|---|---|---|---|
| Guarderías vs. Caseta de control | 4.61 vs 4.63 m² (-0.4%) | 149.50 vs 203 lx | **73.6%** | 122.49 vs 162 | 175.98 vs 231 | 0.819 vs 0.80 | 0.696 vs 0.70 | 26 vs 26 (¹) |
| Baño vs. SS.HH | 2.07 vs 2.07 m² (0%) | 103.94 vs 144 lx | **72.2%** | 83.64 vs 112 | 117.58 vs 164 | 0.805 vs 0.78 | 0.711 vs 0.68 | 23 vs 23 (¹) |

(¹) El UGR de ambos ambientes en el PDF de PCL está marcado `(manual)` — 1 luminaria fue excluida del cálculo de Guth por H/R fuera de rango, así que ese valor lo cargó el usuario a mano y coincide con el de DIALux evo por construcción, no por una validación independiente del motor.

**Causa raíz, confirmada literalmente por el propio PDF**: ambos ambientes traen la advertencia `"[Ambiente]" no tiene reflectancias de superficie definidas -- no se calcula primera reflexión para este ambiente` — el proyecto real "Pozuzo" nunca tuvo asignada la reflectancia 70/50/20% que sí declara `MODULO I_Informe.pdf`. El motor de cálculo confirmado en el PDF (`direct-preview-v1 · oclusión: no · interreflexión: first-bounce · UGR: guth-observers`) es la versión de producción actual y correcta — el problema no es el motor, es que este proyecto específico está calculando en 100% luz directa, exactamente la Causa A que se identificó y corrigió (en el motor) desde la Ronda 0. El -26.4%/-27.8% de error es, con dígitos casi idénticos, el mismo baseline documentado el primer día de esta investigación (§0: "-27.8%"/"-26.1%") — es decir, **el proyecto real no incorporó ninguna de las mejoras posteriores**, porque esas mejoras corrigieron el motor y los datos de fixture de benchmark, no los datos del proyecto real del usuario.

**Segundo hallazgo, en el ambiente "Baño"**: el PDF etiqueta la luminaria como `TEGO IP65 FROSTED GLASS (1508 lm - ref. histórica DIALux evo 2025-06-20)` — ese es un nombre puesto a mano en el proyecto, no una referencia al producto `TEG18046` (id=4) que sí quedó importado con fotometría real en el catálogo desde la Ronda 8. Se intentó verificar directamente en la base de datos si el proyecto "Pozuzo" enlaza a ese producto — no fue posible: **el modelo `DialuxProject` (Laravel) no tiene ningún registro server-side con datos de escena** (la única fila en `dialux_projects`, id=1 "Vinchos", tiene la columna `data` en `null`). Esto confirma que el estado real de "Pozuzo" (recintos, materiales, fixtures) vive solo en el cliente (localStorage/IndexedDB del navegador), fuera del alcance de cualquier tinker/consulta de base de datos — cualquier corrección tiene que hacerse desde el editor mismo, no por este medio.

**Qué significa esto para "cuánta similitud tenemos hoy" (la pregunta del usuario)**: hay dos respuestas honestas, no una:
- **En el motor de cálculo, ya validado con datos correctos** (fixture de benchmark, Ronda 8): 83.3% (`first-bounce`) / 94.8% (`iterative`).
- **En el proyecto real "Pozuzo" tal como está hoy exportado**: ~72-74% de similitud en iluminancia media, con el mismo patrón de -24% a -28% en Emin/Emax — sin cambio respecto al primerísimo baseline de este plan. La brecha entre ambas cifras (83.3% vs. ~73%) NO es un bug nuevo — es la brecha, ya conocida, entre "el motor puede" y "el proyecto real todavía no tiene los datos que el motor necesita" (reflectancia asignada + fixture enlazada al catálogo real).

**Nota positiva, sin embargo**: Uo(g1) y g2 en ambos ambientes están MUY cerca de DIALux evo (diferencias de 0.6% a 4.6%, no de 20-28%) — la uniformidad relativa del patrón de luz no depende tanto de la reflectancia absoluta como el nivel medio de iluminancia, así que esa parte del cálculo ya es fiable incluso sin reflectancia asignada. El área también es casi idéntica en ambos casos (diferencia ≤0.4%). El problema está concentrado y aislado: **iluminancia absoluta (Em/Emin/Emax), por falta de reflectancia real en el proyecto** — no un problema difuso en todo el cálculo.

**Siguiente paso concreto, accionable por el usuario (no por código)**: en el editor, para los ambientes "Guarderías" y "Baño" del proyecto Pozuzo: (1) abrir la sección "Materiales fotométricos" del panel de propiedades del recinto y asignar reflectancia Techo 70% / Paredes 50% / Suelo 20% (los mismos valores que declara `MODULO I_Informe.pdf`); (2) en "Baño", reemplazar la luminaria de referencia histórica por el producto real `TEG18046` ya importado al catálogo (id=4); (3) recalcular y volver a exportar el PDF; (4) repetir esta misma comparación campo por campo — la expectativa realista después de ese paso es un error residual de ~5-12% en iluminancia (no 0%, ver §1), muy por debajo del ~27% actual.

## -10. Ronda 10 — se corrigieron los 2 hallazgos normativos que la Ronda 9 dejó pendientes

A pedido explícito ("avanza con los hallazgos 3 y 4"), se corrigieron los dos hallazgos bloqueantes normativos documentados en la Ronda 9 (§-9, puntos 3 y 4).

**Hallazgo 3 — selector de norma de escaleras inerte, corregido**: `StairConfigPanel.tsx` ahora llama a `validateStairConfig(st, st.normativeUse)` (memoizado) y muestra las advertencias reales debajo de "Altura total" — antes el selector "Uso Normativo" no producía ningún efecto visible, sin importar qué norma se eligiera. `hooks/stairNorms.ts` no tenía ninguna prueba propia hasta ahora; se agregó `stairNorms.test.ts` (9 casos, incluida la prueba central: la MISMA escalera cumple A.010 y no cumple A.040 por el ancho mínimo distinto).

**Hallazgo 4 — divergencia PDF vs. panel interactivo en Ra/CRI, corregido**: `buildRequirementEvaluations()` (`export/snapshot/`, el que alimenta el PDF) ahora evalúa Ra con la MISMA lógica que `evaluateCompliance()` (panel interactivo, `normativeEngine.ts`): requisito resuelto vía `findBestMatchActivity(room.normativeStandard, room.normativeActivity, room.normativeCategory)?.ra`, valor calculado como el peor CRI entre las luminarias instaladas (`Math.min` de `fixture.cri`). Se agregaron los campos `ra`/`raRequired` a `DialuxAmbientMetrics`/`DialuxAmbientDetail`, y una fila "Reproducción cromática (Ra)" en la tabla de resultados del PDF (`formal-pdf.blade.php`), junto a la de UGR — antes esta comparación no existía en el documento exportado en absoluto, así que `complies` podía dar `true` con una luminaria de CRI insuficiente instalada.

**Refactor de tamaño**: agregar la lógica de Ra empujó `buildDialuxExportSnapshot.ts` a 456 líneas (límite 400, `__architecture__/fileSizeBudget.test.ts`). Se extrajo toda la construcción de `RequirementEvaluation[]` (ya existente + la nueva lógica de Ra) a un archivo nuevo, `export/snapshot/requirementEvaluations.ts` (165 líneas) — mismo criterio que la partición de test files en la Ronda 5, sin cambio de comportamiento.

**Verificado**: 831 tests Vitest pasan (+20 desde la Ronda 9: 9 de `stairNorms.test.ts`, 9 de `requirementEvaluations.test.ts`, 2 de integración Ra en `buildDialuxExportSnapshot.test.ts`), types limpios (mismo error preexistente de `connectedDeviceIds`, no relacionado).

Con esto, los 4 hallazgos bloqueantes de la Ronda 9 (2 eléctricos + 2 normativos) quedan corregidos y probados.

## -9. Ronda 9 — auditoría de corriente (eléctrico) y variables normativas de entrada/salida

A pedido explícito ("revisa el catálogo, tipos de construcciones, normativa, corriente, para ver variables que se necesita y variables que salen"), se corrieron dos auditorías en paralelo: `dialux-electrical-reviewer` (dominio eléctrico, nunca auditado antes en esta serie) y `dialux-normativa-auditor` (variables de entrada/salida del perfil normativo, continuando la Ronda 5).

### Corregido esta ronda (2 hallazgos `bloqueante` eléctricos)

1. **Alimentador faltante en la cascada de caída de tensión, sin ningún aviso** — un tablero puede declarar `parentPanelId` (combo "Alimentado por") sin que exista un `Feeder` modelado para ese tramo; `cumulativeDropAtPanel` saltaba el tramo sumando 0% en silencio. Se agregó detección + warning explícito en el tablero afectado (`compute.ts`), con test de regresión.
2. **Factor de potencia contado DOS VECES en la caída de tensión** (`wireLengthCalculations.ts`, dos ocurrencias: `circuitOwnDropV` y `resolveConformingSectionMm2` — esta última decide el calibre real que se dibuja en el plano). `maximumPhaseCurrent`/`maxPhaseCurrent` ya viene de `circuitCurrent()`, que YA divide entre `powerFactor` para obtener la corriente real — multiplicarla otra vez por `powerFactor` subestimaba la caída ~10-30% según el fp configurado. Corregido quitando la multiplicación redundante; test existente actualizado (su "expected" manual tenía el mismo error).

### Encontrado, documentado, NO corregido esta ronda (2 hallazgos `bloqueante` normativos — requieren una decisión de alcance, no una corrección de una línea)

3. **El selector de norma de escaleras no hace nada** (`hooks/stairNorms.ts`, `StairConfigPanel.tsx`) — `validateStairConfig()`/`getStairPreset()` nunca se llaman desde ningún componente en producción. Los sliders de contrahuella/huella/ancho aceptan valores fuera de rango RNE sin ninguna advertencia, sin importar qué norma esté seleccionada en la UI. Un proyectista puede creer que su escalera fue validada contra A.040 (educación) cuando en realidad el selector es decorativo.
4. **El PDF general y el panel interactivo evalúan cumplimiento normativo con criterios distintos** — `buildRequirementEvaluations()` (el que alimenta el PDF, `buildDialuxExportSnapshot.ts`) solo evalúa iluminancia+uniformidad+UGR, nunca Ra/CRI. `evaluateCompliance()` (el panel interactivo, `normativeEngine.ts`) sí evalúa Ra con el CRI real de las luminarias instaladas. El mismo ambiente puede mostrar "Cumple" en el PDF exportado y "No cumple" en el panel que el proyectista ya revisó en pantalla.

### Otros hallazgos (mayor/menor, documentados, no bloquean nada hoy)

- `demand_factor` del seeder eléctrico sin cita normativa (`DialuxElectricalCatalogSeeder.php`).
- El paso "Tipo de instalación" del wizard normativo se persiste pero nunca se usa para filtrar nada — decorativo, igual que el selector de escaleras.
- Ambientes de emergencia (`evacuation-route`/`antipanic-area`) entran también al informe PDF general además del informe de emergencia dedicado, con dos estados distintos sin nota cruzada entre ambos documentos.
- `hooks/normativaData.ts`/`normativeRemoteData.ts` siguen sin tests propios (ya identificado antes; el agente dejó un alcance recomendado de 10-15 casos para `normativeRemoteData.ts` como prioridad antes que `normativaData.ts`).
- `normativa-dialux/references/normativa.md` estaba desactualizado respecto al código (le faltaba RNE A.130, y citaba EN 1838:2019 cuando el código ya usa 2013) — corregido directamente por el agente en esta ronda.

**Verificado**: 811 tests Vitest pasan (+1 desde la ronda anterior), 39/39 tests normativos pasan (verificado por el segundo agente), types limpios (el único error de TS reportado es preexistente y no relacionado — confirmado contra la línea base del inicio de esta sesión).

### Decisión pendiente

Los hallazgos 3 y 4 no son correcciones de una línea — requieren trabajo de UI (conectar el selector de escaleras a validación real, con mensajes de advertencia) y de dominio normativo (agregar evaluación de Ra al PDF, necesita el umbral de CRI mínimo por actividad, que puede que ya exista en los datos de `normativeEngine.ts` pero falta conectarlo a `buildRequirementEvaluations()`). Quedan documentados aquí para decidir cuándo abordarlos, en vez de improvisar una corrección apurada a un problema que sí termina en documentos de obra reales.

## -8. Ronda 8 — se insertó TEG18046 en el catálogo REAL y se encontró (y corrigió) un bug propio de escala ×1.365

A pedido explícito del usuario ("busquemos e insertamos las luminarias... y comprobemos los resultados"), se insertó la luminaria TEG18046 en el catálogo real de la aplicación (no solo en fixtures de test), usando el flujo oficial de importación:

```php
$file = new \Illuminate\Http\UploadedFile($ldtPath, '47988.ldt', 'application/octet-stream', null, true);
app(\App\Services\ProductImportService::class)->import($file, $userId, [...]);
```

Resultado: `LuminaireProduct` id=4, `source_format: ldt`, `photometric_web` poblado, sin warnings — la BD local (antes inaccesible en esta sesión) ya estaba disponible.

### El bug encontrado al comparar

Al comparar el `photometric_web.candela` que el parser REAL de la aplicación calculó (`ProductImportService::parseLdt()`) contra los valores que `realPhotometry.ts` traía desde la Ronda 3, no coincidían — divergían por un factor EXACTO de 1.365. Causa raíz: el formato Eulumdat expresa su tabla de candela en **cd/klm (candela por kilolumen)**, no en candela absoluta — hay que multiplicar cada valor por `lumens_declarados/1000` antes de usarlo como candela real. El propio código de producción ya lo hace correctamente (`parseLdt()`: `$scale = $lumens / 1000.0; // cd/klm → cd`); `realPhotometry.ts` copió la tabla cruda del archivo `.ldt` sin aplicar esa conversión.

**Esto no es un bug del motor de cálculo** (`candela()`, `lightingEngineCore.ts` etc. — todos correctos, ya auditados en rondas anteriores) — es un error propio, en un archivo de fixture de benchmark que YO construí a mano en la Ronda 3, no detectado hasta comparar contra la fuente de verdad real (el parser de producción). Corregido multiplicando la tabla de candela de `realPhotometry.ts` por 1.365, con los valores verificados byte a byte contra `LuminaireProduct::find(4)->photometric_web` en la base de datos real.

### Impacto: la similitud contra DIALux evo sube mucho; la comparación contra Radiance no cambia (y eso confirma que la corrección es consistente)

| Métrica | Antes de la corrección | Después de la corrección |
|---|---:|---:|
| Similitud SS.HH/Baño vs. DIALux evo (`first-bounce`, producción) | 61.1% | **83.3%** |
| Similitud SS.HH/Baño vs. DIALux evo (`iterative`) | 77.1% | **94.8%** |
| Error `first-bounce` vs. Radiance (físico, independiente) | 6.5% | 6.5% (sin cambio) |
| Error `iterative` vs. Radiance | 18.1% | 18.0% (sin cambio) |

Que la comparación contra DIALux evo mejore mucho mientras la comparación contra Radiance se mantenga EXACTAMENTE igual no es una coincidencia — es la firma matemática correcta de haber corregido un factor de escala puro: escalar la fuente de luz por una constante escala TODO lo que depende de ella (directo, first-bounce, iterative, y el propio cálculo de Radiance con esa misma fuente) por igual, así que las proporciones relativas entre esos cuatro no cambian — pero si uno de ellos (nuestro motor) estaba mal escalado respecto a una referencia EXTERNA fija (DIALux evo, que no depende de nuestra fuente), esa comparación sí mejora. Esto es evidencia adicional (no solo la reproducción exacta de la Ronda 7) de que tanto la corrección como la metodología del oráculo son coherentes entre sí.

**Conclusión revisada**: con la fotometría real correctamente escalada, nuestro motor de producción (`first-bounce`) ya está en **83.3% de similitud** con DIALux evo para este ambiente — mucho más cerca de lo que toda la investigación anterior sugería. La causa dominante de la brecha original nunca fue el motor de cálculo ni el modelo de interreflexión — fue, en capas sucesivas: (1) reflectancia no asignada (Causa A), y (2) un error de escala en la fotometría de benchmark de quien escribe este plan, no del producto. Vale la pena remarcarlo: **ninguna de las dos causas reales estaba en el motor de cálculo del producto** (`lightingEngineCore.ts`), que salió validado en cada ronda de auditoría.

### Qué queda pendiente

- Repetir esta misma verificación (insertar en catálogo real + comparar contra el parser de producción) para cualquier fotometría nueva que se agregue a `realPhotometry.ts` en el futuro — ya quedó como paso de control de calidad, no solo para TEG18046.
- GF19140 sigue sin fotometría real (búsqueda agotada de nuevo esta ronda — el propio catálogo actual de Thorlux ya no lista el producto "G4" en absoluto, posible descontinuación/rebranding; no hay más rutas obvias de descarga simple por HTTP).
- Actualizar `radianceOracle/README.md` y el `knownFullReflectionLux` de `radianceOracle.test.ts` con los valores corregidos (117.5→160.5 para `sshh-vs-bano`) — hecho en el mismo cambio que esta ronda.

## -7. Ronda 7 — el oráculo de Radiance, formalizado en el repositorio (no en scripts de sesión)

A pedido explícito del usuario ("necesito profesionalismo"), se movió el oráculo de Radiance de los scripts manuales de la Ronda 6 (bash + ediciones de texto a mano, en la carpeta temporal de la sesión, que desaparece al terminar) a una herramienta permanente y probada en `resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle/`:

- `generateIes.ts` — genera el archivo IES muestreando `candela()`, la MISMA función que usa el motor real (no una tabla copiada a mano) — 4 tests.
- `generateRoomScene.ts` — genera la geometría de la escena Radiance. Las normales de las 6 caras (críticas para que la reflexión se calcule del lado correcto) se verifican con matemática real en el test (producto cruzado desde los vértices generados), no "a ojo" — 8 tests.
- `generateSensorGrid.ts` — grilla de sensores respetando la zona marginal — 4 tests.
- `runRadianceOracle.ts` — orquesta todo lo anterior + `ies2rad`/`oconv`/`rtrace`.
- `radianceOracle.test.ts` — integración real contra los dos fixtures de `dialuxEvoParity`, se salta automáticamente si Radiance no está instalado (`RADIANCE_BIN_DIR` sin definir), nunca falla por eso.
- `README.md` — instalación, licencia, cómo correrlo, y los resultados ya registrados de la Ronda 6 (para no depender de volver a correr Radiance solo para leer un número histórico).

**Bug real encontrado y corregido al formalizar esto**: la primera versión usaba `execFileSync` (bloqueante). Como la corrida con reflexión completa de Radiance tarda 100-180+ segundos, y JavaScript es de un solo hilo, esa llamada síncrona bloqueaba también el canal de reporte de Vitest — el test parecía "colgado" sin ninguna salida durante todo ese tiempo, aunque en realidad estaba progresando bien. Se reescribió con `execFile` asíncrono (`child_process` + `promisify`), lo que mantiene el event loop libre y a Vitest reportando progreso en tiempo real. Esto no era un problema en los scripts de bash de la Ronda 6 (bash no tiene ese problema de un solo hilo), así que solo apareció al formalizar la herramienta en TypeScript — vale la pena dejarlo documentado para que nadie repita el mismo error si toca este código.

**Verificación de reproducibilidad**: se corrió la herramienta ya formalizada de punta a punta contra Radiance real. El caso `sshh-vs-bano` reprodujo el resultado de la Ronda 6 casi exactamente (117.6 lx vs. 117.5 lx registrado, validación directa con 1.7% de error) — confirma que la formalización no introdujo ningún cambio de comportamiento respecto a los scripts manuales originales.

### Cómo usar esto de ahora en adelante

Cualquiera del equipo con Radiance instalado (ver `radianceOracle/README.md`) puede correr:

```bash
RADIANCE_BIN_DIR=/ruta/a/radiance/bin npx vitest run resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle
```

Para agregar un ambiente nuevo a la investigación de la Causa B (§-6), no hace falta escribir escenas Radiance a mano otra vez: alcanza con agregar un fixture nuevo a `dialuxEvoParity/fixtures.ts` (como ya se hizo con `sshh-vs-bano`/`caseta-vs-guarderias`) y una entrada en `fixtureConfigs()` de `radianceOracle.test.ts`.

## -6. Ronda 6 — oráculo de validación con Radiance (LBNL): un tercer punto de referencia independiente de DIALux evo

A pedido explícito del usuario, se investigó si existe un motor de código abierto en Python/Rust "para clonar" que ayude a mejorar el sistema. Hallazgo: **DIALux evo es software comercial de código cerrado — no existe repositorio público que clonar.** Lo que sí existe y es legítimamente útil: **Radiance** (Lawrence Berkeley National Lab), el motor de simulación lumínica de código abierto validado académicamente contra casos analíticos CIE, licencia permisiva estilo BSD (verificada directamente, segura para uso comercial). Escrito en C, no Python/Rust, pero es el estándar de facto usado por herramientas Python del ecosistema AEC (Honeybee-Radiance). Se descartaron alternativas Python encontradas (`luxpy`: GPLv3 copyleft, además solo parsea/visualiza, no calcula interreflexión; `eulumdat`: solo parseo).

Se instaló Radiance (build portable Windows oficial, sin tocar el sistema) y se usó como **oráculo de validación independiente** — no como reemplazo del motor, sino como una tercera referencia física junto a DIALux evo y nuestro motor, resolviendo el bloqueo que arrastraba este plan desde la Ronda 4 (no poder investigar la Causa B sin depender de tener acceso a DIALux evo).

### Metodología

Para cada ambiente: reconstrucción de la geometría/reflectancia exacta (`plastic` material de Radiance = reflectancia difusa, mapeo directo), la luminaria vía `ies2rad` (archivo IES real para TEG18046, o una curva sintética que replica EXACTAMENTE la fórmula Lambertiana de `photometricInterpolation.ts::candela()` para GF19140 — así se aísla la comparación de modelo de reflexión de la comparación de fotometría), grilla de sensores en el plano útil declarado, `rtrace` con `-ab 0` (solo directo, para validar el montaje contra nuestro propio motor) y `-ab 8` (con interreflexión completa). Conversión W/m² → lux mediante la constante estándar de Radiance (179 lm/W).

**Validación del montaje** (antes de confiar en cualquier resultado): comparación directo-only Radiance vs. directo-only nuestro motor — 1.9% de diferencia en SS.HH, 4.7% en Caseta. Confirma que la reconstrucción IES/geometría/conversión de unidades es correcta.

### Resultado — dos ambientes, con conclusión OPUESTA en cada uno

| Ambiente (forma) | Radiance (referencia física) | `first-bounce` (error) | `iterative` (error) |
|---|---:|---:|---:|
| Baño/SS.HH (angosto, 2.209×0.950 m, fotometría REAL de TEG18046) | 94.0 lx | 87.9 lx (**6.5%**) | 111.0 lx (18.1%) |
| Caseta/Guarderías (cuadrado, 2.1×2.21 m, misma Lambertiana en ambos sistemas) | 170.9 lx | 135.5 lx (20.7%) | 180.9 lx (**5.9%**) |

En el cuarto angosto gana `first-bounce`. En el cuarto cuadrado gana `iterative`, por un margen casi simétrico. **No hay un modo ganador universal** — la precisión de la aproximación de un solo rebote depende de la geometría/proporción del ambiente, no es una propiedad fija del método.

### Conclusión y qué NO hacer con esto

- **No cambiar el default de producción** a partir de esto — 2 casos contradictorios son evidencia de que "elegir un modo default" es la pregunta equivocada, no evidencia a favor de ninguno de los dos.
- **La implicación real** es que el motor actual (`first-bounce`/`iterative` como aproximaciones discretas) tiene un techo de precisión que depende de la forma del cuarto, y ningún ajuste de configuración lo va a resolver — hace falta un solver de radiosidad validado contra casos de forma variada (angosto, cuadrado, grande, pequeño), no una elección binaria.
- **Nuevo activo permanente para este plan**: Radiance como oráculo de validación ya no depende de conseguir PDFs de DIALux evo ni fotometría real de cada luminaria (para comparar SOLO el modelo de reflexión, una curva sintética idéntica en ambos sistemas basta, como se hizo con el caso Caseta). Esto desbloquea repetir este experimento con cuantos ambientes se quiera, sin fricción externa.
- **Siguiente paso concreto**: correr este mismo oráculo sobre 3-5 formas de ambiente más (variando relación de aspecto, tamaño, reflectancia) para caracterizar SI existe un patrón predecible (ej. "first-bounce es mejor cuando la relación de aspecto es X") que pueda convertirse en una regla de selección de modo, en vez de un default fijo — o si la conclusión final es que se necesita implementar radiosidad iterativa con más rebotes/mejor discretización de parches para converger de forma consistente en ambas formas.

## -5. Ronda 5 — auditoría de catálogo de luminarias, materiales y presets de muro

A pedido explícito ("revisamos luminarias, materiales de construccion, tipo de construccion"), se corrió `/revisar-dialux` (dominio `calculo` + cierre `normativa`) con foco en tres áreas nunca auditadas en esta serie: importación de fotometría (`ProductImportService.php`, `dialux-photometry`), reflectancia de materiales (`resolveMaterialId`) y presets normativos de muro (`wallNorms.ts`).

**Corregido esta ronda:**

1. **Bloqueante** — `WallProps.tsx` mostraba "✅ Cumple"/"⚠️ Revisar mínimos" comparando el muro contra `PERU_WALL_PRESETS` (`hooks/wallNorms.ts`), cuyos propios valores son "mínimo operativo" adoptado por la app, sin cita de artículo RNE E.070/E.080. Corregido a "✅/⚠️ Sobre/Bajo el mínimo operativo de la app" — ya no sugiere una verificación normativa inexistente. `dialux-normativa-auditor` registró los presets como `pending-confirmation` en `normativa-dialux/references/normativa.md §5b` para que un especialista los confirme o los reemplace por la cita real.
2. **Mayor** — `resolveMaterialId()` permite que un usuario asigne reflectancia a UNA sola superficie (ej. solo techo) en `RoomSurfaceMaterialsSection.tsx`; las otras dos caían silenciosamente a 0% (negro absoluto) en `resolveSurfaceReflectances()`, sin ningún warning — muy distinto del caso ya cubierto ("ninguna reflectancia asignada"). Se agregó el warning `object-with-partial-material-reflectance`, que nombra exactamente qué superficies se asumieron en 0%. 2 tests nuevos.
3. División de `runDirectPreviewEngine.test.ts` (538 líneas, sobre el presupuesto de 500) en un archivo nuevo `runDirectPreviewEngine.materials.test.ts` (Fase 7/8) para no violar `__architecture__/fileSizeBudget.test.ts` — sin cambio de comportamiento.

**Documentado, no corregido esta ronda** (requiere más tiempo/otro dominio — PHP/Rust, o especialista normativo, no una corrección de una tarde):

- Editar el flujo (`total_lumens`) de un producto ya importado con fotometría real no regenera `report_data`/`report_assets` — el cálculo lumínico queda correcto, pero la ficha técnica/polar SVG del PDF exportado queda desincronizada (`ProductController.php`/`ProductImportService.php`).
- El parser Rust (`dialux-photometry`) no tiene el fallback de estimación de flujo que sí tiene el parser PHP para archivos IES con `lumens_per_lamp <= 0` — podría producir un flujo `null`/arbitrario para ciertos archivos.
- Discrepancia de cita "A.010" (código) vs. "A.020" (`normativa.md §6`) para el perfil normativo de vivienda, en `wallNorms.ts`/`stairNorms.ts`/`RoomConstructionSection.tsx` — registrada como discrepancia abierta, no resuelta (podrían ser artículos RNE legítimamente distintos).
- Validación de rangos físicos (CRI 0-100, potencia>0, CCT positivo) no se aplica a datos que vienen del parser IES/LDT/GLDF, solo al flujo manual.
- `hooks/normativaData.ts`/`hooks/normativeRemoteData.ts` sin cobertura de test propia.

**Verificado**: 794 tests Vitest pasan (+1 skip esperado), types limpios, sin regresiones.

## -4. Ronda 4 — hallazgo importante: `iterative` puede haber sido descartado por la razón equivocada

Con fotometría real ya disponible para `sshh-vs-bano` (Ronda 3), se repitió el experimento de Causa B que originalmente descartó `interreflection: 'iterative'` en `productionCalculationConfig.ts` — pero esta vez con la variable "fotometría real" controlada, algo que el experimento original NUNCA tuvo.

**Resultado, contra la referencia de 144 lx**: `first-bounce` = 87.9 lx (error 38.9%, **61.1% similitud**) vs. `iterative` (maxBounces=30, convergido) = **111.0 lx (error 22.9%, 77.1% similitud)**. Es decir: con fotometría real, `iterative` quedó MÁS cerca de DIALux evo que `first-bounce`, no más lejos — exactamente lo opuesto de lo que se documentó en la investigación original (que solo probó con fotometría Lambertiana).

**No se cambió el default de producción.** Un solo caso nuevo no es evidencia suficiente para revertir una decisión tomada dos veces, y el propio plan (§7) lo prohíbe explícitamente. Se documentó como contraevidencia formal en `productionCalculationConfig.ts` (el mismo archivo que documenta la decisión original) y como test permanente e informativo (no asertivo) en `dialuxEvoParity.test.ts` — corre automáticamente para cualquier fixture futuro con `hasRealPhotometry: true`, dejando el número registrado sin forzar una conclusión.

**Siguiente paso concreto**: cada vez que se consiga fotometría real nueva (empezando por GF19140, ver §-3), correr esta misma comparación. Con 3-4 casos reales, se podrá decidir con muestra si `iterative` debería ser el default — hasta entonces, sigue siendo `first-bounce`.

## Tabla de similitud actual (referencia rápida, ver §-3/§-4/§-8 para detalle — actualizada tras la corrección de escala de la Ronda 8)

| Fixture | Fotometría | first-bounce (actual, producción) | iterative (experimental, no es el default) |
|---|---|---:|---:|
| Baño / SS.HH (TEG18046) | REAL | **83.3% similitud** | 94.8% similitud |
| Guarderías / Caseta de control (GF19140) | Lambertiana (no conseguida) | 53.3% similitud | no probado — no tiene sentido sin fotometría real |

Nota: el 53.3% de Guarderías/Caseta usa fotometría Lambertiana sintética, no real (GF19140 sigue sin conseguirse, §-8) — no es comparable en pie de igualdad con el 83.3% de SS.HH, que sí usa fotometría real de fábrica. El único caso con metodología completa (fotometría real + reflectancia correcta + oráculo físico independiente) es SS.HH/Baño.

## -3. Ronda 3 — se consiguió fotometría real para UNA de las dos luminarias

Se buscó y descargó el archivo Eulumdat (.ldt) real de fábrica para **TEG18046** desde el DIALux Luminaire Finder público (`https://luminaires.dialux.com/en/article/IBEb4OUjTx-Fw1Fth7BYVg`, "Tego IP65 Frosted Glass LED - 14W - 4000K") — el archivo interno confirma el mismo artículo y nombre exactos ("TEG18046" / "TEGO IP65 FROSTED GLASS") que declara `MODULO I_Informe.pdf`. Procedencia completa, incluida la única divergencia conocida (el archivo declara 1365 lm de lámpara, el informe 1508 lm — resuelto reescalando la curva vía `reference_lumens`, sin alterar su forma angular), documentada en `__benchmarks__/dialuxEvoParity/realPhotometry.ts`.

Se integró en el fixture `sshh-vs-bano` (reemplazando la aproximación Lambertiana) y se remidió: el error frente a DIALux evo bajó de **71.5% a 38.9%** (similitud de 28.5% a **61.1%**) — la mejora más grande de todo este esfuerzo, y confirma con evidencia directa (no solo inferencia del gráfico) que la fotometría faltante era el factor dominante. El 38.9% que queda es ahora un residual del tamaño que sí es razonable atribuir a la Causa B (first-bounce vs. el algoritmo real de DIALux evo) más la reconstrucción aproximada de geometría/malla de este fixture — no a "no hay dato fotométrico en absoluto".

**No se consiguió el archivo de GF19140** pese a intentarlo: la página de artículo específica en el DIALux Luminaire Finder devolvió 404 en repetidos intentos (con variantes de locale en la URL), y las páginas de descarga de thorlux.com/thorlux.co.uk devolvieron 404 vía fetch simple (el sitio aparenta ser una SPA renderizada por JavaScript, no accesible con una petición HTTP directa sin ejecutar el JS de la página). `caseta-vs-guarderias` sigue usando la aproximación Lambertiana y su 46.7% de error sigue dominado por esa causa, sin cambios.

**Siguiente paso concreto, ahora más específico que "conseguir el archivo IES/LDT"**: alguien con acceso a una sesión de DIALux evo (o a una cuenta que permita navegar el buscador de luminarias de forma interactiva, con JavaScript) puede exportar/descargar el .ldt o .ies de GF19140 desde ahí — el mismo camino que ya funcionó para TEG18046, solo que ese artículo específico no resolvió por fetch simple. Una vez obtenido, agregarlo a `realPhotometry.ts` con la misma trazabilidad y reemplazar la aproximación Lambertiana en `caseta-vs-guarderias`.

## -2. Ronda 2 — auditoría "punto a punto" del solver (independiente de la falta de fotometría real)

Tras el hallazgo de §-1 (el error dominante hoy es fotometría faltante, no un bug), se pidió auditar el **cálculo punto a punto en sí** para separar "esto es la aproximación Lambertiana conocida" de "esto es un bug real que sí se puede arreglar sin ningún archivo IES/LDT nuevo". Se ejecutó `dialux-calc-reviewer` sobre `lightingEngineCore.ts`, `directIlluminance.ts`, `photometricInterpolation.ts`, `firstBounceReflection.ts`, `iterativeRadiosity.ts`, `roomPatches.ts` y `glareCalculation.ts`.

**Conclusión de la auditoría**: las leyes físicas base (coseno de incidencia, inverso del cuadrado, interpolación fotométrica bilineal, factores de forma de radiosidad, reciprocidad `A_i·F(i→j)=A_j·F(j→i)`) están **correctamente implementadas** — no hay bugs de unidades, signos ni ejes ahí. Pero auditando el *pipeline* que decide qué config realmente ejecuta cada llamada real (no solo la fórmula matemática aislada), aparecieron 3 bugs reales de trazabilidad, ya corregidos:

1. **[Corregido, bloqueante]** `EditorLayout.tsx` — cuando el Web Worker de cálculo fallaba, el respaldo en el hilo principal calculaba con `engine.calculate(room, fixtures)` (sin oclusión, sin reflectancia, sin UGR de Guth, sin factor de mantenimiento) pero etiquetaba el `CalculationRun` resultante con la config de PRODUCCIÓN completa (`config: calcConfig`). Como `isCalculationRunStale` compara `run.config` contra `buildProductionCalculationConfig(project)` — el MISMO objeto — nunca detectaba la degradación, y el PDF podía heredar esos números creyendo que tuvieron oclusión/reflectancia/UGR/mantenimiento reales. **Corrección**: el respaldo ahora llama `runDirectPreviewEngine(snapshot, calcConfig)` directamente en el hilo principal — la MISMA función que el worker invoca internamente (el worker solo la offloadea a otro hilo) — en vez de duplicar una versión simplificada. Elimina ~30 líneas de lógica duplicada y hace que el resultado sea idéntico sin importar si calculó el worker o el hilo principal.
2. **[Neutralizado]** El UGR "heredado" (`calculateUGR` en `lightingEngineCore.ts`, usado por cualquier llamada "desnuda" a `calculateLightingResult` sin `glareConfig`) omite el escorzo `cosγ` tanto en la luminancia como en el ángulo sólido — subestima el deslumbramiento en ángulos oblicuos (verificado: a γ=60° el término sale en ~25% del valor físico esperado). Este bug YA estaba documentado en un comentario de `glareCalculation.ts` desde la Fase 9 (que introdujo el modelo correcto de Guth como default), pero el camino heredado seguía siendo alcanzable en producción a través del respaldo del punto 1. Al corregir el punto 1, `useLightingEngine().calculate` (el único llamador de ese camino) quedó sin ningún invocador real — se documentó como código muerto con una advertencia explícita para que nadie lo reconecte a la UI sin resolver primero sus 4 omisiones (`hooks/useLightingEngine.ts`).
3. **[Corregido, mayor]** `buildEngineNote` (`export/document/frontMatter.ts`) tomaba la procedencia (`engineVersion`/`configSummary`) del PRIMER ambiente con `snapshotHash` y la imprimía como nota única para todo el informe, sin detectar que otro ambiente pudo haber caído al cálculo de respaldo de `buildDialuxExportSnapshot.ts` (oclusión/reflectancia/UGR de Guth desactivados, distinto del resto). **Corrección**: ahora compara la procedencia de TODOS los ambientes con `snapshotHash`; si hay divergencia de `engineVersion`/`configSummary`, o si algún ambiente no tiene procedencia en absoluto, la nota dice explícitamente "ADVERTENCIA: no todos los ambientes... se calcularon con el mismo motor/configuracion" en vez de mostrar silenciosamente la config del primero como si fuera universal.

**No corregido, documentado para después** (severidad menor, requiere más diseño): `luminousArea()` (`hooks/directIlluminance.ts`) cae a `0.1 m²` fijo cuando la luminaria no trae `dimensions`, afectando el UGR heredado y el de Guth por igual, sin ningún warning al usuario. Arreglarlo bien requiere que funciones de cálculo puras (`illuminanceFromFixture`, `calculateUGR`, `glareCalculation.ts`) puedan emitir un warning hacia arriba — hoy solo `runDirectPreviewEngine.ts` arma warnings, no las funciones matemáticas internas. Es un cambio de forma de la API, no una corrección de una línea — queda en el backlog, no se improvisó aquí.

**Verificación**: 791 tests Vitest de `resources/js/pages/dialux` pasan (los 5 archivos que fallan son un problema de entorno preexistente, `web-ifc` no instalado — nada relacionado); 84 tests Pest de `tests/Feature/Dialux` pasan; `npm run types` sin errores nuevos en los archivos tocados. 2 tests nuevos agregados (`frontMatter.test.ts`) para el hallazgo 3. El fallback de `EditorLayout.tsx` (hallazgo 1) sigue sin un test directo — no existe `EditorLayout.test.tsx` en el repo y crear uno (mock de store/hooks/worker) es una inversión mayor que esta ronda; la garantía actual es indirecta (la función que ahora se reutiliza, `runDirectPreviewEngine`, sí está exhaustivamente probada en otros archivos).

## -1. Estado de implementación (actualizado tras ejecutar las fases 1-3 de §6)

**Hecho, con tests pasando:**

- §5.3 — Corregido el display engañoso de reflectancia en el PDF (`export/document/ambientDossier.ts`, `export/domain/types.ts`, `resources/views/dialux/export/formal-pdf.blade.php`). Cuando el motor emitió `object-without-material-reflectance`, la tabla "Grado de reflexión" ahora muestra "No asignado (no usado en el cálculo)" en vez de un valor numérico de reserva. 2 tests nuevos en `ambientDossier.test.ts`, suite completa de `resources/js/pages/dialux/export` (230 tests) y `FormalExportTest.php` (34 tests) verdes.
- §5.1 — Creado `resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/` con los primeros dos fixtures reales (Baño/SS.HH, Guarderías/Caseta de control) y tests que bloquean una regresión de la Causa A.

**Hallazgo nuevo, no anticipado al escribir la versión original de este plan (§2.2), que cambia la prioridad del trabajo pendiente:**

Al construir el benchmark con datos reales se midió el error absoluto por primera vez (antes solo se había comparado a ojo). Con la MISMA reflectancia que declara DIALux evo (70/50/20%) y la configuración de producción real (`first-bounce`), el error frente a la referencia fue **71.5%** (Baño/SS.HH) y **46.7%** (Guarderías/Caseta de control) — muy por encima del ~5-12% que la Causa B (§2.2) hacía esperar.

La causa de ESE error adicional no es first-bounce vs. iterativo: es que, sin el archivo IES/LDT real de fábrica, el motor aproxima ambas luminarias como emisores Lambertianos (`I(γ) = (lumens/π)·cos γ`), y las dos luminarias reales concentran mucha más intensidad hacia el nadir que un Lambertiano ideal — GF19140 (Corridor Lens) ~2-2.5x, TEG18046 ~2.8x, leído de los picos de sus CDL polares (`MODULO I_Informe.pdf` p.7-8, eje "cd/klm": ~600-800 y ~900-970 cd/klm respectivamente, contra ~318 cd/klm de un Lambertiano perfecto a igual flujo). Una luminaria más concentrada pone más luz directamente bajo sí misma de lo que Lambertiano predice — el motor subestima el directo sistemáticamente, antes de discutir reflexión.

**Consecuencia directa para la pregunta de "cómo llegar a 100%"**: no es alcanzable, y no es un problema que más iteración de código resuelva solo. El paso que de verdad mueve la aguja no es ajustar el solver de interreflexión — es conseguir el archivo IES/LDT real (o LDT/GLDF equivalente) de GF19140 y TEG18046 (o de cualquier luminaria que un proyecto real use) e importarlo al catálogo, para que `photometricWeb` deje de estar vacío. Sin eso, cualquier tolerancia que este documento proponga sería una expectativa fabricada, no medida. Se documenta como el nuevo ítem de mayor prioridad en §5.1.

**No implementable en esta sesión (requiere datos o acceso que no están disponibles aquí):**

- §3 (corregir los datos del proyecto Pozuzo real: asignar reflectancia a Guarderías/Baño) — requiere abrir el proyecto en la aplicación (UI) o la base de datos de producción/desarrollo del usuario; la base de datos local de este entorno no está accesible desde esta sesión (`SQLSTATE[HY000] [2002]`, MySQL no corriendo). Sigue siendo una acción del usuario, sin cambios.
- §5.4 (investigar por qué DIALux evo tiene una razón total/directo ~1.37 en recintos angostos) — requiere el archivo/proyecto DIALux evo original y varios recintos adicionales para tener una muestra; no es una tarea de una sesión de código.
- §5.5 / Fase 9 (UGR profesional sin depender de valores "manual") — alcance grande, ya mapeado en el plan maestro; no se tocó aquí para no mezclar un cambio de una tarde con una fase completa del roadmap (regla de §7 "no mezclar la corrección de datos con la investigación de modelo").

## 0. Origen de este documento

Comparando dos informes PDF reales:

- `pozuzo-reporte-formal.pdf` — proyecto "Pozuzo", calculado con el motor propio (`direct-preview-v1`, PCL).
- `MODULO I_Informe.pdf` — informe generado por DIALux evo real (Stimulsoft/DIALux), usado como referencia en `planes/plan_replica_informe_luminotecnico_modulo_i.md`.

el usuario detectó que, para ambientes de área y luminaria comparables, los resultados de lux no coinciden entre ambos:

| Comparación | Área | Luminaria | E (PCL) | E (DIALux evo) | Δ relativo |
|---|---:|---|---:|---:|---:|
| Baño (Pozuzo) vs SS.HH (MÓDULO I) | 2.07 m² (idéntica) | TEG18046, 14.0 W, 1508 lm (idéntica) | 104 lx | 144 lx | **-27.8 %** |
| Guarderías (Pozuzo) vs Caseta de control (MÓDULO I) | 4.61 vs 4.63 m² (casi idéntica) | GF19140, 26.0 W, 2580 lm (idéntica) | 150 lx | 203 lx | **-26.1 %** |

Este documento explica la causa confirmada de esa brecha (no es una única fórmula rota), qué parte ya estaba investigada y documentada en el propio código, y qué hacer — para este proyecto y para que el proceso se repita de forma sistemática en cada proyecto nuevo.

**No sustituye** `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md` (la hoja de ruta completa del motor, fases 0-25). Este documento es el primer ciclo concreto de su §10 ("Estrategia de validación") y su §23 ("Criterio para afirmar 'similar a DIALux evo'"), usando estos dos PDFs reales como primeros dos casos de benchmark.

## 1. Expectativa correcta: no existe "100 % de similitud"

Antes de planear cómo cerrar la brecha, hay que corregir el objetivo. Ni siquiera dos herramientas profesionales de escritorio (DIALux evo, Relux, AGi32) coinciden al 100 % entre sí para el mismo proyecto — usan mallas, tratamientos de esquina/cavidad y modelos de interreflexión ligeramente distintos, y publican sus propias tolerancias de comparación. El propio plan maestro ya lo dice en su §20 ("Qué no hacer"): *"No afirmar paridad con DIALux por similitud visual"*.

El objetivo realista y verificable es:

- Error relativo mediano ≤ 3 % en luz directa pura (sin reflectancia).
- Error relativo mediano ≤ 5 %, máximo justificado ≤ 10 %, con interreflexión activada.
- Diferencia absoluta de uniformidad `Uo` ≤ 0.05.
- Diferencia de UGR ≤ 1 unidad, solo en casos donde el método sea aplicable.

(Tolerancias ya propuestas en `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §10.3 — este documento las hereda, no inventa nuevas.)

## 2. Diagnóstico confirmado en código (no solo en el PDF)

Se leyó el motor real (`resources/js/pages/dialux/domain/calculation/runDirectPreviewEngine.ts`, `hooks/lightingEngineCore.ts`, `hooks/iterativeRadiosity.ts`, `hooks/firstBounceReflection.ts`, `domain/calculation/productionCalculationConfig.ts`) para separar "esto es un bug" de "esto es una limitación conocida y ya evaluada".

### 2.1. Causa A (confirmada, específica de este proyecto): Guarderías y Baño no tienen material/reflectancia asignada

`runDirectPreviewEngine.ts:223-234` resuelve la reflectancia de techo/pared/piso **exclusivamente** a través de `object.materialId → CalculationMaterial` (`resolveSurfaceReflectances()`, `runDirectPreviewEngineAdapters.ts:23`). Si el ambiente no tiene material asignado, la función devuelve `null` y el motor:

1. No aplica ninguna interreflexión (ni "first-bounce" ni "iterative"), aunque `config.interreflection` esté activado.
2. Emite el warning `object-without-material-reflectance`.

Ese warning **está presente** en el PDF de Pozuzo, página 15 y 20:

> "Guarderías" no tiene reflectancias de superficie definidas — no se calcula primera reflexión para este ambiente.
> "Baño" no tiene reflectancias de superficie definidas — no se calcula primera reflexión para este ambiente.

Es decir: **Pozuzo se calculó con luz 100 % directa**, sin ningún rebote, mientras que MÓDULO I (DIALux evo real) sí tiene reflectancias 70 % / 50 % / 20 % declaradas y las usa en su radiosidad. La tabla de resumen de Pozuzo muestra igualmente "70% / 50% / 20%" en "Grado de reflexión" — ese valor es el *fallback de visualización* (`DEFAULT_REFLECTANCE_*`, ver `export/document/ambientDossier.ts:163-180`), no lo que el motor usó. El PDF no miente (el warning está ahí), pero es fácil no verlo en una tabla que parece "normal".

**Esto por sí solo explica gran parte de la brecha de -26/-28 %** en habitaciones pequeñas de techo alto (3.5 m) con reflectancia de techo declarada al 70 %: la componente reflejada en un recinto así no es marginal.

### 2.2. Causa B (conocida, ya investigada dos veces, sin resolver): "first-bounce" vs "iterative" vs DIALux evo

`domain/calculation/productionCalculationConfig.ts:20-51` documenta una investigación previa **con un caso real de SS.HH** (2.15 m², 4.67 m de alto, mismas reflectancias y luminarias que DIALux evo):

- DIALux evo real: Ē ≈ 206 lx.
- Motor propio con `interreflection: 'iterative'` (radiosidad convergida): Ē ≈ 294 lx → **+43 % sobre DIALux evo**.
- Motor propio con `interreflection: 'first-bounce'` (un solo rebote): **+9.6 %** sobre DIALux evo.

Se investigó la hipótesis de que los parches de pared sin subdividir colapsaban el campo cercano; se implementó subdivisión vertical (`wallVerticalSegments` en `roomPatches.ts`) y el error solo bajó de +43 % a +37 % — no cerró la brecha. La razón documentada: el solver de este motor converge correctamente a lo que predice el método de cavidad zonal clásico (`1/(1-ρ̄)` ≈ 1.9-2.0 para ρ̄≈0.49), pero **DIALux evo, con las mismas reflectancias declaradas, reporta una relación total/directo mucho menor (~1.37) en ese recinto angosto** — probablemente un tratamiento interno de cavidad/geometría distinto que este motor todavía no reproduce.

**Decisión ya tomada y documentada** (correcta, no hay que revertirla sin resolver la causa raíz): producción usa `interreflection: 'first-bounce'`, no `'iterative'`, porque el error que evita (+9.6 %) es menor y más predecible que el que introduce el modo "más completo" (+37-43 %). Contraintuitivo, pero es el resultado de una medición real, no una suposición.

**Consecuencia para Pozuzo**: incluso después de corregir la Causa A (asignar reflectancia), **no hay que esperar 0 % de error** — hay que esperar un residual del orden de +5 a +12 % típico de `first-bounce` frente a DIALux evo, según lo ya medido en el caso SS.HH análogo.

### 2.3. Causa C (limitación conocida, Fase 9 del plan maestro): UGR "manual" quiebra la comparación de deslumbramiento

Ambos ambientes de Pozuzo muestran `RUG, max 26 (manual)` y `23 (manual)` — no calculado por el motor. `buildDialuxExportSnapshot.ts:142-158` marca `ugrIsManual: true` cuando **todas** las luminarias del ambiente quedan excluidas del cálculo de UGR por la regla H/R > 2 (recinto pequeño en planta con luminaria montada alta, `glareCalculation.ts`). El warning correspondiente también está en el PDF ("1 luminaria(s) excluida(s) del cálculo de UGR ... fuera del rango de validez H/R>2"). El valor mostrado entre paréntesis no proviene de un cálculo del motor: es un valor de reserva. **No se puede comparar el UGR de Pozuzo contra el RUG calculado de MÓDULO I para estos dos ambientes** — no son la misma magnitud (uno es un cálculo real, el otro es un valor manual de reserva). Esto es exactamente la brecha "UGR profesional" ya descrita en `plan_maestro_dialux_web_motor_arquitectura_validacion.md` Fase 9.

### 2.4. Causa D (no aplica aquí, pero hay que descartarla en proyectos futuros): oclusión

`config.occlusion` es `false` por defecto y no hay evidencia de que la Fase 6 (BVH/oclusión) del plan maestro esté implementada todavía. En Guarderías/Baño/Caseta/SS.HH no hay mobiliario ni obstáculos declarados, así que esta causa **no contribuye** a la brecha medida aquí — pero en cualquier ambiente con mobiliario, columnas o particiones sí lo hará, y hoy el motor no la modela en absoluto (ninguna oclusión, nunca).

### 2.5. Observación adicional sin explicar todavía: zona marginal distinta

Pozuzo/Guarderías: zona marginal 0.194 m. MÓDULO I/Caseta de control: zona marginal 0.350 m, para áreas casi idénticas (4.61 vs 4.63 m²). Si la zona marginal de DIALux evo es más ancha, excluye más borde de la malla del promedio — eso por sí solo puede mover `Ē` unos puntos porcentuales (normalmente el borde tiene menor lux que el centro, así que una zona marginal más ancha en DIALux evo tendería a *subir* su promedio, no bajarlo — así que esta diferencia probablemente no es la causa de que DIALux evo dé un valor *mayor*, pero sigue siendo una divergencia de configuración no explicada y debe registrarse, no ignorarse).

## 3. Plan de acción inmediato — para Pozuzo, esta semana

No requiere tocar el motor. Es un problema de datos del proyecto, no de código:

1. Abrir el proyecto Pozuzo, ambientes "Guarderías" y "Baño".
2. En el panel de propiedades del recinto (`RoomSurfaceMaterialsSection.tsx`, sección "Materiales fotométricos"), asignar reflectancia de techo/pared/piso — usar los mismos valores que MÓDULO I declara (70 % / 50 % / 20 %) si el objetivo es comparar contra ese informe, o los valores reales del proyecto si son distintos.
3. Volver a calcular (botón "Calcular", que ya usa `buildProductionCalculationConfig()` — la única fuente de verdad de configuración de producción) y volver a exportar el PDF.
4. Confirmar en el nuevo PDF que el warning `object-without-material-reflectance` desapareció para ambos ambientes.
5. Recalcular el Δ relativo contra MÓDULO I. **Expectativa realista tras este paso: brecha residual de ~5-12 %**, no 0 % — por la Causa B (§2.2), ya conocida y aceptada como límite actual del motor.
6. Si el Δ residual after paso 5 es mayor a ~15 %, no asumir que es "más del mismo problema" — es señal de una causa nueva (geometría, altura de montaje, factor de mantenimiento, malla) y debe registrarse como caso de benchmark nuevo (§5) en vez de cerrarse a ojo.
7. Para el UGR: no comparar el valor "(manual)" contra el RUG calculado de DIALux evo. Si se necesita UGR real para estos ambientes, es un backlog de Fase 9 (§2.3), no algo resoluble ajustando datos.

## 4. Por qué esto no es "un bug que se arregla y ya" para el resto de proyectos

La Causa A es un problema de datos de *este* proyecto (fácil de repetir en cualquier proyecto nuevo si no se asigna material). La Causa B es un límite de modelo *real y medido* del motor actual, que no se resuelve por proyecto — se resuelve evolucionando el solver (Fase 7/8 del plan maestro) o entendiendo por qué DIALux evo diverge del modelo de cavidad zonal clásico en recintos angostos. Tratar cualquiera de las dos como "ajustar un número hasta que cuadre" produciría un motor que coincide con este caso puntual y falla en el siguiente.

## 5. Plan estructural — para que esto no dependa de comparar PDFs a mano cada vez

### 5.1. Formalizar "benchmark contra DIALux evo" como proceso repetible, no como verificación manual

Hoy el proceso fue: exportar dos PDFs, leerlos a mano, notar que no coinciden. Eso no escala y no deja rastro para builds futuros. Se propone:

1. Crear `resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/` con un fixture por caso comparativo real, siguiendo el formato de `fase0_benchmark_dialux.md` y el "caso comparativo" ya descrito en `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §10.1.
2. Cada fixture registra, como mínimo (nada de esto es opcional — sin uno de estos campos el caso no es comparable, solo anecdótico):
   - Software y versión de referencia (ej. "DIALux evo 12.x", con fecha del cálculo si se conoce).
   - Geometría exacta del ambiente (área, altura interior, altura de montaje, altura de plano útil, zona marginal).
   - Reflectancias declaradas techo/pared/piso.
   - Luminaria: fabricante, código, flujo, potencia, archivo fotométrico (IES/LDT) usado — idealmente el mismo archivo importado en ambos sistemas.
   - Factor de mantenimiento usado.
   - Configuración de malla (espaciado, adaptativa o fija).
   - Resultados de referencia: `Ē`, `Emin`, `Emax`, `Uo`, UGR (solo si fue calculado, no manual).
3. Los dos casos de este documento (Baño/SS.HH y Guarderías/Caseta de control) son los primeros dos candidatos — **pero antes de darlos de alta como fixture hay que corregir la Causa A** (§3) y confirmar que la geometría es realmente idéntica (Guarderías es 4.61 m² y Caseta de control 4.63 m² — casi igual pero no idéntica; zona marginal difiere 0.194 vs 0.350 m — hay que decidir si eso invalida la comparación exacta o si es una tolerancia aceptable).
4. Cada fixture se ejecuta como test (Vitest) que llama `runDirectPreviewEngine()` con la configuración de producción real y compara contra el valor de referencia con la tolerancia de §1. Un fixture fuera de tolerancia falla el test — visible en CI, no solo cuando alguien decide comparar PDFs a mano.

**Actualización tras implementar el punto 1-4 (ver §-1):** los dos fixtures ya existen (`__benchmarks__/dialuxEvoParity/`), pero SIN el archivo IES/LDT real de ninguna de las dos luminarias, así que caen al respaldo Lambertiano y el error absoluto medido (46.7%/71.5%) no es utilizable como tolerancia de precisión — ver el hallazgo en §-1 y el doc-comment de `fixtures.ts`. **Nuevo ítem, ahora el de mayor prioridad de esta sección**: conseguir el archivo IES o LDT real de Thorlux GF19140 y TEG18046 (el fabricante los publica típicamente en su sitio o vía el distribuidor) e importarlo al catálogo de luminarias de la plataforma antes de intentar apretar la tolerancia de estos dos fixtures. Sin fotometría real, cualquier número de tolerancia que se fije aquí sería inventado, no medido — exactamente lo que este plan pide no hacer (§7).

### 5.2. Regla de captura para cualquier proyecto futuro

Cuando el equipo calcule un proyecto tanto en DIALux evo como en esta plataforma (validación manual, como se hizo hoy con Pozuzo/MÓDULO I), la salida de ese trabajo **no debe ser solo una conclusión en una conversación** — debe producir un fixture nuevo en `dialuxEvoParity/` siguiendo el formato de §5.1. Esto convierte cada verificación manual futura en una prueba de regresión permanente, en vez de un descubrimiento que se repite (y se vuelve a investigar desde cero) cada vez que alguien nota una discrepancia.

### 5.3. Corregir la señal engañosa del PDF (Causa A, parte UX)

Aunque el warning `object-without-material-reflectance` sí aparece, mostrar "70% / 50% / 20%" en la tabla de resumen justo cuando el motor **no** usó esa reflectancia es una fuente de error humano predecible (pasó hoy). Backlog recomendado, pequeño y de bajo riesgo:

- En `export/document/ambientDossier.ts`, cuando `ambient.room.ceilingReflectance/wallReflectance/floorReflectance` sean `null` (sin asignar) Y el ambiente tenga el warning `object-without-material-reflectance`, la tabla de resumen debería mostrar algo como "No asignado (no usado en el cálculo)" en vez de un valor numérico por defecto que sugiere que sí se usó. Esto no cambia ningún cálculo, solo evita que un valor de *placeholder visual* se lea como un dato real — exactamente el tipo de hallazgo que revisaría `dialux-calc-reviewer` o `dialux-normativa-auditor` si se ejecuta `/revisar-dialux` sobre este cambio.

### 5.4. Retomar la investigación abierta de la Causa B cuando haya presupuesto de ingeniería

No es una tarea de una línea (el propio comentario en el código lo advierte). Se sugiere, en orden:

1. Conseguir o reconstruir el archivo/proyecto DIALux evo original del caso SS.HH ya investigado (2.15 m², 4.67 m) y, si es posible, otro recinto angosto adicional — para saber si la relación total/directo ~1.37 de DIALux evo es consistente en varios recintos angostos o específica de ese caso.
2. Investigar si DIALux evo aplica algún tratamiento de "cavidad efectiva" (reflectancia efectiva de cavidad de techo/piso, al estilo del método de cavidad zonal de IESNA con *coeficientes de utilización* tabulados, en vez de radiosidad de parches pura) que reduzca sistemáticamente la ganancia por reflexión en recintos de proporción alta/angosta.
3. Solo después de tener una hipótesis verificable con al menos 2-3 casos, decidir si se ajusta el modelo de `iterativeRadiosity.ts`/`roomPatches.ts` — no ajustar un coeficiente para que un solo caso cuadre.

### 5.5. Cerrar la Fase 9 (UGR profesional) para dejar de reportar valores "(manual)" en recintos pequeños

La regla H/R > 2 que excluye luminarias del cálculo de UGR es correcta desde el punto de vista de validez del método clásico de tabla CIE, pero deja sin UGR calculado exactamente a los ambientes más comunes en vivienda/educación (baños, depósitos, casetas) — es decir, se pierde comparabilidad justo donde más proyectos van a caer. Esto ya está identificado como brecha en `informe_brechas_evaluaciones_calculos_dialux.md` §5.6; no se repite el análisis aquí, solo se referencia como dependencia de este plan.

## 6. Orden recomendado de trabajo

```text
1. [PENDIENTE — acción del usuario, no de código] Corregir datos de Pozuzo (§3).
2. [PENDIENTE — depende del paso 1] Confirmar Δ residual — ya NO se puede esperar ~5-12%
   como único factor (ver hallazgo §-1): sin fotometría real, esperar un residual mucho
   mayor y dominado por la aproximación Lambertiana, no solo por first-bounce.
3. [HECHO] Dar de alta los primeros 2 fixtures de benchmark (§5.1) — sin datos de Pozuzo
   limpios todavía, así que comparan directamente contra los valores de MÓDULO I/DIALux
   evo declarados en el PDF, no contra un recálculo de Pozuzo ya corregido.
4. [HECHO] Corregir la señal engañosa del PDF (§5.3).
5. [PENDIENTE — proceso, no código] Añadir la regla de captura de fixture a cada
   verificación manual futura (§5.2).
6. [NUEVO, mayor prioridad real tras el hallazgo de §-1] Conseguir el archivo IES/LDT
   real de GF19140 y TEG18046 (o de cualquier luminaria de un proyecto real) e
   importarlo — sin esto, ningún ajuste de código adicional puede cerrar la brecha
   medida, porque el error dominante hoy es de fotometría, no de modelo de reflexión.
7. Retomar la investigación de first-bounce vs iterative vs DIALux evo (§5.4) cuando haya
   capacidad de ingeniería dedicada Y fotometría real (el paso 6) — antes de eso, no se
   puede distinguir cuánto del error es Causa B y cuánto es aproximación fotométrica.
8. Fase 9 del plan maestro (UGR profesional) para dejar de depender de valores "(manual)".
```

Los pasos 1-2 resuelven el caso puntual de hoy y siguen pendientes de que el usuario los ejecute en su proyecto real. Los pasos 3-5 son los que hacen que el próximo proyecto no dependa de que alguien vuelva a comparar dos PDFs a mano — 3 y 4 ya están implementados y probados en esta sesión. El paso 6 es el hallazgo nuevo de esta sesión y ahora bloquea al 7. El paso 8 es trabajo de fondo ya mapeado en el plan maestro — este documento no lo reemplaza, solo prioriza qué parte de ese mapa atacar primero a partir de evidencia real.

## 7. Qué no hacer

- No declarar "100 % de similitud" como meta ni como logro — ninguna herramienta profesional lo hace entre sí (§1).
- No activar `interreflection: 'iterative'` en producción para "ser más preciso" sin resolver §2.2 primero — ya se probó y empeora el resultado frente a DIALux evo en el caso medido.
- No comparar un UGR "(manual)" contra un RUG calculado como si fueran la misma magnitud (§2.3).
- No cerrar esta brecha ajustando un coeficiente para que el caso de Pozuzo cuadre exactamente — eso es sobreajuste a un solo punto de datos, no una corrección de modelo.
- No mezclar la corrección de datos (§3, esta semana) con la investigación de modelo (§5.4, trabajo de fondo) en el mismo commit o la misma conversación de revisión.
- No digitalizar "a ojo" una curva fotométrica desde la imagen de un diagrama polar de una ficha de producto y guardarla como `photometricWeb` — introduce una precisión que parece real pero no lo es, peor que declarar honestamente la aproximación Lambertiana con sus límites conocidos (ver §-1 y `fixtures.ts`). El único dato fotométrico aceptable es el archivo IES/LDT real del fabricante.
