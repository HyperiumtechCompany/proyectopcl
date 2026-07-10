const DB_NAME = 'dialux-plan-storage';
const STORE_NAME = 'plans';
const DB_VERSION = 1;

export interface StoredDialuxPlan {
    projectId: string;
    fileName: string;
    mimeType: string;
    lastModified: number;
    blob: Blob;
}

function openPlanDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveDialuxPlanFile(projectId: string, file: File): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    const payload: StoredDialuxPlan = {
        projectId,
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

export async function loadDialuxPlan(projectId: string): Promise<StoredDialuxPlan | null> {
    if (typeof indexedDB === 'undefined') return null;

    const db = await openPlanDatabase();
    const plan = await new Promise<StoredDialuxPlan | null>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(projectId);

        request.onsuccess = () => resolve((request.result as StoredDialuxPlan | undefined) ?? null);
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
