# Plan de Automatización — Hoja "cronograma valorizado"

> Fuente analizada: `CRONOGRAMA_VALORIZADO_.xlsx`, hoja **"cronograma valorizado"** (A1:AV90).
> Objetivo del documento: dejar **todas** las fórmulas desagregadas, explicar la funcionalidad de
> cada bloque, marcar qué es editable (amarillo/rojo) y qué es "basura"/legado, y proponer el
> modelo de datos + motor de cálculo para portarlo a **React + TypeScript**, de forma que puedas
> verificarlo contra lo que ya tienen construido.

---

## 1. Resumen ejecutivo

La hoja es un **presupuesto valorizado por partidas, con distribución mensual (curva de avance)**.
Tiene 3 grandes bloques:

1. **Partidas del expediente técnico** (filas 9–27): estructura jerárquica de ítems (1, 1.1, 1.1.1,
   1.1.1.1…) con metrado, precio, parcial, y su reparto en columnas mensuales (MES 1…MES 15).
2. **Bloque de totales y "cargas" sobre el Costo Directo** (filas 28–33): Gastos Generales, Utilidad,
   IGV → arma el "Presupuestado de Obra Infraestructura".
3. **Componentes adicionales editables** (filas 34–44), que es lo que preguntas:
   - **Amarillos (34–37):** se **suman** al Presupuestado de Obra (fila 33) para armar el
     "PRESUPUESTO SUB TOTAL" (fila 38). Son *ítems agregables/quitables*, cada uno con su propio
     monto total y su propia lógica de reparto mensual.
   - **Rojos (39–42, 44):** son **porcentajes aplicados sobre una base** (F38 o F43) que también se
     suman en cascada hasta el "PRESUPUESTO TOTAL" final (fila 45). También son ítems
     agregables/quitables.
4. Filas de avance (46–47) y columnas ocultas de verificación (V, X, Z).
5. **Zona muerta/legada** (columnas AA–AK, y filas 49–90): fórmulas rotas (`#REF!`) o tablas
   duplicadas de una versión anterior del archivo (5 meses en vez de 15). **No se debe portar.**

---

## 2. Estructura general (columnas)

| Columna | Contenido | Rol |
|---|---|---|
| A | Código de ítem (1, 1.1, 1.1.1…) o etiqueta de fila de totales | Identificador jerárquico |
| B | Descripción | Texto |
| C | Unidad (und, m², mes, gbl…) | Metadata |
| D | Metrado (o % en filas de totales, ej. D29=10%) | Input numérico |
| E | Precio unitario | Input numérico |
| F | Parcial = `D*E` (en partidas) / fórmula de total (en filas de resumen) | Calculado |
| G…U | MES 1 … MES 15 (15 columnas de reparto mensual) | Input numérico (partidas) / calculado (totales) |
| V | Total verificado = suma de G:U | Verificación |
| W, X, Y, Z | Columnas **ocultas** de control: diferencia (X), bandera OK/mal (Z) | Verificación, no se muestran al usuario final |
| AA…AK | Tabla **legada** (otra versión del cronograma, 5 meses) | **No usar** — dejar fuera del sistema nuevo |

> Nota: en las partidas, F debería ser `=D*E`, pero en el archivo actual F12…F27 están
> **hardcodeados como número**, no como fórmula (`F12=998.65`, no `=D12*E12`). Aunque
> matemáticamente coincide con D*E, si tu automatización va a permitir editar metrado/precio,
> **Parcial debe recalcularse siempre como `metrado * precioUnitario`**, no copiarse tal cual del
> Excel.

---

## 3. Modelo jerárquico de partidas (filas 9–27)

Ejemplo de estructura (nivel por cantidad de segmentos en el código):

```
1        OBRAS PROVISIONALES...              (nivel 1 - capítulo)
 1.1     OBRAS PROVISIONALES Y TRAB. PRELIM. (nivel 2 - sub-capítulo)
  1.1.1  CONSTRUCCIONES PROVISIONALES        (nivel 3 - sub-sub-capítulo)
   1.1.1.1 CARTEL DE IDENTIFICACION...       (nivel 4 - partida con metrado/precio)
   1.1.1.2 PERFILADO Y COMPACTACION...
   ...
  1.1.2  INSTALACIONES PROVISIONALES
  1.1.3  TRABAJOS PRELIMINARES
  1.1.4  MOVILIZACIÓN Y DESMOVILIZACIÓN...
```

- Los **nodos padre** (niveles 1–3, ej. fila 9, 10, 11, 21, 24, 26) **no tienen** D/E/F propios;
  su columna V se calcula igual (`SUM(G:U)` de esa fila), pero esas filas de mes suelen estar
  vacías salvo cuando el padre agrupa directamente partidas sin nietos.
- Los **nodos hoja** (nivel 4, ej. fila 12) sí tienen Metrado (D), Precio (E), Parcial (F), y
  reparto mensual real en G:U.
- **Importante para el modelo de datos:** el Excel NO usa `SUM` de hijos para totalizar un padre
  — cada partida hoja escribe su propio monto en la columna del mes que corresponde, y el padre
  simplemente sería, si se quisiera, la suma de sus hijos. En este archivo el padre no tiene
  fórmula de agregación visible en G:U (están vacías), solo V (fila 9, 10, 11, etc.) hace
  `SUM(G9:U9)`. Es decir: **en la data real, el "monto" de un padre debería ser la suma de sus
  hijos**, y eso hay que reconstruirlo en el sistema nuevo (el Excel actual no lo automatiza bien,
  lo cual es justo un candidato a mejora).

### 3.1 Fórmulas por partida (fila tipo, ejemplo fila 12)

| Celda | Fórmula | Significado |
|---|---|---|
| F12 | *(hardcode, debería ser `=D12*E12`)* | Parcial = Metrado × Precio |
| G12…U12 | input manual (número o vacío) | Monto valorizado de esa partida en ese mes |
| V12 | `=+IF(SUM(G12:U12)>0,SUM(G12:U12),\" \")` | Total mensualizado; si es 0 muestra un espacio (string) en vez de 0 |
| X12 | `=+F12-V12` | Diferencia entre Parcial y la suma de meses (debe ser 0) |
| Z12 | `=+IF(V12=F12,\"OK\",\"TA MAL ALGODÓN\")` | Bandera de verificación en texto |

**Regla de negocio implícita:** la suma de los montos mensuales (G:U) de una partida **debe
coincidir exactamente** con su Parcial (F). Esta es la validación central que hoy se hace con
columnas X/Z, y que en el sistema nuevo se debe hacer como una regla de validación explícita
(no como columnas ocultas).

---

## 4. Fila 28 — COSTO DIRECTO

