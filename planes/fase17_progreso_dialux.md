# Fase 17 — Progreso: Luz natural (Daylight Factor, primer ciclo)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 17.

## Contexto y decisión de alcance

La Fase 17 ("Luz natural") tiene 9 líneas de trabajo interdependientes:
ubicación/norte, fecha/hora/zona horaria, modelo de cielo, ventanas/
transmisión, sombras exteriores, lucernarios, daylight factor, autonomía
anual, integración con control artificial. El usuario eligió un primer
ciclo acotado ("MVP con resultado").

**Corrección de alcance durante la investigación**: se planteó inicialmente
un Daylight Factor "para un instante dado" (con ubicación/norte/fecha/hora).
Consultando a `chief-electrical-engineer-reviewer` se confirmó que el
Daylight Factor clásico (BRE, citado por EN 17037 como método simplificado)
se calcula bajo el **CIE Standard Overcast Sky** — luminancia azimutalmente
simétrica, función solo del ángulo cenital (Moon-Spencer,
`L_θ/L_z = (1+2cosθ)/3`) — y por eso **no depende de fecha, hora ni norte
del edificio**. Esos datos solo son necesarios para *Climate-Based Daylight
Modelling* (autonomía anual), fuera de este ciclo. Se ajustó el alcance con
el usuario a: **solo el Daylight Factor real** (ventanas + transmitancia +
cielo cubierto + reflectancias de la Fase 16), sin ubicación/norte/
fecha-hora/cielo despejado.

## Arquitectura: motor paralelo, no una extensión de `lightingEngineCore.ts`

La radiancia del cielo cubierto es **anisotrópica** (varía fuertemente con
el ángulo cenital) — física distinta a un parche Lambertiano de reflexión
(radiancia constante en toda dirección), que ya asume
`radiosityTransfer.ts::computeFormFactor`. Se construyó un motor PARALELO,
reutilizando los primitivos de bajo nivel sin tocarlos ni integrarlos a
`CalculationConfig`/`runProjectLightingCalculation` — mismo patrón que
`export/derived/data/computeEngineUgrTable.ts` (Fase 15).

### Módulos nuevos (`hooks/`)

- **`cieOvercastSky.ts`**: `overcastSkyRelativeLuminance(zenithAngleRad)` —
  Moon-Spencer normalizado (`L_zenit = 1`; el DF es un cociente, así que la
  escala absoluta se cancela). `pending-confirmation` sobre el texto
  primario CIE 110-2016 (fórmula ampliamente citada en literatura
  secundaria, no verificada letra por letra).
- **`windowSkyAperture.ts`**: ubica una `Window` en el mundo (misma
  matemática que `domain/geometry/occlusionBoxes.ts`) y la subdivide en una
  grilla fina de sub-aberturas — necesario porque la aproximación de campo
  lejano de `computeFormFactor` se rompe cerca de una ventana grande.
  `resolveWindowMidpointWorld` expuesto para el filtro de pertenencia
  ventana↔recinto (ver bug corregido más abajo).
- **`skyIlluminance.ts`**: `skyIlluminanceAtSurfacePoint` — misma forma
  geométrica que `computeFormFactor` (área·cosPatch·cosReceptor/dist²) pero
  **sin el factor `/π`**: ese factor convierte una excitancia Lambertiana en
  iluminancia transferida; aquí `L(θ)` ya es una radiancia y la fórmula
  estándar radiancia→iluminancia no lo lleva. Verificado con el test
  dorado (ver Verificación).
- **`skyReferenceIlluminance.ts`**: iluminancia horizontal exterior de
  referencia (denominador del DF), calculada integrando numéricamente el
  hemisferio celeste completo con la MISMA función `skyIlluminanceAtSurfacePoint`
  (parches sobre una esfera grande, normal radial hacia el origen) — así un
  eventual error de escala en la fórmula se cancela automáticamente en el
  cociente del DF, en vez de usar una constante cerrada aparte.
