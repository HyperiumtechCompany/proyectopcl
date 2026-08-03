---
name: revisar-dialux
description: Orquesta los cinco agentes de revisión del módulo DIALux (dialux-geometry-reviewer, dialux-calc-reviewer, dialux-electrical-reviewer, dialux-drawing-reviewer, dialux-normativa-auditor) en el orden correcto y consolida sus hallazgos en una sola tabla. Úsalo cuando el usuario pida "revisar dialux", "auditar el módulo dialux", "/revisar-dialux", o antes de una entrega/merge que toque resources/js/pages/dialux/. Acepta filtros opcionales por dominio, tipo de proyecto y niveles.
---

# revisar-dialux — orquestador de revisión DIALux

Esta skill ejecuta la Fase 7 de `planes/plan_agentes_skills_revision_normativa_dialux.md`: invoca los cinco agentes de dominio en el orden correcto y consolida sus hallazgos en una sola tabla legible. No hace revisión propia — delega completamente en los agentes.

## Argumentos aceptados

Se invoca como `/revisar-dialux [dominio=...] [tipo-proyecto=...] [niveles=N]`. Todos son opcionales; parsea el string de `args` buscando estos pares `clave=valor` en cualquier orden. Si `args` está vacío, ejecuta el modo completo (sección "Modo completo").

- `dominio=calculo|electrico|geometria|dibujo|normativa` — si se provee, invoca **solo** el agente correspondiente (ver tabla de mapeo abajo), no la cadena completa.
- `tipo-proyecto=...` (hoy: `industrial|vivienda|educacion`; la lista vigente vive en `.claude/skills/normativa-dialux/references/normativa.md` §6, no aquí) — se lo pasas a cada agente como contexto explícito en el prompt de invocación, para que cargue el perfil normativo correcto y no asuma uno por defecto.
- `niveles=N` — si `N > 1`, instruye a cada agente que el campo `level` de sus hallazgos es obligatorio (no puede usar `'todos'` sin haber verificado explícitamente cada nivel).

Si el usuario no indica `tipo-proyecto` y el proyecto real lo tiene declarado en el código (`room.normativeCategory`, `installationCategory` del documento eléctrico, etc.), pídele que lo confirme antes de invocar los agentes si no es evidente por el contexto — no asumas un tipo de proyecto por defecto.

## Mapeo dominio → agente

| `dominio=` | Agente (`subagent_type`) |
|---|---|
| `calculo` | `dialux-calc-reviewer` |
| `electrico` | `dialux-electrical-reviewer` |
| `geometria` | `dialux-geometry-reviewer` |
| `dibujo` | `dialux-drawing-reviewer` |
| `normativa` | `dialux-normativa-auditor` |

## Modo completo (sin `dominio` especificado)

Invoca los cinco agentes **en este orden exacto**, uno por uno (no en paralelo: cada agente depende conceptualmente de que los anteriores ya hayan sido considerados, y `dialux-normativa-auditor` necesita los hallazgos de los otros cuatro):

```text
1. dialux-geometry-reviewer    (la geometría es la base; todo lo demás depende de que esté bien)
2. dialux-calc-reviewer        (cálculo luminotécnico depende de geometría correcta)
3. dialux-electrical-reviewer  (cableado depende de áreas/perímetros correctos)
4. dialux-drawing-reviewer     (el plano depende de cálculo y cableado ya considerados)
5. dialux-normativa-auditor    (cierre: verifica trazabilidad normativa de los cuatro anteriores)
```

Para cada invocación, usa el tool `Agent` con `subagent_type` igual al nombre del agente y un prompt que incluya:

- Qué rama/diff/alcance está revisando (si el usuario no lo especifica, asume "el estado actual del working tree" y dilo explícitamente en el prompt del agente).
- El `tipo-proyecto` y `niveles`, si se proveyeron.
- Un pedido explícito de que reporte según el esquema `DialuxReviewFinding` de `.claude/skills/revisar-dialux/references/finding-schema.md`.

Ejecuta las invocaciones **en primer plano** (`run_in_background: false`) y una por una: necesitas el resultado de cada agente antes de decidir el prompt del siguiente (en particular, antes de invocar a `dialux-normativa-auditor`, que debe recibir un resumen de lo que encontraron los otros cuatro).

## Modo por dominio (`dominio=` especificado)

