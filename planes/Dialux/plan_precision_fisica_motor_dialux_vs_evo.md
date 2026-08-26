# Plan de cierre de brecha de precisión física — motor propio vs. DIALux evo

Continuación técnica de `plan_cierre_brecha_paridad_dialux_evo.md` (Rondas 0-22) y `plan_maestro_dialux_web_motor_arquitectura_validacion.md` (§10.3). Ese trabajo ya resolvió la causa dominante original (fotometría Lambertiana en vez de real: 71.5%→11-17% de error) y calibró empíricamente el tamaño de parche de radiosidad. Este plan ataca la brecha que queda: **11-20%+ de error en `avg_lux`/`Emin`/`Uo` contra PDFs reales de DIALux evo, incluso con fotometría IES/LDT real y radiosidad activa**.

No es un documento de relleno: cada causa tiene evidencia trazable a código o literatura citada, y cada acción tiene un criterio de éxito verificable. Investigación de respaldo completa: agente `chief-electrical-engineer-reviewer`, sesión 2026-08-22 (ver referencias al final).

## 0. Resumen ejecutivo

**Hallazgo central**: el motor propio y DIALux evo resuelven la interreflexión con **métodos numéricos de naturaleza distinta**, no solo con distinta resolución de malla:

- **Motor propio**: radiosidad de parches (Cohen/Greenberg 1985) — discretiza piso/techo/paredes en parches finitos, calcula factores de forma punto-a-parche, resuelve con Gauss-Seidel iterativo. `roomPatches.ts:NEAR_FIELD_PATCH_CAP_M` (0.6 m) es un parche empírico para que esta aproximación no sobre-transfiera energía en recintos angostos — calibrado contra solo 2 proyectos reales.
- **DIALux evo** (según documento técnico propio de DIAL GmbH, *"DIALux evo – New calculation method"*): usa **photon shooting** (equivalente metodológico al photon mapping de Jensen 1996) — dispara fotones desde las superficies, los sigue con ruleta rusa de reflexión/absorción, y estima iluminancia por densidad de fotones en un mapa (kd-tree), **sin discretizar en parches ni resolver una matriz de factores de forma**.

Esto explica un dato ya medido por el propio equipo, sin explicación hasta ahora: el solver de radiosidad de este motor converge al **límite asintótico teórico de cavidad zonal `1/(1-ρ̄)`** (≈1.9-2.0 para ρ̄≈0.49, verificado en Módulo 22) mientras DIALux evo reporta una relación total/directo de **1.37** para el mismo tipo de recinto. Esa es la brecha real — no un bug, es el comportamiento correcto de dos métodos numéricos distintos aplicados al mismo problema.

**Consecuencia para la hoja de ruta**: no se puede "ajustar" la radiosidad de parches para que dé 1.37 sin saber si 1.37 es la física correcta o un sesgo del photon shooting de DIALux evo con pocos fotones (el propio documento de DIAL admite esa limitación en superficies pequeñas). La Sección 2 define el experimento que resuelve esa ambigüedad **antes** de tocar el solver.

## 1. Ranking de causas raíz

| # | Causa | Fuerza de la evidencia | Impacto estimado en `avg_lux`/`Emin`/`Uo` |
|---|---|---|---|
| 1 | Método de interreflexión distinto (radiosidad de parches vs. photon shooting) | Firme — código propio + doc. oficial DIAL + validación académica (Mangkuto 2016, LEUKOS) | Dominante |
| 2 | Zona marginal EN 12464-1 diverge en recintos con relación de aspecto ≥2:1 (0.193 m calculado vs. 0.125 m real, -54%) | Firme como divergencia; causa raíz sin confirmar (falta Anexo C oficial) | Moderado-alto en Emin/Uo, menor en Ē |
| 3 | Interpolación fotométrica bilineal vs. método real de DIALux evo (no publicado) | Hipótesis razonada, sin magnitud medida en este proyecto | Segundo orden, probablemente pocos puntos % |
| 4 | Factor de mantenimiento como escalar único vs. `LLMF×LSF×LMF×RSMF` (CIE 97:2005) | Firme como simplificación de modelo | Bajo para el residual medido (la mayoría de las mediciones se hicieron sin factor de mantenimiento, para aislar la comparación) |
| 5 | UGR (`Lb=Eind/π`, observadores) | Fórmula ya coincide textualmente con el KB oficial de DIALux evo | No es causa de la brecha de iluminancia — mencionado por separado |

