# Reporte de análisis — `VALORIZACIÓN N°02 - JUL 2026 (1).xlsx`

Hojas encontradas: res %, FT, PRESUPUESTO, CALEN. PROG., METRADOS, CALEN. VALO., VAL. MENSUAL, PROG VS. EJEC, CONTROL GEN. AVAN. OBRA., CURVA S, CONTROL AVAN. FISICO, CONTROL FINANCIERO, RESUMEN VAL., R.F.C, R PAGO MENSUAL, PAGOS ACUMULADOS, CONTROL DE PAGOS, RH-EM, resumen 3, resumen 2, Hoja2, PROGRAMADO


## 1. Mapa de dependencias entre hojas

| Hoja | Referencia a | Nº de fórmulas |
|---|---|---|
| CALEN. PROG. | FT | 9 |
| CALEN. VALO. | FT | 9 |
| CONTROL AVAN. FISICO | CURVA S | 45 |
| CONTROL AVAN. FISICO | FT | 7 |
| CONTROL AVAN. FISICO | CONTROL GEN. AVAN. OBRA. | 7 |
| CONTROL DE PAGOS | FT | 10 |
| CONTROL DE PAGOS | CONTROL GEN. AVAN. OBRA. | 5 |
| CONTROL DE PAGOS | R.F.C | 1 |
| CONTROL DE PAGOS | [12]CGO-OP | 1 |
| CONTROL FINANCIERO | FT | 7 |
| CONTROL FINANCIERO | CONTROL GEN. AVAN. OBRA. | 2 |
| CONTROL GEN. AVAN. OBRA. | FT | 9 |
| CONTROL GEN. AVAN. OBRA. | CALEN. PROG. | 6 |
| CONTROL GEN. AVAN. OBRA. | CALEN. VALO. | 2 |
| CURVA S | CONTROL GEN. AVAN. OBRA. | 11 |
| CURVA S | FT | 9 |
| FT | CONTROL GEN. AVAN. OBRA. | 2 |
| METRADOS | FT | 9 |
| PAGOS ACUMULADOS | RESUMEN VAL. | 55 |
| PAGOS ACUMULADOS | FT | 6 |
| PAGOS ACUMULADOS | R.F.C | 2 |
| PAGOS ACUMULADOS | VAL. MENSUAL | 1 |
| PAGOS ACUMULADOS | R PAGO MENSUAL | 1 |
| PRESUPUESTO | FT | 7 |
| PROG VS. EJEC | FT | 9 |
| R PAGO MENSUAL | RESUMEN VAL. | 55 |
| R PAGO MENSUAL | FT | 6 |
| R PAGO MENSUAL | VAL. MENSUAL | 1 |
| R PAGO MENSUAL | R.F.C | 1 |
| R.F.C | CONTROL GEN. AVAN. OBRA. | 9 |
| R.F.C | FT | 8 |
| RESUMEN VAL. | VAL. MENSUAL | 72 |
| RESUMEN VAL. | FT | 7 |
| RH-EM | FT | 11 |
| VAL. MENSUAL | FT | 5 |

## 2. Detalle por hoja


### Hoja: res %

- Celdas con fórmula: 77
- Celdas con valor literal (posibles inputs): 38

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| A | 3 (1) | `=#REF!` | `A3` = `=#REF!` |
| B | 3 (1) | `=#REF!` | `B3` = `=#REF!` |
| B | 4 (1) | `=+#REF!` | `B4` = `=+#REF!` |
| B | 5-12 (8) | `=#REF!` | `B5` = `=#REF!` |
| D | 13 (1) | `=SUM(#REF!)` | `D13` = `=SUM(#REF!)` |
| D | 15 (1) | `=ROUND(D{n}*#REF!,2)` | `D15` = `=ROUND(D13*#REF!,2)` |
| D | 17 (1) | `=ROUND(D{n}*#REF!,2)` | `D17` = `=ROUND(D13*#REF!,2)` |
| D | 19 (1) | `=D{n}+D{n}+D{n}` | `D19` = `=D13+D15+D17` |
| D | 21 (1) | `=#REF!*D{n}` | `D21` = `=#REF!*D19` |
| D | 23 (1) | `=ROUND(D{n}*#REF!,2)-0.01` | `D23` = `=ROUND(D19*#REF!,2)-0.01` |
| D | 25 (1) | `=D{n}+D{n}` | `D25` = `=D21+D23` |
| F | 13 (1) | `=SUM(#REF!)` | `F13` = `=SUM(#REF!)` |
| F | 15 (1) | `=ROUND(F{n}*#REF!,2)` | `F15` = `=ROUND(F13*#REF!,2)` |
| F | 17 (1) | `=ROUND(F{n}*#REF!,2)` | `F17` = `=ROUND(F13*#REF!,2)` |
| F | 19 (1) | `=F{n}+F{n}+F{n}` | `F19` = `=F13+F15+F17` |
| F | 21 (1) | `=ROUND(F{n}*#REF!,2)` | `F21` = `=ROUND(F19*#REF!,2)` |
| F | 23 (1) | `=ROUND(F{n}*#REF!,2)` | `F23` = `=ROUND(F21*#REF!,2)` |
| F | 25 (1) | `=F{n}+F{n}` | `F25` = `=F23+F21` |
| F | 27 (1) | `=F{n}/D{n}` | `F27` = `=F25/D25` |
| G | 3-5 (3) | `=+#REF!` | `G3` = `=+#REF!` |
| G | 9-13 (5) | `=+#REF!` | `G9` = `=+#REF!` |
| H | 3 (1) | `=#REF!` | `H3` = `=#REF!` |
| H | 4-5 (2) | `=+#REF!` | `H4` = `=+#REF!` |
| H | 9-13 (5) | `=+#REF!` | `H9` = `=+#REF!` |
| I | 5 (1) | `=#REF!` | `I5` = `=#REF!` |
| I | 13 (1) | `=SUM(#REF!)` | `I13` = `=SUM(#REF!)` |
| I | 15 (1) | `=ROUND(I{n}*#REF!,2)` | `I15` = `=ROUND(I13*#REF!,2)` |
| I | 17 (1) | `=ROUND(I{n}*#REF!,2)` | `I17` = `=ROUND(I13*#REF!,2)` |
| I | 19 (1) | `=I{n}+I{n}+I{n}` | `I19` = `=I13+I15+I17` |
| I | 21 (1) | `=ROUND(I{n}*#REF!,2)` | `I21` = `=ROUND(I19*#REF!,2)` |
| I | 23 (1) | `=ROUND(I{n}*#REF!,2)` | `I23` = `=ROUND(I21*#REF!,2)` |
| I | 25 (1) | `=I{n}+I{n}` | `I25` = `=I21+I23` |
| J | 5 (1) | `=#REF!` | `J5` = `=#REF!` |
| K | 5 (1) | `=#REF!` | `K5` = `=#REF!` |
| K | 13 (1) | `=SUM(#REF!)` | `K13` = `=SUM(#REF!)` |
| K | 15 (1) | `=ROUND(K{n}*#REF!,2)` | `K15` = `=ROUND(K13*#REF!,2)` |
| K | 17 (1) | `=ROUND(K{n}*#REF!,2)` | `K17` = `=ROUND(K13*#REF!,2)` |
| K | 19 (1) | `=K{n}+K{n}+K{n}` | `K19` = `=K13+K15+K17` |
| K | 21 (1) | `=ROUND(K{n}*#REF!,2)` | `K21` = `=ROUND(K19*#REF!,2)` |
| K | 22 (1) | `=+D{n}-I{n}` | `K22` = `=+D22-I22` |
| K | 23 (1) | `=ROUND(K{n}*#REF!,2)-0.01` | `K23` = `=ROUND(K21*#REF!,2)-0.01` |
| K | 25 (1) | `=K{n}+K{n}` | `K25` = `=K21+K23` |
| K | 27 (1) | `=+K{n}/D{n}` | `K27` = `=+K25/D25` |
| L | 13-26 (14) | `=+K{n}+I{n}` | `L13` = `=+K13+I13` |
| L | 27 (1) | `=+K{n}+H{n}` | `L27` = `=+K27+H13` |
| L | 28 (1) | `=+K{n}+I{n}` | `L28` = `=+K28+I28` |

**⚠ Posibles problemas detectados:**