- **`daylightFactorEngine.ts`**: orquesta `DF = (SC + IRC) / E_ref × 100`
  por punto de malla (reutiliza `buildGrid`/`roomBBox`, ahora exportados
  desde `lightingEngineCore.ts` sin cambiar su comportamiento). IRC se
  calcula inyectando la iluminancia de cielo como "directa" sobre
  `buildRoomEnclosurePatches` (Fase 7/16) y reutilizando
  `firstBounceIlluminance` tal cual — más riguroso que la fórmula promedio
  de BRE Digest 310 (motor propio, no una reproducción del nomograma BRE).
  **ERC = 0 siempre**, documentado explícitamente en `notes` (sin geometría
  de obstrucción exterior modelada todavía — cota inferior conservadora,
  nunca un falso "cumple").
- **`glazingData.ts`**: catálogo de 5 presets de transmitancia de vidrio.

### Bug real detectado y corregido durante la implementación

`resolveWindows` (dentro de `daylightFactorEngine.ts`) inicialmente
aceptaba cualquier ventana cuyo `wallId` existiera en el array `walls`
pasado por el llamador — sin verificar que ese muro estuviera realmente en
el límite del `Room` para el que se calcula. Como el panel pasa
`scene.walls`/`scene.windows` completos (todos los recintos del nivel), una
ventana del OTRO extremo de la escena habría aportado luz natural
incorrectamente. Corregido verificando `distanceToPolygonEdge(midpoint,
room.vertices) <= 1.0m` (tolerancia documentada: `walls`/`rooms` son
entidades dibujadas por separado en este editor, no una se deriva de la
otra). Test de regresión: `daylightFactorEngine.test.ts` — "ignora una
ventana en el muro de OTRO recinto de la misma escena".

### Datos y UI nuevos

- **`hooks/types.ts::Window.glazingTransmittance?: number | null`** —
  mismo patrón opcional/no-fabricado que `Room.ceilingReflectance` (Fase
  16): sin asignar, la ventana no aporta luz natural.
- **`hooks/glazingData.ts`**: 5 presets (simple claro, doble/DVH claro,
  laminado claro, control solar low-E, tintado). **Trazabilidad** (revisado
  con `chief-electrical-engineer-reviewer`): EN 410:2011 e ISO 9050:2003
  solo definen el MÉTODO de medición de transmitancia — no tabulan valores
  típicos por categoría genérica de vidrio. Por eso los 5 valores quedan
  como `source: 'estimación no normativa'` (rango de literatura técnica de
  industria), citando EN 410/ISO 9050 solo como método, nunca como origen
  del número.
- **`components/properties/OpeningProps.tsx::WindowProps`**: nuevo selector
  "Vidrio" (presets + "Personalizado"), mismo patrón que
  `RoomSurfaceMaterialsSection.tsx` (Fase 16).
- **`components/toolbar/panels/LuzNaturalPanel.tsx`** (nuevo): botón
  "Calcular Daylight Factor" bajo demanda (sin persistir en el store ni en
  `CalculationConfig`, mismo patrón que `EmergenciaPanel.tsx`), resultados
  avg/min/max por ambiente, disclaimer de ERC siempre visible. Registrado
  en `Toolbar.tsx`/`PanelId` (botón "Sol", ícono `Sun`).

## Bug real encontrado en verificación manual del usuario (post-entrega)

El usuario abrió el panel en el editor real (proyecto "Vinchos") y confirmó
que la UI renderiza correctamente, pero **el botón "Calcular Daylight
Factor" no mostraba ningún resultado** — el panel era visible pero
inutilizable. Causa raíz: `LuzNaturalPanel.tsx` filtraba
`scene.rooms` por `room.roomType === 'ambient'`, copiando sin verificar la
convención usada en los fixtures de test de `daylightFactorEngine.test.ts`.
Verificado contra datos reales (`php artisan tinker` sobre el proyecto
"Vinchos"): los recintos físicos reales usan `roomType: 'room'` (o el campo
vacío) — `'ambient'`/`'corridor'` son subdivisiones normativas DERIVADAS
del mismo recinto (`ambientSpaces.ts`), nunca entidades separadas en
`scene.rooms`. El filtro original excluía TODOS los recintos reales de
CUALQUIER proyecto — el panel nunca podía mostrar nada.

