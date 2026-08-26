# Plan de resolución del problema para DIALux con Claude Code y Codex

## 1. Objetivo general

Desarrollar una aplicación complementaria para proyectos eléctricos y de iluminación que permita:

- Calcular y modificar la cantidad de luminarias según el nivel mínimo de iluminación requerido.
- Registrar distintos tipos y potencias de luminarias.
- Calcular tomacorrientes según el tipo de ambiente, área, perímetro, ubicación y altura.
- Diferenciar los calibres de conductores de alumbrado, tomacorrientes, alimentadores y tableros.
- Gestionar tableros eléctricos por piso y sus alimentadores.
- Generar metrados eléctricos.
- Exportar los resultados a Excel.
- Preparar datos que puedan utilizarse como apoyo para el modelado y verificación en DIALux.

> Nota técnica: la integración directa con DIALux dependerá de las opciones de importación y exportación disponibles en la versión utilizada. Como primera etapa, la aplicación generará información estructurada en Excel o CSV para que pueda ser utilizada durante el modelado y la validación en DIALux.

---

## 2. Problema identificado

El sistema actual no permite modificar adecuadamente las cantidades y características de los elementos eléctricos. El cálculo debe considerar que una misma exigencia de iluminación puede cumplirse con diferentes combinaciones de luminarias.

Ejemplo:

- Cuatro luminarias de alta potencia.
- Ocho luminarias medianas.
- Diez o doce luminarias pequeñas.

La cantidad de luminarias no debe ser fija. Debe depender de:

- Área del ambiente.
- Iluminancia mínima requerida.
- Flujo luminoso de cada luminaria.
- Potencia.
- Factor de utilización.
- Factor de mantenimiento.
- Altura de instalación.
- Tipo de ambiente.
- Distribución seleccionada por el usuario.

También se requiere parametrizar los tomacorrientes y conductores, debido a que no todos los ambientes, alturas, usos o circuitos tienen las mismas condiciones.

---

# 3. Alcance funcional

## 3.1. Módulo de ambientes

Cada ambiente debe permitir registrar:

- Nombre del ambiente.
- Tipo de ambiente.
- Piso.
- Largo.
- Ancho.
- Altura.
- Área calculada.
- Perímetro calculado.
- Iluminancia mínima requerida.
- Tipo de ocupación.
- Cantidad de usuarios.
- Observaciones.

### Tipos iniciales de ambientes

- Aula.
- Comedor.
- Oficina.
- Pasadizo.
- Sala de reuniones.
- Laboratorio.
- Servicios higiénicos.
- Almacén.
- Exterior.
- Patio.
- Auditorio.
- Ambiente personalizado.

El usuario debe poder crear nuevos tipos de ambientes y modificar sus reglas.

---

## 3.2. Módulo de luminarias

El módulo debe permitir seleccionar o registrar diferentes tipos de luminarias.

### Datos de la luminaria

- Código.
- Marca.
- Modelo.
- Tipo.
- Potencia en W.
- Flujo luminoso en lúmenes.
- Temperatura de color.
- Índice de reproducción cromática.
- Tipo de montaje.
- Altura de montaje.
- Grado de protección IP.
- Factor de potencia.
- Vida útil.
- Precio unitario.
- Archivo fotométrico, cuando corresponda.
- Observaciones.

### Opciones obligatorias

- Cambiar la cantidad de luminarias manualmente.
- Calcular automáticamente la cantidad mínima.
- Mostrar si la cantidad ingresada cumple o no cumple.
- Comparar diferentes luminarias.
- Recalcular cuando cambia la potencia o el flujo luminoso.
- Permitir luminarias grandes, medianas o pequeñas.
- Permitir distribución por filas y columnas.
- Permitir redondear hacia arriba la cantidad calculada.
- Mostrar la iluminancia estimada resultante.
- Mostrar advertencias cuando no se cumpla el mínimo.

### Fórmula inicial de cálculo

La cantidad mínima estimada de luminarias puede calcularse con:

\[
N = \frac{E \times A}{F \times CU \times FM}
\]

Donde:

- \(N\): número de luminarias.
- \(E\): iluminancia requerida en lux.
- \(A\): área del ambiente en m².
- \(F\): flujo luminoso de una luminaria en lúmenes.
- \(CU\): coeficiente de utilización.
- \(FM\): factor de mantenimiento.

