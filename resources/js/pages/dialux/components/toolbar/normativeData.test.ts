import { describe, expect, it } from 'vitest';
import { getCategoryOptions } from '@/pages/dialux/hooks/roomLighting';
import { ALL_STANDARDS } from './normativeData';

describe('catálogos normativos del toolbar', () => {
    it.each([
        ['en_12464_1', 'Europa'],
        ['iesna_handbook', 'Estados Unidos'],
        ['rne_peru', 'Perú'],
        ['en_1838', 'Emergencia europea'],
    ] as const)('%s dispone de áreas para %s', (standard, _region) => {
        expect(getCategoryOptions(standard).length).toBeGreaterThan(0);
    });

    it('cada estándar visible tiene secciones y aplicaciones seleccionables', () => {
        for (const standard of ALL_STANDARDS) {
            expect(standard.sections.length).toBeGreaterThan(0);
            for (const section of standard.sections) {
                const profiles = [
                    ...(section.profiles ?? []),
                    ...(section.subsections ?? []).flatMap(
                        (subsection) => subsection.profiles,
                    ),
                ];
                expect(profiles.length).toBeGreaterThan(0);
            }
        }
    });
});

