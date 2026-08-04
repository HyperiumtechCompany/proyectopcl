# Plan maestro para evolucionar DIALux Web hacia un motor luminotécnico profesional

## 1. Propósito

Este documento organiza la evolución gradual del módulo actual hasta convertirlo en una plataforma web de cálculo, diseño, evaluación y documentación luminotécnica comparable con DIALux evo en los alcances que se implementen y validen.

El plan no busca copiar todas las funciones de DIALux a la vez. Busca construir primero un núcleo interior confiable, modular y verificable, y después ampliar el producto hacia emergencia, luz natural, exteriores, BIM y funciones propias que puedan superar el flujo de escritorio.

La regla principal es:

> Ninguna pantalla, resultado o informe puede presentarse como profesional si el cálculo que lo alimenta no tiene procedencia, vigencia y validación documentadas.

## 2. Objetivos estratégicos

### Objetivo 1 — Arquitectura escalable

- Eliminar responsabilidades múltiples de archivos monolíticos.
- Separar dominio, aplicación, infraestructura, renderizado y UI.
- Permitir que varios desarrolladores trabajen sin editar continuamente los mismos archivos.
- Mantener contratos estables entre editor, motor, resultados e informes.

### Objetivo 2 — Motor confiable

- Evolucionar desde iluminancia directa hacia cálculo con oclusión e interreflexiones.
- Soportar fotometría real, superficies y observadores.
- Comparar resultados contra casos analíticos y proyectos de referencia.
- Publicar el alcance y las tolerancias reales del motor.

### Objetivo 3 — Flujo profesional completo

- Construcción.
- Luminarias.
- Escenas.
- Objetos de cálculo.
- Cálculo.
- Evaluación normativa.
- Resultados.
- Documentación y planos.

### Objetivo 4 — Diferenciación web

- Cálculo en segundo plano.
- Colaboración y revisión.
- Historial de versiones.
- Comparación de alternativas.
- Integración con diseño eléctrico, metrados y costos.
- Automatización y APIs propias.

## 3. Estado actual y deuda principal

## 3.1. Capacidades existentes que deben conservarse

- Editor CAD 2D.
- Visualización 3D con Babylon.js.
- Proyectos y niveles.
- Recintos, muros, puertas, ventanas, pasadizos, escaleras y cubiertas.
- Importación y calibración DXF/DWG.
- Catálogo e importación IES/LDT/GLDF inicial.
- Matrices fotométricas C-γ.
- Colocación individual y por grillas.
- Cálculo directo punto a punto.
- `Eavg`, `Emin`, `Emax`, uniformidad y UGR aproximado.
- Isolíneas y falso color.
- Perfiles normativos.
- Historial undo/redo.
- Informe PDF formal.
- Exportación DXF.
- Módulo eléctrico de circuitos, tomacorrientes, conductores y tableros.

## 3.2. Archivos monolíticos detectados

| Archivo | Líneas aproximadas | Problema principal |
|---|---:|---|
| `engine/House3DBuilder.ts` | 3142 | Construcción, materiales, escenas, escaleras, dispositivos, iluminación y resultados 3D en una clase |
| `components/toolbar/normativeData.ts` | 2819 | Tipos, datos normativos y utilidades en código frontend |
| `components/CatalogPanel.tsx` | 1759 | Datos remotos, formularios, navegación del catálogo y renderizado en un componente |
| `components/canvas/MlightcadCanvas2D.tsx` | 1377 | Motor CAD, lifecycle, interacción, overlays y diálogos |
| `views/dialux/export/formal-pdf.blade.php` | 1322 | Helpers, estilos y todas las plantillas PDF juntas |
| `export/document/buildDialuxFormalDocument.ts` | 1217 | Totales, páginas, índice, glosario y paginación en un builder |
| `hooks/normativaData.ts` | 1144 | Segundo catálogo normativo, riesgo de fuentes duplicadas |
| `components/properties/RoomProps.tsx` | 942 | Propiedades, normativa, luminarias, tomas y acciones del recinto |
| `hooks/useMlightcadEngine.ts` | 889 | Adaptación del motor y múltiples responsabilidades |
| `hooks/useCanvasInteraction.ts` | 874 | Máquina implícita de herramientas e interacción |
| `hooks/ambientSpaces.ts` | 856 | Detección, rasterización, topología y fallbacks mezclados |
| `Services/ProductImportService.php` | 835 | Parseo de varios formatos, persistencia y assets |
| `export/dxf/buildDialuxDxfExport.ts` | 826 | Primitivas, bloques, símbolos, leyendas y composición |

El tamaño no es el único criterio. Un archivo puede ser largo si representa datos estáticos. El problema aparece cuando contiene varias razones para cambiar.

## 3.3. Brechas técnicas del motor

- Suma de luz directa sin oclusión espacial completa.
- Reflectancias registradas, pero no integradas en un solver de interreflexión.
- UGR evaluado desde una posición simplificada.
- Orientación de luminaria principalmente en planta.
- Malla fija de referencia de 0.50 m.
- Planos útiles ligados al recinto, no sistema general de superficies.
- Escena usada también como nivel; no existe una separación robusta nivel/escena luminosa.
- Emergencia representada parcialmente, sin solver específico.
- Ausencia de luz natural, exterior, vial, energía e IFC.
- Falta de una suite publicada de comparación contra motores de referencia.

## 4. Principios obligatorios de arquitectura

## 4.1. Dependencias hacia el dominio

```text
UI React
   ↓
Casos de uso / aplicación
   ↓
Dominio geométrico y fotométrico
   ↓
Puertos de infraestructura

Implementaciones externas:
CAD, Web Workers, WASM, Laravel, almacenamiento, PDF, DXF
```

