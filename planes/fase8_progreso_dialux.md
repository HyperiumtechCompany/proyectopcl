# Fase 8 — Progreso: interreflexión iterativa

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 8 ("Interreflexión iterativa").

## Decisión de alcance

Método elegido: **radiosidad por colocación puntual con "gathering" iterativo
(Gauss-Seidel)**, sobre los MISMOS parches gruesos de la Fase 7 (un parche
por superficie completa — piso, techo, una pared por arista del polígono).
El plan pide explícitamente "refinar superficies adaptativamente" como parte
de esta fase; se decidió **no** implementarlo en este ciclo: subdividir cada
superficie en una malla más fina multiplicaría el costo O(n²) de la matriz de
factores de forma y el trabajo de esta fase (encontrar y corregir un defecto
real de divergencia, ver más abajo) ya era sustancial. Documentado como
pendiente.

También como consecuencia del modelo de datos (`CalculationMaterial`, Fase
1): la "caja Cornell simplificada" que pide el plan no puede tener paredes de
colores distintos (rojo/verde clásicos) porque `wallReflectance` es un único
escalar por recinto, no uno por pared — el test de Cornell de este ciclo usa
reflectancia uniforme y valida el comportamiento de convergencia/energía, no
la diferenciación de color por pared.

## Un defecto real de divergencia encontrado y corregido durante el desarrollo

La primera implementación reutilizó ingenuamente el límite de conservación de
energía de la Fase 7 (acotar cada transferencia individual parche→X a
`≤ π·radiancia`) también para la transferencia parche↔parche. Verificado con
un recinto cúbico de 3×3×3 m y reflectancia uniforme 0.8: el sistema
**diverge exponencialmente** (la energía total crece ~1.6× por iteración,
llegando a 6.9×10¹⁴ en 50 iteraciones) en vez de converger.

Causa: acotar cada PAR (emisor, receptor) por separado a `≤1` (como fracción)
no impide que la SUMA de esas fracciones, sobre TODOS los receptores de un
mismo emisor, exceda el 100% del flujo que ese emisor realmente tiene para
repartir — en un recinto pequeño y cerrado, varios parches cercanos pueden
cada uno aparentar (con la aproximación punto-a-parche) cubrir una fracción
grande del hemisferio del emisor. Como cada parche SÍ realimenta el sistema
en la siguiente iteración (a diferencia del "gather" a un punto de malla,
que es un sumidero y no importa para SU error se sume con otros), ese exceso
se compone geométricamente iteración tras iteración.

Corrección: `iterativeRadiosity.ts` → `computePatchFormFactorMatrix` computa
los factores de forma SIN acotar por par, pero **normaliza cada fila** (todos
los receptores de UN emisor) para que sume como máximo 1 — la técnica
estándar de radiosidad por colocación puntual para garantizar conservación
de energía sin importar cuán inexacta sea la aproximación local. Con esa
matriz row-normalizada y reflectancia `< 1`, la iteración de Gauss-Seidel
tiene garantía matemática de convergencia. Verificado: el mismo caso cúbico
0.8 ahora converge en 32 iteraciones (residual 6.5×10⁻⁷).

De paso se cambió Jacobi → Gauss-Seidel (cada parche usa la excitancia YA
actualizada de los parches anteriores en el mismo barrido): más rápido y más
estable que Jacobi puro, que en geometrías muy simétricas puede quedar
"atascado" oscilando con un residual grande en vez de decrecer (también
observado empíricamente antes de la corrección).

Este episodio queda documentado porque es exactamente el tipo de "regresión
numérica silenciosa" que el plan pide nunca ocultar (§20) — se encontró
ANTES de wire-earlo a `runDirectPreviewEngine`, con un test de energía
extrema (`0.95` de reflectancia) y el caso Cornell, no en producción.

## Segundo defecto real, encontrado por auditoría `dialux-calc-reviewer` DESPUÉS de "cerrar" la fase la primera vez

Con la divergencia ya corregida (arriba) y los 583 tests pasando, se ejecutó
el agente `dialux-calc-reviewer` como segunda verificación independiente
ANTES de dar la fase por terminada — encontró un defecto real que ningún
test detectaba: **`computePatchFormFactorMatrix` invertía el orden
patch/receptor al indexar la matriz**. El sistema seguía convergiendo de
forma estable (la normalización por fila sí evita la divergencia, sin
importar el orden), pero a una **distribución de luz interreflejada
físicamente incorrecta entre parches de áreas distintas** — el caso normal
en cualquier recinto real (piso/techo casi nunca tienen la misma área que
una pared).