La aplicación debe redondear el resultado al entero superior.

### Validación de cantidad manual

Cuando el usuario modifique la cantidad:

\[
E_{estimada} = \frac{N \times F \times CU \times FM}{A}
\]

El sistema debe indicar:

- Cumple.
- No cumple.
- Exceso de iluminación.
- Diferencia en lux.
- Porcentaje de cumplimiento.

---

## 3.3. Módulo de circuitos de alumbrado

Cada circuito de alumbrado debe almacenar:

- Código del circuito.
- Tablero de origen.
- Piso.
- Ambientes asociados.
- Cantidad de luminarias.
- Potencia total.
- Tensión.
- Corriente calculada.
- Longitud del circuito.
- Tipo de instalación.
- Número de conductores.
- Conductor de fase.
- Conductor neutro.
- Conductor de protección.
- Interruptor termomagnético.
- Caída de tensión.
- Observaciones.

### Calibre inicial de alumbrado

- Conductor de cobre de 2.5 mm².
- Referencia aproximada: calibre N.° 14, según la equivalencia y norma adoptada en el proyecto.

> La aplicación no debe depender únicamente del número AWG. Debe guardar el área real del conductor en mm² y permitir equivalencias configurables.

---

## 3.4. Módulo de tomacorrientes

El sistema debe calcular tomacorrientes según el tipo de ambiente.

### Reglas iniciales configurables

#### Aulas

- Un tomacorriente por cada 10 m².

\[
N = \left\lceil \frac{A}{10} \right\rceil
\]

#### Comedores

- Un tomacorriente por cada 15 m².

\[
N = \left\lceil \frac{A}{15} \right\rceil
\]

#### Exteriores

- Separación máxima de 9 m entre tomacorrientes.
- Cálculo inicial basado en el perímetro útil.

\[
N = \left\lceil \frac{P}{9} \right\rceil
\]

Donde:

- \(P\): perímetro útil en metros.

### Modificación manual

El usuario debe poder:

- Aumentar o disminuir la cantidad.
- Cambiar la regla automática.
- Definir separación máxima.
- Definir tomacorrientes adicionales.
- Marcar tomacorrientes especiales.
- Distribuir tomacorrientes por muro.
- Registrar circuitos exclusivos.

---

## 3.5. Tipos de tomacorrientes por altura y uso

La aplicación debe registrar la altura de instalación y el uso previsto.

### Tipos iniciales

| Tipo | Altura referencial | Uso |
|---|---:|---|
| Tomacorriente bajo | 0.40 m | Uso general |
| Tomacorriente para nivel inicial | 1.50 m | Mayor seguridad y control |
| Tomacorriente de pared alto | 1.20 m a 1.80 m | Equipos y accesorios |
| Tomacorriente de comunicaciones | 2.00 m | Cajas o equipos de comunicaciones |
| Tomacorriente de techo | Según proyecto | Proyectores y equipos suspendidos |
| Tomacorriente de piso | Nivel de piso | Mesas, módulos o equipos centrales |
| Tomacorriente exterior | Según proyecto | Equipos exteriores |
| Tomacorriente especial | Configurable | Equipos específicos |

### Campos necesarios

- Tipo de tomacorriente.
- Altura.
- Cantidad.
- Ubicación.
- Muro o zona.
- Circuito.
- Potencia prevista.
- Uso.
- Grado de protección.
- Tipo de caja.
- Observaciones.

---

## 3.6. Módulo de circuitos de tomacorrientes

Cada circuito debe incluir:

- Código.
- Tablero de origen.
- Ambientes.
- Cantidad de puntos.
- Potencia estimada.
- Factor de demanda.
- Potencia demandada.
- Corriente.
- Longitud.
- Calibre.
- Protección.
- Caída de tensión.
- Conductor de protección.
- Tipo de canalización.

### Calibre inicial de tomacorrientes

- Conductor de cobre de 4 mm².
- Referencia aproximada: calibre N.° 12, según la equivalencia y norma adoptada.

La regla debe ser editable porque el calibre final también depende de:

- Corriente.
- Longitud.
- Método de instalación.
- Temperatura.
- Agrupamiento.
- Caída de tensión.
- Protección seleccionada.
- Normativa aplicable.

---

## 3.7. Módulo de tableros eléctricos

El sistema debe permitir crear tableros por piso.

### Ejemplo de estructura