```
F28 = SUM(F12:F27)              -> suma de los Parciales de las partidas hoja
G28 = SUM(G9:G27)                -> OJO: acá SÍ suma desde la fila 9 (nivel padre) hasta 27
H28 = SUM(H9:H27)
... (igual para I..U)
V28 = ROUND(SUM(V9:V27), 2)
```

**Inconsistencia detectada:** F28 suma solo las filas hoja (12:27), pero G28:U28 suman **desde la
fila 9** (que incluye nodos padre). Si los nodos padre alguna vez tuvieron valores propios en G:U
(no derivados de sus hijos), esto duplicaría montos. Con los datos actuales los padres están vacíos
en G:U así que no hay doble conteo, pero es un riesgo si se llenan celdas de fila padre por error.
**Recomendación para el sistema nuevo:** el Costo Directo mensual = suma de **solo las partidas
hoja** (nivel más profundo), nunca de nodos intermedios, para evitar este riesgo estructuralmente.

---

## 5. Filas 29–33 — Cargas sobre el Costo Directo

### 5.1 Gastos Generales (fila 29)
```
D29 = 10%                                  (input editable)
F29 = ROUND(D29 * F28, 2)                  -> monto total de gastos generales
G29 = G28 / F28 * F29                      -> reparto proporcional al peso del mes en el Costo Directo
H29 = H28 / F28 * F29
... (mismo patrón para I..U)
V29 = ROUND(SUM(G29:U29), 2)
```

### 5.2 Utilidad (fila 30) — MISMO patrón que Gastos Generales
```
D30 = 10%
F30 = ROUND(D30 * F28, 2)
G30..U30 = (columna28 / F28) * F30         -> reparto proporcional al Costo Directo
V30 = ROUND(SUM(G30:U30), 2)
```

### 5.3 Sub Total (fila 31)
```
F31 = ROUND(SUM(F28:F30), 2)               -> Costo Directo + Gastos Generales + Utilidad
G31..U31 = SUM(columna28:columna30)        -> suma vertical simple mes a mes
V31 = ROUND(SUM(G31:U31), 2)
```

### 5.4 I.G.V. (fila 32)
```
D32 = 18%
F32 = ROUND(D32 * F31, 2)
G32..U32 = (columna31 / F31) * F32         -> reparto proporcional al Sub Total
   -> con ajustes manuales de redondeo: K32 y L32 tienen "+0.01", T32 y U32 tienen "-0.01"
V32 = ROUND(SUM(G32:U32), 2)
```

> **Ajustes de redondeo manuales (K, L, T, U):** son "parches" a mano para que la suma mensual
> cuadre exactamente con el total anual, porque el reparto proporcional con `ROUND` acumula
> diferencias de centavos. En el sistema nuevo esto se resuelve con un **algoritmo de reparto con
> ajuste de residuo** (ver sección 8.4), no con parches fila por fila.

### 5.5 Presupuestado de Obra Infraestructura (fila 33)
```
F33 = ROUND(SUM(F31:F32), 2)               -> Sub Total + IGV
G33..U33 = SUM(columna31:columna32)
V33 = ROUND(SUM(G33:U33), 2)
```

Este es el "presupuesto base de la obra" antes de los componentes amarillos/rojos.

---

## 6. Filas 34–37 — COMPONENTES **AMARILLOS** (editables, suman al subtotal)

Confirmado por color de relleno (`FFFFFF00` = amarillo) en columna A. Estos 4 ítems son
**agregables y quitables**, cada uno con:
- Un **nombre/descripción** (columna A)
- Opcionalmente un **% base** (columna D, no todos lo usan)
- Un **monto total** (columna F) — a veces hardcode, a veces fórmula
- Una **regla de reparto mensual** (columnas G:U) — varía por ítem, no es uniforme

| Fila | Concepto | F (monto total) | Reparto mensual | Observación |
|---|---|---|---|---|
| 34 | Elaboración del expediente técnico | Hardcode: `183731.9` | Todo en el Mes 1: `G34 = 183731.9` | Costo puntual, no proporcional |
| 35 | Financiamiento de la supervisión de la elaboración del expediente técnico | Hardcode: `131941.7` | Todo en el Mes 1: `G35 = F35` | Costo puntual |
| 36 | Financiamiento de la supervisión de la ejecución de la obra | `D36=3.6%`, pero **F36 hardcode**: `811470.66` (no hay `=D36*algo` visible) | Proporcional al Costo Directo: `G36..U36 = (columna28/F28) * F36` | Igual patrón que Gastos Generales/Utilidad |
| 37 | Gastos de liquidación de la obra | Hardcode: `37000` | Proporcional al Costo Directo: `G37..U37 = (columna28/F28) * F37` | — |

```
V34..V37 = ROUND(SUM(G:U de esa fila), 2)   -> verificación individual
```

**Fila 38 — PRESUPUESTO SUB TOTAL (donde "afectan al subtotal"):**
```
F38 = ROUND(SUM(F33:F37), 2)                -> Presupuestado de Obra + los 4 amarillos
G38..U38 = ROUND(SUM(columna33:columna37 de ese mes), 2)
V38 = ROUND(SUM(G38:U38), 2)
```

**Regla de negocio clave para "amarillo":**
> Cualquier fila amarilla nueva que agregues debe: (a) tener un monto total F, (b) tener una regla
> de reparto mensual (puntual en un mes, proporcional al Costo Directo, o proporcional al Sub
> Total — hay que decidir por ítem), y (c) **su fila debe entrar en el `SUM(F33:F37)` de la fila
> 38** (o el rango equivalente si agregas/quitas filas). Si quitas un ítem amarillo, simplemente
> sale del rango de suma.

---

## 7. Filas 39–44 — COMPONENTES **ROJOS** (editables, % sobre una base)

Confirmado por color `FFFF0000` (rojo) en columna A, filas 39, 40, 41, 42 y 44 (la fila 43 y 45
son totales, no son "rojas" en sí, son resultado).

| Fila | Concepto | D (%) | F (fórmula) | Base sobre la que aplica | Reparto mensual |
|---|---|---|---|---|---|
| 39 | Coordinación | 1.00% | `=D39*F38` | Presupuesto Sub Total (F38) | `(columna28/F28)*F39` — proporcional al Costo Directo |
| 40 | Gestión administrativa | 2.08% | `=D40*F38` | F38 | ídem |
| 41 | Gastos de sensibilización y difusión | 0.33% | `=D41*F38` | F38 | ídem |
| 42 | Controversias y peritajes | 0.23% | `=D42*F38` | F38 | ídem |
| **43** | **PRESUPUESTO TOTAL** (subtotal intermedio) | — | `=ROUND(SUM(F38:F42),2)` | — | `=ROUND(SUM(columna38:columna42),2)` |
| 44 | Control Concurrente (etiqueta dice 0.6%, pero D44=0.5%) | 0.50% (inconsistente con la etiqueta) | **Hardcode** `125884.57` (no hay `=D44*F43`) | conceptualmente F43 | `(columna28/F28)*F44` |
| **45** | **PRESUPUESTO TOTAL** (final) | — | `=ROUND(SUM(F43:F44),2)` | — | `=SUM(columna43:columna44)` |