## 2. Acción P0 — experimento decisivo — EJECUTADO 2026-08-22

Ejecutado sobre el ambiente real "SS.HH" del proyecto real "Módulo 22" (`modulo22ProjectFixture.ts`, geometría real de 10 vértices derivada por `deriveSceneAmbientSpaces` — no una caja reconstruida a mano, área 2.18 m², altura 4.67 m, aspecto angosto ~2.4:1, fotometría real GF19140-sustituto). Test: `resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle/modulo22RealCase.test.ts`. Es la primera vez que se triangulan los tres vértices — motor propio, Radiance, DIALux evo real — sobre el MISMO problema físico exacto (antes, motor-vs-Radiance y motor-vs-evo usaban geometrías distintas).

**Hallazgo colateral importante, corregido antes de interpretar el resultado**: al armar este experimento se encontró que `radianceOracleShapeVariation.test.ts` y `radianceOraclePolygonShapes.test.ts` (los tests previos de esta misma carpeta, usados en Rondas 6-22) comparaban `first-bounce`/`iterative` — que arrastran el factor de mantenimiento de producción (`0.8`, ningún fixture de esa carpeta declara `siteSettings`) — contra el oráculo Radiance, que reporta valores explícitamente "como nuevo" (sin factor de mantenimiento). Esto sub-reportaba `first-bounce`/`iterative` ~20% de forma sistemática en TODAS las filas de esos dos archivos. Corregido (`maintenanceFactor: 1` en las tres ramas de interreflexión, no solo en `'none'`) — **los porcentajes de error `first-bounce`/`iterative` registrados en Rondas 6-22 de `plan_cierre_brecha_paridad_dialux_evo.md` deben tratarse con cautela hasta remedirse con el fix**; no se remidieron todos por el costo de cómputo (cada re-corrida de Radiance con radiosidad completa toma 2-10+ min), pero el sesgo es sistemático y unidireccional (siempre subestima ambos modos por igual, ~1/0.8), así que el ORDEN relativo entre first-bounce/iterative dentro de cada fixture probablemente no cambia, pero la MAGNITUD del error sí — y en al menos un caso real (ver abajo) el fix invirtió cuál modo queda más cerca de qué referencia.

**Resultado, ya corregido**:

| | Ē (avg_lux) | vs. DIALux evo (206 lx) | vs. Radiance físico (266.5 lx) |
|---|---:|---:|---:|
| DIALux evo real | 206 | — | -22.7% |
| Radiance, solo directo | 186.3 | -9.6% | — |
| Motor propio, directo | 185.3 | -10.0% | -0.5% vs. Radiance directo (validación de montaje: geometría/IES/malla correctos) |
| Motor propio, `first-bounce` | 215.4 | **+4.6%** | -19.1% |
| Motor propio, `iterative` | 240.9 | +16.9% | **-9.6%** |
| Radiance, radiosidad completa (física real) | 266.5 | +29.4% | — |

**Interpretación, con el criterio de decisión ya definido en la versión anterior de este plan**:

1. La luz directa está validada de forma independiente (motor vs. Radiance, 0.5% de diferencia) — el pipeline de geometría/fotometría/malla es correcto; el problema es enteramente de interreflexión.
2. **DIALux evo (206) queda muy por debajo de la física real que calcula Radiance (266.5, -22.7%)** — sobre este caso concreto, es DIALux evo quien parece sub-representar la interreflexión real, no el motor propio. Esto es consistente con la limitación que el propio documento de DIAL admite (photon shooting con presupuesto de fotones limitado en superficies pequeñas) — evidencia a favor, no una certeza (N=1 caso).
3. `first-bounce` (215.4) es la aproximación más cercana a DIALux evo (+4.6%); `iterative` (240.9) es la más cercana a la física real de Radiance (-9.6%). **`auto-by-shape`, el default de producción, ya elige `first-bounce` para este aspecto de recinto (~2.4:1, por encima del umbral 2.0:1)** — es decir, la configuración de producción actual YA es, sin cambios, la más parecida a DIALux evo en este caso real. Esto valida (no invalida) la heurística `auto-by-shape` ya elegida.
4. **Tensión real que el plan debe declarar explícitamente**: mejorar la exactitud física del solver de interreflexión (acercarlo a Radiance) ALEJARÍA el resultado de lo que reporta DIALux evo en este tipo de recinto angosto — porque DIALux evo mismo, aquí, no es la referencia físicamente más correcta. "Igualar a DIALux evo" y "ser físicamente correcto" no son el mismo objetivo en esta geometría, y el plan no puede prometer ambos a la vez sin más evidencia (ver §5).

