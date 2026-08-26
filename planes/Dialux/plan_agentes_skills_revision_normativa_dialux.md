# Plan maestro de agentes y skills para revisión normativa de DIALux

## 1. Propósito

Este documento define, por fases, la construcción de una **capa de revisión** para el módulo DIALux: un conjunto de agentes especializados de Claude Code (`.claude/agents/*.md`) y skills (`.claude/skills/*/SKILL.md`) cuya única función es **auditar** lo que ya se construye o se está construyendo, no implementarlo.

Los seis planes existentes en `planes/` (arquitectura del motor, resolución del módulo eléctrico, escalado/capas/undo-redo, DXF por nivel, caída de tensión, réplica del informe) definen **qué construir**. Ninguno define **quién revisa que lo construido sea correcto y esté ligado a norma** antes de aceptarlo como profesional. Ese es el vacío que cierra este plan.

La regla principal, heredada de `plan_maestro_dialux_web_motor_arquitectura_validacion.md`, se extiende aquí a la revisión:

> Ningún hallazgo de revisión puede aprobar una pantalla, cálculo o plano como conforme si no cita la norma, la edición y el artículo exactos que sustentan esa conformidad.

Este plan **no crea código todavía**. Su entregable es el diseño: qué agentes existen, qué revisa cada uno, con qué normativa, en qué fase se implementan y cómo se orquestan. La implementación de cada agente/skill se ejecuta en un ciclo posterior, uno por fase, siguiendo este documento.

## 2. Relación con los planes existentes

| Plan existente | Dominio que construye | Vacío de revisión que deja |
|---|---|---|
| `plan_maestro_dialux_web_motor_arquitectura_validacion.md` | Motor de cálculo, snapshots, solvers, UGR | Define tolerancias y contratos, pero no un agente que verifique en cada cambio que el solver sigue citando fuente/norma |
| `plan_resolucion_dialux_claude_codex.md` | Luminarias, tomacorrientes, circuitos, tableros, alimentadores, metrados | Reglas configurables (RN-01 a RN-07), pero sin revisor que confirme que cada regla nueva tiene respaldo normativo antes de mezclarse en código |
| `plan_fases_dialux_escalado_capas_undo_redo.md` | Escala real, entidades, capas, selección, historial | Pruebas de escala/selección, pero sin revisor que audite construcción de objetos en proyectos multinivel reales antes de merge |
| `plan_maestro_planos_dxf_por_nivel_marcos_leyendas.md` | Exportación DXF por nivel, marcos, leyendas | Matriz de aceptación del exportador, pero sin agente que revise cada nuevo plano contra la clasificación de capas/especialidad antes de entregarlo |
| `plan_caida_tension.md` | Motor de máxima demanda, caída de tensión, tableros jerárquicos | Fórmulas trazadas al Excel, pero sin revisor que confirme los límites (4 %/2.5 %/1 %) contra la norma vigente del proyecto, no contra el Excel de origen |
| `plan_replica_informe_luminotecnico_modulo_i.md` | Informe PDF formal | Evaluador normativo triestado, pero sin agente que valide que el informe generado no imprime un cumplimiento sin fuente citada |

Conclusión: cada plan produce **funcionalidad**; este plan produce **el mecanismo que impide que esa funcionalidad se acepte sin trazabilidad normativa**. Los agentes definidos aquí deben leerse en conjunto con esos planes: no repiten sus fórmulas, las **auditan**.

## 3. Problema a resolver

El sistema abarca cuatro procesos que hoy se revisan de forma manual e implícita:

1. **Cálculos**: luminotécnicos (lux, UGR, uniformidad) y eléctricos (demanda máxima, calibres, caída de tensión, protecciones).
2. **Construcción de objetos**: geometría, escala, jerarquía de entidades (recinto → ambiente → dispositivo), niveles.
3. **Proceso de dibujo**: capas, símbolos, leyendas, marcos, exportación DXF/PDF.
4. **Cableado**: tomacorrientes y luminarias — circuitos, conductores, tableros, alimentadores.

Estos cuatro dominios se repiten para **N pisos** (edificios de varios niveles) y para **distintos tipos de proyecto** (industrial, vivienda, educación), cada uno con exigencias normativas distintas de iluminancia mínima, protección, tomacorrientes por área y clasificación de ambientes. Sin una capa de revisión explícita:

- Un cambio en el motor de cálculo puede romper silenciosamente la tolerancia de un tipo de proyecto y no de otro.
- Una regla eléctrica válida para vivienda puede aplicarse por error a un ambiente industrial.
- Un plano de un piso puede exportarse con la escala o capa equivocada sin que nadie lo note hasta la entrega.
- Un informe puede mostrar "cumple" sin que exista norma configurada detrás.

## 4. Alcance y no alcance

### 4.1. Alcance