Corregido replicando exactamente el criterio ya usado en
`RoomProps.tsx:42` (`isRecinto = !room.roomType || room.roomType === 'room'`)
— el mismo tipo de recinto donde ya se asignan reflectancias (Fase 16).
Este bug NO fue detectado por la suite de tests porque el filtrado por
`roomType` vive en el componente de UI (`LuzNaturalPanel.tsx`), una capa sin
tests en este proyecto (consistente con la convención existente de probar
solo lógica de dominio, no componentes React) — el motor
`daylightFactorEngine.ts` en sí siempre estuvo correcto y probado. Lección:
verificar convenciones de datos reales (`php artisan tinker`) en vez de
asumir que un valor usado en un fixture de test es el que usa la UI real.

## Verificación

- **Test dorado de auto-consistencia** (`skyReferenceIlluminance.test.ts`):
  la integración numérica del hemisferio completo sin obstrucción converge
  al resultado analítico conocido `E = 7π/9 · L_zenit` (Moon & Spencer,
  1942) — confirma que la fórmula de `skyIlluminance.ts` (sin `/π`) es
  dimensionalmente correcta, antes de construir nada más sobre ella.
- **Sanity física** (`daylightFactorEngine.test.ts`): para una ventana de
  2×1.2 m en un recinto de 4×4×2.8 m, avg DF ≈ 5.96%, min ≈ 0.46%, max ≈
  39.88% junto al vidrio — valores plausibles frente a referencias
  publicadas de DF típico (órdenes de magnitud correctos, decae con la
  distancia a la ventana, escala linealmente con la transmitancia).
- `npx vitest run resources/js/pages/dialux`: 738/738 (35 tests nuevos:
  `cieOvercastSky`, `windowSkyAperture`, `skyIlluminance`,
  `skyReferenceIlluminance`, `daylightFactorEngine`, `glazingData`).
- `tsc --noEmit -p .`: sin errores en ningún archivo nuevo/tocado de esta
  fase (confirmado filtrando la salida).
- `npm run build`: OK.
- `fileSizeBudget.test.ts`: sin nuevas violaciones.
- **Verificado en navegador por el usuario** contra el editor real
  (proyecto "Vinchos") — confirmó que el panel renderiza correctamente
  (título, descripción, botón, disclaimer de ERC), y detectó el bug de
  `roomType` de arriba, ya corregido y reverificado (`vitest`/`tsc` limpios
  tras el fix). Pendiente: una segunda pasada del usuario confirmando que
  el flujo completo (asignar vidrio + material → calcular → ver resultado)
  ya funciona con el filtro corregido.

## Pendientes (fuera de alcance, documentado explícitamente)

- Ubicación/norte del proyecto, fecha/hora/zona horaria, modelo de cielo
  despejado, posición solar, sombras exteriores, lucernarios, autonomía
  anual (CBDM/DA/sDA/UDI), integración con control artificial — pertenecen
  al ciclo de autonomía anual posterior.
- **ERC (componente reflejada externa) real** — depende de geometría de
  obstrucción/terreno exterior, pendiente de la fase de "sombras
  exteriores". Hoy siempre 0 (cota inferior conservadora, declarada).
- **Normal de ventana en recintos cóncavos (L/U/T)**: `resolveInwardNormal`
  usa el centroide del recinto para decidir el signo de la normal
  perpendicular al muro — mismo tipo de limitación ya documentada en
  `roomPatches.ts::inwardWallNormal` para su propio caso. Resolverlo con
  precisión requeriría emparejar el muro de la ventana con la arista real
  del polígono del recinto.
- **Ventana que cruza el vértice entre dos segmentos de un muro no recto**:
  se trata como perteneciente entera al primer segmento que la contiene
  (no se subdivide como sí hace `occlusionBoxes.ts` con las cajas de
  oclusión) — caso raro en la práctica.
- Umbrales de cumplimiento por tipo de espacio (2%/3%/4% citados
  informalmente para DF) NO se codificaron como límite normativo — el panel
  solo muestra el número calculado, sin badge "cumple/no cumple", hasta
  verificarlos contra el anexo primario de EN 17037.
- Sin exportación a PDF del resultado de Daylight Factor en este ciclo.