**CONFIRMADO 2026-08-22 sobre 3 casos reales adicionales** (`multiCaseRealTriangulation.test.ts`, a pedido explícito del usuario: "confirmar el patrón primero" antes de tocar cualquier default de producción) — "Caseta de Control" (Módulo 22, ~1:1, 4.73 m²) y "Aula 1°"/"Aula 2°" (Vinchos, ~1:1, ~43 m², geometría de 24-26 vértices real por muros-anillo, NO una caja rectangular). Cuatro casos reales en total, tres proyectos distintos, área de 2 a 44 m², aspecto de 1:1 a 2.4:1:

| Caso | Área | DIALux evo | Motor `first-bounce` (Δevo / Δradiance) | Motor `iterative` (Δevo / Δradiance) | Radiance (física real) | Δ(evo, Radiance) |
|---|---:|---:|---:|---:|---:|---:|
| SS.HH (Módulo 22) | 2.18 m² | 206 lx | 215.4 (**+4.6%** / -19.1%) | 240.9 (+16.9% / **-9.6%**) | 266.5 lx | **-29.4%** |
| Caseta de Control (Módulo 22) | 4.73 m² | 203 lx | 199.7 (**+1.6%** / -20.5%) | 225.8 (+11.2% / **-10.1%**) | 251.2 lx | **-23.8%** |
| Aula 1° (Vinchos) | 43.80 m² | 544 lx | 592.3 (**+8.9%** / -16.0%) | 618.0 (+13.6% / **-12.4%**) | 705.2 lx | **-29.6%** |
| Aula 2° (Vinchos) | 42.71 m² | 567 lx | 635.6 (+12.1% / -12.5%) | 660.9 (+16.6% / **-9.1%**) | 726.7 lx | **-28.2%** |

**El patrón se confirma con una consistencia notable, en los 4 casos sin excepción**:

1. **DIALux evo queda sistemáticamente entre 23.8% y 29.6% POR DEBAJO de la física real** (Radiance) — un rango de solo ~6 puntos porcentuales de ancho, pese a que el área varía de 2 a 44 m² (factor 20x) y el aspecto de 1:1 a 2.4:1. Esta consistencia es la evidencia más fuerte de todo este plan: no parece un artefacto de geometría puntual, parece una propiedad sistemática de cómo DIALux evo calcula la interreflexión en general (consistente con la limitación de "photon shooting con presupuesto de fotones limitado" que el propio documento de DIAL admite).
2. **`iterative` es, en los 4 casos sin excepción, la aproximación MÁS CERCANA a la física real** (Δradiance entre 9.1% y 12.4%) — más cerca que `first-bounce` en cada uno de los 4 casos (Δradiance entre 12.5% y 20.5%).
3. **`first-bounce` es, en los 4 casos sin excepción, la aproximación MÁS CERCANA a DIALux evo** (Δevo entre 1.6% y 12.1%) — más cerca que `iterative` (Δevo entre 11.2% y 16.6%) en cada uno de los 4 casos.
4. Esto ya NO es una coincidencia de un solo caso angosto: es un patrón sistemático. La razón más probable no es que `first-bounce` sea "más correcto" — es que `first-bounce` y DIALux evo comparten el mismo tipo de sesgo (ambos sub-representan la interreflexión frente a la física real), por métodos distintos pero con un efecto neto parecido en magnitud.

