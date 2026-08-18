# PLAN.md

# Plan Maestro de Revisión, Ajuste y Evolución del Motor DIALUX HYPERIUMTECH

## 1. Objetivo General

Desarrollar un motor de cálculo lumínico profesional capaz de obtener
resultados comparables con DIALux evo, sustentables ante un ingeniero
eléctrico mediante:

-   fundamentos físicos;
-   ecuaciones documentadas;
-   trazabilidad de datos;
-   validación matemática;
-   comparación contra resultados oficiales DIALux.

El objetivo no es copiar una interfaz, sino construir un motor propio
con metodología de ingeniería.

------------------------------------------------------------------------

# 2. Situación Actual

## Resultado identificado

Caso de validación:

DIALux evo:

-   Iluminancia promedio: 544 lux

Motor HYPERIUMTECH:

-   Iluminancia promedio: 502 lux

Diferencia:

42 lux

Error relativo aproximado:

7.7 %

## Interpretación

La diferencia no significa necesariamente que la fórmula principal esté
incorrecta.

La desviación puede provenir de:

-   lectura incorrecta del LDT;
-   escalamiento del flujo luminoso;
-   interpolación fotométrica;
-   interpretación de simetría;
-   geometría del recinto;
-   altura del plano de trabajo;
-   factores de mantenimiento;
-   reflexión del ambiente;
-   modelo UGR.

No se debe corregir mediante factores artificiales (+8%), sino encontrar
la causa física.

------------------------------------------------------------------------

# 3. Principio de Desarrollo

Toda función debe tener:

1.  Entrada definida.
2.  Fuente del dato.
3.  Fórmula aplicada.
4.  Unidad física.
5.  Resultado esperado.
6.  Comparación con DIALux.

Formato:

Entrada → Proceso matemático → Resultado → Validación

------------------------------------------------------------------------

# FASE 1

# Auditoría del Caso Patrón DIALux

## Objetivo

Crear un proyecto patrón para comparar exactamente ambos motores.

## Datos a congelar

### Ambiente

-   Largo.
-   Ancho.
-   Altura.
-   Área.
-   Reflectancia techo.
-   Reflectancia pared.
-   Reflectancia piso.

### Luminarias

-   Archivo LDT original.
-   Fabricante.
-   Modelo.
-   Flujo luminoso.
-   Potencia.
-   Cantidad.
-   Altura.
-   Rotación.

### Cálculo

-   Plano de trabajo.
-   Malla de cálculo.
-   Tipo de objeto de cálculo.
-   Factores aplicados.

## Entregable

Archivo:

validation_case_001/

    proyecto_dialux

    luminaria.ldt

    parametros.json

    resultado_dialux.pdf

    resultado_motor.json

------------------------------------------------------------------------

# FASE 2

# Validación del Parser LDT

## Objetivo

Garantizar que la luminaria sea interpretada igual que DIALux.

## Información a revisar

### Identificación

-   Fabricante.
-   Modelo.
-   Código.

### Datos eléctricos

-   Potencia.
-   Flujo luminoso.
-   Eficiencia.

### Datos geométricos

-   Largo.
-   Ancho.
-   Alto.
-   Área luminosa.

### Datos fotométricos

Matriz:

I(C,gamma)

Debe contener:

-   Planos C.
-   Ángulos Gamma.
-   Intensidades luminosas.

------------------------------------------------------------------------

## Pruebas

Comparar:

DIALux vs HYPERIUMTECH

Tabla:

  Dato             DIALux   Motor
  ---------------- -------- -------
  Flujo luminoso            
  Potencia                  
  Dimensiones               
  Candela máxima            

------------------------------------------------------------------------

# FASE 3

# Revisión del Escalamiento Fotométrico

## Problema posible

El LDT puede entregar valores normalizados y requiere conversión.

## Validar fórmula

I_real = I_LDT × factor_de_flujo

Verificar:

-   flujo declarado;
-   flujo total;
-   factor de escala.

## Justificación

Un error aquí modifica todos los lux calculados.

------------------------------------------------------------------------

# FASE 4

# Mejora de Interpolación C-Gamma

## Objetivo

Obtener la intensidad luminosa exacta hacia cualquier dirección.

## Validar:

-   interpolación Gamma;
-   interpolación plano C;
-   reconstrucción por simetría.

## Error típico

Usar el valor más cercano en lugar de interpolación.

