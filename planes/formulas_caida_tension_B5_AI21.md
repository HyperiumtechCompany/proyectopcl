# Fórmulas CT — copia literal de `MD_Caida!B5:AI21`

Fuente: `C:\Users\admin\Downloads\2.2 CAIDA DE TENSIÓN.xlsx`.

No se corrigen ni convierten unidades: cada resultado conserva la unidad y la relación de la plantilla.

## Nombres usados en el sistema

| Excel | Nombre | Unidad |
|---|---|---|
| E | `piAlumbradoW` | W |
| F | `piTomasW` | W |
| G | `piFuerzaW` | W, salvo la referencia literal del TG |
| H | `factorPotencia` | adimensional |
| I | `factorSimultaneidadTomas` | adimensional |
| J | `piTotalKw` | kW |
| K | `maximaDemandaKw` | kW |
| L | `sistema` | 1 o 3 |
| M | `corrienteDisenoA` | A |
| N | `corrienteTotalA` | A |
| O | `balanceo` | R, S, T, RS, ST, TR o RST |
| P/Q/R | `corrienteR_A`, `corrienteS_A`, `corrienteT_A` | A |
| S | `corrienteNominalCableA` | A |
| T | `temperaturaAmbienteC` | °C |
| U | `circuitosAgrupados` | cantidad |
| V | `factorAgrupamientoK1` | adimensional |
| W | `factorTemperaturaK2` | adimensional |
| X | `corrienteAdmisibleCableA` | A |
| Y | `conformidadCapacidad` | texto |
| Z/AA | `itm`, `dif` | texto |
| AB | `longitudConductorM` | m |
| AC | `seccionConductorMm2` | mm² |
| AD | `deltaVoltajeV` | V |
| AE | `deltaVoltajePct` | % |
| AF | `conformidadCaida` | texto |
| AG | `diametroTuboMm` | mm |
| AH | `tipoConductor` | catálogo |
| AI | `seccionTierraMm2` | mm² |

## B5:AI9 — parámetros y encabezados

- `C5 = 3`: número de fases.
- `E5 = "Estrella"`: conexión.
- `K5 = SI(C5=1;220;SI(E5="Estrella";380;SI(E5="Delta";220)))`.
- `P5 = 1.25`: factor de diseño `fdis`.
- `AD5 = 40`: temperatura de trabajo para resistividad.
- `AG5 = 1/58*(1+0.00393*(AD5-20))`.
- `B6:AI7`: título, sin cálculo.
- `B8:AI9`: encabezados y unidades, sin cálculo.

Forma nominal:

```text
VOLTAJE_TABLERO_V = sistemaFases == 1
  ? 220
  : conexion == "Estrella" ? 380 : 220

RESISTIVIDAD_COBRE = (1 / 58) * (1 + 0.00393 * (temperaturaTrabajoC - 20))
FACTOR_DISENO = 1.25
```

## Tres tipos de circuito C — filas 11:18

### 1. C-Alumbrado

```text
PI_ALUMBRADO_W = suma de potencia de luminarias conectadas
PI_TOMAS_W = 0
PI_FUERZA_W = 0
```

### 2. C-Tomacorriente

```text
PI_ALUMBRADO_W = 0
PI_TOMAS_W = suma de potencia de tomacorrientes conectados
PI_FUERZA_W = 0
```

### 3. C-Fuerza

```text
PI_ALUMBRADO_W = 0
PI_TOMAS_W = 0
PI_FUERZA_W = potencia de fuerza ingresada
```

Desde J hasta AI, los tres tipos usan exactamente las mismas fórmulas. Para copiar en una fila `n`:

```excel
Jn =(En+Fn+Gn)/1000
Kn =In*Jn
Mn =SI(Ln=1;Kn*1000/(220*Hn);Kn*1000/(RAIZ(3)*$K$5*Hn))*fdis
Nn =SI(Ln=1;Kn*1000/(220*Hn);Kn*1000/(RAIZ(3)*$K$5*Hn))
Pn =SI($On="RST";$Nn*fdis;SI($On="R";$Nn*fdis;SI($On="RS";$Nn*fdis;SI($On="TR";$Nn*fdis;""))))
Qn =SI($On="RST";$Nn*fdis;SI($On="S";$Nn*fdis;SI($On="RS";$Nn*fdis;SI($On="ST";$Nn*fdis;""))))
Rn =SI($On="RST";$Nn*fdis;SI($On="T";$Nn*fdis;SI($On="ST";$Nn*fdis;SI($On="TR";$Nn*fdis;""))))
Sn =BUSCARV(ACn;tablas!$A$5:$G$21;COINCIDIR(AHn;tablas!$B$3:$G$3;0)+1)
Xn =Wn*Vn*Sn
Yn =SI(Xn>MAX(Pn:Rn);"Conforme";"No Conforme")
ADn=SI(Ln=1;(2*MAX(Pn:Rn)*$AG$5*ABn*Hn)/ACn+$AD$19;SI(Ln=3;(RAIZ(3)*MAX(Pn:Rn)*$AG$5*ABn*Hn)/ACn+$AD$19;""))
AEn=SI(Ln=1;ADn/220*100;ADn/$K$5*100)
AFn=SI(AEn<4;"Cumple";"No cumple")
```

Entradas manuales o provenientes del modelo: `E:F:G`, `H`, `I`, `L`, `O`, `T`, `U`, `Z`, `AA`, `AB`, `AC`, `AG`, `AH`, `AI`.

Forma nominal usada por el sistema:

```text
piTotalKw = (piAlumbradoW + piTomasW + piFuerzaW) / 1000
maximaDemandaKw = factorSimultaneidadTomas * piTotalKw

corrienteTotalA = sistema == 1
  ? maximaDemandaKw * 1000 / (220 * factorPotencia)
  : maximaDemandaKw * 1000 / (sqrt(3) * voltajeTableroV * factorPotencia)

corrienteDisenoA = corrienteTotalA * factorDiseno

corrienteR_A = balanceo contiene R ? corrienteTotalA * factorDiseno : 0
corrienteS_A = balanceo contiene S ? corrienteTotalA * factorDiseno : 0
corrienteT_A = balanceo contiene T ? corrienteTotalA * factorDiseno : 0

corrienteAdmisibleCableA = corrienteNominalCableA * factorAgrupamientoK1 * factorTemperaturaK2
conformidadCapacidad = corrienteAdmisibleCableA > max(corrienteR_A, corrienteS_A, corrienteT_A)

deltaPropioV = sistema == 1
  ? 2 * corrienteMaximaFaseA * resistividadCobre * longitudM * factorPotencia / seccionMm2
  : sqrt(3) * corrienteMaximaFaseA * resistividadCobre * longitudM * factorPotencia / seccionMm2

deltaVoltajeV = deltaPropioV + deltaAguasArribaV
deltaVoltajePct = deltaVoltajeV / (sistema == 1 ? 220 : voltajeTableroV) * 100
conformidadCaida = deltaVoltajePct < 4
```

## TD — fila 19

Fórmulas literales:

```excel
B19 ="TD"
E19 =AD21
J19 =SUMA(J11:J18)
K19 =SUMA(K11:K17)
M19 =SI.ERROR(SI(L19=1;K19*1000/(220*H19);K19*1000/(RAIZ(3)*$K$5*H19))*fdis;"")
N19 =MAX(P19:R19)/1.25
O19 =SI(L19=3;"RST";O11)
P19 =SUMA(P11:P18)
Q19 =SUMA(Q11:Q18)
R19 =SUMA(R11:R18)
S19 =BUSCARV(AC19;tablas!$A$5:$G$21;COINCIDIR(AH19;tablas!$B$3:$G$3;0)+1)
V19 =SI(U19=2;0.85;SI(U19=3;0.75;SI(U19=4;0.7;SI(U19=5;0.65;SI(U19=6;0.6)))))
W19 =SI(T19=10;1.07;SI(T19=15;1.04;SI(T19=20;1;SI(T19=25;0.96;SI(T19=30;0.93;SI(T19=35;0.89;SI(T19=40;0.85)))))))
X19 =W19*V19*S19
Y19 =SI(X19>MAX(P19:R19);"Conforme";"No Conforme")
AD19=SI(L19=1;(2*MAX(P19:R19)*$AG$5*AB19*H19)/AC19+E19;SI(L19=3;(RAIZ(3)*MAX(P19:R19)*$AG$5*AB19*H19)/AC19+E19;""))
AE19=SI(L19=1;AD19/220*100;AD19/$K$5*100)
AF19=SI(AE19<2.5;"Cumple";"No cumple")
```

Relación crítica, conservada sin conversión:

```text
piAlumbradoTd = deltaVoltajeTgV
deltaAguasArribaTdV = piAlumbradoTd
```

En el archivo revisado: `AD21 = 0.4023831389`, por lo tanto `E19 = 0.4023831389` y visualmente `0.40`.

## TG — fila 21

Fórmulas literales:

```excel
G21 =J19
J21 =J19
K21 =K19*I21
M21 =SI(L21=1;K21*1000/(220*H21);K21*1000/(RAIZ(3)*$K$5*H21))*1.25
N21 =MAX(P21:R21)/1.25
O21 ="RST"
P21 =P19*I21
Q21 =Q19*I21
R21 =R19*I21
S21 =BUSCARV(AC21;tablas!$A$5:$G$21;COINCIDIR(AH21;tablas!$B$3:$G$3;0)+1)
V21 =SI(U21=2;0.85;SI(U21=3;0.75;SI(U21=4;0.7;SI(U21=5;0.65;SI(U21=6;0.6)))))
W21 =SI(T21=10;1.07;SI(T21=15;1.04;SI(T21=20;1;SI(T21=25;0.96;SI(T21=30;0.93;SI(T21=35;0.89;SI(T21=40;0.85)))))))
X21 =W21*V21*S21
Y21 =SI(X21>MAX(P21:R21);"Conforme";"No Conforme")
AD21=SI(L21=1;(2*MAX(P21:R21)*$AG$5*AB21*H21)/AC21;SI(L21=3;(RAIZ(3)*MAX(P21:R21)*$AG$5*AB21*H21)/AC21;""))
AE21=SI(L21=1;AD21/220*100;AD21/$K$5*100)
AF21=SI(AE21<1;"Cumple";"No cumple")
```

Forma nominal para varios TD:

```text
piFuerzaTgKw = suma(piTotalKw de cada TD)
piTotalTgKw = suma(piTotalKw de cada TD)
maximaDemandaTgKw = suma(maximaDemandaKw de cada TD) * factorSimultaneidadTg

corrienteR_TgA = suma(corrienteR_TdA) * factorSimultaneidadTg
corrienteS_TgA = suma(corrienteS_TdA) * factorSimultaneidadTg
corrienteT_TgA = suma(corrienteT_TdA) * factorSimultaneidadTg
corrienteTotalTgA = max(corrienteR_TgA, corrienteS_TgA, corrienteT_TgA) / factorDiseno
```

## Catálogo de corriente nominal S

La fórmula `BUSCARV + COINCIDIR` se implementa buscando por `seccionConductorMm2` y `tipoConductor`. Los tipos de la tabla son `TW`, `THW`, `NYY`, `LSOH-80`, `LSOH-90` y `N2X0H`; los valores son los mismos del rango `tablas!A5:G21`.

## Celdas sin fórmula

Las celdas vacías del rango y las columnas de identificación, descripción, protecciones, longitud, sección, tubo, tipo de conductor y tierra son datos de entrada o selección. No se inventa una fórmula para ellas.