**Conclusión de esta fase de investigación**: el motor propio, en su modo `iterative`, es HOY más preciso físicamente que DIALux evo en los 4 casos reales verificados — validado contra Radiance, un motor de radiosidad de código abierto con validación académica publicada (Mangkuto 2016, CIE 171:2006). Esto invierte la premisa con la que arrancó esta investigación ("igualar o superar la precisión de DIALux evo cueste lo que cueste") — en la dimensión de interreflexión, el motor propio ya la supera en precisión física; lo que no logra es igualar el NÚMERO que reporta una herramienta que, por esta evidencia, parece subestimar la física real de forma sistemática. Ver §5 para la decisión de negocio que esto exige, y §3.1 para la recomendación técnica revisada.

## 3. Roadmap por causa, condicionado al resultado de §2

### 3.1 Causa #1 — interreflexión (la que más pesa) — CONFIRMADO en 4 casos reales, decisión recomendada

El patrón se confirmó consistentemente en los 4 casos reales triangulados (§2): DIALux evo queda 23.8-29.6% por debajo de la física real (Radiance) en TODOS; `iterative` es, en TODOS, la aproximación más cercana a la física real; `first-bounce` es, en TODOS, la más cercana a DIALux evo. No hace falta un quinto caso para actuar sobre ESTE perfil — la consistencia entre 4 proyectos de tamaño y forma muy distintos ya es evidencia suficiente para una recomendación, aunque no para cerrar el tema de forma definitiva (ver límite en §2).

**Acotación importante (§7)**: los 4 casos reales comparten reflectancia interior típica (0.70/0.50/0.20-0.30). La matriz de escala sintética de §7 encontró que este patrón SE INVIERTE con reflectancia industrial más baja (0.50/0.30/0.20) — ahí `first-bounce` iguala o supera a `iterative` contra Radiance. La recomendación de esta sección aplica al perfil de reflectancia validado (interior claro), no a proyectos industriales, donde la pregunta sigue abierta por falta de un caso real triangulado.

**Corrección importante (2026-08-22, antes de recomendar nada)**: al preparar la pregunta de decisión para el usuario se encontró que la premisa estaba desactualizada — `buildProductionCalculationConfig()` (`productionCalculationConfig.ts`) **ya usa `interreflection: 'iterative'` como default de producción desde la Ronda 25** (2026-08-19), no `'auto-by-shape'`/`first-bounce`. Ese cambio se hizo antes de esta sesión, por razones ya documentadas ahí (oclusión + subdivisión de campo cercano corregidas eliminaron el sesgo que hacía parecer mejor a `first-bounce`). El doc-comment de `lightingEngineCore.ts` que citaba `'auto-by-shape'` como default estaba desactualizado — corregido en esta misma fecha. **La Ronda 24 (§2) no propone un cambio nuevo: confirma, con evidencia independiente (Radiance, 4 casos reales) y por una vía distinta, que la decisión ya tomada en la Ronda 25 fue la correcta.**

**Recomendación técnica**:

1. **No perseguir el número de DIALux evo modificando el solver de interreflexión.** Hacerlo significaría introducir deliberadamente el mismo sesgo que esta investigación encontró en DIALux evo (sub-representar la interreflexión ~25%) — no es una corrección, es reproducir un error ya identificado.
2. **Mantener `iterative` como default de producción — ya es el caso, sin cambios pendientes en este punto.** La Ronda 31 (2026-08-21, ver `productionCalculationConfig.ts`) ya había encontrado casos donde `iterative` sobreestima (+50%/+20% en "Módulo VII") y trazó la causa dominante a datos de proyecto incompletos (falta el objeto `Door` en la abertura), no al modo de interreflexión — coherente con la evidencia de esta Ronda 24: el modo es correcto, otras causas (geometría/datos incompletos, zona marginal, mantenimiento) siguen abiertas.
3. Seguir avanzando la implementación de factores de forma área-a-área (integral de Nusselt o hemicubo) sobre una malla más fina de piso/techo/paredes, retirando `NEAR_FIELD_PATCH_CAP_M` como parche empírico — con la evidencia de §2, esto ya no es una apuesta: acerca el motor a la física validada de forma consistente en los 4 casos probados.
4. Cada nueva triangulación adicional (recomendado: seguir ampliando el N con más proyectos reales del catálogo del usuario, sin costo adicional de desarrollo — la infraestructura ya existe en `multiCaseRealTriangulation.test.ts`) se documenta como nueva Ronda en `plan_cierre_brecha_paridad_dialux_evo.md`.

