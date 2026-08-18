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
    const plan = await new Promise<StoredDialuxPlan | null>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(planKey(projectId, sceneId));

        request.onsuccess = () =>
            resolve((request.result as StoredDialuxPlanRecord | undefined) ?? null);
        request.onerror = () => reject(request.error);
    });
    db.close();

    return plan;
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

export async function uploadDialuxPlanFile(
    projectId: string,
    sceneId: string,
    file: File,
): Promise<{ warning: string | null }> {
    const formData = new FormData();
    formData.append('plan', file);

    const response = await fetch(
        `/dialux/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(sceneId)}`,
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: formData,
        },
    );

    if (!response.ok) {
        throw new Error(`No se pudo guardar el plano en el servidor (HTTP ${response.status}).`);
    }

    const body = (await response.json().catch(() => null)) as { warning?: string | null } | null;
    return { warning: body?.warning ?? null };
}

export async function loadDialuxPlanFromServer(
    projectId: string,
    sceneId: string,
): Promise<StoredDialuxPlan | null> {
    const response = await fetch(
        `/dialux/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(sceneId)}`,
        {
            headers: {
                Accept: 'application/octet-stream',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        },
    );

    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`No se pudo descargar el plano (HTTP ${response.status}).`);
    }

    const blob = await response.blob();
    const encodedName = response.headers.get('X-Dialux-File-Name');

    return {
        projectId,
        sceneId,
        fileName: encodedName ? decodeURIComponent(encodedName) : `plano-${sceneId}.dxf`,
        mimeType: blob.type || 'application/octet-stream',
        lastModified: Date.now(),
        blob,
    };
}

export async function uploadLocalDialuxPlanIfMissing(
    projectId: string,
    sceneId: string,
    plan: StoredDialuxPlan,
): Promise<void> {
    const url = `/dialux/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(sceneId)}`;
    const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    if (response.ok) return;
    if (response.status !== 404) {
        throw new Error(`No se pudo verificar el plano remoto (HTTP ${response.status}).`);
    }

    await uploadDialuxPlanFile(projectId, sceneId, storedDialuxPlanToFile(plan));
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
): Promise<boolean> {
    const response = await fetch(
        `/dialux/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(sceneId)}/link`,
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
        throw new Error(`No se pudo reutilizar el plano en el servidor (HTTP ${response.status}).`);
    }

    const localSource = await loadDialuxPlan(projectId, sourceSceneId);
    if (localSource) {
        await saveDialuxPlanFile(projectId, sceneId, storedDialuxPlanToFile(localSource));
    }

    return true;
}

/** Elimina el vínculo del plano de un piso (ej. al borrarlo). */
export async function unlinkDialuxPlanFile(projectId: string, sceneId: string): Promise<void> {
    await fetch(`/dialux/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(sceneId)}`, {
        method: 'DELETE',
        headers: {
            Accept: 'application/json',
            'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });
}
