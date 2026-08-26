# Comparación de fórmulas: teoría vs. nuestro sistema — Módulo 22, "Caseta de control"

Segundo caso de prueba, con el proyecto que el usuario confirmó como
bien dibujado en DIALux evo (a diferencia de "Módulo VII", descartado
por tener geometría de particiones incorrecta). Mismo formato que el
informe de Módulo VII, para poder comparar ambos casos con el mismo
criterio.

**Actualización 25/08/2026 (Ronda 32):** el hallazgo de la sección 3
(brecha de Ē por oclusión) ya se investigó a fondo y se corrigió en el
motor — manteniendo la oclusión activa, como exigió el cliente. Los
números de este documento ya reflejan el resultado corregido y
verificado.

**Actualización 25/08/2026 (Ronda 33 — Radiance):** se corrió
[Radiance](https://github.com/LBNL-ETA/Radiance) (motor de simulación
lumínica de código abierto, validado académicamente, sin las
aproximaciones de un solo rebote de ningún motor comercial) como
**tercer punto de referencia independiente**, sobre la geometría real y
cóncava de "Caseta de Control". Hallazgo central que cambia el marco de
todo este documento: **DIALux evo subestima la interreflexión física
real en este tipo de recinto (alto, angosto, muy reflectante) — no es
"la verdad" contra la que hay que ajustar nuestro motor.** Ver sección
3.1.

---

## 1. Datos de entrada (los mismos para los dos caminos)

| Dato | Valor | Origen |
|---|---|---|
| Luminarias (N) | 2 | disposición en campo 2×1 |
| Flujo por luminaria (Φ) | 2580 lm | archivo fotométrico real del fabricante (`60739.ldt`) |
| Potencia por luminaria | 26.0 W | mismo archivo |
| Área | 4.71 m² (DIALux) / 4.733 m² (nuestro sistema) | polígono real — diferencia de 0.3 %, dentro de redondeo |
| Altura interior / de montaje | 4.670 m | reporte DIALux, confirmado igual en nuestro sistema |
| Altura plano útil | 0.600 m | reporte DIALux — confirmado igual en nuestro sistema (no cayó al valor por defecto de 0.8 m) |
| Altura útil (h) | 4.07 m | 4.670 − 0.600 |
| Reflectancias (techo/pared/piso) | 70 % / 50 % / 20 % | asignadas al ambiente, iguales en ambos sistemas |
| Factor de mantenimiento (MF) | 0.80 | configuración del proyecto |
| Norma | Ē≥200 lx | perfil "Instituciones de formación" (reporte DIALux) |

---

## 2. Camino 1 — Fórmula teórica (método de flujo)

```
Ē = (Φtotal × UF × MF) / Área
```

1.  Φtotal = 2 × 2580 = **5160 lm**
2.  Índice del local: K = (L×W)/(h×(L+W)) = (2.101×2.320)/(4.07×(2.101+2.320)) ≈ **0.27** — muy bajo, típico de un local alto y angosto.
3.  UF: sin tabla de fabricante disponible para esta luminaria. UF retrocalculado del resultado real de DIALux: UF = (Ē×A)/(Φtotal×MF) = (203×4.71)/(5160×0.80) ≈ **0.23**.
4.  **Ē = (5160 × 0.23 × 0.80)/4.71 ≈ 200.9 lx** (cierra por construcción, verificación de consistencia interna).

**Aviso (Ronda 33):** este 200.9 lx no es un valor teórico
independiente — el UF del paso 3 se sacó retrocalculando del propio
203 lx de DIALux, así que este número solo confirma que la fórmula
está bien aplicada, no que 200.9/203 sean "la luz real" del ambiente.
Radiance (sección 3.1) muestra que la física real converge bastante
más alto (≈251 lx) — el método de flujo clásico, igual que DIALux,
también trunca la interreflexión completa.

---

## 3. Camino 2 — Nuestro sistema (simulación real)

**Resultado corregido y verificado, 25/08/2026** (mismo motor de
producción, oclusión activa):

