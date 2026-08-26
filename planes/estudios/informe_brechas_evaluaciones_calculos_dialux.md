# Informe de brechas para evaluaciones y cálculos luminotécnicos equivalentes

## Resumen técnico

El sistema ya dispone de los componentes fundamentales para calcular iluminación normal y una primera evaluación de emergencia: fotometría IES/LDT, malla punto a punto, `Eavg`, `Emin`, `Emax`, `Uo`, UGR, factor de mantenimiento, oclusión, interreflexión, modo de emergencia por luminaria, punto crítico e informe separado. Sin embargo, todavía no puede declarar equivalencia funcional o normativa con una herramienta profesional de referencia.

La principal brecha no es una fórmula aislada. Falta un modelo explícito de requisitos que permita decidir **qué superficie se evalúa, qué estadístico se compara, bajo qué escena, con qué fuente normativa y qué evidencia no fotométrica debe verificarse**. El comparador normal actual está rígidamente orientado a `avg_lux`, `Uo` y `UGR`; esto no representa correctamente requisitos como los 10 lx mínimos sobre el piso de una ruta de evacuación o los 50 lx sobre la cara de una señal.

Para cerrar la brecha se necesitan cuatro entregables, en este orden:

1. Contrato normativo y objetos de cálculo tipados.
2. Cálculos fotométricos y escenarios faltantes.
3. Evaluaciones no fotométricas de emergencia.
4. Validación independiente y paridad del informe.

Hasta completar y validar esos cuatro bloques, el producto debe describirse como motor propio con alcance documentado, no como equivalente a DIALux u otra herramienta de escritorio.

## 1. Alcance de la comparación

Este informe toma como objetivo reproducir de manera verificable las evaluaciones normalmente presentadas en una tabla profesional de resultados:

- iluminancia media mantenida `Em`;
- iluminancia mínima `Emin`;
- iluminancia máxima `Emax`;
- uniformidad general `Uo = Emin / Em`;
- uniformidad extrema `g2 = Emin / Emax`, cuando corresponda;
- potencia específica `W/m²`;
- potencia específica normalizada `W/m²/100 lx`;
- UGR máximo para observadores y direcciones definidos;
- cumplimiento normativo por métrica;
- resultados de alumbrado de emergencia;
- procedencia, configuración, advertencias y estado de vigencia del cálculo.

La comparación debe hacerse contra una referencia congelada: producto y versión, configuración completa, geometría, archivo fotométrico, malla, reflectancias, factor de mantenimiento, escena y tolerancias acordadas. Una captura visual no es una especificación suficiente.

## 2. Capacidades existentes que pueden reutilizarse

| Capacidad | Estado actual | Evidencia principal | Observación |
|---|---|---|---|
| Parser IES/LDT en Rust | Implementado | `dialux-photometry/src/main.rs` | Entrega ángulos C, gamma y matriz de candelas. |
| Fotometría normalizada en el dominio | Implementada | `buildCalculationSnapshot.ts` | Conserva matriz y flujo de referencia. |
| Malla punto a punto | Implementada | `lightingEngineCore.ts::buildGrid` | Trabaja sobre el polígono del ambiente y plano útil horizontal. |
| Luz directa | Implementada | `lightingEngineCore.ts::calculatePointByPoint` | Suma contribuciones de luminarias. |
| Oclusión | Implementada/configurable | `CalculationConfig.occlusion` | Requiere benchmarks más amplios. |
| Interreflexión | Implementada/configurable | `first-bounce` e `iterative` | Requiere materiales confiables y validación independiente. |
| Factor de mantenimiento | Implementado | `CalculationConfig.maintenanceFactor` | Se aplica a lux; la procedencia del valor debe quedar trazada. |
| `Eavg`, `Emin`, `Emax` | Implementados | `lightingEngineCore.ts` | Agregados de los puntos activos de la malla. |
| `Uo` | Implementado | `min_lux / avg_lux` | Coincide con la definición general de uniformidad. |
| `g2` | Implementado en exportación | `min_lux / max_lux` | Debe mostrarse solo cuando el criterio aplicable lo requiera. |
| UGR | Implementado con dos modelos | `legacy` y `guth-observers` | El modelo profesional requiere completar validación y alcance. |
| Potencia específica | Implementada en PDF | `formal-pdf.blade.php` | Falta vincular límites de eficiencia cuando sean aplicables. |
| Modo de emergencia | Implementado | `runDirectPreviewEngine.ts` | Filtra luminarias y usa `emergencyFlux`. |
| Evaluación `Emin` de ruta | Implementada parcialmente | `emergencyCompliance.ts` | Evalúa A.130 y EN 1838 por separado. |
| Punto crítico de emergencia | Implementado | `findResultExtremum` | Falta convertirlo en evidencia gráfica y auditable. |
| Informe de emergencia separado | Implementado | `buildDialuxEmergencyDocument.ts` | Todavía cubre solo parte de los requisitos. |
| Procedencia del cálculo | Implementada parcialmente | `CalculationRun` y snapshot de exportación | Debe hacerse obligatoria en todo resultado profesional. |

