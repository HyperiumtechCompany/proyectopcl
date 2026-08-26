# Fase 14 — Progreso: Emergencia (fundamento normativo + motor)

> Seguimiento de `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md`
> §11 Fase 14 ("Emergencia").

## Contexto y decisión de alcance

A pedido explícito del usuario ("utilizamos a nuestro agente
chief-electrical-engineer-reviewer para avanzar en resultados y evitar
trabajo a ciegas"), se consultó a ese agente ANTES de escribir código,
sobre los requisitos reales de EN 1838 y del RNE peruano para alumbrado de
emergencia.

**Hallazgo bloqueante del audit**: el catálogo `en_1838` ya cargado en el
sistema citaba una edición inexistente (`EN 1838:2019` — esa edición no
existe; la real es EN 1838:2013, retirada el 18-dic-2024 y sustituida por
EN 1838:2024). Más grave: la norma que REALMENTE rige legalmente el
alumbrado de emergencia en Perú es **RNE A.130** (Arts. 39-41, D.S.
N°017-2012-VIVIENDA) — exige **10 lx** en medios de evacuación con
**1½ h de autonomía**, muy distinto de los ~1 lx / 1 h de EN 1838 — y no
estaba en el sistema en absoluto. RNE EM.010 (usada hoy como fuente
general de Perú) no tiene ningún artículo de emergencia (verificado por
búsqueda de texto completo del documento oficial). Usar EN 1838 como base
para un proyecto peruano habría subdiseñado el nivel mínimo en ~10x.

Se acordó con el usuario (`AskUserQuestion`): **RNE A.130 es la fuente
obligatoria por defecto en Perú; EN 1838 se mantiene como capa
complementaria explícitamente marcada "buena práctica internacional, no
exigida en Perú" — nunca mezclados en un solo número** (nunca se usa
`findMostStrictNorm()`, que fusiona automáticamente).

Dado el tamaño resultante (catálogo nuevo + concepto de flujo/modo de
emergencia en el motor + geometría de rutas/áreas antipánico + un pipeline
de informe separado), se acotó el alcance con el usuario a
**"fundamento normativo + motor"**: rutas de evacuación y áreas
antipánico se modelan reutilizando el `Room` poligonal existente (nuevo
`roomType`, mismo motor de grilla) en vez de construir geometría de
polilínea nueva — eso queda documentado como pendiente de una fase futura
de mayor esfuerzo.

## Hallazgos de la exploración (evitan trabajo a ciegas)

- `Fixture.emergencyType` ya existía pero era puramente cosmético (solo
  leído por `engine/fixtureHeights.ts` y la leyenda DXF) — cero conexión
  con cálculo o normativa antes de esta fase.
- `domain/calculation/findResultExtremum.ts` (Fase 11, sin consumidor)
  era exactamente lo necesario para "punto crítico" (el punto más oscuro
  de una ruta/área) — sin inventar geometría nueva.
- `RequirementEvaluation.source` ya existía como campo por-evaluación —
  permitió evaluar A.130 y EN 1838 por separado sin tocar
  `findMostStrictNorm()`.
- No hay fórmula normativa (ni EN 1838 ni A.130) para "factor de flujo de
  emergencia" — es dato de fabricante por luminaria. El motor nunca
  inventa un porcentaje por defecto.

## 1. Corrección normativa y alta de RNE A.130

- `hooks/normativeEngine.ts`: `NORMATIVE_STANDARDS_META.en_1838` corregido
  (`source`/`version`/`year`: 2019→2013 + nota de retiro/sucesión y de que
  no aplica legalmente en Perú). Nueva entrada `rne_a130`
  (`region:'americas_peru', country:'PE', legalStatus:'mandatory'`).
  `NORMATIVE_REGIONS` de Perú: `applicableStandards` gana `rne_a130`;
  `priorityOrder` lo incluye.
- `hooks/normativaData.ts`: nuevo catálogo `a130Regulations` (mismo shape
  `RawNormativeBranch[]` que `en1838Regulations`) — "Medios de evacuación"
  (10 lx a nivel de piso) y "Señalización de salida" (50 lx sobre el
  letrero). Deliberadamente **sin** rama de "áreas antipánico" — el audit
  confirmó su ausencia en el texto oficial de A.130; esa categoría queda
  exclusivamente bajo EN 1838.
- `hooks/roomLighting.ts`: `'rne_a130'` agregado a `NormativeStandard` +
  `NORMATIVE_LABELS`.
- Backend: `database/data/normativa_a130.json` (mismo formato que
  `normativa_en1838.json`) + fila nueva en `SOURCES` de
  `DialuxNormativeRequirementsSeeder.php` + seeder corrido.
