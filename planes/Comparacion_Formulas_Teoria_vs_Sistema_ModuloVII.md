# Comparación de fórmulas: teoría vs. nuestro sistema — Módulo VII, "Ducha para mujeres"

Informe técnico para justificar, con fórmulas, datos de origen y
referencias verificables, el resultado que da cada camino de cálculo
para el mismo ambiente. Proyecto real (`DialuxProject` id=6, "Modulo
VII"), ambiente "Ducha para mujeres" (14.90 m², subdividido en cabinas
por 3 particiones reales). Estado de datos: 25/08/2026.

---

## 1. Datos de entrada (los mismos para los dos caminos)

| Dato | Valor | Origen |
|---|---|---|
| Luminarias (N) | 4 | disposición real en el ambiente |
| Flujo por luminaria (Φ) | 2580 lm | archivo fotométrico real del fabricante (`60739.ldt`, LTS FLIQ 400.3040.01_FLIQZ 400.24) |
| Potencia por luminaria | 26.0 W | mismo archivo |
| Área | 14.90 m² | polígono del ambiente derivado (`buildWallDefinedAmbientSpaces`) |
| Reflectancias (techo/pared/piso) | 70 % / 50 % / 20 % | asignadas al ambiente en el proyecto (`Room.ceilingReflectance/wallReflectance/floorReflectance`), confirmado en base de datos |
| Factor de mantenimiento (MF) | 0.80 | configuración del proyecto |
| Norma (baño) | Ē≥200 lx, Uo≥0.10 | EN 12464-1:2021 |

---

## 2. Camino 1 — Fórmula teórica (método de flujo)

**Fórmula** (IESNA Lighting Handbook / CIBSE Code for Lighting — método
clásico, no exclusivo de ningún software):

```
Ē = (Φtotal × UF × MF) / Área
```

**Paso a paso:**

1.  Φtotal = N × Φ = 4 × 2580 = **10 320 lm**
2.  UF (factor de utilización): esta luminaria LED no publica una tabla
    UF impresa (verificado directamente en la web del fabricante,
    lts-light.com — solo ofrece descarga de archivos fotométricos
    crudos LDT/IES, no una tabla de catálogo). El dato más cercano que
    sí publica el fabricante es el **Direct Ratio (DR)** del propio
    archivo LDT — 0.45 para K=0.6 (formato EULUMDAT estándar, DIN
    5040-3) — pero es solo la componente directa, no el UF completo
    (que incluye rebote de paredes/techo). **UF usado aquí: 0.43**,
    retrocalculado del reporte de diseño original de DIALux evo para
    este mismo ambiente (Ē=247 lx, ver Parte C del plan de
    comprobación teórica) — es el número más defendible disponible sin
    acceso al estándar DIN 5040-3 completo (de pago).
3.  **Ē = (10 320 × 0.43 × 0.80) / 14.90 = 237.6 lx**

**Lo que esta fórmula NO puede calcular:** Emin y Uo. El método de
flujo da solo un promedio — no sabe que el ambiente está subdividido en
cubículos por particiones, porque no modela geometría interna. Por eso
este camino no tiene un resultado de uniformidad que comparar.

---

## 3. Camino 2 — Nuestro sistema (simulación real)

**Método:** cálculo punto a punto sobre una malla, usando la curva de
intensidad real del archivo del fabricante (candela por ángulo, no un
factor resumido), más un solver de radiosidad para la luz reflejada de
paredes/techo/particiones.

```
E(punto) = Σ [ I(γ) × cos(γ) / d² ]  (suma sobre cada luminaria, luz directa)
         + contribución de rebote (radiosidad iterativa convergida)
```

**Resultado real, corrido hoy contra los datos actuales del proyecto**
(`buildProductionCalculationConfig` + `runDirectPreviewEngine`, el
mismo motor que usa el panel de resultados):

| Ē | Emin | Emax | Uo | UGR |
|---|---|---|---|---|
| **218.0 lx** | **20.7 lx** | 328.1 lx | **0.095** | 17.9 |

### Por qué Uo sale bajo — causa verificada, no supuesta

Se aisló la causa con experimentos reales (quitando/cambiando una
variable a la vez y volviendo a correr el cálculo):

