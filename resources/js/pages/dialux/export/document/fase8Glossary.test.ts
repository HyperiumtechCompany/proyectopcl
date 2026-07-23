import { describe, expect, it } from 'vitest';
import type { Project } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxFormalDocument } from './buildDialuxFormalDocument';
import { selectGlossaryEntries } from './glossaryCatalog';
import { buildDialuxExportSnapshot } from '../snapshot/buildDialuxExportSnapshot';
import { buildModuloIProjectFixture } from '../__fixtures__/moduloIFixture';

const VISUAL_CONFIG = {
    showGrid: true,
    showIsolux: true,
    show3DView: false,
    isoluxMode: 'functional' as const,
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedId: null,
};

describe('Fase 8 — glosario y anexos', () => {
    it('selectGlossaryEntries excluye términos condicionales cuando el informe no los usa', () => {
        const entries = selectGlossaryEntries({
            hasCct: false,
            hasCri: false,
            hasIsolux: false,
            hasMultipleLevels: false,
        });

        expect(entries.some((e) => e.term.includes('CCT'))).toBe(false);
        expect(entries.some((e) => e.term.includes('CRI'))).toBe(false);
        expect(entries.some((e) => e.term === 'Isolux')).toBe(false);
        expect(entries.some((e) => e.term === 'Nivel')).toBe(false);
        // Los términos "siempre presentes" sí deben estar.
        expect(entries.some((e) => e.term === 'UGR')).toBe(true);
        expect(entries.some((e) => e.term === 'Plano útil')).toBe(true);
    });

    it('selectGlossaryEntries incluye los términos condicionales cuando sí se usan', () => {
        const entries = selectGlossaryEntries({
            hasCct: true,
            hasCri: true,
            hasIsolux: true,
            hasMultipleLevels: true,
        });

        expect(entries.some((e) => e.term.includes('CCT'))).toBe(true);
        expect(entries.some((e) => e.term.includes('CRI'))).toBe(true);
        expect(entries.some((e) => e.term === 'Isolux')).toBe(true);
        expect(entries.some((e) => e.term === 'Nivel')).toBe(true);
    });

    it('el orden es alfabético en español y estable (no cambia entre llamadas)', () => {
        const ctx = { hasCct: true, hasCri: true, hasIsolux: true, hasMultipleLevels: true };
        const first = selectGlossaryEntries(ctx);
        const second = selectGlossaryEntries(ctx);

        expect(first.map((e) => e.term)).toEqual(second.map((e) => e.term));

        const terms = first.map((e) => e.term);
        const sortedTerms = [...terms].sort((a, b) => a.localeCompare(b, 'es'));
        expect(terms).toEqual(sortedTerms);

        // La letra de agrupación coincide con la primera letra del término.
        for (const entry of first) {
            expect(entry.letter).toBe(entry.term.charAt(0).toLocaleUpperCase('es'));
        }
    });

    it('un proyecto de un solo nivel sin CCT/CRI/isolux no incluye esos términos en el documento final', async () => {
        const project = buildModuloIProjectFixture();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.glossary.some((e) => e.term === 'Nivel')).toBe(false);
        expect(documentModel.glossary.some((e) => e.term.includes('CCT'))).toBe(false);

        const glossaryPages = documentModel.pages.filter(
            (page) => page.kind === 'glossary',
        );
        expect(glossaryPages.length).toBeGreaterThan(0);
    });

    it('un proyecto multinivel incluye el término "Nivel" y pagina el glosario si excede una hoja', async () => {
        const project = buildModuloIProjectFixture();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            includeAllScenes: true,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.glossary.some((e) => e.term === 'Nivel')).toBe(true);

        const glossaryPages = documentModel.pages.filter(
            (page) => page.kind === 'glossary',
        );
        const sortedRanges = [...glossaryPages]
            .map((page) => [page.rowRangeStart ?? 0, page.rowRangeEnd ?? 0] as const)
            .sort((a, b) => a[0] - b[0]);
        expect(sortedRanges[0]![0]).toBe(0);
        expect(sortedRanges.at(-1)![1]).toBe(documentModel.glossary.length);
        for (let i = 1; i < sortedRanges.length; i++) {
            expect(sortedRanges[i]![0]).toBe(sortedRanges[i - 1]![1]);
        }
    });

    it('un proyecto con CCT y CRI en sus luminarias incluye esos términos', async () => {
        const project: Project = buildModuloIProjectFixture();
        const firstScene = project.scenes[0]!;
        firstScene.fixtures = firstScene.fixtures.map((fixture) => ({
            ...fixture,
            cct: 4000,
            cri: 80,
        }));

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: firstScene.id,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.glossary.some((e) => e.term.includes('CCT'))).toBe(true);
        expect(documentModel.glossary.some((e) => e.term.includes('CRI'))).toBe(true);
    });
});