## 3. Brecha estructural: el requisito normativo no expresa qué calcular

El catálogo actual usa campos como `Em_lux`, `UGRL`, `Uo` y `Ra`. Esa forma es suficiente para muchas actividades interiores, pero no para requisitos heterogéneos.

Ejemplo crítico de A.130:

- El JSON almacena `Em_lux: 10`.
- El texto exige iluminancia **mínima** a nivel del suelo.
- El comparador del informe normal evalúa `result.avg_lux >= illuminanceLux`.
- Si se reutiliza ese comparador, una ruta puede aprobar por promedio aunque tenga puntos inferiores a 10 lx.

### Contrato mínimo requerido

Cada requisito automatizable debe declarar:

| Campo conceptual | Ejemplo A.130 ruta de evacuación |
|---|---|
| Identificador estable | `rne-a130-art40-evacuation-floor-min` |
| Jurisdicción | Perú |
| Norma y edición | RNE A.130, edición/adopción contractual verificada |
| Artículo/tabla | Art. 40 |
| Magnitud | Iluminancia |
| Estadístico | Mínimo, no promedio |
| Operador | `>=` |
| Umbral | `10` |
| Unidad | `lx` |
| Superficie | Piso de medio de evacuación |
| Altura | `z = 0 m` |
| Orientación | Horizontal, normal hacia arriba |
| Escena | Emergencia |
| Zona evaluada | Todo el medio de evacuación definido |
| Tratamiento de borde | Política declarada |
| Fuente de luz | Flujo de emergencia certificado |
| Factor de mantenimiento | Valor y procedencia explícitos |
| Datos obligatorios | Geometría, luminarias, flujo, fotometría, autonomía, etc. |
| Estado si falta un dato | `no-evaluado`, con causa |

El motor de evaluación debe soportar al menos los estadísticos `average`, `minimum`, `maximum`, `min_over_average`, `min_over_max`, `maximum_ugr`, `duration`, `transfer_time` y condiciones booleanas verificadas.

## 4. Objetos y superficies de cálculo faltantes

El plano útil horizontal del ambiente no basta para reproducir todas las evaluaciones.

### 4.1. Ruta de evacuación

Se necesita un objeto geométrico propio, no solo un `roomType`:

- polilínea o polígono de recorrido;
- ancho efectivo;
- inicio, fin, cambios de dirección e intersecciones;
- escaleras, rampas y desniveles;
- malla a nivel del piso;
- puntos críticos obligatorios;
- tratamiento de obstáculos y puertas.

El `Emin` debe calcularse únicamente sobre esa geometría y no sobre todo el ambiente por aproximación.

### 4.2. Señal de evacuación

Para comprobar 50 lx sobre el letrero se necesita:

- entidad `exit-sign` con ancho y alto;
- posición y cota;
- orientación y normal de la cara evaluada;
- tipo autoiluminado o externamente iluminado;
- una o dos caras activas;
- malla vertical sobre la señal;
- flujo interno o luminarias externas asociadas;
- criterio normativo exacto: mínimo, medio u otro, confirmado desde la fuente.

Hoy no existe una superficie vertical normativa conectada a esa fila de A.130.

### 4.3. Escaleras y superficies inclinadas

Se requieren superficies con normal arbitraria y muestreo 3D. Una malla horizontal proyectada no representa correctamente huellas, descansos, rampas o planos inclinados.

### 4.4. Áreas antipánico y puntos de alto riesgo

Son categorías distintas y deben tener objetos, zonas marginales, métricas y fuentes normativas separadas. No deben heredarse automáticamente desde A.130 si A.130 no define ese requisito.

