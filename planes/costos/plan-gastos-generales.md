# Plan de Automatización — "GASTOS_GENERALES.xls" (8 hojas)

> Fuente: `GASTOS_GENERALES.xls` (formato binario antiguo, convertido a `.xlsx` para el análisis).
> Autor original: CTAR HUANUCO / CONSULTORIA CONSTRUYE. Proyecto de ejemplo: "MEJORAMIENTO DE LOS
> SERVICIOS DE EDUCACION INICIAL Y PRIMARIA DE LA I.E.I.P. Nº64193 CONTAMANA".
> Objetivo: desagregar **todas** las fórmulas de las 8 hojas, identificar de dónde se capturan
> los datos, no cambiar la lógica de negocio, y dejar un plan de codificación en React +
> TypeScript con estructura `components/`, `hooks/`, `types/`, que puedas comprobar contra tu
> sistema ya construido.

---

## 1. Resumen ejecutivo y relación con "cronograma valorizado"

Este workbook **no es independiente**: es el **motor de cálculo detallado** que produce los
porcentajes y montos que, en el otro Excel que ya estudiamos ("cronograma valorizado"), aparecían
como simples inputs planos (`D29=10%` Gastos Generales, `D30=10%` Utilidad, `D36=3.6%`
Financiamiento de supervisión, `D44=0.5%` Control Concurrente). Aquí, en cambio, cada uno de esos
porcentajes se **construye de abajo hacia arriba** a partir de partidas reales (sueldos, fianzas,
seguros, pólizas, alquileres, etc.).

Las 8 hojas y su rol:

| Hoja | Rol | Alimenta a |
|---|---|---|
| **CONSOLIDADO** | Hoja maestra: arma el presupuesto final (Costo Directo + Gastos Generales + Utilidad + IGV + Componentes II/III + Supervisión + Control Concurrente) | Es el resultado final del workbook |
| **G GENERALES** | Desagregado de Gastos Generales Fijos + Variables (sueldos de obra, fianzas, seguros, equipamiento, etc.) | `CONSOLIDADO!G20`, `G23` |
| **GG. FIJOS** | Cálculo financiero detrás de las fianzas y seguros (interés, TEA, días de vigencia) | `G GENERALES` (columna J, varias filas) |
| **SUPERVISION** | Presupuesto de la supervisión de obra (sueldos + gastos generales de supervisión + utilidad + IGV) | `CONSOLIDADO!F59` |
| **GG SUPER** | Desagregado de Gastos Generales de la Supervisión (sueldos sede central, oficina, movilidad) | `SUPERVISION!G39` |
| **Remuneracion** | Costo real de planilla por trabajador (beneficios sociales: essalud, CTS, vacaciones, gratificación) | `G GENERALES` (columna J, filas 61-65) |
| **PLAN COVID** | Réplica de la estructura de "G GENERALES" pero para el Componente III (Plan Covid-19) | **Hoja inactiva** — no está conectada a `CONSOLIDADO` (ver hallazgo 5.3) |
| **CONTROL CONCURRENTE** | Justificación bottom-up del costo real de Control Concurrente, comparado contra el tope legal de 0.6% | Ninguna celda de `CONSOLIDADO` la referencia (ver hallazgo 5.5) |

---

## 2. Mapa de dependencias entre hojas

```
GG. FIJOS ──┐
            ├──► G GENERALES ──► CONSOLIDADO (hoja maestra)
Remuneracion┘

GG SUPER ──► SUPERVISION ──► CONSOLIDADO!F59

PLAN COVID ──► (nada, hoja desconectada)

CONTROL CONCURRENTE ──► (nada, hoja desconectada — solo referencia a CONSOLIDADO!F60, no al revés)
```

**Orden de cálculo que debe respetar el motor TypeScript** (para que cada hoja tenga sus
dependencias resueltas antes de calcularse):

1. `Remuneracion` (depende solo de `G GENERALES` filas 46-59, que son datos de planilla, no de
   totales — ver nota en sección 3.5 sobre la dependencia circular aparente)
2. `GG. FIJOS` (depende de `CONSOLIDADO` para Costo Directo/Duración, y de `G GENERALES` para el
   total de planilla vía `L44`/`C50`)
3. `G GENERALES` (depende de `GG. FIJOS` y `Remuneracion`)
4. `GG SUPER` (independiente, solo depende de `CONSOLIDADO!F58`)
5. `SUPERVISION` (depende de `GG SUPER`)
6. `CONSOLIDADO` (depende de `G GENERALES` y `SUPERVISION`)

> **Dependencia circular aparente (Remuneracion ↔ G GENERALES):** `Remuneracion` lee de
> `'G GENERALES'!D46:J59` (datos de planilla: meses, participación, precio) y `G GENERALES` lee de
> `Remuneracion!G23:K23` (beneficios sociales totalizados). **No es circular en realidad**: son dos
> franjas de columnas distintas de la misma tabla de staff — `G GENERALES` escribe los datos base
> del trabajador (columnas D-J, filas 46-59) y `Remuneracion` los **lee** para calcular beneficios,
> que luego `G GENERALES` vuelve a leer (columnas 61-65) como una sección **distinta**. Para el
> modelo de datos nuevo, esto se resuelve limpio: **una sola fuente de verdad "Staff" (lista de
> trabajadores con sus datos base), de la cual tanto el costo bruto (G GENERALES) como los
> beneficios sociales (Remuneracion) se derivan como funciones puras** — eliminando la necesidad de
> "ir y volver" entre dos hojas.

### 2.1 Matriz completa de vínculos entre hojas (todas las referencias cruzadas, celda por celda)

Esta tabla es el inventario exhaustivo de **cada** fórmula que cruza de una hoja a otra en el
workbook. Úsala como checklist de auditoría: si tu sistema web ya reproduce cada fila de esta
tabla, la interconexión entre hojas está completa.