### 3.2 Causa #2 — zona marginal en recintos angostos

1. Adquirir el texto oficial de EN 12464-1:2021 Anexo C (CEN/AENOR/DIN) — es la única forma de confirmar si DIALux evo usa una rama distinta de la fórmula para relación de aspecto ≥2:1, una tabla discreta, u otro redondeo. **No inferir esto de un solo caso** (ya se probó y se descartó — Ronda 21j).
2. Conseguir un segundo caso real con relación de aspecto ≥2:1 y zona marginal declarada por DIALux evo, para no decidir con un solo punto de datos.
3. Solo entonces: corregir `getRoomMarginalZone` (`roomLighting.ts`) y actualizar `.claude/skills/normativa-dialux/references/normativa.md` con la fila EN 12464-1 Anexo C, marcada `pending-confirmation` hasta que un ingeniero colegiado la valide.

**Criterio de éxito**: la fórmula corregida reproduce el valor declarado por DIALux evo en 2+ casos reales distintos con relación de aspecto ≥2:1, con la fuente primaria citada (norma, edición, cláusula).

### 3.3 Causa #3 — interpolación fotométrica — DESCARTADA (2026-08-22)

Experimento aislante ejecutado: comparó interpolación bilineal actual vs. spline cúbica (Catmull-Rom) sobre la matriz real de `GF19140_SUBSTITUTE_PHOTOMETRIC_WEB` (óptica más concentrada del catálogo, "Corridor Lens", pico ~1640 cd), en dos niveles:

1. **Candela pura, en ángulos intermedios no tabulados**: delta hasta 96-100% — pero es un artefacto de medir error RELATIVO cerca de candela≈0 (gamma≈90-92.5°, donde ambas fotometrías reales disponibles caen a cero o casi cero); no representa una diferencia real de magnitud, y esa región aporta una fracción despreciable de la iluminancia total.
2. **Iluminancia directa a nivel de escena real** (ambiente "caseta-vs-guarderias" 2.1×2.21 m, GF19140-sustituto a 3.5 m, malla de 210 puntos a 0.15 m): **delta promedio 0.046%, delta máximo puntual 0.078%**. Muy por debajo del umbral de 1-2% que el plan definió para considerar esto material.

**Nota adicional que refuerza la conclusión**: ambas fotometrías reales disponibles en el catálogo (`TEG18046`, `GF19140_SUBSTITUTE_PHOTOMETRIC_WEB`) declaran `c_angles: [0]` — un solo plano C (simetría rotacional completa). La interpolación ENTRE planos C de `candelaFromPhotometricWeb` nunca se ejercita con los datos reales de este catálogo; el único eje donde el método de interpolación podría importar es gamma, y ahí la resolución angular real de fábrica (2.5-5°) ya es lo bastante fina para que bilineal y cúbica coincidan prácticamente punto por punto.

**Conclusión: causa descartada como material.** No se implementa interpolación cúbica en `photometricInterpolation.ts` — sería complejidad sin beneficio medible. Si en el futuro se importa una luminaria con múltiples planos C reales (óptica asimétrica, ej. la Thorlux GF19140 exacta si se consigue) o con una malla angular mucho más gruesa (>10°), vale la pena repetir este experimento — la conclusión actual es específica a los datos hoy disponibles, no una garantía universal.

### 3.4 Causa #4 — factor de mantenimiento desagregado — IMPLEMENTADO (2026-08-22)

`ProjectSiteSettings` (`hooks/types.ts`) gana 4 campos opcionales: `lightLossMaintenanceFactor` (LLMF), `luminaireSurvivalFactor` (LSF), `luminaireMaintenanceFactor` (LMF), `roomSurfaceMaintenanceFactor` (RSMF). Nuevo `domain/calculation/maintenanceFactor.ts::resolveMaintenanceFactor()`: cuando el proyecto declara `maintenanceMethod: 'cie_97_2005'` Y los 4 componentes son válidos (0,1], calcula `MF = LLMF×LSF×LMF×RSMF`; en cualquier otro caso (incluido TODO proyecto existente, que no declara estos campos) usa exactamente `maintenanceFactor ?? 0.8`, idéntico al comportamiento de siempre — cambio aditivo, verificado con 6 tests unitarios y la suite completa del dominio de cálculo (113 tests, sin regresiones). `buildProductionCalculationConfig()` ya lo usa.