## 5. Cálculos fotométricos que faltan o requieren cierre

### 5.1. Dirección fotométrica y simetría completa

Para cada punto debe resolverse correctamente el par `(C, gamma)` después de aplicar orientación, inclinación y rotación de la luminaria. Los LDT con simetría deben expandirse o interpretarse de forma inequívoca. Se necesitan tests para:

- simetría rotacional;
- simetría respecto de C0–C180;
- simetría respecto de C90–C270;
- cuadrantes;
- cierre 0°/360°;
- luminarias inclinadas y montadas en pared;
- interpolación bilineal entre planos C y ángulos gamma.

### 5.2. Superficies con normales arbitrarias

La fórmula general debe operar sobre cualquier superficie:

`E = I(C,gamma) × max(0, n · u) / d²`.

Esto es indispensable para señales, paredes, escaleras y cálculo vertical/cilíndrico.

### 5.3. Malla normativa

La separación fija de puntos no garantiza equivalencia. Se necesita una política de malla que defina:

- espaciamiento máximo por objeto y norma;
- distancia a bordes;
- puntos adicionales en cambios geométricos;
- convergencia de `Emin`, `Eavg` y `Uo` al refinar la malla;
- exclusión documentada de puntos fuera del polígono;
- reproducibilidad independiente de la resolución visual.

### 5.4. Factor de mantenimiento

El cálculo soporta un factor global, pero falta un modelo profesional trazable:

- depreciación del flujo de la lámpara/módulo;
- supervivencia;
- suciedad de luminaria;
- suciedad de superficies;
- intervalo de mantenimiento;
- ambiente y régimen de operación;
- factor normal y de emergencia, si difieren.

No se debe mantener `0.8` como default silencioso para todo proyecto.

### 5.5. Interreflexión y materiales

Para resultados comparables se necesitan reflectancias por superficie, no solo defaults generales. Debe validarse:

- conservación de energía;
- límites de reflectancia `[0,1]`;
- convergencia y residuo;
- sensibilidad al tamaño de parche;
- recintos no rectangulares;
- aberturas y superficies ausentes;
- comparación con casos analíticos y una referencia independiente.

### 5.6. UGR profesional

Aunque existe el camino `guth-observers`, para cerrar equivalencia faltan:

- reglas de aplicabilidad;
- área luminosa real y proyectada;
- luminancia por dirección de observación;
- observadores normativos y direcciones;
- índice de posición validado;
- luminancia de fondo sin fallback ambiguo;
- exclusión de luminarias fuera del campo visual;
- peor caso documentado;
- benchmark con tolerancia acordada;
- separación entre UGR del ambiente y tabla UGR del producto.

### 5.7. Iluminancia vertical, cilíndrica y semicilíndrica

Estas magnitudes no están cubiertas por el resumen horizontal actual y son necesarias para ciertas tareas, reconocimiento facial y recorridos. Requieren normales/direcciones múltiples por punto y agregación específica.

## 6. Evaluaciones de emergencia que faltan

El modo de emergencia calcula correctamente con `emergencyFlux` y ya compara `Emin` para rutas marcadas. No obstante, A.130 contiene condiciones adicionales que no se demuestran con una simulación estática.

| Requisito | Estado | Automatización necesaria |
|---|---|---|
| 10 lx mínimos a nivel del suelo | Parcial | Usar geometría real de ruta y malla a `z=0`, no todo el ambiente. |
| 50 lx sobre señal | Faltante | Entidad y malla vertical de señal, más fuente luminosa correspondiente. |
| Autonomía 1½ h | Faltante | Modelo/registro de batería, driver, curva de descarga y flujo durante 90 min. |
| Transferencia automática ≤10 s | Faltante | Dato certificado o ensayo con tiempo medido y evidencia. |
| Falla de una sola lámpara | Faltante | Simulación de contingencias N−1 y detección de zonas oscuras. |
| Alimentación antes del interruptor local | Faltante | Modelo de circuitos, fuente normal/emergencia y topología de control. |
| Conexión conforme al CNE | No evaluable hoy | Cita vigente confirmada y reglas eléctricas implementadas. |
| Señalización NTP 399.010-1 | Faltante | Catálogo de señales, ubicación, visibilidad y validaciones geométricas/documentales. |

### 6.1. Autonomía

No basta almacenar minutos declarados. Se debe distinguir:

- autonomía certificada del producto;
- autonomía calculada del conjunto batería/carga;
- autonomía verificada mediante ensayo;
- iluminancia mantenida durante la descarga.

La condición profesional es temporal: el sistema debe conservar el requisito luminotécnico durante el intervalo aplicable, no solo encender durante 90 minutos.

### 6.2. Transferencia

Debe modelarse como evidencia de sistema, no como lux. Entradas posibles:

- tiempo certificado del equipo;
- ensayo registrado con `t_falla` y `t_activación`;
- tipo de fuente y arquitectura de transferencia;
- fecha, responsable y resultado del ensayo.

### 6.3. Contingencia N−1

Por cada luminaria de emergencia se requiere:

1. retirarla del escenario;
2. recalcular la malla;
3. obtener `Emin` y componentes conexas con iluminación cero o insuficiente;
4. registrar el peor caso y la luminaria causante;
5. mostrar el mapa de la contingencia crítica.

## 7. Brechas del comparador normativo y del informe

### 7.1. Comparador rígido

`buildRequirementEvaluations()` compara actualmente:

- `avg_lux >= illuminanceLux`;
- `uniformity >= uniformityTarget`;
- `ugr <= ugrLimit`.

Faltan métricas dinámicas, valores `null` reales y criterios por objeto. Los defaults `Uo = 0.4` y `UGR = 22` no deben introducirse cuando una norma no los especifica.

### 7.2. Estado normativo insuficiente

Cada evaluación debe distinguir:

- `pass`;
- `fail`;
- `not-evaluated` por dato ausente;
- `not-applicable`;
- `stale`;
- `unsupported-method`;
- `source-unverified`.

Un `null` normativo debe producir `not-applicable` o `not-evaluated`, nunca transformarse en cero ni en un default genérico.

### 7.3. Procedencia

Cada fila del PDF debe poder responder:

- qué ejecución la produjo;
- versión del motor;
- hash de geometría y fotometría;
- configuración;
- fecha;
- norma, edición y cláusula;
- superficie y escena;
- warnings;
- si el resultado está vigente o desactualizado.

### 7.4. Evidencia gráfica

Para una evaluación profesional faltan, según métrica:

- mapa isolux asociado exactamente a la malla evaluada;
- marcador de `Emin` y `Emax`;
- geometría visible de la superficie;
- observador/dirección para UGR;
- mapa de la peor contingencia N−1;
- identificación de luminarias participantes;
- leyenda de escena normal/emergencia.

## 8. Datos mínimos necesarios antes de calcular

### Proyecto y geometría

- jurisdicción y edición normativa contractual;
- uso y actividad de cada espacio;
- niveles, cotas y unidades;
- polígonos cerrados y validados;
- altura de piso, techo y planos de trabajo;
- rutas, escaleras, rampas, salidas y señales;
- obstáculos y aberturas.

### Luminarias

- archivo IES/LDT original y checksum;
- fabricante y referencia;
- matriz fotométrica completa;
- flujo de referencia;
- potencia de entrada;
- dimensiones físicas y del área luminosa;
- orientación y posición;
- flujo de emergencia certificado;
- tipo permanente/no permanente;
- autonomía y tiempo de respuesta certificados;
- datos de batería/driver cuando se calcule autonomía.

### Materiales y mantenimiento

- reflectancia de techo, paredes y piso;
- transmisión cuando corresponda;
- política de mantenimiento;
- factores componentes y factor total;
- fecha/intervalo de mantenimiento.

### Configuración de cálculo

- escena;
- malla;
- zona marginal;
- oclusión;
- interreflexión y convergencia;
- modelo UGR;
- observadores;
- tolerancia numérica;
- modo normal o emergencia.

## 9. Plan previo a implementación

### P0 — Bloqueos normativos y semánticos

1. Verificar edición, vigencia y texto exacto de A.130, EM.010, CNE y NTP aplicables.
2. Corregir conceptualmente el catálogo para distinguir `Em` de `Emin`.
3. Diseñar el contrato genérico de requisitos y estados.
4. Eliminar defaults normativos silenciosos en evaluaciones profesionales.
5. Definir una matriz de aplicabilidad por jurisdicción sin fusionar normas.

### P1 — Objetos y solver necesarios para la tabla