- Tablero General del primer piso.
- Tablero del segundo piso.
- Tablero del tercer piso.

El tablero del primer piso puede alimentar:

- Circuitos del primer piso.
- Alimentador del tablero del segundo piso.
- Alimentador del tablero del tercer piso.

### Datos de cada tablero

- Código.
- Nombre.
- Piso.
- Tablero de origen.
- Tipo.
- Tensión.
- Número de fases.
- Potencia instalada.
- Potencia demandada.
- Corriente de diseño.
- Interruptor principal.
- Capacidad de barras.
- Reserva.
- Número de circuitos.
- Ubicación.
- Observaciones.

### Jerarquía de tableros

La aplicación debe mostrar una estructura tipo árbol:

```text
Tablero General TG-01
├── Tablero Piso 1 TP-01
├── Tablero Piso 2 TP-02
└── Tablero Piso 3 TP-03
```

Cada tablero secundario debe tener un alimentador relacionado con su tablero de origen.

---

## 3.8. Módulo de alimentadores

Los alimentadores deben permitir conductores de mayor sección.

### Secciones iniciales configurables

- 2.5 mm².
- 4 mm².
- 6 mm².
- 10 mm².
- 16 mm².
- 25 mm².
- 35 mm².
- 50 mm².
- 70 mm².
- 95 mm².
- Otras secciones personalizadas.

### Datos del alimentador

- Tablero de origen.
- Tablero de destino.
- Longitud.
- Potencia.
- Corriente de diseño.
- Número de fases.
- Número de conductores.
- Sección de fase.
- Sección de neutro.
- Sección de protección.
- Material.
- Aislamiento.
- Canalización.
- Capacidad de corriente.
- Caída de tensión.
- Protección.
- Reserva.
- Observaciones.

### Criterios de selección

La aplicación debe seleccionar o sugerir el conductor considerando:

1. Corriente de diseño.
2. Capacidad de conducción.
3. Caída de tensión.
4. Protección contra sobrecorriente.
5. Longitud.
6. Temperatura.
7. Agrupamiento.
8. Material.
9. Tipo de instalación.
10. Reserva de crecimiento.

---

# 4. Reglas de negocio

## RN-01. Cantidad editable de luminarias

La cantidad calculada automáticamente debe poder modificarse.

El sistema debe recalcular:

- Iluminancia estimada.
- Potencia instalada.
- Corriente.
- Número de circuitos.
- Metrado de cables.
- Costos.

---

## RN-02. Cumplimiento de iluminación

El sistema debe marcar visualmente:

- Verde: cumple.
- Amarillo: se encuentra cerca del mínimo.
- Rojo: no cumple.

No se debe impedir el registro, pero se debe mostrar la advertencia.

---

## RN-03. Reglas configurables de tomacorrientes

Las reglas por área o perímetro no deben estar escritas directamente en el código. Deben almacenarse en una tabla de configuración.

Ejemplo:

| Ambiente | Método | Valor |
|---|---|---:|
| Aula | área | 10 m²/punto |
| Comedor | área | 15 m²/punto |
| Exterior | perímetro | 9 m/punto |

---

## RN-04. Alturas configurables

Las alturas deben almacenarse como datos y no como textos fijos.

Debe ser posible crear:

- 0.40 m.
- 1.20 m.
- 1.50 m.
- 1.80 m.
- 2.00 m.
- Techo.
- Piso.
- Personalizada.

---

## RN-05. Conductores por tipo de circuito

Reglas iniciales:

- Alumbrado: 2.5 mm².
- Tomacorrientes: 4 mm².
- Alimentadores: cálculo desde 6 mm² en adelante, según la carga.

Estas reglas deben ser editables.

---

## RN-06. Tableros jerárquicos

Un tablero puede:

- Recibir energía de otro tablero.
- Alimentar varios circuitos.
- Alimentar otros tableros.
- Tener reserva de circuitos.
- Tener alimentadores independientes.

---

## RN-07. Metrado automático

El metrado debe actualizarse cuando cambie:

- Cantidad de luminarias.
- Cantidad de tomacorrientes.
- Longitud del recorrido.
- Número de conductores.
- Tipo de conductor.
- Tablero.
- Alimentador.
- Canalización.
- Accesorios.

---

# 5. Modelo de datos propuesto

## 5.1. Entidades principales

### Proyecto