- Diseño de agentes de revisión (no de construcción) para los cuatro dominios.
- Diseño de skills que orquestan esos agentes y que sirven como referencia normativa consultable.
- Cobertura explícita de proyectos de 1 a N pisos.
- Cobertura explícita de tres tipologías iniciales: industrial, vivienda, educación (ampliable).
- Vinculación obligatoria a fuentes normativas identificadas por edición y artículo.
- Formato de hallazgo estandarizado, reutilizable por todos los agentes.

### 4.2. No alcance de este plan

- No implementa el motor de cálculo (ya cubierto por `plan_maestro_dialux_web_motor_arquitectura_validacion.md`).
- No implementa las reglas eléctricas (ya cubiertas por `plan_resolucion_dialux_claude_codex.md` y `plan_caida_tension.md`).
- No decide todavía el texto legal exacto de cada norma; eso se resuelve en la Fase 0 con un especialista.
- No sustituye la revisión de un ingeniero colegiado responsable del proyecto; es una capa de apoyo técnico, no una certificación profesional.

## 5. Taxonomía de dominios de revisión

Cada agente cubre exactamente un dominio. Ningún agente debe mezclar responsabilidades, siguiendo el mismo principio de "una razón para cambiar" de `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §3.2.

### 5.1. Cálculo luminotécnico

- Fórmula de cantidad de luminarias (`N = E×A / (F×CU×FM)`).
- Iluminancia media/mínima/máxima, uniformidad, UGR.
- Factor de mantenimiento y coeficiente de utilización usados.
- Coherencia entre iluminancia requerida por tipo de ambiente y la norma vigente del proyecto.
- Procedencia del motor: si el resultado es `direct-preview-v1`, no debe presentarse como validado.

### 5.2. Cálculo eléctrico y de cableado

- Cálculo de tomacorrientes por área/perímetro/uso.
- Circuitos de alumbrado y tomacorrientes: calibres, protecciones.
- Tableros jerárquicos, alimentadores, factor de demanda/simultaneidad.
- Caída de tensión por tramo y acumulada (2.5 %/4 %/1 % según punto del árbol).
- Metrados derivados de lo anterior.

### 5.3. Construcción de objetos

- Escala real vs. escala dibujada (tolerancia de `plan_fases_dialux_escalado_capas_undo_redo.md`).
- Jerarquía de entidades (`site → building → floor → enclosure → room → device`).
- Identidad independiente por objeto, sin eliminación en cascada implícita.
- Consistencia geométrica entre niveles (que un piso no herede por error la geometría de otro).
- Historial de cambios no debe corromper relaciones padre-hijo.

### 5.4. Proceso de dibujo

- Capas funcionales correctas (`10_ENCLOSURES`, `30_LUMINAIRES`, `40_OUTLETS`, etc.).
- Símbolo idéntico entre planta y leyenda.
- Marco, cajetín, escala de impresión y unidades correctos por lámina.
- Separación de especialidades (alumbrado vs. tomacorrientes) sin mezcla.
- Extensión global (`$EXTMIN/$EXTMAX`) y ausencia de solapes entre láminas.

### 5.5. Multi-nivel (N pisos) — transversal

No es un dominio aparte, es una dimensión que atraviesa los cuatro anteriores. Todo agente debe poder responder, para cada hallazgo: **¿en qué nivel ocurre y se repite en otros niveles?** Esto se implementa como un campo obligatorio `nivel` en el esquema de hallazgo (sección 10), no como un agente nuevo.

### 5.6. Tipología de proyecto — transversal

Igual que el punto anterior: industrial, vivienda y educación no son agentes distintos, son **perfiles normativos** que cualquier agente carga según el tipo de proyecto declarado. Ver sección 6 y 9.2.

## 6. Marco normativo a vincular

Tabla de referencia inicial. Los textos exactos, ediciones y artículos deben confirmarse con un especialista antes de la Fase 0; aquí se documenta la fuente y el dominio que cubre, no el valor final.

| Fuente | Ámbito | Dominio principal | Aplica a |
|---|---|---|---|
| Código Nacional de Electricidad — Utilización (Perú) | Instalaciones interiores, tomacorrientes, calibres, protecciones, caída de tensión | Cálculo eléctrico y cableado | Todos los tipos |
| Código Nacional de Electricidad — Suministro (Perú) | Acometidas, tableros generales | Cálculo eléctrico | Todos los tipos |
| RNE EM.010 — Instalaciones Eléctricas Interiores | Diseño eléctrico interior | Cálculo eléctrico y cableado | Todos los tipos |
| RNE A.010 — Condiciones generales de diseño | Alturas, áreas, circulación | Construcción de objetos | Todos los tipos |
| RNE A.020 — Vivienda | Iluminación y tomacorrientes mínimos en vivienda | Cálculo luminotécnico y eléctrico | Vivienda |
| RNE A.040 — Educación | Iluminancia por tipo de aula, requisitos de emergencia | Cálculo luminotécnico y eléctrico | Educación |
| RNE A.060 / A.090 — Industria y comercio | Iluminancia de procesos, tomacorrientes industriales | Cálculo luminotécnico y eléctrico | Industrial |
| RNE A.130 — Requisitos de seguridad | Alumbrado de emergencia, señalización | Cálculo luminotécnico (emergencia) | Todos los tipos |
| EN 12464-1 | Iluminación de lugares de trabajo interiores | Cálculo luminotécnico | Referencia comparativa, todos los tipos |
| EN 1838 | Alumbrado de emergencia | Cálculo luminotécnico (emergencia) | Referencia comparativa, todos los tipos |
| IES Lighting Handbook | Buenas prácticas de diseño luminotécnico | Cálculo luminotécnico | Referencia comparativa |

Regla obligatoria: ningún agente puede citar una norma sin edición y artículo. Si el dato no está confirmado, el hallazgo debe marcarse como `no-evaluado`, nunca como `conforme` por defecto (mismo principio que `RequirementEvaluation.status` en `plan_replica_informe_luminotecnico_modulo_i.md` §7.3).

## 7. Principios de diseño de agentes y skills

1. **Un agente, un dominio.** Ningún agente revisa cálculo y dibujo a la vez.
2. **Solo lectura por defecto.** Los agentes de revisión no editan código ni datos del proyecto salvo que el usuario pida explícitamente una corrección; su salida es un listado de hallazgos.
3. **Cita obligatoria.** Todo hallazgo que invoque una norma debe incluir fuente, edición y artículo/tabla. Si no puede citarse, se reporta como advertencia de "norma no configurada", no como aprobación.
4. **Reutilizar contratos existentes.** Los agentes deben leer `CalculationSnapshot`, `CalculationRun`, `RequirementEvaluation` y el `DxfDrawingPackage`/`LightingReportDocument` definidos en los planes existentes; no inventan un modelo de datos paralelo.
5. **Trazabilidad por nivel y tipología.** Cada hallazgo declara nivel(es) afectado(s) y tipo de proyecto, incluso si es "todos".
6. **Nunca aprobar en silencio.** Un dominio sin datos suficientes se reporta como `not-evaluated`, igual que en el evaluador normativo del informe PDF.
7. **Severidad explícita.** Todo hallazgo tiene severidad (`bloqueante`, `mayor`, `menor`, `informativo`) y un escenario de falla concreto, no una observación abstracta.
8. **Agentes efímeros de auditoría, no de mantenimiento.** Se invocan bajo demanda (antes de un merge, tras una fase, o en preparación de entrega), no corren en segundo plano de forma continua.

## 8. Arquitectura de agentes (Claude Code subagents)

Cada agente es un archivo `.claude/agents/<nombre>.md` con frontmatter (`name`, `description`, `tools`, `model`) y un cuerpo de instrucciones. Se implementan en las fases 2 a 6 de este plan (sección 11), uno por fase, nunca todos a la vez.

### 8.1. `dialux-calc-reviewer` — revisor de cálculo luminotécnico

- **Responsabilidad**: verificar que toda cifra de iluminancia, UGR, uniformidad y cantidad de luminarias mostrada al usuario tenga procedencia (`engineVersion`, modo, warnings) y cumpla la tolerancia declarada en `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §10.
- **Se invoca**: al cerrar una fase del motor de cálculo, al modificar `LightingCalculator`/solvers, o antes de un `/code-review` sobre esos archivos.
- **Entradas**: `CalculationSnapshot`, `CalculationRun`, fixtures de referencia (analíticos y MÓDULO I).
- **Verifica**:
  - La fórmula `N = E×A/(F×CU×FM)` y su inversa se aplican con redondeo correcto y unidades declaradas.
  - El resultado indica modo (`preview`/`standard`/`high`) y no se presenta un preview como validado.
  - La iluminancia requerida por ambiente corresponde al perfil normativo cargado para el tipo de proyecto (vivienda/educación/industrial).
  - UGR y uniformidad reportan observador/dirección o declaran no aplicable.
  - Comparación contra casos analíticos y golden tests no regresiona tolerancias aprobadas.