| Hoja origen (de donde sale el dato) | Celda origen | Hoja/celda destino (quién la consume) | Qué representa |
|---|---|---|---|
| CONSOLIDADO | `B7,D8,D9,D10,D11,G11,D12,G12,H4` | G GENERALES `C4,D5,D6,D7,D8,J8,D9,K9` (+ mismo patrón en SUPERVISION, GG SUPER, Remuneracion, PLAN COVID, CONTROL CONCURRENTE) | Cabecera del proyecto (nombre, unidad ejecutora, códigos, ubicación, fecha, plazo) — se repite igual en las 6 hojas hijas |
| CONSOLIDADO | `F44` (Costo Directo) | G GENERALES `D11` · GG. FIJOS `C5` · PLAN COVID `E8` | Base para calcular % de Gastos Generales |
| CONSOLIDADO | `F46` (Utilidad) | GG. FIJOS `C8` | Componente del "Subtotal sin IGV" que arma el Monto a Garantizar |
| CONSOLIDADO | `F45` (Gastos Generales) | PLAN COVID `E9` | Solo informativo/comparación en PLAN COVID |
| CONSOLIDADO | `F53` (Componente III, hoy=0) | PLAN COVID `G85` | Base del % de GG del Plan Covid — **hoy NO lee de PLAN COVID, es al revés y está en 0** (hallazgo 5.3) |
| CONSOLIDADO | `F58` (Presupuesto Obra I+II) | SUPERVISION `B10` · GG SUPER `B8` · SUPERVISION `G44` (denominador del %) | Base para reportar Supervisión como % del presupuesto de obra |
| CONSOLIDADO | `F60` (Total) | CONTROL CONCURRENTE `C8` | Base del tope de 0.6% |
| CONSOLIDADO | `G20` | GG. FIJOS `R14` (comparación) | GGF real, comparado contra el GGF estimado (`Q14`) |
| CONSOLIDADO | `H23` | GG. FIJOS `R15` (comparación) | GGV real, comparado contra el GGV estimado (`Q15`) |
| **G GENERALES** | `K39` (Total Gastos Fijos) | CONSOLIDADO `G20` | Alimenta el bloque "Resumen de Análisis de GG" |
| **G GENERALES** | `K99` (Total Gastos Variables) | CONSOLIDADO `G23` | Ídem, para Variables |
| **G GENERALES** | `M36` | GG. FIJOS `L59` (referenciada pero sin consumidor aguas abajo) | Ver hallazgo 4, celda huérfana |
| **G GENERALES** | `D46:J59` (datos base de cada trabajador, filas 46-59) | Remuneracion `A9:E21` (una fila de Remuneracion por cada fila de G GENERALES) | Fuente de datos de personal para calcular beneficios sociales |
| **GG. FIJOS** | `H16` | G GENERALES `J25` | Costo Fianza Fiel Cumplimiento |
| **GG. FIJOS** | `I26` (suma tramos fianza efectivo) | G GENERALES `J26` | Costo Fianza Adelanto Efectivo |
| **GG. FIJOS** | `I35` (suma tramos fianza materiales) | G GENERALES `J27` | Costo Fianza Adelanto Materiales |
| **GG. FIJOS** | `SUM(I22:I25)` | G GENERALES `J87` | Costo de renovación de la fianza de adelanto efectivo |
| **GG. FIJOS** | `SUM(I31:I34)` | G GENERALES `J88` | Costo de renovación de la fianza de adelanto materiales |
| **GG. FIJOS** | `G39` | G GENERALES `J30` | Costo Póliza CAR (Todo Riesgo) |
| **GG. FIJOS** | `G46` (SCTR salud+pensión) | G GENERALES `J32` | Costo Póliza SCTR Admin/Control de Obra |
| **GG. FIJOS** | `B50`, `E50` | G GENERALES `D33` (label dinámico), `J33` | Descripción y costo de Póliza ESSALUD+Vida |
| **GG. FIJOS** | `E55` | G GENERALES `J35` | Costo Sencico |
| **GG. FIJOS** | `B60`, `E60` | G GENERALES `D36` (label dinámico), `J36` | Descripción y costo de Impuestos ITF |
| **Remuneracion** | `G23,H23,I23,J23,K23` (totales SUMPRODUCT: Asig.Familiar, ESSALUD, CTS, Vacaciones, Gratificación) | G GENERALES `J61,J62,J63,J64,J65` | Beneficios sociales totalizados de toda la planilla |
| **G GENERALES** | `K46:K65` | GG. FIJOS `L44` | Base para el cálculo de SCTR (Salud+Pensión) |
| **G GENERALES** | `K41:K60` | GG. FIJOS `C50` | Base para el cálculo de Póliza ESSALUD+Vida — ⚠ rango distinto al anterior, ver hallazgo 5.2 |
| **GG SUPER** | `G25` (Total GG Supervisión) | SUPERVISION `G39` | Gastos Generales de la etapa de Supervisión |
| **SUPERVISION** | `G43` (Total con IGV) | CONSOLIDADO `F59` y también `G32` (bloque Resumen de Análisis) | Costo final de Supervisión y Liquidación — dos celdas de CONSOLIDADO leen el mismo valor |
| — | `[1]Resumen!G101` | GG. FIJOS `P70` | **Enlace a archivo externo roto**, no conectado a nada más (hallazgo 5.7) |

> Fuera de esta matriz no hay más cruces entre hojas: **PLAN COVID** y **CONTROL CONCURRENTE** solo
> reciben datos de `CONSOLIDADO` (cabecera + un total cada una) pero **ninguna fórmula del resto
> del workbook lee de vuelta desde ellas** — están documentadas como hojas de apoyo/justificación,
> no como parte de la cascada de cálculo activa (hallazgos 5.3 y 5.5).



---

## 3. Fórmulas desagregadas por hoja

### 3.1 CONSOLIDADO

**Cabecera (inputs de proyecto):** `B7` proyecto, `D8` unidad ejecutora, `D9` código único, `D10`
institución educativa, `D11` código local, `G11` código modular, `D12` ubicación, `G12` fecha,
`H4` días calendario de ejecución (**input numérico directo**).

**Costo Directo (filas 39-44) — 5 componentes de obra, todos hardcodeados como número (inputs):**
```
F39 = 2309201.64   (Obras provisionales, trabajos preliminares, seguridad, PMA)
F40 = 6212248.54   (Estructuras)
F41 = 2899648.74   (Arquitectura, evacuación y señalización)
F42 = 311402.11    (Instalaciones sanitarias)
F43 = 1034361.32   (Instalaciones eléctricas y comunicaciones)
F44 = ROUND(SUM(F39:F43), 2)     -> COSTO DIRECTO TOTAL
```
> Columnas `I39:I43` (`=Fx*1.1669`) y `J39:J43` (`=Fx*0.1669`) son cálculos sueltos con
> multiplicadores sin etiqueta ni uso posterior — **no son consumidos por ninguna otra fórmula**.
> Se documentan como legado; no portar salvo que el negocio confirme su propósito.

**Resumen de Análisis de Gastos Generales (filas 18-26) — trae los totales de "G GENERALES":**
```
G20 = 'G GENERALES'!K39      -> Total Gastos Generales FIJOS
H20 = G20 * F20 (F20=1)      -> Valor Total (Glb. × 1)
G23 = 'G GENERALES'!K99      -> Total Gastos Generales VARIABLES
H23 = G23 * F23 (F23=1)
H26 = SUM(H20:H25)           -> TOTAL DE GASTOS GENERALES
```

**Resumen de Análisis de Gastos de Supervisión (filas 30-34):**
```
G32 = SUPERVISION!G43        -> Total de Supervisión (con IGV)
H32 = ROUND(G32*F32, 2)      (F32=1)
H34 = SUM(H32:H33)           -> TOTAL DE GASTOS DE SUPERVISIÓN
```

**Cascada del presupuesto — Componente I (filas 44-49):**
```
F44 = COSTO DIRECTO (ver arriba)
F45 = H26                              -> Gastos Generales (del bloque 18-26)
G45 = F45 / F44                        -> % GG sobre CD
F46 = ROUND(F44 * G46, 2)              -> Utilidad; G46 = 5% (input)
F47 = ROUND(SUM(F44:F46), 2)           -> SUB TOTAL PRESUPUESTO
F48 = ROUND(F47 * 0.18, 2)             -> IGV (18%, hardcode dentro de la fórmula)
F49 = ROUND(SUM(F47:F48), 2)           -> SUB TOTAL PRESUPUESTO COMPONENTE I
```

**Componente II — Mobiliario y Equipamiento (filas 50-52), sin desagregado propio:**
```
F50 = 667586          (input directo, no hay hoja de detalle para este componente)
F51 = ROUND(F50*0.18, 2)
F52 = ROUND(SUM(F50:F51), 2)
```

**Componente III — Plan Prevención y Control Covid-19 (filas 53-57), INACTIVO:**
```
F53 = 0    (input directo)
F54 = 0    (input directo)
F55 = ROUND(SUM(F53:F54), 2)
F56 = ROUND(F55*0.18, 2)
F57 = ROUND(SUM(F55:F56), 2)
```
> Ver hallazgo 5.3: existe la hoja `PLAN COVID` con todo un desagregado calculado, pero
> `CONSOLIDADO!F53` y `F54` **no la referencian** — están hardcodeados en 0. Es un componente
> "apagado".

**Totales finales (filas 58-64):**
```
F58 = ROUND(F49 + F52 + F57, 2)        -> TOTAL PPTO OBRA COMPONENTE I+II (+III si se activa)
F59 = SUPERVISION!G43                   -> Gastos de Supervisión y Liquidación
G59 = F59 / F58
F60 = SUM(F58:F59)                      -> TOTAL (fila resaltada en amarillo)
C61 = "SON: " & conviertenumletra(F60)  -> monto en letras (función VBA custom, ver hallazgo 5.6)
F62 = F60 * 0.6%                        -> Control Concurrente (tope legal plano, ver hallazgo 5.5)
F63 = F62 + F60                         -> TOTAL DE INVERSIÓN PARA LA OBRA
C64 = "SON: " & conviertenumletra(F63)
```

