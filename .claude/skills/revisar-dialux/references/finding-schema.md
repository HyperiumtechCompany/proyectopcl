# Contrato `DialuxReviewFinding` (Fase 1)

Este es el formato de salida obligatorio para los cinco agentes definidos en `planes/plan_agentes_skills_revision_normativa_dialux.md` §8 (`dialux-calc-reviewer`, `dialux-electrical-reviewer`, `dialux-geometry-reviewer`, `dialux-drawing-reviewer`, `dialux-normativa-auditor`). Ningún agente debe inventar un formato propio: si un agente reporta hallazgos, deben tener esta forma.

## Esquema

```ts
interface DialuxReviewFinding {
    domain: 'calculo' | 'electrico' | 'geometria' | 'dibujo' | 'normativa';
    projectType: 'industrial' | 'vivienda' | 'educacion' | 'todos';
    level: string | 'todos' | 'no-aplica';
    severity: 'bloqueante' | 'mayor' | 'menor' | 'informativo';
    file: string;
    line?: number;
    summary: string;
    failureScenario: string;
    norm?: {
        source: string;
        edition: string;
        articleOrTable: string;
        confirmationStatus: 'confirmed' | 'pending-confirmation';
    };
    status: 'confirmado' | 'plausible' | 'no-evaluado';
}
```

## Criterios objetivos de severidad

| Severidad | Criterio objetivo |
|---|---|
| `bloqueante` | El hallazgo puede producir una decisión de obra incorrecta con consecuencia física directa (subdimensionar un conductor, calcular menos luminarias de las necesarias en una ruta de evacuación, eliminar un ambiente completo por error de selección) O presenta un valor "conforme"/"cumple" sin fuente normativa que lo sostenga. |
| `mayor` | El hallazgo afecta la exactitud del resultado o su trazabilidad, pero no representa por sí solo una decisión de obra insegura inmediata (ej. dos catálogos normativos que podrían divergir, uniformidad estimada por una heurística en vez del motor real, sin que el usuario lo sepa). |
| `menor` | Desviación de buenas prácticas, mantenibilidad o consistencia que no cambia el resultado numérico entregado al usuario. |
| `informativo` | Observación de contexto, supuesto documentado que ya está marcado como pendiente de confirmación, o mejora sugerida sin urgencia. |

## Reglas de uso obligatorias

1. Si `norm` está presente y `norm.confirmationStatus` es `pending-confirmation`, entonces `status` debe ser `'no-evaluado'`. Nunca `'confirmado'` con una norma no confirmada.
2. `level` es obligatorio (no puede omitirse) cuando el proyecto auditado tiene más de un nivel/piso. Usar `'todos'` solo si el mismo hallazgo se verificó explícitamente en cada nivel, no por asunción.
3. `failureScenario` debe describir una entrada concreta y su consecuencia (p. ej. "un aula con illuminanceLux=500 usando el catálogo A pero 300 en el catálogo B produciría una cantidad de luminarias distinta según qué panel de la UI consulte el proyectista"), nunca una frase abstracta como "podría haber un problema de consistencia".
4. Un agente nunca debe emitir un hallazgo con `status: 'confirmado'` si no citó su fuente (`norm.source` + `norm.edition` + `norm.articleOrTable`) cuando el hallazgo depende de un umbral normativo. Los hallazgos puramente de código (ej. duplicación de lógica, falta de test) no requieren `norm`.

## Formato de tabla consolidada

```text
| Severidad   | Dominio  | Nivel | Archivo:línea | Resumen | Norma | Estado |
|-------------|----------|-------|---------------|---------|-------|--------|
| bloqueante  | calculo  | todos | hooks/lightingCalculations.ts:188 | ... | — | confirmado |
```

El orquestador `revisar-dialux` (Fase 7, `.claude/skills/revisar-dialux/SKILL.md`) usa este formato para consolidar los hallazgos de los cinco agentes en una sola tabla. Si se invoca un agente de forma individual (fuera del orquestador), debe presentar igualmente sus hallazgos en esta misma tabla, ordenados de mayor a menor severidad.