El dominio no puede importar React, Zustand, Axios, Babylon, Inertia, DOM, Canvas ni Laravel.

## 4.2. Separar estado editable y snapshot calculable

```text
ProjectDocument mutable
        ↓ normalización
CalculationSnapshot inmutable
        ↓ solver
CalculationRun inmutable
        ↓ evaluadores
EvaluationResult
        ↓ presentadores
UI / PDF / DXF / Excel
```

Un cálculo nunca debe leer el store mientras está ejecutándose.

## 4.3. Resultados versionados e inmutables

Cada ejecución debe conservar:

- ID.
- Versión del esquema.
- Versión del motor.
- Hash del snapshot.
- Fecha.
- Configuración.
- Calidad/modo.
- Warnings.
- Duración y métricas.
- Resultados por objeto.

Si cambia geometría, material, luminaria, escena o configuración, el resultado anterior pasa a `stale`.

## 4.4. Una sola fuente de verdad

- Coordenadas y unidades: dominio geométrico.
- Fotometría: catálogo normalizado.
- Normativa: repositorio normativo versionado.
- Resultados: `CalculationRun`.
- Símbolos: catálogo compartido.
- Exportaciones: leen los mismos modelos, no recalculan.

## 4.5. Presupuesto de tamaño

Reglas orientativas, no mecánicas:

- Componente React: objetivo menor a 250 líneas.
- Hook/orquestador: objetivo menor a 300 líneas.
- Servicio de dominio: objetivo menor a 400 líneas.
- Builder/emitter: objetivo menor a 400 líneas.
- Test: dividir por comportamiento cuando supere 500 líneas.
- Datos estáticos grandes: JSON/TS generado o archivos por norma/sección.

Cuando un archivo supere el umbral, debe justificarse o dividirse por responsabilidad. No fragmentar funciones cohesionadas solo para cumplir una cifra.

## 4.6. Refactor seguro

Para cada extracción:

1. Crear test caracterizador.
2. Extraer sin cambiar comportamiento.
3. Ejecutar tests.
4. Cambiar comportamiento en un commit/cambio posterior.

No combinar una gran reorganización con un nuevo algoritmo fotométrico.

## 5. Estructura objetivo del software

```text
resources/js/pages/dialux/
├── app/
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── ports/
├── domain/
│   ├── project/
│   ├── geometry/
│   ├── photometry/
│   ├── calculation/
│   ├── evaluation/
│   ├── scenes/
│   ├── emergency/
│   ├── daylight/
│   └── electrical/
├── engine/
│   ├── direct/
│   ├── visibility/
│   ├── radiosity/
│   ├── glare/
│   ├── daylight/
│   ├── workers/
│   └── wasm/
├── editor/
│   ├── 2d/
│   ├── 3d/
│   ├── tools/
│   ├── selection/
│   └── commands/
├── features/
│   ├── construction/
│   ├── luminaires/
│   ├── calculation-objects/
│   ├── calculation-runs/
│   ├── results/
│   ├── normative/
│   ├── reports/
│   └── electrical/
├── infrastructure/
│   ├── cad/
│   ├── persistence/
│   ├── api/
│   ├── workers/
│   └── telemetry/
├── export/
│   ├── pdf/
│   ├── dxf/
│   ├── excel/
│   └── shared/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── math/
│   └── types/
└── pages/
```

Esta estructura es destino, no una migración inmediata. Los archivos se moverán cuando una fase necesite tocarlos.

## 6. Módulos de dominio

## 6.1. Proyecto y construcción

Entidades:

- Proyecto.
- Edificio.
- Nivel.
- Recinto/área.
- Superficie.
- Muro.
- Abertura.
- Objeto.
- Material.

Separar definitivamente:

- `Level`: geometría y elevación.
- `LightingScene`: estado de encendido/regulación.
- `CalculationObject`: superficie o conjunto evaluado.

## 6.2. Fotometría

Entidades:

- Producto.
- Variante.
- Light-emitting surface.
- Photometric web.
- Orientación 3D.
- Multiplicador de flujo.
- Operación normal/emergencia.

Servicios:

- Normalización IES/LDT/GLDF.
- Validación de ángulos y matriz.
- Interpolación C-γ.
- Integración de flujo.
- Transformación por rotación 3D.

## 6.3. Cálculo

Entidades:

- Snapshot.
- Configuración.
- Malla.
- Punto de cálculo.
- Ejecución.
- Resultado por superficie.
- Provenance.
- Warning.

Solvers:

- Directo.
- Visibilidad/oclusión.
- Interreflexión.
- Deslumbramiento.
- Emergencia.
- Luz natural futura.

## 6.4. Evaluación normativa

El solver calcula magnitudes; el evaluador decide cumplimiento.

```text
Solver: Eavg = 487 lx
Requirement: Eavg >= 500 lx
Evaluation: fail
```

No incorporar umbrales normativos dentro del solver.

## 7. Descomposición de monolitos

## 7.1. `House3DBuilder.ts`

Destino:

```text
editor/3d/
├── SceneCoordinator.ts
├── materials/MaterialLibrary.ts
├── builders/LevelBuilder.ts
├── builders/RoomBuilder.ts
├── builders/WallBuilder.ts
├── builders/OpeningBuilder.ts
├── builders/StairBuilder.ts
├── builders/CanopyBuilder.ts
├── builders/LuminaireBuilder.ts
├── builders/ElectricalDeviceBuilder.ts
├── builders/ResultOverlayBuilder.ts
└── lifecycle/SceneResourceRegistry.ts
```

`SceneCoordinator` solo coordina. Cada builder recibe datos y un contexto explícito.

## 7.2. `MlightcadCanvas2D.tsx`

Destino:

```text
editor/2d/
├── CadViewport.tsx
├── CanvasLayerStack.tsx
├── overlays/
├── dialogs/
├── hooks/useCadLifecycle.ts
├── hooks/useViewportTransform.ts
├── hooks/useToolController.ts
├── hooks/useCanvasKeyboard.ts
└── hooks/useOverlayModel.ts
```

El componente raíz monta capas; no contiene reglas de herramientas.

## 7.3. `CatalogPanel.tsx`

Destino:

```text
features/luminaires/catalog/
├── LuminaireCatalogPanel.tsx
├── CatalogSearch.tsx
├── CatalogList.tsx
├── CatalogItem.tsx
├── ImportPhotometryDialog.tsx
├── ManualLuminaireForm.tsx
├── PhotometricTableEditor.tsx
├── useLuminaireCatalog.ts
├── catalogApi.ts
└── mappers.ts
```

Usar rutas Wayfinder existentes en el adaptador API. Los componentes no forman URLs manualmente.

## 7.4. Normativa

Destino:

```text
domain/evaluation/
├── types.ts
├── evaluateRequirement.ts
└── evaluateCalculationRun.ts

features/normative/
├── NormativePanel.tsx
├── NormativeWizard.tsx
└── useNormativeConfig.ts

infrastructure/normative/
├── normativeRepository.ts
└── fallback/
    ├── en-12464-1.json
    ├── en-1838.json
    ├── rne-peru.json
    └── ies.json
```

Eliminar duplicidad entre los dos `normativeData.ts`. Todo requisito debe incluir fuente, edición y fecha.

## 7.5. Informe PDF

Destino:

```text
export/pdf/
├── domain/
├── builders/
│   ├── frontMatter.ts
│   ├── levels.ts
│   ├── ambientDossier.ts
│   ├── products.ts
│   ├── glossary.ts
│   └── pagination.ts
└── assets/

resources/views/dialux/export/
├── formal-pdf.blade.php
├── partials/page-shell.blade.php
├── pages/cover.blade.php
├── pages/toc.blade.php
├── pages/luminaire-list.blade.php
├── pages/product-sheet.blade.php
├── pages/ambient-summary.blade.php
├── pages/calculation.blade.php
└── pages/glossary.blade.php
```

## 8. Contratos técnicos fundamentales

## 8.1. Snapshot

```ts
interface CalculationSnapshot {
    schemaVersion: string;
    projectId: string;
    geometryHash: string;
    levels: CalculationLevel[];
    materials: CalculationMaterial[];
    luminaires: CalculationLuminaire[];
    scenes: LightingScene[];
    calculationObjects: CalculationObject[];
}
```

## 8.2. Configuración

```ts
interface CalculationConfig {
    mode: 'preview' | 'standard' | 'high';
    directLight: boolean;
    occlusion: boolean;
    interreflection: 'none' | 'first-bounce' | 'iterative';
    maxBounces: number;
    convergenceTolerance: number;
    meshPolicy: MeshPolicy;
    glare: GlareConfig;
}
```

## 8.3. Resultado

```ts
interface CalculationRun {
    id: string;
    engineVersion: string;
    snapshotHash: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stale';
    config: CalculationConfig;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    warnings: CalculationWarning[];
    surfaces: SurfaceCalculationResult[];
}
```

## 9. Escalera de calidad del cálculo

No habrá un único botón opaco. El usuario debe conocer el modo:

### Vista previa

- Luz directa.
- Malla más gruesa.
- Actualización rápida.
- Puede usar aproximación cuando falta fotometría.
- Resultado marcado como preliminar.

### Estándar

- Fotometría real obligatoria para resultado profesional.
- Oclusión.
- Primera reflexión o solver convergente limitado.
- Malla normativa.
- UGR con observadores.

### Alta precisión

- Interreflexión iterativa.
- Malla refinada.
- Más observadores/direcciones.
- Tolerancia de convergencia estricta.
- Ejecución en Worker/WASM.

## 10. Estrategia de validación

## 10.1. Tres niveles de referencia

### Casos analíticos

Problemas cuya respuesta puede obtenerse con fórmula:

- Fuente puntual sobre plano horizontal.
- Ley inversa del cuadrado.
- Ley del coseno.
- Rotación de una distribución simétrica/asimétrica.
- Suma lineal de fuentes.

Tolerancia objetivo: error numérico menor a 0.5 %.

### Casos sintéticos controlados

- Caja rectangular sin reflexión.
- Caja con reflectancias conocidas.
- Objeto bloqueando una luminaria.
- Una primera reflexión simple.
- Variación de malla.

### Casos comparativos

Proyectos idénticos ejecutados en DIALux evo u otra referencia aceptada.

Comparar:

- `Eavg`.
- `Emin`.
- `Emax`.
- Uniformidad.
- UGR.
- Ubicación de mínimos/máximos.
- Distribución espacial, no solo promedios.

## 10.2. Métricas

```text
error_relativo = |web - referencia| / max(|referencia|, epsilon)
RMSE = raíz del promedio de errores cuadrados por punto
correlación espacial = correlación entre mallas alineadas
```

## 10.3. Tolerancias iniciales

Las tolerancias deben aprobarse con un especialista. Punto de partida:

- Directo analítico: ≤ 0.5 %.
- Directo contra referencia: mediana ≤ 3 %, máximo justificado ≤ 8 %.
- Con interreflexión: mediana ≤ 5 %, máximo justificado ≤ 10 %.
- Uniformidad: diferencia absoluta ≤ 0.05.
- UGR: diferencia ≤ 1 unidad en casos soportados.

No ocultar casos fuera de tolerancia; clasificarlos por causa.

## 11. Plan de ejecución por fases

## Fase 0 — Gobernanza, línea base y congelación de comportamiento

