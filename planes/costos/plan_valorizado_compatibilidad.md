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

## 16. Próximos pasos sugeridos

1. Confirmar contigo las **dos decisiones de negocio pendientes** marcadas en este documento:
   - Cómo tratar los montos hardcodeados (F34, F35, F36, F37, F44) — ¿siempre fórmula, o permitir
     override manual por ítem?
   - Qué hacer con la inconsistencia de etiqueta/valor en "Control Concurrente" (0.6% vs 0.5%
     real).
2. Si aplica, hacer un análisis equivalente de la hoja **Desembolso** antes de cerrar el modelo de
   datos definitivo, porque consume 19 celdas de esta hoja y puede exponer campos adicionales.
3. Con el checklist de la sección 15, comparar contra el build actual y priorizar los puntos con
   casilla sin marcar.