- id
- nombre
- cliente
- ubicación
- fecha
- norma_referencia
- tensión
- número_fases
- frecuencia
- observaciones

### Piso

- id
- proyecto_id
- nombre
- nivel
- altura

### Ambiente

- id
- piso_id
- tipo_ambiente_id
- nombre
- largo
- ancho
- altura
- area
- perimetro
- lux_requerido
- factor_mantenimiento
- coeficiente_utilizacion

### TipoAmbiente

- id
- nombre
- lux_minimo
- regla_tomacorriente
- valor_regla
- unidad_regla

### Luminaria

- id
- código
- marca
- modelo
- potencia
- flujo_luminoso
- temperatura_color
- ip
- tipo_montaje
- precio

### AmbienteLuminaria

- id
- ambiente_id
- luminaria_id
- cantidad_calculada
- cantidad_seleccionada
- filas
- columnas
- lux_estimado
- cumple

### TipoTomacorriente

- id
- nombre
- altura
- uso
- grado_ip
- descripción

### Tomacorriente

- id
- ambiente_id
- tipo_tomacorriente_id
- cantidad
- muro
- ubicación
- circuito_id

### Tablero

- id
- proyecto_id
- piso_id
- tablero_origen_id
- código
- nombre
- tensión
- fases
- potencia_instalada
- demanda
- corriente
- protección_principal

### Circuito

- id
- tablero_id
- código
- tipo
- potencia
- corriente
- longitud
- protección
- caída_tensión

### Conductor

- id
- material
- sección_mm2
- awg_referencial
- aislamiento
- ampacidad
- precio_metro

### CircuitoConductor

- id
- circuito_id
- conductor_id
- función
- cantidad_conductores
- longitud_total

### Alimentador

- id
- tablero_origen_id
- tablero_destino_id
- conductor_fase_id
- conductor_neutro_id
- conductor_tierra_id
- longitud
- corriente
- caída_tensión
- protección

### Metrado

- id
- proyecto_id
- categoría
- descripción
- unidad
- cantidad
- precio_unitario
- subtotal

---

# 6. Arquitectura propuesta

## 6.1. Frontend

Opciones:

- React.
- Next.js.
- Vue.

Funciones principales:

- Formularios de proyecto.
- Gestión de pisos.
- Plano lógico de ambientes.
- Selección de luminarias.
- Configuración de tomacorrientes.
- Árbol de tableros.
- Cuadro de cargas.
- Metrados.
- Exportación a Excel.

---

## 6.2. Backend

Opciones:

- Laravel.
- Node.js con NestJS.
- Python con FastAPI.

Responsabilidades:

- Cálculos eléctricos.
- Reglas de negocio.
- Validaciones.
- Persistencia.
- Exportación.
- Control de versiones de proyectos.
- Historial de cambios.

---

## 6.3. Base de datos

Opciones recomendadas:

- PostgreSQL.
- MySQL.

No se recomienda guardar los cálculos únicamente en archivos Excel. Excel debe ser un resultado exportable, no la fuente principal de datos.

---

## 6.4. Motor de cálculo

Crear un servicio independiente:

```text
CalculationEngine
├── LightingCalculator
├── OutletCalculator
├── CircuitCalculator
├── FeederCalculator
├── VoltageDropCalculator
├── PanelCalculator
└── QuantityTakeoffCalculator
```

Esto facilitará las pruebas y evitará mezclar los cálculos con la interfaz.

---

# 7. Plan de desarrollo por fases

## Fase 0. Levantamiento y normalización de requisitos

### Objetivo

Convertir los requerimientos verbales en reglas técnicas verificables.

### Actividades

1. Crear catálogo de ambientes.
2. Definir iluminancia mínima por ambiente.
3. Definir reglas de tomacorrientes.
4. Definir alturas.
5. Definir secciones de conductores.
6. Definir tipos de tableros.
7. Definir estructura del Excel.
8. Definir qué información se transferirá a DIALux.
9. Identificar la norma eléctrica aplicable.
10. Registrar supuestos pendientes de validación.

### Responsable principal

- Claude Code: análisis del repositorio y documentación.
- Codex: propuesta del modelo lógico, reglas y pruebas.

### Entregables

- `requirements.md`
- `business-rules.md`
- `assumptions.md`
- `data-dictionary.md`

### Criterio de cierre

Todos los cálculos deben tener:

