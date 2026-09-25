---
name: revisar-emplazamiento
description: Orquesta la revisión del Módulo General / Emplazamiento de DIALux v2 (dibujado 2D/3D, rampas y escaleras que unen plataformas, portones, iluminación exterior, normativa elegida por el cliente). Úsalo cuando el usuario pida "revisar el emplazamiento", "revisar rampas/escaleras/portones", "/revisar-emplazamiento", o antes de una entrega/merge que toque resources/js/pages/dialux/v2/site/. Acepta filtros opcionales dominio=conectividad|render|normativa.
---

# revisar-emplazamiento

Complementa a `/revisar-dialux` (que cubre el editor de interiores) para el Emplazamiento v2. No revisa por sí misma: delega en agentes y consolida.

## Argumentos

`/revisar-emplazamiento [dominio=conectividad|render|normativa]`. Sin argumentos ejecuta los tres, en este orden.

| dominio | agente (`subagent_type`) | qué cubre |
|---|---|---|
| `conectividad` | `dialux-site-connectivity-reviewer` | rampas/escaleras unen plataformas, ajuste al polígono, invasión de vecinos, portones |
| `render` | `dialux-site-render-reviewer` | paridad 2D↔3D, rendimiento, sol/cielo, luminarias exteriores |
| `normativa` | `dialux-normativa-auditor` | ninguna cifra "cumple" sin fuente; regiones EU/EE.UU./Perú; A.120/E.050 como referencia |

## Pasos

1. **Verificación mecánica primero** (no la delegues): `npm run types`, `npm test -- resources/js/pages/dialux/v2/site`, `npx eslint resources/js/pages/dialux/v2/site`. Si algo falla, repórtalo antes de invocar agentes.
2. Invoca los agentes del filtro. `conectividad` y `render` son independientes → en paralelo; `normativa` va DESPUÉS y recibe sus hallazgos (no repite su trabajo).
3. Si el usuario aporta datos reales del proyecto (JSON de `project.site` o una captura), pásaselos a `conectividad` para que calcule `checkLevelLink` sobre cada rampa/escalera.
4. Consolida en UNA tabla: `severidad | dominio | archivo:línea | qué falla | escenario | estado (confirmado / no-evaluado)`. Ordena por severidad. Los hallazgos que solo se ven en el navegador van como `no-evaluado` con instrucciones exactas para que el usuario los compruebe.
5. Cierra con: qué se corrigió (si se pidió), qué queda pendiente y qué debe mirar el usuario a ojo.

## Reglas

- Solo auditoría salvo que el usuario pida aplicar fixes.
- Nunca declares "cumple" por normativa: los valores de `siteNorms` y de los catálogos exteriores están `pending-confirmation`.
- No abras el navegador por iniciativa propia; el usuario prueba y confirma.