Invoca únicamente el agente correspondiente de la tabla de mapeo, con el mismo criterio de prompt (alcance, tipo-proyecto, niveles, esquema de salida). No invoques a `dialux-normativa-auditor` como parte de un filtro por dominio salvo que `dominio=normativa` se pida explícitamente — ese agente asume que los otros ya corrieron, y si no fue así, adviértelo en su prompt para que no dé por hecho hallazgos que no existen en esta ejecución.

## Consolidación de resultados

Una vez que tengas la salida de todos los agentes invocados, constrúyele al usuario **una sola tabla**, no una por agente:

```text
| Severidad | Dominio | Nivel | Archivo:línea | Resumen | Norma | Estado |
```

Reglas de consolidación:

1. Ordena de mayor a menor severidad (`bloqueante` > `mayor` > `menor` > `informativo`).
2. Si dos agentes reportan el mismo archivo/línea con hallazgos distintos, no los fusiones — son observaciones independientes de dominios distintos, aunque coincida la ubicación.
3. Si un agente no encontró hallazgos nuevos (todo lo que reporta ya era conocido de una sesión anterior), inclúyelo igual en el resumen con una fila o nota indicando "sin hallazgos nuevos — N verificaciones pasaron", para que quede constancia de que sí se ejecutó.
4. Cierra siempre con un recuento: cuántos hallazgos `bloqueante` quedan sin resolver — esa cifra es la que más le importa al usuario dado que este sistema alimenta construcción física real.

## Agregar un dominio nuevo (Fase 11 del plan)

Cuando el sistema crezca hacia un dominio que hoy no cubre ninguno de los cinco agentes (ejemplos futuros: exteriores, vial, luz natural, IFC — ver `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md` fases 16-18), seguir este procedimiento en vez de forzar el dominio nuevo dentro de un agente existente:

1. **Crear un agente nuevo**, no una rama de lógica en uno existente: `.claude/agents/dialux-<dominio>-reviewer.md`, con el mismo formato que los cinco actuales (frontmatter `name`/`description`/`tools`/`model`, principio de solo-auditoría, lectura obligatoria de `normativa-dialux` y `finding-schema.md` al inicio).
2. **Fundamentar el agente en el código real**, no en lo que un plan propone construir — igual que se hizo con los cinco agentes actuales, investigar primero qué existe implementado antes de escribir el checklist (los dry-runs de las Fases 2-6 de este plan mostraron repetidamente que el código real iba por delante o por detrás de lo que el plan de construcción asumía).
3. **Agregar el nuevo dominio a la tabla de mapeo** de este archivo (sección "Mapeo dominio → agente") y a la lista de valores válidos de `dominio=` en "Argumentos aceptados".
4. **Decidir su posición en el orden de invocación** del "Modo completo": ¿depende de la geometría/cálculo/cableado/dibujo ya revisados, o es independiente? Insertarlo en el lugar que corresponda, documentando el porqué (igual que la sección de este archivo ya explica por qué geometría va primero y normativa al final).
5. **No crear una segunda skill orquestadora**: el nuevo agente se suma a la cadena de `revisar-dialux`; no se necesita un `revisar-dialux-exteriores` aparte.
6. **Extender `.claude/skills/revisar-dialux/references/finding-schema.md`** solo si el dominio nuevo necesita un valor de `domain` que hoy no exista en el enum `DialuxReviewFinding.domain` — agregarlo ahí, no inventar un esquema paralelo.

Ningún paso de este procedimiento requiere tocar los cinco agentes existentes ni `normativa-dialux` (salvo que el dominio nuevo también traiga normas propias, en cuyo caso aplica el proceso de `.claude/skills/normativa-dialux/SKILL.md` sección "Mantenimiento continuo").

## Qué NO hace esta skill

- No corrige código por su cuenta; eso lo decide el usuario después de ver los hallazgos, igual que en las fases anteriores de este plan.
- No decide umbrales normativos ni resuelve las discrepancias que `normativa-dialux` deja como `pending-confirmation`.
- No reemplaza `/code-review` ni `/code-review ultra`; es un complemento específico del dominio DIALux — ver `planes/plan_agentes_skills_revision_normativa_dialux.md` §9.3 para el orden recomendado entre ambos.

## Referencias

- [references/finding-schema.md](references/finding-schema.md) — contrato `DialuxReviewFinding` y criterios de severidad (Fase 1).
- `.claude/skills/normativa-dialux/` — base normativa que los agentes consultan antes de citar una norma.
- `planes/plan_agentes_skills_revision_normativa_dialux.md` — plan completo; esta skill implementa su Fase 7.