- Entrada.
- Fórmula.
- Unidad.
- Redondeo.
- Resultado.
- Validación.
- Mensaje de error.

---

## Fase 1. Diseño de arquitectura y base de datos

### Objetivo

Construir la estructura técnica del sistema.

### Actividades

1. Crear modelo entidad-relación.
2. Crear migraciones.
3. Crear catálogos.
4. Crear estructura de proyectos, pisos y ambientes.
5. Crear catálogo de luminarias.
6. Crear catálogo de tomacorrientes.
7. Crear catálogo de conductores.
8. Crear tableros y circuitos.
9. Crear alimentadores.
10. Crear registros de metrados.

### Claude Code

- Inspeccionar la estructura del proyecto.
- Identificar convenciones del framework.
- Crear migraciones y modelos.
- Mantener consistencia con el código existente.
- Documentar los cambios.

### Codex

- Generar esquemas SQL.
- Proponer índices.
- Crear validaciones.
- Crear datos semilla.
- Revisar integridad referencial.
- Generar pruebas del modelo.

### Entregables

- Migraciones.
- Modelos.
- Seeders.
- Diagrama ER.
- Catálogos iniciales.

### Criterio de cierre

Debe ser posible registrar:

- Un proyecto.
- Tres pisos.
- Varios ambientes.
- Varias luminarias.
- Varios tomacorrientes.
- Tres tableros relacionados.

---

## Fase 2. Cálculo de luminarias

### Objetivo

Implementar el cálculo automático y la modificación manual de luminarias.

### Actividades

1. Implementar fórmula de cantidad mínima.
2. Implementar cálculo de lux estimado.
3. Permitir cambiar la luminaria.
4. Permitir cambiar la cantidad.
5. Permitir filas y columnas.
6. Validar cumplimiento.
7. Recalcular potencia.
8. Recalcular corriente.
9. Guardar las alternativas comparadas.
10. Mostrar advertencias.

### Claude Code

- Implementar el flujo completo en el proyecto.
- Conectar frontend, backend y base de datos.
- Revisar errores del entorno.
- Ejecutar pruebas.
- Corregir integraciones.

### Codex

- Crear funciones puras de cálculo.
- Crear casos de prueba.
- Revisar unidades.
- Revisar redondeos.
- Proponer mensajes de validación.
- Refactorizar el motor de cálculo.

### Casos de prueba mínimos

#### Caso A

- Área: 40 m².
- Iluminancia: 300 lux.
- Luminaria: 3,600 lm.
- CU: 0.60.
- FM: 0.80.

Validar la cantidad mínima y el lux resultante.

#### Caso B

Comparar:

- 4 luminarias grandes.
- 8 luminarias medianas.
- 12 luminarias pequeñas.

El sistema debe mostrar cuál cumple.

### Criterio de cierre

El usuario puede modificar la cantidad y observar el resultado recalculado en tiempo real.

---

## Fase 3. Cálculo de tomacorrientes

### Objetivo

Calcular y clasificar tomacorrientes según área, perímetro, altura y uso.

### Actividades

1. Implementar regla de aulas.
2. Implementar regla de comedores.
3. Implementar regla de exteriores.
4. Permitir reglas personalizadas.
5. Crear tipos por altura.
6. Permitir tomacorrientes de techo.
7. Permitir tomacorrientes de piso.
8. Permitir tomacorrientes para proyectores.
9. Permitir tomacorrientes para comunicaciones.
10. Permitir cantidades adicionales manuales.

### Casos de prueba

#### Aula de 48 m²

\[
N = \lceil 48/10 \rceil = 5
\]

#### Comedor de 72 m²

\[
N = \lceil 72/15 \rceil = 5
\]

#### Exterior con perímetro útil de 50 m

\[
N = \lceil 50/9 \rceil = 6
\]

### Criterio de cierre

El usuario puede ver la cantidad automática, cambiarla y distribuirla por tipo y altura.

---

## Fase 4. Circuitos y conductores

### Objetivo

Asignar los puntos eléctricos a circuitos y seleccionar conductores.

### Actividades

1. Crear circuitos de alumbrado.
2. Crear circuitos de tomacorrientes.
3. Crear circuitos especiales.
4. Calcular potencia.
5. Calcular corriente.
6. Seleccionar conductor.
7. Seleccionar protección.
8. Calcular caída de tensión.
9. Validar capacidad.
10. Generar advertencias.