### Objetivo

Crear condiciones para cambiar el sistema sin perder funciones existentes.

### Trabajo

- Inventariar funciones, archivos, rutas y tests.
- Registrar tiempos de carga, cálculo, PDF y DXF.
- Crear fixture pequeño, mediano y MÓDULO I.
- Capturar resultados numéricos actuales.
- Definir ADRs para unidades, ejes, snapshots y versiones.
- Configurar reglas de dependencias y tamaños mediante ESLint o tests de arquitectura existentes, sin librerías nuevas si no son necesarias.
- Etiquetar claramente el motor actual como `direct-preview-v1`.

### Entregables

- Línea base reproducible.
- Matriz de capacidades.
- Fixtures versionados.
- Primer benchmark.

### Puerta de salida

Tipos, tests existentes y build pasan; se puede reproducir el mismo resultado dos veces.

## Fase 1 — Contratos y núcleo de dominio

### Objetivo

Separar datos calculables del store y de la UI.

### Trabajo

- Crear tipos de proyecto, nivel, escena y objeto de cálculo.
- Separar `Level` y `LightingScene`.
- Crear `CalculationSnapshot` inmutable.
- Normalizar unidades a SI.
- Crear hash determinista del snapshot.
- Crear `CalculationRun` y estados.
- Adaptar el motor actual mediante un wrapper, sin cambiar fórmula.
- Marcar resultados obsoletos al modificar dependencias.

### Tests

- Snapshot no cambia al editar el store después de crearlo.
- Hash estable con orden irrelevante.
- Hash cambia ante una modificación relevante.
- Serialización compatible.
- Resultado pasa a `stale`.

### Puerta de salida

El motor no importa Zustand ni React y produce el mismo resultado base.

## Fase 2 — Refactor de UI y motores gráficos

### Objetivo

Reducir monolitos sin modificar todavía el algoritmo fotométrico.

### Orden de extracción

1. `CatalogPanel.tsx`.
2. `MlightcadCanvas2D.tsx`.
3. `RoomProps.tsx`.
4. `House3DBuilder.ts`.
5. Exportadores PDF/DXF.
6. Normativa.

### Trabajo

- Extraer componentes presentacionales.
- Extraer hooks de casos de uso.
- Extraer adapters CAD/Babylon.
- Crear registros de recursos 3D para liberar meshes/materiales.
- Centralizar rutas Wayfinder en adaptadores API.
- Dividir tests monolíticos por feature.
- Añadir tests de arquitectura Pest/TypeScript para dependencias prohibidas.

### Puerta de salida

- Ningún componente principal nuevo supera 300 líneas sin justificación.
- Los monolitos disminuyen por responsabilidad, no por wrappers vacíos.
- No cambia el resultado numérico ni visual esperado.

## Fase 3 — Fotometría normalizada y orientación 3D

### Objetivo

Garantizar que el dato de fabricante llega correctamente al solver.

### Trabajo

- Separar parsers IES, LDT y GLDF de persistencia PHP.
- Normalizar todas las matrices a un contrato común.
- Validar monotonicidad de ángulos y dimensiones.
- Soportar simetrías C0, C90, C180 y C360.
- Aplicar tilt/multiplicadores cuando el formato lo requiera.
- Implementar rotación yaw/pitch/roll.
- Representar varias superficies emisoras.
- Validar flujo integrado contra flujo declarado.
- Mantener procedencia: real, manual o sintética.

### Casos

- Simétrica.
- Asimétrica.
- Wall washer.
- Proyector inclinado.
- Luminaria lineal.
- Fotometría incompleta/incorrecta.

### Puerta de salida

Los casos directos analíticos cumplen tolerancia y ninguna fotometría sintética se reporta como fabricante.

## Fase 4 — Objetos de cálculo y mallas

### Objetivo

Dejar de limitar el cálculo a un único plano horizontal implícito por recinto.

### Trabajo

- Crear superficies horizontales, verticales, inclinadas y libres.
- Crear planos útiles automáticos configurables.
- Crear puntos y líneas de cálculo.
- Definir zona marginal.
- Implementar malla fija, adaptativa y normativa.
- Crear máscaras para polígonos con huecos.
- Registrar posición y normal de cada punto.
- Permitir varias superficies por ambiente.

### Tests

- Polígono cóncavo.
- Polígono con hueco.
- Pared vertical.
- Superficie inclinada.
- Puntos exactamente en bordes.
- Refinamiento estable.

### Puerta de salida

El mismo solver calcula cualquier superficie mediante punto, normal y contexto.

## Fase 5 — Solver directo validado

### Objetivo

Consolidar el cálculo directo antes de agregar reflexiones.

### Trabajo

- Extraer interpolación fotométrica.
- Aplicar orientación 3D completa.
- Corregir incidencia según normal del punto.
- Incorporar regulación y escena.
- Parametrizar malla.
- Eliminar uniformidad estimada de resultados finales.
- Añadir precisión y sumatoria numérica estable.
- Comparar con suite analítica y DIALux sin reflexión cuando sea reproducible.

### Puerta de salida

Todos los casos directos cumplen las tolerancias aprobadas.

## Fase 6 — Visibilidad, oclusión y sombras

### Objetivo

Evitar que la luz atraviese muros, techos y obstáculos.

### Trabajo

- Crear representación de triángulos/superficies del snapshot.
- Construir índice espacial BVH o equivalente propio/apoyado en capacidades existentes.
- Lanzar rayos punto ↔ superficie emisora.
- Distinguir elementos opacos, transparentes y excluidos.
- Añadir tolerancias para auto-intersección.
- Soportar muros, losas, mobiliario y objetos.
- Separar visibilidad del solver directo.

### Tests