- **No hace**: no modifica el solver, no decide nuevas tolerancias sin aprobación humana.
- **Herramientas**: lectura de código y fixtures, ejecución de tests (`Bash`/`Read`/`Grep`), sin `Edit`/`Write` salvo modo explícito de corrección.
- **Modelo recomendado**: razonamiento medio-alto; el trabajo es de verificación numérica y normativa, no de generación creativa.

### 8.2. `dialux-electrical-reviewer` — revisor de cálculo eléctrico y cableado

- **Responsabilidad**: auditar tomacorrientes, circuitos, conductores, tableros, alimentadores y caída de tensión contra `plan_resolucion_dialux_claude_codex.md` y `plan_caida_tension.md`.
- **Se invoca**: al modificar `OutletCalculator`, `CircuitCalculator`, `FeederCalculator`, `VoltageDropCalculator`, `PanelCalculator`, o el árbol de tableros.
- **Entradas**: entidades `Tablero`, `Circuito`, `Alimentador`, `Conductor`, catálogos de ampacidad (Tabla A) y diámetros (Tabla B) de `plan_caida_tension.md`.
- **Verifica**:
  - Reglas configurables de tomacorrientes (área/perímetro) no están hardcodeadas en código.
  - Calibre elegido cubre corriente de diseño, agrupamiento y temperatura (factores `V`/`W`).
  - Caída de tensión respeta el límite por tipo de fila (2.5 % tablero, 4 % circuito final, 1 % alimentador general) y el orden topológico padre→hijo.
  - Un circuito que en realidad alimenta un sub-tablero hereda `J/P/Q/R` del tablero hijo, no valores propios.
  - El AWG/mm² se guarda como sección real, no solo como referencia textual.
