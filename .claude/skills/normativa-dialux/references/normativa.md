# Tabla normativa de referencia — DIALux

> **Estado global: BORRADOR, la mayoría de filas AÚN pendiente de confirmación por un especialista.** Este documento tiene dos tipos de contenido, y es importante no confundirlos:
>
> 1. **Filas con columna `en_código` rellena**: el valor **ya está implementado y citado dentro del propio código** (`hooks/normativeEngine.ts::NORMATIVE_STANDARDS_META`, `hooks/normativaData.ts`), con fuente, edición y autoridad específicas. Esto es más confiable que una estimación de memoria general, pero **sigue sin confirmación de un especialista para este proyecto** (vigencia legal, aplicabilidad al caso concreto) — por eso el `estado` sigue en `pending-confirmation` salvo que se indique lo contrario.
> 2. **Filas sin `en_código`**: son estimaciones de conocimiento general, sin ninguna verificación documental directa. Su fiabilidad es menor que las del punto 1.
>
> El proyecto involucra construcción física real (viviendas, zonas de tránsito de personas): **cero valores de esta tabla deben usarse para justificar una decisión de obra sin firma de un ingeniero colegiado responsable**, sea cual sea su `estado`.

Columnas:

- `id`: identificador estable para que los agentes lo referencien.
- `fuente`: documento normativo.
- `edición_conocida`: edición/versión citada. Si viene de `en_código`, es la que el propio código ya declara (`NORMATIVE_STANDARDS_META`), no una estimación mía.
- `en_código`: ruta:línea donde el valor ya está implementado y citado, cuando existe. Vacío si el valor es solo una estimación de conocimiento general.
- `dominio`: `luminotecnico` | `electrico` | `geometria` | `dibujo`.
- `tipoProyecto`: `industrial` | `vivienda` | `educacion` | `todos`.
- `valor_referencial`: el dato citado o estimado.
- `estado`: `pending-confirmation` | `confirmed` | `superseded`.
- `verificado_por`: vacío hasta que un especialista lo confirme.

## 1. Iluminancia mínima por tipo de ambiente (dominio: luminotécnico)

| id | fuente | edición_conocida | en_código | tipoProyecto | valor_referencial | estado | verificado_por |
|---|---|---|---|---|---|---|---|
| lux-vivienda-dormitorio-1 | EN 12464-1 | 2021 | `hooks/normativaData.ts:25-32` | vivienda | 50 lx — "Dormitorio, sala de estar, comedor, sala de juegos, sala de television y similares" | pending-confirmation | |
| lux-vivienda-bano | EN 12464-1 | 2021 | `hooks/normativaData.ts:33-41` | vivienda | 100 lx — baño/ducha/bañera | pending-confirmation | |
| lux-vivienda-bano-espejo | EN 12464-1 | 2021 | `hooks/normativaData.ts:42-50` | vivienda | 500 lx — zona de espejo | pending-confirmation | |
| lux-vivienda-cocina | EN 12464-1 | 2021 | `hooks/normativaData.ts:51-59` | vivienda | 300 lx | pending-confirmation | |
| lux-vivienda-sala-2 | EN 12464-1 | 2021 | `hooks/normativaData.ts:60-68` | vivienda | 100 lx — "Sala de estar, comedor, sala de juegos..." | pending-confirmation | |
| lux-educacion-aula | EN 12464-1 + RNE EM.010 | 2021 / D.S. N°006-2014-V | `components/toolbar/normativeData.ts` (`Em_work: 500`, "5.1 Aulas de enseñanza") y `hooks/normativaData.ts` (`iluminancia_lux: 500`) | educacion | 500 lx — **coincide en ambos catálogos estáticos**, sin divergencia detectada para este caso puntual | pending-confirmation | |
| lux-industrial-sala-control | EN 12464-1 | 2021 | `hooks/normativaData.ts:672` | industrial | 500 lx, UGR 19, Uo 0.6, Ra 80 — "Salas de control de proceso industrial" | pending-confirmation | |
| lux-industrial-mantenimiento | EN 12464-1 | 2021 | `hooks/normativaData.ts:674` | industrial | 300 lx, UGR 25, Uo 0.6, Ra 80 — "Talleres de mantenimiento industrial" | pending-confirmation | |
| lux-industrial-clase-d | RNE EM.010 (cita interna "CNE Utilización – Clase D") | D.S. N°006-2014-V | `hooks/normativaData.ts:1054` | industrial | 200 lx, UGR 25, Uo 0.4, Ra 60 — "Trabajo industrial sin requisito de detalle visual" | pending-confirmation | |
| lux-industrial-clase-c | RNE EM.010 (cita interna "CNE Utilización – Clase C") | D.S. N°006-2014-V | `hooks/normativaData.ts:1055` | industrial | 300 lx, UGR 25, Uo 0.5, Ra 60 — "detalle grueso" | pending-confirmation | |
| lux-industrial-clase-b | RNE EM.010 (cita interna "CNE Utilización – Clase B") | D.S. N°006-2014-V | `hooks/normativaData.ts:1056` | industrial | 500 lx, UGR 22, Uo 0.6, Ra 80 — "trabajo normal (ensamblaje, control)" | pending-confirmation | |
| ugr-oficina-referencia | EN 12464-1 | 2021 | — (sin ubicar línea exacta) | todos | UGR ≤ 19 en oficinas/aulas (referencia general, no verificada línea por línea) | pending-confirmation | |