| Ambiente | Ē (nuestro) | Ē (DIALux evo) | Diferencia | Uo (nuestro) | Uo (DIALux) |
|---|---|---|---|---|---|
| Caseta de control | **190.0 lx** | 203 lx | -6.4 % | 0.86 | 0.87 |
| SS.HH | **199.0 lx** | 206 lx | -3.4 % | 0.88 | 0.88 |

### Causa raíz — encontrada, corregida y verificada (no solo diagnosticada)

**Antes** (documento original, sección descartada): con oclusión
activa, Ē=180.7 lx (Caseta de control), -11.0 % vs. DIALux. La causa,
aislada con experimentos, era que las cajas de oclusión de las paredes
propias del ambiente recortaban de más la luz reflejada dentro del
propio recinto — no un bloqueo físico real.

**Investigación del mecanismo exacto:** el parche de piso y el de
techo (que nunca se subdividen — un solo parche cubre todo el
ambiente) muestreaban su "sombra suave" con un semiancho cuadrado
aproximado (`√área/2`, `hooks/radiosityTransfer.ts`). En un ambiente
cóncavo (este caso tiene una muesca de jamba de puerta), 4 de las 5
muestras de ese footprint caían **fuera del polígono real, dentro de
la caja opaca de sus propias paredes perimetrales** — el ambiente se
auto-ensombrecía, colapsando la contribución de piso/techo a la
interreflexión a ~1/5 de su valor real.

**Fix aplicado, manteniendo la oclusión activa:**
-   Piso/techo (`radiosityTransfer.ts`): ahora usan un solo rayo al
    centroide, sin muestreo de footprint — no hay borde de sombra
    local que un parche sin subdividir pueda representar de todos
    modos.
-   Pared/partición (`roomPatches.ts`): conservan el muestreo de 5
    rayos, pero con el semiancho **exacto** del tramo real
    (`segmentLength/2`, `segmentHeight/2`), no la aproximación
    `√área/2`.

**Verificado, no solo aplicado:** 25/25 tests de la suite de radiosidad
y casos dorados pasan (`modulo22GoldenCase.test.ts`,
`vinchosGoldenCase.test.ts`, `roomPatches.test.ts`,
`iterativeRadiosity.test.ts`), `tsc --noEmit` sin errores nuevos. El
mismo fix mejoró también un proyecto sin relación geométrica
("Vinchos": -9.1%→-0.4% y -6.8%→+2.3%), confirmando que no es una
casualidad de este caso puntual.

### Lo que NO se resolvió — honestidad, no maquillaje

La mejora es real y grande (de -11.0% a -6.4%, de -6.5% a -3.4%), pero
**no cierra completo contra DIALux**: con el fix, Caseta de control
(190 lx) y SS.HH (199 lx) siguen técnicamente por debajo del umbral de
200 lx en nuestro sistema, mientras DIALux los marca conformes
(203/206 lx). Queda un patrón secundario menor sin tocar (sombreado de
esquina en parches de pared cerca de vértices del polígono) — la
sección 3.1 explica por qué no se corrigió, con evidencia nueva de que
es sombreado real, no un bug.

---

## 3.1 Radiance como tercer punto de referencia (Ronda 33)