**Columna "M" — verificación manual paralela (filas 44-60), con un `#REF!` roto:**
```
M44 = F44                                   (Costo Directo, copiado)
M45 = ROUND(0.1269 * M44, 2)                -> GG asumido al 12.69% (flat, no del detalle real)
M46 = ROUND(0.05 * M44, 2)                  -> Utilidad al 5%
M47 = M46 + M45 + M44
N47 = F47 - M47                             -> diferencia real vs. supuesto flat (columna de control)
M48 = ROUND(0.18 * M47, 2)                  -> IGV
M49 = M48 + M47
M50 = 474015                                (input suelto, Componente II a valor fijo distinto de F50)
M52 = ROUND(M50 + M51, 2)
M53..M57 = réplica del bloque Componente III con columnas K/L/M en vez de D/E/F
M58 = ROUND(M49 + #REF! + M50, 2)           -> FÓRMULA ROTA (referencia eliminada)
M59 = ROUND(M58 * 0.0445, 2)                -> Supervisión asumida al 4.45% flat
M60 = ROUND(M58 + M59, 2)
N60 = F60 - M60                             -> diferencia final real vs. supuesto flat
```
> **Este bloque M/N es exactamente el mismo patrón de "verificación con supuestos planos" que ya
> vimos en el otro Excel (columnas V/X/Z).** Aquí compara el cálculo real y detallado (columna F)
> contra un cálculo rápido con porcentajes fijos asumidos (columna M: 12.69% GG, 5% Utilidad,
> 4.45% Supervisión) para detectar si el presupuesto se está desviando mucho de esos supuestos
> típicos. **No portar la fórmula rota de M58**; si se replica este bloque de verificación, debe
> hacerse con una función de comparación explícita (ver sección 8), no con celdas encadenadas.

---

### 3.2 G GENERALES

**Cabecera:** trae del `CONSOLIDADO` (proyecto, unidad ejecutora, etc.) — mismo patrón que ya
documentamos en el Excel anterior.

```
D11 = CONSOLIDADO!F44                  -> Costo Directo
D12 = F101                             -> Gastos Generales total (fijos+variables)
E12 = D12 / D11                        -> % GG sobre CD
F16 = K39 + K99                        -> Fijos + Variables (mismo valor que D12/F101, redundante)
F17 = 6                                -> Plazo de ejecución en MESES (input; ver hallazgo 5.1)
```

**I) GASTOS GENERALES FIJOS (filas 19-39) — 3 sub-bloques, todos con `Cantidad(I) × Costo(J) = K`:**

| Código | Concepto | Fuente del Costo Unitario (J) |
|---|---|---|
| 01.01.00 | Fianza Fiel Cumplimiento | `'GG. FIJOS'!H16` |
| | Fianza Adelanto Efectivo | `'GG. FIJOS'!I26` |
| | Fianza Adelanto Materiales | `'GG. FIJOS'!I35` |
| 01.02.00 | Póliza CAR (Todo Riesgo) | `'GG. FIJOS'!G39` |
| | Ensayo de compresión de testigos | Hardcode: `I31=25`, `J31=44` |
| | Póliza SCTR Admin/Control de Obra | `'GG. FIJOS'!G46` |
| | (label dinámico) Póliza ESSALUD+Vida | `'GG. FIJOS'!E50` |
| 01.03.00 | Sencico (0.20% del ppto) | `'GG. FIJOS'!E55` |
| | (label dinámico) Impuestos ITF | `'GG. FIJOS'!E60` |

```
K39 = ROUND(SUM(K22:K37), 2)          -> TOTAL GASTOS FIJOS
```

**II) GASTOS GENERALES VARIABLES (filas 41-99):**

- **02.01.00 Gastos de Administración en Obra — Sueldos y beneficios (46-59):** 13 roles de
  personal técnico-administrativo. Fórmula uniforme: `K = PRODUCT(G:J)` = Cantidad(G, casi
  siempre 1) × Meses(H) × Participación%(I) × Precio(J). Cada fila tiene sus propios valores de
  meses/participación/precio (ej. Ingeniero Residente: 15 meses, 100% participación, S/10,000;
  Especialista Estructuras: 9 meses, 50%, S/8,000).
- **02.01.00 Pago de Beneficios Sociales (60-65):**
  ```
  F60 = ROUND(SUM(K61:K65) / SUM(K46:K59), 2)   -> % beneficios sobre sueldos base (informativo)
  K61 = PRODUCT(G61:J61); J61 = Remuneracion!G23    -> Asignación Familiar
  K62 = PRODUCT(G62:J62); J62 = Remuneracion!H23    -> ESSALUD
  K63 = PRODUCT(G63:J63); J63 = Remuneracion!I23    -> CTS
  K64 = PRODUCT(G64:J64); J64 = Remuneracion!J23    -> Vacaciones
  K65 = PRODUCT(G65:J65); J65 = Remuneracion!K23    -> Gratificación
  ```
- **02.02.00 Equipamiento y Mobiliario (67-72):** útiles de oficina, computadoras, mobiliario,
  equipo de laboratorio (concreto y suelos). `K = J*I*H` (mismo producto, orden de factores varía
  entre filas pero es conmutativo).
- **02.02.00 Ensayos y pruebas de calidad (74-76):** diseño de mezclas, pruebas estructuras
  metálicas, roturas de probeta. La última (`K76 = H76*I76*J76*G76`) incluye un 4° factor `G76=60`
  (cantidad de roturas) que las otras dos no tienen — patrón no uniforme, respetar por fila.
- **02.02.00 Alquileres, servicios, equipos oficina y comunicaciones (78-81):** alquiler oficina,
  alojamiento, comunicación, grupo electrógeno (este último con `J81=0.5`, 50% participación).
- **02.05.00 Vehículos (83-84):** camioneta pick up 4x4.
- **02.07.00 Gastos Financieros Complementarios — Renovación de Fianzas (86-88):**
  ```
  J87 = SUM('GG. FIJOS'!I22:I25)     -> costo de renovar fianza de adelanto efectivo
  J88 = SUM('GG. FIJOS'!I31:I34)     -> costo de renovar fianza de adelanto materiales
  ```
- **02.08.00 Etapa Recepción y Liquidación de Obra (90-97):** Ingeniero Residente (1 mes, celda
  `J93=14000` resaltada en naranja `FFFFCC99` = **input clave**), Especialista Planeamiento y
  Costos (0.5 mes), Administrador (0.5 mes); más oficina/útiles (`K97`).

```
K99 = SUM(K46:K97)                    -> TOTAL GASTOS VARIABLES
```

**III) Gastos Generales Total (filas 100-108):**
```
F101 = F16                            -> Fijos + Variables
F102 = D11                            -> Costo Directo
F103 = F101/F102                      -> % Gastos Generales
```
> `N100=M100-F101`, `N101=N100/5`, y `H105:H108` son celdas sueltas de cálculo (`M100` está
> vacía, `H105=14.28%*F102`, etc.) sin conexión con el resto del flujo — **legado/scratch, no
> portar**.

---

### 3.3 GG. FIJOS

**Bloque de inputs (5-11):** `C5` Costo Directo, `C6`/`C7` GGF/GGV (calculados más abajo), `C8`
Utilidad, `C9` Subtotal sin IGV, `C10` **Monto de Contrato a Garantizar** (usado como base de casi
todas las fianzas/seguros de este workbook), `C11` Duración de obra en días.