**Inconsistencia detectada dentro del propio catálogo, para que el especialista la revise**: `hooks/normativaData.ts` tiene dos entradas de vivienda con etiquetas casi idénticas ("Dormitorio, sala de estar, comedor..." en 50 lx, línea 27, vs. "Sala de estar, comedor..." en 100 lx, línea 63) — no está claro si son dos casos de uso distintos (general vs. tarea) o una duplicación con valores discrepantes. `dialux-calc-reviewer` debe tratar esto como ambigüedad a resolver, no elegir una de las dos por su cuenta.

**Nota sobre `components/toolbar/normativeData.ts` vs. `hooks/normativaData.ts`**: para el caso puntual de aula (educación) verificado arriba, ambos catálogos coinciden en 500 lx. Esto **no** descarta el riesgo general de divergencia entre ambos archivos señalado en `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §3.2 — solo confirma que, para este caso concreto, no hay conflicto.

## 2. Caída de tensión — límites por punto del árbol de tableros (dominio: eléctrico)

| id | fuente | edición_conocida | en_código | tipoProyecto | valor_referencial | estado | verificado_por |
|---|---|---|---|---|---|---|---|
| voltage-drop-circuito-final | CNE-Utilización (Perú) | no confirmada | `plan_caida_tension.md` §3.11 | todos | El código de `plan_caida_tension.md` ya asume 4 % (histórico Excel); conocimiento general de CNE cita 2.5 %+2.5 % (5 % total) repartido distinto | pending-confirmation | |
| voltage-drop-seed-residencial | (sin cita normativa en el seeder) | no confirmada | `database/seeders/DialuxElectricalCatalogSeeder.php:119-122` | vivienda | 2.5 % plano para lighting/outlets/feeder/special (`installation_category='residencial'`) | pending-confirmation | |
| voltage-drop-seed-educativa | (sin cita normativa en el seeder) | no confirmada | `database/seeders/DialuxElectricalCatalogSeeder.php:125-128` | educacion | 2.5 % lighting/outlets/special, 2.0 % feeder | pending-confirmation | |
| voltage-drop-seed-industrial | (sin cita normativa en el seeder) | no confirmada | `database/seeders/DialuxElectricalCatalogSeeder.php:131-134` | industrial | 3.0 % plano para todos los `circuit_type` | pending-confirmation | |

**Discrepancia abierta, sigue sin resolver (confirmada en Fase 3 del plan de agentes)**: existen **tres** series de valores en el sistema — la del Excel origen (4 %/2.5 %/1 % por nivel del árbol, en `plan_caida_tension.md`), la sembrada en base de datos (2.0–3.0 % plano por `circuit_type`×`installation_category`, sin cascada), y la que se recuerda de forma general del CNE-Perú (2.5 %+2.5 % = 5 % total). **Ninguna de las tres debe asumirse correcta** hasta que el especialista indique cuál rige para este proyecto, bajo qué edición, y si aplica por tramo o en cascada acumulada (ver `.claude/agents/dialux-electrical-reviewer.md`, que ya implementa el cálculo de `cumulativeVoltageDropPct` pero sin umbral total confirmado).

## 3. Reglas de tomacorrientes por ambiente (dominio: eléctrico)

| id | fuente | edición_conocida | en_código | tipoProyecto | valor_referencial | estado | verificado_por |
|---|---|---|---|---|---|---|---|
| tomacorriente-aula | CNE-Utilización / criterio de proyecto | no confirmada | `plan_resolucion_dialux_claude_codex.md` §3.4 | educacion | 1 punto cada 10 m² (sin cita normativa directa en el código) | pending-confirmation | |
| tomacorriente-comedor | CNE-Utilización / criterio de proyecto | no confirmada | ídem | educacion | 1 punto cada 15 m² | pending-confirmation | |
| tomacorriente-exterior | CNE-Utilización / criterio de proyecto | no confirmada | ídem | todos | separación máxima 9 m | pending-confirmation | |
| tomacorriente-vivienda-general | CNE-Utilización | no confirmada | — | vivienda | no definido en el código actual | pending-confirmation | |
| tomacorriente-industrial-general | CNE-Utilización | no confirmada | — | industrial | no definido en el código actual; probablemente por carga de equipo, no por área | pending-confirmation | |

**Nota**: estas reglas ya están codificadas como valor por defecto en la base de datos (`DialuxOutletRule`, configurable), pero ningún archivo cita el artículo exacto del CNE del que provendrían. Puede ser un criterio de oficina de proyectos, no una cita normativa literal. Debe confirmarse el origen real antes de presentarlo como cumplimiento normativo.

## 4. Ampacidad y calibres de conductor (dominio: eléctrico)

| id | fuente | edición_conocida | en_código | tipoProyecto | valor_referencial | estado | verificado_por |
|---|---|---|---|---|---|---|---|
| ampacidad-tabla-a | NTP / CNE-Utilización / IEC 60364 | no confirmada | `plan_caida_tension.md` §1.4 Tabla A | todos | Tabla completa de TW/THW/NYY/LSOH/N2X0H por sección | pending-confirmation | |
| ampacidad-anomalia-120mm2-tw | misma tabla | no confirmada | ídem | todos | 120 mm²/TW = 165 marcado como posible error de tipeo del Excel origen; **no corregir sin confirmar con el especialista** | pending-confirmation | |
| factor-agrupamiento | CNE-Utilización, Tabla 5Dc (nombre citado, contenido no verificado) | no confirmada | `plan_caida_tension.md` §3.6 | todos | 0.85/0.75/0.70/0.65/0.60 según 2 a 6 circuitos agrupados | pending-confirmation | |
| factor-temperatura | CNE-Utilización, Tabla 5A (nombre citado, contenido no verificado) | no confirmada | ídem | todos | 1.07 a 0.85 entre 10 °C y 40 °C | pending-confirmation | |
| design-factor-125pct | NEC/CNE (citado en comentario del propio código) | no confirmada | `resources/js/pages/dialux/electrical/engine/compute.ts:46` (`DESIGN_FACTOR = 1.25`) | todos | 125 % de sobredimensionamiento de corriente de diseño — valor muy estándar en la práctica, pero sin cita de artículo específico | pending-confirmation | |

## 5. Alumbrado de emergencia y rutas de evacuación (dominio: luminotécnico / geometría)

> **Actualizado por `dialux-normativa-auditor`** tras detectar que esta sección había quedado desactualizada respecto al código (edición de EN 1838 corregida de 2019 a 2013 en `normativeEngine.ts`/`normativaData.ts`, y una norma peruana obligatoria nueva — RNE A.130 — agregada como fuente real, sin que este documento lo reflejara). Ver también §7, que tenía el mismo problema (tabla de `NORMATIVE_STANDARDS_META` con 6 normas cuando el código ya define 7).

| id | fuente | edición_conocida | en_código | tipoProyecto | valor_referencial | estado | verificado_por |
|---|---|---|---|---|---|---|---|
| emergencia-eje-ruta | EN 1838 | 2013 (edición 2019 citada antes en este documento no existe en el catálogo público CEN/BSI; 2013 fue retirada 18-dic-2024, sustituida por 2024 aún no verificada aquí) | `hooks/normativaData.ts:1114-1146` | todos | 1 lx en el eje central de la ruta de evacuación (ancho <= 2 m); Ra 40; uniformidad Emax:Emin <= 40:1; 50% del nivel en 5 s y 100% en 60 s; autonomía mínima 1 hora | pending-confirmation | |
| emergencia-escaleras | EN 1838 | 2013 | `hooks/normativaData.ts:1127-1135` | todos | 1 lx en todo el ancho del tramo de escalera (no solo el eje) | pending-confirmation | |
| emergencia-puntos-seguridad | EN 1838 | 2013 | `hooks/normativaData.ts:1136-1144` | todos | 5 lx dentro de un radio de 2 m de alarmas/extintores/primeros auxilios, a nivel de suelo | pending-confirmation | |
| emergencia-area-antipanico | EN 1838 | 2013 | `hooks/normativaData.ts:1147-1160` | todos | 0.5 lx en el núcleo de áreas >= 60 m2 (excluyendo banda perimetral de 0.5 m) | pending-confirmation | |
| emergencia-tarea-alto-riesgo | EN 1838 | 2013 | `hooks/normativaData.ts:1161-1175` | todos | 15 lx (o el mayor entre eso y 10% del nivel normal de la tarea); Uo 0.1; disponibilidad instantánea, sin demora | pending-confirmation | |
| emergencia-autonomia-minima | EN 1838 | 2013 | incluida en las filas anteriores (`requisitos_especificos`) | todos | 1 hora de autonomía mínima | pending-confirmation | |
| emergencia-evacuacion-a130 | RNE A.130 (D.S. N°017-2012-VIVIENDA), Art. 40 | 2012 | `hooks/normativaData.ts:1189-1203`, `domain/calculation/emergencyCompliance.ts` (líneas 37, 41, 73) | todos | 10 lx a nivel de suelo en medios de evacuación; autonomía mínima 1.5 h; transferencia automática en máx. 10 s; conexión según CNE Tomo V Art. 7.1.2.1 (artículo puntual no verificado) | pending-confirmation | |
| emergencia-senalizacion-a130 | RNE A.130 (D.S. N°017-2012-VIVIENDA), Art. 39/41 | 2012 | `hooks/normativaData.ts:1205-1217` | todos | 50 lx sobre el propio letrero de señalización de salida (no sobre la ruta de circulación); señalización según NTP 399.010-1 | pending-confirmation | |

**Nota — jerarquía correcta entre EN 1838 y RNE A.130 (Fase 14 del plan maestro, §11)**: RNE A.130 es la fuente OBLIGATORIA para alumbrado de emergencia en proyectos peruanos (`NORMATIVE_STANDARDS_META.rne_a130.legalStatus === 'mandatory'`) — RNE EM.010 (`rne_peru`) no trata este tema en absoluto (verificado por texto completo del documento oficial, según el propio comentario del código). EN 1838 NO tiene adopción legal en Perú; el código la ofrece solo como referencia complementaria de buena práctica para conceptos que A.130 no define (áreas antipánico, relación de uniformidad 40:1, curva de respuesta 50%@5s/100%@60s). El módulo `domain/calculation/emergencyCompliance.ts` (con su propio test `emergencyCompliance.test.ts`) evalúa ambos estándares SIEMPRE por separado, nunca fusionados en un solo número — a diferencia de `findMostStrictNorm()` en `normativeEngine.ts`, que sí fusiona para el alumbrado normal (no de emergencia). Este es un mecanismo de evaluación normativa adicional a los descritos en `.claude/agents/dialux-normativa-auditor.md` — ningún agente debe asumir que esa lista es exhaustiva sin volver a verificar contra el código.

**Hallazgo de trazabilidad cruzada (bloqueante, agregado por `dialux-normativa-auditor`)**: `hooks/ambientSpaces.ts::deriveSceneAmbientSpaces()` (linea ~1019-1021) filtra unicamente `room.roomType !== 'corridor'` — no excluye `evacuation-route` ni `antipanic-area` — asi que estos ambientes de emergencia tambien se procesan como ambientes normales en el informe PDF general (`export/snapshot/buildDialuxExportSnapshot.ts`), con su propio `RequirementEvaluation`/`complies` basado en el catalogo de iluminancia GENERAL (`room.normativeStandard`/`normativeCategory`/`normativeActivity`, tipicamente sin asignar para este tipo de ambiente porque `RoomLightingSection.tsx` no se renderiza para estos `roomType`), mientras que el informe de emergencia dedicado (`buildDialuxEmergencyDocument.ts`) evalua el mismo ambiente correctamente contra A.130/EN 1838. Hoy esto no produce una falsa cifra "Cumple" en el informe general porque `evaluateRequirementStatus()` devuelve `not-evaluated` sin `source` (verificado vigente en esta misma sesion) — pero si puede mostrar el mismo ambiente fisico con estados distintos en dos documentos PDF distintos del mismo proyecto (uno "Revisar" en el informe general, otro "Cumple"/"No cumple" en el informe de emergencia), sin ninguna nota cruzada que explique por que. Recomendacion: excluir explicitamente `evacuation-route` y `antipanic-area` de `deriveSceneAmbientSpaces()` (mismo tratamiento que `corridor`), o anotar en el informe general que ese ambiente tiene una evaluacion normativa separada.

## 5b. Espesores y alturas mínimas de muro (dominio: geometría)

> Agregado por `dialux-normativa-auditor` al cerrar el hallazgo de `dialux-calc-reviewer` sobre `WallProps.tsx:898-907` (ver sesión de revisión). Estas filas siguen el proceso de mantenimiento "A. Reconciliación con el código" de `SKILL.md`: no requieren especialista todavía, solo dejan trazabilidad de que el valor YA existe en el código, sin que eso implique que la cita normativa esté verificada.

| id | fuente | edición_conocida | en_código | tipoProyecto | valor_referencial | estado | verificado_por |
|---|---|---|---|---|---|---|---|
| muro-vivienda-ladrillo | RNE E.070 (Albañilería) — candidata, sin artículo citado en el código | no confirmada | `hooks/wallNorms.ts:27-42` (`PERU_WALL_PRESETS.brick.housing`) | vivienda | minThickness 0.12 m, minHeight 2.3 m — el propio código lo declara "mínimo operativo... como referencia práctica", no una cita de artículo | pending-confirmation | |
| muro-educacion-ladrillo | RNE E.070 (Albañilería) — candidata, sin artículo citado en el código | no confirmada | `hooks/wallNorms.ts:44-58` (`PERU_WALL_PRESETS.brick.education`) | educacion | minThickness 0.13 m, minHeight 2.4 m | pending-confirmation | |
| muro-vivienda-adobe | RNE E.080 (Diseño y Construcción con Tierra Reforzada) — candidata, sin artículo citado en el código | no confirmada | `hooks/wallNorms.ts:77-91` (`PERU_WALL_PRESETS.adobe.housing`) | vivienda | minThickness 0.40 m, minHeight 2.3 m — el propio código lo declara "mínimo operativo adoptado por la app" | pending-confirmation | |
| muro-educacion-adobe | RNE E.080 — candidata, sin artículo citado en el código | no confirmada | `hooks/wallNorms.ts:93-107` (`PERU_WALL_PRESETS.adobe.education`) | educacion | minThickness 0.40 m, minHeight 2.4 m | pending-confirmation | |

**Nota — origen del hallazgo `bloqueante`**: `components/properties/WallProps.tsx:898-907` muestra un badge "✅ Cumple" / "⚠️ Revisar mínimos" comparando `wall.thickness`/`wall.height` contra estos mismos presets, sin mostrar en la UI ninguna cita de artículo E.070/E.080 (porque el propio código no la tiene). Es un caso confirmado de valor "cumple" sin fuente normativa que lo sostenga — ver `.claude/agents/dialux-normativa-auditor.md`, hallazgo de la sesión que agregó esta sección. Confirmado además que estos valores de muro NO alimentan ningún cálculo eléctrico/geométrico downstream; su único efecto es el badge mostrado al usuario.

## 6. Clasificación de tipos de proyecto usados en esta tabla

**Esta tabla es la fuente única de verdad de qué `tipoProyecto` existen.** Ningún agente (`.claude/agents/dialux-*.md`) ni el orquestador (`.claude/skills/revisar-dialux/`) debe mantener su propia lista cerrada de tipos; cuando mencionan `industrial | vivienda | educacion` es solo el estado actual de esta tabla, no un límite fijo en su lógica. Agregar un tipo nuevo (ver §9.2) requiere editar solo esta fila, no los agentes.

| tipoProyecto | Norma RNE de referencia general | Notas |
|---|---|---|
| `vivienda` | A.020 Vivienda | Incluye vivienda multifamiliar; no distingue todavía unifamiliar vs. multifamiliar como perfiles separados |
| `educacion` | A.040 Educación | Cubre aulas, laboratorios, circulación y SS.HH. escolares; no distingue nivel inicial/primaria/secundaria como perfiles separados todavía |
| `industrial` | A.060 Industria | No distingue todavía subtipo de proceso industrial (liviano/pesado) ni zonas ATEX |

**Nota de vocabulario**: el código usa `installation_category: 'residencial'|'educativa'|'industrial'` (ver `database/seeders/DialuxElectricalCatalogSeeder.php`) para el dominio eléctrico, no exactamente estas mismas palabras. Mapeo: `vivienda↔residencial`, `educacion↔educativa`, `industrial↔industrial` (ya documentado en `.claude/agents/dialux-electrical-reviewer.md`).

**Discrepancia detectada, sin resolver (agregada por `dialux-normativa-auditor`)**: `hooks/stairNorms.ts` (líneas 5, 77-78) y `components/properties/room/RoomConstructionSection.tsx:37` etiquetan el perfil "vivienda" citando **RNE A.010** ("Condiciones Generales de Diseño"), mientras que esta misma tabla (fila `vivienda` arriba) usa **RNE A.020** ("Vivienda") como norma de referencia general para ese `tipoProyecto`. No se puede descartar que ambas citas sean correctas para aspectos distintos (A.010 regula condiciones generales de diseño — incluyendo escaleras — aplicables a toda edificación, mientras A.020 sería la norma específica de uso residencial), pero el sistema no documenta ese matiz en ningún lado, y el mismo patrón "A.010 = vivienda" se repite en `components/properties/room/StairConfigPanel.tsx:106` y en un comentario de `hooks/types.ts:211-217`. No resolver por criterio propio de ningún agente; requiere confirmación de un especialista sobre cuál artículo del RNE aplica realmente a cada caso (escaleras vs. perfil general de vivienda).

**Pendiente para fases futuras** (no bloquea el incremento actual): granularidad adicional por subtipo dentro de cada tipoProyecto, y cobertura de tipologías no listadas aún (salud, comercio, oficinas — ya existen parcialmente en `hooks/normativeEngine.ts` como categorías de actividad, aunque sin perfil normativo completo propio en este plan).

## 7. Catálogo de normas ya citado en código (referencia cruzada)

`hooks/normativeEngine.ts::NORMATIVE_STANDARDS_META` ya mantiene, para siete normas, una ficha con fuente, versión, año, autoridad y estado legal. Esta tabla es más rigurosa que las estimaciones de las secciones 1-5 y debe consultarse en paralelo:

| id interno | fuente citada | año | autoridad | estado legal (`legalStatus`) | catálogo de valores cargado |
|---|---|---|---|---|---|
| `en_12464` | EN 12464-1:2021 | 2021 | CEN/TC 169 | `recommended` | Sí (`en12464Regulations`) |
| `ies_na` | IES HB-10-17 | 2017 | Illuminating Engineering Society | `recommended` | Sí (`iesnaRegulations`) |
| `rne_peru` | RNE EM.010 (D.S. N°006-2014-V) | 2014 | MVCS Perú | `mandatory` | Sí (`rnePeruRegulations`) |
| `en_1838` | EN 1838:2013 (corregido — la edición "2019" citada antes en este documento y en `NORMATIVE_STANDARDS_META` no existe en el catálogo público CEN/BSI; 2013 fue retirada 18-dic-2024, sustituida por 2024 aún no verificada) | 2013 | CEN/TC 169 | `mandatory` (obligatoria SOLO en su propia jurisdicción europea, NO en Perú — ver `rne_a130` abajo para la fuente peruana real) | Sí (`en1838Regulations`) |
| `rne_a130` | RNE A.130 (D.S. N°017-2012-VIVIENDA), Arts. 39-41 | 2012 | MVCS Perú | `mandatory` | Sí (`a130Regulations`) — **norma agregada por Fase 14 del plan maestro, ausente de esta tabla hasta que `dialux-normativa-auditor` la detectó en esta sesión**; es la fuente OBLIGATORIA real para alumbrado de emergencia en Perú (`rne_peru`/EM.010 no trata este tema en absoluto) |
| `nfpa101` | NFPA 101:2021 | 2021 | NFPA | `reference` | **No** — catálogo vacío (`getNormData` retorna `[]`), pese a `active: true` en la metadata (inconsistencia señalada en `.claude/agents/dialux-normativa-auditor.md`) |
| `ds024` | DS-024-2016-EM | 2016 | MEM Perú | `mandatory` | **No** — catálogo vacío, misma inconsistencia que `nfpa101` |

Ningún agente debe citar `nfpa101` o `ds024` como fuente de un valor numérico real: su metadata existe, pero no tienen datos de actividad cargados todavía. El catálogo de `NORMATIVE_STANDARDS_META` en el código ya define **siete** normas (no seis, como decía la versión anterior de esta tabla) — verificar contra el código en cada revisión en vez de confiar en el conteo de esta tabla.

## 8. Registro de confirmaciones

| Fecha | Fila confirmada | Confirmado por | Documento de respaldo |
|---|---|---|---|
| _(vacío — ninguna fila ha sido confirmada formalmente por un especialista todavía; las filas con `en_código` tienen mayor trazabilidad pero no equivalen a confirmación)_ | | | |

## 9. Mantenimiento (Fase 11 del plan)

Ver el proceso completo, con pasos accionables, en `.claude/skills/normativa-dialux/SKILL.md` sección "Mantenimiento continuo". Resumen:

- **Cadencia de revisión de ediciones**: anual, o inmediatamente si alguien del equipo detecta que una norma citada aquí (EN 12464-1:2021, RNE EM.010 D.S. N°006-2014-V, EN 1838:2013, RNE A.130 D.S. N°017-2012-VIVIENDA, IES HB-10-17, NFPA 101:2021, DS-024-2016-EM) fue reemplazada por una edición nueva.
- **Agregar un tipo de proyecto nuevo** (salud, comercio, oficinas...): agregar una fila a la tabla de la sección 6 y, si corresponde, filas nuevas en las secciones 1-5 con su propio `tipoProyecto`. No requiere tocar ningún agente.
- **Agregar un dominio de revisión nuevo** (exteriores, vial, IFC...): ver `.claude/skills/revisar-dialux/SKILL.md` sección "Agregar un dominio nuevo".