### Reglas iniciales

- Alumbrado: 2.5 mm².
- Tomacorrientes: 4 mm².
- Alimentadores: 6 mm² o superior, según cálculo.

### Criterio de cierre

Cada circuito debe indicar:

- Carga.
- Corriente.
- Conductor.
- Protección.
- Longitud.
- Caída de tensión.
- Estado de cumplimiento.

---

## Fase 5. Tableros por piso y alimentadores

### Objetivo

Modelar tableros jerárquicos y alimentadores entre pisos.

### Actividades

1. Crear tablero general.
2. Crear tableros por piso.
3. Relacionar tablero de origen y destino.
4. Calcular cargas por tablero.
5. Calcular demanda.
6. Calcular corriente del alimentador.
7. Seleccionar sección.
8. Calcular protección principal.
9. Mostrar reserva.
10. Crear diagrama lógico.

### Escenario de prueba

```text
TG-01, primer piso
├── Circuitos del primer piso
├── Alimentador TP-02
└── Alimentador TP-03
```

### Criterio de cierre

El sistema debe recalcular el alimentador cuando se agregue o elimine carga en un piso.

---

## Fase 6. Metrados

### Objetivo

Calcular cantidades de materiales.

### Materiales iniciales

- Luminarias.
- Interruptores.
- Tomacorrientes.
- Cajas.
- Conductores.
- Tuberías.
- Canaletas.
- Tableros.
- Interruptores termomagnéticos.
- Diferenciales.
- Accesorios.
- Alimentadores.
- Puesta a tierra.
- Etiquetas.
- Elementos de fijación.

### Fórmula general de cable

\[
L_{cable} = L_{recorrido} \times N_{conductores} \times F_{reserva}
\]

Ejemplo:

- Recorrido: 25 m.
- Conductores: 3.
- Reserva: 1.10.

\[
L_{cable} = 25 \times 3 \times 1.10 = 82.5 \text{ m}
\]

### Criterio de cierre

El metrado se actualiza automáticamente después de cualquier cambio.

---

## Fase 7. Exportación a Excel

### Objetivo

Generar un archivo Excel con todos los resultados.

### Hojas propuestas

1. Datos del proyecto.
2. Pisos.
3. Ambientes.
4. Cálculo de luminarias.
5. Tomacorrientes.
6. Circuitos de alumbrado.
7. Circuitos de tomacorrientes.
8. Tableros.
9. Alimentadores.
10. Cuadro de cargas.
11. Metrado de cables.
12. Metrado general.
13. Presupuesto.
14. Observaciones.
15. Datos para DIALux.

### Requisitos del Excel

- Unidades visibles.
- Fórmulas verificables.
- Filtros.
- Encabezados congelados.
- Formato numérico.
- Totales.
- Subtotales.
- Alertas de incumplimiento.
- Fecha de generación.
- Versión del proyecto.

### Criterio de cierre

El Excel debe abrir sin errores y coincidir con los resultados de la aplicación.

---

## Fase 8. Preparación de información para DIALux

### Objetivo

Generar información ordenada para facilitar el modelado y la validación.

### Datos a exportar

- Nombre del ambiente.
- Largo.
- Ancho.
- Altura.
- Área.
- Iluminancia requerida.
- Tipo de luminaria.
- Flujo luminoso.
- Potencia.
- Cantidad.
- Filas.
- Columnas.
- Altura de montaje.
- Factor de mantenimiento.
- Resultado estimado.
- Resultado validado en DIALux.
- Diferencia porcentual.

### Flujo propuesto

1. La aplicación realiza el cálculo preliminar.
2. El usuario selecciona la luminaria.
3. Se exporta una hoja para DIALux.
4. El diseñador modela el ambiente en DIALux.
5. Se ingresa el resultado real obtenido en DIALux.
6. La aplicación compara ambos resultados.
7. Se registra la versión final aprobada.

### Criterio de cierre

Cada ambiente debe tener trazabilidad entre:

- Cálculo preliminar.
- Selección de luminarias.
- Verificación en DIALux.
- Resultado final.

---

## Fase 9. Pruebas y control de calidad

### Tipos de pruebas

- Unitarias.
- Integración.
- Interfaz.
- Exportación.
- Regresión.
- Rendimiento.
- Seguridad.
- Aceptación del usuario.

