const DB_NAME = 'dialux-plan-storage';
const STORE_NAME = 'plans';
const DB_VERSION = 2;

export interface StoredDialuxPlan {
    projectId: string;
    sceneId: string;
    fileName: string;
    mimeType: string;
    lastModified: number;
    blob: Blob;
}

interface StoredDialuxPlanRecord extends StoredDialuxPlan {
    key: string;
}

function planKey(projectId: string, sceneId: string): string {
    return `${projectId}::${sceneId}`;
}

function openPlanDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            // v1 guardaba un solo plano por proyecto (keyPath 'projectId'):
            // en un proyecto con varios pisos/escenas, importar el plano de
            // un piso sobreescribía en silencio el de otro. v2 escala la
            // clave por proyecto+escena para que cada piso guarde el suyo.
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveDialuxPlanFile(
    projectId: string,
    sceneId: string,
    file: File,
): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    const payload: StoredDialuxPlanRecord = {
        key: planKey(projectId, sceneId),
        projectId,
        sceneId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        blob: file,
    };

    const db = await openPlanDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        store.put(payload);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    db.close();
}

export async function loadDialuxPlan(
    projectId: string,
    sceneId: string,
): Promise<StoredDialuxPlan | null> {
    if (typeof indexedDB === 'undefined') return null;

    const db = await openPlanDatabase();
    const plan = await new Promise<StoredDialuxPlan | null>(
        (resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(planKey(projectId, sceneId));

            request.onsuccess = () =>
                resolve(
                    (request.result as StoredDialuxPlanRecord | undefined) ??
                        null,
                );
            request.onerror = () => reject(request.error);
        },
    );
    db.close();

    return plan;
}

/**
 * Tope para ABRIR un plano CAD en el navegador (V1 y V2). El motor CAD lo
 * procesa en el hilo principal: un DWG de 15,4 MB ("PLANTA GENERAL.dwg")
 * agotó la memoria de la pestaña en producción ("Out of Memory"). Por encima
 * de esto el archivo se conserva, pero no se abre como vectorial.
 */
export const CAD_OPEN_HARD_MAX_BYTES = {
    dwg: 6_000_000,
    dxf: 20_000_000,
} as const;

export function cadOpenHardMax(fileName: string): number {
    return fileName.toLowerCase().endsWith('.dxf')
        ? CAD_OPEN_HARD_MAX_BYTES.dxf
        : CAD_OPEN_HARD_MAX_BYTES.dwg;
}

/** Quita la copia local (IndexedDB) del plano de una escena. */
export async function deleteDialuxPlanFile(
    projectId: string,
    sceneId: string,
): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openPlanDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(planKey(projectId, sceneId));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    db.close();
}

export function storedDialuxPlanToFile(plan: StoredDialuxPlan): File {
    return new File([plan.blob], plan.fileName, {
        type: plan.mimeType,
        lastModified: plan.lastModified,
    });
}

function readXsrfTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

/**
 * DIALux v2 ("Módulos") vive aislado del editor v1 en un árbol de rutas
 * propio (`/dialux-v2/projects/{project}/modules/{module}/plans/{scene}...`,
 * `routes/web.php`) — un `DialuxModule` NO es un `DialuxProject`, así que
 * las rutas de plano de v1 (`/dialux/{project}/plans/{scene}...`) resuelven
 * contra el `DialuxProject` equivocado (o ninguno) cuando se les pasa un
 * `moduleId`. `EditorLayout.tsx` es compartido entre v1 y v2 — antes de este
 * fix, SIEMPRE armaba la URL de v1 sin importar el contexto, así que
 * cualquier operación de plano dentro de un Módulo (heredar el plano de un
 * piso nuevo, cargarlo en el canvas) fallaba en silencio contra el proyecto
 * equivocado — un piso nuevo de un Módulo quedaba "sin plano" aunque el
 * piso de origen sí lo tuviera. `moduleId` es opcional: `undefined` conserva
 * el comportamiento de v1 exacto (mismo llamador, mismo resultado).
 */
function planFileUrl(
    projectId: string,
    sceneId: string,
    moduleId?: string,
): string {
    return moduleId
        ? `/dialux-v2/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}/plans/${encodeURIComponent(sceneId)}`
        : `/dialux/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(sceneId)}`;
}