**Bloque de cálculo lateral (columnas N-R, filas 13-26) — deriva GGF/GGV/Utilidad como % del CD:**
```
O13 = C5                                          (Costo Directo)
O14 = O13 * Q14        Q14≈2.021%   -> GGF (Gastos Generales Fijos) estimado
O15 = O13 * Q15        Q15≈9.539%   -> GGV (Gastos Generales Variables) estimado
R14 = CONSOLIDADO!G20 / CONSOLIDADO!F44      -> % real de GGF (para comparar con Q14)
R15 = CONSOLIDADO!H23 / CONSOLIDADO!F44      -> % real de GGV (para comparar con Q15)
O16 = ROUND(O13 * P16, 2)    P16=5%          -> Utilidad
O18 = ROUND(SUM(O13:O17), 2)                 -> Subtotal (CD+GGF+GGV+Utilidad)
O20 = O18 * 0.18                             -> IGV
O21 = O18 + O20                              -> Monto de Contrato a Garantizar -> alimenta C10
```
> `P18`, `R18`, `R19`, `R20` son celdas de calibración manual (comparan el % objetivo contra el
> % real) — igual patrón que la columna M/N de CONSOLIDADO. `N23:O26` (Supervisión=600000,
> Exp.Técnico=, Total=) son valores sueltos/informativos que **no alimentan ninguna fórmula
> aguas abajo** — no portar como parte del cálculo, pueden mostrarse como nota si el negocio lo
> pide.

**Fianza por Garantía de Fiel Cumplimiento — 10% (13-17):**
```
C16 = C15(10%) * C10                                     -> monto de la fianza
H16 = ROUND(C16 * E16 * (F16+G16), 2)     E16=TEA/360, F16=C11 (días obra), G16=30 (días extra)
```
→ alimenta `'G GENERALES'!J25`.

**Fianza Adelanto en Efectivo — 10% (18-26), amortizada en 4 tramos decrecientes (100%→60%→40%→10%):**
```
I21..I24 = ROUND(C*E*F*H, 2)   -- C=monto fianza(10%*C10), E=tasa diaria, F=% del tramo, H=días vigencia (90 o 30)
I26 = SUM(I21:I25)             -> costo total de renovación
```
→ alimenta `'G GENERALES'!J26`. (`L21`, `L22`, `M22` son cálculo alternativo con tasa mensual
efectiva — **scratch, no conectado**, no portar.)

**Fianza Adelanto en Materiales — 20% (27-35), 5 tramos (100%→60%→40%→10%→10%):**
```
I30..I34 = ROUND(C*E*F*H, 2)
I35 = SUM(I30:I34)
```
→ alimenta `'G GENERALES'!J27`.

**Póliza CAR — Todo Riesgo (36-39):**
```
G39 = ROUND(C39*E39*F39, 2)     C39=C10, D39=0.3% TEA, F39=C11 (días obra)
```
→ alimenta `'G GENERALES'!J30`.

**Seguro SCTR Personal Técnico (41-46):**
```
L44 = SUM('G GENERALES'!K46:K65)      -> costo total de planilla (empleados)
G44 = ROUND(C44*E44*F44, 2)   C44=L44, D44=0.5% TEA (Tasa Salud)
G45 = ROUND(C45*E45*F45, 2)   C45=L45(=L44), D45=1.5% TEA (Tasa Pensión)
G46 = SUM(G44:G45)
```
→ alimenta `'G GENERALES'!J32`.

**Póliza Seguros ESSALUD+Vida (47-50):**
```
C50 = SUM('G GENERALES'!K41:K60)      -- ⚠ rango distinto a L44 (K46:K65), ver hallazgo 5.2
D50 = 0.53%
E50 = ROUND(C50*D50, 2)
```
→ alimenta `'G GENERALES'!J33` (label dinámico "PÓLIZA DE SEGUROS ESSALUD + VIDA").

**Pago Sencico (52-55):**
```
E55 = ROUND(C55*D55, 2)   C55=C10, D55=0.2%
```
→ alimenta `'G GENERALES'!J35`.

**Impuestos ITF (57-60):**
```
E60 = ROUND(C60*D60, 2) + 495.074483000033     C60=C10, D60=0.005%
```
→ alimenta `'G GENERALES'!J36`. **Ver hallazgo 5.4: número mágico dentro de la fórmula.**

**Bloque "SCTR Obreros" (65-70) — desconectado, con link externo roto:**
```
N66 = ROUND(D66*Q66, 2)     Q66=1766707.55 (hardcode "Obreros")
N67 = ROUND(D67*Q67, 2)     Q67=640000 (hardcode "Empleados")
N70 = SUM(N66:N69)
P70 = '[1]Resumen!G101'     -- ⚠ referencia a OTRO ARCHIVO EXCEL que no está presente (link externo roto)
```
**No conectado a ninguna fórmula aguas arriba/abajo. No portar** (ver hallazgo 5.7).

---

### 3.4 SUPERVISION

```
B10 = CONSOLIDADO!F58              -> Presupuesto de Obra (base para el % final)
F10 = CONSOLIDADO!H4               -> Duración de obra en días

I. ETAPA DE SUPERVISIÓN DE OBRA
  A. Sueldos (7 roles: Ing. Supervisor, Especialistas Estructuras/Arquitectura/Eléctrico/
     Sanitario, EIA/SSO, Planeamiento y Costos, Asistente Admin): F = C(participación) × D(meses) × E(precio)
  F16 = SUM(F17:F24)
  B. Oficinas (oficina+mobiliario, equipos cómputo): F25 = SUM(F26:F27)
  G14 = F15 + F25

II. ETAPA RECEPCIÓN Y LIQUIDACIÓN
  A. Sueldos (Ing. Supervisor 1 mes, Esp. Planeamiento 0.5 mes, Asistente 0.5 mes): F31=SUM(F32:F34)
  B. Oficinas: F35 = SUM(F36:F36)
  G29 = F30 + F35

III. COSTO DIRECTO:        G38 = G14 + G29
IV. GASTOS GENERALES:      G39 = 'GG SUPER'!G25
V. UTILIDAD (5% CD):       G40 = ROUND(G38*5%, 2)
VI. TOTAL:                 G41 = G38 + G39 + G40
VII. IGV (18%):            G42 = G41 * 0.18
VIII. TOTAL:                G43 = G41 + G42          -> alimenta CONSOLIDADO!F59
PORCENTAJE:                 G44 = G43 / CONSOLIDADO!F58
```

---

### 3.5 GG SUPER

```
B8 = CONSOLIDADO!F58                            (informativo, no usado en cálculo interno)

I. DETALLE DE GASTOS GENERALES
  A. Sueldos Personal Sede Central (Contador 20% part. × 15 meses, Secretaria ídem): F14=SUM(F15:F16)
  B. Oficinas Adm. Sede Central (oficina+mobiliario, equipos cómputo): F17=SUM(F18:F19)
  C. Movilidad y Equipos de Campo (Alquiler Camioneta, Alquiler Equipo Topográfico): F21=SUM(F22:F23)
  G13 = F14 + F17 + F21

VIII. TOTAL GASTOS GENERALES: G25 = G13         -> alimenta SUPERVISION!G39
```
Todas las filas de detalle usan el mismo patrón: `F = Cantidad(C) × Meses(D) × Precio(E)`.

---

### 3.6 Remuneracion

Por cada uno de los 13 trabajadores (filas 9-21), trae sus datos base desde `'G GENERALES'!` (fila
correspondiente 46-59: participación `A`, cantidad `B`, descripción `C`, meses `D`, precio `E`), y
calcula:

```
F = (E + G) * 13%                          -> Aporte SNP/AFP (13%, "(*)" — DESCUENTO al trabajador, NO es costo del empleador)
G = 46 * A * B                             -> Asignación Familiar (factor fijo S/46 × participación × cantidad)
H = E * 9%                                 -> ESSALUD (9%, aporte del empleador)
I = (E + G + K) * 8.3333%                  -> CTS
J = SUM(E, G) / 12                         -> Vacaciones (1/12)
K = SUM(E, G) / 12                         -> Gratificación  ⚠ ver hallazgo 5.8
L = E + G + H + I + J + K                  -> Total a pagar por mes (costo real del empleador)
```

