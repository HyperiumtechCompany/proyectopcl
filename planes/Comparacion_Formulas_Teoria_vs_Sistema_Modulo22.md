# Comparación de fórmulas: teoría vs. nuestro sistema — Módulo 22, "Caseta de control"

Segundo caso de prueba, con el proyecto que el usuario confirmó como
bien dibujado en DIALux evo (a diferencia de "Módulo VII", descartado
por tener geometría de particiones incorrecta). Mismo formato que el
informe de Módulo VII, para poder comparar ambos casos con el mismo
criterio.

**Actualización 25/08/2026:** el hallazgo de la sección 3 (brecha de Ē
por oclusión) ya se investigó a fondo y se corrigió en el motor —
manteniendo la oclusión activa, como exigió el cliente. Los números de
este documento ya reflejan el resultado corregido y verificado.

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
**no cierra completo**: con el fix, Caseta de control (190 lx) y SS.HH
(199 lx) siguen técnicamente por debajo del umbral de 200 lx en
nuestro sistema, mientras DIALux los marca conformes (203/206 lx).
Queda un patrón secundario menor sin resolver (sombreado de esquina en
parches de pared cerca de vértices del polígono) — no se tocó porque
la evidencia para ese caso no era tan sólida como la del piso/techo, y
el riesgo de una regresión sin esa certeza no se justificaba.

---

## 4. Comparación final

| | Camino 1 — Teoría | Camino 2 — Nuestro sistema (corregido) | DIALux evo |
|---|---|---|---|
| Ē (Caseta de control) | 200.9 lx | **190.0 lx** | 203 lx |
| ¿Cumple Ē≥200 lx? | Sí (por construcción) | **No** (por 5 %) | Sí |
| Uo | no calculable | 0.86 | 0.87 |

**Para el cliente, en una frase:** se identificó y corrigió una causa
real que subestimaba la luz reflejada en ambientes compactos —
la brecha bajó a la mitad (de 11% a 6.4%) manteniendo la oclusión
activa. El resultado todavía queda unos pocos lux por debajo del
mínimo normativo en nuestro sistema; DIALux lo marca conforme con
margen ajustado (203 de 200 requeridos), así que la diferencia
restante puede deberse a precisión de malla o a un segundo efecto
menor de esquina, no a un error de dato del proyecto.

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
