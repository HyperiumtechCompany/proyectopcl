# Fase 16 — Progreso: Biblioteca de materiales (reflectancia fotométrica)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 16.

## Contexto y decisión de alcance

De las 6 líneas de trabajo posibles de la Fase 16 (transmitancia de
vidrio, mobiliario/objetos, texturas/PBR, biblioteca de materiales, etc.),
el usuario eligió empezar por la **biblioteca de materiales** — la única
que impacta el cálculo real (interreflexión), frente a las demás,
puramente visuales o de una entidad nueva desde cero. Directiva explícita
del usuario para esta fase: "trabajarlo bajo normativa" — ningún valor de
reflectancia debía inventarse sin fuente citada.

## Hallazgo central de la exploración

El mecanismo de interreflexión de primer rebote existe y está probado
desde la Fase 7/8 (`domain/calculation/buildCalculationSnapshot.ts::resolveMaterialId`,
`runDirectPreviewEngine.ts::resolveSurfaceReflectances`), pero **nunca se
activaba en ningún proyecto real** por dos motivos combinados, ninguno
relacionado con el solver en sí:

1. Ninguna UI escribía `room.ceilingReflectance`/`wallReflectance`/
   `floorReflectance` — sin esos tres campos, `resolveMaterialId` siempre
   devolvía `null`.
2. `DEFAULT_DIRECT_PREVIEW_CONFIG.interreflection` era `'none'` y ninguna
   UI lo cambiaba — el solver ya construido nunca corría, aunque hubiera
   material asignado.

Se confirmó (leyendo `resolveSurfaceReflectances` y el punto donde
`runDirectPreviewEngine.ts` construye `surfaceReflectances`) que cambiar
el default de (2) a `'first-bounce'` es 100% no disruptivo: sin material
asignado, `surfaceReflectances` queda `null` y no se construye ningún
parche — resultado bit-a-bit idéntico a `'none'` para todo proyecto
existente.

## Trazabilidad normativa de las reflectancias (consulta a `chief-electrical-engineer-reviewer`)

Antes de escribir el catálogo se consultó al agente por los valores.
Veredicto (2026-08-05): **solo el trío 0.70/0.50/0.20 tiene respaldo
normativo verificable con certeza** — es la sala de referencia estándar
de **CIE 117-1995** para tablas UGR (reutilizada por CIE 190:2010). Los
acabados específicos (blanco, pintura clara, concreto, madera, ladrillo,
tonos oscuros) mencionados en fuentes secundarias de EN 12464-1/ISO 8995
**no pudieron verificarse letra por letra** (edición/cláusula/tabla no
confirmadas) — el agente los marcó explícitamente `pending-confirmation`
en vez de inventar una cita. Por eso `hooks/materialsData.ts` etiqueta
cada preset con su `source` real: `'CIE 117-1995 (referencia UGR)'` para
los tres valores de referencia, `'estimación no normativa'` para el resto
(rango típico de industria documentado, nunca atribuido a una norma que
no se pudo confirmar).

## Cambios

- **`hooks/materialsData.ts`** (nuevo): catálogo plano de 10 presets de
  reflectancia (0-1) con `source` explícito por preset — 3 valores de
  referencia CIE 117-1995 (0.70/0.50/0.20) y 7 estimaciones no normativas
  de acabados típicos (blanco/yeso, pintura clara, tono medio, madera
  clara, concreto visto, ladrillo caravista, tono oscuro).
  `getSurfaceMaterialPreset`/`findSurfaceMaterialPresetByValue` para la UI.
- **`components/properties/room/RoomSurfaceMaterialsSection.tsx`**
  (nuevo): 3 `SelectField` (techo/pared/piso), mismo patrón que
  `RoomConstructionSection.tsx` — cada uno ofrece los presets del
  catálogo + "Sin asignar" (`null`, default real) + "Personalizado" (revela
  un `EditField` 0-100%). Escribe directamente
  `room.ceilingReflectance`/`wallReflectance`/`floorReflectance`, los
  mismos campos que `resolveMaterialId` ya consumía — sin tocar el
  dominio de cálculo. Montada en `RoomProps.tsx` junto a
  `RoomConstructionSection`, mismo gating `isRecinto`.
- **`domain/calculation/types.ts`**: `DEFAULT_DIRECT_PREVIEW_CONFIG.interreflection`
  cambiado de `'none'` a `'first-bounce'`, con comentario documentando por
  qué es no disruptivo. Efecto secundario esperado: proyectos sin material
  asignado ahora ven el warning ya existente `object-without-material-reflectance`
  (Fase 7) — informativo, no bloqueante.
- `room.material` (`'brick'|'adobe'`, estructural/RNE) se mantiene
  explícitamente distinto de estas reflectancias fotométricas — no se
  fusionaron los dos conceptos.

## Verificación

- `npx vitest run resources/js/pages/dialux`: 703/703 pasan.
  `fileSizeBudget.test.ts` sobre `hooks/lightingEngineCore.ts` (414/400
  líneas) era **preexistente** (confirmado vía `git stash` como ya
  presente en HEAD antes de esta fase, archivo no tocado) — resuelto
  agregándolo a `fileSizeBudget.allowlist.json` con justificación: es el
  ÚNICO motor de cálculo punto a punto del sistema (el propio archivo
  prohíbe duplicar la fórmula) y creció legítimamente entre las Fases 5-9
  agregando parámetros opcionales no disruptivos, nunca una segunda
  implementación paralela — partirlo rompería esa garantía de fuente
  única de verdad física, así que se prefirió aceptar el tamaño a
  fragmentar el motor (mismo criterio ya documentado en el `$comment` de
  la Fase 0 para los otros 36 archivos de la lista).
- 8 tests que dependían implícitamente del default viejo de
  `interreflection` se corrigieron forzando `interreflection: 'none'`
  explícito donde el test no es sobre materiales (mismo patrón ya usado
  para el cambio de default de UGR en la Fase 9/16), o actualizando la
  aserción al nuevo default real donde corresponde
  (`buildDialuxExportSnapshot.test.ts::configSummary`).
- Se detectó y corrigió un mismatch **preexistente y no relacionado**
  (`runProjectLightingCalculation.test.ts`: el `direct` de comparación no
  pasaba el mismo `maintenanceFactor` que el config-driven — confirmado
  vía `git stash` que ya fallaba antes de esta fase).
- 6 tests nuevos: `materialsData.test.ts` (rango 0-1, sin duplicados,
  cada `source` es CIE-117 o "estimación no normativa" explícita, lookup
  por id/valor).
- `tsc --noEmit -p .`: los errores reportados son todos preexistentes en
  archivos no tocados por esta fase (confirmado filtrando la salida por
  los archivos nuevos/editados: ninguno aparece).
- `npm run build`: OK.

## Pendientes (fuera de alcance, documentado explícitamente)

- Reflectancia por PARED INDIVIDUAL (vs. un solo valor por recinto) —
  limitación ya documentada desde la Fase 8, no resuelta en esta fase.
- Transmitancia parcial de vidrio, mobiliario/objetos con oclusión,
  texturas de imagen en 3D, render PBR/HDR — explícitamente diferidos por
  elección del usuario al iniciar esta fase.
- Confirmación letra-por-letra de EN 12464-1/ISO 8995/IES Handbook para
  los acabados no-CIE del catálogo — requiere el texto primario de esas
  normas; hasta entonces siguen etiquetados "estimación no normativa", no
  "norma X, tabla Y".