**Regla de negocio clave para "rojo":**
> Los ítems rojos 39–42 son **porcentaje × F38** (Presupuesto Sub Total, es decir, DESPUÉS de los
> amarillos). La fila 44 rompe el patrón: está hardcodeada en vez de ser `=D44*F43`, y su etiqueta
> (0.6%) no coincide con el valor real de D44 (0.5%). **Esto es un bug/inconsistencia del Excel
> original** que hay que decidir cómo resolver en el sistema nuevo:
> - Opción A (recomendada): normalizar todos los rojos a `monto = %  × base`, siendo la base
>   configurable por ítem (F38 para 39–42, F43 para 44), y **eliminar los hardcodes**.
> - Opción B: mantener compatibilidad exacta con el Excel actual replicando el hardcode como
>   "override manual" opcional por ítem (útil si el negocio a veces necesita forzar un monto que
>   no siga la fórmula).
>
> Cualquiera de las dos debe quedar explícita en el modelo de datos (ver sección 8.2, campo
> `montoOverride`).

---

## 8. Filas 46–47 — Avance

```
Fila 46 (AVANCE MENSUAL):   G46 = G45 / $F$45   ... U46 = U45 / $F$45
Fila 47 (AVANCE ACUMULADO): G47 = G46
                             H47 = G47 + H46
                             I47 = H47 + I46
                             ... (acumulado progresivo mes a mes)
```

Esto es el **% de avance físico-financiero mensual y acumulado** respecto al Presupuesto Total
final (F45). Es 100% derivado — no requiere inputs nuevos, solo depende de todo lo anterior.

---

## 9. Columnas de verificación (V, X, Z) — patrón repetido

Estas tres columnas se repiten en **cada fila** de partida y de totales:

- **V** = total mensualizado real: `IF(SUM(mensual)>0, SUM(mensual), " ")`
- **X** = diferencia: `Parcial(F) - V` → debería ser 0
- **Z** = bandera textual: `IF(V=F, "OK", "TA MAL ALGODÓN")`

**Para el sistema nuevo, esto se traduce a una función de validación pura** (no a columnas):
`validarFila(partida): { ok: boolean; diferencia: number }`, ejecutable sobre cualquier fila
(partida, capítulo o fila de resumen), en vez de fórmulas de Excel replicadas celda por celda.

---

## 10. Zona **legada / muerta** — NO portar

1. **Columnas AA–AK (filas 9–27):** una tabla paralela con las mismas descripciones pero con **5
   meses** (AB:AF) en vez de 15, y columnas AG:AK que comparan contra la tabla nueva (`=Q9-AB9`,
   etc.). Es evidencia de una versión anterior del cronograma que quedó pegada al archivo. No tiene
   ninguna fórmula activa que dependa de ella hacia adelante (nada en la fila 28+ la referencia).
2. **Filas 49–71 y 77–89:** mezcla de:
   - Una tabla de resumen "COTOS/AVANSE" (sic, con errores de tipeo) por trimestre, que solo
     reordena datos ya calculados (filas 53–57), pero a partir de la fila 58 en adelante **todas
     las fórmulas son `#REF!`** (referencias rotas, probablemente a una hoja o columnas que se
     borraron).
   - Fila 71: `=G33+#REF!+#REF!` — rota.
   - Filas 77–81: sumas rotas (`SUM(#REF!)`) y cálculos sueltos sin relación aparente
     (`=5000/30`, `=100+J81`) que parecen pruebas o restos de otro cálculo.
   - Filas 88–89: dos números sueltos con una resta (`W89=F28-W88`), sin contexto ni etiqueta.
3. **Fila 8, columna AT** y celdas sueltas como `AT5='.'`: basura de formato, ignorar.

**Recomendación:** documentar esto como "deuda técnica detectada en el Excel origen" y **no
replicar ninguna fórmula con `#REF!` ni la tabla AA–AK** en el sistema nuevo. Si tu build actual sí
las está replicando, ese es justamente uno de los puntos a revisar (ver checklist final).

---

## 11. Dependencias externas (fuera de esta hoja, pero a tener en cuenta)

El archivo tiene 3 hojas más que **leen datos de "cronograma valorizado"**:

- **GAUSS**: `B2`, `B3`, `B4`, `B5` y `C31` referencian directamente celdas de cabecera
  (proyecto, unidad ejecutora, código, ubicación, plazo) de esta hoja.
- **CURVA S**: mismo patrón, referencias de cabecera (`B2:B5`, `D39`).
- **Desembolso**: **19 fórmulas** referencian esta hoja (la de mayor acoplamiento). No se
  analizaron en detalle en este documento porque el pedido es sobre "cronograma valorizado", pero
  si van a automatizar todo el sistema, **Desembolso probablemente consume el reparto mensual (fila
  28, 31, 33, 38, 43, 45) para armar un flujo de caja/desembolsos**. Vale la pena un análisis
  aparte antes de dar por cerrado el modelo de datos, porque esas 19 fórmulas pueden revelar campos
  que esta hoja no expone directamente (ej. desagregación por fuente de financiamiento).

---

## 12. Modelo de datos propuesto (TypeScript)

