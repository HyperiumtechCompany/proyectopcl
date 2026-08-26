# Plan de validación física, teórica y numérica del motor luminotécnico

## 1. Objetivo

Construir y validar un motor web cuyos resultados sean trazables desde el archivo fotométrico hasta el informe final. El objetivo no es copiar un número de DIALux evo, sino:

- aplicar ecuaciones fotométricas comprobables;
- conservar correctamente la información del LDT;
- declarar supuestos y aproximaciones numéricas;
- reproducir casos analíticos;
- contrastar con otro motor y con mediciones físicas;
- mostrar fórmula, sustitución, resultado teórico, resultado del sistema y diferencia.

Una coincidencia aislada no demuestra corrección: puede ser cancelación de errores.

## 2. Diagnóstico

El plan anterior describía punto a punto, radiosidad y Radiance, pero no definía un procedimiento reproducible:

1. No distinguía el ángulo fotométrico `γ` del ángulo de incidencia `α`.
2. Mezclaba magnitudes radiométricas y fotométricas. Aquí se usarán iluminancia `E` [lx], exitancia luminosa `M` [lm/m²] y luminancia `L` [cd/m²].
3. Reducía el LDT a una tabla `I(C,γ)`, sin auditar escala cd/klm, flujo, simetría, orden de planos, ángulos no equidistantes ni orientación.
4. No separaba errores de entrada, modelo físico, discretización e informe.
5. No exigía el procedimiento numérico de cada resultado.

Orden de investigación:

`LDT → parser → cd absolutos → orientación/interpolación → directa → oclusión → interreflexión → malla/estadísticos → informe`.

No se ajustará una etapa posterior para ocultar una falla anterior.

## 3. Magnitudes y unidades

| Símbolo | Magnitud | Unidad |
|---|---|---|
| `Φ` | flujo luminoso | lm |
| `I(C,γ)` | intensidad luminosa | cd = lm/sr |
| `E` | iluminancia | lx = lm/m² |
| `M` | exitancia luminosa difusa | lm/m² |
| `L` | luminancia | cd/m² |
| `ρ` | reflectancia difusa | adimensional |
| `r` | distancia luminaria-punto | m |
| `γ` | ángulo respecto del eje fotométrico | grados/rad |
| `α` | ángulo entre rayo y normal receptora | grados/rad |
| `MF`, `UF` | mantenimiento y utilización | adimensional |

Reglas: convertir grados a radianes antes de trigonometría; no intercambiar flujo y candela; aplicar `MF` una sola vez; declarar si el resultado es inicial o mantenido; no aplicar eficiencia/LOR dos veces.

## 4. Teoría 1: iluminancia directa punto a punto

### 4.1 Fórmula general

```text
E_P = I(C,γ) · cos(α) / r²
E_directa(P) = MF · Σ[I_i(C_i,γ_i) · cos(α_i) · V_i / r_i²]
```

`V_i=1` si el rayo es visible y `V_i=0` si está ocluido.

### 4.2 Plano horizontal y luminaria vertical

```text
r = √(h² + x² + y²)
cos(γ) = h/r
α = γ
E_horizontal = I(C,γ) · cos(γ) / r²
             = I(C,γ) · cos³(γ) / h²
```

`I/r²` solo vale bajo la luminaria (`γ=0°`) o si el receptor es perpendicular al rayo.

### 4.3 Ejemplo analítico obligatorio

```text
I=1000 cd; h=3.00 m; γ=α=0°; MF=1.00
E = 1000·cos(0°)/3.00² = 1000/9 = 111.111 lx
```

El sistema debe devolver `111.111 lx` dentro de tolerancia. Después se repite fuera del eje para comprobar distancia e incidencia.

### 4.4 Procedimiento por punto y luminaria

| Paso | Dato/cálculo | Salida |
|---|---|---|
| 1 | coordenadas de luminaria y punto | `(x,y,z)` m |
| 2 | vector y distancia | `r` m |
| 3 | transformación a coordenadas locales | `C`, `γ` |
| 4 | interpolación fotométrica | `I(C,γ)` cd |
| 5 | incidencia | `cos(α)` |
| 6 | visibilidad | `V` |
| 7 | contribución inicial | `I·cos(α)·V/r²` lx |
| 8 | mantenimiento | `MF` |
| 9 | contribución mantenida | `E_i` lx |
| 10 | suma | `E_directa(P)` lx |