- **No hace**: no decide el límite normativo definitivo si aún está pendiente de confirmación (sección 12 de `plan_caida_tension.md`); lo marca como decisión abierta.
- **Herramientas**: `Read`/`Grep`/`Bash` para ejecutar tests unitarios del motor eléctrico.
- **Modelo recomendado**: razonamiento alto; requiere seguir árboles jerárquicos de tableros y verificar orden de cálculo.

### 8.3. `dialux-geometry-reviewer` — revisor de construcción de objetos

- **Responsabilidad**: auditar escala, jerarquía de entidades, capas semánticas y comportamiento multinivel según `plan_fases_dialux_escalado_capas_undo_redo.md`.
- **Se invoca**: al modificar el editor 2D/3D, el modelo de entidades, el sistema de capas o el historial de comandos.
- **Entradas**: proyecto de prueba con planos importados, entidades dibujadas, varios niveles.
- **Verifica**:
  - El área calculada coincide con el área del CAD de referencia dentro de tolerancia (no un factor fijo aplicado ad hoc).
  - Cada entidad tiene ID independiente y `parentId`; eliminar un hijo no elimina al contenedor.
  - Las capas bloqueables/ocultables funcionan y el plano CAD de referencia no es editable por defecto.
  - Deshacer/rehacer conserva escala, jerarquía y no duplica ni pierde entidades tras 100+ operaciones.
  - Un proyecto de N pisos mantiene cada nivel con su propia geometría, sin fuga de datos entre escenas.
- **No hace**: no decide el rediseño del editor; reporta desviaciones respecto al contrato ya definido.
- **Herramientas**: `Read`/`Grep`, ejecución de pruebas Vitest de geometría/selección/historial.
- **Modelo recomendado**: razonamiento medio; el trabajo es principalmente checklist contra pruebas ya definidas.

### 8.4. `dialux-drawing-reviewer` — revisor del proceso de dibujo y exportación

- **Responsabilidad**: auditar capas DXF, símbolos, leyendas, marcos y separación de especialidades según `plan_maestro_planos_dxf_por_nivel_marcos_leyendas.md`.
- **Se invoca**: al modificar el exportador DXF/PDF, el catálogo de símbolos o la composición de láminas.
- **Entradas**: `DxfDrawingPackage`, fixtures de uno, tres y diez niveles.
- **Verifica**:
  - Cada nivel produce lámina de alumbrado y de tomacorrientes por separado, sin mezclar dispositivos de otra especialidad.
  - El símbolo de la leyenda es el mismo renderer/bloque que el símbolo en planta.
  - El marco declara escala, nivel, especialidad y número de lámina, y la escala corresponde matemáticamente al tamaño de papel.
  - No existen solapes entre `frameBounds` de distintas láminas ni pisos.
  - Conductores `unclassified` generan advertencia visible, nunca se ocultan.
- **No hace**: no decide nuevos formatos de papel o escalas sin aprobación; usa el catálogo ya definido.
- **Herramientas**: `Read`/`Grep`/`Bash`, parseo del DXF resultante con el parser existente del proyecto.
- **Modelo recomendado**: razonamiento medio-alto.

### 8.5. `dialux-normativa-auditor` — auditor normativo cruzado

- **Responsabilidad**: agente de cierre. No repite el trabajo de los cuatro anteriores; verifica que **todo hallazgo o cifra "conforme" del sistema tenga una norma citada con edición y artículo**, y que el perfil normativo cargado corresponda al tipo de proyecto declarado (industrial/vivienda/educación).
- **Se invoca**: antes de una entrega formal, antes de generar el informe PDF final, o cuando cambie el repositorio de normativa (`infrastructure/normative/` en el plan maestro).
- **Entradas**: salida de los cuatro agentes anteriores, repositorio normativo versionado, `LightingReportDocument`.
- **Verifica**:
  - No hay ninguna evaluación `pass` sin `source`/`requiredValue` explícitos.
  - El perfil normativo usado coincide con el tipo de proyecto (p. ej. no se aplica la iluminancia de oficina a un aula).
  - Las normas citadas tienen edición vigente y no una versión derogada.
  - El informe no afirma paridad con DIALux u otra certificación que no se sostiene (`plan_maestro` §20, §23).