**Totales:**
```
Fila 22 "MENSUAL":  E22=SUM(E9:E21), G22=SUM(G9:G21), ... (suma simple, no pondera por meses)
Fila 23 "TOTAL":    E23=SUMPRODUCT(D9:D21,E9:E21), G23=SUMPRODUCT(D9:D21,G9:G21), ...
```
> **La fila 23 (TOTAL, con `SUMPRODUCT`) es la que realmente se usa** — es la que
> `'G GENERALES'!J61:J65` consume. La fila 22 ("MENSUAL", suma simple) es solo informativa y no
> tiene consumidores aguas abajo.

---

### 3.7 PLAN COVID — hoja inactiva (Componente III)

Réplica **estructuralmente idéntica** a "G GENERALES" (mismos bloques I/II/III, mismos patrones de
fórmula `PRODUCT`/multiplicación), pero para el "Plan de Prevención y Control Covid-19":
```
L36 = SUM(L19:L34)      -> Total Gastos Fijos Covid
L82 = SUM(L42:L81)      -> Total Gastos Variables Covid
G13 = L36 + L82
G84 = G13
G85 = CONSOLIDADO!F53   -- ⚠ F53 está hardcodeado en 0, no en una fórmula que traiga G84 de vuelta
G86 = G84/G85           -- riesgo de división por cero si G84 y G85 no son ambos 0 a la vez
```
Solo tiene datos cargados en la sección "GASTOS DE ADMINISTRACIÓN EN OBRA" (un Enfermero, 6 meses,
S/2,000/mes) y "Beneficios Sociales" (35% flat) y "Útiles de escritorio". El resto de las
secciones (Ensayos, Alquileres, Vehículos, Fianzas) están vacías (encabezados sin datos).

**Ver hallazgo 5.3: esta hoja no está conectada al flujo de `CONSOLIDADO`.**

---

### 3.8 CONTROL CONCURRENTE — justificación bottom-up del 0.6%

```
B7 = 15                              (Periodo de ejecución faltante, en MESES — input; ver hallazgo 5.1)
C8 = CONSOLIDADO!F60                 (Total sobre el que se calcula el tope)
F8 = H41 / C8                        -> % que representa el COSTO REAL calculado sobre el total

Personal de control (Supervisor, Jefe Comisión, Profesional):
  G = Precio(F) × Periodo(E) × Participación(D) × Cantidad(C)
  H12 = SUM(G13:G15)

Equipamiento (Seguridad, Telecom, Cómputo, Medición, Software):
  F = $H$12 * %categoría(J)          -- el monto de cada rubro es un % del total de personal (H12)
  G = F × E × D × C
  H17 = SUM(G17:G22)

Seguros (SCTR):            H24 = SUM(G25)
Servicios especializados:  H27 = SUM(G28)

Pasajes/Viáticos/Bolsa de viaje:
  L29=8.1 (nº visitas), L30=3 (nº comisionados), L31=L29*L30 (pasajes),
  L33=4 (días/visita), L34=L33*L30*L29 (días-persona)
  H30 = SUM(G30:G34)

Alquiler de vehículos:     H35 = SUM(G36)     (C36 = L34, días de uso)

Gastos administrativos:
  L37 = SUM(H12:H35)                 -> suma de todos los rubros anteriores
  L38 = L37 * 15%                    -> recargo administrativo
  H38 = SUM(G39)                     (F39 = L38)

H41 = SUM(H12:H39)                   -> TOTAL COSTO DE INVERSIÓN REAL DEL CONTROL CONCURRENTE
H43 = C8 * 0.6%                      -> TOPE LEGAL MÁXIMO (mismo cálculo que CONSOLIDADO!F62)
```

**Regla de negocio clave (igual que en el otro Excel):** el monto que efectivamente se presupuesta
en `CONSOLIDADO!F62` es **siempre el tope plano `F60*0.6%`**, no el costo real bottom-up `H41`. Esta
hoja existe **solo como sustento/justificación** de que el costo real (`H41`) cabe dentro del tope
legal — comparando `F8` (% real) contra 0.6% (tope). El sistema nuevo debe preservar esta relación:
calcular ambos números y mostrar la comparación, pero **presupuestar siempre el tope**, no el costo
real, salvo que el negocio indique lo contrario.

---

## 4. Puntos de captura de datos (dónde se ingresan los números, no dónde se calculan)

| Hoja | Inputs directos (números/textos sin fórmula) |
|---|---|
| CONSOLIDADO | `H4` días de ejecución · `F39:F43` los 5 componentes de Costo Directo · `G46` % Utilidad (5%) · `F50` Componente II (Mobiliario) · `F53`,`F54` Componente III (hoy en 0) |
| G GENERALES | `F17` plazo en meses · Para cada partida fija: `I31,J31` (ensayo compresión) · Para cada partida variable: columnas `G,H,I,J` de cada rol de personal (meses, participación, precio) y de cada rubro de equipamiento/servicios · `J93` sueldo Ing. Residente etapa liquidación |
| GG. FIJOS | `C10`-dependientes: `C15`(10%),`D16`(TEA 2.5%),`G16`(30 días) · tramos de amortización `F21:F25`,`F30:F34` (%) y `H21:H25`,`H30:H34` (días) · `D39`(0.3% seguro CAR) · `D44`,`D45` (tasas SCTR) · `D50`(0.53% ESSALUD+Vida) · `D55`(0.2% Sencico) · `D60`(0.005% ITF) + el número mágico `495.074483000033` |
| SUPERVISION | Para cada rol de personal: participación, meses, precio (columnas C,D,E) |
| GG SUPER | Para cada rol/rubro: cantidad, meses, precio |
| Remuneracion | Constantes legales: `13%`(SNP), `9%`(ESSALUD), `8.3333%`(CTS), factor `46`(Asignación Familiar) — **hardcodeadas dentro de las fórmulas**, no en celdas de parámetro aparte |
| PLAN COVID | Datos del único rol activo (Enfermero: 6 meses, S/2,000) y `35%` de beneficios sociales flat |
| CONTROL CONCURRENTE | `B7`(15 meses) · precios de personal de control · `%` de equipamiento por categoría (`J18:J22`) · `L29,L30,L33`(visitas, comisionados, duración) · precios de pasajes/viáticos/vehículo · `15%` recargo administrativo |

> **Recomendación para el modelo de datos:** todas las constantes legales/porcentuales que hoy
> están escritas *dentro* de una fórmula (13%, 9%, 8.3333%, 0.3%, 0.5%, 1.5%, 0.53%, 0.2%, 0.005%,
> 15%, 18% IGV, 5% Utilidad, 0.6% Control Concurrente, factor 46) deben convertirse en
> **parámetros configurables y nombrados** en el sistema nuevo (ver `types/parametros.ts` en la
> sección 7), no en literales sueltos en el código — así, si la normativa laboral o tributaria
> cambia, se actualiza en un solo lugar.

---

## 5. Hallazgos / deuda técnica detectada (a decidir con el negocio antes de portar)

1. **`G GENERALES!F17` (plazo=6 meses) no coincide con los meses individuales usados por el
   personal** (la mayoría de roles usan 15 meses, algunos 9, 6, 5, 2). Tampoco coincide con
   `CONTROL CONCURRENTE!B7` (15 meses) ni necesariamente con `CONSOLIDADO!H4` (días calendario).
   **Confirmar si "F17" es solo informativo o si debería ser el parámetro maestro de duración.**
2. **Rango inconsistente en `GG. FIJOS`:** `L44 = SUM('G GENERALES'!K46:K65)` (usado para SCTR)
   vs. `C50 = SUM('G GENERALES'!K41:K60)` (usado para ESSALUD+Vida) — ventanas de filas distintas
   sobre una tabla de personal muy similar. Verificar si es intencional (cubren universos de
   trabajadores distintos) o es un desfase de rango arrastrado al copiar la fórmula.