```typescript
// --- Partidas jerárquicas (filas 9-27) ---
interface Partida {
  id: string;                 // ej. "1.1.1.1"
  nivel: number;               // profundidad jerárquica (1..4), derivado del id
  padreId: string | null;
  descripcion: string;
  unidad?: string;             // solo en hojas (nivel 4)
  metrado?: number;            // solo en hojas
  precioUnitario?: number;     // solo en hojas
  distribucionMensual: number[]; // longitud = cantidad de meses del proyecto (hoy 15)
}

// Campos DERIVADOS (no se guardan, se calculan):
// parcial = metrado * precioUnitario   (solo hojas)
// totalMensualizado = sum(distribucionMensual)
// diferencia = parcial - totalMensualizado
// esValido = diferencia === 0
// Para nodos padre: parcial y distribucionMensual = suma de los hijos directos

// --- Componentes editables (amarillos y rojos) ---
type BaseCalculo =
  | { tipo: "montoFijo" }                         // el usuario define F directamente
  | { tipo: "porcentajeDeCostoDirecto" }           // % * F28
  | { tipo: "porcentajeDePresupuestoSubTotal" }    // % * F38  (rojos 39-42)
  | { tipo: "porcentajeDePresupuestoTotal" };      // % * F43  (rojo 44)

type ReglaReparto =
  | { tipo: "puntual"; mes: number }                  // todo el monto en un mes (ej. filas 34-35)
  | { tipo: "proporcionalCostoDirecto" }              // reparto = (Gm28/F28) * monto  (36, 37, 39-42, 44)
  | { tipo: "proporcionalSubTotal" }                  // reparto = (Gm31/F31) * monto  (equivalente al de IGV)
  | { tipo: "manual"; valores: number[] };            // input directo por mes

interface ComponenteAdicional {
  id: string;
  categoria: "amarillo" | "rojo";
  nombre: string;
  porcentaje?: number;         // input editable si baseCalculo no es "montoFijo"
  baseCalculo: BaseCalculo;
  montoOverride?: number;      // si está presente, IGNORA baseCalculo y usa este valor directo
                                // (para replicar los hardcodes detectados: F34, F35, F36, F37, F44)
  reglaReparto: ReglaReparto;
  orden: number;                // posición dentro de su categoría (para respetar el orden de suma)
}

// --- Estructura completa del presupuesto ---
interface CronogramaValorizado {
  meses: number;                 // hoy 15, debe ser configurable
  partidas: Partida[];           // árbol de partidas
  gastosGenerales: { porcentaje: number };  // 10%, fila 29
  utilidad: { porcentaje: number };         // 10%, fila 30
  igv: { porcentaje: number };              // 18%, fila 32
  componentesAmarillos: ComponenteAdicional[]; // filas 34-37 (agregable/quitable)
  componentesRojos: ComponenteAdicional[];     // filas 39-42, 44 (agregable/quitable)
}
```

---

## 13. Motor de cálculo (funciones puras, orden de ejecución)

```typescript
// 1. Costo Directo
costoDirecto.total = sum(partidasHoja.map(p => p.metrado * p.precioUnitario));
costoDirecto.mensual[mes] = sum(partidasHoja.map(p => p.distribucionMensual[mes]));

// 2. Gastos Generales y Utilidad (mismo patrón: % del Costo Directo, reparto proporcional al CD)
gastosGenerales.total = round(gastosGenerales.porcentaje * costoDirecto.total, 2);
gastosGenerales.mensual[mes] = (costoDirecto.mensual[mes] / costoDirecto.total) * gastosGenerales.total;
// idem utilidad

// 3. Sub Total = CD + GG + Utilidad
subTotal.total = round(costoDirecto.total + gastosGenerales.total + utilidad.total, 2);
subTotal.mensual[mes] = costoDirecto.mensual[mes] + gastosGenerales.mensual[mes] + utilidad.mensual[mes];

// 4. IGV = % del Sub Total, reparto proporcional al Sub Total (con ajuste de residuo, ver 8.4)
igv.total = round(igv.porcentaje * subTotal.total, 2);
igv.mensual = repartoProporcionalConAjuste(subTotal.mensual, subTotal.total, igv.total);

// 5. Presupuestado de Obra = Sub Total + IGV
presupuestadoObra.total = round(subTotal.total + igv.total, 2);
presupuestadoObra.mensual[mes] = subTotal.mensual[mes] + igv.mensual[mes];

// 6. Cada componente AMARILLO se resuelve individualmente:
for (const c of componentesAmarillos) {
  c.montoTotal = c.montoOverride ?? calcularBase(c.baseCalculo, { costoDirecto, subTotal, presupuestoSubTotal: null });
  c.montoMensual = calcularReparto(c.reglaReparto, c.montoTotal, { costoDirecto, subTotal });
}

// 7. Presupuesto Sub Total = Presupuestado de Obra + SUMA de todos los amarillos activos
presupuestoSubTotal.total = round(presupuestadoObra.total + sum(componentesAmarillos.map(c => c.montoTotal)), 2);
presupuestoSubTotal.mensual[mes] = presupuestadoObra.mensual[mes] + sum(componentesAmarillos.map(c => c.montoMensual[mes]));

// 8. Cada componente ROJO (39-42) se calcula sobre presupuestoSubTotal.total; el especial (44) sobre presupuestoTotalIntermedio.total
for (const c of componentesRojos.filter(c => c.baseCalculo.tipo === "porcentajeDePresupuestoSubTotal")) {
  c.montoTotal = c.montoOverride ?? round(c.porcentaje * presupuestoSubTotal.total, 2);
  c.montoMensual = calcularReparto(c.reglaReparto, c.montoTotal, { costoDirecto });
}

// 9. Presupuesto Total (intermedio) = Presupuesto Sub Total + suma de rojos tipo "porcentajeDePresupuestoSubTotal"
presupuestoTotalIntermedio.total = round(presupuestoSubTotal.total + sum(...), 2);

// 10. Componente rojo especial (Control Concurrente, fila 44) sobre presupuestoTotalIntermedio.total
// 11. Presupuesto Total FINAL = intermedio + control concurrente
presupuestoTotalFinal.total = round(presupuestoTotalIntermedio.total + controlConcurrente.montoTotal, 2);

// 12. Avance mensual y acumulado
avanceMensual[mes] = presupuestoTotalFinal.mensual[mes] / presupuestoTotalFinal.total;
avanceAcumulado[mes] = avanceAcumulado[mes-1] + avanceMensual[mes]; // avanceAcumulado[0] = avanceMensual[0]
```

### 13.1 Reparto proporcional con ajuste de residuo (reemplaza los parches +0.01/-0.01)

```typescript
function repartoProporcionalConAjuste(pesos: number[], totalPesos: number, montoTotal: number): number[] {
  const bruto = pesos.map(p => (p / totalPesos) * montoTotal);
  const redondeado = bruto.map(v => round(v, 2));
  const diferencia = round(montoTotal - sum(redondeado), 2);
  if (diferencia !== 0) {
    // ajustar el mes con mayor peso (o el último mes con monto > 0) en vez de parchar filas fijas
    const idx = indexOfMax(pesos);
    redondeado[idx] = round(redondeado[idx] + diferencia, 2);
  }
  return redondeado;
}
```

Esto reemplaza de forma **genérica y auditable** los ajustes manuales que el Excel tiene
hardcodeados en celdas específicas (K32, L32, T32, U32, U38, R43…), que se romperían apenas
cambien los montos o la cantidad de meses.

---

## 14. UI / edición — reglas para "agregar y quitar" amarillos y rojos

- Cada componente (amarillo o rojo) debe ser una **fila de una lista editable**, no una celda fija.
- Al **agregar** un componente amarillo: se le pide nombre, tipo de base (monto fijo o %),
  regla de reparto (puntual en un mes / proporcional al Costo Directo / proporcional al Sub Total),
  y automáticamente entra en la suma de `presupuestoSubTotal`.
- Al **agregar** un componente rojo: mismo flujo, pero además se debe elegir la **base** (Presupuesto
  Sub Total o Presupuesto Total intermedio), porque en el Excel original no todos usan la misma base
  (39–42 usan F38, 44 usa F43).