- **No hace**: no redacta la norma; solicita al usuario la confirmación cuando el texto no está disponible en el repositorio normativo.
- **Herramientas**: `Read`/`Grep`, sin ejecución de motor de cálculo.
- **Modelo recomendado**: razonamiento alto; es el agente con mayor responsabilidad de "no dejar pasar" una afirmación sin sustento.

### 8.6. Orden de invocación recomendado

```text
dialux-geometry-reviewer   (la geometría es la base de todo lo demás)
        ↓
dialux-calc-reviewer       (cálculo luminotécnico depende de geometría correcta)
        ↓
dialux-electrical-reviewer (cableado depende de áreas/perímetros correctos)
        ↓
dialux-drawing-reviewer    (el plano depende de cálculo y cableado ya validados)
        ↓
dialux-normativa-auditor   (cierre: toda cifra citada tiene norma y perfil correcto)
```

No tiene sentido ejecutar el auditor normativo si la geometría de base aún no fue validada: heredaría hallazgos falsos.

## 9. Arquitectura de skills

Las skills viven en `.claude/skills/<nombre>/SKILL.md` y cumplen dos roles distintos: **orquestar** agentes y **servir de referencia** consultable.

### 9.1. `revisar-dialux` (skill orquestador)

- Invocable como `/revisar-dialux [dominio] [tipo-proyecto] [niveles]`.
- Sin argumentos: ejecuta los cinco agentes en el orden de la sección 8.6 sobre el diff/rama actual, igual que `/code-review` pero acotado al dominio DIALux.
- Con `dominio=calculo|electrico|geometria|dibujo|normativa`: invoca solo el agente correspondiente.
- Con `tipo-proyecto=industrial|vivienda|educacion`: carga el perfil normativo de esa tipología antes de invocar los agentes (ver 9.2).
- Con `niveles=N`: exige que los agentes reporten hallazgos por nivel cuando el proyecto tenga más de un piso.
- Reporta resultados con el mismo formato tabular usado por `/code-review` (severidad, archivo, resumen, escenario de falla), pero exige además el campo `norma` cuando aplique.

### 9.2. `normativa-dialux` (skill de referencia)

- No ejecuta agentes; es una base de consulta que cualquier agente puede cargar.
- Contiene la tabla de la sección 6 en forma estructurada: fuente, edición, artículo, dominio, tipo de proyecto aplicable, valor umbral (cuando esté confirmado).
- Se actualiza únicamente en la Fase 0 y cuando cambie una edición normativa (Fase 11).
- Los agentes de la sección 8 la consultan por keyword (tipo de proyecto + dominio) antes de emitir un hallazgo que cite norma.

### 9.3. Integración con `/code-review` y `/code-review ultra`

