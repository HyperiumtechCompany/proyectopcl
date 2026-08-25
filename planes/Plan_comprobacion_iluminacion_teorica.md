# Plan de comprobación teórica de iluminación

## Objetivo

Justificar, con fundamento teórico y trazabilidad al código del sistema,
los valores de iluminación que reporta el módulo DIALux del proyecto.
Este documento sirve para:

1.  Explicar la teoría (método de flujo/lúmenes y cálculo punto a punto).
2.  Mostrar cómo calcula esos mismos valores **nuestro sistema** (qué
    archivo, qué función, qué fórmula exacta).
3.  Recorrer un caso real de este proyecto, número por número.
4.  Justificar por qué se usó cada fórmula donde el sistema se aparta del
    método clásico de libro — para presentar a un ingeniero externo sin
    que una diferencia "de diseño" se lea como un error.

No reemplaza la revisión y firma del ingeniero responsable del proyecto.

---

## Parte A — Fundamento teórico (método de flujo / lúmenes)

Cadena de cálculo:

Flujo luminoso → Iluminancia media → Uniformidad → Potencia específica →
Consumo energético.

Fuentes de referencia de esta parte: método de flujo descrito en manuales
de referencia como el *IESNA Lighting Handbook* o el *CIBSE Code for
Lighting* (método clásico, no exclusivo de ningún software); límites y
malla de cálculo según **EN 12464-1:2021**; deslumbramiento según
**CIE 117:1995** (método de Guth).

### 1. Datos de entrada

-   Largo (L) y ancho (W) del local (m) — **no solo el área**: K necesita
    L y W por separado.
-   Área: A = L × W (m²)
-   Altura de montaje (m)
-   Altura del plano de trabajo / plano útil (m)
-   Número de luminarias (N)
-   Flujo luminoso por luminaria (lm)
-   Potencia por luminaria (W)
-   Reflectancias: techo / pared / suelo
-   Factor de mantenimiento (MF)

### 2. Flujo luminoso total

Φtotal = N × Φluminaria

### 3. Altura útil

h = Altura de montaje − Altura del plano útil

### 4. Índice del local K

K = (L × W) / (h × (L + W))

Relación geométrica del espacio; a K más bajo, más pérdida relativa de
luz hacia las paredes.

### 5. Reflectancias

Ejemplo: Techo 70 % / Pared 50 % / Suelo 20 %. No se multiplican entre
sí; son entradas independientes a la tabla de UF.

### 6. Factor de utilización (UF)

UF = f(K, reflectancias, distribución fotométrica de la luminaria)

**Este valor no se calcula "de la nada": sale de la tabla UF que publica
el fabricante de la luminaria** (o del análisis que un software hace
sobre el archivo fotométrico LDT/IES), indexada por K en filas y por
combinaciones de reflectancia en columnas. Es el único dato de esta
cadena que un cálculo "sin LDT/IES" no puede generar por sí mismo — hay
que pedirlo al fabricante o consultarlo en la ficha técnica.

### 7. Factor de mantenimiento (MF)

Ejemplo: MF = 0.80. Representa pérdidas por envejecimiento y suciedad.
La derivación completa de libro lo descompone en
LLMF × LSF × LMF × RSMF (ver **CIE 97:2005**, *Guide on the maintenance
of indoor electric lighting systems*); usar un valor global (0.80) es
una simplificación práctica válida, no la derivación completa.

### 8. Flujo útil

Φútil = Φtotal × UF × MF

### 9. Iluminancia media (Ē)

Ē = Φútil / A  (lux)