Valores típicos de referencia quedaron documentados en el doc-comment del módulo, marcados explícitamente como fuente secundaria/`pending-confirmation` (no se citó el texto oficial de CIE 97:2005, no se tuvo acceso a él en esta sesión) — no se usan como default silencioso, solo aparecen si el usuario completa el formulario.

**Pendiente, no implementado en esta sesión**: superficie de UI para que el usuario complete los 4 componentes (hoy solo existen en el modelo de datos y el cálculo) — candidato para un panel en "Terreno"/`ProyectoPanel.tsx`, donde ya vive `maintenanceFactor`/`maintenanceMethod`. Sin UI, esta causa queda cerrada a nivel de motor pero no es utilizable por un usuario real todavía.

## 4. Qué es verificable sin licencia de DIALux evo vs. qué requiere fuente primaria

| Verificable ya, sin DIALux evo | Requiere DIALux evo real o norma comprada |
|---|---|
| Radiance como oráculo físico (ya instalado, BSD, validado contra CIE 171:2006) | Confirmar si el 1.37 (total/directo) del SS.HH angosto es físicamente correcto o sesgo de fotones insuficientes |
| Casos analíticos CIE (fuente puntual, ley del inverso del cuadrado — ya <0.5% de error) | Método exacto de interpolación fotométrica interno de DIALux evo (no publicado) |
| Mediciones de campo con luxómetro calibrado en proyecto real construido — validación definitiva, independiente de cualquier software | Rama exacta del Anexo C EN 12464-1:2021 para relación de aspecto ≥2:1 (requiere el texto oficial, no depende de tener DIALux evo) |
| Texto oficial de EN 12464-1:2021 (compra CEN/AENOR/DIN) y CIE 97:2005 — ninguno depende de tener licencia de DIALux evo | Número de observadores/dirección de vista usado en un UGR real de un proyecto específico, si el PDF no lo declara |

## 5. Límite de lo que este plan puede prometer

DIALux evo es software comercial de código cerrado. Ninguna afirmación sobre "cómo calcula DIALux evo" en este plan es un hecho confirmado del código real — proviene de: (a) el documento técnico propio de DIAL GmbH, (b) un paper académico revisado por pares (Mangkuto 2016, LEUKOS) que validó una versión específica (4.1, 2016) contra CIE 171:2006 — posiblemente desactualizada respecto al kernel actual, y (c) el Knowledge Base de soporte de DIALux evo (fórmulas puntuales, no el algoritmo completo). Cada cita en este plan lleva su fuente para que un ingeniero colegiado pueda verificarla o refutarla independientemente — ninguna cifra normativa debe presentarse al cliente como "igual a DIALux evo" sin haber pasado por el experimento de §2 y, donde aplique, por la fuente normativa primaria de §3.2.

**Actualizado 2026-08-22 — esto ya no es hipotético.** El experimento de §2, confirmado en 4 casos reales, encontró que DIALux evo sub-representa la interreflexión real ~25% de forma consistente. La conversación con el cliente no debería ser "igualar el número de DIALux evo" sino "cuál de los dos métodos es más defendible frente a la física real (Radiance, un motor de código abierto con validación académica publicada — y en última instancia, mediciones de campo con luxómetro calibrado, la única verdad no disputable)". Esto es un argumento técnico más fuerte y más sustentable ante un ingeniero colegiado que perseguir el número de una caja negra — pero es también una conversación de expectativas que el usuario/dueño del producto debe tener explícitamente con su cliente antes de cambiar cualquier default de producción, porque el número que el cliente espera ver ("parecido a lo que muestra DIALux evo") puede no ser el número físicamente correcto. Decisión de negocio, no solo técnica.

## 6. Orden de ejecución recomendado

1. **§2 (experimento decisivo)** — bloqueante, esfuerzo bajo, resuelve la ambigüedad de la causa #1.
2. **§3.3 (interpolación)** — esfuerzo bajo, independiente, descarta o confirma una causa de segundo orden rápido.
3. **§3.4 (factor de mantenimiento)** — esfuerzo moderado, independiente, mejora trazabilidad aunque no mueva mucho el residual.
4. **§3.1 (interreflexión, cambio de fondo)** — esfuerzo alto, condicionado al resultado de §2. No empezar sin ese resultado.
5. **§3.2 (zona marginal)** — condicionado a conseguir el Anexo C oficial; en paralelo a lo anterior, no bloquea nada.