- `revisar-dialux` es complementario, no sustituye la revisión de calidad general de `/code-review`.
- Antes de lanzar `/code-review ultra` sobre una rama que toca `resources/js/pages/dialux/`, se recomienda ejecutar primero `/revisar-dialux` para que la revisión de calidad general no tenga que repetir verificación normativa.
- El agente `dialux-normativa-auditor` puede ejecutarse como paso final antes de una entrega, igual que un gate de calidad adicional al pipeline de CI descrito en `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §15.

## 10. Contrato de salida (esquema de hallazgo)

Todos los agentes de la sección 8 devuelven hallazgos con esta forma común, para que `revisar-dialux` pueda consolidarlos:

```ts
interface DialuxReviewFinding {
    domain: 'calculo' | 'electrico' | 'geometria' | 'dibujo' | 'normativa';
    projectType: 'industrial' | 'vivienda' | 'educacion' | 'todos';
    level: string | 'todos' | 'no-aplica';
    severity: 'bloqueante' | 'mayor' | 'menor' | 'informativo';
    file: string;
    line?: number;
    summary: string;
    failureScenario: string;
    norm?: {
        source: string;
        edition: string;
        articleOrTable: string;
    };
    status: 'confirmado' | 'plausible' | 'no-evaluado';
}
```

Reglas:

- Si `norm` está ausente y el hallazgo depende de un umbral normativo, `status` debe ser `no-evaluado`, nunca `confirmado`.
- `level` es obligatorio en proyectos de más de un piso; `'todos'` solo si el hallazgo se repite idénticamente en cada nivel verificado.
- `failureScenario` debe describir una entrada concreta y su consecuencia, no una observación abstracta (mismo estándar que `ReportFindings` usado en revisiones de código de este entorno).

## 11. Plan de implementación por fases

No se debe iniciar una fase sin cerrar los criterios de la anterior. La implementación real de cada agente/skill ocurre en su fase; este documento no los crea.

### Fase 0 — Inventario normativo y taxonomía confirmada

**Objetivo**: convertir la tabla de la sección 6 en datos verificados, no supuestos.

**Actividades**:
1. Confirmar con un especialista eléctrico/luminotécnico la edición vigente de cada norma listada.
2. Completar artículo/tabla exacto para cada umbral usado hoy en el código (iluminancia mínima por ambiente, calibres, límites de caída de tensión).
3. Confirmar qué normas aplican a cada tipo de proyecto (industrial/vivienda/educación) y documentar excepciones.
4. Registrar supuestos aún no confirmados como `pending-confirmation`, nunca como valor definitivo.

**Entregables**: `normativa-dialux/reference.md` con la tabla completa y su estado de confirmación.

**Criterio de cierre**: cada norma tiene edición y artículo, o está marcada explícitamente como pendiente.

### Fase 1 — Contrato de hallazgos y esquema de severidad

**Objetivo**: fijar el esquema de la sección 10 como contrato estable antes de escribir el primer agente.

**Actividades**:
1. Formalizar `DialuxReviewFinding` como tipo TypeScript o documento de referencia.
2. Definir criterios objetivos para cada severidad (qué hace que algo sea `bloqueante` vs. `mayor`).
3. Acordar el formato de salida legible (tabla) que usará `revisar-dialux` para consolidar hallazgos de varios agentes.

**Entregables**: contrato documentado, ejemplo de salida consolidada con hallazgos ficticios de los cinco dominios.

**Criterio de cierre**: dos hallazgos de dominios distintos pueden combinarse en una sola tabla sin ambigüedad.

### Fase 2 — Agente `dialux-calc-reviewer`

**Objetivo**: primer agente implementado, el de menor dependencia de los demás dominios salvo geometría.

**Actividades**:
1. Escribir `.claude/agents/dialux-calc-reviewer.md` con la responsabilidad de la sección 8.1.
2. Probarlo contra el fixture MÓDULO I y contra los casos analíticos de `plan_maestro_dialux_web_motor_arquitectura_validacion.md` §10.1.
3. Ajustar hasta que no reporte falsos positivos contra un cálculo ya validado.

**Criterio de cierre**: el agente detecta al menos un caso conocido de tolerancia incumplida en un fixture de prueba deliberadamente incorrecto, y no reporta nada en un fixture correcto.

### Fase 3 — Agente `dialux-electrical-reviewer`

**Objetivo**: cubrir cableado, tomacorrientes, tableros y caída de tensión.

**Actividades**:
1. Escribir el agente con la responsabilidad de 8.2.
2. Probarlo contra los casos golden de `plan_caida_tension.md` §7.4 (fila de circuito, fila CG, fila de alimentador general).
3. Verificar que detecta el caso de "circuito que en realidad es sub-tablero" (§4.6 de ese plan) cuando se implemente incorrectamente.

**Criterio de cierre**: el agente distingue correctamente un circuito normal de uno que hereda de un tablero hijo, y marca como `no-evaluado` cualquier límite de caída de tensión no confirmado en Fase 0.

### Fase 4 — Agente `dialux-geometry-reviewer`

**Objetivo**: cubrir escala, jerarquía y comportamiento multinivel.

**Actividades**:
1. Escribir el agente con la responsabilidad de 8.3.
2. Probarlo contra el caso de referencia 40.096 m² vs. 44.540 m² de `plan_fases_dialux_escalado_capas_undo_redo.md`.
3. Confirmar que detecta eliminación en cascada indebida y pérdida de jerarquía tras undo/redo.

**Criterio de cierre**: el agente marca como hallazgo bloqueante cualquier caso donde eliminar un dispositivo borre su ambiente o recinto.

### Fase 5 — Agente `dialux-drawing-reviewer`

**Objetivo**: cubrir capas, símbolos, leyendas y marcos del exportador DXF.

**Actividades**:
1. Escribir el agente con la responsabilidad de 8.4.
2. Probarlo contra los fixtures A, B, C y D de `plan_maestro_planos_dxf_por_nivel_marcos_leyendas.md` §20.
3. Confirmar que detecta mezcla de especialidades y símbolos inconsistentes entre planta y leyenda.

**Criterio de cierre**: el agente rechaza una lámina donde la leyenda de alumbrado contiene un símbolo de tomacorriente.

### Fase 6 — Agente `dialux-normativa-auditor`

**Objetivo**: agente de cierre que verifica trazabilidad normativa de punta a punta.

**Actividades**:
1. Escribir el agente con la responsabilidad de 8.5, consumiendo la salida de los cuatro agentes anteriores.
2. Probarlo contra un informe con al menos un "cumple" sin norma configurada, deliberadamente inyectado.
3. Confirmar que distingue perfiles normativos por tipo de proyecto (usar un umbral de vivienda en un aula debe reportarse como error).

**Criterio de cierre**: ningún hallazgo `confirmado` del conjunto de agentes carece de cita normativa cuando el hallazgo depende de un umbral.

### Fase 7 — Skill orquestador `revisar-dialux`

**Objetivo**: unificar la invocación de los cinco agentes.

**Actividades**:
1. Escribir `.claude/skills/revisar-dialux/SKILL.md` con el comportamiento de la sección 9.1.
2. Implementar el orden de invocación de 8.6.
3. Probar invocación completa, por dominio individual, y con filtro de tipo de proyecto y niveles.

**Criterio de cierre**: `/revisar-dialux` sin argumentos ejecuta los cinco agentes en orden y consolida hallazgos en una sola tabla legible.

### Fase 8 — Skill de referencia `normativa-dialux`

**Objetivo**: dar a los agentes una fuente única de normas consultable.

**Actividades**:
1. Escribir `.claude/skills/normativa-dialux/SKILL.md` con la tabla confirmada en la Fase 0.
2. Conectar los cinco agentes para que consulten esta skill antes de citar una norma.
3. Documentar el proceso de actualización cuando cambie una edición normativa.

**Criterio de cierre**: ningún agente cita una norma que no esté en `normativa-dialux`; si falta, reporta `no-evaluado` en lugar de inventar el dato.

### Fase 9 — Integración con `/code-review` y CI

**Objetivo**: que la revisión normativa forme parte del flujo habitual de calidad, no un paso aislado.

**Actividades**:
1. Documentar en `CLAUDE.md` (o equivalente del proyecto) cuándo ejecutar `/revisar-dialux` antes de `/code-review ultra`.
2. Evaluar, sin obligar, la posibilidad de un gate de CI que recuerde ejecutar la revisión normativa en PRs que toquen `resources/js/pages/dialux/`.
3. No automatizar bloqueo de merge sin acuerdo explícito del equipo (esto es una herramienta de apoyo, no un gate obligatorio salvo que se decida lo contrario).

**Criterio de cierre**: el flujo de trabajo documentado indica claramente el orden recomendado entre revisión normativa y revisión de calidad general.

### Fase 10 — Piloto con MÓDULO I (caso real, educación, 3 niveles)

**Objetivo**: validar los cinco agentes contra un proyecto real antes de darlos por completos.

**Actividades**:
1. Ejecutar `/revisar-dialux` completo sobre el proyecto MÓDULO I (educación, 3 niveles, 24 ambientes).
2. Registrar cada hallazgo y clasificarlo como verdadero positivo, falso positivo o falso negativo conocido.
3. Ajustar agentes hasta que la tasa de falsos positivos sea aceptable para el equipo.
4. Repetir con un proyecto ficticio de tipo industrial y uno de tipo vivienda para confirmar que el perfil normativo cambia correctamente según tipología.

**Criterio de cierre**: los tres tipos de proyecto (educación, industrial, vivienda) producen hallazgos con el perfil normativo correcto y sin falsos positivos evidentes.

### Fase 11 — Mantenimiento y actualización normativa

**Objetivo**: evitar que la capa de revisión quede desactualizada.

**Actividades**:
1. Definir una cadencia de revisión de ediciones normativas (p. ej. anual o ante cambio de norma conocido).
2. Documentar el proceso para agregar un nuevo tipo de proyecto (p. ej. salud, comercio) sin duplicar agentes.
3. Documentar el proceso para agregar un nuevo dominio de revisión si el sistema crece (p. ej. exteriores, vial, cuando esos planes avancen).

**Criterio de cierre**: agregar un tipo de proyecto nuevo requiere solo actualizar `normativa-dialux`, no reescribir agentes.

## 12. Matriz de responsabilidad (dominio × agente × plan de origen)

| Dominio | Agente | Plan que define la funcionalidad auditada |
|---|---|---|
| Cálculo luminotécnico | `dialux-calc-reviewer` | `plan_maestro_dialux_web_motor_arquitectura_validacion.md`, `plan_replica_informe_luminotecnico_modulo_i.md` |
| Cálculo eléctrico y cableado | `dialux-electrical-reviewer` | `plan_resolucion_dialux_claude_codex.md`, `plan_caida_tension.md` |
| Construcción de objetos | `dialux-geometry-reviewer` | `plan_fases_dialux_escalado_capas_undo_redo.md` |
| Proceso de dibujo | `dialux-drawing-reviewer` | `plan_maestro_planos_dxf_por_nivel_marcos_leyendas.md` |
| Trazabilidad normativa | `dialux-normativa-auditor` | Transversal a todos los anteriores |

## 13. Casos de prueba obligatorios por agente

### `dialux-calc-reviewer`

- Caso A de `plan_resolucion_dialux_claude_codex.md` §Fase 2 (40 m², 300 lux, 3600 lm, CU 0.60, FM 0.80).
- Caso con motor marcado `direct-preview-v1` presentado como resultado validado (debe reportarse como bloqueante).
- Ambiente educativo con iluminancia de perfil vivienda aplicado por error.

### `dialux-electrical-reviewer`

- Aula de 48 m² (regla de tomacorrientes por área).
- Exterior con perímetro de 50 m (regla por perímetro).
- Fila CG con caída de tensión que no suma la caída acumulada del tablero padre.
- Circuito que en realidad es un sub-tablero sin `tablero_origen_id`.

### `dialux-geometry-reviewer`

- Recinto de referencia 40.096 m² dibujado con error de escala.
- Eliminación de un interruptor superpuesto a un ambiente.
- Cien operaciones de historial consecutivas sin pérdida de entidades.

### `dialux-drawing-reviewer`

- Proyecto de tres niveles con un nivel sin tomacorrientes.
- Símbolo de leyenda que no coincide con el símbolo en planta.
- Conductor sin clasificación de especialidad.

### `dialux-normativa-auditor`

- Informe con un "cumple" sin `source` configurado.
- Perfil normativo de industria aplicado a un ambiente de vivienda.
- Norma citada con edición derogada.

## 14. Riesgos y controles

### Riesgo 1 — Agentes que aprueban por defecto

**Control**: todo hallazgo sin cita normativa completa se marca `no-evaluado`, nunca `confirmado` (sección 7, principio 6).

### Riesgo 2 — Mezclar dominios en un solo agente

**Control**: un agente, un dominio (sección 7, principio 1); si un cambio de código toca dos dominios, se invocan dos agentes, no se combina la responsabilidad.

### Riesgo 3 — Normativa desactualizada u obsoleta

**Control**: Fase 11 define cadencia de revisión; `normativa-dialux` centraliza la fuente única.

### Riesgo 4 — Confundir tipo de proyecto y aplicar umbral equivocado

**Control**: `projectType` es campo obligatorio del hallazgo; `dialux-normativa-auditor` verifica explícitamente esta coincidencia en la Fase 6.

### Riesgo 5 — Falsos positivos que erosionen la confianza en la herramienta

**Control**: Fase 10 exige piloto real con clasificación explícita de falsos positivos antes de considerar completo un agente.

### Riesgo 6 — Bloquear el flujo de trabajo del equipo

**Control**: `revisar-dialux` es una herramienta de apoyo invocable bajo demanda, no un gate obligatorio de CI salvo decisión explícita del equipo (Fase 9).

## 15. Qué no hacer

- No implementar los cinco agentes en una sola fase; cada uno se valida por separado.
- No inventar un umbral normativo cuando la Fase 0 no lo confirmó; reportarlo como pendiente.
- No mezclar el agente de cálculo con el de cableado aunque ambos dependan de geometría.
- No convertir `revisar-dialux` en un gate de CI obligatorio sin acuerdo explícito del equipo.
- No duplicar en los agentes las fórmulas ya definidas en los planes de construcción; los agentes verifican contra esas fórmulas, no las reimplementan.
- No presentar un hallazgo de un agente como certificación profesional; sigue siendo apoyo técnico, no reemplazo del ingeniero responsable.

## 16. Definición de terminado

Este plan se considera implementado cuando:

- Los cinco agentes (`dialux-calc-reviewer`, `dialux-electrical-reviewer`, `dialux-geometry-reviewer`, `dialux-drawing-reviewer`, `dialux-normativa-auditor`) existen en `.claude/agents/` y pasan sus casos de prueba obligatorios (sección 13).
- Las dos skills (`revisar-dialux`, `normativa-dialux`) existen en `.claude/skills/` y la primera orquesta correctamente a los cinco agentes en el orden de la sección 8.6.
- La tabla normativa de la sección 6 está confirmada por un especialista, con edición y artículo, o explícitamente marcada como pendiente.
- El piloto de la Fase 10 se ejecutó sobre MÓDULO I y sobre un proyecto ficticio industrial y uno de vivienda, con perfiles normativos correctos en los tres casos.
- Ningún hallazgo del sistema completo se presenta como `confirmado` sin cita normativa cuando depende de un umbral.
- El proceso de agregar un nuevo tipo de proyecto o un nuevo dominio está documentado y no requiere reescribir agentes existentes.

## 17. Primer incremento recomendado

No escribir los cinco agentes a la vez. El primer ciclo de trabajo debe cubrir únicamente:

1. Fase 0: confirmar con el especialista al menos las normas de iluminancia mínima por tipo de ambiente y los tres límites de caída de tensión (2.5 %/4 %/1 %), que ya aparecen como decisión pendiente en `plan_caida_tension.md` §7.6.
2. Fase 1: fijar el contrato `DialuxReviewFinding`.
3. Fase 2: implementar y validar `dialux-calc-reviewer` únicamente, contra el fixture MÓDULO I.

Solo después de que ese primer agente detecte correctamente un caso conocido de incumplimiento y no reporte falsos positivos en un caso correcto, se continúa con el siguiente agente en el orden de la sección 8.6.