## 5. Teoría 2: método de flujo

Es una comprobación de iluminancia media; no reemplaza punto a punto ni produce `Emin` o uniformidad.

```text
Φ_total = N·Φ_luminaria
h_m = altura_luminaria − altura_plano
K = (L·W)/[h_m·(L+W)]
Ē_m = Φ_total·UF·MF/A
```

En recintos no rectangulares, `A` sale del polígono real. Si se usa `K`, se documentará el rectángulo equivalente.

### Ejemplo Módulo 22

```text
N=2; Φ_luminaria=2580 lm; Φ_total=5160 lm
A_DIALux=4.71 m²; MF=0.80; Ē_DIALux=203 lx
UF_aparente = Ē·A/(Φ_total·MF)
UF_aparente = 203·4.71/(5160·0.80) = 0.2316
```

Este `UF` es retrocalculado de DIALux: comprueba álgebra, no es una predicción independiente. Para independencia se necesita una tabla CU/UF válida o un modelo zonal documentado.

## 6. Reflexión difusa e interreflexión

Para parches Lambertianos:

```text
M_i = M_e,i + ρ_i·Σ(F_ji·M_j)
L_i = M_i/π
(I − R·F)M = M_e
```

Factor de forma:

```text
F_ij = (1/A_i) ∬[cos(θ_i)cos(θ_j)V_ij/(πr²)] dA_j dA_i
```

Condiciones:

```text
0 ≤ F_ij ≤ 1
Σ_j F_ij ≤ 1
A_iF_ij ≈ A_jF_ji
0 ≤ ρ_i < 1
E_total(P) = E_directa(P) + E_indirecta(P)
```

Pruebas mínimas:

1. `ρ=0`: idéntico a directa.
2. Una reflexión: igual a suma manual de parches.
3. Cavidad simple: converge y disminuye el residuo.
4. Reciprocidad y conservación de flujo.
5. Una barrera opaca reduce o mantiene `E`, no la aumenta por sí sola.
6. Refinar parches no cambia materialmente el resultado convergido.

Producción usa oclusión activa e interreflexión iterativa (`maxBounces=100`, tolerancia `1e-5`). El informe guardará configuración, convergencia, iteraciones y residuo.

## 7. El LDT como punto crítico de falla

Si la fotometría de entrada es incorrecta, una fórmula perfecta también dará resultados incorrectos.

### 7.1 Datos que deben conservarse

- tipo de luminaria y simetría;
- número y lista/separación de planos `C`;
- número y lista/separación de ángulos `γ`;
- flujo luminoso de referencia;
- intensidades, normalmente en `cd/klm`;
- fracción de flujo inferior y LOR, si existen;
- dimensiones, potencia, lámparas e identidad.

Los índices de línea deben verificarse contra EULUMDAT y archivos reales. Parser, interfaz e informes deben usar la misma definición.

### 7.2 Conversión de escala

```text
I_absoluta(C,γ) = I_LDT(C,γ)·Φ_ref/1000
```

Ejemplo real de control:

```text
I_LDT(0°,0°)=635.47 cd/klm
Φ_ref=2580 lm=2.58 klm
I_absoluta=635.47·2.58=1639.51 cd
```

Debe coincidir con un lector independiente. Una diferencia de factor `2.58` delata confusión entre `cd/klm` y `cd`.

### 7.3 Simetría y orientación

No inferir toda la simetría solo por el máximo C. Probar cada código con valores distintos por plano y direcciones en los cuatro cuadrantes:

- sin simetría: preservar `0–360°` y cierre `360°≡0°`;
- simetría declarada: reconstruir exactamente lo indicado por el formato;
- giro de luminaria `90°`: el haz asimétrico también gira `90°`;
- inclinación: transformar el vector mundial al sistema local antes de hallar `C,γ`;
- no confundir orientación geométrica, plano C y gamma.

### 7.4 Interpolación

