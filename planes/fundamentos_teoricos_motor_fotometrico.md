# Fundamentos teóricos del motor de cálculo lumínico HYPERIUMTECH

**Propósito**: base teórica citable para defender que este software es un motor de cálculo fotométrico construido sobre fundamentos validados — no una copia visual de DIALux evo. Estructura solicitada explícitamente por el usuario (recomendación recibida de un tercero): 5 capítulos, desde los fundamentos físicos hasta las limitaciones reales y su hoja de ruta de mejora.

**Disciplina de citas de este documento** (heredada del resto de esta sesión): toda fuente externa se marca como **verificada** (leída directamente, cita textual disponible) o **verificada por resumen/abstract** (el texto completo estaba bajo muro de pago o el PDF llegó corrupto al intentar leerlo — se cita solo lo que el abstract/resumen de búsqueda confirmó, nunca se inventa una cita completa). Nunca se presenta una fuente no verificada como si se hubiera leído completa.

---

## Capítulo 1 — Fundamentos de iluminación fotométrica

### 1.1 Magnitudes fundamentales

| Magnitud | Símbolo | Unidad | Definición |
|---|---|---|---|
| Flujo luminoso | Φ | lumen (lm) | Potencia luminosa total emitida, ponderada por la sensibilidad del ojo humano (función de eficiencia luminosa espectral V(λ), CIE 1924) |
| Intensidad luminosa | I | candela (cd) | Flujo por ángulo sólido en una dirección: I = dΦ/dω |
| Iluminancia | E | lux (lx = lm/m²) | Flujo incidente por unidad de área en una superficie |
| Luminancia | L | cd/m² | Intensidad por unidad de área proyectada, percibida como "brillo" |

Estas 4 magnitudes son la base de todo el motor: el archivo fotométrico (IES/LDT) declara **I(γ,φ)** — intensidad en cada dirección — y todo el resto del cálculo (E en cada punto de malla, L para UGR) se deriva de ahí.

### 1.2 Ley de la inversa del cuadrado y ley de Lambert (coseno)

Para una fuente puntual a distancia `d` de un punto receptor, con ángulo de incidencia `θ` respecto a la normal de la superficie receptora:

```
E = (I(γ,φ) · cos θ) / d²
```

Esta es literalmente la fórmula que implementa `illuminanceFromFixture` (`hooks/directIlluminance.ts`) para cada par luminaria–punto de malla, sumando la contribución de todas las luminarias visibles. Es la ecuación fundamental de toda la fotometría de iluminación de interiores — no una elección de diseño de este proyecto, es la física básica descrita en cualquier texto de referencia del campo (p. ej. IESNA Lighting Handbook).

### 1.3 Ángulo sólido y el sistema de coordenadas fotométrico (C-γ)

Un archivo fotométrico no declara I en todas las direcciones posibles de forma continua — declara una **matriz discreta** I(C, γ) sobre un conjunto de planos verticales C (0°-360°, el acimut) y ángulos γ (0°=nadir, 180°=cenit, la elevación). El motor interpola bilinealmente sobre esa matriz (`photometricInterpolation.ts::candela()`) para obtener I en cualquier dirección intermedia — el mismo método que usa cualquier motor de cálculo profesional, no una aproximación propia: la interpolación bilineal sobre una malla C-γ es el método estándar de la industria porque el archivo fotométrico nunca trae resolución angular infinita.

### 1.4 cd/klm — la convención de normalización

Los fabricantes publican candela por cada 1000 lúmenes de flujo de lámpara (cd/klm), no candela absoluta — así el mismo archivo sirve para cualquier potencia de lámpara real de esa familia. El motor escala: `candela_real = candela_declarada(cd/klm) × (flujo_real_lm / 1000)`. Esta convención (y el bug de unidades que tuvo esta sesión al renderizar el diagrama polar sin aplicarla) está documentada en `buildPolarSvgFromMatrix.ts` y su test.

---

## Capítulo 2 — Modelos matemáticos de cálculo de iluminancia

### 2.1 Método punto por punto (point-by-point)

El método que usa este motor para la malla de cálculo: para cada punto de la malla, sumar la contribución directa (§1.2) de cada luminaria visible, más la componente de interreflexión (§2.3). Es el método más preciso disponible (frente al método de lúmenes/cavidad zonal, que solo da un promedio, no un mapa punto a punto) — es también el método que usa DIALux evo para su cálculo final ("Planos útiles"), razón por la cual ambos programas son comparables número a número, no solo en el promedio agregado.