- `components/toolbar/panels/NormativaPanel.tsx`:
  `STANDARD_TO_NORM_KEY` extendido para exhaustividad de TS (con nota de
  que este panel rápido no está pensado para normas de emergencia).

## 2. Motor — flujo/modo de emergencia

- `hooks/types.ts` `Fixture.emergencyFlux?: number | null` — lúmenes en
  modo emergencia, dato de fabricante, nunca inventado.
- `domain/calculation/types.ts` `CalculationLuminaire`: nuevos
  `emergencyType`/`emergencyFlux` (requeridos, copiados 1:1 en
  `buildCalculationSnapshot.ts` con default `'none'`/`null`).
  `CalculationConfig.emergencyMode?: boolean` — default `undefined`
  reproduce el comportamiento anterior sin cambios.
- `runDirectPreviewEngine.ts`: con `config.emergencyMode: true` el filtro
  de luminarias cambia de raíz — se ignora estado de escena/interruptor
  (en un corte real los circuitos normales pierden alimentación) y en su
  lugar: `emergencyType === 'none'` → excluida siempre;
  `'emergency'`/`'permanent'` con `emergencyFlux` numérico → participa con
  ESE flujo (nunca `lumens` normal); sin `emergencyFlux` → excluida +
  advertencia `luminaire-without-emergency-flux-data` (nunca se sustituye
  por el flujo normal ni se inventa un valor). Nuevo test
  `runDirectPreviewEngine.emergencyMode.test.ts` (5 casos).

## 3. Evaluación de cumplimiento (vía `Room` existente, sin geometría nueva)

- `Room.roomType` gana `'evacuation-route' | 'antipanic-area'`.
- Nuevo `domain/calculation/emergencyCompliance.ts`:
  `evaluateEmergencyCompliance(roomType, minLux)` evalúa AMBAS normas por
  separado — para `evacuation-route`: A.130 (10 lx, mandatorio) + EN 1838
  (1 lx, referencia) como dos `EmergencyRequirementEvaluation` distintas,
  cada una con su `source`; para `antipanic-area`: solo EN 1838 (A.130 no
  tiene equivalente, se documenta la ausencia en vez de inventar un
  mínimo). Nunca fusionadas en un número. 5 tests nuevos.
- Puntos críticos: se reutiliza `findResultExtremum(result, 'min')`
  (Fase 11) sobre el `LightingResult` de cada ruta/área.

## 4. Informe de emergencia (reutiliza el pipeline de Fase 13)

- Nuevo `export/document/buildDialuxEmergencyDocument.ts`: arma un
  `DialuxFormalDocument` (mismo tipo que el informe normal) con solo
  páginas de emergencia — portada distinta ("INFORME DE ALUMBRADO DE
  EMERGENCIA") + tabla de cumplimiento por ruta/área (A.130 vs. EN 1838
  lado a lado, nunca fusionados). 5 tests nuevos.
- Dos `DialuxFormalPageKind` nuevos (`'emergency-cover'`,
  `'emergency-compliance-table'`) + ramas `@elseif` en
  `formal-pdf.blade.php` + reglas nuevas en `FormalExportRequest.php`
  (mismo patrón que cada fase anterior).
- Nuevo hook `export/useDialuxEmergencyPdfExport.ts`: corre el motor con
  `emergencyMode: true`, arma el documento de emergencia, exporta con
  nombre de archivo distinto (`*-informe-emergencia.pdf`) contra el mismo
  endpoint backend. **Botón nuevo y separado** en `EditorLayout.tsx`
  (`dialux-btn-export-emergency`, estilo ámbar) — nunca un toggle sobre el
  botón de export normal, para que los dos informes nunca se confundan.

## Matriz normativa (A.130 vs EN 1838)

