---
name: normativa-dialux
description: Fuente única de referencia normativa (CNE, RNE, EN) para los agentes de revisión DIALux — iluminancia mínima por ambiente, límites de caída de tensión, calibres y factores de corrección, por tipo de proyecto (industrial, vivienda, educación). Todo valor está marcado con su estado de confirmación; ningún agente puede citar un valor de esta tabla como definitivo mientras su estado sea `pending-confirmation`.
---

# Normativa DIALux — tabla de referencia

Esta skill no ejecuta nada. Es una **fuente de consulta** que los agentes `dialux-calc-reviewer`, `dialux-electrical-reviewer`, `dialux-geometry-reviewer`, `dialux-drawing-reviewer` y `dialux-normativa-auditor` deben leer antes de citar cualquier norma en un hallazgo.

> **Advertencia obligatoria de origen**: no todas las filas de `references/normativa.md` tienen el mismo origen. Algunas ya citan un documento y edición específicos porque **ya existen implementadas y citadas dentro del propio código** (`hooks/normativeEngine.ts::NORMATIVE_STANDARDS_META`, `hooks/normativaData.ts` — ver sección 7 de la tabla); esas tienen columna `en_código` rellena. Otras siguen siendo estimaciones de conocimiento general sin ninguna verificación documental. Ninguna de las dos categorías equivale a confirmación: este es un sistema cuyos cálculos alimentan construcción física (viviendas, zonas de tránsito de personas), y ningún valor puede tratarse como definitivo hasta que un ingeniero colegiado responsable del proyecto lo confirme explícitamente. Mientras el campo `estado` de una fila sea `pending-confirmation`, cualquier agente que lo use debe reportar su hallazgo con `status: 'no-evaluado'`, nunca `'confirmado'` — tenga o no `en_código`.

## Cómo debe usar esta skill un agente

1. Identificar el `dominio` del hallazgo (luminotécnico, eléctrico, geometría, dibujo) y el `tipoProyecto` del proyecto en revisión. La lista vigente de `tipoProyecto` vive en `references/normativa.md` §6 (hoy: `industrial`, `vivienda`, `educacion`) — esa tabla es la fuente única de verdad, no una lista fija en este archivo ni en los agentes.
2. Buscar en `references/normativa.md` la fila que coincide con ambos. Si la sección 7 (catálogo ya citado en código) tiene una entrada más específica que la de las secciones 1-5, preferir esa cita.
3. Si la fila existe y su `estado` es `confirmed`: citar `fuente`, `edición` y `artículo` tal cual, y el hallazgo puede marcarse `confirmado` si el resto de la evidencia lo sostiene.
4. Si la fila existe pero su `estado` es `pending-confirmation` (con o sin `en_código`): citar la fuente igual, pero el `status` del hallazgo debe ser `no-evaluado`, y el hallazgo debe incluir la frase literal `"valor no confirmado por especialista"`. Una fila con `en_código` puede describirse como "ya citada en el código, pendiente de confirmar vigencia/aplicabilidad", que es más preciso que "sin ninguna fuente".
5. Si no existe fila para esa combinación de dominio/tipoProyecto: el agente debe reportar `no-evaluado` con el resumen `"norma no configurada para este tipo de proyecto"`, nunca inventar un valor de otro tipo de proyecto por similitud.
6. Nunca citar `nfpa101` o `ds024` como fuente de un valor numérico: su ficha de metadata existe pero su catálogo de actividades está vacío (ver sección 7).

## Actualización de esta skill

Esta skill se actualiza en dos escenarios distintos, que no deben confundirse:

**A. Reconciliación con el código (no requiere especialista, cualquier agente/sesión puede hacerlo)**: cuando se descubra que un valor ya está implementado y citado en el código (como ocurrió en la Fase 8 del plan, al encontrar `NORMATIVE_STANDARDS_META` y los catálogos `en12464Regulations`/`rnePeruRegulations`/`en1838Regulations` con citas reales), se actualiza la fila correspondiente agregando `en_código` con la ruta:línea exacta y ajustando `edición_conocida` a lo que el código realmente declara. El `estado` **no** cambia a `confirmed` solo por esto — sigue en `pending-confirmation`, pero con mejor trazabilidad.

**B. Confirmación real (requiere especialista)**: cambiar el `estado` de una fila a `confirmed` requiere una fuente verificable adicional a la del código (documento oficial vigente, número de resolución, o confirmación explícita del ingeniero responsable de este proyecto) anotada en la columna `verificado_por` y en la sección 8 (registro de confirmaciones), con fecha.

En ambos casos: nunca se borra el historial de una corrección; si un valor cambia, se agrega una fila nueva y se marca la anterior como `superseded`.

## Mantenimiento continuo (Fase 11 del plan)

Esta sección existe para que la capa de revisión no quede desactualizada con el tiempo — es el criterio de cierre de la Fase 11 de `planes/plan_agentes_skills_revision_normativa_dialux.md`: **agregar un tipo de proyecto nuevo debe requerir solo editar este archivo y `references/normativa.md`, nunca reescribir un agente.**

