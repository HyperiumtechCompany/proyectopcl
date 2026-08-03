# Auditoría — Flujo de coordenadas

## Recorrido completo (antes de la Fase 1)

```
Punto del archivo CAD (unidad nativa: mm/cm/m, según $INSUNITS o heurística de extents)
  ↓ cadView.worldToScreen (motor mlightcad, opera en píxeles CSS del canvas)
Punto de pantalla (px CSS)
  ↓ clic del usuario → rawX/rawY = clientX/clientY - rect.left/top
  ↓ cadView.screenToWorld
Punto del modelo en unidades CAD nativas
  ↓ cadToMeters(valor, scaleConfig)  →  effectiveScale = factor × calibrationFactor
Punto guardado en el recinto dibujado (METROS — coordenadas del mundo)
```

## Hallazgos de la Fase 0 y su corrección

| # | Hallazgo | Archivo:línea (antes) | Corrección (Fase 1) |
|---|---|---|---|
| 1 | `devicePixelRatio` se aplicaba en `zoomAt` pero NO en `screenPoint`/`worldPoint` del overlay → posible desalineación en pantallas HiDPI | `useMlightcadEngine.ts:605-606` | Se retiró la multiplicación por `dpr`: la vista de mlightcad opera en píxeles CSS locales (confirmado leyendo `AcGiCamera.screenToWorld` en `node_modules/@mlightcad/cad-simple-viewer/dist/cad-simple-viewer.js:42414` y `AcTrView2d` en `:59356`, que toman `_width`/`_height` de `canvas.getBoundingClientRect()`, ya en unidades CSS). Ver `useMlightcadEngine.ts` función `zoomAt`. |
| 2 | El fallback de `worldPoint`/`screenPoint` (motor no inicializado) no invertía el eje Y, a diferencia de la ruta nativa | `MlightcadCanvas2D.tsx:248-251,295-298` (antiguas) | `geometry/coordinateTransform.ts::createCanvasTransforms` implementa el fallback con inversión de Y explícita (`canvasHeightPx - ...`), coherente con el convenio CAD. |
| 3 | `getCanvasScalePxPerMeter` ignoraba su argumento y devolvía siempre 60 | `canvasUtils.ts:65-67` | Se mantiene como valor fijo del fallback (documentado como tal); el path real de conversión pasa siempre por `effectiveScale` en `cadToMeters`/`metersToCad`, no por este valor. |
| 4 | 4 copias independientes de la fórmula de área (shoelace) | `lightingCalculations.ts`, `ambientSpaces.ts`, `export/document/buildDialuxFormalDocument.ts`, `electrical/useElectricalDocument.ts` | Las 4 delegan ahora en `geometry/polygonGeometry.ts::polygonAreaM2`. |

## Sistema canónico de unidades (Fase 1)

- Unidad interna: **metro**. Toda geometría persistida (`Room.vertices`, `Wall.vertices`, `Fixture.x/y`, etc.) está en metros — confirmado en `useCanvasInteraction.ts` (`canvasToScene` = `worldPoint`, siempre en metros antes de llamar a `store.addRoom`/`addWall`/etc).
- `effectiveScale = scaleConfig.factor × scaleConfig.calibrationFactor` (`geometry/coordinateTransform.ts::getEffectiveScale`).
- Sin redondeo prematuro: no hay `toFixed()`/`Math.round()` en el pipeline de dibujo — confirmado en la auditoría original; los únicos `toFixed()` encontrados son de presentación (badges de UI).
- Calibración manual: `geometry/calibration.ts::calibrateScaleConfig` implementa `factorEscala = distanciaReal / distanciaMedida` y el escalado de área con el cuadrado del factor lineal (`scaleAreaByLinearFactor`).

## Pruebas de invariancia (todas verdes, ver `geometry/coordinateTransform.test.ts`)

- Prueba A (distancia): ida/vuelta `screenToScene(sceneToScreen(p)) === p` exacto.
- Prueba B (rectángulo de referencia): 8.000 m × 5.012 m → 40.096 m² exacto.
- Prueba C (zoom 25/100/400%): el área no cambia.
- Prueba D (pan): el área no cambia con cualquier desplazamiento de cámara.
- Prueba E (fallback sin motor CAD): ida/vuelta exacta e independiente del zoom del overlay.