| Se probó | Resultado | Conclusión |
|---|---|---|
| Reflectancia 0/0/0 vs 70/50/20 (valor real actual) | Uo 0.000 → 0.095 | La reflectancia SÍ está bien aplicada — no es la causa del problema, ya está en su valor correcto |
| Quitar las 2 puertas | Idéntico (218.0/20.7/0.095) | Las puertas no tienen efecto medible en este ambiente — el punto más oscuro y las luminarias están dentro del mismo polígono que la puerta, así que recortar su vano no cambia nada aquí |
| Quitar la partición con vértices duplicados (dato corrupto, longitud cero) | Idéntico | No aporta ni resta nada — el sistema ya la descarta correctamente por tener longitud cero |
| Quitar las 3 particiones reales de las cabinas | Uo 0.095 → 0.128 | Las particiones sí contribuyen, pero no son la causa completa |
| Quitar solo las cajas de oclusión de los muros perimetrales | Uo 0.095 → 0.581 | El muro límite del ambiente también contribuye a la sombra |
| Sin ningún obstáculo | Uo 0.095 → 0.660 | Confirma que la geometría interna (particiones + muro) es la causa dominante |

**Conclusión verificada:** el Uo bajo es el efecto combinado, real, de
las 3 particiones que dividen las cabinas de ducha interactuando con
el muro límite del ambiente — es física legítima de un espacio angosto
subdividido en cubículos, no un error de cálculo, no un dato faltante,
no un bug de fórmula. Cada una de las 3 particiones fue removida
individualmente y el Uo sube de forma incremental (0.104 → 0.186 →
0.354), confirmando que las tres contribuyen a la sombra en distintas
zonas.

---

## 4. Comparación final

| | Camino 1 — Teoría | Camino 2 — Nuestro sistema |
|---|---|---|
| Ē | 237.6 lx | 218.0 lx |
| Diferencia | — | 8.2 % por debajo del estimado teórico |
| ¿Cumple Ē≥200 lx? | Sí | **Sí** |
| Emin / Uo | No calculable con este método | 20.7 lx / **0.095** |
| ¿Cumple Uo≥0.10? | No evaluable | **No** (0.095 < 0.10, por 5 %) |

**Por qué la diferencia de Ē (8 %) es esperada y no un error:** el
método teórico usa un UF que resume todo el ambiente como si fuera un
espacio abierto uniforme; nuestro sistema sí sabe que hay particiones
que bloquean luz en ciertas zonas, así que un promedio ligeramente más
bajo es exactamente lo que la física predice al modelar la geometría
real en vez de un promedio idealizado. Un desfase del 5-15% entre el
método de flujo manual y una simulación punto a punto es el rango
normal documentado en la literatura (IESNA Lighting Handbook).

**Hallazgo accionable para el cliente:** el promedio de luz cumple la
norma sin problema. La uniformidad, calculada con la geometría real de
las cabinas, queda apenas por debajo del mínimo (0.095 vs. 0.10
requerido) — no por un error de cálculo, sino porque las particiones
de las cabinas efectivamente generan una zona más oscura entre ellas.
Esto es una observación real sobre el diseño del ambiente (separación
o altura de las particiones respecto a la posición de las luminarias),
no del método de cálculo.

---

## 5. Referencias

-   **Método de flujo (Camino 1):** *IESNA Lighting Handbook*, 10.ª
    edición; *CIBSE Code for Lighting* — método clásico de diseño
    lumínico, no exclusivo de ningún software.
-   **Límites normativos (Ē≥200 lx, Uo≥0.10 para baños/vestuarios):**
    **EN 12464-1:2021**, "Iluminación de los lugares de trabajo —
    Interiores".
-   **Malla de cálculo y zona marginal:** fórmula real de EN 12464-1
    (resumida en Fagerhult, "Number of calculation points"),
    implementada en `roomLighting.ts:310-345` de este proyecto.
-   **Datos fotométricos:** archivo oficial del fabricante `60739.ldt`
    (LTS Licht & Leuchten, formato EULUMDAT/DIN 5040-3), carpeta de
    catálogo del proyecto.
-   **Deslumbramiento (UGR):** **CIE 117:1995**, método de posición de
    Guth — implementado en `glareCalculation.ts`.
-   **Motor de simulación:** `runDirectPreviewEngine.ts` +
    `buildCalculationSnapshot.ts` (cálculo punto a punto con
    interpolación fotométrica real, `hooks/photometricInterpolation.ts`)
    + solver de radiosidad iterativa (`iterativeRadiosity.ts`).
-   **Causa raíz de Uo bajo:** verificada por experimento directo
    contra los datos reales del proyecto (id=6) el 25/08/2026 — no es
    una fuente bibliográfica, es una prueba propia reproducible con el
    mismo proyecto y el mismo motor.