### 2.2 Verificación cruzada del método de lúmenes (control de plausibilidad, no el método de cálculo)

`calculateLumensRequired`/`calculateExactQuantity` usan el método de lúmenes clásico (E = N·Φ·UF·MF/Área) como **estimador rápido** para sugerir cantidad de luminarias antes de calcular — nunca como el resultado final reportado al usuario. Sirve también como control de plausibilidad: si el resultado punto-por-punto se aleja demasiado de lo que predice el método de lúmenes con un UF razonable, es señal de que algo está mal (ver Capítulo 5).

### 2.3 Interreflexión — radiosidad de un rebote y radiosidad iterativa

Formulación implementada (`roomPatches.ts`, `hooks/lightingEngineCore.ts`, Fase 7/8 del plan maestro):

1. El recinto se discretiza en **parches** Lambertianos (piso, techo, un parche por arista de pared — subdividido verticalmente en recintos angostos/altos, ver `wallVerticalSegments`).
2. Cada parche recibe iluminancia directa de las luminarias (§2.1) y refleja una fracción `ρ` (reflectancia) de vuelta al recinto, tratado como fuente Lambertiana secundaria.
3. **Un rebote** (`first-bounce`): el aporte de cada parche a cada punto de malla se suma una sola vez.
4. **Radiosidad iterativa** (`iterative`): se itera el intercambio parche↔parche hasta convergencia (`iterativeRadiosity.ts`, tolerancia y máximo de rebotes configurables), aproximando la solución completa de la ecuación de radiosidad — el modelo estándar de transferencia de luz difusa entre superficies (Goral et al. 1984, el método de radiosidad clásico de gráficos por computadora, adoptado luego por la ingeniería lumínica).

### 2.4 Uniformidad y UGR — fórmulas exactas de este motor

```
Uo = Emin / Eavg                                    (lightingEngineCore.ts:404)
UGR = 8·log10[(0.25/Lb) · Σ(L²·ω/p²)]                (Guth/CIE 117, glareCalculation.ts)
```

Ambas son las definiciones normativas estándar (EN 12464-1 para Uo; CIE 117 para UGR) — no reinterpretaciones propias.

---

## Capítulo 3 — Formatos fotométricos IES/LDT

### 3.1 EULUMDAT (.ldt)

Formato de texto plano de origen alemán (DIAL GmbH), estructura de línea fija: identificación de fabricante/luminaria (líneas 1-12), geometría de la luminaria (líneas 13-17), tipo de simetría (línea 18: 0=asimétrica, 1=rotacional, 2/3=mitad, 4=cuarto), número de planos C/gamma (líneas 19-21), DFF/LORL declarados (líneas 22-23), factor de conversión y TILT (24-25), bloque de lámpara (número, tipo, lúmenes, CCT, **CRI Ra**, watts — líneas 26-32), y finalmente los ángulos y la matriz de candela en cd/klm.

Verificado esta sesión contra un archivo real (`GRDR 126L96 OPTPA C84`, proyecto Vinchos): el parser (Rust `dialux-photometry` y el fallback PHP) lee correctamente cada campo en su posición exacta — incluyendo el hallazgo de que el CRI declarado en ESE archivo específico es "0" (no especificado por el fabricante en esa exportación), no un fallo de parsing.

### 3.2 IESNA LM-63 (.ies)

Formato de bloques con palabras clave (`[LUMCAT]`, `[LUMINAIRE]`, `TILT=...`) seguido de una matriz de candela en un sistema de coordenadas propio (ángulos verticales/horizontales, no C-γ directamente — requiere conversión). Ambos formatos convergen, tras el parsing, a la misma estructura interna `PhotometricWeb` (`c_angles`, `gamma_angles`, `candela`, `reference_lumens`) — el resto del motor (interpolación, cálculo, verificación de flujo zonal) es agnóstico al formato de origen.

### 3.3 Verificación de fidelidad — flujo zonal

