# Plan — Conectar edificios (módulos) a la Planta General y cerrar la caída de tensión

Fecha: 2026-09-28 · Proyecto de referencia: 9 (Planta General = módulo 7, "Módulo 1" = módulo 8)

## 1. Diagnóstico

### Lo que ya funciona (no se rehace)
- **Puente planta → red** (`site/domain/siteNetworkBridge.ts`): un cable dibujado desde un tablero de la planta (TG / sub tablero) hasta un **edificio vinculado a un módulo** (`building_block.moduleId`) alimenta el **tablero raíz** de ese módulo en Red y CT.
- **Longitud del alimentador** = recorrido dibujado (aéreo / subterráneo, con cotas y desperdicio) + subida del tablero (`piso + altura de montaje`, `panelVerticalM`).
- **Caída de tensión en cascada**: se acumula en % TG → TD → Sub‑TD → circuitos (F6 de `plan_compatibilizacion_planta_general_red_ct.md`), con IEC 60364‑5‑52 Anexo G en los alimentadores.
- **Tabla CT en árbol**: TG → TD → Sub‑TD → salidas (2026‑09‑26).

### Por qué el edificio del proyecto 9 no está conectado
| Hecho (BD, 2026‑09‑28) | Consecuencia |
|---|---|
| 0 de 10 edificios con módulo vinculado | Un cable a un edificio no llega a ningún tablero (aviso `block-unlinked`) |
| 0 cables del TG a un edificio | TD‑01 del Módulo 1 cuelga del TG sin el recorrido real → su ΔU no refleja la distancia |
| Módulo 1 tiene 1 tablero (TD‑01) | Es el tablero raíz: el cable no necesita elegir tablero |

### Brechas reales del sistema
1. **Conexión poco visible**: el vínculo edificio ↔ módulo y el tablero de llegada están en propiedades, sin guía ni estado visible en el plano.
2. **Recorrido interior no contado**: el cable termina en el **centro del bloque**; el tramo dentro del edificio (acometida → TD‑01) no suma longitud. La subida vertical sí se cuenta.
3. **ΔU extremo a extremo no visible en la planta**: hay que ir a Red y CT para ver si el circuito más desfavorable del edificio cumple.
4. **Rendimiento**: clics de 160–360 ms en la planta (consola). El cálculo de alumbrado y el de la red en vivo corren en el hilo principal en cada edición.

## 2. Qué puede hacer el usuario hoy (sin esperar código)
1. Planta General → seleccionar el edificio donde va el Módulo 1 → Propiedades → **Módulo vinculado = Módulo 1**.
2. Herramienta de cableado → desde la **salida del TG** hasta el edificio (tipo de tendido: subterráneo / aéreo).
3. Red y CT → TD‑01 aparece colgado del TG con la longitud del recorrido + subida; la tabla CT (árbol) muestra la ΔU acumulada.

## 3. Fases propuestas

### C1 — Conexión guiada (funcionalidad)
- En las propiedades del edificio: bloque **"Conexión eléctrica"** arriba: módulo vinculado, tablero de llegada (si hay varios raíz), TG / salida que lo alimenta, estado.
- Botón **"Conectar al TG"**: elige TG y salida; traza el cable automáticamente (ruta más corta evitando edificios, reutiliza el auto‑circuitado E1) y deja editar los puntos.
- En el 2D: insignia sobre cada edificio vinculado — "Módulo 1 · TD‑01 · ΔU 1,8 %" — con color por estado (dentro / fuera del límite / sin conectar).
- Avisos del puente (`block-unlinked`, `module-no-panel`, `module-panel-ambiguous`) visibles en la planta, no solo en la red.

### C2 — Longitud completa del alimentador (precisión de ΔU)
- **Punto de acometida**: el cable termina en el **borde del edificio** (el lado más cercano o uno elegido), no en su centro.
- **Recorrido interior**: campo por cable "recorrido dentro del edificio (m)". Valor propuesto = distancia acometida → TD‑01 en el plano del módulo, si el plano está ubicado sobre el bloque (C2b); si no, manual.
- **C2b (opcional)**: ubicar el plano del módulo sobre el bloque (desplazamiento + rotación). Da la posición real de TD‑01 en la planta.
- Desglose H / V por tramo en la tabla CT (las columnas ya existen) con su origen: recorrido exterior, interior, subida.

### C3 — Caída de tensión extremo a extremo
- Por edificio: ΔU acumulada TG → TD‑01 → **circuito más desfavorable**, contra los límites configurados (2,5 % alimentador / 4 % total, criterio ya usado en la tabla CT; edición CNE por confirmar).
- Si no cumple: botón **"Sugerir sección"** con el optimizador R5 ya existente (`sectionOptimizer.ts`) y "Corregir automáticamente" de la tabla CT.
- Mismo dato en el PDF de la planta (sección "Salidas de tableros") y en el unifilar.