- Muro bloqueando 100 %.
- Media abertura.
- Ventana transparente.
- Punto cercano a superficie.
- Objeto fino.
- Dos niveles superpuestos.

### Puerta de salida

No existe contribución directa cuando el camino está ocluido y no aparecen fugas relevantes en bordes.

## Fase 7 — Materiales e interreflexión inicial

### Objetivo

Incorporar la primera contribución reflejada de manera controlada.

### Trabajo

- Crear materiales con reflectancia visible.
- Discretizar superficies receptoras/emisoras.
- Implementar primera reflexión difusa.
- Conservar energía y limitar valores inválidos.
- Comparar habitaciones de reflectancia 0 contra solver directo.
- Comparar reflectancias crecientes.
- Incorporar factor de mantenimiento en el lugar correcto.

### Puerta de salida

Reflectancia 0 reproduce cálculo directo; casos de primera reflexión cumplen tolerancia acordada.

## Fase 8 — Interreflexión iterativa

### Objetivo

Calcular múltiples rebotes hasta convergencia.

### Trabajo

- Elegir radiosidad, progressive refinement u otro método documentado.
- Implementar factores de forma o muestreo.
- Añadir convergencia por energía residual.
- Limitar rebotes, tiempo y memoria.
- Refinar superficies adaptativamente.
- Registrar energía por iteración.
- Exponer modo estándar/alta precisión.

### Tests

- Caja Cornell simplificada.
- Conservación energética.
- Reflectancia extrema.
- Recinto pequeño/grande.
- Convergencia reproducible.

### Puerta de salida

El solver converge de forma determinista y cumple el benchmark de interiores definido.

## Fase 9 — UGR y luminancia profesional

### Objetivo

Reemplazar el indicador central aproximado por evaluación espacial trazable.

### Trabajo

- Crear observadores con posición, altura y dirección.
- Calcular luminancia de superficies emisoras.
- Implementar ángulo sólido aparente.
- Incorporar índice de posición aplicable.
- Calcular luminancia de fondo desde la escena.
- Evaluar varios observadores/direcciones.
- Reportar máximo y ubicación.
- Documentar condiciones donde UGR no aplica.

### Puerta de salida

Los casos UGR soportados cumplen la tolerancia y el informe muestra observador/dirección.

## Fase 10 — Escenas luminosas y controles

### Objetivo

Separar pisos de estados de operación.

### Trabajo

- Varias escenas por proyecto/nivel.
- Grupos de control.
- Encendido, apagado y regulación.
- Escena activa vs. conjunto calculado.
- Comparación de escenas.
- Sensores y horarios como modelo inicial.
- Resultados independientes por escena.

### Puerta de salida

Una geometría puede calcularse con varias escenas sin duplicar el nivel.

## Fase 11 — Resultados profesionales

### Objetivo

Permitir analizar, depurar y comparar resultados.

### Trabajo

- Monitor de resultados.
- Saltar a mínimo/máximo.
- Isolíneas configurables.
- Falso color con escalas guardables.
- Tabla por objeto.
- Comparación de ejecuciones.
- Diferencias entre mallas.
- Warnings y procedencia visibles.
- No conforme/no evaluado/stale.

### Puerta de salida

Cada valor visible puede trazarse a una ejecución, configuración, punto y objeto.

## Fase 12 — Rendimiento: Worker y WASM

### Objetivo

Evitar bloquear la UI y soportar proyectos medianos/grandes.

### Trabajo

- Ejecutar solver en Web Worker.
- Protocolo start/progress/cancel/result/error.
- Transferir buffers, no grandes objetos clonados.
- Cachear geometría, BVH y fotometría.
- Migrar kernels medidos a Rust/WASM, no toda la aplicación.
- Presupuesto de memoria.
- Cancelación y recuperación.
- Benchmarks CI controlados.

### Objetivos iniciales

- UI fluida durante cálculo.
- Cancelación perceptible en menos de 500 ms.
- Progreso por fase.
- Sin crecimiento de memoria entre ejecuciones repetidas.

### Puerta de salida

MÓDULO I puede calcularse sin congelar el navegador y con métricas registradas.

## Fase 13 — Documentación y DXF respaldados por cálculo

### Objetivo

Conectar los planes documental y DXF con la nueva arquitectura.

### Trabajo

- PDF consume `CalculationRun`.
- DXF consume niveles y especialidades normalizadas.
- Mostrar engineVersion, modo y warnings.
- Evitar recálculos en exportadores.
- Invalidar exportación profesional si el resultado está stale.
- Completar planos por nivel, marcos y leyendas.
- Añadir anexos comparativos.

### Puerta de salida

PDF, DXF y UI muestran los mismos valores y metadatos.

## Fase 14 — Emergencia

### Objetivo

Incorporar un flujo separado y verificable.

### Trabajo

- Operación normal/emergencia por luminaria.
- Flujo/factor de emergencia.
- Rutas de evacuación.
- Puntos críticos.
- Áreas antipánico.
- Escena de emergencia.
- Opciones de reflexión específicas.
- Requisitos EN 1838/RNE aplicables.
- Informe de emergencia.

### Puerta de salida

Los resultados de emergencia nunca se confunden con iluminación normal.

## Fase 15 — Corrección de fichas fotométricas: CDL polar y UGR

### Objetivo

Garantizar que toda luminaria importada desde IES/LDT con fotometría válida muestre una CDL polar reproducible en el PDF y que la sección UGR diferencie correctamente entre el UGR calculado del proyecto y una tabla o diagrama UGR de producto. La exportación no debe perder datos ya persistidos por depender de una segunda consulta de red.

### Diagnóstico de partida