## 6.1. Instalación reproducible de Radiance (agregado 2026-08-22, a pedido explícito del usuario)

El usuario reportó fricción operativa real: instalar Radiance era un procedimiento manual que había que repetir en cada máquina/checkout ("cada que subo al repo tengo que descargar, trabajo en casa y el proyecto y en ambos lados he descargado"). Se agregó `npm run setup:radiance` (`scripts/setup-radiance.mjs`): descarga el build oficial más reciente de GitHub Releases e instala en `.radiance/` en la raíz del repo (no versionado, ~30 MB, cada máquina lo genera una vez, idempotente). `runRadianceOracle.ts::resolveBinDir()` y el nuevo `isRadianceAvailable()` (usado por los `describe.skipIf` de los 7 archivos de test de esta carpeta) detectan esa instalación automáticamente — ya no hace falta exportar `RADIANCE_BIN_DIR` a mano en ningún flujo normal; `RADIANCE_BIN_DIR` sigue funcionando y tiene prioridad, para quien prefiera una instalación en otra ruta. Verificado de punta a punta (descarga limpia, detección automática sin ninguna variable de entorno, ejecución real de `rtrace`/`oconv`) en esta misma sesión.

## 7. Matriz de escalas y ambientes libres (agregado 2026-08-22, a pedido explícito del usuario)

El usuario pidió explícitamente que la validación cubra "distintos casos, ya sean ambientes cerrados, ambientes libres, de pequeño, mediano y gran tamaño, desde una caseta de baño hasta una sala industrial". Hasta esta fecha, TODA la validación con Radiance de este proyecto (Rondas 6-22) se limitó a ambientes de 1-16 m², una sola luminaria. Se agregó `radianceOracle/industrialScaleFixtures.ts`: oficina pequeña (30 m², 4 luminarias en grilla 2x2), bodega mediana (120 m², techo 6 m, 6 luminarias 3x2), nave industrial grande (360 m², techo 9 m, 12 luminarias 4x3), y una variante de ambiente libre/abierto.

**Limitación de fotometría, declarada sin ocultarla**: el catálogo de fotometría REAL de este repositorio son dos ópticas de baja potencia (14 W/1508 lm, 26 W/2580 lm) — no hay un .ies/.ldt real de luminaria industrial tipo "high-bay". Los fixtures de escala industrial ESCALAN el flujo de esas mismas ópticas (la forma de la distribución fotométrica se conserva, `candela()` ya reescala proporcionalmente) — no deben presentarse como equivalentes a una luminaria industrial real hasta conseguir un .ies/.ldt de high-bay real.

**Limitación de costo computacional, declarada**: `resolveMeshSpacing` nunca engrosa por encima de 0.5 m (ver su doc-comment) — para una nave de 360 m² eso da ~1400 puntos de malla, y cada uno cuesta una traza de radiosidad completa en el oráculo (`rtrace -ab 8`): minutos se vuelven horas. Los fixtures grandes declaran un `oracleSpacing` propio (1.5-2.5 m), desacoplado de la malla real de producción — es una validación estadística del promedio físico, no un mapa isolux fino. El motor bajo prueba sigue usando su malla real sin cambios.

**Resultado, ejecutado 2026-08-22/23** (sin referencia real de DIALux evo — solo Radiance como oráculo físico):

| Ambiente | Área | Reflectancia (techo/pared/piso) | `first-bounce` (Δ Radiance) | `iterative` (Δ Radiance) | Radiance (física) |
|---|---:|---|---:|---:|---:|
| Oficina pequeña | 30 m² | 0.70/0.50/0.30 | 406.5 lx (16.4%) | 456.5 lx (**6.1%**) | 486.2 lx |
| Bodega mediana | 120 m² | 0.50/0.30/0.20 | 391.1 lx (**0.1%**) | 425.1 lx (8.6%) | 391.5 lx |
| Nave industrial grande | 360 m² | 0.50/0.30/0.20 | 436.2 lx (**3.3%**) | 475.8 lx (5.5%) | 450.8 lx |
| Ambiente libre/abierto | 120 m² | 0.50/0.05/0.20 | 372.0 lx (**4.0%**) | 392.0 lx (9.6%) | 357.7 lx |

