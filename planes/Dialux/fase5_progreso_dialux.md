# Fase 5 — Progreso: solver directo validado

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 5 ("Consolidar el cálculo directo antes de agregar reflexiones").

## Alcance de este ciclo (acordado con el usuario, 2026-08-02)

1. Extraer interpolación fotométrica a su propio módulo.
2. Parametrizar la malla (conectar `meshPolicy.gridSpacingM`, hasta ahora
   metadata sin efecto, al motor real).
3. Suite de validación analítica (§10.1/§10.3/§14.5 del plan).

Dos hallazgos de la investigación previa se dejaron **explícitamente sin
tocar**, por decisión del usuario:

- **"Incorporar regulación y escena"**: `LightingSceneState` (Fase 1) existe
  pero siempre se construye con `on:true, dimmingFactor:1` para todas las
  luminarias, y `runDirectPreviewEngine` ni siquiera lo lee. No se
  implementó porque no existe ninguna UI hoy que pueda producir un estado
  distinto (eso es Fase 10, "Escenas luminosas y controles") — cablear la
  lectura ahora sería preparar una capacidad que nadie puede activar
  todavía.
- **"Eliminar uniformidad estimada de resultados finales"**: confirmado que
  `ResultsPanel.tsx` muestra `estimatedUniformity` (heurística basada solo
  en cantidad de luminarias, sin usar la malla real) en la misma fila que
  `uniformity` real, con etiquetas distintas ("Uo" vs "Uniformidad est.")
  pero pudiendo confundirse. No se tocó porque es un cambio de UI visible
  que no se puede verificar en este entorno (sin navegador headless);
  documentado como hallazgo concreto para que el equipo decida.

## 1. Extracción de interpolación fotométrica

`interpolate1D`, `foldAzimuthToCRange`, `candelaFromPhotometricWeb` y
`candela` se movieron de `lightingEngineCore.ts` a un módulo nuevo,
`hooks/photometricInterpolation.ts` (135 líneas), sin cambiar ninguna
fórmula. `lightingEngineCore.ts` bajó de 398 a 285 líneas.

## 2. Malla parametrizada

`calculateLightingResult(room, fixtures, spacingM = GRID_SPACING)` acepta
ahora un tercer argumento opcional; con el valor por defecto el resultado
es idéntico al de siempre (verificado con los goldens de Fase 0).
`runDirectPreviewEngine` ahora pasa `config.meshPolicy.gridSpacingM` —
antes ese campo de `CalculationConfig` (Fase 1) era puro metadata de
trazabilidad sin ningún efecto real sobre el cálculo. Test nuevo
(`runDirectPreviewEngine.test.ts`) verifica que una malla más gruesa
produce menos celdas Y un resultado agregado distinto (no es un
passthrough sin efecto).

Esto desbloquea, en fases futuras, los modos "estándar"/"alta precisión"
del plan (§9), que necesitan poder pedir una malla más fina sin tocar
código.

## 3. Suite de validación analítica — nuevo, `hooks/lightingEngineCore.analytic.test.ts`

El golden de Fase 0 documentaba explícitamente que congelar el resultado
actual "no es una afirmación de que estos valores sean correctos frente a
una referencia externa (eso es trabajo de Fase 5/10)" — esta suite es esa
referencia. 5 casos con solución cerrada, verificados contra la API pública
(`calculateLightingResult`), sin exportar ninguna función interna del motor
solo para probarla — el truco es un recinto de exactamente
`GRID_SPACING × GRID_SPACING` metros, que por construcción de `buildGrid`
produce una malla de 1×1 con un único punto en su centro, dando control
total sobre la posición del punto de cálculo:

1. Fuente puntual directamente sobre el punto → `E = I₀/h²` (ley del
   inverso del cuadrado, incidencia normal). Tolerancia ±0.5% (plan §10.3).
2. Fuente puntual fuera de eje → `E = I₀·cos²(γ)/d²` (Lambert + inverso del
   cuadrado combinadas, mismo ángulo γ para emisión e incidencia porque el
   eje del proyector apunta al nadir y la superficie receptora es
   horizontal). Tolerancia ±0.5%.
3. Duplicar la distancia vertical reduce la iluminancia a un cuarto.
4. Duplicar luminarias idénticas duplica la contribución (superposición
   lineal, exacto a 9 decimales — es la misma suma, no una aproximación).
5. Rotar una luminaria Lambertiana no cambia el resultado (el modelo no
   depende de azimut — invariante exacto).

Los 5 casos pasan **al primer intento**, sin necesidad de ajustar ninguna
fórmula del motor — confirma que el cálculo directo actual (`direct-preview-v1`)
ya es correcto frente a las referencias analíticas del plan, no solo
autoconsistente. Esto satisface la puerta de salida de la Fase 5 ("todos
los casos directos analíticos cumplen las tolerancias aprobadas") para los
casos que tienen solución cerrada conocida.

## Verificación

- `vitest run`: 512/512 (506 previos + 6 nuevos: 5 analíticos + 1 de malla
  parametrizada), incluyendo los goldens de Fase 0/1 sin ninguna variación.
- `tsc --noEmit`: sin cambio (123 preexistentes).
- ESLint: limpio en todos los archivos tocados.
- `npm run build`: OK.
- `fileSizeBudget.test.ts`: pasa; ambos archivos del motor quedan bajo 400
  líneas sin necesitar allowlist.

## Pendientes (fuera de alcance de este ciclo)

- **Regulación/escena real**: cablear `LightingSceneState` al motor —
  retomar junto con Fase 10 (UI de escenas), no antes.
- **Uniformidad estimada en `ResultsPanel.tsx`**: hallazgo documentado, sin
  tocar (requiere decisión de UX + verificación visual que no es posible en
  este entorno).
- **Sumatoria numérica compensada** (Kahan/Neumaier): evaluado, de bajo
  impacto práctico con los volúmenes actuales de luminarias por ambiente
  (máximo 10 en las fixtures existentes) — no implementado, no justificado
  todavía por ningún caso real.
- **Orientación 3D completa (pitch/roll)**: sigue sin existir (ya
  documentado en Fase 3/4) — bloquea proyectores inclinados y wall-washers,
  dos de los 6 casos de prueba nombrados por el plan para esta fase.
- Comparación contra DIALux evo con proyectos de referencia reales: no
  realizada (no hay ningún proyecto de referencia ni archivo de fabricante
  real en el repo, ya documentado en Fase 3).
