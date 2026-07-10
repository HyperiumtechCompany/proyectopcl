import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatchCreated = vi.fn();
const dispatchActivated = vi.fn();
const clearView = vi.fn();
const addLayout = vi.fn();
const addLayer = vi.fn();
const setActiveLayout = vi.fn();
const createDefaultData = vi.fn();
const ensureDatabaseDefaults = vi.fn();
const getLayerAt = vi.fn((name: string) =>
    name === '0'
        ? {
              name: '0',
          }
        : undefined,
);
const iterateLayers = vi.fn(() =>
    [
        {
            name: '0',
        },
    ][Symbol.iterator](),
);

vi.mock('@mlightcad/cad-simple-viewer', () => {
    enum AcEdOpenMode {
        Read = 0,
        Review = 4,
        Write = 8,
    }

    class AcApDocument {
        public openMode = AcEdOpenMode.Write;
        public fileName = '';
        public docTitle = 'Untitled';
        public database = {
            clayer: '',
            createDefaultData,
            ensureDatabaseDefaults,
            objects: {
                layout: {
                    entries: () =>
                        new Map([
                            [
                                'Model',
                                {
                                    blockTableRecordId: '28',
                                },
                            ],
                        ]).entries(),
                },
            },
            tables: {
                layerTable: {
                    has: vi.fn().mockReturnValue(true),
                    getAt: getLayerAt,
                    newIterator: iterateLayers,
                },
            },
        };
    }

    class AcApContext {
        public view: unknown;
        public doc: unknown;

        public constructor(view: unknown, doc: unknown) {
            this.view = view;
            this.doc = doc;
        }
    }

    return {
        AcApContext,
        AcApDocument,
        AcEdOpenMode,
    };
});

import {
    bootstrapCadDefaults,
    ensureWritableBlankDocument,
} from './mlightcadDocument';
import {
    AcApDocument,
    AcEdOpenMode,
} from '@mlightcad/cad-simple-viewer';

describe('mlightcadDocument', () => {
    beforeEach(() => {
        dispatchCreated.mockClear();
        dispatchActivated.mockClear();
        clearView.mockClear();
        addLayout.mockClear();
        setActiveLayout.mockClear();
        createDefaultData.mockClear();
        ensureDatabaseDefaults.mockClear();
        addLayer.mockClear();
        getLayerAt.mockClear();
        iterateLayers.mockClear();
    });

    it('bootstraps default writable data on the current document', () => {
        const doc = bootstrapCadDefaults(new AcApDocument());

        expect(doc.database.clayer).toBe('0');
        expect(createDefaultData).toHaveBeenCalled();
        expect(ensureDatabaseDefaults).toHaveBeenCalled();
    });

    it('creates a fresh writable blank document when forced', () => {
        const currentDoc = new AcApDocument();
        (currentDoc as { openMode: AcEdOpenMode }).openMode = AcEdOpenMode.Read;

        const manager: {
            curDocument: AcApDocument;
            curView: {
                clear: typeof clearView;
                addLayer: typeof addLayer;
                addLayout: typeof addLayout;
            };
            _context?: { doc?: AcApDocument };
            setActiveLayout: typeof setActiveLayout;
            events: {
                documentCreated: { dispatch: typeof dispatchCreated };
                documentActivated: { dispatch: typeof dispatchActivated };
            };
        } = {
            curDocument: currentDoc,
            curView: { clear: clearView, addLayer, addLayout },
            _context: undefined,
            setActiveLayout,
            events: {
                documentCreated: { dispatch: dispatchCreated },
                documentActivated: { dispatch: dispatchActivated },
            },
        };

        const nextDoc = ensureWritableBlankDocument(manager as never, {
            forceNew: true,
        });

        expect(nextDoc).not.toBe(currentDoc);
        expect(nextDoc.openMode).toBe(AcEdOpenMode.Write);
        expect(manager._context?.doc).toBe(nextDoc);
        expect(clearView).toHaveBeenCalled();
        expect(addLayer).toHaveBeenCalledWith(
            expect.objectContaining({ name: '0' }),
        );
        expect(addLayout).toHaveBeenCalledWith(
            expect.objectContaining({ blockTableRecordId: '28' }),
        );
        expect(setActiveLayout).toHaveBeenCalled();
        expect(dispatchCreated).toHaveBeenCalledWith({ doc: nextDoc });
        expect(dispatchActivated).toHaveBeenCalledWith({ doc: nextDoc });
    });
});