3. **`PLAN COVID` es una hoja completa y funcional, pero desconectada:** `CONSOLIDADO!F53` y `F54`
   están hardcodeados en `0` en vez de referenciar `'PLAN COVID'!G84`/`G13`. Definir si el
   Componente III debe ser un módulo activable/desactivable en el sistema nuevo.
4. **Número mágico dentro de una fórmula:** `GG. FIJOS!E60 = ROUND(C60*D60,2) + 495.074483000033`.
   Existe una celda `L54` con ese mismo valor y una celda `L59 = 'G GENERALES'!M36` sin usar —
   sugiere que el `+495.07...` debería ser una referencia a una celda con nombre, no un literal.
   **No replicar como número mágico en el código** — exponerlo como parámetro documentado
   ("cargo adicional de ITF, origen a confirmar").
5. **`CONSOLIDADO!F62` (Control Concurrente presupuestado) usa el tope plano `F60*0.6%`, no el
   costo real bottom-up de la hoja `CONTROL CONCURRENTE!H41`.** Esto es coherente con el mismo
   patrón visto en el otro Excel — mantenerlo así, pero mostrar ambos números en la UI para
   transparencia (ver sección 8).
6. **`CONSOLIDADO!C61` y `C64` usan `conviertenumletra()`**, una función personalizada de Excel
   (macro VBA), no una función nativa. **Se debe reimplementar en TypeScript un conversor de
   número a letras en formato peruano** ("SON: DOS MILLONES... CON 00/100 SOLES"), ya que el motor
   de cálculo del sistema nuevo no puede depender de macros de Excel.
7. **`GG. FIJOS` filas 65-70 ("SCTR Obreros")** contienen un enlace a un **archivo Excel externo
   roto**: `P70 = '[1]Resumen!G101'`. Esta sección no alimenta ni es alimentada por ninguna otra
   fórmula del workbook — **no portar**.
8. **Posible inconsistencia en `Remuneracion`:** la fórmula de Gratificación (`K`) es idéntica a la
   de Vacaciones (`J`, ambas `=SUM(E,G)/12`), pero la etiqueta original en `'G GENERALES'!D65` dice
   *"Gratificación (1/6 PUnit. x 2)"*, lo que matemáticamente sería `(1/6)*2 = 1/3` anual (≈1/36
   mensual), no `1/12`. **Confirmar con el negocio la fórmula correcta antes de portarla**, dado
   que afecta directamente el costo de personal.
9. **Bloque "M" de `CONSOLIDADO` (verificación con % planos) tiene una fórmula rota:**
   `M58 = ROUND(M49+#REF!+M50,2)`. Esta columna entera es de verificación/calibración manual, no
   forma parte del cálculo real (columna F) — no portar tal cual, reconstruir como función de
   comparación si se desea mantener esa validación.

---

## 6. Modelo de datos (TypeScript)

```typescript
// --- Parámetros legales / tasas configurables (NO hardcodear en fórmulas) ---
interface ParametrosLegalesYFinancieros {
  igv: number;                          // 18%
  utilidadPorcentaje: number;           // 5% (en este proyecto; era 10% en "cronograma valorizado")
  controlConcurrenteTope: number;       // 0.6%
  sencicoPorcentaje: number;            // 0.2%
  itfPorcentaje: number;                // 0.005%
  itfCargoAdicional?: number;           // el "495.07..." hardcodeado — documentar origen (hallazgo 4)
  snpAfpPorcentaje: number;             // 13% (descuento trabajador, informativo)
  essaludPorcentaje: number;            // 9%
  ctsPorcentaje: number;                // 8.3333%
  asignacionFamiliarFactor: number;     // 46 (soles)
  tasaSctrSalud: number;                // 0.5%
  tasaSctrPension: number;              // 1.5%
  tasaPolizaEssaludVida: number;        // 0.53%
  tasaSeguroCAR: number;                // 0.3%
  recargoAdministrativoControlConcurrente: number; // 15%
}

// --- Staff / personal (fuente única, ver sección 2 sobre la "dependencia circular") ---
interface Trabajador {
  id: string;
  rol: string;                  // "Ingeniero Residente", "Especialista en Estructuras"...
  unidad: "mes" | "und" | "glb";
  cantidad: number;             // columna G en G GENERALES (casi siempre 1)
  meses: number;                // columna H
  participacion: number;        // columna I, fracción 0-1
  precioUnitario: number;       // columna J
}
// Derivados (funciones puras, no se guardan):
// costoBase(t) = t.cantidad * t.meses * t.participacion * t.precioUnitario
// asignacionFamiliar(t) = parametros.asignacionFamiliarFactor * t.participacion * t.cantidad
// essalud(t) = t.precioUnitario * parametros.essaludPorcentaje
// cts(t, gratificacion) = (t.precioUnitario + asignacionFamiliar(t) + gratificacion) * parametros.ctsPorcentaje
// vacaciones(t) = (t.precioUnitario + asignacionFamiliar(t)) / 12
// gratificacion(t) = (t.precioUnitario + asignacionFamiliar(t)) / 12   // ⚠ ver hallazgo 5.8, confirmar
// costoTotalMensual(t) = precioUnitario + asignacionFamiliar + essalud + cts + vacaciones + gratificacion
// costoTotalProyecto(t) = costoTotalMensual(t) * t.meses   (equivalente a SUMPRODUCT por trabajador)

// --- Fianza / seguro con vigencia financiera (patrón repetido en GG. FIJOS) ---
interface CostoFinanciero {
  id: string;
  montoBase: number;            // ej. 10% o 20% del Monto de Contrato a Garantizar
  teaAnual: number;              // tasa efectiva anual
  diasVigencia: number;          // duración de obra (+ opcionalmente 30 días de liquidación)
  factorTramo?: number;          // % del tramo (para fianzas amortizadas en varios tramos)
}
// costoFinanciero(c) = round(c.montoBase * (c.teaAnual/360) * (c.factorTramo ?? 1) * c.diasVigencia, 2)

// --- Ítem de rubro genérico (equipamiento, alquileres, ensayos, etc.) ---
interface RubroGenerico {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  tiempoOCantidad2: number;      // segunda cantidad (meses, o factor extra según el rubro)
  participacion: number;         // fracción 0-1
  precioUnitario: number;
}
// monto(r) = r.cantidad * r.tiempoOCantidad2 * r.participacion * r.precioUnitario

// --- Estructura completa del workbook ---
interface PresupuestoGastosGenerales {
  costoDirecto: number;                       // suma de los 5 componentes de obra (input directo)
  montoContratoGarantizar: number;             // = CD + GGF + GGV + Utilidad + IGV (circular con GGF/GGV, ver nota abajo)
  diasEjecucionObra: number;
  gastosGeneralesFijos: {
    fianzaFielCumplimiento: CostoFinanciero;
    fianzaAdelantoEfectivo: CostoFinanciero[];   // 4 tramos
    fianzaAdelantoMateriales: CostoFinanciero[]; // 5 tramos
    polizaCAR: CostoFinanciero;
    ensayoCompresionTestigos: RubroGenerico;
    polizaSCTR: { salud: CostoFinanciero; pension: CostoFinanciero };
    polizaEssaludVida: { base: number; tasa: number };
    sencico: { base: number; tasa: number };
    itf: { base: number; tasa: number; cargoAdicional?: number };
  };
  gastosGeneralesVariables: {
    personalAdministracionObra: Trabajador[];
    beneficiosSociales: Trabajador[];           // derivado del staff anterior
    equipamientoYMobiliario: RubroGenerico[];
    ensayosYPruebasCalidad: RubroGenerico[];
    alquileresYServicios: RubroGenerico[];
    vehiculos: RubroGenerico[];
    renovacionFianzas: { efectivo: number; materiales: number };
    etapaLiquidacion: { personal: Trabajador[]; oficina: RubroGenerico[] };
  };
  supervision: {
    personalEtapaObra: Trabajador[];
    oficinaEtapaObra: RubroGenerico[];
    personalEtapaLiquidacion: Trabajador[];
    oficinaEtapaLiquidacion: RubroGenerico[];
    gastosGeneralesSupervision: {
      personalSedeCentral: Trabajador[];
      oficinaSedeCentral: RubroGenerico[];
      movilidadYEquipos: RubroGenerico[];
    };
    utilidadPorcentaje: number;                 // 5%
  };
  componenteII_MobiliarioEquipamiento: { monto: number };  // input directo, sin desagregado
  componenteIII_PlanCovid?: {                    // opcional/activable, ver hallazgo 5.3
    activo: boolean;
    personalAdministracionObra: Trabajador[];
    equipamiento: RubroGenerico[];
    // ... misma forma que gastosGeneralesVariables
  };
  controlConcurrente: {
    periodoMeses: number;
    personalControl: Trabajador[];
    equipamiento: { categoria: string; porcentajeSobrePersonal: number }[];
    seguros: RubroGenerico[];
    serviciosEspecializados: RubroGenerico[];
    numeroVisitas: number;
    numeroComisionados: number;
    diasPorVisita: number;
    precioVehiculoDia: number;
    recargoAdministrativoPorcentaje: number;     // 15%
  };
}
```

