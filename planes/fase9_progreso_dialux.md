# Fase 9 — Progreso: UGR y luminancia profesional

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 9 ("UGR y luminancia profesional").

## Decisión de alcance: el índice de posición de Guth queda `pending-confirmation`

El índice de posición de Guth (factor `p` en la fórmula UGR) es una curva
empírica (Luckiesh & Guth, 1949; Guth, 1963), no una fórmula derivable de
primeros principios. DIALux evo documenta usar una tabla de interpolación
(coordenadas R, T, H respecto al observador), no una ecuación cerrada. Existe
una aproximación analítica muy citada en software de iluminación, pero no fue
posible verificar sus coeficientes numéricos letra por letra contra CIE
117-1995 ("Discomfort Glare in Interior Lighting") primario con las
herramientas de búsqueda disponibles en esta sesión.

**Decisión, confirmada con el usuario antes de escribir código**: implementar
la aproximación analítica de todos modos, marcada explícitamente
`pending-confirmation` en `hooks/glareCalculation.ts` — mismo patrón que ya
usa la skill `normativa-dialux` para valores normativos sin verificar. UGR
con observadores de Guth queda **funcional pero NO se declara "validado"** en
la matriz de paridad del plan (§23) hasta que un especialista confirme los
coeficientes contra la fuente primaria.

