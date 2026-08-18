> **Corrección de arquitectura (2026-08-17), antes de ejecutar este plan:** el diagnóstico original asumía `dialux-core/src/ldt_parser.rs` (Rust→WASM) como base a ampliar. Verificado contra el código real: ese parser **nunca se llama desde el frontend** (grep completo de `resources/js` sin resultados para `parse_ldt_file`/`parse_ies_file`/`get_ldt_polar_data`) y tiene un bug de offsets confirmado (colapsa 10 líneas reales del espec EULUMDAT en 3 lecturas). El parser que SÍ usa la app en producción es `dialux-photometry` (CLI Rust, invocado por `ProductImportService.php`, con fallback PHP). Este plan ahora amplía ese parser, no `dialux-core`. Ver `planes/plan_cierre_brecha_paridad_dialux_evo.md` Ronda 21 para el detalle de la investigación.
>
> **Fase 1 — COMPLETADA (2026-08-17):** `dialux-photometry/src/main.rs` y `ProductImportService::parseLdt()` (PHP, fallback) ahora extraen TODOS los campos de cabecera EULUMDAT líneas 10-25 (antes descartados en silencio): tipo de luminaria/Ityp (forma), dimensiones físicas L/W/H, dimensiones del área luminosa (L/W + 4 alturas C0/C90/C180/C270), DFF%, LORL%, factor de conversión, tilt, y DR1-10 (factores de reducción). Offsets verificados contra la especificación oficial de DIALux (`evo.support-en.dial.de`) Y AGI32 (`docs.agi32.com`) — dos fuentes independientes — y contra 2 archivos LDT reales de fábrica (EMOS ZU210-9, Thorlux Lexi). IES también gana dimensiones (ancho/largo/alto del LM-63, con conversión pies→metros cuando corresponde). De paso se encontró y corrigió un bug real: PHP guardaba las dimensiones en milímetros crudos (el motor de cálculo espera metros) — sin override manual esto habría roto `luminousArea()`/UGR en silencio para cualquier import futuro. 8 tests Rust + 2 tests PHP nuevos, sin regresiones (verificado con el suite completo).
>
> **Fase 2/3 (modal de previsualización + edición) — COMPLETADA (2026-08-17):** nuevo endpoint `POST /dialux/products/preview` (`ProductController::preview()`) que corre el mismo parseo real (Rust + fallback PHP) SIN persistir — reutiliza `ProductImportService::import(..., persist: false)`, mismo patrón que `repairStoredProduct()`. Nuevo modal `PhotometricPreviewModal.tsx`: tabla de datos editable (nombre, fabricante, lúmenes, watts, CCT, CRI) + datos de solo lectura (forma/Ityp, dimensiones, área luminosa, DFF%, LORL%), diagrama polar CDL (reutiliza `buildPolarSvgFromMatrix.ts`, ya existente) y tabla UGR de referencia con botón "Recalcular" (reutiliza `computeEngineUgrTable.ts`, ya existente — con su disclaimer de "no es la tabla CIE 117 certificada" siempre visible). `ImportPhotometryForm.tsx` ahora previsualiza antes de guardar; el guardado real reenvía el archivo con los overrides editados al endpoint `/import` existente, ahora extendido para aceptar `total_lumens`/`power_watts`/`cct`/`cri_ra` como overrides (antes solo nombre/fabricante).
>
> **Pendiente:** iso-candela, sólido 3D, flujo zonal — no construidos. Sí se agregaron Diagrama cartesiano y Diagrama de cono (Ronda 21b) que faltaban de la lista original. Re-exportar LDT/IES editado (Fase 3 original, `ldt_writer.rs`/`ies_writer.rs`) sigue sin construir.
>
> **Ronda 21b (2026-08-17) — hallazgo real del usuario + ampliación de la tabla UGR:**
> - **Bug real**: "Type of lamps" (ej. "14W LED", línea 28 EULUMDAT) nunca se agregó al parser Rust — se descartaba en silencio aunque PHP sí lo capturaba. Sin ese dato, la potencia de la LÁMPARA (14W) era indistinguible de la potencia CONECTADA de la luminaria completa (17W, incluye driver) — confundir ambas parecía "un error de potencia". Corregido en Rust y expuesto en el modal (pestaña Lámparas), junto con `num_lamps` (que tampoco se exponía).
> - **SHR de la tabla UGR**: el usuario confirmó por observación directa contra el LDT Editor real que DIALux usa SHR=0.25 (no 1.0, como sugería la literatura general de CIE 190) — se mantiene sin cambios, documentado en el código para no revertirlo sin volver a verificar.
> - **Grilla de reflectancia ampliada**: `computeEngineUgrTables()` (nueva, plural) calcula la tabla UGR para 5 combinaciones de reflectancia habituales (antes solo 70/50/20 fijo), mostradas como columnas en el modal — más cerca de la densidad de la tabla real de DIALux. La función singular original (`computeEngineUgrTable()`, usada por el PDF de producción) queda intacta, sin cambios de comportamiento.
> - **Fuera de alcance, ya documentado como tal**: la clasificación por tabla estándar tipo "BK02/BK03" (método de tabla CIE 117 pre-calculada por forma de haz) y la sub-tabla de sensibilidad a la posición del observador ("S = 1.0H/1.5H/2.0H") — ninguna es replicable sin acceso al texto CIE 117 pagado o sin una inversión de ingeniería mayor; quedan fuera, con el disclaimer ya existente cubriendo el motivo.
>
> **Ronda 21c/21d (2026-08-17) — grilla de reflectancia también en el PDF + edición completa del catálogo:**
> - `computeEngineUgrTables()` (5 combinaciones) ahora también alimenta el PDF formal (`enrichProducts.ts` → `formal-pdf.blade.php`), en una sección de ancho completo (no la columna de 50% que antes tenía la tabla de una sola combinación — 11 columnas densas no caben legibles en media página A4). La tabla singular 70/50/20 se conserva sin cambios como fallback.
> - `lamp_type` ahora se puede EDITAR (antes solo se veía en el preview) — tanto al importar (override antes de guardar) como en un producto ya guardado, fusionado dentro de `metadata` sin pisar el resto (parser/luminaire_type/DFF%/etc.).
> - **Editar cualquier luminaria con archivo real (IES/LDT/GLDF) ahora abre el mismo modal rico** (`EditImportedLuminaireModal` + `PhotometricPreviewModal` en modo `edit`) — CDL polar, cartesiano, cono, tabla UGR y campos editables, en vez del formulario genérico. Las luminarias manuales/sintéticas (`source_format: manual`) siguen usando `ManualLuminaireForm`, que es el editor correcto para su curva sintética.
> - Crear, importar, editar, eliminar y compartir ya estaban implementados en el catálogo (`LuminaireCatalogSection.tsx`) desde antes de esta ronda — se verificó que siguen funcionando para ambos tipos de producto tras el cambio.