- El parser Rust entrega `c_angles`, `gamma_angles` y `candela`, y `ProductImportService` genera y persiste `report_assets.polar_svg`.
- Las instancias de luminaria conservan `productId` y pueden conservar también `reportAssets.polar_svg` dentro del snapshot del proyecto.
- `enrichProducts()` vuelve a consultar el catálogo durante cada exportación y solo desde esa respuesta crea `polarDiagramAssetId`; si la consulta falla, captura la excepción y la exportación continúa sin CDL aunque el SVG ya exista en el snapshot.
- El PDF solo muestra UGR de la ficha cuando existen `ugrDiagramValue` o `ugrTable`. El importador Rust/PHP no genera esos campos y el UGR calculado por ambiente no se conecta con esa sección.
- Una tabla UGR de luminaria y el UGR calculado para un ambiente no son equivalentes y no deben presentarse como si lo fueran.

### Trabajo — CDL polar

- Definir una fuente primaria y fallbacks explícitos para el asset polar:
  1. `fixture.reportAssets.polar_svg` ya presente en el snapshot.
  2. `product.report_assets.polar_svg` obtenido del catálogo.
  3. Generación determinista desde `fixture.photometricWeb` si existe una matriz válida.
- Crear `polarDiagramAssetId` sin requerir una petición HTTP cuando el snapshot ya contiene el SVG o la matriz necesaria.
- Mantener el enriquecimiento remoto para foto, logotipo y datos actualizados, pero no convertir su fallo en pérdida silenciosa de la CDL persistida.
- Emitir un warning de exportación trazable cuando fallen todos los orígenes, indicando producto, `productId` y causa.
- Verificar que el asset sobreviva a `buildDialuxFormalDocument()`, `pruneUnusedAssets()`, validación Laravel y render de Dompdf.
- Confirmar que agrupaciones de varias instancias del mismo producto conserven una sola ficha y un único asset polar correcto.
- Representar al menos los planos C principales disponibles; si inicialmente se muestra solo C0, declararlo en la ficha y no presentarlo como distribución completa cuando la luminaria no sea rotacionalmente simétrica.
- Mantener escala fotométrica coherente entre flujo de referencia, flujo configurado e `Imax`; documentar en el asset si la curva fue reescalada.

### Trabajo — UGR y SHR

- Separar formalmente tres conceptos en dominio, UI y PDF:
  - `ambientUgrResult`: resultado UGR calculado para un ambiente, observador y dirección concretos.
  - `productUgrTable`: tabla UGR del fabricante o calculada bajo geometrías normalizadas verificables.
  - `productUgrDiagram`: representación visual de dicha tabla, con SHR y condiciones declaradas.
- No fabricar una tabla UGR únicamente desde el valor UGR máximo del ambiente ni desde la matriz de candelas sin los parámetros geométricos y fotométricos requeridos.
- Definir el contrato de una tabla UGR: dimensiones del área luminosa, flujo de referencia, reflectancias techo/pared/plano, relación geométrica del recinto, espaciamiento o SHR, direcciones de observación, método/edición y procedencia.
- Determinar si el LDT contiene datos suficientes para calcular la tabla solicitada. Los campos ausentes deben producir `no disponible` con motivo técnico, no una tabla sintética presentada como dato de fabricante.
- Implementar, una vez validado el contrato, el generador de tabla/diagrama UGR para los casos soportados, incluyendo la serie de SHR aprobada y `SHR: 0.25` cuando sea aplicable.
- Conectar el UGR real de cada ambiente con la sección de resultados del ambiente, mostrando observador, dirección, modelo, valor, límite y estado; no colocarlo en la ficha como tabla de producto.
- En la ficha del producto, etiquetar claramente si la tabla UGR es `fabricante`, `calculada por el motor` o `no disponible`.
- Mantener `no evaluable` para luminarias o escenarios fuera del alcance del método UGR y explicar la causa.

### Validación

- Fixture real de regresión: `FLIQ 400.3040.01_FLIQZ 400.24` importado mediante Rust.
- Test de importación: matriz válida y `report_assets.polar_svg` no vacío.
- Test frontend sin red: una luminaria con `reportAssets.polar_svg` produce `polarDiagramAssetId` y asset incluido en el documento.
- Test de fallo de API: el PDF conserva la CDL local y registra warning, sin abortar la exportación.
- Test de extremo a extremo: importación LDT → proyecto guardado/recargado → snapshot → documento formal → PDF con texto/asset `CDL polar`.
- Test de poda: `pruneUnusedAssets()` conserva todos los assets polares referenciados y elimina únicamente los no utilizados.
- Tests UGR positivos y negativos: datos completos, dimensiones ausentes, fotometría inválida, caso no aplicable y distinción entre tabla de producto y resultado de ambiente.
- Benchmark UGR contra una referencia independiente y versión/configuración documentadas antes de habilitar una etiqueta de conformidad.
- Inspección visual del PDF real, además de aserciones sobre HTML, para detectar incompatibilidades SVG/bitmap de Dompdf.

### Puerta de salida

- El PDF del fixture FLIQ muestra la CDL polar incluso cuando la consulta de enriquecimiento del catálogo falla.
- Ningún PDF muestra “Gráfico no disponible” si el snapshot contiene un SVG polar válido o una matriz desde la cual puede generarse de forma determinista.
- La sección UGR identifica sin ambigüedad si presenta una tabla de producto o un resultado calculado del ambiente.
- `SHR: 0.25` solo se muestra cuando fue calculado o importado con entradas completas, método y procedencia trazables.
- PDF, snapshot y base de datos conservan el mismo identificador, origen, escala fotométrica y valores relevantes.
- Los tests de importación, enriquecimiento, composición formal y render PDF pasan, y no quedan errores silenciosos en consola para estos flujos.

