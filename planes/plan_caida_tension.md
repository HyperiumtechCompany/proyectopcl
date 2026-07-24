# Plan: Automatización del cálculo de "Máxima Demanda, Selección de Conductor y Caída de Tensión"

> Fuente: `2_2_CAIDA_DE_TENSIÓN.xlsx` — hoja principal **`MD_Caida`** (rango B5:AI289, filas de datos desde la fila 5) + hoja de apoyo **`tablas`** (catálogos técnicos usados por VLOOKUP/MATCH).
>
> Objetivo: portar el motor de cálculo de este Excel a un módulo del sistema web (backend, idealmente TypeScript/Python puro, sin dependencia de Excel), conservando exactamente la misma lógica y las mismas tablas de referencia.

---

## 0. Cómo está organizada la hoja `MD_Caida` (importante antes de tocar código)

No es una tabla plana: es una lista de **tableros eléctricos**, cada uno con:

1. **Fila(s) de parámetros globales** (fila 5): tensión del sistema, tipo de conexión, factor de diseño, temperatura de trabajo. Son **inputs únicos de todo el proyecto**, no se repiten por fila.
2. **N filas de "circuito"** (una por cada circuito derivado del tablero: alumbrado, tomacorriente, equipos, etc.).
3. **1 fila de "subtotal / cabecera de tablero" (CG)** que suma las N filas de circuito de arriba y representa el **alimentador de ese tablero** (la corriente que sube hacia el tablero padre).
4. Una **fila en blanco** separando cada bloque de tablero.
5. Al final (filas 287-289) hay **3 filas especiales de "alimentador general"** (Trafo → Generador → Tablero General TTA) que sólo agregan lo que ya se calculó abajo.

Es decir, el Excel modela un **árbol de tableros eléctricos** (feeder tree): circuitos → tablero → tablero padre → alimentador general. Cada fila "CG" de un tablero puede, a su vez, ser una fila de "circuito" dentro del tablero padre (ver sección 1.3).

**Esto define el modelo de datos que hay que construir en el sistema**: no es "una tabla de circuitos", son **dos entidades relacionadas jerárquicamente**: `Tablero` (panel) y `Circuito` (row), donde un circuito puede apuntar a otro tablero como su origen (sub-alimentado).

---

## 1. Modelo de datos propuesto

### 1.1 Parámetros globales del proyecto (fila 5 del Excel)

Tabla `proyecto_parametros` (o config global, 1 solo registro por proyecto):

| Campo | Celda Excel | Tipo | Descripción |
|---|---|---|---|
| `fases` | C5 | input (1 o 3) | Nº de fases del sistema (1 = monofásico, 3 = trifásico) |
| `conexion` | E5 | input ("Estrella" / "Delta") | Tipo de conexión del transformador |
| `voltaje_linea` (K5) | K5 | **calculado** | `=IF(C5=1,220,IF(E5="Estrella",380,IF(E5="Delta",220)))` |
| `factor_diseno` (fdis, nombre definido) | P5 | input (default 1.25) | Factor de sobredimensionamiento aplicado a la demanda |
| `temp_trabajo` | AD5 | input (default 40 °C) | Temperatura ambiente de diseño |
| `rho_cu_t` (AG5) | AG5 | **calculado** | Resistividad del cobre corregida por temperatura: `=1/58*(1+0.00393*(AD5-20))` |

> Nota: `K5` y `AG5` son fórmulas de una sola celda que se referencian con `$` (absolutas) desde **todas** las filas de circuito de abajo. En el sistema deben calcularse una vez por proyecto y reutilizarse.

### 1.2 Entidad `Tablero` (panel eléctrico)

Cada bloque del Excel (ej. filas 11-19 = tablero "TD-1") se traduce a:

```
Tablero {
  id
  proyecto_id
  codigo            // "TD-1", "TTE-01", "TCB", "TTA"...
  nombre            // "Tablero bloque 1 - piso 1"
  tablero_padre_id  // null si es el tablero general (TG/TTA)
  factor_potencia   // H de la fila CG (0.8, 0.85, 1...)
  factor_simultaneidad // I de la fila CG (solo aplica en alimentador general)
  sistema           // L de la fila CG (1 = monofásico, 3 = trifásico)
  fase_asignada     // O de la fila CG ("R","S","T","RST",...)
  longitud_conductor_m   // AB de la fila CG (input)
  seccion_conductor_mm2  // AC de la fila CG (input)
  tipo_conductor         // AH de la fila CG (input: "LSOH-80","N2X0H",...)
  temp_ambiente_c        // T de la fila CG (input, default 20)
  nro_circuitos_agrupados // U de la fila CG (input)
  proteccion_itm          // Z de la fila CG (input: "4x400","1x16",...)
  diametro_tubo_mm        // AG de la fila CG (input)
  seccion_tierra_mm2      // AI de la fila CG (input)
}
```

### 1.3 Entidad `Circuito` (fila individual dentro de un tablero)

```
Circuito {
  id
  tablero_id            // a qué tablero pertenece (padre)
  numero                // C  -> "C1","C2"... (correlativo)
  descripcion           // D  -> "Alumbrado","Tomacorriente","TTE-01"...
  tablero_origen_id      // NULL normalmente; si el circuito representa
                          //   la alimentación de OTRO tablero (ver fila 17,
                          //   "TTE-01" dentro de TD-1), apunta a ese tablero.
                          //   En ese caso el circuito NO tiene inputs propios
                          //   de potencia: hereda J,P,Q,R del tablero hijo.
  potencia_alumbrado_w   // E  -> input O fórmula agregadora (ver 3.4)
  potencia_tomacorriente_w // F -> input O fórmula agregadora (ver 3.4)
  potencia_fuerza_w      // G  -> input directo (no tiene fórmula generadora en este archivo)
  factor_potencia        // H  -> input (0.8 - 1)
  factor_simultaneidad_tomac // I -> input ("FS tomac", normalmente 1)
  sistema                // L  -> input (1 = monofásico / 3 = trifásico)
  fase                   // O  -> input ("R","S","T","RS","ST","TR","RST")
  seccion_conductor_mm2  // AC -> input
  longitud_conductor_m   // AB -> input
  tipo_conductor         // AH -> input ("LSOH-80","THW","NYY","N2X0H",...)
  seccion_tierra_mm2     // AI -> input
  temp_ambiente_c        // T  -> input (default 20)
  nro_circuitos_agrupados // U -> input (para tabla de agrupamiento, default 1)
  factor_agrupamiento_manual // V -> input SOLO si no aplica fórmula (ver 3.6)
  proteccion_itm          // Z  -> input ("1x16","1x20","4x35"...)
  proteccion_diferencial   // AA -> input ("2x25","2x40",...) — sólo en circuitos, no en filas CG
  diametro_tubo_mm         // AG -> input
}
```

### 1.4 Catálogos (hoja `tablas` → tablas/seed de referencia, NO se editan por el usuario)

Estas tablas alimentan los `VLOOKUP`/`MATCH` del Excel. Deben cargarse como datos semilla (seed) en la base de datos o como constantes JSON del sistema.

**Tabla A — Ampacidad de conductores (A5:G21)**: capacidad de corriente admisible (A) según calibre (mm²) y tipo de aislamiento.

| Calibre (mm²) | TW | THW | NYY | LSOH-80 | LSOH-90 | N2X0H |
|---|---|---|---|---|---|---|
| 2.5 | 24 | 27 | 32 | 24 | 27 | 38 |
| 4 | 31 | 34 | 43 | 31 | 34 | 55 |
| 6 | 39 | 44 | 58 | 39 | 44 | 68 |
| 10 | 51 | 62 | 77 | 51 | 62 | 95 |
| 16 | 68 | 85 | 102 | 68 | 85 | 125 |
| 25 | 88 | 107 | 132 | 88 | 107 | 160 |
| 35 | 110 | 135 | 157 | 110 | 135 | 195 |
| 50 | 138 | 160 | 186 | 138 | 160 | 230 |
| 70 | 165 | 203 | 222 | 165 | 203 | 275 |
| 95 | 198 | 242 | 265 | 198 | 242 | 330 |
| 120 | 165* | 279 | 301 | 231 | 279 | 380 |
| 150 | 264 | 318 | 338 | 264 | 318 | 410 |
| 185 | 303 | 361 | 367 | 303 | 361 | 450 |
| 240 | 352 | 406 | 426 | 352 | 406 | 525 |
| 300 | 391 | 462 | 480 | 391 | 462 | 600 |
| 400 | — | — | — | — | — | 680 |
| 500 | — | — | — | — | — | 700 |