```text
tC=(C−C0)/(C1−C0); tγ=(γ−γ0)/(γ1−γ0)
I0=I(C0,γ0)+tγ[I(C0,γ1)−I(C0,γ0)]
I1=I(C1,γ0)+tγ[I(C1,γ1)−I(C1,γ0)]
I(C,γ)=I0+tC(I1−I0)
```

Debe cubrir pasos no equidistantes, límites, cierre C0/C360 y datos inválidos. Un archivo truncado no se rellenará silenciosamente con ceros para un cálculo definitivo: se rechaza o queda marcado como inválido.

### 7.5 Conservación del flujo

```text
Φ_integrado = ∫₀²π ∫₀π I(C,γ)sin(γ)dγdC
error_flujo = |Φ_integrado−Φ_ref|/Φ_ref·100%
DFF = Φ_0–90/Φ_integrado·100%
UFF = Φ_90–180/Φ_integrado·100%
```

La integración zonal existente debe ser puerta de calidad. Propuesta inicial: advertir sobre `3%` y bloquear el estado “validado” sobre `5%`, salvo explicación por diferencia entre flujo de lámpara, flujo de luminaria y LOR.

### 7.6 Identidad y procedencia

Guardar hash original, fabricante, nombre interno, variante, flujo, potencia, versión del parser, unidad y advertencias. Si el producto y el LDT no coinciden o hay variantes con diferente flujo, advertirlo. Nunca elegir la variante por cercanía al resultado esperado.

## 8. Tabla obligatoria teoría vs sistema

| Magnitud | Fórmula | Sustitución | Teoría | Sistema | Error | Estado |
|---|---|---|---:|---:|---:|---|
| candela de control | `I_LDT·Φ/1000` | `635.47·2.58` | `1639.51 cd` | medir | — | pendiente |
| flujo integrado | integral angular | LDT exacto | calcular | calcular | — | pendiente |
| punto bajo luminaria | `I(0,0)/h²` | caso | calcular | calcular | — | pendiente |
| punto fuera de eje | `I·cos(α)/r²` | caso | calcular | calcular | — | pendiente |
| `Ē_directa` | `ΣE_j/n` | misma malla | calcular | calcular | — | pendiente |
| `Ē_indirecta` | `Ē_total−Ē_directa` | misma malla | calcular | calcular | — | pendiente |
| `Ē_total` | `ΣE_j/n` | puntos publicados | calcular | calcular | — | pendiente |
| `Emin`, `Emax` | `min/max(E_j)` | puntos publicados | calcular | calcular | — | pendiente |
| `Uo` | `Emin/Ē` | anteriores | calcular | calcular | — | pendiente |
| potencia específica | `ΣP/A` | caso | calcular | calcular | — | pendiente |

```text
error_relativo = |x_sistema−x_ref|/|x_ref|·100%
sesgo = (x_sistema−x_ref)/x_ref·100%
RMSE = √[Σ(E_sistema,j−E_ref,j)²/n]
```

Cerca de cero usar error absoluto. No comparar medias con mallas distintas sin publicar separación, borde, altura, zona marginal y puntos incluidos.

## 9. Matriz de validación

### Nivel A — Parser LDT

- cabecera y conteos exactos;
- matriz completa, sin ceros inventados;
- escala cd/klm → cd;
- todas las simetrías y cierre angular;
- interpolación en nodos e intermedios;
- flujo total/zonal reintegrado;
- valores de control contra lector independiente.

### Nivel B — Directa analítica

- fuente puntual sobre plano perpendicular;
- punto horizontal fuera del eje;
- superposición de dos luminarias;
- rotación asimétrica;
- `MF=1.0` y `MF=0.8`;
- barrera opaca conocida.

### Nivel C — Interreflexión

- superficies negras;
- una reflexión manual;
- caja difusa con reciprocidad/conservación;
- convergencia al refinar parches y rebotes;
- geometría cóncava, jambas y aberturas.

### Nivel D — Radiance

Construir la misma geometría, normales, fotometría, orientación, reflectancias, puntos, mantenimiento y parámetros. Radiance es referencia numérica independiente, no medición de la “realidad”. La diferencia se investiga antes de atribuirla a otro motor.

### Nivel E — DIALux evo

Comparar `Ē`, `Emin`, `Emax`, `Uo` y UGR cuando aplique. Es referencia profesional de interoperabilidad, pero no se introducirán multiplicadores ocultos para imitarla.

