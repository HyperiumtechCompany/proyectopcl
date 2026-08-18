# PLAN.md
# Plan de Validación y Comparación Motor DIALUX - HYPERIUMTECH

## Objetivo

Definir las fases necesarias para comprobar nuestro motor de cálculo lumínico contra DIALux, identificando:

- Inputs necesarios.
- Datos que debemos importar.
- Datos faltantes.
- Fórmulas requeridas.
- Outputs esperados.
- Fuente de captura de información.

---

# Arquitectura de validación

Flujo:

DIALux
|
Exportación de información
|
Inputs del proyecto
|
Motor HYPERIUMTECH
|
Resultados
|
Comparación


---

# FASE 1 - Validación del lector LDT

## Objetivo

Comprobar que nuestro lector procesa correctamente una luminaria fotométrica.

## Fuente

Archivo:

.ltd / EULUMDAT


## Información que debemos extraer

### Identificación

- Fabricante.
- Modelo.
- Tipo de luminaria.


### Información eléctrica

- Potencia.
- Flujo luminoso.
- Eficiencia.


### Información geométrica

- Dimensiones.
- Área luminosa.


### Información fotométrica

Dato principal:

I(C, gamma)

Incluye:

- Planos C.
- Ángulos Gamma.
- Intensidad luminosa.


## Validación

Comparar:

DIALux vs HYPERIUMTECH

- Flujo luminoso.
- Potencia.
- Dimensiones.
- Curva fotométrica.


---

# FASE 2 - Modelo del recinto

## Objetivo

Capturar toda la información que NO viene del LDT.


## Inputs requeridos


## Geometría

Capturar:

- Largo.
- Ancho.
- Altura.
- Área.


Fuente:

Proyecto DIALux.


## Materiales

Capturar:

- Reflectancia techo.
- Reflectancia paredes.
- Reflectancia piso.


## Posición luminarias

Capturar:

- X.
- Y.
- Z.
- Rotación.
- Cantidad.


---

# FASE 3 - Motor fotométrico


## Objetivo

Calcular iluminancia punto a punto.


## Inputs

- Archivo LDT.
- Coordenadas luminarias.
- Puntos de cálculo.


## Fórmula principal


E = I(gamma,phi) * cos(theta) / d²


## Procesamiento


1. Obtener intensidad luminosa.
2. Interpolar valores fotométricos.
3. Calcular distancia.
4. Aplicar ley del inverso cuadrado.


## Outputs

- Lux por punto.
- Mapa isolux.
- Iluminancia promedio.
- Iluminancia mínima.
- Iluminancia máxima.


---

# FASE 4 - Validación luminotécnica


Comparación:


| Parámetro | DIALux | HYPERIUMTECH |
|---|---|---|
| Lux promedio | | |
| Lux mínimo | | |
| Lux máximo | | |
| Uniformidad | | |
| UGR | | |


---

# FASE 5 - Motor UGR


## Inputs


Luminaria:

- LDT.
- Área luminosa.


Recinto:

- Dimensiones.
- Reflectancias.


Observador:

- Altura.
- Posición.
- Dirección visual.


## Fórmula


UGR = 8 log10((0.25/Lb) * Σ(L²*w/p²))


## Outputs


- UGR paralelo.
- UGR perpendicular.
- Tabla UGR.


---

# FASE 6 - Consumo energético y LENI


## Objetivo

Replicar cálculo energético.


Referencia:

EN 15193 / EN 15193-1.

La norma establece metodología para evaluar energía utilizada en iluminación y el indicador LENI. citeturn0search6


## Inputs


## Proyecto

- Tipo de edificio.
- Área.


## Operación

- Horas anuales.
- Horas diurnas.
- Horas nocturnas.


## Sistema iluminación

- Potencia instalada.
- Tipo de control.
- Regulación.
- Luz natural.
- Ocupación.


## Factores

FD:
Factor dependencia luz natural.

FO:
Factor ocupación.

FC:
Factor iluminación constante.


## Outputs


- Energía anual kWh/año.
- LENI kWh/(m² año).


---

# FASE 7 - Matriz de datos


Crear control:


| Dato | Fuente | Estado |
|---|---|---|
| LDT | Fabricante | |
| Geometría recinto | DIALux | |
| Reflectancias | Usuario | |
| Posición luminarias | DIALux | |
| Horarios | Norma / usuario | |
| Controles | Usuario | |
| Resultados lux | DIALux | |


---

# FASE 8 - Validación completa


Para cada proyecto:


Guardar:


validation/

    proyecto01/

        input.json

        luminaria.ldt

        resultado_dialux.pdf

        resultado_motor.json


---

# FASE 9 - Orden recomendado de desarrollo


1. Parser LDT.

2. Modelo luminaria.

3. Modelo recinto.

4. Cálculo lux.

5. Interpolación fotométrica.

6. Isolux.

7. Uniformidad.

8. UGR.

9. Energía LENI.

10. Reportes.


---

# Resultado final esperado


INPUT:

- Archivo LDT.
- Ambiente.
- Posiciones luminarias.
- Parámetros normativos.
- Parámetros energéticos.


OUTPUT:

- Cálculo lumínico.
- UGR.
- Uniformidad.
- Consumo energético.
- LENI.
- Reporte técnico.


---

# Nota técnica

El archivo LDT es la fuente fotométrica de la luminaria. No contiene por sí solo todos los parámetros del edificio ni del cálculo energético. Los datos del recinto, horarios, controles y factores deben incorporarse como entradas adicionales.
