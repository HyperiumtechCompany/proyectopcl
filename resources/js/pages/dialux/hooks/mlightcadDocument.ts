import {
    AcApContext,
    AcApDocument,
    AcEdOpenMode,
    type AcApDocManager,
} from '@mlightcad/cad-simple-viewer';

interface BootstrapDatabase {
    createDefaultData?: () => void;
    ensureDatabaseDefaults?: () => void;
    addLayer?: (name: string) => void;
    objects?: {
        layout?: {
            entries?: () => IterableIterator<[string, { blockTableRecordId: string }]>;
        };
    };
    tables?: {
        layerTable?: {
            has?: (name: string) => boolean;
            getAt?: (name: string) => { name: string } | undefined;
            newIterator?: () => IterableIterator<{ name: string }>;
        };
    };
    clayer?: string;
}

type MutableDocManager = {
    _context?: AcApContext;
    setActiveLayout?: () => void;
    events?: {
        documentCreated?: {
            dispatch?: (payload: { doc: AcApDocument }) => void;
        };
        documentActivated?: {
            dispatch?: (payload: { doc: AcApDocument }) => void;
        };
    };
};

export function bootstrapCadDefaults(doc: AcApDocument): AcApDocument {
    const db = doc.database as unknown as BootstrapDatabase | undefined;

    if (!db) {
        return doc;
    }

    if (typeof db.createDefaultData === 'function') {
        db.createDefaultData();
    }

    if (typeof db.ensureDatabaseDefaults === 'function') {
        db.ensureDatabaseDefaults();
    }

    if (
        typeof db.tables?.layerTable?.has === 'function' &&
        !db.tables.layerTable.has('0') &&
        typeof db.addLayer === 'function'
    ) {
        db.addLayer('0');
    }

    db.clayer = '0';

    return doc;
}

export function ensureWritableBlankDocument(
    dm: AcApDocManager,
    options: { forceNew?: boolean } = {},
): AcApDocument {
    const currentDoc = dm.curDocument;

    if (!options.forceNew && currentDoc?.openMode >= AcEdOpenMode.Write) {
        return bootstrapCadDefaults(currentDoc);
    }

    const nextDoc = bootstrapCadDefaults(new AcApDocument());
    const mutableDocManager = dm as unknown as MutableDocManager;
    const db = nextDoc.database as unknown as BootstrapDatabase | undefined;

    dm.curView.clear();
    mutableDocManager._context = new AcApContext(dm.curView, nextDoc);

    if (typeof dm.curView.addLayer === 'function') {
        const registeredLayers = new Set<string>();

        for (const layer of db?.tables?.layerTable?.newIterator?.() ?? []) {
            dm.curView.addLayer(layer as unknown as Parameters<typeof dm.curView.addLayer>[0]);
            registeredLayers.add(layer.name);
        }

        const defaultLayer = db?.tables?.layerTable?.getAt?.('0');
        if (defaultLayer && !registeredLayers.has(defaultLayer.name)) {
            dm.curView.addLayer(defaultLayer as unknown as Parameters<typeof dm.curView.addLayer>[0]);
        }
    }

    if (typeof dm.curView.addLayout === 'function') {
        for (const [, layout] of db?.objects?.layout?.entries?.() ?? []) {
            dm.curView.addLayout(layout as unknown as Parameters<typeof dm.curView.addLayout>[0]);
        }
    }

    mutableDocManager.setActiveLayout?.();
    mutableDocManager.events?.documentCreated?.dispatch?.({ doc: nextDoc });
    mutableDocManager.events?.documentActivated?.dispatch?.({ doc: nextDoc });

    return nextDoc;
}