- Al **quitar** cualquiera de los dos: simplemente sale del arreglo `componentesAmarillos` /
  `componentesRojos`, y el motor de cálculo (que suma sobre el arreglo, no sobre un rango fijo de
  celdas) se ajusta solo — a diferencia del Excel, donde borrar una fila obliga a editar los
  rangos `SUM()` a mano.
- **Validación obligatoria en la UI:** por cada partida y por cada fila de resumen, mostrar el
  equivalente a la columna Z (`OK` / `diferencia ≠ 0`), calculado con la función de validación de
  la sección 9 — no como texto literal "TA MAL ALGODÓN" (typo del original), sino con un mensaje
  claro tipo "El reparto mensual no coincide con el total: diferencia de S/ X.XX".

---

## 15. Checklist para verificar lo que ya tienen construido

Usa esto como lista de chequeo contra el sistema React/TS existente:

- [ ] ¿El Parcial de cada partida se recalcula como `metrado × precioUnitario`, o quedó
      hardcodeado como en el Excel original (F12…F27)?
- [ ] ¿El Costo Directo mensual se calcula sumando **solo partidas hoja**, o corre el riesgo de
      doble conteo si algún nodo padre tiene datos mensuales propios (como pasa en G28:U28 del
      Excel, que suma desde la fila 9)?
- [ ] ¿Gastos Generales y Utilidad reparten proporcionalmente al **Costo Directo** (no al Sub
      Total)?
- [ ] ¿El IGV reparte proporcionalmente al **Sub Total** (no al Costo Directo)?
- [ ] ¿Los 4 componentes amarillos (34–37) están implementados como una **lista editable**, y no
      como 4 filas fijas? ¿Reproducen correctamente que 34 y 35 son "puntuales al mes 1" mientras
      36 y 37 son "proporcionales al Costo Directo"?
- [ ] ¿"Presupuesto Sub Total" (F38) suma Presupuestado de Obra + **todos** los amarillos activos
      (no un rango fijo `F33:F37`)?
- [ ] ¿Los componentes rojos 39–42 calculan `% × Presupuesto Sub Total (F38)`, y no `% × Costo
      Directo` ni `% × Presupuesto Total`?
- [ ] ¿El componente rojo 44 (Control Concurrente) usa como base el **Presupuesto Total
      intermedio (F43)**, distinto de la base de los otros rojos?
- [ ] ¿Se identificó que la etiqueta de la fila 44 dice "0.6%" pero el valor real usado es 0.5%?
      ¿Cuál de los dos se implementó?
- [ ] ¿Existe algún reparto proporcional al Costo Directo o Sub Total que use `+0.01`/`-0.01`
      fijos en meses específicos (como el Excel), en vez de un algoritmo de ajuste de residuo
      genérico?
- [ ] ¿Se excluyó del sistema nuevo la tabla legada (columnas AA–AK) y las fórmulas rotas
      (`#REF!`) de las filas 49–90?
- [ ] ¿La cantidad de meses (hoy 15) está hardcodeada en el código, o es configurable por
      proyecto (dato relevante si van a reusar esto para otros presupuestos con diferente plazo)?
- [ ] ¿Existe una validación por partida (equivalente a columna Z) visible en la UI, o solo se
      valida el total general?
- [ ] Si ya integraron la hoja "Desembolso": ¿qué celdas de "cronograma valorizado" consume?
      (recomendado documentarlo aparte, dado el acoplamiento de 19 fórmulas detectado).

---

## 16. Hojas relacionadas — fórmulas **tal cual** (GAUSS, CURVA S, Desembolso)

Extracción literal de cada celda con fórmula de las 3 hojas que dependen de "cronograma
valorizado", para que puedas comparar celda por celda contra lo que ya tienen construido.

### 16.1 Hoja "GAUSS"

No tiene motor de cálculo propio: son 4 celdas de cabecera + 1 gráfico de barras embebido.

| Celda | Fórmula / contenido | Qué trae |
|---|---|---|
| A1 | `"GRAFICA DE GAUSS"` | Título fijo |
| B2 | `='cronograma valorizado'!A2:V2` | Nombre del proyecto |
| B3 | `='cronograma valorizado'!B3` | Unidad ejecutora |
| B4 | `='cronograma valorizado'!B4` | Código único |
| B5 | `='cronograma valorizado'!B5` | Ubicación |
| C31 | `='cronograma valorizado'!B6` | Plazo de ejecución |

**Gráfico embebido (BarChart):**
- Serie de valores: `'cronograma valorizado'!$G$43:$U$43` → **fila 43 = PRESUPUESTO TOTAL
  mensual** (el subtotal intermedio, antes de sumar Control Concurrente).
- Categorías (eje X): `'cronograma valorizado'!$G$7:$U$8` → etiquetas "MES 1"…"MES 15".

> No hay ninguna otra celda ni fórmula. Toda la hoja es: cabecera + 1 gráfico de barras del
> presupuesto total mensual (fila 43, **no** la fila 45 final).

### 16.2 Hoja "CURVA S"

Mismo patrón que GAUSS: solo cabecera + 1 gráfico.

| Celda | Fórmula / contenido | Qué trae |
|---|---|---|
| A1 | `"CURVA S"` | Título fijo |
| B2 | `='cronograma valorizado'!B2:V2` | Nombre del proyecto |
| B3 | `='cronograma valorizado'!B3` | Unidad ejecutora |
| B4 | `='cronograma valorizado'!B4` | Código único |
| B5 | `='cronograma valorizado'!B5` | Ubicación |
| D39 | `='cronograma valorizado'!B6` | Plazo de ejecución |

**Gráfico embebido (LineChart):**
- Serie de valores: `'cronograma valorizado'!$G$47:$U$47` → **fila 47 = AVANCE ACUMULADO** mensual
  (%, ya expresado como fracción acumulada del Presupuesto Total **final**, fila 45).
- Categorías (eje X): `'cronograma valorizado'!$G$7:$U$8` → mismas etiquetas de mes.

> Nota de coherencia: GAUSS grafica montos en soles de la fila 43 (subtotal intermedio),
> mientras que CURVA S grafica el % acumulado (fila 47) que está calculado sobre la fila 45
> (total final, que incluye Control Concurrente). Si al automatizar ambos gráficos deben
> "hablar de lo mismo", conviene decidir si GAUSS debería graficar la fila 45 en vez de la 43 —
> hoy en el Excel original **no coinciden en su base**.

### 16.3 Hoja "Desembolso" — Cronograma de Desembolsos

Esta es la única de las tres con motor de cálculo propio (154 fórmulas). Modela **adelantos +
valorizaciones + desembolsos** a partir de la data de "cronograma valorizado", con periodos de 30
días (no meses calendario).

#### Cabecera (filas 1–5)