> **Nota sobre "Monto de Contrato a Garantizar":** en el Excel, `GG. FIJOS!O21` (Monto a Garantizar)
> depende de GGF/GGV/Utilidad, pero a la vez `O14`/`O15` (GGF/GGV estimados) se calculan como % de
> `C5` (Costo Directo, no del monto a garantizar) — **no hay circularidad real**, ambos dependen
> solo del Costo Directo. Y el "Monto de Contrato a Garantizar" real (`C10`) que se usa para las
> fianzas viene de `O21`, calculado con los % **estimados** (`Q14`,`Q15`), no con los montos reales
> de `G GENERALES`. Esto significa que hay **dos series de GGF/GGV en paralelo**: la estimada
> (`GG. FIJOS!O14,O15`, usada solo para fijar `C10`) y la real/detallada (`G GENERALES!K39,K99`,
> la que efectivamente se reporta en `CONSOLIDADO`). Son consistentes en la práctica porque `Q14`,
> `Q15` fueron calibrados para aproximar el resultado real, pero **no están matemáticamente
> forzados a coincidir**. Documentar esto explícitamente en la UI de verificación (sección 8).

---

## 7. Motor de cálculo (orden de evaluación)

```typescript
// 1. Trabajadores → costo de planilla (Remuneracion + G GENERALES fusionados en una sola fuente)
const staffConBeneficios = trabajadores.map(t => ({
  ...t,
  asignacionFamiliar: asignacionFamiliar(t),
  essalud: essalud(t),
  gratificacion: gratificacion(t),      // ⚠ confirmar fórmula, hallazgo 5.8
  vacaciones: vacaciones(t),
  cts: cts(t, gratificacion(t)),
}));
const costoTotalPlanilla = sum(staffConBeneficios.map(t => costoTotalProyecto(t)));

// 2. GG. FIJOS: fianzas y seguros (dependen de montoContratoGarantizar y días de obra)
const fianzaFielCumplimiento = costoFinanciero(...);
const fianzasAdelantoEfectivo = tramosEfectivo.map(costoFinanciero);
const fianzasAdelantoMateriales = tramosMateriales.map(costoFinanciero);
const polizaCAR = costoFinanciero(...);
const sctr = { salud: costoFinanciero({ montoBase: costoTotalPlanilla, ... }), pension: ... };
const polizaEssaludVida = round(costoTotalPlanilla * parametros.tasaPolizaEssaludVida, 2);
const sencico = round(montoContratoGarantizar * parametros.sencicoPorcentaje, 2);
const itf = round(montoContratoGarantizar * parametros.itfPorcentaje, 2) + (parametros.itfCargoAdicional ?? 0);

// 3. G GENERALES: Fijos + Variables
const totalGastosFijos = sum([fianzaFielCumplimiento.total, fianzaEfectivoTotal, fianzaMaterialesTotal,
                               polizaCAR, ensayoTestigos, sctr.salud+sctr.pension, polizaEssaludVida,
                               sencico, itf]);
const totalGastosVariables = sum([costoTotalPlanilla, beneficiosSociales, equipamiento, ensayosCalidad,
                                   alquileres, vehiculos, renovacionFianzas, etapaLiquidacion]);
const totalGastosGenerales = totalGastosFijos + totalGastosVariables;

// 4. GG SUPER → SUPERVISION
const totalGGSupervision = personalSedeCentral + oficinaSedeCentral + movilidadYEquipos;
const costoDirectoSupervision = personalEtapaObra + oficinaEtapaObra + personalEtapaLiquidacion + oficinaEtapaLiquidacion;
const utilidadSupervision = round(costoDirectoSupervision * 0.05, 2);
const totalSupervisionConIGV = round((costoDirectoSupervision + totalGGSupervision + utilidadSupervision) * 1.18, 2);

// 5. CONTROL CONCURRENTE (bottom-up, solo para comparación/justificación)
const costoRealControlConcurrente = personal + equipamiento + seguros + servicios + pasajes + vehiculo + admin;
const topeControlConcurrente = presupuestoTotal * parametros.controlConcurrenteTope;
// -> el sistema SIEMPRE presupuesta `topeControlConcurrente`, no `costoRealControlConcurrente`

// 6. CONSOLIDADO (cascada final)
const costoDirecto = sum(componentesObra);   // input directo, 5 partidas
const subTotalPresupuesto = costoDirecto + totalGastosGenerales + utilidad(costoDirecto, 0.05);
const igv = round(subTotalPresupuesto * parametros.igv, 2);
const subTotalComponenteI = subTotalPresupuesto + igv;
const componenteII = montoComponenteII_conIGV;
const componenteIII = componenteIII_activo ? montoComponenteIII_conIGV : 0;
const totalPresupuestoObra = subTotalComponenteI + componenteII + componenteIII;
const totalConSupervision = totalPresupuestoObra + totalSupervisionConIGV;
const controlConcurrentePresupuestado = round(totalConSupervision * parametros.controlConcurrenteTope, 2);
const totalInversionObra = totalConSupervision + controlConcurrentePresupuestado;
```

### 7.1 Conversor de número a letras (reemplaza `conviertenumletra()`)

```typescript
// Debe producir el mismo formato que el Excel: "SON: DOS MILLONES CIENTO... CON 00/100 SOLES"
function numeroALetras(monto: number, moneda: string = "SOLES"): string { /* ... */ }
```
Se recomienda usar o adaptar una librería ya probada para números en español (formato peruano de
soles), en vez de reescribir el algoritmo desde cero — el riesgo de errores en la conversión de
números grandes es alto si se hace a mano.

---

## 8. Estructura de software (React + TypeScript)

