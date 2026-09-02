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

/**
 * `sceneId` reservado para el ARCHIVO CAD ORIGINAL (dxf/dwg) del
 * emplazamiento, aparte del PNG de `SITE_PLAN_SCENE_ID`.
 *
 * El flujo original solo guardaba el PNG rasterizado, así que el plano no se
 * podía volver a abrir en el motor CAD: sin el archivo original no hay
 * vectores, y sin vectores no hay zoom nítido ni distancias reales — que es
 * de donde sale la caída de tensión del Módulo General. Se guarda el original
 * en paralelo, reusando el mismo backend de planos.
 */
export const SITE_PLAN_SOURCE_SCENE_ID = 'site-plan-source';
