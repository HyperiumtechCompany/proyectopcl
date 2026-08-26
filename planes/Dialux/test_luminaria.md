# Caso de Prueba: Validación de Importación LDT y Cálculo

## 1. Datos del Archivo LDT (Entrada)
Estos son los valores que tu struct en Rust debe extraer exactamente:

- **Formato**: EULUMDAT (LDT)
- **Simetría**: 1 (Simetría rotacional alrededor del eje vertical)
- **Dimensiones Luminaria**: 0.60 m (Largo) x 0.60 m (Ancho) x 0.10 m (Alto)
- **Flujo Luminoso de Lámpara**: 1000 lm
- **Potencia**: 10.0 W
- **Número de Planos C**: 4 (0, 90, 180, 270 grados)
- **Número de Ángulos Gamma**: 5 (0, 22.5, 45, 67.5, 90 grados)
- **Factor de Mantenimiento (Proyecto)**: 0.80

### Matriz de Intensidades (cd/klm)
*Nota: Al ser 1000 lm, 1 cd/klm = 1 cd real.*

| Gamma \ C | 0°   | 90°  | 180° | 270° |
|-----------|------|------|------|------|
| **0°**    | 100  | 100  | 100  | 100  |
| **22.5°** | 250  | 250  | 250  | 250  |
| **45°**   | 300  | 300  | 300  | 300  |
| **67.5°** | 150  | 150  | 150  | 150  |
| **90°**   | 50   | 50   | 50   | 50   |

## 2. Configuración del Escenario de Prueba
Para validar tu motor, configura este escenario simple en tu código:

- **Habitación**: 4.0 m x 4.0 m x 3.0 m (Alto)
- **Posición Luminaria**: Centro (2.0, 2.0), altura de techo (3.0 m).
- **Plano de Cálculo**: Altura 0.80 m (Z = 0.80).
- **Punto de Prueba A**: Justo debajo de la luminaria (2.0, 2.0, 0.80).
- **Punto de Prueba B**: En una esquina (0.5, 0.5, 0.80).
- **Reflexiones**: 0% (Negro total) para aislar el cálculo directo y evitar errores en el motor de radiosidad.

## 3. Resultados Esperados (Target)
Si tu código es correcto, deberías obtener estos valores (con tolerancia < 1%):

### Cálculo Manual para Punto A (Debajo de la luz)
- **Distancia ($d$)**: $3.0 - 0.80 = 2.20$ m
- **Ángulo ($\gamma$)**: 0° (Vertical)
- **Intensidad ($I$)**: 100 cd (de la tabla)
- **Ángulo incidencia ($\theta$)**: 0° ($\cos(0) = 1$)
- **Fórmula punto a punto**: $E = (I \cdot \cos\theta) / d^2 \cdot FM$
- **Sustitución**: $E = (100 \cdot 1) / 2.20^2 \cdot 0.80$
- **Resultado Esperado**: **16.53 lux**

### Cálculo Manual para Punto B (Esquina)
- **Delta X/Y**: 1.5 m
- **Distancia Horizontal**: $r = \sqrt{1.5^2 + 1.5^2} = 2.1213$ m
- **Distancia Total ($d$)**: $\sqrt{r^2 + 2.20^2} = \sqrt{9.34} \approx 3.0561$ m
- **Ángulo ($\gamma$)**: $\arctan(r / 2.20) \approx 43.94°$
- **Interpolación lineal de I**: Entre 22.5° (250 cd) y 45° (300 cd): **297.65 cd**.
- **Ángulo de incidencia ($\theta$)**: Igual a $\gamma$. $\cos(\theta) = 2.20 / 3.0561 \approx 0.7199$.
- **Fórmula punto a punto**: $E = (I \cdot \cos\theta) / d^2 \cdot FM$
- **Sustitución**: $E = (297.65 \cdot 0.7199) / 9.34 \cdot 0.80$
- **Resultado Esperado**: **~18.36 lux**

> Forma equivalente usando la altura vertical $h$: $E = I \cdot \cos^3(\gamma) / h^2 \cdot FM$. No se debe usar $\cos^3$ junto con la distancia inclinada $d$, porque eso aplicaría dos veces la corrección angular.

## 4. Checklist de Validación para tu Código Rust
- [ ] ¿El parser lee correctamente los decimales (coma vs punto)?
- [ ] ¿La interpolación angular funciona para ángulos no tabulados (ej. 44°)?
- [ ] ¿Se aplica el Factor de Mantenimiento al final?
- [ ] ¿Las dimensiones de la luminaria se usan para calcular el ángulo sólido (si haces UGR)?
- [ ] ¿El flujo luminoso escala correctamente los cd/klm a cd reales?   