```
src/
├── types/
│   ├── parametros.ts            // ParametrosLegalesYFinancieros
│   ├── trabajador.ts            // Trabajador + funciones de tipo (no de cálculo)
│   ├── costoFinanciero.ts       // CostoFinanciero
│   ├── rubroGenerico.ts         // RubroGenerico
│   ├── gastosGenerales.ts       // PresupuestoGastosGenerales (tipo raíz)
│   └── verificacion.ts          // ResultadoVerificacion (igual patrón que "Verificación del Valorizado")
│
├── lib/calculo/                 // funciones PURAS, sin estado, sin React — el "motor" (sección 7)
│   ├── staff.ts                 // asignacionFamiliar, essalud, cts, vacaciones, gratificacion, costoTotalProyecto
│   ├── costoFinanciero.ts       // costoFinanciero(), amortizacionPorTramos()
│   ├── ggFijos.ts               // ensambla GG. FIJOS completo
│   ├── ggGenerales.ts           // ensambla G GENERALES (Fijos+Variables)
│   ├── supervision.ts           // ensambla SUPERVISION + GG SUPER
│   ├── controlConcurrente.ts    // costoReal() + tope() + comparación
│   ├── consolidado.ts           // cascada final (Costo Directo -> Total Inversión)
│   ├── numeroALetras.ts         // conversor de número a letras (reemplaza conviertenumletra)
│   └── verificacion.ts          // compara resultado del motor vs. dataset de referencia del Excel
│
├── hooks/
│   ├── usePresupuestoGastosGenerales.ts   // arma el estado completo, corre el motor de cálculo, memoiza resultados
│   ├── useTrabajadores.ts                 // CRUD de la lista de personal (agregar/quitar/editar rol)
│   ├── useRubrosEditables.ts              // CRUD genérico para equipamiento/alquileres/servicios (reusa RubroGenerico)
│   ├── useParametrosLegales.ts            // lee/edita ParametrosLegalesYFinancieros (con valores por defecto documentados)
│   └── useVerificacionGastosGenerales.ts  // corre verificacion.ts contra un dataset de referencia cargado
│
├── components/
│   ├── gastos-generales/
│   │   ├── ResumenConsolidado.tsx         // vista tipo "CONSOLIDADO": cascada de totales
│   │   ├── TablaGastosFijos.tsx           // fianzas, seguros, pólizas (con su detalle financiero expandible)
│   │   ├── TablaGastosVariables.tsx       // personal + equipamiento + alquileres, editable
│   │   ├── DetalleFinancieroFianza.tsx    // muestra TEA, días, tramos de una fianza (CostoFinanciero)
│   │   └── ComponenteIIyIII.tsx           // Mobiliario/Equipamiento + Plan Covid (con toggle activo/inactivo)
│   ├── supervision/
│   │   ├── ResumenSupervision.tsx
│   │   └── TablaGastosGeneralesSupervision.tsx
│   ├── control-concurrente/
│   │   ├── DetalleControlConcurrente.tsx  // desglose bottom-up (personal, equipo, seguros, viáticos)
│   │   └── ComparativoTopeVsReal.tsx      // muestra H41 (real) vs H43 (tope) vs lo presupuestado
│   ├── personal/
│   │   ├── TablaTrabajadores.tsx          // lista editable de Trabajador[] (reusable en varias secciones)
│   │   └── FilaTrabajador.tsx
│   └── verificacion/
│       └── PanelVerificacionGastosGenerales.tsx   // igual patrón que "Verificación del Valorizado"
│
└── utils/
    ├── round2.ts                 // ROUND(x,2) equivalente exacto al de Excel
    └── formatoMoneda.ts          // "S/. #,##0.00"
```

**Principios de organización aplicados:**
- **`types/`** solo define formas de datos, sin lógica.
- **`lib/calculo/`** son funciones puras (mismo input → mismo output, sin `useState` ni efectos) —
  esto es lo que permite testear el motor de cálculo de forma aislada y compararlo contra el Excel
  sin necesidad de renderizar componentes.
- **`hooks/`** conectan el motor de cálculo puro con el estado de React (edición del usuario,
  memoización con `useMemo` para no recalcular toda la cascada en cada tecla).
- **`components/`** son solo presentación; reciben datos ya calculados por los hooks, no calculan
  nada por sí mismos.
- Cualquier componente de "tabla editable" (personal, rubros genéricos) se reutiliza en las 4
  secciones que lo necesitan (`G GENERALES`, `SUPERVISION`, `GG SUPER`, `CONTROL CONCURRENTE`) en
  vez de duplicar el componente por hoja.

---

## 9. Verificación — reutilizar "Verificación del Valorizado"

Este módulo se integra al mismo mecanismo ya definido para "cronograma valorizado" (sección 18 de
ese plan): un dataset de referencia extraído del Excel + una función `verificarValorizado()`
generalizada. Para este workbook, el dataset de referencia debe cubrir como mínimo:

| Hoja | Celdas de referencia a extraer |
|---|---|
| CONSOLIDADO | `F44,F45,F46,F47,F48,F49,F58,F59,F60,F62,F63` |
| G GENERALES | `K39,K99,F101,F103` |
| GG. FIJOS | `H16,I26,I35,G39,G46,E50,E55,E60,O21` |
| SUPERVISION | `G14,G29,G38,G39,G40,G41,G42,G43` |
| GG SUPER | `G13,G25` |
| Remuneracion | `E23,G23,H23,I23,J23,K23` |
| CONTROL CONCURRENTE | `H12,H17,H24,H27,H30,H35,H38,H41,H43` |

La pantalla resultante puede llamarse, siguiendo la misma convención, **"Verificación de Gastos
Generales"**, y debe mostrar explícitamente el caso de `CONTROL CONCURRENTE` (costo real `H41` vs.
tope `H43` vs. lo efectivamente presupuestado en `CONSOLIDADO!F62`) para que quede claro que son
tres números relacionados pero distintos, no un error de cálculo.

---

## 10. Checklist para cruzar contra el sistema web ya construido

- [ ] ¿El costo de personal (`Trabajador`) se calcula como una única fuente de verdad, o el
      sistema replica la "ida y vuelta" entre `G GENERALES` y `Remuneracion` como dos tablas
      separadas que hay que mantener sincronizadas?
- [ ] ¿Se confirmó con el negocio la fórmula de Gratificación (hallazgo 5.8) antes de portarla?
- [ ] ¿Los porcentajes/tasas legales (IGV, ESSALUD, SNP, CTS, SCTR, Sencico, ITF,
      Control Concurrente) están como **parámetros configurables**, o quedaron como literales
      dentro de funciones de cálculo?
- [ ] ¿El "Monto de Contrato a Garantizar" (base de las fianzas) usa el GGF/GGV **estimado**
      (como en el Excel, `GG. FIJOS!O14/O15`) o el real (`G GENERALES!K39/K99`)? Confirmar cuál
      debe usar el sistema nuevo, dado que en el Excel son dos series distintas (ver nota final
      de la sección 6).
- [ ] ¿El Componente III (Plan Covid) está implementado como módulo **activable/desactivable**, en
      vez de repetir el hardcode en 0 del Excel original?
- [ ] ¿Se excluyeron del sistema nuevo las celdas de verificación rota (`CONSOLIDADO!M58`), el
      enlace externo roto (`GG. FIJOS!P70`), y los bloques scratch sin conexión (`GG. FIJOS` filas
      65-70, `G GENERALES` filas 105-108)?
- [ ] ¿El número mágico `495.074483000033` de `GG. FIJOS!E60` está documentado como parámetro
      configurable, con su origen marcado como "a confirmar", en vez de copiado literal en el
      código?
- [ ] ¿`CONTROL CONCURRENTE` se presupuesta siempre al tope legal (0.6%), mostrando el costo real
      bottom-up solo como justificación/comparación, y no al revés?
- [ ] ¿El conversor de número a letras (`numeroALetras`) fue reimplementado en TypeScript, sin
      depender de ninguna macro de Excel?
- [ ] ¿Existe la pantalla "Verificación de Gastos Generales" (sección 9) comparando el resultado
      del motor contra el dataset de referencia del Excel, celda por celda?

---

## 11. Próximos pasos sugeridos

1. Confirmar con el negocio los 3 puntos que afectan directamente montos (no solo organización de
   código): fórmula de Gratificación (5.8), rango `L44` vs `C50` en `GG. FIJOS` (5.2), y el origen
   del cargo adicional de ITF (5.4).
2. Definir si `PLAN COVID` (Componente III) debe quedar como módulo activable en el sistema nuevo
   o descartarse si el negocio ya no lo usa en proyectos actuales.
3. Implementar primero `lib/calculo/` (funciones puras) con tests unitarios que comparen contra
   los valores de este Excel, **antes** de construir los componentes de UI — así cualquier
   desviación se detecta en el motor, no en la pantalla.
4. Una vez estable el motor, conectar con "Verificación del Valorizado" para tener un solo panel
   de comprobación que cubra ambos workbooks (cronograma valorizado + gastos generales) del mismo
   proyecto.