1. Superficies arbitrarias horizontales, verticales e inclinadas.
2. Ruta de evacuación y señal como entidades de cálculo.
3. Malla normativa y prueba de convergencia.
4. Comparador dinámico por estadístico.
5. Evidencia de mínimo/máximo sobre el plano.

### P2 — Emergencia completa

1. Escena de emergencia reproducible en UI y exportación.
2. Evaluación de señal de salida.
3. Autonomía y degradación temporal.
4. Transferencia automática.
5. Contingencia N−1.
6. Topología de circuito/control.

### P3 — Equivalencia profesional

1. UGR validado en casos soportados.
2. Iluminancia vertical/cilíndrica cuando el alcance la requiera.
3. Potencia/energía con criterios normativos aplicables.
4. Informe con procedencia completa.
5. Suite de benchmarks contra referencia congelada.

## 10. Estrategia de validación

### Casos analíticos

- una luminaria puntual sobre un plano horizontal;
- varios puntos con solución manual;
- rotación e inclinación;
- superficie vertical;
- simetrías LDT;
- factor de mantenimiento;
- luminaria normal excluida de emergencia.

### Casos de integración

- importar LDT → colocar luminaria → calcular → guardar → recargar → exportar;
- ruta con puntos por encima y debajo de 10 lx;
- promedio aprobado pero `Emin` fallido, para impedir falso positivo;
- señal vertical con 50 lx;
- luminaria sin `emergencyFlux`, que debe quedar excluida y advertida;
- cálculo stale después de mover una luminaria;
- fallo N−1 de cada luminaria.

### Benchmarks externos

Cada benchmark debe registrar:

- software y versión;
- archivo de proyecto o configuración reproducible;
- fotometría exacta;
- geometría;
- reflectancias;
- factor de mantenimiento;
- malla y zonas marginales;
- resultados punto a punto y agregados;
- tolerancia definida antes de comparar.

Tolerancias iniciales propuestas para discusión, no aprobadas todavía:

- nodos analíticos directos: error relativo ≤1 % fuera de valores próximos a cero;
- `Eavg`, `Emin`, `Emax`: tolerancia por modo y malla, a acordar con benchmark;
- `Uo`: tolerancia absoluta, no solo relativa;
- UGR: diferencia ≤1 unidad únicamente en casos donde el método sea aplicable y equivalente.

## 11. Criterio de finalización

Se podrá afirmar que el sistema ofrece las mismas **evaluaciones soportadas** cuando:

1. cada fila de resultado tenga una definición inequívoca y una fuente normativa verificada;
2. el motor evalúe la superficie y el estadístico correctos;
3. resultados normales y de emergencia permanezcan separados;
4. no existan defaults ocultos que produzcan falsos `cumple`;
5. los requisitos temporales, eléctricos y de contingencia tengan evidencia propia;
6. los benchmarks cumplan tolerancias aprobadas;
7. UI, snapshot, PDF y exportaciones muestren los mismos valores y procedencia;
8. los casos no soportados se marquen `no evaluable`;
9. un ingeniero responsable confirme vigencia y aplicabilidad normativa para el proyecto real.

## 12. Decisión recomendada

No comenzar por copiar visualmente la tabla del software de referencia. La primera implementación debe ser el contrato de requisitos y superficies, porque determina qué significa cada resultado y evita que un check verde valide la métrica equivocada.

El orden recomendado es:

`requisito tipado → superficie correcta → cálculo reproducible → comparador → evidencia → PDF → benchmark`.

La prioridad inmediata es cerrar `Emin` de rutas y señales de salida con geometría propia, seguido de estados normativos sin defaults y pruebas contra falsos positivos. Autonomía, transferencia y N−1 deben tratarse como módulos separados, no como extensiones de la fórmula de lux.

## 13. Limitaciones y preguntas abiertas

- Falta definir el producto y versión exactos usados como referencia de equivalencia.
- No se dispone todavía de archivos de benchmark y configuraciones externas reproducibles.
- Debe confirmarse oficialmente la edición vigente/aplicable de cada norma y sus modificaciones.
- Debe decidirse si el alcance incluye solo Perú o también perfiles europeos, estadounidenses y brasileños.
- Debe definirse si la autonomía será solo dato certificado, cálculo de ingeniería, ensayo registrado o los tres.
- Debe establecerse qué clases de recintos y superficies soportará inicialmente el UGR profesional.
- Debe confirmarse el criterio exacto de los 50 lx sobre señales antes de elegir promedio o mínimo.