- `A3`: fórmula rota (#REF!)
- `B3`: fórmula rota (#REF!)
- `G3`: fórmula rota (#REF!)
- `H3`: fórmula rota (#REF!)
- `B4`: fórmula rota (#REF!)
- `G4`: fórmula rota (#REF!)
- `H4`: fórmula rota (#REF!)
- `B5`: fórmula rota (#REF!)
- `G5`: fórmula rota (#REF!)
- `H5`: fórmula rota (#REF!)
- `I5`: fórmula rota (#REF!)
- `J5`: fórmula rota (#REF!)
- `K5`: fórmula rota (#REF!)
- `B6`: fórmula rota (#REF!)
- `B7`: fórmula rota (#REF!)
- `B8`: fórmula rota (#REF!)
- `B9`: fórmula rota (#REF!)
- `G9`: fórmula rota (#REF!)
- `H9`: fórmula rota (#REF!)
- `B10`: fórmula rota (#REF!)
- `G10`: fórmula rota (#REF!)
- `H10`: fórmula rota (#REF!)
- `B11`: fórmula rota (#REF!)
- `G11`: fórmula rota (#REF!)
- `H11`: fórmula rota (#REF!)
- `B12`: fórmula rota (#REF!)
- `G12`: fórmula rota (#REF!)
- `H12`: fórmula rota (#REF!)
- `D13`: fórmula rota (#REF!)
- `F13`: fórmula rota (#REF!)
- `G13`: fórmula rota (#REF!)
- `H13`: fórmula rota (#REF!)
- `I13`: fórmula rota (#REF!)
- `K13`: fórmula rota (#REF!)
- `D15`: fórmula rota (#REF!)
- `F15`: fórmula rota (#REF!)
- `I15`: fórmula rota (#REF!)
- `K15`: fórmula rota (#REF!)
- `D17`: fórmula rota (#REF!)
- `F17`: fórmula rota (#REF!)
- `I17`: fórmula rota (#REF!)
- `K17`: fórmula rota (#REF!)
- `D21`: fórmula rota (#REF!)
- `F21`: fórmula rota (#REF!)
- `I21`: fórmula rota (#REF!)
- `K21`: fórmula rota (#REF!)
- `D23`: fórmula rota (#REF!)
- `F23`: fórmula rota (#REF!)
- `I23`: fórmula rota (#REF!)
- `K23`: fórmula rota (#REF!)

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `sin color` — 38 celdas. Ejemplos: A1='CUADRO DE CONTROL DE AVANCE DE METAS', A2='ITEM', B2='DESCRIPCION', C2='UND', D2='TOTAL', E2='ANTERIOR', G2='ACTUAL %', H2='ACUMULADO %' … (+30 más)

### Hoja: FT

- Celdas con fórmula: 5
- Celdas con valor literal (posibles inputs): 153

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| E | 26 (1) | `=+E{n}` | `E26` = `=+E25` |
| E | 44 (1) | `=+E{n}` | `E44` = `=+E43` |
| E | 51 (1) | `=+E{n}+E{n}-1` | `E51` = `=+E49+E50-1` |
| E | 58 (1) | `=+'CONTROL GEN. AVAN. OBRA.'!L{n}` | `E58` = `=+'CONTROL GEN. AVAN. OBRA.'!L14` |
| E | 59 (1) | `=+'CONTROL GEN. AVAN. OBRA.'!N{n}` | `E59` = `=+'CONTROL GEN. AVAN. OBRA.'!N14` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 1 celdas. Ejemplos: C2='FICHA TÉCNICA DEL PROYECTO'
- Color `theme0` — 152 celdas. Ejemplos: C3='A. DATOS GENERALES', C4='Entidad', D4=':', E4='MUNICIPALIDAD DISTRITAL DE PILLCO MARCA', C5='Obra', D5=':', E5='"MEJORAMIENTO Y AMPLIACIÓN DE LOS SERVICIOS DE TRANSITABILIDAD VEHICULAR Y PEATONAL DEL JR LOS PINOS Y JR LOS CEDROS EN CAYHUAYNA Y CAYHUAYNA DEL DISTRITO DE PILLCO MARCA - PROVINCIA DE HUÁNUCO - DEPARTAMENTO DE HUÁNUCO" con CUI N°2536252', C6='Código único de inversión' … (+144 más)

### Hoja: PRESUPUESTO

- Celdas con fórmula: 128
- Celdas con valor literal (posibles inputs): 618

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 2 (1) | `=+FT!E{n}` | `B2` = `=+FT!E20` |
| C | 3 (1) | `=+FT!E{n}` | `C3` = `=+FT!E5` |
| C | 4-8 (5) | `=+FT!$E${n}` | `C4` = `=+FT!$E$4` |
| F | 148 (1) | `=2500+3523` | `F148` = `=2500+3523` |
| G | 15-24 (10) | `=ROUND(E{n}*F{n},2)` | `G15` = `=ROUND(E15*F15,2)` |
| G | 26-28 (3) | `=ROUND(E{n}*F{n},2)` | `G26` = `=ROUND(E26*F26,2)` |
| G | 30-52 (23) | `=ROUND(E{n}*F{n},2)` | `G30` = `=ROUND(E30*F30,2)` |
| G | 54-69 (16) | `=ROUND(E{n}*F{n},2)` | `G54` = `=ROUND(E54*F54,2)` |
| G | 71-74 (4) | `=ROUND(E{n}*F{n},2)` | `G71` = `=ROUND(E71*F71,2)` |
| G | 76-77 (2) | `=ROUND(E{n}*F{n},2)` | `G76` = `=ROUND(E76*F76,2)` |
| G | 80-84 (5) | `=ROUND(E{n}*F{n},2)` | `G80` = `=ROUND(E80*F80,2)` |
| G | 86-89 (4) | `=ROUND(E{n}*F{n},2)` | `G86` = `=ROUND(E86*F86,2)` |
| G | 92-95 (4) | `=ROUND(E{n}*F{n},2)` | `G92` = `=ROUND(E92*F92,2)` |
| G | 97-101 (5) | `=ROUND(E{n}*F{n},2)` | `G97` = `=ROUND(E97*F97,2)` |
| G | 104-105 (2) | `=ROUND(E{n}*F{n},2)` | `G104` = `=ROUND(E104*F104,2)` |
| G | 107-109 (3) | `=ROUND(E{n}*F{n},2)` | `G107` = `=ROUND(E107*F107,2)` |
| G | 111 (1) | `=ROUND(E{n}*F{n},2)` | `G111` = `=ROUND(E111*F111,2)` |
| G | 114-117 (4) | `=ROUND(E{n}*F{n},2)` | `G114` = `=ROUND(E114*F114,2)` |
| G | 119-122 (4) | `=ROUND(E{n}*F{n},2)` | `G119` = `=ROUND(E119*F119,2)` |
| G | 125-129 (5) | `=ROUND(E{n}*F{n},2)` | `G125` = `=ROUND(E125*F125,2)` |
| G | 131-133 (3) | `=ROUND(E{n}*F{n},2)` | `G131` = `=ROUND(E131*F131,2)` |
| G | 135-136 (2) | `=ROUND(E{n}*F{n},2)` | `G135` = `=ROUND(E135*F135,2)` |
| G | 138 (1) | `=ROUND(E{n}*F{n},2)` | `G138` = `=ROUND(E138*F138,2)` |
| G | 140 (1) | `=ROUND(E{n}*F{n},2)` | `G140` = `=ROUND(E140*F140,2)` |
| G | 142-146 (5) | `=ROUND(E{n}*F{n},2)` | `G142` = `=ROUND(E142*F142,2)` |
| G | 148 (1) | `=ROUND(E{n}*F{n},2)` | `G148` = `=ROUND(E148*F148,2)` |
| G | 150-155 (6) | `=ROUND(E{n}*F{n},2)` | `G150` = `=ROUND(E150*F150,2)` |
| G | 156 (1) | `=ROUND(SUM(G{n}:G{n}),2)` | `G156` = `=ROUND(SUM(G12:G155),2)` |
| G | 157-158 (2) | `=ROUND($D{n}*G${n},2)` | `G157` = `=ROUND($D157*G$156,2)` |
| G | 159 (1) | `=ROUND(G{n}+G{n}+G{n},2)` | `G159` = `=ROUND(G156+G157+G158,2)` |
| G | 160 (1) | `=ROUND($D{n}*G${n},2)` | `G160` = `=ROUND($D160*G$159,2)` |
| G | 161 (1) | `=ROUND(G{n}+G{n},2)` | `G161` = `=ROUND(G159+G160,2)` |

**⚠ Posibles problemas detectados:**

- `F148`: posible número mágico dentro de la fórmula: 2500, 3523

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 8 celdas. Ejemplos: B1='PRESUPUESTO DE OBRA', B10='ITEM', C10='DESCRIPCION', D10='PRESUPUESTO DE OBRA', D11='UND', E11='METRADO', F11='P.UND', G11='TOTAL'
- Color `theme0` — 610 celdas. Ejemplos: B3='Obra:', B4='Entidad:', B5='Ejecutor:', B6='Supervisor:', B7='Residente:', B8='Ing. Supervisor:', B12='01', C12='CREACION DE PISTAS Y VEREDAS JR LOS CEDROS' … (+602 más)

### Hoja: CALEN. PROG.

- Celdas con fórmula: 469
- Celdas con valor literal (posibles inputs): 754

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| F | 148 (1) | `=2500+3523` | `F148` = `=2500+3523` |
| G | 5-7 (3) | `=+FT!$E${n}` | `G5` = `=+FT!$E$24` |
| G | 15-24 (10) | `=ROUND(E{n}*F{n},2)` | `G15` = `=ROUND(E15*F15,2)` |
| G | 26-28 (3) | `=ROUND(E{n}*F{n},2)` | `G26` = `=ROUND(E26*F26,2)` |
| G | 30-52 (23) | `=ROUND(E{n}*F{n},2)` | `G30` = `=ROUND(E30*F30,2)` |
| G | 54-69 (16) | `=ROUND(E{n}*F{n},2)` | `G54` = `=ROUND(E54*F54,2)` |
| G | 71-74 (4) | `=ROUND(E{n}*F{n},2)` | `G71` = `=ROUND(E71*F71,2)` |
| G | 76-77 (2) | `=ROUND(E{n}*F{n},2)` | `G76` = `=ROUND(E76*F76,2)` |
| G | 80-84 (5) | `=ROUND(E{n}*F{n},2)` | `G80` = `=ROUND(E80*F80,2)` |
| G | 86-89 (4) | `=ROUND(E{n}*F{n},2)` | `G86` = `=ROUND(E86*F86,2)` |
| G | 92-95 (4) | `=ROUND(E{n}*F{n},2)` | `G92` = `=ROUND(E92*F92,2)` |
| G | 97-101 (5) | `=ROUND(E{n}*F{n},2)` | `G97` = `=ROUND(E97*F97,2)` |
| G | 104-105 (2) | `=ROUND(E{n}*F{n},2)` | `G104` = `=ROUND(E104*F104,2)` |
| G | 107-109 (3) | `=ROUND(E{n}*F{n},2)` | `G107` = `=ROUND(E107*F107,2)` |
| G | 111 (1) | `=ROUND(E{n}*F{n},2)` | `G111` = `=ROUND(E111*F111,2)` |
| G | 114-117 (4) | `=ROUND(E{n}*F{n},2)` | `G114` = `=ROUND(E114*F114,2)` |
| G | 119-122 (4) | `=ROUND(E{n}*F{n},2)` | `G119` = `=ROUND(E119*F119,2)` |
| G | 125-129 (5) | `=ROUND(E{n}*F{n},2)` | `G125` = `=ROUND(E125*F125,2)` |
| G | 131-133 (3) | `=ROUND(E{n}*F{n},2)` | `G131` = `=ROUND(E131*F131,2)` |
| G | 135-136 (2) | `=ROUND(E{n}*F{n},2)` | `G135` = `=ROUND(E135*F135,2)` |
| G | 138 (1) | `=ROUND(E{n}*F{n},2)` | `G138` = `=ROUND(E138*F138,2)` |
| G | 140 (1) | `=ROUND(E{n}*F{n},2)` | `G140` = `=ROUND(E140*F140,2)` |
| G | 142-146 (5) | `=ROUND(E{n}*F{n},2)` | `G142` = `=ROUND(E142*F142,2)` |
| G | 148 (1) | `=ROUND(E{n}*F{n},2)` | `G148` = `=ROUND(E148*F148,2)` |
| G | 150-155 (6) | `=ROUND(E{n}*F{n},2)` | `G150` = `=ROUND(E150*F150,2)` |
| G | 156 (1) | `=ROUND(SUM(G{n}:G{n}),2)` | `G156` = `=ROUND(SUM(G12:G155),2)` |
| G | 157-158 (2) | `=ROUND($D{n}*G${n},2)` | `G157` = `=ROUND($D157*G$156,2)` |
| G | 159 (1) | `=ROUND(G{n}+G{n}+G{n},2)` | `G159` = `=ROUND(G156+G157+G158,2)` |
| G | 160 (1) | `=ROUND($D{n}*G${n},2)` | `G160` = `=ROUND($D160*G$159,2)` |
| G | 161 (1) | `=ROUND(G{n}+G{n},2)` | `G161` = `=ROUND(G159+G160,2)` |
| G | 162-163 (2) | `=ROUND(G{n}/$G{n},4)` | `G162` = `=ROUND(G156/$G156,4)` |
| I | 15-17 (3) | `=ROUND(J{n}/$G{n},4)` | `I15` = `=ROUND(J15/$G15,4)` |
| I | 19-21 (3) | `=ROUND(J{n}/$G{n},4)` | `I19` = `=ROUND(J19/$G19,4)` |
| I | 23-24 (2) | `=ROUND(J{n}/$G{n},4)` | `I23` = `=ROUND(J23/$G23,4)` |
| I | 26-27 (2) | `=ROUND(J{n}/$G{n},4)` | `I26` = `=ROUND(J26/$G26,4)` |
| I | 30-32 (3) | `=ROUND(J{n}/$G{n},4)` | `I30` = `=ROUND(J30/$G30,4)` |
| I | 34 (1) | `=ROUND(J{n}/$G{n},4)` | `I34` = `=ROUND(J34/$G34,4)` |
| I | 36 (1) | `=ROUND(J{n}/$G{n},4)` | `I36` = `=ROUND(J36/$G36,4)` |
| I | 38-45 (8) | `=ROUND(J{n}/$G{n},4)` | `I38` = `=ROUND(J38/$G38,4)` |
| I | 47 (1) | `=ROUND(J{n}/$G{n},4)` | `I47` = `=ROUND(J47/$G47,4)` |
| I | 49-51 (3) | `=ROUND(J{n}/$G{n},4)` | `I49` = `=ROUND(J49/$G49,4)` |
| I | 54-58 (5) | `=ROUND(J{n}/$G{n},4)` | `I54` = `=ROUND(J54/$G54,4)` |
| I | 60-64 (5) | `=ROUND(J{n}/$G{n},4)` | `I60` = `=ROUND(J60/$G60,4)` |
| I | 66-69 (4) | `=ROUND(J{n}/$G{n},4)` | `I66` = `=ROUND(J66/$G66,4)` |
| I | 71-74 (4) | `=ROUND(J{n}/$G{n},4)` | `I71` = `=ROUND(J71/$G71,4)` |
| I | 76-77 (2) | `=ROUND(J{n}/$G{n},4)` | `I76` = `=ROUND(J76/$G76,4)` |
| I | 80-84 (5) | `=ROUND(J{n}/$G{n},4)` | `I80` = `=ROUND(J80/$G80,4)` |
| I | 86-89 (4) | `=ROUND(J{n}/$G{n},4)` | `I86` = `=ROUND(J86/$G86,4)` |
| I | 92-95 (4) | `=ROUND(J{n}/$G{n},4)` | `I92` = `=ROUND(J92/$G92,4)` |
| I | 97-101 (5) | `=ROUND(J{n}/$G{n},4)` | `I97` = `=ROUND(J97/$G97,4)` |
| I | 104-105 (2) | `=ROUND(J{n}/$G{n},4)` | `I104` = `=ROUND(J104/$G104,4)` |
| I | 107-109 (3) | `=ROUND(J{n}/$G{n},4)` | `I107` = `=ROUND(J107/$G107,4)` |
| I | 111 (1) | `=ROUND(J{n}/$G{n},4)` | `I111` = `=ROUND(J111/$G111,4)` |
| I | 114-117 (4) | `=ROUND(J{n}/$G{n},4)` | `I114` = `=ROUND(J114/$G114,4)` |
| I | 119-122 (4) | `=ROUND(J{n}/$G{n},4)` | `I119` = `=ROUND(J119/$G119,4)` |
| I | 125-129 (5) | `=ROUND(J{n}/$G{n},4)` | `I125` = `=ROUND(J125/$G125,4)` |
| I | 131-133 (3) | `=ROUND(J{n}/$G{n},4)` | `I131` = `=ROUND(J131/$G131,4)` |
| I | 135-136 (2) | `=ROUND(J{n}/$G{n},4)` | `I135` = `=ROUND(J135/$G135,4)` |
| I | 138 (1) | `=ROUND(J{n}/$G{n},4)` | `I138` = `=ROUND(J138/$G138,4)` |
| I | 140 (1) | `=ROUND(J{n}/$G{n},4)` | `I140` = `=ROUND(J140/$G140,4)` |
| I | 142-146 (5) | `=ROUND(J{n}/$G{n},4)` | `I142` = `=ROUND(J142/$G142,4)` |
| I | 148 (1) | `=ROUND(J{n}/$G{n},4)` | `I148` = `=ROUND(J148/$G148,4)` |
| I | 150-155 (6) | `=ROUND(J{n}/$G{n},4)` | `I150` = `=ROUND(J150/$G150,4)` |
| I | 156 (1) | `=+J{n}` | `I156` = `=+J162` |
| J | 156 (1) | `=ROUND(SUM(J{n}:J{n}),2)` | `J156` = `=ROUND(SUM(J12:J155),2)` |
| J | 157-158 (2) | `=ROUND($D{n}*J${n},2)` | `J157` = `=ROUND($D157*J$156,2)` |
| J | 159 (1) | `=ROUND(J{n}+J{n}+J{n},2)` | `J159` = `=ROUND(J156+J157+J158,2)` |
| J | 160 (1) | `=ROUND($D{n}*J${n},2)` | `J160` = `=ROUND($D160*J$159,2)` |
| J | 161 (1) | `=ROUND(J{n}+J{n},2)` | `J161` = `=ROUND(J159+J160,2)` |
| J | 162-163 (2) | `=ROUND(J{n}/$G{n},4)` | `J162` = `=ROUND(J156/$G156,4)` |
| L | 15-17 (3) | `=ROUND(M{n}/$G{n},4)` | `L15` = `=ROUND(M15/$G15,4)` |
| L | 19-21 (3) | `=ROUND(M{n}/$G{n},4)` | `L19` = `=ROUND(M19/$G19,4)` |
| L | 23-24 (2) | `=ROUND(M{n}/$G{n},4)` | `L23` = `=ROUND(M23/$G23,4)` |
| L | 26-27 (2) | `=ROUND(M{n}/$G{n},4)` | `L26` = `=ROUND(M26/$G26,4)` |
| L | 30-32 (3) | `=ROUND(M{n}/$G{n},4)` | `L30` = `=ROUND(M30/$G30,4)` |
| L | 34 (1) | `=ROUND(M{n}/$G{n},4)` | `L34` = `=ROUND(M34/$G34,4)` |
| L | 36 (1) | `=ROUND(M{n}/$G{n},4)` | `L36` = `=ROUND(M36/$G36,4)` |
| L | 38-45 (8) | `=ROUND(M{n}/$G{n},4)` | `L38` = `=ROUND(M38/$G38,4)` |
| L | 47 (1) | `=ROUND(M{n}/$G{n},4)` | `L47` = `=ROUND(M47/$G47,4)` |
| L | 49-51 (3) | `=ROUND(M{n}/$G{n},4)` | `L49` = `=ROUND(M49/$G49,4)` |
| L | 54-58 (5) | `=ROUND(M{n}/$G{n},4)` | `L54` = `=ROUND(M54/$G54,4)` |
| L | 60-64 (5) | `=ROUND(M{n}/$G{n},4)` | `L60` = `=ROUND(M60/$G60,4)` |
| L | 66-69 (4) | `=ROUND(M{n}/$G{n},4)` | `L66` = `=ROUND(M66/$G66,4)` |
| L | 71-74 (4) | `=ROUND(M{n}/$G{n},4)` | `L71` = `=ROUND(M71/$G71,4)` |
| L | 76-77 (2) | `=ROUND(M{n}/$G{n},4)` | `L76` = `=ROUND(M76/$G76,4)` |
| L | 80-84 (5) | `=ROUND(M{n}/$G{n},4)` | `L80` = `=ROUND(M80/$G80,4)` |
| L | 86-89 (4) | `=ROUND(M{n}/$G{n},4)` | `L86` = `=ROUND(M86/$G86,4)` |
| L | 92-95 (4) | `=ROUND(M{n}/$G{n},4)` | `L92` = `=ROUND(M92/$G92,4)` |
| L | 97-101 (5) | `=ROUND(M{n}/$G{n},4)` | `L97` = `=ROUND(M97/$G97,4)` |
| L | 104-105 (2) | `=ROUND(M{n}/$G{n},4)` | `L104` = `=ROUND(M104/$G104,4)` |
| L | 107-109 (3) | `=ROUND(M{n}/$G{n},4)` | `L107` = `=ROUND(M107/$G107,4)` |
| L | 111 (1) | `=ROUND(M{n}/$G{n},4)` | `L111` = `=ROUND(M111/$G111,4)` |
| L | 114-117 (4) | `=ROUND(M{n}/$G{n},4)` | `L114` = `=ROUND(M114/$G114,4)` |
| L | 119-122 (4) | `=ROUND(M{n}/$G{n},4)` | `L119` = `=ROUND(M119/$G119,4)` |
| L | 125-129 (5) | `=ROUND(M{n}/$G{n},4)` | `L125` = `=ROUND(M125/$G125,4)` |
| L | 131-133 (3) | `=ROUND(M{n}/$G{n},4)` | `L131` = `=ROUND(M131/$G131,4)` |
| L | 135-136 (2) | `=ROUND(M{n}/$G{n},4)` | `L135` = `=ROUND(M135/$G135,4)` |
| L | 138 (1) | `=ROUND(M{n}/$G{n},4)` | `L138` = `=ROUND(M138/$G138,4)` |
| L | 140 (1) | `=ROUND(M{n}/$G{n},4)` | `L140` = `=ROUND(M140/$G140,4)` |
| L | 142-146 (5) | `=ROUND(M{n}/$G{n},4)` | `L142` = `=ROUND(M142/$G142,4)` |
| L | 148 (1) | `=ROUND(M{n}/$G{n},4)` | `L148` = `=ROUND(M148/$G148,4)` |
| L | 150-155 (6) | `=ROUND(M{n}/$G{n},4)` | `L150` = `=ROUND(M150/$G150,4)` |
| L | 156 (1) | `=+M{n}` | `L156` = `=+M162` |
| M | 156 (1) | `=ROUND(SUM(M{n}:M{n}),2)` | `M156` = `=ROUND(SUM(M12:M155),2)` |
| M | 157-158 (2) | `=ROUND($D{n}*M${n},2)` | `M157` = `=ROUND($D157*M$156,2)` |
| M | 159 (1) | `=ROUND(M{n}+M{n}+M{n},2)` | `M159` = `=ROUND(M156+M157+M158,2)` |
| M | 160 (1) | `=ROUND($D{n}*M${n},2)` | `M160` = `=ROUND($D160*M$159,2)` |
| M | 161 (1) | `=ROUND(M{n}+M{n},2)` | `M161` = `=ROUND(M159+M160,2)` |
| M | 162 (1) | `=ROUND(M{n}/$G{n},4)` | `M162` = `=ROUND(M156/$G156,4)` |
| M | 163 (1) | `=+J{n}+M{n}` | `M163` = `=+J163+M162` |
| O | 15-17 (3) | `=ROUND(P{n}/$G{n},4)` | `O15` = `=ROUND(P15/$G15,4)` |
| O | 19-21 (3) | `=ROUND(P{n}/$G{n},4)` | `O19` = `=ROUND(P19/$G19,4)` |
| O | 23-24 (2) | `=ROUND(P{n}/$G{n},4)` | `O23` = `=ROUND(P23/$G23,4)` |
| O | 26-27 (2) | `=ROUND(P{n}/$G{n},4)` | `O26` = `=ROUND(P26/$G26,4)` |
| O | 30-32 (3) | `=ROUND(P{n}/$G{n},4)` | `O30` = `=ROUND(P30/$G30,4)` |
| O | 34 (1) | `=ROUND(P{n}/$G{n},4)` | `O34` = `=ROUND(P34/$G34,4)` |
| O | 36 (1) | `=ROUND(P{n}/$G{n},4)` | `O36` = `=ROUND(P36/$G36,4)` |
| O | 38-45 (8) | `=ROUND(P{n}/$G{n},4)` | `O38` = `=ROUND(P38/$G38,4)` |
| O | 47 (1) | `=ROUND(P{n}/$G{n},4)` | `O47` = `=ROUND(P47/$G47,4)` |
| O | 49-51 (3) | `=ROUND(P{n}/$G{n},4)` | `O49` = `=ROUND(P49/$G49,4)` |
| O | 54-58 (5) | `=ROUND(P{n}/$G{n},4)` | `O54` = `=ROUND(P54/$G54,4)` |
| O | 60-64 (5) | `=ROUND(P{n}/$G{n},4)` | `O60` = `=ROUND(P60/$G60,4)` |
| O | 66-69 (4) | `=ROUND(P{n}/$G{n},4)` | `O66` = `=ROUND(P66/$G66,4)` |
| O | 71-74 (4) | `=ROUND(P{n}/$G{n},4)` | `O71` = `=ROUND(P71/$G71,4)` |
| O | 76-77 (2) | `=ROUND(P{n}/$G{n},4)` | `O76` = `=ROUND(P76/$G76,4)` |
| O | 80-84 (5) | `=ROUND(P{n}/$G{n},4)` | `O80` = `=ROUND(P80/$G80,4)` |
| O | 86-89 (4) | `=ROUND(P{n}/$G{n},4)` | `O86` = `=ROUND(P86/$G86,4)` |
| O | 92-95 (4) | `=ROUND(P{n}/$G{n},4)` | `O92` = `=ROUND(P92/$G92,4)` |
| O | 97-101 (5) | `=ROUND(P{n}/$G{n},4)` | `O97` = `=ROUND(P97/$G97,4)` |
| O | 104-105 (2) | `=ROUND(P{n}/$G{n},4)` | `O104` = `=ROUND(P104/$G104,4)` |
| O | 107-109 (3) | `=ROUND(P{n}/$G{n},4)` | `O107` = `=ROUND(P107/$G107,4)` |
| O | 111 (1) | `=ROUND(P{n}/$G{n},4)` | `O111` = `=ROUND(P111/$G111,4)` |
| O | 114-117 (4) | `=ROUND(P{n}/$G{n},4)` | `O114` = `=ROUND(P114/$G114,4)` |
| O | 119-122 (4) | `=ROUND(P{n}/$G{n},4)` | `O119` = `=ROUND(P119/$G119,4)` |
| O | 125-129 (5) | `=ROUND(P{n}/$G{n},4)` | `O125` = `=ROUND(P125/$G125,4)` |
| O | 131-133 (3) | `=ROUND(P{n}/$G{n},4)` | `O131` = `=ROUND(P131/$G131,4)` |
| O | 135-136 (2) | `=ROUND(P{n}/$G{n},4)` | `O135` = `=ROUND(P135/$G135,4)` |
| O | 138 (1) | `=ROUND(P{n}/$G{n},4)` | `O138` = `=ROUND(P138/$G138,4)` |
| O | 140 (1) | `=ROUND(P{n}/$G{n},4)` | `O140` = `=ROUND(P140/$G140,4)` |
| O | 142-146 (5) | `=ROUND(P{n}/$G{n},4)` | `O142` = `=ROUND(P142/$G142,4)` |
| O | 148 (1) | `=ROUND(P{n}/$G{n},4)` | `O148` = `=ROUND(P148/$G148,4)` |
| O | 150-155 (6) | `=ROUND(P{n}/$G{n},4)` | `O150` = `=ROUND(P150/$G150,4)` |
| O | 156 (1) | `=+P{n}` | `O156` = `=+P162` |
| P | 156 (1) | `=ROUND(SUM(P{n}:P{n}),2)` | `P156` = `=ROUND(SUM(P12:P155),2)` |
| P | 157-158 (2) | `=ROUND($D{n}*P${n},2)` | `P157` = `=ROUND($D157*P$156,2)` |
| P | 159 (1) | `=ROUND(P{n}+P{n}+P{n},2)` | `P159` = `=ROUND(P156+P157+P158,2)` |
| P | 160 (1) | `=ROUND($D{n}*P${n},2)` | `P160` = `=ROUND($D160*P$159,2)` |
| P | 161 (1) | `=ROUND(P{n}+P{n},2)` | `P161` = `=ROUND(P159+P160,2)` |
| P | 162 (1) | `=ROUND(P{n}/$G{n},4)` | `P162` = `=ROUND(P156/$G156,4)` |
| P | 163 (1) | `=+M{n}+P{n}` | `P163` = `=+M163+P162` |
| T | 115 (1) | `=+I{n}+60-1` | `T115` = `=+I10+60-1` |

**⚠ Posibles problemas detectados:**

- `F148`: posible número mágico dentro de la fórmula: 2500, 3523

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 23 celdas. Ejemplos: B1='CALENDARIO DE AVANCE DE OBRA VALORIZADO PROGRAMADO ADECUADO AL INICIO DE LA OBRA', B9='ITEM', C9='DESCRIPCION', D9='PRESUPUESTO DE OBRA', I9=datetime.datetime(2026, 6, 1, 0, 0), L9=datetime.datetime(2026, 7, 1, 0, 0), O9=datetime.datetime(2026, 8, 1, 0, 0), I10=datetime.datetime(2026, 6, 20, 0, 0) … (+15 más)
- Color `theme0` — 136 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', D5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', D6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:' … (+128 más)
- Color `sin color` — 595 celdas. Ejemplos: B12='01', C12='CREACION DE PISTAS Y VEREDAS JR LOS CEDROS', B13='01.01', C13='OBRAS\xa0PROVISIONALES Y TRABAJOS\xa0PRELIMINARES', B14='01.01.01', C14='OBRAS PROVISIONALES', B15='01.01.01.01', C15='ALQUILER  DE ALAMACEN, OFICINA Y CASETA DE GUARDIANIA' … (+587 más)

### Hoja: METRADOS

- Celdas con fórmula: 217
- Celdas con valor literal (posibles inputs): 620

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| G | 5-7 (3) | `=+FT!$E${n}` | `G5` = `=+FT!$E$24` |
| M | 12 (1) | `=+G{n}+I{n}+K{n}` | `M12` = `=+G12+I12+K12` |
| M | 14-16 (3) | `=+G{n}+I{n}+K{n}` | `M14` = `=+G14+I14+K14` |
| M | 18-20 (3) | `=+G{n}+I{n}+K{n}` | `M18` = `=+G18+I18+K18` |
| M | 22-23 (2) | `=+G{n}+I{n}+K{n}` | `M22` = `=+G22+I22+K22` |
| M | 25-26 (2) | `=+G{n}+I{n}+K{n}` | `M25` = `=+G25+I25+K25` |
| M | 29-31 (3) | `=+G{n}+I{n}+K{n}` | `M29` = `=+G29+I29+K29` |
| M | 33 (1) | `=+G{n}+I{n}+K{n}` | `M33` = `=+G33+I33+K33` |
| M | 35 (1) | `=+G{n}+I{n}+K{n}` | `M35` = `=+G35+I35+K35` |
| M | 37-44 (8) | `=+G{n}+I{n}+K{n}` | `M37` = `=+G37+I37+K37` |
| M | 46 (1) | `=+G{n}+I{n}+K{n}` | `M46` = `=+G46+I46+K46` |
| M | 48-50 (3) | `=+G{n}+I{n}+K{n}` | `M48` = `=+G48+I48+K48` |
| M | 53-57 (5) | `=+G{n}+I{n}+K{n}` | `M53` = `=+G53+I53+K53` |
| M | 59-63 (5) | `=+G{n}+I{n}+K{n}` | `M59` = `=+G59+I59+K59` |
| M | 65-68 (4) | `=+G{n}+I{n}+K{n}` | `M65` = `=+G65+I65+K65` |
| M | 70-73 (4) | `=+G{n}+I{n}+K{n}` | `M70` = `=+G70+I70+K70` |
| M | 75-76 (2) | `=+G{n}+I{n}+K{n}` | `M75` = `=+G75+I75+K75` |
| M | 79-83 (5) | `=+G{n}+I{n}+K{n}` | `M79` = `=+G79+I79+K79` |
| M | 85-88 (4) | `=+G{n}+I{n}+K{n}` | `M85` = `=+G85+I85+K85` |
| M | 91-94 (4) | `=+G{n}+I{n}+K{n}` | `M91` = `=+G91+I91+K91` |
| M | 96-100 (5) | `=+G{n}+I{n}+K{n}` | `M96` = `=+G96+I96+K96` |
| M | 103-104 (2) | `=+G{n}+I{n}+K{n}` | `M103` = `=+G103+I103+K103` |
| M | 106-108 (3) | `=+G{n}+I{n}+K{n}` | `M106` = `=+G106+I106+K106` |
| M | 110 (1) | `=+G{n}+I{n}+K{n}` | `M110` = `=+G110+I110+K110` |
| M | 113-116 (4) | `=+G{n}+I{n}+K{n}` | `M113` = `=+G113+I113+K113` |
| M | 118-121 (4) | `=+G{n}+I{n}+K{n}` | `M118` = `=+G118+I118+K118` |
| M | 124-128 (5) | `=+G{n}+I{n}+K{n}` | `M124` = `=+G124+I124+K124` |
| M | 130-132 (3) | `=+G{n}+I{n}+K{n}` | `M130` = `=+G130+I130+K130` |
| M | 134-135 (2) | `=+G{n}+I{n}+K{n}` | `M134` = `=+G134+I134+K134` |
| M | 137 (1) | `=+G{n}+I{n}+K{n}` | `M137` = `=+G137+I137+K137` |
| M | 139 (1) | `=+G{n}+I{n}+K{n}` | `M139` = `=+G139+I139+K139` |
| M | 141-145 (5) | `=+G{n}+I{n}+K{n}` | `M141` = `=+G141+I141+K141` |
| M | 147 (1) | `=+G{n}+I{n}+K{n}` | `M147` = `=+G147+I147+K147` |
| M | 149-154 (6) | `=+G{n}+I{n}+K{n}` | `M149` = `=+G149+I149+K149` |
| O | 12 (1) | `=+E{n}-M{n}` | `O12` = `=+E12-M12` |
| O | 14-16 (3) | `=+E{n}-M{n}` | `O14` = `=+E14-M14` |
| O | 18-20 (3) | `=+E{n}-M{n}` | `O18` = `=+E18-M18` |
| O | 22-23 (2) | `=+E{n}-M{n}` | `O22` = `=+E22-M22` |
| O | 25-26 (2) | `=+E{n}-M{n}` | `O25` = `=+E25-M25` |
| O | 29-31 (3) | `=+E{n}-M{n}` | `O29` = `=+E29-M29` |
| O | 33 (1) | `=+E{n}-M{n}` | `O33` = `=+E33-M33` |
| O | 35 (1) | `=+E{n}-M{n}` | `O35` = `=+E35-M35` |
| O | 37-44 (8) | `=+E{n}-M{n}` | `O37` = `=+E37-M37` |
| O | 46 (1) | `=+E{n}-M{n}` | `O46` = `=+E46-M46` |
| O | 48-50 (3) | `=+E{n}-M{n}` | `O48` = `=+E48-M48` |
| O | 53-57 (5) | `=+E{n}-M{n}` | `O53` = `=+E53-M53` |
| O | 59-63 (5) | `=+E{n}-M{n}` | `O59` = `=+E59-M59` |
| O | 65-68 (4) | `=+E{n}-M{n}` | `O65` = `=+E65-M65` |
| O | 70-73 (4) | `=+E{n}-M{n}` | `O70` = `=+E70-M70` |
| O | 75-76 (2) | `=+E{n}-M{n}` | `O75` = `=+E75-M75` |
| O | 79-83 (5) | `=+E{n}-M{n}` | `O79` = `=+E79-M79` |
| O | 85-88 (4) | `=+E{n}-M{n}` | `O85` = `=+E85-M85` |
| O | 91-94 (4) | `=+E{n}-M{n}` | `O91` = `=+E91-M91` |
| O | 96-100 (5) | `=+E{n}-M{n}` | `O96` = `=+E96-M96` |
| O | 103-104 (2) | `=+E{n}-M{n}` | `O103` = `=+E103-M103` |
| O | 106-108 (3) | `=+E{n}-M{n}` | `O106` = `=+E106-M106` |
| O | 110 (1) | `=+E{n}-M{n}` | `O110` = `=+E110-M110` |
| O | 113-116 (4) | `=+E{n}-M{n}` | `O113` = `=+E113-M113` |
| O | 118-121 (4) | `=+E{n}-M{n}` | `O118` = `=+E118-M118` |
| O | 124-128 (5) | `=+E{n}-M{n}` | `O124` = `=+E124-M124` |
| O | 130-132 (3) | `=+E{n}-M{n}` | `O130` = `=+E130-M130` |
| O | 134-135 (2) | `=+E{n}-M{n}` | `O134` = `=+E134-M134` |
| O | 137 (1) | `=+E{n}-M{n}` | `O137` = `=+E137-M137` |
| O | 139 (1) | `=+E{n}-M{n}` | `O139` = `=+E139-M139` |
| O | 141-145 (5) | `=+E{n}-M{n}` | `O141` = `=+E141-M141` |
| O | 147 (1) | `=+E{n}-M{n}` | `O147` = `=+E147-M147` |
| O | 149-154 (6) | `=+E{n}-M{n}` | `O149` = `=+E149-M149` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 10 celdas. Ejemplos: B1='RESUMEN DE METRADOS EJECUTADOS EN EL PRESENTE MES', B9='ITEM', C9='DESCRIPCION', D9='METRADO CONTRATADO', G9=datetime.datetime(2026, 6, 1, 0, 0), M9='METRADO ACUMULADO', O9='SALDO POR METRAR', D10='UND' … (+2 más)
- Color `theme0` — 606 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', D5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', D6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:' … (+598 más)
- Color `theme8` — 4 celdas. Ejemplos: I9=datetime.datetime(2026, 7, 1, 0, 0), K9=datetime.datetime(2026, 5, 1, 0, 0), I10='METRADO', K10='METRADO'

### Hoja: CALEN. VALO.

- Celdas con fórmula: 468
- Celdas con valor literal (posibles inputs): 844

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| F | 148 (1) | `=2500+3523` | `F148` = `=2500+3523` |
| G | 5-7 (3) | `=+FT!$E${n}` | `G5` = `=+FT!$E$24` |
| G | 15-24 (10) | `=ROUND(E{n}*F{n},2)` | `G15` = `=ROUND(E15*F15,2)` |
| G | 26-28 (3) | `=ROUND(E{n}*F{n},2)` | `G26` = `=ROUND(E26*F26,2)` |
| G | 30-52 (23) | `=ROUND(E{n}*F{n},2)` | `G30` = `=ROUND(E30*F30,2)` |
| G | 54-69 (16) | `=ROUND(E{n}*F{n},2)` | `G54` = `=ROUND(E54*F54,2)` |
| G | 71-74 (4) | `=ROUND(E{n}*F{n},2)` | `G71` = `=ROUND(E71*F71,2)` |
| G | 76-77 (2) | `=ROUND(E{n}*F{n},2)` | `G76` = `=ROUND(E76*F76,2)` |
| G | 80-84 (5) | `=ROUND(E{n}*F{n},2)` | `G80` = `=ROUND(E80*F80,2)` |
| G | 86-89 (4) | `=ROUND(E{n}*F{n},2)` | `G86` = `=ROUND(E86*F86,2)` |
| G | 92-95 (4) | `=ROUND(E{n}*F{n},2)` | `G92` = `=ROUND(E92*F92,2)` |
| G | 97-101 (5) | `=ROUND(E{n}*F{n},2)` | `G97` = `=ROUND(E97*F97,2)` |
| G | 104-105 (2) | `=ROUND(E{n}*F{n},2)` | `G104` = `=ROUND(E104*F104,2)` |
| G | 107-109 (3) | `=ROUND(E{n}*F{n},2)` | `G107` = `=ROUND(E107*F107,2)` |
| G | 111 (1) | `=ROUND(E{n}*F{n},2)` | `G111` = `=ROUND(E111*F111,2)` |
| G | 114-117 (4) | `=ROUND(E{n}*F{n},2)` | `G114` = `=ROUND(E114*F114,2)` |
| G | 119-122 (4) | `=ROUND(E{n}*F{n},2)` | `G119` = `=ROUND(E119*F119,2)` |
| G | 125-129 (5) | `=ROUND(E{n}*F{n},2)` | `G125` = `=ROUND(E125*F125,2)` |
| G | 131-133 (3) | `=ROUND(E{n}*F{n},2)` | `G131` = `=ROUND(E131*F131,2)` |
| G | 135-136 (2) | `=ROUND(E{n}*F{n},2)` | `G135` = `=ROUND(E135*F135,2)` |
| G | 138 (1) | `=ROUND(E{n}*F{n},2)` | `G138` = `=ROUND(E138*F138,2)` |
| G | 140 (1) | `=ROUND(E{n}*F{n},2)` | `G140` = `=ROUND(E140*F140,2)` |
| G | 142-146 (5) | `=ROUND(E{n}*F{n},2)` | `G142` = `=ROUND(E142*F142,2)` |
| G | 148 (1) | `=ROUND(E{n}*F{n},2)` | `G148` = `=ROUND(E148*F148,2)` |
| G | 150-155 (6) | `=ROUND(E{n}*F{n},2)` | `G150` = `=ROUND(E150*F150,2)` |
| G | 156 (1) | `=ROUND(SUM(G{n}:G{n}),2)` | `G156` = `=ROUND(SUM(G12:G155),2)` |
| G | 157-158 (2) | `=ROUND($D{n}*G${n},2)` | `G157` = `=ROUND($D157*G$156,2)` |
| G | 159 (1) | `=ROUND(G{n}+G{n}+G{n},2)` | `G159` = `=ROUND(G156+G157+G158,2)` |
| G | 160 (1) | `=ROUND($D{n}*G${n},2)` | `G160` = `=ROUND($D160*G$159,2)` |
| G | 161 (1) | `=ROUND(G{n}+G{n},2)` | `G161` = `=ROUND(G159+G160,2)` |
| G | 162-163 (2) | `=ROUND(G{n}/$G{n},4)` | `G162` = `=ROUND(G156/$G156,4)` |
| I | 15-17 (3) | `=ROUND(J{n}/$G{n},4)` | `I15` = `=ROUND(J15/$G15,4)` |
| I | 19-21 (3) | `=ROUND(J{n}/$G{n},4)` | `I19` = `=ROUND(J19/$G19,4)` |
| I | 23-24 (2) | `=ROUND(J{n}/$G{n},4)` | `I23` = `=ROUND(J23/$G23,4)` |
| I | 26-27 (2) | `=ROUND(J{n}/$G{n},4)` | `I26` = `=ROUND(J26/$G26,4)` |
| I | 30-32 (3) | `=ROUND(J{n}/$G{n},4)` | `I30` = `=ROUND(J30/$G30,4)` |
| I | 34 (1) | `=ROUND(J{n}/$G{n},4)` | `I34` = `=ROUND(J34/$G34,4)` |
| I | 36 (1) | `=ROUND(J{n}/$G{n},4)` | `I36` = `=ROUND(J36/$G36,4)` |
| I | 38-45 (8) | `=ROUND(J{n}/$G{n},4)` | `I38` = `=ROUND(J38/$G38,4)` |
| I | 47 (1) | `=ROUND(J{n}/$G{n},4)` | `I47` = `=ROUND(J47/$G47,4)` |
| I | 49-51 (3) | `=ROUND(J{n}/$G{n},4)` | `I49` = `=ROUND(J49/$G49,4)` |
| I | 54-58 (5) | `=ROUND(J{n}/$G{n},4)` | `I54` = `=ROUND(J54/$G54,4)` |
| I | 60-64 (5) | `=ROUND(J{n}/$G{n},4)` | `I60` = `=ROUND(J60/$G60,4)` |
| I | 66-69 (4) | `=ROUND(J{n}/$G{n},4)` | `I66` = `=ROUND(J66/$G66,4)` |
| I | 71-74 (4) | `=ROUND(J{n}/$G{n},4)` | `I71` = `=ROUND(J71/$G71,4)` |
| I | 76-77 (2) | `=ROUND(J{n}/$G{n},4)` | `I76` = `=ROUND(J76/$G76,4)` |
| I | 80-84 (5) | `=ROUND(J{n}/$G{n},4)` | `I80` = `=ROUND(J80/$G80,4)` |
| I | 86-89 (4) | `=ROUND(J{n}/$G{n},4)` | `I86` = `=ROUND(J86/$G86,4)` |
| I | 92-95 (4) | `=ROUND(J{n}/$G{n},4)` | `I92` = `=ROUND(J92/$G92,4)` |
| I | 97-101 (5) | `=ROUND(J{n}/$G{n},4)` | `I97` = `=ROUND(J97/$G97,4)` |
| I | 104-105 (2) | `=ROUND(J{n}/$G{n},4)` | `I104` = `=ROUND(J104/$G104,4)` |
| I | 107-109 (3) | `=ROUND(J{n}/$G{n},4)` | `I107` = `=ROUND(J107/$G107,4)` |
| I | 111 (1) | `=ROUND(J{n}/$G{n},4)` | `I111` = `=ROUND(J111/$G111,4)` |
| I | 114-117 (4) | `=ROUND(J{n}/$G{n},4)` | `I114` = `=ROUND(J114/$G114,4)` |
| I | 119-122 (4) | `=ROUND(J{n}/$G{n},4)` | `I119` = `=ROUND(J119/$G119,4)` |
| I | 125-129 (5) | `=ROUND(J{n}/$G{n},4)` | `I125` = `=ROUND(J125/$G125,4)` |
| I | 131-133 (3) | `=ROUND(J{n}/$G{n},4)` | `I131` = `=ROUND(J131/$G131,4)` |
| I | 135-136 (2) | `=ROUND(J{n}/$G{n},4)` | `I135` = `=ROUND(J135/$G135,4)` |
| I | 138 (1) | `=ROUND(J{n}/$G{n},4)` | `I138` = `=ROUND(J138/$G138,4)` |
| I | 140 (1) | `=ROUND(J{n}/$G{n},4)` | `I140` = `=ROUND(J140/$G140,4)` |
| I | 142-146 (5) | `=ROUND(J{n}/$G{n},4)` | `I142` = `=ROUND(J142/$G142,4)` |
| I | 148 (1) | `=ROUND(J{n}/$G{n},4)` | `I148` = `=ROUND(J148/$G148,4)` |
| I | 150-155 (6) | `=ROUND(J{n}/$G{n},4)` | `I150` = `=ROUND(J150/$G150,4)` |
| I | 156 (1) | `=+J{n}` | `I156` = `=+J162` |
| J | 156 (1) | `=ROUND(SUM(J{n}:J{n}),2)` | `J156` = `=ROUND(SUM(J12:J155),2)` |
| J | 157-158 (2) | `=ROUND($D{n}*J${n},2)` | `J157` = `=ROUND($D157*J$156,2)` |
| J | 159 (1) | `=ROUND(J{n}+J{n}+J{n},2)` | `J159` = `=ROUND(J156+J157+J158,2)` |
| J | 160 (1) | `=ROUND($D{n}*J${n},2)` | `J160` = `=ROUND($D160*J$159,2)` |
| J | 161 (1) | `=ROUND(J{n}+J{n},2)` | `J161` = `=ROUND(J159+J160,2)` |
| J | 162-163 (2) | `=ROUND(J{n}/$G{n},4)` | `J162` = `=ROUND(J156/$G156,4)` |
| L | 15-17 (3) | `=ROUND(M{n}/$G{n},4)` | `L15` = `=ROUND(M15/$G15,4)` |
| L | 19-21 (3) | `=ROUND(M{n}/$G{n},4)` | `L19` = `=ROUND(M19/$G19,4)` |
| L | 23-24 (2) | `=ROUND(M{n}/$G{n},4)` | `L23` = `=ROUND(M23/$G23,4)` |
| L | 26-27 (2) | `=ROUND(M{n}/$G{n},4)` | `L26` = `=ROUND(M26/$G26,4)` |
| L | 30-32 (3) | `=ROUND(M{n}/$G{n},4)` | `L30` = `=ROUND(M30/$G30,4)` |
| L | 34 (1) | `=ROUND(M{n}/$G{n},4)` | `L34` = `=ROUND(M34/$G34,4)` |
| L | 36 (1) | `=ROUND(M{n}/$G{n},4)` | `L36` = `=ROUND(M36/$G36,4)` |
| L | 38-45 (8) | `=ROUND(M{n}/$G{n},4)` | `L38` = `=ROUND(M38/$G38,4)` |
| L | 47 (1) | `=ROUND(M{n}/$G{n},4)` | `L47` = `=ROUND(M47/$G47,4)` |
| L | 49-51 (3) | `=ROUND(M{n}/$G{n},4)` | `L49` = `=ROUND(M49/$G49,4)` |
| L | 54-58 (5) | `=ROUND(M{n}/$G{n},4)` | `L54` = `=ROUND(M54/$G54,4)` |
| L | 60-64 (5) | `=ROUND(M{n}/$G{n},4)` | `L60` = `=ROUND(M60/$G60,4)` |
| L | 66-69 (4) | `=ROUND(M{n}/$G{n},4)` | `L66` = `=ROUND(M66/$G66,4)` |
| L | 71-74 (4) | `=ROUND(M{n}/$G{n},4)` | `L71` = `=ROUND(M71/$G71,4)` |
| L | 76-77 (2) | `=ROUND(M{n}/$G{n},4)` | `L76` = `=ROUND(M76/$G76,4)` |
| L | 80-84 (5) | `=ROUND(M{n}/$G{n},4)` | `L80` = `=ROUND(M80/$G80,4)` |
| L | 86-89 (4) | `=ROUND(M{n}/$G{n},4)` | `L86` = `=ROUND(M86/$G86,4)` |
| L | 92-95 (4) | `=ROUND(M{n}/$G{n},4)` | `L92` = `=ROUND(M92/$G92,4)` |
| L | 97-101 (5) | `=ROUND(M{n}/$G{n},4)` | `L97` = `=ROUND(M97/$G97,4)` |
| L | 104-105 (2) | `=ROUND(M{n}/$G{n},4)` | `L104` = `=ROUND(M104/$G104,4)` |
| L | 107-109 (3) | `=ROUND(M{n}/$G{n},4)` | `L107` = `=ROUND(M107/$G107,4)` |
| L | 111 (1) | `=ROUND(M{n}/$G{n},4)` | `L111` = `=ROUND(M111/$G111,4)` |
| L | 114-117 (4) | `=ROUND(M{n}/$G{n},4)` | `L114` = `=ROUND(M114/$G114,4)` |
| L | 119-122 (4) | `=ROUND(M{n}/$G{n},4)` | `L119` = `=ROUND(M119/$G119,4)` |
| L | 125-129 (5) | `=ROUND(M{n}/$G{n},4)` | `L125` = `=ROUND(M125/$G125,4)` |
| L | 131-133 (3) | `=ROUND(M{n}/$G{n},4)` | `L131` = `=ROUND(M131/$G131,4)` |
| L | 135-136 (2) | `=ROUND(M{n}/$G{n},4)` | `L135` = `=ROUND(M135/$G135,4)` |
| L | 138 (1) | `=ROUND(M{n}/$G{n},4)` | `L138` = `=ROUND(M138/$G138,4)` |
| L | 140 (1) | `=ROUND(M{n}/$G{n},4)` | `L140` = `=ROUND(M140/$G140,4)` |
| L | 142-146 (5) | `=ROUND(M{n}/$G{n},4)` | `L142` = `=ROUND(M142/$G142,4)` |
| L | 148 (1) | `=ROUND(M{n}/$G{n},4)` | `L148` = `=ROUND(M148/$G148,4)` |
| L | 150-155 (6) | `=ROUND(M{n}/$G{n},4)` | `L150` = `=ROUND(M150/$G150,4)` |
| L | 156 (1) | `=+M{n}` | `L156` = `=+M162` |
| M | 156 (1) | `=ROUND(SUM(M{n}:M{n}),2)` | `M156` = `=ROUND(SUM(M12:M155),2)` |
| M | 157-158 (2) | `=ROUND($D{n}*M${n},2)` | `M157` = `=ROUND($D157*M$156,2)` |
| M | 159 (1) | `=ROUND(M{n}+M{n}+M{n},2)` | `M159` = `=ROUND(M156+M157+M158,2)` |
| M | 160 (1) | `=ROUND($D{n}*M${n},2)` | `M160` = `=ROUND($D160*M$159,2)` |
| M | 161 (1) | `=ROUND(M{n}+M{n},2)` | `M161` = `=ROUND(M159+M160,2)` |
| M | 162 (1) | `=ROUND(M{n}/$G{n},4)` | `M162` = `=ROUND(M156/$G156,4)` |
| M | 163 (1) | `=+J{n}+M{n}` | `M163` = `=+J163+M162` |
| O | 15-17 (3) | `=ROUND(P{n}/$G{n},4)` | `O15` = `=ROUND(P15/$G15,4)` |
| O | 19-21 (3) | `=ROUND(P{n}/$G{n},4)` | `O19` = `=ROUND(P19/$G19,4)` |
| O | 23-24 (2) | `=ROUND(P{n}/$G{n},4)` | `O23` = `=ROUND(P23/$G23,4)` |
| O | 26-27 (2) | `=ROUND(P{n}/$G{n},4)` | `O26` = `=ROUND(P26/$G26,4)` |
| O | 30-32 (3) | `=ROUND(P{n}/$G{n},4)` | `O30` = `=ROUND(P30/$G30,4)` |
| O | 34 (1) | `=ROUND(P{n}/$G{n},4)` | `O34` = `=ROUND(P34/$G34,4)` |
| O | 36 (1) | `=ROUND(P{n}/$G{n},4)` | `O36` = `=ROUND(P36/$G36,4)` |
| O | 38-45 (8) | `=ROUND(P{n}/$G{n},4)` | `O38` = `=ROUND(P38/$G38,4)` |
| O | 47 (1) | `=ROUND(P{n}/$G{n},4)` | `O47` = `=ROUND(P47/$G47,4)` |
| O | 49-51 (3) | `=ROUND(P{n}/$G{n},4)` | `O49` = `=ROUND(P49/$G49,4)` |
| O | 54-58 (5) | `=ROUND(P{n}/$G{n},4)` | `O54` = `=ROUND(P54/$G54,4)` |
| O | 60-64 (5) | `=ROUND(P{n}/$G{n},4)` | `O60` = `=ROUND(P60/$G60,4)` |
| O | 66-69 (4) | `=ROUND(P{n}/$G{n},4)` | `O66` = `=ROUND(P66/$G66,4)` |
| O | 71-74 (4) | `=ROUND(P{n}/$G{n},4)` | `O71` = `=ROUND(P71/$G71,4)` |
| O | 76-77 (2) | `=ROUND(P{n}/$G{n},4)` | `O76` = `=ROUND(P76/$G76,4)` |
| O | 80-84 (5) | `=ROUND(P{n}/$G{n},4)` | `O80` = `=ROUND(P80/$G80,4)` |
| O | 86-89 (4) | `=ROUND(P{n}/$G{n},4)` | `O86` = `=ROUND(P86/$G86,4)` |
| O | 92-95 (4) | `=ROUND(P{n}/$G{n},4)` | `O92` = `=ROUND(P92/$G92,4)` |
| O | 97-101 (5) | `=ROUND(P{n}/$G{n},4)` | `O97` = `=ROUND(P97/$G97,4)` |
| O | 104-105 (2) | `=ROUND(P{n}/$G{n},4)` | `O104` = `=ROUND(P104/$G104,4)` |
| O | 107-109 (3) | `=ROUND(P{n}/$G{n},4)` | `O107` = `=ROUND(P107/$G107,4)` |
| O | 111 (1) | `=ROUND(P{n}/$G{n},4)` | `O111` = `=ROUND(P111/$G111,4)` |
| O | 114-117 (4) | `=ROUND(P{n}/$G{n},4)` | `O114` = `=ROUND(P114/$G114,4)` |
| O | 119-122 (4) | `=ROUND(P{n}/$G{n},4)` | `O119` = `=ROUND(P119/$G119,4)` |
| O | 125-129 (5) | `=ROUND(P{n}/$G{n},4)` | `O125` = `=ROUND(P125/$G125,4)` |
| O | 131-133 (3) | `=ROUND(P{n}/$G{n},4)` | `O131` = `=ROUND(P131/$G131,4)` |
| O | 135-136 (2) | `=ROUND(P{n}/$G{n},4)` | `O135` = `=ROUND(P135/$G135,4)` |
| O | 138 (1) | `=ROUND(P{n}/$G{n},4)` | `O138` = `=ROUND(P138/$G138,4)` |
| O | 140 (1) | `=ROUND(P{n}/$G{n},4)` | `O140` = `=ROUND(P140/$G140,4)` |
| O | 142-146 (5) | `=ROUND(P{n}/$G{n},4)` | `O142` = `=ROUND(P142/$G142,4)` |
| O | 148 (1) | `=ROUND(P{n}/$G{n},4)` | `O148` = `=ROUND(P148/$G148,4)` |
| O | 150-155 (6) | `=ROUND(P{n}/$G{n},4)` | `O150` = `=ROUND(P150/$G150,4)` |
| O | 156 (1) | `=+P{n}` | `O156` = `=+P162` |
| P | 156 (1) | `=ROUND(SUM(P{n}:P{n}),2)` | `P156` = `=ROUND(SUM(P12:P155),2)` |
| P | 157-158 (2) | `=ROUND($D{n}*P${n},2)` | `P157` = `=ROUND($D157*P$156,2)` |
| P | 159 (1) | `=ROUND(P{n}+P{n}+P{n},2)` | `P159` = `=ROUND(P156+P157+P158,2)` |
| P | 160 (1) | `=ROUND($D{n}*P${n},2)` | `P160` = `=ROUND($D160*P$159,2)` |
| P | 161 (1) | `=ROUND(P{n}+P{n},2)` | `P161` = `=ROUND(P159+P160,2)` |
| P | 162 (1) | `=ROUND(P{n}/$G{n},4)` | `P162` = `=ROUND(P156/$G156,4)` |
| P | 163 (1) | `=+M{n}+P{n}` | `P163` = `=+M163+P162` |

**⚠ Posibles problemas detectados:**

- `F148`: posible número mágico dentro de la fórmula: 2500, 3523

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 23 celdas. Ejemplos: B1='CALENDARIO DE AVANCE DE OBRA VALORIZADO EJECUTADO', B9='ITEM', C9='DESCRIPCION', D9='PRESUPUESTO DE OBRA', I9=datetime.datetime(2026, 6, 1, 0, 0), L9=datetime.datetime(2026, 7, 1, 0, 0), O9=datetime.datetime(2026, 8, 1, 0, 0), I10=datetime.datetime(2026, 6, 20, 0, 0) … (+15 más)
- Color `theme0` — 226 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', D5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', D6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:' … (+218 más)
- Color `sin color` — 595 celdas. Ejemplos: B12='01', C12='CREACION DE PISTAS Y VEREDAS JR LOS CEDROS', B13='01.01', C13='OBRAS\xa0PROVISIONALES Y TRABAJOS\xa0PRELIMINARES', B14='01.01.01', C14='OBRAS PROVISIONALES', B15='01.01.01.01', C15='ALQUILER  DE ALAMACEN, OFICINA Y CASETA DE GUARDIANIA' … (+587 más)

### Hoja: VAL. MENSUAL

- Celdas con fórmula: 1038
- Celdas con valor literal (posibles inputs): 919

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 2 (1) | `=+FT!E{n}` | `B2` = `=+FT!E20` |
| C | 5-8 (4) | `=+FT!$E${n}` | `C5` = `=+FT!$E$15` |
| F | 148 (1) | `=2500+3523` | `F148` = `=2500+3523` |
| G | 15-24 (10) | `=ROUND(E{n}*F{n},2)` | `G15` = `=ROUND(E15*F15,2)` |
| G | 26-28 (3) | `=ROUND(E{n}*F{n},2)` | `G26` = `=ROUND(E26*F26,2)` |
| G | 30-52 (23) | `=ROUND(E{n}*F{n},2)` | `G30` = `=ROUND(E30*F30,2)` |
| G | 54-69 (16) | `=ROUND(E{n}*F{n},2)` | `G54` = `=ROUND(E54*F54,2)` |
| G | 71-74 (4) | `=ROUND(E{n}*F{n},2)` | `G71` = `=ROUND(E71*F71,2)` |
| G | 76-77 (2) | `=ROUND(E{n}*F{n},2)` | `G76` = `=ROUND(E76*F76,2)` |
| G | 80-84 (5) | `=ROUND(E{n}*F{n},2)` | `G80` = `=ROUND(E80*F80,2)` |
| G | 86-89 (4) | `=ROUND(E{n}*F{n},2)` | `G86` = `=ROUND(E86*F86,2)` |
| G | 92-95 (4) | `=ROUND(E{n}*F{n},2)` | `G92` = `=ROUND(E92*F92,2)` |
| G | 97-101 (5) | `=ROUND(E{n}*F{n},2)` | `G97` = `=ROUND(E97*F97,2)` |
| G | 104-105 (2) | `=ROUND(E{n}*F{n},2)` | `G104` = `=ROUND(E104*F104,2)` |
| G | 107-109 (3) | `=ROUND(E{n}*F{n},2)` | `G107` = `=ROUND(E107*F107,2)` |
| G | 111 (1) | `=ROUND(E{n}*F{n},2)` | `G111` = `=ROUND(E111*F111,2)` |
| G | 114-117 (4) | `=ROUND(E{n}*F{n},2)` | `G114` = `=ROUND(E114*F114,2)` |
| G | 119-122 (4) | `=ROUND(E{n}*F{n},2)` | `G119` = `=ROUND(E119*F119,2)` |
| G | 125-129 (5) | `=ROUND(E{n}*F{n},2)` | `G125` = `=ROUND(E125*F125,2)` |
| G | 131-133 (3) | `=ROUND(E{n}*F{n},2)` | `G131` = `=ROUND(E131*F131,2)` |
| G | 135-136 (2) | `=ROUND(E{n}*F{n},2)` | `G135` = `=ROUND(E135*F135,2)` |
| G | 138 (1) | `=ROUND(E{n}*F{n},2)` | `G138` = `=ROUND(E138*F138,2)` |
| G | 140 (1) | `=ROUND(E{n}*F{n},2)` | `G140` = `=ROUND(E140*F140,2)` |
| G | 142-146 (5) | `=ROUND(E{n}*F{n},2)` | `G142` = `=ROUND(E142*F142,2)` |
| G | 148 (1) | `=ROUND(E{n}*F{n},2)` | `G148` = `=ROUND(E148*F148,2)` |
| G | 150-155 (6) | `=ROUND(E{n}*F{n},2)` | `G150` = `=ROUND(E150*F150,2)` |
| G | 157 (1) | `=ROUND(SUM(G{n}:G{n}),2)` | `G157` = `=ROUND(SUM(G12:G155),2)` |
| G | 158-159 (2) | `=ROUND($D{n}*G${n},2)` | `G158` = `=ROUND($D158*G$157,2)` |
| G | 160 (1) | `=ROUND(G{n}+G{n}+G{n},2)` | `G160` = `=ROUND(G157+G158+G159,2)` |
| G | 161 (1) | `=ROUND($D{n}*G${n},2)` | `G161` = `=ROUND($D161*G$160,2)` |
| G | 162 (1) | `=ROUND(G{n}+G{n},2)` | `G162` = `=ROUND(G160+G161,2)` |
| G | 163 (1) | `=ROUND(G{n}/$G{n},4)` | `G163` = `=ROUND(G157/$G157,4)` |
| K | 157 (1) | `=+J{n}` | `K157` = `=+J163` |
| M | 60-64 (5) | `=+E{n}` | `M60` = `=+E60` |
| M | 66-69 (4) | `=+E{n}` | `M66` = `=+E66` |
| M | 71-74 (4) | `=+E{n}` | `M71` = `=+E71` |
| M | 80-84 (5) | `=+E{n}` | `M80` = `=+E80` |
| M | 86-89 (4) | `=+E{n}` | `M86` = `=+E86` |
| M | 92-95 (4) | `=+E{n}` | `M92` = `=+E92` |
| M | 97-101 (5) | `=+E{n}` | `M97` = `=+E97` |
| M | 104-105 (2) | `=+E{n}` | `M104` = `=+E104` |
| M | 107-109 (3) | `=+E{n}` | `M107` = `=+E107` |
| M | 111 (1) | `=+E{n}` | `M111` = `=+E111` |
| M | 114-117 (4) | `=+E{n}` | `M114` = `=+E114` |
| M | 119-122 (4) | `=+E{n}` | `M119` = `=+E119` |
| M | 131-133 (3) | `=+E{n}` | `M131` = `=+E131` |
| M | 135-136 (2) | `=+E{n}` | `M135` = `=+E135` |
| M | 138 (1) | `=+E{n}` | `M138` = `=+E138` |
| N | 15-17 (3) | `=ROUND(M{n}*$F{n},2)` | `N15` = `=ROUND(M15*$F15,2)` |
| N | 19-21 (3) | `=ROUND(M{n}*$F{n},2)` | `N19` = `=ROUND(M19*$F19,2)` |
| N | 23-24 (2) | `=ROUND(M{n}*$F{n},2)` | `N23` = `=ROUND(M23*$F23,2)` |
| N | 26-27 (2) | `=ROUND(M{n}*$F{n},2)` | `N26` = `=ROUND(M26*$F26,2)` |
| N | 30-32 (3) | `=ROUND(M{n}*$F{n},2)` | `N30` = `=ROUND(M30*$F30,2)` |
| N | 34 (1) | `=ROUND(M{n}*$F{n},2)` | `N34` = `=ROUND(M34*$F34,2)` |
| N | 36 (1) | `=ROUND(M{n}*$F{n},2)` | `N36` = `=ROUND(M36*$F36,2)` |
| N | 38-45 (8) | `=ROUND(M{n}*$F{n},2)` | `N38` = `=ROUND(M38*$F38,2)` |
| N | 47 (1) | `=ROUND(M{n}*$F{n},2)` | `N47` = `=ROUND(M47*$F47,2)` |
| N | 49-51 (3) | `=ROUND(M{n}*$F{n},2)` | `N49` = `=ROUND(M49*$F49,2)` |
| N | 54-58 (5) | `=ROUND(M{n}*$F{n},2)` | `N54` = `=ROUND(M54*$F54,2)` |
| N | 60-64 (5) | `=ROUND(M{n}*$F{n},2)` | `N60` = `=ROUND(M60*$F60,2)` |
| N | 66-69 (4) | `=ROUND(M{n}*$F{n},2)` | `N66` = `=ROUND(M66*$F66,2)` |
| N | 71-74 (4) | `=ROUND(M{n}*$F{n},2)` | `N71` = `=ROUND(M71*$F71,2)` |
| N | 76-77 (2) | `=ROUND(M{n}*$F{n},2)` | `N76` = `=ROUND(M76*$F76,2)` |
| N | 80-84 (5) | `=ROUND(M{n}*$F{n},2)` | `N80` = `=ROUND(M80*$F80,2)` |
| N | 86-89 (4) | `=ROUND(M{n}*$F{n},2)` | `N86` = `=ROUND(M86*$F86,2)` |
| N | 92-95 (4) | `=ROUND(M{n}*$F{n},2)` | `N92` = `=ROUND(M92*$F92,2)` |
| N | 97-101 (5) | `=ROUND(M{n}*$F{n},2)` | `N97` = `=ROUND(M97*$F97,2)` |
| N | 104-105 (2) | `=ROUND(M{n}*$F{n},2)` | `N104` = `=ROUND(M104*$F104,2)` |
| N | 107-109 (3) | `=ROUND(M{n}*$F{n},2)` | `N107` = `=ROUND(M107*$F107,2)` |
| N | 111 (1) | `=ROUND(M{n}*$F{n},2)` | `N111` = `=ROUND(M111*$F111,2)` |
| N | 114-117 (4) | `=ROUND(M{n}*$F{n},2)` | `N114` = `=ROUND(M114*$F114,2)` |
| N | 119-122 (4) | `=ROUND(M{n}*$F{n},2)` | `N119` = `=ROUND(M119*$F119,2)` |
| N | 125-129 (5) | `=ROUND(M{n}*$F{n},2)` | `N125` = `=ROUND(M125*$F125,2)` |
| N | 131-133 (3) | `=ROUND(M{n}*$F{n},2)` | `N131` = `=ROUND(M131*$F131,2)` |
| N | 135-136 (2) | `=ROUND(M{n}*$F{n},2)` | `N135` = `=ROUND(M135*$F135,2)` |
| N | 138 (1) | `=ROUND(M{n}*$F{n},2)` | `N138` = `=ROUND(M138*$F138,2)` |
| N | 140 (1) | `=ROUND(M{n}*$F{n},2)` | `N140` = `=ROUND(M140*$F140,2)` |
| N | 142-146 (5) | `=ROUND(M{n}*$F{n},2)` | `N142` = `=ROUND(M142*$F142,2)` |
| N | 148 (1) | `=ROUND(M{n}*$F{n},2)` | `N148` = `=ROUND(M148*$F148,2)` |
| N | 150-155 (6) | `=ROUND(M{n}*$F{n},2)` | `N150` = `=ROUND(M150*$F150,2)` |
| N | 157 (1) | `=ROUND(SUM(N{n}:N{n}),2)` | `N157` = `=ROUND(SUM(N12:N155),2)` |
| N | 158-159 (2) | `=ROUND($D{n}*N${n},2)` | `N158` = `=ROUND($D158*N$157,2)` |
| N | 160 (1) | `=ROUND(N{n}+N{n}+N{n},2)` | `N160` = `=ROUND(N157+N158+N159,2)` |
| N | 161 (1) | `=ROUND($D{n}*N${n},2)` | `N161` = `=ROUND($D161*N$160,2)` |
| N | 162 (1) | `=ROUND(N{n}+N{n},2)` | `N162` = `=ROUND(N160+N161,2)` |
| N | 163 (1) | `=ROUND(N{n}/$G{n},4)` | `N163` = `=ROUND(N157/$G157,4)` |
| O | 15-17 (3) | `=ROUND(N{n}/$G{n},4)` | `O15` = `=ROUND(N15/$G15,4)` |
| O | 19-21 (3) | `=ROUND(N{n}/$G{n},4)` | `O19` = `=ROUND(N19/$G19,4)` |
| O | 23-24 (2) | `=ROUND(N{n}/$G{n},4)` | `O23` = `=ROUND(N23/$G23,4)` |
| O | 26-27 (2) | `=ROUND(N{n}/$G{n},4)` | `O26` = `=ROUND(N26/$G26,4)` |
| O | 30-32 (3) | `=ROUND(N{n}/$G{n},4)` | `O30` = `=ROUND(N30/$G30,4)` |
| O | 34 (1) | `=ROUND(N{n}/$G{n},4)` | `O34` = `=ROUND(N34/$G34,4)` |
| O | 36 (1) | `=ROUND(N{n}/$G{n},4)` | `O36` = `=ROUND(N36/$G36,4)` |
| O | 38-45 (8) | `=ROUND(N{n}/$G{n},4)` | `O38` = `=ROUND(N38/$G38,4)` |
| O | 47 (1) | `=ROUND(N{n}/$G{n},4)` | `O47` = `=ROUND(N47/$G47,4)` |
| O | 49-51 (3) | `=ROUND(N{n}/$G{n},4)` | `O49` = `=ROUND(N49/$G49,4)` |
| O | 54-58 (5) | `=ROUND(N{n}/$G{n},4)` | `O54` = `=ROUND(N54/$G54,4)` |
| O | 60-64 (5) | `=ROUND(N{n}/$G{n},4)` | `O60` = `=ROUND(N60/$G60,4)` |
| O | 66-69 (4) | `=ROUND(N{n}/$G{n},4)` | `O66` = `=ROUND(N66/$G66,4)` |
| O | 71-74 (4) | `=ROUND(N{n}/$G{n},4)` | `O71` = `=ROUND(N71/$G71,4)` |
| O | 76-77 (2) | `=ROUND(N{n}/$G{n},4)` | `O76` = `=ROUND(N76/$G76,4)` |
| O | 80-84 (5) | `=ROUND(N{n}/$G{n},4)` | `O80` = `=ROUND(N80/$G80,4)` |
| O | 86-89 (4) | `=ROUND(N{n}/$G{n},4)` | `O86` = `=ROUND(N86/$G86,4)` |
| O | 92-95 (4) | `=ROUND(N{n}/$G{n},4)` | `O92` = `=ROUND(N92/$G92,4)` |
| O | 97-101 (5) | `=ROUND(N{n}/$G{n},4)` | `O97` = `=ROUND(N97/$G97,4)` |
| O | 104-105 (2) | `=ROUND(N{n}/$G{n},4)` | `O104` = `=ROUND(N104/$G104,4)` |
| O | 107-109 (3) | `=ROUND(N{n}/$G{n},4)` | `O107` = `=ROUND(N107/$G107,4)` |
| O | 111 (1) | `=ROUND(N{n}/$G{n},4)` | `O111` = `=ROUND(N111/$G111,4)` |
| O | 114-117 (4) | `=ROUND(N{n}/$G{n},4)` | `O114` = `=ROUND(N114/$G114,4)` |
| O | 119-122 (4) | `=ROUND(N{n}/$G{n},4)` | `O119` = `=ROUND(N119/$G119,4)` |
| O | 125-129 (5) | `=ROUND(N{n}/$G{n},4)` | `O125` = `=ROUND(N125/$G125,4)` |
| O | 131-133 (3) | `=ROUND(N{n}/$G{n},4)` | `O131` = `=ROUND(N131/$G131,4)` |
| O | 135-136 (2) | `=ROUND(N{n}/$G{n},4)` | `O135` = `=ROUND(N135/$G135,4)` |
| O | 138 (1) | `=ROUND(N{n}/$G{n},4)` | `O138` = `=ROUND(N138/$G138,4)` |
| O | 140 (1) | `=ROUND(N{n}/$G{n},4)` | `O140` = `=ROUND(N140/$G140,4)` |
| O | 142-146 (5) | `=ROUND(N{n}/$G{n},4)` | `O142` = `=ROUND(N142/$G142,4)` |
| O | 148 (1) | `=ROUND(N{n}/$G{n},4)` | `O148` = `=ROUND(N148/$G148,4)` |
| O | 150-155 (6) | `=ROUND(N{n}/$G{n},4)` | `O150` = `=ROUND(N150/$G150,4)` |
| O | 157 (1) | `=+N{n}` | `O157` = `=+N163` |
| Q | 15-17 (3) | `=+I{n}+M{n}` | `Q15` = `=+I15+M15` |
| Q | 19-21 (3) | `=+I{n}+M{n}` | `Q19` = `=+I19+M19` |
| Q | 23-24 (2) | `=+I{n}+M{n}` | `Q23` = `=+I23+M23` |
| Q | 26-27 (2) | `=+I{n}+M{n}` | `Q26` = `=+I26+M26` |
| Q | 30-32 (3) | `=+I{n}+M{n}` | `Q30` = `=+I30+M30` |
| Q | 34 (1) | `=+I{n}+M{n}` | `Q34` = `=+I34+M34` |
| Q | 36 (1) | `=+I{n}+M{n}` | `Q36` = `=+I36+M36` |
| Q | 38-45 (8) | `=+I{n}+M{n}` | `Q38` = `=+I38+M38` |
| Q | 47 (1) | `=+I{n}+M{n}` | `Q47` = `=+I47+M47` |
| Q | 49-51 (3) | `=+I{n}+M{n}` | `Q49` = `=+I49+M49` |
| Q | 54-58 (5) | `=+I{n}+M{n}` | `Q54` = `=+I54+M54` |
| Q | 60-64 (5) | `=+I{n}+M{n}` | `Q60` = `=+I60+M60` |
| Q | 66-69 (4) | `=+I{n}+M{n}` | `Q66` = `=+I66+M66` |
| Q | 71-74 (4) | `=+I{n}+M{n}` | `Q71` = `=+I71+M71` |
| Q | 76-77 (2) | `=+I{n}+M{n}` | `Q76` = `=+I76+M76` |
| Q | 80-84 (5) | `=+I{n}+M{n}` | `Q80` = `=+I80+M80` |
| Q | 86-89 (4) | `=+I{n}+M{n}` | `Q86` = `=+I86+M86` |
| Q | 92-95 (4) | `=+I{n}+M{n}` | `Q92` = `=+I92+M92` |
| Q | 97-101 (5) | `=+I{n}+M{n}` | `Q97` = `=+I97+M97` |
| Q | 104-105 (2) | `=+I{n}+M{n}` | `Q104` = `=+I104+M104` |
| Q | 107-109 (3) | `=+I{n}+M{n}` | `Q107` = `=+I107+M107` |
| Q | 111 (1) | `=+I{n}+M{n}` | `Q111` = `=+I111+M111` |
| Q | 114-117 (4) | `=+I{n}+M{n}` | `Q114` = `=+I114+M114` |
| Q | 119-122 (4) | `=+I{n}+M{n}` | `Q119` = `=+I119+M119` |
| Q | 125-129 (5) | `=+I{n}+M{n}` | `Q125` = `=+I125+M125` |
| Q | 131-133 (3) | `=+I{n}+M{n}` | `Q131` = `=+I131+M131` |
| Q | 135-136 (2) | `=+I{n}+M{n}` | `Q135` = `=+I135+M135` |
| Q | 138 (1) | `=+I{n}+M{n}` | `Q138` = `=+I138+M138` |
| Q | 140 (1) | `=+I{n}+M{n}` | `Q140` = `=+I140+M140` |
| Q | 142-146 (5) | `=+I{n}+M{n}` | `Q142` = `=+I142+M142` |
| Q | 148 (1) | `=+I{n}+M{n}` | `Q148` = `=+I148+M148` |
| Q | 150-155 (6) | `=+I{n}+M{n}` | `Q150` = `=+I150+M150` |
| Q | 157 (1) | `=+I{n}+M{n}` | `Q157` = `=+I157+M157` |
| Q | 159-160 (2) | `=+I{n}+M{n}` | `Q159` = `=+I159+M159` |
| Q | 162-163 (2) | `=+I{n}+M{n}` | `Q162` = `=+I162+M162` |
| R | 15-17 (3) | `=+J{n}+N{n}` | `R15` = `=+J15+N15` |
| R | 19-21 (3) | `=+J{n}+N{n}` | `R19` = `=+J19+N19` |
| R | 23-24 (2) | `=+J{n}+N{n}` | `R23` = `=+J23+N23` |
| R | 26-27 (2) | `=+J{n}+N{n}` | `R26` = `=+J26+N26` |
| R | 30-32 (3) | `=+J{n}+N{n}` | `R30` = `=+J30+N30` |
| R | 34 (1) | `=+J{n}+N{n}` | `R34` = `=+J34+N34` |
| R | 36 (1) | `=+J{n}+N{n}` | `R36` = `=+J36+N36` |
| R | 38-45 (8) | `=+J{n}+N{n}` | `R38` = `=+J38+N38` |
| R | 47 (1) | `=+J{n}+N{n}` | `R47` = `=+J47+N47` |
| R | 49-51 (3) | `=+J{n}+N{n}` | `R49` = `=+J49+N49` |
| R | 54-58 (5) | `=+J{n}+N{n}` | `R54` = `=+J54+N54` |
| R | 60-64 (5) | `=+J{n}+N{n}` | `R60` = `=+J60+N60` |
| R | 66-69 (4) | `=+J{n}+N{n}` | `R66` = `=+J66+N66` |
| R | 71-74 (4) | `=+J{n}+N{n}` | `R71` = `=+J71+N71` |
| R | 76-77 (2) | `=+J{n}+N{n}` | `R76` = `=+J76+N76` |
| R | 80-84 (5) | `=+J{n}+N{n}` | `R80` = `=+J80+N80` |
| R | 86-89 (4) | `=+J{n}+N{n}` | `R86` = `=+J86+N86` |
| R | 92-95 (4) | `=+J{n}+N{n}` | `R92` = `=+J92+N92` |
| R | 97-101 (5) | `=+J{n}+N{n}` | `R97` = `=+J97+N97` |
| R | 104-105 (2) | `=+J{n}+N{n}` | `R104` = `=+J104+N104` |
| R | 107-109 (3) | `=+J{n}+N{n}` | `R107` = `=+J107+N107` |
| R | 111 (1) | `=+J{n}+N{n}` | `R111` = `=+J111+N111` |
| R | 114-117 (4) | `=+J{n}+N{n}` | `R114` = `=+J114+N114` |
| R | 119-122 (4) | `=+J{n}+N{n}` | `R119` = `=+J119+N119` |
| R | 125-129 (5) | `=+J{n}+N{n}` | `R125` = `=+J125+N125` |
| R | 131-133 (3) | `=+J{n}+N{n}` | `R131` = `=+J131+N131` |
| R | 135-136 (2) | `=+J{n}+N{n}` | `R135` = `=+J135+N135` |
| R | 138 (1) | `=+J{n}+N{n}` | `R138` = `=+J138+N138` |
| R | 140 (1) | `=+J{n}+N{n}` | `R140` = `=+J140+N140` |
| R | 142-146 (5) | `=+J{n}+N{n}` | `R142` = `=+J142+N142` |
| R | 148 (1) | `=+J{n}+N{n}` | `R148` = `=+J148+N148` |
| R | 150-155 (6) | `=+J{n}+N{n}` | `R150` = `=+J150+N150` |
| R | 157-163 (7) | `=+J{n}+N{n}` | `R157` = `=+J157+N157` |
| S | 15-17 (3) | `=+K{n}+O{n}` | `S15` = `=+K15+O15` |
| S | 19-21 (3) | `=+K{n}+O{n}` | `S19` = `=+K19+O19` |
| S | 23-24 (2) | `=+K{n}+O{n}` | `S23` = `=+K23+O23` |
| S | 26-27 (2) | `=+K{n}+O{n}` | `S26` = `=+K26+O26` |
| S | 30-32 (3) | `=+K{n}+O{n}` | `S30` = `=+K30+O30` |
| S | 34 (1) | `=+K{n}+O{n}` | `S34` = `=+K34+O34` |
| S | 36 (1) | `=+K{n}+O{n}` | `S36` = `=+K36+O36` |
| S | 38-45 (8) | `=+K{n}+O{n}` | `S38` = `=+K38+O38` |
| S | 47 (1) | `=+K{n}+O{n}` | `S47` = `=+K47+O47` |
| S | 49-51 (3) | `=+K{n}+O{n}` | `S49` = `=+K49+O49` |
| S | 54-58 (5) | `=+K{n}+O{n}` | `S54` = `=+K54+O54` |
| S | 60-64 (5) | `=+K{n}+O{n}` | `S60` = `=+K60+O60` |
| S | 66-69 (4) | `=+K{n}+O{n}` | `S66` = `=+K66+O66` |
| S | 71-74 (4) | `=+K{n}+O{n}` | `S71` = `=+K71+O71` |
| S | 76-77 (2) | `=+K{n}+O{n}` | `S76` = `=+K76+O76` |
| S | 80-84 (5) | `=+K{n}+O{n}` | `S80` = `=+K80+O80` |
| S | 86-89 (4) | `=+K{n}+O{n}` | `S86` = `=+K86+O86` |
| S | 92-95 (4) | `=+K{n}+O{n}` | `S92` = `=+K92+O92` |
| S | 97-101 (5) | `=+K{n}+O{n}` | `S97` = `=+K97+O97` |
| S | 104-105 (2) | `=+K{n}+O{n}` | `S104` = `=+K104+O104` |
| S | 107-109 (3) | `=+K{n}+O{n}` | `S107` = `=+K107+O107` |
| S | 111 (1) | `=+K{n}+O{n}` | `S111` = `=+K111+O111` |
| S | 114-117 (4) | `=+K{n}+O{n}` | `S114` = `=+K114+O114` |
| S | 119-122 (4) | `=+K{n}+O{n}` | `S119` = `=+K119+O119` |
| S | 125-129 (5) | `=+K{n}+O{n}` | `S125` = `=+K125+O125` |
| S | 131-133 (3) | `=+K{n}+O{n}` | `S131` = `=+K131+O131` |
| S | 135-136 (2) | `=+K{n}+O{n}` | `S135` = `=+K135+O135` |
| S | 138 (1) | `=+K{n}+O{n}` | `S138` = `=+K138+O138` |
| S | 140 (1) | `=+K{n}+O{n}` | `S140` = `=+K140+O140` |
| S | 142-146 (5) | `=+K{n}+O{n}` | `S142` = `=+K142+O142` |
| S | 148 (1) | `=+K{n}+O{n}` | `S148` = `=+K148+O148` |
| S | 150-155 (6) | `=+K{n}+O{n}` | `S150` = `=+K150+O150` |
| S | 157 (1) | `=+K{n}+O{n}` | `S157` = `=+K157+O157` |
| U | 15-17 (3) | `=+E{n}-Q{n}` | `U15` = `=+E15-Q15` |
| U | 19-21 (3) | `=+E{n}-Q{n}` | `U19` = `=+E19-Q19` |
| U | 23-24 (2) | `=+E{n}-Q{n}` | `U23` = `=+E23-Q23` |
| U | 26-27 (2) | `=+E{n}-Q{n}` | `U26` = `=+E26-Q26` |
| U | 30-32 (3) | `=+E{n}-Q{n}` | `U30` = `=+E30-Q30` |
| U | 34 (1) | `=+E{n}-Q{n}` | `U34` = `=+E34-Q34` |
| U | 36 (1) | `=+E{n}-Q{n}` | `U36` = `=+E36-Q36` |
| U | 38-45 (8) | `=+E{n}-Q{n}` | `U38` = `=+E38-Q38` |
| U | 47 (1) | `=+E{n}-Q{n}` | `U47` = `=+E47-Q47` |
| U | 49-51 (3) | `=+E{n}-Q{n}` | `U49` = `=+E49-Q49` |
| U | 54-58 (5) | `=+E{n}-Q{n}` | `U54` = `=+E54-Q54` |
| U | 60-64 (5) | `=+E{n}-Q{n}` | `U60` = `=+E60-Q60` |
| U | 66-69 (4) | `=+E{n}-Q{n}` | `U66` = `=+E66-Q66` |
| U | 71-74 (4) | `=+E{n}-Q{n}` | `U71` = `=+E71-Q71` |
| U | 76-77 (2) | `=+E{n}-Q{n}` | `U76` = `=+E76-Q76` |
| U | 80-84 (5) | `=+E{n}-Q{n}` | `U80` = `=+E80-Q80` |
| U | 86-89 (4) | `=+E{n}-Q{n}` | `U86` = `=+E86-Q86` |
| U | 92-95 (4) | `=+E{n}-Q{n}` | `U92` = `=+E92-Q92` |
| U | 97-101 (5) | `=+E{n}-Q{n}` | `U97` = `=+E97-Q97` |
| U | 104-105 (2) | `=+E{n}-Q{n}` | `U104` = `=+E104-Q104` |
| U | 107-109 (3) | `=+E{n}-Q{n}` | `U107` = `=+E107-Q107` |
| U | 111 (1) | `=+E{n}-Q{n}` | `U111` = `=+E111-Q111` |
| U | 114-117 (4) | `=+E{n}-Q{n}` | `U114` = `=+E114-Q114` |
| U | 119-122 (4) | `=+E{n}-Q{n}` | `U119` = `=+E119-Q119` |
| U | 125-129 (5) | `=+E{n}-Q{n}` | `U125` = `=+E125-Q125` |
| U | 131-133 (3) | `=+E{n}-Q{n}` | `U131` = `=+E131-Q131` |
| U | 135-136 (2) | `=+E{n}-Q{n}` | `U135` = `=+E135-Q135` |
| U | 138 (1) | `=+E{n}-Q{n}` | `U138` = `=+E138-Q138` |
| U | 140 (1) | `=+E{n}-Q{n}` | `U140` = `=+E140-Q140` |
| U | 142-146 (5) | `=+E{n}-Q{n}` | `U142` = `=+E142-Q142` |
| U | 148 (1) | `=+E{n}-Q{n}` | `U148` = `=+E148-Q148` |
| U | 150-155 (6) | `=+E{n}-Q{n}` | `U150` = `=+E150-Q150` |
| U | 157 (1) | `=+E{n}-Q{n}` | `U157` = `=+E157-Q157` |
| U | 159-160 (2) | `=+E{n}-Q{n}` | `U159` = `=+E159-Q159` |
| U | 162-163 (2) | `=+E{n}-Q{n}` | `U162` = `=+E162-Q162` |
| V | 15-17 (3) | `=+G{n}-R{n}` | `V15` = `=+G15-R15` |
| V | 19-21 (3) | `=+G{n}-R{n}` | `V19` = `=+G19-R19` |
| V | 23-24 (2) | `=+G{n}-R{n}` | `V23` = `=+G23-R23` |
| V | 26-27 (2) | `=+G{n}-R{n}` | `V26` = `=+G26-R26` |
| V | 30-32 (3) | `=+G{n}-R{n}` | `V30` = `=+G30-R30` |
| V | 34 (1) | `=+G{n}-R{n}` | `V34` = `=+G34-R34` |
| V | 36 (1) | `=+G{n}-R{n}` | `V36` = `=+G36-R36` |
| V | 38-45 (8) | `=+G{n}-R{n}` | `V38` = `=+G38-R38` |
| V | 47 (1) | `=+G{n}-R{n}` | `V47` = `=+G47-R47` |
| V | 49-51 (3) | `=+G{n}-R{n}` | `V49` = `=+G49-R49` |
| V | 54-58 (5) | `=+G{n}-R{n}` | `V54` = `=+G54-R54` |
| V | 60-64 (5) | `=+G{n}-R{n}` | `V60` = `=+G60-R60` |
| V | 66-69 (4) | `=+G{n}-R{n}` | `V66` = `=+G66-R66` |
| V | 71-74 (4) | `=+G{n}-R{n}` | `V71` = `=+G71-R71` |
| V | 76-77 (2) | `=+G{n}-R{n}` | `V76` = `=+G76-R76` |
| V | 80-84 (5) | `=+G{n}-R{n}` | `V80` = `=+G80-R80` |
| V | 86-89 (4) | `=+G{n}-R{n}` | `V86` = `=+G86-R86` |
| V | 92-95 (4) | `=+G{n}-R{n}` | `V92` = `=+G92-R92` |
| V | 97-101 (5) | `=+G{n}-R{n}` | `V97` = `=+G97-R97` |
| V | 104-105 (2) | `=+G{n}-R{n}` | `V104` = `=+G104-R104` |
| V | 107-109 (3) | `=+G{n}-R{n}` | `V107` = `=+G107-R107` |
| V | 111 (1) | `=+G{n}-R{n}` | `V111` = `=+G111-R111` |
| V | 114-117 (4) | `=+G{n}-R{n}` | `V114` = `=+G114-R114` |
| V | 119-122 (4) | `=+G{n}-R{n}` | `V119` = `=+G119-R119` |
| V | 125-129 (5) | `=+G{n}-R{n}` | `V125` = `=+G125-R125` |
| V | 131-133 (3) | `=+G{n}-R{n}` | `V131` = `=+G131-R131` |
| V | 135-136 (2) | `=+G{n}-R{n}` | `V135` = `=+G135-R135` |
| V | 138 (1) | `=+G{n}-R{n}` | `V138` = `=+G138-R138` |
| V | 140 (1) | `=+G{n}-R{n}` | `V140` = `=+G140-R140` |
| V | 142-146 (5) | `=+G{n}-R{n}` | `V142` = `=+G142-R142` |
| V | 148 (1) | `=+G{n}-R{n}` | `V148` = `=+G148-R148` |
| V | 150-155 (6) | `=+G{n}-R{n}` | `V150` = `=+G150-R150` |
| V | 157-163 (7) | `=+G{n}-R{n}` | `V157` = `=+G157-R157` |
| W | 15-17 (3) | `=1-S{n}` | `W15` = `=1-S15` |
| W | 19-21 (3) | `=1-S{n}` | `W19` = `=1-S19` |
| W | 23-24 (2) | `=1-S{n}` | `W23` = `=1-S23` |
| W | 26-27 (2) | `=1-S{n}` | `W26` = `=1-S26` |
| W | 30-32 (3) | `=1-S{n}` | `W30` = `=1-S30` |
| W | 34 (1) | `=1-S{n}` | `W34` = `=1-S34` |
| W | 36 (1) | `=1-S{n}` | `W36` = `=1-S36` |
| W | 38-45 (8) | `=1-S{n}` | `W38` = `=1-S38` |
| W | 47 (1) | `=1-S{n}` | `W47` = `=1-S47` |
| W | 49-51 (3) | `=1-S{n}` | `W49` = `=1-S49` |
| W | 54-58 (5) | `=1-S{n}` | `W54` = `=1-S54` |
| W | 60-64 (5) | `=1-S{n}` | `W60` = `=1-S60` |
| W | 66-69 (4) | `=1-S{n}` | `W66` = `=1-S66` |
| W | 71-74 (4) | `=1-S{n}` | `W71` = `=1-S71` |
| W | 76-77 (2) | `=1-S{n}` | `W76` = `=1-S76` |
| W | 80-84 (5) | `=1-S{n}` | `W80` = `=1-S80` |
| W | 86-89 (4) | `=1-S{n}` | `W86` = `=1-S86` |
| W | 92-95 (4) | `=1-S{n}` | `W92` = `=1-S92` |
| W | 97-101 (5) | `=1-S{n}` | `W97` = `=1-S97` |
| W | 104-105 (2) | `=1-S{n}` | `W104` = `=1-S104` |
| W | 107-109 (3) | `=1-S{n}` | `W107` = `=1-S107` |
| W | 111 (1) | `=1-S{n}` | `W111` = `=1-S111` |
| W | 114-117 (4) | `=1-S{n}` | `W114` = `=1-S114` |
| W | 119-122 (4) | `=1-S{n}` | `W119` = `=1-S119` |
| W | 125-129 (5) | `=1-S{n}` | `W125` = `=1-S125` |
| W | 131-133 (3) | `=1-S{n}` | `W131` = `=1-S131` |
| W | 135-136 (2) | `=1-S{n}` | `W135` = `=1-S135` |
| W | 138 (1) | `=1-S{n}` | `W138` = `=1-S138` |
| W | 140 (1) | `=1-S{n}` | `W140` = `=1-S140` |
| W | 142-146 (5) | `=1-S{n}` | `W142` = `=1-S142` |
| W | 148 (1) | `=1-S{n}` | `W148` = `=1-S148` |
| W | 150-155 (6) | `=1-S{n}` | `W150` = `=1-S150` |
| W | 157 (1) | `=1-S{n}` | `W157` = `=1-S157` |
| Y | 157 (1) | `=+R{n}+V{n}` | `Y157` = `=+R157+V157` |

**⚠ Posibles problemas detectados:**

- `F148`: posible número mágico dentro de la fórmula: 2500, 3523

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 20 celdas. Ejemplos: B1='VALORIZACIÓN N°02 DEL MES DE JULIO DE 2026', B10='ITEM', C10='DESCRIPCION', D10='PRESUPUESTO DE OBRA', I10='ACUMULADO ANTERIOR', Q10='ACUMULADO ACTUAL', U10='SALDO', D11='UND' … (+12 más)
- Color `theme0` — 237 celdas. Ejemplos: B3='Obra:', C3='"MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS DE TRANSITABILIDAD VEHICULAR Y PEATONAL DEL JR LOS PINOS Y JR LOS CEDROS EN CAYHUAYNA Y CAYHUAYNA DEL DISTRITO DE PILLCO MARCA - PROVINCIA DE HUANUCO - DEPARTAMENTO DE HUANUCO" CON CUI N°2536252', B4='Entidad:', C4='MUNICIPALIDAD DISTRITAL DE PILLCO MARCA', B5='Ejecutor:', B6='Supervisor:', D6='VALOR REFERENCIAL (CON IGV)', G6=638827.47 … (+229 más)
- Color `theme4` — 14 celdas. Ejemplos: M10='ACTUAL', M11='METRADO', N11='COSTO (S/)', O11='%', M15=0.48, M17=0.48, M145=0.3, M152=0.7 … (+6 más)
- Color `sin color` — 595 celdas. Ejemplos: B12='01', C12='CREACION DE PISTAS Y VEREDAS JR LOS CEDROS', B13='01.01', C13='OBRAS\xa0PROVISIONALES Y TRABAJOS\xa0PRELIMINARES', B14='01.01.01', C14='OBRAS PROVISIONALES', B15='01.01.01.01', C15='ALQUILER  DE ALAMACEN, OFICINA Y CASETA DE GUARDIANIA' … (+587 más)
- Color `FFFFFFFF` — 53 celdas. Ejemplos: I15=1, I16=1, I17=1, I19=1932.21, I20=1932.21, I21=1, I23=135.5, I24=20.33 … (+45 más)

### Hoja: PROG VS. EJEC

- Celdas con fórmula: 250
- Celdas con valor literal (posibles inputs): 806

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| F | 148 (1) | `=2500+3523` | `F148` = `=2500+3523` |
| G | 5-7 (3) | `=+FT!$E${n}` | `G5` = `=+FT!$E$24` |
| G | 15-24 (10) | `=ROUND(E{n}*F{n},2)` | `G15` = `=ROUND(E15*F15,2)` |
| G | 26-28 (3) | `=ROUND(E{n}*F{n},2)` | `G26` = `=ROUND(E26*F26,2)` |
| G | 30-52 (23) | `=ROUND(E{n}*F{n},2)` | `G30` = `=ROUND(E30*F30,2)` |
| G | 54-69 (16) | `=ROUND(E{n}*F{n},2)` | `G54` = `=ROUND(E54*F54,2)` |
| G | 71-74 (4) | `=ROUND(E{n}*F{n},2)` | `G71` = `=ROUND(E71*F71,2)` |
| G | 76-77 (2) | `=ROUND(E{n}*F{n},2)` | `G76` = `=ROUND(E76*F76,2)` |
| G | 80-84 (5) | `=ROUND(E{n}*F{n},2)` | `G80` = `=ROUND(E80*F80,2)` |
| G | 86-89 (4) | `=ROUND(E{n}*F{n},2)` | `G86` = `=ROUND(E86*F86,2)` |
| G | 92-95 (4) | `=ROUND(E{n}*F{n},2)` | `G92` = `=ROUND(E92*F92,2)` |
| G | 97-101 (5) | `=ROUND(E{n}*F{n},2)` | `G97` = `=ROUND(E97*F97,2)` |
| G | 104-105 (2) | `=ROUND(E{n}*F{n},2)` | `G104` = `=ROUND(E104*F104,2)` |
| G | 107-109 (3) | `=ROUND(E{n}*F{n},2)` | `G107` = `=ROUND(E107*F107,2)` |
| G | 111 (1) | `=ROUND(E{n}*F{n},2)` | `G111` = `=ROUND(E111*F111,2)` |
| G | 114-117 (4) | `=ROUND(E{n}*F{n},2)` | `G114` = `=ROUND(E114*F114,2)` |
| G | 119-122 (4) | `=ROUND(E{n}*F{n},2)` | `G119` = `=ROUND(E119*F119,2)` |
| G | 125-129 (5) | `=ROUND(E{n}*F{n},2)` | `G125` = `=ROUND(E125*F125,2)` |
| G | 131-133 (3) | `=ROUND(E{n}*F{n},2)` | `G131` = `=ROUND(E131*F131,2)` |
| G | 135-136 (2) | `=ROUND(E{n}*F{n},2)` | `G135` = `=ROUND(E135*F135,2)` |
| G | 138 (1) | `=ROUND(E{n}*F{n},2)` | `G138` = `=ROUND(E138*F138,2)` |
| G | 140 (1) | `=ROUND(E{n}*F{n},2)` | `G140` = `=ROUND(E140*F140,2)` |
| G | 142-146 (5) | `=ROUND(E{n}*F{n},2)` | `G142` = `=ROUND(E142*F142,2)` |
| G | 148 (1) | `=ROUND(E{n}*F{n},2)` | `G148` = `=ROUND(E148*F148,2)` |
| G | 150-155 (6) | `=ROUND(E{n}*F{n},2)` | `G150` = `=ROUND(E150*F150,2)` |
| G | 156 (1) | `=ROUND(SUM(G{n}:G{n}),2)` | `G156` = `=ROUND(SUM(G12:G155),2)` |
| G | 157-158 (2) | `=ROUND($D{n}*G${n},2)` | `G157` = `=ROUND($D157*G$156,2)` |
| G | 159 (1) | `=ROUND(G{n}+G{n}+G{n},2)` | `G159` = `=ROUND(G156+G157+G158,2)` |
| G | 160 (1) | `=ROUND($D{n}*G${n},2)` | `G160` = `=ROUND($D160*G$159,2)` |
| G | 161 (1) | `=ROUND(G{n}+G{n},2)` | `G161` = `=ROUND(G159+G160,2)` |
| G | 162 (1) | `=ROUND(G{n}/$G{n},4)` | `G162` = `=ROUND(G156/$G156,4)` |
| I | 15-17 (3) | `=ROUND(J{n}/$G{n},4)` | `I15` = `=ROUND(J15/$G15,4)` |
| I | 19-21 (3) | `=ROUND(J{n}/$G{n},4)` | `I19` = `=ROUND(J19/$G19,4)` |
| I | 23-24 (2) | `=ROUND(J{n}/$G{n},4)` | `I23` = `=ROUND(J23/$G23,4)` |
| I | 26-27 (2) | `=ROUND(J{n}/$G{n},4)` | `I26` = `=ROUND(J26/$G26,4)` |
| I | 30-32 (3) | `=ROUND(J{n}/$G{n},4)` | `I30` = `=ROUND(J30/$G30,4)` |
| I | 34 (1) | `=ROUND(J{n}/$G{n},4)` | `I34` = `=ROUND(J34/$G34,4)` |
| I | 36 (1) | `=ROUND(J{n}/$G{n},4)` | `I36` = `=ROUND(J36/$G36,4)` |
| I | 38-45 (8) | `=ROUND(J{n}/$G{n},4)` | `I38` = `=ROUND(J38/$G38,4)` |
| I | 47 (1) | `=ROUND(J{n}/$G{n},4)` | `I47` = `=ROUND(J47/$G47,4)` |
| I | 49-51 (3) | `=ROUND(J{n}/$G{n},4)` | `I49` = `=ROUND(J49/$G49,4)` |
| I | 54-58 (5) | `=ROUND(J{n}/$G{n},4)` | `I54` = `=ROUND(J54/$G54,4)` |
| I | 60-64 (5) | `=ROUND(J{n}/$G{n},4)` | `I60` = `=ROUND(J60/$G60,4)` |
| I | 66-69 (4) | `=ROUND(J{n}/$G{n},4)` | `I66` = `=ROUND(J66/$G66,4)` |
| I | 71-74 (4) | `=ROUND(J{n}/$G{n},4)` | `I71` = `=ROUND(J71/$G71,4)` |
| I | 76-77 (2) | `=ROUND(J{n}/$G{n},4)` | `I76` = `=ROUND(J76/$G76,4)` |
| I | 80-84 (5) | `=ROUND(J{n}/$G{n},4)` | `I80` = `=ROUND(J80/$G80,4)` |
| I | 86-89 (4) | `=ROUND(J{n}/$G{n},4)` | `I86` = `=ROUND(J86/$G86,4)` |
| I | 92-95 (4) | `=ROUND(J{n}/$G{n},4)` | `I92` = `=ROUND(J92/$G92,4)` |
| I | 97-101 (5) | `=ROUND(J{n}/$G{n},4)` | `I97` = `=ROUND(J97/$G97,4)` |
| I | 104-105 (2) | `=ROUND(J{n}/$G{n},4)` | `I104` = `=ROUND(J104/$G104,4)` |
| I | 107-109 (3) | `=ROUND(J{n}/$G{n},4)` | `I107` = `=ROUND(J107/$G107,4)` |
| I | 111 (1) | `=ROUND(J{n}/$G{n},4)` | `I111` = `=ROUND(J111/$G111,4)` |
| I | 114-117 (4) | `=ROUND(J{n}/$G{n},4)` | `I114` = `=ROUND(J114/$G114,4)` |
| I | 119-122 (4) | `=ROUND(J{n}/$G{n},4)` | `I119` = `=ROUND(J119/$G119,4)` |
| I | 125-129 (5) | `=ROUND(J{n}/$G{n},4)` | `I125` = `=ROUND(J125/$G125,4)` |
| I | 131-133 (3) | `=ROUND(J{n}/$G{n},4)` | `I131` = `=ROUND(J131/$G131,4)` |
| I | 135-136 (2) | `=ROUND(J{n}/$G{n},4)` | `I135` = `=ROUND(J135/$G135,4)` |
| I | 138 (1) | `=ROUND(J{n}/$G{n},4)` | `I138` = `=ROUND(J138/$G138,4)` |
| I | 140 (1) | `=ROUND(J{n}/$G{n},4)` | `I140` = `=ROUND(J140/$G140,4)` |
| I | 142-146 (5) | `=ROUND(J{n}/$G{n},4)` | `I142` = `=ROUND(J142/$G142,4)` |
| I | 148 (1) | `=ROUND(J{n}/$G{n},4)` | `I148` = `=ROUND(J148/$G148,4)` |
| I | 150-155 (6) | `=ROUND(J{n}/$G{n},4)` | `I150` = `=ROUND(J150/$G150,4)` |
| I | 156 (1) | `=+J{n}` | `I156` = `=+J162` |
| J | 156 (1) | `=ROUND(SUM(J{n}:J{n}),2)` | `J156` = `=ROUND(SUM(J12:J155),2)` |
| J | 157-158 (2) | `=ROUND($D{n}*J${n},2)` | `J157` = `=ROUND($D157*J$156,2)` |
| J | 159 (1) | `=ROUND(J{n}+J{n}+J{n},2)` | `J159` = `=ROUND(J156+J157+J158,2)` |
| J | 160 (1) | `=ROUND($D{n}*J${n},2)` | `J160` = `=ROUND($D160*J$159,2)` |
| J | 161 (1) | `=ROUND(J{n}+J{n},2)` | `J161` = `=ROUND(J159+J160,2)` |
| J | 162 (1) | `=ROUND(J{n}/$G{n},4)` | `J162` = `=ROUND(J156/$G156,4)` |
| L | 156 (1) | `=+M{n}` | `L156` = `=+M162` |
| M | 156 (1) | `=ROUND(SUM(M{n}:M{n}),2)` | `M156` = `=ROUND(SUM(M12:M155),2)` |
| M | 157-158 (2) | `=ROUND($D{n}*M${n},2)` | `M157` = `=ROUND($D157*M$156,2)` |
| M | 159 (1) | `=ROUND(M{n}+M{n}+M{n},2)` | `M159` = `=ROUND(M156+M157+M158,2)` |
| M | 160 (1) | `=ROUND($D{n}*M${n},2)` | `M160` = `=ROUND($D160*M$159,2)` |
| M | 161 (1) | `=ROUND(M{n}+M{n},2)` | `M161` = `=ROUND(M159+M160,2)` |
| M | 162 (1) | `=ROUND(M{n}/$G{n},4)` | `M162` = `=ROUND(M156/$G156,4)` |

**⚠ Posibles problemas detectados:**

- `F148`: posible número mágico dentro de la fórmula: 2500, 3523

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 13 celdas. Ejemplos: B1='AVANCE PROGRAMADO VS. EJECUTADO (JULIO 2026)', B9='ITEM', C9='DESCRIPCION', D9='PRESUPUESTO DE OBRA', I9=datetime.datetime(2026, 7, 1, 0, 0), I10=datetime.datetime(2026, 7, 1, 0, 0), J10=datetime.datetime(2026, 7, 31, 0, 0), D11='UND' … (+5 más)
- Color `theme0` — 198 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', D5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', D6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:' … (+190 más)
- Color `sin color` — 595 celdas. Ejemplos: B12='01', C12='CREACION DE PISTAS Y VEREDAS JR LOS CEDROS', B13='01.01', C13='OBRAS\xa0PROVISIONALES Y TRABAJOS\xa0PRELIMINARES', B14='01.01.01', C14='OBRAS PROVISIONALES', B15='01.01.01.01', C15='ALQUILER  DE ALAMACEN, OFICINA Y CASETA DE GUARDIANIA' … (+587 más)

### Hoja: CONTROL GEN. AVAN. OBRA.

- Celdas con fórmula: 51
- Celdas con valor literal (posibles inputs): 36

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 11 (1) | `=+'CALEN. PROG.'!I{n}` | `C11` = `=+'CALEN. PROG.'!I9` |
| C | 12 (1) | `=+'CALEN. PROG.'!L{n}` | `C12` = `=+'CALEN. PROG.'!L9` |
| C | 13 (1) | `=+'CALEN. PROG.'!O{n}` | `C13` = `=+'CALEN. PROG.'!O9` |
| D | 11 (1) | `=+'CALEN. PROG.'!J{n}` | `D11` = `=+'CALEN. PROG.'!J161` |
| D | 12 (1) | `=+'CALEN. PROG.'!M{n}` | `D12` = `=+'CALEN. PROG.'!M161` |
| D | 13 (1) | `=+'CALEN. PROG.'!P{n}` | `D13` = `=+'CALEN. PROG.'!P161` |
| D | 14 (1) | `=SUM(D{n}:D{n})` | `D14` = `=SUM(D11:D13)` |
| E | 11 (1) | `=D{n}` | `E11` = `=D11` |
| E | 12-13 (2) | `=+D{n}+E{n}` | `E12` = `=+D12+E11` |
| F | 11-13 (3) | `=ROUND(D{n}/$D${n},4)` | `F11` = `=ROUND(D11/$D$14,4)` |
| F | 14 (1) | `=SUM(F{n}:F{n})` | `F14` = `=SUM(F11:F13)` |
| G | 11 (1) | `=+F{n}` | `G11` = `=+F11` |
| G | 12-13 (2) | `=+F{n}+G{n}` | `G12` = `=+F12+G11` |
| H | 11 (1) | `=+'CALEN. VALO.'!J{n}` | `H11` = `=+'CALEN. VALO.'!J161` |
| H | 12 (1) | `=+'CALEN. VALO.'!M{n}` | `H12` = `=+'CALEN. VALO.'!M161` |
| H | 14 (1) | `=SUM(H{n}:H{n})` | `H14` = `=SUM(H11:H12)` |
| I | 5-7 (3) | `=+FT!$E${n}` | `I5` = `=+FT!$E$24` |
| I | 11 (1) | `=+H{n}` | `I11` = `=+H11` |
| I | 12 (1) | `=+H{n}+I{n}` | `I12` = `=+H12+I11` |
| J | 11-12 (2) | `=ROUND(H{n}/$D${n},4)` | `J11` = `=ROUND(H11/$D$14,4)` |
| J | 14 (1) | `=SUM(J{n}:J{n})` | `J14` = `=SUM(J11:J12)` |
| K | 11 (1) | `=+J{n}` | `K11` = `=+J11` |
| K | 12 (1) | `=+J{n}+K{n}` | `K12` = `=+J12+K11` |
| L | 11-12 (2) | `=+G{n}` | `L11` = `=+G11` |
| L | 14 (1) | `=+L{n}` | `L14` = `=+L12` |
| M | 11-12 (2) | `=ROUND(L{n}*0.8,4)` | `M11` = `=ROUND(L11*0.8,4)` |
| M | 14 (1) | `=+M{n}` | `M14` = `=+M12` |
| N | 11-12 (2) | `=+K{n}` | `N11` = `=+K11` |
| N | 14 (1) | `=+N{n}` | `N14` = `=+N12` |
| O | 11-12 (2) | `=+N{n}-L{n}` | `O11` = `=+N11-L11` |
| O | 14 (1) | `=+O{n}` | `O14` = `=+O12` |
| P | 11-12 (2) | `=+IF(K{n}<G{n},"ATRASADA",IF(K{n}=100%,"CULMINADA","ADELANTADA"))` | `P11` = `=+IF(K11<G11,"ATRASADA",IF(K11=100%,"CULMINADA","ADELANTADA"))` |
| T | 12 (1) | `=SUM(T{n}:T{n})` | `T12` = `=SUM(T10:T11)` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 14 celdas. Ejemplos: B1='CONTROL GENERAL DE AVANCE DE OBRA', B9='VALORIZACIÓN', D9='PROGRAMADO ', H9='EJECUTADO', B10='Nº', C10='MES', D10='MENSUAL', E10='ACUMULADO' … (+6 más)
- Color `theme0` — 20 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', G5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', G6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:' … (+12 más)
- Color `theme6` — 1 celdas. Ejemplos: P9='SITUACIÓN DE LA OBRA'
- Color `theme4` — 1 celdas. Ejemplos: B12=2

### Hoja: CURVA S

- Celdas con fórmula: 37
- Celdas con valor literal (posibles inputs): 33

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 35-37 (3) | `=+'CONTROL GEN. AVAN. OBRA.'!C{n}` | `C35` = `=+'CONTROL GEN. AVAN. OBRA.'!C11` |
| D | 35-37 (3) | `=+'CONTROL GEN. AVAN. OBRA.'!D{n}` | `D35` = `=+'CONTROL GEN. AVAN. OBRA.'!D11` |
| D | 38 (1) | `=SUM(D{n}:D{n})` | `D38` = `=SUM(D35:D37)` |
| E | 35-37 (3) | `=ROUND(D{n}/$D${n},4)` | `E35` = `=ROUND(D35/$D$38,4)` |
| E | 38 (1) | `=SUM(E{n}:E{n})` | `E38` = `=SUM(E35:E37)` |
| F | 35 (1) | `=+E{n}` | `F35` = `=+E35` |
| F | 36-37 (2) | `=+E{n}+F{n}` | `F36` = `=+E36+F35` |
| G | 35-37 (3) | `=0.8*F{n}` | `G35` = `=0.8*F35` |
| H | 5-7 (3) | `=+FT!$E${n}` | `H5` = `=+FT!$E$24` |
| H | 35-36 (2) | `=+'CONTROL GEN. AVAN. OBRA.'!H{n}` | `H35` = `=+'CONTROL GEN. AVAN. OBRA.'!H11` |
| H | 38 (1) | `=SUM(H{n}:H{n})` | `H38` = `=SUM(H35:H36)` |
| I | 35-36 (2) | `=ROUND(H{n}/$D${n},4)` | `I35` = `=ROUND(H35/$D$38,4)` |
| I | 38 (1) | `=SUM(I{n}:I{n})` | `I38` = `=SUM(I35:I36)` |
| J | 35 (1) | `=+I{n}` | `J35` = `=+I35` |
| J | 36 (1) | `=+I{n}+J{n}` | `J36` = `=+I36+J35` |
| K | 35-36 (2) | `=+'CONTROL GEN. AVAN. OBRA.'!P{n}` | `K35` = `=+'CONTROL GEN. AVAN. OBRA.'!P11` |
| K | 38 (1) | `=+'CONTROL GEN. AVAN. OBRA.'!P{n}` | `K38` = `=+'CONTROL GEN. AVAN. OBRA.'!P14` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 1 celdas. Ejemplos: B1='CURVA S'
- Color `theme0` — 23 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', F5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', F6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:' … (+15 más)
- Color `theme4` — 8 celdas. Ejemplos: D32='PROGRAMADO', H32='EJECUTADO', D33='MONTO', E33='% MENSUAL', F33='%ACUMULADO', H33='MONTO', I33='MENSUAL', J33='ACUMULADO'
- Color `theme6` — 1 celdas. Ejemplos: K32='ESTADO DE LA OBRA'

### Hoja: CONTROL AVAN. FISICO

- Celdas con fórmula: 65
- Celdas con valor literal (posibles inputs): 24

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 18-23 (6) | `='CURVA S'!B{n}` | `B18` = `='CURVA S'!B32` |
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 11-13 (3) | `=+'CONTROL GEN. AVAN. OBRA.'!C{n}` | `C11` = `=+'CONTROL GEN. AVAN. OBRA.'!C11` |
| C | 19-22 (4) | `='CURVA S'!C{n}` | `C19` = `='CURVA S'!C33` |
| D | 11-12 (2) | `=+'CONTROL GEN. AVAN. OBRA.'!H{n}` | `D11` = `=+'CONTROL GEN. AVAN. OBRA.'!H11` |
| D | 14 (1) | `=SUM(D{n}:D{n})` | `D14` = `=SUM(D11:D12)` |
| D | 15 (1) | `=+H{n}-D{n}` | `D15` = `=+H6-D14` |
| D | 18-23 (6) | `='CURVA S'!D{n}` | `D18` = `='CURVA S'!D32` |
| E | 11-12 (2) | `=+'CONTROL GEN. AVAN. OBRA.'!J{n}` | `E11` = `=+'CONTROL GEN. AVAN. OBRA.'!J11` |
| E | 14 (1) | `=SUM(E{n}:E{n})` | `E14` = `=SUM(E11:E12)` |
| E | 15 (1) | `=1-E{n}` | `E15` = `=1-E14` |
| E | 19-23 (5) | `='CURVA S'!E{n}` | `E19` = `='CURVA S'!E33` |
| F | 19-22 (4) | `='CURVA S'!F{n}` | `F19` = `='CURVA S'!F33` |
| G | 18 (1) | `='CURVA S'!G{n}` | `G18` = `='CURVA S'!G32` |
| G | 20-22 (3) | `='CURVA S'!G{n}` | `G20` = `='CURVA S'!G35` |
| H | 6 (1) | `=+FT!$E${n}` | `H6` = `=+FT!$E$25` |
| H | 7 (1) | `=+H{n}` | `H7` = `=+H6` |
| H | 18-21 (4) | `='CURVA S'!H{n}` | `H18` = `='CURVA S'!H32` |
| H | 23 (1) | `='CURVA S'!H{n}` | `H23` = `='CURVA S'!H38` |
| I | 19-21 (3) | `='CURVA S'!I{n}` | `I19` = `='CURVA S'!I33` |
| I | 23 (1) | `='CURVA S'!I{n}` | `I23` = `='CURVA S'!I38` |
| J | 19-21 (3) | `='CURVA S'!J{n}` | `J19` = `='CURVA S'!J33` |
| K | 7 (1) | `=+K{n}` | `K7` = `=+K6` |
| K | 18 (1) | `='CURVA S'!K{n}` | `K18` = `='CURVA S'!K32` |
| K | 20-21 (2) | `='CURVA S'!K{n}` | `K20` = `='CURVA S'!K35` |
| K | 23 (1) | `='CURVA S'!K{n}` | `K23` = `='CURVA S'!K38` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 1 celdas. Ejemplos: B1='CONTROL DE AVANCE FÍSICO DE OBRA'
- Color `theme0` — 18 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', B6='Residente:', F6='MONTO DEL CONTRATO ORIGINAL:', I6='INCL. IGV', J6='que representa el ' … (+10 más)
- Color `theme4` — 5 celdas. Ejemplos: B9='AVANCE FÍSICO', B10='N°', C10='MES', D10='MONTO', E10='% MENSUAL'

### Hoja: CONTROL FINANCIERO

- Celdas con fórmula: 27
- Celdas con valor literal (posibles inputs): 38

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| D | 15-16 (2) | `=+'CONTROL GEN. AVAN. OBRA.'!H{n}` | `D15` = `=+'CONTROL GEN. AVAN. OBRA.'!H11` |
| D | 19 (1) | `=SUM(D{n}:D{n})` | `D19` = `=SUM(D12:D18)` |
| D | 20 (1) | `=$F${n}-D{n}` | `D20` = `=$F$7-D19` |
| E | 12-13 (2) | `=+D{n}` | `E12` = `=+D12` |
| E | 15 (1) | `=+D{n}` | `E15` = `=+D15` |
| E | 19 (1) | `=SUM(E{n}:E{n})` | `E19` = `=SUM(E12:E18)` |
| E | 20 (1) | `=$F${n}-E{n}` | `E20` = `=$F$7-E19` |
| F | 6 (1) | `=+FT!$E${n}` | `F6` = `=+FT!$E$25` |
| F | 7 (1) | `=+F{n}` | `F7` = `=+F6` |
| F | 12-13 (2) | `=+E{n}/$F${n}` | `F12` = `=+E12/$F$6` |
| F | 15-16 (2) | `=+E{n}/$F${n}` | `F15` = `=+E15/$F$6` |
| F | 19 (1) | `=SUM(F{n}:F{n})` | `F19` = `=SUM(F12:F18)` |
| F | 20 (1) | `=1-F{n}` | `F20` = `=1-F19` |
| G | 15-16 (2) | `=+D{n}-E{n}` | `G15` = `=+D15-E15` |
| G | 19 (1) | `=SUM(G{n}:G{n})` | `G19` = `=SUM(G12:G18)` |
| G | 20 (1) | `=+D{n}` | `G20` = `=+D20` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 1 celdas. Ejemplos: B1='CONTROL DE AVANCE FINANCIERO DE OBRA'
- Color `theme0` — 16 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', B6='Residente:', E6='MONTO DEL CONTRATO ORIGINAL:', G6='INCL. IGV', B7='Ing. Supervisor:' … (+8 más)
- Color `theme4` — 7 celdas. Ejemplos: B9='N°', C9='Periodo', D9='Monto Facturables', E9='Montos Devengados', G9='Montos Pendientes por devengar', E10='Montos', F10='%'
- Color `sin color` — 14 celdas. Ejemplos: B12='Adelanto directo', C12='-', D12=0, B13='Adelanto de materiales', C13='-', D13=0, B14='B. Valorizaciones de obra', B15='Valorización N°01' … (+6 más)

### Hoja: RESUMEN VAL.

- Celdas con fórmula: 179
- Celdas con valor literal (posibles inputs): 32

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 2 (1) | `=+FT!E{n}` | `B2` = `=+FT!E20` |
| B | 12-24 (13) | `=+'VAL. MENSUAL'!B{n}` | `B12` = `=+'VAL. MENSUAL'!B13` |
| C | 3-8 (6) | `=+FT!$E${n}` | `C3` = `=+FT!$E$5` |
| C | 12-24 (13) | `=+'VAL. MENSUAL'!C{n}` | `C12` = `=+'VAL. MENSUAL'!C13` |
| E | 12-21 (10) | `=SUM('VAL. MENSUAL'!G{n}:G{n})` | `E12` = `=SUM('VAL. MENSUAL'!G13:G27)` |
| E | 22 (1) | `=SUM('VAL. MENSUAL'!F{n}:F{n})` | `E22` = `=SUM('VAL. MENSUAL'!F141:F146)` |
| E | 23-24 (2) | `=SUM('VAL. MENSUAL'!G{n}:G{n})` | `E23` = `=SUM('VAL. MENSUAL'!G147:G148)` |
| E | 25 (1) | `=ROUND(SUM(E{n}:E{n}),2)` | `E25` = `=ROUND(SUM(E12:E24),2)` |
| E | 26-27 (2) | `=ROUND($D{n}*E${n},2)` | `E26` = `=ROUND($D26*E$25,2)` |
| E | 28 (1) | `=ROUND(E{n}+E{n}+E{n},2)` | `E28` = `=ROUND(E25+E26+E27,2)` |
| E | 29 (1) | `=ROUND($D${n}*E{n},2)` | `E29` = `=ROUND($D$29*E28,2)` |
| E | 30 (1) | `=ROUND(E{n}+E{n},2)` | `E30` = `=ROUND(E28+E29,2)` |
| E | 31 (1) | `=ROUND(E{n}/$E${n},4)` | `E31` = `=ROUND(E25/$E$25,4)` |
| G | 12-19 (8) | `=ROUND(H{n}/$E{n},4)` | `G12` = `=ROUND(H12/$E12,4)` |
| G | 25 (1) | `=+H{n}` | `G25` = `=+H31` |
| H | 12-21 (10) | `=SUM('VAL. MENSUAL'!J{n}:J{n})` | `H12` = `=SUM('VAL. MENSUAL'!J13:J27)` |
| H | 22 (1) | `=SUM('VAL. MENSUAL'!I{n}:I{n})` | `H22` = `=SUM('VAL. MENSUAL'!I141:I146)` |
| H | 23-24 (2) | `=SUM('VAL. MENSUAL'!J{n}:J{n})` | `H23` = `=SUM('VAL. MENSUAL'!J147:J148)` |
| H | 25-31 (7) | `=+'VAL. MENSUAL'!J{n}` | `H25` = `=+'VAL. MENSUAL'!J157` |
| J | 12-19 (8) | `=ROUND(K{n}/$E{n},4)` | `J12` = `=ROUND(K12/$E12,4)` |
| J | 25 (1) | `=+K{n}` | `J25` = `=+K31` |
| K | 12-24 (13) | `=SUM('VAL. MENSUAL'!N{n}:N{n})` | `K12` = `=SUM('VAL. MENSUAL'!N13:N27)` |
| K | 25 (1) | `=ROUND(SUM(K{n}:K{n}),2)` | `K25` = `=ROUND(SUM(K12:K24),2)` |
| K | 26-27 (2) | `=ROUND($D{n}*K${n},2)` | `K26` = `=ROUND($D26*K$25,2)` |
| K | 28 (1) | `=ROUND(K{n}+K{n}+K{n},2)` | `K28` = `=ROUND(K25+K26+K27,2)` |
| K | 29 (1) | `=ROUND($D${n}*K{n},2)` | `K29` = `=ROUND($D$29*K28,2)` |
| K | 30 (1) | `=ROUND(K{n}+K{n},2)` | `K30` = `=ROUND(K28+K29,2)` |
| K | 31 (1) | `=ROUND(K{n}/$E${n},4)` | `K31` = `=ROUND(K25/$E$25,4)` |
| M | 12-24 (13) | `=+G{n}+J{n}` | `M12` = `=+G12+J12` |
| M | 25 (1) | `=+N{n}` | `M25` = `=+N31` |
| N | 12-24 (13) | `=H{n}+K{n}` | `N12` = `=H12+K12` |
| N | 25-30 (6) | `=ROUND(H{n}+K{n},2)` | `N25` = `=ROUND(H25+K25,2)` |
| N | 31 (1) | `=ROUND(H{n}+K{n},4)` | `N31` = `=ROUND(H31+K31,4)` |
| P | 12-24 (13) | `=1-M{n}` | `P12` = `=1-M12` |
| P | 25 (1) | `=+Q{n}` | `P25` = `=+Q31` |
| Q | 12-24 (13) | `=E{n}-N{n}` | `Q12` = `=E12-N12` |
| Q | 25-30 (6) | `=ROUND(E{n}-N{n},2)` | `Q25` = `=ROUND(E25-N25,2)` |
| Q | 31 (1) | `=ROUND(E{n}-N{n},4)` | `Q31` = `=ROUND(E31-N31,4)` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 4 celdas. Ejemplos: B1='RESUMEN DE VALORIZACIÓN POR COMPONENTES', B10='ÍTEM', C10='DESCRIPCIÓN', E10='MONTO CONTRATADO'
- Color `theme0` — 20 celdas. Ejemplos: B3='Obra:', B4='Entidad:', B5='Ejecutor:', B6='Supervisor:', B7='Residente:', B8='Ing. Supervisor:', G10='ACUMULADO ANTERIOR', M10='ACUMULADO ACTUAL' … (+12 más)
- Color `theme4` — 3 celdas. Ejemplos: J10='ACTUAL', J11='% DE AVANCE', K11='MONTO'
- Color `theme9` — 3 celdas. Ejemplos: P10='SALDO', P11='% DE SALDO', Q11='MONTO'
- Color `FFE8FDA5` — 2 celdas. Ejemplos: C25='COSTO DIRECTO', C30='MONTO TOTAL VALORIZADO'

### Hoja: R.F.C

- Celdas con fórmula: 27
- Celdas con valor literal (posibles inputs): 24

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 24-26 (3) | `=+'CONTROL GEN. AVAN. OBRA.'!B{n}` | `B24` = `=+'CONTROL GEN. AVAN. OBRA.'!B11` |
| C | 2-8 (7) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 24-26 (3) | `=+'CONTROL GEN. AVAN. OBRA.'!C{n}` | `C24` = `=+'CONTROL GEN. AVAN. OBRA.'!C11` |
| D | 20 (1) | `=+FT!$E${n}` | `D20` = `=+FT!$E$25` |
| D | 21 (1) | `=ROUND(D{n}*10%,2)` | `D21` = `=ROUND(D20*10%,2)` |
| D | 24-26 (3) | `=+'CONTROL GEN. AVAN. OBRA.'!H{n}` | `D24` = `=+'CONTROL GEN. AVAN. OBRA.'!H11` |
| E | 24 (1) | `=+D{n}` | `E24` = `=+D21` |
| F | 24-26 (3) | `=IF(D{n}<E{n},D{n},E{n})` | `F24` = `=IF(D24<E24,D24,E24)` |
| F | 28-29 (2) | `=+F{n}` | `F28` = `=+F24` |
| F | 30 (1) | `=+F{n}+F{n}` | `F30` = `=+F28+F29` |
| F | 31 (1) | `=+D{n}-F{n}` | `F31` = `=+D21-F30` |
| F | 33 (1) | `=+F{n}` | `F33` = `=+F29` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 1 celdas. Ejemplos: B1='RETENCIÓN DE GARANTÍA DE FIEL CUMPLIMIENTO'
- Color `theme0` — 22 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', B6='Residente:', B7='Ing. Supervisor:', B8='Monto del contrato:', B10='Según el REGLAMENTO DE LA LEY GENERAL DE CONTRATACIONES PÚBLICAS:\nEl CONSORCIO EJECUTOR LOS PINOS con el objetivo de cumplir con el Artículo 114 del Reglamento de la Ley N°32069, Ley General de Contrataciones Públicas, en los contratos de ejecución de obras que celebren las Entidades con las micro y pequeñas empresas (MYPES), estas últimas pueden otorgar como Garantía de Fiel Cumplimiento el diez por ciento (10%) del monto del contrato original, cuyo monto asciende a S/ 63,882.75 (Sesenta y Tres Mil Ochocientos Ochenta y Dos con 75/100 soles) incluido IGV, porcentaje que es retenido por la Entidad durante la primera mitad del número de pagos a realizarse, en forma prorrateada, con cargo a ser devuelto en la liquidación de la Obra.' … (+14 más)
- Color `theme6` — 1 celdas. Ejemplos: E25=0

### Hoja: R PAGO MENSUAL

- Celdas con fórmula: 78
- Celdas con valor literal (posibles inputs): 67

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 1 (1) | `="RESUMEN DE PAGO DE LA "&'VAL. MENSUAL'!B{n}` | `B1` = `="RESUMEN DE PAGO DE LA "&'VAL. MENSUAL'!B1` |
| B | 11-23 (13) | `=+'RESUMEN VAL.'!B{n}` | `B11` = `=+'RESUMEN VAL.'!B12` |
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 11-23 (13) | `=+'RESUMEN VAL.'!C{n}` | `C11` = `=+'RESUMEN VAL.'!C12` |
| D | 11-23 (13) | `=+'RESUMEN VAL.'!J{n}` | `D11` = `=+'RESUMEN VAL.'!J12` |
| D | 25-26 (2) | `=+'RESUMEN VAL.'!D{n}` | `D25` = `=+'RESUMEN VAL.'!D26` |
| D | 29 (1) | `=+'RESUMEN VAL.'!K{n}` | `D29` = `=+'RESUMEN VAL.'!K31` |
| E | 11-23 (13) | `=+'RESUMEN VAL.'!K{n}` | `E11` = `=+'RESUMEN VAL.'!K12` |
| E | 24 (1) | `=ROUND(SUM(E{n}:E{n}),2)` | `E24` = `=ROUND(SUM(E11:E23),2)` |
| E | 25-26 (2) | `=ROUND($D{n}*E${n},2)` | `E25` = `=ROUND($D25*E$24,2)` |
| E | 27 (1) | `=ROUND(E{n}+E{n}+E{n},2)` | `E27` = `=ROUND(E24+E25+E26,2)` |
| E | 28 (1) | `=ROUND($D${n}*E{n},2)` | `E28` = `=ROUND($D$28*E27,2)` |
| E | 29 (1) | `=E{n}+E{n}` | `E29` = `=E27+E28` |
| E | 33 (1) | `=E{n}+E{n}` | `E33` = `=E29+E30` |
| E | 34 (1) | `=SUM(E{n}:E{n})` | `E34` = `=SUM(E35:E36)` |
| E | 37 (1) | `=SUM(E{n}:E{n})` | `E37` = `=SUM(E38:E39)` |
| E | 40 (1) | `=E{n}-E{n}-E{n}` | `E40` = `=E33-E34-E37` |
| E | 41 (1) | `=SUM(E{n}:E{n})` | `E41` = `=SUM(E42:E43)` |
| E | 42 (1) | `=+'R.F.C'!F{n}` | `E42` = `=+'R.F.C'!F29` |
| E | 43 (1) | `=ROUND(E{n}*4%,0)` | `E43` = `=ROUND(E40*4%,0)` |
| E | 44 (1) | `=SUM(E{n}:E{n})` | `E44` = `=SUM(E45:E46)` |
| E | 47 (1) | `=E{n}` | `E47` = `=E40` |
| E | 48 (1) | `=+E{n}-E{n}-E{n}` | `E48` = `=+E40-E41-E44` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme0` — 61 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', B6='Residente:', B7='Ing. Supervisor:', C24='COSTO DIRECTO', C25='GASTOS GENERALES' … (+53 más)
- Color `theme4` — 6 celdas. Ejemplos: B9='ITEM', C9='DESCRIPCIÓN', E9='MONTO', B48='K', C48='MONTO LÍQUIDO A PAGAR AL CONTRATISTA', D48='(F-G-H)'

### Hoja: PAGOS ACUMULADOS

- Celdas con fórmula: 163
- Celdas con valor literal (posibles inputs): 114

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 1 (1) | `="RESUMEN DE LA "&'VAL. MENSUAL'!B{n}` | `B1` = `="RESUMEN DE LA "&'VAL. MENSUAL'!B1` |
| B | 11-23 (13) | `=+'RESUMEN VAL.'!B{n}` | `B11` = `=+'RESUMEN VAL.'!B12` |
| B | 50 (1) | `=+'R PAGO MENSUAL'!B{n}` | `B50` = `=+'R PAGO MENSUAL'!B50` |
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 11-23 (13) | `=+'RESUMEN VAL.'!C{n}` | `C11` = `=+'RESUMEN VAL.'!C12` |
| D | 25-26 (2) | `=+'RESUMEN VAL.'!D{n}` | `D25` = `=+'RESUMEN VAL.'!D26` |
| D | 29 (1) | `=+'RESUMEN VAL.'!K{n}` | `D29` = `=+'RESUMEN VAL.'!K31` |
| E | 11-23 (13) | `=+'RESUMEN VAL.'!E{n}` | `E11` = `=+'RESUMEN VAL.'!E12` |
| E | 24 (1) | `=ROUND(SUM(E{n}:E{n}),2)` | `E24` = `=ROUND(SUM(E11:E23),2)` |
| E | 25-26 (2) | `=ROUND($D{n}*E${n},2)` | `E25` = `=ROUND($D25*E$24,2)` |
| E | 27 (1) | `=ROUND(E{n}+E{n}+E{n},2)` | `E27` = `=ROUND(E24+E25+E26,2)` |
| E | 28 (1) | `=ROUND($D${n}*E{n},2)` | `E28` = `=ROUND($D$28*E27,2)` |
| E | 29 (1) | `=ROUND(E{n}+E{n},2)` | `E29` = `=ROUND(E27+E28,2)` |
| E | 30 (1) | `=+E{n}+E{n}` | `E30` = `=+E31+E32` |
| E | 33-34 (2) | `=+E{n}+E{n}` | `E33` = `=+E29+E30` |
| E | 37 (1) | `=+E{n}+E{n}` | `E37` = `=+E38+E39` |
| E | 40 (1) | `=+E{n}+E{n}+E{n}` | `E40` = `=+E33+E34+E37` |
| E | 41 (1) | `=+E{n}+E{n}` | `E41` = `=+E42+E43` |
| E | 42 (1) | `=+'R.F.C'!D{n}` | `E42` = `=+'R.F.C'!D21` |
| E | 43 (1) | `=ROUND(E{n}*4%,0)` | `E43` = `=ROUND(E40*4%,0)` |
| E | 44 (1) | `=+E{n}+E{n}` | `E44` = `=+E45+E46` |
| E | 47 (1) | `=+E{n}` | `E47` = `=+E40` |
| E | 48 (1) | `=+E{n}-E{n}-E{n}` | `E48` = `=+E40-E41-E44` |
| G | 11-23 (13) | `=+'RESUMEN VAL.'!K{n}` | `G11` = `=+'RESUMEN VAL.'!K12` |
| G | 24 (1) | `=ROUND(SUM(G{n}:G{n}),2)` | `G24` = `=ROUND(SUM(G11:G23),2)` |
| G | 25-26 (2) | `=ROUND($D{n}*G${n},2)` | `G25` = `=ROUND($D25*G$24,2)` |
| G | 27 (1) | `=ROUND(G{n}+G{n}+G{n},2)` | `G27` = `=ROUND(G24+G25+G26,2)` |
| G | 28 (1) | `=ROUND($D${n}*G{n},2)` | `G28` = `=ROUND($D$28*G27,2)` |
| G | 29 (1) | `=ROUND(G{n}+G{n},2)` | `G29` = `=ROUND(G27+G28,2)` |
| G | 30 (1) | `=+G{n}-G{n}` | `G30` = `=+G31-G32` |
| G | 33-34 (2) | `=+G{n}+G{n}` | `G33` = `=+G29+G30` |
| G | 37 (1) | `=+G{n}+G{n}` | `G37` = `=+G38+G39` |
| G | 40 (1) | `=+G{n}+G{n}+G{n}` | `G40` = `=+G33+G34+G37` |
| G | 41 (1) | `=+G{n}+G{n}` | `G41` = `=+G42+G43` |
| G | 42 (1) | `=+'R.F.C'!F{n}` | `G42` = `=+'R.F.C'!F33` |
| G | 43 (1) | `=ROUND(G{n}*4%,0)` | `G43` = `=ROUND(G40*4%,0)` |
| G | 44 (1) | `=+G{n}+G{n}` | `G44` = `=+G45+G46` |
| G | 47 (1) | `=+G{n}` | `G47` = `=+G40` |
| G | 48 (1) | `=+G{n}-G{n}-G{n}` | `G48` = `=+G40-G41-G44` |
| H | 11-18 (8) | `=+F{n}+G{n}` | `H11` = `=+F11+G11` |
| H | 24-48 (25) | `=+F{n}+G{n}` | `H24` = `=+F24+G24` |
| I | 11-18 (8) | `=+E{n}-H{n}` | `I11` = `=+E11-H11` |
| I | 24-48 (25) | `=+E{n}-H{n}` | `I24` = `=+E24-H24` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme0` — 60 celdas. Ejemplos: B2='Obra:', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', B6='Residente:', B7='Ing. Supervisor:', B9='ÍTEM', C9='DESCRIPCIÓN DE SUB PRESUPUESTOS' … (+52 más)
- Color `FFFFFFFF` — 43 celdas. Ejemplos: F11=21290.72, F12=190783.91999999998, F13=30386.060000000005, F14=0, F15=0, F16=0, F17=2230.76, F18=0 … (+35 más)
- Color `FFE8FDA5` — 6 celdas. Ejemplos: F24=290198.67, F29=400648.29, F33=400648.29, F40=400648.29, F47=400648.29, F48=320739.54
- Color `FFF2DCDB` — 5 celdas. Ejemplos: F30=0, F34=0, F37=0, F41=79908.75, F44=0

### Hoja: CONTROL DE PAGOS

- Celdas con fórmula: 97
- Celdas con valor literal (posibles inputs): 126

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 2 (1) | `=+FT!$C${n}` | `B2` = `=+FT!$C$5` |
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 13-15 (3) | `=+'CONTROL GEN. AVAN. OBRA.'!C{n}` | `C13` = `=+'CONTROL GEN. AVAN. OBRA.'!C11` |
| C | 22-24 (3) | `=+C{n}` | `C22` = `=+C13` |
| D | 13-14 (2) | `=+'CONTROL GEN. AVAN. OBRA.'!H{n}` | `D13` = `=+'CONTROL GEN. AVAN. OBRA.'!H11` |
| D | 15 (1) | `=+'[12]CGO-OP'!H{n}` | `D15` = `=+'[12]CGO-OP'!H27` |
| D | 16 (1) | `=SUM(D{n}:D{n})` | `D16` = `=SUM(D13:D15)` |
| D | 25 (1) | `=SUM(D{n}:D{n})` | `D25` = `=SUM(D22:D24)` |
| D | 34 (1) | `=+D{n}+D{n}` | `D34` = `=+D16+D25` |
| E | 16 (1) | `=SUM(E{n}:E{n})` | `E16` = `=SUM(E13:E15)` |
| E | 25 (1) | `=SUM(E{n}:E{n})` | `E25` = `=SUM(E22:E24)` |
| E | 34 (1) | `=+E{n}+E{n}` | `E34` = `=+E16+E25` |
| F | 13-15 (3) | `=+D{n}+E{n}` | `F13` = `=+D13+E13` |
| F | 16 (1) | `=SUM(F{n}:F{n})` | `F16` = `=SUM(F13:F15)` |
| F | 22-24 (3) | `=+D{n}+E{n}` | `F22` = `=+D22+E22` |
| F | 25 (1) | `=SUM(F{n}:F{n})` | `F25` = `=SUM(F22:F24)` |
| F | 34 (1) | `=+F{n}+F{n}` | `F34` = `=+F16+F25` |
| G | 16 (1) | `=SUM(G{n}:G{n})` | `G16` = `=SUM(G13:G15)` |
| G | 25 (1) | `=SUM(G{n}:G{n})` | `G25` = `=SUM(G22:G24)` |
| G | 34 (1) | `=+G{n}+G{n}` | `G34` = `=+G16+G25` |
| H | 5-7 (3) | `=+FT!$E${n}` | `H5` = `=+FT!$E$24` |
| H | 16 (1) | `=SUM(H{n}:H{n})` | `H16` = `=SUM(H13:H15)` |
| H | 25 (1) | `=SUM(H{n}:H{n})` | `H25` = `=SUM(H22:H24)` |
| H | 34 (1) | `=+H{n}+H{n}` | `H34` = `=+H16+H25` |
| I | 13-15 (3) | `=+F{n}-(G{n}+H{n})` | `I13` = `=+F13-(G13+H13)` |
| I | 16 (1) | `=SUM(I{n}:I{n})` | `I16` = `=SUM(I13:I15)` |
| I | 22-24 (3) | `=+F{n}-(G{n}+H{n})` | `I22` = `=+F22-(G22+H22)` |
| I | 25 (1) | `=SUM(I{n}:I{n})` | `I25` = `=SUM(I22:I24)` |
| I | 34 (1) | `=+I{n}+I{n}` | `I34` = `=+I16+I25` |
| J | 13 (1) | `=+'R.F.C'!F{n}` | `J13` = `=+'R.F.C'!F24` |
| J | 16 (1) | `=SUM(J{n}:J{n})` | `J16` = `=SUM(J13:J15)` |
| J | 25 (1) | `=SUM(J{n}:J{n})` | `J25` = `=SUM(J22:J24)` |
| J | 34 (1) | `=+J{n}+J{n}` | `J34` = `=+J16+J25` |
| K | 16 (1) | `=SUM(K{n}:K{n})` | `K16` = `=SUM(K13:K15)` |
| K | 25 (1) | `=SUM(K{n}:K{n})` | `K25` = `=SUM(K22:K24)` |
| K | 32 (1) | `=SUM(K{n}:K{n})` | `K32` = `=SUM(K30:K31)` |
| K | 34 (1) | `=+K{n}+K{n}` | `K34` = `=+K16+K25` |
| L | 13-15 (3) | `=ROUND(I{n}*4%,0)` | `L13` = `=ROUND(I13*4%,0)` |
| L | 16 (1) | `=SUM(L{n}:L{n})` | `L16` = `=SUM(L13:L15)` |
| L | 32 (1) | `=SUM(L{n}:L{n})` | `L32` = `=SUM(L30:L31)` |
| L | 34 (1) | `=+L{n}+L{n}` | `L34` = `=+L16+L25` |
| M | 13-15 (3) | `=ROUND(O{n}/1.18,2)` | `M13` = `=ROUND(O13/1.18,2)` |
| M | 16 (1) | `=SUM(M{n}:M{n})` | `M16` = `=SUM(M13:M15)` |
| M | 22 (1) | `=(I{n}-(J{n}+K{n}))/1.18` | `M22` = `=(I22-(J22+K22))/1.18` |
| M | 25 (1) | `=SUM(M{n}:M{n})` | `M25` = `=SUM(M22:M24)` |
| M | 30 (1) | `=+K{n}/1.18` | `M30` = `=+K30/1.18` |
| M | 31 (1) | `=+L{n}/1.18` | `M31` = `=+L31/1.18` |
| M | 32 (1) | `=SUM(M{n}:M{n})` | `M32` = `=SUM(M30:M31)` |
| M | 34 (1) | `=+M{n}+M{n}` | `M34` = `=+M16+M25` |
| N | 13-15 (3) | `=+O{n}-M{n}` | `N13` = `=+O13-M13` |
| N | 16 (1) | `=SUM(N{n}:N{n})` | `N16` = `=SUM(N13:N15)` |
| N | 22-24 (3) | `=M{n}*18%` | `N22` = `=M22*18%` |
| N | 25 (1) | `=SUM(N{n}:N{n})` | `N25` = `=SUM(N22:N24)` |
| N | 30-31 (2) | `=+M{n}*18%` | `N30` = `=+M30*18%` |
| N | 32 (1) | `=SUM(N{n}:N{n})` | `N32` = `=SUM(N30:N31)` |
| N | 34 (1) | `=+N{n}+N{n}` | `N34` = `=+N16+N25` |
| O | 13-15 (3) | `=+I{n}-(J{n}+K{n}+L{n})` | `O13` = `=+I13-(J13+K13+L13)` |
| O | 16 (1) | `=SUM(O{n}:O{n})` | `O16` = `=SUM(O13:O15)` |
| O | 22-24 (3) | `=+M{n}+N{n}` | `O22` = `=+M22+N22` |
| O | 25 (1) | `=SUM(O{n}:O{n})` | `O25` = `=SUM(O22:O24)` |
| O | 30-31 (2) | `=+M{n}+N{n}` | `O30` = `=+M30+N30` |
| O | 32 (1) | `=SUM(O{n}:O{n})` | `O32` = `=SUM(O30:O31)` |
| O | 34 (1) | `=+O{n}+O{n}` | `O34` = `=+O16+O25` |

**⚠ Posibles problemas detectados:**

- `D15`: referencia a archivo externo (posible link roto, ej. '[1]Hoja!...')

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme3` — 28 celdas. Ejemplos: B1='RESUMEN DE VALORIZACIONES TRAMITADAS Y PAGADAS ', B10='VALORIZACIONES CONTRACTUALES', F10='VALORIZACIÓN BRUTA', G10='AMORTIZACIONES', I10='VALORIZACIÓN NETA FACTURABLE', J10='RETENCIONES\n(G.F.C)', K10='PENALIDADES', L10='DETRACCIONES' … (+20 más)
- Color `theme0` — 85 celdas. Ejemplos: B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', F5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', F6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:', F7='PLAZO DE EJECUCIÓN:' … (+77 más)
- Color `theme4` — 13 celdas. Ejemplos: B14=2, E14=0, G14=0, H14=0, J14=0, K14=0, B23=2, D23=0 … (+5 más)

### Hoja: RH-EM

- Celdas con fórmula: 15
- Celdas con valor literal (posibles inputs): 101

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 2 (1) | `=+FT!$C${n}` | `B2` = `=+FT!$C$5` |
| C | 2-7 (6) | `=+FT!$E${n}` | `C2` = `=+FT!$E$5` |
| C | 12 (1) | `=+FT!E{n}` | `C12` = `=+FT!E32` |
| C | 18-19 (2) | `=+C{n}` | `C18` = `=+C12` |
| D | 18-19 (2) | `=+D{n}` | `D18` = `=+D12` |
| E | 5-7 (3) | `=+FT!$E${n}` | `E5` = `=+FT!$E$24` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `theme0` — 93 celdas. Ejemplos: B1='CRONOGRAMA DE PARTICIPACIÓN DE PERSONAL CLAVE - JULIO 2026', B3='Entidad:', B4='Ejecutor:', B5='Supervisor:', D5='VALOR REFERENCIAL (CON IGV)', B6='Residente:', D6='MONTO DEL CONTRATO (INCL. IGV):', B7='Ing. Supervisor:' … (+85 más)
- Color `FFFF0000` — 8 celdas. Ejemplos: K16='D', R16='D', Y16='D', AF16='D', K17=5, R17=12, Y17=19, AF17=26

### Hoja: resumen 3

- Celdas con fórmula: 41
- Celdas con valor literal (posibles inputs): 58

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 4 (1) | `=#REF!` | `B4` = `=#REF!` |
| B | 7 (1) | `=#REF!` | `B7` = `=#REF!` |
| C | 35 (1) | `=A{n}` | `C35` = `=A2` |
| C | 51 (1) | `=C{n}` | `C51` = `=C31` |
| C | 56 (1) | `=A{n}` | `C56` = `=A23` |
| F | 11 (1) | `=#REF!` | `F11` = `=#REF!` |
| F | 12 (1) | `=SUM(F{n}:F{n})` | `F12` = `=SUM(F11:F11)` |
| F | 13 (1) | `=F{n}*0.075` | `F13` = `=F12*0.075` |
| F | 14 (1) | `=F{n}*0.05` | `F14` = `=F12*0.05` |
| F | 15 (1) | `=SUM(F{n}:F{n})` | `F15` = `=SUM(F12:F14)` |
| F | 16 (1) | `=F{n}*0.18+0.01` | `F16` = `=F15*0.18+0.01` |
| F | 17 (1) | `=SUM(F{n}:F{n})-0.01` | `F17` = `=SUM(F15:F16)-0.01` |
| F | 18 (1) | `=F{n}*1` | `F18` = `=F17*1` |
| F | 19 (1) | `=F{n}` | `F19` = `=F18` |
| F | 20 (1) | `=#REF!` | `F20` = `=#REF!` |
| F | 22 (1) | `=SUM(F{n}:F{n})` | `F22` = `=SUM(F19:F20)` |
| G | 11 (1) | `=#REF!` | `G11` = `=#REF!` |
| G | 12 (1) | `=SUM(G{n}:G{n})` | `G12` = `=SUM(G11:G11)` |
| G | 13 (1) | `=G{n}*0.075` | `G13` = `=G12*0.075` |
| G | 14 (1) | `=G{n}*0.05` | `G14` = `=G12*0.05` |
| G | 15 (1) | `=SUM(G{n}:G{n})-0.01` | `G15` = `=SUM(G12:G14)-0.01` |
| G | 16 (1) | `=G{n}*0.18-0.01` | `G16` = `=G15*0.18-0.01` |
| G | 17 (1) | `=SUM(G{n}:G{n})+0.01` | `G17` = `=SUM(G15:G16)+0.01` |
| G | 18 (1) | `=G{n}*1` | `G18` = `=G17*1` |
| G | 23 (1) | `=SUM(G{n}:G{n})` | `G23` = `=SUM(G18:G21)` |
| G | 37-41 (5) | `=G{n}` | `G37` = `=G12` |
| G | 43 (1) | `=G{n}` | `G43` = `=G23` |
| G | 49 (1) | `=SUM(G{n}:G{n})` | `G49` = `=SUM(G43:G47)` |
| G | 58-59 (2) | `=#REF!` | `G58` = `=#REF!` |
| G | 61 (1) | `=SUM(G{n}:G{n})` | `G61` = `=SUM(G58:G60)` |
| G | 64 (1) | `=#REF!*0.1` | `G64` = `=#REF!*0.1` |
| G | 67 (1) | `=G{n}-G{n}` | `G67` = `=G61-G64` |
| H | 11 (1) | `=#REF!` | `H11` = `=#REF!` |
| H | 12 (1) | `=G{n}/F{n}` | `H12` = `=G12/F12` |
| H | 23 (1) | `=G{n}/F{n}` | `H23` = `=G23/F22` |
| I | 29 (1) | `=F{n}-I{n}` | `I29` = `=F23-I26` |

**⚠ Posibles problemas detectados:**

- `B4`: fórmula rota (#REF!)
- `B7`: fórmula rota (#REF!)
- `F11`: fórmula rota (#REF!)
- `G11`: fórmula rota (#REF!)
- `H11`: fórmula rota (#REF!)
- `F20`: fórmula rota (#REF!)
- `G58`: fórmula rota (#REF!)
- `G59`: fórmula rota (#REF!)
- `G64`: fórmula rota (#REF!)

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `sin color` — 58 celdas. Ejemplos: A1='RESUMEN DE LA VALORIZACION N° 03', A2='Del 01 de Octubre  Al 31 de Octubre del 2014', A4='PROYECTO : ', A6='LUGAR :', B6=' CODO DEL POZUZO - PUERTO INCA - HUANUCO.', A7='FECHA : ', A9='ITEM', B9='DESCRIPCION' … (+50 más)

### Hoja: resumen 2

- Celdas con fórmula: 36
- Celdas con valor literal (posibles inputs): 45

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| B | 4 (1) | `=#REF!` | `B4` = `=#REF!` |
| B | 7 (1) | `=#REF!` | `B7` = `=#REF!` |
| C | 35 (1) | `=A{n}` | `C35` = `=A2` |
| C | 51 (1) | `=C{n}` | `C51` = `=C31` |
| F | 11-12 (2) | `=#REF!` | `F11` = `=#REF!` |
| F | 13 (1) | `=F{n}*0.075` | `F13` = `=F12*0.075` |
| F | 14 (1) | `=F{n}*0.05` | `F14` = `=F12*0.05` |
| F | 15 (1) | `=SUM(F{n}:F{n})` | `F15` = `=SUM(F12:F14)` |
| F | 16 (1) | `=F{n}*0.18+0.01` | `F16` = `=F15*0.18+0.01` |
| F | 17 (1) | `=SUM(F{n}:F{n})-0.01` | `F17` = `=SUM(F15:F16)-0.01` |
| F | 18 (1) | `=F{n}*1` | `F18` = `=F17*1` |
| F | 19 (1) | `=F{n}` | `F19` = `=F18` |
| F | 20 (1) | `=#REF!` | `F20` = `=#REF!` |
| F | 22 (1) | `=SUM(F{n}:F{n})` | `F22` = `=SUM(F19:F20)` |
| G | 11 (1) | `=#REF!` | `G11` = `=#REF!` |
| G | 12 (1) | `=SUM(G{n}:G{n})` | `G12` = `=SUM(G11:G11)` |
| G | 13 (1) | `=G{n}*0.075` | `G13` = `=G12*0.075` |
| G | 14 (1) | `=G{n}*0.05` | `G14` = `=G12*0.05` |
| G | 15 (1) | `=SUM(G{n}:G{n})` | `G15` = `=SUM(G12:G14)` |
| G | 16 (1) | `=G{n}*0.18` | `G16` = `=G15*0.18` |
| G | 17 (1) | `=SUM(G{n}:G{n})+0.01` | `G17` = `=SUM(G15:G16)+0.01` |
| G | 18 (1) | `=G{n}*1` | `G18` = `=G17*1` |
| G | 20 (1) | `=G{n}` | `G20` = `=G18` |
| G | 23 (1) | `=G{n}` | `G23` = `=G20` |
| G | 37-41 (5) | `=G{n}` | `G37` = `=G12` |
| G | 43 (1) | `=G{n}` | `G43` = `=G23` |
| G | 49 (1) | `=SUM(G{n}:G{n})` | `G49` = `=SUM(G43:G47)` |
| H | 11 (1) | `=#REF!` | `H11` = `=#REF!` |
| H | 12 (1) | `=G{n}/F{n}` | `H12` = `=G12/F12` |
| H | 23 (1) | `=G{n}/F{n}` | `H23` = `=G23/F22` |
| I | 29 (1) | `=F{n}-I{n}` | `I29` = `=F23-I26` |

**⚠ Posibles problemas detectados:**

- `B4`: fórmula rota (#REF!)
- `B7`: fórmula rota (#REF!)
- `F11`: fórmula rota (#REF!)
- `G11`: fórmula rota (#REF!)
- `H11`: fórmula rota (#REF!)
- `F12`: fórmula rota (#REF!)
- `F20`: fórmula rota (#REF!)

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `sin color` — 45 celdas. Ejemplos: A1='RESUMEN DE LA VALORIZACION N° 03', A2='Del 01 de Setiembre   Al 30 de Setiembre del 2014', A4='PROYECTO : ', A6='LUGAR :', B6=' CODO DEL POZUZO - PUERTO INCA - HUANUCO.', A7='FECHA : ', A9='ITEM', B9='DESCRIPCION' … (+37 más)

### Hoja: Hoja2

- Celdas con fórmula: 0
- Celdas con valor literal (posibles inputs): 0

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

_Sin fórmulas en esta hoja._

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

_Sin celdas literales en esta hoja._

### Hoja: PROGRAMADO

- Celdas con fórmula: 32
- Celdas con valor literal (posibles inputs): 72

**Fórmulas** (comprimidas por patrón repetido; usa `--full` para ver cada celda):

| Columna | Filas | Patrón | Ejemplo |
|---|---|---|---|
| D | 11 (1) | `=SUM(D{n}:D{n})` | `D11` = `=SUM(D5:D10)` |
| E | 5-10 (6) | `=+D{n}/$D${n}` | `E5` = `=+D5/$D$11` |
| F | 5 (1) | `=+E{n}` | `F5` = `=+E5` |
| F | 6-10 (5) | `=+E{n}+F{n}` | `F6` = `=+E6+F5` |
| G | 11 (1) | `=SUM(G{n}:G{n})` | `G11` = `=SUM(G5:G10)` |
| H | 5 (1) | `=+G{n}/$D${n}` | `H5` = `=+G5/$D$11` |
| I | 5 (1) | `=H{n}` | `I5` = `=H5` |
| J | 11 (1) | `=SUM(J{n}:J{n})` | `J11` = `=SUM(J5:J10)` |
| K | 5-10 (6) | `=+J{n}/$D${n}` | `K5` = `=+J5/$D$11` |
| L | 5 (1) | `=+K{n}` | `L5` = `=+K5` |
| L | 6-10 (5) | `=+K{n}+L{n}` | `L6` = `=+K6+L5` |
| M | 11 (1) | `=SUM(M{n}:M{n})` | `M11` = `=SUM(M5:M10)` |
| N | 5 (1) | `=+M{n}/J${n}` | `N5` = `=+M5/J$11` |
| O | 5 (1) | `=N{n}` | `O5` = `=N5` |

**Puntos de captura de datos (celdas con valor literal, sin fórmula):**

- Color `sin color` — 72 celdas. Ejemplos: A1='AVANCE DE OBRA PROGRAMADO VS EJECUTADO - FISICO Y FINANCIERO', A2='Mes/Año', C2='DESCRIPCIÓN', D2='Avance Físico  %', J2='Avance  Financiero  %', B3='Cronogramas', D3='Programado', G3='Ejecutado' … (+64 más)