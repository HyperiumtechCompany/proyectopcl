# Triangulación fotométrica: motor propio, Radiance y DIALux evo

Informe de validación técnica — versión markdown de referencia interna. Versión publicada (para compartir con un ingeniero colegiado o un cliente): [Artifact "Triangulación Fotométrica"](https://claude.ai/code/artifact/d67f0a06-710a-4452-9dde-75aeb22db5be). Fuente completa de datos: `plan_cierre_brecha_paridad_dialux_evo.md` (Rondas 23-24) y `plan_precision_fisica_motor_dialux_vs_evo.md`.

## Alcance exacto de esta afirmación

**En la componente de interreflexión (luz reflejada por techo/pared/piso) de espacios interiores cerrados con reflectancia típica (~0.7/0.5/0.2), y medido contra un renderizador físico independiente y académicamente validado, el modo `iterative` del motor propio se acerca más a la física real que los valores reportados por DIALux evo — en los 4 casos reales verificados hasta ahora.**

Esto NO es "nuestro sistema es mejor que DIALux evo" sin más. No cubre UGR, alumbrado de emergencia, eficiencia energética, exportación DXF, ni espacios industriales de reflectancia baja (ver "Qué NO se afirma"). Cada cifra es reproducible por cualquier tercero.

## 1. Por qué existe esta validación

DIALux evo es software comercial de código cerrado — no hay forma de leer su algoritmo, solo comparar su salida contra algo más. Ajustar el motor propio hasta que su número se parezca al de DIALux evo no es una corrección defendible ante un ingeniero: es imitar una caja negra sin saber si esa caja negra es correcta. Se necesitaba un tercer punto de referencia que ninguno de los dos softwares controle: un método físicamente correcto, publicado, auditable y validado de forma independiente. Ese tercer punto es **Radiance**.

## 2. Metodología

- **Radiance**: motor de simulación de iluminación de código abierto (licencia BSD), LBNL, en desarrollo desde 1985, usado extensamente en investigación de iluminación/arquitectura publicada y revisada por pares.
- **CIE 171:2006**: el conjunto de casos analíticos con solución exacta conocida que la industria usa para validar software lumínico. Mangkuto (2016, *LEUKOS*, revisado por pares) validó tanto DIALux 4.12 (radiosidad) como DIALux evo 4.1 (photon shooting) contra estos casos — el mismo estándar de escrutinio que respalda a Radiance en la literatura de la disciplina.
- **Triangulación**: para cada caso real (geometría/luminarias/reflectancias/resultado de un PDF real de DIALux evo), se recrea la MISMA escena en Radiance (polígono real del ambiente, fotometría IES/LDT real, reflectancias declaradas) y se corre el motor propio sobre el mismo caso — tres números sobre el mismo problema físico exacto.
- **Control de calidad**: se encontró y corrigió un bug real de medición (factor de mantenimiento aplicado de forma no homogénea entre el motor propio y Radiance, sub-reportando ~20% los resultados del motor antes del fix) — ver Ronda 23 del historial.

## 3. Resultados — 4 casos reales (reflectancia 0.7/0.5/0.2)

| Caso | Área | DIALux evo | `first-bounce` (Δevo) | `iterative` (Δevo) | Radiance (física) | Δ(evo, física) |
|---|---:|---:|---:|---:|---:|---:|
| SS.HH — Módulo 22 | 2.18 m² | 206 | 215.4 (+4.6%) | 240.9 (+16.9%) | 266.5 | −29.4% |
| Caseta de Control — Módulo 22 | 4.73 m² | 203 | 199.7 (+1.6%) | 225.8 (+11.2%) | 251.2 | −23.8% |
| Aula 1° — Vinchos | 43.80 m² | 544 | 592.3 (+8.9%) | 618.0 (+13.6%) | 705.2 | −29.6% |
| Aula 2° — Vinchos | 42.71 m² | 567 | 635.6 (+12.1%) | 660.9 (+16.6%) | 726.7 | −28.2% |

`iterative` vs. Radiance (no vs. evo): 9.1%–12.4% en los 4 casos — el más cercano a la física, sin excepción. `first-bounce` vs. Radiance: 12.5%–20.5%. Luz directa motor-vs-Radiance: 0.2%–3.7% (valida geometría/fotometría/malla, antes de discutir interreflexión).

**Hallazgo central**: DIALux evo queda 23.8%-29.6% por debajo de la física real en los 4 casos — un rango de solo 6 puntos pese a que el área varía 20 veces. Consistente con la limitación de "photon shooting con presupuesto de fotones limitado" que el propio DIAL GmbH documenta.

## 4. Resultados — matriz de escala y reflectancia (sin referencia real de DIALux evo)

| Ambiente | Área | Reflectancia (t/p/s) | `first-bounce` (Δ Radiance) | `iterative` (Δ Radiance) | Radiance |
|---|---:|---|---:|---:|---:|
| Oficina pequeña | 30 m² | 0.70/0.50/0.30 | 406.5 (16.4%) | 456.5 (**6.1%**) | 486.2 |
| Bodega mediana | 120 m² | 0.50/0.30/0.20 | 391.1 (**0.1%**) | 425.1 (8.6%) | 391.5 |
| Nave industrial grande | 360 m² | 0.50/0.30/0.20 | 436.2 (**3.3%**) | 475.8 (5.5%) | 450.8 |
| Ambiente libre/abierto | 120 m² | 0.50/0.05/0.20 | 372.0 (**4.0%**) | 392.0 (9.6%) | 357.7 |

**El patrón se invierte con reflectancia industrial**: con reflectancia interior típica (oficina, 0.70/0.50/0.30) `iterative` gana, consistente con la sección 3. Con reflectancia industrial más baja (0.50/0.30/0.20), `first-bounce` iguala o supera a `iterative` en los 3 casos. La conclusión de la sección 3 NO generaliza a proyectos industriales sin más evidencia — y ninguno de estos 4 ambientes tiene referencia real de DIALux evo todavía.

## 5. Qué significa esto, con precisión

Para espacios interiores cerrados con reflectancia clara típica: (1) la luz directa del motor coincide con Radiance dentro de 0.2%-3.7% — geometría/fotometría/malla correctas; (2) `iterative` se acerca más a la física independiente que DIALux evo, en los 4 casos disponibles; (3) la producción ya usa `iterative` por defecto desde el 2026-08-19 (decisión tomada por otras razones), confirmada ahora por una vía completamente independiente.

## 6. Qué NO se afirma

- **N pequeño**: 4 casos reales — suficiente para desconfiar de "parecerse a DIALux evo = correcto", insuficiente para una ley general.
- **Sin mediciones de campo todavía**: ninguna cifra viene de un luxómetro calibrado en una instalación real — la única verdad física no disputable.
- **Radiance no es infalible**: estimador Monte Carlo con sesgo controlable, validado académicamente pero no una verdad matemática exacta en sí mismo.
- **Reflectancia industrial sin resolver**: la sección 4 muestra el patrón invertido, sin ningún caso real de DIALux evo ahí.
- **Solo interreflexión**: no cubre UGR, emergencia, DXF, cálculo eléctrico ni cumplimiento normativo.
- **DIALux evo es una caja cerrada**: toda afirmación sobre "cómo calcula" viene de literatura secundaria (DIAL GmbH, Mangkuto 2016), no del código fuente real.

## 7. Reproducibilidad

```
npm run setup:radiance
npx vitest run resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle
```

Casos reales: `modulo22RealCase.test.ts`, `multiCaseRealTriangulation.test.ts`. Matriz de escala: `radianceOracleIndustrialScale.test.ts`. Historial completo: `plan_cierre_brecha_paridad_dialux_evo.md`, `plan_precision_fisica_motor_dialux_vs_evo.md`.

## 8. Para qué usar esto hoy — y para qué no

**Defendible hoy**: sustentar por qué el número de interreflexión en un ambiente interior típico no tiene que parecerse a DIALux evo para ser correcto; mostrar una metodología de validación reproducible que DIALux evo no puede ofrecer sobre sí mismo; justificar `iterative` como default de producción en interiores de reflectancia típica.

**Todavía no**: afirmar superioridad general sobre DIALux evo sin acotar el alcance; certificar cumplimiento normativo (exige firma de ingeniero colegiado); extender la conclusión a proyectos industriales sin triangular casos reales de ese tipo.

## 9. Referencias

1. [DIALux evo – New calculation method](https://www.dialux.com/fileadmin/documents/DIALux_evo-_New_calculation_method.pdf) — DIAL GmbH.
2. Mangkuto, R. A. (2016). [Validation of DIALux 4.12 and DIALux evo 4.1 against the Analytical Test Cases of CIE 171:2006](https://www.tandfonline.com/doi/abs/10.1080/15502724.2015.1061438). *LEUKOS*, 12(3).
3. [Radiance (LBNL-ETA)](https://github.com/LBNL-ETA/Radiance) — repositorio oficial, licencia BSD.
4. [DIALux evo Knowledge Base — UGR](https://evo.support-en.dial.de/support/solutions/articles/9000116115-ugr).
5. [Fagerhult — Number of calculation points (EN 12464-1)](https://www.fagerhult.com/knowledge/light-planning/en-12464-1/calculation-areas/number-of-calculation-points/) — fuente secundaria de fabricante.
6. [Esse-Ci — Maintenance factor (LLMF/LSF/LMF/RSMF)](https://www.esse-ci.com/en/utility/maintenance-factor/).
7. Jensen, H. W. (1996). [Global Illumination using Photon Maps](http://graphics.ucsd.edu/~henrik/papers/photon_map/).
8. CIE 171:2006 — *Test Cases to Assess the Accuracy of Lighting Computer Programs* (citado vía [2], sin acceso directo al texto en esta investigación).
9. `planes/plan_cierre_brecha_paridad_dialux_evo.md`, `planes/plan_precision_fisica_motor_dialux_vs_evo.md` — historial completo, cada cifra trazable a una ronda específica.

---
*Ninguna cifra de este documento certifica cumplimiento normativo — eso exige la revisión y firma de un ingeniero colegiado responsable del proyecto real.*