> *(120mm² / TW = 165 aparece igual que 70mm²/TW en el Excel original — posible error de origen del Excel; replicar tal cual salvo que el usuario indique corregirlo).*

**Tabla B — Diámetro exterior del conductor por calibre y aislamiento (A26:G40)**, usada para calcular el diámetro de tubería.

**Tabla C — Área de sección del conductor (calculada)**: `=PI()*POWER((diámetro_exterior/2),2)` para cada tipo de aislamiento (columnas J:O de `tablas`, filas 26-40). Esto se puede calcular en código directamente con la fórmula del área del círculo, no hace falta guardarla como tabla estática — basta con guardar la Tabla B (diámetros) y calcular el área en tiempo de ejecución.

**Tabla D — Diámetro de tubería EMT/PVC según sección total ocupada (A43:B54)**:

| Sección (mm²) | Diámetro tubo (") |
|---|---|
| 20 | 0.75 |
| 25 | 1 |
| 35 | 1.25 |
| 40 | 1.5 |
| 50 | 2 |
| 65 | 2.5 |
| 80 | 3 |
| 90 | 3.5 |
| 100 | 4 |
| 115 | 4.5 |
| 130 | 5 |
| 155 | 6 |

> En el Excel provisto esta tabla NO se usa activamente por fórmula (el diámetro de tubo, columna AG, es un **input manual** en cada fila). Impleméntala solo si tu sistema quiere sugerir automáticamente el diámetro de tubo; si no, trátala como referencia opcional.

**Tablas menores (rangos con nombre) — no siempre usadas por fórmula activa pero definidas en el libro**: `RieldinP1`, `RieldinP2`, `RieldinP3`, `CM3P` (breakers), `itmdif`, `itmt` (protecciones diferenciales/termomagnéticas), `calibres` (lista de calibres válidos: 2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300,400,500).
Estas son principalmente **listas de validación** (dropdowns) del Excel original — en el sistema web equivalen a los `<select>`/enums que restringen los inputs de "calibre", "tipo de protección", etc. No participan en el cálculo numérico salvo la Tabla A y B.

---

## 2. Constantes y fórmulas globales (una sola vez por proyecto)

```
voltaje_linea (K5)  = fases == 1 ? 220
                     : conexion == "Estrella" ? 380
                     : conexion == "Delta" ? 220 : null

rho_cu_T (AG5) = (1/58) * (1 + 0.00393 * (temp_trabajo - 20))   // Ω·mm²/m
```

`rho_cu_T` es la resistividad del cobre corregida por temperatura (usada en TODAS las fórmulas de caída de tensión). `voltaje_linea` es el voltaje de línea a línea usado en todo cálculo trifásico.

---

## 3. Fórmulas por fila de CIRCUITO (filas "normales", ej. fila 11-17)

Todas estas fórmulas se calculan **por fila**, usando solo datos de esa misma fila + las constantes globales.

### 3.1 Potencia instalada total — `J` (P.I Total, kW)
```
J = (E_potencia_alumbrado_w + F_potencia_tomacorriente_w + G_potencia_fuerza_w) / 1000
```

### 3.2 Máxima demanda del circuito — `K` (M.D, kW)
```
K = I_factor_simultaneidad * J
```

### 3.3 Corriente de diseño / corriente nominal — `M` (Id teórica) y `N` (In total)
```
N = sistema == 1
      ? (K * 1000) / (220 * H_factor_potencia)
      : (K * 1000) / (SQRT(3) * voltaje_linea * H_factor_potencia)

M = N * factor_diseno   // fdis (parámetro global, celda P5)
```
> `N` = corriente sin sobredimensionar. `M` = corriente de diseño (con el factor de seguridad `fdis`, típicamente 1.25). El sistema debe conservar ambas: `N` se usa después para calcular el ITM sugerido en las filas CG (`N19 = MAX(P19:R19)/1.25`).

### 3.4 Reparto de corriente por fase — `P` (R), `Q` (S), `R` (T)

Reparte la corriente `N` (ya con `fdis` aplicado) según a qué fase(s) está conectado el circuito (campo `O`, texto: "R","S","T","RS","ST","TR","RST"):

```
P (fase R) = O contiene "R" ? N * fdis : 0/"" 
Q (fase S) = O contiene "S" ? N * fdis : 0/""
R (fase T) = O contiene "T" ? N * fdis : 0/""
```
Traducción exacta del Excel (usa comparaciones exactas de texto, no "contiene"):
```
P = (O == "RST" || O == "R" || O == "RS" || O == "TR") ? N*fdis : null
Q = (O == "RST" || O == "S" || O == "RS" || O == "ST") ? N*fdis : null
R = (O == "RST" || O == "T" || O == "ST" || O == "TR") ? N*fdis : null
```
> Implementarlo tal cual (con las mismas combinaciones válidas: R, S, T, RS, ST, TR, RST) para no alterar el comportamiento cuando el usuario ingresa combinaciones parciales.

### 3.5 Corriente admisible del conductor — `S` (Inom cable)

Búsqueda en la **Tabla A** (ampacidad):
```
S = tablaAmpacidad[seccion_conductor_mm2][tipo_conductor]
```
(equivalente a `VLOOKUP(seccion, TablaA, columna_de(tipo_conductor))`)

### 3.6 Factores de corrección — `V` (agrupamiento) y `W` (temperatura)

En las filas de **circuito individual** normalmente `V=1` y `W=1` (inputs fijos). En las filas **CG (subtotal de tablero)** estos SÍ tienen fórmula (ver sección 4.2). Para mantener 100% de fidelidad, implementa la fórmula en ambos casos y deja que el circuito individual normalmente tenga `nro_circuitos_agrupados=1` → `V=1`.

```
V (factor agrupamiento, Tabla 5Dc) =
    nro_circuitos_agrupados==2 ? 0.85
  : nro_circuitos_agrupados==3 ? 0.75
  : nro_circuitos_agrupados==4 ? 0.70
  : nro_circuitos_agrupados==5 ? 0.65
  : nro_circuitos_agrupados==6 ? 0.60
  : 1   // (agrupamiento=1, sin corrección; el Excel no define >6, revisar con el usuario si aplica ampliar tabla)

W (factor temperatura, Tabla 5A) =
    temp_ambiente_c==10 ? 1.07
  : temp_ambiente_c==15 ? 1.04
  : temp_ambiente_c==20 ? 1.00
  : temp_ambiente_c==25 ? 0.96
  : temp_ambiente_c==30 ? 0.93
  : temp_ambiente_c==35 ? 0.89
  : temp_ambiente_c==40 ? 0.85
  : null  // el Excel no cubre otras temperaturas; validar en el form (solo esos 7 valores)
```

### 3.7 Capacidad admisible corregida — `X` (Iadm cable)
```
X = W * V * S
```

### 3.8 Verificación de capacidad — `Y` (Conformidad)
```
Y = X > MAX(P, Q, R) ? "Conforme" : "No Conforme"
```

### 3.9 Caída de tensión en voltios — `AD` (Delta V)

```
AD = sistema == 1
       ? (2 * MAX(P,Q,R) * rho_cu_T * longitud_conductor_m * H_factor_potencia) / seccion_conductor_mm2  [+ caida_aguas_arriba]
     : sistema == 3
       ? (SQRT(3) * MAX(P,Q,R) * rho_cu_T * longitud_conductor_m * H_factor_potencia) / seccion_conductor_mm2  [+ caida_aguas_arriba]
     : null
```
> `caida_aguas_arriba` (el `+E19` / `+AD19` que aparece en las filas CG) es la caída de tensión acumulada de los tableros aguas arriba — ver sección 4.3. En una fila de circuito individual normal (no CG), este término normalmente es 0 (no se suma nada extra).

### 3.10 Caída de tensión en porcentaje — `AE`
```
AE = sistema == 1 ? (AD / 220) * 100 : (AD / voltaje_linea) * 100
```

### 3.11 Verificación de caída de tensión — `AF`
```
AF = AE < limite ? "Cumple" : "No cumple"
```
> **Importante**: el límite varía según el tipo de fila:
> - Circuito individual (derivación final): límite = **4%**
> - Fila CG / subtotal de tablero: límite = **2.5%**
> - Alimentador general (Trafo/Gen/TTA, filas 287-289): límite = **1%**
>
> Esto replica la Norma Técnica peruana (CNE) de caída de tensión máxima admisible: 2.5% en alimentadores + 4% en el total hasta el punto más alejado (o 1% para el alimentador principal en instalaciones con grupo electrógeno/subestación, según este proyecto). **Debe ser un parámetro configurable por "tipo de fila"**, no un valor fijo en el código.

---

## 4. Fórmulas por fila "CG" (subtotal / cabecera de tablero)

Estas filas sí varían respecto a las de circuito: agregan (SUM) las filas de circuito de arriba.

### 4.1 Agregación de potencia y corriente
```
J_CG = SUM(J de todas las filas de circuito del tablero)
K_CG = SUM(K de todas las filas de circuito del tablero)
P_CG = SUM(P de todas las filas de circuito del tablero)
Q_CG = SUM(Q de todas las filas de circuito del tablero)
R_CG = SUM(R de todas las filas de circuito del tablero)
```

### 4.2 Corriente teórica del tablero — `M_CG`
```
M_CG = sistema==1
        ? (K_CG*1000)/(220*H) * fdis
       : (K_CG*1000)/(SQRT(3)*voltaje_linea*H) * fdis
   (envolver en IFERROR -> si divide entre 0 o error, dejar vacío/null)
```

### 4.3 ITM sugerido — `N_CG`
```
N_CG = MAX(P_CG, Q_CG, R_CG) / 1.25
```
> Nota: el `1.25` aquí está **hardcodeado en el Excel**, no referencia `fdis` (aunque casi siempre `fdis=1.25`). Decisión a tomar con el usuario: ¿usar `fdis` real o dejar 1.25 fijo como en el Excel original? Por fidelidad exacta, replicar el `1.25` fijo, y señalarlo como *posible mejora* a futuro.

### 4.4 Fase asignada del tablero — `O_CG`
```
O_CG = sistema==3 ? "RST" : fase_de_la_ultima_fila_de_circuito_del_bloque
```

### 4.5 Caída de tensión acumulada — `E_CG` y `AD_CG` (la parte más delicada)

Cada fila CG trae en `E` la **caída de tensión (en voltios) del tablero PADRE que la alimenta** (aguas arriba), y ese valor se suma dentro de la fórmula de `AD` de este mismo tablero:
```
E_CG = AD del alimentador general (fila 287)   // = caída acumulada del transformador/tablero general
AD_CG = misma fórmula de 3.9, pero SUMANDO E_CG al final:
   AD_CG = (formula base con MAX(P,Q,R), rho_cu_T, longitud, factor_potencia, sección) + E_CG
```
Esto modela la **caída de tensión acumulada en cascada**: el % de caída en un tomacorriente del piso 5 no solo depende del cable que lo alimenta, sino de todo el recorrido aguas arriba (tablero de piso → tablero general → transformador). El sistema debe:

1. Calcular primero el **alimentador general** (nivel raíz del árbol).
2. Calcular cada **tablero** de arriba hacia abajo (orden topológico: primero el padre, luego los hijos), pasando la caída de tensión acumulada (`AD` del padre) como input (`E`) del hijo.
3. Calcular cada **circuito** dentro de su tablero usando la caída acumulada de SU tablero (no de un padre más lejano).

> **Esto es el punto de mayor riesgo de bugs** al portar el Excel: el orden de cálculo importa (no puede ser fila-por-fila lineal, tiene que respetar el árbol jerárquico tablero → tablero padre → alimentador general). Recomiendo modelar el árbol explícitamente (`tablero_padre_id`) y hacer un recorrido **top-down (BFS/DFS desde la raíz)** para calcular `AD` de cada nivel antes de calcular a sus hijos.

### 4.6 Circuito que en realidad es un sub-tablero (ej. fila 17 "TTE-01" dentro de TD-1)

Cuando la descripción de un circuito (columna D) coincide con el código de OTRO tablero (ej. fila 17 dice "TTE-01", y hay un tablero completo llamado "TTE-01" más abajo en filas 21-25), ese circuito **no tiene potencia propia**: hereda los valores agregados (`J`, `P`, `Q`, `R`) directamente de la fila CG de ese tablero hijo.
```
J_circuito = J_CG(tablero_hijo)
P_circuito = P_CG(tablero_hijo)
Q_circuito = Q_CG(tablero_hijo)
R_circuito = R_CG(tablero_hijo)
```
En el sistema esto se resuelve simplemente con el campo `tablero_origen_id` propuesto en 1.3: si está seteado, el circuito no pide inputs de potencia — se calcula automáticamente a partir del tablero referenciado (que a su vez debe estar ya resuelto, de nuevo: **orden topológico**).

---

## 5. Fórmulas del "Alimentador General" (filas 287-289: Trafo → Gen → TTA)

Son 3 filas encadenadas, cada una copiando/ajustando a la anterior:

```
Trafo (287):
  J = SUM(J_CG de TODOS los tableros de primer nivel)
  K = SUM(K_CG de todos) * factor_simultaneidad_general   // I287, input ~0.8
  P,Q,R = SUM(P/Q/R_CG de todos) * factor_simultaneidad_general
  AD = fórmula base (SIN sumar E, porque este es el nivel raíz)
  límite AF = 1%

Gen (288):
  copia literal de Trafo (mismo J,K,P,Q,R), factor_simultaneidad = 1
  AD = fórmula base, usando SU PROPIA longitud (AB288, cable corto: transformador→generador)

TTA (289):
  copia literal de Gen, factor_simultaneidad = 1
  AD = fórmula base, usando SU PROPIA longitud (AB289, generador→tablero general)
```
`E19` (la caída que reciben los tableros de primer nivel) = `AD287` (la caída en el punto "Trafo"), **no** la de TTA. Confirmar con el usuario si esto es intencional en el diseño original (probablemente sí: el Excel modela que el tramo Trafo→TTA es paralelo/redundante con el Generador, y el peor caso para los tableros de piso es la caída ya acumulada hasta el punto "Trafo").

---

## 6. Resumen: columnas que son INPUT puro (rellenar) vs CALCULADAS

**INPUT (usuario debe rellenar en el formulario del sistema):**
C(nº circuito, autogenerable), D(descripción), E y F *(pueden ser input directo O suma de sub-inputs — ver 3.1 nota)*, G, H, I, L, O, T, U, V*(en fila CG es fórmula, en circuito es input)*, Z, AA, AB, AC, AG, AH, AI.
Además, a nivel de proyecto: C5, E5, P5(fdis), AD5(temp), y a nivel de tablero: I(factor simultaneidad, solo en CG), AB/AC/AH/AI propios de la fila CG.

**CALCULADAS (el sistema las produce, nunca se piden al usuario):**
K5, AG5 (globales), J, K, M, N, P, Q, R, S, W, X, Y, AD, AE, AF. En filas CG además: V (fórmula), O (fórmula), E (heredada del padre).

> Regla práctica para el formulario web: **si en el Excel la celda tiene fórmula → es un campo de solo lectura (resultado) en el sistema; si la celda es un valor suelto (número o texto tecleado) → es un campo editable.** Esta tabla resume exactamente cuáles son cuáles, así que sirve como contrato directo para el formulario dinámico.

---

## 7. Plan de implementación sugerido (para Claude Code)

1. **Modelado de datos**
   - Crear entidades `Proyecto`, `ParametrosGlobales`, `Tablero` (con `tablero_padre_id`), `Circuito` (con `tablero_origen_id` opcional).
   - Cargar como *seed data* / constantes: Tabla A (ampacidad), Tabla B (diámetros), listas de calibres válidos, tipos de conductor válidos, combinaciones válidas de fase (R,S,T,RS,ST,TR,RST).

2. **Motor de cálculo (módulo puro, sin UI)**
   - `calcularParametrosGlobales(proyecto)` → `{voltaje_linea, rho_cu_T}`.
   - `calcularCircuito(circuito, globales)` → aplica fórmulas de la sección 3.
   - `calcularTablero(tablero, circuitosDelTablero, caidaTensionPadre, globales)` → aplica fórmulas de la sección 4, incluyendo el caso "circuito = sub-tablero" (4.6).
   - `calcularAlimentadorGeneral(tableros, globales)` → aplica sección 5.
   - `calcularProyectoCompleto(proyecto)` → recorre el árbol en orden topológico (raíz → hojas) llamando a las funciones anteriores en el orden correcto. **Esto reemplaza el recálculo automático de Excel** y es la pieza más importante a testear.

3. **Validaciones de formulario** (equivalentes a las listas de validación de datos del Excel):
   - `sistema` ∈ {1,3}; `fase` ∈ {R,S,T,RS,ST,TR,RST}; `calibre` ∈ lista de calibres de Tabla A; `tipo_conductor` ∈ {TW,THW,NYY,LSOH-80,LSOH-90,N2X0H}; `temp_ambiente_c` ∈ {10,15,20,25,30,35,40} (única con fórmula de corrección definida); `nro_circuitos_agrupados` ∈ {1..6}.

4. **Tests unitarios** (recomendado, usando los propios datos del Excel de ejemplo como "golden data"):
   - Tomar 3-5 filas reales del Excel (ej. fila 11 "TD-1/C1", fila 19 "TD-1/CG1", fila 287 "Trafo") con sus inputs y sus resultados ya calculados por Excel, y usarlos como casos de prueba exactos (input → output esperado) para el motor de cálculo nuevo.
   - Caso especial a testear: fila 17 (circuito que hereda de un sub-tablero) y la cascada de caída de tensión (E19 = AD287).

5. **UI del sistema**
   - Formulario de "Tablero" y de "Circuito" mostrando solo los campos INPUT de la sección 6; el resto se muestra como resultados de solo lectura, recalculados en vivo (o al guardar) llamando al motor de cálculo del backend.
   - Vista de árbol de tableros (para reflejar la jerarquía padre-hijo del proyecto).
   - Indicadores visuales para `Y` ("Conforme"/"No Conforme") y `AF` ("Cumple"/"No cumple"), replicando el semáforo del Excel.

6. **Puntos a confirmar con el usuario del sistema (dueño del Excel) antes de dar por cerrado el motor**:
   - ¿El límite de caída de tensión (4% / 2.5% / 1%) debe ser configurable por proyecto o queda fijo como en este Excel?
   - ¿El `1.25` fijo en `N_CG` (sección 4.3) debe seguir fijo o usar el `fdis` del proyecto?
   - Confirmar el valor de ampacidad "120mm²/TW=165" (parece inconsistente con la progresión de la tabla — posible error de tipeo en el Excel original).
   - ¿La tabla de diámetro de tubería (Tabla D) debe automatizarse (sugerir diámetro) o se deja como input manual igual que en el Excel?

---

## 8. Fuera de alcance de este plan (mencionado solo como referencia)

Las columnas AJ:BP de `MD_Caida` (desagregado de tipos de luminaria y tomacorrientes que alimentan las columnas E/F cuando son fórmula-suma) **no fueron pedidas** dentro del rango B:AI, pero como E y F a veces son fórmulas que dependen de ellas (fila 11: `E11=$AN$9*AN11+...`), quedan documentadas aquí por si luego se decide automatizar también ese desglose:
- Columnas AN:AY = catálogo de luminarias (potencia unitaria en fila 9, cantidad instalada en cada fila de circuito).
- Columnas BF:BN = catálogo de tomacorrientes/equipos (potencia unitaria en fila 9, cantidad en cada fila).
- Si se automatiza, E/F dejan de ser "input directo" y pasan a ser `SUM(cantidad_i * potencia_unitaria_i)` — un tercer tipo de fila hija bajo Circuito (`ComponenteCircuito`).

Las hojas `SPAT`, `PARARRAYO`, `C. Alum.` y `Encabezado` **no fueron analizadas** (fuera del alcance pedido: solo MD_Caida y tablas).