| Celda | Fórmula | Qué trae |
|---|---|---|
| C2 | `='cronograma valorizado'!B3` | Nombre del proyecto *(ojo: usa B3, que en cronograma valorizado es "Unidad Ejecutora", no el nombre del proyecto — posible copy-paste error en el Excel original, verificar)* |
| C3 | `='cronograma valorizado'!B5` | Ubicación |
| C4 | `='cronograma valorizado'!F33` | **Presupuesto de Obra = fila 33 (Presupuestado de Obra Infraestructura), NO la fila 45 (Presupuesto Total final)** |
| D4 | `"I/IGV"` | Etiqueta fija ("incluye IGV") |
| C5 | `='cronograma valorizado'!B6` | Plazo de ejecución |

> **Hallazgo clave:** el "Presupuesto de Obra" que usa Desembolso (`C4`) es la fila **33**, es
> decir **antes** de sumar los componentes amarillos (34–37) y rojos (39–42, 44). Si tu
> automatización asumió que Desembolso trabaja sobre el Presupuesto Total final (F45), **hay que
> corregirlo**: el Excel original usa F33 como base para calcular adelantos y % de desembolso.

#### Encabezados de tabla (filas 7–8)

```
B7 "CALENDARIO"
C7 "ADELANTOS"        (merge C7:E7)
F7 "VALORIZACION"      (merge F7:G7)
H7 "DESEMBOLSOS Inc/Igv" (merge H7:I7)

C8 "EFECTIVO 10% (1)"
D8 "MATERIALES 20% (2)"
E8 "TOTAL (1+2)"
F8 "PARCIAL PRESUPUESTO"
G8 "% AVANCE"
H8 "MONTO DESEMBOLSO"
I8 "% DE DESEMBOLSO"
```

#### Fila 9 — Adelanto inicial (periodo 0, antes de la primera valorización)

```
B9 = 0                                      -> día 0 del calendario
C9 = ROUND($C$4 * 0.1, 4)                   -> Adelanto Directo/Efectivo = 10% del Presupuesto de Obra (F33)
D9 = ROUND($C$4 * 0.2, 4)                   -> Adelanto de Materiales = 20% del Presupuesto de Obra (F33)
E9 = C9 + D9                                -> Total de adelantos
H9 = E9                                     -> Monto de desembolso del periodo 0 = el total de adelantos
I9 = H9 / $C$4                              -> % de desembolso respecto al Presupuesto de Obra
J9 = "*"                                    -> marca de nota al pie (footnote), columna oculta
```

> El **10%** y el **20%** están **hardcodeados dentro de la fórmula** (`0.1`, `0.2`), no en una
> celda de input aparte. Corresponden al Art. 155° del Reglamento de la Ley de Contrataciones del
> Estado (ver nota en B31). **Para el sistema nuevo, estos dos porcentajes deben ser parámetros
> configurables**, no constantes en código, porque la normativa puede cambiar o el proyecto puede
> pactar otros porcentajes de adelanto.

#### Filas 10–24 — Periodos de 30 días (15 periodos, igual a los 15 meses del cronograma)

Patrón idéntico en cada fila (se muestra la fila 10, el resto solo cambia el número de fila y la
columna de "cronograma valorizado" que referencia en M):

```
B10 = B9 + 30                               -> calendario: cada periodo suma 30 días al anterior
M10 = 'cronograma valorizado'!G49           -> trae el valor mensual de la fila 49 de cronograma valorizado
F10 = M10                                   -> "Parcial Presupuesto" del periodo = ese valor mensual
C10 = ROUND(F10 * 0.1, 4)                   -> Amortización del adelanto efectivo: 10% de la valorización del periodo
D10 = ROUND(F10 * 0.2, 4)                   -> Amortización del adelanto de materiales: 20% de la valorización del periodo
E10 = C10 + D10                             -> Total amortizado en el periodo
G10 = F10 / $C$4                            -> % de avance del periodo respecto al Presupuesto de Obra
H10 = F10 - E10                             -> Desembolso neto = Valorización del periodo MENOS lo amortizado de adelantos
I10 = H10 / $C$4                            -> % de desembolso del periodo
```

**Mapeo completo de la columna M (fila 10 a 24) → fila 49 de "cronograma valorizado":**

| Fila Desembolso | Celda referenciada en cronograma valorizado | Mes que representa |
|---|---|---|
| M10 | G49 | Mes 1 |
| M11 | H49 | Mes 2 |
| M12 | I49 | Mes 3 |
| M13 | J49 | Mes 4 |
| M14 | K49 | Mes 5 |
| M15 | L49 | Mes 6 |
| M16 | M49 | Mes 7 |
| M17 | N49 | Mes 8 |
| M18 | O49 | Mes 9 |
| M19 | P49 | Mes 10 |
| M20 | Q49 | Mes 11 |
| M21 | R49 | Mes 12 |
| M22 | S49 | Mes 13 |
| M23 | T49 | Mes 14 |
| M24 | U49 | Mes 15 |

> Recordar de la sección 10: **la fila 49 de "cronograma valorizado" es solo un espejo de la fila
> 33** (`G49=SUM(G33)`, `H49=SUM(H33)`, …). Es decir, Desembolso **no** necesita esa fila
> intermedia — en el sistema nuevo puede leer directamente `presupuestadoObra.mensual[mes]`
> (equivalente a la fila 33), sin replicar la fila 49 como paso separado.

#### Fila 25 — PARCIAL (fila de control/cierre)

```
C25 = C9 - SUM(C10:C24)          -> saldo de adelanto efectivo NO amortizado (debería tender a 0 al final del plazo)
D25 = D9 - SUM(D10:D24)          -> saldo de adelanto de materiales NO amortizado
E25 = E9 - SUM(E10:E24)          -> saldo total de adelantos no amortizado
F25 = SUM(F10:F24)               -> suma de todas las valorizaciones parciales (debería = C4, el Presupuesto de Obra)
G25 = SUM(G10:G24)               -> suma de % de avance (debería tender a 100%)
H25 = SUM(H9:H24)                -> total desembolsado (adelanto inicial + todos los desembolsos netos)
I25 = SUM(I9:I24)                -> % total desembolsado (debería tender a 100%)
```

Esta fila es el **check de cierre**: si `C25`, `D25`, `E25` no están cerca de 0, o si `G25`/`I25`
no están cerca de 100%, algo está mal cuadrado en el reparto mensual de origen.

#### Filas 27–32 — Resumen y nota legal

```
B27 "TOTAL PRESUPUESTO DE OBRA"     E27 = C4                    -> repite el Presupuesto de Obra (F33)
B28 "Adelanto Directo 10%..."       E28 = C9                    -> repite el adelanto efectivo
B29 "Adelanto Materiales 20%..."    E29 = D9                    -> repite el adelanto de materiales
B31  Nota: "* Porcentajes máximos de Adelantos según Artículo 155° del Reglamento de la Ley de
      Contrataciones del Estado"
B32  Nota: "Las Bases establecerán el otorgamiento y el porcentaje final de dichos adelantos."
```