### Cadencia de revisión de ediciones normativas

- **Anual**, como mínimo: releer la sección 7 de `references/normativa.md` (catálogo ya citado en código) y confirmar que ninguna edición (EN 12464-1:2021, RNE EM.010 D.S. N°006-2014-V, EN 1838:2019, IES HB-10-17, NFPA 101:2021, DS-024-2016-EM) fue reemplazada por una versión más nueva.
- **Inmediata**, sin esperar al ciclo anual: en cuanto alguien del equipo (o un especialista consultado) detecte que una norma cambió de edición, se deroga, o deja de aplicar en la jurisdicción del proyecto.
- Cada revisión, tenga o no cambios, se anota en la sección 8 de `references/normativa.md` (registro de confirmaciones) aunque sea solo para dejar constancia de "revisado, sin cambios" con fecha.

### Cómo agregar un tipo de proyecto nuevo (ej. salud, comercio, oficinas)

No se toca ningún agente. Los pasos son exclusivamente sobre `references/normativa.md`:

1. Agregar una fila a la tabla de la sección 6 con el nuevo `tipoProyecto`, su norma RNE/equivalente de referencia y notas.
2. Agregar filas nuevas en las secciones 1-5 (iluminancia, caída de tensión, tomacorrientes, ampacidad, emergencia) para ese `tipoProyecto`, con `estado: pending-confirmation` salvo que ya se tenga una fuente verificada.
3. Si el nuevo tipo ya existe como categoría de actividad en `hooks/normativeEngine.ts`/`hooks/normativaData.ts` (varias, como `salud`, `oficina`, `comercio`, `deportes`, `transporte`, `mineria`, ya aparecen en `getInstallationTypes()` de ese archivo, aunque sin perfil normativo completo propio en este plan todavía), citarlo en la columna `en_código` igual que se hizo en la Fase 8.
4. Si el dominio eléctrico necesita una `installation_category` nueva, verificar primero si ya existe una fila sembrada en `database/seeders/DialuxElectricalCatalogSeeder.php` para ese tipo; si no existe, señalarlo como pendiente — **no asumir que el sistema usará valores neutros**: recordar el hallazgo confirmado en la Fase 10 (`compute.installationCategoryProfiles.test.ts`) de que una categoría no sembrada hoy toma en silencio los valores de la primera categoría sembrada del catálogo, sin advertencia.
5. Ningún agente necesita reescribirse: todos leen `tipoProyecto` como parámetro libre y consultan esta skill dinámicamente.

### Cómo agregar un dominio de revisión nuevo (ej. exteriores, vial, IFC)

Esto sí implica trabajo en `.claude/agents/` y en el orquestador — ver `.claude/skills/revisar-dialux/SKILL.md` sección "Agregar un dominio nuevo" para el procedimiento completo. Regla general: un dominio nuevo es un agente nuevo (`dialux-<dominio>-reviewer.md`), nunca una rama de lógica dentro de un agente existente.

## Discrepancias conocidas que deben resolverse con un especialista

1. **Caída de tensión — tres series de valores distintas y sin resolver** (ver `references/normativa.md` sección 2): la del Excel origen de `plan_caida_tension.md` (4 %/2.5 %/1 % por nivel del árbol), la sembrada en base de datos (2.0–3.0 % plano por tipo de circuito, sin acumular en cascada — `database/seeders/DialuxElectricalCatalogSeeder.php`), y la que se recuerda de forma general del CNE-Perú (2.5 %+2.5 % = 5 % total). Afecta directamente el motor de `cumulativeVoltageDropPct` ya implementado en `dialux-electrical-reviewer`.
2. **Posible duplicación/conflicto interno en `hooks/normativaData.ts`** (ver sección 1): dos entradas de vivienda con etiquetas casi idénticas pero valores distintos (50 lx vs. 100 lx) para "sala de estar/comedor". No resolver por criterio propio; es una pregunta para quien mantenga ese catálogo.
3. **`nfpa101`/`ds024` con `active: true` pero catálogo vacío** (ver sección 7 y `.claude/agents/dialux-normativa-auditor.md`): metadata engañosa que debería corregirse (campo `active` o UI) independientemente de que alguna vez se cargue su catálogo real.
4. **Presets de muro peruanos (`hooks/wallNorms.ts`) sin cita de artículo RNE E.070/E.080** (ver `references/normativa.md` sección 5b, agregada por `dialux-normativa-auditor`): el badge "Cumple"/"Revisar mínimos" de `components/properties/WallProps.tsx:898-907` compara contra estos presets, que el propio código admite son un "mínimo operativo" adoptado por la app, no una cita normativa verificada.
5. **Etiqueta "A.010" vs. "A.020" para el perfil "vivienda"** (ver `references/normativa.md` sección 6): `hooks/stairNorms.ts` y `components/properties/room/RoomConstructionSection.tsx` citan RNE A.010 para vivienda, mientras que la tabla de tipos de proyecto usa A.020. No resolver por criterio propio; requiere especialista.

Ver la tabla completa en [references/normativa.md](references/normativa.md).