### Matriz mínima de pruebas

| Código | Módulo | Escenario | Resultado esperado |
|---|---|---|---|
| T-001 | Luminarias | Cambiar cantidad | Recalcula lux |
| T-002 | Luminarias | Cantidad insuficiente | Muestra alerta |
| T-003 | Tomacorrientes | Aula 48 m² | Calcula 5 |
| T-004 | Tomacorrientes | Comedor 72 m² | Calcula 5 |
| T-005 | Exterior | Perímetro 50 m | Calcula 6 |
| T-006 | Conductores | Alumbrado | Sugiere 2.5 mm² |
| T-007 | Conductores | Tomacorrientes | Sugiere 4 mm² |
| T-008 | Alimentador | Carga elevada | Sugiere sección superior |
| T-009 | Tableros | Agregar carga | Recalcula alimentador |
| T-010 | Excel | Exportar | Archivo válido |

---

## Fase 10. Implementación progresiva

### Versión 1

- Proyectos.
- Pisos.
- Ambientes.
- Luminarias.
- Cantidad editable.
- Cálculo de lux.
- Tomacorrientes.
- Exportación básica.

### Versión 2

- Circuitos.
- Conductores.
- Tableros.
- Alimentadores.
- Caída de tensión.
- Metrados.

### Versión 3

- Presupuesto.
- Comparación de alternativas.
- Integración mejorada con DIALux.
- Historial.
- Informes.
- Diagramas.

---

# 8. Distribución de trabajo entre Claude Code y Codex

## Claude Code

Usarlo principalmente para:

- Analizar el repositorio completo.
- Identificar archivos relacionados.
- Implementar cambios que afecten varios módulos.
- Realizar migraciones.
- Conectar frontend y backend.
- Ejecutar comandos del proyecto.
- Corregir errores de compilación.
- Revisar dependencias.
- Mantener consistencia arquitectónica.
- Documentar cambios.

### Instrucción general para Claude Code

```text
Analiza primero todo el repositorio. No modifiques archivos hasta identificar la arquitectura, el flujo de datos y los módulos existentes. Implementa el sistema eléctrico por fases. Mantén los cálculos separados de la interfaz. Agrega pruebas automatizadas. No codifiques valores técnicos directamente si pueden almacenarse en tablas configurables.
```

---

## Codex

Usarlo principalmente para:

- Crear algoritmos de cálculo.
- Generar funciones puras.
- Proponer modelos de datos.
- Escribir pruebas unitarias.
- Revisar fórmulas.
- Refactorizar módulos.
- Crear exportadores de Excel.
- Revisar errores lógicos.
- Generar casos de prueba.
- Proponer validaciones.

### Instrucción general para Codex

```text
Implementa los cálculos eléctricos como funciones independientes, tipadas y probadas. Cada función debe declarar unidades de entrada y salida. Incluye validación de valores negativos, cero, datos faltantes y divisiones entre cero. Usa redondeo superior cuando se calcule el número mínimo de luminarias o tomacorrientes. No asumas calibres fijos cuando el cálculo de corriente o caída de tensión exija una sección mayor.
```

---

# 9. Prompts por fase

## Prompt para análisis inicial

```text
Revisa el repositorio y genera un diagnóstico técnico. Identifica framework, lenguaje, base de datos, módulos, rutas, servicios, componentes, pruebas y sistema de exportación. Propón dónde implementar los módulos de ambientes, luminarias, tomacorrientes, circuitos, tableros, alimentadores y metrados. No realices cambios todavía.
```

## Prompt para luminarias

```text
Implementa un módulo de cálculo de luminarias. La cantidad mínima debe calcularse con N = (E × A) / (F × CU × FM), redondeada hacia arriba. El usuario debe poder modificar manualmente la cantidad y el sistema debe recalcular el lux estimado con E = (N × F × CU × FM) / A. Agrega pruebas, validaciones, mensajes de cumplimiento y comparación de alternativas.
```

## Prompt para tomacorrientes

```text
Implementa reglas configurables de tomacorrientes. Para aulas usar inicialmente un punto por cada 10 m²; para comedores, un punto por cada 15 m²; para exteriores, separación máxima de 9 m usando el perímetro útil. Permite modificación manual, alturas configurables, tomacorrientes de techo, piso, comunicaciones, proyectores y usos especiales.
```

## Prompt para conductores

