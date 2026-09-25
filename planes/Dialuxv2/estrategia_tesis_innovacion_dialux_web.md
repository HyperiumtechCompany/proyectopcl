# Estrategia de tesis: qué innova el sistema frente a DIALux y cómo demostrarlo

> Documento de trabajo (2026-09-24). Responde tres preguntas: **¿cuál es la innovación?**, **¿cuál es el objetivo medible?** y **¿qué hay que construir para que lo que toma 1 día en el flujo tradicional tome medio día?**. Las cifras marcadas "a medir" NO son resultados: son lo que el estudio de tiempos debe producir.

---

## 1. Diagnóstico honesto

Si la tesis dice "es un DIALux, pero web", el jurado preguntará lo obvio: **DIALux evo es gratuito, maduro y tiene más funciones luminotécnicas**. Competir en "más funciones de iluminación" es una pelea perdida — y además lo haría igual de complicado.

Lo que DIALux **no** hace es justamente donde está tu valor:

| Lo que necesita un proyecto real (ej. colegio de 15 módulos) | Flujo tradicional | Qué pasa entre herramientas |
|---|---|---|
| Iluminación de ambientes interiores y exteriores | DIALux evo | — |
| Circuitos, cuadro de cargas, tableros, secciones | Excel / planilla | Re-digitar cantidades y potencias de DIALux |
| Caída de tensión en cascada (suministro → TG → TD → circuitos) | Excel | Re-digitar longitudes medidas en AutoCAD |
| Planos eléctricos por nivel (alumbrado, tomacorrientes, leyenda) | AutoCAD | Redibujar lo que ya estaba en DIALux |
| Verificación normativa peruana (EM.010, CNE, A.130) | Manual | Consultar tablas a mano |
| Cambios del cliente (mover una luminaria, agregar un módulo) | Las 3 herramientas | **Repetir todo el ciclo** |

**La pérdida de tiempo no está en calcular: está en re-digitar entre herramientas y en rehacer todo ante cada cambio.** Tu motor ya calcula un módulo completo en milisegundos (`planes/Dialux/fase0_benchmark_dialux.md`).

---

## 2. La innovación (lo que defiendes en la sustentación)

> **Una plataforma web que integra en un solo modelo el diseño luminotécnico, el diseño eléctrico y la documentación de un proyecto multi-módulo, automatizando las decisiones repetitivas con reglas normativas peruanas e internacionales, y con cálculos verificables contra una referencia física independiente.**

Cinco ejes, cada uno con evidencia o con un entregable concreto:

| # | Innovación | Por qué DIALux no lo cubre | Estado en el sistema |
|---|---|---|---|
| I1 | **Modelo único lumínico + eléctrico + planos**: una luminaria colocada ya es carga del circuito, del tablero y del plano DXF | DIALux es solo luminotecnia | Hecho en módulos (V1: circuitos, CT, DXF por nivel); planta general enlazada a Red y CT (F2–F5) |
| I2 | **Automatización guiada por norma**: proyección de luminarias en 2 clics, corrector de secciones por ΔU, verificación por tablero, reglas de colocación (½-1-1-½, k·h, cumbrera) | En DIALux cada decisión es manual | Proyección hecha (interiores y exteriores); auto-circuitado **pendiente (P1)** |
| I3 | **Proyecto multi-módulo con red de distribución real**: planta general + N módulos, cascada de ΔU suministro → TG → TD → circuito | DIALux trabaja por proyecto/edificio; no hay red eléctrica | Hecho (F2–F5 de `plan_compatibilizacion_planta_general_red_ct.md`) |
| I4 | **Cálculo transparente y validado contra física real (Radiance)** | DIALux es caja negra | **Evidencia existente**: en 4 casos reales, DIALux evo −23,8 % a −29,6 % vs. Radiance; motor propio (`iterative`) −9,1 % a −12,4 % (`planes/Dialux/plan_cierre_brecha_paridad_dialux_evo.md`, Ronda 24; `estudios/informe_sustentacion_validacion_fisica_motor.md`) |
| I5 | **Web, sin instalación, normativa local (EM.010, CNE, A.130) y ΔU con IEC 60364-5-52 Anexo G** | Escritorio Windows; normas locales no incluidas | Hecho (catálogo EM.010 en BD; ΔU de alimentadores con Anexo G) |

