# Plan de cierre de brecha de paridad con DIALux evo (benchmark Pozuzo vs. MÓDULO I)

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

<!-- RONDA14_RESULTADOS_PENDIENTE -->

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