# Editor Fotométrico Profesional — Plan de Implementación por Fases

> **Objetivo:** Convertir el visor fotométrico actual del proyecto en un editor profesional de archivos LDT/IES/GLDF que iguale o supere a [photometriceditor.com](https://www.photometriceditor.com) (Viso Systems) y al LDT Editor integrado en DIALux evo, reutilizando la infraestructura existente de Rust/WASM + React.

---

## Diagnóstico Actual vs. Objetivo

### Estado actual del parser (lo que YA tenemos)

| Campo | LDT Parser ✅ | IES Parser ✅ | GLDF Reader ✅ |
|-------|:---:|:---:|:---:|
| Nombre luminaria | ✅ | ✅ | ✅ |
| Fabricante | ✅ | ✅ | ✅ |
| Tipo luminaria (Ityp) | ✅ | — | ✅ |
| Simetría (Isym) | ✅ | ✅ (implícita) | — |
| Dimensiones físicas | ✅ | ✅ | ✅ |
| Área luminosa | ✅ | ✅ | — |
| Flujo total (lm) | ✅ | ✅ | ✅ |
| Potencia (W) | ✅ | ✅ (keyword) | ✅ |
| CCT (K) | ✅ | — | ✅ |
| CRI / Ra | ✅ | — | ✅ |
| Eficiencia (lm/W) | ✅ | ✅ | ✅ |
| Fracción flujo abajo (DFF) | ✅ | — | — |
| LORL / Eficiencia luminaria | ✅ | — | — |
| Nº lámparas | ✅ | ✅ | — |
| Tipo lámpara | ✅ | ✅ | — |
| Planos C / ángulos gamma | ✅ | ✅ | — |
| Matriz candelas | ✅ | ✅ | — |
| Beam angle 50% / 10% | ✅ | ✅ | — |
| Max candela | ✅ | ✅ | — |
| **DR1–DR10 (Ratios Directos)** | ❌ ignorado | — | — |
| **Peso (kg)** | ❌ ignorado | — | — |
| **Flujo zonal (0-30°, 0-60°, etc.)** | ❌ no calculado | ❌ | — |
| **DFF / UFF (% arriba/abajo)** | ❌ parcial | ❌ | — |
| **Tabla UGR CIE 117/190** | ❌ | ❌ | — |
| **CU (Coef. Utilización)** | ❌ | ❌ | — |
| **BUG Rating (TM-15)** | ❌ | ❌ | — |
| **Iso-candela plot** | ❌ | ❌ | — |

### Lo que tiene photometriceditor.com (BENCHMARK)

| Capacidad | Photometric Editor | Nuestro sistema actual |
|-----------|:--:|:--:|
| Vista general (Overview dashboard) | ✅ | ❌ |
| Diagrama polar C0/C90 | ✅ | ✅ (solo WASM API) |
| Diagrama polar todos los planos C | ✅ | ❌ |
| Cono de iluminancia (lux vs distancia) | ✅ | ❌ |
| Gráfico cartesiano (ángulo vs cd) | ✅ | ❌ |
| Iso-candela (contorno de igual intensidad) | ✅ | ❌ |
| Vista 3D del sólido fotométrico (WebGL) | ✅ | ❌ |
| Tabla UGR (CIE 117 y CIE 190) | ✅ | ❌ |
| Flujo zonal (barras + porcentajes) | ✅ | ❌ |
| CU / Utilization table | ✅ | ❌ |
| BUG Rating (exterior) | ✅ | ❌ |
| Edición de lúmenes / potencia / CCT / CRI | ✅ | ❌ |
| Edición de simetría | ✅ | ❌ |
| Rotación / inversión de distribución | ✅ | ❌ |
| Edición de dimensiones | ✅ | ❌ |
| Edición de metadatos | ✅ | ❌ |
| Export LDT / IES / TM33 / SVG / PNG / CSV | ✅ | ❌ |
| Export PDF reporte indoor/outdoor | ✅ | ✅ (parcial) |
| Vista de archivo raw | ✅ | ❌ |
| API REST / Embed iframe | ✅ (PRO) | ❌ |
| Visor raw del archivo fuente | ✅ | ❌ |

---

## User Review Required

> [!IMPORTANT]
> **Sobre la librería `eulumdat` de crates.io:** Después de investigarla, **NO recomiendo adoptarla** por las siguientes razones técnicas:
> 1. **Ya tenemos un parser LDT propio** ([`ldt_parser.rs`](file:///c:/laragon/www/proyectopcl/dialux-core/src/ldt_parser.rs)) que lee todos los campos fotométricos esenciales y ya está integrado con WASM.
> 2. La librería `eulumdat` es solo un parser read-only sin capacidad de escritura/serialización — no exporta archivos LDT modificados.
> 3. Agregar una dependencia externa a nuestro `dialux-core` WASM rompe el principio de control total y añade riesgo de incompatibilidad con `wasm-bindgen`.
> 4. Lo que sí necesitamos es **ampliar nuestro parser existente** con los ~15 campos que actualmente ignora (DR1-DR10, peso, múltiples bloques de lámpara, etc.) y agregar la capacidad de **serializar de vuelta a LDT/IES** (escritura).
>
> **Recomendación:** Ampliar el parser propio, NO agregar la dependencia `eulumdat`.

> [!WARNING]
> Este plan tiene **6 fases**. Las Fases 1-3 son el núcleo para igualar al LDT Editor de DIALux. Las Fases 4-6 son para superar a photometriceditor.com. Cada fase es independiente y entregable — se puede parar en cualquier fase y el sistema queda funcional.

---

## Fase 1 — Parser Completo + Datos Derivados (Backend Rust/WASM)

**Objetivo:** Extraer TODOS los campos del estándar EULUMDAT y IESNA sin perder ni un dato. Calcular todos los indicadores derivados que el editor necesita.

### Fundamento técnico
El estándar EULUMDAT define 42 líneas fijas de cabecera más los bloques de ángulos y candelas. Nuestro parser actual ignora las líneas 17–26 (peso y DR1–DR10), no soporta múltiples bloques de lámpara, y no calcula flujo zonal ni coeficientes de utilización. Estos datos son obligatorios para generar la tabla UGR y el reporte PDF profesional.

### [MODIFY] [`ldt_parser.rs`](file:///c:/laragon/www/proyectopcl/dialux-core/src/ldt_parser.rs)
Ampliar `LdtData` con los campos faltantes:
```rust
// Nuevos campos a agregar
pub weight_kg: f64,                    // línea 17
pub direct_ratios: [f64; 10],          // DR1-DR10 (líneas 18-27)
pub ballast_factor: f64,              // factor de balasto (derivado)

// Soporte multi-lámpara (el LDT puede tener N bloques de lámpara)
pub lamp_sets: Vec<LampSet>,          // struct LampSet { num, type, lumens, cct, cri, watts }

// Flujo zonal calculado (integración de la web)
pub zonal_flux: ZonalFlux,            // struct: zone_0_30, zone_0_60, zone_0_90, zone_90_180, dff_pct, uff_pct
```

### [MODIFY] [`ies_parser.rs`](file:///c:/laragon/www/proyectopcl/dialux-core/src/ies_parser.rs)
- Extraer keywords adicionales: `[LAMP]`, `[BALLAST]`, `[BALLASTCAT]`, `[LAMPPOSITION]`, `[OTHER]`, `[SEARCH]`, `[MORE]`.
- Calcular flujo zonal por integración esférica (ya existe `estimate_lumens`, ampliarlo por zonas).

### [NEW] `src/zonal_flux.rs`
Módulo dedicado para:
```
Flujo zonal = ∫∫ I(γ,φ) · sin(γ) · dγ · dφ   [lm]
```
Zonas estándar: 0°–30°, 0°–60°, 0°–90° (downward), 90°–120°, 90°–180° (upward).

- **Fuente de la fórmula:** CIE 121:1996 "The photometry and goniophotometry of luminaires" § 6.3, y IESNA LM-79-08 § 9.1.
- **Por qué:** Es la única manera exacta de calcular cuánta luz sale hacia abajo (DFF) vs arriba (UFF). Los fabricantes lo publican; nosotros debemos verificarlo independientemente del parser.

### [NEW] `src/ugr_table.rs`
Cálculo de la tabla UGR tabulada completa según CIE 117:1995 para incluir en el PDF del producto:
```
UGR = 8 · log₁₀( (0.25/Lb) · Σ (L²·ω/p²) )
```
Para cada combinación estándar de:
- **Dimensiones de sala:** 2H × 2H, 4H × 4H, 8H × 4H, 8H × 8H, 12H × 8H, 12H × 12H
- **Reflectancias:** techo (70/50/30), paredes (70/50/30/10), piso (20)
- **Orientaciones:** crosswise y endwise

| Campo calculado | Fórmula | Fuente |
|---|---|---|
| Flujo zonal (lm por zona) | $\Phi_{zone} = \int_{\gamma_1}^{\gamma_2}\int_0^{2\pi} I(\gamma,\phi)\sin\gamma\,d\phi\,d\gamma$ | CIE 121:1996 |
| DFF / UFF (%) | $DFF = \Phi_{0-90°} / \Phi_{total} \times 100$ | IESNA LM-79 |
| LOR (%) | $LOR = \Phi_{luminaria} / \Phi_{lámpara} \times 100$ | CIE 121:1996 |
| Tabla UGR | CIE 117:1995 (tabulada para salas de referencia) | EN 12464-1 §4.6 |
| CU (Coef. Utilización) | Basado en DR1–DR10 y Room Cavity Ratio | IESNA Handbook, 10th ed. |

---

## Fase 2 — Componente React "Photometric Viewer" (Frontend)

**Objetivo:** Dashboard visual tipo photometriceditor.com con todas las vistas y diagramas.

### [NEW] `resources/js/pages/dialux/components/photometricViewer/`

Crear un componente modular con tabs/vistas:

#### Tab 1: Overview
- Resumen de todos los metadatos (fabricante, modelo, lúmenes, W, CCT, CRI, dimensiones)
- KPIs: max candela, beam angle, field angle, DFF/UFF, LOR, lm/W
- Mini diagrama polar (C0/C90) inline

#### Tab 2: Polar Diagram (Canvas 2D)
- Diagrama polar interactivo de distribución de intensidad luminosa
- Selección de planos C (todos, C0/C180, C90/C270, o cualquier combinación)
- Escala en cd o cd/klm (toggle)
- Overlay de múltiples planos para comparación
- **Por qué Canvas y no SVG:** rendimiento con cientos de puntos de datos; permite zoom/pan suave

#### Tab 3: Cartesian Plot
- Gráfico X=ángulo γ (0°–180°), Y=candela
- Comparar planos C seleccionados
- Útil para inspección detallada de picos y valles

#### Tab 4: Cone Diagram (Cono de iluminancia)
- Proyección del haz a distancias de 1m, 2m, 3m, 4m, 5m
- Muestra: diámetro del haz (m), E₀ centro (lux), E_avg (lux)
- **Fórmula:** $E_0 = I_0 / h^2$ donde $h$ = altura de montaje

#### Tab 5: Iso-candela
- Diagrama de contorno (como un mapa topográfico) mostrando curvas de igual intensidad
- Proyección equirectangular (γ en eje Y, φ en eje X)
- Colores tipo heatmap

#### Tab 6: 3D Solid (WebGL/Babylon.js)
- Sólido fotométrico 3D interactivo
- Ya tenemos Babylon.js en el proyecto (render 3D del edificio)
- Mapeo de color según intensidad (false-color gradient)
- Rotación, pan, zoom libre

#### Tab 7: UGR Table
- Tabla UGR tabulada completa (CIE 117)
- Dos orientaciones: crosswise y endwise
- Todas las combinaciones de reflectancia y tamaño de sala

#### Tab 8: Zonal Flux
- Gráfico de barras + tabla con flujo por zona angular
- Porcentajes acumulados
- DFF, UFF, LOR

#### Tab 9: Raw File
- Visor del contenido original del archivo LDT/IES
- Resaltado de sintaxis (líneas numeradas)
- Útil para debugging y verificación manual

---

## Fase 3 — Capacidad de Edición (Editor Mode)

**Objetivo:** Permitir modificar los datos fotométricos importados y re-exportar.

### Ediciones soportadas

| Operación | Descripción | Complejidad |
|---|---|---|
| **Escalar lúmenes** | Multiplicar toda la matriz de candelas por un factor | Baja |
| **Modificar potencia** | Cambiar W → recalcular lm/W | Baja |
| **Editar CCT / CRI** | Campos de texto, sin impacto en cálculo de luz | Baja |
| **Cambiar simetría** | Promediar/replicar planos C según nueva simetría | Media |
| **Rotar distribución** | Rotar φ → desplazar los planos C en N grados | Media |
| **Invertir (flip)** | Downlight ↔ Uplight: espejo en γ=90° | Media |
| **Editar dimensiones** | Cambiar largo, ancho, alto del housing y área luminosa | Baja |
| **Editar metadatos** | Nombre, fabricante, modelo, fecha, lab | Baja |
| **Combinar archivos** | Sumar distribución directa + indirecta | Alta |

### [NEW] `src/ldt_writer.rs` (Rust/WASM)
Serializar `LdtData` de vuelta al formato EULUMDAT texto plano.

### [NEW] `src/ies_writer.rs` (Rust/WASM)
Serializar `IesData` de vuelta al formato IESNA LM-63.

### [MODIFY] [`lib.rs`](file:///c:/laragon/www/proyectopcl/dialux-core/src/lib.rs)
Nuevas funciones WASM:
```rust
#[wasm_bindgen]
pub fn write_ldt_file(ldt_json: &str) -> String { ... }

#[wasm_bindgen]
pub fn write_ies_file(ies_json: &str) -> String { ... }

#[wasm_bindgen]
pub fn compute_zonal_flux(photometric_json: &str) -> String { ... }

#[wasm_bindgen]
pub fn compute_ugr_table(photometric_json: &str, reflectances_json: &str) -> String { ... }
```

---

## Fase 4 — Exportación Profesional (PDF, SVG, CSV, PNG)

**Objetivo:** Generar reportes profesionales del producto fotométrico.

### [NEW] Reporte PDF "Ficha Técnica de Luminaria"
Contenido del PDF por página:

| Página | Contenido |
|---|---|
| 1. Portada | Logo, nombre luminaria, fabricante, fecha |
| 2. Datos generales | Tabla de metadatos, dimensiones, KPIs eléctricos y fotométricos |
| 3. Diagrama polar | C0/C180 + C90/C270, escalado, con leyenda |
| 4. Cono de iluminancia | Distancias 1–5m con diámetros y lux |
| 5. Tabla UGR | Tabla completa CIE 117 (crosswise + endwise) |
| 6. Flujo zonal | Gráfico + tabla de zonas |
| 7. Tabla candelas | Matriz numérica completa (todos los planos × ángulos) |

### Exportaciones adicionales
- **SVG** de cada diagrama (vectorial para impresión)
- **PNG/JPG** de cada diagrama
- **CSV** con la matriz completa de candelas y tabla UGR

---

## Fase 5 — Formato TM33-18 (XML Moderno) + Mejoras Avanzadas

**Objetivo:** Soportar el formato moderno CIBSE TM33-18 y agregar capacidades avanzadas.

### [NEW] `src/tm33_parser.rs`
Parser y writer del formato XML TM33-18 (el sucesor moderno del LDT e IES, adoptado por la CIE como formato de intercambio universal desde 2019).

### CU Table (Coefficients of Utilization)
- Tabla de factores de utilización para Room Cavity Ratios 1–10
- Basada en los DR1–DR10 del LDT o calculada por integración zonal
- Combinaciones de reflectancia estándar (80/50/20, 70/50/20, etc.)
- **Fuente:** IESNA Lighting Handbook, 10th Edition, Ch. 9

### BUG Rating (para luminarias de exterior)
- Clasificación Backlight-Uplight-Glare según IESNA TM-15-07/11
- Zonas BUG: FH, FH, FM, FL (forward), BH, BM, BL (backward), UH, UL (uplight)
- **Fuente:** IESNA TM-15-11 "Luminaire Classification System for Outdoor Luminaires"

---

## Fase 6 — API REST + Embed (Nivel PRO)

**Objetivo:** Ofrecer el visor como servicio embebible y programático.

### [NEW] Endpoint Laravel
```
GET /api/v2/photometric/{id}/overview    → JSON con todos los KPIs
GET /api/v2/photometric/{id}/polar       → SVG/PNG del diagrama polar
GET /api/v2/photometric/{id}/ugr-table   → JSON con tabla UGR completa
GET /api/v2/photometric/{id}/convert     → Convertir LDT↔IES↔TM33
```

### [NEW] Componente Embebible
- Widget React standalone que puede montarse via iframe en sitios de terceros
- URL: `/embed/photometric?file={url}&view=polar`

---

## Verificación por Fase

| Fase | Verificación |
|---|---|
| 1 | `cargo test` — unit tests para cada campo nuevo del parser (comparar con archivos LDT/IES de referencia conocidos) |
| 2 | `npm run types` + `npm run build` — sin errores TypeScript; visual manual en el navegador |
| 3 | Round-trip test: importar LDT → editar lúmenes → exportar LDT → reimportar → verificar que los valores coincidan |
| 4 | Comparar PDF generado vs ficha técnica del fabricante (mismos valores de beam angle, DFF, UGR) |
| 5 | Validar TM33 exportado contra el validador oficial de CIBSE |
| 6 | Test de integración del endpoint API con Pest |

---

## Resumen de Archivos por Fase

### Fase 1 (Rust/WASM — parser completo)
- [MODIFY] `dialux-core/src/ldt_parser.rs` — campos faltantes
- [MODIFY] `dialux-core/src/ies_parser.rs` — keywords faltantes
- [MODIFY] `dialux-core/src/lib.rs` — nuevas funciones WASM
- [NEW] `dialux-core/src/zonal_flux.rs`
- [NEW] `dialux-core/src/ugr_table.rs`

### Fase 2 (React — visor profesional)
- [NEW] `resources/js/pages/dialux/components/photometricViewer/PhotometricViewer.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/OverviewTab.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/PolarDiagramTab.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/CartesianPlotTab.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/ConeDiagramTab.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/IsoCandela.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/Solid3DTab.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/UGRTableTab.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/ZonalFluxTab.tsx`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/RawFileTab.tsx`

### Fase 3 (React + Rust — edición)
- [NEW] `dialux-core/src/ldt_writer.rs`
- [NEW] `dialux-core/src/ies_writer.rs`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/tabs/EditTab.tsx`

### Fase 4 (PDF + exportaciones)
- [NEW] `resources/js/pages/dialux/export/document/productDatasheetPages.ts`
- [MODIFY] `resources/js/pages/dialux/export/useDialuxPdfExport.ts`

### Fase 5 (TM33 + CU + BUG)
- [NEW] `dialux-core/src/tm33_parser.rs`
- [NEW] `dialux-core/src/cu_table.rs`
- [NEW] `dialux-core/src/bug_rating.rs`

### Fase 6 (API)
- [NEW] `app/Http/Controllers/Dialux/V2/PhotometricApiController.php`
- [NEW] `resources/js/pages/dialux/components/photometricViewer/EmbedViewer.tsx`