## Fase 16 — Materiales, objetos y visualización avanzada

### Objetivo

Mejorar coherencia entre cálculo y 3D.

### Trabajo

- Biblioteca de materiales.
- Reflectancia y transmisión.
- Texturas separadas de propiedades fotométricas.
- Objetos/mobiliario con inclusión configurable en cálculo.
- Vista 3D de resultados.
- Render físicamente plausible como visualización, separado del solver normativo.

## Fase 17 — Luz natural

### Dependencias

No iniciar sin solver interior y materiales validados.

### Trabajo

- Ubicación y norte.
- Fecha, hora y zona horaria.
- Modelo de cielo.
- Ventanas y transmisión.
- Sombras exteriores.
- Lucernarios.
- Daylight factor.
- Autonomía y métricas anuales.
- Integración con control artificial.

## Fase 18 — Exteriores, vial y luz intrusiva

Dividir en productos internos independientes:

- Exteriores generales.
- Carreteras.
- Luz intrusiva.

Cada uno requiere objetos, normas, resultados y benchmarks propios. No reutilizar forzadamente reglas de interiores.

## Fase 19 — BIM/IFC

### Trabajo

- Importar estructura espacial.
- Mapear edificios, niveles, espacios y superficies.
- Conservar IDs IFC.
- Seleccionar elementos incluidos en cálculo.
- Exportar luminarias con coordenadas y propiedades.
- Manejar cambios/reimportación.

## Fase 20 — Capacidades superiores al escritorio

- Colaboración en tiempo real con bloqueo/merge de operaciones.
- Comentarios anclados a objetos.
- Versiones y comparación de revisiones.
- Cálculo en servidor opcional.
- Cola de escenarios.
- Optimización automática de cantidad/posición.
- Comparación energética y económica.
- Integración con metrados, circuitos y presupuesto.
- API para automatización.
- Plantillas organizacionales.
- Auditoría y aprobación.

## 12. Estrategia de frontend

## 12.1. Componentes

Tres categorías:

- Page/container: obtiene IDs y compone features.
- Feature controller: conecta casos de uso con estado.
- Presentational: props/eventos, sin store global.

Evitar componentes que importen simultáneamente store, Axios, motor CAD y componentes visuales.

## 12.2. Estado

- Zustand conserva documento editable y UI local.
- Resultados pesados fuera del historial de comandos.
- Selectores pequeños para evitar rerenders.
- Comandos de dominio para mutaciones.
- Estado temporal de formularios dentro del feature.

## 12.3. Inertia y Wayfinder

- Páginas Inertia solo en límites de navegación.
- Wayfinder centraliza rutas backend.
- Adaptadores API traducen DTO ↔ dominio.
- No usar URLs literales en componentes nuevos.
- Cálculo local no necesita petición Inertia.

## 13. Estrategia Laravel

Laravel será responsable de:

- Usuarios, organizaciones y permisos.
- Persistencia de proyecto y revisiones.
- Catálogos.
- Normativa versionada.
- Archivos fotométricos.
- Exportaciones servidor.
- Jobs de cálculo futuro.
- Auditoría.

No debe contener el mismo algoritmo fotométrico duplicado en PHP. Si hay cálculo servidor, reutilizar el mismo núcleo WASM/nativo o un servicio claramente versionado.

Estructura futura:

```text
app/Dialux/
├── Application/
├── Domain/
├── Infrastructure/
├── Http/
└── Jobs/
```

No migrar controladores existentes solo por estética; hacerlo cuando cambie el caso de uso.

## 14. Estrategia de pruebas

## 14.1. Vitest

- Matemáticas.
- Geometría.
- Parsers y normalizadores.
- Solvers.
- Evaluadores.
- Snapshots y hashes.
- Builders PDF/DXF.
- Hooks y componentes críticos.

## 14.2. Pest

- Autorización.
- Persistencia.
- Versiones de DTO.
- Catálogos.
- Upload/download.
- Exportaciones.
- Jobs.
- Tests de arquitectura backend.

## 14.3. Browser

- Crear proyecto.
- Importar plano.
- Calibrar.
- Crear nivel/recinto.
- Importar luminaria.
- Colocar.
- Calcular.
- Revisar resultados.
- Guardar y reabrir.
- Exportar.
- Sin errores JavaScript/console.

## 14.4. Golden tests

Guardar entradas y salidas numéricas pequeñas, no PDFs gigantes.

Cada golden incluye:

- Fuente.
- Versión.
- Configuración.
- Tolerancia.
- Justificación.

## 14.5. Pruebas metamórficas

- Duplicar luminarias duplica contribución directa.
- Duplicar flujo duplica lux directo.
- Alejar al doble reduce contribución según ley física.
- Rotar luminaria simétrica no cambia resultado.
- Reflectancia cero elimina reflexión.
- Agregar oclusor no aumenta luz directa.
- Refinar malla converge.

## 15. CI y puertas de calidad

Por cada PR/fase:

```text
npm run types
npm test
npm run build
php artisan test --compact
vendor/bin/pint --dirty --format agent   # si cambia PHP
```

Además:

- Tests analíticos siempre.
- Benchmarks en job separado.
- Comparativos de referencia por fase del motor.
- No aceptar regresiones numéricas sin explicación y actualización aprobada del golden.

## 16. Versionado y migración

- `projectSchemaVersion`.
- `photometrySchemaVersion`.
- `calculationSnapshotVersion`.
- `engineVersion`.
- `resultSchemaVersion`.
- `reportSchemaVersion`.

Crear migraciones puras y secuenciales:

```text
v1 → v2 → v3
```

Nunca llenar silenciosamente un campo técnico crítico con un default y presentarlo como dato real.

## 17. Rendimiento y escalabilidad