**Frase para la sustentación** (30 segundos):
> "DIALux resuelve la iluminación; el proyecto real necesita además circuitos, tableros, caída de tensión y planos, que hoy se hacen en Excel y AutoCAD re-digitando todo. Este sistema une las tres cosas en un solo modelo web, automatiza las decisiones repetitivas con la norma peruana, y sus cálculos se validaron contra Radiance, donde incluso resultaron más cercanos a la física que DIALux en los casos medidos. El objetivo es reducir a la mitad el tiempo de un proyecto completo."

⚠ Cuidado con las afirmaciones: "más cercano a la física que DIALux" vale **para los casos medidos** (4 recintos reales, reflectancias 0,7/0,5/0,2), no en general. El informe de sustentación ya lista qué NO se afirma — citarlo textual.

---

## 3. Objetivo e hipótesis medibles

**Objetivo general.** Desarrollar y validar una plataforma web integrada de diseño luminotécnico y eléctrico que reduzca el tiempo de elaboración de un proyecto completo (iluminación + circuitos + caída de tensión + planos) en al menos 50 % respecto del flujo tradicional (DIALux evo + AutoCAD + planilla), sin pérdida de exactitud.

**Objetivos específicos.**
1. Modelo integrado (una fuente de datos para iluminación, electricidad y planos).
2. Automatizar la colocación de luminarias, el circuitado y el dimensionamiento por norma.
3. Validar la exactitud lumínica contra Radiance y la eléctrica contra cálculo manual.
4. Medir el tiempo y la cantidad de operaciones frente al flujo tradicional.

**Hipótesis.**
- H1 (tiempo): tiempo_sistema ≤ 0,5 × tiempo_tradicional para el mismo proyecto — **a medir**.
- H2 (exactitud lumínica): |Ē_sistema − Ē_Radiance| ≤ 15 % en los casos de validación — evidencia parcial existente (9–12 %).
- H3 (exactitud eléctrica): ΔU del sistema = cálculo manual (Anexo G) con error < 0,01 % — cubierto por tests (`feederVoltageDrop.test.ts`, caso 100 A·100 m·50 mm² → 1,5735 %).
- H4 (errores): 0 errores de re-digitación entre iluminación, cuadro de cargas y planos (por construcción: un solo modelo).

---

## 4. Cómo demostrarlo (metodología)

**Estudio de tiempos** con un proyecto real (p. ej. colegio con planta general y varios módulos):

| Tarea | Flujo tradicional (herramienta) | Sistema | Métrica |
|---|---|---|---|
| T1 Importar plano y definir ambientes | AutoCAD → DIALux | Import DWG + ambientes automáticos | min, operaciones |
| T2 Iluminar ambientes según norma | DIALux | Proyección 2 clics con Ēm de EM.010 | min, operaciones |
| T3 Iluminación exterior (canchas, patios, techados) | DIALux | Proyección exterior + cálculo V1 | min |
| T4 Circuitos y cuadro de cargas | Excel | Circuitado automático (P1) + CT | min, errores |
| T5 Caída de tensión en cascada | Excel | Red y CT (automático) | min, errores |
| T6 Planos eléctricos por nivel | AutoCAD | Export DXF automático | min |
| T7 Un cambio del cliente (mover/añadir) | Las 3 | Una edición, todo se actualiza | min |
| T8 Informe | DIALux + Word | Reporte único | min |

- Cronometrar el flujo tradicional con 1–3 proyectistas y el sistema con los mismos (orden cruzado para evitar aprendizaje).
- **Instrumentar el sistema** (P7): registrar el tiempo por fase y las operaciones para no depender del cronómetro manual.
- Exactitud: reutilizar la triangulación Radiance y los tests de ΔU; añadir un caso exterior (cancha) contra Radiance.

---

## 5. Qué construir para bajar de 1 día a medio día (priorizado por tiempo ahorrado)