### 16.4 Modelo de datos adicional (Desembolso) para TypeScript

```typescript
interface PeriodoDesembolso {
  numero: number;               // 0 (adelanto inicial), 1..15 (periodos de 30 días)
  diaCalendario: number;        // 0, 30, 60, 90... (acumulado)
  valorizacionParcial: number;  // = presupuestadoObra.mensual[mes] (fila 33 del cronograma, mes correspondiente)
  amortizacionEfectivo: number; // = round(valorizacionParcial * pctAdelantoEfectivo, 4)
  amortizacionMateriales: number; // = round(valorizacionParcial * pctAdelantoMateriales, 4)
  desembolsoNeto: number;       // = valorizacionParcial - (amortizacionEfectivo + amortizacionMateriales)
}

interface CronogramaDesembolsos {
  presupuestoDeObra: number;         // = presupuestadoObra.total (fila 33, NO fila 45)
  pctAdelantoEfectivo: number;       // hoy 10%, DEBE ser configurable (no constante en código)
  pctAdelantoMateriales: number;     // hoy 20%, DEBE ser configurable
  diasPorPeriodo: number;            // hoy 30, podría variar
  periodos: PeriodoDesembolso[];     // uno por cada mes del cronograma valorizado
}

// Derivados:
// adelantoEfectivoInicial = round(presupuestoDeObra * pctAdelantoEfectivo, 4)
// adelantoMaterialesInicial = round(presupuestoDeObra * pctAdelantoMateriales, 4)
// saldoAdelantoNoAmortizado = adelantoInicial - sum(periodos.map(p => p.amortizacion...))
//   -> debe tender a 0 al final del plazo (equivalente a la fila 25 de control)
```

### 16.5 Checklist adicional — GAUSS, CURVA S y Desembolso

- [ ] ¿El gráfico "GAUSS" en el sistema nuevo grafica la fila **43** (Presupuesto Total
      intermedio, sin Control Concurrente) tal como el Excel, o graficaron por error la fila 45
      (total final)? Decidir con el negocio si esto se corrige o se mantiene igual al original.
- [ ] ¿"CURVA S" grafica el **avance acumulado (%)** calculado sobre el Presupuesto Total
      **final** (fila 45), y no sobre el subtotal (fila 43)?
- [ ] ¿El "Presupuesto de Obra" que usa el módulo de Desembolsos es el de la fila **33**
      (Presupuestado de Obra Infraestructura) y no el Presupuesto Total final (fila 45)?
- [ ] ¿Los porcentajes de adelanto (10% efectivo, 20% materiales) están como **parámetros
      configurables** del proyecto, o quedaron hardcodeados como en el Excel (`*0.1`, `*0.2`
      dentro de la fórmula)?
- [ ] ¿Los periodos de Desembolso están armados como **30 días fijos por periodo** (calendario),
      independiente de que el cronograma use "meses"? Confirmar si el negocio realmente quiere
      periodos de 30 días exactos o meses calendario reales (28-31 días) — el Excel usa 30 fijos.
- [ ] ¿Existe la fila de **cierre/control** (equivalente a la fila 25: saldo de adelantos no
      amortizados, suma de % de avance, % total desembolsado), para detectar cuadres que no
      cierran en 100%?
- [ ] ¿Se corrigió (o se documentó como deuda conocida) el posible error de `C2` en Desembolso,
      que trae `B3` (Unidad Ejecutora) en vez del nombre del proyecto?
- [ ] Dado que Desembolso lee de la fila 49 (que es solo un espejo de la fila 33), ¿el sistema
      nuevo eliminó ese paso intermedio y lee directamente del total mensual de "Presupuestado de
      Obra Infraestructura"?

---

## 18. "Verificación del Valorizado" — compatibilidad con el sistema web + reportes Excel/PDF

> Nombre oficial de este módulo/pantalla/reporte dentro del sistema: **"Verificación del
> Valorizado"**. Es el punto donde el sistema web ya construido se **compara celda por celda**
> contra el Excel original, y donde se generan los reportes de salida (Excel y PDF) que el
> negocio necesita entregar.

### 18.1 Objetivo

Dado que ya existe un sistema web construido sobre este Excel, "Verificación del Valorizado" tiene
dos responsabilidades separadas:

1. **Verificación (interna/QA):** confirmar que el motor de cálculo del sistema web reproduce
   exactamente los mismos números que el Excel, celda por celda, en las 4 hojas (cronograma
   valorizado, GAUSS, CURVA S, Desembolso).
2. **Reporte (salida al negocio):** generar un Excel y un PDF descargables desde el sistema web,
   que el cliente/entidad pueda revisar igual que revisaría el Excel original — con la sección de
   verificación visible como respaldo de que el cálculo cuadra.

### 18.2 Estrategia de verificación (dataset de referencia + comparación)

**Paso 1 — Dataset de referencia ("golden values"):** extraer del Excel original (recalculado, es
decir con valores en caché, no solo fórmulas) los valores de todas las celdas clave, por hoja:

| Hoja | Celdas de referencia a extraer |
|---|---|
| cronograma valorizado | `F12:F27` (parciales), `V9:V27` (totales mensualizados por partida), `F28:F45` y `G28:U45` (toda la cascada de totales), `G46:U47` (avance mensual y acumulado) |
| GAUSS | `G43:U43` (serie del gráfico) |
| CURVA S | `G47:U47` (serie del gráfico) |
| Desembolso | `C9:I9` (adelanto inicial), `C10:I24` (los 15 periodos), `C25:I25` (fila de cierre) |

**Paso 2 — Cálculo del sistema web:** correr el mismo escenario (mismas partidas, mismos
porcentajes, mismos componentes amarillos/rojos) a través del motor de cálculo TypeScript descrito
en la sección 13, y producir la misma matriz de celdas.

**Paso 3 — Comparación fila por fila:** generalizar la lógica de las columnas V/X/Z (sección 9) a
**todas** las hojas, no solo a "cronograma valorizado":

```typescript
interface ResultadoVerificacion {
  hoja: string;
  celdaOEtiqueta: string;      // ej. "Partida 1.1.1.2" o "Desembolso - Periodo 3"
  valorExcel: number;
  valorSistema: number;
  diferencia: number;           // valorExcel - valorSistema
  estado: "OK" | "DIFERENCIA";  // OK si |diferencia| <= tolerancia (ej. 0.01)
}

function verificarValorizado(
  referenciaExcel: ResultadoVerificacion[],
  calculoSistema: ResultadoVerificacion[],
  tolerancia = 0.01
): ResultadoVerificacion[] { /* compara par a par por celdaOEtiqueta */ }
```

