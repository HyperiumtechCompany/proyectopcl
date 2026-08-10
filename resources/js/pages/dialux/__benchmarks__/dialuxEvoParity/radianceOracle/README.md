# Oráculo de validación con Radiance

Origen: `planes/plan_cierre_brecha_paridad_dialux_evo.md` §-6. Investigación de por qué el usuario preguntó "¿existe un motor de código abierto que podamos clonar para mejorar el sistema?" — respuesta corta: **no existe repositorio público de DIALux evo (es software comercial de código cerrado), pero sí existe [Radiance](https://github.com/LBNL-ETA/Radiance) (Lawrence Berkeley National Lab), el motor de simulación lumínica de código abierto validado académicamente contra casos analíticos CIE**, con licencia permisiva estilo BSD (verificada directamente, segura para uso comercial).

## Qué es esto y qué NO es

Esta carpeta **no reemplaza** el motor de cálculo del producto (`direct-preview-v1`, `hooks/lightingEngineCore.ts`). Es una herramienta de **validación independiente**: nos deja calcular la iluminancia físicamente correcta (radiosidad completa, sin las aproximaciones de un solo rebote que usa nuestro motor) para cualquier ambiente/luminaria, y compararla contra:

1. Lo que reporta nuestro propio motor (`first-bounce` e `iterative`).
2. Lo que reportó DIALux evo en un PDF real, cuando se tiene uno.

Esto resuelve un bloqueo real que arrastraba la investigación desde antes de esta ronda: no se puede seguir investigando la Causa B (`first-bounce` vs. `iterative`, ver el plan) sin depender de tener acceso a una licencia de DIALux evo para cada caso nuevo. Con Radiance, cualquiera del equipo puede generar un tercer punto de referencia físico para cualquier ambiente, sin esa dependencia.

**Nunca se ejecuta como parte del producto** — ni en el cálculo en vivo del editor, ni en la exportación de PDF. Es una herramienta de desarrollo/investigación, opcional, que requiere instalar Radiance aparte.

## Instalación de Radiance

1. Descargar el build oficial de tu sistema operativo desde <https://github.com/LBNL-ETA/Radiance/releases/latest> (usar el asset `Radiance_<hash>_Windows.zip`, `_Linux.zip`, o el `.pkg`/`.zip` de macOS — NO hace falta instalador, el zip es portable).
2. Descomprimir en cualquier carpeta, por ejemplo `C:\radiance\` o `~/radiance/`. Debe quedar una carpeta `bin/` (con `oconv`, `rtrace`, `ies2rad`, etc.) y una carpeta `lib/` hermana (con los archivos `.cal` que esos binarios necesitan en tiempo de ejecución).
3. Exportar la variable de entorno `RADIANCE_BIN_DIR` apuntando a esa carpeta `bin/`:
   - PowerShell: `$env:RADIANCE_BIN_DIR = "C:\radiance\bin"`
   - Bash: `export RADIANCE_BIN_DIR="/ruta/a/radiance/bin"`

**Licencia**: Radiance se distribuye bajo una licencia propia estilo BSD (permisiva, sin copyleft) — ver `License.txt` en el propio repositorio de Radiance. No se vendorea ningún binario de Radiance en este repositorio; cada quien instala su propia copia siguiendo el paso 1.

## Cómo correrlo

Sin `RADIANCE_BIN_DIR` configurada, los tests de esta carpeta se SALTAN automáticamente (nunca fallan por falta de instalación):

```bash
npx vitest run resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle
```

Con Radiance instalado:

```bash
RADIANCE_BIN_DIR=/ruta/a/radiance/bin npx vitest run resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle
```

Cada corrida completa (2 fixtures × luz directa + reflexión completa) toma entre 1 y 3 minutos en una laptop normal — el cálculo de radiosidad de Radiance es deliberadamente más lento y más preciso que el motor propio (que calcula en milisegundos); por diseño no se ejecuta en ningún flujo de usuario.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `generateIes.ts` | Genera un archivo IES (LM-63-2002) a partir de un `Fixture` de este proyecto, muestreando `candela()` — la MISMA función que usa el motor real, real o Lambertiana, para que el oráculo compare siempre contra lo que el motor calcula hoy. |
| `generateRoomScene.ts` | Genera la geometría Radiance (`.rad`) de un ambiente rectangular con materiales `plastic` difusos por reflectancia declarada. Normales verificadas geométricamente (no a mano) en `generateRoomScene.test.ts`. |
| `generateSensorGrid.ts` | Grilla de sensores horizontales sobre el plano útil, excluyendo la zona marginal declarada. |
| `runRadianceOracle.ts` | Orquesta: IES → `ies2rad` → posicionar → escena + luminarias → `oconv` → `rtrace` (directo y con reflexión) → promedio en lux (conversión W/m² × 179). |
| `radianceOracle.test.ts` | Integración: corre el oráculo sobre los fixtures de `../fixtures.ts`, valida el montaje contra el motor propio, y compara contra los valores ya registrados en la Ronda 6. |

## Resultados ya registrados (Ronda 6, sin re-correr)

Todos los valores son "como nuevo" (sin factor de mantenimiento — Radiance no lo conoce; para comparar contra un valor que sí lo tenga, multiplicar por ese factor).

| Ambiente | Fotometría | Radiance (radiosidad completa) | `first-bounce` | `iterative` |
|---|---|---:|---:|---:|
| Baño/SS.HH (2.209×0.950 m) | Real (TEG18046) | 160.5 lx | 150.0 lx (**6.5%** de error) | 189.4 lx (18.0%) |
| Caseta/Guarderías (2.1×2.21 m) | Lambertiana (misma en ambos sistemas) | 170.9 lx | 135.5 lx (20.7%) | 180.9 lx (**5.9%**) |

Valores "como nuevo" (sin factor de mantenimiento). Los de `sshh-vs-bano` se corrigieron en la Ronda 8 (`plan_cierre_brecha_paridad_dialux_evo.md` §-8): `realPhotometry.ts` tenía un bug propio de escala ×1.365 en la tabla de candela (Eulumdat expresa candela en cd/klm, no candela absoluta — corregido y verificado contra el parser real de producción, insertando la misma luminaria en el catálogo real de la app). El error relativo de `first-bounce`/`iterative` contra Radiance NO cambió con la corrección (6.5%/18.0%, prácticamente igual a antes) — es la firma esperada de haber corregido un factor de escala puro, ver el plan para el razonamiento completo.

**Conclusión de la Ronda 6, todavía vigente**: no hay un modo ganador universal — cuál de los dos (`first-bounce`/`iterative`) se acerca más a la física real depende de la geometría del ambiente. Ver el plan para el detalle y los próximos pasos (correr 3-5 formas de ambiente más antes de considerar cualquier cambio de configuración de producción).

## Limitaciones declaradas

- Solo ambientes rectangulares simples (`generateRoomScene.ts`), sin mobiliario ni aberturas.
- Solo luminarias rotacionalmente simétricas (`generateIes.ts` — un solo plano C). Una óptica asimétrica real (ej. GF19140 "Corridor Lens", si se consigue su IES/LDT real) necesitaría extender esto a varios planos C.
- La conversión W/m² → lux (constante 179) fue validada empíricamente contra el motor propio en dos casos (1.9% y 4.7% de diferencia en luz directa) — no es una prueba matemática, es una validación cruzada.