Medir:

- Número de niveles.
- Superficies/triángulos.
- Luminarias.
- Puntos de cálculo.
- Rayos.
- Iteraciones.
- Memoria máxima.
- Tiempo por etapa.

Fixtures:

- Pequeño: 1 recinto, 4 luminarias, 100 puntos.
- Mediano: 1 nivel, 20 recintos, 200 luminarias.
- Grande: MÓDULO I, 3 niveles, 24 ambientes.
- Estrés: límites acordados y cancelación.

Optimizar después de perfilar. Candidatos naturales para WASM:

- Interpolación masiva.
- Ray casting/BVH.
- Cálculo punto a punto.
- Radiosidad.
- Contornos.

## 18. Seguridad y robustez

- Limitar tamaño y complejidad de IES/LDT/GLDF/DXF/DWG.
- Validar matrices antes del cálculo.
- Prevenir números no finitos.
- Cancelar cálculos excesivos.
- Aislar Worker.
- No confiar en nombres/metadata de archivos.
- Autorizar proyectos y catálogos.
- Sanitizar informes.
- Registrar fallos sin guardar archivos sensibles completos.

## 19. Roadmap de entregas

### Entrega A — Base mantenible

Fases 0–2.

Resultado: arquitectura modular, mismo comportamiento.

### Entrega B — Directo confiable

Fases 3–5.

Resultado: cálculo directo validado con fotometría y superficies correctas.

### Entrega C — Interior profesional inicial

Fases 6–9.

Resultado: oclusión, reflexiones y UGR en alcance documentado.

### Entrega D — Flujo profesional web

Fases 10–13.

Resultado: escenas, resultados, rendimiento y documentación coherente.

### Entrega E — Especialidades

Fases 14–19, una por una.

### Entrega F — Diferenciadores

Fase 20.

## 20. Qué no hacer

- No afirmar paridad con DIALux por similitud visual.
- No desarrollar daylight antes de resolver materiales y oclusión.
- No implementar reflexiones dentro de componentes React.
- No duplicar solver en TypeScript y PHP.
- No reescribir el editor completo.
- No mover todos los archivos en una sola fase.
- No usar el PDF como fuente de resultados.
- No esconder fallbacks sintéticos.
- No agregar una norma sin fuente y edición.
- No optimizar sin benchmark.
- No actualizar goldens para hacer pasar un error no explicado.

## 21. Matriz de hitos

| Hito | Evidencia para declararlo completo |
|---|---|
| Arquitectura modular | Límites de dependencia, monolitos divididos y tests verdes |
| Fotometría confiable | IES/LDT validados e integración de flujo consistente |
| Cálculo directo validado | Suite analítica y comparación dentro de tolerancia |
| Oclusión | Casos de sombra y aberturas sin fugas |
| Interreflexión | Convergencia y benchmarks documentados |
| UGR profesional | Observadores/direcciones y comparación aceptada |
| Interior profesional | Flujo completo con resultados trazables |
| Emergencia | Objetos, escena, solver y reporte separados |
| Daylight | Cielo, clima, transmisión y métricas validadas |
| Paridad declarada | Matriz pública por feature, no una afirmación general |

## 22. Definición de terminado por funcionalidad

Una funcionalidad del motor está terminada únicamente si:

- Tiene contrato de entrada y salida.
- No depende de UI.
- Tiene pruebas analíticas o golden.
- Tiene benchmark cuando es costosa.
- Tiene procedencia y versión.
- Invalida resultados cuando cambian entradas.
- Expone warnings.
- Aparece consistentemente en UI e informe.
- Está documentado su alcance y sus limitaciones.

## 23. Criterio para afirmar “similar a DIALux evo”

No usar una sola etiqueta global. Publicar una matriz:

```text
Interiores / luz directa: validado
Interiores / interreflexión: beta
UGR: validado para recintos rectangulares
Emergencia: no soportado
Daylight: no soportado
Vial: no soportado
```

Solo una capacidad marcada como validada puede formar parte de una entrega profesional.

## 24. Primer ciclo recomendado

El primer ciclo debe cubrir únicamente Fases 0 y 1:

1. Crear fixtures numéricos actuales.
2. Medir resultados y rendimiento.
3. Definir contratos `CalculationSnapshot` y `CalculationRun`.
4. Encapsular el motor directo actual detrás de una interfaz.
5. Añadir hash e invalidación.
6. Mantener exactamente los resultados actuales.

Después iniciar la extracción de `CatalogPanel` y `MlightcadCanvas2D`. No comenzar por dividir `House3DBuilder` mientras el contrato de escena 3D no esté estabilizado.

## 25. Definición global de terminado

La evolución habrá alcanzado su primera meta profesional cuando:

- El código está dividido por dominio y responsabilidad.
- Ningún solver depende de React/Zustand/DOM.
- IES/LDT se normalizan y validan.
- Existen superficies de cálculo generales.
- Luz directa, oclusión, primera reflexión/interreflexión y UGR cumplen tolerancias aprobadas para interiores.
- Los resultados son versionados, reproducibles y se invalidan correctamente.
- El cálculo no bloquea la UI.
- UI, PDF y DXF consumen la misma ejecución.
- MÓDULO I puede recalcularse, analizarse y exportarse de extremo a extremo.
- Las limitaciones no implementadas se muestran claramente.
- Types, Vitest, Pest, build y benchmarks relevantes pasan.
- No se agregaron dependencias ni se cambiaron APIs públicas sin aprobación.

Al cumplir esta meta, el producto podrá considerarse una plataforma web profesional para iluminación interior en el alcance validado. Emergencia, daylight, exteriores, vial e IFC seguirán siendo programas de trabajo separados, no requisitos ocultos del primer lanzamiento.