Causa exacta: `computeFormFactor(patch, receiver)` (`radiosityTransfer.ts`)
devuelve `F(receiver→patch)` (fracción del hemisferio de `receiver` que
ocupa `patch`, usando el ÁREA DE `patch`). La convención de radiosidad
estándar necesita `matrix[i][j] = F(i→j)` (fracción del flujo que SALE de
`i` y llega a `j`) para la ecuación `incidente_i = Σⱼ excitancia_j · F(i→j)`.
Para obtener `F(i→j)` hay que llamar `computeFormFactor(patch=j,
receiver=i)` — la primera versión llamaba `computeFormFactor(patches[i],
patches[j])` (orden literal de los índices del bucle, intuitivo pero
invertido). Verificado numéricamente con dos parches de 100 m² y 1 m²
separados 5 m: la llamada invertida da un valor 100× menor que el correcto
para uno de los dos sentidos.

Por qué ningún test lo detectó la primera vez: todos los tests de
`iterativeRadiosity.test.ts` (convergencia, monotonía de energía,
reflectancia extrema, determinismo) siguen pasando igual con la matriz
transpuesta — verifican que el sistema es ESTABLE, no que sea CORRECTO frente
a un valor de referencia independiente. Corrección: se invirtieron los
argumentos de `computeFormFactor` en `computePatchFormFactorMatrix` y se
agregaron dos tests nuevos que si detectan esto:

1. Identidad de reciprocidad `área_i · F(i→j) == área_j · F(j→i)` sobre
   `computeFormFactor` directamente (válida siempre, por construcción de la
   fórmula — buena prueba de la función base, pero NO alcanza a probar que
   `computePatchFormFactorMatrix` la use en el orden correcto).
2. Un segundo test, más estricto, que sí lo logra: parches sintéticos MUY
   separados entre sí (100 m, para garantizar que ninguna fila se
   reescale — la normalización por fila puede "disimular" un orden de
   argumentos invertido cuando cada fila termina dividida por un factor
   distinto, como se comprobó al intentar validar con parches de un
   recinto real) y compara `matrix[i][j]` con `computeFormFactor(patches[j],
   patches[i])` usando IGUALDAD EXACTA de punto flotante (`toBe`, no una
   tolerancia). Verificado deliberadamente: este test falla con el código
   con el bug reintroducido a propósito, y pasa con la corrección.

De paso se corrigió el criterio de convergencia: usaba el residual relativo
de la ENERGÍA TOTAL del sistema (ponderada por área, dominada por los
parches grandes como piso/techo), lo que podía reportar "converged" mientras
un parche pequeño seguía cambiando de forma significativa. Ahora usa el
residual relativo MÁXIMO entre todos los parches individuales
(`computeMaxRelativeResidual`) — un criterio más estricto y honesto.

También se subió `MAX_SAFE_BOUNCES` de 100 a 300: verificado empíricamente
que reflectancias de 0.9-0.95 (comunes en acabados claros reales, no un caso
de laboratorio) necesitan 61-115 iteraciones para converger a 1e-6 con el
nuevo criterio de residual más estricto — 100 dejaba "no convergido"
precisamente ese rango. El costo extra es trivial (recintos típicos tienen
~10 parches; 300 iteraciones son ~30 000 operaciones, microsegundos).

## 1. Factor de forma compartido — `hooks/radiosityTransfer.ts`

- `computeFormFactor(patch, receiver, obstacles)`: factor de forma SIN
  acotar, punto-a-parche estándar (`área·cosθ_parche·cosθ_receptor/(π·dist²)`),
  con los mismos chequeos de coseno/oclusión de la Fase 7. Devuelve
  `F(receiver→patch)` — convención documentada extensamente en el código tras
  el defecto de indexado descrito arriba.
- `patchExitanceTransferToPoint(point, patch, exitance, obstacles)`: para
  receptores SUMIDERO (puntos de malla) — acota el factor de forma individual
  a `[0,1]` (suficiente porque el punto no realimenta el sistema). Refactor
  puro de la función de la Fase 7 (mismo resultado numérico, verificado con
  los tests existentes sin cambios).

## 2. Solver iterativo — `hooks/iterativeRadiosity.ts`