Verificado y citable (documentación de soporte de DIALux evo, artículo "UGR
Verfahren - Unified Glare Rating"):
- Altura de ojo estándar del observador: 1.2 m.
- `Lb = Eind/π` (`Eind` = iluminancia indirecta en el ojo del observador).
- Exclusión de luminarias con H/R > 2 (fuera del rango de validez de la
  tabla).

## Camino nuevo, opcional — el `calculateUGR` heredado NO cambia

`calculateLightingResult` gana un 7º parámetro opcional `glareConfig`. Sin él
(default `null`), el UGR se calcula EXACTAMENTE como antes de esta fase
(`calculateUGR`, observador único implícito en el centro del recinto, sin
índice de posición, `Lb = avg/π`) — no se tocan los goldens de Fase 0. Con
`glareConfig` (aunque sea `{}`), se activa el camino nuevo con observadores
reales. Mismo patrón no disruptivo usado en cada fase desde la 5.

## 1. Observadores — `hooks/glareObserver.ts`

`GlareObserver {x, y, eyeHeight, viewDirectionDeg}`. `buildDefaultObservers(room)`
genera un observador en el centroide del recinto, evaluado en las 4
direcciones cardinales de vista (0°/90°/180°/270°) — mismo criterio que las
tablas UGR normativas, que reportan el peor caso entre direcciones
principales de vista, no una sola dirección arbitraria.

## 2. Solver de UGR — `hooks/glareCalculation.ts`

`evaluateUGR(observers, fixtures, obstacles, computeBackgroundLuminance)`
evalúa cada observador y reporta el UGR MÁXIMO + cuál observador lo produjo
(plan §11: "reportar máximo y ubicación"). Exclusiones documentadas
("condiciones donde UGR no aplica", plan §11 Fase 9):

- **Campo visual inferior** (`dz <= 0`, fuente a la altura del ojo o por
  debajo): el índice de posición de Guth solo está definido en el campo
  visual superior.
- **H/R > 2**: fuera del rango de validez de la tabla (documentado por
  DIALux evo).
- **Fuera del hemisferio frontal** (`sigma > 90°`, ej. fuente detrás del
  observador): ver el defecto encontrado y corregido más abajo.
- **Oclusión**: reutiliza el mismo `isSegmentOccluded` de la Fase 6 (no
  cuenta como "excluida por rango", es un motivo distinto).

## 3. Wiring — `hooks/lightingEngineCore.ts` / `domain/calculation/`

- `calculateLightingResult(..., glareConfig)`: con `glareConfig`, la
  luminancia de fondo se calcula POR OBSERVADOR como `Eind/π`, reutilizando
  el mismo `reflectedIlluminance` de las Fases 7/8 (primera reflexión o
  radiosidad iterativa) evaluado en un plano vertical con normal = dirección
  de vista — sin datos de interreflexión activos (`Eind<=0`), cae al mismo
  `avg/π` que el motor usa desde la Fase 0 (nunca deja `Lb` en 0).
- `LightingResult` gana `ugr_observer_x/y/eye_height/view_direction_deg` y
  `ugr_excluded_fixture_count` — presentes solo con el camino nuevo.
- `CalculationConfig.glare` gana `observerModel: 'legacy' | 'guth-observers'`
  (default `'legacy'`, no disruptivo).
- `luminousArea` se movió de `lightingEngineCore.ts` a `directIlluminance.ts`
  (mismo cuerpo, para que `glareCalculation.ts` pueda importarla sin crear un
  ciclo de módulos).

## Auditoría `dialux-calc-reviewer` y correcciones

### Encontrado por el propio autor al escribir los tests (antes de la auditoría)

La aproximación polinómica de Guth, evaluada con una fuente fuera del campo
visual frontal (ej. `tau=180°, sigma≈169°`, una luminaria detrás del
observador), produce un **exponente negativo** — el índice de posición
COLAPSA hacia 0 en vez de crecer, lo que **amplifica** absurdamente la
contribución de una fuente invisible en vez de descartarla (verificado: un
UGR que debía ser 0, por una luminaria fuera de la vista, salía positivo y
mayor que el de la luminaria SÍ visible). Corregido excluyendo fuentes con
`sigma > 90°` — a la vez la corrección del artefacto Y la condición
físicamente correcta (una luminaria detrás de la cabeza no puede deslumbrar
por visión directa). Test de regresión dedicado en `glareCalculation.test.ts`.

### Encontrado por la auditoría

1. **Decaimiento `cos³γ` en vez de `cosγ` (bloqueante)**. El ángulo sólido
   aparente (`ω = A·cosγ/d²`, correcto, "implementar ángulo sólido aparente")
   se multiplicaba por una "luminancia" (`candela(γ)/área`) que YA decae como
   `cosγ` (el modelo Lambertiano de `candela()` es `I₀·cosγ`) — el producto
   neto decaía como `cos³γ` en vez del `cosγ` físicamente correcto para una
   fuente Lambertiana (verificado numéricamente por la auditoría: a `γ=60°`
   el término calculado era solo el 25% del valor físico esperado). Este
   defecto YA EXISTÍA parcialmente en el `calculateUGR` heredado (que
   tampoco escorzaba la luminancia, aunque sin el ángulo sólido aparente
   correcto encima) — el heredado queda sin tocar (congelado, Fase 0);
   corregido solo en el camino nuevo: la luminancia ahora divide por el ÁREA
   PROYECTADA (`área·cosγ`, no el área plana), reproduciendo el decaimiento
   `cosγ` correcto en el producto `L²ω`.
2. **Cambio de método de `Lb` sin aviso al activar interreflexión (bloqueante)**.
   Activar `surfaceReflectances` junto con `guth-observers` cambia el MÉTODO
   de `Lb` por completo (de `avg/π` a `Eind/π`), casi siempre un valor mucho
   más chico — la auditoría verificó con un ejemplo concreto que esto puede
   subir el UGR reportado ~8-9 unidades sin que el diseño haya cambiado
   (riesgo real: un aula conforme podría "volverse" no conforme solo por
   activar interreflexión). Corregido: `runDirectPreviewEngine.ts` emite el
   warning `ugr-background-luminance-method-changed` cuando ambas
   condiciones están activas a la vez.

### Confirmado sin defecto adicional

- El polinomio de Guth es monótono y bien comportado en todo `[0°,90°]×[0°,90°]`
  (verificado numéricamente por la auditoría, ~16 000 muestras) — la
  exclusión `sigma>90°` basta para el defecto de colapso encontrado; no hay
  otra zona de no-monotonicidad dentro del rango aceptado.
- La convención `tau`/`sigma` es la estándar de esta familia de fórmulas
  (verificado: `cos σ = cos θᵥ · cos τ` se cumple exactamente, implica
  `τ ≤ σ` siempre, consistente con Guth/CIE).
- La regla H/R>2 usa la definición correcta (`H` = diferencia de altura
  fuente-ojo, `R` = distancia horizontal), consistente con DIALux evo.
- No hay ninguna ruta que produzca NaN/negativo sin cubrir por las guardas
  actuales (verificado analítica y numéricamente).

## Verificación

- `vitest run`: 616/616, sin ninguna variación en los goldens/suite
  analítica de Fases 0/5/6/7/8. Tests nuevos: 3 `glareObserver.test.ts` +
  11 `glareCalculation.test.ts` (incluye el caso de regresión de `sigma>90°`)
  + 4 `lightingEngineCore.glareObservers.test.ts` + 4 en
  `runDirectPreviewEngine.test.ts` (incluye los 2 del warning de cambio de
  método de `Lb`).
- `tsc --noEmit`: sin errores nuevos en ningún archivo de esta fase.
- ESLint: limpio en todos los archivos tocados/creados — `glareObserver.ts`/
  `glareCalculation.ts` agregados al alcance de pureza de dominio en
  `eslint.config.js` (que de paso corrigió una omisión de la Fase 8:
  `iterativeRadiosity.ts`/`radiosityTransfer.ts` nunca se habían agregado a
  esa lista).
- `npm run build`: OK.
- `fileSizeBudget.test.ts`: pasa — `lightingEngineCore.ts` quedó en 381
  líneas (cerca del presupuesto de 400, ver pendiente abajo),
  `glareCalculation.ts` en ~210, `glareObserver.ts` en 55.

## Pendientes (fuera de alcance de este ciclo)

- **Ningún camino de exportación/UI activa `observerModel: 'guth-observers'`
  todavía** — mismo patrón de pendiente que oclusión (Fase 6), primera
  reflexión (Fase 7) e interreflexión iterativa (Fase 8): el motor está
  listo, solo `runDirectPreviewEngine.ts` lo cablea vía `CalculationConfig`,
  ningún export/PDF/panel en vivo lo usa aún.
- **Solo se muestrea el centroide del recinto** (en 4 direcciones), no una
  grilla de posiciones — señalado por la auditoría: el máximo real de la
  sala (cerca de una pared o luminaria específica) puede no coincidir con el
  centroide. `glareConfig.observers` ya permite pasar observadores
  personalizados para cuando se necesite una grilla más fina; no se generó
  una por defecto en este ciclo.
- **La procedencia (heredado vs. Guth-observers) no se propaga a
  `DialuxAmbientMetrics.provenance`** (`export/snapshot/buildDialuxExportSnapshot.ts`)
  — señalado por la auditoría; irrelevante hoy porque esa ruta no activa el
  camino nuevo, pero se volverá relevante en cuanto se cablee un export real.
- **`uniformityTarget ?? 0.4` / `ugrLimit ?? 22` sin fuente normativa citada**
  en `buildDialuxExportSnapshot.ts` — preexistente, no de esta fase (mismo
  hallazgo recurrente del checklist estándar del agente revisor).
- **`lightingEngineCore.ts` cerca del presupuesto de tamaño** (381/400
  líneas) — no se justificó una extracción adicional en este ciclo (el
  archivo sigue siendo cohesivo: orquesta grid + reflexión + UGR, todas
  responsabilidades del "único motor"), pero la próxima fase que le agregue
  código debería considerar extraer el bloque de wiring de UGR a su propia
  función.
- **Validez empírica del polinomio de Guth más allá de ~60°** — la
  literatura que documenta esta familia de fórmulas suele acotar su rango
  empíricamente respaldado a `~0-60°`, no los `90°` usados como corte de
  exclusión en este ciclo; valores en `(60°,90°]` son una extrapolación
  suave del polinomio, no una zona empíricamente validada. Relacionado con
  el estado `pending-confirmation` general del índice de posición.
