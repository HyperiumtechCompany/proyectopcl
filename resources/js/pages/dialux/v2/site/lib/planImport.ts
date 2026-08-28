import { show } from '@/actions/App/Http/Controllers/Dialux/V2/PlanFileController';

/**
 * Reserva un `sceneId` fijo (el backend de planos vincula archivos a
 * `dialuxModule.id` + `sceneId`, pensado originalmente para pisos del
 * editor de interiores) para el plano de fondo del emplazamiento del
 * Módulo General — que no tiene "pisos" en ese sentido. Reusa el MISMO
 * backend (`dialux_plans`/`PlanFileController`) sin cambios de esquema.
 */
export const SITE_PLAN_SCENE_ID = 'site-plan';

/**
 * URL de descarga del plano de emplazamiento ya importado (imagen PNG).
 * `updatedAt` es un cache-buster: la URL vive en una ruta FIJA por
 * proyecto+módulo (no cambia al reimportar), así que sin este parámetro el
 * navegador podría seguir mostrando la imagen vieja en caché tras subir un
 * plano nuevo.
 */
export function sitePlanImageUrl(
    projectId: number,
    generalModuleId: number,
    updatedAt: number,
): string {
    return show.url(
        {
            dialuxProject: projectId,
            dialuxModule: generalModuleId,
            sceneId: SITE_PLAN_SCENE_ID,
        },
        { query: { v: updatedAt } },
    );
}