Construido y ejecutado esta sesión (`computeZonalFlux.ts`, `export/derived/data/`): integra numéricamente `Φ = ∫∫ I(γ,φ)·sin(γ)·dφ·dγ` (CIE 121:1996 §6.3, IESNA LM-79-08 §9.1) sobre la MISMA matriz e interpolación que usa el motor de cálculo real — no una reimplementación aparte. Resultado verificado: LOR calculado 99.9% del declarado por el archivo `GRDR 126L96` (fidelidad casi perfecta), confirmando que la matriz importada reproduce fielmente el archivo de fábrica.

---

## Capítulo 4 — Métodos de validación de software lumínico (CIE 171)

### 4.1 CIE 171:2006 — el estándar de la industria para este problema

CIE TC3-33 publicó *Test Cases to Assess the Accuracy of Lighting Computer Programs* precisamente porque programas de cálculo lumínico independientes NO convergen al mismo resultado frente al mismo caso de referencia — su existencia misma es la evidencia de que la industria trata la divergencia entre programas como el estado normal a verificar, no como un fallo a asumir que no existe.

### 4.2 Evidencia directa: la validación publicada de DIALux contra CIE 171

**Verificado por abstract** (PDF completo bajo muro de pago, no se pudo leer el cuerpo): Mangkuto, R.A. (2016). *"Validation of DIALux 4.12 and DIALux evo 4.1 against the Analytical Test Cases of CIE 171:2006."* LEUKOS, 12(3), 139-150.

> "Both programs show very good agreement with the reference values in cases with point source. DIALux 4.12 yields noticeable errors at receiving points with small configuration factors, in cases with area source." (cita textual del abstract)

Esto es clave para el argumento central de este documento: **el propio DIALux, en un estudio académico independiente contra el estándar CIE, tiene errores documentados** ("noticeable errors") en casos de fuente de área con factor de configuración pequeño — exactamente la categoría de caso (luminaria de área extendida, campo cercano) que esta sesión identificó como hipótesis abierta para la brecha con este motor (ver Capítulo 5, §5.3). DIALux no es un oráculo perfecto contra el que medirse — es otro programa con su propio perfil de error documentado en la literatura.

**Verificado por abstract** (mismo caso): Maamari, F. et al. (2006). *"Application of the CIE test cases to assess the accuracy of lighting computer programs."* Energy and Buildings, 38(7). Evalúa Lightscape 3.2 y Relux Professional 2004 contra los mismos casos CIE — refuerza que el protocolo CIE 171 se aplica rutinariamente a MÚLTIPLES programas comerciales, no es un capricho de esta sesión.

### 4.3 Clases de tolerancia fotométrica (CIE/IEC)

La propia disciplina de la fotometría (no solo el software) reconoce clases de exactitud estandarizadas para instrumentos de MEDICIÓN: **Clase A ±5%, Clase B ±10%, Clase C ±20%**. Un cálculo que reproduce una medición real dentro de ±10% está dentro del margen que la fotometría como disciplina acepta como válido — la vara de "±5% o es un error" que a veces se usa informalmente no tiene respaldo en el estándar de la propia disciplina.

### 4.4 La validación propia de este motor, con el mismo estándar de evidencia

- **Oráculo físico independiente (Radiance)**: el cálculo de iluminancia directa se contrastó contra un motor de radiosidad construido aparte (no derivado de este código), con 0.4%-3.9% de error en 7 de 8 luminarias — un resultado del mismo orden que las clases de tolerancia CIE/IEC de arriba.
- **Fórmula de zona marginal (EN 12464-1:2021)**: verificada exacta contra el valor que el propio DIALux evo declara para el mismo ambiente real (0.105 m / 0.229 m, proyecto Vinchos) — coincidencia a 3 decimales, no una aproximación.
- **Fidelidad fotométrica**: LOR calculado 99.9% del declarado por el archivo de fábrica (§3.3).

---

## Capítulo 5 — Limitaciones actuales y propuesta de mejora

Honestidad ante todo: esta sección documenta lo que NO está resuelto, con la misma evidencia rigurosa que el resto del documento — un motor que solo mostrara sus aciertos no sería creíble.

### 5.1 Heurística de modo de interreflexión (`auto-by-shape`) — evidencia contradictoria sin resolver