- `computePatchFormFactorMatrix(patches, obstacles)`: matriz `n×n` donde
  `matrix[i][j] = F(i→j)` (fracción del flujo que SALE de `i` y llega a `j`),
  cada fila normalizada para sumar como máximo 1 (ver corrección arriba). Se
  calcula UNA vez por llamada a `solveRadiosity` (no depende de la
  excitancia, solo de geometría/oclusión) — también es una mejora de
  rendimiento sobre recalcular geometría en cada rebote.
- `solveRadiosity(patches, directIlluminance, obstacles, maxBounces, convergenceTolerance)`:
  Gauss-Seidel hasta que el residual relativo MÁXIMO entre todos los parches
  (`computeMaxRelativeResidual`, no un agregado) caiga bajo
  `convergenceTolerance`, o se agote `maxBounces` (acotado a
  `MAX_SAFE_BOUNCES = 300` — "limitar rebotes, tiempo y memoria" — trivial en
  costo real incluso en este valor). Devuelve `exitance[]`, `iterations`,
  `residual`, `converged` y `energyPerIteration[]` ("registrar energía por
  iteración"). `maxBounces <= 1` devuelve el resultado de un único rebote sin
  iterar, IDÉNTICO al de la Fase 7 (mismo patrón no disruptivo).
- `gatherRadiosityIlluminance(point, patches, exitance, obstacles)`: "gather"
  final a un punto de malla, reutilizando `patchExitanceTransferToPoint`.

## 3. Wiring en el motor — `hooks/lightingEngineCore.ts`

`calculateLightingResult` gana un 6º parámetro opcional `iterativeConfig:
{maxBounces, convergenceTolerance} | null = null`. Sin él (default), o sin
`surfaceReflectances`, el comportamiento es idéntico al de la Fase 7 — mismo
patrón no disruptivo que todas las fases anteriores. Con él, `calculatePointByPoint`
recibe una función `reflectedIlluminance(point)` inyectada (primera reflexión
o radiosidad iterativa, según corresponda) en vez de recibir `patches`/
`patchIlluminance` directamente — así no necesita saber cuál de las dos
está corriendo.

`LightingResult` (`hooks/types.ts`) gana tres campos opcionales
(`interreflection_iterations`, `interreflection_converged`,
`interreflection_residual`), presentes solo cuando se usó radiosidad
iterativa.

## 4. Wiring de configuración — `domain/calculation/runDirectPreviewEngine.ts`

- `config.interreflection === 'iterative'` ahora activa radiosidad real
  (antes de esta fase, advertía "no implementado" y calculaba solo directo).
- `config.maxBounces <= 1` con `'iterative'`: warning
  `interreflection-maxBounces-too-low` — pedir "iterativo" sin permitir más
  de un rebote es indistinguible de `'first-bounce'`, y el plan pide no
  ocultar ese hecho.
- Si un objeto no converge dentro de `maxBounces`: warning
  `interreflection-not-converged` con la cantidad de iteraciones y el
  residual — el resultado se usa igual (truncado), pero nunca se presenta
  como "convergido" cuando no lo está.
- Sin material/reflectancias: mismo warning `object-without-material-reflectance`
  de la Fase 7 (mensaje ajustado según el modo).

## Verificación

- `vitest run`: 587/587, sin ninguna variación en los goldens/suite analítica
  de Fases 0/5/6/7. Detalle de tests nuevos de esta fase: 14 en
  `iterativeRadiosity.test.ts` (incluye los 2 de reciprocidad que detectan el
  segundo defecto y el de reflectancia=1.0) + 5 en
  `lightingEngineCore.iterativeRadiosity.test.ts` + 4 en
  `runDirectPreviewEngine.test.ts` (reemplazando el test obsoleto de Fase 7
  que asumía `'iterative'` como no implementado) + 2 en
  `photometricInterpolation.test.ts` (heredados de la corrección de la Fase 7).
- Casos requeridos por el plan, todos cubiertos en `iterativeRadiosity.test.ts`:
  caja Cornell simplificada (reflectancia uniforme, ver limitación del modelo
  de datos arriba), conservación energética (recinto angosto, Fase 7;
  divergencia detectada y corregida, esta fase), reflectancia extrema (0.95 y
  1.0, converge o reporta `converged:false` de forma segura, sin NaN/Infinity),
  recinto pequeño y grande, convergencia reproducible (determinismo verificado
  con dos corridas idénticas).
- **Dos rondas de auditoría `dialux-calc-reviewer`** sobre esta fase: la
  primera (antes de cualquier wiring) encontró el bug de indexado transpuesto
  descrito arriba; ambas rondas completadas con hallazgos corregidos antes de
  declarar la fase terminada — ningún hallazgo bloqueante quedó pendiente sin
  resolver.
- `tsc --noEmit`: sin errores nuevos en ningún archivo de esta fase
  (verificado filtrando el diff completo por los archivos tocados — el
  conteo total de errores del proyecto cambió por trabajo NO relacionado de
  otra sesión en curso sobre `spatt-pararrayos`/`canvas`, confirmado con
  `git stash` de solo los archivos de esta fase).
- ESLint: limpio en todos los archivos tocados/creados de esta fase (los 16
  errores de `no-irregular-whitespace` en `hooks/types.ts` son mojibake
  preexistente en líneas no tocadas por esta fase, confirmado con
  `git stash`).
- `npm run build`: OK.
- `fileSizeBudget.test.ts`: pasa — `lightingEngineCore.ts` quedó en 330
  líneas, `iterativeRadiosity.ts` en 219, `radiosityTransfer.ts` en 74,
  todos muy por debajo del presupuesto de 400 líneas para servicios de
  dominio.

## Pendientes (fuera de alcance de este ciclo)

- **Ningún camino de exportación/UI activa todavía oclusión, primera
  reflexión NI radiosidad iterativa** (Fases 6/7/8 completas) — señalado
  explícitamente por la segunda auditoría: `export/snapshot/buildDialuxExportSnapshot.ts`,
  `export/useDialuxPdfExport.ts` y `hooks/useLightingEngine.ts` (el hook del
  panel en vivo) llaman `calculateLightingResult` solo con `(room, fixtures)`
  — ningún PDF, informe formal, ni cálculo que el usuario vea hoy incluye
  interreflexión de ningún tipo. Es el mismo patrón de pendiente ya
  documentado en cada fase desde la 6 ("motor listo, UI no cableada, decisión
  de producto"), pero se marca aquí con más énfasis porque acumula tres fases
  de motor completo sin ningún punto de entrada real activado — cablear al
  menos UN camino (probablemente el panel en vivo, vía `useLightingEngine.ts`)
  debería ser el primer paso de cualquier fase de producto futura sobre esto.
- **Reflectancia = 1.0** (permitida por `clampReflectance`, Fase 7) no tiene
  garantía de convergencia (ningún parche absorbe nada; ver test dedicado en
  `iterativeRadiosity.test.ts`) — comportamiento seguro (`converged:false`,
  valores finitos) pero documentado como caso límite físicamente válido sin
  punto fijo, no un defecto a corregir en el solver.
- **Sin refinamiento adaptativo de superficies** — un parche por superficie
  completa, igual que la Fase 7. El plan lo pide explícitamente para esta
  fase; se documentó como decisión de alcance arriba, dado el trabajo real
  de esta fase (encontrar y corregir la divergencia). Subdividir
  superficies mejoraría la precisión geométrica de los factores de forma en
  recintos con geometría compleja, a costa de O(n²) más caro.
- **`CalculationMaterial` sigue sin reflectancia por pared individual** — la
  caja Cornell real (paredes de colores distintos) sigue sin ser
  representable; heredado de la Fase 1, no es defecto de esta fase.
- **`config.interreflection`/`maxBounces`/`convergenceTolerance` no están
  expuestos en ninguna UI todavía** — mismo patrón de pendiente que
  `config.occlusion` (Fase 6) y `interreflection: 'first-bounce'` (Fase 7):
  el motor está listo, cablear un selector de calidad en la UI es decisión
  de producto (relacionado con la "escalera de calidad" del plan §9), no de
  este ciclo de motor.
- **`energyPerIteration` no se propaga fuera de `solveRadiosity`** — se
  registra (plan: "registrar energía por iteración") pero no se expone en
  `LightingResult`/`CalculationRun`; solo `iterations`/`converged`/`residual`
  (un resumen) llegan hasta ahí. Exponer el detalle completo por iteración a
  la UI es trabajo de la Fase 11 ("Resultados profesionales" — trazabilidad
  completa), no de esta.
- **El benchmark de interiores formal** ("cumple el benchmark de interiores
  definido", puerta de salida del plan) no está formalizado como suite de
  benchmark separada en este ciclo — la verificación se apoyó en los tests
  analíticos/de convergencia arriba. Formalizar un benchmark de rendimiento
  encaja mejor con la Fase 12 ("Rendimiento: Worker y WASM"), que ya lo pide
  explícitamente.