```text
Implementa el catálogo y selección de conductores. Usa como valores iniciales 2.5 mm² para alumbrado y 4 mm² para tomacorrientes. Para alimentadores permite 6, 10, 16, 25, 35 mm² y secciones superiores. La selección final debe validar corriente, longitud, caída de tensión, protección y método de instalación.
```

## Prompt para tableros

```text
Implementa tableros jerárquicos por piso. Un tablero del primer piso puede alimentar los tableros del segundo y tercer piso. Cada tablero debe consolidar la potencia instalada, demanda, corriente, protección principal, alimentadores y reserva. Agrega una visualización tipo árbol.
```

## Prompt para Excel

```text
Genera un archivo Excel con hojas para proyecto, ambientes, luminarias, tomacorrientes, circuitos, tableros, alimentadores, cuadro de cargas, metrados y datos para DIALux. Incluye unidades, filtros, fórmulas verificables, totales, alertas de incumplimiento, fecha y versión.
```

---

# 10. Criterios de aceptación generales

El sistema será aceptado cuando:

1. La cantidad de luminarias pueda cambiarse.
2. El sistema recalcule los lux automáticamente.
3. El sistema indique si cumple el mínimo.
4. Las reglas de tomacorrientes sean configurables.
5. Se puedan registrar tomacorrientes a diferentes alturas.
6. Se puedan registrar tomacorrientes de techo y piso.
7. Alumbrado y tomacorrientes utilicen circuitos independientes.
8. Se puedan seleccionar conductores de 2.5, 4, 6, 10, 16, 25 y 35 mm².
9. Los tableros puedan alimentar otros tableros.
10. Los alimentadores se recalculen según la carga.
11. El metrado se actualice automáticamente.
12. El Excel coincida con la base de datos.
13. Se pueda comparar el cálculo preliminar con DIALux.
14. Todos los cálculos tengan pruebas automatizadas.
15. Los parámetros técnicos puedan modificarse sin cambiar el código.

---

# 11. Riesgos técnicos

## Riesgo 1. Confundir AWG con mm²

Mitigación:

- Guardar siempre la sección en mm².
- Mantener AWG solo como referencia.
- Crear tabla de equivalencias.

## Riesgo 2. Usar calibres fijos

Mitigación:

- Usar los calibres iniciales como valores por defecto.
- Validar siempre corriente y caída de tensión.

## Riesgo 3. Resultados diferentes a DIALux

Mitigación:

- Identificar que el cálculo inicial es una aproximación.
- Validar con archivos fotométricos y geometría real.
- Registrar el resultado definitivo de DIALux.

## Riesgo 4. Reglas no validadas

Mitigación:

- Mantener las reglas configurables.
- Registrar la norma y versión utilizadas.
- Solicitar revisión de un especialista eléctrico.

## Riesgo 5. Metrados incorrectos

Mitigación:

- Separar recorrido físico y cantidad de conductores.
- Incluir factor de reserva.
- Mostrar el detalle de la fórmula.

---

# 12. Información pendiente de validación técnica

Antes de considerar el sistema como definitivo, se debe confirmar:

- Norma eléctrica utilizada.
- Niveles de iluminación por ambiente.
- Factores de utilización.
- Factores de mantenimiento.
- Equivalencia exacta entre AWG y mm².
- Alturas obligatorias por tipo de edificación.
- Cantidad máxima de puntos por circuito.
- Potencia asignada por tomacorriente.
- Factores de demanda.
- Límites de caída de tensión.
- Tipos de protección.
- Sección mínima del conductor de protección.
- Reglas de neutral.
- Reglas para equipos especiales.
- Requisitos de accesibilidad y seguridad infantil.
- Formato requerido para la entrega a DIALux.

---

# 13. Resultado esperado

Al finalizar las fases, la aplicación deberá permitir que el proyectista:

1. Cree el edificio y sus pisos.
2. Registre los ambientes.
3. Calcule luminarias.
4. Cambie la cantidad de luminarias.
5. Verifique el nivel de iluminación.
6. Calcule tomacorrientes.
7. Defina alturas y usos.
8. Organice circuitos.
9. Cree tableros por piso.
10. Calcule alimentadores.
11. Seleccione conductores.
12. Genere cuadros de carga.
13. Obtenga metrados.
14. Exporte a Excel.
15. Compare los resultados con DIALux.