**Hallazgo importante, no anticipado**: con reflectancia interior típica (oficina, 0.70/0.50/0.30 — el mismo perfil que los 4 casos reales de §2), `iterative` gana con claridad (6.1% vs. 16.4%), consistente con §2. Pero con reflectancia industrial más baja (0.50/0.30/0.20, los otros 3 ambientes), el patrón se INVIERTE: `first-bounce` iguala o supera a `iterative` en los 3, incluyendo un caso casi exacto (bodega, 0.1% de error). **La conclusión de §2/§3.1 ("iterative es más preciso") NO generaliza a reflectancia industrial baja sin más evidencia** — y ninguno de estos 4 ambientes sintéticos tiene una referencia real de DIALux evo, así que no se puede saber todavía si DIALux evo también se comporta distinto en ese régimen. Queda como pregunta abierta explícita, no una conclusión — el próximo paso natural es triangular un proyecto industrial real (geometría + fotometría + PDF de DIALux evo reales) cuando exista uno disponible.

**Hallazgo real, no solo una limitación de los fixtures de prueba**: al modelar la variante de "ambiente libre/abierto" se confirmó que `EnclosureReflectances`/`buildRoomEnclosurePatches` (`roomPatches.ts`) solo aceptan UNA reflectancia de pared para las 4 (o N) aristas del polígono del recinto — no existe manera de declarar "esta arista específica no tiene muro, es una abertura al exterior, no refleja". Para un recinto totalmente cerrado (la mayoría de los casos ya validados) esto no importa. Para el caso que el usuario pidió explícitamente ("ambientes libres") sí importa: un cobertizo, andén de carga, o nave con un lado abierto reflejará luz de forma uniforme en las 4 paredes en el modelo actual, cuando en la realidad el lado abierto no debería aportar nada. El fixture `open-bay` de `industrialScaleFixtures.ts` usa una aproximación (reflectancia de pared ~0.05 uniforme) documentada como NO equivalente a una solución real por-arista.

**Propuesta concreta, no implementada todavía** (requiere decisión explícita, cambio de forma de datos, y revisión — no se implementó en esta sesión por alcance): extender `PartitionPatchInput`/el modelo de `Wall` con un campo de reflectancia por arista (reusando `wallType: 'exterior'` ya existente en `Wall` como señal de "posible abertura", con reflectancia 0 por defecto para exterior sin muro físico declarado), y que `buildRoomEnclosurePatches` reciba un mapa arista→reflectancia en vez de un escalar único. Cambio aditivo (con reflectancia uniforme como default, sin romper ningún caso ya validado) — candidato para una fase separada, después de cerrar §2/§3.1-3.4.

## Referencias

- [DIALux evo – New calculation method (DIAL GmbH)](https://www.dialux.com/fileadmin/documents/DIALux_evo-_New_calculation_method.pdf)
- [Validation of DIALux 4.12 and DIALux evo 4.1 against the Analytical Test Cases of CIE 171:2006 — Mangkuto, LEUKOS 12(3), 2016](https://www.tandfonline.com/doi/abs/10.1080/15502724.2015.1061438)
- [Fagerhult — Number of calculation points (EN 12464-1)](https://www.fagerhult.com/knowledge/light-planning/en-12464-1/calculation-areas/number-of-calculation-points/)
- [DIALux evo Knowledge Base — UGR](https://evo.support-en.dial.de/support/solutions/articles/9000116115-ugr)
- [Esse-Ci — Maintenance factor (LLMF/LSF/LMF/RSMF, CIE 97:2005)](https://www.esse-ci.com/en/utility/maintenance-factor/)
- [Global Illumination using Photon Maps — Jensen 1996](http://graphics.ucsd.edu/~henrik/papers/photon_map/)
- `planes/plan_cierre_brecha_paridad_dialux_evo.md` (Rondas 0-22, historial completo de esta investigación)
- `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md` §10.3 (tolerancias)