| Prioridad | Qué | Tiempo que ataca | Esfuerzo | Estado |
|---|---|---|---|---|
| **P1** | **Auto-circuitado**: agrupar luminarias/tomacorrientes en circuitos por reglas (separar alumbrado y tomas, máx. puntos/potencia por circuito, fases balanceadas), trazar la ruta al tablero y dimensionar sección por ΔU | T4 (el más largo del flujo manual) | Alto | Pendiente |
| P2 | **Plantillas de proyecto** (colegio / vivienda / industrial): norma, luminarias típicas, alturas, reglas de circuito ya cargadas | T1–T4 (menos configuración) | Bajo | Pendiente |
| P3 | **Asistente de flujo**: barra "siguiente paso" (plano → ambientes → luminarias → circuitos → verificar → planos) con lo que falta en cada módulo | Tiempo perdido buscando qué hacer | Medio | Pendiente |
| P4 | **Reporte único** de planta general + módulos (lumínico + eléctrico + verificación) | T8 | Medio | Parcial (PDF por módulo existe) |
| P5 | **Planos DXF del emplazamiento** con el pipeline DXF de la V1 | T6 exterior | Medio | Pendiente |
| P6 | **Import CAD inteligente del emplazamiento**: reconocer capas/bloques del DWG como módulos, cercos, canchas | T1 exterior | Alto | Parcial (import como fondo) |
| P7 | **Cronómetro de tareas** (telemetría local, exportable) para la tesis | Evidencia H1 | Bajo | Pendiente |

**Reglas de diseño (aprendidas en esta etapa del proyecto):**
1. Cada tarea frecuente en **≤ 2 clics** (elegir y colocar), con valores por defecto de la norma.
2. **Un solo lugar por tarea** (nada duplicado entre paleta y propiedades).
3. **Resultados en vivo** (vista previa antes de colocar, Ēm/ΔU al instante).
4. **Mostrar el porqué** de cada propuesta (método de lúmenes, regla de separación, norma).
5. **Paleta por categorías** con buscador: la herramienta crece sin volverse inmanejable.
6. **Nunca declarar "cumple"** sin fuente; decir "≥ norma" y citar la norma y la edición.

---

## 6. Agentes y skills (Claude Code) para trabajar esto

**Ya existen** (`.claude/agents`, `.claude/skills`):

| Nombre | Para qué |
|---|---|
| `dialux-geometry-reviewer` | Escala, entidades, multinivel, selección/undo |
| `dialux-calc-reviewer` | Lux, uniformidad, UGR, cantidad de luminarias |
| `dialux-electrical-reviewer` | Circuitos, secciones, tableros, ΔU |
| `dialux-drawing-reviewer` | Planos DXF, capas, símbolos, leyenda |
| `dialux-normativa-auditor` | Que ninguna cifra "cumple" carezca de fuente |
| `dialux-site-connectivity-reviewer` / `dialux-site-render-reviewer` | Emplazamiento: rampas/portones; 2D↔3D |
| `chief-electrical-engineer-reviewer` | Veredicto integral de ingeniería |
| skills `revisar-dialux`, `revisar-emplazamiento`, `normativa-dialux` | Orquestan las revisiones y la tabla normativa |

**Propuestos** (a crear si se aprueba):

| Nombre | Tipo | Para qué sirve en la tesis |
|---|---|---|
| `tesis-validacion` | skill | Corre los casos de oro (Radiance, ΔU a mano, proyección) y genera las **tablas de validación** listas para el documento |
| `dialux-ux-flow-auditor` | agente | Cuenta pasos/clics por tarea (T1–T8) contra la meta de ≤ 2 clics y detecta duplicados |
| `dialux-site-lighting-reviewer` | agente | Revisa el cálculo exterior, la proyección, techados y portones (hoy no hay revisor para esto) |
| `dialux-autocircuit-reviewer` | agente | Revisará P1 (reglas CNE de circuitos, balance de fases) cuando exista |

---

## 7. Próximos pasos recomendados

1. **Fase 6** (pruebas de lo ya construido) — en curso con el usuario.
2. **P7 cronómetro** (bajo esfuerzo, habilita la evidencia H1 desde ya).
3. **P1 auto-circuitado** (el mayor ahorro de tiempo del flujo real).
4. Crear el skill `tesis-validacion` para producir las tablas de la tesis de forma reproducible.