### C4 — Rendimiento
- Cálculo de alumbrado exterior en un **Web Worker** (fase X3 pendiente): la UI no se congela al calcular.
- Red en vivo en la planta: recalcular solo cuando cambian datos **eléctricos** (tableros, cables, cargas), no al mover un árbol o editar un texto; con *debounce* de 150 ms.
- Meta medible: clic en la planta < 100 ms con el proyecto 9 (hoy 160–360 ms).

### C5 — Verificación (tesis)
- Test con caso a mano: TG → TD‑01 con longitud conocida, ΔU = K·I·ρ·L·cosφ / S, contra el motor.
- Prueba con los datos reales del proyecto 9 (edificio vinculado + cable) → ΔU en la tabla CT, en la planta y en el PDF, iguales.

## 4. Orden recomendado
**C1 → C2 → C3 → C4 → C5.** C1 y C2 cierran la conexión y la precisión de la ΔU, lo que más preocupa. C3 lo hace visible, C4 da fluidez y C5 lo deja respaldado para la tesis.

## 5. Decisión pendiente
- C2b (ubicar el plano del módulo sobre el bloque) da la longitud interior exacta, pero exige posicionar cada plano. Alternativa: longitud interior manual por cable. **Recomendación:** empezar con la manual (C2) y hacer C2b después.

## 6. Avance

### 2026-09-28 — C1 + C2 hechas, C3 parcial
- **C1**: `BuildingConnectionPanel.tsx` en las propiedades del edificio (módulo vinculado, tablero de llegada, cable, avisos del puente) + botón **"Conectar al tablero"** (`useSiteEditor.connectBlockToPanel` → `domain/blockConnection.ts`: recto o en L sin cruzar otros edificios, subterráneo 0,6 m). Insignia 2D: "Módulo: TD · desde TG · ΔU %" o, sin cable, "Módulo · sin cable desde el tablero" (ámbar).
- **C2**: acometida en la FACHADA (`wireAnchors.buildingEntryPoint`, usada por 2D, 3D y longitud) + `SiteCircuit.interiorLengthM` (recorrido interior) sumado a la longitud horizontal del alimentador en el puente. Decisión: longitud interior manual (C2b queda para después).
- **C3 (parcial)**: el panel del edificio muestra ΔU del alimentador (límite 2,5 %) y **punta a punta** = alimentador + circuito más desfavorable del módulo (`port.circuits[].cumulativeVoltageDropPct`, límite 4 %). Falta: "Sugerir sección" y el dato en PDF / unifilar.
- **C4 (medición)**: con el proyecto 9, `deriveSiteNetworkLive` tarda 2,6 ms (no es el cuello de botella); `calculateSiteLighting` 95 ms (→ Web Worker). Los clics lentos son de render: perfilar antes de optimizar.

### 2026-09-28 — C3 completa
- `blockConnection.ts`: `suggestFeederSection` (menor sección normalizada que cumple ΔU propia ≤ límite de alimentador Y punta a punta ≤ límite total, fórmula IEC 60364-5-52 Anexo G de la red, piso = sección por ampacidad de la red; test con caso a mano), `moduleWorstCircuit`, `buildingFeedRows` (fuente única para panel, PDF y unifilar).
- Panel del edificio: límites leídos de la red (`networkSettings`), botón "Sugerir sección: aplicar X mm²" (escribe `SiteCircuit.sectionMm2`, que el puente pasa a la red) o aviso si ni 300 mm² alcanza.
- PDF de la planta: página "Alimentadores a edificios (módulos)" (L total/interior, conductor, ΔU alimentador, circuito más desfavorable, punta a punta, "Dentro/Fuera del límite").
- Unifilar: el tablero raíz de cada módulo muestra "dU max C-x … -> total y %" y se marca si supera el límite total.
- Siguiente: C4 (rendimiento: perfilar el render, alumbrado en Web Worker) y C5 (verificación e2e con el proyecto 9).

### 2026-09-28 — C4 (parte 1): alumbrado en Web Worker
- `site/workers/siteLightingWorker.ts` + `siteLightingWorkerProtocol.ts` + cliente `site/lib/siteLightingWorkerClient.ts` (singleton por pestaña, mismo patrón blob + `?worker&url` que `useDialuxCalculationWorker`; respaldo síncrono si el worker no se crea o falla). `useSiteLightingCalculation.run/runArea` lo usan.
- Verificado: build genera `siteLightingWorker-*.js` (32 KB, sin window/document); prueba de humo en node con el proyecto 9: 14 áreas en ~118 ms fuera del hilo de la UI; test del respaldo síncrono con resultado idéntico.
- Pendiente C4 parte 2: perfilar el render (clics 160–360 ms) con una grabación del usuario. Las vistas previas de proyección (`siteFixtureProjection`/`siteLinearProjection`) siguen calculando síncrono (un solo espacio).
- C5: la verificación e2e necesita que el usuario vincule el edificio del Módulo 1 y trace el cable; luego se contrasta panel / Red y CT / PDF / unifilar con los datos de la BD.