| Aspecto | RNE A.130 (obligatoria en Perú) | EN 1838 (referencia opcional) |
|---|---|---|
| Fuente | RNE Norma A.130 "Requisitos de Seguridad", Arts. 39-41 (D.S. N°017-2012-VIVIENDA) | EN 1838:2013 (CEN/TC 169) |
| Estado de la edición | Vigente, oficial peruana | **Retirada el 18-dic-2024**, sustituida por EN 1838:2024 (valores de esa edición nueva no verificados en este sistema) |
| Jurisdicción | Perú — legalmente obligatoria | Unión Europea — obligatoria en SU jurisdicción, sin adopción legal en Perú |
| Medios de evacuación | 10 lx a nivel de piso, autonomía ≥1½ h | ~1 lx en el eje, uniformidad 40:1, curva de respuesta ≤5 s/60 s |
| Señalización de salida | 50 lx sobre el letrero (NTP 399.010-1) | No especificado en el catálogo cargado |
| Áreas antipánico | **No define esta categoría** (documentado como ausencia, no como 0) | 0.5 lx (referencia) |
| Cláusula reenviada, no verificada en este sistema | Art. 40 inciso d) remite a CNE Tomo V (Utilización) Art. 7.1.2.1 | — |
| Verificación | Confirmada por `chief-electrical-engineer-reviewer` (búsqueda de texto completo del documento oficial) | Valores técnicos de dominio público; edición 2024 no verificada |
| Uso en el motor | Fuente por defecto, obligatoria | Capa opcional, etiquetada explícitamente — nunca fusionada con A.130 en un solo número |

## Verificación

- `npx vitest run resources/js/pages/dialux`: 668 tests, 666 pasan. Las 2
  fallas (`fileSizeBudget.test.ts` sobre `hooks/lightingEngineCore.ts`, y
  `runProjectLightingCalculation.test.ts` con una discrepancia de
  `avg_lux`) son **preexistentes de la sesión concurrente** que agregó
  `maintenanceFactor` (default `0.8`) a `runDirectPreviewEngine.ts` —
  confirmado vía `git diff` (archivo ya en HEAD, sin cambios pendientes en
  el árbol de trabajo). No se tocó ese código.
- `runDirectPreviewEngine.ts` superó el presupuesto de tamaño por mis
  cambios (447→397 líneas) — corregido comprimiendo comentarios
  existentes y unificando `toEngineFixture`/`toEmergencyEngineFixture` en
  una sola función que recibe `lumens` ya resuelto, sin cambiar ningún
  valor calculado (verificado con los 31 tests de ese archivo antes y
  después del refactor).
- `tsc --noEmit -p .`/ESLint: limpios en todos los archivos
  tocados/creados de esta fase (confirmado filtrando la salida por
  archivo); el resto de errores/warnings del árbol (mlightcad,
  `panelCircuitCalculations.test.ts`, `outletGroups.test.ts`, mojibake en
  comentarios de `hooks/types.ts`, import/order e `isExportDisabled` sin
  usar en `EditorLayout.tsx`) son preexistentes, confirmados vía
  `git diff` sin relación con ningún archivo de esta fase.
- `npm run build`: OK.
- `php artisan test tests/Feature/Dialux/FormalExportTest.php
  tests/Feature/Dialux/NormativeRequirementsSeederTest.php`: 33/33 (149
  assertions) — incluye 2 tests nuevos de render/validación de páginas de
  emergencia y 2 tests nuevos del seeder de RNE A.130.
- `php artisan test tests/Feature/Dialux`: 75 pasan, 6 fallan, todas en
  `ProductImportTest.php` (parsing IES/GLDF) — **preexistentes**,
  confirmado vía `git diff --stat` (archivo sin ninguna modificación en
  este ciclo).
- `vendor/bin/pint --dirty --format agent`: `{"result":"pass"}`.
- Config cache verificado y limpiado (`php artisan config:clear`) antes
  de correr Pest, según el incidente documentado en memoria persistente.

## Pendientes (fuera de alcance de este ciclo)

- **Geometría de ruta real** (polilínea + ancho + muestreo a lo largo del
  eje) — rutas largas/curvas quedan aproximadas por el `Room` poligonal
  que el usuario dibuje; más preciso requeriría una fase de mayor
  esfuerzo.
- **Jurisdicción automática** — no se construyó lógica que advierta en la
  UI si el proyecto es peruano y el usuario selecciona EN 1838 como si
  fuera obligatorio; se corrigió solo el texto/cita de las normas.
- **CNE Tomo V Art. 7.1.2.1** (citado por A.130 Art. 40 inciso d) — no
  verificado, documentado como tal en el disclaimer, sin bloquear la
  fase.
- **Vía alternativa NFPA 101 para edificios existentes** — mencionada en
  el audit como posible excepción aplicable en ciertos casos; no
  verificada ni implementada.
- **UI para dibujar `evacuation-route`/`antipanic-area`** — el `roomType`
  y la evaluación de cumplimiento están listos y probados, pero ningún
  panel del editor permite todavía crear un `Room` con esos tipos; se
  activa solo cuando esa UI exista.
- **`emergencyFlux` por catálogo/importación IES/GLDF** — hoy solo se
  puede asignar manualmente por luminaria; no se agregó ningún flujo de
  importación masiva.