**Paso 4 — Pantalla/reporte "Verificación del Valorizado":** una vista (en el sistema web) que
lista el resultado de `verificarValorizado()` agrupado por hoja y por sección (partidas, cargas,
amarillos, rojos, avance, desembolsos), mostrando:
- Total de celdas comparadas, cuántas en `OK`, cuántas en `DIFERENCIA`.
- Detalle expandible de cada `DIFERENCIA` (hoja, etiqueta, valor esperado, valor calculado, delta).
- Esta pantalla reemplaza — con más alcance — lo que hoy son las columnas ocultas V/X/Z del Excel.

> **Uso recomendado:** correr "Verificación del Valorizado" contra 2–3 proyectos reales ya
> cargados en el sistema web (no solo contra este Excel de ejemplo), para confirmar que el motor
> de cálculo generaliza bien y no solo calza por casualidad con este caso puntual.

### 18.3 Reporte de salida en **Excel**

Requisitos para que el Excel exportado desde el sistema web sea compatible con lo que el negocio
ya conoce:

- **Misma estructura de hojas:** "cronograma valorizado", "GAUSS", "CURVA S", "Desembolso" (si el
  negocio necesita seguir entregando el paquete completo) — o al menos la hoja principal si
  deciden simplificar.
- **Fórmulas reales, no solo valores:** exportar con fórmulas (`=D12*E12`, `=SUM(...)`, etc.),
  igual que documentado en las secciones 3–13, para que el cliente pueda seguir auditando y
  editando en Excel si lo necesita — no solo un "volcado" de números estáticos.
- **Mismo formato visual:** colores de fila (amarillo para componentes tipo "amarillo", rojo para
  tipo "rojo"), formato de número `$#,##0.00`, fuente consistente con el resto del sistema.
- **Gráficos embebidos:** replicar el `BarChart` de GAUSS (fila 43) y el `LineChart` de CURVA S
  (fila 47), o la base que se decida usar tras resolver el punto pendiente de la sección 16.5
  sobre si GAUSS debe usar la fila 43 o la 45.
- **Hoja o sección adicional "Verificación del Valorizado":** agregar al Excel exportado una hoja
  (o un bloque al final de "cronograma valorizado") con el resumen de `verificarValorizado()` —
  así el archivo que reciba el cliente también trae el respaldo de que el cálculo cuadra, no solo
  el sistema web internamente.
- **Librería sugerida:** una que soporte escribir fórmulas y gráficos nativos de Excel (no solo
  valores), para mantener la editabilidad que el negocio ya tiene hoy con el archivo original.

### 18.4 Reporte de salida en **PDF**

Requisitos para el PDF exportable:

- **Vista imprimible de "cronograma valorizado":** tabla de partidas (con su jerarquía visual,
  sangrías por nivel), fila de totales (Costo Directo → Presupuesto Total final), y los
  componentes amarillos/rojos claramente diferenciados (por ejemplo con un tag o color de fondo
  suave, ya que el PDF no necesita replicar el relleno de celda de Excel literalmente, pero sí la
  distinción visual).
- **Curva S como imagen:** dado que un PDF no lleva gráficos "vivos" como Excel, renderizar la
  curva de avance acumulado (fila 47) como gráfico estático (imagen o SVG) dentro del PDF.
- **Sección "Verificación del Valorizado" visible en el PDF:** un bloque final (o un anexo) que
  muestre el resumen de la verificación — cuántas partidas/celdas cuadran, y si hay alguna
  `DIFERENCIA` pendiente, dejarla explícita en el PDF en vez de ocultarla. Esto le da al reporte
  el mismo respaldo de auditoría que tiene hoy el Excel con sus columnas ocultas V/X/Z, pero de
  forma visible y explicable a alguien que no abre Excel.
- **Generación desde el motor de cálculo, no desde el archivo Excel:** el PDF debe generarse a
  partir de los mismos datos y del mismo motor TypeScript que usa el sistema web (sección 13), no
  a partir de una conversión del `.xlsx` — así se garantiza que el PDF, el Excel exportado y lo
  que se ve en pantalla siempre están sincronizados entre sí.

### 18.5 Checklist — "Verificación del Valorizado"

- [ ] ¿Existe una pantalla o reporte con este nombre exacto ("Verificación del Valorizado") en el
      sistema web, o la verificación está dispersa/implícita en otras pantallas?
- [ ] ¿La verificación compara **las 4 hojas** (cronograma valorizado, GAUSS, CURVA S,
      Desembolso), o solo la hoja principal?
- [ ] ¿Se definió una **tolerancia de redondeo** explícita (ej. ±0.01) para no marcar como
      "DIFERENCIA" desajustes de centavos que son esperables por redondeo?
- [ ] ¿El reporte Excel exportado trae **fórmulas reales** (no solo valores) y mantiene colores
      de amarillo/rojo para los componentes editables?
- [ ] ¿El reporte Excel exportado incluye los gráficos de GAUSS y CURVA S?
- [ ] ¿El reporte PDF incluye la curva de avance como gráfico (no solo tabla de números)?
- [ ] ¿Tanto el Excel como el PDF incluyen la sección/resumen de "Verificación del Valorizado"
      visible para el cliente final, o solo se usa internamente en el sistema?
- [ ] ¿El PDF y el Excel se generan **desde el mismo motor de cálculo** que alimenta la pantalla
      del sistema web (evitando 3 fuentes de verdad distintas), o cada exportación tiene su propia
      lógica de cálculo replicada por separado (riesgo de que se desincronicen con el tiempo)?

---

## 19. Próximos pasos sugeridos

1. Confirmar contigo las **decisiones de negocio pendientes** marcadas en este documento:
   - Cómo tratar los montos hardcodeados (F34, F35, F36, F37, F44) — ¿siempre fórmula, o permitir
     override manual por ítem?
   - Qué hacer con la inconsistencia de etiqueta/valor en "Control Concurrente" (0.6% vs 0.5%
     real).
   - Si GAUSS debe graficar la fila 43 (como hoy) o la fila 45 (total final) — ambos gráficos hoy
     no comparten la misma base.
   - Si los % de adelanto (10%/20%) y los 30 días por periodo de Desembolso deben ser fijos o
     configurables por proyecto.
2. Verificar/corregir el posible error de referencia en Desembolso `C2` (trae B3 en vez del
   nombre del proyecto).
3. Con los checklists de las secciones 15, 16.5 y 18.5, comparar contra el build actual y
   priorizar los puntos con casilla sin marcar.
4. Definir e implementar la pantalla/reporte **"Verificación del Valorizado"** (sección 18) como
   el punto único de comparación entre Excel original y sistema web, y como base de los reportes
   Excel/PDF exportables.