## Mejora requerida

Implementar:

Interpolación bilineal:

I(C,gamma)

------------------------------------------------------------------------

# FASE 5

# Validación del Modelo Geométrico

## Objetivo

Confirmar que la posición matemática sea idéntica.

## Revisar:

-   coordenadas X,Y,Z;
-   altura luminaria;
-   inclinación;
-   distancia al punto;
-   orientación.

## Validar plano de cálculo

Ejemplo:

DIALux:

0.85 m

Motor:

0.80 m

Puede generar diferencias importantes.

------------------------------------------------------------------------

# FASE 6

# Motor de Iluminancia

## Fundamento

Ley del inverso del cuadrado:

E = I(gamma,phi) × cos(theta) / d²

## Validación

Comparar punto por punto:

  Punto   DIALux   Motor
  ------- -------- -------
  P1               
  P2               
  P3               

No comparar solamente promedio.

------------------------------------------------------------------------

# FASE 7

# Modelo de Reflexión del Ambiente

## Objetivo

Igualar resultados totales.

## Revisar

Si el motor calcula:

Solo iluminación directa

o

Iluminación directa + reflejada.

## Mejora

Implementar:

-   reflectancia superficies;
-   rebote de luz;
-   radiosidad.

## Justificación

DIALux considera comportamiento del ambiente.

La ausencia de reflexión puede generar pérdidas del 5% al 15%.

------------------------------------------------------------------------

# FASE 8

# Uniformidad e Isolux

## Implementar

Cálculos:

Promedio:

Em = ΣE / N

Mínimo:

Emin = min(E)

Uniformidad:

U0 = Emin / Em

## Generar

-   mapa isolux;
-   curvas;
-   colores;
-   reportes.

------------------------------------------------------------------------

# FASE 9

# Motor UGR

## Objetivo

Crear cálculo sustentable de deslumbramiento.

## Inputs

Luminaria:

-   LDT.
-   Área luminosa.

Ambiente:

-   dimensiones.
-   reflectancias.

Observador:

-   posición.
-   dirección.

## Fórmula

UGR =

8 log10((0.25/Lb) × Σ(L²ω/p²))

## Validación

Comparar:

UGR DIALux

vs

UGR HYPERIUMTECH

------------------------------------------------------------------------

# FASE 10

# Motor Energético LENI

## Objetivo

Replicar consumo energético.

## Inputs

-   Tipo edificio.
-   Horas anuales.
-   Potencia instalada.
-   Ocupación.
-   Luz natural.
-   Controles.

## Outputs

-   kWh/año.
-   LENI.

## Importante

Las horas y factores energéticos no provienen del LDT.

Son parámetros externos del modelo energético.

------------------------------------------------------------------------

# FASE 11

# Reporte Técnico de Ingeniería

Cada resultado debe explicar:

Ejemplo:

Resultado:

520 lux

Debe responder:

¿De dónde salió?

Respuesta:

-   luminaria utilizada;
-   archivo LDT;
-   flujo;
-   posición;
-   ecuación;
-   parámetros del recinto;
-   cálculo aplicado.

------------------------------------------------------------------------

# FASE 12

# Arquitectura Software Final

## Frontend

React + Vite

Responsable:

-   interfaz;
-   visualización;
-   CAD;
-   reportes.

## Backend

Laravel API

Responsable:

-   usuarios;
-   proyectos;
-   permisos;
-   almacenamiento.

## Engine

Python/Rust

Responsable:

-   LDT parser;
-   fotometría;
-   cálculo;
-   UGR;
-   LENI.

------------------------------------------------------------------------

# FASE 13

# Orden de Desarrollo Recomendado

1.  Parser LDT.
2.  Modelo matemático luminaria.
3.  Interpolación fotométrica.
4.  Cálculo lux.
5.  Validación contra DIALux.
6.  Geometría completa.
7.  Reflexiones.
8.  Isolux.
9.  Uniformidad.
10. UGR.
11. Energía.
12. Render 3D.
13. Reportes profesionales.

------------------------------------------------------------------------

# Criterio de Aceptación Final

El motor será considerado validado cuando:

-   reproduzca resultados DIALux dentro de tolerancia definida;
-   cada cálculo tenga fundamento matemático;
-   exista trazabilidad completa;
-   un ingeniero pueda revisar y justificar cada resultado.
