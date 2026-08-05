# Fase 18 — Progreso: Exteriores, vial y luz intrusiva

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 18.

## Estado: DIFERIDA explícitamente, no implementada

A pedido directo del usuario tras cerrar la Fase 17, se salta la Fase 18 y
se continúa con la Fase 19 (BIM/IFC). Se documenta este ciclo como
explícitamente diferido, no como completado ni como olvidado — mismo
criterio de trazabilidad usado en cada fase anterior para el trabajo fuera
de alcance.

## Por qué es razonable diferirla ahora

El propio plan maestro exige para esta fase: "Dividir en productos internos
independientes: Exteriores generales, Carreteras, Luz intrusiva. Cada uno
requiere objetos, normas, resultados y benchmarks propios. No reutilizar
forzadamente reglas de interiores." Es decir, el plan mismo trata la Fase
18 como tres iniciativas separadas y grandes (no una sola pieza acotable
como se hizo con la Fase 16/17), cada una con su propia normativa
(iluminación vial tiene normas propias — CIE 115, RNTC/manuales de
carreteras — distintas de EN 12464-1/RNE EM.010 usadas hasta ahora) y sus
propios objetos de dominio (postes, luminarias viales con fotometría tipo
IES de vía, curvas de deslumbramiento intrusivo). No comparte solver ni
geometría con el motor interior actual de forma directa, a diferencia de
la Fase 17 (que sí pudo reutilizar el 80% de los primitivos de parches/
factor de forma ya construidos).

## Pendiente para cuando se retome

- **Exteriores generales**: iluminación de fachadas, patios, estacionamientos
  al aire libre — probablemente el subconjunto más cercano a reutilizar el
  motor actual (point-by-point ya funciona sin techo, la malla y
  `calculateLightingResult` no asumen un recinto cerrado salvo por el uso
  de `room.height` en algunos cálculos de plano útil — habría que revisar).
- **Carreteras**: requiere clases normativas de vía (ME/CE de EN 13201 o
  equivalente RNE), métricas propias (luminancia de calzada, no solo
  iluminancia — un cambio de magnitud física, no solo de norma) y objetos
  nuevos (postes con brazo/altura/inclinación, geometría de vía).
- **Luz intrusiva**: métrica completamente distinta (luz molesta hacia
  ventanas vecinas / cielo nocturno — ULR, glare index de exteriores),
  ninguna infraestructura reutilizable del motor interior actual.
- Ninguno de los tres tiene todavía objetos de dominio, normativa cargada,
  ni UI en este código base — partirán de cero cuando se retomen.

## Verificación

No aplica — no se modificó ningún archivo de código en este ciclo.
