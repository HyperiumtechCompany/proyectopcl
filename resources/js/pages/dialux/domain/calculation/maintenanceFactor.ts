import type { ProjectSiteSettings } from '@/pages/dialux/hooks/types';

/**
 * Causa #4 de `planes/plan_precision_fisica_motor_dialux_vs_evo.md` §3.4:
 * hasta esta función, `maintenanceFactor` era SIEMPRE un escalar único
 * (default 0.8) aplicado al final del cálculo — sin distinguir sus cuatro
 * componentes reales (CIE 97:2005 §4, resumido en fuentes secundarias de
 * fabricante como Esse-Ci/TRILUX — el texto oficial de CIE 97:2005 no está
 * verificado en este repositorio, ver `pending-confirmation` abajo):
 *
 *   MF = LLMF × LSF × LMF × RSMF
 *
 *   - LLMF (Lamp Lumen Maintenance Factor): depreciación del flujo de la
 *     lámpara/módulo LED durante el intervalo de mantenimiento.
 *   - LSF (Lamp Survival Factor): fracción de lámparas/módulos que siguen
 *     encendidos al final del intervalo (con LED y garantía declarada,
 *     típicamente 1.0 — casi nunca fallan antes del recambio del conjunto).
 *   - LMF (Luminaire Maintenance Factor / Luminaire Dirt Depreciation):
 *     depreciación por suciedad ACUMULADA EN la luminaria — depende del
 *     grado IP, el tipo de ambiente y el intervalo de limpieza.
 *   - RSMF (Room Surface Maintenance Factor): depreciación por suciedad en
 *     las superficies del recinto (techo/pared/piso) — depende del ambiente
 *     y el intervalo de limpieza, afecta la componente reflejada, no la
 *     directa.
 *
 * Esta función NO reemplaza `maintenanceFactor` para ningún proyecto
 * existente — es aditiva: solo desagrega el cálculo cuando el proyecto
 * declara explícitamente `maintenanceMethod: 'cie_97_2005'` Y los CUATRO
 * componentes. Sin eso, el comportamiento es IDÉNTICO al de siempre
 * (`maintenanceFactor ?? DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor`).
 *
 * Valores típicos de referencia (fuente secundaria, `pending-confirmation`
 * hasta que un ingeniero colegiado confirme contra el texto oficial de
 * CIE 97:2005 — NO usarlos como default silencioso, son solo referencia
 * documental para quien complete el formulario):
 *   - LLMF LED, 50000 h: 0.90-0.95 según fabricante/driver.
 *   - LSF LED con garantía: 1.0 (falla por debajo de umbral de flujo, no
 *     apagado total, dentro del período de garantía declarado).
 *   - LMF, ambiente limpio/interior, IP20, limpieza anual: ~0.90; ambiente
 *     industrial/sucio, limpieza anual: ~0.80; limpieza cada 3 años: ~0.70.
 *   - RSMF, ambiente limpio, limpieza anual: ~0.90; industrial: ~0.80.
 */
const DEFAULT_MAINTENANCE_FACTOR = 0.8;

function isValidComponent(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1;
}

/**
 * Resuelve el factor de mantenimiento EFECTIVO para un proyecto — producto
 * de los 4 componentes CIE 97:2005 cuando `maintenanceMethod === 'cie_97_2005'`
 * y los cuatro están declarados y son válidos (0,1]; en cualquier otro caso,
 * el escalar único `maintenanceFactor` (o el default 0.8 si tampoco está).
 * Nunca lanza — un componente inválido (0, negativo, >1, no numérico) hace
 * caer al escalar único en vez de propagar un `NaN`/valor físicamente
 * imposible al cálculo.
 */
export function resolveMaintenanceFactor(siteSettings: ProjectSiteSettings | undefined): number {
    const fallback = siteSettings?.maintenanceFactor ?? DEFAULT_MAINTENANCE_FACTOR;

    if (siteSettings?.maintenanceMethod !== 'cie_97_2005') {
        return fallback;
    }

    const { lightLossMaintenanceFactor, luminaireSurvivalFactor, luminaireMaintenanceFactor, roomSurfaceMaintenanceFactor } = siteSettings;

    if (
        !isValidComponent(lightLossMaintenanceFactor) ||
        !isValidComponent(luminaireSurvivalFactor) ||
        !isValidComponent(luminaireMaintenanceFactor) ||
        !isValidComponent(roomSurfaceMaintenanceFactor)
    ) {
        return fallback;
    }

    return lightLossMaintenanceFactor * luminaireSurvivalFactor * luminaireMaintenanceFactor * roomSurfaceMaintenanceFactor;
}
