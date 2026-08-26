# ADR 0003 — Versionado de esquemas y motor

- Estado: aceptado (política de versionado, aplicable desde la Fase 1 en adelante).
- Fecha: 2026-08-02.
- Contexto: `planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md` §16.

## Contexto

El plan maestro (§16) enumera seis versiones a mantener
(`projectSchemaVersion`, `photometrySchemaVersion`, `calculationSnapshotVersion`,
`engineVersion`, `resultSchemaVersion`, `reportSchemaVersion`) y exige
migraciones puras y secuenciales (`v1 → v2 → v3`), pero no fija el formato del
identificador ni quién es responsable de incrementarlo. Se decide aquí para
no improvisarlo en medio de la Fase 1.

## Decisión

1. **Formato de las versiones de esquema** (`projectSchemaVersion`,
   `photometrySchemaVersion`, `calculationSnapshotVersion`, `resultSchemaVersion`,
   `reportSchemaVersion`): entero secuencial como string, `"1"`, `"2"`, `"3"` —
   no semver. Estas versiones representan pasos de migración de datos
   persistidos, no compatibilidad de API pública; un entero secuencial hace
   trivial la comparación (`Number(a) < Number(b)`) y evita la ambigüedad de
   qué significa un "minor bump" en un dato serializado.
2. **Formato de `engineVersion`**: string descriptivo con guiones,
   `"<alcance>-<madurez>-v<n>"`. El primer valor es
   `LIGHTING_ENGINE_VERSION = 'direct-preview-v1'`
   (`hooks/lightingEngineCore.ts`). Incrementar el sufijo numérico exige que
   cambie el algoritmo (no el refactor de su código); cambiar `<alcance>` o
   `<madurez>` (p. ej. `direct-standard-v1` cuando se agregue oclusión en
   Fase 6) es una decisión de producto, no solo técnica, y debe reflejarse en
   la matriz de capacidades del §23 del plan maestro.
3. **Quién incrementa cada versión**:
   - `projectSchemaVersion`/`photometrySchemaVersion`: quien cambie la forma
     de los datos persistidos (Laravel/DB) de proyecto o fotometría.
   - `calculationSnapshotVersion`: quien cambie la forma de
     `CalculationSnapshot` (ADR 0002) de forma incompatible con snapshots ya
     serializados.
   - `engineVersion`: quien cambie el algoritmo de un solver (no un refactor
     interno que preserve el resultado — ver §4.6 del plan, "refactor
     seguro").
   - `resultSchemaVersion`/`reportSchemaVersion`: quien cambie la forma de
     `CalculationRun` o de los contratos que consume PDF/DXF/UI.
   Cada incremento se documenta en el commit que lo introduce, no en un
   changelog separado.
4. **Migraciones**: cada paso de versión de esquema tiene una función pura
   `migrateVFromToVTo(data: unknown): unknown`, sin acceso a red/DB dentro de
   la función de migración en sí (la orquestación que decide qué migraciones
   aplicar puede vivir en infraestructura). Nunca se salta un escalón
   (`v1 → v3` directo) — siempre `v1 → v2 → v3`, aunque sea más verboso, para
   que cada paso sea auditable independientemente.
5. **Nunca rellenar en silencio un campo de versión ausente con un default**
   (regla explícita del plan maestro §16). Un dato sin
   `calculationSnapshotVersion`/`engineVersion` se trata como versión
   desconocida y se marca con un warning explícito, nunca se asume `v1`.

## Consecuencias

- `LIGHTING_ENGINE_VERSION` ya sigue este formato desde su introducción en
  Fase 0 (`hooks/lightingEngineCore.ts`) — no requiere cambio para adoptar
  este ADR.
- `CalculationRun.engineVersion` (Fase 1, §8.3 del plan) se puebla desde esta
  misma constante, sin duplicar el string en otro archivo.
- La matriz de capacidades del §23 del plan maestro debe citar el
  `engineVersion` exacto vigente para cada fila, no solo "validado"/"beta" en
  abstracto.