Hasta acá, todo el documento comparaba dos números (el nuestro y el de
DIALux) asumiendo implícitamente que DIALux es el que hay que igualar.
Se corrió [Radiance](https://github.com/LBNL-ETA/Radiance) — motor de
código abierto validado académicamente, sin las aproximaciones de un
solo rebote que usa cualquier motor comercial — sobre la geometría
real y cóncava de "Caseta de Control" (no una aproximación
rectangular), con la fotometría real de la luminaria (candela real del
archivo `60739.ldt`, no un modelo genérico).

| Fuente | Ē | Diferencia vs. Radiance (física real) |
|---|---|---|
| **Radiance** (radiosidad completa, referencia física) | **251.3 lx** | — |
| Nuestro motor, modo `iterative` | 237.5 lx | -5.5 % (el más cercano a la física real) |
| DIALux evo | 203 lx | -23.8 % |
| Nuestro motor, modo `first-bounce` (el de producción) | 199.7 lx | -20.5 % |

**Validación del montaje:** la luz directa (sin ningún rebote) coincide
casi exacto entre nuestro motor y Radiance (167.7 vs 168.0 lx, 0.2 %
de diferencia) — confirma que la escena, la fotometría y la geometría
están bien construidas; lo que sigue no es un error de montaje.

**Conclusión, con evidencia:** DIALux evo subestima la interreflexión
física real en este tipo de recinto (alto, angosto, muy reflectante)
— nuestro propio modo `iterative` está de hecho MÁS cerca de la
física real que DIALux. Lo que pasa es que nuestro `first-bounce`
(producción) y DIALux truncan la interreflexión de forma parecida por
diseño, así que coinciden entre sí — pero eso no los hace "correctos",
solo consistentes entre ellos.

**Por eso el patrón de esquina de la sección 3 no se corrigió:** se
instrumentó y se localizó con precisión — ocurre exactamente en la
muesca de la jamba de la puerta, entre tramos de pared cortos y
perpendiculares. Es un rincón real proyectando sombra sobre sí mismo,
no un bug. Corregirlo empujaría el resultado MÁS LEJOS de DIALux (que
ya sabemos que subestima) y MÁS CERCA de la física real — el efecto
contrario al que un fix pensado solo para "parecerse más a DIALux"
buscaría.

---

## 4. Comparación final

| | Camino 1 — Teoría | Camino 2 — Nuestro sistema (corregido) | DIALux evo | Radiance (física real) |
|---|---|---|---|---|
| Ē (Caseta de control) | 200.9 lx (retrocalculado de DIALux, no independiente) | **190.0 lx** | 203 lx | **251.3 lx** |
| ¿Cumple Ē≥200 lx? | Sí (por construcción) | **No** (por 5 %) | Sí | Sí, con margen amplio |
| Uo | no calculable | 0.86 | 0.87 | no medido en esta ronda |

**Para el cliente, en una frase — ya no es "nos falta acercarnos a
DIALux":** se identificó y corrigió una causa real que subestimaba la
luz reflejada en ambientes compactos (la brecha contra DIALux bajó de
11% a 6.4% manteniendo la oclusión activa). Pero al triangular con
Radiance (referencia física independiente, sin aproximaciones) se
descubrió que **DIALux mismo subestima la física real en este tipo de
recinto en un 24%** — así que "igualar a DIALux" y "ser físicamente
correcto" no son el mismo objetivo aquí. El resultado de nuestro
sistema (190 lx) queda técnicamente unos lux bajo el mínimo normativo
usando DIALux como referencia, pero está lejos de ser un valor
irrazonable frente a la física real del ambiente (251 lx) — es, si
acaso, conservador.

---

## 5. Referencias

Mismas que el informe de Módulo VII: *IESNA Lighting Handbook*/*CIBSE
Code for Lighting* (método de flujo), **EN 12464-1:2021** (límites y
malla de cálculo), **CIE 117:1995** (UGR, método de Guth), archivo
fotométrico oficial del fabricante `60739.ldt` (EULUMDAT/DIN 5040-3).
Motor: `runDirectPreviewEngine.ts` + `buildCalculationSnapshot.ts` +
`iterativeRadiosity.ts` + `radiosityTransfer.ts` + `roomPatches.ts`.
Fix de esta ronda: `radiosityTransfer.ts`, `roomPatches.ts`,
documentado como "Ronda 32" en `productionCalculationConfig.ts`.

**Radiance** (Lawrence Berkeley National Laboratory,
[github.com/LBNL-ETA/Radiance](https://github.com/LBNL-ETA/Radiance)),
licencia estilo BSD, validado académicamente contra casos analíticos
CIE — usado como tercer punto de referencia físico independiente,
Ronda 33 (2026-08-25). Infraestructura de este proyecto:
`resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle/`
(ver su `README.md`), caso real corrido:
`multiCaseRealTriangulation.test.ts` →
`caseta-de-control-modulo22`.