### Nivel F — Medición física

- luxómetro calibrado y clase documentada;
- posición, altura y orientación de cada lectura;
- tensión, potencia, temperatura y estabilización;
- reflectancias medidas o justificadas;
- luz natural anulada o registrada;
- repetición e incertidumbre;
- medición vs motor vs Radiance vs DIALux.

## 10. Tolerancias iniciales

| Prueba | Criterio de desarrollo |
|---|---|
| directa analítica | error `≤0.1%` |
| nodo exacto LDT | redondeo `≤0.01%` |
| interpolación artificial | error `≤0.1%` |
| flujo reintegrado | objetivo `≤3%`; investigar `>5%` |
| refinamiento de malla | cambio de `Ē≤1%` |
| radiosidad | residuo `≤1e-5` y conservación |
| comparación de motores | tolerancia por métrica/caso |

Los límites finales se justificarán con norma e incertidumbre. Un resultado `199–203 lx` frente a un requisito de `200 lx` es limítrofe, no una certeza.

## 11. Procedimiento para Módulo 22

1. Identificar por hash el LDT exacto de cada luminaria.
2. Resolver diferencias entre nombre interno, variante, flujo y potencia.
3. Publicar `C`, `γ`, candela LDT y absoluta en cinco direcciones como mínimo.
4. Reintegrar flujo total, inferior y superior.
5. Verificar posición, giro e inclinación de cada instancia.
6. Ejecutar `direct-only`, luego oclusión, una reflexión y radiosidad iterativa.
7. Registrar el aporte de cada etapa por ambiente.
8. Repetir con los mismos puntos en DIALux y Radiance.
9. Completar la tabla teoría vs sistema con resultados regenerados.

Los informes históricos mezclan modos, reparaciones fotométricas y mallas de rondas distintas. Son evidencia histórica, no una línea base única, hasta regenerarlos con un manifiesto común.

## 12. Implementación involucrada

| Etapa | Archivo principal |
|---|---|
| parser LDT | `dialux-core/src/ldt_parser.rs` |
| interpolación/candela | `resources/js/pages/dialux/hooks/photometricInterpolation.ts` |
| cálculo | `resources/js/pages/dialux/hooks/lightingEngineCore.ts` |
| parches | `resources/js/pages/dialux/hooks/roomPatches.ts` |
| transferencia | `resources/js/pages/dialux/hooks/radiosityTransfer.ts` |
| radiosidad | `resources/js/pages/dialux/hooks/iterativeRadiosity.ts` |
| configuración | `resources/js/pages/dialux/domain/calculation/productionCalculationConfig.ts` |
| flujo zonal | `resources/js/pages/dialux/export/derived/data/computeZonalFlux.ts` |
| caso Módulo 22 | `resources/js/pages/dialux/domain/calculation/modulo22GoldenCase.test.ts` |
| Radiance | `resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle/` |

## 13. Entregables

1. Manifiesto de entrada: geometría, materiales, luminarias, hash LDT, orientación, plano, malla, `MF` y solver.
2. Auditoría LDT: cabecera, escala, simetría, candelas de control, flujo integrado/zonal y advertencias.
3. Cuaderno teoría vs sistema con sustitución y unidades.
4. Desglose: directa, oclusión, primera reflexión, rebotes y total.
5. Comparación espacial: mismos puntos, mapa de diferencias, sesgo y RMSE.
6. Protocolo físico con incertidumbre.
7. Suite de casos analíticos, LDT, radiosidad y casos dorados.

## 14. Definición de terminado

- Los LDT pasan la auditoría o tienen excepción justificada.
- Los casos analíticos reproducen fórmula y unidades.
- La radiosidad converge, conserva flujo y es estable a refinamiento.
- Cada resultado se reconstruye desde sus entradas.
- Las comparaciones usan escenas y puntos equivalentes.
- Las diferencias restantes tienen causa, magnitud e incertidumbre.
- Compilan el código y pasan los tests relacionados.
- No existen factores calibrados para imitar un caso particular.

> El motor implementa un modelo fotométrico trazable, validado con casos analíticos, control integral del LDT, comparación numérica independiente y mediciones físicas dentro del alcance y tolerancias declarados.