export async function uploadDialuxPlanFile(
    projectId: string,
    sceneId: string,
    file: File,
    moduleId?: string,
): Promise<{ warning: string | null }> {
    const formData = new FormData();
    formData.append('plan', file);

    const response = await fetch(planFileUrl(projectId, sceneId, moduleId), {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(
            `No se pudo guardar el plano en el servidor (HTTP ${response.status}).`,
        );
    }

    const body = (await response.json().catch(() => null)) as {
        warning?: string | null;
    } | null;
    return { warning: body?.warning ?? null };
}

export async function loadDialuxPlanFromServer(
    projectId: string,
    sceneId: string,
    moduleId?: string,
): Promise<StoredDialuxPlan | null> {
    const response = await fetch(planFileUrl(projectId, sceneId, moduleId), {
        headers: {
            Accept: 'application/octet-stream',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(
            `No se pudo descargar el plano (HTTP ${response.status}).`,
        );
    }

    const blob = await response.blob();
    const encodedName = response.headers.get('X-Dialux-File-Name');

    return {
        projectId,
        sceneId,
        fileName: encodedName
            ? decodeURIComponent(encodedName)
            : `plano-${sceneId}.dxf`,
        mimeType: blob.type || 'application/octet-stream',
        lastModified: Date.now(),
        blob,
    };
}

export async function uploadLocalDialuxPlanIfMissing(
    projectId: string,
    sceneId: string,
    plan: StoredDialuxPlan,
    moduleId?: string,
): Promise<void> {
    const url = planFileUrl(projectId, sceneId, moduleId);
    const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    if (response.ok) return;
    if (response.status !== 404) {
        throw new Error(
            `No se pudo verificar el plano remoto (HTTP ${response.status}).`,
        );
    }

    await uploadDialuxPlanFile(
        projectId,
        sceneId,
        storedDialuxPlanToFile(plan),
        moduleId,
    );
}

/**
 * Vincula el plano de `sourceSceneId` al piso `sceneId` en el servidor sin
 * duplicar el archivo (varios pisos pueden compartir el mismo plano), y
 * copia la caché local para que el piso nuevo lo muestre sin ir a red.
 */
export async function linkDialuxPlanFile(
    projectId: string,
    sceneId: string,
    sourceSceneId: string,
    moduleId?: string,
): Promise<boolean> {
    const response = await fetch(
        `${planFileUrl(projectId, sceneId, moduleId)}/link`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify({ source_scene_id: sourceSceneId }),
        },
    );

    if (response.status === 404) return false;
    if (!response.ok) {
        throw new Error(
            `No se pudo reutilizar el plano en el servidor (HTTP ${response.status}).`,
        );
    }

    const localSource = await loadDialuxPlan(projectId, sourceSceneId);
    if (localSource) {
        await saveDialuxPlanFile(
            projectId,
            sceneId,
            storedDialuxPlanToFile(localSource),
        );
    }

    return true;
}

/** Vínculo piso→archivo devuelto por `GET .../plans`. */
export interface DialuxPlanBinding {
    scene_id: string;
    plan_id: number;
    original_name: string | null;
    size_bytes: number | null;
}

function plansCollectionUrl(projectId: string, moduleId?: string): string {
    return moduleId
        ? `/dialux-v2/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}/plans`
        : `/dialux/${encodeURIComponent(projectId)}/plans`;
}

/**
 * Devuelve, por piso con plano, a qué archivo apunta — para que el editor
 * muestre si el plano de un piso es propio o compartido con otros pisos
 * (varios `scene_id` con el mismo `plan_id`).
 */
export async function fetchDialuxPlanBindings(
    projectId: string,
    moduleId?: string,
): Promise<DialuxPlanBinding[]> {
    const response = await fetch(plansCollectionUrl(projectId, moduleId), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });
    if (!response.ok) {
        throw new Error(
            `No se pudieron cargar los planos (HTTP ${response.status}).`,
        );
    }
    const body = (await response.json().catch(() => null)) as {
        bindings?: DialuxPlanBinding[];
    } | null;
    return body?.bindings ?? [];
}

/** Elimina el vínculo del plano de un piso (ej. al borrarlo). */
export async function unlinkDialuxPlanFile(
    projectId: string,
    sceneId: string,
    moduleId?: string,
): Promise<void> {
    await fetch(planFileUrl(projectId, sceneId, moduleId), {
        method: 'DELETE',
        headers: {
            Accept: 'application/json',
            'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });
}

/** Estado de la versión ligera de un plano CAD pesado (la genera el servidor en segundo plano). */
export interface DialuxPlanLayer {
    name: string;
    entities: number;
    /** Peso aproximado de la capa en la versión ligera (con sus bloques exclusivos). */
    bytes: number;
    /** Elegida por defecto (las decorativas vienen desmarcadas). */
    keep: boolean;
}

export interface DialuxPlanLightStatus {
    needs_light: boolean;
    status: 'pending' | 'processing' | 'ready' | 'failed' | 'needs_layers' | null;
    size_bytes: number;
    light_size_bytes: number | null;
    error: string | null;
    updated_at: number | null;
    /** `geometry` = geometría binaria del plano COMPLETO (se dibuja con WebGL); `dxf` = método anterior. */
    format?: 'geometry' | 'dxf';
    /** Capas con su peso (cuando el plano completo no cabe en el navegador). */
    layers: DialuxPlanLayer[] | null;
    /** Lo que queda siempre (cabecera, tablas, bloques compartidos). */
    base_bytes: number | null;
    dxf_bytes: number | null;
    /** Tope que el navegador puede abrir. */
    cap_bytes: number;
}

/** Consulta (y, para planos subidos antes, pone en cola) la versión ligera. `null` si el plano no está en el servidor. */
export async function fetchDialuxPlanLightStatus(
    projectId: string,
    sceneId: string,
    moduleId: string,
): Promise<DialuxPlanLightStatus | null> {
    const response = await fetch(`${planFileUrl(projectId, sceneId, moduleId)}/light/status`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });
    if (!response.ok) return null;
    return (await response.json()) as DialuxPlanLightStatus;
}

/** Vuelve a poner en cola la versión ligera (tras un fallo). */
export async function retryDialuxPlanLight(
    projectId: string,
    sceneId: string,
    moduleId: string,
): Promise<DialuxPlanLightStatus | null> {
    const response = await fetch(`${planFileUrl(projectId, sceneId, moduleId)}/light/retry`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });
    if (!response.ok) return null;
    return (await response.json()) as DialuxPlanLightStatus;
}

/**
 * Descarga la versión ligera (DXF). Se guarda en la caché local con su
 * `updated_at` para no volver a bajarla mientras el plano no cambie.
 */
export async function loadDialuxPlanLightFile(
    projectId: string,
    sceneId: string,
    moduleId: string,
    version: number,
): Promise<File | null> {
    const cacheScene = `${sceneId}::light`;
    const cached = await loadDialuxPlan(projectId, cacheScene);
    if (cached && cached.lastModified === version) return storedDialuxPlanToFile(cached);
    const response = await fetch(`${planFileUrl(projectId, sceneId, moduleId)}/light`, {
        headers: { Accept: 'application/octet-stream', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    const file = new File([blob], 'plano-ligero.dxf', { type: 'application/dxf', lastModified: version });
    try {
        await saveDialuxPlanFile(projectId, cacheScene, file);
    } catch {
        /* sin caché local: se vuelve a descargar la próxima vez */
    }
    return file;
}

/**
 * Descarga la GEOMETRÍA del plano pesado (`.dxg`, generada en el servidor):
 * el plano completo reducido a trazos por capa, que se dibuja con WebGL. Va
 * comprimida (gzip) y el navegador la descomprime solo. Se guarda en la
 * caché local con su `updated_at` para no volver a bajarla.
 */
export async function loadDialuxPlanGeometry(
    projectId: string,
    sceneId: string,
    moduleId: string,
    version: number,
): Promise<ArrayBuffer | null> {
    const cacheScene = `${sceneId}::geometry`;
    try {
        const cached = await loadDialuxPlan(projectId, cacheScene);
        if (cached && cached.lastModified === version) return await cached.blob.arrayBuffer();
    } catch {
        /* caché local no disponible: se descarga */
    }
    const response = await fetch(`${planFileUrl(projectId, sceneId, moduleId)}/light`, {
        headers: { Accept: 'application/octet-stream', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    try {
        await saveDialuxPlanFile(
            projectId,
            cacheScene,
            new File([buffer], 'plano.dxg', { type: 'application/octet-stream', lastModified: version }),
        );
    } catch {
        /* sin caché local: se vuelve a descargar la próxima vez */
    }
    return buffer;
}