Nota de notación: DIALux evo etiqueta este valor como **Ē⊥** ("Ē
perpendicular"), indicando iluminancia media evaluada perpendicular al
plano útil (para un plano horizontal, es la componente horizontal
estándar). No es un error del reporte ni del plan — es la convención de
notación propia de DIALux evo.

### 10. Uniformidad Uo (g1)

Uo = Emin / Ē

`Uo, g1` es la abreviatura que ya usa este proyecto para uniformidad
([glossaryCatalog.ts:133-137](resources/js/pages/dialux/export/document/glossaryCatalog.ts#L133-L137)).

**Emin no sale del método de flujo** (que solo da un promedio): requiere
un cálculo punto a punto real sobre una grilla, con la curva fotométrica
real de la luminaria. Por eso el objetivo "sin depender de LDT/IES" del
plan solo aplica a Ē, no a Emin/Uo.

### 11. Potencia específica

Pesp = Ptotal / A  (W/m²)

DIALux evo reporta dos variantes en el mismo informe: una relativa al
**plano útil** (área de cálculo, sin la zona marginal) y otra relativa al
**área** total del recinto — dan números distintos. Ver Parte C para un
caso donde ninguna de las dos coincide con el cálculo directo
Ptotal/Base, y Parte B sobre por qué nuestro sistema no reproduce este
campo.

### 12. Potencia por 100 lux

P100lux = (Pesp / Ē) × 100  (W/m²/100 lx)

### 13. Consumo anual

Eanual = (Ptotal × horas de funcionamiento) / 1000  (kWh/año)

### 14. Cálculo punto a punto

E = I(γ) × cos(γ) / d²

Donde I(γ) es la intensidad luminosa en la dirección del punto (de la
curva fotométrica), γ el ángulo desde el nadir de la luminaria y d la
distancia directa (oblicua) fuente-punto. La iluminancia total de un
punto es la suma de todas las luminarias que inciden sobre él; Ē es el
promedio de todos los puntos de la malla.

**Malla de cálculo**: no es arbitraria. Este proyecto ya implementa la
fórmula real de EN 12464-1:2021 para el espaciado de malla y la zona
marginal — ver Parte B, punto 5. Usar cualquier otro espaciado hace que
la comparación Emin/Uo contra DIALux no sea comparable, aunque Ē
coincida (evidencia real de este mismo proyecto: ver
[adaptiveGridSpacing.ts:9-19](resources/js/pages/dialux/hooks/adaptiveGridSpacing.ts#L9-L19)).

**Deslumbramiento (UGR)**: es un cálculo aparte, no del método de flujo.
Usa el índice de posición de Guth (**CIE 117:1995**) evaluado en el
observador de peor caso.

---

## Parte B — Cómo lo calcula nuestro sistema

El sistema tiene **dos rutas de cálculo distintas** para lo que en la
teoría parece un solo flujo. No confundirlas es clave para justificar
cualquier diferencia frente a DIALux o frente al método clásico.

| Paso teórico | Ruta en nuestro sistema | Archivo / función | Fórmula real | Nota |
|---|---|---|---|---|
| Lúmenes requeridos (dimensionamiento) | Sizing inicial | [lightingCalculations.ts:59-71](resources/js/pages/dialux/hooks/lightingCalculations.ts#L59-L71) `calculateLumensRequired` | `((Área×Lux)/Fm)×Fu` | **Literal, no clásica** (no divide por Fu). Decisión confirmada por el ingeniero supervisor el 2026-08-07; con Fm=Fu=0.8 el resultado equivale a Área×Lux sin pérdidas — ver Parte D. |
| Ē, Emin, Emax, isolux (verificación/reporte) | Simulación punto a punto real | [directIlluminance.ts](resources/js/pages/dialux/hooks/directIlluminance.ts), [lightingEngineCore.ts](resources/js/pages/dialux/hooks/lightingEngineCore.ts), [adaptiveGridSpacing.ts](resources/js/pages/dialux/hooks/adaptiveGridSpacing.ts) | E=I(γ)cos(γ)/d² por punto, con interpolación fotométrica real (`candela()`) sobre el archivo LDT/IES de cada luminaria | **No usa tabla UF** — calcula directo desde la fotometría, igual que DIALux, no como el método de flujo manual de la Parte A. |
| Interreflexión (aporte de paredes/techo reflejantes) | Radiosidad | [iterativeRadiosity.ts](resources/js/pages/dialux/hooks/iterativeRadiosity.ts) | Solver de radiosidad (first-bounce o iterativo, según forma del recinto) | Ver Parte D — default `auto-by-shape`. |
| Zona marginal / malla de cálculo | EN 12464-1:2021 real | [roomLighting.ts:310-345](resources/js/pages/dialux/hooks/roomLighting.ts#L310-L345) `getRoomMarginalZone` | `p = min(10, 0.2×5^log10(d))`, `n = round(d/p)`, zona marginal = `(d/n)/2` — `d` = dimensión mayor si L/W∈[0.5,2], si no la menor | Requiere el polígono real del recinto (`room.vertices`), no solo el área. |
| Uniformidad Uo | Directo desde la malla | resultado de la simulación | Emin/Ē sobre los puntos calculados | No hay tabla intermedia; sale de los mismos puntos que Ē. |
| UGR | Guth analítico | [glareCalculation.ts](resources/js/pages/dialux/hooks/glareCalculation.ts) | Aproximación polinómica de Guth (**CIE 117:1995**), peor observador | Override manual disponible (`Room.manualUgr`) para casos fuera del rango de validez H/R≤2. |
| Potencia específica (W/m², W/m²/100lx) | **No implementado** | — | — | Nuestro sistema no calcula este campo; es exclusivo del reporte nativo de DIALux evo. No hay con qué comparar dentro del sistema — ver Parte C. |

---

## Parte C — Caso aplicado

Datos de un ambiente real de este proyecto (reporte DIALux evo):

| Dato | Valor |
|---|---|
| Base (A) | 14.36 m² |
| Altura interior / de montaje | 3.500 m |
| Altura plano útil | 0.000 m |
| Reflectancias techo/pared/suelo | 70 % / 50 % / 20 % |
| Factor de degradación (MF) | 0.80 (global) |
| Luminaria | LTS Licht & Leuchten FLIQ 400.3040.01_FLIQZ 400.24, 1×LED 650mA |
| Potencia por luminaria (P) | 26.0 W |
| Flujo por luminaria (Φ) | 2580 lm |
| Cantidad (N) | 4, en campo 2×2 (X: 2.108 m, Y: 1.788 m entre ejes) |

**Resultados reportados por DIALux:** Ē⊥ = 247 lx (≥200 requerido) · Uo =
0.41 (≥0.10 requerido) · Rug,max = 22 (≤23) · Consumo = 100 kWh/a (≤550
informativo) · Zona marginal = 0.123 m · Pesp = 4.51 W/m² (plano útil) /
3.62 W/m² (área).

### Cálculo teórico paso a paso

1.  Φtotal = 4 × 2580 = **10 320 lm**
2.  Ptotal = 4 × 26.0 = **104 W**
3.  Rendimiento lumínico = 2580/26 = **99.2 lm/W**
4.  h = 3.500 − 0.000 = **3.5 m**
5.  K: requiere L y W exactos del polígono del recinto — con las
    coordenadas de la disposición de luminarias se puede *estimar*
    L≈4.22 m, W≈3.58 m → K≈0.55, pero L×W≈15.08 m² no coincide con la
    Base declarada (14.36 m²), así que esta estimación es solo
    orientativa, no el dato real de entrada.
6.  UF: **retrocalculado** desde el resultado reportado (así se verifica
    la razonabilidad sin tener la tabla del fabricante a mano):
    UF = (Ē×A)/(Φtotal×MF) = (247×14.36)/(10320×0.80) ≈ **0.43**
    → esto es lo que hay que pedirle al ingeniero: confirmar en la ficha
    fotométrica de la FLIQ 400.3040.01 si 0.43 es razonable para K≈0.55
    y reflectancias 70/50/20.
7.  Comprobación: Ē = (10320×0.43×0.80)/14.36 ≈ **247 lx** ✓ (cierra por
    construcción, es la vuelta del cálculo anterior).
8.  Emin = Uo×Ē = 0.41×247 ≈ **101 lx**.
9.  Consumo: 104 W × horas/1000 = 100 kWh/a → horas de uso implícitas ≈
    **962 h/año**.
10. Zona marginal: aplicando la fórmula real del sistema
    ([roomLighting.ts:336](resources/js/pages/dialux/hooks/roomLighting.ts#L336))
    con la L,W *estimadas* del punto 5 (d=4.22, ratio 1.18<2 → d=largo),
    da p≈0.55 m y zona marginal≈0.26 m — **no coincide** con el 0.123 m
    reportado. Esto confirma que L,W estimadas del layout de luminarias
    no son las dimensiones reales del polígono del recinto; para
    reproducir el 0.123 m exacto hace falta el polígono real
    (`room.vertices`), no una inferencia.
11. Potencia específica: 104/14.36 = 7.24 W/m² por cálculo directo — no
    coincide con ninguno de los dos valores del reporte (4.51 / 3.62
    W/m²). Como nuestro sistema no implementa este campo (Parte B), no
    hay forma de contrastarlo internamente; queda como pregunta abierta
    para el ingeniero o para el glosario oficial de DIALux evo (Ayuda →
    Glosario → "Potencia específica de conexión").

### Qué llevarle al ingeniero de este caso

-   **Pedir cálculo, no solo opinión:** UF para K≈0.55 (con L,W reales,
    no estimadas) y reflectancias 70/50/20, según la ficha fotométrica
    de la FLIQ 400.3040.01 — comparar contra el 0.43 retrocalculado.
-   **Pedir criterio:** ¿es razonable Uo=0.41 y Rug,max=22 para un
    layout 2×2 con este espaciado y esta altura de montaje? (Esto no se
    recalcula a mano sin software; se evalúa con experiencia y tablas
    de fabricante.)
-   **Aclarar, no calcular:** qué área usa DIALux evo para "Potencia
    específica de conexión" — no es ni la Base ni una derivación simple
    de ella.

### Caso 2 — divergencia real Ē/Uo/Emin/UGR entre nuestro motor y DIALux evo

Para este mismo ambiente ("Ducha para mujeres"), el panel de resultados
en vivo del sistema (motor `direct-preview-v1`) da:

| Campo | Nuestro sistema | DIALux evo (Fuente 1) | Diferencia |
|---|---|---|---|
| Ē | 229 lx | 247 lx | ~7 % |
| Emin | 56 lx | ~101 lx (retrocalculado) | ~45 % |
| Uo | 0.242 | 0.41 | ~41 % |
| UGR | 17.8 | 22 | ~19 % |

Que Ē diverja poco pero Uo/Emin/UGR diverjan mucho **no es ruido
aleatorio ni un bug de fórmula** — está diagnosticado y documentado para
este mismo ambiente en una ronda anterior de este proyecto
([productionCalculationConfig.ts:139-171](resources/js/pages/dialux/domain/calculation/productionCalculationConfig.ts#L139-L171),
"Ronda 31, 2026-08-21, tercer proyecto real 'Módulo VII'"):

> El muro de "Ducha para mujeres" tiene una muesca de jamba (el hueco de
> una puerta real) pero el proyecto no tiene ningún objeto `Door`
> registrado ahí. `buildWallOcclusionBoxes` trata la muesca como pared
> 100 % sólida piso-a-techo (sin puerta que recortar el vano),
> oscureciendo esa esquina mucho más que la puerta real. Verificado en
> el mismo ambiente: **con oclusión desactivada, Uo pasó de 0.11 a 0.61
> y Emin de 33 a 224 lx** — el efecto es enorme y muy localizado, por
> eso Ē (promedio sobre toda la malla) casi no se mueve mientras
> Emin/Uo (dominados por el punto más oscuro) sí colapsan. El UGR bajo
> es la misma causa: el cálculo excluye luminarias ocluidas desde el
> observador, así que un muro "ciego" sin puerta hace que el motor vea
> menos luminarias de las que un observador real vería por el vano
> abierto, subestimando el deslumbramiento.

**Conclusión: no es un bug de cálculo, es dato de escena incompleto.**
Verificar en el editor si "Ducha para mujeres" tiene un objeto `Door`
colocado en el vano de la jamba (`wallId` apuntando a ese muro). La
teoría (Parte A) nunca puede detectar esto porque no modela geometría
de puertas; solo la ruta de simulación real (Parte B) lo revela — y
solo si los datos de entrada están completos.

---

## Parte D — Justificación de las fórmulas y decisiones usadas en el sistema

Para defender frente a un revisor externo por qué el sistema no siempre
usa la fórmula "de libro":

-   **Lúmenes requeridos con fórmula literal** (`(Área×Lux/Fm)×Fu`, no
    `/Fm/Fu`): decisión explícita confirmada por el ingeniero supervisor
    del proyecto el 2026-08-07, después de mostrarle que con Fm=Fu=0.8
    el resultado equivale a Área×Lux sin ningún factor de pérdida real.
    No es un error de transcripción de la fórmula clásica — fue
    evaluada y descartada antes en este mismo proyecto.
-   **UGR con aproximación analítica de Guth** en vez de tabla
    certificada de fabricante: se usa el ajuste polinómico atribuido a
    Guth/IESNA (misma base experimental que CIE 117:1995), evaluado en
    el peor observador. Cuando la geometría cae fuera del rango de
    validez del índice de posición de Guth (H/R>2), el sistema permite
    un override manual (`Room.manualUgr`) en vez de forzar un cálculo
    fuera de rango.
-   **Zona marginal con la fórmula real de EN 12464-1:2021** (no un 5 %
    fijo sin fuente, que se usaba antes): reproduce los valores
    pequeños y no redondos que reporta DIALux evo (0.135/0.201/0.209 m
    en verificaciones reales), fuente resumida en Fagerhult "Number of
    calculation points" (verificado 2026-08-06).
-   **Interreflexión first-bounce / iterativa automática según forma**:
    activa un solver ya existente sin ser disruptivo — cambia solo el
    valor por defecto, decisión verificada contra un proyecto de
    referencia (Módulo 22).
-   **Reflectancias**: solo se aceptan valores citados de CIE 117-1995 o
    marcados explícitamente como "estimación no normativa" — nunca un
    número inventado sin marcar su procedencia.
-   **Consumo anual**: es puramente informativo, sin límite normativo
    fabricado — se corrigió un bug donde el "máx. kWh/a" mostrado era en
    realidad el lux normativo relabeleado.

---

## Parte E — Procedimiento general y repetible para Ē (Fase 1)

La Parte C resuelve un caso puntual (un ambiente, un número). Esta parte
generaliza ese mismo procedimiento para poder aplicarlo, ambiente por
ambiente, a **todo el proyecto** — empezando solo por Ē (iluminancia
media), que es lo único de la Parte A totalmente reproducible sin
software. Emin/Uo, UGR, zona marginal exacta y potencia específica
quedan para fases posteriores (necesitan malla punto a punto, Guth, o
el polígono real del recinto — ver Partes A y B); no se calculan en esta
fase para no mezclar un número aproximado de mano con uno que requiere
simulación.

### Qué dato se usa y de dónde sale exactamente

| Dato | Fuente en el sistema | Nota |
|---|---|---|
| Área (m²) | Polígono del ambiente ya calibrado (Parte G) | No usar el área "a ojo"; confirmar que el plano de ese ambiente esté calibrado con medida real. |
| N y Φluminaria (lm) | Columna "LM/foco" del panel de resultados (detectado del catálogo de la luminaria) | Ya viene del fabricante, no hace falta pedirlo aparte. |
| P (W) | Ficha de catálogo de la luminaria | Para consumo y potencia específica (fases posteriores). |
| Reflectancias techo/pared/suelo | Material asignado al ambiente (biblioteca de materiales), `ceilingReflectance`/`wallReflectance`/`floorReflectance` ([runDirectPreviewEngineAdapters.ts:25-36](resources/js/pages/dialux/domain/calculation/runDirectPreviewEngineAdapters.ts#L25-L36)) | **Si el ambiente no tiene material asignado, el motor usa 0 (sin rebote alguno)** — verificar esto ANTES de calcular, porque un UF retrocalculado sobre un ambiente sin material asignado no va a significar nada real. |
| Factor de mantenimiento (MF) | Configuración global del proyecto (0.80 por defecto) | Ver Parte A, punto 7, sobre la simplificación frente a la descomposición completa de CIE 97:2005. |
| Norma (lux) | Aplicación/actividad asignada al ambiente | Para comparar el Ē resultante contra el mínimo exigido. |

### Procedimiento (repetir por cada ambiente)

1.  Φtotal = N × Φluminaria
2.  UF: buscar en la tabla del fabricante para K (si se tiene L,W reales)
    y las reflectancias reales del material asignado. Si no hay tabla a
    mano, se puede retrocalcular desde un Ē de referencia conocido
    (DIALux u otro), pero ese UF queda marcado explícitamente como
    **"estimado por retrocálculo, pendiente de confirmar con ficha del
    fabricante"** — nunca como un valor definitivo (mismo criterio que
    ya exige el proyecto para reflectancias no citadas, Parte D).
3.  Ē = (Φtotal × UF × MF) / Área
4.  Comparar Ē contra la norma del ambiente → Conforme / No conforme.

### Plantilla para llenar ambiente por ambiente

| Ambiente | N | Φluminaria | Área | UF (fuente) | MF | Ē calculado | Norma | Estado |
|---|---|---|---|---|---|---|---|---|
| Ducha para mujeres | 4 | 2580 lm | 14.3598 m² | 0.43 (retrocalculado, pendiente confirmar) | 0.80 | ≈247 lx | 200 lx | Conforme |
| … | | | | | | | | |

Cuando se complete esta fase para todos los ambientes del proyecto, se
avanza a la siguiente (Emin/Uo por malla real, o UGR) documentándola con
el mismo formato de evidencia que esta y que la Parte D.

### Dato real de UF encontrado en el archivo LDT oficial (y su límite)

El archivo fotométrico real de esta luminaria
(`60739.ldt`, carpeta oficial del catálogo: *"3. 26w - 2580 lm - SEGUN
PLANO"*) **sí contiene** un dato relacionado con UF que el sitio web del
fabricante no publica: el campo estándar EULUMDAT **DR (Direct Ratio)**,
líneas 33-42 del archivo — 10 valores para los índices de local
estándar K = 0.6, 0.8, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0
(metodología DIN 5040-3 / LiTG 3.5):

| K | 0.6 | 0.8 | 1.0 | 1.25 | 1.5 | 2.0 | 2.5 | 3.0 | 4.0 | 5.0 |
|---|---|---|---|---|---|---|---|---|---|---|
| DR | 0.45 | 0.54 | 0.61 | 0.69 | 0.74 | 0.79 | 0.84 | 0.87 | 0.90 | 0.92 |

Para K≈0.55 (nuestra estimación, Parte C) el valor más cercano es
**DR=0.45 (K=0.6)**.

**Por qué esto NO se puede sustituir directo como UF en la fórmula**:
probando Ē = (Φtotal×DR×MF)/Área = (10320×0.45×0.80)/14.3598 ≈ **258.75
lx** — un resultado **mayor** que los dos resultados simulados reales
(247 lx DIALux, 229 lx nuestro sistema). Eso es físicamente al revés de
lo esperado: si DR es solo la componente directa (sin rebote de
paredes/techo), el UF completo (que sí incluye rebote) debería ser
**mayor o igual** que DR, nunca menor — así que un Ē basado en DR
debería salir **por debajo**, no por encima, del Ē real. Esta
inconsistencia es evidencia de que **DR no es intercambiable con UF**
en la fórmula simple del método de flujo: DIN 5040-3/LiTG 3.5 define un
procedimiento propio para combinar DR con las reflectancias reales del
recinto y obtener el UF final, y ese procedimiento no está descrito en
ninguna fuente de acceso libre que haya podido verificar (el estándar
DIN 5040-3 es de pago). No voy a inventar esa fórmula.

**Conclusión honesta**: el archivo LDT real sí trae un dato oficial y
verificable (DR por K) que antes no sabíamos que existía — corrige lo
dicho anteriormente en este documento sobre que "no hay dato del
fabricante". Pero convertir ese DR en un UF completo, con el rigor de
la norma que lo define, requiere el texto de DIN 5040-3 (de pago) o una
herramienta que ya implemente esa conversión (ej. *EulumdatTools*, que
según su propia documentación exporta "tablas UF según LiTG 3.5
directamente desde archivos EULUMDAT" con reflectancias
seleccionables). Sin eso, el UF retrocalculado (0.40-0.43, tabla de
arriba) sigue siendo el número más defendible que tenemos — ahora con
el DR real como referencia de sanity-check (0.45 en K=0.6, del mismo
orden de magnitud que el UF retrocalculado, lo cual es razonable).

### Flujo zonal real (integrado a mano de la curva de intensidad real) y una advertencia sobre fórmulas de terceros

Verificación independiente: se integró numéricamente la curva de
intensidad real del archivo (líneas 117-153 de `60739.ldt`, candela cada
2.5° de γ=0° a 90°) con el método de flujo zonal
`Φ(0,γ) = 2π ∫₀^γ I(γ')·sin(γ') dγ'` (regla del trapecio). La integral
total da ≈999.2 de 1000 (la base de normalización EULUMDAT), lo que
valida la lectura del archivo:

| Cono (0°–γ) | % del flujo total hacia abajo |
|---|---|
| 0-20° | 22.1 % |
| 0-30° | 43.7 % |
| 0-40° | 64.6 % |
| 0-60° | 90.5 % |
| 0-90° | 100 % |

**Advertencia (verificada en esta ronda):** una consulta a otro
asistente de IA sobre esta misma luminaria devolvió una fórmula
("`UF=(K/(K+0.4))×0.85×0.71`", con un supuesto "CIE Flux Code: 58 87 97
100 100") presentada como si viniera de CIBSE/CIE 52. **El flujo zonal
real calculado arriba no coincide con ese "58 87 97 100 100"**, lo que
indica que esos números no salieron de este archivo — con alta
probabilidad fueron inventados o genéricos, ajustados para acercarse al
0.43 ya retrocalculado en este documento (coincidencia sospechosa, no
evidencia de que la fórmula sea real). **No usar esa fórmula ni citarla
frente al ingeniero como si fuera de una norma** — no se pudo verificar
y la evidencia propia la contradice. El flujo zonal de la tabla de
arriba sí es reproducible por cualquiera con el mismo archivo LDT y el
mismo método, a diferencia de la fórmula descartada.

---

## Parte F — Comparación con DIALux y criterio de aceptación

Comparar, campo por campo:

-   Flujo total, UF, MF → método de flujo (Parte A) vs retrocálculo
    desde el reporte.
-   Ē, Emin, Uo → simulación punto a punto (Parte B) vs reporte DIALux;
    tolerancia sugerida ±10-15 % entre método tabular manual y cálculo
    punto a punto real (ambos métodos válidos, pero de distinta
    resolución).
-   UGR → método de Guth propio (Parte B) vs UGR nativo de DIALux evo;
    **no se espera coincidencia exacta** (metodologías internas
    distintas aunque compartan base experimental) — solo mismo orden de
    magnitud y mismo veredicto de cumplimiento.
-   W/m², kWh/año → no calculado por nuestro sistema (Parte B); se
    reporta tal cual sale de DIALux, sin verificación interna.

La diferencia entre teoría y DIALux se debe principalmente a que DIALux
(y la ruta de simulación de nuestro sistema) calcula la distribución
real de la luz usando la fotometría real de la luminaria, mientras que
el método de flujo manual (Parte A) usa un UF promediado de tabla.

---

## Parte G — Metodología de escalado: por qué L y W no son "al ojo"

Punto recurrente al presentar este documento: el método de flujo (Parte
A, punto 1) exige L y W del recinto por separado, no solo el área. Si el
ingeniero pregunta de dónde salen esas dimensiones, la respuesta no es
"se estimaron" — el sistema deriva la escala de una **medida real
conocida**, no de una lectura visual del plano
([calibration.ts](resources/js/pages/dialux/geometry/calibration.ts)):

```
factorEscala  = distanciaReal / distanciaMedida      (lineal)
áreaCorregida = áreaMedida × factorEscala²            (cuadrática)
```

El usuario mide sobre el plano importado una distancia cuyo valor real
conoce (p. ej. el ancho de una puerta, un muro medido en obra), la
introduce en metros, y ese factor se aplica de forma **uniforme a todo
el plano calibrado** — no se recalcula por ambiente ni se ajusta a ojo.
Esto es lo que hay que decirle al ingeniero en vez de "no tengo el
ancho y el alto":

> "El ancho y el alto de cada ambiente salen de la geometría del plano
> importado, calibrada con una distancia real conocida — no son una
> estimación visual. Puedo mostrarle qué medida se usó para calibrar
> este plano."

**Causa más probable si "un ambiente sale grande y otro pequeño":** no
es que el sistema sea inconsistente — es que hay más de un plano/origen
CAD en el mismo proyecto (p. ej. un DXF importado por piso) y cada uno
necesita **su propia calibración**. Un factor de escala calibrado en un
plano no se traslada automáticamente a otro plano distinto insertado en
el mismo proyecto. Antes de comparar K/zona marginal de un ambiente
puntual contra DIALux, confirma que el plano de ese ambiente específico
fue calibrado con una medida real (no heredó una escala por defecto o
la heurística de `$INSUNITS`/extents, que es la de menor confianza según
el propio comentario del archivo).

---

## Parte H — Hoja de cálculo manual consolidada (lista para compartir)

Todo lo de las Partes A-G en una sola hoja, con las fórmulas y los datos
ya verificados — sin números sin fuente, sin fórmulas de terceros sin
confirmar. Caso: "Ducha para mujeres", LTS FLIQ 400.3040.01_FLIQZ 400.24.

**Nota de completitud (previa a esta hoja):** el bug de escalado de
candela que motivó la Parte anterior (cd/1000lm mostrado en vez de cd
absoluto) estaba en 3 funciones **genéricas y compartidas**
(`buildPolarSvgFromMatrix.ts`, `buildCartesianSvgFromMatrix.ts`,
`ProductImportService::buildPolarSvg()`), no en algo específico de esta
luminaria — corregido y verificado (`tsc`, `vitest`, `php artisan test`)
en esta misma ronda. Como el fix vive en el código compartido, aplica al
100 % de las luminarias del catálogo, no solo a la FLIQ. El parser real
(`ProductImportService::parseLdt()`, fuente de verdad para el motor de
cálculo) y el archivo de benchmarks (`realPhotometry.ts`) ya tenían la
conversión correcta desde 2026-08-18 — el bug nunca afectó Ē/Emin/Uo de
ningún proyecto, solo la vista de comparación del catálogo.

### Datos de entrada (todos con fuente)

| Dato | Valor | Fuente |
|---|---|---|
| N | 4 | disposición 2×2 en el reporte |
| Φluminaria | 2580 lm | LDT real (`60739.ldt`, línea 29) |
| P | 26.0 W | LDT real y ficha del fabricante |
| Área | 14.3598 m² | polígono calibrado (Parte G) |
| Reflectancias | 70 / 50 / 20 % | material asignado al ambiente |
| MF | 0.80 | configuración global del proyecto |
| Norma | 200 lx (Baño) | aplicación asignada al ambiente |

### Cadena de fórmulas con sustitución

| # | Fórmula | Sustitución | Resultado |
|---|---|---|---|
| 1 | Φtotal = N·Φluminaria | 4 × 2580 | **10 320 lm** |
| 2 | Ptotal = N·P | 4 × 26.0 | **104 W** |
| 3 | Rendimiento = Φ/P | 2580/26 | **99.2 lm/W** |
| 4 | Flujo zonal (0-30°) | integración real del LDT | **43.7 %** del flujo hacia abajo |
| 5 | DR (K=0.6, EULUMDAT oficial) | tabla del LDT | **0.45** — componente directa, no UF completo |
| 6 | UF (retrocalculado, DIALux) | (Ē×A)/(Φtotal×MF) = (247×14.3598)/(10320×0.80) | **0.430** |
| 7 | UF (retrocalculado, nuestro sistema) | (229×14.3598)/(10320×0.80) | **0.398** |
| 8 | **Ē = (Φtotal·UF·MF)/Área** | (10320×0.430×0.80)/14.3598 | **≈247 lx** ✓ |
| 9 | Emin = Uo·Ē | 0.41×247 | **≈101 lx** |
| 10 | Consumo | Ptotal×horas/1000 = 100 kWh/a | horas de uso ≈ **962 h/año** |

### Qué es exacto, qué es aproximado — para no presentar uno como el otro

-   **Exacto, con fuente verificable:** Φtotal, Ptotal, rendimiento
    lumínico, flujo zonal (líneas 6-9 de esta hoja), DR de tabla oficial.
-   **Aproximado y declarado como tal:** UF (retrocalculado de una
    simulación real, no de una tabla del fabricante — DIN 5040-3 que
    definiría la conversión DR→UF es un estándar de pago, no se pudo
    verificar). No presentar 0.43/0.40 como "el UF de catálogo".
-   **Descartado, no citar:** la fórmula `UF=(K/(K+0.4))×0.85×0.71` y el
    "CIE Flux Code 58 87 97 100 100" de un tercero — contradichos por el
    flujo zonal real calculado en la Parte E.

### Para el ingeniero, en una frase

"Ē se calcula con el método de flujo estándar (fila 8); el único dato
sin tabla de fabricante es UF, que aquí viene retrocalculado de una
simulación real (filas 6-7) porque esta luminaria LED no publica tabla
UF impresa — solo el LDT crudo, que si integra el flujo zonal (fila 4)
de forma consistente con el DR oficial (fila 5)."