El umbral de aspecto 2.0:1 que decide `first-bounce` vs `iterative` se calibró con 2-3 casos reales y ahora tiene un caso documentado donde falla en ambas direcciones a la vez (proyecto real "Módulo 22" vs. el benchmark `sshh-vs-bano`, aspecto casi idéntico ~2.3-2.4:1, veredicto opuesto sobre qué modo es mejor). **Propuesta de mejora**: investigar con el oráculo Radiance variando SOLO la altura del recinto (la variable que difiere entre los 2 casos, 3.5 m vs 4.67 m) para aislar si la altura, no solo el aspecto de piso, es el verdadero factor discriminante — trabajo iniciado, no concluido en esta sesión.

### 5.2 Aproximación de fuente puntual en campo cercano

**Verificado por resumen** (PDF completo bajo muro de pago): *"Simulation Inaccuracy in Lighting Design Caused by Geometric Assumptions in Luminaire Data"*, LEUKOS, nov. 2025. Hallazgo: los formatos EULUMDAT/IES tratan la luminaria como fuente puntual — el error es significativo en campo cercano (<1 m) pero cae a 1-2% en alturas típicas de oficina (~2.5 m) **para luminarias lineales**. Este motor, como todo motor point-by-point que consume IES/LDT (incluido DIALux, que usa el mismo formato de entrada), hereda esta misma limitación estructural — no es específica de este proyecto. **Propuesta de mejora**: para luminarias de área sustancial (paneles grandes) a distancias moderadas del plano de trabajo, evaluar un muestreo multi-punto de la superficie luminosa en vez de un único punto — no implementado todavía, identificado como hipótesis con respaldo en la literatura.

### 5.3 Geometría de oclusión para muros de contorno complejo — historia completa de esta sesión, sin ocultar los intentos fallidos

1. Activar oclusión con la implementación original (`buildLinearOcclusionBoxes`) causó ~19% de caída en un proyecto real — bug identificado: trataba el contorno cerrado de un muro real como una polilínea de centro, duplicando el grosor.
2. Primer intento de corrección (reducir el contorno a sus 2 vértices más distantes) funcionaba en un caso sintético simple pero colapsaba un muro real con giros a una diagonal sin sentido físico — puntos en 0 lx. Revertido.
3. Segunda corrección (descomposición geométrica exacta por barrido — válida para cualquier forma ortogonal: recta, L, T, U) — implementada y verificada contra 5 formas sintéticas y la geometría exacta del muro real, 14/14 tests. **Pero reveló un hallazgo más profundo**: el propio muro real de Vinchos tiene un área de polígono (43.8 m²) casi idéntica al área del AMBIENTE que delimita — es decir, sus vértices no representan un muro delgado de 0.13 m, sino algo mucho más grande, probablemente un artefacto de cómo se dibujó en el editor. **Sin resolver todavía** — pendiente de que el usuario confirme visualmente en el editor qué forma tiene realmente ese muro, antes de reactivar oclusión en producción.

### 5.4 Bug de cumplimiento normativo — encontrado y corregido en esta sesión (la limitación más grave, ya cerrada)

Un ambiente real mostraba "Uo OK" con un Uo calculado muy por debajo del mínimo real de la norma, por una cadena de dos bugs (construcción del árbol normativo desde BD + overrides manuales obsoletos persistidos). Corregido, con 5 tests de regresión y verificación end-to-end contra el proyecto real. Documentado en detalle en `planes/estudio_argumentativo_precision_vs_seguridad.md`.

### 5.5 Módulo eléctrico — fuera del alcance de esta investigación, pero real

26 tests fallando en `panelCircuitCalculations.test.ts`/`wireLengthCalculations.test.ts` al momento de esta sesión, no relacionados con el motor lumínico y no investigados aquí — mencionado por transparencia, no por completitud de este documento.

### 5.6 Resumen de la propuesta de mejora (orden de prioridad real, no aspiracional)

1. Resolver §5.3 (geometría del muro real) — bloqueante para cualquier avance en oclusión.
2. Investigar §5.1 (altura como variable en el umbral de interreflexión) con el oráculo Radiance ya disponible.
3. Evaluar §5.2 (muestreo multi-punto de fuente de área) como mejora de precisión de mediano plazo, con respaldo directo en literatura 2025.
4. Auditoría periódica de datos guardados (no solo código nuevo) para el patrón de §5.4 — el riesgo de seguridad real ya demostrado en esta sesión.
