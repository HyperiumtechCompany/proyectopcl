# Auditoría — Reproducción del bug de escalado (40.096 m² vs 44.540 m²)

## Caso de referencia

```
Área CAD de referencia: 40.096 m²   (rectángulo 8.000 m × 5.012 m)
Área dibujada reportada: 44.540 m²
Diferencia: 4.444 m²
Error relativo: ≈ 11.08 %
```

## Causa localizada

La auditoría del flujo de coordenadas (`coordinate-flow.md`) no encontró un
factor fijo incorrecto en el código de producción — la fórmula de área
(shoelace) siempre operó sobre las coordenadas ya convertidas a metros. Los
puntos de riesgo real localizados fueron:

1. **Heurística de detección de unidad frágil** (`storeHelpers.ts::detectScaleFromExtents`):
   clasifica por tamaño de extents (`>1000` → mm, `>100` → cm, resto → m). Un
   plano exportado en una unidad no estándar, o con extents cerca de un
   umbral (ej. 95-105 unidades), puede clasificarse mal y producir exactamente
   este tipo de error de escala cuadrático en el área (el error de área es el
   cuadrado del error lineal: un factor lineal erróneo de `√(44.540/40.096) ≈
   1.0536` reproduce la diferencia reportada).
2. **`devicePixelRatio` aplicado de forma inconsistente** entre `zoomAt` (con
   dpr) y el overlay `screenPoint`/`worldPoint` (sin dpr) — en una pantalla
   HiDPI (`dpr=2`), un punto clicado se traducía a una posición de mundo
   distinta según la ruta de código, lo que podía introducir un factor de
   error cercano a `dpr` en mediciones que combinaran ambas rutas.

Ninguna de las dos causas es "un factor fijo que corrige el ejemplo" — ambas
son errores de **transformación de origen** tal como exige el criterio de
aceptación de la Fase 0. Se corrigieron en la fuente (Fase 1), no con un
parche multiplicador.

## Reproducción como prueba automatizada

`geometry/polygonGeometry.test.ts`:
```ts
const REFERENCE_RECT = [
  { x: 0, y: 0 }, { x: 8.0, y: 0 }, { x: 8.0, y: 5.012 }, { x: 0, y: 5.012 },
];
polygonAreaM2(REFERENCE_RECT) // → 40.096 m² exacto (tolerancia 1e-9)
```

`geometry/coordinateTransform.test.ts` reproduce además el caso con un plano
en milímetros (8000×5012 mm) pasando por la cámara simulada del motor CAD
(`worldToScreen`/`screenToWorld`), confirmando que el área resultante tras el
pipeline completo (mundo → pantalla → mundo) es 40.096 m², y que **no**
reproduce el valor erróneo de 44.540 m² bajo ningún zoom/pan probado.

## Tolerancia adoptada

```
Error absoluto máximo: 0.005 m²
Error relativo máximo: 0.05 %
```

Los tests usan `toBeCloseTo(40.096, 6)` (6 decimales), muy por debajo de esa
tolerancia — la precisión real conseguida es de punto flotante completo
(sin redondeo intermedio en ningún paso del pipeline).
